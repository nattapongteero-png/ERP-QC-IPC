# Data Model: Material Withdrawal Approval

**Branch**: `018-material-withdrawal-approval`
**Date**: 2026-06-02
**Storage**: MySQL (prod) + SQLite (test) via Drizzle dual-schema

## Entity Relationship Diagram

```text
work_orders ──┬─< material_withdrawal_requests ──< material_withdrawal_request_items
              │           │
              │           ├─< material_withdrawal_attachments
              │           │
              │           └─── material_withdrawal_approvals (1:0..1)
              │                       │
              │                       └─── signatures (FK)
              │
              └─< material_consumption  (extend: +additional_qty_via_withdrawal_request)

users ────────< material_withdrawal_requests.requested_by_user_id
users ────────< material_withdrawal_approvals.approver_user_id

factories ────< material_withdrawal_requests.factory_id
factories ────< material_withdrawal_rules.factory_id

materials ────< material_withdrawal_request_items.material_id
material_categories ──< material_withdrawal_rules.material_category

deviations (existing) ──── extend: +withdrawal_request_id (FK, nullable)
inventory_transactions (existing) ──── created on approve (FK ref unchanged)
```

## New Entities

### 1. `material_withdrawal_requests`

Header record for a withdrawal request.

| Column | Type (SQLite / MySQL) | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER PK auto / INT PK auto | NOT NULL | |
| `work_order_id` | INTEGER / INT | FK → `work_orders.id`, NOT NULL, ON DELETE RESTRICT | The WO being augmented |
| `factory_id` | INTEGER / INT | FK → `factories.id`, NOT NULL | For filtering / cap lookup |
| `requested_by_user_id` | INTEGER / INT | FK → `users.id`, NOT NULL | Operator who created request |
| `requested_at` | TEXT (ISO) / DATETIME | NOT NULL, default `getNow()` | |
| `status` | TEXT / VARCHAR(20) | NOT NULL, default `'pending'`; CHECK in app: pending / approved / rejected / cancelled | State of request |
| `reason_type` | TEXT / VARCHAR(40) | NOT NULL; values: `machine_setup_loss` / `equipment_trial_run` / `parameter_adjustment` / `other` | Discriminator for reason |
| `reason_detail` | TEXT / TEXT | NULL | Free-text required when reason_type=`other` (enforced in Zod) |
| `machine_phase` | TEXT / VARCHAR(40) | NULL | Required when reason_type=`machine_setup_loss` (enforced in Zod) |
| `room_id` | INTEGER / INT | FK → `rooms.id`, NOT NULL | Where incident occurred |
| `cancelled_reason` | TEXT / TEXT | NULL | Reason set when WO closed/cancelled etc. |
| `created_at` | TEXT / DATETIME | NOT NULL | |
| `updated_at` | TEXT / DATETIME | NOT NULL | |

**State transitions:**

```text
pending ──approve──> approved (terminal)
pending ──reject──> rejected (terminal)
pending ──auto───> cancelled (WO closed / system event)
```

Approved/rejected/cancelled records are **immutable** (FR-028).

**Indexes:** `(work_order_id, status)`, `(factory_id, requested_at)`, `(requested_by_user_id)`.

### 2. `material_withdrawal_request_items`

Line items in a request (a request can include multiple materials).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | PK auto | | |
| `request_id` | FK → `material_withdrawal_requests.id` | NOT NULL, ON DELETE CASCADE | |
| `material_id` | FK → `materials.id` (items table) | NOT NULL, ON DELETE RESTRICT | Must be in BOM of the WO — validated in service |
| `quantity_requested` | DECIMAL(18,4) (TEXT in SQLite parsed in app) | NOT NULL, > 0 | Requested amount |
| `quantity_approved` | DECIMAL(18,4) | NULL when pending; set on approve | Supervisor may approve a different (lower) amount |
| `unit` | TEXT VARCHAR(20) | NOT NULL | Must match BOM unit |
| `bom_planned_quantity` | DECIMAL(18,4) | NOT NULL | Snapshot of planned BOM qty for traceability |
| `cumulative_extra_after_approve` | DECIMAL(18,4) | NULL until approved | Sum of all prior approved extras + this one (denormalized for fast cap check) |
| `created_at` | DATETIME / TEXT | NOT NULL | |

**Indexes:** `(request_id)`, `(material_id, request_id)`.

### 3. `material_withdrawal_approvals`

The single approval/rejection action per request (1:1 max with request).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | PK auto | | |
| `request_id` | FK → `material_withdrawal_requests.id` | NOT NULL UNIQUE, ON DELETE RESTRICT | Enforce 1 approval per request |
| `approver_user_id` | FK → `users.id` | NOT NULL | Must hold `production:withdrawal:approve` |
| `action` | VARCHAR(10) / TEXT | NOT NULL; values: `approve` / `reject` | |
| `action_at` | DATETIME / TEXT | NOT NULL | |
| `reason` | TEXT | NOT NULL when action=`reject`, optional when `approve` | |
| `signature_id` | FK → `signatures.id` | NOT NULL | Reuses E-sig table |
| `created_at` | DATETIME / TEXT | NOT NULL | |

**Indexes:** `(request_id) UNIQUE`, `(approver_user_id, action_at)`.

### 4. `material_withdrawal_attachments`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | PK auto | | |
| `request_id` | FK → `material_withdrawal_requests.id` | NOT NULL, ON DELETE CASCADE | |
| `file_url` | TEXT | NOT NULL | Storage URL |
| `file_name` | TEXT VARCHAR(255) | NOT NULL | Original name |
| `mime_type` | TEXT VARCHAR(80) | NOT NULL | |
| `size_bytes` | INTEGER / BIGINT | NOT NULL | Max 5 MB (enforced in API) |
| `uploaded_by_user_id` | FK → `users.id` | NOT NULL | |
| `uploaded_at` | DATETIME / TEXT | NOT NULL | |

**Constraint:** Max 5 attachments per request (enforced in service layer).

### 5. `material_withdrawal_rules`

Per-factory / per-material-category soft and hard caps.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | PK auto | | |
| `factory_id` | FK → `factories.id` (nullable) | NULL = any factory | Hierarchical lookup |
| `material_category` | VARCHAR(40) (nullable) | NULL = any category | Values: `active_ingredient` / `excipient` / `packaging` / `other` |
| `soft_cap_percent` | DECIMAL(5,2) | NOT NULL, 0–999 | e.g. 10.00 = 10% |
| `hard_cap_percent` | DECIMAL(5,2) | NOT NULL, 0–999 | e.g. 50.00 = 50% |
| `is_active` | BOOLEAN / INTEGER | NOT NULL, default 1 | Soft-delete |
| `created_by_user_id` | FK → `users.id` | NOT NULL | |
| `created_at` | DATETIME / TEXT | NOT NULL | |
| `updated_at` | DATETIME / TEXT | NOT NULL | |

**Lookup precedence (per FR-013 + R9):**

1. (factory_id = X, material_category = Y) → use
2. else (factory_id = X, material_category = NULL) → use
3. else (factory_id = NULL, material_category = Y) → use
4. else (factory_id = NULL, material_category = NULL) → use (global default; seeded as 10/50)

**Seed defaults:** Insert (NULL, NULL, 10.00, 50.00) on first migration.

**Indexes:** `(factory_id, material_category) UNIQUE` (with NULLs treated as wildcards).

## Extended Entities

### `material_consumption` (existing — add 1 column)

| New Column | Type | Description |
|---|---|---|
| `additional_qty_via_withdrawal_request` | DECIMAL(18,4) NOT NULL DEFAULT 0 | Sum of approved extras for this WO+material |

This avoids recomputing the sum on every consumption read.

### `deviations` (existing — add 1 column)

| New Column | Type | Description |
|---|---|---|
| `withdrawal_request_id` | FK → `material_withdrawal_requests.id` (nullable) | NULL when deviation has unrelated origin |

Enables: "show me the original request for this deviation."

## Permissions (in existing permission table)

Two new permission rows:

| Permission | Description | Default Roles |
|---|---|---|
| `production:withdrawal:request` | Create a request | Production Operator, Production Supervisor |
| `production:withdrawal:approve` | Approve / reject | **Production Supervisor only** |
| `production:withdrawal:configure` | Edit rules (caps) | System Admin, Factory Manager |

## Validation Rules (Zod, summarized)

```text
CreateRequest:
  workOrderId: int, must be active WO
  items: array(min 1, max 20) of {
    materialId: int (must be in WO BOM)
    quantityRequested: number(>0)
    unit: string (must match BOM unit)
  }
  reasonType: enum
  reasonDetail: string (required if reasonType='other')
  machinePhase: string (required if reasonType='machine_setup_loss')
  roomId: int (must be active room of factory)
  attachmentIds: array(max 5) of int (optional)

ApproveRequest:
  approvedItems: array of { itemId: int, quantityApproved: number(>=0, <= quantityRequested) }
  comment: string (optional)
  password: string (for e-sig verification)

RejectRequest:
  reason: string (min 10 chars)
  password: string (for e-sig)
```

## Audit Trail

Every INSERT / UPDATE goes through `auditedInsert / auditedUpdate` from `src/lib/db/audit-wrapper.ts`. Existing `audit_trail` table captures `(table, id, user_id, action, old_values JSON, new_values JSON, timestamp)`.

No new audit columns needed.

## Migration Order

1. Add columns to `material_consumption`, `deviations` (nullable so no data backfill needed)
2. Create `material_withdrawal_rules` + seed default row
3. Create `material_withdrawal_requests`
4. Create `material_withdrawal_request_items`
5. Create `material_withdrawal_attachments`
6. Create `material_withdrawal_approvals`
7. Insert permissions + role assignments
8. Register doc type in `approval-workflow.service.ts`

Each step is independently revertible.

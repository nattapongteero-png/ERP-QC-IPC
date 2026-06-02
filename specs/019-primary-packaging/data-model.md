# Data Model: Primary Packaging Material Issuance & Return

**Branch**: `019-primary-packaging`
**Date**: 2026-06-02
**Storage**: MySQL (prod) + SQLite (test) via Drizzle dual-schema

## Entity Relationship Diagram

```text
work_orders ──< wo_packaging_materials  (extend)
                       │       (= "Issuance" semantically; existing table)
                       │
                       ├─< wo_packaging_returns  (NEW)
                       │           │
                       │           ├─── wo_packaging_return_approvals (1:0..1)  (NEW)
                       │           │              │
                       │           │              ├─── electronic_signatures (FK)
                       │           │              ├─── inventory_lots (FK new_lot_id, nullable)
                       │           │              └─── deviations (FK, nullable)
                       │           │
                       │           ├─── electronic_signatures (verifier_signature_id)
                       │           └─── users (returner, verifier)
                       │
                       ├─── inventory_lots (source_lot_id)
                       ├─── electronic_signatures (verifier_signature_id)
                       └─── users (operator, verifier)

packaging_tolerances  (NEW; standalone — lookup by packaging_category)

items (existing — type='packaging') ──< wo_packaging_materials
items.category ─── (heuristic mapping) ─── packaging_tolerances.packaging_category
```

---

## Extended Entity

### `wo_packaging_materials` (existing — ADD 5 columns)

Existing table at `schema.ts:1569` (SQLite) and `:4890` (MySQL).

| New Column | Type (SQLite / MySQL) | Notes |
|---|---|---|
| `container_label` | TEXT / VARCHAR(50) | NULL until issuance flow used; required for new flow |
| `verifier_user_id` | INTEGER / INT | FK users.id, nullable until verified |
| `verifier_signature_id` | INTEGER / INT | FK electronic_signatures.id, nullable |
| `verified_at` | TEXT / DATETIME | When verifier signed |
| `flow_status` | TEXT / VARCHAR(30) | NEW STATUS dimension for the issuance flow: `pending_verification` / `issued` / `cancelled`. Distinct from existing `status` column to preserve backward compat |

**Indexes to add:** `(work_order_id, container_label, created_at)` for 24h duplicate check (R6).

**Migration safety:** All new columns nullable so existing rows (from current batch records flow) remain valid.

---

## New Entities

### 1. `wo_packaging_returns`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | PK auto | NOT NULL | |
| `wo_packaging_material_id` | FK → `wo_packaging_materials.id` | NOT NULL, ON DELETE RESTRICT | Links to the original issuance row |
| `used_qty` | INTEGER / INT | NOT NULL, ≥ 0 | Quantity actually used in production |
| `return_qty` | INTEGER / INT | NOT NULL, ≥ 0 | Quantity returned to warehouse |
| `variance_qty` | INTEGER / INT | NOT NULL, ≥ 0 | = issued - used - return |
| `variance_percent` | DECIMAL(6,2) / REAL | NOT NULL | = variance_qty / issued_qty × 100 |
| `outside_tolerance` | INTEGER (bool) / BOOL | NOT NULL, default 0 | Flagged when variance % > tolerance |
| `variance_reason` | TEXT / VARCHAR(40) | NOT NULL | enum: sampling / spillage / process_loss / cleaning / damaged / unaccounted / other |
| `variance_explanation` | TEXT | NULL | Free-text root cause when outside_tolerance |
| `return_container_label` | TEXT / VARCHAR(50) | NOT NULL | Container label of the box being returned |
| `proposed_status` | TEXT / VARCHAR(20) | NOT NULL | Operator's proposal: `reusable` / `quarantine` / `rejected` |
| `returner_user_id` | FK users.id | NOT NULL | Who initiated the return |
| `verifier_user_id` | FK users.id | NOT NULL | Who verified |
| `verifier_signature_id` | FK electronic_signatures.id | NOT NULL | E-sig of verifier |
| `verified_at` | DATETIME / TEXT | NOT NULL | When verifier signed |
| `status` | TEXT / VARCHAR(30) | NOT NULL | `pending_qa_approval` / `approved_reusable` / `approved_quarantine` / `rejected` |
| `submitted_at` | DATETIME / TEXT | NOT NULL | When return was submitted |
| `created_at` | DATETIME / TEXT | NOT NULL | |
| `updated_at` | DATETIME / TEXT | NOT NULL | |

**State transitions:**
```text
(new) ─create─> pending_qa_approval ─QA approve Reusable─>   approved_reusable    (terminal)
                                   ─QA approve Quarantine─> approved_quarantine  (terminal)
                                   ─QA reject─>             rejected             (terminal)
```

Approved/rejected rows are **immutable** (FR-039).

**Indexes:** `(wo_packaging_material_id)`, `(status, submitted_at)`, `(returner_user_id)`.

---

### 2. `wo_packaging_return_approvals`

QA approval record (1:1 with return).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | PK auto | NOT NULL | |
| `return_id` | FK → `wo_packaging_returns.id` | NOT NULL UNIQUE | 1 approval per return |
| `qa_user_id` | FK users.id | NOT NULL | QA reviewer |
| `qa_signature_id` | FK electronic_signatures.id | NOT NULL | QA e-sig |
| `final_status` | TEXT / VARCHAR(20) | NOT NULL | `approved_reusable` / `approved_quarantine` / `rejected` |
| `override_reason` | TEXT | NULL | Required when final_status ≠ proposed_status |
| `qa_notes` | TEXT | NULL | Optional QA comment |
| `new_lot_id` | FK inventory_lots.id | NULL | Set when Reusable/Quarantine (the newly created child lot) |
| `deviation_id` | FK deviations.id | NULL | Set when outside_tolerance or Rejected |
| `action_at` | DATETIME / TEXT | NOT NULL | When QA signed |
| `created_at` | DATETIME / TEXT | NOT NULL | |

**Indexes:** `(return_id) UNIQUE`, `(qa_user_id, action_at)`.

---

### 3. `packaging_tolerances`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | PK auto | NOT NULL | |
| `packaging_category` | TEXT / VARCHAR(40) | NOT NULL UNIQUE | `capsule` / `bottle` / `cap` / `label` / `other` |
| `tolerance_percent` | DECIMAL(6,2) / REAL | NOT NULL, > 0 | e.g. 2.00 = 2% |
| `is_active` | INTEGER bool / BOOL | NOT NULL, default 1 | Soft-delete |
| `notes` | TEXT | NULL | Optional rationale |
| `created_by_user_id` | FK users.id | NOT NULL | |
| `created_at` | DATETIME / TEXT | NOT NULL | |
| `updated_at` | DATETIME / TEXT | NOT NULL | |

**Indexes:** `(packaging_category) UNIQUE`.

**Seed defaults** (insert on migration):
| packaging_category | tolerance_percent |
|---|---|
| capsule | 2.00 |
| bottle | 1.00 |
| cap | 1.00 |
| label | 0.50 |
| other | 1.00 |

---

## Permissions (in existing permission table)

Four new permission rows:

| Permission | Description | Default Roles |
|---|---|---|
| `production:packaging:issue` | Create + verify issuance | Production Operator, Production Supervisor |
| `production:packaging:return` | Create + verify return | Production Operator, Production Supervisor |
| `production:packaging:approve` | QA approve/reject return | **QA Manager, QA Officer only** |
| `production:packaging:configure` | Edit tolerances | System Admin, Factory Manager |

---

## Validation Rules (Zod, summarized)

```text
CreateIssuanceInput:
  workOrderId: int (must be released or in_progress)
  itemId: int (must be in WO BOM AND items.type='packaging')
  sourceLotId: int (must have ≥ quantity stock)
  quantity: int (> 0)
  containerLabel: string (trim, 3-50 chars, required)
  roomId: int

VerifyIssuanceInput:
  password: string (e-sig)

CreateReturnInput:
  woPackagingMaterialId: int (must be flow_status='issued')
  usedQty: int (≥ 0, ≤ issued_qty)
  returnQty: int (≥ 0, ≤ issued_qty - used_qty)
  varianceReason: enum
  varianceExplanation: string (required if computed variance > tolerance OR if proposed_status='rejected')
  returnContainerLabel: string (3-50, required)
  proposedStatus: enum('reusable','quarantine','rejected')

VerifyReturnInput:
  password: string

ApproveReturnInput:
  finalStatus: enum('approved_reusable','approved_quarantine','rejected')
  overrideReason: string (required if finalStatus != mapped(proposedStatus))
  qaNotes: string (optional)
  password: string

CreateToleranceInput:
  packagingCategory: enum
  tolerancePercent: number(0..100)
```

---

## Audit Trail

Every INSERT / UPDATE goes through `auditedInsert / auditedUpdate` (from `src/lib/db/audit-wrapper.ts`). Existing `audit_trail` table is the sink; no new audit columns.

---

## Migration Order

1. Add nullable columns to `wo_packaging_materials` (safe — existing rows unaffected)
2. Add index `(work_order_id, container_label, created_at)`
3. Create `packaging_tolerances` + seed 5 default categories
4. Create `wo_packaging_returns`
5. Create `wo_packaging_return_approvals`
6. Insert 4 new permissions + role mappings

Each step independently revertible.

---

## Reconciliation Formula

```text
Per Work Order × Item:
  bomPlanned   = wo_packaging_materials.plannedQuantity  (existing column, sum if multiple issuances)
  issued       = SUM(wo_packaging_materials.quantity WHERE flow_status='issued')
  returned     = SUM(wo_packaging_returns.return_qty WHERE status='approved_reusable')
                   (quarantine and rejected don't add to "returned" usable stock)
  used         = SUM(wo_packaging_returns.used_qty WHERE status IN ('approved_reusable','approved_quarantine','rejected'))
                   (used qty is reported regardless of QA outcome)
  variance     = issued - used - returned
  variancePct  = variance / issued × 100
  tolerance    = packaging_tolerances.tolerance_percent FOR mapped(items.category)
  withinTol    = variancePct ≤ tolerance
```

Returned in JSON for the reconciliation card and used for Excel/PDF export.

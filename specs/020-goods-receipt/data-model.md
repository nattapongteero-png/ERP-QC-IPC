# Data Model: Goods Receipt & Incoming Inspection

**Feature**: 020-goods-receipt
**Date**: 2026-06-02

## Overview

Four new tables, one config table, one helper table, plus two additive columns on existing tables. All tables defined in dual SQLite + MySQL schema, exported via `src/lib/db/schema-goods-receipt.ts` and re-exported through `src/lib/db/schema.ts`.

## Entities

### 1. `goods_receipts` (header)

Header document for one incoming-stock event.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | integer PK | autoincrement | |
| `grn_number` | varchar(20) | unique, not null | Format `GRN-YYYY-NNNNN` |
| `source_type` | varchar(2) | not null | `'po'` or `'wo'` |
| `po_id` | integer | nullable, FK→purchase_orders.id | non-null iff source_type=`po` |
| `wo_id` | integer | nullable, FK→work_orders.id | non-null iff source_type=`wo` |
| `vendor_id` | integer | nullable, FK→vendors.id | denormalized for filtering |
| `warehouse_id` | integer | not null, FK→warehouses.id | quarantine warehouse |
| `status` | varchar(20) | not null, default `'in_progress'` | see header state machine |
| `receiver_user_id` | integer | not null, FK→users.id | creator |
| `received_date` | date | not null | actual delivery date |
| `notes` | text | nullable | |
| `created_at` | datetime | not null | |
| `updated_at` | datetime | not null | |

Indexes: `grn_number` (unique), `(source_type, po_id)`, `(source_type, wo_id)`, `(status, received_date)`, `vendor_id`.

#### Header status state machine

| From | To | Trigger |
|---|---|---|
| (new) | `in_progress` | GRN created |
| `in_progress` | `released` | all lines reach `released_to_stock` |
| `in_progress` | `partially_released` | ≥1 line `released_to_stock` AND ≥1 line `rejected` or `cancelled` |
| `in_progress` | `rejected` | all lines reach `rejected` |
| `in_progress` | `cancelled` | header cancelled (within 24h, no signed lines) |

---

### 2. `goods_receipt_lines`

One line per item-lot received on a GRN.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | integer PK | autoincrement | |
| `grn_id` | integer | not null, FK→goods_receipts.id ON DELETE CASCADE | |
| `line_number` | integer | not null | 1-based, scoped to GRN |
| `item_id` | integer | not null, FK→items.id | |
| `expected_quantity` | decimal(15,4) | not null | from PO line or WO output |
| `actual_quantity` | decimal(15,4) | nullable | filled by receiver |
| `unit` | varchar(20) | not null | unit of measure |
| `vendor_lot_number` | varchar(50) | nullable | raw material only |
| `batch_number` | varchar(50) | nullable | finished goods only |
| `manufacturing_date` | date | nullable | |
| `expiry_date` | date | nullable | |
| `variance_amount` | decimal(15,4) | nullable | actual − expected, signed |
| `variance_percent` | decimal(6,2) | nullable | computed |
| `variance_reason` | text | nullable | required when variance flagged |
| `status` | varchar(30) | not null, default `'created'` | see line state machine |
| `inventory_lot_id` | integer | nullable, FK→inventory_lots.id | created at checklist sign |
| `qc_sample_id` | integer | nullable, FK→qc_samples.id | created at checklist sign |
| `qc_sample_creation_failed` | boolean | not null, default false | R5 fallback flag |
| `receiver_signature_id` | integer | nullable, FK→electronic_signatures.id | checklist signer |
| `qa_signature_id` | integer | nullable, FK→electronic_signatures.id | QA release signer |
| `qa_decision_at` | datetime | nullable | timestamp of release/reject |
| `rejection_reason` | text | nullable | required when status=rejected |
| `source_po_line_id` | integer | nullable, FK→purchase_order_lines.id | for raw material |
| `source_wo_output_id` | integer | nullable | for finished goods (no FK, free-form ref) |
| `created_at` | datetime | not null | |
| `updated_at` | datetime | not null | |

Indexes: `(grn_id, line_number)` unique, `item_id`, `status`, `inventory_lot_id`, `qc_sample_id`.

#### Line status state machine

```
                            ┌─────────────────┐
                            │   created       │ ← initial
                            └────────┬────────┘
                                     │ receiver signs checklist
                                     ▼
                            ┌─────────────────┐
                            │ checklist_done  │
                            └────────┬────────┘
                                     │ QC sample registered
                                     ▼
                            ┌─────────────────┐
                            │  qc_pending     │
                            └────┬──────┬─────┘
                                 │      │
                qc.status=approved│      │qc.status=failed (auto)
                                 ▼      │
                        ┌─────────────┐ │
                        │ qc_approved │ │
                        └──────┬──────┘ │
                               │        │
                  QA "Release" │        │
                               ▼        │
                        ┌─────────────┐ │
                        │released_to_ │ │
                        │   stock     │ │
                        └─────────────┘ │
                                        │
                                        │  ◄── QA "Reject" (any time)
                                        ▼
                                ┌─────────────┐
                                │  rejected   │
                                └─────────────┘

(cancelled): from `created` only, within 24h
```

Triple Independence rule: `receiver_signature_id.user_id` ≠ `qa_signature_id.user_id` (enforced in service).

---

### 3. `goods_receipt_checklists`

One checklist per receipt line. Stores the signed snapshot.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | integer PK | autoincrement | |
| `line_id` | integer | not null, FK→goods_receipt_lines.id ON DELETE CASCADE | |
| `template_id` | integer | not null, FK→receipt_checklist_templates.id | |
| `template_version` | integer | not null | snapshot version |
| `category` | varchar(20) | not null | `'raw_material'` or `'finished_goods'` |
| `captured_items_json` | json | not null | array of `{id, label, isPass, remarks}` |
| `signed_at` | datetime | not null | |
| `signature_id` | integer | not null, FK→electronic_signatures.id | |
| `created_at` | datetime | not null | |

Indexes: `line_id` (unique — one checklist per line).

---

### 4. `receipt_checklist_templates`

Admin-editable master data.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | integer PK | autoincrement | |
| `category` | varchar(20) | not null | `'raw_material'` or `'finished_goods'` |
| `version` | integer | not null | per-category increment |
| `is_current` | boolean | not null, default true | exactly one current per category |
| `items_json` | json | not null | array of `{id, label, isMandatory, sortOrder}` |
| `created_by_user_id` | integer | not null, FK→users.id | |
| `created_at` | datetime | not null | |

Indexes: `(category, version)` unique, `(category, is_current)`.

Seed data: 2 rows — `raw_material` v1 with 4 items, `finished_goods` v1 with 5 items.

---

### 5. `receipt_tolerances` (config)

Per-category tolerance config.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | integer PK | autoincrement | |
| `category` | varchar(20) | unique, not null | `'raw_material'` or `'finished_goods'` |
| `tolerance_percent` | decimal(6,2) | not null | 0–100 |
| `is_active` | boolean | not null, default true | |
| `notes` | text | nullable | |
| `created_at` | datetime | not null | |
| `updated_at` | datetime | not null | |

Seed: `('raw_material', 2.0)`, `('finished_goods', 5.0)`.

---

### 6. `goods_receipt_sequences` (helper)

Per-year counter for GRN numbering.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `year` | integer PK | not null | 4-digit |
| `next_value` | integer | not null, default 1 | |
| `updated_at` | datetime | not null | |

Concurrency: incremented inside the create-GRN transaction with `FOR UPDATE`.

---

## Additive columns on existing tables

### `inventory_lots`

Add: `source_grn_line_id INTEGER NULL` with FK to `goods_receipt_lines.id`. Nullable — historical lots keep NULL.

### `qc_samples`

Add: `source_grn_line_id INTEGER NULL` + `flag_for_qc_manager BOOLEAN NOT NULL DEFAULT false`.

Both additions are purely additive — no existing queries read these columns, so they are zero-risk.

---

## Entity relationships (Mermaid-style)

```
purchase_orders ─┐                          ┌─ work_orders
                 │                          │
                 └────┐                ┌────┘
                      ▼                ▼
              goods_receipts (header)
                      │
                      │ 1
                      │
                      │ N
                      ▼
            goods_receipt_lines ─────────────┬─────► inventory_lots (status=quarantine→released)
                      │                      │
                      │ 1                    │
                      │                      └─────► qc_samples (auto-created)
                      │ 1
                      ▼
            goods_receipt_checklists
                      │
                      │ N
                      │
                      ▼
            receipt_checklist_templates (versioned)

            electronic_signatures ◄─── receiver_signature_id, qa_signature_id
            audit_trail            ◄─── every status transition
```

---

## Validation rules (Zod schemas in `src/lib/validation/goods-receipt.ts`)

- `createGrnSchema`: `sourceType ∈ {'po','wo'}`, exactly one of `poId`/`woId` present, `receivedDate` ≤ today.
- `updateGrnLineSchema`: `actualQuantity ≥ 0`, `expiryDate > manufacturingDate`, `vendorLotNumber required if sourceType=po`.
- `signChecklistSchema`: all mandatory items in `capturedItemsJson` are `isPass=true`, signature payload present.
- `qaReleaseSchema`: `lineId` valid, `signature` present, QC sample status must be `approved`.
- `qaRejectSchema`: `lineId` valid, `rejectionReason` required (min 10 chars), `signature` present.

---

## Migration strategy

1. **Phase 1**: Create 6 new tables via `schema-sync.ts` auto-migration.
2. **Phase 1**: Add 3 additive columns to `inventory_lots` + `qc_samples` via ALTER TABLE.
3. **Phase 1**: Seed `receipt_tolerances` (2 rows) and `receipt_checklist_templates` (2 rows) and `hr_app_permissions` (3 new keys).
4. **No data backfill** — historical lots remain unmapped to GRNs (per spec Assumption "No retroactive data migration").

---

## Index strategy summary

All queries from the dashboard, list, and detail pages must hit an index. Hot paths:
- Dashboard tile "Pending Checklist" → `goods_receipt_lines.status` index.
- Dashboard tile "Pending QA" → `goods_receipt_lines.status` index.
- Dashboard tile "Quarantine Aging" → `inventory_lots.status` (existing) + `inventory_lots.received_date` (existing).
- List page filter by supplier → `goods_receipts.vendor_id` index.
- Detail page lot lookup → `inventory_lots.source_grn_line_id` (new index).
- Auditor lookup from lot → `inventory_lots.source_grn_line_id` (same).

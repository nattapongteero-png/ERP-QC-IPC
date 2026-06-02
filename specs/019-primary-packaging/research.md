# Phase 0 Research: Primary Packaging Material Issuance & Return

**Date**: 2026-06-02
**Branch**: `019-primary-packaging`

---

## R1. Existing `wo_packaging_materials` Reuse Boundary

**Question:** Should we extend the existing table or create a parallel one?

**Decision:** **Extend** `wo_packaging_materials` with verification + status columns. Do NOT create a parallel issuance table.

**Rationale:**
- The table already represents "packaging materials linked to a WO" — semantically correct
- It's already referenced by batch records and existing reporting (see `wo-execution.service.ts:1769+`)
- Creating a parallel table would fragment data; existing reports would miss new flow

**Columns to add:**
- `container_label` (varchar 50)
- `verifier_user_id` (FK users, nullable until verified)
- `verifier_signature_id` (FK electronic_signatures, nullable)
- `verified_at` (datetime, nullable)
- `flow_status` (varchar 30; values: `pending_verification` / `issued` / `cancelled` — distinct from existing `status` to avoid collision with batch logic)

**Alternatives considered:**
- Create `wo_packaging_issuances` separately — rejected (data duplication, breaks existing reports)
- Repurpose existing `status` column — rejected (existing code paths rely on its current semantics)

---

## R2. Triple Independence Enforcement Pattern

**Question:** Where to enforce that Operator ≠ Verifier ≠ QA?

**Decision:** Defense in depth — enforce at **both** service layer (cannot be bypassed) **and** API layer (early rejection).

**Service-layer guard (mandatory):**
```ts
// In packaging-return.service.ts approveReturn()
if (qaUserId === returnRow.returnerUserId) throw new PackagingError('QA_EQUALS_RETURNER');
if (qaUserId === returnRow.verifierUserId) throw new PackagingError('QA_EQUALS_VERIFIER');
```

**API-layer guard (early check):**
```ts
// In /approve route handler
const ret = await getReturnById(returnId);
if (session.userId === ret.returnerUserId || session.userId === ret.verifierUserId) {
  return 400 with code 'TRIPLE_INDEPENDENCE_VIOLATION';
}
```

**Admin bypass:** Even admin users CANNOT bypass Triple Independence — this is a GMP integrity requirement, not just permission. Unlike feature 018 where `isAdminRole` bypassed permission checks, here admin must still satisfy independence.

**Alternatives considered:**
- Enforce only at service — rejected (admin UI could call API and see misleading 500 errors instead of friendly 400s)
- Enforce only at API — rejected (defense in depth — direct DB access bypasses API)

---

## R3. Atomic QA Approval Transaction

**Question:** What goes in a single Drizzle transaction on approve?

**Decision:** Wrap all 7 side-effects in `db.transaction(async tx => ...)`:

```text
1. Load return row + verify status='pending_qa_approval'
2. Verify Triple Independence (re-check defensively)
3. Verify QA password (e-sig)
4. Insert into wo_packaging_return_approvals (capture signature_id)
5. Update return.status to one of: approved_reusable / approved_quarantine / rejected
6. IF Reusable or Quarantine:
   - INSERT new inventory_lot (parentLotId = source lot, qty = returnQty)
   - INSERT inventory_transaction (type='return', positive qty)
7. IF Reject:
   - INSERT deviation
   - INSERT waste_disposal log (if such table exists; else just deviation)
8. IF outside_tolerance was true at submit (regardless of QA decision):
   - INSERT deviation linking to return
9. RETURN { return, newLotId?, deviationId? }
```

**Rationale:** SC-012 requires 100% of approved Reusable creates new lot + transaction. Any partial failure must roll back the entire approval.

**MySQL FOR UPDATE locks:** Hold row lock on `wo_packaging_returns.id` and on the source lot during the tx to prevent concurrent approvals or stock races.

**Alternatives considered:**
- Compensating transactions — rejected (much more complex; Drizzle txs work)
- Synchronous outside-tx side effects (notification) — kept outside tx (failure ≠ data corruption)

---

## R4. Child Lot via `parentLotId` — Pattern Study

**Question:** How does `material-return.service.ts` create child lots?

**Decision:** Mirror exactly — `inventory_lots.parentLotId` already exists in schema (line 255 of schema.ts: `parentLotId: integer('parent_lot_id').references((): AnySQLiteColumn => sqliteInventoryLots.id)`).

**Algorithm on Reusable approve:**
```ts
const newLot = await tx.insert(lots).values({
  itemId: sourceLot.itemId,
  lotNumber: `${sourceLot.lotNumber}-RTN-${returnId}`,
  parentLotId: sourceLot.id,
  warehouseId: sourceLot.warehouseId,
  quantity: returnQty,
  unit: sourceLot.unit,
  status: 'available',  // immediately reusable
  receivedAt: getNow(),
  // ... other fields copied from source
});
```

For Quarantine: same but `status: 'quarantine'`.

**Reference:** `material-return.service.ts:approveMaterialReturn` — function body has the proven pattern.

---

## R5. Tolerance Lookup — Simpler than Feature 018

**Question:** How is tolerance keyed?

**Decision:** Single dimension — packaging_category. NOT per factory (unlike feature 018's withdrawal cap rules).

**Why simpler:**
- Tolerance is technical (based on physical packaging type), not commercial
- All factories should use same standards for consistency
- If per-factory needed later, easy to add `factory_code` column

**Lookup table:**
```text
packaging_tolerances:
  (packaging_category='capsule', tolerance_percent=2.0)
  (packaging_category='bottle',  tolerance_percent=1.0)
  (packaging_category='cap',     tolerance_percent=1.0)
  (packaging_category='label',   tolerance_percent=0.5)
  (packaging_category='other',   tolerance_percent=1.0)  -- fallback
```

**Lookup priority:**
1. Exact category match
2. Fall back to 'other'
3. Hard default 1.0% if even 'other' missing

**Packaging category derivation:** From `items.category` (existing field — values like 'Capsule', 'Bottle' seen in seed data). Map lowercased → tolerance key.

---

## R6. Container Label 24h Duplicate Check

**Question:** How to efficiently check for duplicate Container Labels in the last 24 hours of a WO?

**Decision:** Query existing `wo_packaging_materials` rows filtered by `work_order_id` + `container_label` + `created_at >= NOW() - INTERVAL 24 HOUR`.

**Index strategy:** Add index `(work_order_id, container_label, created_at)` — supports both the duplicate check and the per-WO listing.

**Warning, not block (FR-005):** Service returns `{ created: true, containerLabelWarning: true, existingIssuanceIds: [n,m] }` when duplicate found. UI shows toast warning but still proceeds.

**Return side:** Same check against existing return rows (`return_container_label`).

---

## R7. Packaging Category Derivation

**Question:** How do we know an item is a "capsule" vs "bottle"?

**Decision:** Use existing `items.category` field. Seed data shows:
- `PK-001: 'Capsule'`
- `PK-002: 'Bottle'`

Service helper:
```ts
function toToleranceCategory(itemCategory: string | null): string {
  const c = (itemCategory ?? '').toLowerCase();
  if (c.includes('caps')) return 'capsule';
  if (c.includes('bottle')) return 'bottle';
  if (c.includes('cap')) return 'cap';      // distinct from 'capsule'
  if (c.includes('label')) return 'label';
  return 'other';
}
```

**Action:** Add admin UI later (out of MVP) to map item → category if heuristic fails.

---

## R8. DevExtreme Components

| UI need | Chosen component | Why |
|---|---|---|
| Issuance form | `Popup` + `Form` | Reusable, supports validation |
| Material picker (BOM filter type=packaging) | `SelectBox` w/ async dataSource | Searchable, custom template |
| Quantity (pcs) | `NumberBox` (integer mode) | Step buttons for tablet |
| Container Label | `TextBox` with debounced async validator | 24h duplicate check |
| Reason dropdown | `SelectBox` | Static enum list |
| Status badge | Custom span (chip) | Lightweight |
| QA queue | `DataGrid` w/ row template | Filter/sort/export builtin |
| Reconciliation table | `DataGrid` w/ summary row | Built-in totaling |
| Trend chart | `Chart` + `BarSeries` | DevExtreme charts |
| Excel export | DataGrid's `export-data-grid` | Native support |

---

## R9. i18n Namespace `packaging`

**Decision:** New namespace `packaging` (singular, generic enough for future packaging features).

Files:
- `src/locales/th/packaging.json`
- `src/locales/en/packaging.json`

Register in `src/lib/i18n/config.ts` + `request.ts` (same pattern as feature 018).

**Key structure:**
```text
page.title, page.description
form.material, form.quantity, form.lot, form.containerLabel, form.room, form.reason.{...}
return.title, return.usedQty, return.returnQty, return.variance, return.status.{...}
status.pending_verification, status.issued, status.pending_qa_approval, status.approved_reusable, ...
buttons.issue, buttons.verify, buttons.approve, buttons.reject, buttons.return
errors.dualControl, errors.tripleIndependence, errors.usedExceedsIssued, errors.lotRejected, errors.containerLabelRequired
reconciliation.{...}
toast.{...}
```

ICU format `{var}` (lesson learned from feature 018).

---

## R10. Dual-DB Constraints

**Quantities (pcs):** Use `INTEGER` columns — packaging is whole pieces.
- SQLite: `integer()`
- MySQL: `int()`

**Percentages (variance, tolerance):** `DECIMAL(6,2)` in MySQL, `real()` in SQLite.

**Datetimes:** Use existing `date-utils.ts` helpers — same pattern as feature 018.

**Container Label uniqueness:** No DB-level uniqueness (would block legitimate cases); enforce via service-layer 24h check.

---

## R11. Notification Integration

**Decision:** When a return is submitted (`pending_qa_approval`), enqueue in-app notification to all users with `production:packaging:approve` permission in same factory.

If notification subsystem exists (TBD during implementation), use it; else log a TODO for follow-up.

**Operator notification:** When QA decides — notify the original returner (in-app toast on next page refresh).

---

## R12. Audit Trail Scope

Every mutation goes through `auditedInsert/auditedUpdate`. Tables in scope:
- `wo_packaging_materials` (extend)
- `wo_packaging_returns` (new)
- `wo_packaging_return_approvals` (new)
- `packaging_tolerances` (new)

Existing `audit_trail` table captures (table, id, user_id, action, old_values JSON, new_values JSON, timestamp). No new audit columns needed.

---

## Open Items Carried into Phase 1

None. All NEEDS CLARIFICATION resolved.

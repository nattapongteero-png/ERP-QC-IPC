# Phase 0 Research: Material Withdrawal Approval

**Date**: 2026-06-02
**Branch**: `018-material-withdrawal-approval`

This research validates technical assumptions made in the spec and surfaces unknowns. All findings are derived from inspecting the current codebase at `c:\Herbal ERP\herbal-medicine-erp`.

---

## R1. Approval Workflow Engine — Extension Contract

**Question:** How do we register a new document type `material_withdrawal_request` in `approval-workflow.service.ts` without breaking existing 7 doc types?

**Decision:** Add `material_withdrawal_request` to the `APPROVE_PERMISSION_BY_DOC_TYPE` map with permission `production:withdrawal:approve`. Mirror the structure of `purchase_requisition`. Existing doc types unaffected.

**Rationale:** Engine is keyed by `document_type` string discriminator; adding a new key is additive (no existing branch reads "exhaustive").

**Alternatives considered:**
- Build a separate approval service for withdrawal → rejected (DRY violation, would duplicate e-sig + state machine code)
- Bypass engine and handle in `material-withdrawal.service` directly → rejected (loses cross-feature reporting capability, violates Constitution I)

**References:** `src/lib/services/approval-workflow.service.ts` lines 1–1720, doc-type map appears near top of file.

---

## R2. Material Return Service — Pattern Reuse

**Question:** Can we lift the variance-calc + deviation auto-creation pattern from `material-return.service.ts`?

**Decision:** Yes. Mirror the two-stage workflow (`submit` → `approve`). Replace "excess quantity returned" with "additional quantity requested." Reuse `auditedInsert/Update`, `getTableRef`, `getInsertId`, `executeDbOperation` helpers.

**Key differences to implement:**
| Aspect | material-return | material-withdrawal |
|---|---|---|
| Direction | Return excess → stock IN | Request more → stock OUT |
| Status flow | `submitted → received` | `pending → approved` (or `rejected`) |
| Variance reason | Process loss / spillage etc. | Setup loss / trial / parameter adjust |
| Phase block | None | Selective per affected material (FR-035..040) |
| Approval E-sig | None today | **Required** (FR-017) |

**References:** `src/lib/services/material-return.service.ts` lines 1–1780.

---

## R3. Production Gate — Selective Phase Block Insertion Point

**Question:** Where do we add the "is this phase blocked by a pending withdrawal request for material M?" check?

**Decision:** Add new function `isPhaseBlockedByPendingWithdrawal(workOrderId, phaseId): { blocked: boolean; reason?: string; pendingRequestIds: number[] }` and call it from the existing `canAdvanceToPhase()` (or equivalent) wrapper. Cache the BOM phase→material mapping per WO via a single SQL join (avoid N+1).

**Rationale:** Production gate already centralizes per-phase pre-conditions. The new check joins the same table set already loaded by the gate.

**Algorithm:**
```text
INPUT: workOrderId, targetPhaseId
1. SELECT materials used in phase = (SELECT DISTINCT material_id FROM bom_step_materials WHERE phase_id = targetPhaseId AND work_order_id = ...)
2. SELECT pending requests = (SELECT request_id, request_item_ids FROM material_withdrawal_requests WHERE work_order_id = ... AND status = 'pending')
3. INTERSECT: materials in (2) ∩ materials in (1) → blocking_request_ids
4. RETURN { blocked: blocking_request_ids.length > 0, pendingRequestIds: blocking_request_ids }
```

**References:** `src/lib/services/production-gate.service.ts` line ~76 (requisitionStatus check).

---

## R4. E-Signature Pattern from Line Clearance

**Question:** How is E-signature implemented in Line Clearance and how to reuse?

**Decision:** Reuse exact pattern — server-side password verification via `bcrypt.compare()` against user's stored password hash; signature payload (user ID, timestamp, action, document hash) is HMAC-signed with server secret and stored in a `signatures` table row referenced by FK.

**Rationale:** Per Constitution IV — single source of truth for E-sig. Line Clearance already passed GMP validation. New approval inherits the audited path.

**Reusable artifacts:**
- `POST /api/signatures` (existing) — accepts payload, returns signature_id
- `<ESignaturePromptDialog />` — Popup that asks for password, returns signature_id on success

**Action:** Search and confirm exact dialog component name during implementation.

**References:** Found via `src/app/api/signatures/` (route) and `src/components/production/` (LC dialog).

---

## R5. BOM Phase → Material Mapping

**Question:** How is "which materials are used in which phase" represented? Needed for FR-040.

**Decision:** Derive from `bom_step_materials` (existing) joined with `sop_steps.phase` (existing in 017-ipc-criteria-redesign). Each `bom_step_material` belongs to a `sop_step`; each `sop_step` has a `phase` enum (pre_production / production / post_production / packaging / inspection).

**Materialized view (optional optimization):** Create `bom_phase_materials` view if read perf becomes an issue. For MVP, dynamic JOIN is acceptable (typical WO has < 100 step-materials).

**References:** Search `src/lib/db/schema.ts` for `bomStepMaterials` and `sopSteps` tables.

---

## R6. DevExtreme Component Choices

| UI need | Chosen component | Why |
|---|---|---|
| Request form (modal) | `Popup` + `Form` | DevExtreme Form supports Thai labels, async validators, conditional visibility for "phase" field |
| Material picker (from BOM) | `SelectBox` w/ async dataSource | Searchable, supports custom item template (show on-hand qty + unit) |
| Quantity input | `NumberBox` | Decimal precision, unit suffix display |
| Reason | `SelectBox` w/ static items + conditional `TextArea` | Dropdown + "Other" expands text input |
| File upload | `FileUploader` | Multi-file, image preview, server-side endpoint |
| Supervisor queue | `DataGrid` w/ master-detail rows | Built-in filter/sort/export; row template for cards |
| Approve/Reject dialog | `Popup` + `TextArea` + ESignaturePromptDialog | Confirm reason then escalate to e-sig |
| Phase block banner | `Alert`-like custom div using DevExtreme styles | Lightweight, doesn't need full DevExtreme widget |
| Reports | `DataGrid` + `Chart` (PieChart, BarChart) | Export Excel/PDF built-in, charting for trends |

**Avoided:** No raw HTML form controls, no shadcn/ui.

---

## R7. i18n Message Files

**Decision:** Add `src/locales/th/material-withdrawal.json` (primary) and `src/locales/en/material-withdrawal.json` (secondary). Validate with `bun run i18n:check`.

**Key structure:**
```text
common.title, common.subtitle
form.material.label, form.quantity.label, form.reason.label, form.reason.options.*
form.phase.label, form.phase.options.*
form.attachments.label, form.attachments.dragDrop
table.columns.*
status.pending, status.approved, status.rejected, status.cancelled
toast.created.success, toast.approved.success, toast.rejected.success, toast.error.*
errors.dualControl, errors.duplicate, errors.exceedSoftCap, errors.exceedHardCap, errors.insufficientStock
buttons.request, buttons.approve, buttons.reject, buttons.export
phaseBlock.banner.title, phaseBlock.banner.message
```

---

## R8. Dual-DB Date/Default Handling

**Decision:** All date columns use `getNow()`, `toDbDate()`, `toQueryDate()` from `src/lib/db/date-utils.ts`. Status column default = `'pending'` literal (string), supported by both Drizzle SQLite and MySQL adapters. For decimal quantities, use `text` in SQLite (parsed in app) and `decimal(18,4)` in MySQL — pattern already used in `materialReturns`.

**Rationale:** Established codebase pattern; avoids the schema-sync DDL default bug (per memory).

**Foreign keys:** ON DELETE CASCADE only between request → request_items and request → attachments. ON DELETE RESTRICT for FKs to work_orders, materials, users (preserve audit history).

---

## R9. Cap Configuration Storage

**Question:** Where do per-factory / per-material-category caps live?

**Decision:** New table `material_withdrawal_rules` keyed by `(factory_id, material_category)`. Lookup falls back hierarchically: (factory, category) → (factory, ANY) → (ANY, category) → (ANY, ANY = global default 10% soft / 50% hard).

**Rationale:** Avoids per-material row explosion; aligns with how existing GMP threshold tables are keyed.

---

## R10. Transactional Atomicity on Approve

**Question:** FR-021 + FR-022 + FR-023 must all succeed or all fail (SC-003).

**Decision:** Wrap the approve operation in a single Drizzle transaction:

```text
db.transaction(async (tx) => {
  1. Verify stock availability — read-lock material rows (SELECT … FOR UPDATE on MySQL; SQLite serializes by design)
  2. Update withdrawal_request.status = 'approved' (audited)
  3. INSERT inventory_transaction (deduct stock, audited)
  4. UPDATE material_consumption (audited)
  5. INSERT deviation (audited)
  6. Capture e-signature row
  7. Emit notification (queued — outside tx to avoid blocking, but commit must succeed first)
})
```

**Rationale:** Constitution IV — data integrity for GMP records. Drizzle supports MySQL/SQLite transactions identically through the `executeDbOperation` helper if we extend it. Notifications happen post-commit to avoid sending false success.

---

## R11. Notification Delivery (LINE + in-app)

**Decision:** Use existing notification subsystem (whichever it is — confirm during implementation). For Phase-1 MVP, in-app toast/notification is mandatory; LINE notify is optional and configurable via factory settings.

**Action:** Locate existing notification service during Phase-2 implementation; if absent, scope drops to in-app only and LINE is deferred to a follow-up spec.

---

## R12. Attachment Storage

**Decision:** Reuse the existing `attachments` table (visible at `src/app/api/attachments/`). Add polymorphic FK fields `entity_type='material_withdrawal_request'`, `entity_id=request.id` already supported by that subsystem.

**Action:** Verify polymorphic shape during Phase-2; if it's typed per entity instead, add a join table.

---

## Open Items (Carried into Phase 1)

None. All NEEDS CLARIFICATION resolved in spec; remaining unknowns are implementation details that surface during coding and are tracked in tasks.md.

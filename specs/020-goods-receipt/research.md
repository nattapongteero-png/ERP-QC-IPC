# Research: Goods Receipt & Incoming Inspection

**Feature**: 020-goods-receipt
**Date**: 2026-06-02

This document records the design decisions taken before implementation. Each entry follows: **Decision → Rationale → Alternatives considered**.

---

## R1 — GRN Numbering Strategy

**Decision**: Use a small `goods_receipt_sequences` table with one row per `(year)`. Within the create-GRN transaction, increment `nextValue` with `SELECT ... FOR UPDATE` (MySQL) / `BEGIN IMMEDIATE` (SQLite) and format `GRN-YYYY-NNNNN` with 5-digit zero pad. Sequence resets on the first GRN of a new calendar year.

**Rationale**:
- Spec FR-001 and SC-008 require gap-free, unique numbering per year.
- A DB sequence table is portable across MySQL/SQLite (Drizzle dual-schema).
- `FOR UPDATE` lock prevents two concurrent receivers from getting the same number.
- 5 digits supports up to 99,999 GRNs/year — sufficient for the 50–200/month target.

**Alternatives considered**:
- **MySQL `AUTO_INCREMENT`** — Rejected: gaps on transaction rollback violate SC-008.
- **UUID / ULID** — Rejected: not human-readable, fails auditor expectations.
- **Application-side counter in Redis** — Rejected: introduces infra dependency this project doesn't have.

---

## R2 — State Machine Location

**Decision**: Define `GRN_TRANSITIONS` as a TypeScript constant in `src/types/goods-receipt.ts`. Guard every transition in TWO layers: (1) service layer reads current status, validates against the transition map, throws `INVALID_TRANSITION` if disallowed; (2) API layer re-validates after pulling from DB.

**Rationale**:
- Defense in depth — F019 used the same pattern and successfully prevented a class of bugs where API routes bypassed service checks.
- A single map drives both runtime validation and unit-test exhaustiveness.

**Alternatives considered**:
- **XState** — Rejected: heavy dependency for one state machine; team unfamiliar.
- **DB-level CHECK constraints** — Rejected: SQLite + MySQL CHECK constraint differences create dual-schema burden.

---

## R3 — Triple Independence Enforcement

**Decision**: In the service layer, BEFORE any DB write, fetch the line's `receiverUserId` (who signed the checklist) and compare with the current session's `userId`. If equal, throw `TRIPLE_INDEPENDENCE_VIOLATION` regardless of role. Admin role does NOT bypass.

**Rationale**:
- Spec FR-025 is explicit: no role bypass.
- GMP segregation of duties (PIC/S Annex 1) prohibits self-approval.
- Service-layer placement protects all entry points (API, future webhook, future CLI).

**Alternatives considered**:
- **Admin-bypass-with-justification** — Rejected: spec explicitly forbids.
- **API-layer only** — Rejected: violates defense-in-depth; future entry points would skip the check.

---

## R4 — Atomic Release Transaction

**Decision**: The QA "Release to Stock" action runs as a single Drizzle transaction with these ordered side effects:
1. INSERT into `electronic_signatures` (QA signature)
2. UPDATE `goods_receipt_lines.status` → `released_to_stock`
3. UPDATE `inventory_lots.status` → `released`
4. INSERT into `audit_trail` (state change event)

If any step fails, the entire transaction rolls back — partial release is impossible.

**Rationale**:
- Spec FR-018 + FR-020 + SC-003 collectively require: no released lot without QA signature. Atomicity guarantees this invariant.
- Drizzle's `db.transaction(async (tx) => {...})` is well-supported in both MySQL and SQLite drivers.

**Alternatives considered**:
- **Step-by-step with manual compensation** — Rejected: failure recovery complex, audit-unfriendly.
- **Saga pattern with outbox** — Rejected: overengineered for a 4-write transaction with no external systems.

---

## R5 — Auto-QC Sample Creation

**Decision**: Inside the checklist-sign transaction, after inserting the checklist row and updating the line to `checklist_done`, call `createQcSampleForGrnLine(lineId, lotId, itemId, defaultTestPanelId)` — a new service function that wraps the existing `qc-sample.service.ts` `createSample()`. The new function adds the `sourceGrnLineId` foreign key.

If the auto-QC call throws, catch and log a warning — DO NOT roll back the checklist sign. Set a flag `goods_receipt_lines.qcSampleCreationFailed = true` and notify QC manager.

**Rationale**:
- Spec FR-021 mandates auto-creation.
- Spec FR-022 says QC sample must still be created even when test panel is missing — but a hard failure shouldn't block the receiver's work; this is exactly the kind of "downstream notification" pattern that GMP encourages.
- Decoupling sign from QC creation also avoids tight coupling for performance.

**Alternatives considered**:
- **Hard couple** (QC fail → sign fail) — Rejected: blocks receiver for QC-team responsibility.
- **Background job** — Rejected: introduces queue infra; user expects QC sample to exist immediately.

---

## R6 — Checklist Template Versioning

**Decision**: `receipt_checklist_templates` has columns `(id, category, version, isCurrent, itemsJson)`. When a template is edited, a NEW row is inserted with `version = previousVersion + 1` and `isCurrent = true`; previous row is set `isCurrent = false`. Signed checklists store `(templateId, templateVersion, capturedItemsJson)` — they materialize the items at sign time so future template edits do not mutate history.

**Rationale**:
- Spec FR-013 requires admin-editable templates without breaking historical signatures.
- GMP requires reproducibility — auditors must see the exact checklist that was signed.
- Soft-versioning avoids destructive UPDATE on a master table.

**Alternatives considered**:
- **In-place edit with audit log** — Rejected: reconstructing historical state from audit log is fragile.
- **Full normalized version table** — Rejected: over-engineered for items that are inherently small (4–6 items per template).

---

## R7 — Tolerance Configuration

**Decision**: New `receipt_tolerances` table mirroring `packaging_tolerances` (id, category, tolerancePercent, isActive, notes, createdAt, updatedAt). Seed with `('raw_material', 2.0)` and `('finished_goods', 5.0)`. Admin page reuses the DataGrid pattern from `master-data/packaging-tolerances`.

**Rationale**:
- Consistency with F019 — the same admin pattern, same UI, same permission shape.
- Configurability per FR-017.

**Alternatives considered**:
- **Settings JSON in app config** — Rejected: requires deploy to change; runtime DB config is better.
- **Per-item tolerance** — Out of scope; future enhancement if business demands.

---

## R8 — Source Document Discrimination (PO vs WO)

**Decision**: `goods_receipts` has columns `sourceType: 'po' | 'wo'`, `poId: int | null`, `woId: int | null`. CHECK at INSERT time (in Zod schema + service): exactly one of `poId`/`woId` must be non-null, and `sourceType` must match.

**Rationale**:
- Two-foreign-key + discriminator is the standard relational pattern for "exactly one of N references".
- Dropdowns in `new` page show only POs when sourceType=po, only WOs when sourceType=wo — clean UI separation.
- Avoids polymorphic FK ambiguity.

**Alternatives considered**:
- **Single polymorphic `sourceId` + `sourceType`** — Rejected: loses FK integrity; can't JOIN cleanly.
- **Separate `raw_material_grns` and `finished_goods_grns` tables** — Rejected: duplicates 80% of columns; dashboard query becomes a UNION.

---

## R9 — Dashboard Query Strategy

**Decision**: Dashboard tile counts come from a single MATERIALIZED query per tile, executed via TanStack Query with 30s `staleTime`. List page uses a single LEFT JOIN: `goods_receipts ← goods_receipt_lines ← inventory_lots`, aggregating line counts and the dominant status. Pagination at 50 rows server-side.

**Rationale**:
- Constitution IV (Performance): no N+1, queries return <500ms.
- TanStack Query handles invalidation automatically — after any mutation, dashboard refreshes without explicit polling.

**Alternatives considered**:
- **Materialized view in MySQL** — Rejected: SQLite doesn't support; breaks dual-schema testing.
- **Per-row count fetch** (N+1) — Rejected: violates Constitution IV.

---

## R10 — i18n

**Decision**: Add `src/locales/th/goodsReceipt.json` and `src/locales/en/goodsReceipt.json`. Thai is the primary locale (per F015 standard). Translation keys follow the established pattern: `actions.*`, `status.*`, `form.*.label`, `table.columns.*`, `toast.*`.

**Rationale**:
- Consistency with all prior features (015 onward).
- `bun run i18n:check` validates parity.

**Alternatives considered**: None — standard pattern.

---

## R11 — Permission Keys

**Decision**: Three new permission keys, seeded into `hr_app_permissions`:
- `inventory:goods_receipt:receive` — create a GRN, edit actuals before sign
- `inventory:goods_receipt:checklist` — sign the receiver checklist
- `quality:incoming:approve` — QA Release / Reject action

Default role mappings (seed):
- WH_STAFF, WH_MANAGER → receive + checklist
- QA_OFFICER, QA_MANAGER → approve
- ADMIN → all three, but Triple Independence still blocks self-approval

**Rationale**:
- FR-027 requires HR-system integration.
- Three keys map cleanly to the three workflow positions (receive, inspect, approve).

**Alternatives considered**:
- **Single combined `goods_receipt:*`** — Rejected: can't enforce segregation of duties; defeats Triple Independence.

---

## R12 — Default Test Panel Lookup

**Decision**: When auto-creating the QC sample for a receipt line, lookup `items.defaultTestPanelId` (existing column). If non-null, pass to `createSample()`. If null, set `qc_samples.flagForQcManager = true` and continue.

**Rationale**:
- FR-022 explicitly handles the missing-panel case.
- No new column needed on `items` — column already exists.
- Flag-and-continue keeps the receiver's flow unblocked.

**Alternatives considered**:
- **Block receipt until QC manager assigns a panel** — Rejected: penalizes operations for QC misconfiguration.

---

## Open questions

None. All known unknowns from the spec are resolved above. The plan proceeds to Phase 1.

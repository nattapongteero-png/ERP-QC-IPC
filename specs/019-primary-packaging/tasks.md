---
description: "Dependency-ordered task list for 019-primary-packaging"
---

# Tasks: Primary Packaging Material Issuance & Return

**Input**: Design documents from `/specs/019-primary-packaging/`
**Prerequisites**: spec.md, plan.md, research.md, data-model.md, contracts/

**Tests**: TDD is MANDATORY per Constitution v1.4.0 — all implementation tasks have a preceding failing-test task.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallel-safe (different files, no incomplete deps)
- **[Story]**: US1 / US2 / US3 / US4 / US5 (see spec.md)
- Paths relative to repo root `c:\Herbal ERP\herbal-medicine-erp\`

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Create folder structure: `src/app/production/work-orders/[id]/packaging-materials/{,return,verify,approve}/`, `src/app/api/production/work-orders/[id]/{packaging-issuances,packaging-returns,packaging-reconciliation}/`, `src/app/api/master-data/packaging-tolerances/`, `src/components/shared/`, `src/components/production/`, `tests/lib/services/`, `tests/api/packaging/`, `tests/components/production/`
- [ ] T002 [P] Create i18n message files: `src/locales/th/packaging.json` and `src/locales/en/packaging.json` per research.md R9 (page, form, return, status, buttons, errors, reconciliation, toast — ICU format `{var}`)
- [ ] T003 [P] Add sidebar entry "เบิก/คืน Packaging" pointing to `/production/work-orders` (operator finds entry inside WO page); plus admin entry "เกณฑ์ Tolerance" → `/master-data/packaging-tolerances` in `src/components/layout/sidebar.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Database Schema

- [ ] T004 Create `src/lib/db/schema-packaging.ts`: define `sqliteWoPackagingReturns` + `mysqlWoPackagingReturns` tables per data-model.md §1 (with all required FKs, indexes on `(wo_packaging_material_id)`, `(status, submitted_at)`, `(returner_user_id)`)
- [ ] T005 [P] In `src/lib/db/schema-packaging.ts`: define `sqliteWoPackagingReturnApprovals` + `mysqlWoPackagingReturnApprovals` tables per data-model.md §2 (UNIQUE on return_id, FKs to signatures + inventory_lots + deviations)
- [ ] T006 [P] In `src/lib/db/schema-packaging.ts`: define `sqlitePackagingTolerances` + `mysqlPackagingTolerances` tables per data-model.md §3 (UNIQUE on packaging_category)
- [ ] T007 In `src/lib/db/schema-packaging.ts`: define Drizzle relations for all 3 new tables (request↔items, return↔approval, approval↔signature, etc.)
- [ ] T008 Extend `sqliteWOPackagingMaterials` and `mysqlWOPackagingMaterials` in `src/lib/db/schema.ts`: add columns `container_label`, `verifier_user_id`, `verifier_signature_id`, `verified_at`, `flow_status` (default `'pending_verification'`) per data-model.md extension section. Add index `(work_order_id, container_label, created_at)`
- [ ] T009 Re-export new tables from `src/lib/db/schema.ts` index block (add after existing material-withdrawal exports)
- [ ] T010 Add seed function in `src/lib/db/seed.ts` after report categories block: insert 5 default `packaging_tolerances` rows (capsule 2.0, bottle 1.0, cap 1.0, label 0.5, other 1.0) idempotently; require admin user id

### Permissions

- [ ] T011 In `src/lib/db/seed-hr.ts`: add 4 new permission rows: `production:packaging:issue`, `production:packaging:return`, `production:packaging:approve`, `production:packaging:configure` (Production module)
- [ ] T012 Update role-permission seed (or document SQL to run post-deploy) so PROD_OPERATOR + PROD_MANAGER get `issue` + `return`; QC_MANAGER + QA_MANAGER + QA_OFFICER get `approve`; ADMIN + DIV_HEAD get `configure`

### Shared Types & Validation

- [ ] T013 [P] Create `src/types/packaging.ts`: TS interfaces `WOPackagingIssuance*`, `WOPackagingReturn*`, `WOPackagingReturnApproval*`, `PackagingTolerance`, `IssuanceStatus`, `ReturnStatus`, `ProposedReturnStatus`, `VarianceReason`, error codes class `PackagingError` with constants (DUAL_CONTROL_VIOLATION, TRIPLE_INDEPENDENCE_VIOLATION, USED_EXCEEDS_ISSUED, LOT_REJECTED_MUST_REJECT, VARIANCE_EXPLANATION_REQUIRED, CONTAINER_LABEL_REQUIRED, INSUFFICIENT_STOCK, MATERIAL_NOT_IN_BOM, NOT_PACKAGING_TYPE, INVALID_PASSWORD, ISSUANCE_NOT_PENDING, RETURN_NOT_PENDING_QA, OVERRIDE_REASON_REQUIRED)
- [ ] T014 [P] Create `src/lib/validation/packaging.ts`: Zod schemas — `createIssuanceSchema`, `verifyIssuanceSchema`, `createReturnSchema` (with conditional `varianceExplanation` required when outside tolerance OR rejected), `verifyReturnSchema`, `approveReturnSchema` (conditional `overrideReason` required), `createToleranceSchema`, `updateToleranceSchema`

**Checkpoint**: Foundation ready — DB tables exist, permissions seeded, types + validation available.

---

## Phase 3: User Story 1 — Operator Issues Packaging (Priority: P1) 🎯 MVP

**Goal**: Operator submits an issuance, verifier (different user) signs with e-sig, stock auto-deducts.

**Independent Test**: Login as operator → open WO → click "เบิก Packaging" → fill form → submit (status=pending_verification) → login as another operator → verify queue shows pending → sign with password → status=issued, stock decremented in inventory_lots.

### Tests for US1

- [ ] T015 [P] [US1] Failing service test in `tests/lib/services/packaging-issuance.service.test.ts`: `createIssuance` happy path (uses SQLite in-memory + seeded WO, BOM, packaging item, lot)
- [ ] T016 [P] [US1] Failing service test: `createIssuance` rejects when `items.type ≠ 'packaging'` (NOT_PACKAGING_TYPE)
- [ ] T017 [P] [US1] Failing service test: `createIssuance` rejects when item not in WO BOM (MATERIAL_NOT_IN_BOM)
- [ ] T018 [P] [US1] Failing service test: `createIssuance` rejects when stock insufficient (INSUFFICIENT_STOCK)
- [ ] T019 [P] [US1] Failing service test: `createIssuance` returns `containerLabelWarning=true` when same Container Label within 24h of same WO (warning, not block) — per FR-005 / R6
- [ ] T020 [P] [US1] Failing service test: `verifyIssuance` rejects when verifier === operator (DUAL_CONTROL_VIOLATION) — per FR-008
- [ ] T021 [P] [US1] Failing service test: `verifyIssuance` happy path — atomic stock deduction + signature row + flow_status → `issued`
- [ ] T022 [P] [US1] Failing service test: `verifyIssuance` rejects wrong password (INVALID_PASSWORD)
- [ ] T023 [P] [US1] Failing API integration test in `tests/api/packaging/issuances.test.ts`: `POST /api/production/work-orders/{id}/packaging-issuances` returns 201, 403 without permission, 400 invalid body
- [ ] T024 [P] [US1] Failing API integration test: `GET /api/production/work-orders/{id}/packaging-issuances?status=pending_verification` returns scoped list
- [ ] T025 [P] [US1] Failing API integration test: `POST /api/production/work-orders/{id}/packaging-issuances/{issuanceId}/verify` — happy path + DUAL_CONTROL_VIOLATION + INVALID_PASSWORD
- [ ] T026 [P] [US1] Failing component test in `tests/components/production/packaging-issuance-form.test.tsx`: renders, validates required fields, submits via mocked fetch
- [ ] T027 [P] [US1] Failing component test in `tests/components/shared/container-label-input.test.tsx`: shows warning indicator when API returns duplicate flag

### Service Layer (US1)

- [ ] T028 [US1] Create `src/lib/services/packaging-issuance.service.ts`. Implement `createIssuance(input, operatorUserId)`: validate WO active, BOM membership, items.type='packaging', stock sufficient, container label 24h check (warning), insert row with flow_status=`pending_verification` via `auditedInsert`
- [ ] T029 [US1] In `src/lib/services/packaging-issuance.service.ts`: implement `verifyIssuance(issuanceId, password, verifierUserId)` wrapped in transaction:
  1. Load row, verify flow_status=`pending_verification`
  2. Dual Control: verifier ≠ operator
  3. Verify password via existing auth helper → capture signature row
  4. Lock source lot row, verify stock still sufficient
  5. Update row: verifier_user_id, verifier_signature_id, verified_at, flow_status=`issued`
  6. Insert inventory_transaction (type=`issue`, negative qty)
  7. Decrement lot quantity
  8. Return detail with transaction id
- [ ] T030 [US1] In same file: implement `getIssuanceById`, `listIssuancesForWO(workOrderId, status?)`, `cancelIssuance(id, operatorId)` (only pending + own)

### API Layer (US1)

- [ ] T031 [US1] Create `src/app/api/production/work-orders/[id]/packaging-issuances/route.ts`: POST (Zod validate, permission `production:packaging:issue`, call service, return 201) + GET (list)
- [ ] T032 [US1] Create `src/app/api/production/work-orders/[id]/packaging-issuances/[issuanceId]/route.ts`: GET detail
- [ ] T033 [US1] Create `src/app/api/production/work-orders/[id]/packaging-issuances/[issuanceId]/verify/route.ts`: POST verify (Dual Control via service)
- [ ] T034 [US1] Create `src/app/api/production/work-orders/[id]/packaging-issuances/[issuanceId]/cancel/route.ts`: POST cancel (owner-only)

### UI Layer (US1)

- [ ] T035 [P] [US1] Create `src/components/shared/container-label-input.tsx`: TextBox with debounced async duplicate-check fetch, yellow warning chip if `duplicateInLast24h` returns true
- [ ] T036 [P] [US1] Create `src/components/production/packaging-issuance-form.tsx`: DevExtreme `Popup` + `Form` (Material SelectBox filtered to BOM + type=packaging, Source Lot SelectBox with FIFO ordering, Quantity NumberBox integer, ContainerLabelInput, Room SelectBox); TanStack Query mutation; i18n errors via `useTranslations('packaging')`
- [ ] T037 [P] [US1] Create `src/components/production/packaging-issuance-table.tsx`: DataGrid showing issuances for a WO with status chips, filter by flow_status, click-to-verify
- [ ] T038 [US1] Create `src/app/production/work-orders/[id]/packaging-materials/page.tsx`: server-render WO context + render `<PackagingIssuanceForm/>` + `<PackagingIssuanceTable/>`; permission-gated to `production:packaging:issue`
- [ ] T039 [US1] Create `src/app/production/work-orders/[id]/packaging-materials/verify/page.tsx`: verifier queue — list of `pending_verification` issuances of this WO + ESignaturePromptDialog flow

**Checkpoint**: US1 functional — operator can issue, verifier signs, stock deducts. Run gates (`bunx tsc --noEmit --skipLibCheck`, `bun run lint`, `bun run test:run -- packaging`) and commit.

---

## Phase 4: User Story 2 — Operator Returns Packaging (Priority: P1) 🎯 MVP

**Goal**: Operator submits a return for an issued packaging, verifier signs, return enters `pending_qa_approval`.

**Independent Test**: Using an `issued` row from US1, open Return page → fill used/return/reason/container label/proposed status → submit → another user verifies → status=pending_qa_approval.

### Tests for US2

- [ ] T040 [P] [US2] Failing service test in `tests/lib/services/packaging-return.service.test.ts`: `createReturn` happy path; variance computed correctly (used=750, return=45 → variance=5)
- [ ] T041 [P] [US2] Failing service test: `createReturn` rejects USED_EXCEEDS_ISSUED (FR-015)
- [ ] T042 [P] [US2] Failing service test: `createReturn` flags `outsideTolerance=true` when variance% > tolerance for material's category (FR-016) — using seeded packaging_tolerances
- [ ] T043 [P] [US2] Failing service test: `createReturn` rejects LOT_REJECTED_MUST_REJECT — when source lot status=`rejected` and proposed_status ≠ `rejected` (FR-017)
- [ ] T044 [P] [US2] Failing service test: `createReturn` requires `varianceExplanation` when `outside_tolerance=true` OR `proposed_status='rejected'`
- [ ] T045 [P] [US2] Failing service test: `verifyReturn` rejects when verifier === returner (DUAL_CONTROL_VIOLATION)
- [ ] T046 [P] [US2] Failing API integration test in `tests/api/packaging/returns.test.ts`: `POST .../packaging-returns` returns 201 + persists, 400 for each error code
- [ ] T047 [P] [US2] Failing API integration test: `POST .../packaging-returns/{id}/verify` happy + DUAL_CONTROL_VIOLATION
- [ ] T048 [P] [US2] Failing component test in `tests/components/production/packaging-return-dialog.test.tsx`: renders, computes variance live, conditional explanation field, submits

### Service Layer (US2)

- [ ] T049 [US2] Create `src/lib/services/packaging-return.service.ts`. Implement `resolveTolerance(itemCategory)` — heuristic per R7 mapping items.category → tolerance category, look up `packaging_tolerances`, fallback to `other`, hard default 1.0
- [ ] T050 [US2] In same file: implement `createReturn(input, returnerUserId)`:
  1. Load referenced issuance, verify flow_status=`issued`
  2. Validate usedQty + returnQty ≤ issuedQty
  3. Validate source lot not rejected (if rejected → block unless proposed_status=`rejected`)
  4. Compute variance qty + percent + outsideTolerance via `resolveTolerance`
  5. Validate varianceExplanation required iff outsideTolerance OR proposed=`rejected`
  6. Insert row with status=`pending_qa_approval` (returner signs at create-time? No: returner_user_id stored; verifier signs separately)
  7. Return detail
- [ ] T051 [US2] In same file: implement `verifyReturn(returnId, password, verifierUserId)`: verify Dual Control + e-sig → update verifier_user_id, verifier_signature_id, verified_at; status stays `pending_qa_approval` (used as a flag — verified must occur before QA can act)
- [ ] T052 [US2] In same file: implement `getReturnById(id)`, `listReturnsForWO(workOrderId, status?)`

### API Layer (US2)

- [ ] T053 [US2] Create `src/app/api/production/work-orders/[id]/packaging-returns/route.ts`: POST (create) + GET (list)
- [ ] T054 [US2] Create `src/app/api/production/work-orders/[id]/packaging-returns/[returnId]/route.ts`: GET detail
- [ ] T055 [US2] Create `src/app/api/production/work-orders/[id]/packaging-returns/[returnId]/verify/route.ts`: POST verify

### UI Layer (US2)

- [ ] T056 [P] [US2] Create `src/components/production/packaging-return-dialog.tsx`: DevExtreme `Popup` + `Form` (Issuance SelectBox showing issued items, Used/Return NumberBoxes with live variance calc, Variance Reason SelectBox + conditional TextArea, ContainerLabelInput, Proposed Status RadioGroup) + i18n
- [ ] T057 [US2] Create `src/app/production/work-orders/[id]/packaging-materials/return/page.tsx`: hosts the return dialog; permission-gated to `production:packaging:return`

**Checkpoint**: US2 functional — return flow works. Commit.

---

## Phase 5: User Story 3 — QA Reviews and Approves Return (Priority: P1) 🎯 MVP

**Goal**: QA opens queue, reviews a verified return, approves with chosen final status; system atomically updates stock (creates child lot via parentLotId), captures signature, creates deviation when needed.

**Independent Test**: Use a verified return from US2 → login as QA → open queue → approve as Reusable + e-sig → verify: new lot exists, inventory_transaction created, return.status=approved_reusable, no deviation (within tolerance) OR with deviation (outside tolerance).

### Tests for US3

- [ ] T058 [P] [US3] Failing service test in `tests/lib/services/packaging-return.service.test.ts`: `approveReturn` happy path Reusable — single transaction creates inventory_lot (parentLotId=source), inventory_transaction (positive qty), approval row, updates return.status; returns new lot id + transaction id
- [ ] T059 [P] [US3] Failing service test: `approveReturn` rejects when QA === returner (TRIPLE_INDEPENDENCE_VIOLATION) — per R2 (defense in depth; even admin must satisfy)
- [ ] T060 [P] [US3] Failing service test: `approveReturn` rejects when QA === verifier (TRIPLE_INDEPENDENCE_VIOLATION)
- [ ] T061 [P] [US3] Failing service test: `approveReturn` rejects when finalStatus differs from proposed without `overrideReason` (OVERRIDE_REASON_REQUIRED)
- [ ] T062 [P] [US3] Failing service test: `approveReturn` happy path Quarantine — new lot status=`quarantine`
- [ ] T063 [P] [US3] Failing service test: `approveReturn` Rejected — no new lot, no transaction, deviation created
- [ ] T064 [P] [US3] Failing service test: `approveReturn` outside_tolerance — deviation created regardless of final status
- [ ] T065 [P] [US3] Failing service test: `approveReturn` atomicity — if deviation insert fails, the entire approval rolls back (no orphan lots) — simulate by throwing inside transaction
- [ ] T066 [P] [US3] Failing API integration test in `tests/api/packaging/approve.test.ts`: `POST .../packaging-returns/{id}/approve` happy + TRIPLE_INDEPENDENCE_VIOLATION + INVALID_PASSWORD + RETURN_NOT_PENDING_QA + OVERRIDE_REASON_REQUIRED
- [ ] T067 [P] [US3] Failing API integration test: `POST .../packaging-returns/{id}/reject` shortcut endpoint with `reason` parameter
- [ ] T068 [P] [US3] Failing component test in `tests/components/production/packaging-return-approval-card.test.tsx`: renders detail, propose/override flow, e-sig prompt

### Service Layer (US3)

- [ ] T069 [US3] In `src/lib/services/packaging-return.service.ts`: implement `approveReturn(returnId, input, qaUserId)` wrapped in `db.transaction(async tx => ...)` per R3:
  1. Load return row + verify status=`pending_qa_approval` + verified_at NOT NULL
  2. Triple Independence: qaUserId ≠ returner, qaUserId ≠ verifier
  3. Verify password → capture signature row (entity=`packaging_return`, action=approve|reject)
  4. Validate overrideReason if finalStatus differs from mapped proposed
  5. Map finalStatus to `approved_reusable`/`approved_quarantine`/`rejected`; update return row
  6. IF Reusable OR Quarantine: insert new inventory_lot (parentLotId=source lot, qty=returnQty, status='available' or 'quarantine'); insert inventory_transaction (type=`return`, positive qty)
  7. IF outsideTolerance was true OR finalStatus=`rejected`: insert deviation linking back to return (deviation_type='packaging_return')
  8. Insert approval row with all FKs filled
  9. Return { return, newLotId?, inventoryTransactionId?, deviationId? }
- [ ] T070 [US3] In same file: implement `rejectReturn(returnId, reason, qaUserId, password)` — convenience wrapper that calls `approveReturn` with finalStatus=`rejected` + overrideReason=reason
- [ ] T071 [US3] In same file: implement `listPendingApprovalsForQA(qaUserId, factoryCode?)` — supervisor queue scope (returns verified rows pending QA, excluding those where QA would violate Triple Independence)

### API Layer (US3)

- [ ] T072 [US3] Create `src/app/api/production/work-orders/[id]/packaging-returns/[returnId]/approve/route.ts`: POST; permission `production:packaging:approve`; admin role does NOT bypass Triple Independence (per R2); map service errors to 400/403
- [ ] T073 [US3] Create `src/app/api/production/work-orders/[id]/packaging-returns/[returnId]/reject/route.ts`: POST reject (shortcut)

### UI Layer (US3)

- [ ] T074 [P] [US3] Create `src/components/production/packaging-return-approval-card.tsx`: shows return summary + propose-vs-final status, override reason field appears when changing final status, ESignaturePromptDialog for e-sig
- [ ] T075 [US3] Create `src/app/production/work-orders/[id]/packaging-materials/approve/page.tsx`: QA queue page using DataGrid + ApprovalCard rows; refetch every 30s

**Checkpoint**: US3 functional — MVP complete (US1+US2+US3 P1 stories all done). Commit.

---

## Phase 6: User Story 4 — Reconciliation Report (Priority: P2)

**Goal**: Render per-WO reconciliation table showing BOM Planned, Issued, Used, Returned, Variance, %Variance, Within Tolerance; with Excel/PDF export.

**Independent Test**: Generate sample data via US1+US2+US3 → open Reconciliation card on WO detail → see correct totals; export Excel → file downloads with same data.

### Tests for US4

- [ ] T076 [P] [US4] Failing service test in `tests/lib/services/packaging-reconciliation.service.test.ts`: `getReconciliation(workOrderId)` aggregates correctly across multiple issuances + returns per item
- [ ] T077 [P] [US4] Failing service test: reconciliation marks `withinTolerance=false` and includes `deviationIds` when variance% > tolerance
- [ ] T078 [P] [US4] Failing API integration test in `tests/api/packaging/reconciliation.test.ts`: `GET .../packaging-reconciliation?format=json` shape matches contract; `format=excel` returns binary
- [ ] T079 [P] [US4] Failing component test in `tests/components/production/packaging-reconciliation-card.test.tsx`: renders table, summary row, status chips, Export button

### Service Layer (US4)

- [ ] T080 [US4] Create `src/lib/services/packaging-reconciliation.service.ts`: implement `getReconciliation(workOrderId)` — aggregates by item (SUM issued_qty for status=`issued`; SUM returned for approved_reusable; SUM used regardless of QA outcome); computes variance + %; looks up tolerance via `resolveTolerance`; returns rows + summary per data-model.md "Reconciliation Formula"
- [ ] T081 [US4] In same file: implement export helpers `toExcel(report)` and `toPdf(report)` (reuse existing utility patterns from `src/lib/utils/export-*` if present; else create minimal)

### API Layer (US4)

- [ ] T082 [US4] Create `src/app/api/production/work-orders/[id]/packaging-reconciliation/route.ts`: GET handler dispatching to JSON/Excel/PDF based on `format` query

### UI Layer (US4)

- [ ] T083 [P] [US4] Create `src/components/production/packaging-reconciliation-card.tsx`: DevExtreme `DataGrid` with summary row, color-coded `withinTolerance` cell, Export Excel/PDF buttons calling API
- [ ] T084 [US4] Embed `<PackagingReconciliationCard/>` in WO detail page (extend `src/app/production/work-orders/[id]/page.tsx` — minimal edit, one-line component embed near existing reconciliation areas)

**Checkpoint**: US4 functional — Reconciliation works for any WO. Commit.

---

## Phase 7: User Story 5 — Trend & Wastage Analytics (Priority: P3)

**Goal**: Time-series trend of packaging wastage rate; export.

### Tests for US5

- [ ] T085 [P] [US5] Failing service test in `tests/lib/services/packaging-reconciliation.service.test.ts`: `getTrend(filters)` returns one row per period, fills gaps with zero
- [ ] T086 [P] [US5] Failing API integration test: `GET /api/production/packaging-trend` shape matches contract

### Implementation (US5)

- [ ] T087 [US5] In `src/lib/services/packaging-reconciliation.service.ts`: implement `getTrend(filters)` — time-series aggregation
- [ ] T088 [US5] Create `src/app/api/production/packaging-trend/route.ts`: GET handler
- [ ] T089 [P] [US5] Create `src/app/production/packaging-analytics/page.tsx`: filter bar (date range, factory, packaging category), DevExtreme `Chart` BarSeries + summary KPI tiles, Export button

**Checkpoint**: US5 functional — analytics for management.

---

## Phase 8: Admin Tolerance Management (Cross-cutting — supports US2)

**Purpose**: Configurable per-category tolerance without code changes.

- [ ] T090 [P] Failing service test in `tests/lib/services/packaging-return.service.test.ts`: tolerance CRUD (createTolerance, updateTolerance, listTolerances)
- [ ] T091 [P] Failing API test in `tests/api/packaging/tolerances.test.ts`: CRUD endpoints per contracts/tolerances.yaml
- [ ] T092 In `src/lib/services/packaging-return.service.ts`: implement `createTolerance`, `updateTolerance`, `listTolerances` (admin-only)
- [ ] T093 Create `src/app/api/master-data/packaging-tolerances/route.ts` (GET + POST) and `src/app/api/master-data/packaging-tolerances/[id]/route.ts` (PUT)
- [ ] T094 Create `src/app/master-data/packaging-tolerances/page.tsx`: DevExtreme `DataGrid` inline-edit; permission `production:packaging:configure`

---

## Phase 9: Polish & Cross-Cutting

- [ ] T095 [P] Integration test in `tests/integration/packaging-atomic-rollback.test.ts`: simulate failure mid-approve-transaction (mock deviation insert throw) → verify return row, lot, and transaction all rolled back
- [ ] T096 [P] Integration test in `tests/integration/packaging-cross-contamination-block.test.ts`: source lot rejected → return as Reusable rejected with LOT_REJECTED_MUST_REJECT
- [ ] T097 [P] Performance test: reconciliation render ≤ 5s for WO with 50 issuances + 50 returns (SC-009)
- [ ] T098 [P] Performance test: Excel export ≤ 10s for same WO (SC-010)
- [ ] T099 [P] Run `bun run i18n:check` and fix missing keys
- [ ] T100 Verify Constitution gates: `bunx tsc --noEmit --skipLibCheck`, `bun run lint`, `bun run test:run`, `bun run build`
- [ ] T101 Walk through `specs/019-primary-packaging/quickstart.md` end-to-end on local stack
- [ ] T102 Update `CLAUDE.md` "Recent Changes" with one-line summary of 019 feature
- [ ] T103 Open PR/MR against `main` linking spec.md + plan.md + each US's Independent Test

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No deps — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all stories
- **Phase 3 (US1)**: Depends on Phase 2
- **Phase 4 (US2)**: Depends on Phase 2; also needs US1 data shape (issuance row referenced by return) — but service tests can use seed factories without full US1 UI
- **Phase 5 (US3)**: Depends on Phase 4 (return row to approve)
- **Phase 6 (US4)**: Depends on Phase 5 (data to aggregate)
- **Phase 7 (US5)**: Depends on Phase 6 (extends aggregation service)
- **Phase 8 (Tolerances admin UI)**: Can run parallel with US1+ once Phase 2 done; default seed (T010) covers MVP
- **Phase 9 (Polish)**: Depends on US1 + US2 + US3 (MVP)

### Within Each User Story

- TDD: tests MUST fail before implementation (Constitution II)
- Schema → service → API → UI strictly
- Service tests use SQLite in-memory

### Parallel Opportunities

- Phase 2 table-definition tasks T005, T006 are [P]
- Phase 3 tests T015–T027 are all [P]
- Phase 4 tests T040–T048 are [P]
- Phase 5 tests T058–T068 are [P]
- Phase 6 tests T076–T079 are [P]
- US1 and US2 can be developed in parallel (different files) once Phase 2 done; US3 needs US2's data shape

---

## Parallel Example: User Story 3 Tests

```text
Task T058: approveReturn happy Reusable
Task T059: approveReturn QA===returner blocked
Task T060: approveReturn QA===verifier blocked
Task T061: approveReturn override requires reason
Task T062: approveReturn happy Quarantine
Task T063: approveReturn Rejected — no lot/transaction
Task T064: approveReturn outside_tolerance creates deviation
Task T065: approveReturn atomicity (rollback on partial failure)
Task T066: API approve endpoint
Task T067: API reject shortcut
Task T068: ApprovalCard component
```

All 11 tasks share zero file dependencies — write all failing tests in parallel.

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 — all P1)

These three stories together = MVP. None alone is useful (issue without return = no reconciliation; return without approval = stuck pending; approval without issue/return = nothing to approve).

1. Phase 1 Setup (T001–T003)
2. Phase 2 Foundational (T004–T014)
3. Phase 3 US1 (T015–T039) — operator issuance
4. Phase 4 US2 (T040–T057) — operator return
5. Phase 5 US3 (T058–T075) — QA approval
6. **STOP**: walk quickstart sections 4–6, commit, open PR

### Incremental Delivery

- Add US4 (Reconciliation Report) — adds governance/audit visibility
- Add US5 (Trend Analytics) — adds strategic insight
- Add Phase 8 (admin tolerance UI) — anytime after Phase 2

### Parallel Team Strategy (with 3 devs)

After Phase 2:
- Dev A: US1 (operator issuance)
- Dev B: US2 (operator return) — can mock US1 in tests
- Dev C: prepares US3 scaffolding (DB queries, transaction tests) — final integration after US2

---

## Notes

- [P] = different files, no incomplete deps
- Tests MUST fail before impl (TDD, Constitution II.1)
- Commit per task or logical group (Constitution I.5)
- Every commit must pass `bunx tsc --noEmit --skipLibCheck` and `bun run lint`
- Triple Independence enforcement is NEW vs feature 018 — even admin must satisfy (per research R2)
- Atomic approval transaction has 7 side-effects — test rollback path explicitly (T065)
- Error codes are stable strings used in tests + API + i18n — define centrally in `packaging.errors.ts` (or within types/packaging.ts) early in T013
- Service-layer guards are mandatory; API-layer guards are early-warning defense in depth

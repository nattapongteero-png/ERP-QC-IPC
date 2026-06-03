---
description: "Task list for Feature 020: Goods Receipt & Incoming Inspection"
---

# Tasks: Goods Receipt & Incoming Inspection

**Input**: Design documents from `/specs/020-goods-receipt/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅
**TDD**: MANDATORY per Constitution v1.4.0 — every implementation task is preceded by a failing test task.

**Total tasks**: 87 across 9 phases.
**MVP scope**: Phases 1+2+3 (P1 — Raw Material GRN). 32 tasks total.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable — different files, no in-phase dependency
- **[Story]**: User story label (US1–US5); Setup/Foundational/Polish have no story label

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize feature workspace and shared constants

- [x] T001 Create folder `src/components/goods-receipt/` with `.gitkeep`
- [x] T002 [P] Add Thai translation file `src/locales/th/goodsReceipt.json` with namespace stub (`actions.*`, `status.*`, `form.*`, `table.columns.*`, `toast.*`)
- [x] T003 [P] Add English translation file `src/locales/en/goodsReceipt.json` mirroring the Thai keys
- [x] T004 Register the `goodsReceipt` namespace in `src/lib/i18n/config.ts` namespaces array
- [x] T005 [P] Create `src/types/goods-receipt.ts` with: `GrnStatus`, `GrnLineStatus`, `ChecklistCategory`, `GRN_LINE_TRANSITIONS` constant, `GoodsReceiptErrorCode` enum (12 codes including `TRIPLE_INDEPENDENCE_VIOLATION`, `INVALID_TRANSITION`, `LOT_IN_QUARANTINE`, `SOURCE_ALREADY_RECEIVED`, `VARIANCE_NOT_JUSTIFIED`, `QC_NOT_APPROVED`, `CHECKLIST_INCOMPLETE`, `CANCELLATION_WINDOW_EXPIRED`, `DUPLICATE_VENDOR_LOT`, `EXPIRY_TOO_SHORT`, `MISSING_SIGNATURE`, `PERMISSION_DENIED`), and a `GoodsReceiptError` class extending Error

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, validation, seed data, permissions, sidebar — everything every user story depends on. **No user-story work begins until this phase is complete.**

### Database schema

- [x] T006 Create `src/lib/db/schema-goods-receipt.ts` with dual SQLite+MySQL definitions for: `goods_receipts`, `goods_receipt_lines`, `goods_receipt_checklists`, `receipt_checklist_templates`, `receipt_tolerances`, `goods_receipt_sequences` — exactly per `data-model.md` columns/indexes
- [x] T007 Add Drizzle `relations()` blocks in `src/lib/db/schema-goods-receipt.ts` linking GRN↔Lines, Lines↔Checklist, Lines↔Lot, Lines↔QcSample
- [x] T008 Re-export the 6 new tables from `src/lib/db/schema.ts` so `schema-sync.ts` picks them up
- [x] T009 Extend `inventory_lots` (both SQLite and MySQL) with nullable `sourceGrnLineId INTEGER` + index in `src/lib/db/schema.ts`
- [x] T010 Extend `qc_samples` (both SQLite and MySQL) with nullable `sourceGrnLineId INTEGER` + `flagForQcManager BOOLEAN NOT NULL DEFAULT false` in `src/lib/db/schema.ts`
- [x] T011 Run `bun run db:sync` and confirm: 6 new tables created, 2 additive columns added, no destructive ALTERs proposed

### Validation schemas

- [x] T012 [P] Create `src/lib/validation/goods-receipt.ts` with Zod schemas: `createGrnSchema`, `updateGrnLineSchema`, `signChecklistSchema`, `qaReleaseSchema`, `qaRejectSchema`, `cancelGrnSchema`, `createTemplateSchema`, `updateTemplateSchema`

### Permissions + seed

- [x] T013 Add 3 new permissions (`inventory:goods_receipt:receive`, `inventory:goods_receipt:checklist`, `quality:incoming:approve`) and default role mappings (WH_STAFF/WH_MANAGER receive+checklist; QA_OFFICER/QA_MANAGER approve; ADMIN all) into `src/lib/db/seed.ts`
- [x] T014 [P] Seed `receipt_tolerances` rows `('raw_material', 2.0)` and `('finished_goods', 5.0)` in `src/lib/db/seed.ts`
- [x] T015 [P] Seed `receipt_checklist_templates` v1 for `raw_material` (4 items per FR-009) and `finished_goods` (5 items per FR-010) in `src/lib/db/seed.ts`

### Sidebar

- [x] T016 Add sidebar entries in `src/components/layout/sidebar.tsx`: Inventory → "ตรวจรับของ (GRN)" → `/inventory/goods-receipt`; Quality → "ตรวจรับเข้า (Incoming Inspection)" → `/quality/incoming-inspection`; Master Data → "Checklist Templates" → `/master-data/receipt-checklist-templates` — gated by the 3 new permissions

### Shared service helpers

- [x] T017 Create `src/lib/services/goods-receipt-numbering.service.ts` with `generateGrnNumber(year, tx)` — performs `FOR UPDATE` on `goods_receipt_sequences`, increments, formats `GRN-YYYY-NNNNN`
- [x] T018 [P] [TEST] Write Vitest for `goods-receipt-numbering.service.test.ts` covering: first GRN of year sets sequence to 2, concurrent calls produce no duplicates (sequential simulation), year rollover resets counter
- [x] T019 Implement numbering to make T018 pass

**Checkpoint**: Foundation ready — schema migrated, permissions live, sidebar visible. All user stories can now begin.

---

## Phase 3: User Story 1 — Raw Material GRN with Checklist & Auto-QC Sample (Priority: P1) 🎯 MVP

**Goal**: Warehouse receiver creates a numbered GRN against a PO, fills actuals, signs a 4-item checklist, and the system atomically creates an inventory lot in quarantine plus a linked QC sample.

**Independent Test**: With one approved PO and one WH_STAFF user, complete steps 1–4 of `quickstart.md` Walkthrough A and verify (a) GRN number assigned, (b) lot status=quarantine, (c) QC sample created with `sourceGrnLineId` set, (d) audit_trail entries written.

### Tests for User Story 1 (TDD Red phase)

- [x] T020 [P] [US1] [TEST] Write failing test `tests/lib/services/goods-receipt.service.test.ts::createGrnFromPo` — creates GRN from a 2-line PO, asserts GRN number format, line count, header status `in_progress`
- [x] T021 [P] [US1] [TEST] Write failing test `tests/lib/services/goods-receipt.service.test.ts::updateLineActuals` — accepts within tolerance, flags `quantity_variance` when over 2%, requires `varianceReason`
- [x] T022 [P] [US1] [TEST] Write failing test `tests/lib/services/goods-receipt-checklist.service.test.ts::signChecklist` — rejects incomplete checklist, accepts complete with valid signature, creates `inventory_lots` row in `quarantine`, creates linked `qc_samples` row with `sourceGrnLineId` and status `registered`, returns `qcSampleCreationFailed=false`
- [x] T023 [P] [US1] [TEST] Write failing test `tests/lib/services/goods-receipt-checklist.service.test.ts::signChecklist_missingDefaultPanel` — when `items.defaultTestPanelId IS NULL`, sample still created but `flagForQcManager=true` and line `qcSampleCreationFailed=false`
- [x] T024 [P] [US1] [TEST] Write failing test `tests/lib/services/material-withdrawal.service.test.ts::cannotWithdrawFromQuarantine` — attempt to consume a lot whose status=`quarantine` returns error code `LOT_IN_QUARANTINE`
- [x] T025 [P] [US1] [TEST] Write failing API integration test `tests/api/goods-receipts/createGrn.test.ts` — POST /api/inventory/goods-receipts asserts 201 + GRN body + lines populated; missing permission returns 403

### Implementation for User Story 1

- [x] T026 [P] [US1] Create `src/lib/services/goods-receipt.service.ts` with: `createGrnFromPo(input, userId)`, `updateLine(lineId, patch, userId)`, `getGrnById(id)`, `listGrns(filter, pagination)` — uses `executeDbOperation`, `getTableRef`, `getInsertId`, `getNow`, `toDbDate`, `toQueryDate` per project conventions. Uses `auditedInsert/auditedUpdate` for state changes.
- [x] T027 [US1] Create `src/lib/services/goods-receipt-checklist.service.ts` with `signChecklist(lineId, payload, userId)` — wraps everything in a single `db.transaction`: validates checklist completeness, captures signature via `electronic_signatures`, inserts `goods_receipt_checklists` row with `capturedItemsJson` snapshot of template items, updates line status to `checklist_done`, calls `createInventoryLot(...quarantine)`, calls `createQcSampleForGrnLine()`, updates line status to `qc_pending` if QC succeeded
- [x] T028 [US1] In `src/lib/services/goods-receipt-checklist.service.ts`, implement `createQcSampleForGrnLine(lineId, lotId, itemId, defaultTestPanelId)` — calls existing `qc-sample.service.ts::createSample()` with `sourceGrnLineId`, returns sample ID; if `defaultTestPanelId IS NULL`, sets `flagForQcManager=true` on the sample
- [x] T029 [US1] Update `src/lib/services/material-withdrawal.service.ts` (or `inventory.service.ts` if withdrawal lives there) to reject any withdrawal source lot whose status is `quarantine | under_test | rejected | blocked` with `GoodsReceiptError('LOT_IN_QUARANTINE')`
- [x] T030 [P] [US1] Create API route `src/app/api/inventory/goods-receipts/route.ts` — GET (list with filters per `goods-receipts.yaml`), POST (create from PO). Enforces `inventory:goods_receipt:receive` permission. Returns 403 on missing perm, 409 on `SOURCE_ALREADY_RECEIVED`
- [x] T031 [P] [US1] Create API route `src/app/api/inventory/goods-receipts/[id]/route.ts` — GET (detail with lines, signatures, history), PATCH (header notes only after sign)
- [x] T032 [US1] Create API route `src/app/api/inventory/goods-receipts/[id]/lines/[lineId]/route.ts` — PATCH (update actuals, vendor lot, dates, variance reason). Rejects with 409 if line is not in `created` status
- [x] T033 [US1] Create API route `src/app/api/inventory/goods-receipts/[id]/lines/[lineId]/checklist/route.ts` — POST signs checklist. Enforces `inventory:goods_receipt:checklist` permission. Calls `signChecklist()`. Returns line + inventoryLotId + qcSampleId
- [x] T034 [P] [US1] Create list page `src/app/inventory/goods-receipt/page.tsx` — `MainLayout` wrapper not needed (inherited from parent layout if present; verify before adding). Uses DevExtreme `DataGrid` with columns: GRN number, source type, vendor/WO, received date, status (badge), line count. Filters: status, source type, date range, vendor. Pagination 50.
- [x] T035 [P] [US1] Create new-GRN page `src/app/inventory/goods-receipt/new/page.tsx` — DevExtreme `RadioGroup` for source type, `SelectBox` showing approved POs (when raw) or `packaging_complete` WOs (when finished goods), `DateBox` for received date, `SelectBox` for warehouse. On submit calls POST /api/inventory/goods-receipts and navigates to detail
- [x] T036 [US1] Create detail page `src/app/inventory/goods-receipt/[id]/page.tsx` — header card (GRN number, status, source link, receiver, date), DevExtreme `DataGrid` of lines with inline edit for actuals, "Sign Checklist" button per line → opens `ChecklistEditor` popup → `ElectronicSignatureDialog`. Shows linked lot ID + QC sample ID once signed.
- [x] T037 [P] [US1] Create reusable `src/components/goods-receipt/checklist-editor.tsx` — DevExtreme `Popup` containing checkbox list of mandatory items from the current template, remarks `TextArea` per item, validates all mandatory items checked before enabling sign button
- [x] T038 [P] [US1] Create `src/components/goods-receipt/grn-source-picker.tsx` — DevExtreme `SelectBox` with custom item template showing PO number+vendor or WO number+product. Filters internally based on `sourceType` prop.
- [x] T039 [US1] Add Thai translations for all US1 strings in `src/locales/th/goodsReceipt.json`: page titles, button labels, status badges, checklist item descriptions, toasts, error messages
- [x] T040 [P] [US1] Add English mirror in `src/locales/en/goodsReceipt.json`
- [x] T041 [P] [US1] [TEST] Write failing RTL test `tests/app/inventory/goods-receipt/page.test.tsx` — renders dashboard tiles, asserts no console errors, asserts loading and empty states render
- [x] T042 [US1] Run `bunx tsc --noEmit --skipLibCheck` and fix all type errors introduced by US1
- [x] T043 [US1] Run `bun run lint` and fix all lint errors introduced by US1
- [x] T044 [US1] Manually walk through `quickstart.md` Walkthrough A steps 1–4 on the running dev server (port 33021) — verify GRN number, lot quarantine, QC sample created
- [x] T045 [US1] Git commit US1: `feat(020): raw material GRN with checklist + auto-QC sample (US1)`

**Checkpoint**: User Story 1 fully functional — MVP achievable here. Stop and validate before proceeding.

---

## Phase 4: User Story 2 — Finished Goods GRN from Production WO (Priority: P1)

**Goal**: Production supervisor receives finished goods from a Work Order with batch number, FG-specific 5-item checklist, and yield-variance handling.

**Independent Test**: With one WO in `packaging_complete` status and a production user, complete `quickstart.md` Walkthrough B steps 1–3.

### Tests for User Story 2

- [x] T046 [P] [US2] [TEST] Write failing test `tests/lib/services/goods-receipt.service.test.ts::createGrnFromWo` — creates GRN from a WO, pre-populates FG line with expected qty from WO output, header gets `sourceType='wo'` + `woId` set
- [x] T047 [P] [US2] [TEST] Write failing test `tests/lib/services/goods-receipt.service.test.ts::yieldVarianceFlag` — actual 9650 vs expected 10000 (3.5%) does not flag; actual 9200 (8%) flags `yield_variance` and requires reason
- [x] T048 [P] [US2] [TEST] Write failing test `tests/lib/services/goods-receipt.service.test.ts::woAlreadyFullyReceived` — second GRN attempt on a WO whose first GRN already covered all expected output returns 409 `SOURCE_ALREADY_RECEIVED` unless override flag is set
- [x] T049 [P] [US2] [TEST] Write failing test `tests/lib/services/goods-receipt-checklist.service.test.ts::fgChecklistVariant` — when line's GRN is `sourceType='wo'`, the checklist template fetched is `finished_goods` v(current), with 5 items

### Implementation for User Story 2

- [x] T050 [US2] Extend `goods-receipt.service.ts::createGrnFromWo(input, userId)` — fetches WO output spec, creates GRN with `sourceType='wo'`, populates lines from WO expected output
- [x] T051 [US2] Extend `goods-receipt.service.ts::updateLine` — when GRN sourceType=`wo`, use `finished_goods` tolerance (5% default) and flag `yield_variance` instead of `quantity_variance`
- [x] T052 [US2] Extend `signChecklist()` in `goods-receipt-checklist.service.ts` to select FG template when `category='finished_goods'`
- [x] T053 [US2] Extend POST `src/app/api/inventory/goods-receipts/route.ts` to accept `sourceType='wo'` and route to `createGrnFromWo`
- [x] T054 [P] [US2] Add "Receive into Stock" action button on `src/app/production/work-orders/[id]/page.tsx` — visible only when WO status=`packaging_complete`. Navigates to `/inventory/goods-receipt/new?woId={id}`
- [x] T055 [US2] Update `src/app/inventory/goods-receipt/new/page.tsx` to read `?poId=` or `?woId=` query params and prefill source picker
- [x] T056 [US2] Add FG translation keys to `src/locales/{th,en}/goodsReceipt.json` (FG checklist labels, yield variance, batch number)
- [x] T057 [US2] Run `bunx tsc --noEmit --skipLibCheck` + `bun run lint` and fix
- [x] T058 [US2] Manually walk through `quickstart.md` Walkthrough B
- [x] T059 [US2] Git commit US2: `feat(020): finished goods GRN from work order (US2)`

**Checkpoint**: US1 + US2 both work independently. Both source types covered.

---

## Phase 5: User Story 3 — QA Approval & Release to Stock with Triple Independence (Priority: P1)

**Goal**: QA officer can release a line whose checklist is signed and QC sample is approved; Triple Independence is enforced (Admin not bypass); reject path auto-creates a deviation.

**Independent Test**: Complete `quickstart.md` Walkthrough A step 6 + Walkthrough C (Triple Independence) + Walkthrough D (Reject).

### Tests for User Story 3

- [x] T060 [P] [US3] [TEST] Write failing test `tests/lib/services/goods-receipt-qa.service.test.ts::releaseToStock` — given line in `qc_approved`, releases → line status `released_to_stock`, lot status `released`, audit_trail entry, electronic_signature row, all in single transaction
- [x] T061 [P] [US3] [TEST] Write failing test `tests/lib/services/goods-receipt-qa.service.test.ts::tripleIndependenceBlocksReceiver` — same user who signed checklist attempts release → throws `TRIPLE_INDEPENDENCE_VIOLATION` with NO db writes
- [x] T062 [P] [US3] [TEST] Write failing test `tests/lib/services/goods-receipt-qa.service.test.ts::adminCannotBypassTI` — admin role attempting self-release also throws `TRIPLE_INDEPENDENCE_VIOLATION`
- [x] T063 [P] [US3] [TEST] Write failing test `tests/lib/services/goods-receipt-qa.service.test.ts::cannotReleaseUnapprovedQc` — QC sample status `failed` → release returns `QC_NOT_APPROVED` 409
- [x] T064 [P] [US3] [TEST] Write failing test `tests/lib/services/goods-receipt-qa.service.test.ts::rejectCreatesDeviation` — reject with reason → line status `rejected`, lot status `rejected`, new `deviations` row linked to GRN, signed by QA
- [x] T065 [P] [US3] [TEST] Write failing API test `tests/api/goods-receipts/qa-release.test.ts` — POST /qa with action=release, simulate same-user case, expect 403 + `TRIPLE_INDEPENDENCE_VIOLATION`

### Implementation for User Story 3

- [x] T066 [US3] Create `src/lib/services/goods-receipt-qa.service.ts` with `qaRelease(lineId, signature, userId)` — atomic Drizzle transaction over 4 tables (signatures, lines, lots, audit_trail). FIRST step: Triple Independence check by comparing `userId` with `line.receiverSignature.signedByUserId`. Admin role check explicitly disabled.
- [x] T067 [US3] In `goods-receipt-qa.service.ts`, implement `qaReject(lineId, reason, signature, userId)` — atomic transaction that updates line→`rejected`, lot→`rejected`, inserts `deviations` row linked to GRN, writes audit
- [x] T068 [US3] Create API route `src/app/api/inventory/goods-receipts/[id]/lines/[lineId]/qa/route.ts` — POST accepts `{action: 'release'|'reject', rejectionReason?, signature}`. Enforces `quality:incoming:approve` permission. Routes to `qaRelease` or `qaReject`
- [x] T069 [US3] Extend `src/app/inventory/goods-receipt/[id]/page.tsx` — show "Release to Stock" button when line status=`qc_approved`, "Reject" button always (when not already terminal). Both open `ElectronicSignatureDialog`. Reject requires reason field (min 10 chars).
- [x] T070 [US3] Add Thai+English translations for QA actions: `actions.release`, `actions.reject`, `toast.released`, `toast.rejected`, error messages including TI violation
- [x] T071 [US3] Run `bunx tsc --noEmit --skipLibCheck` + `bun run lint` and fix
- [x] T072 [US3] Manually walk through Walkthroughs A6, C, D
- [x] T073 [US3] Git commit US3: `feat(020): QA release + reject with Triple Independence (US3)`

**Checkpoint**: All P1 stories complete — full receive-to-release flow live with GMP compliance.

---

## Phase 6: User Story 4 — Pending Dashboards (Priority: P2)

**Goal**: GRN list dashboard with 4 tiles (Pending Checklist, Pending QA, Released Today, Quarantine Aging) and a QC-perspective Incoming Inspection page.

**Independent Test**: With several GRNs in mixed states + at least 1 quarantine lot >14 days old, dashboard tiles show correct counts; clicking each drills into a filtered list.

### Tests for User Story 4

- [x] T074 [P] [US4] [TEST] Write failing test `tests/lib/services/goods-receipt-dashboard.service.test.ts::tileCounts` — fixture with known mix returns correct `{pendingChecklistCount, pendingQaCount, releasedTodayCount, quarantineAgingCount, staleQcSampleCount}`
- [x] T075 [P] [US4] [TEST] Write failing RTL test `tests/app/inventory/goods-receipt/dashboard.test.tsx` — renders 4 tiles with mock counts, no console errors

### Implementation for User Story 4

- [x] T076 [US4] Create `src/lib/services/goods-receipt-dashboard.service.ts` with `getDashboardCounts()` and `getPendingQaList(filter)` — single LEFT JOIN over `goods_receipts ← goods_receipt_lines ← inventory_lots`, no N+1
- [x] T077 [P] [US4] Create API route `src/app/api/quality/incoming-inspection/dashboard/route.ts` — GET returns counts per `incoming-inspection.yaml`
- [x] T078 [P] [US4] Create API route `src/app/api/quality/incoming-inspection/pending-qa/route.ts` — GET paginated list of lines awaiting QA
- [x] T079 [P] [US4] Create API route `src/app/api/quality/incoming-inspection/quarantine-aging/route.ts` — GET bands + items
- [x] T080 [US4] Create `src/components/goods-receipt/grn-dashboard-tiles.tsx` — 4-tile row, each tile is a click-through to filtered list
- [x] T081 [US4] Update `src/app/inventory/goods-receipt/page.tsx` to render dashboard tiles on top of the GRN list with filter parameter
- [x] T082 [US4] Create `src/app/quality/incoming-inspection/page.tsx` — QC perspective: items grouped by item code, with sample status badges, drill-through to GRN line
- [x] T083 [US4] Translations for tile labels + dashboard strings
- [x] T084 [US4] Type check + lint + manual walkthrough E
- [x] T085 [US4] Git commit US4: `feat(020): pending receipt + QC dashboards (US4)`

**Checkpoint**: Supervisors and QC have visibility — daily ops unblocked.

---

## Phase 7: User Story 5 — Receipt History & Audit Trail (Priority: P3)

**Goal**: Auditor can reach the GRN, checklist, signatures, and QC sample for any released lot in ≤3 clicks.

**Independent Test**: Pick any released lot from the lot detail page, follow GRN link, see history section.

### Tests for User Story 5

- [x] T086 [P] [US5] [TEST] Write failing test `tests/lib/services/lot-history.service.test.ts::lotShowsSourceGrn` — given a lot with `sourceGrnLineId`, helper returns GRN number + receiver + QA signature
- [x] T087 [P] [US5] [TEST] Write failing RTL test `tests/app/inventory/lots/[id]/page.test.tsx` — released lot detail shows "Source GRN" link

### Implementation for User Story 5

- [x] T088 [US5] Add `getLotSourceGrn(lotId)` helper in `src/lib/services/inventory.service.ts` (or a new `lot-history.service.ts`) — joins `inventory_lots` → `goods_receipt_lines` → `goods_receipts` → signatures + users
- [x] T089 [US5] Update `src/app/inventory/lots/[id]/page.tsx` — add "Source GRN" link section when `lot.sourceGrnLineId IS NOT NULL`. Show GRN number, receiver name + sig timestamp, QA name + release timestamp
- [x] T090 [P] [US5] Extend the History section in `src/app/inventory/goods-receipt/[id]/page.tsx` to list every state transition with user + time + reason. Source: `audit_trail` filtered by entity `goods_receipt_lines` + grnId
- [x] T091 [P] [US5] Wire `AuditLogViewerDialog` to GRN detail page — entity `goodsReceiptLines`, filter by current GRN
- [x] T092 [US5] Translations for history section + audit-related labels
- [x] T093 [US5] Type check + lint + manual walkthrough audit scenarios
- [x] T094 [US5] Git commit US5: `feat(020): receipt history + audit trail (US5)`

**Checkpoint**: Compliance/audit story complete.

---

## Phase 8: Master Data — Checklist Templates Admin + Tolerance Admin

**Purpose**: Admin can edit checklist templates (creates new version) and tolerance percentages.

- [x] T095 [P] [TEST] Write failing test `tests/lib/services/goods-receipt-checklist.service.test.ts::createTemplateNewVersion` — creating a new template marks previous `isCurrent=false`, increments version
- [x] T096 Create API routes `src/app/api/master-data/receipt-checklist-templates/route.ts` (GET list, POST new version) and `[id]/route.ts` (PATCH soft-deprecate)
- [x] T097 [P] Create admin page `src/app/master-data/receipt-checklist-templates/page.tsx` — DevExtreme `DataGrid` of templates, "New Version" popup with item editor (label, mandatory, sort)
- [x] T098 [P] Create admin page `src/app/master-data/receipt-tolerances/page.tsx` — clone of `packaging-tolerances` page pattern with `receipt_tolerances` entity (raw_material + finished_goods)
- [x] T099 [P] Create API routes `src/app/api/master-data/receipt-tolerances/route.ts` + `[id]/route.ts` — GET list, PUT update
- [x] T100 Add sidebar entries for both admin pages under Master Data (gated by `inventory:goods_receipt:configure` permission — add this 4th permission to seed if not present)
- [x] T101 Type check + lint + commit: `feat(020): checklist templates + tolerances admin (Phase 8)`

---

## Phase 9: Polish & Cross-Cutting

- [x] T102 [P] Add data-testid attributes to all interactive elements in US1–US5 pages so Playwright E2E tests can target reliably (per CLAUDE.md mandate)
- [x] T103 [P] Write Playwright E2E test `tests/e2e/goods-receipt.spec.ts` walking through `quickstart.md` Walkthroughs A + C end to end on the dev server
- [x] T104 Run `bun run i18n:check` and fix any missing translation keys
- [x] T105 Run the 3 verification SQL queries from `quickstart.md` § Verification queries against local UAT to confirm SC-003, SC-006, SC-008 invariants hold
- [x] T106 Update `CLAUDE.md` Recent Changes section to reference Feature 020
- [x] T107 Final `bunx tsc --noEmit --skipLibCheck` across whole project to verify no regressions in unrelated modules
- [x] T108 Final `bun run lint` and `bun run test:run` — all must pass
- [x] T109 Git commit polish: `chore(020): polish + E2E + verification (Phase 9)`

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: No deps, start immediately. T002/T003/T005 parallel.
- **Phase 2 (Foundational)**: Depends on Phase 1. Within phase, T006 blocks T007/T008/T009/T010 (same file/schema). T012 parallel. T014/T015 parallel after T013. T016 independent. T017→T018→T019 sequential.
- **Phase 3–5 (P1 stories US1, US2, US3)**: All depend on Phase 2. **Within a phase, all `[TEST]` tasks come before their corresponding implementation per TDD mandate.** US2 depends slightly on US1 (extends `createGrn` and detail page) but tests can be written in parallel. US3 depends on US1 (needs a `qc_approved` line to release).
- **Phase 6 (US4 dashboard)**: Depends on Phase 5 (needs full state machine to compute counts realistically).
- **Phase 7 (US5 audit)**: Depends on Phase 5 (needs released lots to test history).
- **Phase 8 (admin)**: Depends on Phase 2 only — can run anytime after foundational, even parallel to P1 stories if staffed.
- **Phase 9 (polish)**: Depends on all desired phases.

### User-story-level dependency summary

```
Phase 1 Setup
   ↓
Phase 2 Foundational  ←─── BLOCKING gate ─────┐
   ↓                                          │
   ├──→ Phase 3 (US1, P1, MVP)                │
   │       ↓                                  │
   │       ├──→ Phase 4 (US2, P1)             │
   │       └──→ Phase 5 (US3, P1)             │
   │              ↓                           │
   │              ├──→ Phase 6 (US4, P2)      │
   │              └──→ Phase 7 (US5, P3)      │
   │                                          │
   └──→ Phase 8 (Master data admin) ──────────┘ (independent of P1 stories)
                ↓
            Phase 9 (Polish & E2E)
```

### Parallelization map (within phase)

- **Phase 1**: T002 ∥ T003 ∥ T005 (different files)
- **Phase 2**: T012 ∥ T014 ∥ T015 ∥ T016 (independent)
- **Phase 3 tests**: T020 ∥ T021 ∥ T022 ∥ T023 ∥ T024 ∥ T025 (all different test files)
- **Phase 3 impl**: T026 first, then T030 ∥ T031 ∥ T034 ∥ T035 ∥ T037 ∥ T038 ∥ T040 ∥ T041 (different files)
- **Phase 5 tests**: T060 ∥ T061 ∥ T062 ∥ T063 ∥ T064 ∥ T065
- **Phase 6 APIs**: T077 ∥ T078 ∥ T079 (different routes)
- **Phase 8 pages**: T097 ∥ T098 ∥ T099 (different files)

---

## Parallel Example: Phase 3 (US1) test wave

```bash
# Run these failing tests in parallel — they cover independent code paths
Task: tests/lib/services/goods-receipt.service.test.ts::createGrnFromPo (T020)
Task: tests/lib/services/goods-receipt.service.test.ts::updateLineActuals (T021)
Task: tests/lib/services/goods-receipt-checklist.service.test.ts::signChecklist (T022)
Task: tests/lib/services/goods-receipt-checklist.service.test.ts::signChecklist_missingDefaultPanel (T023)
Task: tests/lib/services/material-withdrawal.service.test.ts::cannotWithdrawFromQuarantine (T024)
Task: tests/api/goods-receipts/createGrn.test.ts (T025)
```

---

## Implementation Strategy

### MVP First (Phases 1+2+3 — US1 only — 32 tasks)

1. Phase 1 Setup → ~1 hour
2. Phase 2 Foundational → ~3–4 hours (schema is the bulk)
3. Phase 3 US1 → ~6–8 hours (TDD cycle for ~6 services + UI)
4. **STOP and VALIDATE** with Walkthrough A
5. Demo-ready: raw material receipt with checklist + auto-QC + quarantine. Already a major compliance win.

### Incremental Delivery (recommended cadence)

- **Day 1**: Phases 1+2 → foundation
- **Day 2**: Phase 3 (US1) → MVP deploy
- **Day 3**: Phase 4 (US2) → FG support
- **Day 4**: Phase 5 (US3) → QA release + Triple Independence + Reject
- **Day 5**: Phase 6 (US4) → dashboards
- **Day 6**: Phase 7 (US5) + Phase 8 (admin) + Phase 9 (polish)

### Parallel team strategy

- Dev A: schema + foundational (Phase 1+2), then US1 service+API
- Dev B: US1 UI (after Dev A's API contract is stable)
- Dev C: Phase 8 admin (independent of US1)
- Once US1 ships: rotate to US2/US3 in parallel.

---

## Notes

- **TDD is MANDATORY**: every implementation task is preceded by a failing test task. Per Constitution v1.4.0 + project CLAUDE.md.
- **DevExtreme only** for all UI components — no shadcn/HTML primitives where DevExtreme equivalent exists.
- **i18n parity** — every Thai key MUST have an English mirror; CI enforces via `bun run i18n:check`.
- **Triple Independence is non-bypass-able** — verified in Phase 5 tests T061+T062.
- **Commit after each task** per Constitution I; phase-level commit messages above are summary tags.
- **No N+1 queries** — dashboard helpers must JOIN in a single query (verified by code review at T076).
- After T011 (schema sync), run a one-off check that `inventory_lots` and `qc_samples` did NOT lose any rows or break existing reads.

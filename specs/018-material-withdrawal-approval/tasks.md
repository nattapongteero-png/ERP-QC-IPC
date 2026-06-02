---
description: "Dependency-ordered task list for 018-material-withdrawal-approval"
---

# Tasks: Material Withdrawal Approval for Machine Setup Loss

**Input**: Design documents from `/specs/018-material-withdrawal-approval/`
**Prerequisites**: spec.md, plan.md, research.md, data-model.md, contracts/

**Tests**: TDD is MANDATORY per Constitution v1.4.0 (II) — all implementation tasks have a preceding failing-test task.

**Organization**: Tasks grouped by user story so each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallel-safe (different files, no incomplete deps)
- **[Story]**: US1 / US2 / US3 / US4 (see spec.md)
- File paths absolute or relative to repo root

## Path Conventions

Single Next.js project. Paths relative to `c:\Herbal ERP\herbal-medicine-erp\`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Folder layout, i18n scaffolding

- [ ] T001 Create folder structure: `src/app/material-withdrawal/{,pending,reports,rules}/`, `src/app/api/material-withdrawal/{requests,pending,reports,rules}/`, `src/components/production/`, `tests/lib/services/`, `tests/api/material-withdrawal/`, `tests/components/production/`
- [ ] T002 [P] Create i18n message files: `src/locales/th/material-withdrawal.json` and `src/locales/en/material-withdrawal.json` with keys per research.md R7 (common, form, table, status, toast, errors, buttons, phaseBlock)
- [ ] T003 [P] Add sidebar entry for "เบิกวัตถุดิบเพิ่ม" in `src/components/layout/sidebar.tsx` under Production section (collapsed by default until permissions granted)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, permissions, doc-type registration. MUST complete before any user story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Database Schema

- [ ] T004 Extend `src/lib/db/schema.ts`: add `sqliteMaterialWithdrawalRequests` + `mysqlMaterialWithdrawalRequests` tables per data-model.md §1 (work_order_id, factory_id, requested_by_user_id, requested_at, status, reason_type, reason_detail, machine_phase, room_id, cancelled_reason, created_at, updated_at) with indexes (work_order_id, status), (factory_id, requested_at), (requested_by_user_id)
- [ ] T005 [P] Extend `src/lib/db/schema.ts`: add `sqliteMaterialWithdrawalRequestItems` + `mysqlMaterialWithdrawalRequestItems` tables per data-model.md §2 with FK cascade-on-delete to requests
- [ ] T006 [P] Extend `src/lib/db/schema.ts`: add `sqliteMaterialWithdrawalApprovals` + `mysqlMaterialWithdrawalApprovals` tables per data-model.md §3 (UNIQUE on request_id, FK to signatures)
- [ ] T007 [P] Extend `src/lib/db/schema.ts`: add `sqliteMaterialWithdrawalAttachments` + `mysqlMaterialWithdrawalAttachments` tables per data-model.md §4
- [ ] T008 [P] Extend `src/lib/db/schema.ts`: add `sqliteMaterialWithdrawalRules` + `mysqlMaterialWithdrawalRules` tables per data-model.md §5 with UNIQUE (factory_id, material_category) treating NULL as wildcard
- [ ] T009 Extend existing `materialConsumption` table in `src/lib/db/schema.ts`: add column `additional_qty_via_withdrawal_request` (DECIMAL/TEXT) NOT NULL DEFAULT 0
- [ ] T010 Extend existing `deviations` table in `src/lib/db/schema.ts`: add nullable FK column `withdrawal_request_id` → `material_withdrawal_requests.id`
- [ ] T011 Re-export new tables from `src/lib/db/schema.ts` index block for auto-sync detection; verify schema-sync detects 5 new tables + 2 column adds (no DDL-default bug — refer to memory `schema-sync-ddl-default-bug` for guard pattern)
- [ ] T012 Add seed row for default global rule in `src/lib/db/seed-gmp.ts` (or new `seed-material-withdrawal.ts`): INSERT `material_withdrawal_rules (factory_id=NULL, material_category=NULL, soft_cap_percent=10.00, hard_cap_percent=50.00)` — idempotent upsert

### Permissions & Workflow Registration

- [ ] T013 Add new permission rows to seed: `production:withdrawal:request`, `production:withdrawal:approve`, `production:withdrawal:configure` in `src/lib/db/seed-lookup.ts` (or appropriate permission seed)
- [ ] T014 Assign permissions to default roles: Operator → `request`, Supervisor → `request` + `approve`, Admin/Manager → `configure`. Update the role-permission mapping seed
- [ ] T015 Register doc type `material_withdrawal_request` in `src/lib/services/approval-workflow.service.ts` `APPROVE_PERMISSION_BY_DOC_TYPE` map → permission `production:withdrawal:approve` (per research.md R1)

### Shared Types & Validation

- [ ] T016 [P] Create `src/types/material-withdrawal.ts` with TS interfaces: `MaterialWithdrawalRequest`, `MaterialWithdrawalRequestItem`, `MaterialWithdrawalApproval`, `MaterialWithdrawalAttachment`, `MaterialWithdrawalRule`, status enum, reason_type enum
- [ ] T017 [P] Create `src/lib/validation/material-withdrawal.ts` with Zod schemas: `createRequestSchema` (conditional required fields per reason_type), `approveRequestSchema`, `rejectRequestSchema`, `createRuleSchema`, `updateRuleSchema`

**Checkpoint**: Foundation ready — DB tables exist, permissions seeded, doc type registered, types/validation available. User story implementation can begin.

---

## Phase 3: User Story 1 — Operator Submits Withdrawal Request (Priority: P1) 🎯 MVP

**Goal**: Production operators can create withdrawal requests bound to a Work Order, with reason capture, attachments, soft/hard cap enforcement, and the relevant production phase auto-blocks (FR-035..040).

**Independent Test**: Logged in as Operator → open WO → click "ขอเบิกวัตถุดิบเพิ่ม" → fill form → submit → request appears with status `pending` AND the WO phase that uses that material shows a yellow "blocked" banner. Other phases of the same WO advanceable.

### Tests for User Story 1 (write first, observe failures)

- [ ] T018 [P] [US1] Write failing service test in `tests/lib/services/material-withdrawal.service.test.ts`: `createRequest` happy path (valid WO, BOM material, valid quantity) — uses SQLite in-memory + seed (work order, BOM, materials, room)
- [ ] T019 [P] [US1] Write failing service test in `tests/lib/services/material-withdrawal.service.test.ts`: `createRequest` rejects when material not in WO BOM (FR-002)
- [ ] T020 [P] [US1] Write failing service test in `tests/lib/services/material-withdrawal.service.test.ts`: `createRequest` requires `machinePhase` when reasonType=`machine_setup_loss` (FR-005)
- [ ] T021 [P] [US1] Write failing service test in `tests/lib/services/material-withdrawal.service.test.ts`: `createRequest` blocks when cumulative would exceed hard cap (FR-012), warns on soft cap (FR-011), uses hierarchical rule lookup (R9)
- [ ] T022 [P] [US1] Write failing service test in `tests/lib/services/material-withdrawal.service.test.ts`: `createRequest` is idempotent within 30s for same payload (FR-009)
- [ ] T023 [P] [US1] Write failing service test in `tests/lib/services/production-gate.service.test.ts`: `isPhaseBlockedByPendingWithdrawal` returns blocked=true only for phases consuming the affected material (FR-035..036, algorithm per research.md R3)
- [ ] T024 [P] [US1] Write failing API integration test in `tests/api/material-withdrawal/requests.test.ts`: `POST /api/material-withdrawal/requests` returns 201 + persisted request; 403 without permission; 400 on invalid payload
- [ ] T025 [P] [US1] Write failing API integration test in `tests/api/material-withdrawal/requests.test.ts`: `GET /api/material-withdrawal/requests` filters by workOrderId, status, factoryId, dateRange (FR-031)
- [ ] T026 [P] [US1] Write failing API integration test in `tests/api/material-withdrawal/requests.test.ts`: `DELETE /api/material-withdrawal/requests/{id}` cancels pending request (own only), 409 if already approved/rejected
- [ ] T027 [P] [US1] Write failing API integration test in `tests/api/material-withdrawal/blocked-phases.test.ts`: `GET /api/production/work-orders/{id}/blocked-phases` returns only phases using materials with pending requests
- [ ] T028 [P] [US1] Write failing component test in `tests/components/production/material-withdrawal-request-dialog.test.tsx`: renders, validates required fields, submits via mocked fetch (React Testing Library + Vitest)
- [ ] T029 [P] [US1] Write failing component test in `tests/components/production/phase-block-banner.test.tsx`: renders banner when blocked, hides when not, click opens detail

### Service Layer (US1)

- [ ] T030 [US1] Implement `createRequest(input, userId)` in new file `src/lib/services/material-withdrawal.service.ts`: validates BOM membership, conditional fields, cap (soft/hard via `resolveCapRule`), idempotency (30s window via in-memory or DB check on requested_at+payload hash), inserts request + items + attachments through `auditedInsert` from `audit-wrapper.ts` (depends on T004–T008, T015, T017)
- [ ] T031 [US1] Implement `resolveCapRule(factoryId, materialCategory)` in `src/lib/services/material-withdrawal.service.ts` with hierarchical fallback (factory+cat → factory+ANY → ANY+cat → ANY+ANY), returns active rule
- [ ] T032 [US1] Implement `getRequestById(id, userId)` and `listRequests(filters, userId)` in `src/lib/services/material-withdrawal.service.ts` with permission-scoped visibility (Operators see own; Supervisors see their factory's)
- [ ] T033 [US1] Implement `cancelRequest(id, userId)` in `src/lib/services/material-withdrawal.service.ts`: only requester can cancel; only when status=`pending`; sets cancelled_reason + status=`cancelled` via `auditedUpdate`
- [ ] T034 [US1] Implement `isPhaseBlockedByPendingWithdrawal(workOrderId, phaseId)` and `listBlockedPhasesForWorkOrder(workOrderId)` in `src/lib/services/production-gate.service.ts` (extend existing file) using the algorithm in research.md R3 (single JOIN, no N+1)
- [ ] T035 [US1] Wire `canAdvanceToPhase` (or equivalent existing gate function) in `src/lib/services/production-gate.service.ts` to call the new check (FR-035) — preserve existing checks; new check additive

### API Layer (US1)

- [ ] T036 [US1] Implement `src/app/api/material-withdrawal/requests/route.ts`: `POST` (create) + `GET` (list with filters per contracts/requests.yaml) — Zod validate body, permission check, calls service, returns 201/200
- [ ] T037 [US1] Implement `src/app/api/material-withdrawal/requests/[id]/route.ts`: `GET` (detail) + `DELETE` (cancel) per contracts/requests.yaml
- [ ] T038 [US1] Implement `src/app/api/material-withdrawal/attachments/route.ts`: `POST` upload (multipart), max 5 MB, mime allowlist (image/jpeg, image/png, application/pdf), stores via existing attachment storage, returns attachment ID
- [ ] T039 [US1] Implement `src/app/api/production/work-orders/[id]/blocked-phases/route.ts`: `GET` returns blocked phases per contracts/approvals.yaml (calls `listBlockedPhasesForWorkOrder`)

### UI Layer (US1)

- [ ] T040 [P] [US1] Create `src/components/production/material-withdrawal-request-dialog.tsx`: DevExtreme `Popup` + `Form` (Material `SelectBox` filtered to WO BOM, Quantity `NumberBox`, Reason `SelectBox` with conditional `TextArea`/Phase field, Room `SelectBox`, `FileUploader`); calls API via TanStack Query; Thai labels via `useTranslations('material-withdrawal')`
- [ ] T041 [P] [US1] Create `src/components/production/phase-block-banner.tsx`: yellow alert-style banner with phase name, affected materials, link to open pending request detail; rendered inside WO phase view when blocked-phases API returns non-empty
- [ ] T042 [US1] Create `src/components/production/material-withdrawal-detail-dialog.tsx`: read-only DevExtreme Popup showing all request fields + items + attachments + approval status; reused by operator and supervisor
- [ ] T043 [US1] Extend Work Order detail page in `src/app/production/work-orders/[id]/page.tsx`: add "ขอเบิกวัตถุดิบเพิ่ม" button (only when user has `production:withdrawal:request`), render `<PhaseBlockBanner />` on each phase card, use the API from T039
- [ ] T044 [US1] Create `src/app/material-withdrawal/page.tsx` (list view): DevExtreme `DataGrid` with filters (status, WO, date range, reason, factory) per contracts/requests.yaml `GET /requests`, server-side paging via TanStack Query
- [ ] T045 [US1] Create `src/app/material-withdrawal/layout.tsx`: MainLayout wrapper with sidebar (i18n title, permission-gated nav)

**Checkpoint**: US1 fully functional — operator can submit, see pending list, phase auto-blocks. Run `bunx tsc --noEmit --skipLibCheck`, `bun run lint`, `bun run test:run -- material-withdrawal` — all green. Commit per Constitution I (Frequent Commits).

---

## Phase 4: User Story 2 — Supervisor Approves/Rejects (Priority: P1) 🎯 MVP

**Goal**: Production Supervisors see pending queue scoped to their WOs, review detail + WO history, approve or reject with E-signature; on approve the system atomically deducts stock, updates consumption, creates a deviation, unblocks affected phases, notifies operator.

**Independent Test**: As Supervisor — open pending queue → see request from US1 → click approve → enter password → request status=`approved`, inventory_transactions row created, deviation row created, phase banner disappears, operator sees notification.

### Tests for User Story 2

- [ ] T046 [P] [US2] Write failing service test in `tests/lib/services/material-withdrawal.service.test.ts`: `approveRequest` happy path — verifies single-transaction atomicity (FR-021..023, SC-003): status changes, inventory_transactions row, deviation row, material_consumption updated, signature row captured
- [ ] T047 [P] [US2] Write failing service test: `approveRequest` blocks when stock insufficient at approve-time (FR-020)
- [ ] T048 [P] [US2] Write failing service test: `approveRequest` rejects when approver is the requester (Dual Control FR-015, SC-004)
- [ ] T049 [P] [US2] Write failing service test: `approveRequest` rejects on invalid password (E-sig FR-017)
- [ ] T050 [P] [US2] Write failing service test: `approveRequest` rejects when status is not `pending`
- [ ] T051 [P] [US2] Write failing service test: `rejectRequest` creates record-only deviation (FR-026), does NOT deduct stock (FR-025), unblocks phases
- [ ] T052 [P] [US2] Write failing service test: approving with reduced quantity (`quantityApproved < quantityRequested`) reflects in inventory + cap counters
- [ ] T053 [P] [US2] Write failing API integration test in `tests/api/material-withdrawal/approve.test.ts`: `POST /requests/{id}/approve` happy path, 400 invalid password, 400 dual control, 400 insufficient stock, 403 no permission
- [ ] T054 [P] [US2] Write failing API integration test in `tests/api/material-withdrawal/reject.test.ts`: `POST /requests/{id}/reject` happy path, 400 short reason (<10 chars), 400 invalid password
- [ ] T055 [P] [US2] Write failing API integration test in `tests/api/material-withdrawal/pending.test.ts`: `GET /pending` returns queue scoped to supervisor's factory, sorted oldest-first
- [ ] T056 [P] [US2] Write failing component test in `tests/components/production/material-withdrawal-approval-card.test.tsx`: renders detail, approve/reject buttons, e-sig prompt flow
- [ ] T057 [P] [US2] Write failing component test in `tests/components/production/e-signature-prompt-dialog.test.tsx` (if shared component doesn't already exist from Line Clearance — verify per R4)

### Service Layer (US2)

- [ ] T058 [US2] Implement `approveRequest(id, input, approverUserId)` in `src/lib/services/material-withdrawal.service.ts` wrapped in `db.transaction(async tx => ...)` per research.md R10:
  1. Load request, verify status=`pending`
  2. Verify approver ≠ requester (FR-015 Dual Control)
  3. Verify password via existing E-sig service (R4) → capture signature_id
  4. Re-resolve cap, verify cumulative ≤ hard cap (defensive)
  5. Check stock availability for each material (FOR UPDATE on MySQL, locked rows)
  6. Update request status=`approved`, set quantityApproved per item, recompute cumulative_extra_after_approve
  7. Insert into `material_withdrawal_approvals` with signature_id
  8. Insert inventory transaction rows (decrement stock) via existing inventory service
  9. Update `material_consumption.additional_qty_via_withdrawal_request`
  10. Insert deviation row (type "Material Withdrawal — Setup Loss") with `withdrawal_request_id`
  11. Return: request + inventoryTransactionIds + deviationId + unblockedPhaseIds (recompute via T034)
- [ ] T059 [US2] Implement `rejectRequest(id, reason, approverUserId, password)` in `src/lib/services/material-withdrawal.service.ts` in transaction:
  1. Verify status=`pending`, Dual Control, e-sig
  2. Update status=`rejected`, insert approval row with action=`reject`
  3. Insert record-only deviation (flag `rejected — no inventory impact`)
  4. Compute unblockedPhaseIds (now empty for this request)
- [ ] T060 [US2] Implement `listPendingRequestsForSupervisor(userId, factoryId?)` in `src/lib/services/material-withdrawal.service.ts`: returns pending requests filtered by supervisor's assigned factories
- [ ] T061 [US2] Implement notification side-effect (post-commit) in service: enqueue in-app notification to requester on approve/reject; LINE notify if factory config enables it (per research.md R11 — if notification subsystem missing, in-app only and document a follow-up TODO)

### API Layer (US2)

- [ ] T062 [US2] Implement `src/app/api/material-withdrawal/requests/[id]/approve/route.ts`: `POST` per contracts/approvals.yaml; Zod validate, permission check `production:withdrawal:approve`, calls service, maps service errors to 400/403/404 with code
- [ ] T063 [US2] Implement `src/app/api/material-withdrawal/requests/[id]/reject/route.ts`: `POST` per contracts/approvals.yaml
- [ ] T064 [US2] Implement `src/app/api/material-withdrawal/pending/route.ts`: `GET` per contracts/requests.yaml `/pending`

### UI Layer (US2)

- [ ] T065 [P] [US2] Create `src/components/production/material-withdrawal-approval-card.tsx`: DevExtreme card showing request summary + items + history toggle; Approve / Reject buttons trigger e-sig prompt
- [ ] T066 [P] [US2] Reuse or create `src/components/shared/e-signature-prompt-dialog.tsx` (verify existing from Line Clearance per R4; if missing, create generic component that takes `onConfirm(password)` callback)
- [ ] T067 [US2] Create `src/app/material-withdrawal/pending/page.tsx`: supervisor queue using DevExtreme `DataGrid` with custom row template using `<MaterialWithdrawalApprovalCard />`; refetch every 30s; shows count badge
- [ ] T068 [US2] Wire notification toast on operator side: when a previously-pending request transitions to approved/rejected, surface via TanStack Query refetch + DevExtreme Toast (i18n message)

**Checkpoint**: US2 fully functional — supervisor approves/rejects with full atomicity, phase unblocks, operator notified. **MVP complete.** Run gates: `bunx tsc --noEmit --skipLibCheck`, `bun run lint`, `bun run test:run`. Commit + push for PR review.

---

## Phase 5: User Story 3 — Tracking & Reporting (Priority: P2)

**Goal**: Managers and QC can list all requests with rich filters, view monthly/quarterly summaries with breakdowns by machine/material/reason, and export Excel/PDF.

**Independent Test**: As Manager — open Reports → select date range + factory → see summary card + chart + grouped breakdown → click Export Excel → file downloads with same data.

### Tests for User Story 3

- [ ] T069 [P] [US3] Write failing service test in `tests/lib/services/withdrawal-reporting.service.test.ts`: `getMonthlySummary` aggregates correctly across multiple requests (counts, sums, top reasons)
- [ ] T070 [P] [US3] Write failing service test: `getTrend(interval=month)` returns one row per period covering range, gaps as zero
- [ ] T071 [P] [US3] Write failing API integration test in `tests/api/material-withdrawal/reports.test.ts`: `GET /reports?format=json` shape matches contract, `format=excel` returns binary with correct content-type, `format=pdf` likewise
- [ ] T072 [P] [US3] Write failing component test in `tests/components/production/withdrawal-report-page.test.tsx`: renders summary + chart + grid; export button triggers download

### Service Layer (US3)

- [ ] T073 [US3] Create `src/lib/services/withdrawal-reporting.service.ts`: `getMonthlySummary(filters)`, `getTrend(filters)`, `getBreakdown(groupBy)` — pure SQL aggregations via Drizzle, use date-utils for cross-DB date handling
- [ ] T074 [P] [US3] Add Excel export helper in `src/lib/utils/export-excel.ts` (if not present) — uses an existing library if one is installed for other features; produces a workbook with summary sheet + groups sheet
- [ ] T075 [P] [US3] Add PDF export helper in `src/lib/utils/export-pdf.ts` (reuse existing PDF generator pattern from other reports if present)

### API Layer (US3)

- [ ] T076 [US3] Implement `src/app/api/material-withdrawal/reports/route.ts`: `GET` per contracts/reports.yaml — dispatches to JSON/Excel/PDF based on `format` query
- [ ] T077 [US3] Implement `src/app/api/material-withdrawal/reports/trend/route.ts`: `GET` per contracts/reports.yaml

### UI Layer (US3)

- [ ] T078 [P] [US3] Create `src/app/material-withdrawal/reports/page.tsx`: filter bar (factory, date range, groupBy), summary KPI cards, DevExtreme `Chart` (BarChart of monthly extra qty + PieChart of reason breakdown), DataGrid for groups, Export buttons (Excel/PDF) wired to API
- [ ] T079 [US3] Dashboard KPI tiles in `src/app/material-withdrawal/page.tsx` header: pending count, approval rate, top wastage materials (FR-034)

**Checkpoint**: US3 functional — reports render, exports work within 10s for 1 month / 1 factory (SC-010).

---

## Phase 6: User Story 4 — QC & Deviation Integration (Priority: P3)

**Goal**: QC users see auto-created deviations linked back to source request; can drill into context without leaving deviation tracker.

**Independent Test**: Approve a request → open Deviation Tracker as QC → see new deviation type "Material Withdrawal — Setup Loss" → click → drawer opens with original request detail.

### Tests for User Story 4

- [ ] T080 [P] [US4] Write failing service test in `tests/lib/services/material-withdrawal.service.test.ts`: deviation row created via approve includes `withdrawal_request_id` FK + correct deviation_type
- [ ] T081 [P] [US4] Write failing component test in `tests/components/quality/deviation-detail-with-withdrawal.test.tsx`: when deviation has withdrawal_request_id, drill-down link visible and opens request detail

### Implementation (US4)

- [ ] T082 [P] [US4] Extend the existing deviation list view (locate via `src/app/quality/` or similar) to filter by `deviation_type='material_withdrawal_setup_loss'` and show withdrawal_request_id column with link
- [ ] T083 [US4] Extend deviation detail page to render `<MaterialWithdrawalDetailDialog />` (from T042) when `withdrawal_request_id` is set — click opens drawer
- [ ] T084 [US4] Add QC notification: when a withdrawal-related deviation is created, post in-app notification to users in QC role of that factory (uses notification subsystem from T061)

**Checkpoint**: US4 functional — QC sees and drills into deviations originating from withdrawal requests.

---

## Phase 7: Admin Rules Management (Cross-cutting — supports US1)

**Purpose**: Allow Factory Manager / Admin to configure soft/hard caps without code changes. Not strictly required for MVP but unlocks operational flexibility called out by FR-013.

- [ ] T085 [P] Write failing service test in `tests/lib/services/material-withdrawal.service.test.ts`: rule create / update / lookup hierarchy
- [ ] T086 [P] Write failing API integration test in `tests/api/material-withdrawal/rules.test.ts`: rules CRUD per contracts/rules.yaml
- [ ] T087 Implement `createRule`, `updateRule`, `listRules`, `lookupRule` in `src/lib/services/material-withdrawal.service.ts` (reuse `resolveCapRule` from T031)
- [ ] T088 Implement `src/app/api/material-withdrawal/rules/route.ts` (GET, POST) and `src/app/api/material-withdrawal/rules/[id]/route.ts` (PUT) and `src/app/api/material-withdrawal/rules/lookup/route.ts` (GET)
- [ ] T089 Create `src/app/material-withdrawal/rules/page.tsx`: DevExtreme `DataGrid` with inline edit; permission-gated to `production:withdrawal:configure`

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T090 [P] Add edge case integration test in `tests/integration/material-withdrawal-wo-cancelled.test.ts`: WO is closed while requests pending → all pending requests auto-cancel with reason "WO closed/cancelled" (spec Edge Cases)
- [ ] T091 [P] Add edge case integration test in `tests/integration/material-withdrawal-escalation.test.ts`: request pending > 1 day triggers escalation notification to Factory Manager (spec Edge Cases)
- [ ] T092 [P] Add edge case integration test in `tests/integration/material-withdrawal-concurrent.test.ts`: two concurrent approve calls on the same request — only one succeeds (SC-009)
- [ ] T093 [P] Performance test: report export 1 month + 1 factory completes ≤ 10s (SC-010) — uses seed of 1000 requests
- [ ] T094 [P] Run `bun run i18n:check` and resolve any missing keys
- [ ] T095 [P] Update `docs/i18n-developer-guide.md` only if new patterns introduced (skip if not)
- [ ] T096 Verify Constitution gates: `bunx tsc --noEmit --skipLibCheck`, `bun run lint`, `bun run test:run`, `bun run build`
- [ ] T097 Walk through `specs/018-material-withdrawal-approval/quickstart.md` end-to-end on local stack and confirm every step passes
- [ ] T098 Update `CLAUDE.md` "Recent Changes" with one-line summary of 018 feature
- [ ] T099 Open PR against `main` with description linking spec.md + plan.md and a copy of the Independent Test criteria for each story

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No deps — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all stories
- **Phase 3 (US1)**: Depends on Phase 2 complete
- **Phase 4 (US2)**: Depends on Phase 2 complete; integrates with US1 entities but **logically independent** (could be developed in parallel by separate dev — US2 service tests can use seeded pending requests directly)
- **Phase 5 (US3)**: Depends on Phase 2 complete; reads US1+US2 data
- **Phase 6 (US4)**: Depends on Phase 4 (US2) — needs the deviation auto-creation path
- **Phase 7 (Rules)**: Can run in parallel with US1 once Phase 2 done; rules table needed by US1 cap enforcement but default seed (T012) covers MVP
- **Phase 8 (Polish)**: Depends on US1 + US2 complete (MVP) — US3 / US4 polish runs after their respective phases

### Within Each User Story

- Tests (TDD) MUST be written and observed FAILING before implementation (Constitution II)
- Schema → service → API → UI strictly in order within story; Service tests use SQLite in-memory
- Models within story marked [P] can run in parallel (different schema blocks); but T004 ordered before T005–T008 since they FK to it

### Parallel Opportunities

- **Phase 2 schema tasks**: T005–T008 are [P] (different table blocks within `schema.ts`), but coordinate to avoid merge conflicts
- **Phase 3 tests**: T018–T029 are all [P] (different test files)
- **Phase 3 UI components**: T040–T042 are [P] (different component files)
- **Phase 4 tests**: T046–T057 are [P]
- **US1 and US2 development**: Can proceed in parallel after Foundational done
- **Phase 8 polish**: T090–T095 are [P]

---

## Parallel Example: User Story 1 Tests

```text
# Launch all US1 test tasks in parallel (all different files):
Task T018: material-withdrawal.service.test.ts — createRequest happy path
Task T019: material-withdrawal.service.test.ts — BOM membership rejection
Task T020: material-withdrawal.service.test.ts — machine phase conditional
Task T021: material-withdrawal.service.test.ts — cap enforcement
Task T022: material-withdrawal.service.test.ts — idempotency window
Task T023: production-gate.service.test.ts — selective phase block
Task T024–T026: api/material-withdrawal/requests.test.ts
Task T027: api/material-withdrawal/blocked-phases.test.ts
Task T028: components/production/material-withdrawal-request-dialog.test.tsx
Task T029: components/production/phase-block-banner.test.tsx
```

(T018–T022 share the same test file — interleave as separate `describe()` blocks; not literally parallel in editor but conceptually independent.)

---

## Implementation Strategy

### MVP First (US1 + US2)

Both P1 stories together = MVP. Why both: a withdrawal request without an approval flow is not useful (operator just files paperwork with no resolution).

1. Phase 1 Setup (T001–T003)
2. Phase 2 Foundational (T004–T017) — schema, permissions, types
3. Phase 3 US1 (T018–T045) — operator side
4. Phase 4 US2 (T046–T068) — supervisor side
5. **STOP and VALIDATE**: Walk quickstart.md sections 4–5 with real users; commit; open PR

### Incremental Delivery

- After MVP merge → ship US3 (reporting) for value-add
- Then US4 (QC integration) for completeness
- Phase 7 (admin rules UI) anytime after Phase 2 — only needed when operations team wants non-default caps

### Parallel Team Strategy

With 2 developers post-Foundational:

- Dev A: Phase 3 (US1)
- Dev B: Phase 4 (US2)
- Integration meeting at the Phase 3/4 boundary (US2 needs US1's pending data to exist — seed for tests, real for integration)
- Both converge on Phase 8 polish

---

## Notes

- [P] = different files, no incomplete deps
- [Story] label maps task to user story for traceability and partial-merge safety
- Tests MUST fail first (Red phase) — commit failing test before writing impl (Constitution II.1)
- Commit after each task or logical group (Constitution I.5)
- Every commit must pass `bunx tsc --noEmit --skipLibCheck` and `bun run lint` (Constitution I.7)
- Avoid touching the same line in `schema.ts` from two [P] tasks at the same time — schedule sequentially or coordinate via merge
- Service layer error codes (`INSUFFICIENT_STOCK`, `DUAL_CONTROL_VIOLATION`, `INVALID_PASSWORD`, `REQUEST_NOT_PENDING`, `EXCEEDS_HARD_CAP`, `DUPLICATE_SUBMISSION`) must be stable strings used both in tests and in API contract — define them once in `src/lib/services/material-withdrawal.errors.ts` early in T030

# Tasks: GMP Compliance Gap Analysis

**Input**: Design documents from `/specs/009-gmp-compliance-gap-analysis/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create feature branch `009-gmp-compliance-gap-analysis` and verify clean state
- [x] T002 [P] Create shared type definitions in `src/types/documents.ts`
- [x] T003 [P] Create shared type definitions in `src/types/capa.ts`
- [x] T004 [P] Create shared type definitions in `src/types/complaints.ts`
- [x] T005 [P] Create shared type definitions in `src/types/recalls.ts`
- [x] T006 [P] Create shared type definitions in `src/types/sanitation.ts`
- [x] T007 [P] Create shared type definitions in `src/types/stability.ts`
- [x] T008 [P] Create shared type definitions in `src/types/audits.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema and core infrastructure that MUST be complete before ANY user story

**CRITICAL**: No user story work can begin until this phase is complete

### Database Schema (SQLite + MySQL dual-schema)

- [ ] T009 Create `documents` table in `src/lib/db/schema.ts` and `src/lib/db/schema-mysql.ts`
- [ ] T010 Create `document_versions` table with FK to documents
- [ ] T011 Create `document_approvals` table with FK to document_versions
- [ ] T012 Create `document_types` table (master data)
- [ ] T013 Create `capa` table in schema (FK to existing deviations)
- [ ] T014 Create `capa_actions` table with FK to capa
- [ ] T015 Create `capa_effectiveness` table with FK to capa
- [ ] T016 Create `complaints` table (FK to items, inventory_lots)
- [ ] T017 Create `complaint_investigations` table with FK to complaints
- [ ] T018 Create `recalls` table (FK to items)
- [ ] T019 Create `recall_notifications` table with FK to recalls
- [ ] T020 Create `recall_reconciliation` table with FK to recalls
- [ ] T021 Create `sanitation_schedules` table
- [ ] T022 Create `sanitation_logs` table with FK to sanitation_schedules
- [ ] T023 Create `pest_control_logs` table
- [ ] T024 Create `stability_protocols` table (FK to items)
- [ ] T025 Create `stability_studies` table with FK to protocols, inventory_lots
- [ ] T026 Create `stability_samples` table with FK to studies, quality_tests
- [ ] T027 Create `stability_trends` table with FK to studies
- [ ] T028 Create `audit_plans` table
- [ ] T029 Create `audits` table with FK to audit_plans
- [ ] T030 Create `audit_findings` table with FK to audits, capa
- [ ] T031 Create `manufacturing_contracts` table
- [ ] T032 Create `contract_batches` table with FK to contracts, inventory_lots
- [ ] T033 Create `change_requests` table
- [ ] T034 Create `change_approvals` table with FK to change_requests
- [ ] T035 Create `pqr_reports` table (FK to items)
- [ ] T036 Create `pqr_metrics` table with FK to pqr_reports
- [ ] T037 Generate and run Drizzle migrations

### Shared Components

- [ ] T038 [P] Create `WorkflowStatusBadge.tsx` in `src/components/shared/` for document/CAPA/complaint status
- [ ] T039 [P] Create `ApprovalChain.tsx` in `src/components/shared/` for approval workflow UI
- [ ] T040 [P] Create `AuditTrailViewer.tsx` in `src/components/shared/` for audit log display
- [ ] T041 [P] Create `TrendChart.tsx` in `src/components/shared/` using DevExtreme dxChart

### Seed Data

- [ ] T042 Seed `document_types` with SOP, POL, FORM, WI, SPEC records
- [ ] T043 Add navigation menu entries for new modules in layout

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 2 - Document Control Officer Manages SOPs (Priority: P1)

**Goal**: Implement document control system with version management, approval workflow, and audit trail

**Independent Test**: Create document, submit for approval, approve, verify version history accessible

### Tests for User Story 2

- [ ] T044 [P] [US2] Unit test for document-service in `tests/unit/services/document-service.test.ts`
- [ ] T045 [P] [US2] Integration test for documents API in `tests/integration/api/documents.test.ts`

### Implementation for User Story 2

- [ ] T046 [US2] Create document-service in `src/lib/services/document-service.ts`
  - generateDocumentNumber(), createDocument(), createVersion(), getVersionHistory()
- [ ] T047 [US2] Implement GET/POST `/api/documents` route in `src/app/api/documents/route.ts`
- [ ] T048 [US2] Implement GET/PATCH `/api/documents/[id]` route in `src/app/api/documents/[id]/route.ts`
- [ ] T049 [US2] Implement GET/POST `/api/documents/[id]/versions` in `src/app/api/documents/[id]/versions/route.ts`
- [ ] T050 [US2] Implement POST `/api/documents/[id]/approve` in `src/app/api/documents/[id]/approve/route.ts`
- [ ] T051 [US2] Implement GET `/api/documents/approvals` (pending approvals list)
- [ ] T052 [US2] Implement POST `/api/documents/approvals/[id]` (approve/reject)
- [ ] T053 [US2] Implement GET `/api/documents/types` route
- [ ] T054 [P] [US2] Create DocumentList.tsx in `src/components/documents/` with DevExtreme DataGrid
- [ ] T055 [P] [US2] Create DocumentForm.tsx in `src/components/documents/` with DevExtreme Form
- [ ] T056 [P] [US2] Create DocumentVersionHistory.tsx in `src/components/documents/`
- [ ] T057 [P] [US2] Create DocumentApprovalDialog.tsx in `src/components/documents/`
- [ ] T058 [US2] Create documents list page in `src/app/documents/page.tsx`
- [ ] T059 [US2] Create new document page in `src/app/documents/new/page.tsx`
- [ ] T060 [US2] Create document detail page in `src/app/documents/[id]/page.tsx`

**Checkpoint**: Document control module fully functional

---

## Phase 4: User Story 3 - Quality Manager Handles CAPA Workflow (Priority: P1)

**Goal**: Implement CAPA management with action tracking, effectiveness verification, and source linking

**Independent Test**: Create CAPA from deviation, assign actions, complete actions, verify effectiveness, close CAPA

### Tests for User Story 3

- [ ] T061 [P] [US3] Unit test for capa-service in `tests/unit/services/capa-service.test.ts`
- [ ] T062 [P] [US3] Integration test for CAPA API in `tests/integration/api/capa.test.ts`
- [ ] T063 [P] [US3] Workflow test for deviation-to-capa in `tests/integration/workflows/deviation-to-capa.test.ts`

### Implementation for User Story 3

- [ ] T064 [US3] Create capa-service in `src/lib/services/capa-service.ts`
  - generateCapaNumber(), createFromDeviation(), addAction(), recordEffectiveness(), closeCapa()
- [ ] T065 [US3] Implement GET/POST `/api/capa` route in `src/app/api/capa/route.ts`
- [ ] T066 [US3] Implement GET/PATCH `/api/capa/[id]` route in `src/app/api/capa/[id]/route.ts`
- [ ] T067 [US3] Implement GET/POST `/api/capa/[id]/actions` in `src/app/api/capa/[id]/actions/route.ts`
- [ ] T068 [US3] Implement PATCH `/api/capa/[id]/actions/[actionId]` for action updates
- [ ] T069 [US3] Implement GET/POST `/api/capa/[id]/effectiveness` route
- [ ] T070 [US3] Implement POST `/api/capa/[id]/close` route with validation
- [ ] T071 [US3] Implement GET `/api/capa/dashboard` for metrics
- [ ] T072 [P] [US3] Create CapaList.tsx in `src/components/capa/` with DevExtreme DataGrid
- [ ] T073 [P] [US3] Create CapaForm.tsx in `src/components/capa/` with root cause fields
- [ ] T074 [P] [US3] Create CapaActionList.tsx in `src/components/capa/` for action management
- [ ] T075 [P] [US3] Create CapaEffectivenessForm.tsx in `src/components/capa/`
- [ ] T076 [P] [US3] Create CapaDashboard.tsx in `src/components/capa/` with DevExtreme dxChart
- [ ] T077 [US3] Create CAPA list page in `src/app/capa/page.tsx`
- [ ] T078 [US3] Create new CAPA page in `src/app/capa/new/page.tsx`
- [ ] T079 [US3] Create CAPA detail page in `src/app/capa/[id]/page.tsx`
- [ ] T080 [US3] Add "Create CAPA" button to existing deviation detail page

**Checkpoint**: CAPA management module fully functional

---

## Phase 5: User Story 7 - Customer Service Handles Complaints (Priority: P2)

**Goal**: Implement complaint recording, QC routing, investigation workflow, and trend analysis

**Independent Test**: Record complaint, route to QC, conduct investigation, close with findings

### Tests for User Story 7

- [ ] T081 [P] [US7] Unit test for complaint-service in `tests/unit/services/complaint-service.test.ts`
- [ ] T082 [P] [US7] Integration test for complaints API in `tests/integration/api/complaints.test.ts`

### Implementation for User Story 7

- [ ] T083 [US7] Create complaint-service in `src/lib/services/complaint-service.ts`
  - generateComplaintNumber(), createComplaint(), routeToQC(), recordInvestigation(), closeComplaint()
- [ ] T084 [US7] Implement GET/POST `/api/complaints` route in `src/app/api/complaints/route.ts`
- [ ] T085 [US7] Implement GET/PATCH `/api/complaints/[id]` route in `src/app/api/complaints/[id]/route.ts`
- [ ] T086 [US7] Implement POST `/api/complaints/[id]/investigation` route
- [ ] T087 [US7] Implement POST `/api/complaints/[id]/close` route
- [ ] T088 [US7] Implement GET `/api/complaints/trends` route with aggregation
- [ ] T089 [P] [US7] Create ComplaintList.tsx in `src/components/complaints/` with DevExtreme DataGrid
- [ ] T090 [P] [US7] Create ComplaintForm.tsx in `src/components/complaints/`
- [ ] T091 [P] [US7] Create ComplaintInvestigationForm.tsx in `src/components/complaints/`
- [ ] T092 [P] [US7] Create ComplaintTrendsChart.tsx in `src/components/complaints/`
- [ ] T093 [US7] Create complaints list page in `src/app/complaints/page.tsx`
- [ ] T094 [US7] Create complaint detail page in `src/app/complaints/[id]/page.tsx`

**Checkpoint**: Complaint handling module fully functional

---

## Phase 6: User Story 8 - Recall Coordinator Executes Product Recall (Priority: P2)

**Goal**: Implement recall initiation, distribution tracking, customer notification, and reconciliation

**Independent Test**: Initiate mock recall, identify customers, record notifications, reconcile quantities

### Tests for User Story 8

- [ ] T095 [P] [US8] Unit test for recall-service in `tests/unit/services/recall-service.test.ts`
- [ ] T096 [P] [US8] Integration test for recalls API in `tests/integration/api/recalls.test.ts`
- [ ] T097 [P] [US8] Workflow test for complaint-to-recall in `tests/integration/workflows/complaint-to-recall.test.ts`

### Implementation for User Story 8

- [ ] T098 [US8] Create recall-service in `src/lib/services/recall-service.ts`
  - generateRecallNumber(), initiateRecall(), getDistributionData(), recordNotification(), reconcile()
- [ ] T099 [US8] Implement GET/POST `/api/recalls` route in `src/app/api/recalls/route.ts`
- [ ] T100 [US8] Implement GET/PATCH `/api/recalls/[id]` route in `src/app/api/recalls/[id]/route.ts`
- [ ] T101 [US8] Implement GET `/api/recalls/[id]/distribution` route (aggregates inventory_transactions)
- [ ] T102 [US8] Implement GET/POST `/api/recalls/[id]/notifications` route
- [ ] T103 [US8] Implement PATCH `/api/recalls/[id]/notifications/[notificationId]` route
- [ ] T104 [US8] Implement GET/POST `/api/recalls/[id]/reconciliation` route
- [ ] T105 [US8] Implement POST `/api/recalls/[id]/close` route
- [ ] T106 [US8] Implement POST `/api/recalls/mock-drill` route for recall simulation
- [ ] T107 [P] [US8] Create RecallList.tsx in `src/components/recalls/` with DevExtreme DataGrid
- [ ] T108 [P] [US8] Create RecallForm.tsx in `src/components/recalls/`
- [ ] T109 [P] [US8] Create RecallDistributionTable.tsx in `src/components/recalls/`
- [ ] T110 [P] [US8] Create RecallNotificationTracker.tsx in `src/components/recalls/`
- [ ] T111 [P] [US8] Create RecallReconciliationForm.tsx in `src/components/recalls/`
- [ ] T112 [US8] Create recalls list page in `src/app/recalls/page.tsx`
- [ ] T113 [US8] Create recall detail page in `src/app/recalls/[id]/page.tsx`

**Checkpoint**: Recall management module fully functional

---

## Phase 7: User Story 6 - Quality Manager Runs Stability Program (Priority: P2)

**Goal**: Implement stability protocols, study enrollment, sample scheduling, and trend analysis

**Independent Test**: Create protocol, enroll batch, schedule tests, record results, view trends

### Tests for User Story 6

- [ ] T114 [P] [US6] Unit test for stability-service in `tests/unit/services/stability-service.test.ts`
- [ ] T115 [P] [US6] Integration test for stability API in `tests/integration/api/stability.test.ts`

### Implementation for User Story 6

- [ ] T116 [US6] Create stability-service in `src/lib/services/stability-service.ts`
  - createProtocol(), enrollBatch(), generateSampleSchedule(), recordTestResult(), calculateTrends()
- [ ] T117 [US6] Implement GET/POST `/api/stability/protocols` route
- [ ] T118 [US6] Implement GET/PATCH `/api/stability/protocols/[id]` route
- [ ] T119 [US6] Implement POST `/api/stability/protocols/[id]/approve` route
- [ ] T120 [US6] Implement GET/POST `/api/stability/studies` route
- [ ] T121 [US6] Implement GET/PATCH `/api/stability/studies/[id]` route
- [ ] T122 [US6] Implement GET `/api/stability/samples` route with filters
- [ ] T123 [US6] Implement GET/PATCH `/api/stability/samples/[id]` route
- [ ] T124 [US6] Implement POST `/api/stability/samples/[id]/test` route (link to quality_tests)
- [ ] T125 [US6] Implement GET `/api/stability/samples/alerts` route (due/overdue samples)
- [ ] T126 [US6] Implement GET `/api/stability/trends` route
- [ ] T127 [US6] Implement GET `/api/stability/trends/[studyId]` route with projections
- [ ] T128 [P] [US6] Create StabilityProtocolList.tsx in `src/components/stability/`
- [ ] T129 [P] [US6] Create StabilityStudyList.tsx in `src/components/stability/`
- [ ] T130 [P] [US6] Create StabilitySampleSchedule.tsx in `src/components/stability/`
- [ ] T131 [P] [US6] Create StabilityTrendChart.tsx in `src/components/stability/` with DevExtreme dxChart
- [ ] T132 [US6] Create stability dashboard page in `src/app/stability/page.tsx`
- [ ] T133 [US6] Create studies list page in `src/app/stability/studies/page.tsx`
- [ ] T134 [US6] Create trends page in `src/app/stability/trends/page.tsx`

**Checkpoint**: Stability program module fully functional

---

## Phase 8: User Story 9 - Facilities Manager Manages Sanitation (Priority: P3)

**Goal**: Implement sanitation schedules, cleaning logs, pest control tracking, and trend analysis

**Independent Test**: Create schedule, log completion, record pest control, view trends

### Tests for User Story 9

- [ ] T135 [P] [US9] Unit test for sanitation-service in `tests/unit/services/sanitation-service.test.ts`
- [ ] T136 [P] [US9] Integration test for sanitation API in `tests/integration/api/sanitation.test.ts`

### Implementation for User Story 9

- [ ] T137 [US9] Create sanitation-service in `src/lib/services/sanitation-service.ts`
  - createSchedule(), logCompletion(), logPestControl(), getPendingTasks(), getTrends()
- [ ] T138 [US9] Implement GET/POST `/api/sanitation/schedules` route
- [ ] T139 [US9] Implement GET/PATCH/DELETE `/api/sanitation/schedules/[id]` route
- [ ] T140 [US9] Implement GET/POST `/api/sanitation/logs` route
- [ ] T141 [US9] Implement GET/PATCH `/api/sanitation/logs/[id]` route
- [ ] T142 [US9] Implement GET `/api/sanitation/logs/pending` route
- [ ] T143 [US9] Implement GET/POST `/api/sanitation/pest-control` route
- [ ] T144 [US9] Implement GET/PATCH `/api/sanitation/pest-control/[id]` route
- [ ] T145 [US9] Implement GET `/api/sanitation/trends` route
- [ ] T146 [P] [US9] Create SanitationScheduleList.tsx in `src/components/sanitation/`
- [ ] T147 [P] [US9] Create SanitationLogForm.tsx in `src/components/sanitation/`
- [ ] T148 [P] [US9] Create PestControlLogForm.tsx in `src/components/sanitation/`
- [ ] T149 [P] [US9] Create SanitationTrends.tsx in `src/components/sanitation/`
- [ ] T150 [US9] Create sanitation dashboard page in `src/app/sanitation/page.tsx`
- [ ] T151 [US9] Create schedules page in `src/app/sanitation/schedules/page.tsx`
- [ ] T152 [US9] Create logs page in `src/app/sanitation/logs/page.tsx`
- [ ] T153 [US9] Create pest control page in `src/app/sanitation/pest-control/page.tsx`

**Checkpoint**: Sanitation program module fully functional

---

## Phase 9: User Story 10 - Internal Auditor Conducts Self-Inspection (Priority: P3)

**Goal**: Implement audit planning, execution, findings recording, and CAPA linkage

**Independent Test**: Create audit plan, schedule audit, record findings, create CAPA from finding, close

### Tests for User Story 10

- [ ] T154 [P] [US10] Unit test for audit-service in `tests/unit/services/audit-service.test.ts`
- [ ] T155 [P] [US10] Integration test for audits API in `tests/integration/api/audits.test.ts`
- [ ] T156 [P] [US10] Workflow test for audit-to-capa in `tests/integration/workflows/audit-to-capa.test.ts`

### Implementation for User Story 10

- [ ] T157 [US10] Create audit-service in `src/lib/services/audit-service.ts`
  - createPlan(), scheduleAudit(), recordFinding(), createCapaFromFinding(), closeFinding()
- [ ] T158 [US10] Implement GET/POST `/api/audits/plans` route
- [ ] T159 [US10] Implement GET/PATCH `/api/audits/plans/[id]` route
- [ ] T160 [US10] Implement POST `/api/audits/plans/[id]/approve` route
- [ ] T161 [US10] Implement GET/POST `/api/audits` route
- [ ] T162 [US10] Implement GET/PATCH `/api/audits/[id]` route
- [ ] T163 [US10] Implement POST `/api/audits/[id]/start` route
- [ ] T164 [US10] Implement POST `/api/audits/[id]/complete` route
- [ ] T165 [US10] Implement GET/POST `/api/audits/findings` route
- [ ] T166 [US10] Implement GET/PATCH `/api/audits/findings/[id]` route
- [ ] T167 [US10] Implement POST `/api/audits/findings/[id]/capa` route
- [ ] T168 [US10] Implement POST `/api/audits/findings/[id]/close` route
- [ ] T169 [US10] Implement GET `/api/audits/reports` route (statistics)
- [ ] T170 [US10] Implement GET `/api/audits/reports/coverage` route (GMP chapter coverage)
- [ ] T171 [P] [US10] Create AuditPlanList.tsx in `src/components/audits/`
- [ ] T172 [P] [US10] Create AuditScheduleCalendar.tsx in `src/components/audits/`
- [ ] T173 [P] [US10] Create AuditFindingForm.tsx in `src/components/audits/`
- [ ] T174 [P] [US10] Create AuditCoverageChart.tsx in `src/components/audits/`
- [ ] T175 [US10] Create audits dashboard page in `src/app/audits/page.tsx`
- [ ] T176 [US10] Create plans page in `src/app/audits/plans/page.tsx`
- [ ] T177 [US10] Create audit detail page in `src/app/audits/[id]/page.tsx`

**Checkpoint**: Internal audit module fully functional

---

## Phase 10: User Story 1 - QA Manager Reviews Compliance Dashboard (Priority: P1)

**Goal**: Implement compliance dashboard showing GMP chapter status with drill-down to gaps

**Independent Test**: View dashboard, verify all chapters shown, drill-down to specific gaps

**Note**: This user story depends on other modules being implemented to show meaningful data

### Implementation for User Story 1

- [ ] T178 [US1] Create compliance-service in `src/lib/services/compliance-service.ts`
  - calculateChapterCoverage(), getGapDetails(), getModuleStatus()
- [ ] T179 [US1] Implement GET `/api/compliance/dashboard` route
- [ ] T180 [US1] Implement GET `/api/compliance/gaps` route with chapter filter
- [ ] T181 [P] [US1] Create ComplianceDashboard.tsx in `src/components/compliance/`
- [ ] T182 [P] [US1] Create ChapterStatusCard.tsx in `src/components/compliance/`
- [ ] T183 [P] [US1] Create GapAnalysisTable.tsx in `src/components/compliance/`
- [ ] T184 [US1] Create compliance dashboard page in `src/app/compliance/page.tsx`

**Checkpoint**: Compliance dashboard fully functional

---

## Phase 11: Supporting Modules (P1.3, P1.4, P3.4)

**Purpose**: Change Control, PQR Generation, Contract Repository

### Change Control (P1.3)

- [ ] T185 [P] Create change-service in `src/lib/services/change-service.ts`
- [ ] T186 Implement GET/POST `/api/changes` route
- [ ] T187 Implement GET/PATCH `/api/changes/[id]` route
- [ ] T188 Implement POST `/api/changes/[id]/approve` route
- [ ] T189 [P] Create ChangeRequestList.tsx in `src/components/changes/`
- [ ] T190 [P] Create ChangeRequestForm.tsx in `src/components/changes/`

### PQR Generation (P1.4)

- [ ] T191 [P] Create pqr-service in `src/lib/services/pqr-service.ts`
  - generateReport(), calculateMetrics(), aggregateData()
- [ ] T192 Implement POST `/api/pqr/generate` route (aggregates data from all modules)
- [ ] T193 Implement GET `/api/pqr` route (list reports)
- [ ] T194 Implement GET `/api/pqr/[id]` route (report details)
- [ ] T195 [P] Create PqrReportList.tsx in `src/components/pqr/`
- [ ] T196 [P] Create PqrReportViewer.tsx in `src/components/pqr/`

### Contract Repository (P3.4)

- [ ] T197 [P] Create contract-service in `src/lib/services/contract-service.ts`
- [ ] T198 Implement GET/POST `/api/contracts` route
- [ ] T199 Implement GET/PATCH `/api/contracts/[id]` route
- [ ] T200 [P] Create ContractList.tsx in `src/components/contracts/`
- [ ] T201 [P] Create ContractForm.tsx in `src/components/contracts/`

---

## Phase 12: User Story 4 & 5 - eBMR and Material Status Enhancements (Priority: P2)

**Goal**: Enhance existing work order and inventory modules for GMP compliance

**Note**: These stories enhance existing modules rather than creating new ones

### User Story 4 - eBMR Enhancements

- [ ] T202 [US4] Add line_clearance_verified field to existing work_orders table
- [ ] T203 [US4] Add ipc_checkpoints JSON field to existing work_order_operations table
- [ ] T204 [US4] Add dual_verification fields to existing weighing/dispensing records
- [ ] T205 [US4] Implement line clearance verification UI in existing work order page
- [ ] T206 [US4] Implement IPC checkpoint recording UI
- [ ] T207 [US4] Implement dual verification UI for critical operations

### User Story 5 - Material Status Enhancements

- [ ] T208 [US5] Add rejection_reason, rejection_date fields to inventory_lots table
- [ ] T209 [US5] Add blocked_for_qa field to inventory_lots table
- [ ] T210 [US5] Update inventory issuance logic to block rejected/quarantine lots
- [ ] T211 [US5] Add material status dashboard to inventory module

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T212 [P] Add audit trail logging to all new API routes
- [ ] T213 [P] Add permission checks for all new API routes based on hr_authorizations
- [ ] T214 [P] Add email notification triggers for approvals, due dates, overdue items
- [ ] T215 Code cleanup and refactoring across all new modules
- [ ] T216 Performance optimization: add database indexes per data-model.md
- [ ] T217 [P] Add unit tests for remaining untested services
- [ ] T218 Security hardening: input validation, SQL injection prevention review
- [ ] T219 Run quickstart.md validation for all implemented patterns
- [ ] T220 Update navigation menu with proper grouping and permissions
- [ ] T221 Final integration test: complete workflow from deviation to CAPA to closure

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Stories (Phases 3-12)**: All depend on Foundational phase completion
- **Polish (Phase 13)**: Depends on all desired user stories being complete

### User Story Dependencies

```
Foundation (Phase 2) ─┬─→ US2 Document Control (Phase 3) ─→ Change Control (Phase 11)
                      │
                      ├─→ US3 CAPA (Phase 4) ─┬─→ US7 Complaints (Phase 5)
                      │                       │
                      │                       ├─→ US10 Internal Audit (Phase 9)
                      │                       │
                      │                       └─→ PQR (Phase 11) requires US3
                      │
                      ├─→ US6 Stability (Phase 7) - Independent
                      │
                      ├─→ US8 Recalls (Phase 6) ←─ US7 Complaints
                      │
                      ├─→ US9 Sanitation (Phase 8) - Independent
                      │
                      └─→ US1 Compliance Dashboard (Phase 10) - Depends on all modules
```

### Parallel Opportunities

**After Phase 2 (Foundation), these can run in parallel:**
- US2 Document Control (Phase 3)
- US6 Stability (Phase 7)
- US9 Sanitation (Phase 8)

**After US3 CAPA (Phase 4), these can run in parallel:**
- US7 Complaints (Phase 5)
- US10 Internal Audit (Phase 9)

**US8 Recalls requires US7 Complaints first due to complaint-to-recall workflow**

**US1 Compliance Dashboard should be implemented last as it aggregates all module data**

---

## Parallel Example: Phase 2 Foundation

```bash
# Launch all schema tasks together (different tables):
Task: "Create documents table in schema.ts"
Task: "Create capa table in schema.ts"
Task: "Create complaints table in schema.ts"
Task: "Create recalls table in schema.ts"
# ... (all T009-T036 can run in parallel)

# Launch all shared components together (different files):
Task: "Create WorkflowStatusBadge.tsx"
Task: "Create ApprovalChain.tsx"
Task: "Create AuditTrailViewer.tsx"
Task: "Create TrendChart.tsx"
```

---

## Parallel Example: Independent User Stories

```bash
# After Foundation complete, launch these in parallel:

# Developer A: Document Control
Task: "Create document-service in src/lib/services/document-service.ts"
Task: "Implement GET/POST /api/documents route"
# ...

# Developer B: Stability Program
Task: "Create stability-service in src/lib/services/stability-service.ts"
Task: "Implement GET/POST /api/stability/protocols route"
# ...

# Developer C: Sanitation
Task: "Create sanitation-service in src/lib/services/sanitation-service.ts"
Task: "Implement GET/POST /api/sanitation/schedules route"
# ...
```

---

## Implementation Strategy

### MVP First (Core P1 Stories)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundation (CRITICAL - blocks all stories)
3. Complete Phase 3: US2 Document Control
4. Complete Phase 4: US3 CAPA
5. **STOP and VALIDATE**: Test document and CAPA workflows
6. Deploy/demo - This is the P1 MVP!

### Incremental Delivery

1. Setup + Foundation → Foundation ready
2. Add US2 Document Control → Test → Deploy (Document MVP)
3. Add US3 CAPA → Test → Deploy (QMS MVP)
4. Add US7 Complaints → Test → Deploy
5. Add US8 Recalls → Test → Deploy (Complaint/Recall MVP)
6. Add US6 Stability → Test → Deploy
7. Add US9 Sanitation → Test → Deploy
8. Add US10 Internal Audit → Test → Deploy
9. Add US1 Compliance Dashboard → Test → Deploy (Full Feature)

---

## Task Summary

| Phase | User Story | Tasks | Priority |
|-------|------------|-------|----------|
| 1 | Setup | 8 | - |
| 2 | Foundation | 35 | - |
| 3 | US2 Document Control | 17 | P1 |
| 4 | US3 CAPA | 20 | P1 |
| 5 | US7 Complaints | 14 | P2 |
| 6 | US8 Recalls | 19 | P2 |
| 7 | US6 Stability | 21 | P2 |
| 8 | US9 Sanitation | 19 | P3 |
| 9 | US10 Internal Audit | 24 | P3 |
| 10 | US1 Compliance Dashboard | 7 | P1 |
| 11 | Supporting Modules | 17 | P1/P3 |
| 12 | US4/US5 Enhancements | 10 | P2 |
| 13 | Polish | 10 | - |
| **Total** | | **221** | |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- All API routes must include audit trail logging
- All UI must use DevExtreme components exclusively
- All services must support SQLite (test) and MySQL (production)

# Tasks: GMP Compliance Gap Closure Implementation

**Input**: Design documents from `/specs/009-gmp-compliance-gap-analysis/`
**Prerequisites**: plan-implementation.md (required), spec.md, data-model.md
**Branch**: `009-gmp-compliance-gap-analysis`
**Date**: 2025-12-23

**Scope**: Implement GMP compliance modules (FR-001 to FR-046) to achieve 80%+ coverage across all 10 หมวด (chapters). This is the FEATURE IMPLEMENTATION companion to the existing integration testing tasks.

## Format: `[ID] [P?] [FR-###] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[FR-###]**: Which functional requirement(s) this task addresses
- Include exact file paths in descriptions

---

## Phase 1: Document Control System (P1)

**Purpose**: Implement FR-001, FR-002, FR-018-022 - Document control with version management, approval workflow, effective dates

**User Story**: US2 - Document Control Officer Manages SOPs

### Database Schema

- [ ] T101 [P] [FR-001] Create SQLite schema `src/lib/db/schema/sqlite/document-control.ts` with documentTypes, documents, documentVersions, documentApprovals tables
- [ ] T102 [P] [FR-001] Create MySQL schema `src/lib/db/schema/mysql/document-control.ts` matching SQLite schema
- [ ] T103 [FR-001] Export document control tables from `src/lib/db/schema/sqlite/index.ts` and `src/lib/db/schema/mysql/index.ts`
- [ ] T104 [FR-001] Run `pnpm drizzle-kit generate` and `pnpm drizzle-kit push` to apply migrations
- [ ] T105 [FR-001] Seed document_types with standard types: SOP, POL, FORM, WI, SPEC in `src/lib/db/seed-document-types.ts`

### Service Layer

- [ ] T106 [FR-001] Create `src/lib/services/document-control-service.ts` with createDocument() generating auto-numbered document IDs
- [ ] T107 [FR-001] Add createVersion() to document-control-service.ts with sequential version numbering (1.0, 2.0, etc.)
- [ ] T108 [FR-001] Add submitForApproval() creating approval records based on document type approval chain
- [ ] T109 [FR-001] Add approveVersion() with delegation support via hr_delegations lookup
- [ ] T110 [FR-001] Add rejectVersion() with rejection comments and notification
- [ ] T111 [FR-001] Add publishDocument() setting effective date and marking previous version superseded
- [ ] T112 [FR-002] Add listDocuments() with filters for status, type, department, and full-text search
- [ ] T113 [FR-002] Add getDocumentById() returning document with all versions and approval history

### Integration Tests

- [ ] T114 [FR-001] Create `tests/integration/services/document-control-impl.test.ts` with real SQLite testing
- [ ] T115 [FR-001] Test complete workflow: draft → submit → approve → publish → supersede

### API Routes

- [ ] T116 [P] [FR-001] Create `src/app/api/documents/route.ts` with GET (list) and POST (create)
- [ ] T117 [P] [FR-001] Create `src/app/api/documents/[id]/route.ts` with GET and PUT
- [ ] T118 [FR-001] Create `src/app/api/documents/[id]/versions/route.ts` with POST (new version)
- [ ] T119 [FR-001] Create `src/app/api/documents/[id]/versions/[versionId]/approve/route.ts` with POST

### UI Pages

- [ ] T120 [P] [FR-002] Create `src/app/quality/documents/page.tsx` with DevExtreme DataGrid listing documents
- [ ] T121 [FR-001] Create `src/app/quality/documents/new/page.tsx` with document creation form
- [ ] T122 [FR-001] Create `src/app/quality/documents/[id]/page.tsx` with version history and approval status
- [ ] T123 [FR-001] Create `src/app/quality/documents/[id]/versions/new/page.tsx` for creating new versions
- [ ] T124 [FR-001] Add approval workflow UI in document detail page with approve/reject buttons

**Checkpoint Phase 1**: Document Control system functional - test by creating SOP, submitting for approval, approving, and publishing

---

## Phase 2: CAPA Enhancement (P1)

**Purpose**: Enhance FR-003, FR-005 - CAPA effectiveness verification and multiple source linkage

**User Story**: US3 - Quality Manager Handles CAPA Workflow

### Database Schema

- [ ] T201 [FR-005] Add capa_effectiveness table to `src/lib/db/schema/sqlite/capa.ts` if not exists
- [ ] T202 [FR-005] Verify capa table has sourceType, deviationId, complaintId, auditFindingId columns

### Service Layer Enhancement

- [ ] T203 [FR-005] Add recordEffectivenessCheck() to `src/lib/services/capa-service.ts` with checkNumber sequence
- [ ] T204 [FR-005] Add getEffectivenessHistory() returning all checks for a CAPA
- [ ] T205 [FR-005] Modify closeCapa() to require effective verification before closure
- [ ] T206 [FR-003] Add createCapaFromDeviation() auto-linking to source deviation
- [ ] T207 [FR-003] Add createCapaFromComplaint() auto-linking to source complaint
- [ ] T208 [FR-003] Add createCapaFromAuditFinding() auto-linking to source audit finding

### Integration Tests

- [ ] T209 [FR-005] Add effectiveness verification tests to `tests/integration/services/capa-service-real.test.ts`
- [ ] T210 [FR-005] Test CAPA cannot close without effective verification

### UI Enhancement

- [ ] T211 [FR-005] Add effectiveness verification section to `src/app/quality/capa/[id]/page.tsx`
- [ ] T212 [FR-005] Add effectiveness check form with criteria, result, evidence fields

**Checkpoint Phase 2**: CAPA effectiveness verification works - test by completing CAPA actions and recording effectiveness check

---

## Phase 3: Change Control (P1)

**Purpose**: Implement FR-046 - Change control workflow linked to document control

**User Story**: Related to US2 - Document Control

### Database Schema

- [ ] T301 [P] [FR-046] Create `src/lib/db/schema/sqlite/change-control.ts` with changeRequests, changeApprovals tables
- [ ] T302 [P] [FR-046] Create `src/lib/db/schema/mysql/change-control.ts` matching SQLite schema
- [ ] T303 [FR-046] Export change control tables from schema index files

### Service Layer

- [ ] T304 [FR-046] Create `src/lib/services/change-control-service.ts` with createChangeRequest()
- [ ] T305 [FR-046] Add submitChangeForReview() initiating approval workflow
- [ ] T306 [FR-046] Add approveChange() with multi-department approval support (QA, Production, Regulatory)
- [ ] T307 [FR-046] Add implementChange() recording implementation date and linking to affected documents
- [ ] T308 [FR-046] Add closeChange() after effectiveness verification

### Integration Tests

- [ ] T309 [FR-046] Create `tests/integration/services/change-control-impl.test.ts`

### API Routes

- [ ] T310 [P] [FR-046] Create `src/app/api/changes/route.ts` with GET and POST
- [ ] T311 [FR-046] Create `src/app/api/changes/[id]/approve/route.ts`

### UI Pages

- [ ] T312 [P] [FR-046] Create `src/app/quality/changes/page.tsx` with change request list
- [ ] T313 [FR-046] Create `src/app/quality/changes/new/page.tsx` with change request form
- [ ] T314 [FR-046] Create `src/app/quality/changes/[id]/page.tsx` with approval workflow UI

**Checkpoint Phase 3**: Change control workflow functional

---

## Phase 4: PQR Generation (P1)

**Purpose**: Implement FR-004 - Annual Product Quality Review auto-generation

**User Story**: Related to US1 - QA Manager Reviews Compliance Dashboard

### Database Schema

- [ ] T401 [P] [FR-004] Create `src/lib/db/schema/sqlite/pqr.ts` with pqrReports, pqrMetrics tables
- [ ] T402 [P] [FR-004] Create `src/lib/db/schema/mysql/pqr.ts` matching SQLite schema
- [ ] T403 [FR-004] Export PQR tables from schema index files

### Service Layer

- [ ] T404 [FR-004] Create `src/lib/services/pqr-service.ts` with generatePQR(productId, year)
- [ ] T405 [FR-004] Add aggregateBatchMetrics() counting batches, calculating yield stats from work_orders
- [ ] T406 [FR-004] Add aggregateDeviationMetrics() counting deviations by severity from deviations table
- [ ] T407 [FR-004] Add aggregateCapaMetrics() counting CAPAs, closure rates from capa table
- [ ] T408 [FR-004] Add aggregateComplaintMetrics() counting complaints by category from complaints table
- [ ] T409 [FR-004] Add aggregateOosMetrics() counting OOS results from quality_tests
- [ ] T410 [FR-004] Add aggregateStabilityStatus() summarizing stability trends from stability_studies
- [ ] T411 [FR-004] Add calculatePQRMetrics() computing KPIs against targets
- [ ] T412 [FR-004] Add approvePQR() with QA manager signature

### Integration Tests

- [ ] T413 [FR-004] Create `tests/integration/services/pqr-impl.test.ts`
- [ ] T414 [FR-004] Test PQR generation aggregates data correctly from all source tables

### API Routes

- [ ] T415 [P] [FR-004] Create `src/app/api/pqr/route.ts` with GET and POST (generate)
- [ ] T416 [FR-004] Create `src/app/api/pqr/[id]/route.ts` with GET and PUT (approve)

### UI Pages

- [ ] T417 [P] [FR-004] Create `src/app/quality/pqr/page.tsx` with PQR list by product/year
- [ ] T418 [FR-004] Create `src/app/quality/pqr/generate/page.tsx` with product/year selection
- [ ] T419 [FR-004] Create `src/app/quality/pqr/[id]/page.tsx` with full PQR report view and approval

**Checkpoint Phase 4**: PQR generation works - test by generating PQR for a product with existing batch data

---

## Phase 5: Complaint Enhancement (P2)

**Purpose**: Enhance FR-037, FR-041 - QC routing and regulatory reporting

**User Story**: US7 - Customer Service Representative Handles Complaints

### Service Layer Enhancement

- [ ] T501 [FR-037] Add routeToQC() to `src/lib/services/complaint-service.ts` auto-assigning QC reviewer
- [ ] T502 [FR-037] Add assignInvestigator() for complaint investigation assignment
- [ ] T503 [FR-037] Add recordInvestigation() capturing batch record review, retain sample test, root cause
- [ ] T504 [FR-041] Add evaluateRegulatoryReporting() prompting for FDA notification consideration
- [ ] T505 [FR-041] Add recordAdverseEvent() linking complaint to adverse event with severity
- [ ] T506 [FR-037] Add getComplaintTrends() analyzing patterns by product, category, time period

### Integration Tests

- [ ] T507 [FR-037] Add QC routing tests to complaint-service integration tests
- [ ] T508 [FR-041] Test regulatory reporting flag triggers on serious complaints

### UI Enhancement

- [ ] T509 [FR-037] Add investigation form to `src/app/quality/complaints/[id]/page.tsx`
- [ ] T510 [FR-041] Add regulatory notification section with checkbox and date field
- [ ] T511 [FR-037] Create `src/app/quality/complaints/trends/page.tsx` with DevExtreme charts

**Checkpoint Phase 5**: Complaint handling with QC routing and regulatory tracking

---

## Phase 6: Recall Management (P2)

**Purpose**: Implement FR-038-040 - Recall execution with distribution tracking

**User Story**: US8 - Recall Coordinator Executes Product Recall

### Database Schema Enhancement

- [ ] T601 [FR-038] Verify recalls, recall_notifications, recall_reconciliation tables exist per data-model.md
- [ ] T602 [FR-038] Add indexes on recall_notifications(recallId) and recall_reconciliation(recallId, lotId)

### Service Layer

- [ ] T603 [FR-038] Create `src/lib/services/recall-distribution-service.ts` with getDistributionByLot()
- [ ] T604 [FR-038] Add aggregateInventoryTransactions() grouping by customer from inventory_transactions
- [ ] T605 [FR-039] Add sendRecallNotifications() creating notification records for each affected customer
- [ ] T606 [FR-039] Add trackNotificationResponse() updating acknowledgment and response status
- [ ] T607 [FR-040] Add recordReturn() logging returned quantities by customer
- [ ] T608 [FR-040] Add reconcileRecall() calculating distributed vs returned vs destroyed vs unaccounted
- [ ] T609 [FR-040] Add calculateEffectivenessRate() as reconciledQty / distributedQty * 100
- [ ] T610 [FR-040] Add generateRecallReport() for regulatory submission

### Integration Tests

- [ ] T611 [FR-038-040] Create `tests/integration/services/recall-distribution-impl.test.ts`
- [ ] T612 [FR-038] Test distribution aggregation from inventory transactions

### API Routes

- [ ] T613 [P] [FR-038] Create `src/app/api/recalls/[id]/distribution/route.ts`
- [ ] T614 [FR-039] Create `src/app/api/recalls/[id]/notifications/route.ts`
- [ ] T615 [FR-040] Create `src/app/api/recalls/[id]/reconciliation/route.ts`

### UI Enhancement

- [ ] T616 [FR-038] Add distribution tracking tab to `src/app/quality/recalls/[id]/page.tsx`
- [ ] T617 [FR-039] Add notification management UI with send/track functionality
- [ ] T618 [FR-040] Add reconciliation form with quantity breakdown
- [ ] T619 [FR-040] Add recall effectiveness dashboard showing reconciliation progress

**Checkpoint Phase 6**: Recall management with distribution tracking - test mock recall scenario

---

## Phase 7: Stability Enhancement (P2)

**Purpose**: Enhance FR-033-034 - Protocol management, trend analysis, OOS workflow

**User Story**: US6 - Quality Manager Runs Stability Program

### Service Layer Enhancement

- [ ] T701 [FR-033] Add createProtocol() to `src/lib/services/stability-service.ts` with timepoint JSON
- [ ] T702 [FR-033] Add enrollBatch() linking lot to protocol and generating sample schedule
- [ ] T703 [FR-033] Add generateSampleSchedule() creating stability_samples for each timepoint
- [ ] T704 [FR-033] Add getUpcomingSamples() returning samples due within N days
- [ ] T705 [FR-033] Add recordSampleResult() linking to quality_tests
- [ ] T706 [FR-034] Add calculateTrend() computing slope from historical results
- [ ] T707 [FR-034] Add detectOOS() comparing result against spec limits
- [ ] T708 [FR-034] Add triggerOOSInvestigation() creating deviation with stability linkage

### Integration Tests

- [ ] T709 [FR-033-034] Add protocol and trend tests to stability-service integration tests

### UI Enhancement

- [ ] T710 [FR-033] Create `src/app/quality/stability/protocols/page.tsx` with protocol list
- [ ] T711 [FR-033] Create `src/app/quality/stability/protocols/new/page.tsx` with timepoint editor
- [ ] T712 [FR-034] Add trend chart to `src/app/quality/stability/[id]/page.tsx` using DevExtreme Chart
- [ ] T713 [FR-034] Add OOS alert indicator with link to deviation

**Checkpoint Phase 7**: Stability program with trend visualization and OOS detection

---

## Phase 8: Sanitation Enhancement (P3)

**Purpose**: Enhance FR-014-017 - Schedule management, completion tracking, trends

**User Story**: US9 - Facilities Manager Manages Sanitation Program

### Service Layer Enhancement

- [ ] T801 [FR-014] Add createSchedule() to `src/lib/services/sanitation-service.ts` with frequency options
- [ ] T802 [FR-014] Add generateDueDates() creating expected cleaning dates based on frequency
- [ ] T803 [FR-015] Add logCleaning() recording operator, method, verification
- [ ] T804 [FR-016] Add logPestControl() recording contractor activity
- [ ] T805 [FR-017] Add getSanitationTrends() calculating compliance rates by area over time
- [ ] T806 [FR-017] Add getPestControlTrends() analyzing activity levels

### UI Enhancement

- [ ] T807 [FR-014] Create `src/app/facilities/sanitation/schedules/page.tsx`
- [ ] T808 [FR-015] Create `src/app/facilities/sanitation/logs/page.tsx` with completion form
- [ ] T809 [FR-016] Create `src/app/facilities/pest-control/page.tsx`
- [ ] T810 [FR-017] Create `src/app/facilities/sanitation/trends/page.tsx` with charts

**Checkpoint Phase 8**: Sanitation program with scheduling and trends

---

## Phase 9: Internal Audit Enhancement (P3)

**Purpose**: Enhance FR-042-044 - Audit planning, GMP chapter mapping, CAPA linkage

**User Story**: US10 - Internal Auditor Conducts Self-Inspection

### Service Layer Enhancement

- [ ] T901 [FR-042] Add createAuditPlan() to `src/lib/services/internal-audit-service.ts` with year coverage
- [ ] T902 [FR-042] Add generateAuditSchedule() distributing audits across GMP chapters 1-10
- [ ] T903 [FR-043] Add recordFinding() with gmpChapter and gmpRequirement fields
- [ ] T904 [FR-043] Add classifyFinding() setting severity (observation, minor, major, critical)
- [ ] T905 [FR-044] Add createCapaFromFinding() linking audit finding to CAPA
- [ ] T906 [FR-044] Add verifyFindingClosure() confirming CAPA completion

### UI Enhancement

- [ ] T907 [FR-042] Create `src/app/quality/audits/plans/page.tsx` with annual plan view
- [ ] T908 [FR-042] Add GMP chapter coverage heatmap showing audit status per chapter
- [ ] T909 [FR-043] Add finding classification selector to audit finding form
- [ ] T910 [FR-044] Add CAPA linkage display showing finding→CAPA→closure chain

**Checkpoint Phase 9**: Internal audit program with GMP coverage tracking

---

## Phase 10: Equipment Enhancement (P3)

**Purpose**: Implement FR-010-013 - Calibration scheduling, maintenance alerts, status tracking

### Database Schema

- [ ] T1001 [FR-010] Add calibration and maintenance fields to equipment table if not exists
- [ ] T1002 [FR-013] Add cleaningStatus enum column to equipment table

### Service Layer

- [ ] T1003 [FR-010] Create `src/lib/services/equipment-maintenance-service.ts` with scheduleCalibration()
- [ ] T1004 [FR-011] Add getOverdueCalibrations() returning equipment needing calibration
- [ ] T1005 [FR-011] Add sendCalibrationAlerts() notifying responsible personnel
- [ ] T1006 [FR-012] Add updateEquipmentStatus() with status validation workflow
- [ ] T1007 [FR-013] Add updateCleaningStatus() with clean/dirty/in-use/out-of-service states

### UI Enhancement

- [ ] T1008 [FR-010] Create `src/app/facilities/equipment/calibration/page.tsx`
- [ ] T1009 [FR-011] Add calibration due alert banner to equipment list page
- [ ] T1010 [FR-012] Add equipment status indicator with color coding
- [ ] T1011 [FR-013] Add cleaning status toggle to equipment detail page

**Checkpoint Phase 10**: Equipment management with calibration tracking

---

## Phase 11: Compliance Dashboard (P1)

**Purpose**: Implement US1 - QA Manager Reviews Compliance Dashboard

### Service Layer

- [ ] T1101 [SC-001] Create `src/lib/services/compliance-dashboard-service.ts` with getComplianceOverview()
- [ ] T1102 [SC-001] Add calculateChapterCoverage() for each หมวด 1-10
- [ ] T1103 [SC-001] Add getGapsWithDrilldown() returning requirements not yet met

### UI Pages

- [ ] T1104 [SC-001] Create `src/app/quality/compliance/page.tsx` with dashboard layout
- [ ] T1105 [SC-001] Add DevExtreme PieChart showing overall compliance percentage
- [ ] T1106 [SC-001] Add DataGrid with chapter-by-chapter breakdown
- [ ] T1107 [SC-001] Add drill-down to specific requirements showing gap details

**Checkpoint Phase 11**: Compliance dashboard shows 80%+ coverage

---

## Phase 12: Verification & Polish

**Purpose**: Final validation and documentation

- [ ] T1201 Run `pnpm tsc --noEmit` and fix all TypeScript errors
- [ ] T1202 Run `pnpm lint` and fix all linting errors
- [ ] T1203 Run `pnpm test:run` and verify all tests pass
- [ ] T1204 Manual testing: Document control full workflow
- [ ] T1205 Manual testing: CAPA from deviation through effectiveness verification
- [ ] T1206 Manual testing: Recall mock scenario with distribution tracking
- [ ] T1207 Manual testing: PQR generation for existing product
- [ ] T1208 Manual testing: Compliance dashboard shows accurate coverage
- [ ] T1209 Update spec.md Implementation Status table with actual coverage percentages

**Checkpoint Final**: All GMP compliance modules implemented, tests pass, 80%+ coverage achieved

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Document Control) ──┐
                             ├──→ Phase 3 (Change Control) ──→ Phase 4 (PQR)
Phase 2 (CAPA Enhancement) ──┤
                             ├──→ Phase 5 (Complaints) ──→ Phase 6 (Recalls)
                             │
                             ├──→ Phase 9 (Internal Audit)
                             │
Phase 7 (Stability) ─────────┘

Phase 8 (Sanitation) ────────── (Independent)
Phase 10 (Equipment) ────────── (Independent)
Phase 11 (Dashboard) ────────── (Depends on all)
```

### Parallel Opportunities

**Phase 1-2**: T101/T102, T116/T117, T120 can run in parallel
**Phase 3-4**: T301/T302, T310, T312 can run in parallel
**Phase 8-10**: All phases can run in parallel (no dependencies)

---

## Task Summary

| Phase | Description | Tasks | FR Coverage | Priority |
|-------|-------------|-------|-------------|----------|
| 1 | Document Control System | 25 | FR-001, FR-002 | P1 |
| 2 | CAPA Enhancement | 12 | FR-003, FR-005 | P1 |
| 3 | Change Control | 14 | FR-046 | P1 |
| 4 | PQR Generation | 19 | FR-004 | P1 |
| 5 | Complaint Enhancement | 11 | FR-037, FR-041 | P2 |
| 6 | Recall Management | 19 | FR-038-040 | P2 |
| 7 | Stability Enhancement | 13 | FR-033-034 | P2 |
| 8 | Sanitation Enhancement | 10 | FR-014-017 | P3 |
| 9 | Internal Audit Enhancement | 10 | FR-042-044 | P3 |
| 10 | Equipment Enhancement | 11 | FR-010-013 | P3 |
| 11 | Compliance Dashboard | 7 | SC-001 | P1 |
| 12 | Verification & Polish | 9 | - | - |
| **Total** | | **160** | **24 FRs** | |

---

## Deferred Scope

| Requirement | Description | Reason | Target |
|-------------|-------------|--------|--------|
| FR-035 | Contract Repository | No contract manufacturing in use | Future phase |
| FR-036 | Batch-Level Contractor ID | Depends on FR-035 | Future phase |
| FR-045 | Reference Library (Pharmacopoeia) | SHOULD requirement | Future phase |

---

## Notes

- Each task follows TDD: write failing test → implement → verify → commit
- Use existing patterns from `src/lib/services/capa-service.ts` as reference
- DevExtreme components required for all UI (Constitution III)
- Commit after each task completion (Constitution I)
- Run `pnpm tsc --noEmit && pnpm lint` before each commit (Constitution I)

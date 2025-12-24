# Tasks: GMP Compliance Gap Analysis - Phase 2 (External Auditor Requirements)

**Input**: Design documents from `/specs/009-gmp-compliance-gap-analysis/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/phase2-api.yaml
**Feature Branch**: `009-gmp-compliance-gap-analysis`
**Scope**: FR-047 to FR-074 (External Auditor Requirements)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US11-US15 from spec.md)

## User Story Mapping

| Story | Title | Priority | FR Range |
|-------|-------|----------|----------|
| US11 | External Auditor Reviews Dashboard KPIs | P1 | FR-047 to FR-054 |
| US12 | Warehouse Clerk Records Complete Material Receipt | P1 | FR-055 to FR-061 |
| US13 | Production Operator Completes Line Clearance | P1 | FR-062, FR-071-074 |
| US14 | Production Operator Verifies Labels | P1 | FR-064, FR-065, FR-071-074 |
| US15 | QC Analyst Records Disposition Decision | P1 | FR-067 to FR-070, FR-071-074 |

---

## Phase 1: Setup

**Purpose**: Project structure verification and dependency setup

- [X] T001 Verify Next.js project structure matches plan.md layout
- [X] T002 [P] Verify Drizzle ORM dual-schema configuration in src/lib/db/
- [X] T003 [P] Verify DevExtreme React 25.x dependency in package.json
- [X] T004 [P] Verify existing attachments table supports BLOB storage (fileData column)

---

## Phase 2: Foundational (Schema Changes - Blocking All User Stories)

**Purpose**: Database schema modifications required by ALL user stories

**CRITICAL**: No user story work can begin until this phase is complete

### Schema Column Additions

- [X] T005 Add manufacturer/importer columns to inventory_lots in src/lib/db/schema.ts (manufacturerName, manufacturerId, importerName, importerId, countryOfOrigin)
- [X] T006 Add retest tracking columns to inventory_lots in src/lib/db/schema.ts (retestDate, retestIntervalMonths, lastRetestDate, retestStatus)
- [X] T007 [P] Add strength column to items in src/lib/db/schema.ts
- [X] T008 [P] Add disposition columns to quality_tests in src/lib/db/schema.ts (disposition, dispositionBy, dispositionAt, dispositionReason, dispositionApprovedBy, dispositionApprovedAt)
- [X] T009 [P] Add BOM verification columns to bom_lines in src/lib/db/schema.ts (percentageInFormula, weighedQty, weighedBy, verifiedBy, verifiedAt)
- [X] T010 [P] Add line clearance columns to work_orders in src/lib/db/schema.ts (lineClearanceRequired, lineClearanceStatus, lineClearanceBy, lineClearanceAt, lineClearanceChecklistId)

### MySQL Schema Mirror (Must match SQLite changes)

- [X] T011 Add manufacturer/importer columns to inventory_lots in src/lib/db/schema.ts (same file, MySQL section)
- [X] T012 Add retest tracking columns to inventory_lots in src/lib/db/schema.ts
- [X] T013 [P] Add strength column to items in src/lib/db/schema.ts
- [X] T014 [P] Add disposition columns to quality_tests in src/lib/db/schema.ts
- [X] T015 [P] Add BOM verification columns to bom_lines in src/lib/db/schema.ts
- [X] T016 [P] Add line clearance columns to work_orders in src/lib/db/schema.ts

### New Tables (Order matters: electronic_signatures first, referenced by others)

- [X] T017 Create electronic_signatures table (SQLite) in src/lib/db/schema.ts
- [X] T018 Create electronic_signatures table (MySQL) in src/lib/db/schema.ts
- [X] T019 Create line_clearance_checklists table (SQLite) in src/lib/db/schema.ts
- [X] T020 Create line_clearance_checklists table (MySQL) in src/lib/db/schema.ts
- [X] T021 Create label_verifications table (SQLite) in src/lib/db/schema.ts
- [X] T022 Create label_verifications table (MySQL) in src/lib/db/schema.ts
- [X] T023 Create stock_alert_rules table (SQLite) in src/lib/db/schema.ts
- [X] T024 Create stock_alert_rules table (MySQL) in src/lib/db/schema.ts

### Schema Sync and Validation

- [X] T025 Export new tables and type aliases in src/lib/db/schema.ts (types added at end of file)
- [ ] T026 Run DB_TYPE=sqlite pnpm db:push to apply SQLite schema changes
- [X] T027 TypeScript types for new tables added directly in schema.ts (ElectronicSignature, LineClearanceChecklist, LabelVerification, StockAlertRule)

### Electronic Signature Service (Foundation for US13, US14, US15)

- [X] T028 Create electronic-signature-service.ts in src/lib/services/ with createElectronicSignature, verifyUserPassword, getSignaturesForEntity, verifySignatureIntegrity functions
- [X] T029 Create unit test for electronic-signature-service in tests/unit/services/ (10 tests passing)

**Checkpoint**: Foundation ready - all schema changes applied, e-signature service functional

---

## Phase 3: User Story 11 - External Auditor Reviews Dashboard KPIs (Priority: P1) MVP

**Goal**: Provide audit dashboard with 8 KPI cards showing RM status, QC summary, and production status

**Independent Test**: View /dashboard/audit page and verify all 8 KPI cards display accurate real-time data

**FR Coverage**: FR-047 (RM YTD), FR-048 (RM Status), FR-049 (Expiry Alerts), FR-050 (Min Stock), FR-051 (QC Summary), FR-052 (Production Status), FR-053 (Pending QC), FR-054 (FG Approved)

### Implementation for User Story 11

- [X] T030 [US11] Create audit-dashboard-service.ts in src/lib/services/ with getAuditKpis aggregation function
- [X] T031 [P] [US11] Implement getRmReceivedYtd helper in audit-dashboard-service.ts (FR-047)
- [X] T032 [P] [US11] Implement getRmStatusBreakdown helper in audit-dashboard-service.ts (FR-048)
- [X] T033 [P] [US11] Implement getExpiryAlerts helper in audit-dashboard-service.ts (FR-049)
- [X] T034 [P] [US11] Implement getMinStockAlerts helper in audit-dashboard-service.ts (FR-050)
- [X] T035 [P] [US11] Implement getQcSummary helper in audit-dashboard-service.ts (FR-051)
- [X] T036 [P] [US11] Implement getProductionStatus helper in audit-dashboard-service.ts (FR-052)
- [X] T037 [P] [US11] Implement getPendingQcRelease helper in audit-dashboard-service.ts (FR-053)
- [X] T038 [P] [US11] Implement getFgApproved helper in audit-dashboard-service.ts (FR-054)
- [X] T039 [US11] Create /api/dashboard/audit-kpis/route.ts API endpoint returning all 8 KPIs
- [X] T040 [P] [US11] Create /api/dashboard/rm-summary/route.ts API endpoint (FR-047 detailed view)
- [X] T041 [P] [US11] Create /api/inventory/min-stock-alerts/route.ts API endpoint (FR-050)
- [X] T042 [US11] Create rm-summary-card.tsx component in src/components/dashboard/ (FR-047)
- [X] T043 [P] [US11] Create rm-status-card.tsx component in src/components/dashboard/ (FR-048)
- [X] T044 [P] [US11] Create expiry-alert-card.tsx component in src/components/dashboard/ (FR-049)
- [X] T045 [P] [US11] Create min-stock-alert-card.tsx component in src/components/dashboard/ (FR-050)
- [X] T046 [P] [US11] Create qc-summary-card.tsx component in src/components/dashboard/ (FR-051)
- [X] T047 [P] [US11] Create production-status-card.tsx component in src/components/dashboard/ (FR-052)
- [X] T048 [P] [US11] Create pending-qc-card.tsx component in src/components/dashboard/ (FR-053)
- [X] T049 [P] [US11] Create fg-approved-card.tsx component in src/components/dashboard/ (FR-054)
- [X] T050 [US11] Create audit dashboard page at src/app/dashboard/audit/page.tsx with all 8 KPI cards
- [X] T051 [US11] Create integration test for audit-dashboard-service in tests/integration/services/audit-dashboard-service-real.test.ts (43 tests passing)
- [X] T052 [US11] Create UI test for audit dashboard page in tests/e2e/dashboard-audit.test.tsx (30 tests passing)

**Checkpoint**: Audit dashboard fully functional with all 8 KPI cards displaying real-time data (<3s load time target) ✅ COMPLETED

---

## Phase 4: User Story 12 - Warehouse Clerk Records Complete Material Receipt (Priority: P1)

**Goal**: Capture complete material receipt details including manufacturer, importer, retest date, and attached documents

**Independent Test**: Receive a material, record all detail fields, attach COA document, verify data saved correctly

**FR Coverage**: FR-055 (Manufacturer/Importer), FR-056 (Retest Date), FR-057 (COA/MSDS Attachments), FR-058 (Herbal Extract Details), FR-059 (FG Strength), FR-060 (Photo Upload), FR-061 (QC Hold Reason Display)

### Implementation for User Story 12

- [ ] T053 [US12] Update inventory.service.ts to handle manufacturer/importer fields on lot creation in src/lib/services/inventory.service.ts
- [ ] T054 [US12] Update inventory.service.ts to handle retest date tracking (retestDate, retestIntervalMonths, retestStatus)
- [ ] T055 [US12] Create /api/inventory/lots/[id]/documents/route.ts to proxy to existing attachments API with moduleName='inventory_lot' (FR-057)
- [ ] T056 [P] [US12] Update lot creation form to include manufacturer name and ID fields in src/app/inventory/lots/new/page.tsx
- [ ] T057 [P] [US12] Update lot creation form to include importer name and ID fields
- [ ] T058 [P] [US12] Update lot creation form to include country of origin field
- [ ] T059 [P] [US12] Update lot creation form to include retest date and interval fields
- [ ] T060 [US12] Add DocumentAttachment component to lot detail page for COA/Spec/MSDS uploads in src/app/inventory/lots/[id]/page.tsx (FR-057)
- [ ] T061 [P] [US12] Update item form to include strength field for finished goods in src/app/inventory/items/[id]/page.tsx (FR-059)
- [ ] T062 [P] [US12] Add photo upload with scale reference using DocumentAttachment in lot detail page (FR-060)
- [ ] T063 [US12] Create retest alert query and display QC hold reason on lot detail page (FR-061)
- [ ] T064 [US12] Update lot list page to show manufacturer and retest status columns in src/app/inventory/lots/page.tsx
- [ ] T065 [US12] Create integration test for inventory lot with manufacturer/retest fields in tests/integration/services/inventory-service-real.test.ts
- [ ] T066 [US12] Create UI test for lot creation with all new fields in tests/e2e/inventory-lot-creation.test.tsx

**Checkpoint**: Material receipt captures all required fields, documents attached via DocumentAttachment, retest tracking functional

---

## Phase 5: User Story 13 - Production Operator Completes Line Clearance (Priority: P1)

**Goal**: Enforce line clearance verification with dual sign-off before production start

**Independent Test**: Attempt to start production, complete line clearance checklist, verify production blocked until clearance verified

**FR Coverage**: FR-062 (Line Clearance Enforcement), FR-071-074 (Electronic Signatures)

### Implementation for User Story 13

- [ ] T067 [US13] Create line-clearance.service.ts in src/lib/services/ with createLineClearance, verifyLineClearance, checkLineClearanceRequired functions
- [ ] T068 [US13] Update production.service.ts to block work order start if line clearance not complete
- [ ] T069 [US13] Create /api/production/work-orders/[workOrderId]/line-clearance/route.ts for GET and POST
- [ ] T070 [US13] Create /api/production/work-orders/[workOrderId]/line-clearance/verify/route.ts with e-signature
- [ ] T071 [US13] Create ElectronicSignatureDialog component in src/components/shared/electronic-signature-dialog.tsx
- [ ] T072 [US13] Create line-clearance-form.tsx component in src/components/production/ with checklist items
- [ ] T073 [US13] Create line clearance page at src/app/production/line-clearance/page.tsx for work order line clearance
- [ ] T074 [US13] Update work order detail page to show line clearance status and block production start in src/app/production/work-orders/[id]/page.tsx
- [ ] T075 [US13] Create integration test for line-clearance-service in tests/integration/services/line-clearance-service-real.test.ts
- [ ] T076 [US13] Create UI test for line clearance workflow in tests/e2e/line-clearance.test.tsx

**Checkpoint**: Line clearance enforced, production blocked until dual verification complete with e-signatures

---

## Phase 6: User Story 14 - Production Operator Verifies Labels (Priority: P1)

**Goal**: Attach label images to batch record with dual verification signatures

**Independent Test**: Upload label image, verify label content, get operator and witness signatures, view label in batch record

**FR Coverage**: FR-064 (Label Image Attachment), FR-065 (Dual Label Verification), FR-071-074 (Electronic Signatures)

### Implementation for User Story 14

- [ ] T077 [US14] Create label-verification.service.ts in src/lib/services/ with createLabelVerification, verifyLabel, witnessLabel functions
- [ ] T078 [US14] Create /api/production/batch-records/[batchRecordId]/labels/route.ts for GET and POST (label upload uses attachments API)
- [ ] T079 [US14] Create /api/production/labels/[labelId]/verify/route.ts with operator e-signature
- [ ] T080 [US14] Create /api/production/labels/[labelId]/witness/route.ts with witness e-signature
- [ ] T081 [US14] Create label-verification-form.tsx component in src/components/production/ with image upload using DocumentAttachment
- [ ] T082 [US14] Create label verification page at src/app/production/label-verification/page.tsx
- [ ] T083 [US14] Update batch record detail page to show label verifications in src/app/production/work-orders/[id]/batch-record/page.tsx
- [ ] T084 [US14] Create integration test for label-verification-service in tests/integration/services/label-verification-service-real.test.ts
- [ ] T085 [US14] Create UI test for label verification workflow in tests/e2e/label-verification.test.tsx

**Checkpoint**: Label images attached to batch records with dual e-signature verification (operator + witness)

---

## Phase 7: User Story 15 - QC Analyst Records Disposition Decision (Priority: P1)

**Goal**: Record disposition decisions with approval workflow and automatic lot status update

**Independent Test**: Complete QC test with fail result, record disposition, get approval, verify lot status updates automatically

**FR Coverage**: FR-067 (Disposition Decision), FR-068 (Disposition Reason), FR-069 (Auto Lot Status Update), FR-070 (Audit Trail), FR-071-074 (Electronic Signatures)

### Implementation for User Story 15

- [ ] T086 [US15] Create qc-disposition.service.ts in src/lib/services/ with setDisposition, approveDisposition, updateLotStatusFromDisposition functions
- [ ] T087 [US15] Create /api/quality/tests/[testId]/disposition/route.ts for POST
- [ ] T088 [US15] Create /api/quality/tests/[testId]/disposition/approve/route.ts with e-signature
- [ ] T089 [US15] Create /api/quality/qc-summary/route.ts API endpoint (FR-051 detailed)
- [ ] T090 [US15] Create /api/quality/pending-release/route.ts API endpoint (FR-053)
- [ ] T091 [US15] Create disposition-form.tsx component in src/components/quality/ with reason field and approval workflow
- [ ] T092 [US15] Update quality test detail page to include disposition section in src/app/quality/tests/[id]/page.tsx
- [ ] T093 [US15] Update quality test list to show disposition status in src/app/quality/tests/page.tsx
- [ ] T094 [US15] Create integration test for qc-disposition-service in tests/integration/services/qc-disposition-service-real.test.ts
- [ ] T095 [US15] Create UI test for disposition workflow in tests/e2e/qc-disposition.test.tsx

**Checkpoint**: Disposition decisions recorded with approval workflow, lot status auto-updated, complete audit trail

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Integration, validation, and optimization across all user stories

- [ ] T096 [P] Create /api/signatures/route.ts API endpoint for listing signatures by entity (FR-074)
- [ ] T097 Add signature display component showing full name, title, timestamp, meaning in src/components/shared/signature-display.tsx
- [ ] T098 Add stock_alert_rules seed data for default thresholds (90 days expiry, 30 days retest) in tests/helpers/seed-data.ts
- [ ] T099 [P] Run performance test for dashboard audit-kpis endpoint to verify <3s load (SC-011)
- [ ] T100 [P] Validate all e-signature operations require password re-authentication (SC-018)
- [ ] T101 Run full integration test suite to verify all tests pass
- [ ] T102 Run ESLint and TypeScript checks (pnpm lint && pnpm tsc --noEmit)
- [ ] T103 Update quickstart.md with Phase 2 verification steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - verification only
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
  - Electronic Signature Service (T028-T029) must complete before US13, US14, US15
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US11 (Dashboard): Can start independently after Phase 2
  - US12 (Inventory): Can start independently after Phase 2
  - US13 (Line Clearance): Requires e-signature service (T028)
  - US14 (Label Verification): Requires e-signature service (T028)
  - US15 (Disposition): Requires e-signature service (T028)
- **Polish (Phase 8)**: Depends on all user stories complete

### User Story Dependencies

- **US11 (Dashboard KPIs)**: No dependencies on other stories - can start first
- **US12 (Material Receipt)**: No dependencies on other stories - can start first
- **US13 (Line Clearance)**: Depends on e-signature service, uses ElectronicSignatureDialog
- **US14 (Label Verification)**: Depends on e-signature service, uses ElectronicSignatureDialog
- **US15 (Disposition)**: Depends on e-signature service, uses ElectronicSignatureDialog

### Within Each User Story

- Service layer before API endpoints
- API endpoints before UI components
- Core implementation before integration tests
- Integration tests verify functionality
- UI tests validate end-to-end workflow

### Parallel Opportunities

```bash
# Phase 2 - After T017/T018 (electronic_signatures table):
Task: T019 (line_clearance_checklists)
Task: T021 (label_verifications)
Task: T023 (stock_alert_rules)

# US11 - All 8 dashboard helpers can run in parallel:
Task: T031 (RM YTD)
Task: T032 (RM Status)
Task: T033 (Expiry Alerts)
Task: T034 (Min Stock)
Task: T035 (QC Summary)
Task: T036 (Production Status)
Task: T037 (Pending QC)
Task: T038 (FG Approved)

# US11 - All 8 KPI cards can run in parallel:
Task: T042-T049 (all dashboard card components)

# US12 - Form field updates can run in parallel:
Task: T056 (manufacturer)
Task: T057 (importer)
Task: T058 (country)
Task: T059 (retest date)
Task: T061 (strength)
Task: T062 (photo upload)

# User stories themselves can run in parallel after Phase 2:
Team A: US11 (Dashboard) + US12 (Inventory)
Team B: US13 (Line Clearance)
Team C: US14 (Labels) + US15 (Disposition)
```

---

## Implementation Strategy

### MVP First (Dashboard KPIs Only)

1. Complete Phase 1: Setup verification
2. Complete Phase 2: Schema changes + e-signature service
3. Complete Phase 3: US11 (Dashboard KPIs)
4. **STOP and VALIDATE**: Test dashboard loads <3s with all 8 KPIs
5. Deploy/demo audit dashboard

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US11 (Dashboard) → Test → Deploy (MVP - auditors can view KPIs)
3. Add US12 (Inventory) → Test → Deploy (complete material tracking)
4. Add US13 (Line Clearance) → Test → Deploy (production enforcement)
5. Add US14 (Labels) → Test → Deploy (label verification)
6. Add US15 (Disposition) → Test → Deploy (QC workflow complete)
7. Each story adds value without breaking previous stories

### Estimated Effort

| Phase | Tasks | Estimated Days |
|-------|-------|----------------|
| Setup | T001-T004 | 0.5 |
| Foundational | T005-T029 | 5 |
| US11 Dashboard | T030-T052 | 6 |
| US12 Inventory | T053-T066 | 5 |
| US13 Line Clearance | T067-T076 | 4 |
| US14 Labels | T077-T085 | 4 |
| US15 Disposition | T086-T095 | 4 |
| Polish | T096-T103 | 2 |
| **Total** | **103 tasks** | **~30.5 days** |

---

## Summary

- **Total Tasks**: 103
- **Phase 1 (Setup)**: 4 tasks
- **Phase 2 (Foundational)**: 25 tasks
- **Phase 3 (US11 Dashboard)**: 23 tasks
- **Phase 4 (US12 Inventory)**: 14 tasks
- **Phase 5 (US13 Line Clearance)**: 10 tasks
- **Phase 6 (US14 Labels)**: 9 tasks
- **Phase 7 (US15 Disposition)**: 10 tasks
- **Phase 8 (Polish)**: 8 tasks

### Independent Test Criteria by Story

- **US11**: Dashboard loads in <3s showing all 8 KPI values
- **US12**: Material receipt saves manufacturer, importer, retest date, COA attachment
- **US13**: Work order blocked until line clearance verified by two persons
- **US14**: Label images attached with dual e-signature (operator + witness)
- **US15**: Disposition approved with e-signature, lot status auto-updated

### Parallel Opportunities Identified

- 6 schema column additions can run in parallel (T005-T010)
- 6 MySQL schema mirrors can run in parallel (T011-T016)
- 8 dashboard helper functions can run in parallel (T031-T038)
- 8 dashboard card components can run in parallel (T042-T049)
- 6 lot form field updates can run in parallel (T056-T062)
- User stories US11-US15 can run in parallel after Phase 2

### MVP Scope

**User Story 11 only** provides immediate value for auditor visits:
- Dashboard with 8 real-time KPI cards
- RM status breakdown with pending reasons
- Expiry and min stock alerts
- QC pass/fail summary
- Production status overview

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- All file storage uses existing `attachments` table (database BLOB)
- Label images and lot documents use DocumentAttachment component with moduleName
- E-signatures require password re-authentication (21 CFR Part 11)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently

# Tasks: DevExpress Reports Integration

**Input**: Design documents from `/specs/005-devexpress-reports/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This feature uses a hybrid architecture:
- **Next.js Frontend**: `src/` at repository root
- **ASP.NET Core Backend**: `reporting-backend/` at repository root
- **Tests**: `tests/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency installation

- [X] T001 Install DevExpress Reporting npm packages (devexpress-reporting-react@25.1-stable, devexpress-reporting@25.1-stable, @devexpress/analytics-core@25.1-stable, ace-builds) in package.json
- [X] T002 Create ASP.NET Core reporting backend project using `dotnet new dx.aspnetcore.reporting.backend` in reporting-backend/
- [X] T003 [P] Add environment variable NEXT_PUBLIC_REPORTING_BACKEND_URL to .env.local and .env.example
- [X] T004 [P] Create TypeScript types for reports in src/types/reports.ts
- [X] T005 [P] Update docker-compose.yml to include reporting-backend service

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database Schema

- [X] T006 Create Drizzle ORM schema for report tables in src/lib/db/schema/reports.ts
- [X] T007 Run Drizzle migration to create report_categories, report_templates, report_permissions, report_executions tables
- [X] T008 Seed default report categories (Inventory, Production, Quality, Purchasing, Sales)

### ASP.NET Core Backend Setup

- [X] T009 Configure CORS policy for Next.js frontend in reporting-backend/Program.cs
- [X] T010 [P] Create EF Core DbContext for report tables in reporting-backend/Data/ReportDbContext.cs
- [X] T011 [P] Create EF Core entity models in reporting-backend/Data/Models/ (ReportTemplate.cs, ReportCategory.cs, ReportPermission.cs, ReportExecution.cs)
- [X] T012 Implement DatabaseReportStorage extending ReportStorageWebExtension in reporting-backend/Services/DatabaseReportStorage.cs
- [X] T013 Configure MySQL connection in reporting-backend/appsettings.json and appsettings.Development.json
- [X] T014 Register DatabaseReportStorage as scoped service in reporting-backend/Program.cs
- [X] T015 [P] Implement JWT validation service in reporting-backend/Services/JwtAuthenticationService.cs
- [X] T016 [P] Create Dockerfile for reporting-backend in reporting-backend/Dockerfile

### Next.js Report Data API Endpoints

- [X] T017 [P] Create inventory valuation data endpoint in src/app/api/reports/data/inventory-valuation/route.ts
- [X] T018 [P] Create lot status data endpoint in src/app/api/reports/data/lot-status/route.ts
- [X] T019 [P] Create production summary data endpoint in src/app/api/reports/data/production-summary/route.ts

**Checkpoint**: Foundation ready - both services can communicate, database has report tables, sample data endpoints available

---

## Phase 3: User Story 1 - View and Preview Reports (Priority: P1) 🎯 MVP

**Goal**: Business users can view and preview existing reports in a responsive viewer on any device

**Independent Test**: Load report viewer with a sample report, verify display, navigation, paging, zoom, and responsive layout across desktop/tablet/mobile

### Implementation for User Story 1

- [X] T020 [US1] Create ReportViewer wrapper component with DevExpress Document Viewer in src/components/reports/ReportViewer.tsx
- [X] T021 [US1] Create report viewer page with dynamic route in src/app/reports/view/[code]/page.tsx
- [X] T022 [US1] Add loading state component for report viewer in src/components/reports/ReportViewerSkeleton.tsx
- [X] T023 [US1] Configure DevExpress Document Viewer options (paging, zoom, search) in ReportViewer component
- [X] T024 [US1] Add responsive CSS styles for mobile/tablet viewports in ReportViewer component
- [X] T025 [US1] Create error boundary for report viewer errors in src/components/reports/ReportErrorBoundary.tsx
- [X] T026 [US1] Create a sample "Inventory Valuation" report template in reporting-backend for testing
- [X] T027 [US1] Verify report viewer works end-to-end: load sample report, test paging, zoom, search, mobile view

**Checkpoint**: User Story 1 complete - users can view reports in browser on any device with paging, zoom, and search

---

## Phase 4: User Story 2 - Export and Print Reports (Priority: P2)

**Goal**: Business users can export reports to PDF, Excel, Word and print them

**Independent Test**: Export a sample report to each format (PDF, Excel, Word), verify file downloads and content accuracy; test print functionality

### Implementation for User Story 2

- [X] T028 [US2] Enable PDF export in ReportViewer component with DevExpress built-in export
- [X] T029 [US2] Enable Excel (XLSX) export in ReportViewer component
- [X] T030 [US2] Enable Word (DOCX) export in ReportViewer component
- [X] T031 [US2] Configure print functionality in ReportViewer component
- [X] T032 [US2] Add export progress indicator for large reports in ReportViewer component
- [X] T033 [US2] Create audit logging for export/print actions - call logReportExecution in src/lib/services/reports.service.ts
- [ ] T034 [US2] Verify exports work end-to-end: export sample report to PDF/Excel/Word, verify file content and print dialog

**Checkpoint**: User Story 2 complete - users can export reports to PDF/Excel/Word and print them

---

## Phase 5: User Story 3 - Design New Report Templates (Priority: P3)

**Goal**: Report designers can create new report templates using visual designer without programming

**Independent Test**: Open designer, create report with data table and text, save template, verify it appears in template list and can be viewed

### Implementation for User Story 3

- [X] T035 [US3] Create ReportDesigner wrapper component with DevExpress Report Designer in src/components/reports/ReportDesigner.tsx
- [X] T036 [US3] Create report designer page with dynamic route in src/app/reports/design/[code]/page.tsx
- [X] T037 [US3] Configure designer toolbox with available components (text, table, chart, barcode, image) in ReportDesigner component
- [X] T038 [US3] Enable drag-and-drop component placement in ReportDesigner component
- [X] T039 [US3] Configure data source binding in designer - register JSON data sources for inventory/production/quality data
- [X] T040 [US3] Implement preview functionality in ReportDesigner component
- [X] T041 [US3] Implement save functionality - connect designer save to DatabaseReportStorage in .NET backend
- [X] T042 [US3] Create "New Report" page with template creation form in src/app/reports/new/page.tsx
- [X] T043 [US3] Create report templates API endpoint for POST (create) in src/app/api/reports/templates/route.ts
- [X] T044 [US3] Add loading state for designer initialization in ReportDesigner component
- [ ] T045 [US3] Verify designer works end-to-end: create new report, add components, bind data, save, view in viewer

**Checkpoint**: User Story 3 complete - designers can create reports visually and save templates

---

## Phase 6: User Story 4 - Edit Existing Report Templates (Priority: P4)

**Goal**: Report designers can modify existing report templates to update reports as requirements change

**Independent Test**: Open existing template in editor, modify it (add column), save, verify changes persist when reopened

### Implementation for User Story 4

- [X] T046 [US4] Load existing template in ReportDesigner component via reportUrl parameter
- [X] T047 [US4] Implement template update in DatabaseReportStorage - increment version on save
- [X] T048 [US4] Add cancel/revert functionality in ReportDesigner component
- [X] T049 [US4] Create report templates API endpoint for PUT (update) in src/app/api/reports/templates/[code]/route.ts
- [X] T050 [US4] Add unsaved changes warning when leaving designer with modifications
- [ ] T051 [US4] Verify editing works end-to-end: open existing template, modify, save, reopen and verify changes persist

**Checkpoint**: User Story 4 complete - designers can edit existing templates with version tracking

---

## Phase 7: User Story 5 - Manage Report Templates (Priority: P5)

**Goal**: Administrators can organize, categorize, and control access to report templates

**Independent Test**: Create category, assign report to it, set permissions, verify restricted user cannot access

### Implementation for User Story 5

- [X] T052 [US5] Create ReportList component with template listing in src/components/reports/ReportList.tsx
- [X] T053 [US5] Create ReportCategoryTree component for category navigation in src/components/reports/ReportCategoryTree.tsx
- [X] T054 [US5] Update reports dashboard page with category tree and template list in src/app/reports/page.tsx
- [X] T055 [US5] Create report templates API endpoint for GET (list with filtering) in src/app/api/reports/templates/route.ts
- [X] T056 [US5] Create report templates API endpoint for GET (single) in src/app/api/reports/templates/[code]/route.ts
- [X] T057 [US5] Create report templates API endpoint for DELETE in src/app/api/reports/templates/[code]/route.ts
- [X] T058 [US5] Create categories API endpoint (CRUD) in src/app/api/reports/categories/route.ts
- [X] T059 [US5] Create categories API endpoint for single category in src/app/api/reports/categories/[id]/route.ts
- [X] T060 [US5] Create publish/unpublish endpoints in src/app/api/reports/templates/[code]/publish/route.ts and unpublish/route.ts
- [X] T061 [US5] Create permissions API endpoint in src/app/api/reports/templates/[code]/permissions/route.ts
- [X] T062 [US5] Create permission management UI component in src/components/reports/ReportPermissions.tsx
- [X] T063 [US5] Implement role-based access filtering in template list API
- [X] T064 [US5] Add search and filter functionality in ReportList component
- [ ] T065 [US5] Verify management works end-to-end: create category, assign report, set permissions, test access control

**Checkpoint**: User Story 5 complete - admins can organize and control access to reports

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### Audit and Security

- [ ] T066 [P] Create executions API endpoint for audit trail in src/app/api/reports/executions/route.ts
- [ ] T067 [P] Add audit logging to all report viewer and export actions
- [ ] T068 Implement permission check middleware for all report API endpoints
- [ ] T069 Add JWT token forwarding from Next.js to .NET backend for authenticated data fetching

### Error Handling and UX

- [ ] T070 [P] Add comprehensive error messages for common failure scenarios
- [ ] T071 [P] Add toast notifications for save/export success/failure
- [ ] T072 Improve loading states with skeleton loaders

### Performance

- [ ] T073 Add report thumbnail generation for template listing
- [ ] T074 Implement caching for frequently accessed reports

### Documentation and Validation

- [ ] T075 [P] Run quickstart.md validation - verify all setup steps work
- [ ] T076 [P] Run type check and lint: pnpm tsc --noEmit && pnpm lint
- [ ] T077 [P] Run .NET build: dotnet build reporting-backend/

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational (CRITICAL - blocks all user stories)
    ↓
    ├─→ Phase 3: User Story 1 (P1) - View Reports ← MVP
    │       ↓
    ├─→ Phase 4: User Story 2 (P2) - Export/Print (depends on viewer from US1)
    │       ↓
    ├─→ Phase 5: User Story 3 (P3) - Design Reports
    │       ↓
    ├─→ Phase 6: User Story 4 (P4) - Edit Reports (depends on designer from US3)
    │       ↓
    └─→ Phase 7: User Story 5 (P5) - Manage Reports
            ↓
        Phase 8: Polish
```

### User Story Dependencies

| Story | Depends On | Can Start After |
|-------|------------|-----------------|
| US1: View Reports | Foundational | Phase 2 complete |
| US2: Export/Print | US1 (viewer component) | T027 complete |
| US3: Design Reports | Foundational | Phase 2 complete |
| US4: Edit Reports | US3 (designer component) | T045 complete |
| US5: Manage Reports | Foundational | Phase 2 complete |

### Within Each User Story

1. Components/services before pages
2. Backend endpoints before frontend integration
3. Core implementation before integration
4. End-to-end verification as final task

### Parallel Opportunities

**Phase 1 (all parallel):**
- T003, T004, T005 can run in parallel

**Phase 2 (mixed):**
- T010, T011 can run in parallel
- T015, T016 can run in parallel
- T017, T018, T019 can run in parallel

**Phase 8 (mostly parallel):**
- T066, T067, T070, T071, T075, T076, T077 can run in parallel

---

## Parallel Example: Phase 2 Foundational

```bash
# Launch database tasks first:
Task T006: "Create Drizzle ORM schema in src/lib/db/schema/reports.ts"
Task T007: "Run Drizzle migration"
Task T008: "Seed default categories"

# Then launch .NET setup in parallel:
Task T010: "Create EF Core DbContext in reporting-backend/Data/ReportDbContext.cs"
Task T011: "Create EF Core entity models in reporting-backend/Data/Models/"

# Then launch all data API endpoints in parallel:
Task T017: "Create inventory-valuation endpoint"
Task T018: "Create lot-status endpoint"
Task T019: "Create production-summary endpoint"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T019)
3. Complete Phase 3: User Story 1 (T020-T027)
4. **STOP and VALIDATE**: Test report viewing independently
5. Deploy/demo if ready - users can view reports!

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. Add US1 (View) → Test → Deploy (MVP!)
3. Add US2 (Export) → Test → Deploy
4. Add US3 (Design) → Test → Deploy
5. Add US4 (Edit) → Test → Deploy
6. Add US5 (Manage) → Test → Deploy
7. Each story adds value without breaking previous stories

### Suggested Ordering for Solo Developer

1. T001-T019 (Setup + Foundational)
2. T020-T027 (US1: View) ← Stop here for MVP
3. T028-T034 (US2: Export)
4. T035-T045 (US3: Design)
5. T046-T051 (US4: Edit)
6. T052-T065 (US5: Manage)
7. T066-T077 (Polish)

---

## Summary

| Phase | Tasks | Parallelizable |
|-------|-------|----------------|
| Setup | 5 | 3 |
| Foundational | 14 | 8 |
| US1: View Reports | 8 | 0 |
| US2: Export/Print | 7 | 0 |
| US3: Design Reports | 11 | 0 |
| US4: Edit Templates | 6 | 0 |
| US5: Manage Templates | 14 | 0 |
| Polish | 12 | 7 |
| **Total** | **77** | **18** |

**MVP Scope**: Phases 1-3 (27 tasks) → Users can view reports
**Full Feature**: All phases (77 tasks) → Complete reporting system

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable after completion
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Run error verification after code changes: `pnpm tsc --noEmit && pnpm lint`

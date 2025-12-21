# Tasks: HR/Personnel Management Module

**Input**: Design documents from `/specs/007-hr-personnel-management/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/hr-api.yaml

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and HR module structure

- [ ] T001 Create HR TypeScript types in src/types/hr.ts
- [ ] T002 [P] Create HR Zod validation schemas in src/lib/validations/hr.ts
- [ ] T003 [P] Create HR API route structure directories under src/app/api/hr/
- [ ] T004 [P] Create HR page structure directories under src/app/(app)/hr/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Add hr_org_units table schema (SQLite) in src/lib/db/schema.ts
- [ ] T006 Add hr_org_units table schema (MySQL) in src/lib/db/schema.ts
- [ ] T007 [P] Add hr_positions table schema (SQLite + MySQL) in src/lib/db/schema.ts
- [ ] T008 [P] Add hr_employees table schema (SQLite + MySQL) in src/lib/db/schema.ts
- [ ] T009 [P] Add hr_employee_assignments table schema (SQLite + MySQL) in src/lib/db/schema.ts
- [ ] T010 [P] Add hr_job_descriptions table schema (SQLite + MySQL) in src/lib/db/schema.ts
- [ ] T011 [P] Add hr_training_courses table schema (SQLite + MySQL) in src/lib/db/schema.ts
- [ ] T012 [P] Add hr_training_sessions table schema (SQLite + MySQL) in src/lib/db/schema.ts
- [ ] T013 [P] Add hr_training_records table schema (SQLite + MySQL) in src/lib/db/schema.ts
- [ ] T014 [P] Add hr_authorizations table schema (SQLite + MySQL) in src/lib/db/schema.ts
- [ ] T015 [P] Add hr_delegations table schema (SQLite + MySQL) in src/lib/db/schema.ts
- [ ] T016 [P] Add hr_health_records table schema (SQLite + MySQL) in src/lib/db/schema.ts
- [ ] T017 [P] Add hr_app_roles table schema (SQLite + MySQL) in src/lib/db/schema.ts
- [ ] T018 [P] Add hr_app_permissions table schema (SQLite + MySQL) in src/lib/db/schema.ts
- [ ] T019 [P] Add hr_role_permissions table schema (SQLite + MySQL) in src/lib/db/schema.ts
- [ ] T020 [P] Add hr_employee_roles table schema (SQLite + MySQL) in src/lib/db/schema.ts
- [ ] T021 [P] Add hr_notifications table schema (SQLite + MySQL) in src/lib/db/schema.ts
- [ ] T022 Create HR audit service with immutable logging in src/lib/services/hr-audit.service.ts
- [ ] T023 Run database schema sync and verify all 16 HR tables created

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Organization Structure (Priority: P1) 🎯 MVP

**Goal**: HR administrators can view, create, and maintain organizational hierarchy with GMP separation enforcement

**Independent Test**: Create org chart with company > site > division > department levels, verify hierarchy displays correctly and Production/QC separation is enforced

### Implementation for User Story 1

- [ ] T024 [US1] Implement OrgUnit CRUD service in src/lib/services/hr.service.ts
- [ ] T025 [US1] Add separation of duties validation (QC cannot be under Production) in src/lib/services/hr.service.ts
- [ ] T026 [US1] Add effective date range validation for org units in src/lib/services/hr.service.ts
- [ ] T027 [P] [US1] Create GET/POST /api/hr/org-units route in src/app/api/hr/org-units/route.ts
- [ ] T028 [P] [US1] Create GET/PATCH/DELETE /api/hr/org-units/[id] route in src/app/api/hr/org-units/[id]/route.ts
- [ ] T029 [P] [US1] Create GET /api/hr/org-units/[id]/children route in src/app/api/hr/org-units/[id]/children/route.ts
- [ ] T030 [US1] Create GET /api/hr/org-units/tree route for full hierarchy in src/app/api/hr/org-units/tree/route.ts
- [ ] T031 [P] [US1] Create OrgUnitPicker shared component in src/components/shared/OrgUnitPicker.tsx
- [ ] T032 [US1] Create OrgChartTree component with DevExtreme TreeList in src/components/hr/OrgChartTree.tsx
- [ ] T033 [US1] Create OrgChartDiagram component with DevExtreme Diagram in src/components/hr/OrgChartDiagram.tsx
- [ ] T034 [US1] Create org-chart page with tree editing and visual display in src/app/(app)/hr/org-chart/page.tsx
- [ ] T035 [US1] Add audit logging for org unit create/update/delete operations

**Checkpoint**: User Story 1 complete - org structure can be managed and visualized

---

## Phase 4: User Story 2 - Employee Profiles and Assignments (Priority: P1)

**Goal**: HR administrators can create employee profiles, assign to positions/departments, and track assignment history

**Independent Test**: Create employee record, assign to position, change department, verify assignment history is preserved

### Implementation for User Story 2

- [ ] T036 [US2] Implement Employee CRUD service in src/lib/services/hr.service.ts
- [ ] T037 [US2] Implement EmployeeAssignment tracking service in src/lib/services/hr.service.ts
- [ ] T038 [US2] Add automatic user deactivation when employee status changes to inactive in src/lib/services/hr.service.ts
- [ ] T039 [P] [US2] Create GET/POST /api/hr/employees route in src/app/api/hr/employees/route.ts
- [ ] T040 [P] [US2] Create GET/PATCH /api/hr/employees/[id] route in src/app/api/hr/employees/[id]/route.ts
- [ ] T041 [P] [US2] Create GET /api/hr/employees/[id]/assignments route in src/app/api/hr/employees/[id]/assignments/route.ts
- [ ] T042 [P] [US2] Create GET /api/hr/employees/search route in src/app/api/hr/employees/search/route.ts
- [ ] T043 [P] [US2] Create EmployeeLookup shared component in src/components/shared/EmployeeLookup.tsx
- [ ] T044 [P] [US2] Create EmployeeCard component in src/components/hr/EmployeeCard.tsx
- [ ] T045 [US2] Create employee directory page with search and filters in src/app/(app)/hr/employees/page.tsx
- [ ] T046 [US2] Create employee profile page with assignment history in src/app/(app)/hr/employees/[id]/page.tsx
- [ ] T047 [US2] Add audit logging for employee create/update/status change operations

**Checkpoint**: User Story 2 complete - employees can be managed with full assignment history

---

## Phase 5: User Story 3 - Position and Job Description Management (Priority: P2)

**Goal**: HR administrators can define positions with version-controlled job descriptions and GMP-critical designations

**Independent Test**: Create position with job description, update JD to new version, verify previous version is archived

### Implementation for User Story 3

- [ ] T048 [US3] Implement Position CRUD service in src/lib/services/hr.service.ts
- [ ] T049 [US3] Implement JobDescription version control service in src/lib/services/hr.service.ts
- [ ] T050 [US3] Add JD approval workflow (draft → pending → approved → obsolete) in src/lib/services/hr.service.ts
- [ ] T051 [P] [US3] Create GET/POST /api/hr/positions route in src/app/api/hr/positions/route.ts
- [ ] T052 [P] [US3] Create GET/PATCH /api/hr/positions/[id] route in src/app/api/hr/positions/[id]/route.ts
- [ ] T053 [P] [US3] Create PositionSelect shared component in src/components/shared/PositionSelect.tsx
- [ ] T054 [US3] Create positions management page with JD versioning in src/app/(app)/hr/positions/page.tsx
- [ ] T055 [US3] Add audit logging for position and JD operations

**Checkpoint**: User Story 3 complete - positions with versioned JDs can be managed

---

## Phase 6: User Story 4 - Training Catalog and Record Management (Priority: P2)

**Goal**: Training coordinators can manage courses, schedule sessions, record completions, and track certification validity

**Independent Test**: Create course, schedule session, enroll employee, record pass result, verify competency matrix shows valid certification

### Implementation for User Story 4

- [ ] T056 [US4] Implement TrainingCourse CRUD service in src/lib/services/training.service.ts
- [ ] T057 [US4] Implement TrainingSession scheduling service in src/lib/services/training.service.ts
- [ ] T058 [US4] Implement TrainingRecord completion service with expiry calculation in src/lib/services/training.service.ts
- [ ] T059 [US4] Implement competency matrix generation service in src/lib/services/training.service.ts
- [ ] T060 [US4] Add training expiration check logic (valid/expiring_soon/expired) in src/lib/services/training.service.ts
- [ ] T061 [P] [US4] Create GET/POST /api/hr/training/courses route in src/app/api/hr/training/courses/route.ts
- [ ] T062 [P] [US4] Create GET/POST /api/hr/training/sessions route in src/app/api/hr/training/sessions/route.ts
- [ ] T063 [P] [US4] Create GET/POST /api/hr/training/records route in src/app/api/hr/training/records/route.ts
- [ ] T064 [US4] Create GET /api/hr/training/competency-matrix route in src/app/api/hr/training/competency-matrix/route.ts
- [ ] T065 [P] [US4] Create TrainingMatrix component with DevExtreme DataGrid in src/components/hr/TrainingMatrix.tsx
- [ ] T066 [US4] Create training courses catalog page in src/app/(app)/hr/training/courses/page.tsx
- [ ] T067 [US4] Create training sessions management page in src/app/(app)/hr/training/sessions/page.tsx
- [ ] T068 [US4] Create competency matrix page with employee/course grid in src/app/(app)/hr/training/matrix/page.tsx
- [ ] T069 [US4] Add audit logging for training operations

**Checkpoint**: User Story 4 complete - full training lifecycle can be managed

---

## Phase 7: User Story 5 - Authorization and Delegation Management (Priority: P2)

**Goal**: Administrators can designate authorized persons for approval actions with scope limits and delegation support

**Independent Test**: Grant batch release auth to employee, create delegation, verify authorization check returns correct source (direct/delegation)

### Implementation for User Story 5

- [ ] T070 [US5] Implement Authorization CRUD service in src/lib/services/authorization.service.ts
- [ ] T071 [US5] Implement Delegation service with date-range validation in src/lib/services/authorization.service.ts
- [ ] T072 [US5] Implement authorization check with caching (<200ms requirement) in src/lib/services/authorization.service.ts
- [ ] T073 [US5] Add cache invalidation on authorization/delegation changes in src/lib/services/authorization.service.ts
- [ ] T074 [P] [US5] Create GET/POST /api/hr/authorizations route in src/app/api/hr/authorizations/route.ts
- [ ] T075 [P] [US5] Create GET/PATCH/DELETE /api/hr/authorizations/[id] route in src/app/api/hr/authorizations/[id]/route.ts
- [ ] T076 [P] [US5] Create GET/POST /api/hr/authorizations/delegations route in src/app/api/hr/authorizations/delegations/route.ts
- [ ] T077 [US5] Create GET /api/hr/authorizations/check route for external module validation in src/app/api/hr/authorizations/check/route.ts
- [ ] T078 [P] [US5] Create AuthorizationBadge component in src/components/hr/AuthorizationBadge.tsx
- [ ] T079 [US5] Create authorizations management page with delegation support in src/app/(app)/hr/authorizations/page.tsx
- [ ] T080 [US5] Add audit logging for authorization grant/revoke and delegation operations

**Checkpoint**: User Story 5 complete - authorization system with delegation fully functional

---

## Phase 8: User Story 6 - Personnel Health Records Management (Priority: P3)

**Goal**: Health staff can record health examinations with privacy protection for sensitive data

**Independent Test**: Record health exam as health_staff, set restricted status, verify non-health users only see fitness status

### Implementation for User Story 6

- [ ] T081 [US6] Implement HealthRecord service with privacy filtering in src/lib/services/hr.service.ts
- [ ] T082 [US6] Add role-based field filtering for medicalDetails and examinerNotes in src/lib/services/hr.service.ts
- [ ] T083 [P] [US6] Create GET/POST /api/hr/health-records route with role check in src/app/api/hr/health-records/route.ts
- [ ] T084 [P] [US6] Create HealthStatusIndicator component (Fit/Unfit/Restricted) in src/components/hr/HealthStatusIndicator.tsx
- [ ] T085 [US6] Add health status display to employee profile page in src/app/(app)/hr/employees/[id]/page.tsx
- [ ] T086 [US6] Add audit logging for health record operations

**Checkpoint**: User Story 6 complete - health records managed with privacy protection

---

## Phase 9: User Story 7 - Role and Permission Mapping (Priority: P3)

**Goal**: System administrators can map roles to permissions with separation of duties enforcement

**Independent Test**: Create role with permissions, assign to employee, verify access control works and Production/QC conflict is blocked

### Implementation for User Story 7

- [ ] T087 [US7] Implement AppRole and AppPermission CRUD service in src/lib/services/hr.service.ts
- [ ] T088 [US7] Implement RolePermission mapping service in src/lib/services/hr.service.ts
- [ ] T089 [US7] Implement EmployeeRole assignment service with scope in src/lib/services/hr.service.ts
- [ ] T090 [US7] Add separation of duties validation (Production vs QC conflicts) in src/lib/services/hr.service.ts
- [ ] T091 [P] [US7] Create GET/POST /api/hr/roles route in src/app/api/hr/roles/route.ts
- [ ] T092 [P] [US7] Create GET/PUT /api/hr/roles/[id]/permissions route in src/app/api/hr/roles/[id]/permissions/route.ts
- [ ] T093 [P] [US7] Create GET /api/hr/permissions route in src/app/api/hr/permissions/route.ts
- [ ] T094 [US7] Create roles and permissions management page in src/app/(app)/hr/roles/page.tsx
- [ ] T095 [US7] Add audit logging for role and permission operations

**Checkpoint**: User Story 7 complete - RBAC fully configured with separation of duties

---

## Phase 10: User Story 8 - Audit Trail and Access Review (Priority: P3)

**Goal**: Auditors can review all HR data changes with immutable, searchable audit log

**Independent Test**: Perform HR operations, search audit log by date/actor/entity, verify entries are immutable

### Implementation for User Story 8

- [ ] T096 [US8] Implement audit log search and filtering service in src/lib/services/hr-audit.service.ts
- [ ] T097 [US8] Add immutability protection (prevent update/delete) for audit entries in src/lib/services/hr-audit.service.ts
- [ ] T098 [US8] Create GET /api/hr/audit route with filters in src/app/api/hr/audit/route.ts
- [ ] T099 [US8] Create HR audit log viewer page with search/filter in src/app/(app)/hr/audit/page.tsx
- [ ] T100 [US8] Verify all previous user stories have audit logging enabled

**Checkpoint**: User Story 8 complete - full audit trail with search capability

---

## Phase 11: Notifications & Cron Jobs

**Purpose**: Training expiration and health check notifications

- [ ] T101 Implement notification creation service in src/lib/services/training.service.ts
- [ ] T102 Create GET /api/hr/training/notifications/check cron endpoint in src/app/api/hr/training/notifications/check/route.ts
- [ ] T103 Create GET /api/hr/health-records/notifications/check cron endpoint in src/app/api/hr/health-records/notifications/check/route.ts
- [ ] T104 Add notification display to employee profile and dashboard

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple user stories

- [ ] T105 [P] Add HR module navigation to main app sidebar
- [ ] T106 [P] Create HR module landing page with quick actions
- [ ] T107 Add pagination to all list endpoints and pages
- [ ] T108 Add loading states and error boundaries to all HR pages
- [ ] T109 Optimize authorization cache performance (verify <200ms p95)
- [ ] T110 [P] Add form validation error messages to all HR forms
- [ ] T111 Run quickstart.md validation to verify all endpoints work
- [ ] T112 Verify all 16 tables have correct indexes per data-model.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **US1 Org Structure (Phase 3)**: Depends on Foundational (P1 MVP)
- **US2 Employee Profiles (Phase 4)**: Depends on Foundational, can run parallel to US1
- **US3 Positions/JD (Phase 5)**: Depends on Foundational, can run parallel
- **US4 Training (Phase 6)**: Depends on Foundational + Employee service from US2
- **US5 Authorization (Phase 7)**: Depends on Foundational + Employee service from US2
- **US6 Health Records (Phase 8)**: Depends on Foundational + Employee service from US2
- **US7 Roles/Permissions (Phase 9)**: Depends on Foundational
- **US8 Audit Trail (Phase 10)**: Depends on HR audit service from Phase 2
- **Notifications (Phase 11)**: Depends on US4 Training + US6 Health Records
- **Polish (Phase 12)**: Depends on all user stories complete

### User Story Priority Order

| Priority | Story | Phase | Can Start After |
|----------|-------|-------|-----------------|
| P1 | US1 - Org Structure | 3 | Foundation (Phase 2) |
| P1 | US2 - Employee Profiles | 4 | Foundation (Phase 2) |
| P2 | US3 - Positions/JD | 5 | Foundation (Phase 2) |
| P2 | US4 - Training | 6 | US2 complete (employee lookup) |
| P2 | US5 - Authorization | 7 | US2 complete (employee lookup) |
| P3 | US6 - Health Records | 8 | US2 complete (employee lookup) |
| P3 | US7 - Roles/Permissions | 9 | Foundation (Phase 2) |
| P3 | US8 - Audit Trail | 10 | Foundation (Phase 2) |

### Parallel Opportunities Within Phases

**Phase 2 (Foundational)**: All schema tasks T005-T021 can run in parallel

**Phase 3 (US1)**: T027-T029, T031 can run in parallel (different files)

**Phase 4 (US2)**: T039-T044 can run in parallel (different files)

**Phase 5-10**: Each story has [P] marked tasks that can run in parallel

---

## Parallel Example: Phase 2 Foundational

```bash
# Launch all schema tasks in parallel:
Task: "Add hr_positions table schema (SQLite + MySQL) in src/lib/db/schema.ts"
Task: "Add hr_employees table schema (SQLite + MySQL) in src/lib/db/schema.ts"
Task: "Add hr_training_courses table schema (SQLite + MySQL) in src/lib/db/schema.ts"
# ... (all T007-T021 in parallel)
```

---

## Parallel Example: Phase 3 User Story 1

```bash
# After service implementation, launch route tasks in parallel:
Task: "[US1] Create GET/POST /api/hr/org-units route"
Task: "[US1] Create GET/PATCH/DELETE /api/hr/org-units/[id] route"
Task: "[US1] Create GET /api/hr/org-units/[id]/children route"
Task: "[US1] Create OrgUnitPicker shared component"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Org Structure)
4. Complete Phase 4: User Story 2 (Employee Profiles)
5. **STOP and VALIDATE**: Test org chart and employee management independently
6. Deploy/demo if ready - basic HR data entry functional

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (Org) + US2 (Employees) → MVP: Core HR data management
3. US3 (Positions/JD) → Add: Position definitions with JD versioning
4. US4 (Training) → Add: Full training lifecycle
5. US5 (Authorization) → Add: Approval control for other modules
6. US6-US8 → Complete: Health, RBAC, Audit

### Parallel Team Strategy

With 2-3 developers after Foundation complete:

- **Developer A**: US1 (Org) → US3 (Positions) → US7 (Roles)
- **Developer B**: US2 (Employees) → US4 (Training) → US8 (Audit)
- **Developer C**: US5 (Authorization) → US6 (Health) → Polish

---

## Summary

| Phase | User Story | Priority | Task Count |
|-------|------------|----------|------------|
| 1 | Setup | - | 4 |
| 2 | Foundational | - | 19 |
| 3 | US1 - Org Structure | P1 | 12 |
| 4 | US2 - Employee Profiles | P1 | 12 |
| 5 | US3 - Positions/JD | P2 | 8 |
| 6 | US4 - Training | P2 | 14 |
| 7 | US5 - Authorization | P2 | 11 |
| 8 | US6 - Health Records | P3 | 6 |
| 9 | US7 - Roles/Permissions | P3 | 9 |
| 10 | US8 - Audit Trail | P3 | 5 |
| 11 | Notifications | - | 4 |
| 12 | Polish | - | 8 |
| **Total** | | | **112** |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- All tasks include exact file paths from plan.md structure
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- MVP scope: US1 + US2 (23 implementation tasks + 23 foundational)

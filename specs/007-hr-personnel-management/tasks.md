# Tasks: HR Pages Responsive & Professional UI Redesign

**Input**: Design documents from `/specs/007-hr-personnel-management/`
**Prerequisites**: plan.md (responsive UI redesign), research.md (responsive patterns), data-model.md (UI components), contracts/

**Organization**: Tasks are grouped by UI user story to enable independent implementation and testing. This is a UI-only enhancement - no backend changes required.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which UI story this task belongs to (e.g., UI1, UI2, UI3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Components Infrastructure)

**Purpose**: Create reusable responsive components before modifying any pages

- [ ] T001 [P] Create StatCard component in src/components/shared/stat-card.tsx
- [ ] T002 [P] Create ResponsivePageHeader component in src/components/shared/responsive-page-header.tsx
- [ ] T003 [P] Create ResponsiveFormLayout components in src/components/shared/responsive-form-layout.tsx
- [ ] T004 [P] Create MobileListView component in src/components/shared/mobile-list-view.tsx
- [ ] T005 Update shared components index in src/components/shared/index.ts
- [ ] T006 [P] Add mobile CSS overrides in src/styles/dx.mobile-overrides.css

---

## Phase 2: UI Story 1 - HR Dashboard (Priority: P1) 🎯 MVP

**Goal**: Main HR dashboard is responsive with improved stat cards and mobile layout

**Independent Test**: View /hr on desktop (1920px), tablet (768px), and mobile (375px) - layout adapts correctly, stat cards are readable

### Implementation for UI Story 1

- [ ] T007 [UI1] Add ResponsivePageHeader to HR dashboard in src/app/hr/page.tsx
- [ ] T008 [UI1] Replace inline stat cards with StatCard component in src/app/hr/page.tsx
- [ ] T009 [UI1] Add responsive grid for module cards (1-col mobile, 2-col tablet, 3-col desktop) in src/app/hr/page.tsx
- [ ] T010 [UI1] Improve quick actions layout for mobile in src/app/hr/page.tsx
- [ ] T011 [UI1] Test dashboard on all breakpoints and fix any issues

**Checkpoint**: HR dashboard fully responsive

---

## Phase 3: UI Story 2 - Employee Directory (Priority: P1)

**Goal**: Employee list page with responsive DataGrid and mobile card view

**Independent Test**: View /hr/employees on mobile - columns hide appropriately, data is readable

### Implementation for UI Story 2

- [ ] T012 [UI2] Add ResponsivePageHeader to employees page in src/app/hr/employees/page.tsx
- [ ] T013 [UI2] Add columnHidingEnabled and hidingPriority to DataGrid columns in src/app/hr/employees/page.tsx
- [ ] T014 [UI2] Add stat cards for employee counts (total, active, new this month) in src/app/hr/employees/page.tsx
- [ ] T015 [UI2] Add responsive height calculation for DataGrid in src/app/hr/employees/page.tsx
- [ ] T016 [UI2] Add mobile-optimized search and filters in src/app/hr/employees/page.tsx
- [ ] T017 [UI2] Test employee list on all breakpoints

**Checkpoint**: Employee directory fully responsive

---

## Phase 4: UI Story 3 - New Employee Form (Priority: P1)

**Goal**: New employee form with responsive field layout

**Independent Test**: View /hr/employees/new on mobile - fields stack vertically, form is usable

### Implementation for UI Story 3

- [ ] T018 [UI3] Update header with ResponsivePageHeader in src/app/hr/employees/new/page.tsx
- [ ] T019 [UI3] Apply responsive grid layout to form fields (1-col mobile, 2-col desktop) in src/app/hr/employees/new/page.tsx
- [ ] T020 [UI3] Ensure form buttons stack on mobile in src/app/hr/employees/new/page.tsx
- [ ] T021 [UI3] Test new employee form on all breakpoints

**Checkpoint**: New employee form fully responsive

---

## Phase 5: UI Story 4 - Training Landing Page (Priority: P1)

**Goal**: Training module landing with responsive stats and navigation

**Independent Test**: View /hr/training on mobile - stats readable, navigation cards stack properly

### Implementation for UI Story 4

- [ ] T022 [UI4] Add ResponsivePageHeader to training page in src/app/hr/training/page.tsx
- [ ] T023 [UI4] Add StatCard components for training stats in src/app/hr/training/page.tsx
- [ ] T024 [UI4] Apply responsive grid to training module cards in src/app/hr/training/page.tsx
- [ ] T025 [UI4] Test training landing on all breakpoints

**Checkpoint**: Training landing fully responsive

---

## Phase 6: UI Story 5 - Position Management (Priority: P2)

**Goal**: Positions page with responsive grid and side panel

**Independent Test**: View /hr/positions on tablet - side panel collapses, grid adapts

### Implementation for UI Story 5

- [ ] T026 [UI5] Add ResponsivePageHeader to positions page in src/app/hr/positions/page.tsx
- [ ] T027 [UI5] Add columnHidingEnabled to positions DataGrid in src/app/hr/positions/page.tsx
- [ ] T028 [UI5] Make position detail side panel collapsible on mobile in src/app/hr/positions/page.tsx
- [ ] T029 [UI5] Test positions page on all breakpoints

**Checkpoint**: Positions page fully responsive

---

## Phase 7: UI Story 6 - Organization Structure (Priority: P2)

**Goal**: Org structure page with responsive TreeList

**Independent Test**: View /hr/org on mobile - TreeList scrolls horizontally, controls accessible

### Implementation for UI Story 6

- [ ] T030 [UI6] Add ResponsivePageHeader to org page in src/app/hr/org/page.tsx
- [ ] T031 [UI6] Add responsive width handling to TreeList in src/app/hr/org/page.tsx
- [ ] T032 [UI6] Make org unit detail panel collapsible on mobile in src/app/hr/org/page.tsx
- [ ] T033 [UI6] Test org structure on all breakpoints

**Checkpoint**: Org structure page fully responsive

---

## Phase 8: UI Story 7 - Training Courses (Priority: P2)

**Goal**: Training courses grid with responsive columns

**Independent Test**: View /hr/training/courses on mobile - essential columns visible

### Implementation for UI Story 7

- [ ] T034 [UI7] Add ResponsivePageHeader to courses page in src/app/hr/training/courses/page.tsx
- [ ] T035 [UI7] Add columnHidingEnabled to courses DataGrid in src/app/hr/training/courses/page.tsx
- [ ] T036 [UI7] Test courses page on all breakpoints

**Checkpoint**: Training courses fully responsive

---

## Phase 9: UI Story 8 - Training Sessions (Priority: P2)

**Goal**: Training sessions grid with responsive columns

**Independent Test**: View /hr/training/sessions on mobile - date/location visible

### Implementation for UI Story 8

- [ ] T037 [UI8] Add ResponsivePageHeader to sessions page in src/app/hr/training/sessions/page.tsx
- [ ] T038 [UI8] Add columnHidingEnabled to sessions DataGrid in src/app/hr/training/sessions/page.tsx
- [ ] T039 [UI8] Test sessions page on all breakpoints

**Checkpoint**: Training sessions fully responsive

---

## Phase 10: UI Story 9 - Specialized Pages (Priority: P3)

**Goal**: Remaining pages with basic responsive improvements

**Independent Test**: Each page usable on mobile without horizontal scrolling

### Org Chart Visualization

- [ ] T040 [P] [UI9] Add zoom/pan controls for mobile in src/app/hr/org-chart/page.tsx
- [ ] T041 [P] [UI9] Add horizontal scroll wrapper for diagram in src/app/hr/org-chart/page.tsx

### Competency Matrix

- [ ] T042 [P] [UI9] Add columnHidingEnabled to matrix DataGrid in src/app/hr/training/matrix/page.tsx
- [ ] T043 [P] [UI9] Add horizontal scroll for wide matrix in src/app/hr/training/matrix/page.tsx

### Authorizations Page

- [ ] T044 [P] [UI9] Add ResponsivePageHeader and columnHidingEnabled in src/app/hr/authorizations/page.tsx

### Health Records Page

- [ ] T045 [P] [UI9] Add ResponsivePageHeader and columnHidingEnabled in src/app/hr/health-records/page.tsx

### Roles Page

- [ ] T046 [P] [UI9] Add ResponsivePageHeader and columnHidingEnabled in src/app/hr/roles/page.tsx

### Notifications Page

- [ ] T047 [P] [UI9] Add ResponsivePageHeader and responsive list in src/app/hr/notifications/page.tsx

### Audit Log Page

- [ ] T048 [P] [UI9] Add ResponsivePageHeader and columnHidingEnabled in src/app/hr/audit/page.tsx

### Employee Detail Page

- [ ] T049 [P] [UI9] Add responsive tabs and form layout in src/app/hr/employees/[id]/page.tsx

**Checkpoint**: All 16 HR pages responsive

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements and testing

- [ ] T050 Run lint and fix any TypeScript errors: npm run lint
- [ ] T051 Test all 16 pages on desktop (1920px)
- [ ] T052 Test all 16 pages on tablet (768px)
- [ ] T053 Test all 16 pages on mobile (375px)
- [ ] T054 Fix any responsive issues found during testing
- [ ] T055 Verify DevExtreme adaptive columns work correctly
- [ ] T056 Commit all changes with descriptive message

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **UI Stories 1-4 (Phases 2-5)**: Depend on Setup - HIGH PRIORITY
- **UI Stories 5-8 (Phases 6-9)**: Depend on Setup - MEDIUM PRIORITY
- **UI Story 9 (Phase 10)**: Depends on Setup - LOW PRIORITY, all tasks parallel
- **Polish (Phase 11)**: Depends on all UI stories complete

### Parallel Opportunities

**Phase 1 (Setup)**: All component tasks T001-T004 can run in parallel

**Phase 10 (Specialized)**: All tasks T040-T049 can run in parallel (different pages)

**Across Phases**: After Setup, all UI story phases can run in parallel if team capacity allows

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all shared component tasks in parallel:
Task: "Create StatCard component in src/components/shared/stat-card.tsx"
Task: "Create ResponsivePageHeader component in src/components/shared/responsive-page-header.tsx"
Task: "Create ResponsiveFormLayout components in src/components/shared/responsive-form-layout.tsx"
Task: "Create MobileListView component in src/components/shared/mobile-list-view.tsx"
```

---

## Parallel Example: Phase 10 Specialized Pages

```bash
# Launch all P3 page tasks in parallel (different files):
Task: "[UI9] Add zoom/pan controls for mobile in src/app/hr/org-chart/page.tsx"
Task: "[UI9] Add columnHidingEnabled to matrix DataGrid in src/app/hr/training/matrix/page.tsx"
Task: "[UI9] Add ResponsivePageHeader and columnHidingEnabled in src/app/hr/authorizations/page.tsx"
# ... (all T040-T049 in parallel)
```

---

## Implementation Strategy

### MVP First (UI Stories 1-4 Only)

1. Complete Phase 1: Setup (shared components)
2. Complete Phase 2: UI Story 1 (HR Dashboard)
3. Complete Phase 3: UI Story 2 (Employee Directory)
4. Complete Phase 4: UI Story 3 (New Employee Form)
5. Complete Phase 5: UI Story 4 (Training Landing)
6. **STOP and VALIDATE**: Test 4 high-traffic pages on all devices
7. Deploy/demo if ready - core responsive experience complete

### Incremental Delivery

1. Setup → Shared components ready
2. UI1-4 (P1 pages) → MVP: High-traffic pages responsive
3. UI5-8 (P2 pages) → Core management pages responsive
4. UI9 (P3 pages) → All 16 pages responsive
5. Polish → Final testing and fixes

---

## Summary

| Phase | UI Story | Priority | Task Count | Pages Affected |
|-------|----------|----------|------------|----------------|
| 1 | Setup | - | 6 | - |
| 2 | UI1 - Dashboard | P1 | 5 | 1 |
| 3 | UI2 - Employees | P1 | 6 | 1 |
| 4 | UI3 - New Employee | P1 | 4 | 1 |
| 5 | UI4 - Training Landing | P1 | 4 | 1 |
| 6 | UI5 - Positions | P2 | 4 | 1 |
| 7 | UI6 - Org Structure | P2 | 4 | 1 |
| 8 | UI7 - Training Courses | P2 | 3 | 1 |
| 9 | UI8 - Training Sessions | P2 | 3 | 1 |
| 10 | UI9 - Specialized | P3 | 10 | 8 |
| 11 | Polish | - | 7 | All |
| **Total** | | | **56** | **16 pages** |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to UI improvement story
- Each UI story is independently testable on its target page
- All tasks include exact file paths from plan.md
- Test on 3 breakpoints: desktop (1920px), tablet (768px), mobile (375px)
- Commit after each phase or logical group of tasks
- MVP scope: UI1-UI4 (19 implementation tasks + 6 setup)

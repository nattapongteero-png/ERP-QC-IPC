# Tasks: DevExtreme UI Migration

**Input**: Design documents from `/specs/004-devextreme-migration/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, quickstart.md

**Tests**: Tests are included per constitution requirement (II. Testing Standards) - unit tests for primary paths.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Project Type**: Next.js App Router (single project)
- **Source**: `src/` at repository root
- **Tests**: `tests/` at repository root (existing Vitest setup)

---

## Phase 1: Setup (DevExtreme Foundation)

**Purpose**: Install DevExtreme and configure essential infrastructure before any component migration

- [ ] T001 Install DevExtreme dependencies: `npm install devextreme@25.1 devextreme-react@25.1 --save-exact` in package.json
- [ ] T002 Install DevExtreme ThemeBuilder: `npm install devextreme-themebuilder@25.1 --save-dev --save-exact` in package.json
- [ ] T003 [P] Create theme configuration file in devextreme-theme/emerald-metadata.json with emerald color scheme
- [ ] T004 [P] Create Thai locale dictionary file in src/localization/th.json with DevExtreme UI translations
- [ ] T005 Build emerald theme: run `npx devextreme build-theme` to generate public/css/dx.material.emerald.css
- [ ] T006 Create DevExtreme provider component in src/components/providers/devextreme-provider.tsx with Thai locale setup
- [ ] T007 Create Zod-DevExtreme validation adapter in src/lib/validation/zod-devextreme-adapter.ts
- [ ] T008 Update root layout to include DevExtremeProvider in src/app/layout.tsx
- [ ] T009 Add DevExtreme CSS import to src/app/globals.css (after existing styles)
- [ ] T010 Add build:theme script to package.json for theme regeneration
- [ ] T011 Run `pnpm tsc --noEmit && pnpm lint` to verify setup passes type check and lint

**Checkpoint**: DevExtreme is installed, themed, and provider is configured. Ready for component migration.

---

## Phase 2: Foundational Components (Shared Wrappers)

**Purpose**: Create reusable DevExtreme wrapper components that all user stories will use

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T012 [P] Create DxButton wrapper component in src/components/ui/dx-button.tsx with emerald styling
- [ ] T013 [P] Create DxTextBox wrapper component in src/components/ui/dx-text-box.tsx with Zod validation support
- [ ] T014 [P] Create DxSelectBox wrapper component in src/components/ui/dx-select-box.tsx with search filtering
- [ ] T015 [P] Create DxDateBox wrapper component in src/components/ui/dx-date-box.tsx with Thai locale
- [ ] T016 [P] Create DxDataGrid wrapper component in src/components/ui/dx-data-grid.tsx with sorting, filtering, export
- [ ] T017 [P] Create DxPopup wrapper component in src/components/ui/dx-popup.tsx for dialogs
- [ ] T018 [P] Create DxForm wrapper component in src/components/ui/dx-form.tsx with Zod validation integration
- [ ] T019 [P] Create DxLoadIndicator wrapper component in src/components/ui/dx-load-indicator.tsx for loading states
- [ ] T020 Create component index exports in src/components/ui/index.ts for all dx-* components
- [ ] T021 Run `pnpm tsc --noEmit && pnpm lint` to verify foundational components pass type check
- [ ] T022 Commit foundational components: `git add src/components/ui/dx-*.tsx && git commit`

**Checkpoint**: Foundation ready - all DevExtreme wrappers created. User story implementation can now begin.

---

## Phase 3: User Story 1 - Data Table Operations (Priority: P1) 🎯 MVP

**Goal**: Replace all table components with DevExtreme DataGrid for sorting, filtering, pagination, and export

**Independent Test**: Load items list page, verify sorting by column click, filtering by column filter row, pagination, and Excel export

### Tests for User Story 1

- [ ] T023 [P] [US1] Create DataGrid unit test in tests/unit/components/dx-data-grid.test.tsx for sorting behavior
- [ ] T024 [P] [US1] Create DataGrid unit test in tests/unit/components/dx-data-grid.test.tsx for filtering behavior
- [ ] T025 [P] [US1] Create DataGrid unit test in tests/unit/components/dx-data-grid.test.tsx for export functionality

### Implementation for User Story 1

- [ ] T026 [US1] Replace table component in src/components/ui/table.tsx with DxDataGrid import and deprecation notice
- [ ] T027 [US1] Update items list page in src/app/(dashboard)/items/page.tsx to use DxDataGrid with columns config
- [ ] T028 [US1] Update warehouses list page in src/app/(dashboard)/warehouses/page.tsx to use DxDataGrid
- [ ] T029 [US1] Update customers list page in src/app/(dashboard)/customers/page.tsx to use DxDataGrid
- [ ] T030 [US1] Update sales list page in src/app/(dashboard)/sales/page.tsx to use DxDataGrid
- [ ] T031 [US1] Configure virtual scrolling for DataGrids with large datasets in all list pages
- [ ] T032 [US1] Add Excel/CSV export buttons to all DataGrid toolbars
- [ ] T033 [US1] Update empty state display to use DevExtreme noDataText in DxDataGrid wrapper
- [ ] T034 [US1] Run `pnpm tsc --noEmit && pnpm lint` to verify US1 changes pass
- [ ] T035 [US1] Commit US1 changes: `git add . && git commit -m "feat(US1): migrate tables to DevExtreme DataGrid"`

**Checkpoint**: All data tables use DevExtreme DataGrid with sorting, filtering, export. MVP complete.

---

## Phase 4: User Story 2 - Form Input Components (Priority: P2)

**Goal**: Replace form inputs with DevExtreme TextBox, SelectBox, DateBox with Zod validation

**Independent Test**: Open item edit form, fill with invalid data, verify validation errors appear inline, submit valid form

### Tests for User Story 2

- [ ] T036 [P] [US2] Create TextBox unit test in tests/unit/components/dx-text-box.test.tsx for validation callback
- [ ] T037 [P] [US2] Create DateBox unit test in tests/unit/components/dx-date-box.test.tsx for Thai month display
- [ ] T038 [P] [US2] Create Form unit test in tests/unit/components/dx-form.test.tsx for Zod schema integration

### Implementation for User Story 2

- [ ] T039 [US2] Replace input component in src/components/ui/input.tsx with DxTextBox import and deprecation notice
- [ ] T040 [US2] Replace select component in src/components/ui/select.tsx with DxSelectBox import and deprecation notice
- [ ] T041 [US2] Replace date-picker component in src/components/ui/date-picker.tsx with DxDateBox import and deprecation notice
- [ ] T042 [US2] Update ItemEditForm in src/components/ui/item-edit-form.tsx to use DxForm with DevExtreme inputs
- [ ] T043 [US2] Update WarehouseEditForm in src/components/ui/warehouse-edit-form.tsx to use DxForm with DevExtreme inputs
- [ ] T044 [US2] Update form-field wrapper in src/components/ui/form-field.tsx to use DevExtreme validation display
- [ ] T045 [US2] Integrate existing Zod schemas with DevExtreme CustomRule validators in all forms
- [ ] T046 [US2] Add keyboard navigation support (Tab, Enter, Escape) to all form components
- [ ] T047 [US2] Run `pnpm tsc --noEmit && pnpm lint` to verify US2 changes pass
- [ ] T048 [US2] Commit US2 changes: `git add . && git commit -m "feat(US2): migrate form inputs to DevExtreme"`

**Checkpoint**: All form inputs use DevExtreme components with Zod validation. Forms are independently testable.

---

## Phase 5: User Story 3 - Search and Lookup Dialogs (Priority: P2)

**Goal**: Replace search dialogs with DevExtreme Popup containing DataGrid for fast filtering

**Independent Test**: Open item search dialog from sales order, type search term, verify instant filtering, select item with Enter key

### Tests for User Story 3

- [ ] T049 [P] [US3] Create Popup unit test in tests/unit/components/dx-popup.test.tsx for open/close behavior
- [ ] T050 [P] [US3] Create search dialog integration test in tests/integration/search-dialog.test.tsx for keyboard navigation

### Implementation for User Story 3

- [ ] T051 [US3] Replace dialog component in src/components/ui/dialog.tsx with DxPopup import and deprecation notice
- [ ] T052 [US3] Update ItemSearchDialog in src/components/ui/item-search-dialog.tsx to use DxPopup with DxDataGrid
- [ ] T053 [US3] Update CustomerSearchDialog in src/components/ui/customer-search-dialog.tsx to use DxPopup with DxDataGrid
- [ ] T054 [US3] Add instant search filtering with DevExtreme DataGrid filterValue in search dialogs
- [ ] T055 [US3] Implement keyboard navigation (arrow keys, Enter to select) in search dialog DataGrids
- [ ] T056 [US3] Add "no results" empty state message to search dialogs using DataGrid noDataText
- [ ] T057 [US3] Configure search dialog focus management (auto-focus search, return focus on close)
- [ ] T058 [US3] Run `pnpm tsc --noEmit && pnpm lint` to verify US3 changes pass
- [ ] T059 [US3] Commit US3 changes: `git add . && git commit -m "feat(US3): migrate search dialogs to DevExtreme"`

**Checkpoint**: All search dialogs use DevExtreme Popup with DataGrid filtering. Dialogs are independently testable.

---

## Phase 6: User Story 4 - Dashboard Cards and Statistics (Priority: P3)

**Goal**: Update dashboard components with DevExtreme-consistent styling and loading indicators

**Independent Test**: Load dashboard page, verify KPI cards display with trend indicators, skeleton loading appears during fetch

### Tests for User Story 4

- [ ] T060 [P] [US4] Create KPI card unit test in tests/unit/components/kpi-card.test.tsx for trend indicator display

### Implementation for User Story 4

- [ ] T061 [US4] Update Card component in src/components/ui/card.tsx to use DevExtreme CSS classes instead of Tailwind
- [ ] T062 [US4] Update KpiCard component in src/components/ui/kpi-card.tsx to use DevExtreme styling and DxLoadIndicator
- [ ] T063 [US4] Update StatCard component in src/components/ui/stat-card.tsx to use DevExtreme styling
- [ ] T064 [US4] Update Badge component in src/components/ui/badge.tsx to use DevExtreme CSS patterns
- [ ] T065 [US4] Update EmptyState component in src/components/ui/empty-state.tsx to use DevExtreme styling
- [ ] T066 [US4] Update Skeleton component in src/components/ui/skeleton.tsx to use DxLoadIndicator
- [ ] T067 [US4] Update dashboard page in src/app/(dashboard)/page.tsx to use updated card components
- [ ] T068 [US4] Run `pnpm tsc --noEmit && pnpm lint` to verify US4 changes pass
- [ ] T069 [US4] Commit US4 changes: `git add . && git commit -m "feat(US4): migrate dashboard cards to DevExtreme styling"`

**Checkpoint**: Dashboard displays with DevExtreme-consistent styling. Cards are independently testable.

---

## Phase 7: User Story 5 - Layout and Navigation (Priority: P3)

**Goal**: Replace layout components with DevExtreme Drawer, ResponsiveBox, and Toolbar

**Independent Test**: Navigate through all menu items, test responsive collapse on mobile, verify active state highlighting

### Tests for User Story 5

- [ ] T070 [P] [US5] Create Drawer unit test in tests/unit/components/sidebar.test.tsx for open/close behavior
- [ ] T071 [P] [US5] Create Toolbar unit test in tests/unit/components/page-header.test.tsx for responsive behavior

### Implementation for User Story 5

- [ ] T072 [US5] Create DxDrawer wrapper component in src/components/ui/dx-drawer.tsx for sidebar
- [ ] T073 [US5] Create DxToolbar wrapper component in src/components/ui/dx-toolbar.tsx for page headers
- [ ] T074 [US5] Create DxResponsiveBox wrapper component in src/components/ui/dx-responsive-box.tsx for layouts
- [ ] T075 [US5] Update Sidebar component in src/components/layout/sidebar.tsx to use DxDrawer
- [ ] T076 [US5] Update MainLayout component in src/components/layout/main-layout.tsx to use DxDrawer + DxResponsiveBox
- [ ] T077 [US5] Update PageHeader component in src/components/ui/page-header.tsx to use DxToolbar
- [ ] T078 [US5] Configure responsive breakpoints using DevExtreme screenByWidth function
- [ ] T079 [US5] Add tooltip support for collapsed sidebar icons using DevExtreme Tooltip
- [ ] T080 [US5] Replace all remaining Tailwind utility classes in layout components with DevExtreme CSS
- [ ] T081 [US5] Run `pnpm tsc --noEmit && pnpm lint` to verify US5 changes pass
- [ ] T082 [US5] Commit US5 changes: `git add . && git commit -m "feat(US5): migrate layout to DevExtreme Drawer/ResponsiveBox"`

**Checkpoint**: All layout components use DevExtreme. Navigation is independently testable.

---

## Phase 8: Supporting Components Migration

**Purpose**: Migrate remaining UI components that don't map to specific user stories

- [ ] T083 [P] Update DropdownMenu in src/components/ui/dropdown-menu.tsx to use DevExtreme DropDownButton
- [ ] T084 [P] Update Tabs in src/components/ui/tabs.tsx to use DevExtreme TabPanel
- [ ] T085 [P] Update Tooltip in src/components/ui/tooltip.tsx to use DevExtreme Tooltip
- [ ] T086 [P] Update Separator in src/components/ui/separator.tsx to use DevExtreme CSS
- [ ] T087 [P] Update ApiError in src/components/ui/api-error.tsx to use DevExtreme styling
- [ ] T088 [P] Update GlobalApiErrors in src/components/ui/global-api-errors.tsx to use DevExtreme Toast/Notification
- [ ] T089 Update component index in src/components/ui/index.ts with all migrated components
- [ ] T090 Run `pnpm tsc --noEmit && pnpm lint` to verify supporting components pass
- [ ] T091 Commit supporting components: `git add . && git commit -m "feat: migrate supporting UI components to DevExtreme"`

**Checkpoint**: All 30 UI components have been migrated to DevExtreme equivalents.

---

## Phase 9: Legacy Cleanup (Tailwind/Radix Removal)

**Purpose**: Remove all old UI libraries and their dependencies - FR-016, FR-017, FR-018

**⚠️ CRITICAL**: Only proceed after ALL user stories are complete and tested

- [ ] T092 Remove all Tailwind CSS class names from src/app/globals.css (keep only DevExtreme imports)
- [ ] T093 Remove all remaining `className` props with Tailwind utilities from all .tsx files in src/
- [ ] T094 Delete old component files that have been replaced: src/components/ui/button.tsx (old version)
- [ ] T095 Delete src/lib/utils.ts containing cn() function (no longer needed)
- [ ] T096 Uninstall Tailwind packages: `npm uninstall tailwindcss @tailwindcss/forms @tailwindcss/typography postcss autoprefixer`
- [ ] T097 Uninstall Radix packages: `npm uninstall @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tooltip @radix-ui/react-separator @radix-ui/react-slot`
- [ ] T098 Uninstall CVA and utility packages: `npm uninstall class-variance-authority clsx tailwind-merge`
- [ ] T099 Delete configuration files: tailwind.config.ts, postcss.config.js
- [ ] T100 Run verification: `grep -r "className=.*flex\|className=.*p-\|className=.*m-\|className=.*bg-" src/` should return empty
- [ ] T101 Run verification: `grep -r "@radix-ui" src/` should return empty
- [ ] T102 Run verification: `grep -r "tailwind-merge\|clsx\|cva(" src/` should return empty
- [ ] T103 Run `npm install` to update package-lock.json with removed dependencies
- [ ] T104 Run `pnpm tsc --noEmit && pnpm lint && pnpm build` to verify cleanup passes all checks
- [ ] T105 Commit cleanup: `git add . && git commit -m "chore: remove Tailwind/Radix/shadcn dependencies (FR-016/17/18)"`

**Checkpoint**: Zero Tailwind/Radix/shadcn code remains. SC-008, SC-009, SC-010 verified.

---

## Phase 10: Integration Testing & Polish

**Purpose**: Final verification across all user stories and performance validation

- [ ] T106 Run full E2E test suite: `pnpm test:e2e` for all user flows
- [ ] T107 Run Lighthouse performance audit on dashboard and items list pages
- [ ] T108 Run bundle size analysis: `ANALYZE=true pnpm build` and document size in specs/004-devextreme-migration/
- [ ] T109 Run accessibility audit with axe-core on all migrated pages
- [ ] T110 Test responsive behavior at mobile (320px), tablet (768px), desktop (1920px) breakpoints
- [ ] T111 Test Thai locale date formatting in all date picker components
- [ ] T112 Test keyboard navigation in all forms, dialogs, and data grids
- [ ] T113 Fix any issues identified during testing
- [ ] T114 Update CLAUDE.md with DevExtreme technology note (remove Tailwind/Radix mentions)
- [ ] T115 Run `.specify/scripts/bash/update-agent-context.sh claude` to update agent context
- [ ] T116 Final verification: all success criteria SC-001 through SC-010 pass
- [ ] T117 Commit final changes: `git add . && git commit -m "chore: complete DevExtreme migration verification"`

**Checkpoint**: Migration complete. All success criteria verified. Ready for PR/merge.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 - BLOCKS all user stories
- **Phases 3-7 (User Stories)**: All depend on Phase 2 completion
  - User stories CAN proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P2 → P3 → P3)
- **Phase 8 (Supporting)**: Can run in parallel with later user stories
- **Phase 9 (Cleanup)**: Depends on ALL user story phases (3-8) completion
- **Phase 10 (Polish)**: Depends on Phase 9 completion

### User Story Dependencies

| Story | Priority | Depends On | Can Parallel With |
|-------|----------|------------|-------------------|
| US1 (Data Tables) | P1 | Phase 2 only | US2, US3 (after Phase 2) |
| US2 (Form Inputs) | P2 | Phase 2 only | US1, US3 (after Phase 2) |
| US3 (Search Dialogs) | P2 | Phase 2 only | US1, US2 (after Phase 2) |
| US4 (Dashboard Cards) | P3 | Phase 2 only | US1-US3, US5 |
| US5 (Layout/Nav) | P3 | Phase 2 only | US1-US4 |

### Within Each User Story

1. Tests MUST be written and FAIL before implementation
2. Wrapper components before page updates
3. Core implementation before integration
4. Type check and lint after each story
5. Commit immediately after story completion

### Parallel Opportunities

**Phase 1**:
- T003, T004 can run in parallel (different files)

**Phase 2**:
- T012-T019 can ALL run in parallel (separate wrapper components)

**Per User Story**:
- All tests within a story can run in parallel
- Different user stories can be worked on in parallel by different developers

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "T023 - Create DataGrid unit test for sorting in tests/unit/components/dx-data-grid.test.tsx"
Task: "T024 - Create DataGrid unit test for filtering in tests/unit/components/dx-data-grid.test.tsx"
Task: "T025 - Create DataGrid unit test for export in tests/unit/components/dx-data-grid.test.tsx"

# After tests fail, launch page updates in parallel:
Task: "T027 - Update items list page to use DxDataGrid"
Task: "T028 - Update warehouses list page to use DxDataGrid"
Task: "T029 - Update customers list page to use DxDataGrid"
Task: "T030 - Update sales list page to use DxDataGrid"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T011)
2. Complete Phase 2: Foundational (T012-T022)
3. Complete Phase 3: User Story 1 - Data Tables (T023-T035)
4. **STOP and VALIDATE**: Test all data listing pages independently
5. Deploy/demo if ready - users can sort, filter, export data

### Incremental Delivery

1. Setup + Foundational → DevExtreme infrastructure ready
2. Add User Story 1 → Tables work → Deploy (MVP!)
3. Add User Story 2 → Forms work → Deploy
4. Add User Story 3 → Search dialogs work → Deploy
5. Add User Story 4 → Dashboard polished → Deploy
6. Add User Story 5 → Layout complete → Deploy
7. Cleanup + Polish → Legacy removed → Final release

### Parallel Team Strategy

With 3 developers after Phase 2:
- Developer A: User Story 1 (Data Tables) → User Story 4 (Dashboard)
- Developer B: User Story 2 (Forms) → Phase 8 (Supporting)
- Developer C: User Story 3 (Search Dialogs) → User Story 5 (Layout)
- All: Phase 9 (Cleanup) → Phase 10 (Polish)

---

## Task Summary

| Phase | Task Range | Count | Parallel Tasks |
|-------|-----------|-------|----------------|
| 1. Setup | T001-T011 | 11 | 2 |
| 2. Foundational | T012-T022 | 11 | 8 |
| 3. US1 Data Tables | T023-T035 | 13 | 3 (tests) + 4 (pages) |
| 4. US2 Forms | T036-T048 | 13 | 3 (tests) |
| 5. US3 Search Dialogs | T049-T059 | 11 | 2 (tests) |
| 6. US4 Dashboard | T060-T069 | 10 | 1 (test) |
| 7. US5 Layout | T070-T082 | 13 | 2 (tests) |
| 8. Supporting | T083-T091 | 9 | 6 |
| 9. Cleanup | T092-T105 | 14 | 0 (sequential) |
| 10. Polish | T106-T117 | 12 | 0 (sequential) |
| **TOTAL** | T001-T117 | **117** | **31** |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing (TDD approach)
- Commit after each task or logical group per constitution requirement
- Run `pnpm tsc --noEmit && pnpm lint` after every phase per constitution requirement
- Stop at any checkpoint to validate story independently

# Tasks: UI Redesign for Elegant and Professional Appearance

**Input**: Design documents from `/specs/002-ui-redesign/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Tests are NOT explicitly requested - implementation tasks only.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Path Conventions

- **Project Type**: Next.js App Router (single project)
- **Components**: `src/components/ui/`, `src/components/layout/`
- **Styles**: `src/app/globals.css`
- **Pages**: `src/app/[module]/`
- **Utilities**: `src/lib/utils/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, utility functions, and design token foundation

- [x] T001 Install clsx and tailwind-merge dependencies with `pnpm add clsx tailwind-merge`
- [x] T002 [P] Create cn utility function in src/lib/utils/cn.ts for class name merging
- [x] T003 [P] Add design tokens (colors, spacing, typography, shadows, radius) to src/app/globals.css using @theme directive
- [x] T004 [P] Add animation keyframes (fade-in, slide-in, scale-in, shimmer, pulse) to src/app/globals.css
- [x] T005 Run type check and lint to verify setup: `pnpm tsc --noEmit && pnpm lint`

---

## Phase 2: Foundational (Core Components)

**Purpose**: Core UI components that ALL user stories depend on - MUST complete before any user story work

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Enhance Button component with variants (primary, secondary, ghost, danger), sizes (sm, md, lg), loading state, and focus indicators in src/components/ui/button.tsx
- [x] T007 [P] Enhance Card component with elevation variants (flat, raised, elevated), padding options, and interactive state in src/components/ui/card.tsx
- [x] T008 [P] Enhance Badge component with variants (default, primary, secondary, success, warning, danger, info) and sizes in src/components/ui/badge.tsx
- [x] T009 [P] Create Skeleton component with variants (text, circular, rectangular) and animations (pulse, shimmer) in src/components/ui/skeleton.tsx
- [x] T010 [P] Create EmptyState component with icon, title, description, and action props in src/components/ui/empty-state.tsx
- [x] T011 Run type check and lint to verify foundational components: `pnpm tsc --noEmit && pnpm lint`
- [x] T012 Commit foundational phase: `git add . && git commit -m "feat(ui): add foundational design system components"`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Consistent Visual Experience Across Pages (Priority: P1) MVP

**Goal**: Establish unified visual design across all pages with consistent spacing, typography, and color scheme

**Independent Test**: Navigate through Dashboard, Inventory, Production, Quality, Purchasing, Sales, Reports, Settings and verify all pages share consistent header styles, button appearances, card designs, and layout structure

### Implementation for User Story 1

- [x] T013 [US1] Update MainLayout component with consistent spacing and transitions in src/components/layout/main-layout.tsx
- [x] T014 [P] [US1] Create page header component pattern with consistent typography hierarchy in src/components/ui/page-header.tsx
- [x] T015 [P] [US1] Update Dashboard page to use enhanced components and consistent spacing in src/app/dashboard/page.tsx
- [x] T016 [P] [US1] Update Inventory list page styling for consistency in src/app/inventory/items/page.tsx
- [x] T017 [P] [US1] Update Production module pages for consistency in src/app/production/work-orders/page.tsx
- [x] T018 [P] [US1] Update Quality module pages for consistency in src/app/quality/page.tsx
- [x] T019 [P] [US1] Update Purchasing module pages for consistency in src/app/purchasing/page.tsx
- [x] T020 [P] [US1] Update Sales module pages for consistency in src/app/sales/page.tsx
- [x] T021 [P] [US1] Update Reports page for consistency in src/app/reports/page.tsx
- [x] T022 [P] [US1] Update Settings page for consistency in src/app/settings/page.tsx
- [x] T023 [US1] Run type check and lint: `pnpm tsc --noEmit && pnpm lint`
- [x] T024 [US1] Commit User Story 1: `git add . && git commit -m "feat(ui): apply consistent visual design across all pages"`

**Checkpoint**: User Story 1 complete - all pages have unified visual design

---

## Phase 4: User Story 2 - Enhanced Dashboard with Professional Data Visualization (Priority: P2)

**Goal**: Present KPIs and statistics in an elegant, easy-to-read format with clear visual hierarchy

**Independent Test**: View dashboard with sample data and verify KPI cards have prominent numbers, subtle icons, trend indicators, and hover animations

### Implementation for User Story 2

- [x] T025 [P] [US2] Create KPICard component with visual hierarchy (prominent number, subtitle, icon, trend) in src/components/ui/kpi-card.tsx
- [x] T026 [P] [US2] Create StatCard component for secondary statistics display in src/components/ui/stat-card.tsx
- [x] T027 [US2] Update Dashboard page with enhanced KPI cards and hover effects in src/app/dashboard/page.tsx
- [x] T028 [US2] Add loading skeletons for dashboard KPI cards using CardSkeleton
- [x] T029 [US2] Run type check and lint: `pnpm tsc --noEmit && pnpm lint`
- [x] T030 [US2] Commit User Story 2: `git add . && git commit -m "feat(ui): enhance dashboard with professional KPI visualization"`

**Checkpoint**: User Story 2 complete - dashboard displays elegant data visualization

---

## Phase 5: User Story 3 - Improved Form and Input Experience (Priority: P3)

**Goal**: Provide visually refined input fields with clear focus states, validation feedback, and smooth transitions

**Independent Test**: Interact with any form (create item, work order, purchase order) and verify focus indicators, error states with icons, and success confirmation

### Implementation for User Story 3

- [x] T031 [US3] Enhance Input component with focus states, error/success styling, icons, and size variants in src/components/ui/input.tsx
- [x] T032 [P] [US3] Enhance Select component with matching focus states and error styling in src/components/ui/select.tsx
- [x] T033 [P] [US3] Create FormField wrapper component with label, helper text, and error display in src/components/ui/form-field.tsx
- [x] T034 [US3] Update inventory item creation form with enhanced inputs in src/app/inventory/items/new/page.tsx or relevant form
- [x] T035 [P] [US3] Update work order creation form with enhanced inputs in src/app/production/work-orders/new/page.tsx or relevant form
- [x] T036 [P] [US3] Update purchase order creation form with enhanced inputs in src/app/purchasing/orders/new/page.tsx or relevant form
- [x] T037 [US3] Run type check and lint: `pnpm tsc --noEmit && pnpm lint`
- [x] T038 [US3] Commit User Story 3: `git add . && git commit -m "feat(ui): improve form and input experience with focus states and validation"`

**Checkpoint**: User Story 3 complete - forms have refined input experience

---

## Phase 6: User Story 4 - Polished Table and List Views (Priority: P4)

**Goal**: Provide visually refined tables with proper alignment, readable typography, row differentiation, and hover states

**Independent Test**: View any list page (inventory items, purchase orders, sales orders) and verify alternating rows, hover highlights, and sort indicators

### Implementation for User Story 4

- [x] T039 [US4] Enhance Table component with striped rows, hover states, sort indicators, and loading skeleton in src/components/ui/table.tsx
- [x] T040 [P] [US4] Create TableSkeleton component for loading states in src/components/ui/table-skeleton.tsx
- [x] T041 [US4] Update inventory items list with enhanced table in src/app/inventory/items/page.tsx
- [x] T042 [P] [US4] Update inventory lots list with enhanced table in src/app/inventory/lots/page.tsx
- [x] T043 [P] [US4] Update purchase orders list with enhanced table in src/app/purchasing/orders/page.tsx
- [x] T044 [P] [US4] Update sales orders list with enhanced table in src/app/sales/orders/page.tsx
- [x] T045 [P] [US4] Update quality tests list with enhanced table in src/app/quality/tests/page.tsx
- [x] T046 [US4] Run type check and lint: `pnpm tsc --noEmit && pnpm lint`
- [x] T047 [US4] Commit User Story 4: `git add . && git commit -m "feat(ui): polish table and list views with row styling and hover states"`

**Checkpoint**: User Story 4 complete - tables have polished visual appearance

---

## Phase 7: User Story 5 - Enhanced Navigation and Sidebar (Priority: P5)

**Goal**: Provide modern, polished sidebar navigation with smooth transitions and clear active states

**Independent Test**: Click through sidebar menu items and verify active state highlights, smooth hover transitions, and collapse/expand animations

### Implementation for User Story 5

- [x] T048 [US5] Enhance Sidebar component with smooth transitions, hover effects, and improved active state styling in src/components/layout/sidebar.tsx
- [x] T049 [US5] Add smooth collapse/expand animation for sidebar sections
- [x] T050 [US5] Update mobile navigation header with consistent styling in src/components/layout/main-layout.tsx
- [x] T051 [US5] Add reduced motion support for sidebar animations (prefers-reduced-motion)
- [x] T052 [US5] Run type check and lint: `pnpm tsc --noEmit && pnpm lint`
- [x] T053 [US5] Commit User Story 5: `git add . && git commit -m "feat(ui): enhance sidebar navigation with transitions and active states"`

**Checkpoint**: User Story 5 complete - navigation feels modern and polished

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple user stories, responsive testing, and accessibility verification

- [ ] T054 [P] Verify responsive design at 375px, 768px, 1024px, 1920px viewports across all pages
- [ ] T055 [P] Verify all interactive elements have visible focus indicators (WCAG 2.1 AA)
- [ ] T056 [P] Verify color contrast ratios meet WCAG 2.1 AA standards (4.5:1 for text, 3:1 for large text)
- [ ] T057 Test reduced motion preference handling across all animated components
- [ ] T058 Review and fix any visual inconsistencies found during testing
- [ ] T059 Run final type check and lint: `pnpm tsc --noEmit && pnpm lint`
- [ ] T060 Final commit: `git add . && git commit -m "feat(ui): complete UI redesign with polish and accessibility verification"`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P4 → P5)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - establishes baseline for other stories
- **User Story 2 (P2)**: Can start after Foundational - uses components from US1 but independently testable
- **User Story 3 (P3)**: Can start after Foundational - Input/Select enhancements are independent
- **User Story 4 (P4)**: Can start after Foundational - Table enhancements are independent
- **User Story 5 (P5)**: Can start after Foundational - Sidebar enhancements are independent

### Within Each User Story

- Component enhancements before page updates
- Core implementation before integration
- Type check and lint before commit
- Commit after each story completes

### Parallel Opportunities

**Phase 1 (Setup):**
- T002, T003, T004 can run in parallel (different files)

**Phase 2 (Foundational):**
- T007, T008, T009, T010 can run in parallel (different component files)

**Phase 3 (US1):**
- T014-T022 can run in parallel after T013 (different page files)

**Phase 4-7 (US2-US5):**
- User stories themselves can run in parallel if team capacity allows
- Within each story, tasks marked [P] can run in parallel

**Phase 8 (Polish):**
- T054, T055, T056 can run in parallel (different verification types)

---

## Parallel Example: User Story 1

```bash
# After T013 (MainLayout) completes, launch all page updates in parallel:
Task: "Update Dashboard page styling in src/app/dashboard/page.tsx"
Task: "Update Inventory list page styling in src/app/inventory/items/page.tsx"
Task: "Update Production module pages in src/app/production/page.tsx"
Task: "Update Quality module pages in src/app/quality/page.tsx"
Task: "Update Purchasing module pages in src/app/purchasing/page.tsx"
Task: "Update Sales module pages in src/app/sales/page.tsx"
Task: "Update Reports page in src/app/reports/page.tsx"
Task: "Update Settings page in src/app/settings/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T012) - CRITICAL
3. Complete Phase 3: User Story 1 (T013-T024)
4. **STOP and VALIDATE**: Navigate all pages, verify consistent design
5. Deploy/demo if ready - MVP delivers value

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy (MVP!)
3. Add User Story 2 → Test dashboard → Deploy
4. Add User Story 3 → Test forms → Deploy
5. Add User Story 4 → Test tables → Deploy
6. Add User Story 5 → Test navigation → Deploy
7. Complete Polish → Final release

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (consistent pages)
   - Developer B: User Story 2 (dashboard)
   - Developer C: User Story 3 (forms)
3. After initial stories:
   - Developer A: User Story 4 (tables)
   - Developer B: User Story 5 (navigation)
   - Developer C: Polish phase

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Constitution requires: commit after each task, run lint/type check before commit
- Stop at any checkpoint to validate story independently
- All components must respect prefers-reduced-motion for accessibility

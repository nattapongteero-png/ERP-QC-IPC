# Tasks: shadcn/ui Migration and Professional UI Enhancement

**Input**: Design documents from `/specs/003-shadcn-migration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/components.md

**Tests**: No tests explicitly requested in specification. Focus on manual verification and type checking.

**Current Status**: Migration paused after Phase 2 (Foundational) and partial Phase 3 (Core Component Migration). Page updates (T033+) not yet started.
**Last Updated**: 2025-12-19

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Exact file paths included in descriptions

## Path Conventions

- **Project type**: Single Next.js web application
- **Components**: `src/components/ui/`, `src/components/layout/`
- **Pages**: `src/app/`
- **Utilities**: `src/lib/utils/`
- **Config**: Root-level config files

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize shadcn/ui and configure project foundation

- [x] T001 Initialize shadcn/ui CLI with `npx shadcn@canary init` in project root
- [x] T002 Configure components.json for shadcn/ui with paths `@/components` and `@/lib/utils`
- [x] T003 [P] Add shadcn/ui CSS variables to src/app/globals.css (--primary, --secondary, --destructive, etc.)
- [x] T004 [P] Verify cn utility exists and matches shadcn pattern in src/lib/utils/cn.ts
- [x] T005 Run `pnpm tsc --noEmit && pnpm lint` to verify setup has no errors
- [x] T006 Commit: "chore: initialize shadcn/ui configuration"

---

## Phase 2: Foundational (Theme & Core Dependencies)

**Purpose**: Establish theme tokens and install core shadcn/ui components that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Map emerald/teal palette to shadcn CSS variables in src/app/globals.css (--primary: emerald-600, --destructive: red-500)
- [x] T008 [P] Migrate Button component with CVA patterns in src/components/ui/button.tsx
- [x] T009 [P] Migrate Card component with CVA patterns in src/components/ui/card.tsx
- [x] T010 [P] Migrate Input component with CVA patterns in src/components/ui/input.tsx
- [x] T011 [P] Migrate Badge component with CVA patterns in src/components/ui/badge.tsx
- [x] T012 [P] Migrate Table component with shadcn primitives in src/components/ui/table.tsx
- [x] T013 [P] Migrate Select component with CVA patterns in src/components/ui/select.tsx
- [x] T014 [P] Migrate Skeleton component with CVA patterns in src/components/ui/skeleton.tsx
- [x] T015 [P] Add Separator component with @radix-ui/react-separator
- [x] T016 Run `pnpm tsc --noEmit && pnpm lint` to verify all components migrated correctly
- [x] T017 Commit: "feat(ui): migrate core components to shadcn/ui CVA patterns"

**Checkpoint**: Foundation ready - user story implementation can now begin ✅

---

## Phase 3: User Story 1 - Consistent Component Experience (Priority: P1) 🎯 MVP

**Goal**: Replace all custom UI components with shadcn/ui equivalents for consistent design language

**Independent Test**: Navigate through application verifying all buttons, inputs, selects, tables have consistent styling, spacing, and behavior

### Core Component Migration ✅ COMPLETED

- [x] T018 [P] [US1] Add loading prop and leftIcon/rightIcon support to shadcn Button in src/components/ui/button.tsx
- [x] T019 [P] [US1] Add custom variants (success, warning, info) to shadcn Badge in src/components/ui/badge.tsx
- [x] T020 [P] [US1] Add dot prop support to Badge for status indicators in src/components/ui/badge.tsx
- [x] T021 [US1] Verify Button API compatibility with existing usage patterns (variant mapping: primary→default, danger→destructive)
- [x] T022 Run `pnpm tsc --noEmit && pnpm lint` to verify Button and Badge customizations
- [x] T023 Commit: "feat(ui): customize shadcn Button and Badge components"

### Form Component Migration ✅ COMPLETED

- [x] T024 [P] [US1] Form components maintained with existing API in src/components/ui/form-field.tsx
- [x] T025 [P] [US1] Migrate Select wrapper with CVA patterns (options array, onChange callback) in src/components/ui/select.tsx
- [x] T026 [US1] Verify Input component styling matches emerald focus states in src/components/ui/input.tsx
- [x] T027 Run `pnpm tsc --noEmit && pnpm lint` to verify form components
- [x] T028 Commit: "feat(ui): migrate form components to shadcn patterns"

### Table Component Migration ✅ COMPLETED

- [x] T029 [US1] Update Table component to use shadcn Table primitives (TableHeader, TableBody, TableRow, TableHead, TableCell) in src/components/ui/table.tsx
- [x] T030 [US1] Add hover states and row styling consistent with shadcn patterns in src/components/ui/table.tsx
- [x] T031 Run `pnpm tsc --noEmit && pnpm lint` to verify Table migration
- [x] T032 Commit: "feat(ui): migrate Table component to shadcn"

### Regression Verification (FR-002 Coverage)

- [x] T032A [US1] Create component API compatibility checklist documenting all existing component props/usage
- [x] T032B [US1] Verify Button usage in 3 sample pages still works after migration
- [x] T032C [US1] Verify Form components in 1 sample create/edit page still submit correctly
- [x] T032D [US1] Verify Table components in 1 sample list page still sort/filter correctly

### Page Updates - Inventory Module

- [x] T033 [P] [US1] Update Dashboard page to use migrated components in src/app/dashboard/page.tsx
- [x] T034 [P] [US1] Update Inventory Items page to use migrated components in src/app/inventory/items/page.tsx
- [x] T035 [P] [US1] Update Inventory Items detail page in src/app/inventory/items/[id]/page.tsx
- [x] T036 [P] [US1] Update Inventory Lots page in src/app/inventory/lots/page.tsx
- [x] T037 [P] [US1] Update Inventory Lots detail page in src/app/inventory/lots/[id]/page.tsx
- [x] T038 [P] [US1] Update Inventory Warehouses page in src/app/inventory/warehouses/page.tsx
- [x] T039 [P] [US1] Update Inventory Warehouses detail page in src/app/inventory/warehouses/[id]/page.tsx
- [x] T040 [P] [US1] Update Inventory Transactions page in src/app/inventory/transactions/page.tsx
- [x] T041 [P] [US1] Update Inventory Expiry Alerts page in src/app/inventory/expiry-alerts/page.tsx
- [x] T042 Run `pnpm tsc --noEmit && pnpm lint` to verify inventory pages
- [x] T043 Commit: "feat(ui): update inventory pages to use shadcn components"

### Page Updates - Production & Quality Modules

- [x] T044 [P] [US1] Update Production page in src/app/production/page.tsx
- [x] T045 [P] [US1] Update Production Work Orders page in src/app/production/work-orders/page.tsx
- [x] T046 [P] [US1] Update Production Work Orders detail page in src/app/production/work-orders/[id]/page.tsx
- [x] T047 [P] [US1] Update Quality page in src/app/quality/page.tsx
- [x] T048 [P] [US1] Update Quality Tests detail page in src/app/quality/tests/[id]/page.tsx
- [x] T049 [P] [US1] Update Quality Deviations detail page in src/app/quality/deviations/[id]/page.tsx
- [x] T050 Run `pnpm tsc --noEmit && pnpm lint` to verify production/quality pages
- [x] T051 Commit: "feat(ui): update production and quality pages to use shadcn components"

### Page Updates - Purchasing & Sales Modules

- [x] T052 [P] [US1] Update Purchasing page in src/app/purchasing/page.tsx
- [x] T053 [P] [US1] Update Purchasing Orders detail page in src/app/purchasing/orders/[id]/page.tsx
- [x] T054 [P] [US1] Update Sales page in src/app/sales/page.tsx
- [x] T055 [P] [US1] Update Sales Orders detail page in src/app/sales/orders/[id]/page.tsx
- [x] T056 Run `pnpm tsc --noEmit && pnpm lint` to verify purchasing/sales pages
- [x] T057 Commit: "feat(ui): update purchasing and sales pages to use shadcn components"

### Page Updates - Remaining Pages

- [x] T058 [P] [US1] Update Reports page in src/app/reports/page.tsx
- [x] T059 [P] [US1] Update Users page in src/app/users/page.tsx
- [x] T060 [P] [US1] Update Settings page in src/app/settings/page.tsx
- [x] T061 [P] [US1] Update Login page in src/app/login/page.tsx
- [x] T062 Run `pnpm tsc --noEmit && pnpm lint` to verify remaining pages
- [x] T063 Commit: "feat(ui): update remaining pages to use shadcn components"

### Page Updates - Additional Pages (Discovered in Analysis)

- [x] T129 [P] [US1] Update root page in src/app/page.tsx
- [x] T130 [P] [US1] Update Inventory landing page in src/app/inventory/page.tsx
- [x] T131 [P] [US1] Update Production Batch Records page in src/app/production/batch-records/page.tsx
- [x] T132 [P] [US1] Update Production Batch Records detail in src/app/production/batch-records/[id]/page.tsx
- [x] T133 [P] [US1] Update Production BOM page in src/app/production/bom/page.tsx
- [x] T134 [P] [US1] Update Production BOM detail in src/app/production/bom/[id]/page.tsx
- [x] T135 [P] [US1] Update Production BOM new in src/app/production/bom/new/page.tsx
- [x] T136 [P] [US1] Update Production Work Orders new in src/app/production/work-orders/new/page.tsx
- [x] T137 [P] [US1] Update Quality Tests page in src/app/quality/tests/page.tsx
- [x] T138 [P] [US1] Update Quality Tests new in src/app/quality/tests/new/page.tsx
- [x] T139 [P] [US1] Update Quality Deviations page in src/app/quality/deviations/page.tsx
- [x] T140 [P] [US1] Update Quality Deviations new in src/app/quality/deviations/new/page.tsx
- [x] T141 [P] [US1] Update Quality Specs page in src/app/quality/specs/page.tsx
- [x] T142 [P] [US1] Update Quality Specs detail in src/app/quality/specs/[id]/page.tsx
- [x] T143 [P] [US1] Update Quality Specs new in src/app/quality/specs/new/page.tsx
- [x] T144 [P] [US1] Update Purchasing Orders new in src/app/purchasing/orders/new/page.tsx
- [x] T145 [P] [US1] Update Purchasing Vendors page in src/app/purchasing/vendors/page.tsx
- [x] T146 [P] [US1] Update Purchasing Vendors detail in src/app/purchasing/vendors/[id]/page.tsx
- [x] T147 [P] [US1] Update Purchasing Vendors new in src/app/purchasing/vendors/new/page.tsx
- [x] T148 [P] [US1] Update Sales Orders new in src/app/sales/orders/new/page.tsx
- [x] T149 Run `pnpm tsc --noEmit && pnpm lint` to verify additional pages
- [x] T150 Commit: "feat(ui): update remaining discovered pages to shadcn"

**Checkpoint**: User Story 1 complete - all core components migrated and pages updated

---

## Phase 4: User Story 2 - Professional Visual Hierarchy (Priority: P1)

**Goal**: Enhance visual hierarchy through custom component updates and layout refinements

**Independent Test**: Review each page type (dashboard, list views, detail views) verifying clear distinction between headings, content, actions

### Custom Component Updates

- [x] T064 [P] [US2] Refactor KPICard to use shadcn Card as base with proper visual hierarchy in src/components/ui/kpi-card.tsx
- [x] T065 [P] [US2] Refactor StatCard to use shadcn Card as base with consistent styling in src/components/ui/stat-card.tsx
- [x] T066 [P] [US2] Enhance EmptyState with shadcn typography and spacing tokens in src/components/ui/empty-state.tsx
- [x] T067 [P] [US2] Enhance PageHeader with proper heading hierarchy and action alignment in src/components/ui/page-header.tsx
- [x] T068 Run `pnpm tsc --noEmit && pnpm lint` to verify custom component updates
- [x] T069 Commit: "feat(ui): refactor custom components to use shadcn patterns"

### Layout Component Updates

- [x] T070 [US2] Update Sidebar with shadcn styling patterns (consistent spacing, hover states) in src/components/layout/sidebar.tsx
- [x] T071 [US2] Update MainLayout with proper content hierarchy and spacing in src/components/layout/main-layout.tsx
- [x] T072 Run `pnpm tsc --noEmit && pnpm lint` to verify layout updates
- [x] T073 Commit: "feat(ui): update layout components with shadcn patterns"

### Visual Hierarchy Verification

- [x] T074 [US2] Verify Dashboard page visual hierarchy (KPI prominence, section grouping) in src/app/dashboard/page.tsx
- [x] T075 [US2] Verify list page visual hierarchy (table headers, row distinction, action buttons) across all list pages
- [x] T076 Run `pnpm tsc --noEmit && pnpm lint` to verify all changes
- [x] T077 Commit: "feat(ui): verify and refine visual hierarchy across pages"

**Checkpoint**: User Story 2 complete - visual hierarchy improved throughout application ✅

---

## Phase 5: User Story 3 - Accessible and Responsive Interface (Priority: P2)

**Goal**: Ensure accessibility (WCAG 2.1 AA) and responsive behavior across all viewports

**Independent Test**: Navigate using keyboard only, test with screen reader, verify layout on mobile/tablet/desktop

### Accessibility Enhancements

- [x] T078 [P] [US3] Verify all Button components have proper focus-visible states in src/components/ui/button.tsx
- [x] T079 [P] [US3] Verify all form inputs have associated labels and aria-attributes in src/components/ui/input.tsx
- [x] T080 [P] [US3] Verify Select component keyboard navigation and screen reader support in src/components/ui/select.tsx
- [x] T081 [P] [US3] Verify Table component has proper scope attributes and aria-labels in src/components/ui/table.tsx
- [x] T082 [US3] Add skip-to-content link for keyboard navigation in src/components/layout/main-layout.tsx
- [x] T083 Run `pnpm tsc --noEmit && pnpm lint` to verify accessibility updates
- [x] T084 Commit: "feat(a11y): enhance component accessibility for WCAG 2.1 AA"

### Responsive Behavior

- [x] T085 [P] [US3] Install shadcn Sheet component for mobile sidebar: `npx shadcn@canary add sheet`
- [x] T086 [US3] Implement mobile sidebar drawer using Sheet in src/components/layout/sidebar.tsx
- [x] T087 [US3] Verify responsive breakpoints work correctly (320px, 768px, 1024px, 1920px) in src/components/layout/main-layout.tsx
- [x] T088 [US3] Verify Table components scroll horizontally on mobile viewports
- [x] T089 Run `pnpm tsc --noEmit && pnpm lint` to verify responsive updates
- [x] T090 Commit: "feat(ui): improve responsive behavior with mobile sidebar"

**Checkpoint**: User Story 3 complete - application accessible and responsive ✅

---

## Phase 6: User Story 4 - Polished Interaction Feedback (Priority: P2)

**Goal**: Add loading states, transitions, and micro-interactions for professional feel

**Independent Test**: Perform actions (button clicks, form submissions, navigation) verifying appropriate feedback

### Feedback Components

- [ ] T091 [P] [US4] Install shadcn Dialog component: `npx shadcn@canary add dialog`
- [ ] T092 [P] [US4] Install shadcn DropdownMenu component: `npx shadcn@canary add dropdown-menu`
- [ ] T093 [P] [US4] Install shadcn Tooltip component: `npx shadcn@canary add tooltip`
- [ ] T094 [P] [US4] Install shadcn Sonner (toast) component: `npx shadcn@canary add sonner`
- [ ] T095 Run `pnpm tsc --noEmit && pnpm lint` to verify new components installed
- [ ] T096 Commit: "chore: install interaction feedback components"

### Loading State Enhancements

- [ ] T097 [US4] Verify Button loading state shows spinner and prevents double-click in src/components/ui/button.tsx
- [ ] T098 [US4] Verify Skeleton components used correctly for loading states in src/components/ui/skeleton.tsx
- [ ] T099 [US4] Update KPICardSkeleton and StatCardSkeleton to use shadcn Skeleton in src/components/ui/kpi-card.tsx
- [ ] T100 Run `pnpm tsc --noEmit && pnpm lint` to verify loading states
- [ ] T101 Commit: "feat(ui): enhance loading states with shadcn patterns"

### Micro-Interactions

- [ ] T102 [US4] Add hover transitions to all interactive cards (KPICard, StatCard, Card) in relevant component files
- [ ] T103 [US4] Verify dropdown menus animate smoothly using DropdownMenu component
- [ ] T104 [US4] Add Tooltip to icon-only buttons for clarity across application
- [ ] T105 Run `pnpm tsc --noEmit && pnpm lint` to verify micro-interactions
- [ ] T106 Commit: "feat(ui): add micro-interactions for polished feel"

**Checkpoint**: User Story 4 complete - interactions feel responsive and polished

---

## Phase 7: User Story 5 - Maintainable Theme System (Priority: P3)

**Goal**: Consolidate theme tokens for easy future brand updates

**Independent Test**: Modify primary color in theme config and verify all primary-colored elements update

### Theme Token Consolidation

- [ ] T107 [US5] Document all CSS variables in src/app/globals.css with comments explaining each token
- [ ] T108 [US5] Ensure all emerald color references use CSS variables (no hardcoded oklch values in components)
- [ ] T109 [US5] Create theme documentation in specs/003-shadcn-migration/theme-guide.md
- [ ] T110 Run `pnpm tsc --noEmit && pnpm lint` to verify theme consistency
- [ ] T111 Commit: "docs: document theme system and consolidate tokens"

### Variant System

- [ ] T112 [US5] Verify Button variants use CSS variables consistently in src/components/ui/button.tsx
- [ ] T113 [US5] Verify Badge variants use CSS variables consistently in src/components/ui/badge.tsx
- [ ] T114 [US5] Verify Card elevation styles use design tokens in src/components/ui/card.tsx
- [ ] T115 Run `pnpm tsc --noEmit && pnpm lint` to verify variant system
- [ ] T116 Commit: "refactor(ui): ensure all variants use theme tokens"

**Checkpoint**: User Story 5 complete - theme fully configurable via single file

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, cleanup, and documentation

- [ ] T117 [P] Run full accessibility audit using browser dev tools or axe-core
- [ ] T118 [P] Verify responsive behavior at all breakpoints (320px, 768px, 1024px, 1920px+)
- [ ] T119 [P] Measure and verify bundle size increase < 50KB gzipped
- [ ] T120 [P] Measure First Contentful Paint remains under 2 seconds
- [ ] T121 Run `pnpm build` to verify production build succeeds
- [ ] T122 Run `pnpm test:run` to verify all existing tests still pass
- [ ] T123 Visual regression check: compare all page types before/after migration
- [ ] T124 [P] Remove any unused old component code or deprecated props
- [ ] T125 [P] Update specs/003-shadcn-migration/quickstart.md with final migration notes
- [ ] T126 Run final `pnpm tsc --noEmit && pnpm lint && pnpm build` verification
- [ ] T127 Commit: "chore: final cleanup and documentation updates"
- [ ] T128 Create pull request with comprehensive summary of all changes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 (Phase 3) and US2 (Phase 4) are both P1 priority - can run in parallel
  - US3 (Phase 5) and US4 (Phase 6) are both P2 priority - can run in parallel after US1/US2
  - US5 (Phase 7) is P3 priority - can start after foundational, but best after US1-4
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational (BLOCKS all user stories)
    ↓
    ├── Phase 3: US1 - Consistent Components (P1) ──┬── can run in parallel
    ├── Phase 4: US2 - Visual Hierarchy (P1) ───────┘
    │       ↓
    ├── Phase 5: US3 - Accessibility (P2) ──────────┬── can run in parallel
    ├── Phase 6: US4 - Interactions (P2) ───────────┘
    │       ↓
    └── Phase 7: US5 - Theme System (P3)
            ↓
    Phase 8: Polish
```

### Within Each User Story

- Verify types after each component change
- Commit after each logical group of changes
- Test manually before marking complete

### Parallel Opportunities

**Phase 2 (Foundational) - All component installs can run in parallel:**
- T008, T009, T010, T011, T012, T013, T014, T015

**Phase 3 (US1) - Page updates can run in parallel:**
- T033-T041 (Inventory pages)
- T044-T049 (Production/Quality pages)
- T052-T055 (Purchasing/Sales pages)
- T058-T061 (Remaining pages)

**Phase 4 (US2) - Custom component updates can run in parallel:**
- T064, T065, T066, T067

**Phase 5 (US3) - Accessibility checks can run in parallel:**
- T078, T079, T080, T081

**Phase 6 (US4) - New component installs can run in parallel:**
- T091, T092, T093, T094

---

## Parallel Example: Phase 2 Component Installation

```bash
# Launch all component installations in parallel:
npx shadcn@canary add button
npx shadcn@canary add card
npx shadcn@canary add input
npx shadcn@canary add badge
npx shadcn@canary add table
npx shadcn@canary add select
npx shadcn@canary add skeleton
npx shadcn@canary add separator
```

## Parallel Example: Phase 3 Page Updates

```bash
# Launch inventory page updates in parallel (different files):
# T033: src/app/dashboard/page.tsx
# T034: src/app/inventory/items/page.tsx
# T035: src/app/inventory/items/[id]/page.tsx
# T036: src/app/inventory/lots/page.tsx
# ... (all can be updated simultaneously)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Consistent Components)
4. **STOP and VALIDATE**: Test all pages have consistent components
5. Deploy/demo if ready - this provides immediate visible value

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test → Deploy (MVP with consistent components!)
3. Add User Story 2 → Test → Deploy (improved visual hierarchy)
4. Add User Story 3 + 4 → Test → Deploy (accessibility + interactions)
5. Add User Story 5 → Test → Deploy (maintainable theme)
6. Polish → Final release

### Suggested MVP Scope

**Minimum Viable Migration**: Complete through Phase 3 (User Story 1)
- All core components migrated to shadcn/ui
- All pages updated to use new components
- Consistent design language achieved
- Bundle size and performance verified

---

## Summary

| Metric | Count |
|--------|-------|
| **Total Tasks** | 154 |
| **Setup Tasks** | 6 |
| **Foundational Tasks** | 11 |
| **US1 Tasks (P1)** | 72 |
| **US2 Tasks (P1)** | 14 |
| **US3 Tasks (P2)** | 13 |
| **US4 Tasks (P2)** | 16 |
| **US5 Tasks (P3)** | 10 |
| **Polish Tasks** | 12 |
| **Parallel Opportunities** | 80+ tasks marked [P] |

> **Note**: Task count updated 2025-12-19 after analysis discovered 22 additional pages and added 4 regression verification tasks.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story (US1-US5)
- Each user story is independently completable and testable
- Commit after each task or logical group
- Run `pnpm tsc --noEmit && pnpm lint` after each component change (per constitution)
- Stop at any checkpoint to validate story independently

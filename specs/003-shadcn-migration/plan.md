# Implementation Plan: shadcn/ui Migration and Professional UI Enhancement

**Branch**: `003-shadcn-migration` | **Date**: 2025-12-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-shadcn-migration/spec.md`

## Summary

Migrate the existing custom UI component library to shadcn/ui to achieve a more professional, consistent, and maintainable user interface. The migration preserves the existing emerald/teal brand colors while leveraging shadcn/ui's well-tested, accessible components. This is a UI-only migration with no changes to API endpoints or data models.

## Technical Context

**Language/Version**: TypeScript 5.x with React 19, Next.js 15 (App Router)
**Primary Dependencies**: shadcn/ui, Radix UI primitives, Tailwind CSS v4, Lucide React (icons), React Query v5
**Storage**: N/A (UI-only changes, existing MySQL/SQLite backends unchanged)
**Testing**: Vitest with @testing-library/react for component tests
**Target Platform**: Web (responsive: 320px to 1920px+ viewports)
**Project Type**: Single Next.js web application
**Performance Goals**: FCP < 2 seconds, interaction feedback < 100ms
**Constraints**: Bundle size increase < 50KB gzipped, no regression in existing functionality
**Scale/Scope**: 14 existing UI components to migrate, 45 pages to update

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality Standards | ✅ PASS | TypeScript strict mode, ESLint compliance maintained |
| I. Error Verification | ✅ PASS | Will run `pnpm tsc --noEmit` and `pnpm lint` after each component migration |
| I. Frequent Commits | ✅ PASS | Commit after each component migration |
| II. Testing Standards | ✅ PASS | Component tests will be added/updated for migrated components |
| III. UX Consistency | ✅ PASS | shadcn/ui provides consistent styling; emerald/teal theme preserved |
| III. Responsive Design | ✅ PASS | shadcn/ui components are responsive by default |
| III. Loading States | ✅ PASS | shadcn/ui provides Skeleton component |
| III. Accessibility | ✅ PASS | shadcn/ui built on Radix UI with WCAG compliance |
| IV. Performance | ✅ PASS | Bundle size monitored; shadcn/ui is tree-shakeable |
| V. Security | N/A | UI-only changes, no security impact |

**Gate Status**: ✅ PASSED - No violations

### Post-Design Re-evaluation (Phase 1 Complete)

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| I. Code Quality | ✅ PASS | Component contracts define TypeScript interfaces; ESLint configs unchanged |
| I. No Hardcoded Values | ✅ PASS | All colors via CSS variables; theme centralized in globals.css |
| II. Testing | ✅ PASS | Testing strategy documented; component tests planned per migration |
| III. UX Consistency | ✅ PASS | shadcn/ui ensures consistent styling; API contracts preserve existing patterns |
| III. Responsive Design | ✅ PASS | All components responsive by default; breakpoints 320px-1920px+ |
| III. Accessibility | ✅ PASS | Radix UI primitives provide WCAG AA compliance out of box |
| IV. Performance | ✅ PASS | Bundle < 50KB increase; tree-shakeable components |
| V. Security | N/A | No auth/API changes |

**Post-Design Gate Status**: ✅ PASSED - Ready for task generation

## Project Structure

### Documentation (this feature)

```text
specs/003-shadcn-migration/
├── plan.md              # This file
├── research.md          # Phase 0 output: shadcn/ui integration research
├── data-model.md        # Phase 1 output: Component mapping (no data model changes)
├── quickstart.md        # Phase 1 output: Migration guide
├── contracts/           # Phase 1 output: Component API contracts
│   └── components.md    # Component props/variants documentation
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── app/                      # Next.js App Router pages (26 pages to update)
│   ├── dashboard/
│   ├── inventory/
│   ├── production/
│   ├── quality/
│   ├── purchasing/
│   ├── sales/
│   ├── reports/
│   ├── users/
│   ├── settings/
│   └── login/
├── components/
│   ├── layout/               # Layout components (sidebar, main-layout)
│   │   ├── main-layout.tsx
│   │   └── sidebar.tsx
│   └── ui/                   # UI components (to be migrated to shadcn/ui)
│       ├── badge.tsx         # → shadcn Badge
│       ├── button.tsx        # → shadcn Button
│       ├── card.tsx          # → shadcn Card
│       ├── empty-state.tsx   # Custom (keep, enhance with shadcn styling)
│       ├── form-field.tsx    # → shadcn Form + FormField
│       ├── input.tsx         # → shadcn Input
│       ├── kpi-card.tsx      # Custom (keep, use shadcn Card internally)
│       ├── page-header.tsx   # Custom (keep, enhance with shadcn styling)
│       ├── select.tsx        # → shadcn Select
│       ├── skeleton.tsx      # → shadcn Skeleton
│       ├── stat-card.tsx     # Custom (keep, use shadcn Card internally)
│       └── table.tsx         # → shadcn Table
└── lib/
    └── utils/
        └── cn.ts             # Already exists; shadcn/ui uses same pattern

tests/
└── components/               # Component tests (to be added/updated)
```

**Structure Decision**: Single Next.js application structure maintained. shadcn/ui components will be installed to `src/components/ui/` following shadcn/ui conventions. Custom components (KPICard, StatCard, EmptyState, PageHeader) will be refactored to use shadcn primitives internally.

## Complexity Tracking

> No constitution violations requiring justification.

## Implementation Phases

### Phase 0: Research & Setup

1. Research shadcn/ui + Tailwind CSS v4 compatibility
2. Research theme customization for emerald/teal brand colors
3. Research migration strategy for existing components
4. Document component mapping decisions

### Phase 1: Foundation Setup

1. Install and configure shadcn/ui CLI
2. Configure theme with emerald/teal color palette
3. Install core shadcn/ui components (Button, Card, Input, etc.)
4. Verify theme renders correctly

### Phase 2: Core Component Migration

1. Migrate Button component
2. Migrate Card components (Card, CardHeader, CardContent, etc.)
3. Migrate Input component
4. Migrate Select component
5. Migrate Badge component
6. Migrate Table component
7. Migrate Skeleton component
8. Add new components: Dialog, Dropdown, Tooltip

### Phase 3: Custom Component Updates

1. Update KPICard to use shadcn Card internally
2. Update StatCard to use shadcn Card internally
3. Update EmptyState with shadcn styling
4. Update PageHeader with shadcn styling
5. Update FormField to use shadcn Form patterns

### Phase 4: Layout Migration

1. Update Sidebar with shadcn styling patterns
2. Update MainLayout with shadcn patterns
3. Verify responsive behavior

### Phase 5: Page Updates

1. Update Dashboard page
2. Update Inventory pages (6 pages)
3. Update Production pages (3 pages)
4. Update Quality pages (3 pages)
5. Update Purchasing pages (2 pages)
6. Update Sales pages (2 pages)
7. Update Reports page
8. Update Users page
9. Update Settings page
10. Update Login page

### Phase 6: Polish & Verification

1. Accessibility audit (WCAG 2.1 AA)
2. Responsive testing across breakpoints
3. Performance testing (FCP, bundle size)
4. Visual regression check
5. Final cleanup and documentation

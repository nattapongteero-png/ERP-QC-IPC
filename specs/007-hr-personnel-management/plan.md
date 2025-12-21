# Implementation Plan: HR Pages Responsive & Professional UI Redesign

**Branch**: `007-hr-personnel-management` | **Date**: 2025-12-21 | **Spec**: [spec.md](./spec.md)
**Input**: User request to modify every page `/hr/*` to be mobile-friendly and desktop-friendly, with informative data and professional appearance.

## Summary

Enhance all 16 HR module pages to be fully responsive across desktop (1920px), tablet (768px-1024px), and mobile (320px-767px) viewports. Implement consistent professional UI patterns using DevExtreme components with informative dashboard elements, summary cards, and improved data visualization.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 15 (App Router), React 19
**Primary Dependencies**: DevExtreme React 25.1.x, Tailwind CSS v4, TanStack Query 5.x, Lucide React
**Storage**: MySQL (production), SQLite (testing) via Drizzle ORM
**Testing**: Vitest for unit tests, Playwright for E2E
**Target Platform**: Web - Desktop (1920px), Tablet (768px-1024px), Mobile (320px-767px)
**Project Type**: Web application (Next.js monorepo)
**Performance Goals**: Page load < 3s, API response < 500ms
**Constraints**: Must use DevExtreme components exclusively (licensed), maintain GMP compliance
**Scale/Scope**: 16 HR pages to enhance

## Constitution Check

*GATE: All items verified before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Type Safety | PASS | Using TypeScript strict mode |
| Linting Compliance | PASS | ESLint configured |
| DevExtreme Components | PASS | Using DevExtreme as primary UI library |
| Responsive Design | REQUIRES WORK | Current pages need mobile optimization |
| Reusable Components | REQUIRES WORK | Some patterns can be extracted to shared components |
| Error Handling | PASS | Toast notifications and error states implemented |

## Project Structure

### Documentation (this feature)

```text
specs/007-hr-personnel-management/
├── plan.md              # This file
├── research.md          # Phase 0 output - responsive patterns research
├── data-model.md        # Phase 1 output - UI component definitions
├── quickstart.md        # Phase 1 output - implementation guide
├── contracts/           # Phase 1 output - component APIs
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/hr/                       # HR module pages (16 pages to enhance)
│   ├── page.tsx                  # HR Dashboard
│   ├── audit/page.tsx            # Audit Trail
│   ├── authorizations/page.tsx   # Authorization Management
│   ├── employees/
│   │   ├── page.tsx              # Employee Directory
│   │   ├── new/page.tsx          # New Employee Form
│   │   └── [id]/page.tsx         # Employee Detail/Edit
│   ├── health-records/page.tsx   # Health Records
│   ├── notifications/page.tsx    # Notifications
│   ├── org/page.tsx              # Organization Units
│   ├── org-chart/page.tsx        # Organization Chart Diagram
│   ├── positions/page.tsx        # Position Management
│   ├── roles/page.tsx            # Role Management
│   └── training/
│       ├── page.tsx              # Training Landing
│       ├── courses/page.tsx      # Training Courses
│       ├── matrix/page.tsx       # Competency Matrix
│       └── sessions/page.tsx     # Training Sessions
├── components/
│   ├── hr/                       # HR-specific components
│   │   └── OrgChartDiagram.tsx   # Org chart visualization
│   ├── shared/                   # Shared reusable components
│   │   ├── responsive-page-header.tsx  # NEW: Responsive header
│   │   ├── stat-card.tsx              # NEW: Summary stat card
│   │   ├── responsive-data-grid.tsx   # NEW: Mobile-optimized grid
│   │   └── mobile-list-view.tsx       # NEW: Card list for mobile
│   └── ui/                       # Base UI components
│       ├── dx-button.tsx
│       ├── dx-data-grid.tsx
│       └── dx-date-box.tsx
└── styles/
    ├── dx.emerald-override.css
    └── dx.mobile-overrides.css   # Mobile-specific DevExtreme overrides
```

**Structure Decision**: Enhancement to existing Next.js web application structure. New shared components will be added to `src/components/shared/` for reuse across HR pages. Mobile-specific styles will be added to existing override files.

## HR Pages Analysis

### Page Categories & Enhancement Strategy

| Category | Pages | Current State | Enhancement Needed |
|----------|-------|---------------|-------------------|
| **Dashboards** | HR Dashboard | Basic responsive | Add summary cards, quick actions, mobile layout |
| **Data Grids** | Employees, Positions, Roles, Courses, Sessions, Authorizations, Health Records, Audit, Notifications | Fixed height grids | Mobile card view, responsive columns, swipe actions |
| **Forms** | New Employee, Employee Edit | Desktop-only layout | Stack fields on mobile, responsive dialogs |
| **Visualizations** | Org Chart, Competency Matrix | Desktop-focused | Horizontal scroll on mobile, zoom controls |
| **Landing Pages** | Training Landing, Org Landing | Simple card grid | Responsive grid, better mobile navigation |

### Enhancement Priorities (by page)

1. **P1 - High Traffic Pages**
   - `/hr` - Main dashboard (entry point)
   - `/hr/employees` - Employee directory (most used)
   - `/hr/employees/new` - New employee (frequent action)
   - `/hr/training` - Training landing (frequent access)

2. **P2 - Core Management Pages**
   - `/hr/positions` - Position management
   - `/hr/org` - Organization structure
   - `/hr/training/courses` - Course management
   - `/hr/training/sessions` - Session scheduling

3. **P3 - Specialized Pages**
   - `/hr/org-chart` - Visual diagram
   - `/hr/training/matrix` - Competency matrix
   - `/hr/authorizations` - Authorization control
   - `/hr/health-records` - Health tracking
   - `/hr/roles` - Role/permission management
   - `/hr/notifications` - Alert center
   - `/hr/audit` - Audit log
   - `/hr/employees/[id]` - Employee detail

## Complexity Tracking

> No constitution violations requiring justification. All enhancements follow existing patterns.

| Decision | Rationale | Alternative Considered |
|----------|-----------|------------------------|
| Add shared responsive components | Maximize reuse across 16 pages | Inline responsive code per page (rejected - violates DRY) |
| Mobile card view for grids | DevExtreme grids are complex on mobile | Custom mobile components (rejected - maintenance burden) |
| Breakpoint-based layout | Standard responsive approach | Container queries (rejected - less browser support) |

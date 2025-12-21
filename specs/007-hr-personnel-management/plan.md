# Implementation Plan: HR/Personnel Management Module

**Branch**: `007-hr-personnel-management` | **Date**: 2025-12-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-hr-personnel-management/spec.md`

## Summary

Implement a comprehensive HR/Personnel Management module for GMP compliance. The module provides organization structure management, employee profiles, position/job descriptions, training records with competency tracking, authorization control with delegation, health records, role-based permissions with separation of duties enforcement, and immutable audit trail. The module integrates with existing authentication and serves as the authoritative identity source for other ERP modules (Production, QC/QA, CAPA, Deviations, Release).

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 15 (App Router), React 19
**Primary Dependencies**: Drizzle ORM, DevExtreme React 25.1.x, Zod 4.2.x, TanStack Query 5.x, jsonwebtoken (existing)
**Storage**: MySQL (production), SQLite (testing) via Drizzle ORM - extends existing dual-schema pattern
**Testing**: Vitest with Testing Library, DB_TYPE=sqlite for unit tests
**Target Platform**: Web application (Linux server), iPad landscape as primary target
**Project Type**: Web application - Next.js App Router with API routes and React frontend
**Performance Goals**: API responses <500ms for simple queries, <2s for complex reports; page load <3s
**Constraints**: <200ms p95 for authorization checks (critical path), 50+ concurrent users, 1000+ employees
**Scale/Scope**: 1000+ employees, 6-level org hierarchy, 13 new entities, 8 user stories across P1-P3

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality Standards | ✅ PASS | TypeScript strict mode, ESLint, Zod validation, reusable components |
| II. Testing Standards | ✅ PASS | Unit tests for services, integration tests for API endpoints |
| III. User Experience Consistency | ✅ PASS | DevExtreme components, Tailwind CSS, responsive design |
| IV. Performance Requirements | ✅ PASS | Pagination for large datasets, indexed queries, <500ms API responses |
| V. Security and GMP Compliance | ✅ PASS | Audit trail immutable, role-based access, separation of duties enforcement |
| Quality Gates | ✅ PASS | CI pipeline with tsc, lint, test, build |
| Reusable Components | ✅ PASS | Shared dialogs for employee lookup, org unit picker, training matrix |

**Pre-Phase 0 Gate Result**: PASS - No violations detected

## Project Structure

### Documentation (this feature)

```text
specs/007-hr-personnel-management/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output - OpenAPI specs
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/hr/                          # HR API routes
│   │   ├── org-units/
│   │   │   ├── route.ts                 # List/Create org units
│   │   │   ├── [id]/route.ts            # Get/Update/Delete org unit
│   │   │   └── [id]/children/route.ts   # Get child org units
│   │   ├── positions/
│   │   │   ├── route.ts                 # List/Create positions
│   │   │   └── [id]/route.ts            # Get/Update/Delete position
│   │   ├── employees/
│   │   │   ├── route.ts                 # List/Create employees
│   │   │   ├── [id]/route.ts            # Get/Update employee
│   │   │   ├── [id]/assignments/route.ts # Assignment history
│   │   │   └── search/route.ts          # Employee search
│   │   ├── training/
│   │   │   ├── courses/route.ts         # Training catalog
│   │   │   ├── sessions/route.ts        # Training sessions
│   │   │   ├── records/route.ts         # Training records
│   │   │   └── competency-matrix/route.ts # Employee competency matrix
│   │   ├── authorizations/
│   │   │   ├── route.ts                 # List/Create authorizations
│   │   │   ├── [id]/route.ts            # Get/Update authorization
│   │   │   ├── delegations/route.ts     # Delegations
│   │   │   └── check/route.ts           # Authorization validation
│   │   ├── health-records/
│   │   │   └── route.ts                 # Health records (restricted)
│   │   └── roles/
│   │       ├── route.ts                 # Application roles
│   │       └── permissions/route.ts     # Role-permission mappings
│   └── (app)/hr/                        # HR UI pages
│       ├── org-chart/page.tsx           # Organization chart viewer
│       ├── employees/
│       │   ├── page.tsx                 # Employee directory
│       │   └── [id]/page.tsx            # Employee profile
│       ├── positions/page.tsx           # Position management
│       ├── training/
│       │   ├── courses/page.tsx         # Training catalog
│       │   ├── sessions/page.tsx        # Session management
│       │   └── matrix/page.tsx          # Competency matrix
│       ├── authorizations/page.tsx      # Authorization management
│       └── audit/page.tsx               # HR audit log viewer
├── components/
│   ├── hr/                              # HR-specific components
│   │   ├── OrgChartTree.tsx             # Organization chart tree
│   │   ├── EmployeeCard.tsx             # Employee summary card
│   │   ├── TrainingMatrix.tsx           # Competency matrix grid
│   │   ├── AuthorizationBadge.tsx       # Authorization status badge
│   │   └── HealthStatusIndicator.tsx    # Fit/Unfit/Restricted indicator
│   └── shared/
│       ├── OrgUnitPicker.tsx            # Reusable org unit selector
│       ├── EmployeeLookup.tsx           # Reusable employee search dialog
│       └── PositionSelect.tsx           # Reusable position dropdown
├── lib/
│   ├── db/
│   │   └── schema.ts                    # Add HR tables (both SQLite & MySQL)
│   └── services/
│       ├── hr.service.ts                # HR business logic
│       ├── training.service.ts          # Training management
│       ├── authorization.service.ts     # Authorization checks
│       └── hr-audit.service.ts          # HR-specific audit logging
└── types/
    └── hr.ts                            # HR TypeScript types

tests/
├── unit/
│   └── services/
│       ├── hr.service.test.ts
│       ├── training.service.test.ts
│       └── authorization.service.test.ts
└── integration/
    └── api/hr/
        ├── org-units.test.ts
        ├── employees.test.ts
        └── authorizations.test.ts
```

**Structure Decision**: Follows existing project structure with domain-specific API routes under `src/app/api/hr/` and pages under `src/app/(app)/hr/`. Reusable HR components in `src/components/hr/` with shared pickers in `src/components/shared/`. Service layer in `src/lib/services/` for business logic separation.

## Complexity Tracking

> No violations detected - table not required.

## Phase 0: Research Tasks

Based on Technical Context analysis, the following research tasks are needed:

1. **Org Chart Visualization**: Research DevExtreme tree/diagram components for organization chart display
2. **Training Expiration Notifications**: Research notification patterns in Next.js (API cron jobs vs external scheduler)
3. **Authorization Caching**: Research caching strategies for frequent authorization checks (<200ms requirement)
4. **Health Record Privacy**: Research field-level access control patterns with Drizzle ORM
5. **Delegation Logic**: Research temporal authorization patterns (date-range based access)

## Phase 1: Design Deliverables

After Phase 0 research completion:

1. **data-model.md**: Complete entity definitions with Drizzle schema patterns (SQLite + MySQL)
2. **contracts/hr-api.yaml**: OpenAPI 3.0 specification for all HR endpoints
3. **quickstart.md**: Development setup and testing guide for HR module

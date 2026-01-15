# Implementation Plan: Unit Cost Calculation System

**Branch**: `014-unit-cost` | **Date**: 2026-01-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-unit-cost/spec.md`

## Summary

Implement a comprehensive unit cost calculation system for the Herbal Medicine ERP that:
- Calculates Weighted Average Cost (WAC) on inventory receipts with cost layer audit trail
- Allocates landed costs (freight, duty, insurance, handling) to received items
- Aggregates production costs (material, labor, overhead) on work orders
- Provides 5 cost views (WAC, standard, last purchase, production, full cost)
- Calculates COGS and margin on sales shipments
- Delivers cost management dashboard and reports

Technical approach: Extend existing Drizzle ORM schema with 8 new tables, create a `unit-cost.service.ts` core service leveraging existing `db-helper.ts` and `audit-wrapper.ts` utilities, integrate with existing inventory/production/accounting services, and build DevExtreme-based UI components.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 16.0.10
**Primary Dependencies**: React 19, DevExtreme React 25.2.3, Drizzle ORM, TanStack Query 5.x, Zod 4.x
**Storage**: MySQL (production), SQLite (testing) via Drizzle dual-schema pattern
**Testing**: Vitest + React Testing Library (unit/integration), Playwright (E2E)
**Target Platform**: Web application (responsive: desktop 1920px, tablet 768px-1024px, mobile 320px-767px)
**Project Type**: Full-stack web application (Next.js App Router)
**Performance Goals**:
- Page load < 3 seconds
- API response < 500ms for simple queries, < 2 seconds for reports
- Support 50 concurrent users
**Constraints**:
- 4 decimal precision for unit costs
- THB as base currency
- No retroactive WAC adjustments
- GMP audit trail compliance
**Scale/Scope**:
- 10,000+ inventory transactions per month
- 8 new database tables
- 1 new service file (~1500 lines estimated)
- 15+ new API endpoints
- 10+ new UI components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Compliance |
|-----------|-------------|------------|
| I. Code Quality - Type Safety | Strict TypeScript, no `any` types | PASS - Will use existing typed patterns |
| I. Code Quality - No Hardcoded Values | Use config/env for rates | PASS - All rates stored in database |
| I. Code Quality - Error Handling | Async error handling, structured responses | PASS - Use existing api-utils.ts patterns |
| I. Code Quality - Reusable Components | Extract shared UI patterns | PASS - Will extend existing shared components |
| II. Testing Standards | Unit tests for cost calculations | PASS - Critical business logic covered |
| III. UX Consistency - DevExtreme | Use DevExtreme components exclusively | PASS - DataGrid, Form, Charts |
| III. UX Consistency - Loading/Error | Loading indicators, clear error messages | PASS - Follow existing patterns |
| IV. Performance - API Response | < 500ms simple, < 2s reports | PASS - Use pagination, indexing |
| IV. Performance - Database | Appropriate indexes, no N+1 | PASS - Add indexes on cost layer queries |
| V. Security - Audit Trail | Log all modifications | PASS - Use auditedInsert/Update/Delete |
| V. Security - Authorization | Role-based access | PASS - Use withAuth middleware |

**Gate Status**: PASSED - No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/014-unit-cost/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
│   ├── cost-layers.yaml
│   ├── landed-costs.yaml
│   ├── work-centers.yaml
│   └── cost-reports.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/
│   │   ├── cost/                           # NEW - Cost management APIs
│   │   │   ├── items/[id]/cost-views/route.ts
│   │   │   ├── items/[id]/cost-layers/route.ts
│   │   │   ├── landed-costs/route.ts
│   │   │   ├── landed-costs/[id]/route.ts
│   │   │   ├── landed-costs/[id]/allocate/route.ts
│   │   │   ├── landed-costs/[id]/post/route.ts
│   │   │   ├── work-centers/route.ts
│   │   │   ├── work-centers/[id]/route.ts
│   │   │   ├── overhead-rates/route.ts
│   │   │   ├── work-orders/[id]/costs/route.ts
│   │   │   ├── work-orders/[id]/operations/route.ts
│   │   │   └── dashboard/kpis/route.ts
│   │   └── reports/
│   │       ├── cost-summary/route.ts       # NEW
│   │       ├── production-cost/route.ts    # NEW
│   │       └── margin-analysis/route.ts    # NEW
│   └── cost/                               # NEW - Cost management pages
│       ├── layout.tsx
│       ├── page.tsx                        # Cost dashboard
│       ├── landed-costs/
│       │   ├── page.tsx                    # List
│       │   ├── new/page.tsx                # Create
│       │   └── [id]/page.tsx               # Edit
│       ├── work-centers/
│       │   ├── page.tsx                    # List
│       │   ├── new/page.tsx                # Create
│       │   └── [id]/page.tsx               # Edit
│       └── reports/
│           ├── cost-summary/page.tsx
│           ├── production-cost/page.tsx
│           └── margin-analysis/page.tsx
├── components/
│   └── cost/                               # NEW - Cost management components
│       ├── CostDashboard.tsx
│       ├── CostViewsPanel.tsx
│       ├── CostLayerHistory.tsx
│       ├── LandedCostForm.tsx
│       ├── LandedCostAllocationGrid.tsx
│       ├── WorkCenterForm.tsx
│       ├── WorkOrderCostSummary.tsx
│       ├── ProductionCostReport.tsx
│       └── MarginAnalysisChart.tsx
├── lib/
│   ├── db/
│   │   ├── schema.ts                       # MODIFY - Add 8 new tables
│   │   └── schema-cost.ts                  # NEW - Cost-specific schema (optional split)
│   ├── services/
│   │   ├── unit-cost.service.ts            # NEW - Core cost calculation service
│   │   ├── inventory.service.ts            # MODIFY - Integrate WAC on receipt
│   │   ├── production.service.ts           # MODIFY - Integrate production costing
│   │   └── sales.service.ts                # MODIFY - Integrate COGS on shipment
│   └── validation/
│       └── unit-cost.ts                    # NEW - Zod schemas
├── types/
│   └── unit-cost.ts                        # NEW - TypeScript interfaces
└── tests/
    ├── unit/
    │   └── lib/services/
    │       └── unit-cost.service.test.ts   # NEW
    └── integration/
        └── api/cost/
            ├── cost-layers.test.ts         # NEW
            ├── landed-costs.test.ts        # NEW
            └── work-centers.test.ts        # NEW
```

**Structure Decision**: Following existing Next.js App Router structure. Adding `/cost/` module under both `/app/` and `/components/`. Adding `/api/cost/` for REST endpoints. Extending existing services rather than replacing them.

## Complexity Tracking

> No Constitution Check violations requiring justification. Simple extension of existing patterns.

| Aspect | Approach | Justification |
|--------|----------|---------------|
| 8 new tables | Add to schema.ts | Follows existing dual-schema pattern |
| 1 core service | unit-cost.service.ts | Single responsibility for cost calculations |
| Service integration | Modify existing | Leverage existing transaction flows |

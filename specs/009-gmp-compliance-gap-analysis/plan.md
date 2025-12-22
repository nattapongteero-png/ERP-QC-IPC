# Implementation Plan: GMP Compliance Gap Analysis

**Branch**: `009-gmp-compliance-gap-analysis` | **Date**: 2025-12-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-gmp-compliance-gap-analysis/spec.md`

## Summary

This plan addresses the implementation gaps identified between the current Herbal Medicine ERP codebase and the Thai FDA GMP requirements (INTEL-HERBAL-MANUFACTURING.md). The primary deliverables are 11 new modules/enhancements covering Document Control, CAPA Management, Complaints/Recalls, Sanitation, Stability Program, and Internal Audit - bringing total GMP compliance from ~40% average to 80%+ across all 10 หมวด.

## Technical Context

**Language/Version**: TypeScript 5.x with strict mode enabled
**Primary Dependencies**: Next.js 16.0.10, React 19.2.1, DevExtreme React 25.1.7, Drizzle ORM 0.45.1, TanStack Query 5.90.12, Zod 4.2.1
**Storage**: MySQL 8.0 (production), SQLite (testing) via Drizzle ORM dual-schema pattern
**Testing**: Vitest 4.x with @testing-library/react, DB_TYPE=sqlite for test isolation
**Target Platform**: Web application (desktop primary, tablet secondary - iPad landscape)
**Project Type**: Web application with Next.js App Router
**Performance Goals**: <500ms API response, <3s page load, 50 concurrent users
**Constraints**: GMP audit trail required, immutable records for QC-approved data, DevExtreme components mandatory
**Scale/Scope**: ~118 existing tables, 149 API routes, adding ~20 new tables and ~50 new API routes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence/Notes |
|-----------|--------|----------------|
| I. Code Quality Standards | ✅ PASS | TypeScript strict mode, ESLint, Drizzle ORM for type-safe DB |
| - No Hardcoded Values | ✅ PASS | All config via env vars, DB-driven settings |
| - Error Verification | ✅ PASS | `pnpm tsc --noEmit` and `pnpm lint` in workflow |
| - Frequent Commits | ✅ PASS | Commit after each task per constitution |
| - Reusable Components | ✅ PASS | Shared components in `src/components/shared/` |
| II. Testing Standards | ✅ PASS | Vitest with SQLite isolation, TDD encouraged |
| III. UX Consistency | ✅ PASS | DevExtreme components exclusively |
| IV. Performance | ✅ PASS | Pagination, indexing, <500ms API targets |
| V. Security & GMP Compliance | ✅ PASS | Audit trail, role-based access, JWT auth |

**Gate Result**: PASS - No constitution violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/009-gmp-compliance-gap-analysis/
├── plan.md              # This file
├── research.md          # Phase 0 output - design decisions
├── data-model.md        # Phase 1 output - entity definitions
├── quickstart.md        # Phase 1 output - implementation guide
├── contracts/           # Phase 1 output - API specifications
│   ├── document-control.yaml
│   ├── capa.yaml
│   ├── complaints-recalls.yaml
│   ├── sanitation.yaml
│   ├── stability.yaml
│   └── internal-audit.yaml
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/
│   │   ├── documents/           # NEW: Document Control API
│   │   │   ├── route.ts
│   │   │   ├── [id]/
│   │   │   │   ├── route.ts
│   │   │   │   ├── versions/route.ts
│   │   │   │   └── approve/route.ts
│   │   │   └── types/route.ts
│   │   ├── capa/                # NEW: CAPA Management API
│   │   │   ├── route.ts
│   │   │   ├── [id]/
│   │   │   │   ├── route.ts
│   │   │   │   ├── actions/route.ts
│   │   │   │   └── effectiveness/route.ts
│   │   │   └── dashboard/route.ts
│   │   ├── complaints/          # NEW: Complaints API
│   │   │   ├── route.ts
│   │   │   ├── [id]/route.ts
│   │   │   └── trends/route.ts
│   │   ├── recalls/             # NEW: Recalls API
│   │   │   ├── route.ts
│   │   │   ├── [id]/
│   │   │   │   ├── route.ts
│   │   │   │   ├── distribution/route.ts
│   │   │   │   └── reconciliation/route.ts
│   │   │   └── mock-drill/route.ts
│   │   ├── sanitation/          # NEW: Sanitation API
│   │   │   ├── schedules/route.ts
│   │   │   ├── logs/route.ts
│   │   │   ├── pest-control/route.ts
│   │   │   └── trends/route.ts
│   │   ├── stability/           # NEW: Stability Program API
│   │   │   ├── studies/route.ts
│   │   │   ├── protocols/route.ts
│   │   │   ├── samples/route.ts
│   │   │   └── trends/route.ts
│   │   ├── audits/              # NEW: Internal Audit API
│   │   │   ├── plans/route.ts
│   │   │   ├── [id]/route.ts
│   │   │   ├── findings/route.ts
│   │   │   └── reports/route.ts
│   │   ├── pqr/                 # NEW: Product Quality Review API
│   │   │   ├── generate/route.ts
│   │   │   └── [id]/route.ts
│   │   ├── contracts/           # NEW: Contract Manufacturing API
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   └── compliance/          # NEW: Compliance Dashboard API
│   │       └── dashboard/route.ts
│   ├── documents/               # NEW: Document Control UI
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [id]/page.tsx
│   ├── capa/                    # NEW: CAPA Management UI
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [id]/page.tsx
│   ├── complaints/              # NEW: Complaints UI
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── recalls/                 # NEW: Recalls UI
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── sanitation/              # NEW: Sanitation UI
│   │   ├── page.tsx
│   │   ├── schedules/page.tsx
│   │   ├── logs/page.tsx
│   │   └── pest-control/page.tsx
│   ├── stability/               # NEW: Stability Program UI
│   │   ├── page.tsx
│   │   ├── studies/page.tsx
│   │   └── trends/page.tsx
│   ├── audits/                  # NEW: Internal Audit UI
│   │   ├── page.tsx
│   │   ├── plans/page.tsx
│   │   └── [id]/page.tsx
│   └── compliance/              # NEW: Compliance Dashboard UI
│       └── page.tsx
├── components/
│   ├── shared/
│   │   ├── WorkflowStatusBadge.tsx      # Reusable workflow status display
│   │   ├── ApprovalChain.tsx            # Reusable approval workflow UI
│   │   ├── AuditTrailViewer.tsx         # Reusable audit trail display
│   │   └── TrendChart.tsx               # Reusable trend visualization
│   ├── documents/               # NEW: Document Control components
│   ├── capa/                    # NEW: CAPA components
│   ├── complaints/              # NEW: Complaints components
│   ├── recalls/                 # NEW: Recalls components
│   ├── sanitation/              # NEW: Sanitation components
│   ├── stability/               # NEW: Stability components
│   └── audits/                  # NEW: Audit components
├── lib/
│   ├── db/
│   │   ├── schema.ts            # EXTEND: Add new tables (~20)
│   │   └── schema-mysql.ts      # EXTEND: MySQL equivalents
│   └── services/
│       ├── document-service.ts  # NEW
│       ├── capa-service.ts      # NEW
│       ├── complaint-service.ts # NEW
│       ├── recall-service.ts    # NEW
│       ├── sanitation-service.ts# NEW
│       ├── stability-service.ts # NEW
│       ├── audit-service.ts     # NEW
│       └── pqr-service.ts       # NEW
└── types/
    ├── documents.ts             # NEW
    ├── capa.ts                  # NEW
    ├── complaints.ts            # NEW
    ├── recalls.ts               # NEW
    ├── sanitation.ts            # NEW
    ├── stability.ts             # NEW
    └── audits.ts                # NEW

tests/
├── unit/
│   ├── services/
│   │   ├── document-service.test.ts
│   │   ├── capa-service.test.ts
│   │   ├── complaint-service.test.ts
│   │   ├── recall-service.test.ts
│   │   ├── sanitation-service.test.ts
│   │   ├── stability-service.test.ts
│   │   ├── audit-service.test.ts
│   │   └── pqr-service.test.ts
│   └── components/
└── integration/
    ├── api/
    │   ├── documents.test.ts
    │   ├── capa.test.ts
    │   ├── complaints.test.ts
    │   ├── recalls.test.ts
    │   ├── sanitation.test.ts
    │   ├── stability.test.ts
    │   └── audits.test.ts
    └── workflows/
        ├── deviation-to-capa.test.ts
        ├── complaint-to-recall.test.ts
        └── audit-to-capa.test.ts
```

**Structure Decision**: Extends existing Next.js App Router structure with new feature modules. Each module follows the established pattern: API routes in `src/app/api/[module]/`, UI pages in `src/app/[module]/`, components in `src/components/[module]/`, services in `src/lib/services/`, and types in `src/types/`.

## Complexity Tracking

No constitution violations requiring justification. The design follows existing patterns.

## Implementation Phases

### Phase 0: Research (Complete)

See [research.md](./research.md) for design decisions.

### Phase 1: Design (Complete)

See:
- [data-model.md](./data-model.md) for entity definitions
- [contracts/](./contracts/) for API specifications
- [quickstart.md](./quickstart.md) for implementation guide

### Phase 2: Tasks (Pending)

Run `/speckit.tasks` to generate implementation tasks.

## Module Priority Order

Based on dependencies and GMP criticality:

| Priority | Module | Dependencies | Est. Tables | Est. APIs |
|----------|--------|--------------|-------------|-----------|
| P1.1 | Document Control | None | 3 | 8 |
| P1.2 | CAPA Management | Deviation (exists), Document Control | 3 | 10 |
| P1.3 | Change Control | Document Control | 2 | 6 |
| P1.4 | PQR Generation | CAPA, Deviation, Stability | 2 | 4 |
| P2.1 | Complaints | CAPA | 2 | 8 |
| P2.2 | Recalls | Lot Traceability (exists) | 3 | 10 |
| P2.3 | Stability Program | Quality Tests (exists) | 4 | 12 |
| P3.1 | Sanitation | None | 3 | 8 |
| P3.2 | Pest Control | Sanitation | 1 | 4 |
| P3.3 | Internal Audit | CAPA | 3 | 8 |
| P3.4 | Contract Repository | None | 2 | 4 |
| P1.0 | Compliance Dashboard | All above | 0 | 2 |

**Total New**: ~28 tables, ~84 API endpoints

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Scope creep from 11 modules | Strict P1/P2/P3 prioritization, MVP per module |
| Integration with existing deviations | Use existing deviation table, add foreign key to CAPA |
| Audit trail consistency | Reuse existing audit_log pattern from HR module |
| DevExtreme learning curve | Copy existing grid/form patterns from inventory module |
| Test coverage | TDD approach, SQLite isolation for unit tests |

## Success Metrics (from Spec)

- SC-001: 80%+ coverage across all 10 GMP chapters
- SC-002: 100% batch releases require e-authorization
- SC-003: Deviations closed with CAPA in 30/60 days
- SC-004: Document retrieval < 30 seconds
- SC-005: Stability trends available for marketed products
- SC-006: Recall identifies 100% affected customers in 4 hours
- SC-007: 100% internal audit completion annually
- SC-008: Regulatory reports generated in 24 hours
- SC-009: Training expiry alerts 30 days advance
- SC-010: Equipment calibration overdue < 2%

# Implementation Plan: Accounting Module Integration

**Branch**: `010-accounting-module-integration` | **Date**: 2025-12-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-accounting-module-integration/spec.md`

## Summary

Comprehensive accounting module integration for the herbal medicine ERP system, connecting HR, Purchase, and Sales modules with double-entry bookkeeping, Thai tax compliance (VAT 7%, WHT), fixed asset management with depreciation, equipment maintenance tracking, and TFRS-compliant financial reporting.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 14+
**Primary Dependencies**: Drizzle ORM, DevExtreme React 25.x, TanStack Query, Zod
**Storage**: MySQL (production), SQLite (testing) via dual-schema pattern
**Testing**: Vitest with React Testing Library
**Target Platform**: Web application (responsive, iPad landscape primary)
**Project Type**: Web application (Next.js monolith with API routes + React frontend)
**Performance Goals**: API responses <500ms for simple queries, <2s for reports; 50 concurrent users
**Constraints**: Thai language support (bilingual), GMP audit trail requirements, TFRS compliance
**Scale/Scope**: ~20 new database tables, ~40 API endpoints, ~15 UI pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Type Safety | PASSED | TypeScript strict mode, Zod validation schemas |
| Testing Standards | PASSED | Unit tests for services, integration tests for APIs |
| UX Consistency | PASSED | DevExtreme components, Thai/English bilingual |
| Performance | PASSED | Paginated queries, indexed lookups |
| Security & GMP | PASSED | Audit trail for all financial transactions |
| Reusable Components | PASSED | Shared dialogs, form patterns, grid configs |

All gates PASSED. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/010-accounting-module-integration/
├── plan.md              # This file
├── research.md          # Technical decisions (12 items resolved)
├── data-model.md        # 21 entities with ERD
├── quickstart.md        # Developer guide with code examples
├── contracts/           # OpenAPI 3.0.3 specifications
│   ├── gl-accounts.yaml
│   ├── journal-entries.yaml
│   ├── invoices.yaml
│   ├── fixed-assets.yaml
│   ├── maintenance.yaml
│   └── reports.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (from /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/accounting/         # API routes
│   │   ├── gl-accounts/
│   │   ├── journal-entries/
│   │   ├── ap-invoices/
│   │   ├── ar-invoices/
│   │   ├── payments/
│   │   ├── fixed-assets/
│   │   ├── equipment/
│   │   ├── maintenance/
│   │   ├── fiscal-periods/
│   │   └── reports/
│   └── (protected)/accounting/ # UI pages
│       ├── chart-of-accounts/
│       ├── journal-entries/
│       ├── ap/
│       ├── ar/
│       ├── fixed-assets/
│       ├── equipment/
│       ├── reports/
│       └── settings/
├── lib/
│   ├── db/
│   │   └── schema/
│   │       ├── sqliteAccounting.ts  # SQLite schema
│   │       └── mysqlAccounting.ts   # MySQL schema
│   └── services/
│       └── accounting.service.ts    # Business logic
├── components/
│   └── accounting/
│       ├── shared/                  # Reusable components
│       └── ...                      # Feature components
└── types/
    └── accounting.ts                # Shared type definitions

tests/
├── unit/
│   └── services/
│       └── accounting.service.test.ts
└── integration/
    └── api/
        └── accounting/
```

**Structure Decision**: Following existing monolith pattern with dual SQLite/MySQL schemas, service layer for business logic, and DevExtreme UI components.

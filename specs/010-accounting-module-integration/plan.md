# Implementation Plan: Accounting Module Integration

**Branch**: `010-accounting-module-integration` | **Date**: 2025-12-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-accounting-module-integration/spec.md`

## Summary

This feature implements a comprehensive accounting module that integrates with existing HR, Purchase, and Sales modules. The module provides:

1. **Core Accounting**: Chart of Accounts (Thai Accounting Standards), double-entry journal entries, period management
2. **AP/AR Integration**: Automatic invoice generation from PO receipts and SO shipments
3. **Thai Tax Compliance**: VAT (7%), Withholding Tax, Por Por 30, WHT certificates
4. **Manufacturing Cost Accounting**: Material/labor/overhead allocation to production batches
5. **Fixed Assets**: Depreciation per Thai Revenue Code, asset tracking, disposal management
6. **Equipment Maintenance**: Preventive scheduling, maintenance cost tracking, MTBF analysis
7. **Financial Reporting**: Trial Balance, Balance Sheet, Income Statement, Cash Flow Statement (TFRS format)

Technical approach follows existing patterns: Drizzle ORM with SQLite/MySQL dual-schema, service layer for business logic, Next.js API routes with authentication middleware, DevExtreme React UI components.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 14+
**Primary Dependencies**: Drizzle ORM, DevExtreme React 25.x, TanStack Query, Zod
**Storage**: MySQL (production), SQLite (testing) via dual-schema pattern
**Testing**: Vitest + React Testing Library
**Target Platform**: Web (desktop/tablet responsive, iPad landscape primary target)
**Project Type**: Web application (Next.js monolith with API routes + React frontend)
**Performance Goals**:
- Page load < 3 seconds
- API response < 500ms (simple), < 2 seconds (complex reports)
- Trial Balance/statements generated within 1 minute
**Constraints**:
- 50 concurrent users minimum
- Closed period posting prevention
- Audit trail for all transactions
- Thai language support (nameTh/nameEn pattern)
**Scale/Scope**:
- 18 new database entities
- 50 functional requirements
- 10 user stories across 3 priority levels
- Integration with 4 existing modules (HR, Purchasing, Sales, Inventory)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I. Code Quality Standards** | | |
| Type Safety (strict TypeScript) | PASS | Will use existing strict tsconfig; all entities typed |
| No Hardcoded Values | PASS | Thai COA template from seed data; tax rates configurable |
| Error Verification | PASS | tsc --noEmit + lint on all changes |
| Frequent Commits | PASS | Commit after each task completion |
| Reusable Components | PASS | Shared dialogs for AP/AR, common grid configs |
| **II. Testing Standards** | | |
| Test Coverage | PASS | Unit tests for services, integration for API routes |
| Unit Test Isolation | PASS | SQLite in-memory for all service tests |
| Integration Tests | PASS | API contract tests for all endpoints |
| **III. User Experience** | | |
| Responsive Design | PASS | DevExtreme responsive grids; iPad target |
| Loading States | PASS | TanStack Query loading states |
| DevExtreme Components | PASS | All UI using DevExtreme exclusively |
| **IV. Performance** | | |
| Page Load < 3s | PASS | Standard Next.js patterns + pagination |
| API Response | PASS | Indexed queries; pagination for large datasets |
| Database Queries | PASS | Drizzle with proper joins; no N+1 |
| **V. Security & GMP** | | |
| Authentication | PASS | All routes use withAuth middleware |
| Authorization | PASS | Role-based permissions (accounting role) |
| Audit Trail | PASS | All GL transactions logged with user/timestamp |
| Data Integrity | PASS | Posted JE not editable; reversals create new entries |

**GATE STATUS: PASSED** - No constitution violations identified.

## Project Structure

### Documentation (this feature)

```text
specs/010-accounting-module-integration/
├── plan.md              # This file
├── research.md          # Phase 0: Technology decisions
├── data-model.md        # Phase 1: Entity definitions
├── quickstart.md        # Phase 1: Developer guide
├── contracts/           # Phase 1: API specifications
│   ├── gl-accounts.yaml
│   ├── journal-entries.yaml
│   ├── ap-invoices.yaml
│   ├── ar-invoices.yaml
│   ├── fixed-assets.yaml
│   ├── maintenance.yaml
│   └── reports.yaml
├── checklists/
│   └── requirements.md  # Spec validation checklist
└── tasks.md             # Phase 2: Implementation tasks (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── accounting/                    # UI Pages
│   │   ├── page.tsx                   # Module dashboard
│   │   ├── chart-of-accounts/
│   │   │   ├── page.tsx               # COA list
│   │   │   └── [id]/page.tsx          # Account detail
│   │   ├── journal-entries/
│   │   │   ├── page.tsx               # JE list
│   │   │   ├── new/page.tsx           # Create JE
│   │   │   └── [id]/page.tsx          # JE detail
│   │   ├── ap-invoices/
│   │   │   ├── page.tsx               # AP list
│   │   │   └── [id]/page.tsx          # AP detail
│   │   ├── ar-invoices/
│   │   │   ├── page.tsx               # AR list
│   │   │   └── [id]/page.tsx          # AR detail
│   │   ├── fixed-assets/
│   │   │   ├── page.tsx               # Asset register
│   │   │   ├── new/page.tsx           # Register asset
│   │   │   └── [id]/page.tsx          # Asset detail
│   │   ├── equipment/
│   │   │   ├── page.tsx               # Equipment list
│   │   │   └── [id]/
│   │   │       ├── page.tsx           # Equipment detail
│   │   │       └── maintenance/page.tsx # Maintenance history
│   │   ├── reports/
│   │   │   ├── page.tsx               # Report menu
│   │   │   ├── trial-balance/page.tsx
│   │   │   ├── balance-sheet/page.tsx
│   │   │   ├── income-statement/page.tsx
│   │   │   ├── cash-flow/page.tsx
│   │   │   ├── vat-report/page.tsx
│   │   │   └── asset-register/page.tsx
│   │   ├── period-close/
│   │   │   └── page.tsx               # Period management
│   │   └── settings/
│   │       ├── page.tsx               # Accounting settings
│   │       ├── fiscal-years/page.tsx
│   │       └── asset-categories/page.tsx
│   └── api/
│       └── accounting/
│           ├── gl-accounts/
│           │   ├── route.ts           # GET list, POST create
│           │   └── [id]/route.ts      # GET, PUT, DELETE
│           ├── journal-entries/
│           │   ├── route.ts
│           │   ├── [id]/route.ts
│           │   └── [id]/post/route.ts # POST journal entry
│           ├── ap-invoices/
│           │   ├── route.ts
│           │   ├── [id]/route.ts
│           │   ├── [id]/approve/route.ts
│           │   └── [id]/pay/route.ts
│           ├── ar-invoices/
│           │   ├── route.ts
│           │   ├── [id]/route.ts
│           │   ├── [id]/confirm/route.ts
│           │   └── [id]/receive-payment/route.ts
│           ├── fixed-assets/
│           │   ├── route.ts
│           │   ├── [id]/route.ts
│           │   ├── [id]/dispose/route.ts
│           │   └── depreciation/route.ts
│           ├── equipment/
│           │   ├── route.ts
│           │   ├── [id]/route.ts
│           │   └── [id]/maintenance/route.ts
│           ├── fiscal-periods/
│           │   ├── route.ts
│           │   └── [id]/close/route.ts
│           └── reports/
│               ├── trial-balance/route.ts
│               ├── balance-sheet/route.ts
│               ├── income-statement/route.ts
│               ├── cash-flow/route.ts
│               ├── vat-report/route.ts
│               └── wht-certificates/route.ts
├── components/
│   └── accounting/
│       ├── gl-account-selector.tsx    # Shared GL lookup
│       ├── journal-entry-form.tsx     # JE creation form
│       ├── invoice-grid.tsx           # Shared AP/AR grid
│       ├── payment-dialog.tsx         # Payment recording
│       ├── asset-form.tsx             # Asset registration
│       ├── depreciation-calculator.tsx
│       ├── maintenance-form.tsx
│       └── report-filters.tsx         # Date range, period selection
├── lib/
│   ├── db/
│   │   └── schema.ts                  # Add 18 new entities (dual SQLite/MySQL)
│   ├── services/
│   │   └── accounting.service.ts      # All accounting business logic
│   └── validation/
│       └── accounting.ts              # Zod schemas for accounting entities
└── types/
    └── accounting.ts                  # TypeScript interfaces

tests/
├── services/
│   └── accounting.service.test.ts     # Service unit tests
├── api/
│   └── accounting/                    # API integration tests
└── components/
    └── accounting/                    # Component tests
```

**Structure Decision**: Follows existing Next.js monolith pattern with App Router. New `/accounting` domain under both `/app` (pages) and `/api` (routes). Service layer in `/lib/services/accounting.service.ts` following existing patterns. UI components in `/components/accounting/` for reusability.

## Complexity Tracking

> No constitution violations to justify. Design follows established patterns.

| Area | Approach | Rationale |
|------|----------|-----------|
| 18 entities | Single schema file | Follows existing pattern in schema.ts |
| Multiple reports | Separate API routes | Each report has different query logic |
| AP/AR integration | Event hooks in existing services | Minimal changes to purchasing.service.ts and sales.service.ts |

# Implementation Plan: Accounting Module Gap Analysis

**Branch**: `011-accounting-spec-gap` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-accounting-spec-gap/spec.md`

## Summary

This plan addresses the remaining 10-15% of missing features in the Manufacturing Accounting System. The gap analysis reveals that the core P2P (Purchase-to-Pay) and O2C (Order-to-Cash) workflows are fully implemented with automatic accounting entries. The missing features are:

1. **Purchase Requisitions (P1)** - Upstream document before PO
2. **Bank Reconciliation (P1)** - Statement import and matching
3. **Credit/Debit Notes (P2)** - AR/AP adjustment documents
4. **3-Way Matching (P2)** - PO/GRN/Invoice tolerance checking
5. **Configurable Approval Workflows (P2)** - Rule-based approval routing
6. **Manufacturing Variance Analysis (P3)** - Standard cost variance reporting

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 16.0.10
**Primary Dependencies**: Drizzle ORM, DevExtreme React 25.2.3, TanStack Query 5.x, Zod 4.x
**Storage**: MySQL (production), SQLite (testing) via dual-schema pattern
**Testing**: Vitest + React Testing Library (unit), Playwright (E2E)
**Target Platform**: Web application (desktop-first, responsive)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: API < 500ms simple queries, < 2s complex reports, 50 concurrent users
**Constraints**: GMP compliance requires full audit trail, no data deletion
**Scale/Scope**: ~50 users, 6 new modules, extends existing accounting infrastructure

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Compliance |
|-----------|-------------|------------|
| **I. Code Quality** | TypeScript strict mode, ESLint, no hardcoded values | PASS - Will use existing patterns |
| **I. Reusable Components** | Extract common UI patterns to shared components | PASS - Will reuse existing DataGrid, Form patterns |
| **II. Testing Standards** | Unit tests for success + error paths | PASS - Will add tests per feature |
| **III. UX Consistency** | DevExtreme components only, responsive design | PASS - DevExtreme DataGrid, Form, SelectBox |
| **IV. Performance** | API < 500ms, paginated queries | PASS - Will follow existing patterns |
| **V. Security/GMP** | Authentication, audit trail, role-based access | PASS - Will use auditedInsert/Update/Delete |

**Gate Status**: PASS - No violations require justification

## Project Structure

### Documentation (this feature)

```text
specs/011-accounting-spec-gap/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
│   ├── purchase-requisitions.yaml
│   ├── bank-reconciliation.yaml
│   ├── credit-debit-notes.yaml
│   ├── three-way-matching.yaml
│   ├── approval-workflows.yaml
│   └── variance-analysis.yaml
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── types/
│   ├── purchase-requisition.ts      # PR type definitions
│   ├── bank-reconciliation.ts       # Bank recon types
│   ├── credit-debit-notes.ts        # CN/DN types
│   ├── matching.ts                  # 3-way matching types
│   ├── approval-workflow.ts         # Workflow config types
│   └── variance.ts                  # Variance analysis types
├── lib/
│   ├── validation/
│   │   ├── purchase-requisition.ts  # PR Zod schemas
│   │   ├── bank-reconciliation.ts   # Bank recon schemas
│   │   ├── credit-debit-notes.ts    # CN/DN schemas
│   │   ├── matching.ts              # Matching tolerance schemas
│   │   └── approval-workflow.ts     # Workflow config schemas
│   ├── db/
│   │   └── schema.ts                # Add new tables (PRs, bank statements, etc.)
│   └── services/
│       ├── purchase-requisition.service.ts
│       ├── bank-reconciliation.service.ts
│       ├── credit-debit-notes.service.ts
│       ├── matching.service.ts
│       ├── approval-workflow.service.ts
│       └── variance-analysis.service.ts
├── app/
│   ├── accounting/
│   │   ├── bank-reconciliation/
│   │   │   ├── page.tsx             # Bank recon list
│   │   │   ├── import/page.tsx      # Statement import
│   │   │   └── [id]/page.tsx        # Reconciliation details
│   │   ├── credit-notes/
│   │   │   ├── page.tsx             # CN list
│   │   │   └── new/page.tsx         # Create CN
│   │   ├── debit-notes/
│   │   │   ├── page.tsx             # DN list
│   │   │   └── new/page.tsx         # Create DN
│   │   └── variance-reports/
│   │       └── page.tsx             # Variance analysis dashboard
│   ├── purchasing/
│   │   └── requisitions/
│   │       ├── page.tsx             # PR list
│   │       ├── new/page.tsx         # Create PR
│   │       └── [id]/page.tsx        # PR details
│   ├── settings/
│   │   ├── approval-workflows/
│   │   │   ├── page.tsx             # Workflow config list
│   │   │   └── [id]/page.tsx        # Workflow details
│   │   └── matching-tolerances/
│   │       └── page.tsx             # Tolerance config
│   └── api/
│       ├── purchasing/
│       │   └── requisitions/        # PR API routes
│       ├── accounting/
│       │   ├── bank-reconciliation/ # Bank recon routes
│       │   ├── credit-notes/        # CN routes
│       │   ├── debit-notes/         # DN routes
│       │   ├── matching/            # Matching routes
│       │   └── variance-reports/    # Variance routes
│       └── settings/
│           ├── approval-workflows/  # Workflow config routes
│           └── matching-tolerances/ # Tolerance config routes
└── components/
    ├── purchasing/
    │   ├── PRForm.tsx               # PR create/edit form
    │   └── PRLineGrid.tsx           # PR line items grid
    ├── accounting/
    │   ├── BankStatementImport.tsx  # Statement import dialog
    │   ├── ReconciliationGrid.tsx   # Matching grid
    │   ├── CreditNoteForm.tsx       # CN form
    │   └── VarianceChart.tsx        # Variance charts
    └── shared/
        └── ApprovalWorkflow.tsx     # Reusable approval component

tests/
├── unit/
│   ├── lib/
│   │   └── services/
│   │       ├── purchase-requisition.service.test.ts
│   │       ├── bank-reconciliation.service.test.ts
│   │       ├── credit-debit-notes.service.test.ts
│   │       ├── matching.service.test.ts
│   │       ├── approval-workflow.service.test.ts
│   │       └── variance-analysis.service.test.ts
│   └── app/
│       └── purchasing/
│           └── requisitions/
│               └── page.test.tsx
└── e2e/
    └── accounting/
        ├── purchase-requisitions.spec.ts
        ├── bank-reconciliation.spec.ts
        ├── credit-notes.spec.ts
        └── variance-reports.spec.ts
```

**Structure Decision**: Web application using Next.js App Router pattern. New modules follow the established Template Module pattern from `/template` with service layer, API routes, and DevExtreme UI components.

## Complexity Tracking

> No violations to justify - plan follows existing patterns

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

---

## Constitution Check (Post-Design)

*Re-evaluated after Phase 1 design completion*

| Principle | Requirement | Post-Design Status |
|-----------|-------------|-------------------|
| **I. Code Quality** | TypeScript strict mode, ESLint, no hardcoded values | PASS - Data model uses proper types, no magic numbers |
| **I. Reusable Components** | Extract common UI patterns to shared components | PASS - ApprovalWorkflow.tsx is shared across all document types |
| **II. Testing Standards** | Unit tests for success + error paths | PASS - Test patterns defined in quickstart.md |
| **III. UX Consistency** | DevExtreme components only, responsive design | PASS - All UI uses DataGrid, Form, SelectBox |
| **IV. Performance** | API < 500ms, paginated queries | PASS - All list APIs support pagination |
| **V. Security/GMP** | Authentication, audit trail, role-based access | PASS - All entities use audit wrapper, segregation enforced |

**Post-Design Gate Status**: PASS - Design aligns with constitution principles

---

## Generated Artifacts Summary

| Artifact | Path | Description |
|----------|------|-------------|
| **plan.md** | `specs/011-accounting-spec-gap/plan.md` | This implementation plan |
| **research.md** | `specs/011-accounting-spec-gap/research.md` | Research findings and decisions |
| **data-model.md** | `specs/011-accounting-spec-gap/data-model.md` | Entity definitions and relationships |
| **quickstart.md** | `specs/011-accounting-spec-gap/quickstart.md` | Implementation quick-start guide |
| **contracts/** | `specs/011-accounting-spec-gap/contracts/` | OpenAPI specifications |
| - purchase-requisitions.yaml | | PR API contract |
| - bank-reconciliation.yaml | | Bank recon API contract |
| - credit-debit-notes.yaml | | CN/DN API contract |
| - three-way-matching.yaml | | Matching API contract |
| - approval-workflows.yaml | | Workflow API contract |
| - variance-analysis.yaml | | Variance API contract |

---

## Next Steps

Run `/speckit.tasks` to generate the task breakdown from this plan.

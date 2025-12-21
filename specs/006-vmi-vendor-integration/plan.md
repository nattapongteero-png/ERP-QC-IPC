# Implementation Plan: VMI Portal Vendor Integration

**Branch**: `006-vmi-vendor-integration` | **Date**: 2025-12-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-vmi-vendor-integration/spec.md`

## Summary

Integrate with VMI Portal as a vendor to enable real-time data exchange with hospitals. The system will:
1. Store and manage VMI Portal API credentials securely per vendor
2. Sync item master, prices, and inventory to VMI Portal
3. Receive and manage purchase orders from hospitals via polling
4. Track order lifecycle (submitted → confirmed → shipped → received)

Technical approach: Extend existing Next.js API routes and services with VMI-specific endpoints, add schema fields for standard codes (TPP/TTMT), and implement background job scheduling for automated sync operations.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 15 (App Router)
**Primary Dependencies**: React 19, Drizzle ORM, DevExtreme React 25.1.x, Zod 4.2.x, TanStack Query 5.x
**Storage**: MySQL (production), SQLite (testing) via Drizzle ORM
**Testing**: Vitest with @testing-library/react
**Target Platform**: Web application (responsive, iPad landscape primary)
**Project Type**: Next.js full-stack web application
**Performance Goals**: API response <500ms, 100 items sync <30 seconds, order polling every 15 minutes
**Constraints**: Secure credential storage, 90-day transaction log retention, GMP compliance for audit trail
**Scale/Scope**: 50 concurrent users, integration with external VMI Portal API

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Code Quality Standards | ✅ PASS | TypeScript strict mode, ESLint, no hardcoded values (API URLs in config) |
| I. Error Verification | ✅ PASS | Will run `pnpm tsc --noEmit` and `pnpm lint` after each change |
| I. Frequent Commits | ✅ PASS | Commit after each logical unit of work |
| I. Reusable Components | ✅ PASS | Components in `src/components/purchasing/vmi/`, shared dialogs in `src/components/shared/` |
| II. Testing Standards | ✅ PASS | Unit tests for services, integration tests for API endpoints |
| III. User Experience | ✅ PASS | Loading states, error feedback, form validation per existing patterns |
| III. DevExtreme Components | ✅ PASS | All UI uses DevExtreme DataGrid, Form, Charts, LoadIndicator |
| IV. Performance | ✅ PASS | API <500ms, pagination for large syncs, no N+1 queries |
| V. Security & GMP | ✅ PASS | API key encryption, audit logging, role-based access |

**Quality Gates**:
- [ ] Type Check: `pnpm tsc --noEmit` passes
- [ ] Lint: `pnpm lint` passes with no errors
- [ ] Unit Tests: `pnpm test:run` passes
- [ ] Build: `pnpm build` succeeds

## Project Structure

### Documentation (this feature)

```text
specs/006-vmi-vendor-integration/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
│   ├── vmi-config.yaml
│   ├── vmi-sync.yaml
│   └── vmi-orders.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/
│   │   ├── purchasing/
│   │   │   └── vmi/                    # Existing - extend
│   │   │       ├── route.ts            # Existing VMI snapshot
│   │   │       ├── config/route.ts     # NEW: VMI credentials management
│   │   │       ├── sync/
│   │   │       │   ├── items/route.ts  # NEW: Sync items to portal
│   │   │       │   ├── prices/route.ts # NEW: Sync prices to portal
│   │   │       │   └── inventory/route.ts # NEW: Sync inventory
│   │   │       └── orders/
│   │   │           ├── route.ts        # NEW: Poll & list VMI orders
│   │   │           └── [id]/
│   │   │               ├── route.ts    # NEW: Order details & actions
│   │   │               └── receipt-status/route.ts # NEW
│   │   └── vendors/
│   │       └── [id]/
│   │           └── vmi-config/route.ts # NEW: Vendor VMI settings
│   └── purchasing/
│       └── vmi/                        # NEW: VMI management pages
│           ├── page.tsx                # VMI dashboard
│           ├── orders/page.tsx         # VMI orders list
│           └── sync/page.tsx           # Sync management
├── lib/
│   ├── db/
│   │   └── schema.ts                   # Extend with tpp_code, ttmt_code
│   ├── services/
│   │   ├── purchasing.service.ts       # Existing - extend
│   │   └── vmi-portal.service.ts       # NEW: VMI Portal API client
│   └── crypto/
│       └── encrypt.ts                  # NEW: API key encryption
├── components/
│   ├── shared/                         # Reusable components (per Constitution I)
│   │   └── ConfirmationDialog.tsx      # NEW: Shared confirmation dialog
│   └── purchasing/
│       └── vmi/                        # NEW: VMI-specific components (domain folder)
│           ├── VmiCredentialsForm.tsx  # Uses DevExtreme Form, TextBox, Button
│           ├── VmiSyncStatus.tsx       # Uses DevExtreme LoadIndicator
│           ├── VmiOrdersGrid.tsx       # Uses DevExtreme DataGrid
│           ├── VmiOrderDetail.tsx      # Uses DevExtreme Form
│           ├── VmiDashboard.tsx        # Uses DevExtreme Charts, DataGrid
│           └── VmiTransactionLog.tsx   # Uses DevExtreme DataGrid
└── types/
    └── vmi.ts                          # NEW: VMI types

tests/
├── unit/
│   ├── services/
│   │   └── vmi-portal.service.test.ts
│   └── crypto/
│       └── encrypt.test.ts
└── integration/
    └── api/
        └── vmi/
            ├── config.test.ts
            ├── sync.test.ts
            └── orders.test.ts
```

**Structure Decision**: Extend existing Next.js structure with new VMI-specific routes under `/api/purchasing/vmi/` and new UI pages under `/purchasing/vmi/`. Follow existing patterns for services, components, and tests.

## Complexity Tracking

No constitution violations - design follows existing patterns and complexity guidelines.

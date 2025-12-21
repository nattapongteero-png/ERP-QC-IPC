# Implementation Plan: VMI Vendor Sync (Correction)

**Branch**: `008-vmi-vendor-sync` | **Date**: 2025-12-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-vmi-vendor-sync/spec.md`

## Summary

This feature corrects the VMI integration architecture. The existing implementation (006) incorrectly treats this ERP as a **customer** of VMI vendors. In reality, this system IS the vendor/supplier that sells to hospitals via VMI portals.

**Key Corrections**:
1. Push OUR inventory/catalog/prices TO VMI portals (outbound sync)
2. Receive orders FROM VMI portals INTO our sales system (not purchasing)
3. Store VMI portal API credentials in the settings module (not per-vendor)

**Technical Approach**: Extend existing VMI infrastructure, redirect order flow from purchasing to sales module, add settings-based portal configuration.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 15+ (App Router)
**Primary Dependencies**: Next.js 16.0.10, React 19.2.1, Drizzle ORM 0.45.1, DevExtreme React 25.1.7, TanStack Query 5.90.12, Zod 4.2.1
**Storage**: MySQL 8.0 (production), SQLite (testing) via Drizzle ORM dual-schema pattern
**Testing**: Vitest 4.0.16 with SQLite in-memory, @testing-library/react 16.3.1
**Target Platform**: Web application (Linux server deployment, browser-based UI)
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: Sync 500 items in <60 seconds, API responses <500ms, order polling every 15 minutes
**Constraints**: Dual database support required, encrypted API key storage, audit trail for all VMI operations
**Scale/Scope**: 50 concurrent users, multiple VMI portal connections, 90-day transaction log retention

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status | Notes |
|-----------|-------------|--------|-------|
| I. Type Safety | TypeScript strict mode | PASS | Existing patterns in codebase |
| I. No Hardcoded Values | Config in settings/env | PASS | Portal URLs and API keys stored in settings table |
| I. Error Verification | tsc --noEmit, lint | PASS | CI pipeline enforces |
| I. Frequent Commits | Atomic commits | PASS | Will commit after each logical unit |
| I. Reusable Components | Shared dialogs/forms | PASS | Will use existing VMI components, add shared settings UI |
| II. Test Coverage | Unit tests for business logic | PASS | Vitest with SQLite in-memory |
| II. Test-First | TDD for complex features | PASS | Will write tests before implementation |
| III. DevExtreme Components | Primary UI library | PASS | Existing DevExtreme patterns in codebase |
| III. Loading States | Async indicators | PASS | TanStack Query handles this |
| IV. API Response | <500ms for simple queries | PASS | Sync operations may exceed for bulk |
| IV. Database Queries | Use indexes, no N+1 | PASS | Drizzle ORM with proper joins |
| V. Authentication | JWT tokens required | PASS | Existing withAuth middleware |
| V. Authorization | Role-based access | PASS | Use 'settings:*' and 'sales:*' permissions |
| V. Audit Trail | Log all modifications | PASS | Existing createAuditLog function |
| V. Secrets Management | Encrypt API keys | PASS | Existing crypto/encrypt.ts service |

**All gates PASS** - No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/008-vmi-vendor-sync/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
│   ├── vmi-settings-api.yaml
│   ├── vmi-sync-api.yaml
│   └── vmi-orders-api.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/
│   │   ├── settings/
│   │   │   └── vmi/                    # NEW: VMI portal settings API
│   │   │       ├── route.ts            # GET/POST portal configurations
│   │   │       ├── [portalId]/
│   │   │       │   ├── route.ts        # GET/PUT/DELETE specific portal
│   │   │       │   └── test/route.ts   # POST test connection
│   │   ├── vmi-sync/                   # NEW: Outbound sync API
│   │   │   ├── inventory/route.ts      # POST sync inventory
│   │   │   ├── items/route.ts          # POST sync item catalog
│   │   │   ├── prices/route.ts         # POST sync prices
│   │   │   └── status/route.ts         # GET sync status/history
│   │   └── sales/
│   │       └── vmi-orders/             # NEW: VMI orders into sales
│   │           ├── route.ts            # GET list, POST poll for new
│   │           ├── [orderId]/
│   │           │   ├── route.ts        # GET/PUT order details
│   │           │   ├── confirm/route.ts
│   │           │   └── ship/route.ts
│   ├── (dashboard)/
│   │   └── settings/
│   │       └── vmi/page.tsx            # NEW: VMI settings UI
│   └── (dashboard)/
│       └── vmi/
│           ├── page.tsx                # NEW: VMI dashboard
│           ├── sync/page.tsx           # NEW: Manual sync triggers
│           └── orders/page.tsx         # NEW: VMI sales orders list
├── lib/
│   ├── db/
│   │   └── schema.ts                   # MODIFY: Add vmi_portal_config table
│   ├── services/
│   │   ├── vmi-portal.service.ts       # MODIFY: Support vendor role
│   │   ├── vmi-sync.service.ts         # NEW: Outbound sync logic
│   │   └── vmi-sales-order.service.ts  # NEW: VMI order to sales conversion
│   └── crypto/
│       └── encrypt.ts                  # EXISTING: Use for API key encryption
├── components/
│   └── vmi/
│       ├── VmiPortalConfigForm.tsx     # NEW: Settings form component
│       ├── VmiSyncStatusCard.tsx       # NEW: Sync status display
│       └── VmiOrdersGrid.tsx           # NEW: Orders grid (DevExtreme)
└── types/
    └── vmi.ts                          # MODIFY: Add vendor-side types

tests/
├── services/
│   ├── vmi-sync.service.test.ts        # NEW: Sync service tests
│   └── vmi-sales-order.service.test.ts # NEW: Order conversion tests
├── api/
│   ├── vmi-settings.test.ts            # NEW: Settings API tests
│   ├── vmi-sync.test.ts                # NEW: Sync API tests
│   └── vmi-sales-orders.test.ts        # NEW: Sales orders API tests
└── integration/
    └── vmi-full-flow.test.ts           # NEW: End-to-end VMI flow
```

**Structure Decision**: Follows existing Next.js App Router patterns. New VMI features extend existing `/api/` structure. Settings integrated into existing settings module. Sales orders extend existing `/api/sales/` module.

## Complexity Tracking

> No constitution violations - this section is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

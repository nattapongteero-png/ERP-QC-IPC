# Implementation Plan: Comprehensive Integration Tests with Real SQLite

**Branch**: `009-gmp-compliance-gap-analysis` | **Date**: 2025-12-23 | **Spec**: [spec.md](./spec.md)
**Input**: User request to add comprehensive integration tests using real SQLite for all modules

## Summary

This plan addresses the gap between mock-based unit tests and real-world integration tests. Currently, only the CAPA service has comprehensive integration tests with real SQLite database. All other GMP compliance modules (Complaints, Documents, Internal Audit, Recalls, Sanitation, Stability) and business modules (Production, Quality, Inventory, HR, Sales, Purchasing, VMI) use mocked database calls that don't validate actual database operations, schema compatibility, or real-world workflows.

**Goal**: Ensure all service modules have comprehensive integration tests using real SQLite that cover real-world scenarios including complete CRUD operations, workflow validations, and data integrity checks.

## Technical Context

**Language/Version**: TypeScript 5.x with strict mode enabled
**Primary Dependencies**: Next.js 16.0.10, React 19.2.1, Drizzle ORM 0.45.1, better-sqlite3 12.5.0
**Storage**: MySQL 8.0 (production), SQLite (testing) via Drizzle ORM dual-schema pattern
**Testing**: Vitest 4.0.16 with jsdom environment
**Target Platform**: Node.js server (API routes) + Browser (React components)
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: All tests complete within 60 seconds, individual test < 1 second
**Constraints**: Tests must work with in-memory SQLite (:memory:), no external services required
**Scale/Scope**: 14 service modules (CAPA existing + 13 new), targeting ~150 integration test cases

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Code Quality Standards** | ✅ PASS | Integration tests improve code quality, TypeScript strict mode, no hardcoded values |
| **II. Testing Standards** | ✅ PASS | This plan directly addresses "Integration Tests: API endpoints MUST have integration tests validating request/response contracts. Database operations MUST have integration tests validating data integrity." |
| **III. User Experience Consistency** | N/A | Testing infrastructure, no UI changes |
| **IV. Performance Requirements** | ✅ PASS | Tests target < 1 second per test |
| **V. Security and GMP Compliance** | ✅ PASS | Tests validate audit trail, data integrity, role-based access |

**Quality Gates:**
- Type Check: Tests must pass `pnpm tsc --noEmit`
- Lint: Tests must pass `pnpm lint`
- Unit Tests: All tests must pass `pnpm test:run`

## Project Structure

### Documentation (this feature)

```text
specs/009-gmp-compliance-gap-analysis/
├── plan.md              # This file
├── research.md          # Phase 0 output - testing patterns and best practices
├── data-model.md        # Phase 1 output - test schema requirements
├── quickstart.md        # Phase 1 output - how to run and write tests
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── db/
│   │   ├── index.ts           # Database connection (SQLite/MySQL switch)
│   │   └── schema/            # Drizzle ORM schema definitions
│   │       ├── sqlite/        # SQLite-specific schemas
│   │       └── mysql/         # MySQL-specific schemas
│   └── services/              # Service modules to test (20 files)
│       ├── capa-service.ts           # ✅ Has real SQLite tests
│       ├── complaint-service.ts      # ❌ Needs real SQLite tests
│       ├── document-service.ts       # ❌ Needs real SQLite tests
│       ├── internal-audit-service.ts # ❌ Needs real SQLite tests
│       ├── recall-service.ts         # ❌ Needs real SQLite tests
│       ├── sanitation-service.ts     # ❌ Needs real SQLite tests
│       ├── stability-service.ts      # ❌ Needs real SQLite tests
│       ├── inventory.service.ts      # ❌ Needs real SQLite tests
│       ├── production.service.ts     # ❌ Needs real SQLite tests
│       ├── quality.service.ts        # ❌ Needs real SQLite tests
│       ├── hr.service.ts             # ❌ Needs real SQLite tests
│       ├── sales.service.ts          # ❌ Needs real SQLite tests
│       ├── purchasing.service.ts     # ❌ Needs real SQLite tests
│       ├── vmi-portal.service.ts     # ❌ Needs real SQLite tests
│       ├── vmi-sync.service.ts       # ❌ Needs real SQLite tests
│       └── ...
│
tests/
├── setup.ts                    # Global test setup (DB_TYPE=sqlite)
├── helpers/                    # NEW: Shared test utilities
│   ├── test-db.ts              # NEW: Database setup helper
│   ├── schema-sync.ts          # NEW: Drizzle schema → SQLite DDL
│   └── seed-data.ts            # NEW: Common test data seeding
├── unit/                       # Existing unit tests (mocked)
│   └── services/
├── integration/
│   ├── services/               # NEW: Real SQLite integration tests
│   │   ├── capa-service-real.test.ts           # ✅ EXISTS
│   │   ├── complaint-service-real.test.ts      # NEW
│   │   ├── document-service-real.test.ts       # NEW
│   │   ├── internal-audit-service-real.test.ts # NEW
│   │   ├── recall-service-real.test.ts         # NEW
│   │   ├── sanitation-service-real.test.ts     # NEW
│   │   ├── stability-service-real.test.ts      # NEW
│   │   ├── inventory-service-real.test.ts      # NEW
│   │   ├── production-service-real.test.ts     # NEW
│   │   ├── quality-service-real.test.ts        # NEW
│   │   ├── hr-service-real.test.ts             # NEW
│   │   ├── sales-service-real.test.ts          # NEW
│   │   ├── purchasing-service-real.test.ts     # NEW
│   │   └── vmi-portal-service-real.test.ts     # NEW
│   └── api/                    # Existing API tests
```

**Structure Decision**: Extend existing test structure with shared helpers and new integration test files following the CAPA pattern.

## Modules Requiring Integration Tests

### Priority 1: GMP Compliance Modules (P1)

| Module | Service File | Required Tables | Test Scenarios |
|--------|--------------|-----------------|----------------|
| Complaints | `complaint-service.ts` | complaints, complaint_investigations, users | Create, investigate, escalate, close, trend analysis |
| Documents | `document-service.ts` | documents, document_versions, document_approvals, users | Create, version, approve, obsolete, search |
| Internal Audit | `internal-audit-service.ts` | internal_audits, audit_findings, audit_checklists, users | Schedule, conduct, record findings, link to CAPA |

### Priority 2: GMP Compliance Modules (P2)

| Module | Service File | Required Tables | Test Scenarios |
|--------|--------------|-----------------|----------------|
| Recalls | `recall-service.ts` | recalls, recall_distributions, recall_returns, inventory_lots, users | Initiate, track distribution, reconcile returns |
| Sanitation | `sanitation-service.ts` | sanitation_schedules, sanitation_logs, sanitation_areas, users | Schedule, log completion, verify, trend |
| Stability | `stability-service.ts` | stability_studies, stability_tests, stability_results, quality_tests, users | Enroll, schedule, record results, trend, OOS |

### Priority 3: Business Modules (P3)

| Module | Service File | Required Tables | Test Scenarios |
|--------|--------------|-----------------|----------------|
| Inventory | `inventory.service.ts` | inventory_items, inventory_lots, inventory_transactions, users | Receive, issue, transfer, adjust, quarantine/release |
| Production | `production.service.ts` | work_orders, batch_records, bill_of_materials, users | Create order, execute, yield reconciliation |
| Quality | `quality.service.ts` | quality_tests, test_results, specifications, users | Sample, test, approve/reject, OOS workflow |
| HR | `hr.service.ts` | hr_employees, hr_training_records, hr_authorizations, users | Create employee, assign training, track completion |
| Sales | `sales.service.ts` | sales_orders, sales_order_items, customers, users | Create order, fulfill, ship, invoice |
| Purchasing | `purchasing.service.ts` | purchase_orders, po_items, vendors, users | Create PO, receive, approve, close |
| VMI Portal | `vmi-portal.service.ts` | vmi_vendors, vmi_inventory, vmi_orders, users | Configure vendor, sync inventory, process orders |

## Testing Pattern (Based on CAPA Implementation)

### Standard Integration Test Structure

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema/sqlite';
import { setupTestDatabase, seedTestUsers, cleanTables } from '@/tests/helpers/test-db';

describe('ModuleService Integration (Real SQLite)', () => {
  let sqlite: Database.Database;
  let testDb: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    // Setup in-memory SQLite with schema sync
    const setup = await setupTestDatabase();
    sqlite = setup.sqlite;
    testDb = setup.db;

    // Mock db module to use test database
    vi.doMock('@/lib/db', () => ({
      isSqlite: () => true,
      getDb: async () => testDb,
      getSqliteDb: () => testDb,
      schema,
    }));
  });

  beforeEach(() => {
    cleanTables(sqlite, ['table1', 'table2']);
    seedTestUsers(sqlite);
  });

  afterAll(() => {
    sqlite.close();
  });

  describe('Real-World Scenarios', () => {
    it('should complete full workflow from creation to closure', async () => {
      // Test complete lifecycle
    });

    it('should handle error conditions appropriately', async () => {
      // Test validation, constraints, error paths
    });
  });

  describe('Service Functions', () => {
    it('should create record with all required fields', async () => {
      // Test individual function
    });
  });
});
```

### Real-World Scenario Examples Per Module

**Complaints:**
1. Customer complaint received → QC review → Investigation → Root cause → CAPA created → Closure
2. Complaint trend analysis across product lines
3. Escalation to regulatory notification for serious issues

**Documents:**
1. Draft SOP → Review → Approve → Publish → Train → Obsolete → Archive
2. Version control with concurrent edits blocked
3. Approval workflow with delegation

**Internal Audit:**
1. Annual audit schedule → Conduct audit → Record findings → Create CAPAs → Verify closure
2. Finding classification and severity tracking
3. Audit report generation

## Complexity Tracking

No constitution violations expected - this plan adds testing infrastructure which is explicitly required by Constitution Section II.

## Implementation Approach

### Phase 1: Shared Test Infrastructure
1. Create `tests/helpers/test-db.ts` - Database setup helper (extract from CAPA tests)
2. Create `tests/helpers/schema-sync.ts` - Generic schema synchronization
3. Create `tests/helpers/seed-data.ts` - Common test data factory

### Phase 2: GMP Compliance Module Tests (P1)
4. Complaint service integration tests
5. Document service integration tests
6. Internal Audit service integration tests

### Phase 3: GMP Compliance Module Tests (P2)
7. Recall service integration tests
8. Sanitation service integration tests
9. Stability service integration tests

### Phase 4: Business Module Tests (P3)
10. Inventory service integration tests
11. Production service integration tests
12. Quality service integration tests
13. HR service integration tests
14. Sales service integration tests
15. Purchasing service integration tests
16. VMI Portal service integration tests

### Phase 5: Verification
17. Run all tests, ensure no regressions
18. Update coverage reports
19. Document test patterns in quickstart.md

## Success Criteria

- [ ] All 14 service modules have real SQLite integration tests
- [ ] Each module has at least 5 real-world scenario tests
- [ ] All tests pass with `pnpm test:run`
- [ ] Test coverage for services increases by 25%+
- [ ] Tests complete in < 90 seconds total (14 modules × ~10 tests × ~0.6s average)
- [ ] Shared test helpers reduce boilerplate by 50%+
- [ ] Schema alignment tasks (Phase 0) completed before blocked tests proceed

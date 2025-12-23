# Research: GMP Compliance Gap Analysis

**Feature**: 009-gmp-compliance-gap-analysis
**Date**: 2025-12-22
**Purpose**: Resolve technical unknowns and establish design decisions for GMP compliance modules

## Research Tasks Completed

### 1. Document Control System Design

**Decision**: Hierarchical document structure with version chains

**Rationale**:
- GMP requires traceable document history with approval chains
- Thai FDA (เอกสาร 2) mandates current vs obsolete document separation
- Existing hr_job_descriptions table provides approval workflow pattern to follow

**Alternatives Considered**:
- Flat document table with version field → Rejected: harder to query "current" versions
- Git-like commit history → Rejected: over-engineering for document control
- External DMS integration → Rejected: compliance requires audit trail in same system

**Design Pattern**:
```
documents (master record)
  └── document_versions (version chain)
        └── document_approvals (approval signatures per version)
```

### 2. CAPA Workflow Integration with Existing Deviations

**Decision**: CAPA as separate table with foreign key to deviation source

**Rationale**:
- Existing `deviations` table has `correctiveAction` and `preventiveAction` text fields
- CAPA needs structured workflow: actions, owners, due dates, effectiveness checks
- Multiple sources (deviation, complaint, audit finding) can trigger CAPA

**Alternatives Considered**:
- Extend deviation table with CAPA fields → Rejected: CAPA lifecycle differs from deviation
- Embed CAPA in deviation as JSON → Rejected: poor queryability, no separate workflow
- Separate CAPA module → Selected: clean separation, multiple source types

**Integration Pattern**:
```
deviations (existing)
  └── capa (new, references deviation_id OR complaint_id OR audit_finding_id)
        └── capa_actions (individual action items)
              └── capa_effectiveness (verification records)
```

### 3. Recall Distribution Tracking

**Decision**: Leverage existing `inventory_transactions` + new `recall_distributions` view

**Rationale**:
- Existing inventory transactions track movements by lot
- Need to aggregate by customer for recall notification
- Thai FDA requires customer contact info + quantities

**Alternatives Considered**:
- Separate distribution ledger table → Rejected: duplicates existing data
- Real-time aggregation only → Rejected: slow for large datasets
- Materialized view/cache → Selected: pre-aggregate for recall speed (4-hour target)

**Design Pattern**:
```
recalls (new)
  └── recall_notifications (customer notification tracking)
  └── recall_reconciliation (returned vs distributed)

Query: inventory_transactions by lot_id, group by customer
```

### 4. Stability Program Protocol Design

**Decision**: Protocol-driven testing with timepoint scheduling

**Rationale**:
- ICH guidelines require predefined test schedules (0, 1, 2, 3, 6, 9, 12, 18, 24, 36 months)
- Need trend visualization for early detection
- OOS results must trigger investigation workflow

**Alternatives Considered**:
- Ad-hoc testing → Rejected: not GMP compliant
- Fixed schedule for all products → Rejected: different products have different requirements
- Flexible protocol → Selected: protocol defines tests and timepoints per product

**Design Pattern**:
```
stability_protocols (defines test schedule template)
  └── stability_studies (instance per batch)
        └── stability_samples (enrolled batches)
              └── stability_tests (linked to quality_tests for results)
```

### 5. Audit Trail Consistency

**Decision**: Reuse existing `audit_log` pattern from HR module

**Rationale**:
- HR module has proven audit trail implementation
- Consistent format across all modules
- Already handles before/after values, user ID, timestamp

**Pattern from HR**:
```typescript
// Existing pattern in src/lib/db/schema.ts
export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tableName: text('table_name').notNull(),
  recordId: integer('record_id').notNull(),
  action: text('action').notNull(), // 'create', 'update', 'delete'
  oldValues: text('old_values'), // JSON
  newValues: text('new_values'), // JSON
  userId: integer('user_id'),
  ipAddress: text('ip_address'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});
```

### 6. DevExtreme Component Patterns

**Decision**: Follow inventory module grid/form patterns

**Rationale**:
- Constitution mandates DevExtreme exclusively
- Inventory module has mature patterns for grids, filters, forms
- Consistency aids user training

**Reference Patterns**:
- DataGrid: `src/app/inventory/lots/page.tsx`
- Form with validation: `src/app/quality/deviations/new/page.tsx`
- Master-detail: `src/app/production/work-orders/[id]/page.tsx`

### 7. Sanitation Schedule Design

**Decision**: Calendar-based recurring schedule with completion tracking

**Rationale**:
- Sanitation requires daily/weekly/monthly schedules by area
- Need trend analysis for compliance rates
- Simple pattern, no complex workflows

**Design Pattern**:
```
sanitation_schedules (recurring schedule definition)
  └── sanitation_logs (actual completion records)
        ├── area, method, operator
        ├── verifiedBy, verifiedAt
        └── notes, deviations
```

### 8. Internal Audit GMP Coverage

**Decision**: Checklist-based audits mapped to หมวด 1-10

**Rationale**:
- Thai FDA requires coverage of all GMP areas
- Auditors need structured checklists
- Findings must link to CAPA

**Design Pattern**:
```
audit_plans (annual plan covering all areas)
  └── audits (individual audit events)
        └── audit_checklists (items to verify)
        └── audit_findings (observations/findings)
              └── capa (linked corrective actions)
```

## Technology Decisions Summary

| Area | Decision | Rationale |
|------|----------|-----------|
| Database | Drizzle ORM dual-schema (SQLite/MySQL) | Existing pattern, test isolation |
| API | Next.js API routes with Zod validation | Existing pattern, type safety |
| UI | DevExtreme React grids/forms | Constitution mandate |
| State | TanStack Query for server state | Existing pattern |
| Workflow | Status enum with transition rules | Simple, auditable |
| Audit | Centralized audit_log table | Consistency |
| Authorization | Reuse hr_authorizations pattern | GMP separation of duties |

## Unresolved Items

None - all technical unknowns resolved through codebase analysis and GMP best practices.

## Next Steps

1. Generate data-model.md with detailed entity definitions
2. Generate API contracts in OpenAPI format
3. Create quickstart.md implementation guide

---

## Part 2: Integration Testing Research (2025-12-23)

**Purpose**: Establish patterns for real SQLite integration tests across all modules

### Research Task 1: Test Database Strategy

**Decision**: Use in-memory SQLite with Drizzle ORM schema sync for all integration tests

**Rationale**:
- In-memory SQLite `:memory:` is fast (no disk I/O), isolated (no cleanup between test runs), and disposable
- Drizzle ORM dual-schema pattern already exists in codebase (`src/lib/db/schema/sqlite/` and `src/lib/db/schema/mysql/`)
- Schema sync from Drizzle metadata ensures tests use identical schema to production
- WAL mode (`sqlite.pragma('journal_mode = WAL')`) enables concurrent reads during tests

**Alternatives Considered**:
1. **File-based SQLite** - Rejected because slower and requires cleanup
2. **Docker MySQL container** - Rejected because adds complexity and slower test startup
3. **Separate test database** - Rejected because harder to maintain schema parity

### Research Task 2: Schema Synchronization Method

**Decision**: Extract table definitions from Drizzle ORM using `getTableName()` and `getTableColumns()` APIs

**Rationale**:
- Drizzle ORM exposes table metadata through utility functions
- Automatically stays in sync with schema changes (no manual DDL maintenance)
- Supports all Drizzle column types with proper SQLite mapping
- Handles constraints (PRIMARY KEY, NOT NULL, UNIQUE, DEFAULT)

**Implementation Pattern** (from CAPA tests):
```typescript
import { getTableName, getTableColumns } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';

function generateCreateTableSql(table: SQLiteTable): string {
  const tableName = getTableName(table);
  const columns = getTableColumns(table);
  const columnDefs: string[] = [];

  for (const [key, column] of Object.entries(columns)) {
    const col = column as any;
    let def = `"${col.name}" `;

    // Map data type
    switch (col.dataType) {
      case 'string': def += 'TEXT'; break;
      case 'number': def += 'INTEGER'; break;
      case 'boolean': def += 'INTEGER'; break;
      default: def += 'TEXT';
    }

    if (col.primary) def += ' PRIMARY KEY';
    if (col.autoIncrement) def += ' AUTOINCREMENT';
    if (col.notNull && !col.primary) def += ' NOT NULL';
    if (col.hasDefault) def += ` DEFAULT ${formatDefault(col.default)}`;
    if (col.isUnique && !col.primary) def += ' UNIQUE';

    columnDefs.push(def);
  }

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (${columnDefs.join(', ')})`;
}
```

### Research Task 3: Database Mocking Strategy

**Decision**: Use `vi.mock()` to replace `@/lib/db` module with test database before service imports

**Rationale**:
- Services import database functions at module load time
- Mock must be established before dynamic imports
- Allows tests to use real service functions with controlled database

**Implementation Pattern**:
```typescript
let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

vi.mock('@/lib/db', async () => {
  return {
    isSqlite: () => true,
    getDb: async () => testDb,
    getSqliteDb: () => testDb,
    markSchemaSynced: () => {},
    schema,
  };
});

// Import services AFTER mock is set up
import { createRecord, listRecords } from '@/lib/services/module-service';
```

### Research Task 4: Test Data Lifecycle

**Decision**: Clean relevant tables and seed base data before each test in `beforeEach`

**Rationale**:
- Each test starts with known state
- Prevents test pollution (one test's data affecting another)
- Enables parallel test execution in future
- Base seed data (users) provides required FK references

**Implementation Pattern**:
```typescript
beforeAll(async () => {
  sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  testDb = drizzle(sqlite, { schema });
  syncSchemaFromDrizzle();
});

beforeEach(() => {
  cleanTables();  // DELETE FROM in correct order (FK dependencies)
  seedTestData(); // INSERT base records (users, reference data)
});

afterAll(() => {
  sqlite.close();
});
```

**Table Cleanup Order** (respect foreign key dependencies):
1. Child tables first (e.g., `capa_effectiveness`, `capa_actions`)
2. Parent tables last (e.g., `capa`, `users`)

### Research Task 5: Modules Requiring Integration Tests

| Module | Service File | Current Test Type | Gap |
|--------|--------------|-------------------|-----|
| CAPA | `capa-service.ts` | **Real SQLite** | None - already implemented |
| Complaints | `complaint-service.ts` | Mocked | Needs real SQLite tests |
| Documents | `document-service.ts` | Mocked | Needs real SQLite tests |
| Internal Audit | `internal-audit-service.ts` | Mocked | Needs real SQLite tests |
| Recalls | `recall-service.ts` | Mocked | Needs real SQLite tests |
| Sanitation | `sanitation-service.ts` | Mocked | Needs real SQLite tests |
| Stability | `stability-service.ts` | Mocked | Needs real SQLite tests |
| Inventory | `inventory.service.ts` | Mocked | Needs real SQLite tests |
| Production | `production.service.ts` | Mocked | Needs real SQLite tests |
| Quality | `quality.service.ts` | Mocked | Needs real SQLite tests |
| HR | `hr.service.ts` | None | Needs real SQLite tests |
| Sales | `sales.service.ts` | None | Needs real SQLite tests |
| Purchasing | `purchasing.service.ts` | None | Needs real SQLite tests |
| VMI Portal | `vmi-portal.service.ts` | Mocked API | Needs real SQLite tests |

### Research Task 6: Shared Test Helper Architecture

**Decision**: Create reusable helpers in `tests/helpers/` for database setup, schema sync, and seeding

**Rationale**:
- Reduces boilerplate across 15+ test files
- Ensures consistent setup patterns
- Makes adding new tests easier
- Centralizes schema sync logic for maintenance

**Proposed Helper Files**:

#### tests/helpers/test-db.ts
```typescript
export function setupTestDatabase(tables: SQLiteTable[]) {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  const db = drizzle(sqlite, { schema });

  for (const table of tables) {
    sqlite.exec(generateCreateTableSql(table));
  }

  return { sqlite, db };
}

export function cleanTables(sqlite: Database.Database, tableNames: string[]) {
  for (const name of tableNames) {
    sqlite.exec(`DELETE FROM ${name}`);
  }
}
```

#### tests/helpers/seed-data.ts
```typescript
export function seedTestUsers(sqlite: Database.Database) {
  sqlite.exec(`
    INSERT OR IGNORE INTO users (id, name, email, password, role, is_active)
    VALUES
      (1, 'QA Manager', 'qa@test.com', 'hash123', 'qa_manager', 1),
      (2, 'Production Supervisor', 'prod@test.com', 'hash123', 'supervisor', 1),
      (3, 'QC Analyst', 'qc@test.com', 'hash123', 'analyst', 1),
      (4, 'Warehouse Operator', 'warehouse@test.com', 'hash123', 'operator', 1),
      (5, 'Document Controller', 'doc@test.com', 'hash123', 'doc_controller', 1)
  `);
}
```

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Schema drift between SQLite and MySQL | Tests verify same Drizzle schema is used |
| Flaky tests from state leakage | Clean + seed in beforeEach |
| Slow tests from disk I/O | In-memory SQLite only |
| Missing FK constraints in SQLite | Explicit test for relationship integrity |
| Test maintenance burden | Shared helpers reduce duplication |

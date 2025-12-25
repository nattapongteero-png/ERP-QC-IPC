# Test Helpers

Shared utilities for integration tests with real SQLite database.

## Overview

These helpers provide reusable test infrastructure to reduce boilerplate across all service integration tests. The pattern ensures:

- **Real SQLite database** - No mocks, actual database operations
- **Schema sync from Drizzle ORM** - Test schema matches production
- **Clean isolation** - Each test starts with fresh data
- **Consistent test data** - Shared constants and seed functions

## Files

| File | Purpose |
|------|---------|
| `test-db.ts` | Database setup, cleanup, and mock creation |
| `schema-sync.ts` | Generate CREATE TABLE SQL from Drizzle schema |
| `seed-data.ts` | Test data factories for each module |
| `test-constants.ts` | Shared IDs, statuses, dates, and templates |

## Usage Pattern

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '@/tests/helpers/schema-sync';
import { seedTestUsers } from '@/tests/helpers/seed-data';
import { TEST_USER_IDS, TEST_DATES } from '@/tests/helpers/test-constants';

// 1. Declare database variables
let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

// 2. Mock the database module BEFORE importing service
vi.mock('@/lib/db', async () => {
  return {
    isSqlite: () => true,
    getDb: async () => testDb,
    getSqliteDb: () => testDb,
    markSchemaSynced: () => {},
    schema,
  };
});

// 3. Mock audit to avoid side effects
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

// 4. Import service AFTER mocking
import { myServiceFunction } from '@/lib/services/my-service';

describe('My Service Tests', () => {
  beforeAll(async () => {
    // 5. Create in-memory database
    sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    testDb = drizzle(sqlite, { schema });

    // 6. Create required tables
    const tables = [
      schema.sqliteUsers,
      schema.sqliteMyTable,
      // ... other tables
    ];
    for (const table of tables) {
      sqlite.exec(generateCreateTableSql(table));
    }

    // 7. Initial seed
    seedTestUsers(sqlite);
  });

  afterAll(() => {
    sqlite.close();
  });

  beforeEach(() => {
    // 8. Clean tables in FK order (children first)
    sqlite.exec('DELETE FROM my_table');
    sqlite.exec('DELETE FROM users');

    // 9. Re-seed for each test
    seedTestUsers(sqlite);
  });

  it('should do something', async () => {
    const result = await myServiceFunction();
    expect(result).toBeDefined();
  });
});
```

## Key Patterns

### 1. Mock Before Import

Always set up `vi.mock()` BEFORE importing the service:

```typescript
vi.mock('@/lib/db', async () => { /* ... */ });
vi.mock('@/lib/audit', () => { /* ... */ });

// Then import
import { myService } from '@/lib/services/my-service';
```

### 2. Table Creation Order

Create tables in FK dependency order (parents first):

```typescript
const tables = [
  schema.sqliteUsers,        // Parent
  schema.sqliteComplaints,   // Child (references users)
  schema.sqliteInvestigations, // Grandchild (references complaints)
];
```

### 3. Table Cleanup Order

Clean tables in reverse FK order (children first):

```typescript
sqlite.exec('DELETE FROM investigations');
sqlite.exec('DELETE FROM complaints');
sqlite.exec('DELETE FROM users');
```

### 4. Use Test Constants

Always use constants for IDs and dates:

```typescript
import { TEST_USER_IDS, TEST_DATES, COMPLAINT_TEMPLATE } from '@/tests/helpers/test-constants';

const complaint = await createComplaint({
  ...COMPLAINT_TEMPLATE,
  severity: 'critical',
}, TEST_USER_IDS.QA_MANAGER);
```

### 5. Real-World Scenarios

Structure tests as real workflows:

```typescript
describe('Scenario: Complete complaint lifecycle', () => {
  it('should handle receive -> investigate -> close flow', async () => {
    // Step 1: Create complaint
    const complaint = await createComplaint({ /* ... */ });
    expect(complaint.status).toBe('received');

    // Step 2: Route to QC
    const investigation = await routeToQC(complaint.id, qcAnalystId);
    expect(investigation.investigatorId).toBe(qcAnalystId);

    // Step 3: Record findings
    await recordInvestigation(complaint.id, { /* ... */ });

    // Step 4: Close
    const closed = await closeComplaint(complaint.id, 'Resolved');
    expect(closed.status).toBe('closed');
  });
});
```

## Module-Specific Seed Functions

| Function | Tables Seeded |
|----------|---------------|
| `seedCapaTestData()` | users, deviations |
| `seedComplaintTestData()` | users, items, inventory_lots |
| `seedDocumentTestData()` | users, document_types |
| `seedAuditTestData()` | users |
| `seedRecallTestData()` | users, items, inventory_lots |
| `seedSanitationTestData()` | users |
| `seedStabilityTestData()` | users, items, inventory_lots |

## Test Constants Reference

### User IDs
- `TEST_USER_IDS.QA_MANAGER` (1)
- `TEST_USER_IDS.PRODUCTION_SUPERVISOR` (2)
- `TEST_USER_IDS.QC_ANALYST` (3)
- `TEST_USER_IDS.DOCUMENT_CONTROLLER` (4)
- `TEST_USER_IDS.AUDITOR` (5)

### Product IDs
- `TEST_PRODUCT_IDS.PRODUCT_A` (1)
- `TEST_PRODUCT_IDS.PRODUCT_B` (2)
- `TEST_PRODUCT_IDS.RAW_MATERIAL` (3)

### Dates
- `TEST_DATES.TODAY` - Current date
- `TEST_DATES.PAST_DATE` - 1 year ago
- `TEST_DATES.FUTURE_DATE` - 1 year ahead
- `TEST_DATES.OVERDUE_DATE` - Far past (for overdue tests)

## Running Tests

```bash
# Run all integration tests
pnpm test tests/integration/

# Run specific module tests
pnpm test tests/integration/services/complaint-service-real.test.ts

# Run with coverage
pnpm test:coverage
```

## Adding New Module Tests

1. Identify required tables from the service
2. Add table constants to `schema-sync.ts` TABLE_GROUPS if needed
3. Add seed function to `seed-data.ts`
4. Add any new constants to `test-constants.ts`
5. Create test file following the pattern above

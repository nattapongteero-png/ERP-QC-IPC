# Database Wrapper Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate all 69 API routes from the legacy `(db as any)` pattern to use the new `db-helper.ts` abstraction layer.

**Architecture:** Replace direct database calls with the `executeDbOperation`, `getTableRef`, and `dbDate` helpers. The db-helper wraps SQLite/MySQL differences internally, eliminating manual type casts and database type checks throughout the codebase.

**Tech Stack:** TypeScript 5.x, Next.js 15 (App Router), Drizzle ORM, db-helper abstraction layer

---

## Migration Pattern Reference

### Before (Old Pattern)
```typescript
import { getDb, schema } from '@/lib/db';

const db = await getDb();
const useSqlite = process.env.DB_TYPE === 'sqlite';
const itemsTable = useSqlite ? schema.sqliteItems : schema.mysqlItems;

const result = await (db as any).select().from(itemsTable).where(eq(itemsTable.id, id));
```

### After (New Pattern)
```typescript
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';

const itemsTable = getTableRef('items');

const result = await executeDbOperation(async (db) => {
  return db.select().from(itemsTable).where(eq(itemsTable.id, id));
});
```

### Key Changes
1. **Import:** `@/lib/db` → `@/lib/db/db-helper`
2. **Table Reference:** `useSqlite ? schema.sqliteX : schema.mysqlX` → `getTableRef('x')`
3. **Database Call:** `(db as any).operation()` → `executeDbOperation(async (db) => db.operation())`
4. **Date Handling:** `isSqlite ? now.toISOString() : now` → `dbDate()`

---

## Batch 1: Core Customer & Vendor Routes (6 files)

### Task 1.1: Migrate `/api/customers/route.ts`

**Files:**
- Modify: `src/app/api/customers/route.ts`

**Step 1: Update imports**

Replace:
```typescript
import { getDb, schema } from '@/lib/db';
```

With:
```typescript
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';
```

**Step 2: Update GET handler**

Replace the database initialization and query pattern:
```typescript
const db = await getDb();
const useSqlite = process.env.DB_TYPE === 'sqlite';
const customersTable = useSqlite ? schema.sqliteCustomers : schema.mysqlCustomers;
// ...
const result = await (db as any).select()...
```

With:
```typescript
const customersTable = getTableRef('customers');

const result = await executeDbOperation(async (db) => {
  let query = db.select().from(customersTable);
  // Apply filters...
  return query;
});
```

**Step 3: Update POST handler**

Replace date handling:
```typescript
const now = new Date();
// ...
createdAt: useSqlite ? now.toISOString() : now,
updatedAt: useSqlite ? now.toISOString() : now,
```

With:
```typescript
const now = dbDate();
// ...
createdAt: now,
updatedAt: now,
```

**Step 4: Run lint to verify**

Run: `npm run lint -- --fix src/app/api/customers/route.ts`
Expected: No errors related to `@typescript-eslint/no-explicit-any`

**Step 5: Commit**

```bash
git add src/app/api/customers/route.ts
git commit -m "refactor(api): migrate customers route to db-helper"
```

---

### Task 1.2: Migrate `/api/customers/[id]/route.ts`

**Files:**
- Modify: `src/app/api/customers/[id]/route.ts`

**Step 1: Update imports**

Replace:
```typescript
import { db, getTableRef } from '@/lib/db/db-helper';
// Plus any remaining imports from @/lib/db
```

With only:
```typescript
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';
```

**Step 2: Remove unused old imports**

Remove any remaining:
```typescript
import { getDb } from '@/lib/db';
import { sqliteCustomers, mysqlCustomers, sqliteSalesOrders, mysqlSalesOrders } from '@/lib/db/schema';
```

**Step 3: Update GET handler**

Replace:
```typescript
const db = await getDb();
const isSqlite = process.env.DB_TYPE === 'sqlite';
const customers = isSqlite ? sqliteCustomers : mysqlCustomers;
const salesOrders = isSqlite ? sqliteSalesOrders : mysqlSalesOrders;

const customerResult = await (db as any).select().from(customers)...
```

With:
```typescript
const customersTable = getTableRef('customers');
const salesOrdersTable = getTableRef('salesOrders');

const customerResult = await executeDbOperation(async (db) => {
  return db.select().from(customersTable).where(eq(customersTable.id, customerId));
});
```

**Step 4: Update PUT handler with dbDate**

Replace:
```typescript
const now = new Date();
await (db as any).update(customers).set({
  // ...
  updatedAt: isSqlite ? now.toISOString() : now,
})
```

With:
```typescript
await executeDbOperation(async (db) => {
  return db.update(customersTable).set({
    // ...
    updatedAt: dbDate(),
  }).where(eq(customersTable.id, customerId));
});
```

**Step 5: Update DELETE handler**

Apply same pattern for all `(db as any)` calls.

**Step 6: Run lint to verify**

Run: `npm run lint -- --fix src/app/api/customers/[id]/route.ts`
Expected: No `@typescript-eslint/no-explicit-any` warnings

**Step 7: Commit**

```bash
git add src/app/api/customers/[id]/route.ts
git commit -m "refactor(api): migrate customers/[id] route to db-helper"
```

---

### Task 1.3: Migrate `/api/vendors/route.ts`

**Files:**
- Modify: `src/app/api/vendors/route.ts`

**Step 1: Update imports**

```typescript
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';
```

**Step 2: Update table references**

```typescript
const vendorsTable = getTableRef('vendors');
```

**Step 3: Wrap all database operations**

For each `(db as any)` call, wrap with `executeDbOperation`.

**Step 4: Replace date handling with dbDate()**

**Step 5: Run lint**

Run: `npm run lint -- --fix src/app/api/vendors/route.ts`

**Step 6: Commit**

```bash
git add src/app/api/vendors/route.ts
git commit -m "refactor(api): migrate vendors route to db-helper"
```

---

### Task 1.4: Migrate `/api/vendors/[id]/route.ts`

**Files:**
- Modify: `src/app/api/vendors/[id]/route.ts`

**Steps:** Follow same pattern as Task 1.3

**Commit:**
```bash
git add src/app/api/vendors/[id]/route.ts
git commit -m "refactor(api): migrate vendors/[id] route to db-helper"
```

---

### Task 1.5: Migrate `/api/vendors/[id]/vmi-config/route.ts`

**Files:**
- Modify: `src/app/api/vendors/[id]/vmi-config/route.ts`

**Additional table:**
```typescript
const vmiVendorConfigTable = getTableRef('vmiVendorConfig');
```

**Commit:**
```bash
git add src/app/api/vendors/[id]/vmi-config/route.ts
git commit -m "refactor(api): migrate vendors vmi-config route to db-helper"
```

---

### Task 1.6: Migrate `/api/vendors/[id]/vmi-config/test/route.ts`

**Files:**
- Modify: `src/app/api/vendors/[id]/vmi-config/test/route.ts`

**Commit:**
```bash
git add src/app/api/vendors/[id]/vmi-config/test/route.ts
git commit -m "refactor(api): migrate vendors vmi-config test route to db-helper"
```

---

## Batch 2: Items & Inventory Routes (10 files)

### Task 2.1: Migrate `/api/items/route.ts`

**Files:**
- Modify: `src/app/api/items/route.ts`

**Step 1: Update imports**

```typescript
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';
```

**Step 2: Replace table reference**

```typescript
const itemsTable = getTableRef('items');
```

**Step 3: Wrap queries with executeDbOperation**

Replace:
```typescript
let baseQuery = (db as any).select().from(itemsTable);
```

With:
```typescript
const items = await executeDbOperation(async (db) => {
  let query = db.select().from(itemsTable);

  // Apply conditions
  if (conditions.length > 0) {
    const whereClause = conditions.reduce((acc, cond, i) =>
      i === 0 ? cond : sql`${acc} AND ${cond}`
    );
    query = query.where(whereClause);
  }

  // Apply pagination
  return query.limit(pagination.limit).offset(offset);
});
```

**Step 4: Handle count query separately**

```typescript
const total = await executeDbOperation(async (db) => {
  let countQuery = db.select({ count: sql`count(*)` }).from(itemsTable);
  if (conditions.length > 0) {
    countQuery = countQuery.where(whereClause);
  }
  const result = await countQuery;
  return Number(result[0]?.count || 0);
});
```

**Step 5: Update POST handler**

Replace `lastInsertRowid` handling - keep database-specific ID extraction:
```typescript
const result = await executeDbOperation(async (db) => {
  return db.insert(itemsTable).values({...});
});

const itemId = process.env.DB_TYPE === 'sqlite'
  ? result.lastInsertRowid
  : result[0].insertId;
```

Note: `lastInsertRowid` vs `insertId` is a Drizzle return value difference that must stay.

**Step 6: Run lint**

Run: `npm run lint -- --fix src/app/api/items/route.ts`

**Step 7: Commit**

```bash
git add src/app/api/items/route.ts
git commit -m "refactor(api): migrate items route to db-helper"
```

---

### Task 2.2: Migrate `/api/items/[id]/route.ts`

**Files:**
- Modify: `src/app/api/items/[id]/route.ts`

**Commit:**
```bash
git add src/app/api/items/[id]/route.ts
git commit -m "refactor(api): migrate items/[id] route to db-helper"
```

---

### Task 2.3: Migrate `/api/items/[id]/detail/route.ts`

**Files:**
- Modify: `src/app/api/items/[id]/detail/route.ts`

**Commit:**
```bash
git add src/app/api/items/[id]/detail/route.ts
git commit -m "refactor(api): migrate items/[id]/detail route to db-helper"
```

---

### Task 2.4: Migrate `/api/item-categories/route.ts`

**Files:**
- Modify: `src/app/api/item-categories/route.ts`

**Table:**
```typescript
const itemCategoriesTable = getTableRef('itemCategories');
```

**Commit:**
```bash
git add src/app/api/item-categories/route.ts
git commit -m "refactor(api): migrate item-categories route to db-helper"
```

---

### Task 2.5: Migrate `/api/item-units/route.ts`

**Files:**
- Modify: `src/app/api/item-units/route.ts`

**Table:**
```typescript
const itemUnitsTable = getTableRef('itemUnits');
```

**Commit:**
```bash
git add src/app/api/item-units/route.ts
git commit -m "refactor(api): migrate item-units route to db-helper"
```

---

### Task 2.6: Migrate `/api/inventory/lots/route.ts`

**Files:**
- Modify: `src/app/api/inventory/lots/route.ts`

**Tables:**
```typescript
const lotsTable = getTableRef('inventoryLots');
const itemsTable = getTableRef('items');
const warehousesTable = getTableRef('warehouses');
```

**Commit:**
```bash
git add src/app/api/inventory/lots/route.ts
git commit -m "refactor(api): migrate inventory/lots route to db-helper"
```

---

### Task 2.7: Migrate `/api/inventory/lots/[id]/route.ts`

**Files:**
- Modify: `src/app/api/inventory/lots/[id]/route.ts`

**Commit:**
```bash
git add src/app/api/inventory/lots/[id]/route.ts
git commit -m "refactor(api): migrate inventory/lots/[id] route to db-helper"
```

---

### Task 2.8: Migrate `/api/inventory/lots/[id]/status/route.ts`

**Files:**
- Modify: `src/app/api/inventory/lots/[id]/status/route.ts`

**Commit:**
```bash
git add src/app/api/inventory/lots/[id]/status/route.ts
git commit -m "refactor(api): migrate inventory/lots/[id]/status route to db-helper"
```

---

### Task 2.9: Migrate `/api/inventory/transactions/route.ts`

**Files:**
- Modify: `src/app/api/inventory/transactions/route.ts`

**Table:**
```typescript
const transactionsTable = getTableRef('inventoryTransactions');
```

**Commit:**
```bash
git add src/app/api/inventory/transactions/route.ts
git commit -m "refactor(api): migrate inventory/transactions route to db-helper"
```

---

### Task 2.10: Migrate `/api/warehouses/route.ts` and related

**Files:**
- Modify: `src/app/api/warehouses/route.ts`
- Modify: `src/app/api/warehouses/[id]/route.ts`
- Modify: `src/app/api/warehouses/[id]/detail/route.ts`

**Table:**
```typescript
const warehousesTable = getTableRef('warehouses');
```

**Commit:**
```bash
git add src/app/api/warehouses/
git commit -m "refactor(api): migrate warehouses routes to db-helper"
```

---

## Batch 3: Sales Routes (6 files)

### Task 3.1: Migrate `/api/sales/orders/route.ts`

**Files:**
- Modify: `src/app/api/sales/orders/route.ts`

**Tables:**
```typescript
const salesOrdersTable = getTableRef('salesOrders');
const salesOrderItemsTable = getTableRef('salesOrderItems');
const customersTable = getTableRef('customers');
```

**Commit:**
```bash
git add src/app/api/sales/orders/route.ts
git commit -m "refactor(api): migrate sales/orders route to db-helper"
```

---

### Task 3.2: Migrate `/api/sales/orders/[id]/detail/route.ts`

**Files:**
- Modify: `src/app/api/sales/orders/[id]/detail/route.ts`

**Commit:**
```bash
git add src/app/api/sales/orders/[id]/detail/route.ts
git commit -m "refactor(api): migrate sales/orders/[id]/detail route to db-helper"
```

---

### Task 3.3: Migrate `/api/sales/vmi-orders/[orderId]/route.ts`

**Files:**
- Modify: `src/app/api/sales/vmi-orders/[orderId]/route.ts`

**Special handling:** This file imports VMI-specific tables directly:
```typescript
// Replace
import { sqliteVmiSalesOrders, mysqlVmiSalesOrders } from '@/lib/db/schema';

// With
const vmiSalesOrdersTable = getTableRef('vmiSalesOrders');
```

**Commit:**
```bash
git add src/app/api/sales/vmi-orders/[orderId]/route.ts
git commit -m "refactor(api): migrate sales/vmi-orders route to db-helper"
```

---

### Task 3.4: Migrate `/api/sales/vmi-orders/[orderId]/lines/[lineId]/match/route.ts`

**Files:**
- Modify: `src/app/api/sales/vmi-orders/[orderId]/lines/[lineId]/match/route.ts`

**Commit:**
```bash
git add src/app/api/sales/vmi-orders/[orderId]/lines/[lineId]/match/route.ts
git commit -m "refactor(api): migrate sales/vmi-orders line match route to db-helper"
```

---

## Batch 4: Purchasing Routes (12 files)

### Task 4.1: Migrate `/api/purchasing/orders/route.ts`

**Files:**
- Modify: `src/app/api/purchasing/orders/route.ts`

**Tables:**
```typescript
const purchaseOrdersTable = getTableRef('purchaseOrders');
const purchaseOrderItemsTable = getTableRef('purchaseOrderItems');
const vendorsTable = getTableRef('vendors');
```

**Commit:**
```bash
git add src/app/api/purchasing/orders/route.ts
git commit -m "refactor(api): migrate purchasing/orders route to db-helper"
```

---

### Task 4.2: Migrate `/api/purchasing/orders/[id]/detail/route.ts`

**Commit:**
```bash
git add src/app/api/purchasing/orders/[id]/detail/route.ts
git commit -m "refactor(api): migrate purchasing/orders/[id]/detail route to db-helper"
```

---

### Task 4.3: Migrate `/api/purchasing/orders/[id]/receive/route.ts`

**Commit:**
```bash
git add src/app/api/purchasing/orders/[id]/receive/route.ts
git commit -m "refactor(api): migrate purchasing/orders/[id]/receive route to db-helper"
```

---

### Task 4.4: Migrate VMI purchasing routes

**Files:**
- Modify: `src/app/api/purchasing/vmi/transactions/route.ts`
- Modify: `src/app/api/purchasing/vmi/transactions/[id]/route.ts`
- Modify: `src/app/api/purchasing/vmi/orders/route.ts`
- Modify: `src/app/api/purchasing/vmi/orders/[id]/route.ts`
- Modify: `src/app/api/purchasing/vmi/orders/[id]/receipt-status/route.ts`
- Modify: `src/app/api/purchasing/vmi/dashboard/route.ts`

**Tables:**
```typescript
const vmiTransactionsTable = getTableRef('vmiTransactions');
const vmiOrdersTable = getTableRef('vmiOrders');
```

**Commit:**
```bash
git add src/app/api/purchasing/vmi/
git commit -m "refactor(api): migrate purchasing/vmi routes to db-helper"
```

---

### Task 4.5: Migrate VMI sync routes

**Files:**
- Modify: `src/app/api/purchasing/vmi/sync/inventory/route.ts`
- Modify: `src/app/api/purchasing/vmi/sync/items/route.ts`
- Modify: `src/app/api/purchasing/vmi/sync/prices/route.ts`

**Commit:**
```bash
git add src/app/api/purchasing/vmi/sync/
git commit -m "refactor(api): migrate purchasing/vmi/sync routes to db-helper"
```

---

### Task 4.6: Migrate VMI cron routes

**Files:**
- Modify: `src/app/api/purchasing/vmi/cron/sync-inventory/route.ts`
- Modify: `src/app/api/purchasing/vmi/cron/poll-orders/route.ts`

**Commit:**
```bash
git add src/app/api/purchasing/vmi/cron/
git commit -m "refactor(api): migrate purchasing/vmi/cron routes to db-helper"
```

---

## Batch 5: Production Routes (8 files)

### Task 5.1: Migrate `/api/production/work-orders/route.ts`

**Files:**
- Modify: `src/app/api/production/work-orders/route.ts`

**Tables:**
```typescript
const workOrdersTable = getTableRef('workOrders');
const workOrderMaterialsTable = getTableRef('workOrderMaterials');
const itemsTable = getTableRef('items');
```

**Commit:**
```bash
git add src/app/api/production/work-orders/route.ts
git commit -m "refactor(api): migrate production/work-orders route to db-helper"
```

---

### Task 5.2: Migrate work order detail routes

**Files:**
- Modify: `src/app/api/production/work-orders/[id]/detail/route.ts`
- Modify: `src/app/api/production/work-orders/[id]/status/route.ts`
- Modify: `src/app/api/production/work-orders/[id]/materials/route.ts`
- Modify: `src/app/api/production/work-orders/[id]/qc-tests/route.ts`

**Commit:**
```bash
git add src/app/api/production/work-orders/[id]/
git commit -m "refactor(api): migrate production/work-orders/[id] routes to db-helper"
```

---

### Task 5.3: Migrate batch records routes

**Files:**
- Modify: `src/app/api/production/batch-records/route.ts`
- Modify: `src/app/api/production/batch-records/[id]/route.ts`

**Table:**
```typescript
const batchRecordsTable = getTableRef('batchRecords');
```

**Commit:**
```bash
git add src/app/api/production/batch-records/
git commit -m "refactor(api): migrate production/batch-records routes to db-helper"
```

---

## Batch 6: Quality Routes (8 files)

### Task 6.1: Migrate QC tests routes

**Files:**
- Modify: `src/app/api/quality/tests/route.ts`
- Modify: `src/app/api/quality/tests/[id]/detail/route.ts`
- Modify: `src/app/api/quality/tests/[id]/result/route.ts`

**Tables:**
```typescript
const qcTestsTable = getTableRef('qcTests');
const qcTestResultsTable = getTableRef('qcTestResults');
```

**Commit:**
```bash
git add src/app/api/quality/tests/
git commit -m "refactor(api): migrate quality/tests routes to db-helper"
```

---

### Task 6.2: Migrate QC specs routes

**Files:**
- Modify: `src/app/api/quality/specs/route.ts`
- Modify: `src/app/api/quality/specs/[id]/route.ts`

**Table:**
```typescript
const qualitySpecsTable = getTableRef('qualitySpecs');
```

**Commit:**
```bash
git add src/app/api/quality/specs/
git commit -m "refactor(api): migrate quality/specs routes to db-helper"
```

---

### Task 6.3: Migrate deviations routes

**Files:**
- Modify: `src/app/api/quality/deviations/route.ts`
- Modify: `src/app/api/quality/deviations/[id]/route.ts`
- Modify: `src/app/api/quality/deviations/[id]/detail/route.ts`

**Tables:**
```typescript
const deviationsTable = getTableRef('deviations');
const usersTable = getTableRef('users');
```

**Commit:**
```bash
git add src/app/api/quality/deviations/
git commit -m "refactor(api): migrate quality/deviations routes to db-helper"
```

---

## Batch 7: BOM Routes (2 files)

### Task 7.1: Migrate BOM routes

**Files:**
- Modify: `src/app/api/bom/route.ts`
- Modify: `src/app/api/bom/[id]/route.ts`

**Tables:**
```typescript
const bomTable = getTableRef('bom');
const bomItemsTable = getTableRef('bomItems');
```

**Commit:**
```bash
git add src/app/api/bom/
git commit -m "refactor(api): migrate bom routes to db-helper"
```

---

## Batch 8: Auth & Users Routes (3 files)

### Task 8.1: Migrate `/api/auth/login/route.ts`

**Files:**
- Modify: `src/app/api/auth/login/route.ts`

**Special handling:** Login may use specific user table references:
```typescript
const usersTable = getTableRef('users');
```

**Commit:**
```bash
git add src/app/api/auth/login/route.ts
git commit -m "refactor(api): migrate auth/login route to db-helper"
```

---

### Task 8.2: Migrate users routes

**Files:**
- Modify: `src/app/api/users/route.ts`
- Modify: `src/app/api/users/[id]/route.ts`

**Commit:**
```bash
git add src/app/api/users/
git commit -m "refactor(api): migrate users routes to db-helper"
```

---

## Batch 9: Dashboard & Reports Routes (12 files)

### Task 9.1: Migrate `/api/dashboard/route.ts`

**Files:**
- Modify: `src/app/api/dashboard/route.ts`

**Step 1: Update imports**

```typescript
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
```

**Step 2: Replace all table references**

```typescript
const itemsTable = getTableRef('items');
const lotsTable = getTableRef('inventoryLots');
const workOrdersTable = getTableRef('workOrders');
const poTable = getTableRef('purchaseOrders');
const soTable = getTableRef('salesOrders');
const deviationsTable = getTableRef('deviations');
const warehousesTable = getTableRef('warehouses');
```

**Step 3: Wrap Promise.all queries**

```typescript
const [
  itemsCount,
  lotsInQuarantine,
  // ...
] = await executeDbOperation(async (db) => {
  return Promise.all([
    db.select({ count: sql`count(*)` })
      .from(itemsTable)
      .where(eq(itemsTable.isActive, true))
      .then((r: any) => Number(r[0]?.count || 0)),
    // ... other queries
  ]);
});
```

**Step 4: Run lint**

Run: `npm run lint -- --fix src/app/api/dashboard/route.ts`

**Step 5: Commit**

```bash
git add src/app/api/dashboard/route.ts
git commit -m "refactor(api): migrate dashboard route to db-helper"
```

---

### Task 9.2: Migrate report templates routes

**Files:**
- Modify: `src/app/api/reports/templates/route.ts`
- Modify: `src/app/api/reports/templates/[code]/route.ts`
- Modify: `src/app/api/reports/templates/[code]/publish/route.ts`
- Modify: `src/app/api/reports/templates/[code]/unpublish/route.ts`
- Modify: `src/app/api/reports/templates/[code]/permissions/route.ts`

**Tables:**
```typescript
const reportTemplatesTable = getTableRef('reportTemplates');
const reportPermissionsTable = getTableRef('reportPermissions');
```

**Commit:**
```bash
git add src/app/api/reports/templates/
git commit -m "refactor(api): migrate reports/templates routes to db-helper"
```

---

### Task 9.3: Migrate report categories routes

**Files:**
- Modify: `src/app/api/reports/categories/route.ts`
- Modify: `src/app/api/reports/categories/[id]/route.ts`

**Table:**
```typescript
const reportCategoriesTable = getTableRef('reportCategories');
```

**Commit:**
```bash
git add src/app/api/reports/categories/
git commit -m "refactor(api): migrate reports/categories routes to db-helper"
```

---

### Task 9.4: Migrate report data routes

**Files:**
- Modify: `src/app/api/reports/data/production-summary/route.ts`
- Modify: `src/app/api/reports/data/lot-status/route.ts`
- Modify: `src/app/api/reports/data/inventory-valuation/route.ts`

**Commit:**
```bash
git add src/app/api/reports/data/
git commit -m "refactor(api): migrate reports/data routes to db-helper"
```

---

## Batch 10: VMI Lookup Routes (2 files)

### Task 10.1: Migrate VMI lookup routes

**Files:**
- Modify: `src/app/api/vmi/lookup/tpp/route.ts`
- Modify: `src/app/api/vmi/lookup/ttmt/route.ts`

**Commit:**
```bash
git add src/app/api/vmi/lookup/
git commit -m "refactor(api): migrate vmi/lookup routes to db-helper"
```

---

## Final Verification

### Task 11.1: Run full lint check

**Step 1: Run ESLint on all API routes**

Run: `npm run lint -- src/app/api/`
Expected: No `@typescript-eslint/no-explicit-any` warnings from `(db as any)` patterns

**Step 2: Search for remaining patterns**

Run: `grep -r "(db as any)" src/app/api/ | wc -l`
Expected: 0

**Step 3: Search for old imports**

Run: `grep -r "from '@/lib/db'" src/app/api/ | grep -v "db-helper" | wc -l`
Expected: 0 (no files importing directly from @/lib/db without db-helper)

---

### Task 11.2: Run tests

**Step 1: Run test suite**

Run: `npm test`
Expected: All tests pass

**Step 2: Run type check**

Run: `npm run build`
Expected: No TypeScript errors

---

### Task 11.3: Final commit

```bash
git add -A
git commit -m "refactor(api): complete database wrapper migration

- Migrated 69 API routes to use db-helper abstraction
- Eliminated all (db as any) type casts
- Standardized on getTableRef, executeDbOperation, dbDate
- Removed direct schema imports from API routes
"
```

---

## Quick Reference: Table Name Mappings

| API Entity | getTableRef Name |
|------------|------------------|
| customers | `'customers'` |
| vendors | `'vendors'` |
| items | `'items'` |
| inventoryLots | `'inventoryLots'` |
| inventoryTransactions | `'inventoryTransactions'` |
| warehouses | `'warehouses'` |
| itemCategories | `'itemCategories'` |
| itemUnits | `'itemUnits'` |
| salesOrders | `'salesOrders'` |
| salesOrderItems | `'salesOrderItems'` |
| purchaseOrders | `'purchaseOrders'` |
| purchaseOrderItems | `'purchaseOrderItems'` |
| workOrders | `'workOrders'` |
| workOrderMaterials | `'workOrderMaterials'` |
| batchRecords | `'batchRecords'` |
| qcTests | `'qcTests'` |
| qcTestResults | `'qcTestResults'` |
| qualitySpecs | `'qualitySpecs'` |
| deviations | `'deviations'` |
| bom | `'bom'` |
| bomItems | `'bomItems'` |
| users | `'users'` |
| reportTemplates | `'reportTemplates'` |
| reportCategories | `'reportCategories'` |
| reportPermissions | `'reportPermissions'` |
| vmiVendorConfig | `'vmiVendorConfig'` |
| vmiSalesOrders | `'vmiSalesOrders'` |
| vmiTransactions | `'vmiTransactions'` |
| vmiOrders | `'vmiOrders'` |

---

## Notes for Implementer

1. **Preserve business logic:** Only change the database access pattern, not the query logic itself.

2. **Keep lastInsertRowid/insertId handling:** The ID extraction after INSERT is Drizzle-specific and must remain database-type aware:
   ```typescript
   const id = process.env.DB_TYPE === 'sqlite'
     ? result.lastInsertRowid
     : result[0].insertId;
   ```

3. **Test each batch:** After migrating each batch, run `npm run lint` and `npm test` to catch issues early.

4. **Commit frequently:** Each task should result in a commit. This makes rollback easy if issues arise.

5. **eslint-disable comments:** Remove any `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments that were added for `(db as any)` - they're no longer needed.

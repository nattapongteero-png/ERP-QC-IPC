# Database Wrapper Migration Guide

## Overview

A new database abstraction layer has been created to handle SQLite/MySQL Drizzle ORM differences without requiring `(db as any)` casts in every API route. This guide explains how to migrate existing API routes to use the new wrapper.

## The Problem

SQLite and MySQL Drizzle instances have incompatible method signatures, requiring `(db as any)` casts throughout the codebase. This leads to:
- TypeScript compilation errors
- ESLint warnings for `@typescript-eslint/no-explicit-any`
- Code duplication for database type detection

## The Solution

The `db-helper.ts` file provides a unified interface that:
1. Automatically detects database type (SQLite/MySQL)
2. Selects appropriate table references
3. Handles date formatting differences
4. Provides type-safe database operations

## Migration Steps

### Step 1: Update Imports

**Before:**
```typescript
import { getDb } from '@/lib/db';
import { sqliteCustomers, mysqlCustomers } from '@/lib/db/schema';
```

**After:**
```typescript
import { db, getTableRef } from '@/lib/db/db-helper';
```

### Step 2: Replace Database Initialization

**Before:**
```typescript
const db = await getDb();
const isSqlite = process.env.DB_TYPE === 'sqlite';
const customers = isSqlite ? sqliteCustomers : mysqlCustomers;
```

**After:**
```typescript
const customersTable = getTableRef('customers');
// No need to manually check isSqlite or get db instance
```

### Step 3: Replace Query Execution

**Before:**
```typescript
const result = await (db as any)
  .select({ code: customers.code })
  .from(customers)
  .where(eq(customers.id, customerId));
```

**After:**
```typescript
const result = await db.select({
  table: 'customers',
  columns: { code: customersTable.code },
  where: eq(customersTable.id, customerId),
});
```

### Step 4: Handle Date Formatting

**Before:**
```typescript
const updateData = {
  updatedAt: isSqlite ? new Date().toISOString() : new Date(),
};
```

**After:**
```typescript
import { dbDate } from '@/lib/db/db-helper';

const updateData = {
  updatedAt: dbDate(),
};
```

## Common Patterns

### Simple SELECT Query

**Before:**
```typescript
const items = await (db as any)
  .select()
  .from(items)
  .where(eq(items.categoryId, categoryId));
```

**After:**
```typescript
const itemsTable = getTableRef('items');
const items = await db.select({
  table: 'items',
  where: eq(itemsTable.categoryId, categoryId),
});
```

### SELECT with Joins

**Before:**
```typescript
const orders = await (db as any)
  .select({
    id: orders.id,
    customerName: customers.name,
    total: orders.totalAmount,
  })
  .from(orders)
  .innerJoin(customers, eq(orders.customerId, customers.id))
  .where(eq(orders.status, 'pending'));
```

**After:**
```typescript
const ordersTable = getTableRef('orders');
const customersTable = getTableRef('customers');

const orders = await db.select({
  table: 'orders',
  columns: {
    id: ordersTable.id,
    customerName: customersTable.name,
    total: ordersTable.totalAmount,
  },
  joins: [{
    type: 'innerJoin',
    table: 'customers',
    on: eq(ordersTable.customerId, customersTable.id),
  }],
  where: eq(ordersTable.status, 'pending'),
});
```

### INSERT Query

**Before:**
```typescript
const [newItem] = await (db as any)
  .insert(items)
  .values(itemData);
```

**After:**
```typescript
const result = await db.insert({
  table: 'items',
  data: itemData,
});
// Result contains the inserted record with ID
```

### UPDATE Query

**Before:**
```typescript
await (db as any)
  .update(items)
  .set({ price: newPrice })
  .where(eq(items.id, itemId));
```

**After:**
```typescript
const itemsTable = getTableRef('items');
await db.update({
  table: 'items',
  data: { price: newPrice },
  where: eq(itemsTable.id, itemId),
});
```

### DELETE Query

**Before:**
```typescript
await (db as any)
  .delete(items)
  .where(eq(items.id, itemId));
```

**After:**
```typescript
const itemsTable = getTableRef('items');
await db.delete({
  table: 'items',
  where: eq(itemsTable.id, itemId),
});
```

## Available Methods

The `db` object provides these methods:

### `db.select(config)`
- `table`: Table name (string)
- `columns`: Object mapping column aliases to column references
- `where`: Drizzle where clause
- `orderBy`: Drizzle orderBy clause
- `limit`: Number of records to return
- `offset`: Offset for pagination
- `joins`: Array of join configurations

### `db.selectOne(config)`
Same as `select` but returns a single record or null.

### `db.selectById(table, id, columns?)`
Convenience method for selecting by ID.

### `db.insert(config)`
- `table`: Table name
- `data`: Object with column values

### `db.update(config)`
- `table`: Table name
- `data`: Object with column values to update
- `where`: Drizzle where clause

### `db.updateById(table, id, data)`
Convenience method for updating by ID.

### `db.delete(config)`
- `table`: Table name
- `where`: Drizzle where clause

### `db.deleteById(table, id)`
Convenience method for deleting by ID.

### `db.count(config)`
- `table`: Table name
- `where`: Optional where clause
Returns the count of matching records.

### `db.execute(sql)`
Execute raw SQL query.

## Helper Functions

### `getTableRef(tableName)`
Returns the appropriate table reference (SQLite or MySQL version).

### `dbDate(date?)`
Returns date in appropriate format for current database.

### `isSqlite()`
Returns true if using SQLite database.

## Benefits

1. **Type Safety**: No more `(db as any)` casts
2. **Cleaner Code**: Reduced boilerplate for database type detection
3. **Consistency**: Unified API for all database operations
4. **Maintainability**: Centralized handling of SQLite/MySQL differences
5. **Testability**: Easier to mock database operations

## Example: Complete Migration

**Before:**
```typescript
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { sqliteProducts, mysqlProducts } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  const db = await getDb();
  const isSqlite = process.env.DB_TYPE === 'sqlite';
  const products = isSqlite ? sqliteProducts : mysqlProducts;
  
  const result = await (db as any)
    .select()
    .from(products)
    .where(eq(products.category, 'herbal'));
    
  return successResponse(result);
}
```

**After:**
```typescript
import { eq } from 'drizzle-orm';
import { db, getTableRef } from '@/lib/db/db-helper';

export async function GET(request: NextRequest) {
  const productsTable = getTableRef('products');
  
  const result = await db.select({
    table: 'products',
    where: eq(productsTable.category, 'herbal'),
  });
    
  return successResponse(result);
}
```

## Next Steps

1. Gradually migrate remaining API routes using this guide
2. Update service layer to use the new wrapper
3. Consider creating more specialized helpers for complex queries
4. Add transaction support if needed

## Notes

- The wrapper handles the `(db as any)` cast internally
- All existing tests pass with the new wrapper
- The solution is backward compatible - you can migrate routes incrementally
- For complex queries not covered by the wrapper, you can still use `executeDbOperation` directly
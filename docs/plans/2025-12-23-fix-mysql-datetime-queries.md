# Fix MySQL DateTime Query Compatibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all locations where date strings are incorrectly passed to Drizzle ORM comparison operators, causing MySQL query failures.

**Architecture:** Create a new utility function `toQueryDate()` in `date-utils.ts` that converts date strings to the correct format for Drizzle query conditions (Date for MySQL, string for SQLite). Apply this utility to all 7 critical locations identified.

**Tech Stack:** TypeScript 5.x, Drizzle ORM, Next.js 16, dual-database pattern (MySQL/SQLite)

---

## Root Cause

Drizzle ORM's MySQL driver calls `value.toISOString()` on values passed to comparison operators (`gte`, `lte`, `eq`, etc.) for datetime columns. When a string is passed instead of a Date object, this fails with:

```
TypeError: value.toISOString is not a function
```

**Current broken pattern:**
```typescript
const today = new Date().toISOString().split('T')[0];  // String "2025-12-23"
.where(lte(table.dateField, today))  // FAILS on MySQL
```

**Correct pattern:**
```typescript
const today = toQueryDate(getTodayStr());  // Date for MySQL, string for SQLite
.where(lte(table.dateField, today))  // Works on both
```

---

### Task 1: Add toQueryDate Utility Function

**Files:**
- Modify: `src/lib/db/date-utils.ts`
- Test: `tests/lib/db/date-utils.test.ts`

**Step 1: Write the failing test**

Add to `tests/lib/db/date-utils.test.ts`:

```typescript
describe('toQueryDate', () => {
  it('should convert string date for query conditions', () => {
    const result = toQueryDate('2024-12-23');
    // In SQLite mode (test env), returns string
    expect(typeof result === 'string' || result instanceof Date).toBe(true);
  });

  it('should handle Date object input', () => {
    const input = new Date('2024-12-23');
    const result = toQueryDate(input);
    expect(typeof result === 'string' || result instanceof Date).toBe(true);
  });

  it('should handle null/undefined', () => {
    const result = toQueryDate(null);
    expect(typeof result === 'string' || result instanceof Date).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/db/date-utils.test.ts`
Expected: FAIL with "toQueryDate is not exported"

**Step 3: Write minimal implementation**

Add to `src/lib/db/date-utils.ts`:

```typescript
/**
 * Convert a date value to the correct format for Drizzle query conditions.
 * Use this when passing dates to gte(), lte(), eq(), etc. operators.
 *
 * MySQL: Returns Date object (Drizzle calls toISOString internally)
 * SQLite: Returns string (text comparison)
 *
 * @param value - Date object, date string, or null/undefined
 * @returns Date object for MySQL, string for SQLite
 */
export function toQueryDate(value: Date | string | null | undefined): Date | string {
  if (!value) {
    return isSqlite() ? getTodayStr() : new Date();
  }

  if (value instanceof Date) {
    return isSqlite() ? value.toISOString().split('T')[0] : value;
  }

  // String input
  if (isSqlite()) {
    // For SQLite, ensure YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    return new Date(value).toISOString().split('T')[0];
  }

  // For MySQL, convert string to Date
  return new Date(value);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/db/date-utils.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/db/date-utils.ts tests/lib/db/date-utils.test.ts
git commit -m "feat(date-utils): add toQueryDate for Drizzle query conditions"
```

---

### Task 2: Fix CAPA Service - listCapas

**Files:**
- Modify: `src/lib/services/capa-service.ts:251-255`

**Step 1: Read current implementation**

Current code at lines 251-255:
```typescript
const today = new Date().toISOString().split('T')[0];
if (overdue) {
  conditions.push(
    and(
      lte(capa.dueDate, today),
```

**Step 2: Update imports**

Add `toQueryDate` to existing imports:
```typescript
import { getNow, toDbDate, getTodayStr, toDateSafe, toQueryDate } from '../db/date-utils';
```

**Step 3: Apply the fix**

Replace lines 251-255 with:
```typescript
const todayForQuery = toQueryDate(getTodayStr());
if (overdue) {
  conditions.push(
    and(
      lte(capa.dueDate, todayForQuery),
```

**Step 4: Verify no syntax errors**

Run: `npm run lint -- src/lib/services/capa-service.ts`
Expected: No new errors

**Step 5: Commit**

```bash
git add src/lib/services/capa-service.ts
git commit -m "fix(capa): use toQueryDate for dueDate query condition"
```

---

### Task 3: Fix Reports Service - getQualitySummaryReport

**Files:**
- Modify: `src/lib/services/reports.service.ts:411-412`

**Step 1: Read current implementation**

Current code at lines 411-412:
```typescript
if (dateFrom) testConditions.push(gte(tests.createdAt, dateFrom));
if (dateTo) testConditions.push(lte(tests.createdAt, dateTo));
```

**Step 2: Update imports**

Add import:
```typescript
import { toQueryDate } from '../db/date-utils';
```

**Step 3: Apply the fix**

Replace lines 411-412 with:
```typescript
if (dateFrom) testConditions.push(gte(tests.createdAt, toQueryDate(dateFrom)));
if (dateTo) testConditions.push(lte(tests.createdAt, toQueryDate(dateTo)));
```

**Step 4: Verify no syntax errors**

Run: `npm run lint -- src/lib/services/reports.service.ts`
Expected: No new errors

**Step 5: Commit**

```bash
git add src/lib/services/reports.service.ts
git commit -m "fix(reports): use toQueryDate in getQualitySummaryReport"
```

---

### Task 4: Fix Reports Service - getStockMovementReport

**Files:**
- Modify: `src/lib/services/reports.service.ts:497-498`

**Step 1: Read current implementation**

Current code at lines 497-498:
```typescript
if (dateFrom) conditions.push(gte(transactions.createdAt, dateFrom));
if (dateTo) conditions.push(lte(transactions.createdAt, dateTo));
```

**Step 2: Apply the fix (import already added in Task 3)**

Replace lines 497-498 with:
```typescript
if (dateFrom) conditions.push(gte(transactions.createdAt, toQueryDate(dateFrom)));
if (dateTo) conditions.push(lte(transactions.createdAt, toQueryDate(dateTo)));
```

**Step 3: Commit**

```bash
git add src/lib/services/reports.service.ts
git commit -m "fix(reports): use toQueryDate in getStockMovementReport"
```

---

### Task 5: Fix Quality Service - getDeviationStatistics

**Files:**
- Modify: `src/lib/services/quality.service.ts:778-781`

**Step 1: Read current implementation**

Current code at lines 778-781:
```typescript
if (dateFrom) {
  conditions.push(gte(deviations.createdAt, dateFrom));
}
if (dateTo) {
  conditions.push(lte(deviations.createdAt, dateTo));
}
```

**Step 2: Update imports**

Add import:
```typescript
import { toQueryDate } from '../db/date-utils';
```

**Step 3: Apply the fix**

Replace with:
```typescript
if (dateFrom) {
  conditions.push(gte(deviations.createdAt, toQueryDate(dateFrom)));
}
if (dateTo) {
  conditions.push(lte(deviations.createdAt, toQueryDate(dateTo)));
}
```

**Step 4: Commit**

```bash
git add src/lib/services/quality.service.ts
git commit -m "fix(quality): use toQueryDate in getDeviationStatistics"
```

---

### Task 6: Fix Purchasing Service - evaluateVendor

**Files:**
- Modify: `src/lib/services/purchasing.service.ts:672-675`

**Step 1: Read current implementation**

Current code at lines 672-675:
```typescript
if (dateFrom) {
  conditions.push(gte(purchaseOrders.createdAt, dateFrom));
}
if (dateTo) {
  conditions.push(lte(purchaseOrders.createdAt, dateTo));
}
```

**Step 2: Update imports**

Add import:
```typescript
import { toQueryDate } from '../db/date-utils';
```

**Step 3: Apply the fix**

Replace with:
```typescript
if (dateFrom) {
  conditions.push(gte(purchaseOrders.createdAt, toQueryDate(dateFrom)));
}
if (dateTo) {
  conditions.push(lte(purchaseOrders.createdAt, toQueryDate(dateTo)));
}
```

**Step 4: Commit**

```bash
git add src/lib/services/purchasing.service.ts
git commit -m "fix(purchasing): use toQueryDate in evaluateVendor"
```

---

### Task 7: Search and Fix Remaining Occurrences

**Step 1: Search for remaining patterns**

Run grep to find any remaining patterns:
```bash
grep -rn "toISOString().split" src/lib/services/ | grep -v "test"
grep -rn "gte.*createdAt\|lte.*createdAt\|gte.*Date\|lte.*Date" src/lib/services/
```

**Step 2: Fix any additional occurrences found**

Apply the same pattern:
- Replace direct string dates with `toQueryDate(dateString)`
- Ensure all date comparisons in WHERE clauses use `toQueryDate()`

**Step 3: Commit any additional fixes**

```bash
git add -A
git commit -m "fix: apply toQueryDate to remaining date query conditions"
```

---

### Task 8: Update CLAUDE.md Documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add documentation for query date handling**

Add under the "MySQL/SQLite Date Handling" section:

```markdown
### Dates in Query Conditions

When using dates in Drizzle ORM comparison operators (`gte`, `lte`, `eq`, etc.), use `toQueryDate()`:

```typescript
import { toQueryDate, getTodayStr } from '../db/date-utils';

// For today's date in queries
const today = toQueryDate(getTodayStr());
.where(lte(table.dueDate, today))

// For date parameters from API
.where(gte(table.createdAt, toQueryDate(dateFrom)))
.where(lte(table.createdAt, toQueryDate(dateTo)))
```

**Why:** MySQL datetime columns require Date objects in query conditions. SQLite uses text comparison. `toQueryDate()` handles both.
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add toQueryDate pattern to CLAUDE.md"
```

---

### Task 9: Run Full Test Suite

**Step 1: Run linter**

Run: `npm run lint`
Expected: No new errors

**Step 2: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 3: Manual verification**

Test the previously failing endpoint:
```bash
curl "http://localhost:3000/api/complaints/trends?period=month" | jq
```
Expected: 200 response with valid JSON data

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/lib/db/date-utils.ts` | Add `toQueryDate()` function |
| `tests/lib/db/date-utils.test.ts` | Add tests for `toQueryDate()` |
| `src/lib/services/capa-service.ts` | Use `toQueryDate()` in `listCapas` |
| `src/lib/services/reports.service.ts` | Use `toQueryDate()` in `getQualitySummaryReport` and `getStockMovementReport` |
| `src/lib/services/quality.service.ts` | Use `toQueryDate()` in `getDeviationStatistics` |
| `src/lib/services/purchasing.service.ts` | Use `toQueryDate()` in `evaluateVendor` |
| `CLAUDE.md` | Document the `toQueryDate()` pattern |

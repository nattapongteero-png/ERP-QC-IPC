# Fix TypeError: value.toISOString Errors Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all `TypeError: value.toISOString is not a function` errors that occur when date fields from SQLite (stored as strings) are treated as Date objects.

**Architecture:** Add a safe date conversion utility `toDateSafe()` to the existing `date-utils.ts` module. This function will handle both Date objects (from MySQL) and string values (from SQLite) uniformly. Apply this utility wherever database date fields are converted to Date objects.

**Tech Stack:** TypeScript 5.x, Drizzle ORM, Next.js 16, dual-database pattern (MySQL/SQLite)

---

## Root Cause Analysis

The error `TypeError: value.toISOString is not a function` occurs because:

1. **SQLite schema** uses `text` type for date fields (returns strings)
2. **MySQL schema** uses `datetime` type for date fields (returns Date objects)
3. **Code assumes** values are Date objects and calls `.toISOString()` on them
4. When running with SQLite (testing), strings don't have `.toISOString()` method

**Example of problematic pattern:**
```typescript
// This fails in SQLite when c.receivedDate is a string
const date = new Date(c.receivedDate);  // Creates Date from string - OK
// But if code tries: c.receivedDate.toISOString() - FAILS with string
```

---

### Task 1: Add Safe Date Conversion Utility

**Files:**
- Modify: `src/lib/db/date-utils.ts`
- Test: `tests/lib/db/date-utils.test.ts`

**Step 1: Write the failing test**

Create test file `tests/lib/db/date-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { toDateSafe, formatDateFromDb } from '@/lib/db/date-utils';

describe('date-utils', () => {
  describe('toDateSafe', () => {
    it('should convert string date to Date object', () => {
      const result = toDateSafe('2024-12-23');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(11); // 0-indexed
      expect(result.getDate()).toBe(23);
    });

    it('should return Date object unchanged', () => {
      const input = new Date('2024-12-23');
      const result = toDateSafe(input);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(input.getTime());
    });

    it('should handle ISO string format', () => {
      const result = toDateSafe('2024-12-23T10:30:00.000Z');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
    });

    it('should handle null/undefined by returning current date', () => {
      const now = new Date();
      const result = toDateSafe(null);
      expect(result.getFullYear()).toBe(now.getFullYear());
    });
  });

  describe('formatDateFromDb', () => {
    it('should format Date object to YYYY-MM-DD', () => {
      const result = formatDateFromDb(new Date('2024-12-23'));
      expect(result).toBe('2024-12-23');
    });

    it('should format string date to YYYY-MM-DD', () => {
      const result = formatDateFromDb('2024-12-23T10:30:00.000Z');
      expect(result).toBe('2024-12-23');
    });

    it('should pass through already formatted YYYY-MM-DD string', () => {
      const result = formatDateFromDb('2024-12-23');
      expect(result).toBe('2024-12-23');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/db/date-utils.test.ts`
Expected: FAIL with "toDateSafe is not exported"

**Step 3: Write minimal implementation**

Add to `src/lib/db/date-utils.ts`:

```typescript
/**
 * Safely convert a database date value to a Date object.
 * Handles both Date objects (MySQL) and strings (SQLite).
 *
 * @param value - Date object, ISO string, or date string from database
 * @returns Date object
 */
export function toDateSafe(value: Date | string | null | undefined): Date {
  if (!value) {
    return new Date();
  }
  if (value instanceof Date) {
    return value;
  }
  return new Date(value);
}

/**
 * Format a database date value to YYYY-MM-DD string.
 * Handles both Date objects (MySQL) and strings (SQLite).
 *
 * @param value - Date object or string from database
 * @returns YYYY-MM-DD formatted string
 */
export function formatDateFromDb(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  // If it's already YYYY-MM-DD, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  // Parse and format ISO string or other formats
  return new Date(value).toISOString().split('T')[0];
}

/**
 * Format a database date value to YYYY-MM month string.
 * Handles both Date objects (MySQL) and strings (SQLite).
 *
 * @param value - Date object or string from database
 * @returns YYYY-MM formatted string
 */
export function formatMonthFromDb(value: Date | string): string {
  const date = toDateSafe(value);
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/db/date-utils.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/db/date-utils.ts tests/lib/db/date-utils.test.ts
git commit -m "feat(date-utils): add toDateSafe and formatDateFromDb for dual-DB safety"
```

---

### Task 2: Fix Complaint Service - getComplaintTrends

**Files:**
- Modify: `src/lib/services/complaint-service.ts:834-841`

**Step 1: Read the current implementation**

Current problematic code at line 834-841:
```typescript
complaints.forEach((c: { receivedDate: string }) => {
  let label: string;
  const date = new Date(c.receivedDate);
  if (dateFormat === 'day') {
    label = c.receivedDate;
  } else {
    label = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  }
  dateCounts.set(label, (dateCounts.get(label) || 0) + 1);
});
```

**Step 2: Update imports**

Add to existing imports in `complaint-service.ts`:
```typescript
import { getNow, toDbDate, getTodayStr, toDateSafe, formatDateFromDb, formatMonthFromDb } from '../db/date-utils';
```

**Step 3: Apply the fix**

Replace lines 834-843 with:
```typescript
complaints.forEach((c: { receivedDate: Date | string }) => {
  let label: string;
  if (dateFormat === 'day') {
    label = formatDateFromDb(c.receivedDate);
  } else {
    label = formatMonthFromDb(c.receivedDate);
  }
  dateCounts.set(label, (dateCounts.get(label) || 0) + 1);
});
```

**Step 4: Verify the fix**

Run: `curl "http://localhost:3000/api/complaints/trends?period=month" | jq`
Expected: 200 response with trend data, no TypeError

**Step 5: Commit**

```bash
git add src/lib/services/complaint-service.ts
git commit -m "fix(complaints): use safe date conversion in getComplaintTrends"
```

---

### Task 3: Fix Stability Service Date Handling

**Files:**
- Modify: `src/lib/services/stability-service.ts:590`

**Step 1: Read the current implementation**

Current code at line 590:
```typescript
new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
```

**Step 2: Update imports**

Add `toDateSafe` to existing imports:
```typescript
import { toDateSafe } from '../db/date-utils';
```

**Step 3: Apply the fix**

Replace line 590 sorting comparison with:
```typescript
toDateSafe(a.scheduledDate).getTime() - toDateSafe(b.scheduledDate).getTime()
```

**Step 4: Run tests**

Run: `npm test -- --grep "stability"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/services/stability-service.ts
git commit -m "fix(stability): use toDateSafe for scheduledDate sorting"
```

---

### Task 4: Fix CAPA Service Date Handling

**Files:**
- Modify: `src/lib/services/capa-service.ts:1281`

**Step 1: Read the current implementation**

Current code at line 1281:
```typescript
const closed = new Date(capa.closedDate);
```

**Step 2: Update imports**

Add `toDateSafe` to existing imports:
```typescript
import { toDateSafe } from '../db/date-utils';
```

**Step 3: Apply the fix**

Replace line 1281 with:
```typescript
const closed = toDateSafe(capa.closedDate);
```

**Step 4: Run tests**

Run: `npm test -- --grep "capa"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/services/capa-service.ts
git commit -m "fix(capa): use toDateSafe for closedDate conversion"
```

---

### Task 5: Fix Sanitation Service Date Handling

**Files:**
- Modify: `src/lib/services/sanitation-service.ts:796`

**Step 1: Read the current implementation**

Current code at line 796:
```typescript
return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
```

**Step 2: Update imports**

Add `toDateSafe` to existing imports:
```typescript
import { toDateSafe } from '../db/date-utils';
```

**Step 3: Apply the fix**

Replace line 796 with:
```typescript
return toDateSafe(a.dueDate).getTime() - toDateSafe(b.dueDate).getTime();
```

**Step 4: Run tests**

Run: `npm test -- --grep "sanitation"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/services/sanitation-service.ts
git commit -m "fix(sanitation): use toDateSafe for dueDate sorting"
```

---

### Task 6: Fix HR Service Date Handling

**Files:**
- Modify: `src/lib/services/hr.service.ts:2289,2341`

**Step 1: Read the current implementation**

Current code at lines 2289 and 2341:
```typescript
const expiryDate = new Date(record.expiryDate);
```

**Step 2: Update imports**

Add `toDateSafe` to existing imports:
```typescript
import { toDateSafe } from '../db/date-utils';
```

**Step 3: Apply the fix**

Replace both occurrences with:
```typescript
const expiryDate = toDateSafe(record.expiryDate);
```

**Step 4: Run tests**

Run: `npm test -- --grep "hr"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/services/hr.service.ts
git commit -m "fix(hr): use toDateSafe for expiryDate conversion"
```

---

### Task 7: Fix Production Service Date Handling

**Files:**
- Modify: `src/lib/services/production.service.ts:732`

**Step 1: Read the current implementation**

Current code at line 732:
```typescript
const requiredDate = new Date(demand.requiredDate);
```

**Step 2: Update imports**

Add `toDateSafe` to existing imports:
```typescript
import { toDateSafe } from '../db/date-utils';
```

**Step 3: Apply the fix**

Replace line 732 with:
```typescript
const requiredDate = toDateSafe(demand.requiredDate);
```

**Step 4: Run tests**

Run: `npm test -- --grep "production"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/services/production.service.ts
git commit -m "fix(production): use toDateSafe for requiredDate conversion"
```

---

### Task 8: Fix Reports Service Date Handling

**Files:**
- Modify: `src/lib/services/reports.service.ts:194`

**Step 1: Read the current implementation**

Current code at line 194:
```typescript
const expiryDate = new Date(lot.expiryDate);
```

**Step 2: Update imports**

Add `toDateSafe` to existing imports:
```typescript
import { toDateSafe } from '../db/date-utils';
```

**Step 3: Apply the fix**

Replace line 194 with:
```typescript
const expiryDate = toDateSafe(lot.expiryDate);
```

**Step 4: Run tests**

Run: `npm test -- --grep "reports"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/services/reports.service.ts
git commit -m "fix(reports): use toDateSafe for expiryDate conversion"
```

---

### Task 9: Run Full Test Suite and Verify

**Step 1: Run linter**

Run: `npm run lint`
Expected: No new errors

**Step 2: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 3: Manual verification**

Test the original failing endpoint:
```bash
curl "http://localhost:3000/api/complaints/trends?period=month" | jq
```
Expected: 200 response with valid JSON data

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: final cleanup for toISOString date handling"
```

---

## Summary of Changes

| File | Line(s) | Change |
|------|---------|--------|
| `src/lib/db/date-utils.ts` | new | Add `toDateSafe()`, `formatDateFromDb()`, `formatMonthFromDb()` |
| `tests/lib/db/date-utils.test.ts` | new | Unit tests for date utilities |
| `src/lib/services/complaint-service.ts` | 834-841 | Use `formatDateFromDb()` and `formatMonthFromDb()` |
| `src/lib/services/stability-service.ts` | 590 | Use `toDateSafe()` for sorting |
| `src/lib/services/capa-service.ts` | 1281 | Use `toDateSafe()` for closedDate |
| `src/lib/services/sanitation-service.ts` | 796 | Use `toDateSafe()` for dueDate sorting |
| `src/lib/services/hr.service.ts` | 2289, 2341 | Use `toDateSafe()` for expiryDate |
| `src/lib/services/production.service.ts` | 732 | Use `toDateSafe()` for requiredDate |
| `src/lib/services/reports.service.ts` | 194 | Use `toDateSafe()` for expiryDate |

---

## Post-Implementation: Update CLAUDE.md

Add this pattern to the MySQL/SQLite Date Handling section:

```markdown
### Reading dates from database

When reading date fields from the database, always use safe conversion:

```typescript
import { toDateSafe, formatDateFromDb, formatMonthFromDb } from '../db/date-utils';

// Convert DB value to Date object safely
const date = toDateSafe(record.dateField);

// Format DB value to YYYY-MM-DD string
const dateStr = formatDateFromDb(record.dateField);

// Format DB value to YYYY-MM month string
const monthStr = formatMonthFromDb(record.dateField);
```

**Why:** SQLite returns date fields as strings, MySQL returns Date objects. These utilities handle both.
```

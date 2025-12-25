# Code Review: PQR Aggregation Functions (T405-T412)

**Feature:** 009-gmp-compliance-gap-analysis (หมวด 1)
**Reviewer:** Senior Code Reviewer
**Date:** 2025-12-23
**Commit Range:** 96616eb → 2ab7080

---

## Executive Summary

**Assessment: NEEDS WORK**

The implementation successfully delivers all 8 functions (T405-T412) with comprehensive test coverage and proper TypeScript typing. However, there is **1 CRITICAL issue** that breaks database abstraction compatibility and **several important issues** that need addressing before merging.

**Test Results:** ✅ All 10 unit tests passing
**Lint:** ✅ No errors
**TypeScript:** ✅ No type errors

---

## Plan Alignment Analysis

### Requirements Met (T405-T412)

✅ **T405: aggregateBatchMetrics()** - Queries work_orders for batch production metrics
✅ **T406: aggregateDeviationMetrics()** - Queries deviations for quality deviation metrics
✅ **T407: aggregateCapaMetrics()** - Queries capas for CAPA metrics
✅ **T408: aggregateComplaintMetrics()** - Queries complaints for complaint metrics
✅ **T409: aggregateOosMetrics()** - Queries quality_tests for OOS metrics
✅ **T410: aggregateStabilityStatus()** - Queries stability studies for status
✅ **T411: calculatePQRMetrics()** - Calculates KPIs and generates recommendations
✅ **T412: approvePQR()** - Approves a PQR with signature

### Scope Verification

All planned functions from `tasks-implementation.md` Phase 4 (lines 155-162) have been implemented. The implementation correctly:
- Aggregates data from all specified source tables
- Calculates metrics per requirements
- Generates intelligent recommendations based on thresholds
- Follows the existing service pattern

---

## Critical Issues

### 🔴 CRITICAL #1: SQL CONCAT() Function - Database Compatibility Break

**Location:** `src/lib/services/pqr-service.ts:1116`

```typescript
recommendations: sql`CONCAT(COALESCE(${pqrReportsTable.recommendations}, ''),
  '\n\nApproval Comments: ', ${comments})`
```

**Problem:**
- `CONCAT()` is MySQL-specific syntax
- SQLite uses `||` operator for string concatenation
- This breaks the dual-database abstraction pattern used throughout the codebase
- Will cause test failures when running with SQLite (DB_TYPE=sqlite)

**Evidence:**
- Project uses dual-database pattern (MySQL production, SQLite testing)
- No other service file uses `CONCAT()` SQL function
- Search through `/src/lib/db` shows no CONCAT usage patterns

**Impact:** HIGH - Breaks testing and violates architecture principle

**Fix Required:**
Replace SQL CONCAT with JavaScript string concatenation:

```typescript
// Get current recommendations first
const currentReport = await getPqrById(pqrId);
const currentRecommendations = currentReport?.recommendations || '';
const updatedRecommendations = comments
  ? `${currentRecommendations}\n\nApproval Comments: ${comments}`
  : currentRecommendations;

await executeDbOperation(async (db) => {
  return db
    .update(pqrReportsTable)
    .set({
      status: 'approved',
      approvedBy: approverId,
      approvedAt: getNow(),
      ...(comments && { recommendations: updatedRecommendations }),
    })
    .where(eq(pqrReportsTable.id, pqrId));
});
```

---

## Important Issues

### ⚠️ IMPORTANT #1: SQL Injection in Dynamic Query

**Location:** `src/lib/services/pqr-service.ts:779` (aggregateStabilityStatus)

```typescript
sql`${stabilitySamplesTable.studyId} IN (${sql.raw(studyIds.join(','))})`
```

**Problem:**
- Using `sql.raw()` with joined array creates potential SQL injection vector
- While `studyIds` are numbers here, the pattern is unsafe
- Drizzle ORM provides safe alternatives using `inArray()`

**Impact:** MEDIUM - Security vulnerability pattern

**Recommendation:**
```typescript
import { inArray } from 'drizzle-orm';

// Replace with:
inArray(stabilitySamplesTable.studyId, studyIds)
```

### ⚠️ IMPORTANT #2: Missing Error Handling for Empty Study IDs

**Location:** `src/lib/services/pqr-service.ts:770-779`

```typescript
if (studyIds.length > 0) {
  const samplesWithOos = await executeDbOperation(async (db) => {
    return db
      .select(...)
      .where(
        and(
          sql`${stabilitySamplesTable.studyId} IN (${sql.raw(studyIds.join(','))})`,
          eq(stabilitySamplesTable.oosDetected, true)
        )
      );
  });
```

**Problem:**
- When `studyIds` is empty array, `join(',')` produces empty string
- Results in malformed SQL: `studyId IN ()`
- Should use Drizzle's `inArray()` which handles this case

**Impact:** MEDIUM - Runtime errors on edge cases

**Fix:** Use `inArray()` which safely handles empty arrays

### ⚠️ IMPORTANT #3: Date Handling Uses toQueryDate Correctly

**Status:** ✅ GOOD

All aggregation functions correctly use:
- `toQueryDate()` for WHERE clause comparisons (lines 516, 550, 584, 647, 708, 747)
- `gte()` and `lte()` operators for range queries
- Proper abstraction pattern followed

**Example:**
```typescript
const startQueryDate = toQueryDate(startDate);
const endQueryDate = toQueryDate(endDate);

.where(
  and(
    eq(workOrdersTable.productId, productId),
    gte(workOrdersTable.actualEndDate, startQueryDate),
    lte(workOrdersTable.actualEndDate, endQueryDate)
  )
);
```

This is correct per `CLAUDE.md` guidelines.

---

## Minor Issues

### 📝 MINOR #1: Hardcoded "unknown" Fallback Values

**Locations:** Multiple functions

```typescript
const status = c.status || 'unknown';
const severity = d.severity || 'unknown';
const category = c.category || 'unknown';
```

**Issue:**
- Hardcoded "unknown" string scattered throughout
- Should be a constant for consistency
- Consider logging when encountering null/undefined values

**Recommendation:**
```typescript
const UNKNOWN_VALUE = 'unknown' as const;

// Usage:
const status = c.status || UNKNOWN_VALUE;
```

### 📝 MINOR #2: Magic Numbers in KPI Thresholds

**Location:** `calculatePQRMetrics()` function

```typescript
const batchSuccessTarget = targets.batchSuccessRate || 95;
const maxDeviationRate = targets.maxDeviationRate || 5;
const minCapaClosureRate = targets.minCapaClosureRate || 90;
const maxOosRate = targets.maxOosRate || 2;
const maxComplaintRate = targets.maxComplaintRate || 1;
```

**Issue:**
- Default threshold values (95, 5, 90, 2, 1) are hardcoded
- These should be configurable or at least documented as constants

**Recommendation:**
```typescript
const DEFAULT_THRESHOLDS = {
  BATCH_SUCCESS_RATE: 95,
  MAX_DEVIATION_RATE: 5,
  MIN_CAPA_CLOSURE_RATE: 90,
  MAX_OOS_RATE: 2,
  MAX_COMPLAINT_RATE: 1,
} as const;

const batchSuccessTarget = targets.batchSuccessRate ?? DEFAULT_THRESHOLDS.BATCH_SUCCESS_RATE;
```

### 📝 MINOR #3: Recommendation Messages Should Support i18n

**Location:** `calculatePQRMetrics()` lines 900-1086

**Issue:**
- All recommendation messages are hardcoded English strings
- Project appears to be Thai-based (field names use Thai)
- Should support internationalization

**Note:** This is likely acceptable for MVP, but flag for future enhancement

---

## Strengths

### ✅ Excellent Test Coverage

**File:** `tests/unit/services/pqr-service-aggregation.test.ts`

- 10 comprehensive unit tests covering all scenarios
- Tests happy paths and edge cases (empty data, null values)
- Proper mocking with Vitest
- Tests verify calculations (averages, rates, percentages)
- All tests passing

**Example Quality Test:**
```typescript
it('should calculate on-time closure rate correctly', async () => {
  const mockCapas = [
    { id: 1, status: 'closed', dueDate: '2024-02-01', closedDate: '2024-01-28' },
    { id: 2, status: 'closed', dueDate: '2024-03-01', closedDate: '2024-03-05' },
    { id: 3, status: 'open', dueDate: '2024-04-01', closedDate: null },
  ];

  const result = await aggregateCapaMetrics(1, '2024-01-01', '2024-12-31');

  expect(result.onTimeClosureRate).toBe(50); // 1 on-time / 2 closed
});
```

### ✅ Proper TypeScript Typing

- All return types explicitly defined
- Uses proper `Awaited<ReturnType<>>` pattern for aggregated data
- MetricType and MetricStatus types correctly used
- No `any` types

### ✅ Intelligent KPI Calculation Logic

The `calculatePQRMetrics()` function (T411) shows excellent business logic:

1. **Multi-tier Status Evaluation:**
   ```typescript
   status:
     deviationRate === null ? 'warning'
     : deviationRate <= maxDeviationRate ? 'pass'
     : deviationRate <= maxDeviationRate * 1.2 ? 'warning'  // 20% tolerance
     : 'fail'
   ```

2. **Contextual Recommendations:**
   ```typescript
   if (criticalCount > 0) {
     recommendations.push('...with X critical deviations. Immediate action required.');
   } else {
     recommendations.push('...Review and strengthen controls.');
   }
   ```

3. **Overall Score Calculation:**
   - Calculates % of KPIs passing
   - Generates tiered summary recommendations (100%, 80%+, 60%+, <60%)

### ✅ Correct Database Abstraction Pattern

- Uses `getTableRef()` for all table access
- Uses `executeDbOperation()` wrapper
- Follows existing service patterns from capa-service.ts
- Proper use of Drizzle ORM query builders

### ✅ Proper Date Handling

All date operations follow project standards:
- `toQueryDate()` for WHERE clauses ✅
- `getNow()` for timestamp inserts ✅
- `formatDateFromDb()` for reading dates ✅
- No raw date strings in queries ✅

### ✅ Good Code Organization

- Clear separation of concerns
- Helper functions at top
- Logical grouping with comments
- Consistent naming conventions
- Comprehensive JSDoc comments

---

## Security Assessment

### ✅ No Authentication/Authorization Issues
- Functions accept `userId` parameter appropriately (approvePQR)
- No direct SQL string concatenation (except the CONCAT issue noted)
- Uses parameterized queries via Drizzle ORM

### ⚠️ SQL Injection Vector
- See IMPORTANT #1 - `sql.raw()` usage
- Needs replacement with `inArray()`

---

## Performance Considerations

### Potential Optimization Areas

1. **Multiple Database Calls in aggregateStabilityStatus**
   - First query gets studies
   - Second query gets OOS samples
   - Could be combined with a single JOIN query
   - **Impact:** LOW - Unlikely to be performance bottleneck for PQR generation

2. **N+1 Query Pattern in getPqrById**
   - Separate queries for report and metrics
   - Could use JOIN or batch query
   - **Impact:** LOW - Only called once per PQR view

3. **Large Result Sets**
   - No pagination in aggregation functions
   - Products with 1000s of batches could slow down
   - **Impact:** LOW - Annual aggregation is typically bounded
   - **Mitigation:** Already using indexed date ranges

**Overall:** Performance is acceptable for the use case (annual report generation)

---

## Code Quality Metrics

| Metric | Score | Notes |
|--------|-------|-------|
| **Type Safety** | 9/10 | Excellent TypeScript usage, minor improvements possible |
| **Test Coverage** | 9/10 | All functions tested, could add integration tests |
| **Error Handling** | 7/10 | Basic error handling via executeDbOperation, could be more explicit |
| **Documentation** | 8/10 | Good JSDoc, function names clear |
| **Maintainability** | 8/10 | Well-organized, follows patterns |
| **Database Abstraction** | 6/10 | **Critical issue with CONCAT breaks pattern** |
| **Security** | 7/10 | One SQL injection vector to fix |

**Overall Code Quality:** 7.7/10

---

## Recommendations Summary

### Must Fix Before Merge (Critical)

1. **Replace SQL CONCAT()** with JavaScript string concatenation in `approvePQR()`
   - Breaks SQLite compatibility
   - Violates dual-database abstraction

### Should Fix Before Merge (Important)

2. **Replace `sql.raw()` with `inArray()`** in `aggregateStabilityStatus()`
   - Security: Prevents SQL injection pattern
   - Reliability: Handles empty arrays correctly

3. **Add Integration Test** (per tasks-implementation.md T413-414)
   - Current tests are unit tests with mocks
   - Need real SQLite test verifying actual aggregation
   - Validate joins work correctly across tables

### Nice to Have (Minor - Can be Follow-up Tasks)

4. Extract hardcoded "unknown" to constant
5. Extract default thresholds to configuration constants
6. Consider i18n support for recommendation messages
7. Add explicit error logging for null/undefined values in aggregation

---

## Final Verdict

**Status: NEEDS WORK**

**Strengths:**
- All 8 required functions implemented correctly
- Excellent test coverage with all tests passing
- Proper TypeScript typing throughout
- Intelligent KPI calculation logic
- Good code organization and documentation
- Follows existing service patterns (mostly)

**Critical Blockers:**
- SQL CONCAT() breaks database abstraction (MUST FIX)

**Important Issues:**
- SQL injection vector with sql.raw() (SHOULD FIX)
- Missing integration tests per plan (SHOULD ADD)

**Recommendation:**
Fix the critical CONCAT issue and the sql.raw() security issue, then this will be ready to merge. The implementation is otherwise solid and well-tested. Consider adding the integration test (T413) as specified in the plan before marking Phase 4 complete.

---

## Diff Summary

**Files Changed:**
- `src/lib/services/pqr-service.ts` (+724 lines)
- `tests/unit/services/pqr-service-aggregation.test.ts` (+357 lines, new file)

**Commits:**
- 2ab7080: Implementation of T405-T412

**Lines of Code Added:** ~1,081 (mostly new functionality)

---

## Next Steps

1. **Immediate:** Fix CRITICAL #1 (CONCAT compatibility)
2. **Before Merge:** Fix IMPORTANT #1 (sql.raw security)
3. **Before Merge:** Add integration test (T413 per plan)
4. **After Merge:** Create follow-up tasks for minor improvements
5. **Phase 4 Checkpoint:** Test PQR generation with existing batch data (per tasks.md line 180)

---

**Reviewed by:** Senior Code Reviewer
**Date:** 2025-12-23
**Confidence Level:** HIGH (comprehensive review with test execution)

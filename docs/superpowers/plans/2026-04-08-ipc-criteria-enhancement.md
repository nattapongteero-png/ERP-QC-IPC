# IPC Criteria Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dosage form, criteria type (numeric/checkbox), and tolerance-based pass/fail logic to the IPC system.

**Architecture:** Extend existing `ipc_criteria` and `quality_tests` schemas with new columns. Update `recordIPCTestResult()` service to use tolerance-based aggregation instead of all-or-nothing. Update criteria form UI with conditional fields and work order IPC page with checkbox recording mode.

**Tech Stack:** Drizzle ORM (SQLite/MySQL dual schema), Next.js 16, React 19, DevExtreme React 25.2, TanStack Query, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/db/schema.ts` | Modify | Add 3 cols to ipc_criteria, 2 cols to quality_tests (SQLite+MySQL) |
| `src/app/api/master-data/ipc-criteria/route.ts` | Modify | Handle new fields in POST/PUT |
| `src/components/master-data/IPCCriteriaForm.tsx` | Modify | Add dosageForm, criteriaType, tolerancePercent fields with conditional visibility |
| `src/lib/services/wo-execution.service.ts` | Modify | Update getBOMIPCConfig, initializeWOIPCTests, recordIPCTestResult, getWOIPCTests for tolerance + checkbox |
| `src/app/api/production/work-orders/[id]/ipc/route.ts` | Modify | Pass checkbox samples through to service |
| `src/app/production/work-orders/[id]/ipc/page.tsx` | Modify | Checkbox UI, summary bar, criteriaType-aware recording |
| `tests/integration/services/ipc-tolerance.test.ts` | Create | Test tolerance-based pass/fail logic |
| `tests/unit/pages/master-data/ipc-criteria-form.test.tsx` | Create | Test conditional form visibility |

---

### Task 1: Schema — Add columns to ipc_criteria and quality_tests

**Files:**
- Modify: `src/lib/db/schema.ts:1243-1258` (SQLite ipc_criteria)
- Modify: `src/lib/db/schema.ts:4425-4440` (MySQL ipc_criteria)
- Modify: `src/lib/db/schema.ts:435-466` (SQLite quality_tests)
- Modify: `src/lib/db/schema.ts:1826-1857` (MySQL quality_tests)

- [ ] **Step 1: Add 3 columns to SQLite ipc_criteria**

In `src/lib/db/schema.ts`, find `sqliteIPCCriteria` (line 1243). After the `isActive` column (line 1256), add:

```typescript
  dosageForm: text('dosage_form'),
  criteriaType: text('criteria_type').notNull().default('numeric'), // numeric, checkbox
  tolerancePercent: real('tolerance_percent').notNull().default(0),
```

- [ ] **Step 2: Add 3 columns to MySQL ipc_criteria**

Find `mysqlIPCCriteria` (line 4425). After the `isActive` column (line 4438), add:

```typescript
  dosageForm: varchar('dosage_form', { length: 100 }),
  criteriaType: varchar('criteria_type', { length: 20 }).notNull().default('numeric'),
  tolerancePercent: decimal('tolerance_percent', { precision: 5, scale: 2 }).notNull().default('0'),
```

- [ ] **Step 3: Add 2 columns to SQLite quality_tests**

Find `sqliteQualityTests` (line 435). After the `specUnit` column (line 456), add:

```typescript
  criteriaType: text('criteria_type').default('numeric'), // numeric, checkbox — copied from ipc_criteria at init
  tolerancePercent: real('tolerance_percent').default(0),
```

- [ ] **Step 4: Add 2 columns to MySQL quality_tests**

Find `mysqlQualityTests` (line 1826). After the `specUnit` column (line 1847), add:

```typescript
  criteriaType: varchar('criteria_type', { length: 20 }).default('numeric'),
  tolerancePercent: decimal('tolerance_percent', { precision: 5, scale: 2 }).default('0'),
```

- [ ] **Step 5: Add columns to production MySQL database**

Run ALTER TABLE statements on the production MySQL database:

```sql
ALTER TABLE ipc_criteria
  ADD COLUMN dosage_form VARCHAR(100) DEFAULT NULL,
  ADD COLUMN criteria_type VARCHAR(20) NOT NULL DEFAULT 'numeric',
  ADD COLUMN tolerance_percent DECIMAL(5,2) NOT NULL DEFAULT 0;

ALTER TABLE quality_tests
  ADD COLUMN criteria_type VARCHAR(20) DEFAULT 'numeric',
  ADD COLUMN tolerance_percent DECIMAL(5,2) DEFAULT 0;
```

- [ ] **Step 6: Run type check**

```bash
bunx tsc --noEmit --skipLibCheck
```

Expected: no errors (new columns are optional/defaulted).

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat(ipc): add dosageForm, criteriaType, tolerancePercent to schema"
```

---

### Task 2: API — Handle new fields in IPC Criteria CRUD

**Files:**
- Modify: `src/app/api/master-data/ipc-criteria/route.ts`

- [ ] **Step 1: Update POST handler to include new fields**

In `route.ts`, find the `POST` handler's `db.insert(table).values({...})` block (line 61-75). Add the 3 new fields to the values object:

```typescript
          dosageForm: data.dosageForm || null,
          criteriaType: data.criteriaType || 'numeric',
          tolerancePercent: data.tolerancePercent ?? 0,
```

Add after `isActive: data.isActive ?? true,` (line 73).

- [ ] **Step 2: Update PUT handler to include new fields in allowed list**

In the `PUT` handler, find the `fields` array (line 123):

```typescript
const fields = ['code', 'name', 'nameTh', 'testMethod', 'specification', 'minValue', 'maxValue', 'unit', 'sampleSize', 'checkIntervalMinutes', 'isCritical', 'isActive'];
```

Replace with:

```typescript
const fields = ['code', 'name', 'nameTh', 'testMethod', 'specification', 'minValue', 'maxValue', 'unit', 'sampleSize', 'checkIntervalMinutes', 'isCritical', 'isActive', 'dosageForm', 'criteriaType', 'tolerancePercent'];
```

- [ ] **Step 3: Run type check**

```bash
bunx tsc --noEmit --skipLibCheck
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/master-data/ipc-criteria/route.ts
git commit -m "feat(ipc): handle dosageForm, criteriaType, tolerancePercent in API"
```

---

### Task 3: Service — Update getBOMIPCConfig and initializeWOIPCTests

**Files:**
- Modify: `src/lib/services/wo-execution.service.ts`

- [ ] **Step 1: Add new fields to getBOMIPCConfig SELECT**

In `getBOMIPCConfig()` (line 1540), find the `.select({...})` block. Add after `unit: ipcCriteria.unit,` (line 1560):

```typescript
        criteriaType: ipcCriteria.criteriaType,
        tolerancePercent: ipcCriteria.tolerancePercent,
        dosageForm: ipcCriteria.dosageForm,
```

- [ ] **Step 2: Update initializeWOIPCTests to copy criteriaType and tolerancePercent**

In `initializeWOIPCTests()` (line 1939), find the `db.insert(tables.qualityTests).values({...})` block (line 2010-2026). Add after `specUnit: config.unit,` (line 2022):

```typescript
        criteriaType: config.criteriaType || 'numeric',
        tolerancePercent: Number(config.tolerancePercent) || 0,
```

- [ ] **Step 3: Update getWOIPCTests to return criteriaType and tolerancePercent**

In `getWOIPCTests()` (line 1613), find the `.select({...})` block (line 1622-1641). Add after `specUnit: tables.qualityTests.specUnit,` (line 1640):

```typescript
        criteriaType: tables.qualityTests.criteriaType,
        tolerancePercent: tables.qualityTests.tolerancePercent,
```

- [ ] **Step 4: Update the round result calculation to use tolerance**

In `getWOIPCTests()`, find the rounds aggregation (line 1692-1703). Replace the `result` calculation:

```typescript
// Old line:
result: roundSamples.some((s: any) => s.result === 'fail') ? 'fail' : 'pass',
```

Replace with:

```typescript
result: (() => {
  const failCount = roundSamples.filter((s: any) => s.result === 'fail').length;
  const total = roundSamples.length;
  const tolerancePct = Number(test.tolerancePercent) || 0;
  if (total === 0) return 'pending';
  const failPct = (failCount / total) * 100;
  return failPct > tolerancePct ? 'fail' : 'pass';
})(),
```

- [ ] **Step 5: Run type check**

```bash
bunx tsc --noEmit --skipLibCheck
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/wo-execution.service.ts
git commit -m "feat(ipc): pass criteriaType/tolerancePercent through BOM→WO flow"
```

---

### Task 4: Service — Update recordIPCTestResult for tolerance + checkbox

**Files:**
- Modify: `src/lib/services/wo-execution.service.ts`

- [ ] **Step 1: Update RecordIPCTestInput interface to accept checkbox results**

Find the `RecordIPCTestInput` interface (line 1724). Update the `samples` array type:

```typescript
export interface RecordIPCTestInput {
  qualityTestId: number;
  numericResult?: number;
  result?: string;
  notes?: string;
  testedBy: number;
  testRound?: number;
  samples?: Array<{
    sampleNumber: number;
    numericValue?: number;
    textValue?: string;
    result?: string; // for checkbox mode: 'pass' or 'fail'
  }>;
}
```

- [ ] **Step 2: Rewrite the multi-sample recording block with tolerance logic**

In `recordIPCTestResult()` (line 1738), find the block starting at `if (input.samples && input.samples.length > 0)` (line 1771). Replace the entire block from line 1771 to line 1805 with:

```typescript
    if (input.samples && input.samples.length > 0) {
      // Delete existing samples for this round (in case of re-recording)
      await db.delete(tables.ipcTestSamples).where(
        and(
          eq(tables.ipcTestSamples.qualityTestId, input.qualityTestId),
          eq(tables.ipcTestSamples.testRound, testRound)
        )
      );

      const criteriaType = test.criteriaType || 'numeric';
      const tolerancePct = Number(test.tolerancePercent) || 0;

      // Insert samples with round number
      for (const sample of input.samples) {
        let sampleResult: string | null = null;

        if (criteriaType === 'checkbox') {
          // Checkbox mode: result comes directly from user input
          sampleResult = sample.result || null;
        } else {
          // Numeric mode: auto-calculate from min/max
          if (sample.numericValue != null && test.specMinValue != null && test.specMaxValue != null) {
            sampleResult = (sample.numericValue >= Number(test.specMinValue) && sample.numericValue <= Number(test.specMaxValue))
              ? 'pass' : 'fail';
          }
        }

        await db.insert(tables.ipcTestSamples).values({
          qualityTestId: input.qualityTestId,
          sampleNumber: sample.sampleNumber,
          testRound,
          numericValue: sample.numericValue ?? null,
          textValue: sample.textValue ?? null,
          result: sampleResult,
          createdAt: getNow(),
        });
      }

      // Aggregate: tolerance-based pass/fail
      const sampleResults = input.samples.map((s) => {
        if (criteriaType === 'checkbox') {
          return s.result === 'pass';
        }
        if (s.numericValue != null && test.specMinValue != null && test.specMaxValue != null) {
          return s.numericValue >= Number(test.specMinValue) && s.numericValue <= Number(test.specMaxValue);
        }
        return true; // text-only samples default to pass
      });
      const failCount = sampleResults.filter((passed) => !passed).length;
      const totalCount = sampleResults.length;
      const failPercent = totalCount > 0 ? (failCount / totalCount) * 100 : 0;
      autoResult = failPercent > tolerancePct ? 'fail' : 'pass';

      // Calculate average numeric result from samples (numeric mode only)
      if (criteriaType === 'numeric') {
        const numericSamples = input.samples.filter((s) => s.numericValue != null);
        if (numericSamples.length > 0) {
          input.numericResult = numericSamples.reduce((sum, s) => sum + (s.numericValue || 0), 0) / numericSamples.length;
        }
      }
    }
```

- [ ] **Step 3: Update single-value recording block to use tolerance**

Find the `else if (input.numericResult != null)` block (line 1812-1834). Replace with:

```typescript
    else if (input.numericResult != null) {
      // Single-value record: also track as a sample for round history
      await db.delete(tables.ipcTestSamples).where(
        and(
          eq(tables.ipcTestSamples.qualityTestId, input.qualityTestId),
          eq(tables.ipcTestSamples.testRound, testRound)
        )
      );
      let singleResult: string | null = null;
      if (test.specMinValue != null && test.specMaxValue != null) {
        singleResult = (input.numericResult >= Number(test.specMinValue) && input.numericResult <= Number(test.specMaxValue))
          ? 'pass' : 'fail';
      }
      await db.insert(tables.ipcTestSamples).values({
        qualityTestId: input.qualityTestId,
        sampleNumber: 1,
        testRound,
        numericValue: input.numericResult,
        textValue: null,
        result: singleResult,
        createdAt: getNow(),
      });
      // For single value, tolerance doesn't change behavior (1 sample: 0% or 100% fail)
      autoResult = singleResult;
    }
```

- [ ] **Step 4: Run type check**

```bash
bunx tsc --noEmit --skipLibCheck
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/wo-execution.service.ts
git commit -m "feat(ipc): implement tolerance-based pass/fail and checkbox recording"
```

---

### Task 5: Test — Tolerance-based pass/fail logic

**Files:**
- Create: `tests/integration/services/ipc-tolerance.test.ts`

- [ ] **Step 1: Write tolerance logic tests**

Create `tests/integration/services/ipc-tolerance.test.ts`:

```typescript
/**
 * Tests for IPC tolerance-based pass/fail logic
 * Verifies: numeric tolerance %, checkbox mode, backward compatibility (tolerance=0)
 */
import { describe, it, expect } from 'vitest';

/**
 * Pure logic function extracted for testing.
 * Same algorithm as recordIPCTestResult() in wo-execution.service.ts
 */
function calculateIPCResult(
  samples: Array<{ numericValue?: number; result?: string }>,
  criteriaType: 'numeric' | 'checkbox',
  tolerancePercent: number,
  specMin?: number,
  specMax?: number,
): 'pass' | 'fail' {
  const sampleResults = samples.map((s) => {
    if (criteriaType === 'checkbox') {
      return s.result === 'pass';
    }
    if (s.numericValue != null && specMin != null && specMax != null) {
      return s.numericValue >= specMin && s.numericValue <= specMax;
    }
    return true;
  });
  const failCount = sampleResults.filter((passed) => !passed).length;
  const totalCount = sampleResults.length;
  const failPercent = totalCount > 0 ? (failCount / totalCount) * 100 : 0;
  return failPercent > tolerancePercent ? 'fail' : 'pass';
}

describe('IPC Tolerance Pass/Fail Logic', () => {
  describe('Numeric mode with tolerance', () => {
    it('should pass when fail% equals tolerance% (boundary)', () => {
      // 10 samples, 1 fails = 10%, tolerance = 10% → PASS (<=)
      const samples = [
        { numericValue: 200 }, { numericValue: 195 }, { numericValue: 215 }, // 215 > 210 = fail
        { numericValue: 198 }, { numericValue: 201 }, { numericValue: 193 },
        { numericValue: 205 }, { numericValue: 199 }, { numericValue: 202 }, { numericValue: 197 },
      ];
      expect(calculateIPCResult(samples, 'numeric', 10, 190, 210)).toBe('pass');
    });

    it('should fail when fail% exceeds tolerance%', () => {
      // 10 samples, 2 fail = 20%, tolerance = 10% → FAIL
      const samples = [
        { numericValue: 200 }, { numericValue: 185 }, { numericValue: 215 }, // 185 < 190 fail, 215 > 210 fail
        { numericValue: 198 }, { numericValue: 201 }, { numericValue: 193 },
        { numericValue: 205 }, { numericValue: 199 }, { numericValue: 202 }, { numericValue: 197 },
      ];
      expect(calculateIPCResult(samples, 'numeric', 10, 190, 210)).toBe('fail');
    });

    it('should pass when all samples are within range', () => {
      const samples = [
        { numericValue: 200 }, { numericValue: 195 }, { numericValue: 205 },
      ];
      expect(calculateIPCResult(samples, 'numeric', 10, 190, 210)).toBe('pass');
    });
  });

  describe('Backward compatibility (tolerance = 0)', () => {
    it('should fail if any single sample fails when tolerance is 0', () => {
      const samples = [
        { numericValue: 200 }, { numericValue: 195 }, { numericValue: 215 }, // 1 fail
      ];
      // 1/3 = 33.3% > 0% → FAIL (old behavior preserved)
      expect(calculateIPCResult(samples, 'numeric', 0, 190, 210)).toBe('fail');
    });

    it('should pass when all samples pass with tolerance 0', () => {
      const samples = [
        { numericValue: 200 }, { numericValue: 195 }, { numericValue: 205 },
      ];
      expect(calculateIPCResult(samples, 'numeric', 0, 190, 210)).toBe('pass');
    });
  });

  describe('Checkbox mode', () => {
    it('should pass when fail% is within tolerance', () => {
      // 5 samples, 1 fail = 20%, tolerance = 20% → PASS
      const samples = [
        { result: 'pass' }, { result: 'pass' }, { result: 'fail' },
        { result: 'pass' }, { result: 'pass' },
      ];
      expect(calculateIPCResult(samples, 'checkbox', 20)).toBe('pass');
    });

    it('should fail when fail% exceeds tolerance', () => {
      // 5 samples, 2 fail = 40%, tolerance = 20% → FAIL
      const samples = [
        { result: 'pass' }, { result: 'fail' }, { result: 'fail' },
        { result: 'pass' }, { result: 'pass' },
      ];
      expect(calculateIPCResult(samples, 'checkbox', 20)).toBe('fail');
    });

    it('should fail if any checkbox fails when tolerance is 0', () => {
      const samples = [
        { result: 'pass' }, { result: 'pass' }, { result: 'fail' },
      ];
      expect(calculateIPCResult(samples, 'checkbox', 0)).toBe('fail');
    });

    it('should pass when all checkboxes pass', () => {
      const samples = [
        { result: 'pass' }, { result: 'pass' }, { result: 'pass' },
      ];
      expect(calculateIPCResult(samples, 'checkbox', 0)).toBe('pass');
    });
  });

  describe('Edge cases', () => {
    it('should pass with empty samples array', () => {
      expect(calculateIPCResult([], 'numeric', 10, 190, 210)).toBe('pass');
    });

    it('should handle 100% tolerance (always pass)', () => {
      const samples = [
        { numericValue: 999 }, { numericValue: 0 }, // all fail
      ];
      // 2/2 = 100%, tolerance = 100% → PASS (100 > 100 is false)
      expect(calculateIPCResult(samples, 'numeric', 100, 190, 210)).toBe('pass');
    });

    it('should handle single sample numeric', () => {
      // 1 sample fails = 100% > 0% → FAIL
      expect(calculateIPCResult([{ numericValue: 215 }], 'numeric', 0, 190, 210)).toBe('fail');
      // 1 sample passes = 0% > 0% is false → PASS
      expect(calculateIPCResult([{ numericValue: 200 }], 'numeric', 0, 190, 210)).toBe('pass');
    });
  });
});
```

- [ ] **Step 2: Run the test**

```bash
bun test tests/integration/services/ipc-tolerance.test.ts
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/services/ipc-tolerance.test.ts
git commit -m "test(ipc): add tolerance-based pass/fail logic tests"
```

---

### Task 6: UI — Update IPC Criteria Form with new fields

**Files:**
- Modify: `src/components/master-data/IPCCriteriaForm.tsx`

- [ ] **Step 1: Update IPCCriteria interface**

Find the `IPCCriteria` interface (line 16). Add new fields after `isActive`:

```typescript
interface IPCCriteria {
  id: number;
  code: string;
  name: string;
  nameTh: string | null;
  testMethod: string | null;
  specification: string | null;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
  sampleSize: number;
  checkIntervalMinutes: number;
  isCritical: boolean;
  isActive: boolean;
  dosageForm: string | null;
  criteriaType: string;
  tolerancePercent: number;
}
```

- [ ] **Step 2: Update initialData defaults**

Find `initialData` (line 53). Add the new defaults:

```typescript
  const initialData: Partial<IPCCriteria> = existing || {
    code: '', name: '', nameTh: '', testMethod: '', specification: '',
    minValue: null, maxValue: null, unit: '', sampleSize: 5,
    checkIntervalMinutes: 30, isCritical: false, isActive: true,
    dosageForm: null, criteriaType: 'numeric', tolerancePercent: 0,
  };
```

- [ ] **Step 3: Add DxSelectBox import**

Add to the existing imports at the top of the file:

```typescript
import { DxSelectBox } from '@/components/ui/dx-select-box';
```

- [ ] **Step 4: Add new form fields to JSX**

In the `IPCCriteriaFormInner` component, find the `<CardContent className="space-y-6">` section (line 125). After the Code/Unit row (line 135), add:

```tsx
          {/* Dosage Form and Criteria Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รูปแบบยา (Dosage Form)</label>
              <DxSelectBox
                value={formData.dosageForm || ''}
                onValueChanged={(e) => setFormData({ ...formData, dosageForm: e.value || null })}
                items={['capsule', 'tablet', 'powder', 'liquid', 'cream', 'ointment', 'suppository', 'other']}
                placeholder="Select dosage form"
                showClearButton
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทเกณฑ์ (Criteria Type) *</label>
              <DxSelectBox
                value={formData.criteriaType || 'numeric'}
                onValueChanged={(e) => setFormData({ ...formData, criteriaType: e.value })}
                items={[
                  { value: 'numeric', text: 'ตัวเลข (Numeric) — ใส่ค่าวัด + เทียบ Min/Max' },
                  { value: 'checkbox', text: 'ติ๊กเลือก (Checkbox) — ผ่าน/ไม่ผ่าน' },
                ]}
                valueExpr="value"
                displayExpr="text"
              />
            </div>
          </div>

          {/* Tolerance Percent */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tolerance ±%</label>
              <DxNumberBox
                value={formData.tolerancePercent ?? 0}
                onValueChanged={(e) => setFormData({ ...formData, tolerancePercent: e.value })}
                min={0}
                max={100}
                format="#0.##'%'"
              />
              <p className="text-xs text-gray-500 mt-1">0% = ทุก sample ต้องผ่าน, 10% = ยอมให้ไม่ผ่านได้ 10%</p>
            </div>
          </div>
```

- [ ] **Step 5: Add conditional visibility for Min/Max/Unit**

Find the Min Value / Max Value grid (line 155-164). Wrap the entire `<div className="grid grid-cols-1 md:grid-cols-2 gap-4">` block with:

```tsx
          {formData.criteriaType !== 'checkbox' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Value</label>
                <DxNumberBox value={formData.minValue ?? undefined} onValueChanged={(e) => setFormData({ ...formData, minValue: e.value })} placeholder="e.g., 190" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Value</label>
                <DxNumberBox value={formData.maxValue ?? undefined} onValueChanged={(e) => setFormData({ ...formData, maxValue: e.value })} placeholder="e.g., 210" />
              </div>
            </div>
          )}
```

Also wrap the Unit field in the Code/Unit row. Find the Unit `<div>` (line 132-134) and wrap it:

```tsx
            {formData.criteriaType !== 'checkbox' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <DxTextBox value={formData.unit || ''} onValueChanged={(e) => setFormData({ ...formData, unit: e.value })} placeholder="e.g., mg, mm, min" />
              </div>
            )}
```

- [ ] **Step 6: Run type check**

```bash
bunx tsc --noEmit --skipLibCheck
```

- [ ] **Step 7: Commit**

```bash
git add src/components/master-data/IPCCriteriaForm.tsx
git commit -m "feat(ipc): add dosageForm, criteriaType, tolerancePercent to criteria form"
```

---

### Task 7: UI — Update Work Order IPC recording page

**Files:**
- Modify: `src/app/production/work-orders/[id]/ipc/page.tsx`

- [ ] **Step 1: Add criteriaType and tolerancePercent to IPCTest interface**

Find the `IPCTest` interface (line 33). Add after `disposition`:

```typescript
  criteriaType: string | null;  // 'numeric' | 'checkbox'
  tolerancePercent: number | null;
```

- [ ] **Step 2: Add checkbox sample state**

Find the state declarations (line 130-135). Add after `expandedTests`:

```typescript
  const [checkboxResults, setCheckboxResults] = useState<('pass' | 'fail' | null)[]>([]);
```

- [ ] **Step 3: Update openInlineRecord for checkbox mode**

Find `openInlineRecord()` (line 245). Replace the function body with:

```typescript
  function openInlineRecord(test: IPCTest, round?: number) {
    setSelectedTest(test);
    setRecordNotes('');

    const nextRound = round || (test.totalRounds || 0) + 1;
    setRecordRound(nextRound);

    const sampleSize = test.sampleSize || 1;
    const criteriaType = test.criteriaType || 'numeric';

    // Load existing values for this round (if editing existing round)
    const roundSamples = test.rounds?.find((r) => r.round === nextRound)?.samples || [];

    if (criteriaType === 'checkbox') {
      // Checkbox mode: load pass/fail states
      const results = Array.from({ length: sampleSize }, (_, i) => {
        const sample = roundSamples.find((s) => s.sampleNumber === i + 1);
        return (sample?.result as 'pass' | 'fail' | null) ?? null;
      });
      setCheckboxResults(results);
      setSampleValues([]);
      setNumericResult(undefined);
    } else if (sampleSize > 1) {
      const values = Array.from({ length: sampleSize }, (_, i) => {
        const sample = roundSamples.find((s) => s.sampleNumber === i + 1);
        return sample?.numericValue != null ? Number(sample.numericValue) : undefined;
      });
      setSampleValues(values);
      setCheckboxResults([]);
      setNumericResult(undefined);
    } else {
      const existingVal = roundSamples.length > 0 && roundSamples[0].numericValue != null
        ? Number(roundSamples[0].numericValue) : undefined;
      setNumericResult(existingVal);
      setSampleValues([]);
      setCheckboxResults([]);
    }
  }
```

- [ ] **Step 4: Update handleSaveRecord for checkbox mode**

Find `handleSaveRecord()` (line 273). Replace the function body with:

```typescript
  function handleSaveRecord() {
    if (!selectedTest) return;

    const sampleSize = selectedTest.sampleSize || 1;
    const criteriaType = selectedTest.criteriaType || 'numeric';

    if (criteriaType === 'checkbox') {
      // Checkbox mode: submit results directly
      const samples = checkboxResults.map((r, i) => ({
        sampleNumber: i + 1,
        result: r || 'pass',
      }));
      recordMutation.mutate({
        qualityTestId: selectedTest.id,
        notes: recordNotes || undefined,
        testRound: recordRound,
        samples,
      });
    } else if (sampleSize > 1) {
      // Multi-sample numeric
      const samples = sampleValues.map((v, i) => ({
        sampleNumber: i + 1,
        numericValue: v,
      }));
      recordMutation.mutate({
        qualityTestId: selectedTest.id,
        notes: recordNotes || undefined,
        testRound: recordRound,
        samples,
      });
    } else {
      // Single value numeric
      recordMutation.mutate({
        qualityTestId: selectedTest.id,
        numericResult,
        notes: recordNotes || undefined,
        testRound: recordRound,
      });
    }
  }
```

- [ ] **Step 5: Add checkbox input UI and summary bar to inline record form**

Find the inline record form section. Locate the `{/* Multi-sample inputs */}` block (line 650-672). After it, add the checkbox mode UI:

```tsx
                      {/* Checkbox mode inputs */}
                      {(test.criteriaType === 'checkbox') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            ผลการตรวจ ({test.sampleSize} ตัวอย่าง)
                          </label>
                          <div className="grid grid-cols-5 gap-2">
                            {checkboxResults.map((val, idx) => (
                              <div key={idx} className="text-center">
                                <label className="block text-xs text-gray-500 mb-0.5">#{idx + 1}</label>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    className={`flex-1 px-1 py-1.5 rounded text-xs font-medium transition-colors ${
                                      val === 'pass'
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-100 text-gray-500 hover:bg-green-100'
                                    }`}
                                    onClick={() => {
                                      const next = [...checkboxResults];
                                      next[idx] = 'pass';
                                      setCheckboxResults(next);
                                    }}
                                  >
                                    Pass
                                  </button>
                                  <button
                                    type="button"
                                    className={`flex-1 px-1 py-1.5 rounded text-xs font-medium transition-colors ${
                                      val === 'fail'
                                        ? 'bg-red-500 text-white'
                                        : 'bg-gray-100 text-gray-500 hover:bg-red-100'
                                    }`}
                                    onClick={() => {
                                      const next = [...checkboxResults];
                                      next[idx] = 'fail';
                                      setCheckboxResults(next);
                                    }}
                                  >
                                    Fail
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
```

Also update the existing multi-sample condition to exclude checkbox mode. Change:

```tsx
{(test.sampleSize || 1) > 1 && (
```

To:

```tsx
{test.criteriaType !== 'checkbox' && (test.sampleSize || 1) > 1 && (
```

And change the single value condition:

```tsx
{(test.sampleSize || 1) <= 1 && (
```

To:

```tsx
{test.criteriaType !== 'checkbox' && (test.sampleSize || 1) <= 1 && (
```

- [ ] **Step 6: Add real-time summary bar**

After the checkbox/numeric inputs section (before `{/* Notes */}`), add:

```tsx
                      {/* Summary bar — real-time pass/fail preview */}
                      {(() => {
                        const criteriaType = test.criteriaType || 'numeric';
                        const tolerancePct = Number(test.tolerancePercent) || 0;
                        let passCount = 0;
                        let totalCount = 0;

                        if (criteriaType === 'checkbox') {
                          const filled = checkboxResults.filter((r) => r != null);
                          totalCount = filled.length;
                          passCount = filled.filter((r) => r === 'pass').length;
                        } else if ((test.sampleSize || 1) > 1) {
                          const filled = sampleValues.filter((v) => v != null);
                          totalCount = filled.length;
                          passCount = filled.filter((v) =>
                            v != null && test.specMinValue != null && test.specMaxValue != null &&
                            v >= Number(test.specMinValue) && v <= Number(test.specMaxValue)
                          ).length;
                        }

                        if (totalCount === 0) return null;

                        const failCount = totalCount - passCount;
                        const failPct = (failCount / totalCount) * 100;
                        const overallPass = failPct <= tolerancePct;

                        return (
                          <div className={`flex items-center justify-between p-2 rounded text-sm font-medium ${
                            overallPass ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                          }`}>
                            <span>
                              ผ่าน {passCount}/{totalCount} ตัวอย่าง ({(100 - failPct).toFixed(0)}%)
                            </span>
                            <span className="text-xs">
                              Tolerance: ±{tolerancePct}% — {overallPass ? 'PASS' : 'FAIL'}
                            </span>
                          </div>
                        );
                      })()}
```

- [ ] **Step 7: Update round history sample display for checkbox mode**

Find the round samples grid (line 561-577). Update the sample display to handle checkbox mode:

```tsx
                                {round.samples.map((sample) => (
                                  <div
                                    key={sample.id}
                                    className={`text-center p-1.5 rounded text-xs ${
                                      sample.result === 'pass'
                                        ? 'bg-green-50 text-green-700'
                                        : sample.result === 'fail'
                                        ? 'bg-red-50 text-red-700'
                                        : 'bg-gray-50 text-gray-600'
                                    }`}
                                  >
                                    <div className="font-medium">#{sample.sampleNumber}</div>
                                    <div>
                                      {sample.numericValue != null
                                        ? Number(sample.numericValue).toFixed(2)
                                        : sample.result === 'pass' ? 'Pass'
                                        : sample.result === 'fail' ? 'Fail'
                                        : sample.textValue || '-'}
                                    </div>
                                  </div>
                                ))}
```

- [ ] **Step 8: Run type check**

```bash
bunx tsc --noEmit --skipLibCheck
```

- [ ] **Step 9: Commit**

```bash
git add src/app/production/work-orders/[id]/ipc/page.tsx
git commit -m "feat(ipc): add checkbox recording mode and summary bar to IPC page"
```

---

### Task 8: E2E Test — IPC Criteria Form renders correctly

**Files:**
- Create: `tests/unit/pages/master-data/ipc-criteria-form-enhanced.test.tsx`

- [ ] **Step 1: Write form test**

Create `tests/unit/pages/master-data/ipc-criteria-form-enhanced.test.tsx`:

```tsx
/**
 * Tests for enhanced IPC Criteria Form with dosageForm, criteriaType, tolerancePercent
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock next modules
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null, isLoading: false }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

// Mock DevExtreme components
vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, ...props }: any) => <button {...props}>{text}</button>,
}));
vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: ({ value, placeholder, ...props }: any) => <input value={value || ''} placeholder={placeholder} readOnly />,
}));
vi.mock('@/components/ui/dx-number-box', () => ({
  DxNumberBox: ({ value, placeholder, ...props }: any) => <input type="number" value={value ?? ''} placeholder={placeholder} readOnly />,
}));
vi.mock('@/components/ui/dx-switch', () => ({
  DxSwitch: ({ value, ...props }: any) => <input type="checkbox" checked={value} readOnly />,
}));
vi.mock('@/components/ui/dx-select-box', () => ({
  DxSelectBox: ({ value, placeholder, ...props }: any) => <select value={value || ''}><option>{placeholder || value}</option></select>,
}));
vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title }: any) => <h1>{title}</h1>,
}));

import { IPCCriteriaForm } from '@/components/master-data/IPCCriteriaForm';

describe('IPCCriteriaForm Enhanced', () => {
  it('renders without crashing in create mode', () => {
    render(<IPCCriteriaForm mode="create" />);
    expect(screen.getByText('New IPC Criteria')).toBeDefined();
  });

  it('renders dosage form field', () => {
    render(<IPCCriteriaForm mode="create" />);
    expect(screen.getByText(/รูปแบบยา/)).toBeDefined();
  });

  it('renders criteria type field', () => {
    render(<IPCCriteriaForm mode="create" />);
    expect(screen.getByText(/ประเภทเกณฑ์/)).toBeDefined();
  });

  it('renders tolerance percent field', () => {
    render(<IPCCriteriaForm mode="create" />);
    expect(screen.getByText(/Tolerance ±%/)).toBeDefined();
  });

  it('renders Min/Max fields by default (numeric mode)', () => {
    render(<IPCCriteriaForm mode="create" />);
    expect(screen.getByText('Min Value')).toBeDefined();
    expect(screen.getByText('Max Value')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test**

```bash
bun test tests/unit/pages/master-data/ipc-criteria-form-enhanced.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/pages/master-data/ipc-criteria-form-enhanced.test.tsx
git commit -m "test(ipc): add IPC criteria form UI tests for new fields"
```

---

### Task 9: Update changelog

**Files:**
- Modify: `public/changelog-herbal-erp.html`

- [ ] **Step 1: Add changelog entries for IPC enhancement**

Add entries to the `DATA` array in `public/changelog-herbal-erp.html`:

```javascript
{module:'Master Data',menu:'IPC Criteria',sub:'New/Edit',type:'feat',desc:'เพิ่มช่องรูปแบบยา (Dosage Form) สำหรับจัดกลุ่มเกณฑ์ตามประเภทยา',date:'8 เม.ย. 69',prompt:'เพิ่มช่องกำหนดรูปแบบยาใน IPC Criteria'},
{module:'Master Data',menu:'IPC Criteria',sub:'New/Edit',type:'feat',desc:'เพิ่มประเภทเกณฑ์ 2 แบบ: ตัวเลข (Numeric) และ ติ๊กเลือก (Checkbox)',date:'8 เม.ย. 69',prompt:'เพิ่มช่องกำหนดเกณฑ์ numeric/checkbox ใน IPC Criteria'},
{module:'Master Data',menu:'IPC Criteria',sub:'New/Edit',type:'feat',desc:'เพิ่ม Tolerance ±% สำหรับกำหนดเปอร์เซ็นต์ที่ยอมรับได้',date:'8 เม.ย. 69',prompt:'เพิ่มเกณฑ์ tolerance percent ใน IPC Criteria'},
{module:'Production',menu:'Work Orders',sub:'IPC Control',type:'feat',desc:'รองรับการบันทึก IPC แบบ Checkbox (ติ๊กผ่าน/ไม่ผ่าน) นอกเหนือจากตัวเลข',date:'8 เม.ย. 69',prompt:'เพิ่มโหมด checkbox ในหน้าบันทึก IPC'},
{module:'Production',menu:'Work Orders',sub:'IPC Control',type:'feat',desc:'เพิ่ม Summary Bar แสดงผลผ่าน/ไม่ผ่าน แบบ real-time พร้อม Tolerance %',date:'8 เม.ย. 69',prompt:'เพิ่ม summary bar แสดงผลการตรวจ IPC'},
{module:'Production',menu:'Work Orders',sub:'IPC Control',type:'feat',desc:'ปรับ pass/fail logic ใช้ Tolerance % แทนแบบเดิม (sample ใดไม่ผ่าน=ทั้งหมดไม่ผ่าน)',date:'8 เม.ย. 69',prompt:'ปรับ logic ตัดสิน IPC ให้ใช้ tolerance percent'},
```

- [ ] **Step 2: Commit**

```bash
git add public/changelog-herbal-erp.html
git commit -m "docs: add IPC criteria enhancement entries to changelog"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run all IPC-related tests**

```bash
bun test tests/integration/services/ipc-tolerance.test.ts tests/unit/pages/master-data/ipc-criteria-form-enhanced.test.tsx
```

Expected: All PASS.

- [ ] **Step 2: Run full type check**

```bash
bunx tsc --noEmit --skipLibCheck
```

Expected: No errors.

- [ ] **Step 3: Run full test suite**

```bash
bun test
```

Expected: No regressions.

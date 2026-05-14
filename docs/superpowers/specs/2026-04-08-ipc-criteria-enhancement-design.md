# IPC Criteria Enhancement Design

**Date:** 2026-04-08
**Status:** Approved
**Scope:** Enhance IPC (In-Process Control) system with dosage form, criteria type (numeric/checkbox), and tolerance-based pass/fail logic

---

## Problem Statement

The current IPC system only supports numeric value recording with absolute min/max pass/fail (any single sample failure = entire test failure). Production needs:

1. **Dosage form** field to categorize criteria by drug form (capsule, tablet, etc.)
2. **Two criteria types:**
   - Numeric (3.1): Enter measured values, auto-check against min/max, with percentage tolerance
   - Checkbox (3.2): Tick pass/fail per sample for qualitative tests (appearance, color, odor)
3. **Tolerance-based pass/fail:** Instead of "any fail = all fail", use ±X% threshold — e.g., if tolerance is 10% and 1/10 samples fail (10%), the test still passes

## Current State

### What exists:
- `ipc_criteria` table: code, name, nameTh, testMethod, specification, minValue, maxValue, unit, sampleSize, checkIntervalMinutes, isCritical, isActive
- IPC Criteria CRUD at `/master-data/ipc-criteria`
- IPC recording in work orders at `/production/work-orders/[id]/ipc`
- Multi-sample numeric recording with round-based tracking
- Per-round approval workflow
- Auto pass/fail based on min/max range (all-or-nothing)

### What's missing:
- No `dosageForm` field
- No `criteriaType` distinction (numeric vs checkbox)
- No `tolerancePercent` for aggregate pass/fail
- No checkbox-based recording UI

---

## Design

### 1. Database Schema Changes

Add 3 columns to `ipc_criteria` table (both SQLite and MySQL schemas):

| Column | SQLite Type | MySQL Type | Default | Description |
|--------|-------------|------------|---------|-------------|
| `dosage_form` | text | varchar(100) | NULL | Drug form: capsule, tablet, powder, liquid, cream, ointment, suppository, other |
| `criteria_type` | text | varchar(20) | 'numeric' | `numeric` = measured values + min/max, `checkbox` = pass/fail tick |
| `tolerance_percent` | real | decimal(5,2) | 0 | Acceptable failure percentage. 0 = any fail means test fail (backward compatible) |

**Backward compatibility:** Existing records default to `criteria_type='numeric'`, `tolerance_percent=0`, preserving current all-or-nothing behavior.

**When `criteria_type='checkbox'`:** Fields `minValue`, `maxValue`, `unit` are ignored (may be null).

### 2. Pass/Fail Logic Changes

Located in `src/lib/services/wo-execution.service.ts` → `recordIPCTestResult()`.

#### For criteriaType = 'numeric':

```
For each sample:
  if value < minValue OR value > maxValue → sample result = 'fail'
  else → sample result = 'pass'

failCount = number of failed samples
failPercent = (failCount / totalSamples) * 100

if failPercent > tolerancePercent → overall test = 'fail'
if failPercent <= tolerancePercent → overall test = 'pass'
```

**Example:** 10 samples, tolerance=10%, min=190, max=210
- Values: [200, 195, 215, 198, 201, 193, 205, 199, 202, 197]
- Sample #3 (215) fails → 1/10 = 10% ≤ 10% → **PASS**
- If 2 samples fail → 20% > 10% → **FAIL**

#### For criteriaType = 'checkbox':

```
For each sample:
  User ticks pass or fail (no numeric value)

failCount = number of samples marked 'fail'
failPercent = (failCount / totalSamples) * 100

if failPercent > tolerancePercent → overall test = 'fail'
if failPercent <= tolerancePercent → overall test = 'pass'
```

#### Data stored in `ipc_test_samples`:

| criteriaType | numericValue | textValue | result |
|---|---|---|---|
| numeric | measured value | null | pass/fail (auto from min/max) |
| checkbox | null | null | pass/fail (from user input) |

### 3. IPC Criteria Form (Master Data UI)

File: `src/components/master-data/IPCCriteriaForm.tsx`

**New fields added to form:**

1. **SelectBox "รูปแบบยา" (Dosage Form)** — predefined options: capsule, tablet, powder, liquid, cream, ointment, suppository, other
2. **RadioGroup "ประเภทเกณฑ์" (Criteria Type)** — two options:
   - `numeric` — ใส่ค่าตัวเลข + เทียบ Min/Max
   - `checkbox` — ติ๊กผ่าน/ไม่ผ่าน
3. **NumberBox "Tolerance ±%" (Tolerance Percent)** — range 0-100, default 0

**Conditional visibility:**
- When `criteriaType = 'checkbox'`: hide Min Value, Max Value, Unit fields
- When `criteriaType = 'numeric'`: show all fields

### 4. IPC Recording (Work Order UI)

File: `src/app/production/work-orders/[id]/ipc/page.tsx`

**Changes to inline record form:**

- **numeric mode:** NumberBox per sample (unchanged from current behavior)
- **checkbox mode:** Pass/Fail toggle buttons per sample instead of NumberBox
  - Green "Pass" / Red "Fail" toggle for each sample slot
  - No numeric input needed

**Summary bar (both modes):**
- Display: "ผ่าน X/Y ตัวอย่าง (Z%) — Tolerance: ±T%"
- Color: green if overall pass, red if overall fail
- Shows real-time as user enters data

**Sample display in round history:**
- numeric: show numeric value with pass/fail color
- checkbox: show Pass/Fail badge (no numeric value)

### 5. API Changes

#### Master Data API (`/api/master-data/ipc-criteria`)
- GET/POST/PUT: include `dosageForm`, `criteriaType`, `tolerancePercent` fields
- Validation: `criteriaType` must be 'numeric' or 'checkbox'
- Validation: `tolerancePercent` must be 0-100

#### Work Order IPC API (`/api/production/work-orders/[id]/ipc`)

**GET response:** Include `criteriaType`, `tolerancePercent`, `dosageForm` in each test object (joined from ipc_criteria via bom_in_process_qc).

**POST record action:** Accept `samples[].result` for checkbox mode:
```json
{
  "action": "record",
  "qualityTestId": 123,
  "testRound": 1,
  "samples": [
    { "sampleNumber": 1, "result": "pass" },
    { "sampleNumber": 2, "result": "fail" },
    { "sampleNumber": 3, "result": "pass" }
  ]
}
```

For numeric mode (unchanged):
```json
{
  "action": "record",
  "qualityTestId": 123,
  "testRound": 1,
  "samples": [
    { "sampleNumber": 1, "numericValue": 200.5 },
    { "sampleNumber": 2, "numericValue": 195.3 }
  ]
}
```

### 6. BOM IPC Config

**No schema changes needed.** `bom_in_process_qc` references `criteriaId` (FK to `ipc_criteria`). The `criteriaType`, `tolerancePercent`, and `dosageForm` are accessed via JOIN when initializing work order IPC tests.

The `initializeWOIPCTests()` function already copies spec values (minValue, maxValue, unit, specification) to `quality_tests`. It will additionally need to store `criteriaType` and `tolerancePercent` so the recording logic knows which mode to use.

**Option:** Store `criteriaType` and `tolerancePercent` on `quality_tests` record (new columns) so recording doesn't need to re-query ipc_criteria. This is preferred for data integrity.

### 7. quality_tests Schema Addition

Add 2 columns to `quality_tests` table:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `criteria_type` | varchar(20) | 'numeric' | Copied from ipc_criteria at initialization |
| `tolerance_percent` | decimal(5,2) | 0 | Copied from ipc_criteria at initialization |

These are populated by `initializeWOIPCTests()` and used by `recordIPCTestResult()`.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/db/schema.ts` | Add 3 cols to ipc_criteria (SQLite+MySQL), 2 cols to quality_tests (SQLite+MySQL) |
| `src/components/master-data/IPCCriteriaForm.tsx` | Add dosageForm, criteriaType, tolerancePercent fields |
| `src/app/api/master-data/ipc-criteria/route.ts` | Handle new fields in CRUD |
| `src/lib/services/wo-execution.service.ts` | Update recordIPCTestResult() for tolerance logic + checkbox mode, update initializeWOIPCTests() to copy criteriaType/tolerancePercent |
| `src/app/production/work-orders/[id]/ipc/page.tsx` | Checkbox mode UI, summary bar, criteriaType-aware recording |
| `src/app/api/production/work-orders/[id]/ipc/route.ts` | Return criteriaType/tolerancePercent, accept checkbox samples |

## Out of Scope

- Dosage form master data management (use predefined list for now)
- Filtering IPC criteria by dosage form in BOM config (future enhancement)
- Historical migration of existing test data

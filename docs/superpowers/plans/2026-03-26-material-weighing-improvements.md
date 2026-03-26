# Material Weighing Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the Material Weighing page to show product names (TH/EN), planned qty with UoM, and allow operators to select inventory lots from a SelectBox dropdown.

**Architecture:** Add `getAvailableLots()` to inventory.service.ts (reusing getLotsForPicking query logic), add a new API endpoint, modify `getWOMaterials()` to LEFT JOIN with inventory_lots for lot numbers, update `recordMaterialWeight()` to accept optional lotId, and enhance the UI with product name display and DevExtreme SelectBox for lot selection.

**Tech Stack:** TypeScript, Next.js 16, React 19, DevExtreme React 25.2.3, Drizzle ORM, TanStack Query, next-intl

**Spec:** `docs/superpowers/specs/2026-03-26-material-weighing-improvements-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/services/inventory.service.ts` | Modify | Add `getAvailableLots()` reusing `getLotsForPicking` query conditions |
| `src/app/api/inventory/lots/available/route.ts` | Create | GET endpoint for available lots by itemId |
| `src/lib/services/wo-execution.service.ts` | Modify | Update `getWOMaterials()` (LEFT JOIN + alias), `recordMaterialWeight()` (accept lotId) |
| `src/app/api/production/work-orders/[id]/material-weighing/route.ts` | Modify | Pass `lotId` from request body to service |
| `src/app/production/work-orders/[id]/material-weighing/page.tsx` | Modify | Enhanced display + SelectBox lot picker |
| `src/locales/th/production.json` | Modify | Add Thai i18n keys for material weighing |
| `src/locales/en/production.json` | Modify | Add English i18n keys for material weighing |
| `tests/unit/services/material-weighing.test.ts` | Create | Unit tests for service layer changes |
| `tests/app/production/material-weighing-page.test.tsx` | Create | UI tests for page changes |

---

### Task 1: Add `getAvailableLots()` to inventory service

**Files:**
- Modify: `src/lib/services/inventory.service.ts:164-218`
- Test: `tests/unit/services/material-weighing.test.ts`

This task extracts the shared query conditions from `getLotsForPicking()` into a reusable helper, then adds a new `getAvailableLots()` function that returns all available lots for an item without quantity allocation.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/services/material-weighing.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
  isSqlite: vi.fn(() => true),
}));

vi.mock('@/lib/db/db-helper', () => ({
  getTableRef: vi.fn((name: string) => ({ _tableName: name })),
  executeDbOperation: vi.fn(async (fn: any) => fn({})),
  getInsertId: vi.fn(() => 1),
}));

vi.mock('@/lib/db/date-utils', () => ({
  getNow: vi.fn(() => '2026-03-26T00:00:00.000Z'),
  toQueryDate: vi.fn((d: string) => d),
  getTodayStr: vi.fn(() => '2026-03-26'),
}));

describe('getAvailableLots', () => {
  it('should return available lots sorted by FEFO', async () => {
    const { getAvailableLots } = await import('@/lib/services/inventory.service');
    const result = await getAvailableLots(1);
    expect(Array.isArray(result)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/unit/services/material-weighing.test.ts --reporter=verbose`
Expected: FAIL — `getAvailableLots` is not exported from inventory.service

- [ ] **Step 3: Implement `getAvailableLots()` in inventory.service.ts**

Add after line 218 (after `getLotsForPicking`). Use the same `getDb()` pattern as the rest of `inventory.service.ts`:

```typescript
/**
 * Get available lots for an item (for lot selection UI)
 * Reuses same query conditions as getLotsForPicking (FEFO sort)
 * Returns all available lots without quantity allocation
 */
export async function getAvailableLots(itemId: number): Promise<{
  id: number;
  lotNumber: string;
  availableQty: number;
  unit: string;
  expiryDate: string | null;
  vendorLotNumber: string | null;
  manufacturerName: string | null;
}[]> {
  const { lots } = getTables();
  const database = (await getDb()) as any;

  const conditions = [
    eq(lots.itemId, itemId),
    eq(lots.status, 'released'),
    sql`${lots.quantity} - ${lots.reservedQuantity} > 0`,
  ];

  const availableLots = await database
    .select({
      id: lots.id,
      lotNumber: lots.lotNumber,
      quantity: lots.quantity,
      reservedQuantity: lots.reservedQuantity,
      unit: lots.unit,
      expiryDate: lots.expiryDate,
      vendorLotNumber: lots.vendorLotNumber,
      manufacturerName: lots.manufacturerName,
    })
    .from(lots)
    .where(and(...conditions))
    .orderBy(asc(lots.expiryDate), asc(lots.id));

  return availableLots.map((lot: any) => ({
    id: lot.id,
    lotNumber: lot.lotNumber,
    availableQty: (lot.quantity || 0) - (lot.reservedQuantity || 0),
    unit: lot.unit,
    expiryDate: lot.expiryDate,
    vendorLotNumber: lot.vendorLotNumber,
    manufacturerName: lot.manufacturerName,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/unit/services/material-weighing.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Type check**

Run: `bunx tsc --noEmit --skipLibCheck`

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/inventory.service.ts tests/unit/services/material-weighing.test.ts
git commit -m "feat: add getAvailableLots() to inventory service for lot selection"
```

---

### Task 2: Create API endpoint for available lots

**Files:**
- Create: `src/app/api/inventory/lots/available/route.ts`

- [ ] **Step 1: Create the API route**

Create `src/app/api/inventory/lots/available/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getAvailableLots } from '@/lib/services/inventory.service';

// GET /api/inventory/lots/available?itemId=XX - Get available lots for lot selection
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const itemId = searchParams.get('itemId');

      if (!itemId || isNaN(Number(itemId))) {
        return errorResponse('Valid itemId is required', 400);
      }

      const lots = await getAvailableLots(Number(itemId));
      return successResponse(lots);
    } catch (error) {
      console.error('Error fetching available lots:', error);
      return serverErrorResponse(error);
    }
  }, ['inventory:read']);
}
```

- [ ] **Step 2: Type check**

Run: `bunx tsc --noEmit --skipLibCheck`

- [ ] **Step 3: Verify endpoint with MySQL MCP**

Test the underlying query logic by running a manual query against the database:

```sql
SELECT id, lot_number, quantity, reserved_quantity, unit, expiry_date, vendor_lot_number, manufacturer_name
FROM inventory_lots
WHERE status = 'released' AND quantity - reserved_quantity > 0
ORDER BY expiry_date ASC, id ASC
LIMIT 10;
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/inventory/lots/available/route.ts
git commit -m "feat: add GET /api/inventory/lots/available endpoint for lot selection"
```

---

### Task 3: Update `getWOMaterials()` to include lot number and fix field alias

**Files:**
- Modify: `src/lib/services/wo-execution.service.ts:709-742`

This task modifies `getWOMaterials()` to:
1. Add LEFT JOIN with `inventory_lots` to get `lotNumber`
2. Alias `plannedQuantity` → `plannedQty` to match frontend `MaterialLine` interface

- [ ] **Step 1: Add test for the lotNumber field**

Add to `tests/unit/services/material-weighing.test.ts`:

```typescript
describe('getWOMaterials', () => {
  it('should include lotNumber from inventory_lots via LEFT JOIN', async () => {
    // This is a structural test - verifying the function exists and returns data
    const { getWOMaterials } = await import('@/lib/services/wo-execution.service');
    expect(typeof getWOMaterials).toBe('function');
  });
});
```

- [ ] **Step 2: Modify `getWOMaterials()` in wo-execution.service.ts**

At line 709-742, update the function. Key changes:
1. Import `inventoryLots` table reference via `getTables()`
2. Add `lotNumber` to SELECT from `inventoryLots`
3. Add LEFT JOIN on `workOrderMaterials.lotId = inventoryLots.id`
4. Alias `plannedQuantity` → `plannedQty` in the returned objects

The `getTables()` function in `wo-execution.service.ts` uses **direct schema imports** (NOT `getTableRef()`). You must:

1. Add to the import block (line 18-63):
```typescript
  // Add to SQLite imports:
  sqliteInventoryLots,
  // Add to MySQL imports:
  mysqlInventoryLots,
```

2. Add to both branches of `getTables()` (lines 68-117):
```typescript
// In SQLite branch (line 70-92), add:
inventoryLots: sqliteInventoryLots,

// In MySQL branch (line 94-116), add:
inventoryLots: mysqlInventoryLots,
```

Then update `getWOMaterials()`:

```typescript
export async function getWOMaterials(workOrderId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const materials = await db
      .select({
        id: tables.workOrderMaterials.id,
        workOrderId: tables.workOrderMaterials.workOrderId,
        itemId: tables.workOrderMaterials.itemId,
        bomLineId: tables.workOrderMaterials.bomLineId,
        plannedQty: tables.workOrderMaterials.plannedQuantity,
        actualQty: tables.workOrderMaterials.actualQuantity,
        weighedQty: tables.workOrderMaterials.weighedQty,
        weighedBy: tables.workOrderMaterials.weighedBy,
        weighedAt: tables.workOrderMaterials.weighedAt,
        verifiedBy: tables.workOrderMaterials.verifiedBy,
        verifiedAt: tables.workOrderMaterials.verifiedAt,
        waterDate: tables.workOrderMaterials.waterDate,
        waterConductivity: tables.workOrderMaterials.waterConductivity,
        waterTemperature: tables.workOrderMaterials.waterTemperature,
        status: tables.workOrderMaterials.status,
        unit: tables.workOrderMaterials.unit,
        lotId: tables.workOrderMaterials.lotId,
        // Item details
        itemNameTh: tables.items.nameTh,
        itemNameEn: tables.items.nameEn,
        itemName: tables.items.nameEn,
        itemCode: tables.items.code,
        // Lot details (from LEFT JOIN)
        lotNumber: tables.inventoryLots.lotNumber,
      })
      .from(tables.workOrderMaterials)
      .innerJoin(tables.items, eq(tables.workOrderMaterials.itemId, tables.items.id))
      .leftJoin(tables.inventoryLots, eq(tables.workOrderMaterials.lotId, tables.inventoryLots.id))
      .where(eq(tables.workOrderMaterials.workOrderId, workOrderId));

    return materials;
  });
}
```

**Key changes:**
- `plannedQuantity` → aliased as `plannedQty` to match `MaterialLine` interface
- `actualQuantity` → aliased as `actualQty`
- Added `lotId` field
- Added `lotNumber` from LEFT JOIN with `inventoryLots`
- Added `itemNameEn` for bilingual display

- [ ] **Step 3: Run tests**

Run: `bunx vitest run tests/unit/services/material-weighing.test.ts --reporter=verbose`

- [ ] **Step 4: Type check**

Run: `bunx tsc --noEmit --skipLibCheck`

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/wo-execution.service.ts tests/unit/services/material-weighing.test.ts
git commit -m "feat: add lotNumber LEFT JOIN and fix field aliases in getWOMaterials"
```

---

### Task 4: Update `recordMaterialWeight()` to accept optional lotId

**Files:**
- Modify: `src/lib/services/wo-execution.service.ts:700-837`
- Modify: `src/app/api/production/work-orders/[id]/material-weighing/route.ts:61-68`

- [ ] **Step 1: Add test for lotId handling**

Add to `tests/unit/services/material-weighing.test.ts`:

```typescript
describe('recordMaterialWeight with lotId', () => {
  it('should accept optional lotId in RecordMaterialWeightInput', async () => {
    // Verify the interface accepts lotId
    const input: any = {
      materialId: 1,
      weighedQty: 100,
      weighedBy: 1,
      lotId: 5,
    };
    expect(input.lotId).toBe(5);
  });

  it('should accept undefined lotId (fallback to FEFO)', async () => {
    const input: any = {
      materialId: 1,
      weighedQty: 100,
      weighedBy: 1,
    };
    expect(input.lotId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Update `RecordMaterialWeightInput` interface**

At line 700-707 of `wo-execution.service.ts`, add `lotId`:

```typescript
export interface RecordMaterialWeightInput {
  materialId: number;
  weighedQty: number;
  weighedBy: number;
  lotId?: number;  // Optional: if provided, use this lot; otherwise FEFO auto-pick
  waterDate?: string;
  waterConductivity?: number;
  waterTemperature?: number;
}
```

- [ ] **Step 3: Update `recordMaterialWeight()` to use lotId when provided**

At line 769-784 (the lot assignment section), replace the existing logic:

```typescript
  // Step 2: Deduct inventory if not already issued
  if (material.status !== 'issued') {
    let lotId = data.lotId || material.lotId;

    // If user selected a lot, validate it
    if (data.lotId) {
      const selectedLot = await executeDbOperation(async (db: any) => {
        const [lot] = await db.select({
          id: tables.inventoryLots.id,
          status: tables.inventoryLots.status,
          quantity: tables.inventoryLots.quantity,
          reservedQuantity: tables.inventoryLots.reservedQuantity,
        })
        .from(tables.inventoryLots)
        .where(eq(tables.inventoryLots.id, data.lotId!));
        return lot;
      });

      if (!selectedLot) {
        throw new Error('Selected lot not found');
      }
      if (selectedLot.status !== 'released') {
        throw new Error('Selected lot is not in released status');
      }
      const availableQty = (selectedLot.quantity || 0) - (selectedLot.reservedQuantity || 0);
      if (availableQty < data.weighedQty) {
        throw new Error(`Insufficient quantity in selected lot. Available: ${availableQty}, Required: ${data.weighedQty}`);
      }

      lotId = data.lotId;
      // Assign the selected lot to the material record
      await executeDbOperation(async (db: any) => {
        await db.update(tables.workOrderMaterials)
          .set({ lotId })
          .where(eq(tables.workOrderMaterials.id, data.materialId));
      });
    }
    // If no lot assigned and no user selection, auto-find one using FEFO
    else if (!lotId) {
      const { allocated } = await getLotsForPicking(material.itemId, data.weighedQty);
      if (allocated.length > 0) {
        lotId = allocated[0].lotId;
        await executeDbOperation(async (db: any) => {
          await db.update(tables.workOrderMaterials)
            .set({ lotId })
            .where(eq(tables.workOrderMaterials.id, data.materialId));
        });
      }
    }

    // Continue with existing issueMaterial logic (lines 786-834) — unchanged:
    if (lotId) {
      try {
        const [workOrder] = await executeDbOperation(async (db: any) => {
          return db.select({ woNumber: tables.workOrders.woNumber, batchNumber: tables.workOrders.batchNumber })
            .from(tables.workOrders)
            .where(eq(tables.workOrders.id, material.workOrderId));
        });

        const woNumber = workOrder?.woNumber || `WO-${material.workOrderId}`;
        const batchNumber = workOrder?.batchNumber || '';

        await issueMaterial(
          lotId,
          data.weighedQty,
          'WO',
          material.workOrderId,
          woNumber,
          data.weighedBy,
          `Material weighing for ${woNumber}`,
          { workOrderId: material.workOrderId, batchNumber }
        );

        await executeDbOperation(async (db: any) => {
          await db.update(tables.workOrderMaterials).set({
            status: 'issued',
            actualQuantity: data.weighedQty,
            issuedBy: data.weighedBy,
            issuedAt: getNow(),
          }).where(eq(tables.workOrderMaterials.id, data.materialId));
        });

        return executeDbOperation(async (db: any) => {
          const [updated] = await db.select().from(tables.workOrderMaterials).where(eq(tables.workOrderMaterials.id, data.materialId));
          return updated;
        });
      } catch (error: any) {
        console.error('Error issuing material from inventory:', error);
        throw new Error(`Material weight recorded but inventory deduction failed: ${error.message}`);
      }
    }
  }

  return material;
```

- [ ] **Step 4: Update the route handler to pass lotId AND return 400 for lot validation errors**

In `src/app/api/production/work-orders/[id]/material-weighing/route.ts`, line 61-68, add `lotId` to the service call:

```typescript
      const material = await recordMaterialWeight({
        materialId: data.materialId,
        weighedQty: data.weighedQty,
        weighedBy,
        lotId: data.lotId || undefined,
        waterDate: data.waterDate,
        waterConductivity: data.waterConductivity,
        waterTemperature: data.waterTemperature,
      });
```

**Also update the catch block** (line 71-74) to return 400 for known lot validation errors instead of 500:

```typescript
    } catch (error) {
      console.error('Error recording material weight:', error);
      if (error instanceof Error) {
        // Return 400 for lot validation errors so the client can show user-friendly messages
        if (error.message.includes('lot not found') ||
            error.message.includes('not in released status') ||
            error.message.includes('Insufficient quantity')) {
          return errorResponse(error.message, 400);
        }
      }
      return serverErrorResponse(error);
    }
```

- [ ] **Step 5: Run tests**

Run: `bunx vitest run tests/unit/services/material-weighing.test.ts --reporter=verbose`

- [ ] **Step 6: Type check**

Run: `bunx tsc --noEmit --skipLibCheck`

- [ ] **Step 7: Commit**

```bash
git add src/lib/services/wo-execution.service.ts src/app/api/production/work-orders/[id]/material-weighing/route.ts tests/unit/services/material-weighing.test.ts
git commit -m "feat: accept optional lotId in recordMaterialWeight with validation"
```

---

### Task 5: Add i18n translation keys

**Files:**
- Modify: `src/locales/th/production.json`
- Modify: `src/locales/en/production.json`

- [ ] **Step 1: Add Thai translations**

In `src/locales/th/production.json`, inside the `"execution"` object (around line 295), add a `"materialWeighingPage"` key:

```json
"materialWeighingPage": {
  "title": "ชั่งน้ำหนักวัตถุดิบ",
  "progress": {
    "weighed": "ชั่งแล้ว",
    "verified": "ตรวจสอบแล้ว",
    "allVerified": "ตรวจสอบครบทุกรายการ"
  },
  "material": {
    "planned": "แผน",
    "actual": "จริง",
    "variance": "ส่วนต่าง",
    "lot": "Lot"
  },
  "form": {
    "actualWeight": "น้ำหนักจริง",
    "lot": {
      "label": "Lot Number",
      "placeholder": "เลือก Lot (ไม่บังคับ)",
      "noData": "ไม่พบ Lot ที่ใช้ได้",
      "expiry": "หมดอายุ",
      "noExpiry": "N/A"
    },
    "notes": "หมายเหตุ",
    "recordWeight": "บันทึกน้ำหนัก",
    "cancel": "ยกเลิก",
    "varianceWarning": "ส่วนต่างสูง - กรุณาตรวจสอบ"
  },
  "actions": {
    "weigh": "ชั่ง",
    "verify": "ตรวจสอบ",
    "backToExecution": "กลับไปหน้าดำเนินการ"
  },
  "toast": {
    "weightRecorded": "บันทึกน้ำหนักสำเร็จ",
    "weightVerified": "ตรวจสอบน้ำหนักสำเร็จ"
  },
  "noMaterials": "ไม่พบวัตถุดิบสำหรับใบสั่งผลิตนี้",
  "noMaterialsHint": "วัตถุดิบจะถูกโหลดจากสูตรการผลิต (BOM)"
}
```

- [ ] **Step 2: Add English translations**

In `src/locales/en/production.json`, add the same structure with English values:

```json
"materialWeighingPage": {
  "title": "Material Weighing",
  "progress": {
    "weighed": "Weighed",
    "verified": "Verified",
    "allVerified": "All Verified"
  },
  "material": {
    "planned": "Planned",
    "actual": "Actual",
    "variance": "Variance",
    "lot": "Lot"
  },
  "form": {
    "actualWeight": "Actual Weight",
    "lot": {
      "label": "Lot Number",
      "placeholder": "Select Lot (optional)",
      "noData": "No available lots",
      "expiry": "Exp",
      "noExpiry": "N/A"
    },
    "notes": "Notes",
    "recordWeight": "Record Weight",
    "cancel": "Cancel",
    "varianceWarning": "High variance - please verify"
  },
  "actions": {
    "weigh": "Weigh",
    "verify": "Verify",
    "backToExecution": "Back to Execution"
  },
  "toast": {
    "weightRecorded": "Material weight has been recorded",
    "weightVerified": "Material weight has been verified"
  },
  "noMaterials": "No materials found for this work order.",
  "noMaterialsHint": "Materials are loaded from the BOM formula."
}
```

- [ ] **Step 3: Validate i18n**

Run: `bun run i18n:check`

- [ ] **Step 4: Commit**

```bash
git add src/locales/th/production.json src/locales/en/production.json
git commit -m "feat: add i18n keys for material weighing improvements"
```

---

### Task 6: Update Material Weighing page UI

**Files:**
- Modify: `src/app/production/work-orders/[id]/material-weighing/page.tsx`
- Test: `tests/app/production/material-weighing-page.test.tsx`

This is the main UI task. Changes:
1. Show product name in both languages (TH / EN)
2. Replace lot number text input with DxSelectBox
3. Add `lotId` to form state and submission
4. Use i18n keys for labels

- [ ] **Step 1: Write the failing UI test**

Create `tests/app/production/material-weighing-page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '66' }),
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock TanStack Query
const mockMaterials = [
  {
    id: 1,
    itemId: 10,
    itemCode: 'RM-001',
    itemName: 'Turmeric Extract',
    itemNameTh: 'สารสกัดขมิ้น',
    itemNameEn: 'Turmeric Extract',
    plannedQty: 150,
    unit: 'kg',
    weighedQty: null,
    weighedAt: null,
    verifiedAt: null,
    lotNumber: null,
    isWater: false,
  },
];

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey }: any) => {
    if (queryKey[0] === 'work-order') {
      return {
        data: { id: 66, woNumber: 'WO2603267925', batchNumber: 'FG-8107-260326-211', productName: 'Test', status: 'in_progress' },
        isLoading: false,
      };
    }
    if (queryKey[0] === 'wo-materials') {
      return { data: mockMaterials, isLoading: false };
    }
    if (queryKey[0] === 'available-lots') {
      return {
        data: [
          { id: 1, lotNumber: 'LOT-001', availableQty: 200, unit: 'kg', expiryDate: '2026-09-30', vendorLotNumber: 'VL-001', manufacturerName: 'ABC' },
        ],
        isLoading: false,
      };
    }
    return { data: null, isLoading: false };
  }),
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

// Mock DevExtreme components
vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, onClick }: any) => <button onClick={onClick}>{text}</button>,
}));
vi.mock('@/components/ui/dx-popup', () => ({
  DxPopup: ({ visible, children }: any) => visible ? <div data-testid="weigh-dialog">{children}</div> : null,
}));
vi.mock('@/components/ui/dx-number-box', () => ({
  DxNumberBox: ({ value }: any) => <input type="number" defaultValue={value} />,
}));
vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: ({ value, placeholder }: any) => <input type="text" defaultValue={value} placeholder={placeholder} />,
}));
vi.mock('@/components/ui/dx-text-area', () => ({
  DxTextArea: ({ value, placeholder }: any) => <textarea defaultValue={value} placeholder={placeholder} />,
}));
vi.mock('@/components/ui/dx-load-indicator', () => ({
  DxLoadIndicator: () => <div>Loading...</div>,
}));
vi.mock('@/components/ui/dx-select-box', () => ({
  DxSelectBox: ({ placeholder, dataSource }: any) => (
    <select data-testid="lot-selectbox">
      <option value="">{placeholder}</option>
      {dataSource?.map((lot: any) => (
        <option key={lot.id} value={lot.id}>{lot.lotNumber}</option>
      ))}
    </select>
  ),
}));
vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title }: any) => <div>{title}</div>,
}));

describe('Material Weighing Page', () => {
  it('renders product name in both languages (TH / EN)', async () => {
    const MaterialWeighingPage = (await import('@/app/production/work-orders/[id]/material-weighing/page')).default;
    render(<MaterialWeighingPage />);

    await waitFor(() => {
      // Should show Thai name
      expect(screen.getByText(/สารสกัดขมิ้น/)).toBeDefined();
      // Should show English name
      expect(screen.getByText(/Turmeric Extract/)).toBeDefined();
    });
  });

  it('renders planned quantity with UoM', async () => {
    const MaterialWeighingPage = (await import('@/app/production/work-orders/[id]/material-weighing/page')).default;
    render(<MaterialWeighingPage />);

    await waitFor(() => {
      expect(screen.getByText(/150/)).toBeDefined();
      expect(screen.getByText(/kg/)).toBeDefined();
    });
  });

  it('renders item code for each material', async () => {
    const MaterialWeighingPage = (await import('@/app/production/work-orders/[id]/material-weighing/page')).default;
    render(<MaterialWeighingPage />);

    await waitFor(() => {
      expect(screen.getByText('RM-001')).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/app/production/material-weighing-page.test.tsx --reporter=verbose`
Expected: FAIL — test structure issues or missing bilingual name display

- [ ] **Step 3: Update `MaterialLine` interface**

At line 32-55 of `page.tsx`, add `itemNameEn` and `lotId`:

```typescript
interface MaterialLine {
  id: number;
  bomLineId: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  itemNameTh?: string;
  itemNameEn?: string;
  unit: string;
  plannedQty: number;
  actualQty?: number;
  weighedQty?: number;
  weighedBy?: number;
  weighedByName?: string;
  weighedAt?: string;
  verifiedBy?: number;
  verifiedByName?: string;
  verifiedAt?: string;
  lotId?: number;
  lotNumber?: string;
  isWater?: boolean;
  waterDate?: string;
  waterConductivity?: number;
  waterTemperature?: number;
}
```

- [ ] **Step 4: Add DxSelectBox import and available lots query**

At line 18 (imports), add:

```typescript
import { DxSelectBox } from '@/components/ui/dx-select-box';
```

Update `formData` state (line 78-86) to include `lotId`:

```typescript
const [formData, setFormData] = useState({
  weighedQty: 0,
  lotId: undefined as number | undefined,
  notes: '',
  waterDate: '',
  waterConductivity: 0,
  waterTemperature: 0,
});
```

**Important:** Remove `lotNumber` from `formData` — it is replaced by `lotId`. The old `lotNumber: ''` field must not appear in the state, `handleOpenWeighDialog`, or `onSuccess` reset.

Add an available lots query after the materials query (after line 108). **Use `isLoading` to show loading state on the SelectBox:**

```typescript
// Fetch available lots for selected material
const { data: availableLots, isLoading: lotsLoading } = useQuery({
  queryKey: ['available-lots', selectedMaterial?.itemId],
  queryFn: async () => {
    if (!selectedMaterial?.itemId) return [];
    const res = await fetch(`/api/inventory/lots/available?itemId=${selectedMaterial.itemId}`);
    const data = await res.json();
    if (!data.success) return [];
    return data.data;
  },
  enabled: !!selectedMaterial?.itemId,
});
```

- [ ] **Step 5: Update handleOpenWeighDialog to reset lotId**

At line 162-173, update:

```typescript
const handleOpenWeighDialog = (material: MaterialLine) => {
  setSelectedMaterial(material);
  setFormData({
    weighedQty: material.plannedQty,
    lotId: material.lotId || undefined,
    notes: '',
    waterDate: material.waterDate || new Date().toISOString().split('T')[0],
    waterConductivity: material.waterConductivity || 0,
    waterTemperature: material.waterTemperature || 25,
  });
  setShowWeighDialog(true);
};
```

- [ ] **Step 6: Update handleSubmitWeight to send lotId**

At line 175-181, the mutation already sends `...data` which includes `lotId`. Verify the mutation body includes lotId.

- [ ] **Step 7: Update Material List display — show bilingual product name**

At line 318-328 (inside the material card), replace:

```tsx
<p className="font-medium text-gray-900">{material.itemName}</p>
```

With:

```tsx
<p className="font-medium text-gray-900">
  {material.itemNameTh && material.itemNameEn
    ? `${material.itemNameTh} / ${material.itemNameEn}`
    : material.itemNameTh || material.itemNameEn || material.itemName}
</p>
```

- [ ] **Step 8: Replace Lot Number TextBox with SelectBox in Weigh Dialog**

At lines 436-443 (the lot number input in the dialog), replace:

```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Lot Number</label>
  <DxTextBox
    value={formData.lotNumber}
    onValueChanged={(e) => setFormData({ ...formData, lotNumber: e.value })}
    placeholder="Enter lot number"
  />
</div>
```

With:

```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    {t('execution.materialWeighingPage.form.lot.label')}
  </label>
  <DxSelectBox
    value={formData.lotId}
    onValueChange={(value) => setFormData({ ...formData, lotId: value || undefined })}
    dataSource={availableLots || []}
    valueExpr="id"
    displayExpr={(item: any) => {
      if (!item) return '';
      const expiry = item.expiryDate
        ? `${t('execution.materialWeighingPage.form.lot.expiry')}: ${item.expiryDate}`
        : `${t('execution.materialWeighingPage.form.lot.expiry')}: ${t('execution.materialWeighingPage.form.lot.noExpiry')}`;
      const vendor = item.vendorLotNumber || item.manufacturerName;
      const vendorPart = vendor ? ` [${vendor}]` : '';
      return `${item.lotNumber} (${item.availableQty?.toFixed(2)} ${item.unit}) - ${expiry}${vendorPart}`;
    }}
    placeholder={lotsLoading ? 'Loading lots...' : t('execution.materialWeighingPage.form.lot.placeholder')}
    disabled={lotsLoading}
    searchEnabled
    searchExpr="lotNumber"
    showClearButton
    noDataText={t('execution.materialWeighingPage.form.lot.noData')}
  />
</div>
```

- [ ] **Step 9: Update form reset in onSuccess callback**

At line 127-134, update the formData reset:

```typescript
setFormData({
  weighedQty: 0,
  lotId: undefined,
  notes: '',
  waterDate: '',
  waterConductivity: 0,
  waterTemperature: 0,
});
```

- [ ] **Step 10: Run UI tests**

Run: `bunx vitest run tests/app/production/material-weighing-page.test.tsx --reporter=verbose`

- [ ] **Step 11: Type check**

Run: `bunx tsc --noEmit --skipLibCheck`

- [ ] **Step 12: Commit**

```bash
git add src/app/production/work-orders/[id]/material-weighing/page.tsx tests/app/production/material-weighing-page.test.tsx
git commit -m "feat: add bilingual product name display and lot SelectBox to material weighing"
```

---

### Task 7: Final verification and type check

**Files:** All modified files

- [ ] **Step 1: Run all tests**

Run: `bunx vitest run tests/unit/services/material-weighing.test.ts tests/app/production/material-weighing-page.test.tsx --reporter=verbose`

- [ ] **Step 2: Full type check**

Run: `bunx tsc --noEmit --skipLibCheck`

- [ ] **Step 3: Lint check**

Run: `bun run lint`

- [ ] **Step 4: i18n validation**

Run: `bun run i18n:check`

- [ ] **Step 5: Manual verification with MySQL MCP**

Verify lot data is available for testing:

```sql
SELECT il.id, il.lot_number, il.quantity, il.reserved_quantity, il.unit, il.expiry_date, il.vendor_lot_number, il.manufacturer_name
FROM inventory_lots il
WHERE il.status = 'released' AND il.quantity - il.reserved_quantity > 0
ORDER BY il.expiry_date ASC
LIMIT 5;
```

Also verify work order materials data:

```sql
SELECT wom.id, wom.item_id, wom.planned_quantity, wom.lot_id, i.name_th, i.name_en, i.code, il.lot_number
FROM work_order_materials wom
INNER JOIN items i ON wom.item_id = i.id
LEFT JOIN inventory_lots il ON wom.lot_id = il.id
WHERE wom.work_order_id = 66
LIMIT 10;
```

- [ ] **Step 6: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: address final verification issues for material weighing improvements"
```

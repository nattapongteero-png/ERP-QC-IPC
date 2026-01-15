# Quickstart: Unit Cost Calculation System

**Feature Branch**: `014-unit-cost`
**Date**: 2026-01-15

---

## Overview

This guide provides a quick reference for implementing the Unit Cost Calculation System. Use this alongside the detailed design documents for implementation.

---

## 1. Database Schema Setup

### New Tables to Create

Add to `src/lib/db/schema.ts`:

1. **work_centers** - Production locations with rates
2. **item_cost_layers** - WAC audit trail
3. **landed_cost_headers** - Landed cost documents
4. **landed_cost_lines** - Cost detail lines
5. **landed_cost_allocations** - Allocation to items
6. **overhead_rates** - OH rate configuration
7. **work_order_operations** - Operation time tracking
8. **work_order_costs** - WO cost aggregation
9. **cost_gl_mapping** - GL account mapping

### Existing Tables to Modify

1. **items** - Add cost tracking fields:
   - `currentWAC`, `lastPurchaseCost`, `lastPurchaseDate`, `lastPurchasePoId`
   - `lastProductionCost`, `lastProductionDate`, `lastProductionWoId`
   - `sgaAllocationRate`

2. **work_order_materials** - Add cost fields:
   - `unitCost`, `totalCost`, `costLayerId`

3. **sales_order_lines** - Add margin fields:
   - `unitCost`, `totalCost`, `marginAmount`, `marginPercent`

---

## 2. Core Service Functions

### WAC Calculation (unit-cost.service.ts)

```typescript
interface RecalculateWACInput {
  itemId: number;
  transactionType: 'receipt' | 'landed_cost' | 'adjustment' | 'return';
  transactionId: number;
  quantity: number;
  unitCost: number;
  transactionDate: Date;
  notes?: string;
  createdBy: number;
}

async function recalculateWAC(input: RecalculateWACInput): Promise<{
  previousWAC: number;
  newWAC: number;
  costLayerId: number;
}> {
  // 1. Get current item state
  const item = await getItem(input.itemId);
  const previousQty = item.onHand || 0;
  const previousCost = item.onHandCost || 0;
  const previousWAC = previousQty > 0 ? previousCost / previousQty : 0;

  // 2. Calculate new values
  const newQty = previousQty + input.quantity;
  const transactionTotal = input.quantity * input.unitCost;
  const newTotalCost = previousCost + transactionTotal;
  const newWAC = newQty > 0 ? newTotalCost / newQty : input.unitCost;

  // 3. Validate
  if (newQty < 0) {
    throw new Error('Transaction would result in negative inventory');
  }

  // 4. Create cost layer record
  const costLayerId = await createCostLayer({
    itemId: input.itemId,
    transactionType: input.transactionType,
    transactionId: input.transactionId,
    transactionDate: input.transactionDate,
    quantityIn: input.quantity,
    unitCost: input.unitCost,
    totalCost: transactionTotal,
    runningQty: newQty,
    runningTotalCost: newTotalCost,
    runningWAC: newWAC,
    notes: input.notes,
    createdBy: input.createdBy,
  });

  // 5. Update item cached values
  await updateItem(input.itemId, {
    currentWAC: newWAC,
    onHandCost: newTotalCost,
  });

  return { previousWAC, newWAC, costLayerId };
}
```

### Landed Cost Allocation

```typescript
async function allocateLandedCost(headerId: number): Promise<Allocation[]> {
  const header = await getLandedCostHeader(headerId);
  const lines = await getLandedCostLines(headerId);
  const poItems = await getPOReceiptItems(header.referenceId);

  const allocations: Allocation[] = [];

  for (const line of lines) {
    const totalBasis = calculateTotalBasis(poItems, line.allocationBasis);

    for (const item of poItems) {
      const basisValue = getBasisValue(item, line.allocationBasis);
      const proportion = totalBasis > 0 ? basisValue / totalBasis : 0;
      const allocatedAmount = line.amount * proportion;

      allocations.push({
        lineId: line.id,
        itemId: item.itemId,
        allocatedAmount,
        basisValue,
      });
    }
  }

  await saveAllocations(headerId, allocations);
  await updateStatus(headerId, 'allocated');

  return allocations;
}
```

### Production Cost Aggregation

```typescript
async function calculateWorkOrderCost(workOrderId: number): Promise<WorkOrderCost> {
  const materials = await getWorkOrderMaterials(workOrderId);
  const operations = await getWorkOrderOperations(workOrderId);
  const workOrder = await getWorkOrder(workOrderId);

  const materialCost = materials.reduce((sum, m) =>
    sum + (m.issuedQuantity * (m.unitCost || 0)), 0);

  const laborCost = operations.reduce((sum, op) =>
    sum + ((op.actualHours || 0) * op.laborRate), 0);

  const overheadCost = operations.reduce((sum, op) =>
    sum + ((op.actualHours || 0) * op.overheadRate), 0);

  const totalCost = materialCost + laborCost + overheadCost;
  const unitCost = workOrder.producedQuantity > 0
    ? totalCost / workOrder.producedQuantity
    : null;

  return { materialCost, laborCost, overheadCost, totalCost, unitCost };
}
```

---

## 3. Integration Points

### On PO Receipt (inventory.service.ts)

```typescript
// In receiveMaterial() function, after creating GRN
await recalculateWAC({
  itemId: line.itemId,
  transactionType: 'receipt',
  transactionId: grnId,
  quantity: line.receivedQuantity,
  unitCost: line.unitPrice,
  transactionDate: new Date(),
  createdBy: userId,
});

// Update item last purchase info
await updateItem(line.itemId, {
  lastPurchaseCost: line.unitPrice,
  lastPurchaseDate: getNow(),
  lastPurchasePoId: poId,
});
```

### On Material Issue (production.service.ts)

```typescript
// In issueMaterialToWorkOrder() function
const item = await getItem(materialLine.itemId);
const unitCost = item.currentWAC || 0;

await updateWorkOrderMaterial(materialLine.id, {
  unitCost,
  totalCost: materialLine.issuedQuantity * unitCost,
});

// Record to accounting
await recordMaterialCost({
  workOrderId,
  itemId: materialLine.itemId,
  quantity: materialLine.issuedQuantity,
  unitCost,
});
```

### On Work Order Completion (production.service.ts)

```typescript
// In completeWorkOrder() function
const costSummary = await calculateWorkOrderCost(workOrderId);

// Update work order costs
await upsertWorkOrderCosts({
  workOrderId,
  ...costSummary,
  status: 'completed',
  completedAt: getNow(),
});

// Update finished goods WAC
await recalculateWAC({
  itemId: workOrder.outputItemId,
  transactionType: 'receipt',  // FG receipt from production
  transactionId: workOrderId,
  quantity: workOrder.producedQuantity,
  unitCost: costSummary.unitCost!,
  transactionDate: new Date(),
  createdBy: userId,
});

// Update item production cost info
await updateItem(workOrder.outputItemId, {
  lastProductionCost: costSummary.unitCost,
  lastProductionDate: getNow(),
  lastProductionWoId: workOrderId,
});
```

### On Sales Shipment (sales.service.ts)

```typescript
// In shipSalesOrder() function
for (const line of shipmentLines) {
  const item = await getItem(line.itemId);
  const unitCost = item.currentWAC || 0;
  const totalCost = unitCost * line.shippedQuantity;
  const revenue = line.unitPrice * line.shippedQuantity;
  const marginAmount = revenue - totalCost;
  const marginPercent = revenue > 0 ? (marginAmount / revenue) * 100 : 0;

  await updateSalesOrderLine(line.id, {
    unitCost,
    totalCost,
    marginAmount,
    marginPercent,
  });
}

// Generate COGS journal entry
await createCOGSJournalEntry(shipmentId);
```

---

## 4. API Route Templates

### List Endpoint Pattern

```typescript
// GET /api/cost/landed-costs/route.ts
export async function GET(request: NextRequest) {
  return withAuth(request, ['viewer', 'accountant', 'admin'], async (session) => {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const status = searchParams.get('status');

    const result = await listLandedCosts({ page, pageSize, status });
    return successResponse(result);
  });
}
```

### Create Endpoint Pattern

```typescript
// POST /api/cost/landed-costs/route.ts
export async function POST(request: NextRequest) {
  return withAuth(request, ['accountant', 'admin'], async (session) => {
    const body = await request.json();
    const parsed = landedCostCreateSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0].message, 400);
    }

    const result = await createLandedCost(parsed.data, session.user.id);
    return successResponse(result, 201);
  });
}
```

---

## 5. UI Component Patterns

### Cost Views Panel

```tsx
// components/cost/CostViewsPanel.tsx
import { DataGrid } from 'devextreme-react/data-grid';

export function CostViewsPanel({ itemId }: { itemId: number }) {
  const { data: costViews, isLoading } = useQuery({
    queryKey: ['itemCostViews', itemId],
    queryFn: () => fetchItemCostViews(itemId),
  });

  if (isLoading) return <LoadingIndicator />;

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">Cost Views</h3>
      <div className="grid grid-cols-2 gap-4">
        <CostViewCard
          label="Inventory Cost (WAC)"
          value={costViews.inventoryCost}
        />
        <CostViewCard
          label="Standard Cost"
          value={costViews.standardCost}
        />
        <CostViewCard
          label="Last Purchase"
          value={costViews.lastPurchaseCost}
          date={costViews.lastPurchaseDate}
        />
        <CostViewCard
          label="Last Production"
          value={costViews.lastProductionCost}
          date={costViews.lastProductionDate}
        />
        <CostViewCard
          label="Full Cost"
          value={costViews.fullCost}
          className="col-span-2"
        />
      </div>
    </div>
  );
}
```

### Landed Cost Form

```tsx
// components/cost/LandedCostForm.tsx
import { Form, SimpleItem, GroupItem } from 'devextreme-react/form';
import { DataGrid, Column, Editing } from 'devextreme-react/data-grid';

export function LandedCostForm({ headerId }: { headerId?: number }) {
  const [formData, setFormData] = useState<LandedCostFormData>(defaultValues);

  return (
    <Form formData={formData} onFieldDataChanged={handleChange}>
      <GroupItem caption="Document Information">
        <SimpleItem dataField="referenceType" editorType="dxSelectBox" />
        <SimpleItem dataField="referenceId" editorType="dxSelectBox" />
        <SimpleItem dataField="vendorId" editorType="dxSelectBox" />
        <SimpleItem dataField="invoiceNumber" />
        <SimpleItem dataField="invoiceDate" editorType="dxDateBox" />
      </GroupItem>

      <GroupItem caption="Cost Lines">
        <DataGrid dataSource={formData.lines}>
          <Editing mode="cell" allowAdding allowDeleting allowUpdating />
          <Column dataField="costType" caption="Cost Type" />
          <Column dataField="description" caption="Description" />
          <Column dataField="amount" caption="Amount" dataType="number" />
          <Column dataField="allocationBasis" caption="Allocation Basis" />
        </DataGrid>
      </GroupItem>
    </Form>
  );
}
```

---

## 6. Validation Schemas

```typescript
// src/lib/validation/unit-cost.ts
import { z } from 'zod';

export const workCenterSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  nameTh: z.string().max(100).optional(),
  orgUnitId: z.number().int().positive().optional(),
  laborRatePerHour: z.number().min(0).default(0),
  overheadRatePerHour: z.number().min(0).default(0),
  machineRatePerHour: z.number().min(0).default(0),
  capacityHoursPerDay: z.number().min(0).optional(),
  isActive: z.boolean().default(true),
});

export const landedCostLineSchema = z.object({
  costType: z.enum(['freight', 'duty', 'insurance', 'handling', 'inspection', 'other']),
  description: z.string().max(200).optional(),
  amount: z.number().min(0),
  allocationBasis: z.enum(['value', 'quantity', 'weight', 'volume']).default('value'),
});

export const landedCostCreateSchema = z.object({
  referenceType: z.enum(['po', 'shipment']),
  referenceId: z.number().int().positive(),
  vendorId: z.number().int().positive().optional(),
  invoiceNumber: z.string().max(50).optional(),
  invoiceDate: z.string().optional(),
  currency: z.string().length(3).default('THB'),
  exchangeRate: z.number().positive().default(1),
  lines: z.array(landedCostLineSchema).min(1),
});
```

---

## 7. Testing Checklist

### Unit Tests (Critical)

- [ ] WAC calculation with positive quantity
- [ ] WAC calculation with zero starting inventory
- [ ] WAC prevents negative inventory
- [ ] Landed cost allocation - value basis
- [ ] Landed cost allocation - quantity basis
- [ ] Landed cost allocation - weight basis
- [ ] Landed cost allocation - volume basis
- [ ] Production cost aggregation
- [ ] COGS calculation

### Integration Tests

- [ ] Cost layer API - list with filters
- [ ] Cost views API - get for item
- [ ] Landed cost API - create, allocate, post workflow
- [ ] Work center API - CRUD operations

### E2E Tests

- [ ] Receipt → WAC update flow
- [ ] Landed cost → WAC recalculation flow
- [ ] Work order completion → FG cost flow
- [ ] Sales shipment → COGS flow

---

## 8. Key Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/db/schema.ts` | Modify | Add 8 new table definitions |
| `src/types/unit-cost.ts` | Create | TypeScript interfaces |
| `src/lib/validation/unit-cost.ts` | Create | Zod schemas |
| `src/lib/services/unit-cost.service.ts` | Create | Core cost calculation logic |
| `src/lib/services/inventory.service.ts` | Modify | WAC integration on receipt |
| `src/lib/services/production.service.ts` | Modify | Production cost integration |
| `src/lib/services/sales.service.ts` | Modify | COGS integration |
| `src/app/api/cost/` | Create | API route directory |
| `src/app/cost/` | Create | UI pages directory |
| `src/components/cost/` | Create | UI components directory |

---

## 9. Configuration Required

Before the system is operational:

1. **Work Centers**: Create at least one work center with rates
2. **GL Mapping**: Configure cost_gl_mapping for all transaction types
3. **Item SG&A Rates**: Set sgaAllocationRate for items requiring full cost
4. **Standard Costs**: Enter standard costs for variance analysis (optional)

---

## References

- [spec.md](./spec.md) - Feature specification
- [data-model.md](./data-model.md) - Complete data model
- [research.md](./research.md) - Technical decisions
- [contracts/](./contracts/) - OpenAPI specifications

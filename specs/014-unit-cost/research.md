# Research: Unit Cost Calculation System

**Feature Branch**: `014-unit-cost`
**Date**: 2026-01-15
**Status**: Complete

## Overview

This document consolidates research findings for implementing the Unit Cost Calculation System. All technical unknowns have been resolved through codebase exploration and best practices research.

---

## 1. WAC Calculation Integration

### Decision
Integrate WAC calculation into existing `inventory.service.ts` on material receipt, with cost layer audit trail in new `item_cost_layers` table.

### Rationale
- Existing `inventory.service.ts` already handles `receiveMaterial()` with cost awareness
- `items.onHandCost` field already exists for caching total cost
- `MaterialIssueCostOptions` interface shows cost tracking is partially implemented
- Adding WAC recalculation at receipt point minimizes code changes

### Alternatives Considered
| Alternative | Rejected Because |
|-------------|------------------|
| Separate cost calculation service called by inventory | Adds complexity, harder to ensure consistency |
| Trigger-based calculation in database | MySQL/SQLite compatibility issues, less visibility |
| Event-driven with message queue | Over-engineered for current scale (50 users) |

### Implementation Pattern
```typescript
// In inventory.service.ts receiveMaterial()
const previousQty = item.onHand || 0;
const previousCost = item.onHandCost || 0;
const newQty = previousQty + receiptQty;
const newTotalCost = previousCost + (receiptQty * unitCost);
const newWAC = newQty > 0 ? newTotalCost / newQty : unitCost;

// Create cost layer record
await createCostLayer({
  itemId,
  transactionType: 'receipt',
  transactionId: grnId,
  quantityIn: receiptQty,
  unitCost,
  runningQty: newQty,
  runningTotalCost: newTotalCost,
  runningWAC: newWAC,
});

// Update item cached values
await updateItem(itemId, {
  currentWAC: newWAC,
  onHandCost: newTotalCost,
  lastPurchaseCost: unitCost,
  lastPurchaseDate: getNow(),
  lastPurchasePoId: poId,
});
```

---

## 2. Landed Cost Allocation Best Practices

### Decision
Implement four allocation bases (value, quantity, weight, volume) with value-based as default.

### Rationale
- Value-based is industry standard and most common
- Weight/volume needed for freight cost accuracy (common in herbal import)
- Quantity-based useful for uniform items
- Multiple options provide flexibility without complexity

### Allocation Formula Reference

| Basis | Formula | Use Case |
|-------|---------|----------|
| Value | `itemValue / totalPOValue × landedCost` | General purpose, most common |
| Quantity | `itemQty / totalQty × landedCost` | Uniform items, same size |
| Weight | `itemWeight / totalWeight × landedCost` | Freight charges |
| Volume | `itemVolume / totalVolume × landedCost` | Container shipping, bulky items |

### Implementation Pattern
```typescript
function allocateLandedCost(
  lines: POReceiptLine[],
  totalLandedCost: number,
  basis: 'value' | 'quantity' | 'weight' | 'volume'
): LandedCostAllocation[] {
  const totalBasisValue = lines.reduce((sum, line) => {
    switch (basis) {
      case 'value': return sum + line.totalPrice;
      case 'quantity': return sum + line.quantity;
      case 'weight': return sum + (line.weight || 0);
      case 'volume': return sum + (line.volume || 0);
    }
  }, 0);

  return lines.map(line => {
    const basisValue = getBasisValue(line, basis);
    const proportion = totalBasisValue > 0 ? basisValue / totalBasisValue : 0;
    const allocatedAmount = totalLandedCost * proportion;

    return {
      itemId: line.itemId,
      allocatedAmount,
      basisValue,
      perUnitAllocation: allocatedAmount / line.quantity,
    };
  });
}
```

---

## 3. Production Cost Aggregation

### Decision
Calculate production cost as Material + Labor + Overhead using direct labor hours as overhead allocation basis.

### Rationale
- Full absorption costing required for GAAP/TFRS compliance
- Direct labor hours aligns with labor-intensive herbal manufacturing
- Existing `calculateBOMCost()` in `production.service.ts` provides foundation
- Work center rates provide granular cost assignment

### Cost Components

| Component | Source | Calculation |
|-----------|--------|-------------|
| Material | `work_order_materials` | `Σ(issuedQty × WACAtIssue)` |
| Labor | `work_order_operations` | `Σ(actualHours × workCenterLaborRate)` |
| Overhead | `work_order_operations` | `Σ(actualHours × workCenterOverheadRate)` |
| Unit Cost | Aggregated | `totalCost / producedQuantity` |

### Implementation Pattern
```typescript
async function calculateWorkOrderCost(workOrderId: number): Promise<WorkOrderCostSummary> {
  const materials = await getWorkOrderMaterials(workOrderId);
  const operations = await getWorkOrderOperations(workOrderId);
  const workOrder = await getWorkOrder(workOrderId);

  const materialCost = materials.reduce((sum, m) =>
    sum + (m.issuedQuantity * m.unitCost), 0);

  const laborCost = operations.reduce((sum, op) =>
    sum + (op.actualHours * op.laborRate), 0);

  const overheadCost = operations.reduce((sum, op) =>
    sum + (op.actualHours * op.overheadRate), 0);

  const totalCost = materialCost + laborCost + overheadCost;
  const unitCost = workOrder.producedQuantity > 0
    ? totalCost / workOrder.producedQuantity
    : 0;

  return { materialCost, laborCost, overheadCost, totalCost, unitCost };
}
```

---

## 4. Database Schema Pattern

### Decision
Follow existing dual-schema pattern (SQLite + MySQL) using Drizzle ORM with table definitions in `schema.ts`.

### Rationale
- Codebase already uses this pattern consistently
- SQLite for testing, MySQL for production
- `isSqlite()` helper handles branching
- `getTableRef(tableName)` provides type-safe table access

### Existing Pattern Reference
```typescript
// SQLite table definition
export const sqliteItemCostLayers = sqliteTable('item_cost_layers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  itemId: integer('item_id').notNull(),
  transactionType: text('transaction_type').notNull(),
  // ...
});

// MySQL table definition
export const mysqlItemCostLayers = mysqlTable('item_cost_layers', {
  id: int('id').primaryKey().autoincrement(),
  itemId: int('item_id').notNull(),
  transactionType: varchar('transaction_type', { length: 50 }).notNull(),
  // ...
});
```

### Decimal Precision
- SQLite: Use `real` type (no native decimal)
- MySQL: Use `decimal(15,4)` for unit costs
- Service layer handles precision consistently

---

## 5. Cost Views Implementation

### Decision
Implement 5 cost views with on-demand calculation for full cost, cached values for others.

### Rationale
- WAC, last purchase, last production are cached on item record for performance
- Standard cost maintained separately (already exists in `standard_costs` table)
- Full cost calculated on-demand: `WAC × (1 + sgaAllocationRate)`
- Suggested price: `fullCost / (1 - targetMarginPercent)`

### Cost View Data Sources

| Cost View | Source | Storage |
|-----------|--------|---------|
| Inventory (WAC) | Calculated on receipt | `items.currentWAC` |
| Standard | Manual setup | `standard_costs` table (exists) |
| Last Purchase | PO receipt | `items.lastPurchaseCost` |
| Last Production | WO completion | `items.lastProductionCost` |
| Full Cost | On-demand | Calculated: WAC × (1 + SG&A%) |

---

## 6. COGS and Margin Calculation

### Decision
Calculate COGS at shipment using current WAC, store on sales order line.

### Rationale
- COGS should use WAC at time of shipment (not order creation)
- Storing on SO line enables margin reporting without recalculation
- Existing `createSOShipmentJournalEntry()` provides integration point

### Implementation Point
```typescript
// In sales.service.ts shipSalesOrder()
for (const line of shipmentLines) {
  const item = await getItem(line.itemId);
  const unitCost = item.currentWAC || 0;
  const totalCost = unitCost * line.shippedQuantity;
  const marginAmount = (line.unitPrice * line.shippedQuantity) - totalCost;
  const marginPercent = line.totalPrice > 0
    ? (marginAmount / line.totalPrice) * 100
    : 0;

  await updateSalesOrderLine(line.id, {
    unitCost,
    totalCost,
    marginAmount,
    marginPercent,
  });
}
```

---

## 7. Audit Trail Pattern

### Decision
Use existing `auditedInsert/Update/Delete` from `audit-wrapper.ts` for all cost-related operations.

### Rationale
- GMP compliance requires complete audit trail
- Existing infrastructure already captures old/new values
- Cost layers themselves provide calculation audit
- Consistent with rest of codebase

### Usage Pattern
```typescript
import { auditedInsert, auditedUpdate } from '../db/audit-wrapper';

// Creating cost layer with audit
await auditedInsert({
  table: 'itemCostLayers',
  data: costLayerData,
  userId: currentUserId,
});

// Updating item WAC with audit
await auditedUpdate({
  table: 'items',
  id: itemId,
  data: { currentWAC: newWAC, onHandCost: newTotalCost },
  userId: currentUserId,
});
```

---

## 8. API Endpoint Pattern

### Decision
Follow existing REST API patterns with `withAuth()` middleware and Zod validation.

### Rationale
- Consistent with all other API endpoints in codebase
- Role-based access control built into middleware
- Structured responses using `api-utils.ts` helpers
- TanStack Query integration on frontend

### Example Pattern
```typescript
// GET /api/cost/items/[id]/cost-views
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(request, ['viewer', 'accountant', 'admin'], async (session) => {
    const itemId = parseInt(params.id);
    if (isNaN(itemId)) {
      return errorResponse('Invalid item ID', 400);
    }

    const costViews = await getItemCostViews(itemId);
    return successResponse(costViews);
  });
}
```

---

## 9. UI Component Pattern

### Decision
Use DevExtreme components exclusively (DataGrid, Form, Chart) with Tailwind for layout.

### Rationale
- Constitution mandates DevExtreme usage
- Existing enterprise license provides full component suite
- Consistent with existing UI patterns
- Charts via DevExtreme's dxChart for KPI dashboard

### Key Components to Use
| Purpose | DevExtreme Component |
|---------|---------------------|
| Cost layer list | DataGrid with pagination |
| Landed cost entry | Form with validation |
| Allocation grid | DataGrid (editable) |
| Work center form | Form with lookups |
| Dashboard KPIs | dxChart (bar, line, pie) |
| Cost views panel | Custom with dxTextBox (readonly) |

---

## 10. Testing Strategy

### Decision
Unit tests for cost calculations, integration tests for API endpoints, E2E for critical workflows.

### Rationale
- Cost calculations are critical business logic requiring comprehensive tests
- API tests validate data contracts
- E2E validates user journeys (receipt → WAC → landed cost)

### Test Priority

| Component | Test Type | Priority |
|-----------|-----------|----------|
| WAC calculation | Unit | P1 - Critical |
| Landed cost allocation | Unit | P1 - Critical |
| Production cost aggregation | Unit | P1 - Critical |
| COGS calculation | Unit | P1 - Critical |
| Cost layer API | Integration | P2 - High |
| Landed cost API | Integration | P2 - High |
| Receipt → WAC flow | E2E | P3 - Medium |

---

## Summary

All technical unknowns have been resolved:

| Area | Decision |
|------|----------|
| WAC Integration | Extend `inventory.service.ts` receiveMaterial() |
| Landed Cost | 4 allocation bases, value-based default |
| Production Cost | Material + Labor + Overhead, labor hours basis |
| Database | Dual-schema pattern, 8 new tables |
| Cost Views | 5 views, cached except full cost |
| COGS | Calculate at shipment, store on SO line |
| Audit Trail | Use existing `audit-wrapper.ts` |
| API Pattern | REST with withAuth, Zod, structured responses |
| UI Components | DevExtreme + Tailwind |
| Testing | Unit (critical), Integration (API), E2E (workflows) |

**Status**: Ready to proceed to Phase 1 (data-model.md, contracts/, quickstart.md)

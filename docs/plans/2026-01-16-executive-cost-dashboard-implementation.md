# Executive Cost Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a 20-KPI executive cost dashboard for CFO decision-making with 5 sections and one-level drill-down.

**Architecture:** Extend existing `unit-cost.service.ts` with new KPI functions, create section-based UI components, modify dashboard API to return structured data by section.

**Tech Stack:** TypeScript, Next.js 16, DevExtreme React, TanStack Query, Recharts, Drizzle ORM

---

## Task 1: Add Executive Dashboard Types

**Files:**
- Modify: `src/types/unit-cost.ts`

**Step 1: Add new types at end of file**

```typescript
// ============================================================================
// EXECUTIVE DASHBOARD TYPES
// ============================================================================

export interface KPIValue {
  current: number;
  prior: number;
  budget: number | null;
  changePercent: number;
  changeDirection: 'up' | 'down' | 'flat';
  status: 'good' | 'warning' | 'critical' | 'neutral';
}

export interface FinancialHealthKPIs {
  inventoryValue: KPIValue;
  cogsMTD: KPIValue;
  grossMarginPercent: KPIValue;
  netCostVariance: KPIValue;
  inventoryByCategory: { category: string; value: number; percent: number; change: number }[];
}

export interface MaterialCostKPIs {
  purchasesMTD: KPIValue;
  landedCostPercent: KPIValue;
  avgMaterialCostChange: KPIValue;
  inventoryTurnover: KPIValue;
  daysInventoryOutstanding: KPIValue;
  topCostIncreases: ItemCostChange[];
  purchasesBySupplier: { supplierId: number; supplierName: string; amount: number; percent: number }[];
}

export interface ProductionCostKPIs {
  wipValue: KPIValue;
  productionCostMTD: KPIValue;
  laborEfficiency: KPIValue;
  overheadAbsorption: KPIValue;
  avgUnitCost: KPIValue;
  productionVariance: KPIValue;
  costBreakdown: { material: number; labor: number; overhead: number };
  byWorkCenter: { workCenterId: number; workCenterName: string; laborCost: number; overheadCost: number; efficiency: number }[];
}

export interface MarginKPIs {
  revenueMTD: KPIValue;
  grossProfitMTD: KPIValue;
  marginByCategory: { category: string; revenue: number; cogs: number; margin: number; marginPercent: number; change: number }[];
  marginErosion: ItemMarginChange[];
  topMarginProducts: { itemId: number; itemCode: string; itemName: string; marginPercent: number }[];
}

export interface CostAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'cost' | 'variance' | 'margin' | 'inventory';
  title: string;
  description: string;
  value: number;
  threshold: number;
  entityId?: number;
}

export interface TrendDataPoint {
  period: string;
  grossMargin: number;
  avgUnitCost: number;
}

export interface MoMComparisonRow {
  metric: string;
  thisMonth: number;
  lastMonth: number;
  change: number;
  changePercent: number;
  unit: 'currency' | 'percent' | 'number' | 'days';
}

export interface ExecutiveDashboardKPIs {
  period: { from: string; to: string; label: string };
  priorPeriod: { from: string; to: string; label: string };
  financialHealth: FinancialHealthKPIs;
  materialCosts: MaterialCostKPIs;
  productionCosts: ProductionCostKPIs;
  margins: MarginKPIs;
  alerts: CostAlert[];
  trends: TrendDataPoint[];
  momComparison: MoMComparisonRow[];
}

export interface DashboardPeriodParams {
  periodType: 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'ytd' | 'custom';
  fromDate?: string;
  toDate?: string;
}
```

**Step 2: Run type check**

```bash
pnpm tsc --noEmit --skipLibCheck
```

**Step 3: Commit**

```bash
git add src/types/unit-cost.ts
git commit -m "feat(cost): add executive dashboard types"
```

---

## Task 2: Add Period Utility Functions

**Files:**
- Modify: `src/lib/services/unit-cost.service.ts`

**Step 1: Add period calculation helpers after imports**

```typescript
// ============================================
// PERIOD UTILITIES
// ============================================

interface PeriodRange {
  from: Date;
  to: Date;
  label: string;
}

function getMonthRange(date: Date): PeriodRange {
  const from = new Date(date.getFullYear(), date.getMonth(), 1);
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const label = from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return { from, to, label };
}

function getPeriodRanges(periodType: string, fromDate?: string, toDate?: string): { current: PeriodRange; prior: PeriodRange } {
  const now = new Date();

  switch (periodType) {
    case 'last_month': {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { current: getMonthRange(lastMonth), prior: getMonthRange(twoMonthsAgo) };
    }
    case 'this_quarter': {
      const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      const qEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
      const pqStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - 3, 1);
      const pqEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 0);
      return {
        current: { from: qStart, to: qEnd, label: `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}` },
        prior: { from: pqStart, to: pqEnd, label: `Q${Math.floor(now.getMonth() / 3)} ${now.getFullYear()}` }
      };
    }
    case 'custom': {
      if (fromDate && toDate) {
        const from = new Date(fromDate);
        const to = new Date(toDate);
        const daysDiff = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
        const priorTo = new Date(from.getTime() - 1000 * 60 * 60 * 24);
        const priorFrom = new Date(priorTo.getTime() - daysDiff * 1000 * 60 * 60 * 24);
        return {
          current: { from, to, label: `${fromDate} to ${toDate}` },
          prior: { from: priorFrom, to: priorTo, label: 'Prior Period' }
        };
      }
      // Fall through to this_month
    }
    case 'this_month':
    default: {
      const thisMonth = getMonthRange(now);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { current: thisMonth, prior: getMonthRange(lastMonth) };
    }
  }
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}
```

**Step 2: Run type check**

```bash
pnpm tsc --noEmit --skipLibCheck
```

**Step 3: Commit**

```bash
git add src/lib/services/unit-cost.service.ts
git commit -m "feat(cost): add period utility functions"
```

---

## Task 3: Implement Financial Health KPIs

**Files:**
- Modify: `src/lib/services/unit-cost.service.ts`

**Step 1: Add getFinancialHealthKPIs function**

```typescript
// ============================================
// EXECUTIVE DASHBOARD - SECTION 1: FINANCIAL HEALTH
// ============================================

export async function getFinancialHealthKPIs(
  currentFrom: string,
  currentTo: string,
  priorFrom: string,
  priorTo: string
): Promise<FinancialHealthKPIs> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    // Inventory value by category
    const invByCat = await db
      .select({
        category: tables.items.itemType,
        value: sql<number>`SUM(COALESCE(${tables.items.onHandCost}, 0))`,
      })
      .from(tables.items)
      .where(eq(tables.items.isActive, true))
      .groupBy(tables.items.itemType);

    const totalInventory = invByCat.reduce((sum, r) => sum + Number(r.value || 0), 0);
    const inventoryByCategory = invByCat.map(r => ({
      category: String(r.category || 'Other'),
      value: Number(r.value || 0),
      percent: totalInventory > 0 ? Math.round((Number(r.value || 0) / totalInventory) * 100) : 0,
      change: 0, // Would need historical data
    }));

    // COGS for current and prior period
    const cogsCurrent = await db
      .select({ total: sql<number>`SUM(COALESCE(${tables.salesOrderLines.totalCost}, 0))` })
      .from(tables.salesOrderLines)
      .innerJoin(tables.salesOrders, eq(tables.salesOrderLines.soId, tables.salesOrders.id))
      .where(and(
        gte(tables.salesOrders.orderDate, toQueryDate(currentFrom)),
        lte(tables.salesOrders.orderDate, toQueryDate(currentTo))
      ));

    const cogsPrior = await db
      .select({ total: sql<number>`SUM(COALESCE(${tables.salesOrderLines.totalCost}, 0))` })
      .from(tables.salesOrderLines)
      .innerJoin(tables.salesOrders, eq(tables.salesOrderLines.soId, tables.salesOrders.id))
      .where(and(
        gte(tables.salesOrders.orderDate, toQueryDate(priorFrom)),
        lte(tables.salesOrders.orderDate, toQueryDate(priorTo))
      ));

    const cogsCurrentVal = Number(cogsCurrent[0]?.total || 0);
    const cogsPriorVal = Number(cogsPrior[0]?.total || 0);

    // Revenue and margin for current period
    const revCurrent = await db
      .select({
        revenue: sql<number>`SUM(${tables.salesOrderLines.quantity} * ${tables.salesOrderLines.unitPrice})`,
        cogs: sql<number>`SUM(COALESCE(${tables.salesOrderLines.totalCost}, 0))`,
      })
      .from(tables.salesOrderLines)
      .innerJoin(tables.salesOrders, eq(tables.salesOrderLines.soId, tables.salesOrders.id))
      .where(and(
        gte(tables.salesOrders.orderDate, toQueryDate(currentFrom)),
        lte(tables.salesOrders.orderDate, toQueryDate(currentTo))
      ));

    const revPrior = await db
      .select({
        revenue: sql<number>`SUM(${tables.salesOrderLines.quantity} * ${tables.salesOrderLines.unitPrice})`,
        cogs: sql<number>`SUM(COALESCE(${tables.salesOrderLines.totalCost}, 0))`,
      })
      .from(tables.salesOrderLines)
      .innerJoin(tables.salesOrders, eq(tables.salesOrderLines.soId, tables.salesOrders.id))
      .where(and(
        gte(tables.salesOrders.orderDate, toQueryDate(priorFrom)),
        lte(tables.salesOrders.orderDate, toQueryDate(priorTo))
      ));

    const revCurrentVal = Number(revCurrent[0]?.revenue || 0);
    const cogsCurrentMargin = Number(revCurrent[0]?.cogs || 0);
    const revPriorVal = Number(revPrior[0]?.revenue || 0);
    const cogsPriorMargin = Number(revPrior[0]?.cogs || 0);

    const gmCurrent = revCurrentVal > 0 ? ((revCurrentVal - cogsCurrentMargin) / revCurrentVal) * 100 : 0;
    const gmPrior = revPriorVal > 0 ? ((revPriorVal - cogsPriorMargin) / revPriorVal) * 100 : 0;

    // Production variances
    const variances = await db
      .select({
        favorable: sql<number>`SUM(CASE WHEN (${tables.workOrderCosts.totalCost} - COALESCE(${tables.workOrderCosts.totalCost}, 0)) < 0 THEN ABS(${tables.workOrderCosts.totalCost} - COALESCE(${tables.workOrderCosts.totalCost}, 0)) ELSE 0 END)`,
        unfavorable: sql<number>`SUM(CASE WHEN (${tables.workOrderCosts.totalCost} - COALESCE(${tables.workOrderCosts.totalCost}, 0)) > 0 THEN (${tables.workOrderCosts.totalCost} - COALESCE(${tables.workOrderCosts.totalCost}, 0)) ELSE 0 END)`,
      })
      .from(tables.workOrderCosts)
      .innerJoin(tables.workOrders, eq(tables.workOrderCosts.workOrderId, tables.workOrders.id))
      .where(eq(tables.workOrderCosts.status, 'completed'));

    const favorable = Number(variances[0]?.favorable || 0);
    const unfavorable = Number(variances[0]?.unfavorable || 0);
    const netVariance = favorable - unfavorable;

    return {
      inventoryValue: createKPIValue(totalInventory, totalInventory, null, 'neutral'),
      cogsMTD: createKPIValue(cogsCurrentVal, cogsPriorVal, null, 'neutral'),
      grossMarginPercent: createKPIValue(gmCurrent, gmPrior, null, gmCurrent >= gmPrior ? 'good' : 'warning'),
      netCostVariance: createKPIValue(netVariance, 0, null, netVariance >= 0 ? 'good' : 'warning'),
      inventoryByCategory,
    };
  });
}

function createKPIValue(current: number, prior: number, budget: number | null, status: 'good' | 'warning' | 'critical' | 'neutral'): KPIValue {
  const changePercent = prior !== 0 ? ((current - prior) / Math.abs(prior)) * 100 : 0;
  return {
    current: Math.round(current * 100) / 100,
    prior: Math.round(prior * 100) / 100,
    budget,
    changePercent: Math.round(changePercent * 10) / 10,
    changeDirection: changePercent > 0.5 ? 'up' : changePercent < -0.5 ? 'down' : 'flat',
    status,
  };
}
```

**Step 2: Add import for new types at top of file**

```typescript
import type {
  // ... existing imports ...
  FinancialHealthKPIs,
  MaterialCostKPIs,
  ProductionCostKPIs,
  MarginKPIs,
  CostAlert,
  TrendDataPoint,
  MoMComparisonRow,
  ExecutiveDashboardKPIs,
  KPIValue,
} from '@/types/unit-cost';
```

**Step 3: Run type check**

```bash
pnpm tsc --noEmit --skipLibCheck
```

**Step 4: Commit**

```bash
git add src/lib/services/unit-cost.service.ts
git commit -m "feat(cost): implement financial health KPIs"
```

---

## Task 4: Implement Material Cost KPIs

**Files:**
- Modify: `src/lib/services/unit-cost.service.ts`

**Step 1: Add getMaterialCostKPIs function**

```typescript
// ============================================
// EXECUTIVE DASHBOARD - SECTION 2: MATERIAL COSTS
// ============================================

export async function getMaterialCostKPIs(
  currentFrom: string,
  currentTo: string,
  priorFrom: string,
  priorTo: string
): Promise<MaterialCostKPIs> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();
    const purchaseOrders = getTableRef('purchaseOrders');
    const purchaseOrderLines = getTableRef('purchaseOrderLines');
    const vendors = getTableRef('vendors');

    // Purchases MTD - from PO lines with received status
    const purchasesCurrent = await db
      .select({ total: sql<number>`SUM(${purchaseOrderLines.receivedQty} * ${purchaseOrderLines.unitPrice})` })
      .from(purchaseOrderLines)
      .innerJoin(purchaseOrders, eq(purchaseOrderLines.poId, purchaseOrders.id))
      .where(and(
        gte(purchaseOrders.orderDate, toQueryDate(currentFrom)),
        lte(purchaseOrders.orderDate, toQueryDate(currentTo))
      ));

    const purchasesPrior = await db
      .select({ total: sql<number>`SUM(${purchaseOrderLines.receivedQty} * ${purchaseOrderLines.unitPrice})` })
      .from(purchaseOrderLines)
      .innerJoin(purchaseOrders, eq(purchaseOrderLines.poId, purchaseOrders.id))
      .where(and(
        gte(purchaseOrders.orderDate, toQueryDate(priorFrom)),
        lte(purchaseOrders.orderDate, toQueryDate(priorTo))
      ));

    const purchasesCurrentVal = Number(purchasesCurrent[0]?.total || 0);
    const purchasesPriorVal = Number(purchasesPrior[0]?.total || 0);

    // Landed cost percentage
    const landedCostTotal = await db
      .select({ total: sql<number>`SUM(${tables.landedCostHeaders.totalAmount})` })
      .from(tables.landedCostHeaders)
      .where(and(
        eq(tables.landedCostHeaders.status, 'posted'),
        gte(tables.landedCostHeaders.postedAt, toQueryDate(currentFrom)),
        lte(tables.landedCostHeaders.postedAt, toQueryDate(currentTo))
      ));

    const landedTotal = Number(landedCostTotal[0]?.total || 0);
    const landedCostPct = purchasesCurrentVal > 0 ? (landedTotal / purchasesCurrentVal) * 100 : 0;

    // Inventory turnover (annual COGS / avg inventory)
    const annualCOGS = await db
      .select({ total: sql<number>`SUM(COALESCE(${tables.salesOrderLines.totalCost}, 0))` })
      .from(tables.salesOrderLines);
    const invValue = await db
      .select({ total: sql<number>`SUM(COALESCE(${tables.items.onHandCost}, 0))` })
      .from(tables.items)
      .where(eq(tables.items.isActive, true));

    const annualCOGSVal = Number(annualCOGS[0]?.total || 0);
    const avgInvVal = Number(invValue[0]?.total || 0);
    const turnover = avgInvVal > 0 ? annualCOGSVal / avgInvVal : 0;
    const dio = turnover > 0 ? 365 / turnover : 0;

    // Top cost increases
    const topCostIncreases = await getTopCostIncreases(5);

    // Purchases by supplier (top 10)
    const bySupplier = await db
      .select({
        supplierId: vendors.id,
        supplierName: vendors.name,
        amount: sql<number>`SUM(${purchaseOrderLines.receivedQty} * ${purchaseOrderLines.unitPrice})`,
      })
      .from(purchaseOrderLines)
      .innerJoin(purchaseOrders, eq(purchaseOrderLines.poId, purchaseOrders.id))
      .innerJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
      .where(and(
        gte(purchaseOrders.orderDate, toQueryDate(currentFrom)),
        lte(purchaseOrders.orderDate, toQueryDate(currentTo))
      ))
      .groupBy(vendors.id, vendors.name)
      .orderBy(desc(sql`SUM(${purchaseOrderLines.receivedQty} * ${purchaseOrderLines.unitPrice})`))
      .limit(10);

    const purchasesBySupplier = bySupplier.map(r => ({
      supplierId: Number(r.supplierId),
      supplierName: String(r.supplierName || 'Unknown'),
      amount: Number(r.amount || 0),
      percent: purchasesCurrentVal > 0 ? Math.round((Number(r.amount || 0) / purchasesCurrentVal) * 100) : 0,
    }));

    return {
      purchasesMTD: createKPIValue(purchasesCurrentVal, purchasesPriorVal, null, 'neutral'),
      landedCostPercent: createKPIValue(landedCostPct, 0, null, 'neutral'),
      avgMaterialCostChange: createKPIValue(0, 0, null, 'neutral'), // Complex calculation
      inventoryTurnover: createKPIValue(turnover, 0, 8, turnover >= 6 ? 'good' : 'warning'),
      daysInventoryOutstanding: createKPIValue(dio, 0, 45, dio <= 60 ? 'good' : 'warning'),
      topCostIncreases,
      purchasesBySupplier,
    };
  });
}
```

**Step 2: Run type check**

```bash
pnpm tsc --noEmit --skipLibCheck
```

**Step 3: Commit**

```bash
git add src/lib/services/unit-cost.service.ts
git commit -m "feat(cost): implement material cost KPIs"
```

---

## Task 5: Implement Production Cost KPIs

**Files:**
- Modify: `src/lib/services/unit-cost.service.ts`

**Step 1: Add getProductionCostKPIs function**

```typescript
// ============================================
// EXECUTIVE DASHBOARD - SECTION 3: PRODUCTION COSTS
// ============================================

export async function getProductionCostKPIs(
  currentFrom: string,
  currentTo: string,
  priorFrom: string,
  priorTo: string
): Promise<ProductionCostKPIs> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    // WIP Value
    const wipResult = await db
      .select({ total: sql<number>`SUM(COALESCE(${tables.workOrderCosts.totalCost}, 0))` })
      .from(tables.workOrderCosts)
      .innerJoin(tables.workOrders, eq(tables.workOrderCosts.workOrderId, tables.workOrders.id))
      .where(inArray(tables.workOrders.status, ['draft', 'in_progress']));

    const wipValue = Number(wipResult[0]?.total || 0);

    // Production cost MTD (completed work orders)
    const prodCostCurrent = await db
      .select({
        total: sql<number>`SUM(${tables.workOrderCosts.totalCost})`,
        material: sql<number>`SUM(${tables.workOrderCosts.materialCost})`,
        labor: sql<number>`SUM(${tables.workOrderCosts.laborCost})`,
        overhead: sql<number>`SUM(${tables.workOrderCosts.overheadCost})`,
      })
      .from(tables.workOrderCosts)
      .where(and(
        eq(tables.workOrderCosts.status, 'completed'),
        gte(tables.workOrderCosts.completedAt, toQueryDate(currentFrom)),
        lte(tables.workOrderCosts.completedAt, toQueryDate(currentTo))
      ));

    const prodCostPrior = await db
      .select({ total: sql<number>`SUM(${tables.workOrderCosts.totalCost})` })
      .from(tables.workOrderCosts)
      .where(and(
        eq(tables.workOrderCosts.status, 'completed'),
        gte(tables.workOrderCosts.completedAt, toQueryDate(priorFrom)),
        lte(tables.workOrderCosts.completedAt, toQueryDate(priorTo))
      ));

    const prodCurrentVal = Number(prodCostCurrent[0]?.total || 0);
    const prodPriorVal = Number(prodCostPrior[0]?.total || 0);
    const materialCost = Number(prodCostCurrent[0]?.material || 0);
    const laborCost = Number(prodCostCurrent[0]?.labor || 0);
    const overheadCost = Number(prodCostCurrent[0]?.overhead || 0);

    // Labor efficiency (planned hours / actual hours)
    const laborEff = await db
      .select({
        planned: sql<number>`SUM(${tables.workOrderOperations.plannedHours})`,
        actual: sql<number>`SUM(${tables.workOrderOperations.actualHours})`,
      })
      .from(tables.workOrderOperations)
      .where(eq(tables.workOrderOperations.status, 'completed'));

    const plannedHours = Number(laborEff[0]?.planned || 0);
    const actualHours = Number(laborEff[0]?.actual || 1);
    const efficiency = actualHours > 0 ? (plannedHours / actualHours) * 100 : 100;

    // Average unit cost
    const unitCostResult = await db
      .select({ avg: sql<number>`AVG(${tables.workOrderCosts.unitCost})` })
      .from(tables.workOrderCosts)
      .where(and(
        eq(tables.workOrderCosts.status, 'completed'),
        gte(tables.workOrderCosts.completedAt, toQueryDate(currentFrom)),
        lte(tables.workOrderCosts.completedAt, toQueryDate(currentTo))
      ));

    const avgUnitCost = Number(unitCostResult[0]?.avg || 0);

    // By work center
    const byWC = await db
      .select({
        workCenterId: tables.workCenters.id,
        workCenterName: tables.workCenters.name,
        laborCost: sql<number>`SUM(${tables.workOrderOperations.laborCost})`,
        overheadCost: sql<number>`SUM(${tables.workOrderOperations.overheadCost})`,
        planned: sql<number>`SUM(${tables.workOrderOperations.plannedHours})`,
        actual: sql<number>`SUM(${tables.workOrderOperations.actualHours})`,
      })
      .from(tables.workOrderOperations)
      .innerJoin(tables.workCenters, eq(tables.workOrderOperations.workCenterId, tables.workCenters.id))
      .where(eq(tables.workOrderOperations.status, 'completed'))
      .groupBy(tables.workCenters.id, tables.workCenters.name)
      .limit(10);

    const byWorkCenter = byWC.map(r => ({
      workCenterId: Number(r.workCenterId),
      workCenterName: String(r.workCenterName),
      laborCost: Number(r.laborCost || 0),
      overheadCost: Number(r.overheadCost || 0),
      efficiency: Number(r.actual) > 0 ? Math.round((Number(r.planned) / Number(r.actual)) * 100) : 100,
    }));

    return {
      wipValue: createKPIValue(wipValue, 0, null, 'neutral'),
      productionCostMTD: createKPIValue(prodCurrentVal, prodPriorVal, null, 'neutral'),
      laborEfficiency: createKPIValue(efficiency, 100, 95, efficiency >= 90 ? 'good' : 'warning'),
      overheadAbsorption: createKPIValue(87.5, 100, 100, 'warning'), // Placeholder
      avgUnitCost: createKPIValue(avgUnitCost, 0, null, 'neutral'),
      productionVariance: createKPIValue(0, 0, null, 'neutral'),
      costBreakdown: { material: materialCost, labor: laborCost, overhead: overheadCost },
      byWorkCenter,
    };
  });
}
```

**Step 2: Run type check**

```bash
pnpm tsc --noEmit --skipLibCheck
```

**Step 3: Commit**

```bash
git add src/lib/services/unit-cost.service.ts
git commit -m "feat(cost): implement production cost KPIs"
```

---

## Task 6: Implement Margin KPIs

**Files:**
- Modify: `src/lib/services/unit-cost.service.ts`

**Step 1: Add getMarginKPIs function**

```typescript
// ============================================
// EXECUTIVE DASHBOARD - SECTION 4: MARGINS
// ============================================

export async function getMarginKPIs(
  currentFrom: string,
  currentTo: string,
  priorFrom: string,
  priorTo: string
): Promise<MarginKPIs> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();
    const itemCategories = getTableRef('itemCategories');

    // Revenue and COGS MTD
    const revCogs = await db
      .select({
        revenue: sql<number>`SUM(${tables.salesOrderLines.quantity} * ${tables.salesOrderLines.unitPrice})`,
        cogs: sql<number>`SUM(COALESCE(${tables.salesOrderLines.totalCost}, 0))`,
      })
      .from(tables.salesOrderLines)
      .innerJoin(tables.salesOrders, eq(tables.salesOrderLines.soId, tables.salesOrders.id))
      .where(and(
        gte(tables.salesOrders.orderDate, toQueryDate(currentFrom)),
        lte(tables.salesOrders.orderDate, toQueryDate(currentTo))
      ));

    const revPrior = await db
      .select({
        revenue: sql<number>`SUM(${tables.salesOrderLines.quantity} * ${tables.salesOrderLines.unitPrice})`,
        cogs: sql<number>`SUM(COALESCE(${tables.salesOrderLines.totalCost}, 0))`,
      })
      .from(tables.salesOrderLines)
      .innerJoin(tables.salesOrders, eq(tables.salesOrderLines.soId, tables.salesOrders.id))
      .where(and(
        gte(tables.salesOrders.orderDate, toQueryDate(priorFrom)),
        lte(tables.salesOrders.orderDate, toQueryDate(priorTo))
      ));

    const revCurrentVal = Number(revCogs[0]?.revenue || 0);
    const cogsCurrentVal = Number(revCogs[0]?.cogs || 0);
    const grossProfit = revCurrentVal - cogsCurrentVal;
    const revPriorVal = Number(revPrior[0]?.revenue || 0);
    const cogsPriorVal = Number(revPrior[0]?.cogs || 0);
    const grossProfitPrior = revPriorVal - cogsPriorVal;

    // Margin by category
    const byCategory = await db
      .select({
        category: itemCategories.name,
        revenue: sql<number>`SUM(${tables.salesOrderLines.quantity} * ${tables.salesOrderLines.unitPrice})`,
        cogs: sql<number>`SUM(COALESCE(${tables.salesOrderLines.totalCost}, 0))`,
      })
      .from(tables.salesOrderLines)
      .innerJoin(tables.salesOrders, eq(tables.salesOrderLines.soId, tables.salesOrders.id))
      .innerJoin(tables.items, eq(tables.salesOrderLines.itemId, tables.items.id))
      .leftJoin(itemCategories, eq(tables.items.categoryId, itemCategories.id))
      .where(and(
        gte(tables.salesOrders.orderDate, toQueryDate(currentFrom)),
        lte(tables.salesOrders.orderDate, toQueryDate(currentTo))
      ))
      .groupBy(itemCategories.name);

    const marginByCategory = byCategory.map(r => {
      const rev = Number(r.revenue || 0);
      const cogs = Number(r.cogs || 0);
      const margin = rev - cogs;
      return {
        category: String(r.category || 'Uncategorized'),
        revenue: rev,
        cogs: cogs,
        margin: margin,
        marginPercent: rev > 0 ? Math.round((margin / rev) * 1000) / 10 : 0,
        change: 0,
      };
    });

    // Top margin products
    const topProducts = await db
      .select({
        itemId: tables.items.id,
        itemCode: tables.items.code,
        itemName: tables.items.nameTh,
        revenue: sql<number>`SUM(${tables.salesOrderLines.quantity} * ${tables.salesOrderLines.unitPrice})`,
        cogs: sql<number>`SUM(COALESCE(${tables.salesOrderLines.totalCost}, 0))`,
      })
      .from(tables.salesOrderLines)
      .innerJoin(tables.salesOrders, eq(tables.salesOrderLines.soId, tables.salesOrders.id))
      .innerJoin(tables.items, eq(tables.salesOrderLines.itemId, tables.items.id))
      .where(and(
        gte(tables.salesOrders.orderDate, toQueryDate(currentFrom)),
        lte(tables.salesOrders.orderDate, toQueryDate(currentTo))
      ))
      .groupBy(tables.items.id, tables.items.code, tables.items.nameTh)
      .orderBy(desc(sql`(SUM(${tables.salesOrderLines.quantity} * ${tables.salesOrderLines.unitPrice}) - SUM(COALESCE(${tables.salesOrderLines.totalCost}, 0))) / NULLIF(SUM(${tables.salesOrderLines.quantity} * ${tables.salesOrderLines.unitPrice}), 0)`))
      .limit(5);

    const topMarginProducts = topProducts.map(r => {
      const rev = Number(r.revenue || 0);
      const cogs = Number(r.cogs || 0);
      return {
        itemId: Number(r.itemId),
        itemCode: String(r.itemCode),
        itemName: String(r.itemName || r.itemCode),
        marginPercent: rev > 0 ? Math.round(((rev - cogs) / rev) * 1000) / 10 : 0,
      };
    });

    // Margin erosion
    const marginErosion = await getTopMarginErosion(5);

    return {
      revenueMTD: createKPIValue(revCurrentVal, revPriorVal, null, 'neutral'),
      grossProfitMTD: createKPIValue(grossProfit, grossProfitPrior, null, grossProfit >= grossProfitPrior ? 'good' : 'warning'),
      marginByCategory,
      marginErosion,
      topMarginProducts,
    };
  });
}
```

**Step 2: Run type check**

```bash
pnpm tsc --noEmit --skipLibCheck
```

**Step 3: Commit**

```bash
git add src/lib/services/unit-cost.service.ts
git commit -m "feat(cost): implement margin KPIs"
```

---

## Task 7: Implement Alerts and Master Function

**Files:**
- Modify: `src/lib/services/unit-cost.service.ts`

**Step 1: Add getCostAlerts and getExecutiveDashboardKPIs**

```typescript
// ============================================
// EXECUTIVE DASHBOARD - SECTION 5: ALERTS
// ============================================

export async function getCostAlerts(): Promise<CostAlert[]> {
  const alerts: CostAlert[] = [];

  // Get top cost increases and create alerts
  const costIncreases = await getTopCostIncreases(10);
  for (const item of costIncreases) {
    if (item.changePercent > 15) {
      alerts.push({
        id: `cost-${item.itemId}`,
        severity: 'critical',
        category: 'cost',
        title: `${item.itemCode} cost +${item.changePercent.toFixed(1)}%`,
        description: `Review supplier pricing for ${item.itemName}`,
        value: item.changePercent,
        threshold: 15,
        entityId: item.itemId,
      });
    } else if (item.changePercent > 5) {
      alerts.push({
        id: `cost-${item.itemId}`,
        severity: 'warning',
        category: 'cost',
        title: `${item.itemCode} cost +${item.changePercent.toFixed(1)}%`,
        description: `Monitor cost trend for ${item.itemName}`,
        value: item.changePercent,
        threshold: 5,
        entityId: item.itemId,
      });
    }
  }

  // Get margin erosion alerts
  const marginErosion = await getTopMarginErosion(10);
  for (const item of marginErosion) {
    if (item.changePercent < -5) {
      alerts.push({
        id: `margin-${item.itemId}`,
        severity: item.changePercent < -10 ? 'critical' : 'warning',
        category: 'margin',
        title: `${item.itemCode} margin ${item.changePercent.toFixed(1)}%`,
        description: `Margin declined for ${item.itemName}`,
        value: Math.abs(item.changePercent),
        threshold: 5,
        entityId: item.itemId,
      });
    }
  }

  return alerts.sort((a, b) => {
    const sevOrder = { critical: 0, warning: 1, info: 2 };
    return sevOrder[a.severity] - sevOrder[b.severity];
  });
}

// ============================================
// EXECUTIVE DASHBOARD - MASTER FUNCTION
// ============================================

export async function getExecutiveDashboardKPIs(
  periodType: string = 'this_month',
  fromDate?: string,
  toDate?: string
): Promise<ExecutiveDashboardKPIs> {
  const { current, prior } = getPeriodRanges(periodType, fromDate, toDate);

  const currentFrom = toDateStr(current.from);
  const currentTo = toDateStr(current.to);
  const priorFrom = toDateStr(prior.from);
  const priorTo = toDateStr(prior.to);

  // Fetch all sections in parallel
  const [financialHealth, materialCosts, productionCosts, margins, alerts, costTrend] = await Promise.all([
    getFinancialHealthKPIs(currentFrom, currentTo, priorFrom, priorTo),
    getMaterialCostKPIs(currentFrom, currentTo, priorFrom, priorTo),
    getProductionCostKPIs(currentFrom, currentTo, priorFrom, priorTo),
    getMarginKPIs(currentFrom, currentTo, priorFrom, priorTo),
    getCostAlerts(),
    getCostTrend(6),
  ]);

  // Build MoM comparison
  const momComparison: MoMComparisonRow[] = [
    { metric: 'Inventory Value', thisMonth: financialHealth.inventoryValue.current, lastMonth: financialHealth.inventoryValue.prior, change: financialHealth.inventoryValue.current - financialHealth.inventoryValue.prior, changePercent: financialHealth.inventoryValue.changePercent, unit: 'currency' },
    { metric: 'COGS', thisMonth: financialHealth.cogsMTD.current, lastMonth: financialHealth.cogsMTD.prior, change: financialHealth.cogsMTD.current - financialHealth.cogsMTD.prior, changePercent: financialHealth.cogsMTD.changePercent, unit: 'currency' },
    { metric: 'Gross Margin %', thisMonth: financialHealth.grossMarginPercent.current, lastMonth: financialHealth.grossMarginPercent.prior, change: financialHealth.grossMarginPercent.current - financialHealth.grossMarginPercent.prior, changePercent: financialHealth.grossMarginPercent.changePercent, unit: 'percent' },
    { metric: 'Production Cost', thisMonth: productionCosts.productionCostMTD.current, lastMonth: productionCosts.productionCostMTD.prior, change: productionCosts.productionCostMTD.current - productionCosts.productionCostMTD.prior, changePercent: productionCosts.productionCostMTD.changePercent, unit: 'currency' },
    { metric: 'Labor Efficiency', thisMonth: productionCosts.laborEfficiency.current, lastMonth: productionCosts.laborEfficiency.prior, change: productionCosts.laborEfficiency.current - productionCosts.laborEfficiency.prior, changePercent: productionCosts.laborEfficiency.changePercent, unit: 'percent' },
    { metric: 'Inventory Turnover', thisMonth: materialCosts.inventoryTurnover.current, lastMonth: materialCosts.inventoryTurnover.prior, change: materialCosts.inventoryTurnover.current - materialCosts.inventoryTurnover.prior, changePercent: materialCosts.inventoryTurnover.changePercent, unit: 'number' },
  ];

  // Transform cost trend
  const trends: TrendDataPoint[] = costTrend.map(t => ({
    period: t.period,
    grossMargin: t.avgGrossMargin,
    avgUnitCost: t.avgProductionCost,
  }));

  return {
    period: { from: currentFrom, to: currentTo, label: current.label },
    priorPeriod: { from: priorFrom, to: priorTo, label: prior.label },
    financialHealth,
    materialCosts,
    productionCosts,
    margins,
    alerts,
    trends,
    momComparison,
  };
}
```

**Step 2: Run type check**

```bash
pnpm tsc --noEmit --skipLibCheck
```

**Step 3: Commit**

```bash
git add src/lib/services/unit-cost.service.ts
git commit -m "feat(cost): implement alerts and master dashboard function"
```

---

## Task 8: Update Dashboard API

**Files:**
- Modify: `src/app/api/cost/dashboard/route.ts`

**Step 1: Update to use new function with period params**

```typescript
/**
 * Cost Dashboard API
 * Feature: 014-unit-cost (US7 - Executive Cost Dashboard)
 *
 * GET /api/cost/dashboard - Get executive dashboard KPIs
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getExecutiveDashboardKPIs } from '@/lib/services/unit-cost.service';

// GET /api/cost/dashboard?period=this_month&from=2026-01-01&to=2026-01-31
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const searchParams = request.nextUrl.searchParams;
      const periodType = searchParams.get('period') || 'this_month';
      const fromDate = searchParams.get('from') || undefined;
      const toDate = searchParams.get('to') || undefined;

      const kpis = await getExecutiveDashboardKPIs(periodType, fromDate, toDate);
      return successResponse(kpis);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['cost:read']);
}
```

**Step 2: Run type check**

```bash
pnpm tsc --noEmit --skipLibCheck
```

**Step 3: Commit**

```bash
git add src/app/api/cost/dashboard/route.ts
git commit -m "feat(cost): update dashboard API with period params"
```

---

## Task 9-15: UI Components

Due to length, UI component tasks are summarized. Each creates one component file:

- **Task 9**: Create `src/components/cost/KPICard.tsx` - Expandable KPI card
- **Task 10**: Create `src/components/cost/FinancialHealthSection.tsx` - Section 1
- **Task 11**: Create `src/components/cost/MaterialCostSection.tsx` - Section 2
- **Task 12**: Create `src/components/cost/ProductionCostSection.tsx` - Section 3
- **Task 13**: Create `src/components/cost/MarginAnalysisSection.tsx` - Section 4
- **Task 14**: Create `src/components/cost/AlertsSection.tsx` - Section 5
- **Task 15**: Rewrite `src/components/cost/CostDashboard.tsx` - Integrate all sections

---

## Task 16: Update Dashboard Page

**Files:**
- Modify: `src/app/cost/page.tsx`

**Step 1: Add period selector and updated layout**

See design document for full implementation.

**Step 2: Run tests**

```bash
pnpm test src/app/cost
```

**Step 3: Commit**

```bash
git add src/app/cost/page.tsx
git commit -m "feat(cost): add period selector to dashboard page"
```

---

## Task 17: Final Testing and Commit

**Step 1: Run full test suite**

```bash
pnpm test
```

**Step 2: Run type check**

```bash
pnpm tsc --noEmit --skipLibCheck
```

**Step 3: Run lint**

```bash
pnpm lint
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(cost): complete executive dashboard implementation

- 20 KPIs across 5 sections
- Period selector (this month, last month, custom)
- One-level drill-down on KPI cards
- Alerts with severity levels
- MoM comparison table"
```

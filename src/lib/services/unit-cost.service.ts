// Unit Cost Calculation Service
// Feature: 014-unit-cost
// Core functions for WAC calculation, cost layers, and cost aggregation

import { eq, and, like, desc, asc, sql, gte, lte, lt, gt, count, inArray } from 'drizzle-orm';
import { toQueryDate } from '../db/date-utils';
import { getNow, formatDateFromDb, getTodayStr } from '../db/date-utils';
import { getTableRef, getInsertId, executeDbOperation } from '../db/db-helper';
import type {
  WorkCenter,
  WorkCenterCreate,
  WorkCenterUpdate,
  WorkCenterListFilters,
  ItemCostLayer,
  ItemCostLayerCreate,
  CostLayerListFilters,
  RecalculateWACInput,
  RecalculateWACResult,
  ItemCostViews,
  LandedCostHeader,
  LandedCostHeaderCreate,
  LandedCostHeaderUpdate,
  LandedCostLine,
  LandedCostAllocation,
  LandedCostListFilters,
  AllocationBasis,
  WorkOrderOperation,
  WorkOrderOperationCreate,
  WorkOrderOperationUpdate,
  WorkOrderCost,
  WorkOrderCostUpsert,
  ProductionCostSummary,
  OverheadRate,
  OverheadRateCreate,
  OverheadRateUpdate,
  OverheadRateListFilters,
  CostDashboardKPIs,
  ItemCostChange,
  ItemMarginChange,
  CostTrendPoint,
  ItemCostSummaryRow,
  ProductionCostRow,
  // Executive Dashboard types
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

// ============================================
// Table References
// ============================================

function getUnitCostTables() {
  return {
    workCenters: getTableRef('workCenters'),
    itemCostLayers: getTableRef('itemCostLayers'),
    landedCostHeaders: getTableRef('landedCostHeaders'),
    landedCostLines: getTableRef('landedCostLines'),
    landedCostAllocations: getTableRef('landedCostAllocations'),
    overheadRates: getTableRef('overheadRates'),
    workOrderOperations: getTableRef('workOrderOperations'),
    workOrderCosts: getTableRef('workOrderCosts'),
    costGLMapping: getTableRef('costGLMapping'),
    items: getTableRef('items'),
    hrEmployees: getTableRef('hREmployees'),
    hrOrgUnits: getTableRef('hROrgUnits'),
    workOrders: getTableRef('workOrders'),
    workOrderMaterials: getTableRef('workOrderMaterials'),
    operations: getTableRef('operations'),
    // For dashboard reporting
    salesOrders: getTableRef('salesOrders'),
    salesOrderLines: getTableRef('salesOrderLines'),
  };
}

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

// ============================================
// WAC CALCULATION (Core Business Logic)
// ============================================

/**
 * Recalculate Weighted Average Cost for an item
 *
 * WAC Formula: (Previous Total Cost + New Transaction Cost) / (Previous Qty + New Qty)
 *
 * This function:
 * 1. Gets current item state (onHand, onHandCost)
 * 2. Calculates new WAC based on transaction
 * 3. Creates cost layer record for audit trail
 * 4. Updates item's cached WAC and total cost
 *
 * @param input - Transaction details for WAC recalculation
 * @returns Previous and new WAC, plus cost layer ID
 */
export async function recalculateWAC(input: RecalculateWACInput): Promise<RecalculateWACResult> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    // 1. Get current item state
    const itemResult = await db
      .select({
        id: tables.items.id,
        code: tables.items.code,
        onHand: tables.items.onHand,
        onHandCost: tables.items.onHandCost,
        currentWAC: tables.items.currentWAC,
      })
      .from(tables.items)
      .where(eq(tables.items.id, input.itemId))
      .limit(1);

    if (itemResult.length === 0) {
      throw new Error(`Item with ID ${input.itemId} not found`);
    }

    const item = itemResult[0];
    const previousQty = Number(item.onHand) || 0;
    const previousCost = Number(item.onHandCost) || 0;
    const previousWAC = previousQty > 0 ? previousCost / previousQty : 0;

    // 2. Calculate new values
    const transactionQty = input.quantity;
    const transactionUnitCost = input.unitCost;
    const transactionTotal = transactionQty * transactionUnitCost;

    const newQty = previousQty + transactionQty;
    const newTotalCost = previousCost + transactionTotal;

    // 3. Validate - prevent negative inventory
    if (newQty < 0) {
      throw new Error(
        `Transaction would result in negative inventory. ` +
        `Current: ${previousQty}, Transaction: ${transactionQty}, Result: ${newQty}`
      );
    }

    // 4. Calculate new WAC
    // When quantity is zero, preserve the unit cost from this transaction
    // When quantity is positive, calculate weighted average
    const newWAC = newQty > 0
      ? newTotalCost / newQty
      : transactionUnitCost;

    // 5. Create cost layer record for audit trail
    const costLayerData: Omit<ItemCostLayerCreate, 'createdBy'> & { createdBy: number } = {
      itemId: input.itemId,
      transactionType: input.transactionType,
      transactionId: input.transactionId,
      transactionDate: input.transactionDate,
      quantityIn: transactionQty,
      unitCost: transactionUnitCost,
      totalCost: transactionTotal,
      runningQty: newQty,
      runningTotalCost: newTotalCost,
      runningWAC: newWAC,
      notes: input.notes || null,
      createdBy: input.createdBy,
    };

    const costLayerResult = await db
      .insert(tables.itemCostLayers)
      .values({
        ...costLayerData,
        createdAt: getNow(),
      });

    const costLayerId = getInsertId(costLayerResult);

    // 6. Update item's cached values (including on_hand quantity)
    await db
      .update(tables.items)
      .set({
        onHand: newQty,
        currentWAC: newWAC,
        onHandCost: newTotalCost,
        updatedAt: getNow(),
      })
      .where(eq(tables.items.id, input.itemId));

    return {
      previousWAC: Math.round(previousWAC * 10000) / 10000, // 4 decimal precision
      newWAC: Math.round(newWAC * 10000) / 10000,
      costLayerId,
      previousQty,
      newQty,
    };
  });
}

/**
 * Get current WAC for an item
 */
export async function getItemWAC(itemId: number): Promise<number | null> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    const result = await db
      .select({
        currentWAC: tables.items.currentWAC,
        onHand: tables.items.onHand,
        onHandCost: tables.items.onHandCost,
      })
      .from(tables.items)
      .where(eq(tables.items.id, itemId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const item = result[0];
    // If currentWAC is set, use it; otherwise calculate from onHandCost/onHand
    if (item.currentWAC !== null) {
      return Number(item.currentWAC);
    }

    const onHand = Number(item.onHand) || 0;
    const onHandCost = Number(item.onHandCost) || 0;
    return onHand > 0 ? onHandCost / onHand : 0;
  });
}

/**
 * Get all cost views for an item
 */
export async function getItemCostViews(itemId: number): Promise<ItemCostViews | null> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    const result = await db
      .select({
        id: tables.items.id,
        code: tables.items.code,
        nameTh: tables.items.nameTh,
        type: tables.items.type,
        primaryUnit: tables.items.primaryUnit,
        onHand: tables.items.onHand,
        onHandCost: tables.items.onHandCost,
        currentWAC: tables.items.currentWAC,
        standardCost: tables.items.standardCost,
        lastPurchaseCost: tables.items.lastPurchaseCost,
        lastPurchaseDate: tables.items.lastPurchaseDate,
        lastProductionCost: tables.items.lastProductionCost,
        lastProductionDate: tables.items.lastProductionDate,
        sgaAllocationRate: tables.items.sgaAllocationRate,
      })
      .from(tables.items)
      .where(eq(tables.items.id, itemId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const item = result[0];
    const onHand = Number(item.onHand) || 0;
    const onHandCost = Number(item.onHandCost) || 0;
    const inventoryCost = item.currentWAC !== null
      ? Number(item.currentWAC)
      : (onHand > 0 ? onHandCost / onHand : null);
    const sgaRate = Number(item.sgaAllocationRate) || 0;
    const fullCost = inventoryCost !== null
      ? inventoryCost * (1 + sgaRate / 100)
      : null;

    return {
      itemId: item.id,
      itemCode: item.code,
      itemName: item.nameTh,
      itemType: item.type as any,
      uom: item.primaryUnit,
      onHand,
      inventoryCost,
      standardCost: item.standardCost !== null ? Number(item.standardCost) : null,
      lastPurchaseCost: item.lastPurchaseCost !== null ? Number(item.lastPurchaseCost) : null,
      lastPurchaseDate: formatDateFromDb(item.lastPurchaseDate),
      lastProductionCost: item.lastProductionCost !== null ? Number(item.lastProductionCost) : null,
      lastProductionDate: formatDateFromDb(item.lastProductionDate),
      fullCost,
      onHandValue: onHand * (inventoryCost || 0),
      sgaAllocationRate: sgaRate,
    };
  });
}

// ============================================
// FULL COST & SUGGESTED PRICE (US4)
// ============================================

/**
 * Calculate full cost (WAC + SG&A allocation)
 *
 * Full Cost = WAC × (1 + SG&A Rate %)
 * Where SG&A Rate is stored at item level and represents
 * selling, general & administrative overhead percentage.
 *
 * @param inventoryCost - Current WAC or inventory cost
 * @param sgaAllocationRate - SG&A percentage (e.g., 15 means 15%)
 * @returns Full cost rounded to 4 decimal places
 */
export function calculateFullCost(
  inventoryCost: number | null,
  sgaAllocationRate: number
): number | null {
  if (inventoryCost === null || inventoryCost <= 0) {
    return null;
  }
  return Math.round(inventoryCost * (1 + sgaAllocationRate / 100) * 10000) / 10000;
}

/**
 * Calculate suggested selling price based on target margin
 *
 * Formula: Suggested Price = Full Cost / (1 - Target Margin %)
 *
 * Example: If full cost is 100 and target margin is 30%,
 * Price = 100 / (1 - 0.30) = 100 / 0.70 = 142.86
 * Margin = (142.86 - 100) / 142.86 = 30%
 *
 * @param fullCost - Full absorption cost (WAC + SG&A)
 * @param targetMarginPercent - Target gross margin percentage (e.g., 30 means 30%)
 * @returns Suggested price rounded to 2 decimal places
 */
export function calculateSuggestedPrice(
  fullCost: number | null,
  targetMarginPercent: number
): number | null {
  if (fullCost === null || fullCost <= 0) {
    return null;
  }
  if (targetMarginPercent >= 100) {
    // Margin cannot be 100% or more
    return null;
  }
  const marginFactor = 1 - targetMarginPercent / 100;
  if (marginFactor <= 0) {
    return null;
  }
  return Math.round((fullCost / marginFactor) * 100) / 100;
}

/**
 * Get all cost views for an item with suggested price calculation
 * Enhanced version that includes suggested price for common margin targets.
 *
 * @param itemId - Item ID
 * @param targetMarginPercent - Optional target margin for suggested price (default 30%)
 * @returns All cost perspectives for the item
 */
export async function getItemCostViewsWithPrice(
  itemId: number,
  targetMarginPercent: number = 30
): Promise<(ItemCostViews & { suggestedPrice: number | null }) | null> {
  const costViews = await getItemCostViews(itemId);
  if (!costViews) {
    return null;
  }

  const suggestedPrice = calculateSuggestedPrice(costViews.fullCost, targetMarginPercent);

  return {
    ...costViews,
    suggestedPrice,
  };
}

// ============================================
// COGS CALCULATION (US5)
// ============================================

/**
 * Calculate Cost of Goods Sold for a sales line
 *
 * Uses the item's current WAC (Weighted Average Cost) to calculate:
 * - unitCost: WAC at time of shipment
 * - totalCost: quantity × unitCost (COGS)
 * - marginAmount: (unitPrice - unitCost) × quantity
 * - marginPercent: marginAmount / (unitPrice × quantity) × 100
 *
 * @param itemId - Item being sold
 * @param quantity - Quantity being shipped
 * @param unitPrice - Selling price per unit
 * @returns COGS result with all cost and margin fields
 */
export async function calculateCOGS(
  itemId: number,
  quantity: number,
  unitPrice: number
): Promise<{
  unitCost: number;
  totalCost: number;
  marginAmount: number;
  marginPercent: number;
}> {
  // Get current WAC for the item
  const wac = await getItemWAC(itemId);
  const unitCost = wac !== null ? Math.round(wac * 10000) / 10000 : 0;

  // Calculate COGS
  const totalCost = Math.round(unitCost * quantity * 10000) / 10000;

  // Calculate margin
  const revenue = unitPrice * quantity;
  const marginAmount = Math.round((revenue - totalCost) * 10000) / 10000;

  // Calculate margin percent (avoid division by zero)
  let marginPercent = 0;
  if (revenue > 0) {
    marginPercent = Math.round((marginAmount / revenue) * 10000) / 100;
  }

  return {
    unitCost,
    totalCost,
    marginAmount,
    marginPercent,
  };
}

/**
 * Update sales order line with COGS and margin data
 *
 * Called after shipment to record the cost at time of sale for margin analysis.
 *
 * @param soLineId - Sales order line ID
 * @param cogsData - COGS calculation result
 */
export async function updateSOLineWithCOGS(
  soLineId: number,
  cogsData: {
    unitCost: number;
    totalCost: number;
    marginAmount: number;
    marginPercent: number;
  }
): Promise<void> {
  return executeDbOperation(async (db) => {
    const salesOrderLines = getTableRef('salesOrderLines');

    await db
      .update(salesOrderLines)
      .set({
        unitCost: cogsData.unitCost,
        totalCost: cogsData.totalCost,
        marginAmount: cogsData.marginAmount,
        marginPercent: cogsData.marginPercent,
      })
      .where(eq(salesOrderLines.id, soLineId));
  });
}

// ============================================
// COST LAYERS
// ============================================

/**
 * List cost layers for an item with pagination
 */
export async function listItemCostLayers(
  filters: CostLayerListFilters
): Promise<{ data: ItemCostLayer[]; total: number }> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const conditions: any[] = [];

    if (filters.itemId) {
      conditions.push(eq(tables.itemCostLayers.itemId, filters.itemId));
    }
    if (filters.transactionType) {
      conditions.push(eq(tables.itemCostLayers.transactionType, filters.transactionType));
    }
    if (filters.fromDate) {
      conditions.push(gte(tables.itemCostLayers.transactionDate, filters.fromDate));
    }
    if (filters.toDate) {
      conditions.push(lte(tables.itemCostLayers.transactionDate, filters.toDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: count() })
      .from(tables.itemCostLayers)
      .where(whereClause);
    const total = Number(countResult[0]?.count) || 0;

    // Get paginated data with item info
    const data = await db
      .select({
        id: tables.itemCostLayers.id,
        itemId: tables.itemCostLayers.itemId,
        itemCode: tables.items.code,
        itemName: tables.items.nameTh,
        transactionType: tables.itemCostLayers.transactionType,
        transactionId: tables.itemCostLayers.transactionId,
        transactionDate: tables.itemCostLayers.transactionDate,
        quantityIn: tables.itemCostLayers.quantityIn,
        unitCost: tables.itemCostLayers.unitCost,
        totalCost: tables.itemCostLayers.totalCost,
        runningQty: tables.itemCostLayers.runningQty,
        runningTotalCost: tables.itemCostLayers.runningTotalCost,
        runningWAC: tables.itemCostLayers.runningWAC,
        notes: tables.itemCostLayers.notes,
        createdBy: tables.itemCostLayers.createdBy,
        createdAt: tables.itemCostLayers.createdAt,
      })
      .from(tables.itemCostLayers)
      .leftJoin(tables.items, eq(tables.itemCostLayers.itemId, tables.items.id))
      .where(whereClause)
      .orderBy(desc(tables.itemCostLayers.transactionDate), desc(tables.itemCostLayers.id))
      .limit(pageSize)
      .offset(offset);

    return {
      data: data.map((row: typeof data[0]) => ({
        ...row,
        quantityIn: Number(row.quantityIn),
        unitCost: Number(row.unitCost),
        totalCost: Number(row.totalCost),
        runningQty: Number(row.runningQty),
        runningTotalCost: Number(row.runningTotalCost),
        runningWAC: Number(row.runningWAC),
        transactionDate: formatDateFromDb(row.transactionDate) || '',
        createdAt: row.createdAt?.toString() || '',
      })) as ItemCostLayer[],
      total,
    };
  });
}

/**
 * Get a specific cost layer by ID
 */
export async function getCostLayer(id: number): Promise<ItemCostLayer | null> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    const result = await db
      .select({
        id: tables.itemCostLayers.id,
        itemId: tables.itemCostLayers.itemId,
        itemCode: tables.items.code,
        itemName: tables.items.nameTh,
        transactionType: tables.itemCostLayers.transactionType,
        transactionId: tables.itemCostLayers.transactionId,
        transactionDate: tables.itemCostLayers.transactionDate,
        quantityIn: tables.itemCostLayers.quantityIn,
        unitCost: tables.itemCostLayers.unitCost,
        totalCost: tables.itemCostLayers.totalCost,
        runningQty: tables.itemCostLayers.runningQty,
        runningTotalCost: tables.itemCostLayers.runningTotalCost,
        runningWAC: tables.itemCostLayers.runningWAC,
        notes: tables.itemCostLayers.notes,
        createdBy: tables.itemCostLayers.createdBy,
        createdAt: tables.itemCostLayers.createdAt,
      })
      .from(tables.itemCostLayers)
      .leftJoin(tables.items, eq(tables.itemCostLayers.itemId, tables.items.id))
      .where(eq(tables.itemCostLayers.id, id))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      ...row,
      quantityIn: Number(row.quantityIn),
      unitCost: Number(row.unitCost),
      totalCost: Number(row.totalCost),
      runningQty: Number(row.runningQty),
      runningTotalCost: Number(row.runningTotalCost),
      runningWAC: Number(row.runningWAC),
      transactionDate: formatDateFromDb(row.transactionDate) || '',
      createdAt: row.createdAt?.toString() || '',
    } as ItemCostLayer;
  });
}

// ============================================
// WORK CENTERS
// ============================================

/**
 * List work centers with filters and pagination
 */
export async function listWorkCenters(
  filters: WorkCenterListFilters = {}
): Promise<{ data: WorkCenter[]; total: number }> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const conditions: any[] = [];

    if (filters.isActive !== undefined) {
      conditions.push(eq(tables.workCenters.isActive, filters.isActive));
    }
    if (filters.search) {
      conditions.push(
        sql`(${tables.workCenters.code} LIKE ${`%${filters.search}%`} OR ${tables.workCenters.name} LIKE ${`%${filters.search}%`})`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: count() })
      .from(tables.workCenters)
      .where(whereClause);
    const total = Number(countResult[0]?.count) || 0;

    // Get paginated data
    const data = await db
      .select({
        id: tables.workCenters.id,
        code: tables.workCenters.code,
        name: tables.workCenters.name,
        nameTh: tables.workCenters.nameTh,
        orgUnitId: tables.workCenters.orgUnitId,
        orgUnitName: tables.hrOrgUnits.name,
        laborRatePerHour: tables.workCenters.laborRatePerHour,
        overheadRatePerHour: tables.workCenters.overheadRatePerHour,
        machineRatePerHour: tables.workCenters.machineRatePerHour,
        capacityHoursPerDay: tables.workCenters.capacityHoursPerDay,
        isActive: tables.workCenters.isActive,
        createdAt: tables.workCenters.createdAt,
        updatedAt: tables.workCenters.updatedAt,
      })
      .from(tables.workCenters)
      .leftJoin(tables.hrOrgUnits, eq(tables.workCenters.orgUnitId, tables.hrOrgUnits.id))
      .where(whereClause)
      .orderBy(asc(tables.workCenters.code))
      .limit(pageSize)
      .offset(offset);

    return {
      data: data.map((row: typeof data[0]) => ({
        ...row,
        laborRatePerHour: Number(row.laborRatePerHour) || 0,
        overheadRatePerHour: Number(row.overheadRatePerHour) || 0,
        machineRatePerHour: Number(row.machineRatePerHour) || 0,
        capacityHoursPerDay: row.capacityHoursPerDay !== null ? Number(row.capacityHoursPerDay) : null,
        createdAt: row.createdAt?.toString() || '',
        updatedAt: row.updatedAt?.toString() || '',
      })) as WorkCenter[],
      total,
    };
  });
}

/**
 * Get a work center by ID
 */
export async function getWorkCenter(id: number): Promise<WorkCenter | null> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    const result = await db
      .select({
        id: tables.workCenters.id,
        code: tables.workCenters.code,
        name: tables.workCenters.name,
        nameTh: tables.workCenters.nameTh,
        orgUnitId: tables.workCenters.orgUnitId,
        orgUnitName: tables.hrOrgUnits.name,
        laborRatePerHour: tables.workCenters.laborRatePerHour,
        overheadRatePerHour: tables.workCenters.overheadRatePerHour,
        machineRatePerHour: tables.workCenters.machineRatePerHour,
        capacityHoursPerDay: tables.workCenters.capacityHoursPerDay,
        isActive: tables.workCenters.isActive,
        createdAt: tables.workCenters.createdAt,
        updatedAt: tables.workCenters.updatedAt,
      })
      .from(tables.workCenters)
      .leftJoin(tables.hrOrgUnits, eq(tables.workCenters.orgUnitId, tables.hrOrgUnits.id))
      .where(eq(tables.workCenters.id, id))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      ...row,
      laborRatePerHour: Number(row.laborRatePerHour) || 0,
      overheadRatePerHour: Number(row.overheadRatePerHour) || 0,
      machineRatePerHour: Number(row.machineRatePerHour) || 0,
      capacityHoursPerDay: row.capacityHoursPerDay !== null ? Number(row.capacityHoursPerDay) : null,
      createdAt: row.createdAt?.toString() || '',
      updatedAt: row.updatedAt?.toString() || '',
    } as WorkCenter;
  });
}

/**
 * Create a new work center
 */
export async function createWorkCenter(data: WorkCenterCreate): Promise<{ id: number; code: string }> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    // Check for duplicate code
    const existing = await db
      .select({ id: tables.workCenters.id })
      .from(tables.workCenters)
      .where(eq(tables.workCenters.code, data.code))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Work center with code "${data.code}" already exists`);
    }

    const now = getNow();
    const insertData = {
      code: data.code,
      name: data.name,
      nameTh: data.nameTh || null,
      orgUnitId: data.orgUnitId || null,
      laborRatePerHour: data.laborRatePerHour ?? 0,
      overheadRatePerHour: data.overheadRatePerHour ?? 0,
      machineRatePerHour: data.machineRatePerHour ?? 0,
      capacityHoursPerDay: data.capacityHoursPerDay || null,
      isActive: data.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.insert(tables.workCenters).values(insertData);
    const id = getInsertId(result);

    return { id, code: data.code };
  });
}

/**
 * Update a work center
 */
export async function updateWorkCenter(id: number, data: WorkCenterUpdate): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    // Check if exists
    const existing = await db
      .select({ id: tables.workCenters.id })
      .from(tables.workCenters)
      .where(eq(tables.workCenters.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`Work center with ID ${id} not found`);
    }

    // Check for duplicate code if code is being changed
    if (data.code) {
      const duplicate = await db
        .select({ id: tables.workCenters.id })
        .from(tables.workCenters)
        .where(and(
          eq(tables.workCenters.code, data.code),
          sql`${tables.workCenters.id} != ${id}`
        ))
        .limit(1);

      if (duplicate.length > 0) {
        throw new Error(`Work center with code "${data.code}" already exists`);
      }
    }

    const updateData: Record<string, any> = { updatedAt: getNow() };

    if (data.code !== undefined) updateData.code = data.code;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.nameTh !== undefined) updateData.nameTh = data.nameTh;
    if (data.orgUnitId !== undefined) updateData.orgUnitId = data.orgUnitId;
    if (data.laborRatePerHour !== undefined) updateData.laborRatePerHour = data.laborRatePerHour;
    if (data.overheadRatePerHour !== undefined) updateData.overheadRatePerHour = data.overheadRatePerHour;
    if (data.machineRatePerHour !== undefined) updateData.machineRatePerHour = data.machineRatePerHour;
    if (data.capacityHoursPerDay !== undefined) updateData.capacityHoursPerDay = data.capacityHoursPerDay;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    await db
      .update(tables.workCenters)
      .set(updateData)
      .where(eq(tables.workCenters.id, id));
  });
}

/**
 * Delete a work center (soft delete by setting isActive = false)
 */
export async function deleteWorkCenter(id: number): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    // Check if exists
    const existing = await db
      .select({ id: tables.workCenters.id })
      .from(tables.workCenters)
      .where(eq(tables.workCenters.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`Work center with ID ${id} not found`);
    }

    // Check if used in work order operations
    const usedInOperations = await db
      .select({ count: count() })
      .from(tables.workOrderOperations)
      .where(eq(tables.workOrderOperations.workCenterId, id));

    if (Number(usedInOperations[0]?.count) > 0) {
      throw new Error('Cannot delete work center that is used in work orders');
    }

    // Hard delete if not used
    await db
      .delete(tables.workCenters)
      .where(eq(tables.workCenters.id, id));
  });
}

// ============================================
// OVERHEAD RATES (US6)
// ============================================

/**
 * List overhead rates with optional filters
 */
export async function listOverheadRates(
  filters: OverheadRateListFilters = {}
): Promise<{ data: OverheadRate[]; total: number }> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    // Build conditions
    const conditions = [];
    if (filters.workCenterId) {
      conditions.push(eq(tables.overheadRates.workCenterId, filters.workCenterId));
    }
    if (filters.isActive !== undefined) {
      conditions.push(eq(tables.overheadRates.isActive, filters.isActive ? 1 : 0));
    }
    if (filters.effectiveDate) {
      conditions.push(lte(tables.overheadRates.effectiveFrom, filters.effectiveDate));
      // Either effectiveTo is null or >= effectiveDate
      conditions.push(
        sql`(${tables.overheadRates.effectiveTo} IS NULL OR ${tables.overheadRates.effectiveTo} >= ${filters.effectiveDate})`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: count() })
      .from(tables.overheadRates)
      .where(whereClause);
    const total = Number(countResult[0]?.count) || 0;

    // Get data
    const rows = await db
      .select({
        id: tables.overheadRates.id,
        code: tables.overheadRates.code,
        name: tables.overheadRates.name,
        orgUnitId: tables.overheadRates.orgUnitId,
        workCenterId: tables.overheadRates.workCenterId,
        overheadType: tables.overheadRates.overheadType,
        allocationBasis: tables.overheadRates.allocationBasis,
        ratePerUnit: tables.overheadRates.ratePerUnit,
        effectiveFrom: tables.overheadRates.effectiveFrom,
        effectiveTo: tables.overheadRates.effectiveTo,
        glAccountId: tables.overheadRates.glAccountId,
        isActive: tables.overheadRates.isActive,
        createdAt: tables.overheadRates.createdAt,
        updatedAt: tables.overheadRates.updatedAt,
        workCenterCode: tables.workCenters.code,
      })
      .from(tables.overheadRates)
      .leftJoin(tables.workCenters, eq(tables.overheadRates.workCenterId, tables.workCenters.id))
      .where(whereClause)
      .orderBy(tables.overheadRates.code);

    const data = rows.map((row: typeof rows[number]) => ({
      ...row,
      isActive: Boolean(row.isActive),
      effectiveFrom: formatDateFromDb(row.effectiveFrom) || '',
      effectiveTo: row.effectiveTo ? formatDateFromDb(row.effectiveTo) : null,
      createdAt: formatDateFromDb(row.createdAt) || '',
      updatedAt: formatDateFromDb(row.updatedAt) || '',
    })) as OverheadRate[];

    return { data, total };
  });
}

/**
 * Get a single overhead rate by ID
 */
export async function getOverheadRate(id: number): Promise<OverheadRate | null> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    const rows = await db
      .select({
        id: tables.overheadRates.id,
        code: tables.overheadRates.code,
        name: tables.overheadRates.name,
        orgUnitId: tables.overheadRates.orgUnitId,
        workCenterId: tables.overheadRates.workCenterId,
        overheadType: tables.overheadRates.overheadType,
        allocationBasis: tables.overheadRates.allocationBasis,
        ratePerUnit: tables.overheadRates.ratePerUnit,
        effectiveFrom: tables.overheadRates.effectiveFrom,
        effectiveTo: tables.overheadRates.effectiveTo,
        glAccountId: tables.overheadRates.glAccountId,
        isActive: tables.overheadRates.isActive,
        createdAt: tables.overheadRates.createdAt,
        updatedAt: tables.overheadRates.updatedAt,
        workCenterCode: tables.workCenters.code,
      })
      .from(tables.overheadRates)
      .leftJoin(tables.workCenters, eq(tables.overheadRates.workCenterId, tables.workCenters.id))
      .where(eq(tables.overheadRates.id, id))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      ...row,
      isActive: Boolean(row.isActive),
      effectiveFrom: formatDateFromDb(row.effectiveFrom) || '',
      effectiveTo: row.effectiveTo ? formatDateFromDb(row.effectiveTo) : null,
      createdAt: formatDateFromDb(row.createdAt) || '',
      updatedAt: formatDateFromDb(row.updatedAt) || '',
    } as OverheadRate;
  });
}

/**
 * Create a new overhead rate
 */
export async function createOverheadRate(
  data: OverheadRateCreate
): Promise<{ id: number; code: string }> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    // Check for duplicate code
    const existing = await db
      .select({ id: tables.overheadRates.id })
      .from(tables.overheadRates)
      .where(eq(tables.overheadRates.code, data.code))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Overhead rate with code ${data.code} already exists`);
    }

    const result = await db.insert(tables.overheadRates).values({
      code: data.code,
      name: data.name,
      orgUnitId: data.orgUnitId ?? null,
      workCenterId: data.workCenterId ?? null,
      overheadType: data.overheadType,
      allocationBasis: data.allocationBasis,
      ratePerUnit: data.ratePerUnit,
      effectiveFrom: data.effectiveFrom,
      effectiveTo: data.effectiveTo ?? null,
      glAccountId: data.glAccountId ?? null,
      isActive: data.isActive !== false ? 1 : 0,
      createdAt: getNow(),
      updatedAt: getNow(),
    });

    const id = getInsertId(result);
    return { id, code: data.code };
  });
}

/**
 * Update an overhead rate
 */
export async function updateOverheadRate(
  id: number,
  data: OverheadRateUpdate
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    // Check if exists
    const existing = await db
      .select({ id: tables.overheadRates.id })
      .from(tables.overheadRates)
      .where(eq(tables.overheadRates.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`Overhead rate with ID ${id} not found`);
    }

    const updateData: Record<string, unknown> = { updatedAt: getNow() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.ratePerUnit !== undefined) updateData.ratePerUnit = data.ratePerUnit;
    if (data.effectiveTo !== undefined) updateData.effectiveTo = data.effectiveTo;
    if (data.isActive !== undefined) updateData.isActive = data.isActive ? 1 : 0;

    await db
      .update(tables.overheadRates)
      .set(updateData)
      .where(eq(tables.overheadRates.id, id));
  });
}

/**
 * Get effective overhead rate for a work center on a specific date
 */
export async function getEffectiveOverheadRate(
  workCenterId: number,
  date: string
): Promise<OverheadRate | null> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    const rows = await db
      .select({
        id: tables.overheadRates.id,
        code: tables.overheadRates.code,
        name: tables.overheadRates.name,
        orgUnitId: tables.overheadRates.orgUnitId,
        workCenterId: tables.overheadRates.workCenterId,
        overheadType: tables.overheadRates.overheadType,
        allocationBasis: tables.overheadRates.allocationBasis,
        ratePerUnit: tables.overheadRates.ratePerUnit,
        effectiveFrom: tables.overheadRates.effectiveFrom,
        effectiveTo: tables.overheadRates.effectiveTo,
        glAccountId: tables.overheadRates.glAccountId,
        isActive: tables.overheadRates.isActive,
        createdAt: tables.overheadRates.createdAt,
        updatedAt: tables.overheadRates.updatedAt,
      })
      .from(tables.overheadRates)
      .where(
        and(
          eq(tables.overheadRates.workCenterId, workCenterId),
          eq(tables.overheadRates.isActive, 1),
          lte(tables.overheadRates.effectiveFrom, date),
          sql`(${tables.overheadRates.effectiveTo} IS NULL OR ${tables.overheadRates.effectiveTo} >= ${date})`
        )
      )
      .orderBy(desc(tables.overheadRates.effectiveFrom))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      ...row,
      isActive: Boolean(row.isActive),
      effectiveFrom: formatDateFromDb(row.effectiveFrom) || '',
      effectiveTo: row.effectiveTo ? formatDateFromDb(row.effectiveTo) : null,
      createdAt: formatDateFromDb(row.createdAt) || '',
      updatedAt: formatDateFromDb(row.updatedAt) || '',
    } as OverheadRate;
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate next document number for landed costs
 * Format: LC-YYYY-NNNN
 */
export async function generateLandedCostDocNumber(): Promise<string> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();
    const year = new Date().getFullYear();
    const prefix = `LC-${year}-`;

    // Find the highest number for this year
    const result = await db
      .select({ documentNumber: tables.landedCostHeaders.documentNumber })
      .from(tables.landedCostHeaders)
      .where(like(tables.landedCostHeaders.documentNumber, `${prefix}%`))
      .orderBy(desc(tables.landedCostHeaders.documentNumber))
      .limit(1);

    let nextNum = 1;
    if (result.length > 0) {
      const lastDoc = result[0].documentNumber;
      const numPart = lastDoc.substring(prefix.length);
      nextNum = parseInt(numPart, 10) + 1;
    }

    return `${prefix}${nextNum.toString().padStart(4, '0')}`;
  });
}

/**
 * Update item's last purchase cost information
 */
export async function updateItemLastPurchase(
  itemId: number,
  unitCost: number,
  poId: number
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    await db
      .update(tables.items)
      .set({
        lastPurchaseCost: unitCost,
        lastPurchaseDate: getTodayStr(),
        lastPurchasePoId: poId,
        updatedAt: getNow(),
      })
      .where(eq(tables.items.id, itemId));
  });
}

/**
 * Update item's last production cost information
 */
export async function updateItemLastProduction(
  itemId: number,
  unitCost: number,
  woId: number
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    await db
      .update(tables.items)
      .set({
        lastProductionCost: unitCost,
        lastProductionDate: getTodayStr(),
        lastProductionWoId: woId,
        updatedAt: getNow(),
      })
      .where(eq(tables.items.id, itemId));
  });
}

// ============================================
// LANDED COST MANAGEMENT
// ============================================

/**
 * Generate document number for landed cost
 */
async function generateLandedCostDocNumberInternal(): Promise<string> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();
    const year = new Date().getFullYear();
    const prefix = `LC${year}-`;

    // Get the latest document number for this year
    const result = await db
      .select({ documentNumber: tables.landedCostHeaders.documentNumber })
      .from(tables.landedCostHeaders)
      .where(like(tables.landedCostHeaders.documentNumber, `${prefix}%`))
      .orderBy(desc(tables.landedCostHeaders.documentNumber))
      .limit(1);

    let nextNumber = 1;
    if (result.length > 0 && result[0].documentNumber) {
      const lastNumber = parseInt(result[0].documentNumber.replace(prefix, ''), 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    return `${prefix}${nextNumber.toString().padStart(5, '0')}`;
  });
}

/**
 * Create a new landed cost header with optional lines
 */
export async function createLandedCost(
  data: LandedCostHeaderCreate,
  userId: number
): Promise<{ id: number; documentNumber: string }> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();
    const documentNumber = await generateLandedCostDocNumberInternal();

    // Get reference number (PO number or shipment number)
    let referenceNumber: string | null = null;
    if (data.referenceType === 'po') {
      // Get PO number from purchase_orders table
      const purchaseOrders = getTableRef('purchaseOrders');
      const poResult = await db
        .select({ poNumber: purchaseOrders.poNumber })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, data.referenceId))
        .limit(1);
      referenceNumber = poResult[0]?.poNumber || null;
    }

    // Insert header
    const headerResult = await db
      .insert(tables.landedCostHeaders)
      .values({
        documentNumber,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        referenceNumber,
        vendorId: data.vendorId || null,
        invoiceNumber: data.invoiceNumber || null,
        invoiceDate: data.invoiceDate || null,
        totalAmount: 0, // Will be calculated from lines
        currency: data.currency || 'THB',
        exchangeRate: data.exchangeRate || 1,
        status: 'draft',
        createdBy: userId,
        createdAt: getNow(),
        updatedAt: getNow(),
      });

    const headerId = getInsertId(headerResult);

    // Insert lines if provided
    if (data.lines && data.lines.length > 0) {
      let totalAmount = 0;

      for (const line of data.lines) {
        await db
          .insert(tables.landedCostLines)
          .values({
            landedCostHeaderId: headerId,
            costType: line.costType,
            description: line.description || null,
            amount: line.amount,
            allocationBasis: line.allocationBasis || 'value',
            createdAt: getNow(),
          });
        totalAmount += line.amount;
      }

      // Update header total
      await db
        .update(tables.landedCostHeaders)
        .set({
          totalAmount,
          updatedAt: getNow(),
        })
        .where(eq(tables.landedCostHeaders.id, headerId));
    }

    return { id: headerId, documentNumber };
  });
}

/**
 * Get a landed cost header with lines and allocations
 */
export async function getLandedCost(id: number): Promise<LandedCostHeader | null> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    const headerResult = await db
      .select()
      .from(tables.landedCostHeaders)
      .where(eq(tables.landedCostHeaders.id, id))
      .limit(1);

    if (headerResult.length === 0) {
      return null;
    }

    const header = headerResult[0];

    // Get lines
    const lines = await db
      .select()
      .from(tables.landedCostLines)
      .where(eq(tables.landedCostLines.landedCostHeaderId, id));

    // Get allocations
    const allocations = await db
      .select()
      .from(tables.landedCostAllocations)
      .where(eq(tables.landedCostAllocations.landedCostHeaderId, id));

    return {
      id: header.id,
      documentNumber: header.documentNumber,
      referenceType: header.referenceType as 'po' | 'shipment',
      referenceId: header.referenceId,
      referenceNumber: header.referenceNumber,
      vendorId: header.vendorId,
      invoiceNumber: header.invoiceNumber,
      invoiceDate: formatDateFromDb(header.invoiceDate),
      totalAmount: Number(header.totalAmount) || 0,
      currency: header.currency,
      exchangeRate: Number(header.exchangeRate) || 1,
      status: header.status as 'draft' | 'allocated' | 'posted',
      postedAt: header.postedAt ? formatDateFromDb(header.postedAt) : null,
      postedBy: header.postedBy,
      createdBy: header.createdBy,
      createdAt: formatDateFromDb(header.createdAt),
      updatedAt: formatDateFromDb(header.updatedAt),
      lines: lines.map((l: typeof lines[0]) => ({
        id: l.id,
        landedCostHeaderId: l.landedCostHeaderId,
        costType: l.costType as 'freight' | 'duty' | 'insurance' | 'handling' | 'inspection' | 'other',
        description: l.description,
        amount: Number(l.amount) || 0,
        allocationBasis: l.allocationBasis as AllocationBasis,
        createdAt: formatDateFromDb(l.createdAt),
      })),
      allocations: allocations.map((a: typeof allocations[0]) => ({
        id: a.id,
        landedCostLineId: a.landedCostLineId,
        landedCostHeaderId: a.landedCostHeaderId,
        itemId: a.itemId,
        lotId: a.lotId,
        poLineId: a.poLineId,
        allocatedAmount: Number(a.allocatedAmount) || 0,
        basisValue: Number(a.basisValue) || 0,
        createdAt: formatDateFromDb(a.createdAt),
      })),
    };
  });
}

/**
 * Update a landed cost header
 */
export async function updateLandedCost(
  id: number,
  data: LandedCostHeaderUpdate
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    // Check if landed cost exists and is in draft status
    const existing = await db
      .select({ status: tables.landedCostHeaders.status })
      .from(tables.landedCostHeaders)
      .where(eq(tables.landedCostHeaders.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`Landed cost with ID ${id} not found`);
    }

    if (existing[0].status !== 'draft') {
      throw new Error('Cannot update landed cost that is not in draft status');
    }

    // Update header fields
    await db
      .update(tables.landedCostHeaders)
      .set({
        vendorId: data.vendorId !== undefined ? data.vendorId : undefined,
        invoiceNumber: data.invoiceNumber !== undefined ? data.invoiceNumber : undefined,
        invoiceDate: data.invoiceDate !== undefined ? data.invoiceDate : undefined,
        currency: data.currency !== undefined ? data.currency : undefined,
        exchangeRate: data.exchangeRate !== undefined ? data.exchangeRate : undefined,
        updatedAt: getNow(),
      })
      .where(eq(tables.landedCostHeaders.id, id));

    // If lines are provided, replace all lines
    if (data.lines !== undefined) {
      // Delete existing lines
      await db
        .delete(tables.landedCostLines)
        .where(eq(tables.landedCostLines.landedCostHeaderId, id));

      // Delete existing allocations
      await db
        .delete(tables.landedCostAllocations)
        .where(eq(tables.landedCostAllocations.landedCostHeaderId, id));

      // Insert new lines
      let totalAmount = 0;
      for (const line of data.lines) {
        await db
          .insert(tables.landedCostLines)
          .values({
            landedCostHeaderId: id,
            costType: line.costType,
            description: line.description || null,
            amount: line.amount,
            allocationBasis: line.allocationBasis || 'value',
            createdAt: getNow(),
          });
        totalAmount += line.amount;
      }

      // Update header total
      await db
        .update(tables.landedCostHeaders)
        .set({
          totalAmount,
          status: 'draft', // Reset to draft if lines changed
          updatedAt: getNow(),
        })
        .where(eq(tables.landedCostHeaders.id, id));
    }
  });
}

/**
 * Delete a landed cost header and its lines
 */
export async function deleteLandedCost(id: number): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    // Check if landed cost exists and is in draft status
    const existing = await db
      .select({ status: tables.landedCostHeaders.status })
      .from(tables.landedCostHeaders)
      .where(eq(tables.landedCostHeaders.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`Landed cost with ID ${id} not found`);
    }

    if (existing[0].status !== 'draft') {
      throw new Error('Cannot delete landed cost that is not in draft status');
    }

    // Delete allocations, lines, then header
    await db
      .delete(tables.landedCostAllocations)
      .where(eq(tables.landedCostAllocations.landedCostHeaderId, id));

    await db
      .delete(tables.landedCostLines)
      .where(eq(tables.landedCostLines.landedCostHeaderId, id));

    await db
      .delete(tables.landedCostHeaders)
      .where(eq(tables.landedCostHeaders.id, id));
  });
}

/**
 * List landed costs with filters and pagination
 */
export async function listLandedCosts(
  filters: LandedCostListFilters = {}
): Promise<{ data: LandedCostHeader[]; total: number; page: number; pageSize: number }> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();
    const { status, fromDate, toDate, search, page = 1, pageSize = 20 } = filters;

    // Build conditions
    const conditions = [];

    if (status) {
      conditions.push(eq(tables.landedCostHeaders.status, status));
    }

    if (fromDate) {
      conditions.push(gte(tables.landedCostHeaders.createdAt, fromDate));
    }

    if (toDate) {
      conditions.push(lte(tables.landedCostHeaders.createdAt, toDate + ' 23:59:59'));
    }

    if (search) {
      conditions.push(
        sql`(${tables.landedCostHeaders.documentNumber} LIKE ${`%${search}%`} OR ${tables.landedCostHeaders.referenceNumber} LIKE ${`%${search}%`} OR ${tables.landedCostHeaders.invoiceNumber} LIKE ${`%${search}%`})`
      );
    }

    // Get total count
    const countResult = await db
      .select({ count: count() })
      .from(tables.landedCostHeaders)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countResult[0]?.count) || 0;

    // Get paginated data
    const offset = (page - 1) * pageSize;
    const data = await db
      .select()
      .from(tables.landedCostHeaders)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tables.landedCostHeaders.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      data: data.map((row: typeof data[0]) => ({
        id: row.id,
        documentNumber: row.documentNumber,
        referenceType: row.referenceType as 'po' | 'shipment',
        referenceId: row.referenceId,
        referenceNumber: row.referenceNumber,
        vendorId: row.vendorId,
        invoiceNumber: row.invoiceNumber,
        invoiceDate: formatDateFromDb(row.invoiceDate),
        totalAmount: Number(row.totalAmount) || 0,
        currency: row.currency,
        exchangeRate: Number(row.exchangeRate) || 1,
        status: row.status as 'draft' | 'allocated' | 'posted',
        postedAt: row.postedAt ? formatDateFromDb(row.postedAt) : null,
        postedBy: row.postedBy,
        createdBy: row.createdBy,
        createdAt: formatDateFromDb(row.createdAt),
        updatedAt: formatDateFromDb(row.updatedAt),
      })),
      total,
      page,
      pageSize,
    };
  });
}

/**
 * Allocate landed cost to items based on allocation basis
 * Supports 4 allocation bases: value, quantity, weight, volume
 */
export async function allocateLandedCost(
  landedCostId: number
): Promise<LandedCostAllocation[]> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();
    const purchaseOrderLines = getTableRef('purchaseOrderLines');

    // Get landed cost header
    const headerResult = await db
      .select()
      .from(tables.landedCostHeaders)
      .where(eq(tables.landedCostHeaders.id, landedCostId))
      .limit(1);

    if (headerResult.length === 0) {
      throw new Error(`Landed cost with ID ${landedCostId} not found`);
    }

    const header = headerResult[0];

    if (header.status !== 'draft') {
      throw new Error('Can only allocate landed cost in draft status');
    }

    // Get lines
    const lines = await db
      .select()
      .from(tables.landedCostLines)
      .where(eq(tables.landedCostLines.landedCostHeaderId, landedCostId));

    if (lines.length === 0) {
      throw new Error('No cost lines to allocate');
    }

    // Get PO lines for allocation (only for PO reference type)
    if (header.referenceType !== 'po') {
      throw new Error('Only PO reference type is currently supported');
    }

    const poLines = await db
      .select({
        id: purchaseOrderLines.id,
        itemId: purchaseOrderLines.itemId,
        quantity: purchaseOrderLines.quantity,
        receivedQuantity: purchaseOrderLines.receivedQuantity,
        unitPrice: purchaseOrderLines.unitPrice,
      })
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.poId, header.referenceId));

    if (poLines.length === 0) {
      throw new Error('No PO lines found for allocation');
    }

    // Get item details for weight/volume (if needed)
    const itemIds = [...new Set(poLines.map((l: typeof poLines[0]) => l.itemId))];
    const itemDetails = await db
      .select({
        id: tables.items.id,
        code: tables.items.code,
        nameTh: tables.items.nameTh,
        weight: tables.items.weight,
        volume: tables.items.volume,
      })
      .from(tables.items)
      .where(sql`${tables.items.id} IN (${sql.join(itemIds.map((id) => sql`${id}`), sql`, `)})`);

    type ItemDetail = typeof itemDetails[0];
    const itemMap = new Map<number, ItemDetail>(itemDetails.map((i: ItemDetail) => [i.id, i]));

    // Delete existing allocations
    await db
      .delete(tables.landedCostAllocations)
      .where(eq(tables.landedCostAllocations.landedCostHeaderId, landedCostId));

    // Calculate allocations for each line
    const allAllocations: LandedCostAllocation[] = [];

    for (const line of lines) {
      const basis = line.allocationBasis as AllocationBasis;

      // Calculate total basis value
      let totalBasisValue = 0;
      const poLineBasisValues: { poLineId: number; itemId: number; value: number }[] = [];

      for (const poLine of poLines) {
        const qty = Number(poLine.receivedQuantity) || Number(poLine.quantity) || 0;
        const item = itemMap.get(poLine.itemId);

        let basisValue = 0;
        switch (basis) {
          case 'value':
            basisValue = qty * (Number(poLine.unitPrice) || 0);
            break;
          case 'quantity':
            basisValue = qty;
            break;
          case 'weight':
            basisValue = qty * (Number(item?.weight) || 1); // Default weight 1 if not set
            break;
          case 'volume':
            basisValue = qty * (Number(item?.volume) || 1); // Default volume 1 if not set
            break;
        }

        poLineBasisValues.push({
          poLineId: poLine.id,
          itemId: poLine.itemId,
          value: basisValue,
        });
        totalBasisValue += basisValue;
      }

      // Allocate cost proportionally
      if (totalBasisValue > 0) {
        for (const plBasis of poLineBasisValues) {
          const allocatedAmount = (plBasis.value / totalBasisValue) * Number(line.amount);

          const allocResult = await db
            .insert(tables.landedCostAllocations)
            .values({
              landedCostLineId: line.id,
              landedCostHeaderId: landedCostId,
              itemId: plBasis.itemId,
              poLineId: plBasis.poLineId,
              allocatedAmount: Math.round(allocatedAmount * 10000) / 10000, // 4 decimal precision
              basisValue: plBasis.value,
              createdAt: getNow(),
            });

          const allocId = getInsertId(allocResult);
          const item = itemMap.get(plBasis.itemId);

          allAllocations.push({
            id: allocId,
            landedCostLineId: line.id,
            landedCostHeaderId: landedCostId,
            itemId: plBasis.itemId,
            itemCode: item?.code,
            itemName: item?.nameTh,
            lotId: null,
            poLineId: plBasis.poLineId,
            allocatedAmount: Math.round(allocatedAmount * 10000) / 10000,
            basisValue: plBasis.value,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    // Update header status to allocated
    await db
      .update(tables.landedCostHeaders)
      .set({
        status: 'allocated',
        updatedAt: getNow(),
      })
      .where(eq(tables.landedCostHeaders.id, landedCostId));

    return allAllocations;
  });
}

/**
 * Post landed cost - updates WAC for affected items and creates cost layers
 */
export async function postLandedCost(
  landedCostId: number,
  userId: number
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();
    const purchaseOrderLines = getTableRef('purchaseOrderLines');

    // Get landed cost header
    const headerResult = await db
      .select()
      .from(tables.landedCostHeaders)
      .where(eq(tables.landedCostHeaders.id, landedCostId))
      .limit(1);

    if (headerResult.length === 0) {
      throw new Error(`Landed cost with ID ${landedCostId} not found`);
    }

    const header = headerResult[0];

    if (header.status !== 'allocated') {
      throw new Error('Can only post landed cost in allocated status');
    }

    // Get allocations grouped by item
    const allocations = await db
      .select()
      .from(tables.landedCostAllocations)
      .where(eq(tables.landedCostAllocations.landedCostHeaderId, landedCostId));

    if (allocations.length === 0) {
      throw new Error('No allocations found - please allocate first');
    }

    // Group allocations by item
    const itemAllocations = new Map<number, number>();
    const itemPoLineIds = new Map<number, number>();

    for (const alloc of allocations) {
      const currentAmount = itemAllocations.get(alloc.itemId) || 0;
      itemAllocations.set(alloc.itemId, currentAmount + Number(alloc.allocatedAmount));
      if (alloc.poLineId) {
        itemPoLineIds.set(alloc.itemId, alloc.poLineId);
      }
    }

    // Get PO lines to determine quantities
    const poLineIds = Array.from(new Set(allocations.map((a: typeof allocations[0]) => a.poLineId).filter((id: number | null): id is number => id !== null)));

    const poLines = await db
      .select({
        id: purchaseOrderLines.id,
        itemId: purchaseOrderLines.itemId,
        receivedQuantity: purchaseOrderLines.receivedQuantity,
        quantity: purchaseOrderLines.quantity,
      })
      .from(purchaseOrderLines)
      .where(sql`${purchaseOrderLines.id} IN (${sql.join(poLineIds.map((id) => sql`${id}`), sql`, `)})`);

    type POLineInfo = typeof poLines[0];
    const poLineMap = new Map<number, POLineInfo>(poLines.map((l: POLineInfo) => [l.id, l]));

    // Calculate per-unit landed cost and update WAC for each item
    for (const [itemId, totalLandedCost] of itemAllocations) {
      // Get the PO line to determine quantity
      const poLineId = itemPoLineIds.get(itemId);
      const poLine = poLineId ? poLineMap.get(poLineId) : undefined;
      const qty = Number(poLine?.receivedQuantity) || Number(poLine?.quantity) || 1;

      // Calculate per-unit landed cost
      const perUnitLandedCost = totalLandedCost / qty;

      // Create cost layer for landed cost
      await recalculateWAC({
        itemId,
        transactionType: 'landed_cost',
        transactionId: landedCostId,
        quantity: 0, // Landed cost doesn't change quantity
        unitCost: perUnitLandedCost * qty, // Total landed cost for this item
        transactionDate: getTodayStr(),
        notes: `Landed Cost: ${header.documentNumber}`,
        createdBy: userId,
      });
    }

    // Update header status to posted
    await db
      .update(tables.landedCostHeaders)
      .set({
        status: 'posted',
        postedAt: getNow(),
        postedBy: userId,
        updatedAt: getNow(),
      })
      .where(eq(tables.landedCostHeaders.id, landedCostId));
  });
}

// ============================================
// PRODUCTION COST AGGREGATION (US3)
// ============================================

/**
 * Get work order operations with time tracking and costs
 */
export async function getWorkOrderOperations(
  workOrderId: number
): Promise<WorkOrderOperation[]> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    const result = await db
      .select({
        id: tables.workOrderOperations.id,
        workOrderId: tables.workOrderOperations.workOrderId,
        operationId: tables.workOrderOperations.operationId,
        workCenterId: tables.workOrderOperations.workCenterId,
        workCenterCode: tables.workCenters.code,
        workCenterName: tables.workCenters.name,
        sequence: tables.workOrderOperations.sequence,
        operationName: tables.operations.name,
        plannedHours: tables.workOrderOperations.plannedHours,
        actualHours: tables.workOrderOperations.actualHours,
        laborRate: tables.workOrderOperations.laborRate,
        laborCost: tables.workOrderOperations.laborCost,
        overheadRate: tables.workOrderOperations.overheadRate,
        overheadCost: tables.workOrderOperations.overheadCost,
        startTime: tables.workOrderOperations.startTime,
        endTime: tables.workOrderOperations.endTime,
        operatorId: tables.workOrderOperations.operatorId,
        operatorFirstName: tables.hrEmployees.firstName,
        operatorLastName: tables.hrEmployees.lastName,
        status: tables.workOrderOperations.status,
        notes: tables.workOrderOperations.notes,
        createdAt: tables.workOrderOperations.createdAt,
        updatedAt: tables.workOrderOperations.updatedAt,
      })
      .from(tables.workOrderOperations)
      .leftJoin(tables.workCenters, eq(tables.workOrderOperations.workCenterId, tables.workCenters.id))
      .leftJoin(tables.operations, eq(tables.workOrderOperations.operationId, tables.operations.id))
      .leftJoin(tables.hrEmployees, eq(tables.workOrderOperations.operatorId, tables.hrEmployees.id))
      .where(eq(tables.workOrderOperations.workOrderId, workOrderId))
      .orderBy(asc(tables.workOrderOperations.sequence));

    return result.map((row: typeof result[0]) => {
      const operatorName = row.operatorFirstName && row.operatorLastName
        ? `${row.operatorFirstName} ${row.operatorLastName}`
        : undefined;
      return {
      id: row.id,
      workOrderId: row.workOrderId,
      operationId: row.operationId,
      workCenterId: row.workCenterId,
      workCenterCode: row.workCenterCode || undefined,
      workCenterName: row.workCenterName || undefined,
      sequence: row.sequence,
      operationName: row.operationName || undefined,
      plannedHours: Number(row.plannedHours) || 0,
      actualHours: row.actualHours !== null ? Number(row.actualHours) : null,
      laborRate: Number(row.laborRate) || 0,
      laborCost: row.laborCost !== null ? Number(row.laborCost) : null,
      overheadRate: Number(row.overheadRate) || 0,
      overheadCost: row.overheadCost !== null ? Number(row.overheadCost) : null,
      startTime: formatDateFromDb(row.startTime),
      endTime: formatDateFromDb(row.endTime),
      operatorId: row.operatorId,
      operatorName,
      status: row.status as 'pending' | 'in_progress' | 'completed' | 'skipped',
      notes: row.notes,
      createdAt: formatDateFromDb(row.createdAt) || '',
      updatedAt: formatDateFromDb(row.updatedAt) || '',
    };
    }) as WorkOrderOperation[];
  });
}

/**
 * Create work order operations from BOM routing
 */
export async function createWorkOrderOperations(
  data: WorkOrderOperationCreate[]
): Promise<number[]> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();
    const ids: number[] = [];

    for (const op of data) {
      const result = await db
        .insert(tables.workOrderOperations)
        .values({
          workOrderId: op.workOrderId,
          operationId: op.operationId,
          workCenterId: op.workCenterId,
          sequence: op.sequence,
          plannedHours: op.plannedHours,
          laborRate: op.laborRate,
          overheadRate: op.overheadRate,
          status: 'pending',
          createdAt: getNow(),
          updatedAt: getNow(),
        });
      ids.push(getInsertId(result));
    }

    return ids;
  });
}

/**
 * Update work order operation (time tracking)
 */
export async function updateWorkOrderOperation(
  operationId: number,
  data: WorkOrderOperationUpdate
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    // Get existing operation
    const existing = await db
      .select()
      .from(tables.workOrderOperations)
      .where(eq(tables.workOrderOperations.id, operationId))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`Work order operation ${operationId} not found`);
    }

    const op = existing[0];
    const updateData: Record<string, unknown> = {
      updatedAt: getNow(),
    };

    if (data.actualHours !== undefined) {
      updateData.actualHours = data.actualHours;
      // Calculate costs when actual hours are set
      if (data.actualHours !== null) {
        updateData.laborCost = Math.round(data.actualHours * Number(op.laborRate) * 10000) / 10000;
        updateData.overheadCost = Math.round(data.actualHours * Number(op.overheadRate) * 10000) / 10000;
      }
    }
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.operatorId !== undefined) updateData.operatorId = data.operatorId;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;

    await db
      .update(tables.workOrderOperations)
      .set(updateData)
      .where(eq(tables.workOrderOperations.id, operationId));
  });
}

/**
 * Get or create work order cost record
 */
export async function getWorkOrderCost(workOrderId: number): Promise<WorkOrderCost | null> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    const result = await db
      .select({
        id: tables.workOrderCosts.id,
        workOrderId: tables.workOrderCosts.workOrderId,
        workOrderNumber: tables.workOrders.woNumber,
        materialCost: tables.workOrderCosts.materialCost,
        laborCost: tables.workOrderCosts.laborCost,
        overheadCost: tables.workOrderCosts.overheadCost,
        totalCost: tables.workOrderCosts.totalCost,
        producedQuantity: tables.workOrderCosts.producedQuantity,
        unitCost: tables.workOrderCosts.unitCost,
        status: tables.workOrderCosts.status,
        completedAt: tables.workOrderCosts.completedAt,
        createdAt: tables.workOrderCosts.createdAt,
        updatedAt: tables.workOrderCosts.updatedAt,
      })
      .from(tables.workOrderCosts)
      .leftJoin(tables.workOrders, eq(tables.workOrderCosts.workOrderId, tables.workOrders.id))
      .where(eq(tables.workOrderCosts.workOrderId, workOrderId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id,
      workOrderId: row.workOrderId,
      workOrderNumber: row.workOrderNumber || undefined,
      materialCost: Number(row.materialCost) || 0,
      laborCost: Number(row.laborCost) || 0,
      overheadCost: Number(row.overheadCost) || 0,
      totalCost: Number(row.totalCost) || 0,
      producedQuantity: row.producedQuantity !== null ? Number(row.producedQuantity) : null,
      unitCost: row.unitCost !== null ? Number(row.unitCost) : null,
      status: row.status as 'in_progress' | 'completed' | 'adjusted',
      completedAt: formatDateFromDb(row.completedAt),
      createdAt: formatDateFromDb(row.createdAt) || '',
      updatedAt: formatDateFromDb(row.updatedAt) || '',
    };
  });
}

/**
 * Upsert work order cost record
 */
export async function upsertWorkOrderCost(data: WorkOrderCostUpsert): Promise<number> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    // Check if exists
    const existing = await db
      .select({ id: tables.workOrderCosts.id })
      .from(tables.workOrderCosts)
      .where(eq(tables.workOrderCosts.workOrderId, data.workOrderId))
      .limit(1);

    if (existing.length > 0) {
      // Update
      const updateData: Record<string, unknown> = {
        updatedAt: getNow(),
      };
      if (data.materialCost !== undefined) updateData.materialCost = data.materialCost;
      if (data.laborCost !== undefined) updateData.laborCost = data.laborCost;
      if (data.overheadCost !== undefined) updateData.overheadCost = data.overheadCost;
      if (data.totalCost !== undefined) updateData.totalCost = data.totalCost;
      if (data.producedQuantity !== undefined) updateData.producedQuantity = data.producedQuantity;
      if (data.unitCost !== undefined) updateData.unitCost = data.unitCost;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;

      await db
        .update(tables.workOrderCosts)
        .set(updateData)
        .where(eq(tables.workOrderCosts.workOrderId, data.workOrderId));

      return existing[0].id;
    } else {
      // Insert
      const result = await db
        .insert(tables.workOrderCosts)
        .values({
          workOrderId: data.workOrderId,
          materialCost: data.materialCost ?? 0,
          laborCost: data.laborCost ?? 0,
          overheadCost: data.overheadCost ?? 0,
          totalCost: data.totalCost ?? 0,
          producedQuantity: data.producedQuantity ?? null,
          unitCost: data.unitCost ?? null,
          status: data.status ?? 'in_progress',
          completedAt: data.completedAt ?? null,
          createdAt: getNow(),
          updatedAt: getNow(),
        });

      return getInsertId(result);
    }
  });
}

/**
 * Calculate work order cost from materials issued and operations completed
 *
 * This aggregates:
 * - Material Cost: Sum of (quantity × WAC) for all dispensed materials
 * - Labor Cost: Sum of (actualHours × laborRate) for all operations
 * - Overhead Cost: Sum of (actualHours × overheadRate) for all operations
 *
 * @param workOrderId - The work order to calculate costs for
 * @returns Aggregated production cost summary
 */
export async function calculateWorkOrderCost(workOrderId: number): Promise<ProductionCostSummary> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    // 1. Calculate Material Cost from work_order_materials
    const materialResult = await db
      .select({
        totalMaterialCost: sql<number>`COALESCE(SUM(${tables.workOrderMaterials.actualQuantity} * COALESCE(${tables.workOrderMaterials.unitCost}, ${tables.items.currentWAC}, 0)), 0)`,
      })
      .from(tables.workOrderMaterials)
      .leftJoin(tables.items, eq(tables.workOrderMaterials.itemId, tables.items.id))
      .where(eq(tables.workOrderMaterials.workOrderId, workOrderId));

    const materialCost = Number(materialResult[0]?.totalMaterialCost) || 0;

    // 2. Calculate Labor and Overhead Cost from work_order_operations
    const operationResult = await db
      .select({
        totalLaborCost: sql<number>`COALESCE(SUM(${tables.workOrderOperations.laborCost}), 0)`,
        totalOverheadCost: sql<number>`COALESCE(SUM(${tables.workOrderOperations.overheadCost}), 0)`,
      })
      .from(tables.workOrderOperations)
      .where(eq(tables.workOrderOperations.workOrderId, workOrderId));

    const laborCost = Number(operationResult[0]?.totalLaborCost) || 0;
    const overheadCost = Number(operationResult[0]?.totalOverheadCost) || 0;

    // 3. Get produced quantity from work order
    const woResult = await db
      .select({
        actualQuantity: tables.workOrders.actualQuantity,
      })
      .from(tables.workOrders)
      .where(eq(tables.workOrders.id, workOrderId))
      .limit(1);

    const producedQuantity = Number(woResult[0]?.actualQuantity) || 0;

    // 4. Calculate totals
    const totalCost = Math.round((materialCost + laborCost + overheadCost) * 10000) / 10000;
    const unitCost = producedQuantity > 0
      ? Math.round((totalCost / producedQuantity) * 10000) / 10000
      : null;

    return {
      workOrderId,
      materialCost: Math.round(materialCost * 10000) / 10000,
      laborCost: Math.round(laborCost * 10000) / 10000,
      overheadCost: Math.round(overheadCost * 10000) / 10000,
      totalCost,
      unitCost,
    };
  });
}

/**
 * Get production cost summary for a work order (detailed view)
 */
export async function getWorkOrderCostSummary(workOrderId: number): Promise<{
  workOrder: { id: number; woNumber: string; productCode: string; productName: string; producedQty: number | null };
  materials: { itemCode: string; itemName: string; quantity: number; unitCost: number; totalCost: number }[];
  operations: { sequence: number; workCenterCode: string; actualHours: number | null; laborCost: number | null; overheadCost: number | null }[];
  summary: ProductionCostSummary;
} | null> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    // Get work order details
    const woResult = await db
      .select({
        id: tables.workOrders.id,
        woNumber: tables.workOrders.woNumber,
        productId: tables.workOrders.productId,
        actualQuantity: tables.workOrders.actualQuantity,
        productCode: tables.items.code,
        productName: tables.items.nameTh,
      })
      .from(tables.workOrders)
      .leftJoin(tables.items, eq(tables.workOrders.productId, tables.items.id))
      .where(eq(tables.workOrders.id, workOrderId))
      .limit(1);

    if (woResult.length === 0) {
      return null;
    }

    const wo = woResult[0];

    // Get materials with costs
    const materialsResult = await db
      .select({
        itemCode: tables.items.code,
        itemName: tables.items.nameTh,
        quantity: tables.workOrderMaterials.actualQuantity,
        unitCost: tables.workOrderMaterials.unitCost,
        itemWac: tables.items.currentWAC,
      })
      .from(tables.workOrderMaterials)
      .leftJoin(tables.items, eq(tables.workOrderMaterials.itemId, tables.items.id))
      .where(eq(tables.workOrderMaterials.workOrderId, workOrderId));

    const materials = materialsResult.map((m: typeof materialsResult[0]) => {
      const qty = Number(m.quantity) || 0;
      const cost = Number(m.unitCost) || Number(m.itemWac) || 0;
      return {
        itemCode: m.itemCode || '',
        itemName: m.itemName || '',
        quantity: qty,
        unitCost: cost,
        totalCost: Math.round(qty * cost * 10000) / 10000,
      };
    });

    // Get operations with costs
    const operationsResult = await db
      .select({
        sequence: tables.workOrderOperations.sequence,
        workCenterCode: tables.workCenters.code,
        actualHours: tables.workOrderOperations.actualHours,
        laborCost: tables.workOrderOperations.laborCost,
        overheadCost: tables.workOrderOperations.overheadCost,
      })
      .from(tables.workOrderOperations)
      .leftJoin(tables.workCenters, eq(tables.workOrderOperations.workCenterId, tables.workCenters.id))
      .where(eq(tables.workOrderOperations.workOrderId, workOrderId))
      .orderBy(asc(tables.workOrderOperations.sequence));

    const operations = operationsResult.map((o: typeof operationsResult[0]) => ({
      sequence: o.sequence,
      workCenterCode: o.workCenterCode || '',
      actualHours: o.actualHours !== null ? Number(o.actualHours) : null,
      laborCost: o.laborCost !== null ? Number(o.laborCost) : null,
      overheadCost: o.overheadCost !== null ? Number(o.overheadCost) : null,
    }));

    // Calculate summary
    const summary = await calculateWorkOrderCost(workOrderId);

    return {
      workOrder: {
        id: wo.id,
        woNumber: wo.woNumber,
        productCode: wo.productCode || '',
        productName: wo.productName || '',
        producedQty: wo.actualQuantity !== null ? Number(wo.actualQuantity) : null,
      },
      materials,
      operations,
      summary,
    };
  });
}

/**
 * Update finished goods WAC after work order completion
 *
 * This is called when a work order is completed to:
 * 1. Calculate the production unit cost
 * 2. Update the finished goods item's WAC using the production transaction
 * 3. Update the item's lastProductionCost and lastProductionDate
 *
 * @param workOrderId - The completed work order
 * @param userId - User performing the action
 * @returns Updated WAC for the finished goods item
 */
export async function updateFinishedGoodsWAC(
  workOrderId: number,
  userId: number
): Promise<RecalculateWACResult | null> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    // 1. Get work order with product info
    const woResult = await db
      .select({
        id: tables.workOrders.id,
        woNumber: tables.workOrders.woNumber,
        productId: tables.workOrders.productId,
        actualQuantity: tables.workOrders.actualQuantity,
      })
      .from(tables.workOrders)
      .where(eq(tables.workOrders.id, workOrderId))
      .limit(1);

    if (woResult.length === 0) {
      throw new Error(`Work order ${workOrderId} not found`);
    }

    const wo = woResult[0];
    const producedQty = Number(wo.actualQuantity) || 0;

    if (producedQty <= 0) {
      // No output recorded, skip WAC update
      return null;
    }

    // 2. Calculate production cost
    const costSummary = await calculateWorkOrderCost(workOrderId);

    if (costSummary.unitCost === null) {
      return null;
    }

    // 3. Update work order costs record
    await upsertWorkOrderCost({
      workOrderId,
      materialCost: costSummary.materialCost,
      laborCost: costSummary.laborCost,
      overheadCost: costSummary.overheadCost,
      totalCost: costSummary.totalCost,
      producedQuantity: producedQty,
      unitCost: costSummary.unitCost,
      status: 'completed',
      completedAt: getTodayStr(),
    });

    // 4. Update finished goods WAC via recalculateWAC
    // Note: Production adds to inventory, so we use positive quantity
    const wacResult = await recalculateWAC({
      itemId: wo.productId,
      transactionType: 'receipt', // Production receipt
      transactionId: workOrderId,
      quantity: producedQty,
      unitCost: costSummary.unitCost,
      transactionDate: getTodayStr(),
      notes: `Production from WO: ${wo.woNumber}`,
      createdBy: userId,
    });

    // 5. Update last production info
    await updateItemLastProduction(wo.productId, costSummary.unitCost, workOrderId);

    return wacResult;
  });
}

// ============================================
// DASHBOARD & REPORTS (US7)
// ============================================

/**
 * Get dashboard KPIs for cost management overview
 */
export async function getCostDashboardKPIs(): Promise<CostDashboardKPIs> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    // Get inventory value from items table
    const inventoryResult = await db
      .select({
        totalValue: sql<number>`SUM(COALESCE(${tables.items.onHandCost}, 0))`,
      })
      .from(tables.items)
      .where(eq(tables.items.isActive, true));
    const inventoryValue = Number(inventoryResult[0]?.totalValue) || 0;

    // Get WIP value from open work orders
    const wipResult = await db
      .select({
        totalWIP: sql<number>`SUM(COALESCE(${tables.workOrderCosts.totalCost}, 0))`,
      })
      .from(tables.workOrderCosts)
      .innerJoin(tables.workOrders, eq(tables.workOrderCosts.workOrderId, tables.workOrders.id))
      .where(inArray(tables.workOrders.status, ['draft', 'in_progress']));
    const wipValue = Number(wipResult[0]?.totalWIP) || 0;

    // Calculate gross margin from recent sales (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const marginResult = await db
      .select({
        totalRevenue: sql<number>`SUM(${tables.salesOrderLines.quantity} * ${tables.salesOrderLines.unitPrice})`,
        totalCost: sql<number>`SUM(COALESCE(${tables.salesOrderLines.totalCost}, 0))`,
      })
      .from(tables.salesOrderLines)
      .innerJoin(tables.salesOrders, eq(tables.salesOrderLines.soId, tables.salesOrders.id))
      .where(gte(tables.salesOrders.createdAt, toQueryDate(thirtyDaysAgoStr)));

    const totalRevenue = Number(marginResult[0]?.totalRevenue) || 0;
    const totalCost = Number(marginResult[0]?.totalCost) || 0;
    const grossMarginPercent = totalRevenue > 0
      ? Math.round(((totalRevenue - totalCost) / totalRevenue) * 10000) / 100
      : 0;

    // Get top cost increases (items with highest WAC increase in last 30 days)
    const topCostIncreases = await getTopCostIncreases(5);

    // Get top margin erosion (items with declining margins)
    const topMarginErosion = await getTopMarginErosion(5);

    // Get cost trend (last 6 months)
    const costTrend = await getCostTrend(6);

    return {
      inventoryValue,
      inventoryValueChange: 0, // Would require historical comparison
      wipValue,
      wipValueChange: 0, // Would require historical comparison
      avgMaterialCostChange: 0, // Would require historical comparison
      grossMarginPercent,
      grossMarginPercentPrior: 0, // Would require historical comparison
      favorableVariance: 0, // Calculated from production variances
      unfavorableVariance: 0, // Calculated from production variances
      topCostIncreases,
      topMarginErosion,
      costTrend,
    };
  });
}

/**
 * Get items with the highest cost increases
 */
export async function getTopCostIncreases(limit: number = 5): Promise<ItemCostChange[]> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();

    // Get items with cost layer history
    // Compare most recent cost to average of previous costs
    const rows = await db
      .select({
        itemId: tables.items.id,
        itemCode: tables.items.code,
        itemName: tables.items.nameTh,
        currentWAC: sql<number>`(${tables.items.onHandCost} / NULLIF(${tables.items.onHand}, 0))`,
        lastCost: sql<number>`(
          SELECT c.running_wac
          FROM item_cost_layers c
          WHERE c.item_id = ${tables.items.id}
          ORDER BY c.created_at DESC
          LIMIT 1 OFFSET 1
        )`,
      })
      .from(tables.items)
      .where(and(
        eq(tables.items.isActive, true),
        gt(tables.items.onHand, 0)
      ))
      .limit(limit * 2); // Get more and filter

    const changes: ItemCostChange[] = [];
    for (const row of rows) {
      const currentCost = Number(row.currentWAC) || 0;
      const previousCost = Number(row.lastCost) || 0;
      if (previousCost > 0 && currentCost > previousCost) {
        const changePercent = Math.round(((currentCost - previousCost) / previousCost) * 10000) / 100;
        changes.push({
          itemId: row.itemId,
          itemCode: row.itemCode,
          itemName: row.itemName || row.itemCode,
          previousCost,
          currentCost,
          changePercent,
        });
      }
    }

    // Sort by change percent descending and take top N
    return changes.sort((a, b) => b.changePercent - a.changePercent).slice(0, limit);
  });
}

/**
 * Get items with declining margins
 */
export async function getTopMarginErosion(_limit: number = 5): Promise<ItemMarginChange[]> {
  // This requires sales history comparison
  // For now return empty array - would need more complex query with historical data
  return [];
}

/**
 * Get cost trend data for charts
 */
export async function getCostTrend(months: number = 6): Promise<CostTrendPoint[]> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();
    const trends: CostTrendPoint[] = [];

    // Get monthly aggregates for the last N months
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    for (let i = 0; i < months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - (months - i - 1));
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthStart = `${period}-01`;
      const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      const monthEnd = nextMonth.toISOString().split('T')[0];

      // Get average costs from cost layers created in this month
      const costResult = await db
        .select({
          avgCost: sql<number>`AVG(${tables.itemCostLayers.unitCost})`,
        })
        .from(tables.itemCostLayers)
        .where(and(
          gte(tables.itemCostLayers.createdAt, toQueryDate(monthStart)),
          lt(tables.itemCostLayers.createdAt, toQueryDate(monthEnd))
        ));

      trends.push({
        period,
        avgMaterialCost: Number(costResult[0]?.avgCost) || 0,
        avgProductionCost: 0, // Would need production cost aggregation
        avgGrossMargin: 0, // Would need sales margin aggregation
      });
    }

    return trends;
  });
}

/**
 * Get cost summary report with filters
 */
export async function getCostSummaryReport(filters: {
  itemType?: string;
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ data: ItemCostSummaryRow[]; total: number }> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 50;
    const offset = (page - 1) * pageSize;

    // Build conditions
    const conditions = [eq(tables.items.isActive, true)];
    if (filters.itemType) {
      conditions.push(eq(tables.items.type, filters.itemType));
    }
    if (filters.category) {
      conditions.push(eq(tables.items.category, filters.category));
    }
    if (filters.search) {
      conditions.push(
        sql`(${tables.items.code} LIKE ${`%${filters.search}%`} OR ${tables.items.nameTh} LIKE ${`%${filters.search}%`})`
      );
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await db
      .select({ count: count() })
      .from(tables.items)
      .where(whereClause);
    const total = Number(countResult[0]?.count) || 0;

    // Get data with pagination
    const rows = await db
      .select({
        itemId: tables.items.id,
        itemCode: tables.items.code,
        itemName: tables.items.nameTh,
        itemType: tables.items.type,
        category: tables.items.category,
        uom: tables.items.primaryUnit,
        onHand: tables.items.onHand,
        onHandCost: tables.items.onHandCost,
        standardCost: tables.items.standardCost,
        lastPurchaseCost: tables.items.lastPurchaseCost,
        lastPurchaseDate: tables.items.lastPurchaseDate,
        lastProductionCost: tables.items.lastProductionCost,
        lastProductionDate: tables.items.lastProductionDate,
      })
      .from(tables.items)
      .where(whereClause)
      .orderBy(tables.items.code)
      .limit(pageSize)
      .offset(offset);

    const data: ItemCostSummaryRow[] = rows.map((row: typeof rows[number]) => {
      const onHand = Number(row.onHand) || 0;
      const onHandCost = Number(row.onHandCost) || 0;
      const currentWAC = onHand > 0 ? Math.round((onHandCost / onHand) * 10000) / 10000 : null;
      const fullCost = currentWAC !== null ? Math.round(currentWAC * 1.1 * 10000) / 10000 : null;

      return {
        itemId: row.itemId,
        itemCode: row.itemCode,
        itemName: row.itemName || row.itemCode,
        itemType: row.itemType as ItemCostSummaryRow['itemType'],
        categoryName: null, // Would need join to categories
        uom: row.uom,
        onHand,
        currentWAC,
        onHandValue: onHandCost,
        standardCost: row.standardCost ? Number(row.standardCost) : null,
        lastPurchaseCost: row.lastPurchaseCost ? Number(row.lastPurchaseCost) : null,
        lastPurchaseDate: row.lastPurchaseDate ? formatDateFromDb(row.lastPurchaseDate) : null,
        lastProductionCost: row.lastProductionCost ? Number(row.lastProductionCost) : null,
        lastProductionDate: row.lastProductionDate ? formatDateFromDb(row.lastProductionDate) : null,
        fullCost,
      };
    });

    return { data, total };
  });
}

/**
 * Get production cost report
 */
export async function getProductionCostReport(filters: {
  dateFrom?: string;
  dateTo?: string;
  itemId?: number;
  status?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ data: ProductionCostRow[]; total: number }> {
  return executeDbOperation(async (db) => {
    const tables = getUnitCostTables();
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 50;
    const offset = (page - 1) * pageSize;

    // Build conditions
    const conditions = [];
    if (filters.dateFrom) {
      conditions.push(gte(tables.workOrders.createdAt, toQueryDate(filters.dateFrom)));
    }
    if (filters.dateTo) {
      conditions.push(lte(tables.workOrders.createdAt, toQueryDate(filters.dateTo)));
    }
    if (filters.itemId) {
      conditions.push(eq(tables.workOrders.productId, filters.itemId));
    }
    if (filters.status) {
      conditions.push(eq(tables.workOrders.status, filters.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: count() })
      .from(tables.workOrders)
      .leftJoin(tables.workOrderCosts, eq(tables.workOrders.id, tables.workOrderCosts.workOrderId))
      .where(whereClause);
    const total = Number(countResult[0]?.count) || 0;

    // Get data
    const rows = await db
      .select({
        workOrderId: tables.workOrders.id,
        workOrderNumber: tables.workOrders.woNumber,
        itemId: tables.workOrders.productId,
        itemCode: tables.items.code,
        itemName: tables.items.nameTh,
        plannedQty: tables.workOrders.plannedQty,
        producedQty: tables.workOrders.producedQty,
        completedDate: tables.workOrders.completedDate,
        status: tables.workOrders.status,
        materialCost: tables.workOrderCosts.materialCost,
        laborCost: tables.workOrderCosts.laborCost,
        overheadCost: tables.workOrderCosts.overheadCost,
        totalCost: tables.workOrderCosts.totalCost,
        unitCost: tables.workOrderCosts.unitCost,
        standardCost: tables.items.standardCost,
      })
      .from(tables.workOrders)
      .innerJoin(tables.items, eq(tables.workOrders.productId, tables.items.id))
      .leftJoin(tables.workOrderCosts, eq(tables.workOrders.id, tables.workOrderCosts.workOrderId))
      .where(whereClause)
      .orderBy(desc(tables.workOrders.createdAt))
      .limit(pageSize)
      .offset(offset);

    const data: ProductionCostRow[] = rows.map((row: typeof rows[number]) => {
      const materialCost = Number(row.materialCost) || 0;
      const laborCost = Number(row.laborCost) || 0;
      const overheadCost = Number(row.overheadCost) || 0;
      const totalCost = Number(row.totalCost) || (materialCost + laborCost + overheadCost);
      const unitCost = row.unitCost ? Number(row.unitCost) : null;
      const standardCost = row.standardCost ? Number(row.standardCost) : null;

      let varianceAmount: number | null = null;
      let variancePercent: number | null = null;
      if (unitCost !== null && standardCost !== null && standardCost > 0) {
        varianceAmount = Math.round((unitCost - standardCost) * 10000) / 10000;
        variancePercent = Math.round((varianceAmount / standardCost) * 10000) / 100;
      }

      return {
        workOrderId: row.workOrderId,
        workOrderNumber: row.workOrderNumber,
        itemId: row.itemId,
        itemCode: row.itemCode,
        itemName: row.itemName || row.itemCode,
        plannedQty: Number(row.plannedQty) || 0,
        producedQty: row.producedQty ? Number(row.producedQty) : null,
        completedDate: row.completedDate ? formatDateFromDb(row.completedDate) : null,
        materialCost,
        laborCost,
        overheadCost,
        totalCost,
        unitCost,
        standardUnitCost: standardCost,
        varianceAmount,
        variancePercent,
        status: row.status,
      };
    });

    return { data, total };
  });
}

// ============================================
// EXECUTIVE DASHBOARD - KPI VALUE HELPER
// ============================================

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

    const totalInventory = invByCat.reduce((sum: number, r: typeof invByCat[number]) => sum + Number(r.value || 0), 0);
    const inventoryByCategory = invByCat.map((r: typeof invByCat[number]) => ({
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

    const purchasesBySupplier = bySupplier.map((r: typeof bySupplier[number]) => ({
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

    const byWorkCenter = byWC.map((r: typeof byWC[number]) => ({
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

    const marginByCategory = byCategory.map((r: typeof byCategory[number]) => {
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

    const topMarginProducts = topProducts.map((r: typeof topProducts[number]) => {
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

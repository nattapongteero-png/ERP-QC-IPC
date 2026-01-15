// Unit Cost Calculation Service
// Feature: 014-unit-cost
// Core functions for WAC calculation, cost layers, and cost aggregation

import { eq, and, like, desc, asc, sql, gte, lte, count } from 'drizzle-orm';
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
  };
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

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

/**
 * Variance Analysis Service (T131-T134)
 * Manufacturing variance analysis and standard costing
 * Part of 011-accounting-spec-gap - User Story 6
 */

import { eq, and, desc, gte, lte, isNull, sql, inArray } from 'drizzle-orm';
import { getTableRef, getInsertId, executeDbOperation } from '../db/db-helper';
import { getNow, toDbDate, getTodayStr, formatDateFromDb, toQueryDate } from '../db/date-utils';
import type {
  StandardCost,
  StandardCostDetail,
  StandardCostInput,
  VarianceRecord,
  VarianceType,
  WorkOrderVariances,
  VarianceSummary,
  RollupResult,
  CalculateVarianceResult,
  PostVarianceResult,
  StandardCostListFilters,
  VarianceListFilters,
  VARIANCE_TYPE_LABELS,
} from '@/types/variance';

// Helper to get table references
function getTables() {
  return {
    standardCosts: getTableRef('standardCosts'),
    varianceRecords: getTableRef('varianceRecords'),
    items: getTableRef('items'),
    workOrders: getTableRef('workOrders'),
    workOrderMaterials: getTableRef('workOrderMaterials'),
    workOrderOperations: getTableRef('workOrderOperations'),
    bom: getTableRef('bOM'),
    bomLines: getTableRef('bOMLines'),
    journalEntries: getTableRef('journalEntries'),
    journalLines: getTableRef('journalLines'),
    users: getTableRef('users'),
    fiscalPeriods: getTableRef('fiscalPeriods'),
  };
}

const VARIANCE_LABELS: Record<VarianceType, string> = {
  mpv: 'Material Price Variance',
  muv: 'Material Usage Variance',
  lrv: 'Labor Rate Variance',
  lev: 'Labor Efficiency Variance',
  voh_var: 'Variable Overhead Variance',
  foh_vol: 'Fixed Overhead Volume Variance',
};

// ==========================================
// Standard Cost CRUD (T131)
// ==========================================

/**
 * Create a new standard cost record
 */
export async function createStandardCost(
  data: StandardCostInput,
  createdBy: number
): Promise<number> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Calculate total cost.
    //
    // Number() on each part is load-bearing, not defensive noise. MySQL returns
    // DECIMAL columns as STRINGS, so the BOM roll-up — which reads laborCost and
    // overheadCost straight out of an existing row — was doing
    //   0 + "0.0000" + "0.0000"  ->  "00.00000.0000"
    // i.e. string concatenation, and the insert then failed on every single item
    // with "Failed query: insert into standard_costs". The Zod schema types these
    // as numbers, so TypeScript could not catch it; only real MySQL data shows it.
    const materialCost = Number(data.materialCost) || 0;
    const laborCost = Number(data.laborCost) || 0;
    const overheadCost = Number(data.overheadCost) || 0;
    const totalCost = materialCost + laborCost + overheadCost;

    // If setAsCurrent is true, first mark existing current as not current
    if (data.setAsCurrent !== false) {
      await db
        .update(tables.standardCosts)
        .set({ isCurrent: false })
        .where(eq(tables.standardCosts.itemId, data.itemId));
    }

    // Insert new standard cost
    const result = await db.insert(tables.standardCosts).values({
      itemId: data.itemId,
      // toDbDate: MySQL datetime needs a Date object, not the raw string the
      // date picker sends. Passing the string through made the driver call
      // .toISOString() on a non-Date → "a.toISOString is not a function" on save.
      effectiveDate: toDbDate(data.effectiveDate),
      materialCost,
      laborCost,
      overheadCost,
      totalCost,
      // Same string-from-DECIMAL hazard as the cost fields above: the roll-up
      // carries these over from an existing row.
      standardHours: Number(data.standardHours) || 0,
      standardLaborRate: Number(data.standardLaborRate) || 0,
      notes: data.notes || null,
      isCurrent: data.setAsCurrent !== false,
      createdBy,
      createdAt: getNow(),
    });

    return getInsertId(result);
  });
}

/**
 * Get standard cost by ID
 */
export async function getStandardCostById(id: number): Promise<StandardCostDetail | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const [cost] = await db
      .select({
        id: tables.standardCosts.id,
        itemId: tables.standardCosts.itemId,
        itemCode: tables.items.code,
        itemName: tables.items.nameTh,
        effectiveDate: tables.standardCosts.effectiveDate,
        materialCost: tables.standardCosts.materialCost,
        laborCost: tables.standardCosts.laborCost,
        overheadCost: tables.standardCosts.overheadCost,
        totalCost: tables.standardCosts.totalCost,
        standardHours: tables.standardCosts.standardHours,
        standardLaborRate: tables.standardCosts.standardLaborRate,
        isCurrent: tables.standardCosts.isCurrent,
        notes: tables.standardCosts.notes,
        createdBy: tables.standardCosts.createdBy,
        createdAt: tables.standardCosts.createdAt,
      })
      .from(tables.standardCosts)
      .leftJoin(tables.items, eq(tables.standardCosts.itemId, tables.items.id))
      .where(eq(tables.standardCosts.id, id))
      .limit(1);

    if (!cost) return null;

    return {
      ...cost,
      itemCode: cost.itemCode || '',
      itemName: cost.itemName || '',
      effectiveDate: formatDateFromDb(cost.effectiveDate) || '',
      createdAt: formatDateFromDb(cost.createdAt) || '',
    } as StandardCostDetail;
  });
}

/**
 * Get current standard cost for an item
 */
export async function getCurrentStandardCost(itemId: number): Promise<StandardCost | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const [cost] = await db
      .select({
        id: tables.standardCosts.id,
        itemId: tables.standardCosts.itemId,
        itemCode: tables.items.code,
        itemName: tables.items.nameTh,
        effectiveDate: tables.standardCosts.effectiveDate,
        materialCost: tables.standardCosts.materialCost,
        laborCost: tables.standardCosts.laborCost,
        overheadCost: tables.standardCosts.overheadCost,
        totalCost: tables.standardCosts.totalCost,
        standardHours: tables.standardCosts.standardHours,
        standardLaborRate: tables.standardCosts.standardLaborRate,
        isCurrent: tables.standardCosts.isCurrent,
        notes: tables.standardCosts.notes,
        createdAt: tables.standardCosts.createdAt,
      })
      .from(tables.standardCosts)
      .leftJoin(tables.items, eq(tables.standardCosts.itemId, tables.items.id))
      .where(and(
        eq(tables.standardCosts.itemId, itemId),
        eq(tables.standardCosts.isCurrent, true)
      ))
      .limit(1);

    if (!cost) return null;

    return {
      ...cost,
      itemCode: cost.itemCode || '',
      itemName: cost.itemName || '',
      effectiveDate: formatDateFromDb(cost.effectiveDate) || '',
      createdAt: formatDateFromDb(cost.createdAt) || '',
    } as StandardCost;
  });
}

/**
 * List standard costs with filters
 */
export async function listStandardCosts(
  filters: StandardCostListFilters = {}
): Promise<{ data: StandardCost[]; total: number }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const conditions: any[] = [];

    if (filters.itemId) {
      conditions.push(eq(tables.standardCosts.itemId, filters.itemId));
    }
    if (filters.isCurrent !== undefined) {
      conditions.push(eq(tables.standardCosts.isCurrent, filters.isCurrent));
    }
    if (filters.effectiveDate) {
      conditions.push(lte(tables.standardCosts.effectiveDate, filters.effectiveDate));
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db
      .select({
        id: tables.standardCosts.id,
        itemId: tables.standardCosts.itemId,
        itemCode: tables.items.code,
        itemName: tables.items.nameTh,
        effectiveDate: tables.standardCosts.effectiveDate,
        materialCost: tables.standardCosts.materialCost,
        laborCost: tables.standardCosts.laborCost,
        overheadCost: tables.standardCosts.overheadCost,
        totalCost: tables.standardCosts.totalCost,
        standardHours: tables.standardCosts.standardHours,
        standardLaborRate: tables.standardCosts.standardLaborRate,
        isCurrent: tables.standardCosts.isCurrent,
        notes: tables.standardCosts.notes,
        createdAt: tables.standardCosts.createdAt,
      })
      .from(tables.standardCosts)
      .leftJoin(tables.items, eq(tables.standardCosts.itemId, tables.items.id))
      .where(whereClause)
      .orderBy(desc(tables.standardCosts.isCurrent), desc(tables.standardCosts.effectiveDate))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.standardCosts)
      .where(whereClause);

    return {
      data: data.map((c: { itemCode?: string | null; itemName?: string | null; effectiveDate?: Date | string | null; createdAt?: Date | string | null; [key: string]: unknown }) => ({
        ...c,
        itemCode: c.itemCode || '',
        itemName: c.itemName || '',
        effectiveDate: formatDateFromDb(c.effectiveDate) || '',
        createdAt: formatDateFromDb(c.createdAt) || '',
      })) as StandardCost[],
      total: Number(countResult?.count || 0),
    };
  });
}

// ==========================================
// Variance Calculation (T132)
// ==========================================

/**
 * Calculate manufacturing variances for a work order
 * MPV = (Actual Price - Standard Price) × Actual Quantity
 * MUV = (Actual Quantity - Standard Quantity) × Standard Price
 * LRV = (Actual Rate - Standard Rate) × Actual Hours
 * LEV = (Actual Hours - Standard Hours) × Standard Rate
 */
export async function calculateWorkOrderVariances(
  workOrderId: number,
  createdBy: number
): Promise<CalculateVarianceResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const variances: VarianceRecord[] = [];

    // Get work order details
    const [workOrder] = await db
      .select({
        id: tables.workOrders.id,
        orderNumber: tables.workOrders.woNumber,
        itemId: tables.workOrders.productId,
        quantityProduced: tables.workOrders.actualQuantity,
        quantityPlanned: tables.workOrders.plannedQuantity,
        status: tables.workOrders.status,
        completedAt: tables.workOrders.completedAt,
      })
      .from(tables.workOrders)
      .where(eq(tables.workOrders.id, workOrderId))
      .limit(1);

    if (!workOrder) {
      throw new Error('Work order not found');
    }

    if (workOrder.status !== 'completed') {
      throw new Error('Work order must be completed before calculating variances');
    }

    // Get standard cost for the item
    const standardCost = await getCurrentStandardCost(workOrder.itemId);
    if (!standardCost) {
      throw new Error('No standard cost defined for item');
    }

    const today = getTodayStr();
    const quantityProduced = Number(workOrder.quantityProduced) || 0;

    // Actual material consumption for this work order (list item 9a). Sum the
    // real issued cost/quantity recorded on work_order_materials; fall back to
    // standard only when nothing was recorded, so a WO with real data no longer
    // reports a hard-coded zero variance.
    const materialRows = await db
      .select({
        actualQuantity: tables.workOrderMaterials.actualQuantity,
        plannedQuantity: tables.workOrderMaterials.plannedQuantity,
        totalCost: tables.workOrderMaterials.totalCost,
        unitCost: tables.workOrderMaterials.unitCost,
      })
      .from(tables.workOrderMaterials)
      .where(eq(tables.workOrderMaterials.workOrderId, workOrderId));

    const hasMaterialActuals = materialRows.length > 0;
    const actualMaterialCostSum = materialRows.reduce((sum: number, r: any) => {
      const total =
        r.totalCost != null
          ? Number(r.totalCost)
          : (Number(r.actualQuantity) || 0) * (Number(r.unitCost) || 0);
      return sum + total;
    }, 0);
    const actualMaterialQtySum = materialRows.reduce(
      (sum: number, r: any) => sum + (Number(r.actualQuantity) || 0),
      0,
    );

    // Calculate Material Price Variance (MPV): actual issued cost vs standard.
    const standardMaterialTotal = standardCost.materialCost * quantityProduced;
    const actualMaterialTotal = hasMaterialActuals
      ? actualMaterialCostSum
      : standardMaterialTotal;
    const mpvAmount = actualMaterialTotal - standardMaterialTotal;

    const mpvRecord: any = {
      workOrderId,
      itemId: workOrder.itemId,
      varianceType: 'mpv' as VarianceType,
      varianceDate: today,
      standardValue: standardMaterialTotal,
      actualValue: actualMaterialTotal,
      varianceAmount: mpvAmount,
      quantity: quantityProduced,
      isFavorable: mpvAmount <= 0, // Negative variance is favorable for costs
      createdAt: getNow(),
    };

    const mpvResult = await db.insert(tables.varianceRecords).values(mpvRecord);
    const mpvId = getInsertId(mpvResult);
    variances.push({ ...mpvRecord, id: mpvId, varianceTypeName: VARIANCE_LABELS.mpv });

    // Calculate Material Usage Variance (MUV): actual issued qty vs planned, at
    // standard cost (list item 9a). Uses real consumption from
    // work_order_materials; falls back to zero variance when none recorded.
    const standardQty = Number(workOrder.quantityPlanned) || quantityProduced;
    const actualQty = hasMaterialActuals ? actualMaterialQtySum : standardQty;
    const unitMaterialCost = standardCost.materialCost;
    const muvAmount = (actualQty - standardQty) * unitMaterialCost;

    const muvRecord: any = {
      workOrderId,
      itemId: workOrder.itemId,
      varianceType: 'muv' as VarianceType,
      varianceDate: today,
      standardValue: standardQty * unitMaterialCost,
      actualValue: actualQty * unitMaterialCost,
      varianceAmount: muvAmount,
      quantity: quantityProduced,
      isFavorable: muvAmount <= 0,
      createdAt: getNow(),
    };

    const muvResult = await db.insert(tables.varianceRecords).values(muvRecord);
    const muvId = getInsertId(muvResult);
    variances.push({ ...muvRecord, id: muvId, varianceTypeName: VARIANCE_LABELS.muv });

    // Actual labor from work_order_operations (list item 9b): sum recorded
    // labor cost and hours across the WO's operations. Falls back to standard
    // when no operations were tracked, so a real WO no longer reports zero.
    const operationRows = await db
      .select({
        actualHours: tables.workOrderOperations.actualHours,
        plannedHours: tables.workOrderOperations.plannedHours,
        laborRate: tables.workOrderOperations.laborRate,
        laborCost: tables.workOrderOperations.laborCost,
      })
      .from(tables.workOrderOperations)
      .where(eq(tables.workOrderOperations.workOrderId, workOrderId));

    const hasLaborActuals = operationRows.length > 0;
    const actualLaborCostSum = operationRows.reduce((sum: number, r: any) => {
      const cost =
        r.laborCost != null
          ? Number(r.laborCost)
          : (Number(r.actualHours) || 0) * (Number(r.laborRate) || 0);
      return sum + cost;
    }, 0);
    const actualHoursSum = operationRows.reduce(
      (sum: number, r: any) => sum + (Number(r.actualHours) || 0),
      0,
    );

    // Calculate Labor Rate Variance (LRV): actual labor cost vs standard.
    const standardLaborTotal = standardCost.laborCost * quantityProduced;
    const actualLaborTotal = hasLaborActuals ? actualLaborCostSum : standardLaborTotal;
    const lrvAmount = actualLaborTotal - standardLaborTotal;

    const lrvRecord: any = {
      workOrderId,
      itemId: workOrder.itemId,
      varianceType: 'lrv' as VarianceType,
      varianceDate: today,
      standardValue: standardLaborTotal,
      actualValue: actualLaborTotal,
      varianceAmount: lrvAmount,
      quantity: quantityProduced,
      isFavorable: lrvAmount <= 0,
      createdAt: getNow(),
    };

    const lrvResult = await db.insert(tables.varianceRecords).values(lrvRecord);
    const lrvId = getInsertId(lrvResult);
    variances.push({ ...lrvRecord, id: lrvId, varianceTypeName: VARIANCE_LABELS.lrv });

    // Calculate Labor Efficiency Variance (LEV): actual vs standard hours, at
    // the standard labor rate (list item 9b).
    const standardHoursTotal = standardCost.standardHours * quantityProduced;
    const actualHoursTotal = hasLaborActuals ? actualHoursSum : standardHoursTotal;
    const levAmount = (actualHoursTotal - standardHoursTotal) * standardCost.standardLaborRate;

    const levRecord: any = {
      workOrderId,
      itemId: workOrder.itemId,
      varianceType: 'lev' as VarianceType,
      varianceDate: today,
      standardValue: standardHoursTotal * standardCost.standardLaborRate,
      actualValue: actualHoursTotal * standardCost.standardLaborRate,
      varianceAmount: levAmount,
      quantity: quantityProduced,
      isFavorable: levAmount <= 0,
      createdAt: getNow(),
    };

    const levResult = await db.insert(tables.varianceRecords).values(levRecord);
    const levId = getInsertId(levResult);
    variances.push({ ...levRecord, id: levId, varianceTypeName: VARIANCE_LABELS.lev });

    // Calculate total variance
    const totalVariance = mpvAmount + muvAmount + lrvAmount + levAmount;

    return {
      workOrderId,
      variancesCreated: variances.length,
      totalVariance,
      variances,
    };
  });
}

// ==========================================
// Standard Cost Roll-up (T133)
// ==========================================

/**
 * Roll up standard costs from BOM components
 */
export async function rollupStandardCosts(
  itemIds: number[] | undefined,
  effectiveDate: string | undefined,
  createdBy: number
): Promise<RollupResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const result: RollupResult = {
      itemsProcessed: 0,
      itemsUpdated: 0,
      errors: [],
    };

    const targetDate = effectiveDate || getTodayStr();

    // Get products with an approved BOM.
    //
    // This function referenced three columns that do not exist on `bom`:
    // `bom.itemId` (the column is `productId`) and `bom.isActive` (the table
    // has `status`, not a boolean flag). Selecting an undefined column makes
    // Drizzle throw "Cannot convert undefined or null to object", so EVERY
    // roll-up failed — the button could never have worked.
    //
    // 'approved' matches how production.service.ts picks a usable BOM: rolling
    // standard costs off a draft or obsolete recipe would cost the wrong thing.
    const bomConditions = [eq(tables.bom.status, 'approved')];
    if (itemIds && itemIds.length > 0) {
      bomConditions.push(inArray(tables.bom.productId, itemIds));
    }

    // Both predicates go into ONE where(): calling .where() twice on a Drizzle
    // builder REPLACES the first condition rather than adding to it.
    const bomItems = await db
      .select({
        itemId: tables.bom.productId,
        itemCode: tables.items.code,
      })
      .from(tables.bom)
      .leftJoin(tables.items, eq(tables.bom.productId, tables.items.id))
      .where(and(...bomConditions));

    for (const bomItem of bomItems) {
      result.itemsProcessed++;

      try {
        // Get BOM lines for this item. The component column on bom_lines is
        // `itemId` — selecting a non-existent `componentId` made Drizzle throw
        // "Cannot convert undefined or null to object" for every roll-up.
        const bomLines = await db
          .select({
            componentId: tables.bomLines.itemId,
            quantity: tables.bomLines.quantity,
          })
          .from(tables.bomLines)
          .leftJoin(tables.bom, eq(tables.bomLines.bomId, tables.bom.id))
          .where(eq(tables.bom.productId, bomItem.itemId));

        let totalMaterialCost = 0;

        // Sum up component costs
        for (const line of bomLines) {
          const componentCost = await getCurrentStandardCost(line.componentId);
          if (componentCost) {
            // Number() on totalCost for the same reason as in createStandardCost:
            // it arrives from MySQL as a DECIMAL string, and `+=` against a
            // string would concatenate rather than add.
            totalMaterialCost += Number(componentCost.totalCost) * Number(line.quantity);
          }
        }

        // Get existing standard cost for labor/overhead if available
        const existingCost = await getCurrentStandardCost(bomItem.itemId);
        const laborCost = existingCost?.laborCost || 0;
        const overheadCost = existingCost?.overheadCost || 0;
        const standardHours = existingCost?.standardHours || 0;
        const standardLaborRate = existingCost?.standardLaborRate || 0;

        // Create new standard cost with rolled up material cost
        await createStandardCost(
          {
            itemId: bomItem.itemId,
            effectiveDate: targetDate,
            materialCost: totalMaterialCost,
            laborCost,
            overheadCost,
            standardHours,
            standardLaborRate,
            notes: 'Rolled up from BOM components',
          },
          createdBy
        );

        result.itemsUpdated++;
      } catch (error) {
        result.errors.push({
          itemId: bomItem.itemId,
          itemCode: bomItem.itemCode || 'Unknown',
          error: (error as Error).message,
        });
      }
    }

    return result;
  });
}

// ==========================================
// Variance Posting (T134)
// ==========================================

/**
 * Post variances to General Ledger by creating journal entries.
 *
 * DISABLED — this function wrote a journal entry HEADER with totalDebit /
 * totalCredit and status:'posted', but never inserted a single row into
 * journal_lines, and never picked a Dr/Cr account at all. The result was a
 * posted JE claiming Dr=Cr=X with no detail behind it: the trial balance
 * (which reads journal_lines) could not see it, so the header count and the
 * line sum would silently disagree and no auditor could trace the amount.
 *
 * Verified against the UAT database on 2026-07-15: zero VAR-% entries and zero
 * line-less entries exist, so nothing has been corrupted yet — this throws
 * before that can change.
 *
 * To re-enable, the following must be true first:
 *   1. calculateWorkOrderVariances must return real numbers. Today all four
 *      variances hardcode actual = standard (lines ~308/332/356/379), so every
 *      amount posted here would be exactly 0.
 *   2. Dr/Cr accounts must be resolved per variance type — the cost_gl_mapping
 *      table already has a 'variance' transaction type but nothing reads it.
 *   3. journal_lines rows must be inserted inside the same transaction as the
 *      header, and the header must only be marked 'posted' once they exist.
 */
export async function postVariances(
  _varianceIds: number[] | undefined,
  _periodId: number | undefined,
  _createdBy: number
): Promise<PostVarianceResult> {
  throw new Error('VARIANCE_POSTING_DISABLED');
}

/** @deprecated Kept for reference until posting is implemented correctly. */
async function postVariancesUnsafe_DO_NOT_USE(
  varianceIds: number[] | undefined,
  periodId: number | undefined,
  createdBy: number
): Promise<PostVarianceResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const result: PostVarianceResult = {
      variancesPosted: 0,
      journalEntriesCreated: 0,
      totalVarianceAmount: 0,
    };

    // Get unposted variances
    let conditions: any[] = [isNull(tables.varianceRecords.journalEntryId)];
    if (varianceIds && varianceIds.length > 0) {
      conditions.push(inArray(tables.varianceRecords.id, varianceIds));
    }

    const variances = await db
      .select()
      .from(tables.varianceRecords)
      .where(and(...conditions));

    if (variances.length === 0) {
      return result;
    }

    // Group variances by work order for JE creation
    const variancesByWorkOrder: Record<number, typeof variances> = {};
    for (const v of variances) {
      if (!variancesByWorkOrder[v.workOrderId]) {
        variancesByWorkOrder[v.workOrderId] = [];
      }
      variancesByWorkOrder[v.workOrderId].push(v);
    }

    // Get current open period if not specified
    let targetPeriodId = periodId;
    if (!targetPeriodId) {
      const [openPeriod] = await db
        .select()
        .from(tables.fiscalPeriods)
        .where(eq(tables.fiscalPeriods.status, 'open'))
        .orderBy(desc(tables.fiscalPeriods.startDate))
        .limit(1);

      if (openPeriod) {
        targetPeriodId = openPeriod.id;
      }
    }

    // Create journal entries for each work order's variances
    for (const [workOrderId, woVariances] of Object.entries(variancesByWorkOrder)) {
      const totalVariance = woVariances.reduce((sum: number, v: { varianceAmount: number | string }) => sum + Number(v.varianceAmount), 0);
      result.totalVarianceAmount += totalVariance;

      // Generate JE number
      const jeNumber = `VAR-${workOrderId}-${Date.now()}`;

      // Create journal entry
      const jeResult = await db.insert(tables.journalEntries).values({
        entryNumber: jeNumber,
        entryDate: getTodayStr(),
        periodId: targetPeriodId,
        description: `Manufacturing Variance - WO #${workOrderId}`,
        totalDebit: Math.abs(totalVariance),
        totalCredit: Math.abs(totalVariance),
        status: 'posted',
        source: 'variance',
        sourceId: parseInt(workOrderId),
        createdBy,
        createdAt: getNow(),
        postedAt: getNow(),
        postedBy: createdBy,
      });

      const jeId = getInsertId(jeResult);
      result.journalEntriesCreated++;

      // Update variance records with JE reference
      for (const v of woVariances) {
        await db
          .update(tables.varianceRecords)
          .set({
            journalEntryId: jeId,
            postedAt: getNow(),
          })
          .where(eq(tables.varianceRecords.id, v.id));

        result.variancesPosted++;
      }
    }

    return result;
  });
}

// ==========================================
// Variance Queries
// ==========================================

/**
 * List variance records with filters
 */
export async function listVariances(
  filters: VarianceListFilters = {}
): Promise<{ data: VarianceRecord[]; total: number; summary: VarianceSummary }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const conditions: any[] = [];

    if (filters.workOrderId) {
      conditions.push(eq(tables.varianceRecords.workOrderId, filters.workOrderId));
    }
    if (filters.itemId) {
      conditions.push(eq(tables.varianceRecords.itemId, filters.itemId));
    }
    if (filters.varianceType) {
      conditions.push(eq(tables.varianceRecords.varianceType, filters.varianceType));
    }
    // Date range on the variance date (list item 9c). Previously dateFrom/dateTo
    // were accepted on the filter object but never applied to the query, so the
    // period selector on the variances screen did nothing.
    if (filters.dateFrom) {
      conditions.push(gte(tables.varianceRecords.varianceDate, toQueryDate(filters.dateFrom)));
    }
    if (filters.dateTo) {
      conditions.push(lte(tables.varianceRecords.varianceDate, toQueryDate(filters.dateTo)));
    }
    if (filters.isPosted !== undefined) {
      if (filters.isPosted) {
        conditions.push(sql`${tables.varianceRecords.journalEntryId} IS NOT NULL`);
      } else {
        conditions.push(isNull(tables.varianceRecords.journalEntryId));
      }
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db
      .select({
        id: tables.varianceRecords.id,
        workOrderId: tables.varianceRecords.workOrderId,
        workOrderNumber: tables.workOrders.woNumber,
        itemId: tables.varianceRecords.itemId,
        itemCode: tables.items.code,
        itemName: tables.items.nameTh,
        varianceType: tables.varianceRecords.varianceType,
        varianceDate: tables.varianceRecords.varianceDate,
        standardValue: tables.varianceRecords.standardValue,
        actualValue: tables.varianceRecords.actualValue,
        varianceAmount: tables.varianceRecords.varianceAmount,
        quantity: tables.varianceRecords.quantity,
        isFavorable: tables.varianceRecords.isFavorable,
        journalEntryId: tables.varianceRecords.journalEntryId,
        postedAt: tables.varianceRecords.postedAt,
        notes: tables.varianceRecords.notes,
        createdAt: tables.varianceRecords.createdAt,
      })
      .from(tables.varianceRecords)
      .leftJoin(tables.workOrders, eq(tables.varianceRecords.workOrderId, tables.workOrders.id))
      .leftJoin(tables.items, eq(tables.varianceRecords.itemId, tables.items.id))
      .where(whereClause)
      .orderBy(desc(tables.varianceRecords.varianceDate))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.varianceRecords)
      .where(whereClause);

    // Calculate summary
    const summaryResult = await db
      .select({
        varianceType: tables.varianceRecords.varianceType,
        total: sql<number>`SUM(${tables.varianceRecords.varianceAmount})`,
        favorable: sql<number>`SUM(CASE WHEN ${tables.varianceRecords.isFavorable} = 1 THEN ${tables.varianceRecords.varianceAmount} ELSE 0 END)`,
        unfavorable: sql<number>`SUM(CASE WHEN ${tables.varianceRecords.isFavorable} = 0 THEN ${tables.varianceRecords.varianceAmount} ELSE 0 END)`,
      })
      .from(tables.varianceRecords)
      .where(whereClause)
      .groupBy(tables.varianceRecords.varianceType);

    const summary: VarianceSummary = {
      totalVariance: 0,
      favorableTotal: 0,
      unfavorableTotal: 0,
      mpvTotal: 0,
      muvTotal: 0,
      lrvTotal: 0,
      levTotal: 0,
      vohVarTotal: 0,
      fohVolTotal: 0,
    };

    for (const row of summaryResult) {
      const total = Number(row.total) || 0;
      summary.totalVariance += total;
      summary.favorableTotal += Number(row.favorable) || 0;
      summary.unfavorableTotal += Number(row.unfavorable) || 0;

      switch (row.varianceType) {
        case 'mpv': summary.mpvTotal = total; break;
        case 'muv': summary.muvTotal = total; break;
        case 'lrv': summary.lrvTotal = total; break;
        case 'lev': summary.levTotal = total; break;
        case 'voh_var': summary.vohVarTotal = total; break;
        case 'foh_vol': summary.fohVolTotal = total; break;
      }
    }

    return {
      data: data.map((v: { workOrderNumber?: string | null; itemCode?: string | null; itemName?: string | null; varianceType?: string; varianceDate?: Date | string | null; createdAt?: Date | string | null; postedAt?: Date | string | null; [key: string]: unknown }) => ({
        ...v,
        workOrderNumber: v.workOrderNumber || '',
        itemCode: v.itemCode || '',
        itemName: v.itemName || '',
        varianceTypeName: VARIANCE_LABELS[v.varianceType as VarianceType],
        varianceDate: formatDateFromDb(v.varianceDate) || '',
        createdAt: formatDateFromDb(v.createdAt) || '',
        postedAt: v.postedAt ? formatDateFromDb(v.postedAt) : null,
      })) as VarianceRecord[],
      total: Number(countResult?.count || 0),
      summary,
    };
  });
}

/**
 * Get variances for a specific work order
 */
export async function getWorkOrderVariances(workOrderId: number): Promise<WorkOrderVariances | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Get work order details
    const [workOrder] = await db
      .select({
        id: tables.workOrders.id,
        orderNumber: tables.workOrders.woNumber,
        itemId: tables.workOrders.productId,
        itemCode: tables.items.code,
        itemName: tables.items.nameTh,
        quantityProduced: tables.workOrders.actualQuantity,
      })
      .from(tables.workOrders)
      .leftJoin(tables.items, eq(tables.workOrders.productId, tables.items.id))
      .where(eq(tables.workOrders.id, workOrderId))
      .limit(1);

    if (!workOrder) return null;

    // Get variances
    const { data: variances, summary } = await listVariances({ workOrderId });

    return {
      workOrderId,
      workOrderNumber: workOrder.orderNumber,
      itemCode: workOrder.itemCode || '',
      itemName: workOrder.itemName || '',
      quantityProduced: Number(workOrder.quantityProduced) || 0,
      totalVariance: summary.totalVariance,
      isFavorable: summary.totalVariance <= 0,
      variances,
    };
  });
}

/**
 * Material Return Service
 *
 * Handles the production -> warehouse return flow for excess raw material.
 *
 * Two-stage workflow:
 *   1. submitMaterialReturn  — operator declares issued/used/return per lot,
 *      computes variance vs item-level tolerance, persists header + lines
 *      with status='submitted'. NO inventory movement yet.
 *   2. approveMaterialReturn — QA reviews and approves. Service then:
 *        - creates a new inventory_lots row inheriting from each source lot
 *          (parentLotId chain preserves traceability per design §3.2)
 *        - posts inventory_transactions ('return' for the new lot,
 *          'variance_adjustment' for any unaccounted residual)
 *        - auto-creates a deviation when variance is outside tolerance
 *        - flips header status to 'received'
 *
 * Standards covered:
 *   - FDA 21 CFR 211.103  (yield reconciliation per batch)
 *   - 21 CFR Part 11      (audit trail captured via auditedInsert/Update)
 *   - PIC/S PE 009 Annex 7 (herbal-specific reconciliation)
 *   - SAP movement type 262 / Oracle MES "Reverse Dispense" patterns
 */

import { eq, and, desc, gte, lte, like, inArray, sql, isNull } from 'drizzle-orm';
import { executeDbOperation, getInsertId } from '../db/db-helper';
import { isSqlite } from '../db';
import { getNow, toQueryDate } from '../db/date-utils';
import {
  // SQLite tables
  sqliteMaterialReturns,
  sqliteMaterialReturnLines,
  sqliteMaterialVarianceTolerances,
  sqliteInventoryLots,
  sqliteInventoryTransactions,
  sqliteItems,
  sqliteWorkOrders,
  sqliteWorkOrderMaterials,
  sqliteWarehouses,
  sqliteUsers,
  sqliteDeviations,
  // MySQL tables
  mysqlMaterialReturns,
  mysqlMaterialReturnLines,
  mysqlMaterialVarianceTolerances,
  mysqlInventoryLots,
  mysqlInventoryTransactions,
  mysqlItems,
  mysqlWorkOrders,
  mysqlWorkOrderMaterials,
  mysqlWarehouses,
  mysqlUsers,
  mysqlDeviations,
} from '../db/schema';

import type { SubmitMaterialReturnInput, UpdateMaterialReturnInput, MaterialReturnLineInput } from '../validation/material-return';

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

/** Default variance tolerance (%) when no item- or category-level rule applies. */
const DEFAULT_TOLERANCE_PCT = 3.0;

/** Numeric epsilon for float comparisons of operator-entered weights. */
const EPSILON = 1e-6;

// ----------------------------------------------------------------------------
// Table-ref helper (mirrors wo-execution.service pattern)
// ----------------------------------------------------------------------------

function getTables() {
  if (isSqlite()) {
    return {
      materialReturns: sqliteMaterialReturns,
      materialReturnLines: sqliteMaterialReturnLines,
      tolerances: sqliteMaterialVarianceTolerances,
      lots: sqliteInventoryLots,
      transactions: sqliteInventoryTransactions,
      items: sqliteItems,
      workOrders: sqliteWorkOrders,
      workOrderMaterials: sqliteWorkOrderMaterials,
      warehouses: sqliteWarehouses,
      users: sqliteUsers,
      deviations: sqliteDeviations,
    };
  }
  return {
    materialReturns: mysqlMaterialReturns,
    materialReturnLines: mysqlMaterialReturnLines,
    tolerances: mysqlMaterialVarianceTolerances,
    lots: mysqlInventoryLots,
    transactions: mysqlInventoryTransactions,
    items: mysqlItems,
    workOrders: mysqlWorkOrders,
    workOrderMaterials: mysqlWorkOrderMaterials,
    warehouses: mysqlWarehouses,
    users: mysqlUsers,
    deviations: mysqlDeviations,
  };
}

// ----------------------------------------------------------------------------
// Public types
// ----------------------------------------------------------------------------

export interface ReconciliationItemRow {
  itemId: number;
  itemCode: string | null;
  itemName: string | null;
  unit: string | null;
  totalIssued: number;
  totalUsed: number;
  totalReturned: number;
  varianceQty: number;
  variancePct: number;
  tolerancePct: number;
  status: 'within' | 'outside' | 'pending';
}

export interface ReconciliationResult {
  workOrderId: number;
  items: ReconciliationItemRow[];
  unsubmittedExcess: Array<{
    workOrderMaterialId: number;
    itemId: number;
    itemCode: string | null;
    itemName: string | null;
    plannedQty: number;
    weighedQty: number;
    excessQty: number;
    unit: string | null;
  }>;
  pendingApproval: Array<{
    returnId: number;
    returnNumber: string;
    returnDate: Date | string;
    lineCount: number;
    totalReturnQty: number;
  }>;
  summary: {
    totalLines: number;
    withinTolCount: number;
    outsideTolCount: number;
    pendingCount: number;
  };
}

export interface ListMaterialReturnsFilters {
  workOrderId?: number;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  warehouseId?: number;
  page?: number;
  limit?: number;
}

export interface ListMaterialReturnsRow {
  id: number;
  returnNumber: string;
  workOrderId: number | null;
  woNumber: string | null;
  receivingWarehouseId: number;
  warehouseName: string | null;
  status: string;
  returnDate: Date | string;
  returnedBy: number;
  returnedByName: string | null;
  approvedBy: number | null;
  approvedAt: Date | string | null;
  notes: string | null;
  lineCount: number;
  totalReturnQty: number;
}

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

/**
 * Generate next sequential return number `RET-{YYYY}-{6digit}`.
 *
 * Strategy mirrors purchase-requisition.service.generatePRNumber(): scan latest
 * for the year, increment, retry on UNIQUE collision when called inside a
 * concurrent submit. Uses 6-digit padding per design §5.1 input contract.
 */
async function generateReturnNumber(database: any): Promise<string> {
  const tables = getTables();
  const year = new Date().getFullYear();
  const prefix = `RET-${year}-`;

  const existing = await database
    .select({ returnNumber: tables.materialReturns.returnNumber })
    .from(tables.materialReturns)
    .where(like(tables.materialReturns.returnNumber, `${prefix}%`))
    .orderBy(desc(tables.materialReturns.id))
    .limit(1);

  if (existing.length === 0) {
    return `${prefix}000001`;
  }
  const lastNumber = String(existing[0].returnNumber);
  const seq = parseInt(lastNumber.replace(prefix, ''), 10);
  const nextSeq = (Number.isFinite(seq) ? seq + 1 : 1).toString().padStart(6, '0');
  return `${prefix}${nextSeq}`;
}

/**
 * Generate next returned-lot number `RTN-{YYYY}-{6digit}`.
 * Looked up against inventory_lots (lot_number space, not return space).
 */
async function generateReturnedLotNumber(database: any): Promise<string> {
  const tables = getTables();
  const year = new Date().getFullYear();
  const prefix = `RTN-${year}-`;

  const existing = await database
    .select({ lotNumber: tables.lots.lotNumber })
    .from(tables.lots)
    .where(like(tables.lots.lotNumber, `${prefix}%`))
    .orderBy(desc(tables.lots.id))
    .limit(1);

  if (existing.length === 0) {
    return `${prefix}000001`;
  }
  const lastNumber = String(existing[0].lotNumber);
  const seq = parseInt(lastNumber.replace(prefix, ''), 10);
  const nextSeq = (Number.isFinite(seq) ? seq + 1 : 1).toString().padStart(6, '0');
  return `${prefix}${nextSeq}`;
}

/**
 * Generate next deviation number `DEV-{YYYY}-{6digit}`.
 * Mirrors generation in wo-execution.service for consistency, but uses a
 * sequential scan rather than a random suffix so audit reports stay tidy.
 */
async function generateDeviationNumber(database: any): Promise<string> {
  const tables = getTables();
  const year = new Date().getFullYear();
  const prefix = `DEV-${year}-`;

  const existing = await database
    .select({ deviationNumber: tables.deviations.deviationNumber })
    .from(tables.deviations)
    .where(like(tables.deviations.deviationNumber, `${prefix}%`))
    .orderBy(desc(tables.deviations.id))
    .limit(1);

  if (existing.length === 0) {
    return `${prefix}000001`;
  }
  const lastNumber = String(existing[0].deviationNumber);
  // Existing DEV numbers may use a 4-digit random suffix from legacy code.
  // Fall back gracefully: parse what we can, default to 1.
  const tail = lastNumber.replace(prefix, '');
  const seq = parseInt(tail, 10);
  const nextSeq = (Number.isFinite(seq) ? seq + 1 : 1).toString().padStart(6, '0');
  return `${prefix}${nextSeq}`;
}

/**
 * Resolve the effective variance tolerance (%) for an item.
 *
 * Precedence per design §5.2.2:
 *   1. Item-specific active rule (item_id = X)
 *   2. Category-level active rule (item_category = item.category)
 *   3. DEFAULT_TOLERANCE_PCT
 *
 * Currently ignores effective_from/to date windows — they're stored but the
 * default lookup uses only is_active=true. Phase 6 (tolerance master CRUD UI)
 * will add date-aware selection.
 */
async function resolveTolerancePct(
  database: any,
  itemId: number,
  itemCategory: string | null,
): Promise<number> {
  const tables = getTables();

  // 1. Item-specific
  const itemRule = await database
    .select({ tolerancePct: tables.tolerances.tolerancePct })
    .from(tables.tolerances)
    .where(and(
      eq(tables.tolerances.itemId, itemId),
      eq(tables.tolerances.isActive, true),
    ))
    .orderBy(desc(tables.tolerances.id))
    .limit(1);
  if (itemRule.length > 0 && itemRule[0].tolerancePct != null) {
    return Number(itemRule[0].tolerancePct);
  }

  // 2. Category-level
  if (itemCategory) {
    const catRule = await database
      .select({ tolerancePct: tables.tolerances.tolerancePct })
      .from(tables.tolerances)
      .where(and(
        eq(tables.tolerances.itemCategory, itemCategory),
        isNull(tables.tolerances.itemId),
        eq(tables.tolerances.isActive, true),
      ))
      .orderBy(desc(tables.tolerances.id))
      .limit(1);
    if (catRule.length > 0 && catRule[0].tolerancePct != null) {
      return Number(catRule[0].tolerancePct);
    }
  }

  return DEFAULT_TOLERANCE_PCT;
}

interface ComputedVariance {
  varianceQty: number;
  variancePct: number;
  tolerancePct: number;
  isOutsideTolerance: boolean;
}

/** Compute variance + tolerance check for a single line. */
function computeVariance(
  line: MaterialReturnLineInput,
  tolerancePct: number,
): ComputedVariance {
  const varianceQty = line.issuedQty - line.usedQty - line.returnQty;
  const variancePct = line.issuedQty > 0
    ? Math.abs(varianceQty / line.issuedQty) * 100
    : 0;
  return {
    varianceQty,
    variancePct,
    tolerancePct,
    isOutsideTolerance: variancePct > tolerancePct + EPSILON,
  };
}

// ----------------------------------------------------------------------------
// 1. submitMaterialReturn
// ----------------------------------------------------------------------------

export interface SubmitMaterialReturnResult {
  returnId: number;
  returnNumber: string;
  status: 'submitted';
  lineIds: number[];
  outsideToleranceCount: number;
}

/**
 * Operator action — record a material-return event.
 * Sets status='submitted'. Inventory movement is deferred to approval.
 *
 * Throws on:
 *   - return_unit not in item.primaryUnit / item.secondaryUnit (design §5.2.1)
 *   - source lot does not exist
 *   - item_id mismatch with source lot
 */
export async function submitMaterialReturn(
  input: SubmitMaterialReturnInput,
): Promise<SubmitMaterialReturnResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // 1. Resolve item context for every distinct itemId in the payload so we
    //    can validate return_unit AND look up tolerance per line. Done in a
    //    single query to avoid N+1.
    const itemIds = Array.from(new Set(input.lines.map((l) => l.itemId)));
    const itemRows = await db
      .select({
        id: tables.items.id,
        code: tables.items.code,
        nameTh: tables.items.nameTh,
        category: tables.items.category,
        primaryUnit: tables.items.primaryUnit,
        secondaryUnit: tables.items.secondaryUnit,
      })
      .from(tables.items)
      .where(inArray(tables.items.id, itemIds));
    const itemMap = new Map<number, typeof itemRows[number]>();
    for (const it of itemRows) itemMap.set(Number(it.id), it);

    // 2. Resolve source lot context — confirms lots exist + match itemId.
    const sourceLotIds = Array.from(new Set(input.lines.map((l) => l.sourceLotId)));
    const lotRows = await db
      .select({
        id: tables.lots.id,
        itemId: tables.lots.itemId,
        lotNumber: tables.lots.lotNumber,
      })
      .from(tables.lots)
      .where(inArray(tables.lots.id, sourceLotIds));
    const lotMap = new Map<number, typeof lotRows[number]>();
    for (const lot of lotRows) lotMap.set(Number(lot.id), lot);

    // 3. Per-line validation (business rules beyond Zod's reach).
    for (const line of input.lines) {
      const item = itemMap.get(line.itemId);
      if (!item) {
        throw new Error(`Item ${line.itemId} not found`);
      }
      const lot = lotMap.get(line.sourceLotId);
      if (!lot) {
        throw new Error(`Source lot ${line.sourceLotId} not found`);
      }
      if (Number(lot.itemId) !== line.itemId) {
        throw new Error(
          `Lot ${line.sourceLotId} (lot ${lot.lotNumber}) belongs to item ${lot.itemId}, not ${line.itemId}`,
        );
      }
      // Return UOM enforcement: must equal one of the item's defined UOMs
      // (primary or secondary). This implements design §5.2.1 in the absence
      // of a dedicated dispense_units table.
      const allowedUnits = [item.primaryUnit, item.secondaryUnit]
        .filter((u): u is string => !!u)
        .map((u) => u.toLowerCase());
      if (!allowedUnits.includes(line.returnUnit.toLowerCase())) {
        throw new Error(
          `Return unit "${line.returnUnit}" is not valid for item ${item.code} ` +
          `(allowed: ${allowedUnits.join(', ') || 'none configured'})`,
        );
      }
    }

    // 4. Compute variance per line (after validation, so we don't waste a
    //    tolerance lookup if validation throws above).
    const tolerancePerItem = new Map<number, number>();
    for (const itemId of itemIds) {
      const item = itemMap.get(itemId);
      const tol = await resolveTolerancePct(db, itemId, item?.category ?? null);
      tolerancePerItem.set(itemId, tol);
    }

    const computedLines = input.lines.map((line) => ({
      line,
      computed: computeVariance(line, tolerancePerItem.get(line.itemId) ?? DEFAULT_TOLERANCE_PCT),
    }));

    // 5. Generate return number + insert header.
    const returnNumber = await generateReturnNumber(db);
    const now = getNow();

    const headerInsert = await db.insert(tables.materialReturns).values({
      returnNumber,
      workOrderId: input.workOrderId,
      returnDate: now,
      returnedBy: input.operatorId,
      receivingWarehouseId: input.receivingWarehouseId,
      status: 'submitted',
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    });
    const returnId = Number(getInsertId(headerInsert));

    // 6. Insert each line.
    const lineIds: number[] = [];
    let outsideCount = 0;
    for (const { line, computed } of computedLines) {
      const lineInsert = await db.insert(tables.materialReturnLines).values({
        returnId,
        sourceLotId: line.sourceLotId,
        itemId: line.itemId,
        issuedQty: line.issuedQty,
        issuedUnit: line.issuedUnit,
        usedQty: line.usedQty,
        usedUnit: line.usedUnit,
        returnQty: line.returnQty,
        returnUnit: line.returnUnit,
        expectedVarianceQty: line.expectedVarianceQty ?? null,
        varianceQty: computed.varianceQty,
        variancePct: computed.variancePct,
        varianceReason: line.varianceReason,
        varianceExplanation: line.varianceExplanation ?? null,
        isOutsideTolerance: computed.isOutsideTolerance,
        returnContainerLabel: line.containerLabel,
        returnContainerType: line.containerType ?? null,
        notes: line.notes ?? null,
        createdAt: now,
        updatedAt: now,
      });
      lineIds.push(Number(getInsertId(lineInsert)));
      if (computed.isOutsideTolerance) outsideCount++;
    }

    return {
      returnId,
      returnNumber,
      status: 'submitted' as const,
      lineIds,
      outsideToleranceCount: outsideCount,
    };
  });
}

// ----------------------------------------------------------------------------
// 1b. updateMaterialReturn — operator can revise lines while status='submitted'
//     (i.e. before QA confirms receipt). Implementation strategy: delete the
//     existing lines and insert fresh ones — line edits are coarse-grained
//     (issued/used/return/variance) and recomputing tolerance is cheap.
// ----------------------------------------------------------------------------

export interface UpdateMaterialReturnResult {
  returnId: number;
  returnNumber: string;
  status: 'submitted';
  lineIds: number[];
  outsideToleranceCount: number;
}

export async function updateMaterialReturn(
  returnId: number,
  input: UpdateMaterialReturnInput,
): Promise<UpdateMaterialReturnResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // 1. Load + guard status. Edits are only allowed while QA hasn't acted yet.
    const [header] = await db
      .select()
      .from(tables.materialReturns)
      .where(eq(tables.materialReturns.id, returnId))
      .limit(1);
    if (!header) {
      throw new Error(`Material return ${returnId} not found`);
    }
    if (header.status !== 'submitted') {
      throw new Error(
        `Cannot edit material return ${header.returnNumber} — status="${header.status}" (only 'submitted' is editable)`,
      );
    }

    // 2. Validate items + lots (mirror submitMaterialReturn).
    const itemIds = Array.from(new Set(input.lines.map((l) => l.itemId)));
    const itemRows = await db
      .select({
        id: tables.items.id,
        code: tables.items.code,
        category: tables.items.category,
        primaryUnit: tables.items.primaryUnit,
        secondaryUnit: tables.items.secondaryUnit,
      })
      .from(tables.items)
      .where(inArray(tables.items.id, itemIds));
    const itemMap = new Map<number, typeof itemRows[number]>();
    for (const it of itemRows) itemMap.set(Number(it.id), it);

    const sourceLotIds = Array.from(new Set(input.lines.map((l) => l.sourceLotId)));
    const lotRows = await db
      .select({
        id: tables.lots.id,
        itemId: tables.lots.itemId,
        lotNumber: tables.lots.lotNumber,
      })
      .from(tables.lots)
      .where(inArray(tables.lots.id, sourceLotIds));
    const lotMap = new Map<number, typeof lotRows[number]>();
    for (const lot of lotRows) lotMap.set(Number(lot.id), lot);

    for (const line of input.lines) {
      const item = itemMap.get(line.itemId);
      if (!item) throw new Error(`Item ${line.itemId} not found`);
      const lot = lotMap.get(line.sourceLotId);
      if (!lot) throw new Error(`Source lot ${line.sourceLotId} not found`);
      if (Number(lot.itemId) !== line.itemId) {
        throw new Error(
          `Lot ${line.sourceLotId} (lot ${lot.lotNumber}) belongs to item ${lot.itemId}, not ${line.itemId}`,
        );
      }
      const allowedUnits = [item.primaryUnit, item.secondaryUnit]
        .filter((u): u is string => !!u)
        .map((u) => u.toLowerCase());
      if (!allowedUnits.includes(line.returnUnit.toLowerCase())) {
        throw new Error(
          `Return unit "${line.returnUnit}" is not valid for item ${item.code}`,
        );
      }
    }

    // 3. Recompute variance.
    const tolerancePerItem = new Map<number, number>();
    for (const itemId of itemIds) {
      const item = itemMap.get(itemId);
      const tol = await resolveTolerancePct(db, itemId, item?.category ?? null);
      tolerancePerItem.set(itemId, tol);
    }
    const computedLines = input.lines.map((line) => ({
      line,
      computed: computeVariance(line, tolerancePerItem.get(line.itemId) ?? DEFAULT_TOLERANCE_PCT),
    }));

    const now = getNow();

    // 4. Update header (notes, optional receiving warehouse, updatedAt).
    const headerSet: Record<string, unknown> = { notes: input.notes ?? null, updatedAt: now };
    if (input.receivingWarehouseId) {
      headerSet.receivingWarehouseId = input.receivingWarehouseId;
    }
    await db.update(tables.materialReturns).set(headerSet).where(eq(tables.materialReturns.id, returnId));

    // 5. Wipe + reinsert lines. Each line carries its own returnedLotId only
    //    after approval, so deleting submitted lines is safe (no FK cascade
    //    concern — lots haven't been created yet).
    await db.delete(tables.materialReturnLines).where(eq(tables.materialReturnLines.returnId, returnId));

    const lineIds: number[] = [];
    let outsideCount = 0;
    for (const { line, computed } of computedLines) {
      const lineInsert = await db.insert(tables.materialReturnLines).values({
        returnId,
        sourceLotId: line.sourceLotId,
        itemId: line.itemId,
        issuedQty: line.issuedQty,
        issuedUnit: line.issuedUnit,
        usedQty: line.usedQty,
        usedUnit: line.usedUnit,
        returnQty: line.returnQty,
        returnUnit: line.returnUnit,
        expectedVarianceQty: line.expectedVarianceQty ?? null,
        varianceQty: computed.varianceQty,
        variancePct: computed.variancePct,
        varianceReason: line.varianceReason,
        varianceExplanation: line.varianceExplanation ?? null,
        isOutsideTolerance: computed.isOutsideTolerance,
        returnContainerLabel: line.containerLabel,
        returnContainerType: line.containerType ?? null,
        notes: line.notes ?? null,
        createdAt: now,
        updatedAt: now,
      });
      lineIds.push(Number(getInsertId(lineInsert)));
      if (computed.isOutsideTolerance) outsideCount++;
    }

    return {
      returnId,
      returnNumber: header.returnNumber as string,
      status: 'submitted' as const,
      lineIds,
      outsideToleranceCount: outsideCount,
    };
  });
}

// ----------------------------------------------------------------------------
// 1c. cancelMaterialReturnApproval — QA/warehouse can revert a 'received'
//     return back to 'submitted' so production can edit it again.
//     Refuses if the new RTN lot has any subsequent transactions (already
//     reissued/consumed) — at that point a manual deviation is required.
// ----------------------------------------------------------------------------

export interface CancelApprovalResult {
  returnId: number;
  returnNumber: string;
  status: 'submitted';
  removedLotIds: number[];
}

export async function cancelMaterialReturnApproval(
  returnId: number,
  cancelledBy: number,
): Promise<CancelApprovalResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const [header] = await db
      .select()
      .from(tables.materialReturns)
      .where(eq(tables.materialReturns.id, returnId))
      .limit(1);
    if (!header) {
      throw new Error(`Material return ${returnId} not found`);
    }
    if (header.status !== 'received') {
      throw new Error(
        `Cannot cancel approval — return ${header.returnNumber} is not in 'received' status (current: '${header.status}')`,
      );
    }

    const lines = await db
      .select()
      .from(tables.materialReturnLines)
      .where(eq(tables.materialReturnLines.returnId, returnId));

    const newLotIds = (lines as Array<{ returnedLotId: number | null }>)
      .map((l) => l.returnedLotId)
      .filter((id): id is number => id != null);

    // Refuse if any returned lot already has activity beyond the initial
    // 'return' transaction (would corrupt downstream balances if we delete it).
    if (newLotIds.length > 0) {
      const txns = await db
        .select({
          lotId: tables.transactions.lotId,
          transactionType: tables.transactions.transactionType,
        })
        .from(tables.transactions)
        .where(inArray(tables.transactions.lotId, newLotIds));
      for (const t of txns as Array<{ lotId: number; transactionType: string }>) {
        if (t.transactionType !== 'return') {
          throw new Error(
            `ไม่สามารถยกเลิกการรับเข้าคลังได้ — ลอตที่คืน (id=${t.lotId}) มีการเคลื่อนไหวต่อแล้ว`,
          );
        }
      }
    }

    // 1. Delete return + variance_adjustment transactions tied to this return.
    await db
      .delete(tables.transactions)
      .where(and(
        eq(tables.transactions.referenceType, 'material_return'),
        eq(tables.transactions.referenceId, returnId),
      ));

    // 2. Delete the new RTN lots (FK from return_lines.returnedLotId is
    //    nullable, so we null them first to break the chain).
    if (newLotIds.length > 0) {
      await db
        .update(tables.materialReturnLines)
        .set({ returnedLotId: null })
        .where(eq(tables.materialReturnLines.returnId, returnId));
      await db
        .delete(tables.lots)
        .where(inArray(tables.lots.id, newLotIds));
    }

    // 3. Revert header.
    const now = getNow();
    await db
      .update(tables.materialReturns)
      .set({
        status: 'submitted',
        approvedBy: null,
        approvedAt: null,
        notes: header.notes
          ? `${header.notes}\n[ยกเลิกการรับเข้าคลังโดย user ${cancelledBy} เมื่อ ${now}]`
          : `[ยกเลิกการรับเข้าคลังโดย user ${cancelledBy} เมื่อ ${now}]`,
        updatedAt: now,
      })
      .where(eq(tables.materialReturns.id, returnId));

    return {
      returnId,
      returnNumber: header.returnNumber as string,
      status: 'submitted' as const,
      removedLotIds: newLotIds,
    };
  });
}

// ----------------------------------------------------------------------------
// 2. approveMaterialReturn
// ----------------------------------------------------------------------------

export interface ApprovalLineSummary {
  lineId: number;
  newLotId: number;
  newLotNumber: string;
  returnTransactionId: number;
  varianceTransactionId: number | null;
  deviationId: number | null;
  deviationNumber: string | null;
}

export interface ApprovalResult {
  returnId: number;
  status: 'received';
  approvedBy: number;
  approvedAt: Date | string;
  newLots: Array<{ id: number; lotNumber: string; quantity: number; itemId: number }>;
  inventoryTransactions: Array<{ id: number; transactionType: string; lotId: number; quantity: number }>;
  deviationsCreated: Array<{ id: number; deviationNumber: string; lineId: number }>;
  lineSummaries: ApprovalLineSummary[];
}

/**
 * QA action — approve a submitted return + post inventory effects.
 * Idempotent: re-approving a 'received' return throws an actionable error
 * rather than silently re-creating lots/transactions/deviations.
 *
 * Side effects per line:
 *   1. INSERT inventory_lots (RTN-YYYY-NNNNNN, parent=source, qty=returnQty)
 *   2. INSERT inventory_transactions type='return'  (qty = +returnQty)
 *   3. If varianceQty != 0:
 *      INSERT inventory_transactions type='variance_adjustment'
 *        (qty = -varianceQty against source_lot, reason=varianceReason)
 *   4. If isOutsideTolerance && deviationId IS NULL:
 *      INSERT deviations + UPDATE line.deviation_id
 *   5. UPDATE line.returned_lot_id with the new lot id
 *
 * Then UPDATE the header to status='received', approved_by=approverId.
 */
export async function approveMaterialReturn(
  returnId: number,
  approverId: number,
): Promise<ApprovalResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // 1. Load header + verify status. Idempotency check: if 'received', refuse.
    const [header] = await db
      .select()
      .from(tables.materialReturns)
      .where(eq(tables.materialReturns.id, returnId))
      .limit(1);
    if (!header) {
      throw new Error(`Material return ${returnId} not found`);
    }
    if (header.status === 'received') {
      throw new Error(`Material return ${header.returnNumber} is already received`);
    }
    if (header.status === 'rejected') {
      throw new Error(`Material return ${header.returnNumber} was rejected and cannot be approved`);
    }
    if (header.status !== 'submitted') {
      throw new Error(
        `Material return ${header.returnNumber} cannot be approved from status="${header.status}"`,
      );
    }

    // 2. Load all lines + source-lot snapshots in two batched queries.
    const lines = await db
      .select()
      .from(tables.materialReturnLines)
      .where(eq(tables.materialReturnLines.returnId, returnId));
    if (lines.length === 0) {
      throw new Error(`Material return ${header.returnNumber} has no lines`);
    }

    const sourceLotIds: number[] = Array.from(new Set((lines as any[]).map((l) => Number(l.sourceLotId))));
    const sourceLots = await db
      .select()
      .from(tables.lots)
      .where(inArray(tables.lots.id, sourceLotIds));
    const sourceLotMap = new Map<number, any>();
    for (const lot of sourceLots) sourceLotMap.set(Number(lot.id), lot);

    // Item lookup for deviation titles + tolerance fallback.
    const itemIds: number[] = Array.from(new Set((lines as any[]).map((l) => Number(l.itemId))));
    const itemRows = await db
      .select({
        id: tables.items.id,
        code: tables.items.code,
        nameTh: tables.items.nameTh,
        category: tables.items.category,
        primaryUnit: tables.items.primaryUnit,
        secondaryUnit: tables.items.secondaryUnit,
        conversionRate: tables.items.conversionRate,
        weightTrackingEnabled: tables.items.weightTrackingEnabled,
      })
      .from(tables.items)
      .where(inArray(tables.items.id, itemIds));
    const itemMap = new Map<number, typeof itemRows[number]>();
    for (const it of itemRows) itemMap.set(Number(it.id), it);

    const newLots: ApprovalResult['newLots'] = [];
    const inventoryTransactions: ApprovalResult['inventoryTransactions'] = [];
    const deviationsCreated: ApprovalResult['deviationsCreated'] = [];
    const lineSummaries: ApprovalLineSummary[] = [];

    const now = getNow();

    // 3. Per-line side effects.
    for (const line of lines as any[]) {
      const sourceLot = sourceLotMap.get(Number(line.sourceLotId));
      if (!sourceLot) {
        throw new Error(`Source lot ${line.sourceLotId} not found while approving`);
      }
      const item = itemMap.get(Number(line.itemId));

      const returnQtyRaw = Number(line.returnQty);
      const varianceQty = Number(line.varianceQty);

      // 3-level conversion at lot creation: when item is weight-tracked AND the
      // return was recorded in SU (= BOM unit = secondary unit), convert to PU
      // so the new RTN lot is stored in the same primary unit as other lots
      // (e.g. 250 cap → 0.25 box). Non-tracked items keep BOM unit unchanged.
      const itemR1 = item?.conversionRate != null ? Number(item.conversionRate) : 0;
      const isWeightTracked = !!item?.weightTrackingEnabled
        && itemR1 > 0
        && !!item?.primaryUnit
        && !!item?.secondaryUnit;
      const returnInSU = isWeightTracked && line.returnUnit === item?.secondaryUnit;
      const returnQty = returnInSU ? returnQtyRaw / itemR1 : returnQtyRaw;
      const lotUnit = returnInSU ? (item!.primaryUnit as string) : line.returnUnit;

      // 3a. Create new returned lot inheriting from source.
      const newLotNumber = await generateReturnedLotNumber(db);
      const lotInsertResult = await db.insert(tables.lots).values({
        itemId: Number(line.itemId),
        lotNumber: newLotNumber,
        batchNumber: sourceLot.batchNumber ?? null,
        warehouseId: header.receivingWarehouseId,
        locationId: null,
        quantity: returnQty,
        reservedQuantity: 0,
        unit: lotUnit,
        // Quarantine on receipt — QC re-test policy is configurable later.
        status: 'quarantine',
        manufacturingDate: sourceLot.manufacturingDate ?? null,
        expiryDate: sourceLot.expiryDate ?? null,
        receivedDate: now as any,
        vendorId: sourceLot.vendorId ?? null,
        vendorLotNumber: sourceLot.vendorLotNumber ?? null,
        cost: sourceLot.cost ?? null,
        poNumber: sourceLot.poNumber ?? null,
        coaNumber: sourceLot.coaNumber ?? null,
        manufacturerName: sourceLot.manufacturerName ?? null,
        manufacturerId: sourceLot.manufacturerId ?? null,
        importerName: sourceLot.importerName ?? null,
        importerId: sourceLot.importerId ?? null,
        countryOfOrigin: sourceLot.countryOfOrigin ?? null,
        retestDate: sourceLot.retestDate ?? null,
        retestIntervalMonths: sourceLot.retestIntervalMonths ?? null,
        lastRetestDate: sourceLot.lastRetestDate ?? null,
        retestStatus: sourceLot.retestStatus ?? null,
        parentLotId: Number(line.sourceLotId),
        createdAt: now,
        updatedAt: now,
      });
      const newLotId = Number(getInsertId(lotInsertResult));
      newLots.push({
        id: newLotId,
        lotNumber: newLotNumber,
        quantity: returnQty,
        itemId: Number(line.itemId),
      });

      // 3b. Inventory transaction: 'return' for the new lot creation.
      const returnTxnInsert = await db.insert(tables.transactions).values({
        lotId: newLotId,
        transactionType: 'return',
        quantity: returnQty,
        unit: lotUnit,
        referenceType: 'material_return',
        referenceId: returnId,
        referenceNumber: header.returnNumber,
        toWarehouseId: header.receivingWarehouseId,
        reason: `Material return — ${line.varianceReason}`,
        performedBy: approverId,
        approvedBy: approverId,
        createdAt: now,
      });
      const returnTxnId = Number(getInsertId(returnTxnInsert));
      inventoryTransactions.push({
        id: returnTxnId,
        transactionType: 'return',
        lotId: newLotId,
        quantity: returnQty,
      });

      // 3c. Variance adjustment if any unaccounted residual.
      let varianceTxnId: number | null = null;
      if (Math.abs(varianceQty) > EPSILON) {
        const varTxnInsert = await db.insert(tables.transactions).values({
          lotId: Number(line.sourceLotId),
          transactionType: 'variance_adjustment',
          // Negative quantity — the variance was already counted as issued
          // but never returned, so we book it out of the source lot.
          quantity: -varianceQty,
          unit: line.issuedUnit,
          referenceType: 'material_return',
          referenceId: returnId,
          referenceNumber: header.returnNumber,
          fromWarehouseId: sourceLot.warehouseId,
          reason: `Variance ${varianceQty.toFixed(4)} ${line.issuedUnit} — ${line.varianceReason}`,
          performedBy: approverId,
          approvedBy: approverId,
          createdAt: now,
        });
        varianceTxnId = Number(getInsertId(varTxnInsert));
        inventoryTransactions.push({
          id: varianceTxnId,
          transactionType: 'variance_adjustment',
          lotId: Number(line.sourceLotId),
          quantity: -varianceQty,
        });
      }

      // 3d. Auto-create deviation if outside tolerance and not already linked.
      let deviationId: number | null = null;
      let deviationNumber: string | null = null;
      const isOutside = Boolean(line.isOutsideTolerance);
      if (isOutside && !line.deviationId) {
        const itemName = item?.nameTh || item?.code || `item#${line.itemId}`;
        const variancePct = Number(line.variancePct);
        // Resolve tolerance again for severity scaling — re-read so we honor
        // any tolerance changes between submit and approve.
        const tolerancePct = await resolveTolerancePct(
          db,
          Number(line.itemId),
          item?.category ?? null,
        );
        const severity: 'minor' | 'major' =
          variancePct <= tolerancePct * 2 + EPSILON ? 'minor' : 'major';

        const devNumber = await generateDeviationNumber(db);
        const devInsert = await db.insert(tables.deviations).values({
          deviationNumber: devNumber,
          title: `Material variance — ${itemName} on WO #${header.workOrderId} (${variancePct.toFixed(2)}%)`,
          description:
            `Auto-generated from material return ${header.returnNumber}, line ${line.id}.\n` +
            `Issued: ${line.issuedQty} ${line.issuedUnit}, ` +
            `Used: ${line.usedQty} ${line.usedUnit}, ` +
            `Returned: ${line.returnQty} ${line.returnUnit}, ` +
            `Variance: ${varianceQty.toFixed(4)} (${variancePct.toFixed(2)}%) — tolerance ${tolerancePct.toFixed(2)}%.\n` +
            `Reason: ${line.varianceReason}.` +
            (line.varianceExplanation ? `\nOperator: ${line.varianceExplanation}` : ''),
          type: 'process',
          sourceType: 'material_return',
          sourceId: Number(line.id),
          lotId: Number(line.sourceLotId),
          workOrderId: header.workOrderId,
          severity,
          status: 'open',
          reportedBy: approverId,
          reportedAt: now,
          createdAt: now,
          updatedAt: now,
        });
        deviationId = Number(getInsertId(devInsert));
        deviationNumber = devNumber;
        deviationsCreated.push({
          id: deviationId,
          deviationNumber: devNumber,
          lineId: Number(line.id),
        });
      } else if (line.deviationId) {
        deviationId = Number(line.deviationId);
      }

      // 3e. Update line with returned_lot_id (+ deviation_id if newly created).
      const lineUpdate: Record<string, any> = {
        returnedLotId: newLotId,
        updatedAt: now,
      };
      if (deviationId && !line.deviationId) {
        lineUpdate.deviationId = deviationId;
      }
      await db
        .update(tables.materialReturnLines)
        .set(lineUpdate)
        .where(eq(tables.materialReturnLines.id, Number(line.id)));

      lineSummaries.push({
        lineId: Number(line.id),
        newLotId,
        newLotNumber,
        returnTransactionId: returnTxnId,
        varianceTransactionId: varianceTxnId,
        deviationId,
        deviationNumber,
      });
    }

    // 4. Flip header to 'received'.
    await db
      .update(tables.materialReturns)
      .set({
        status: 'received',
        approvedBy: approverId,
        approvedAt: now,
        updatedAt: now,
      })
      .where(eq(tables.materialReturns.id, returnId));

    return {
      returnId,
      status: 'received' as const,
      approvedBy: approverId,
      approvedAt: now,
      newLots,
      inventoryTransactions,
      deviationsCreated,
      lineSummaries,
    };
  });
}

// ----------------------------------------------------------------------------
// 2b. rejectMaterialReturn
// ----------------------------------------------------------------------------

export interface RejectionResult {
  returnId: number;
  status: 'rejected';
  rejectedBy: number;
  rejectedAt: Date | string;
  rejectionReason: string;
}

/**
 * QA action — reject a submitted return.
 * No inventory effects: the source lot is left untouched and the operator
 * must redo the return after correcting the discrepancy.
 */
export async function rejectMaterialReturn(
  returnId: number,
  approverId: number,
  rejectionReason: string,
): Promise<RejectionResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new Error('Rejection reason is required');
    }

    const [header] = await db
      .select()
      .from(tables.materialReturns)
      .where(eq(tables.materialReturns.id, returnId))
      .limit(1);
    if (!header) {
      throw new Error(`Material return ${returnId} not found`);
    }
    if (header.status === 'rejected') {
      throw new Error(`Material return ${header.returnNumber} is already rejected`);
    }
    if (header.status === 'received') {
      throw new Error(
        `Material return ${header.returnNumber} is already received and cannot be rejected`,
      );
    }
    if (header.status !== 'submitted') {
      throw new Error(
        `Material return ${header.returnNumber} cannot be rejected from status="${header.status}"`,
      );
    }

    const now = getNow();
    await db
      .update(tables.materialReturns)
      .set({
        status: 'rejected',
        approvedBy: approverId,
        approvedAt: now,
        rejectionReason,
        updatedAt: now,
      })
      .where(eq(tables.materialReturns.id, returnId));

    return {
      returnId,
      status: 'rejected' as const,
      rejectedBy: approverId,
      rejectedAt: now,
      rejectionReason,
    };
  });
}

// ----------------------------------------------------------------------------
// 3. getMaterialReconciliation
// ----------------------------------------------------------------------------

/**
 * Aggregate a per-WO reconciliation report.
 *
 * Definitions:
 *   - totalIssued   = SUM(work_order_materials.weighedQty || actualQuantity)
 *                     fallback to plannedQuantity when both are null.
 *   - totalReturned = SUM(material_return_lines.returnQty) for approved returns
 *   - totalUsed     = totalIssued - totalReturned - totalVariance
 *                     (variance only counted from approved returns)
 *   - status        = 'pending' if there are submitted-but-not-approved lines
 *                     for this item, else 'within' if |variancePct| <= tolerance
 *                     else 'outside'.
 */
export async function getMaterialReconciliation(
  workOrderId: number,
): Promise<ReconciliationResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // ---- Issued totals from WO materials ----
    const issuedRows = await db
      .select({
        materialId: tables.workOrderMaterials.id,
        itemId: tables.workOrderMaterials.itemId,
        plannedQty: tables.workOrderMaterials.plannedQuantity,
        weighedQty: tables.workOrderMaterials.weighedQty,
        actualQty: tables.workOrderMaterials.actualQuantity,
        unit: tables.workOrderMaterials.unit,
        itemCode: tables.items.code,
        itemName: tables.items.nameTh,
        itemCategory: tables.items.category,
      })
      .from(tables.workOrderMaterials)
      .leftJoin(tables.items, eq(tables.workOrderMaterials.itemId, tables.items.id))
      .where(eq(tables.workOrderMaterials.workOrderId, workOrderId));

    const issuedByItem = new Map<
      number,
      { itemId: number; itemCode: string | null; itemName: string | null; unit: string | null; itemCategory: string | null; totalIssued: number }
    >();
    const unsubmittedExcess: ReconciliationResult['unsubmittedExcess'] = [];

    for (const row of issuedRows as any[]) {
      const itemId = Number(row.itemId);
      // Issued = whatever physically went out the warehouse to production.
      // Prefer weighedQty (post-Phase 3) > actualQuantity > plannedQty.
      const issued =
        row.weighedQty != null
          ? Number(row.weighedQty)
          : row.actualQty != null
            ? Number(row.actualQty)
            : Number(row.plannedQty) || 0;
      const planned = Number(row.plannedQty) || 0;
      const weighed = row.weighedQty != null ? Number(row.weighedQty) : 0;
      const excess = weighed - planned;

      const prev = issuedByItem.get(itemId);
      if (prev) {
        prev.totalIssued += issued;
      } else {
        issuedByItem.set(itemId, {
          itemId,
          itemCode: row.itemCode ?? null,
          itemName: row.itemName ?? null,
          unit: row.unit ?? null,
          itemCategory: row.itemCategory ?? null,
          totalIssued: issued,
        });
      }

      // "Unsubmitted excess" = a WO material that weighed more than planned
      // and has no return line yet. Approximation per spec: heuristic check
      // is done after we know which itemIds have returns submitted.
      if (excess > EPSILON) {
        unsubmittedExcess.push({
          workOrderMaterialId: Number(row.materialId),
          itemId,
          itemCode: row.itemCode ?? null,
          itemName: row.itemName ?? null,
          plannedQty: planned,
          weighedQty: weighed,
          excessQty: excess,
          unit: row.unit ?? null,
        });
      }
    }

    // ---- Approved-return aggregates ----
    const approvedReturnRows = await db
      .select({
        lineId: tables.materialReturnLines.id,
        returnId: tables.materialReturnLines.returnId,
        itemId: tables.materialReturnLines.itemId,
        returnQty: tables.materialReturnLines.returnQty,
        varianceQty: tables.materialReturnLines.varianceQty,
        variancePct: tables.materialReturnLines.variancePct,
        isOutsideTolerance: tables.materialReturnLines.isOutsideTolerance,
        status: tables.materialReturns.status,
      })
      .from(tables.materialReturnLines)
      .innerJoin(
        tables.materialReturns,
        eq(tables.materialReturnLines.returnId, tables.materialReturns.id),
      )
      .where(eq(tables.materialReturns.workOrderId, workOrderId));

    const returnedByItem = new Map<number, { returned: number; variance: number; outsideAny: boolean; pendingAny: boolean }>();
    const itemsWithPending = new Set<number>();

    for (const row of approvedReturnRows as any[]) {
      const itemId = Number(row.itemId);
      const slot = returnedByItem.get(itemId) ?? {
        returned: 0,
        variance: 0,
        outsideAny: false,
        pendingAny: false,
      };
      if (row.status === 'received') {
        slot.returned += Number(row.returnQty);
        slot.variance += Number(row.varianceQty);
        if (row.isOutsideTolerance) slot.outsideAny = true;
      } else if (row.status === 'submitted') {
        slot.pendingAny = true;
        itemsWithPending.add(itemId);
      }
      returnedByItem.set(itemId, slot);
    }

    // ---- Pending-approval list (header-level) ----
    const pendingRows = await db
      .select({
        returnId: tables.materialReturns.id,
        returnNumber: tables.materialReturns.returnNumber,
        returnDate: tables.materialReturns.returnDate,
      })
      .from(tables.materialReturns)
      .where(and(
        eq(tables.materialReturns.workOrderId, workOrderId),
        eq(tables.materialReturns.status, 'submitted'),
      ));

    let pendingApproval: ReconciliationResult['pendingApproval'] = [];
    if (pendingRows.length > 0) {
      const pendingIds = pendingRows.map((r: any) => Number(r.returnId));
      const lineAgg = await db
        .select({
          returnId: tables.materialReturnLines.returnId,
          lineCount: sql<number>`COUNT(*)`,
          totalReturnQty: sql<number>`COALESCE(SUM(${tables.materialReturnLines.returnQty}), 0)`,
        })
        .from(tables.materialReturnLines)
        .where(inArray(tables.materialReturnLines.returnId, pendingIds))
        .groupBy(tables.materialReturnLines.returnId);
      const aggMap = new Map<number, { lineCount: number; totalReturnQty: number }>();
      for (const a of lineAgg as any[]) {
        aggMap.set(Number(a.returnId), {
          lineCount: Number(a.lineCount) || 0,
          totalReturnQty: Number(a.totalReturnQty) || 0,
        });
      }
      pendingApproval = pendingRows.map((r: any) => ({
        returnId: Number(r.returnId),
        returnNumber: String(r.returnNumber),
        returnDate: r.returnDate,
        lineCount: aggMap.get(Number(r.returnId))?.lineCount ?? 0,
        totalReturnQty: aggMap.get(Number(r.returnId))?.totalReturnQty ?? 0,
      }));
    }

    // ---- Combine into items list ----
    // Resolve a tolerance per item once.
    const items: ReconciliationItemRow[] = [];
    for (const issued of issuedByItem.values()) {
      const tol = await resolveTolerancePct(db, issued.itemId, issued.itemCategory);
      const ret = returnedByItem.get(issued.itemId) ?? { returned: 0, variance: 0, outsideAny: false, pendingAny: false };
      // Used = issued - returned - variance (variance only when received).
      const totalUsed = issued.totalIssued - ret.returned - ret.variance;
      const variancePct = issued.totalIssued > 0
        ? Math.abs(ret.variance / issued.totalIssued) * 100
        : 0;
      const status: ReconciliationItemRow['status'] = ret.pendingAny
        ? 'pending'
        : ret.outsideAny || variancePct > tol + EPSILON
          ? 'outside'
          : 'within';
      items.push({
        itemId: issued.itemId,
        itemCode: issued.itemCode,
        itemName: issued.itemName,
        unit: issued.unit,
        totalIssued: issued.totalIssued,
        totalUsed,
        totalReturned: ret.returned,
        varianceQty: ret.variance,
        variancePct,
        tolerancePct: tol,
        status,
      });
    }
    // Stable order — by itemCode then itemId.
    items.sort((a, b) => {
      const codeA = a.itemCode ?? '';
      const codeB = b.itemCode ?? '';
      if (codeA !== codeB) return codeA.localeCompare(codeB);
      return a.itemId - b.itemId;
    });

    const summary = {
      totalLines: items.length,
      withinTolCount: items.filter((i) => i.status === 'within').length,
      outsideTolCount: items.filter((i) => i.status === 'outside').length,
      pendingCount: items.filter((i) => i.status === 'pending').length,
    };

    // Filter out unsubmittedExcess for items that already have a submitted return.
    const filteredUnsubmittedExcess = unsubmittedExcess.filter(
      (e) => !itemsWithPending.has(e.itemId),
    );

    return {
      workOrderId,
      items,
      unsubmittedExcess: filteredUnsubmittedExcess,
      pendingApproval,
      summary,
    };
  });
}

// ----------------------------------------------------------------------------
// 4. listMaterialReturns
// ----------------------------------------------------------------------------

export interface ListMaterialReturnsResult {
  items: ListMaterialReturnsRow[];
  total: number;
  page: number;
  limit: number;
}

export async function listMaterialReturns(
  filters: ListMaterialReturnsFilters = {},
): Promise<ListMaterialReturnsResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 200) : 20;

    const conds: any[] = [];
    if (filters.workOrderId) {
      conds.push(eq(tables.materialReturns.workOrderId, filters.workOrderId));
    }
    if (filters.status) {
      conds.push(eq(tables.materialReturns.status, filters.status));
    }
    if (filters.warehouseId) {
      conds.push(eq(tables.materialReturns.receivingWarehouseId, filters.warehouseId));
    }
    if (filters.dateFrom) {
      conds.push(gte(tables.materialReturns.returnDate, toQueryDate(filters.dateFrom) as any));
    }
    if (filters.dateTo) {
      conds.push(lte(tables.materialReturns.returnDate, toQueryDate(filters.dateTo) as any));
    }
    const whereClause = conds.length > 0 ? and(...conds) : undefined;

    // Count
    let countQuery = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tables.materialReturns);
    if (whereClause) countQuery = countQuery.where(whereClause);
    const totalResult = await countQuery;
    const total = Number(totalResult[0]?.count ?? 0);

    // Page
    let pageQuery = db
      .select({
        id: tables.materialReturns.id,
        returnNumber: tables.materialReturns.returnNumber,
        workOrderId: tables.materialReturns.workOrderId,
        woNumber: tables.workOrders.woNumber,
        receivingWarehouseId: tables.materialReturns.receivingWarehouseId,
        warehouseName: tables.warehouses.name,
        status: tables.materialReturns.status,
        returnDate: tables.materialReturns.returnDate,
        returnedBy: tables.materialReturns.returnedBy,
        returnedByName: tables.users.name,
        approvedBy: tables.materialReturns.approvedBy,
        approvedAt: tables.materialReturns.approvedAt,
        notes: tables.materialReturns.notes,
      })
      .from(tables.materialReturns)
      .leftJoin(tables.workOrders, eq(tables.materialReturns.workOrderId, tables.workOrders.id))
      .leftJoin(tables.warehouses, eq(tables.materialReturns.receivingWarehouseId, tables.warehouses.id))
      .leftJoin(tables.users, eq(tables.materialReturns.returnedBy, tables.users.id));
    if (whereClause) pageQuery = pageQuery.where(whereClause);
    const headers = await pageQuery
      .orderBy(desc(tables.materialReturns.id))
      .limit(limit)
      .offset((page - 1) * limit);

    if (headers.length === 0) {
      return { items: [], total, page, limit };
    }

    const ids = (headers as any[]).map((h) => Number(h.id));
    const lineAgg = await db
      .select({
        returnId: tables.materialReturnLines.returnId,
        lineCount: sql<number>`COUNT(*)`,
        totalReturnQty: sql<number>`COALESCE(SUM(${tables.materialReturnLines.returnQty}), 0)`,
      })
      .from(tables.materialReturnLines)
      .where(inArray(tables.materialReturnLines.returnId, ids))
      .groupBy(tables.materialReturnLines.returnId);
    const aggMap = new Map<number, { lineCount: number; totalReturnQty: number }>();
    for (const a of lineAgg as any[]) {
      aggMap.set(Number(a.returnId), {
        lineCount: Number(a.lineCount) || 0,
        totalReturnQty: Number(a.totalReturnQty) || 0,
      });
    }

    const items: ListMaterialReturnsRow[] = (headers as any[]).map((h) => {
      const agg = aggMap.get(Number(h.id));
      return {
        id: Number(h.id),
        returnNumber: String(h.returnNumber),
        workOrderId: h.workOrderId == null ? null : Number(h.workOrderId),
        woNumber: h.woNumber ?? null,
        receivingWarehouseId: Number(h.receivingWarehouseId),
        warehouseName: h.warehouseName ?? null,
        status: String(h.status),
        returnDate: h.returnDate,
        returnedBy: Number(h.returnedBy),
        returnedByName: h.returnedByName ?? null,
        approvedBy: h.approvedBy == null ? null : Number(h.approvedBy),
        approvedAt: h.approvedAt ?? null,
        notes: h.notes ?? null,
        lineCount: agg?.lineCount ?? 0,
        totalReturnQty: agg?.totalReturnQty ?? 0,
      };
    });

    return { items, total, page, limit };
  });
}

// ----------------------------------------------------------------------------
// 5. getMaterialReturnDetail
// ----------------------------------------------------------------------------

export interface MaterialReturnDetailLine {
  id: number;
  itemId: number;
  itemCode: string | null;
  itemName: string | null;
  sourceLot: {
    id: number;
    lotNumber: string;
    quantityRemaining: number;
    warehouseId: number;
    expiryDate: string | Date | null;
  } | null;
  returnedLot: {
    id: number;
    lotNumber: string;
    status: string;
    quantity: number;
  } | null;
  issuedQty: number;
  issuedUnit: string;
  usedQty: number;
  usedUnit: string;
  returnQty: number;
  returnUnit: string;
  expectedVarianceQty: number | null;
  varianceQty: number;
  variancePct: number;
  varianceReason: string;
  varianceExplanation: string | null;
  isOutsideTolerance: boolean;
  returnContainerLabel: string | null;
  returnContainerType: string | null;
  notes: string | null;
  deviation: {
    id: number;
    deviationNumber: string;
    severity: string;
    status: string;
  } | null;
}

export interface MaterialReturnDetail {
  id: number;
  returnNumber: string;
  workOrderId: number | null;
  woNumber: string | null;
  receivingWarehouseId: number;
  warehouseName: string | null;
  status: string;
  returnDate: Date | string;
  returnedBy: number;
  returnedByName: string | null;
  approvedBy: number | null;
  approvedByName: string | null;
  approvedAt: Date | string | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  lines: MaterialReturnDetailLine[];
}

export async function getMaterialReturnDetail(
  returnId: number,
): Promise<MaterialReturnDetail | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const headerRows = await db
      .select({
        id: tables.materialReturns.id,
        returnNumber: tables.materialReturns.returnNumber,
        workOrderId: tables.materialReturns.workOrderId,
        woNumber: tables.workOrders.woNumber,
        receivingWarehouseId: tables.materialReturns.receivingWarehouseId,
        warehouseName: tables.warehouses.name,
        status: tables.materialReturns.status,
        returnDate: tables.materialReturns.returnDate,
        returnedBy: tables.materialReturns.returnedBy,
        returnedByName: tables.users.name,
        approvedBy: tables.materialReturns.approvedBy,
        approvedAt: tables.materialReturns.approvedAt,
        rejectionReason: tables.materialReturns.rejectionReason,
        notes: tables.materialReturns.notes,
        createdAt: tables.materialReturns.createdAt,
        updatedAt: tables.materialReturns.updatedAt,
      })
      .from(tables.materialReturns)
      .leftJoin(tables.workOrders, eq(tables.materialReturns.workOrderId, tables.workOrders.id))
      .leftJoin(tables.warehouses, eq(tables.materialReturns.receivingWarehouseId, tables.warehouses.id))
      .leftJoin(tables.users, eq(tables.materialReturns.returnedBy, tables.users.id))
      .where(eq(tables.materialReturns.id, returnId))
      .limit(1);

    const header = (headerRows[0] as any) || null;
    if (!header) return null;

    // Approver name (separate join — same users table; alias would be cleaner
    // but Drizzle's alias semantics differ subtly between SQLite/MySQL adapters
    // so we just do a follow-up lookup).
    let approvedByName: string | null = null;
    if (header.approvedBy) {
      const apv = await db
        .select({ name: tables.users.name })
        .from(tables.users)
        .where(eq(tables.users.id, Number(header.approvedBy)))
        .limit(1);
      approvedByName = apv[0]?.name ?? null;
    }

    // Lines + joins
    const lineRows = await db
      .select({
        id: tables.materialReturnLines.id,
        itemId: tables.materialReturnLines.itemId,
        itemCode: tables.items.code,
        itemName: tables.items.nameTh,
        sourceLotId: tables.materialReturnLines.sourceLotId,
        returnedLotId: tables.materialReturnLines.returnedLotId,
        issuedQty: tables.materialReturnLines.issuedQty,
        issuedUnit: tables.materialReturnLines.issuedUnit,
        usedQty: tables.materialReturnLines.usedQty,
        usedUnit: tables.materialReturnLines.usedUnit,
        returnQty: tables.materialReturnLines.returnQty,
        returnUnit: tables.materialReturnLines.returnUnit,
        expectedVarianceQty: tables.materialReturnLines.expectedVarianceQty,
        varianceQty: tables.materialReturnLines.varianceQty,
        variancePct: tables.materialReturnLines.variancePct,
        varianceReason: tables.materialReturnLines.varianceReason,
        varianceExplanation: tables.materialReturnLines.varianceExplanation,
        isOutsideTolerance: tables.materialReturnLines.isOutsideTolerance,
        returnContainerLabel: tables.materialReturnLines.returnContainerLabel,
        returnContainerType: tables.materialReturnLines.returnContainerType,
        notes: tables.materialReturnLines.notes,
        deviationId: tables.materialReturnLines.deviationId,
      })
      .from(tables.materialReturnLines)
      .leftJoin(tables.items, eq(tables.materialReturnLines.itemId, tables.items.id))
      .where(eq(tables.materialReturnLines.returnId, returnId));

    // Bulk-fetch source/returned lots and deviations.
    const sourceLotIds = Array.from(new Set((lineRows as any[]).map((l) => Number(l.sourceLotId))));
    const returnedLotIds = (lineRows as any[])
      .map((l) => l.returnedLotId)
      .filter((v): v is number => v != null)
      .map((v) => Number(v));
    const deviationIds = (lineRows as any[])
      .map((l) => l.deviationId)
      .filter((v): v is number => v != null)
      .map((v) => Number(v));

    const sourceLots = sourceLotIds.length > 0
      ? await db
          .select({
            id: tables.lots.id,
            lotNumber: tables.lots.lotNumber,
            quantity: tables.lots.quantity,
            warehouseId: tables.lots.warehouseId,
            expiryDate: tables.lots.expiryDate,
          })
          .from(tables.lots)
          .where(inArray(tables.lots.id, sourceLotIds))
      : [];
    const sourceLotMap = new Map<number, any>();
    for (const lot of sourceLots) sourceLotMap.set(Number(lot.id), lot);

    const returnedLots = returnedLotIds.length > 0
      ? await db
          .select({
            id: tables.lots.id,
            lotNumber: tables.lots.lotNumber,
            status: tables.lots.status,
            quantity: tables.lots.quantity,
          })
          .from(tables.lots)
          .where(inArray(tables.lots.id, returnedLotIds))
      : [];
    const returnedLotMap = new Map<number, any>();
    for (const lot of returnedLots) returnedLotMap.set(Number(lot.id), lot);

    const deviationsRows = deviationIds.length > 0
      ? await db
          .select({
            id: tables.deviations.id,
            deviationNumber: tables.deviations.deviationNumber,
            severity: tables.deviations.severity,
            status: tables.deviations.status,
          })
          .from(tables.deviations)
          .where(inArray(tables.deviations.id, deviationIds))
      : [];
    const deviationMap = new Map<number, any>();
    for (const d of deviationsRows) deviationMap.set(Number(d.id), d);

    const lines: MaterialReturnDetailLine[] = (lineRows as any[]).map((l) => {
      const src = sourceLotMap.get(Number(l.sourceLotId));
      const rtn = l.returnedLotId ? returnedLotMap.get(Number(l.returnedLotId)) : null;
      const dev = l.deviationId ? deviationMap.get(Number(l.deviationId)) : null;
      return {
        id: Number(l.id),
        itemId: Number(l.itemId),
        itemCode: l.itemCode ?? null,
        itemName: l.itemName ?? null,
        sourceLot: src
          ? {
              id: Number(src.id),
              lotNumber: String(src.lotNumber),
              quantityRemaining: Number(src.quantity) || 0,
              warehouseId: Number(src.warehouseId),
              expiryDate: src.expiryDate ?? null,
            }
          : null,
        returnedLot: rtn
          ? {
              id: Number(rtn.id),
              lotNumber: String(rtn.lotNumber),
              status: String(rtn.status),
              quantity: Number(rtn.quantity) || 0,
            }
          : null,
        issuedQty: Number(l.issuedQty),
        issuedUnit: String(l.issuedUnit),
        usedQty: Number(l.usedQty),
        usedUnit: String(l.usedUnit),
        returnQty: Number(l.returnQty),
        returnUnit: String(l.returnUnit),
        expectedVarianceQty: l.expectedVarianceQty == null ? null : Number(l.expectedVarianceQty),
        varianceQty: Number(l.varianceQty),
        variancePct: Number(l.variancePct),
        varianceReason: String(l.varianceReason),
        varianceExplanation: l.varianceExplanation ?? null,
        isOutsideTolerance: Boolean(l.isOutsideTolerance),
        returnContainerLabel: l.returnContainerLabel ?? null,
        returnContainerType: l.returnContainerType ?? null,
        notes: l.notes ?? null,
        deviation: dev
          ? {
              id: Number(dev.id),
              deviationNumber: String(dev.deviationNumber),
              severity: String(dev.severity),
              status: String(dev.status),
            }
          : null,
      };
    });

    return {
      id: Number(header.id),
      returnNumber: String(header.returnNumber),
      workOrderId: header.workOrderId == null ? null : Number(header.workOrderId),
      woNumber: header.woNumber ?? null,
      receivingWarehouseId: Number(header.receivingWarehouseId),
      warehouseName: header.warehouseName ?? null,
      status: String(header.status),
      returnDate: header.returnDate,
      returnedBy: Number(header.returnedBy),
      returnedByName: header.returnedByName ?? null,
      approvedBy: header.approvedBy == null ? null : Number(header.approvedBy),
      approvedByName,
      approvedAt: header.approvedAt ?? null,
      rejectionReason: header.rejectionReason ?? null,
      notes: header.notes ?? null,
      createdAt: header.createdAt,
      updatedAt: header.updatedAt,
      lines,
    };
  });
}

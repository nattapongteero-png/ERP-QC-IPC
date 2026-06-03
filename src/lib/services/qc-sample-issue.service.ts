/**
 * QC Sample Issue + Retain Sample logic
 * Audit QC2 (sample stock decrement) + QC3 (retain sample warehouse + retention)
 *
 * When a QC sample is registered with `sampleQty` and/or `retainSampleQty`:
 *   1. Resolve the source lot — explicit sourceLotId, or by (productId, lotNumber).
 *   2. Decrement source lot quantity by (sampleQty + retainSampleQty).
 *   3. Insert an inventory_transactions row with transactionType='qc_sample'
 *      (for the test portion) and 'retain_sample' (for the retain portion).
 *   4. If retainSampleQty > 0:
 *        - Find/create the Retain Sample warehouse (type='retain_sample').
 *        - Create a new lot in that warehouse with quantity=retainSampleQty.
 *        - Compute retainExpiryDate = source.expiryDate + 1 year
 *          (fallback: today + 1 year).
 *   5. Return resolved lot ids + retainExpiryDate so caller can patch
 *      the qc_samples row.
 */
import { eq, and } from 'drizzle-orm';
import { isSqlite } from '../db';
import { getTableRef, executeDbOperation, getInsertId } from '../db/db-helper';
import { getNow, toDbDate, getTodayStr } from '../db/date-utils';

const RETAIN_WAREHOUSE_CODE = 'WH-RS-001';
const RETAIN_WAREHOUSE_NAME = 'Retain Sample Warehouse';
const RETAIN_WAREHOUSE_TYPE = 'retain_sample';

export interface QcIssueInput {
  sampleId: number;
  sampleNumber: string;
  productId: number;
  sourceLotId?: number | null;
  lotNumber?: string | null;
  sampleQty?: number | null;
  retainSampleQty?: number | null;
  userId: number;
}

export interface QcIssueResult {
  sourceLotId: number | null;
  sampleIssuedQty: number;
  retainLotId: number | null;
  retainQty: number;
  retainExpiryDate: string | null;
  retainWarehouseId: number | null;
}

export class QcIssueError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'QcIssueError';
  }
}

/**
 * Look up or create the Retain Sample warehouse. Exposed so callers + tests
 * can verify the side effect.
 */
export async function ensureRetainSampleWarehouse(userId?: number): Promise<{
  id: number;
  code: string;
  name: string;
  created: boolean;
}> {
  return executeDbOperation(async (db: any) => {
    const warehouses = getTableRef('warehouses');
    const [existing] = await db
      .select({ id: warehouses.id, code: warehouses.code, name: warehouses.name })
      .from(warehouses)
      .where(eq(warehouses.type, RETAIN_WAREHOUSE_TYPE))
      .limit(1);
    if (existing) {
      return { id: existing.id, code: existing.code, name: existing.name, created: false };
    }
    const values: Record<string, unknown> = {
      code: RETAIN_WAREHOUSE_CODE,
      name: RETAIN_WAREHOUSE_NAME,
      type: RETAIN_WAREHOUSE_TYPE,
      isActive: true,
    };
    if (isSqlite()) {
      const [created] = await db.insert(warehouses).values(values).returning();
      return { id: created.id, code: created.code, name: created.name, created: true };
    }
    const result = await db.insert(warehouses).values(values);
    const id = Number(getInsertId(result));
    void userId;
    return { id, code: RETAIN_WAREHOUSE_CODE, name: RETAIN_WAREHOUSE_NAME, created: true };
  });
}

/**
 * Resolve source lot from explicit id or (productId, lotNumber). Returns
 * the lot row or null.
 */
async function resolveSourceLot(
  db: any,
  input: { sourceLotId?: number | null; productId: number; lotNumber?: string | null },
) {
  const lots = getTableRef('inventoryLots');
  if (input.sourceLotId) {
    const [lot] = await db.select().from(lots).where(eq(lots.id, input.sourceLotId)).limit(1);
    return lot ?? null;
  }
  if (!input.lotNumber) return null;
  const [lot] = await db
    .select()
    .from(lots)
    .where(and(eq(lots.itemId, input.productId), eq(lots.lotNumber, input.lotNumber)))
    .limit(1);
  return lot ?? null;
}

function addYears(date: Date, years: number): Date {
  const out = new Date(date);
  out.setFullYear(out.getFullYear() + years);
  return out;
}

/**
 * Compute retainExpiryDate = max(sourceLot.expiryDate, today) + 1 year
 * per WHO TRS 986 Annex 9 (retain at least until 1 year after product
 * expiry).
 */
export function computeRetainExpiry(sourceExpiry: string | Date | null): string {
  let base: Date;
  if (sourceExpiry) {
    const candidate = sourceExpiry instanceof Date ? sourceExpiry : new Date(sourceExpiry);
    base = isNaN(candidate.getTime()) ? new Date() : candidate;
  } else {
    base = new Date();
  }
  return addYears(base, 1).toISOString().slice(0, 10);
}

export async function issueSampleFromLot(input: QcIssueInput): Promise<QcIssueResult> {
  const sampleQty = Number(input.sampleQty) > 0 ? Number(input.sampleQty) : 0;
  const retainQty = Number(input.retainSampleQty) > 0 ? Number(input.retainSampleQty) : 0;
  const totalDraw = sampleQty + retainQty;

  if (totalDraw <= 0) {
    return {
      sourceLotId: null,
      sampleIssuedQty: 0,
      retainLotId: null,
      retainQty: 0,
      retainExpiryDate: null,
      retainWarehouseId: null,
    };
  }

  return executeDbOperation(async (db: any) => {
    const lots = getTableRef('inventoryLots');
    const transactions = getTableRef('inventoryTransactions');

    const sourceLot = await resolveSourceLot(db, input);
    if (!sourceLot) {
      throw new QcIssueError(
        'SOURCE_LOT_NOT_FOUND',
        'SOURCE_LOT_NOT_FOUND: source lot not found for productId+lotNumber',
      );
    }

    const available = Number(sourceLot.quantity) - Number(sourceLot.reservedQuantity ?? 0);
    if (totalDraw > available) {
      throw new QcIssueError(
        'INSUFFICIENT_LOT_STOCK',
        `INSUFFICIENT_LOT_STOCK: source lot has ${available} ${sourceLot.unit} available, requested ${totalDraw}`,
      );
    }

    // Decrement source lot
    const newQty = Number(sourceLot.quantity) - totalDraw;
    await db.update(lots).set({ quantity: newQty, updatedAt: getNow() }).where(eq(lots.id, sourceLot.id));

    // Record inventory_transactions for sample portion
    if (sampleQty > 0) {
      await db.insert(transactions).values({
        lotId: sourceLot.id,
        transactionType: 'qc_sample',
        quantity: sampleQty,
        unit: sourceLot.unit,
        referenceType: 'QC_SAMPLE',
        referenceId: input.sampleId,
        referenceNumber: input.sampleNumber,
        fromWarehouseId: sourceLot.warehouseId,
        reason: 'QC sample drawn from lot',
        performedBy: input.userId,
        createdAt: getNow(),
      });
    }

    // Retain sample portion
    let retainLotId: number | null = null;
    let retainWarehouseId: number | null = null;
    let retainExpiryDate: string | null = null;
    if (retainQty > 0) {
      const retainWh = await ensureRetainSampleWarehouse(input.userId);
      retainWarehouseId = retainWh.id;
      retainExpiryDate = computeRetainExpiry(sourceLot.expiryDate);

      const retainLotNumber = `${sourceLot.lotNumber}-RS-${input.sampleNumber}`;
      const retainValues: Record<string, unknown> = {
        itemId: sourceLot.itemId,
        lotNumber: retainLotNumber,
        warehouseId: retainWh.id,
        quantity: retainQty,
        reservedQuantity: 0,
        unit: sourceLot.unit,
        status: 'released',
        manufacturingDate: sourceLot.manufacturingDate,
        expiryDate: toDbDate(retainExpiryDate),
        receivedDate: toDbDate(getTodayStr()),
      };
      if (isSqlite()) {
        const [retainLot] = await db.insert(lots).values(retainValues).returning();
        retainLotId = retainLot.id;
      } else {
        const result = await db.insert(lots).values(retainValues);
        retainLotId = Number(getInsertId(result));
      }

      await db.insert(transactions).values({
        lotId: retainLotId,
        transactionType: 'retain_sample',
        quantity: retainQty,
        unit: sourceLot.unit,
        referenceType: 'QC_SAMPLE',
        referenceId: input.sampleId,
        referenceNumber: input.sampleNumber,
        fromWarehouseId: sourceLot.warehouseId,
        toWarehouseId: retainWh.id,
        reason: 'Retain sample copy stored',
        performedBy: input.userId,
        createdAt: getNow(),
      });
    }

    return {
      sourceLotId: sourceLot.id,
      sampleIssuedQty: sampleQty,
      retainLotId,
      retainQty,
      retainExpiryDate,
      retainWarehouseId,
    };
  });
}

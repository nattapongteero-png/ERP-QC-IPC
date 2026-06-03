/**
 * Goods Receipt Service — GRN CRUD + state machine + line updates
 * Feature: 020-goods-receipt
 */
import { eq, and, desc, sql, gte, lte, inArray } from 'drizzle-orm';
import { executeDbOperation, getTableRef, getInsertId } from '../db/db-helper';
import { getNow, toDbDate, toQueryDate } from '../db/date-utils';
import {
  GoodsReceiptError,
  GOODS_RECEIPT_ERROR_CODES,
  GRN_LINE_TRANSITIONS,
  type ChecklistCategory,
  type CreateGrnInput,
  type GoodsReceipt,
  type GoodsReceiptLine,
  type GrnLineStatus,
  type GrnStatus,
  type UpdateGrnLineInput,
} from '@/types/goods-receipt';
import { generateGrnNumber } from './goods-receipt-numbering.service';

function getTables() {
  return {
    grns: getTableRef('goodsReceipts'),
    lines: getTableRef('goodsReceiptLines'),
    checklists: getTableRef('goodsReceiptChecklists'),
    templates: getTableRef('receiptChecklistTemplates'),
    tolerances: getTableRef('receiptTolerances'),
    po: getTableRef('purchaseOrders'),
    poLines: getTableRef('purchaseOrderLines'),
    wo: getTableRef('workOrders'),
    items: getTableRef('items'),
    vendors: getTableRef('vendors'),
    warehouses: getTableRef('warehouses'),
    users: getTableRef('users'),
    inventoryLots: getTableRef('inventoryLots'),
    qcSamples: getTableRef('qcSamples'),
    signatures: getTableRef('electronicSignatures'),
  };
}

// ============================================
// Tolerance lookups (auto-seed defaults if absent)
// ============================================

const DEFAULT_TOLERANCES: Record<ChecklistCategory, number> = {
  raw_material: 2.0,
  finished_goods: 5.0,
};

export async function getToleranceForCategory(
  category: ChecklistCategory,
): Promise<number> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const rows = await db
      .select()
      .from(t.tolerances)
      .where(eq(t.tolerances.category, category))
      .limit(1);

    if (rows.length === 0) {
      // Self-seed default
      await db.insert(t.tolerances).values({
        category,
        tolerancePercent: DEFAULT_TOLERANCES[category],
        isActive: true,
        createdAt: getNow(),
        updatedAt: getNow(),
      });
      return DEFAULT_TOLERANCES[category];
    }
    return Number(rows[0].tolerancePercent);
  });
}

// ============================================
// Create GRN from PO or WO
// ============================================

export async function createGrn(
  input: CreateGrnInput,
  receiverUserId: number,
): Promise<{ grn: GoodsReceipt; lines: GoodsReceiptLine[] }> {
  return executeDbOperation(async (db) => {
    const t = getTables();

    // Validate source
    let vendorId: number | null = null;
    let prefilledLines: Array<{
      itemId: number;
      expectedQuantity: number;
      unit: string;
      sourcePoLineId?: number | null;
      sourceWoOutputId?: number | null;
    }> = [];

    if (input.sourceType === 'po') {
      if (!input.poId)
        throw new GoodsReceiptError(GOODS_RECEIPT_ERROR_CODES.INVALID_SOURCE, 'poId required');

      const po = await db.select().from(t.po).where(eq(t.po.id, input.poId)).limit(1);
      if (po.length === 0)
        throw new GoodsReceiptError(GOODS_RECEIPT_ERROR_CODES.NOT_FOUND, 'PO not found');
      vendorId = po[0].vendorId ?? null;

      const poLines = await db
        .select()
        .from(t.poLines)
        .where(eq(t.poLines.purchaseOrderId, input.poId));

      if (poLines.length === 0)
        throw new GoodsReceiptError(GOODS_RECEIPT_ERROR_CODES.INVALID_SOURCE, 'PO has no lines');

      prefilledLines = poLines.map((pl: any) => ({
        itemId: Number(pl.itemId),
        expectedQuantity: Math.max(
          0,
          Number(pl.quantity ?? 0) - Number(pl.receivedQuantity ?? 0),
        ),
        unit: pl.unit ?? '',
        sourcePoLineId: Number(pl.id),
      }));
    } else {
      if (!input.woId)
        throw new GoodsReceiptError(GOODS_RECEIPT_ERROR_CODES.INVALID_SOURCE, 'woId required');

      const wo = await db.select().from(t.wo).where(eq(t.wo.id, input.woId)).limit(1);
      if (wo.length === 0)
        throw new GoodsReceiptError(GOODS_RECEIPT_ERROR_CODES.NOT_FOUND, 'WO not found');

      // One FG line keyed on WO product
      const productId = Number(wo[0].productId ?? wo[0].itemId ?? 0);
      if (!productId)
        throw new GoodsReceiptError(GOODS_RECEIPT_ERROR_CODES.INVALID_SOURCE, 'WO has no product');

      const expectedQty = Number(wo[0].plannedQuantity ?? wo[0].targetQuantity ?? wo[0].quantity ?? 0);
      const unit =
        wo[0].unit ?? wo[0].productUnit ?? (await db.select().from(t.items).where(eq(t.items.id, productId)).limit(1))[0]?.unit ?? 'unit';

      prefilledLines = [
        {
          itemId: productId,
          expectedQuantity: expectedQty,
          unit: String(unit),
          sourceWoOutputId: Number(wo[0].id),
        },
      ];
    }

    // Generate GRN number
    const grnNumber = await generateGrnNumber(new Date().getFullYear());

    const grnInsert = await db.insert(t.grns).values({
      grnNumber,
      sourceType: input.sourceType,
      poId: input.sourceType === 'po' ? input.poId : null,
      woId: input.sourceType === 'wo' ? input.woId : null,
      vendorId,
      warehouseId: input.warehouseId,
      status: 'in_progress',
      receiverUserId,
      receivedDate: toDbDate(input.receivedDate),
      notes: input.notes ?? null,
      createdAt: getNow(),
      updatedAt: getNow(),
    });
    const grnId = getInsertId(grnInsert);

    // Insert lines
    for (let i = 0; i < prefilledLines.length; i++) {
      const pl = prefilledLines[i];
      await db.insert(t.lines).values({
        grnId,
        lineNumber: i + 1,
        itemId: pl.itemId,
        expectedQuantity: pl.expectedQuantity,
        unit: pl.unit,
        status: 'created',
        qcSampleCreationFailed: false,
        sourcePoLineId: pl.sourcePoLineId ?? null,
        sourceWoOutputId: pl.sourceWoOutputId ?? null,
        createdAt: getNow(),
        updatedAt: getNow(),
      });
    }

    const grn = await getGrnById(grnId);
    return { grn: grn.grn, lines: grn.lines };
  });
}

// ============================================
// Update line actuals (variance calculation)
// ============================================

export async function updateGrnLine(
  lineId: number,
  patch: UpdateGrnLineInput,
  _userId: number,
): Promise<GoodsReceiptLine> {
  return executeDbOperation(async (db) => {
    const t = getTables();

    const existing = await db.select().from(t.lines).where(eq(t.lines.id, lineId)).limit(1);
    if (existing.length === 0)
      throw new GoodsReceiptError(GOODS_RECEIPT_ERROR_CODES.NOT_FOUND, 'Line not found');

    const line = existing[0];
    if (line.status !== 'created')
      throw new GoodsReceiptError(
        GOODS_RECEIPT_ERROR_CODES.INVALID_TRANSITION,
        'Line is no longer editable',
      );

    // Compute variance
    const expected = Number(line.expectedQuantity);
    const actual = patch.actualQuantity != null ? Number(patch.actualQuantity) : null;
    let varianceAmount: number | null = null;
    let variancePercent: number | null = null;

    if (actual != null && expected > 0) {
      varianceAmount = actual - expected;
      variancePercent = (varianceAmount / expected) * 100;
    }

    const updates: Record<string, unknown> = {
      updatedAt: getNow(),
    };
    if (patch.actualQuantity != null) {
      updates.actualQuantity = patch.actualQuantity;
      updates.varianceAmount = varianceAmount;
      updates.variancePercent = variancePercent;
    }
    if (patch.vendorLotNumber !== undefined) updates.vendorLotNumber = patch.vendorLotNumber;
    if (patch.batchNumber !== undefined) updates.batchNumber = patch.batchNumber;
    if (patch.manufacturingDate !== undefined)
      updates.manufacturingDate = patch.manufacturingDate ? toDbDate(patch.manufacturingDate) : null;
    if (patch.expiryDate !== undefined)
      updates.expiryDate = patch.expiryDate ? toDbDate(patch.expiryDate) : null;
    if (patch.varianceReason !== undefined) updates.varianceReason = patch.varianceReason;

    await db.update(t.lines).set(updates).where(eq(t.lines.id, lineId));

    const fresh = await db.select().from(t.lines).where(eq(t.lines.id, lineId)).limit(1);
    return fresh[0] as GoodsReceiptLine;
  });
}

// ============================================
// Validate variance against tolerance + reason
// ============================================

export async function isVarianceWithinTolerance(
  category: ChecklistCategory,
  variancePercent: number | null,
): Promise<boolean> {
  if (variancePercent == null) return true;
  const tolerance = await getToleranceForCategory(category);
  return Math.abs(variancePercent) <= tolerance;
}

// ============================================
// State transition guard
// ============================================

export function assertTransition(from: GrnLineStatus, to: GrnLineStatus): void {
  const allowed = GRN_LINE_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new GoodsReceiptError(
      GOODS_RECEIPT_ERROR_CODES.INVALID_TRANSITION,
      `Cannot transition from ${from} to ${to}`,
      { from, to, allowed },
    );
  }
}

// ============================================
// Get GRN by id (with lines)
// ============================================

export async function getGrnById(
  id: number,
): Promise<{ grn: GoodsReceipt; lines: GoodsReceiptLine[] }> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const grnRows = await db.select().from(t.grns).where(eq(t.grns.id, id)).limit(1);
    if (grnRows.length === 0)
      throw new GoodsReceiptError(GOODS_RECEIPT_ERROR_CODES.NOT_FOUND, 'GRN not found');

    const lineRows = await db
      .select()
      .from(t.lines)
      .where(eq(t.lines.grnId, id))
      .orderBy(t.lines.lineNumber);

    return {
      grn: normalizeGrn(grnRows[0]),
      lines: lineRows.map(normalizeLine),
    };
  });
}

// ============================================
// List GRNs (filterable, paginated)
// ============================================

export interface ListGrnsFilter {
  status?: GrnStatus;
  sourceType?: 'po' | 'wo';
  vendorId?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export async function listGrns(filter: ListGrnsFilter = {}): Promise<{
  items: Array<GoodsReceipt & { lineCount: number; vendorName: string | null }>;
  total: number;
  page: number;
  pageSize: number;
}> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, filter.pageSize ?? 50));
    const offset = (page - 1) * pageSize;

    const conds: any[] = [];
    if (filter.status) conds.push(eq(t.grns.status, filter.status));
    if (filter.sourceType) conds.push(eq(t.grns.sourceType, filter.sourceType));
    if (filter.vendorId) conds.push(eq(t.grns.vendorId, filter.vendorId));
    if (filter.dateFrom) conds.push(gte(t.grns.receivedDate, toQueryDate(filter.dateFrom)));
    if (filter.dateTo) conds.push(lte(t.grns.receivedDate, toQueryDate(filter.dateTo)));
    const whereExpr = conds.length > 0 ? and(...conds) : undefined;

    const rows = await db
      .select({
        id: t.grns.id,
        grnNumber: t.grns.grnNumber,
        sourceType: t.grns.sourceType,
        poId: t.grns.poId,
        woId: t.grns.woId,
        vendorId: t.grns.vendorId,
        warehouseId: t.grns.warehouseId,
        status: t.grns.status,
        receiverUserId: t.grns.receiverUserId,
        receivedDate: t.grns.receivedDate,
        notes: t.grns.notes,
        createdAt: t.grns.createdAt,
        updatedAt: t.grns.updatedAt,
        vendorName: t.vendors.name,
      })
      .from(t.grns)
      .leftJoin(t.vendors, eq(t.grns.vendorId, t.vendors.id))
      .where(whereExpr)
      .orderBy(desc(t.grns.id))
      .limit(pageSize)
      .offset(offset);

    // Line counts
    const grnIds = rows.map((r: any) => Number(r.id));
    const counts: Record<number, number> = {};
    if (grnIds.length > 0) {
      const cntRows = await db
        .select({
          grnId: t.lines.grnId,
          c: sql<number>`COUNT(*)`,
        })
        .from(t.lines)
        .where(inArray(t.lines.grnId, grnIds))
        .groupBy(t.lines.grnId);
      for (const c of cntRows) {
        counts[Number(c.grnId)] = Number(c.c);
      }
    }

    // Total
    const totalRows = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(t.grns)
      .where(whereExpr);
    const total = Number(totalRows[0]?.c ?? 0);

    return {
      items: rows.map((r: any) => ({
        ...normalizeGrn(r),
        vendorName: r.vendorName ?? null,
        lineCount: counts[Number(r.id)] ?? 0,
      })),
      total,
      page,
      pageSize,
    };
  });
}

// ============================================
// Cancel GRN (created lines only, within 24h)
// ============================================

export async function cancelGrn(
  grnId: number,
  reason: string,
  userId: number,
): Promise<void> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const grnRows = await db.select().from(t.grns).where(eq(t.grns.id, grnId)).limit(1);
    if (grnRows.length === 0)
      throw new GoodsReceiptError(GOODS_RECEIPT_ERROR_CODES.NOT_FOUND, 'GRN not found');

    const grn = grnRows[0];

    if (Number(grn.receiverUserId) !== userId)
      throw new GoodsReceiptError(
        GOODS_RECEIPT_ERROR_CODES.PERMISSION_DENIED,
        'Only original creator can cancel',
      );

    const createdAt = new Date(grn.createdAt);
    const hoursElapsed = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursElapsed > 24)
      throw new GoodsReceiptError(
        GOODS_RECEIPT_ERROR_CODES.CANCELLATION_WINDOW_EXPIRED,
        '24h window expired',
      );

    // Block if any line has progressed beyond created
    const advancedLines = await db
      .select({ id: t.lines.id })
      .from(t.lines)
      .where(
        and(eq(t.lines.grnId, grnId), sql`${t.lines.status} <> 'created'`),
      );
    if (advancedLines.length > 0)
      throw new GoodsReceiptError(
        GOODS_RECEIPT_ERROR_CODES.INVALID_TRANSITION,
        'Cannot cancel — some lines already advanced',
        { advancedLineIds: advancedLines.map((l: any) => Number(l.id)) },
      );

    await db.update(t.lines).set({ status: 'cancelled', updatedAt: getNow() }).where(eq(t.lines.grnId, grnId));
    await db
      .update(t.grns)
      .set({ status: 'cancelled', notes: reason, updatedAt: getNow() })
      .where(eq(t.grns.id, grnId));
  });
}

// ============================================
// Recompute header status from lines
// ============================================

export async function recomputeHeaderStatus(grnId: number): Promise<void> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const lines = await db.select({ status: t.lines.status }).from(t.lines).where(eq(t.lines.grnId, grnId));

    if (lines.length === 0) return;

    const statuses: string[] = lines.map((l: any) => String(l.status));
    let header: GrnStatus = 'in_progress';
    if (statuses.every((s: string) => s === 'released_to_stock')) header = 'released';
    else if (statuses.every((s: string) => s === 'rejected')) header = 'rejected';
    else if (statuses.every((s: string) => s === 'cancelled')) header = 'cancelled';
    else if (statuses.every((s: string) => ['released_to_stock', 'rejected', 'cancelled'].includes(s)))
      header = 'partially_released';

    await db.update(t.grns).set({ status: header, updatedAt: getNow() }).where(eq(t.grns.id, grnId));
  });
}

// ============================================
// Normalizers (raw DB row → domain object)
// ============================================

function normalizeGrn(row: any): GoodsReceipt {
  return {
    id: Number(row.id),
    grnNumber: String(row.grnNumber),
    sourceType: row.sourceType as 'po' | 'wo',
    poId: row.poId != null ? Number(row.poId) : null,
    woId: row.woId != null ? Number(row.woId) : null,
    vendorId: row.vendorId != null ? Number(row.vendorId) : null,
    warehouseId: Number(row.warehouseId),
    status: row.status as GrnStatus,
    receiverUserId: Number(row.receiverUserId),
    receivedDate: typeof row.receivedDate === 'string' ? row.receivedDate : new Date(row.receivedDate).toISOString().slice(0, 10),
    notes: row.notes ?? null,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(row.createdAt).toISOString(),
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date(row.updatedAt).toISOString(),
  };
}

function normalizeLine(row: any): GoodsReceiptLine {
  return {
    id: Number(row.id),
    grnId: Number(row.grnId),
    lineNumber: Number(row.lineNumber),
    itemId: Number(row.itemId),
    expectedQuantity: Number(row.expectedQuantity),
    actualQuantity: row.actualQuantity != null ? Number(row.actualQuantity) : null,
    unit: String(row.unit),
    vendorLotNumber: row.vendorLotNumber ?? null,
    batchNumber: row.batchNumber ?? null,
    manufacturingDate: row.manufacturingDate
      ? typeof row.manufacturingDate === 'string'
        ? row.manufacturingDate.slice(0, 10)
        : new Date(row.manufacturingDate).toISOString().slice(0, 10)
      : null,
    expiryDate: row.expiryDate
      ? typeof row.expiryDate === 'string'
        ? row.expiryDate.slice(0, 10)
        : new Date(row.expiryDate).toISOString().slice(0, 10)
      : null,
    varianceAmount: row.varianceAmount != null ? Number(row.varianceAmount) : null,
    variancePercent: row.variancePercent != null ? Number(row.variancePercent) : null,
    varianceReason: row.varianceReason ?? null,
    status: row.status as GrnLineStatus,
    inventoryLotId: row.inventoryLotId != null ? Number(row.inventoryLotId) : null,
    qcSampleId: row.qcSampleId != null ? Number(row.qcSampleId) : null,
    qcSampleCreationFailed: Boolean(row.qcSampleCreationFailed),
    receiverSignatureId: row.receiverSignatureId != null ? Number(row.receiverSignatureId) : null,
    qaSignatureId: row.qaSignatureId != null ? Number(row.qaSignatureId) : null,
    qaDecisionAt: row.qaDecisionAt ? String(row.qaDecisionAt) : null,
    rejectionReason: row.rejectionReason ?? null,
    sourcePoLineId: row.sourcePoLineId != null ? Number(row.sourcePoLineId) : null,
    sourceWoOutputId: row.sourceWoOutputId != null ? Number(row.sourceWoOutputId) : null,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(row.createdAt).toISOString(),
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date(row.updatedAt).toISOString(),
  };
}

/**
 * Goods Receipt Service — GRN CRUD + state machine + line updates
 * Feature: 020-goods-receipt
 */
import { eq, and, desc, sql, gte, lte, inArray } from 'drizzle-orm';
import { executeDbOperation, getTableRef, getInsertId } from '../db/db-helper';
import { getNow, toDbDate, toQueryDate, getTodayStr, formatDateFromDb } from '../db/date-utils';
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
  type GrnWorkflowStatus,
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

      // Drizzle column is `poId` (db column `po_id`) — not `purchaseOrderId`.
      // The wrong reference resolved to `undefined` and Drizzle emitted
      // SQL with an empty column name ("WHERE = ?"), failing every PO-sourced
      // GRN creation.
      const poLines = await db
        .select()
        .from(t.poLines)
        .where(eq(t.poLines.poId, input.poId));

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

/**
 * Auto-create a GRN for a source (PO approved / WO completed) — idempotent.
 *
 * Skips if a GRN already exists for the same poId/woId (so re-approving or
 * re-completing does not create duplicates). Resolves the destination
 * warehouse by type (finished_goods for WO output, raw_material for PO).
 * Best-effort: callers should wrap in try/catch so the parent action (PO
 * approval / WO completion) never fails because of GRN creation.
 */
export async function autoCreateGrnForSource(opts: {
  sourceType: 'po' | 'wo';
  poId?: number;
  woId?: number;
  userId: number;
}): Promise<{ created: boolean; grnId: number | null }> {
  const t = getTables();

  // 1. Idempotency check + resolve destination warehouse.
  const pre = await executeDbOperation(async (db) => {
    const existing = await db
      .select({ id: t.grns.id })
      .from(t.grns)
      .where(
        opts.sourceType === 'po'
          ? eq(t.grns.poId, Number(opts.poId))
          : eq(t.grns.woId, Number(opts.woId)),
      )
      .limit(1);
    if (existing.length > 0) return { existsId: Number(existing[0].id), warehouseId: null as number | null };

    // Resolve the GRN header's default warehouse by what is actually being
    // received (item 40). A WO always produces finished goods. A PO defaults to
    // raw material UNLESS its lines carry finished-goods/wip items — a Finished
    // Goods PO must land in the FG warehouse, not the raw-material default.
    let whType = 'raw_material';
    if (opts.sourceType === 'wo') {
      whType = 'finished_goods';
    } else if (opts.poId != null) {
      const poItemRows = await db
        .select({ type: t.items.type })
        .from(t.poLines)
        .leftJoin(t.items, eq(t.poLines.itemId, t.items.id))
        .where(eq(t.poLines.poId, Number(opts.poId)));
      const hasFinished = poItemRows.some((r: any) =>
        r.type === 'finished_goods' || r.type === 'wip',
      );
      if (hasFinished) whType = 'finished_goods';
    }
    let whRows = await db.select({ id: t.warehouses.id }).from(t.warehouses).where(eq(t.warehouses.type, whType)).limit(1);
    if (whRows.length === 0) {
      whRows = await db.select({ id: t.warehouses.id }).from(t.warehouses).limit(1);
    }
    return { existsId: null as number | null, warehouseId: whRows[0]?.id ?? null };
  });

  if (pre.existsId) return { created: false, grnId: pre.existsId };
  if (!pre.warehouseId) return { created: false, grnId: null };

  // 2. Create the GRN (lines prefilled from PO/WO).
  // Use local-timezone today (getTodayStr), NOT new Date().toISOString() —
  // toISOString() is UTC, so before 07:00 ICT it returns the previous day,
  // making the GRN's received date show one day early (e.g. 18th instead of 19th).
  const today = getTodayStr();
  const { grn } = await createGrn(
    {
      sourceType: opts.sourceType,
      poId: opts.sourceType === 'po' ? opts.poId : null,
      woId: opts.sourceType === 'wo' ? opts.woId : null,
      warehouseId: Number(pre.warehouseId),
      receivedDate: today,
      notes:
        opts.sourceType === 'wo'
          ? 'สร้างอัตโนมัติเมื่อปิด Work Order'
          : 'สร้างอัตโนมัติเมื่ออนุมัติใบสั่งซื้อ (PO)',
    },
    opts.userId,
  );
  return { created: true, grnId: Number(grn.id) };
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
    // Lot / batch / mfg / expiry are read off the PHYSICAL goods, which for an
    // auto-created (PO-approval) GRN arrive AFTER the line already exists — so the
    // line must stay editable through the whole receiving window, not only at
    // 'created'. Allow edits up to (but not including) QC approval; once
    // qc_approved / released / rejected the actuals are locked.
    if (!['created', 'checklist_done', 'qc_pending'].includes(line.status))
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
      .select({
        line: t.lines,
        itemCode: t.items.code,
        itemName: t.items.nameTh,
        // The actual inventory lot this line was received into (system lot
        // number + unit cost), so the GRN shows the real lot detail, not only
        // the vendor's lot number captured at receiving.
        inventoryLotNumber: t.inventoryLots.lotNumber,
        unitCost: t.inventoryLots.cost,
      })
      .from(t.lines)
      .leftJoin(t.items, eq(t.lines.itemId, t.items.id))
      .leftJoin(t.inventoryLots, eq(t.lines.inventoryLotId, t.inventoryLots.id))
      .where(eq(t.lines.grnId, id))
      .orderBy(t.lines.lineNumber);

    return {
      grn: normalizeGrn(grnRows[0]),
      lines: lineRows.map((r: any) =>
        normalizeLine({
          ...r.line,
          itemCode: r.itemCode,
          itemName: r.itemName,
          inventoryLotNumber: r.inventoryLotNumber,
          unitCost: r.unitCost,
        }),
      ),
    };
  });
}

// ============================================
// List GRNs (filterable, paginated)
// ============================================

export interface ListGrnsFilter {
  status?: GrnStatus;
  workflowStatus?: GrnWorkflowStatus;
  sourceType?: 'po' | 'wo';
  vendorId?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  // Register gate: hide PO GRNs that were auto-created at PO approval but whose
  // lines are all still 'created' (nothing actually received yet). Only PO GRNs
  // with ≥1 line advanced past 'created' (= received via the PO-receive
  // checklist) appear. WO GRNs are always shown — a WO GRN exists only once the
  // work order is closed, which is itself the receipt.
  receivedOnly?: boolean;
}

/**
 * Roll a GRN's per-line statuses up into one register-friendly workflow status.
 * Rule: the GRN sits at the stage of its LEAST-advanced still-open line, so it
 * only reads "ผ่านแล้ว" once every line is released. Terminal header states
 * (cancelled / rejected) win outright.
 */
export function deriveWorkflowStatus(
  headerStatus: string,
  stage: Record<string, number>,
): GrnWorkflowStatus {
  if (headerStatus === 'cancelled') return 'cancelled';
  const open = (s: string) => (stage[s] ?? 0) > 0;
  // Least-advanced open line dictates the stage.
  if (open('created')) return 'pending_checklist';
  if (open('checklist_done') || open('qc_pending')) return 'pending_qc';
  if (open('qc_approved')) return 'pending_qa';
  // No open earlier-stage lines left. If anything was rejected and nothing is
  // still released, surface the rejection; otherwise it's fully released.
  if (open('rejected') && !open('released_to_stock')) return 'rejected';
  if (open('released_to_stock')) return 'released';
  // No lines yet (shouldn't normally happen) — fall back to header mapping.
  return headerStatus === 'released' ? 'released' : 'pending_checklist';
}

export async function listGrns(filter: ListGrnsFilter = {}): Promise<{
  items: Array<GoodsReceipt & { lineCount: number; vendorName: string | null; woNumber: string | null; workflowStatus: GrnWorkflowStatus; canCancel: boolean }>;
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
        woNumber: t.wo.woNumber,
      })
      .from(t.grns)
      .leftJoin(t.vendors, eq(t.grns.vendorId, t.vendors.id))
      .leftJoin(t.wo, eq(t.grns.woId, t.wo.id))
      .where(whereExpr)
      .orderBy(desc(t.grns.id))
      .limit(pageSize)
      .offset(offset);

    // Line counts + how many lines have advanced past 'created'. The advanced
    // count lets the list show a Cancel button only when cancellation would
    // actually succeed (backend cancelGrn requires EVERY line still 'created').
    const grnIds = rows.map((r: any) => Number(r.id));
    const counts: Record<number, number> = {};
    const advancedCounts: Record<number, number> = {};
    // Per-GRN tally of lines at each workflow stage, used to derive a
    // register-friendly roll-up status (รอ Checklist / รอ QC / รอ QA / ผ่านแล้ว).
    const stageCounts: Record<number, Record<string, number>> = {};
    if (grnIds.length > 0) {
      const cntRows = await db
        .select({
          grnId: t.lines.grnId,
          status: t.lines.status,
          c: sql<number>`COUNT(*)`,
        })
        .from(t.lines)
        .where(inArray(t.lines.grnId, grnIds))
        .groupBy(t.lines.grnId, t.lines.status);
      for (const c of cntRows) {
        const gid = Number(c.grnId);
        const n = Number(c.c);
        counts[gid] = (counts[gid] ?? 0) + n;
        if (String(c.status) !== 'created') {
          advancedCounts[gid] = (advancedCounts[gid] ?? 0) + n;
        }
        (stageCounts[gid] ??= {})[String(c.status)] = n;
      }
    }

    // Total
    const totalRows = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(t.grns)
      .where(whereExpr);
    const total = Number(totalRows[0]?.c ?? 0);

    const CANCELLABLE_HEADER = ['in_progress'];
    let items = rows.map((r: any) => {
      const id = Number(r.id);
      const lineCount = counts[id] ?? 0;
      const advanced = advancedCounts[id] ?? 0;
      // Mirror the backend cancelGrn() guard: header still in progress,
      // has lines, and none advanced past 'created'. (Creator + 24h are
      // also enforced server-side; this just hides the obviously-invalid case.)
      const canCancel =
        CANCELLABLE_HEADER.includes(String(r.status)) && lineCount > 0 && advanced === 0;
      return {
        ...normalizeGrn(r),
        vendorName: r.vendorName ?? null,
        woNumber: r.woNumber ?? null,
        lineCount,
        workflowStatus: deriveWorkflowStatus(String(r.status), stageCounts[id] ?? {}),
        canCancel,
      };
    });

    // Register gate: hide PO GRNs with nothing received yet (all lines still
    // 'created'). A GRN line advances past 'created' only when the warehouse
    // receives it via the PO-receive checklist, so advanced>0 means "received +
    // checklist passed". WO GRNs are always kept.
    if (filter.receivedOnly) {
      items = items.filter((it: { id: number; sourceType: string }) =>
        it.sourceType === 'wo' || (advancedCounts[Number(it.id)] ?? 0) > 0,
      );
    }

    // Optional client-side filter by derived workflow status (KPI card / pill
    // bar drill-down). Done in-memory because workflowStatus is computed, not a
    // column — the dataset per page is small (≤200 rows).
    if (filter.workflowStatus) {
      items = items.filter((it: { workflowStatus: GrnWorkflowStatus }) => it.workflowStatus === filter.workflowStatus);
    }

    return {
      items,
      total: filter.workflowStatus || filter.receivedOnly ? items.length : total,
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
    // formatDateFromDb uses LOCAL date components — a plain toISOString() here
    // is UTC and shifts a DATE column back one day (shows 18th for a 19th receipt).
    receivedDate: formatDateFromDb(row.receivedDate),
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
    itemCode: row.itemCode ?? null,
    itemName: row.itemName ?? null,
    expectedQuantity: Number(row.expectedQuantity),
    actualQuantity: row.actualQuantity != null ? Number(row.actualQuantity) : null,
    sampleQuantity: row.sampleQuantity != null ? Number(row.sampleQuantity) : null,
    unit: String(row.unit),
    vendorLotNumber: row.vendorLotNumber ?? null,
    batchNumber: row.batchNumber ?? null,
    manufacturingDate: row.manufacturingDate ? formatDateFromDb(row.manufacturingDate) : null,
    expiryDate: row.expiryDate ? formatDateFromDb(row.expiryDate) : null,
    varianceAmount: row.varianceAmount != null ? Number(row.varianceAmount) : null,
    variancePercent: row.variancePercent != null ? Number(row.variancePercent) : null,
    varianceReason: row.varianceReason ?? null,
    status: row.status as GrnLineStatus,
    inventoryLotId: row.inventoryLotId != null ? Number(row.inventoryLotId) : null,
    inventoryLotNumber: row.inventoryLotNumber ?? null,
    unitCost: row.unitCost != null ? Number(row.unitCost) : null,
    qcLotId: row.qcLotId != null ? Number(row.qcLotId) : null,
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

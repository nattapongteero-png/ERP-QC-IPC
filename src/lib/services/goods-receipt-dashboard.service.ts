/**
 * Goods Receipt Dashboard Service — tile counts + pending-QA list + aging
 * Feature: 020-goods-receipt
 */
import { eq, and, sql, inArray, desc } from 'drizzle-orm';
import { executeDbOperation, getTableRef } from '../db/db-helper';
import { getTodayStr } from '../db/date-utils';
import type { IncomingDashboardCounts } from '@/types/goods-receipt';

function getTables() {
  return {
    grns: getTableRef('goodsReceipts'),
    lines: getTableRef('goodsReceiptLines'),
    inventoryLots: getTableRef('inventoryLots'),
    qcSamples: getTableRef('qcSamples'),
    items: getTableRef('items'),
    vendors: getTableRef('vendors'),
    warehouses: getTableRef('warehouses'),
  };
}

export async function getDashboardCounts(): Promise<IncomingDashboardCounts> {
  return executeDbOperation(async (db) => {
    const t = getTables();

    const pendingChecklistRow = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(t.lines)
      .where(eq(t.lines.status, 'created'));
    const pendingQaRow = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(t.lines)
      .where(eq(t.lines.status, 'qc_approved'));

    // Inspection outcomes — passed = QC approved or already released to stock;
    // rejected = QC rejected the incoming line.
    const passedRow = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(t.lines)
      .where(inArray(t.lines.status, ['qc_approved', 'released_to_stock']));
    const rejectedRow = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(t.lines)
      .where(eq(t.lines.status, 'rejected'));

    const today = getTodayStr();
    const releasedTodayRow = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(t.lines)
      .where(
        and(
          eq(t.lines.status, 'released_to_stock'),
          sql`DATE(${t.lines.qaDecisionAt}) = ${today}`,
        ),
      );

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const quarantineAgingRow = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(t.inventoryLots)
      .where(
        and(
          eq(t.inventoryLots.status, 'quarantine'),
          sql`DATE(${t.inventoryLots.receivedDate}) <= ${fourteenDaysAgo}`,
        ),
      );

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 19);
    const staleQcRow = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(t.qcSamples)
      .where(
        and(
          inArray(t.qcSamples.status, ['registered', 'testing']),
          sql`${t.qcSamples.createdAt} <= ${thirtyDaysAgo}`,
        ),
      );

    return {
      pendingChecklistCount: Number(pendingChecklistRow[0]?.c ?? 0),
      pendingQaCount: Number(pendingQaRow[0]?.c ?? 0),
      passedCount: Number(passedRow[0]?.c ?? 0),
      rejectedCount: Number(rejectedRow[0]?.c ?? 0),
      releasedTodayCount: Number(releasedTodayRow[0]?.c ?? 0),
      quarantineAgingCount: Number(quarantineAgingRow[0]?.c ?? 0),
      staleQcSampleCount: Number(staleQcRow[0]?.c ?? 0),
    };
  });
}

export async function getPendingQaList(): Promise<Array<{
  grnId: number;
  grnNumber: string;
  lineId: number;
  itemCode: string;
  itemName: string;
  actualQuantity: number;
  expectedQuantity: number;
  unit: string;
  qcSampleId: number | null;
  qcSampleStatus: string | null;
  ageDays: number;
  vendorName: string | null;
}>> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const rows = await db
      .select({
        grnId: t.grns.id,
        grnNumber: t.grns.grnNumber,
        lineId: t.lines.id,
        // items table column is `code`, not `itemCode`; product name is
        // `nameTh` (with `nameEn` as the English fallback elsewhere). The
        // previous references resolved to undefined, fed into Drizzle's
        // SELECT map, and crashed with
        //   TypeError: Cannot convert undefined or null to object
        // (Object.entries inside Drizzle prepare) on every request.
        itemCode: t.items.code,
        itemName: t.items.nameTh,
        actualQuantity: t.lines.actualQuantity,
        expectedQuantity: t.lines.expectedQuantity,
        unit: t.lines.unit,
        qcSampleId: t.lines.qcSampleId,
        qcSampleStatus: t.qcSamples.status,
        lineStatus: t.lines.status,
        createdAt: t.lines.createdAt,
        vendorName: t.vendors.name,
      })
      .from(t.lines)
      .leftJoin(t.grns, eq(t.grns.id, t.lines.grnId))
      .leftJoin(t.items, eq(t.items.id, t.lines.itemId))
      .leftJoin(t.qcSamples, eq(t.qcSamples.id, t.lines.qcSampleId))
      .leftJoin(t.vendors, eq(t.vendors.id, t.grns.vendorId))
      // QC inspection queue + recent outcomes: lines awaiting the QC checklist
      // ('created'), lines awaiting the lab result ('qc_pending'), plus recently
      // inspected lines so the result (ผ่าน / ไม่ผ่าน) is visible —
      // 'qc_approved'/'released_to_stock' = passed, 'rejected' = failed.
      // Released-to-stock is excluded (already in stock).
      .where(inArray(t.lines.status, ['created', 'qc_pending', 'qc_approved', 'rejected']))
      .orderBy(desc(t.lines.id))
      .limit(200);

    return rows.map((r: any) => {
      // Map the line lifecycle to a QC outcome shown in the grid.
      const ls = String(r.lineStatus ?? '');
      const qcResult =
        ls === 'created' || ls === 'qc_pending'
          ? 'pending' // created = awaiting checklist; qc_pending = awaiting lab
          : ls === 'rejected'
            ? 'failed'
            : 'passed'; // qc_approved / released_to_stock
      return {
        grnId: Number(r.grnId),
        grnNumber: String(r.grnNumber),
        lineId: Number(r.lineId),
        itemCode: r.itemCode ?? '',
        itemName: r.itemName ?? '',
        actualQuantity: Number(r.actualQuantity ?? 0),
        expectedQuantity: Number(r.expectedQuantity ?? 0),
        unit: String(r.unit ?? ''),
        qcSampleId: r.qcSampleId != null ? Number(r.qcSampleId) : null,
        qcSampleStatus: r.qcSampleStatus ?? null,
        lineStatus: ls,
        qcResult,
        ageDays: Math.floor((Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        vendorName: r.vendorName ?? null,
      };
    });
  });
}

export async function getQuarantineAging(): Promise<{
  bands: Array<{ label: string; minDays: number; maxDays: number | null; count: number }>;
  items: Array<{
    lotId: number;
    lotNumber: string;
    itemCode: string;
    itemName: string;
    quantity: number;
    unit: string;
    ageDays: number;
    grnNumber: string | null;
    warehouseName: string;
    receivedDate: string;
  }>;
}> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const lots = await db
      .select({
        lotId: t.inventoryLots.id,
        lotNumber: t.inventoryLots.lotNumber,
        // Same column-name fix as getPendingQaList — items has `code` and
        // `nameTh`, not `itemCode` / `name`. Without this the quarantine-
        // aging tile silently 500s with the same Drizzle Object.entries
        // crash.
        itemCode: t.items.code,
        itemName: t.items.nameTh,
        quantity: t.inventoryLots.quantity,
        unit: t.inventoryLots.unit,
        receivedDate: t.inventoryLots.receivedDate,
        warehouseName: t.warehouses.name,
        sourceGrnLineId: t.inventoryLots.sourceGrnLineId,
      })
      .from(t.inventoryLots)
      .leftJoin(t.items, eq(t.items.id, t.inventoryLots.itemId))
      .leftJoin(t.warehouses, eq(t.warehouses.id, t.inventoryLots.warehouseId))
      .where(eq(t.inventoryLots.status, 'quarantine'));

    // Resolve GRN numbers for the lots
    const grnLineIds = lots
      .filter((l: any) => l.sourceGrnLineId)
      .map((l: any) => Number(l.sourceGrnLineId));
    const grnByLine: Record<number, string> = {};
    if (grnLineIds.length > 0) {
      const links = await db
        .select({
          lineId: t.lines.id,
          grnNumber: t.grns.grnNumber,
        })
        .from(t.lines)
        .leftJoin(t.grns, eq(t.grns.id, t.lines.grnId))
        .where(inArray(t.lines.id, grnLineIds));
      for (const l of links) {
        if (l.grnNumber) grnByLine[Number(l.lineId)] = String(l.grnNumber);
      }
    }

    const now = Date.now();
    const items = lots.map((l: any) => {
      const received = l.receivedDate ? new Date(l.receivedDate) : new Date();
      const ageDays = Math.floor((now - received.getTime()) / (1000 * 60 * 60 * 24));
      return {
        lotId: Number(l.lotId),
        lotNumber: String(l.lotNumber),
        itemCode: l.itemCode ?? '',
        itemName: l.itemName ?? '',
        quantity: Number(l.quantity ?? 0),
        unit: String(l.unit ?? ''),
        ageDays,
        grnNumber: l.sourceGrnLineId ? grnByLine[Number(l.sourceGrnLineId)] ?? null : null,
        warehouseName: l.warehouseName ?? '',
        receivedDate: l.receivedDate ? String(l.receivedDate).slice(0, 10) : '',
      };
    });

    const bands = [
      { label: '0-7 days', minDays: 0, maxDays: 7, count: items.filter((i: { ageDays: number }) => i.ageDays <= 7).length },
      { label: '8-14 days', minDays: 8, maxDays: 14, count: items.filter((i: { ageDays: number }) => i.ageDays > 7 && i.ageDays <= 14).length },
      { label: '15+ days', minDays: 15, maxDays: null as number | null, count: items.filter((i: { ageDays: number }) => i.ageDays > 14).length },
    ];

    return { bands, items };
  });
}

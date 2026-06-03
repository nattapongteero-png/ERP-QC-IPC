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
        itemCode: t.items.itemCode,
        itemName: t.items.name,
        actualQuantity: t.lines.actualQuantity,
        unit: t.lines.unit,
        qcSampleId: t.lines.qcSampleId,
        qcSampleStatus: t.qcSamples.status,
        createdAt: t.lines.createdAt,
        vendorName: t.vendors.name,
      })
      .from(t.lines)
      .leftJoin(t.grns, eq(t.grns.id, t.lines.grnId))
      .leftJoin(t.items, eq(t.items.id, t.lines.itemId))
      .leftJoin(t.qcSamples, eq(t.qcSamples.id, t.lines.qcSampleId))
      .leftJoin(t.vendors, eq(t.vendors.id, t.grns.vendorId))
      .where(eq(t.lines.status, 'qc_approved'))
      .orderBy(desc(t.lines.id))
      .limit(200);

    return rows.map((r: any) => ({
      grnId: Number(r.grnId),
      grnNumber: String(r.grnNumber),
      lineId: Number(r.lineId),
      itemCode: r.itemCode ?? '',
      itemName: r.itemName ?? '',
      actualQuantity: Number(r.actualQuantity ?? 0),
      unit: String(r.unit ?? ''),
      qcSampleId: r.qcSampleId != null ? Number(r.qcSampleId) : null,
      qcSampleStatus: r.qcSampleStatus ?? null,
      ageDays: Math.floor((Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      vendorName: r.vendorName ?? null,
    }));
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
        itemCode: t.items.itemCode,
        itemName: t.items.name,
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

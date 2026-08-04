/**
 * Purchasing dashboard — the numbers behind /purchasing.
 *
 * Same three layers as production. Two things the plan flags are handled
 * honestly rather than faked:
 *   - PPV needs an agreed baseline price. Until standard costs are maintained
 *     this returns null with a reason, instead of inventing a variance.
 *   - "Spend under management" needs a way to tell in-system purchases from
 *     after-the-fact entries; there is none, so it is not reported at all.
 */
import { eq, inArray } from 'drizzle-orm';
import { executeDbOperation, getTableRef } from '../db/db-helper';
import { getTodayStr, formatDateFromDb } from '../db/date-utils';
import { KPI_TARGETS, KPI_DEFINITIONS, KPI_WINDOW_DAYS, KPI_TREND_MONTHS, kpiStatus } from '../constants/kpi-targets';
import { recentMonths } from './production-dashboard.service';

function getTables() {
  return {
    po: getTableRef('purchaseOrders'),
    poLines: getTableRef('purchaseOrderLines'),
    pr: getTableRef('purchaseRequisitions'),
    vendors: getTableRef('vendors'),
    items: getTableRef('items'),
    grn: getTableRef('goodsReceipts'),
    grnLines: getTableRef('goodsReceiptLines'),
  };
}

const ymd = (v: unknown): string | null => {
  if (!v) return null;
  try {
    return formatDateFromDb(v as never);
  } catch {
    const s = String(v);
    return s.length >= 10 ? s.slice(0, 10) : null;
  }
};

function shiftDays(fromYmd: string, days: number): string {
  const [y, m, d] = fromYmd.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

const pct = (num: number, den: number): number | null =>
  den > 0 ? Number(((num / den) * 100).toFixed(1)) : null;

/** Top N by value, remainder folded into one "other" bucket (never a 9th colour). */
export function topNWithOther<T extends { value: number }>(
  rows: T[],
  n: number,
): { top: T[]; otherValue: number; otherCount: number } {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, n);
  const rest = sorted.slice(n);
  return {
    top,
    otherValue: rest.reduce((s, r) => s + r.value, 0),
    otherCount: rest.length,
  };
}

export interface PurchasingDashboard {
  window: { from: string; to: string; days: number };
  kpis: {
    spendWindow: { value: number; orders: number };
    onTimeDelivery: { value: number | null; target: number; status: string; onTime: number; received: number };
    openReceipts: { count: number; value: number };
    poCycleDays: { value: number | null; target: number; status: string; samples: number };
    incomingAcceptance: { value: number | null; target: number; status: string; accepted: number; total: number };
    top3Concentration: { value: number | null; target: number; status: string };
    ppv: { value: number | null; unavailableReason: string | null };
  };
  spendTrend: Array<{ month: string; value: number; orders: number }>;
  topVendors: Array<{ vendorId: number; name: string; value: number; otdPercent: number | null }>;
  otdByVendor: Array<{ vendorId: number; name: string; otdPercent: number; target: number; receipts: number }>;
  lateOrders: Array<{
    id: number; poNumber: string; vendorName: string | null;
    expectedDate: string | null; daysLate: number; outstandingValue: number;
  }>;
}

export async function getPurchasingDashboard(opts?: { today?: string }): Promise<PurchasingDashboard> {
  const today = opts?.today ?? getTodayStr();
  const windowFrom = shiftDays(today, -KPI_WINDOW_DAYS);
  const months = recentMonths(today, KPI_TREND_MONTHS);
  const trendFrom = `${months[0]}-01`;

  return executeDbOperation(async (db) => {
    const t = getTables();

    const orders = (await db.select().from(t.po)) as Array<Record<string, any>>;
    const lines = (await db.select().from(t.poLines)) as Array<Record<string, any>>;
    const vendorRows = (await db.select({ id: t.vendors.id, name: t.vendors.name }).from(t.vendors)) as Array<Record<string, any>>;
    const vendorName = new Map<number, string>();
    for (const v of vendorRows) vendorName.set(Number(v.id), String(v.name ?? ''));

    const LIVE = (o: Record<string, any>) => !['cancelled', 'rejected', 'draft'].includes(String(o.status));
    const orderValue = (o: Record<string, any>) =>
      Number(o.subtotalAmount ?? o.totalAmount ?? 0) || 0;

    // ---------- Layer 1 ----------
    const windowOrders = orders.filter((o) => {
      const d = ymd(o.orderDate);
      return LIVE(o) && d != null && d >= windowFrom && d <= today;
    });
    const spendWindow = windowOrders.reduce((s, o) => s + orderValue(o), 0);

    // On-time delivery: compare each receipt against its PO's expected date.
    let receipts: Array<Record<string, any>> = [];
    try {
      receipts = (await db.select().from(t.grn)) as Array<Record<string, any>>;
    } catch {
      receipts = [];
    }
    const poById = new Map<number, Record<string, any>>();
    for (const o of orders) poById.set(Number(o.id), o);

    const judged = receipts
      .map((r) => {
        const po = r.poId != null ? poById.get(Number(r.poId)) : null;
        const expected = po ? ymd(po.expectedDate) : null;
        const received = ymd(r.receivedDate);
        if (!expected || !received) return null;
        if (received < windowFrom || received > today) return null;
        const late = new Date(received).getTime() >
          new Date(shiftDays(expected, KPI_DEFINITIONS.otdGraceDays)).getTime();
        return { vendorId: po?.vendorId != null ? Number(po.vendorId) : null, onTime: !late };
      })
      .filter((v): v is { vendorId: number | null; onTime: boolean } => v !== null);
    const onTimeCount = judged.filter((j) => j.onTime).length;

    // Outstanding receipts: ordered but not yet received, valued at PO price.
    let openValue = 0;
    let openCount = 0;
    const openByPo = new Map<number, number>();
    for (const l of lines) {
      const qty = Number(l.quantity) || 0;
      const rec = Number(l.receivedQuantity) || 0;
      if (rec >= qty) continue;
      const po = poById.get(Number(l.poId));
      if (!po || !LIVE(po)) continue;
      const v = (qty - rec) * (Number(l.unitPrice) || 0);
      openValue += v;
      openCount += 1;
      openByPo.set(Number(l.poId), (openByPo.get(Number(l.poId)) ?? 0) + v);
    }

    // PO cycle time: requisition raised → PO approved.
    let cycleDays: number[] = [];
    try {
      const prs = (await db.select().from(t.pr)) as Array<Record<string, any>>;
      const prByPo = new Map<number, Record<string, any>>();
      for (const p of prs) if (p.poId != null) prByPo.set(Number(p.poId), p);
      cycleDays = orders
        .map((o) => {
          const pr = prByPo.get(Number(o.id));
          const start = pr ? ymd(pr.createdAt) : null;
          const end = ymd(o.approvedAt);
          if (!start || !end || end < windowFrom) return null;
          const d = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
          return d >= 0 ? d : null;
        })
        .filter((v): v is number => v != null);
    } catch {
      cycleDays = [];
    }
    const avgCycle = cycleDays.length
      ? Number((cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length).toFixed(1))
      : null;

    // Incoming acceptance: GRN lines that made it past QC.
    let accepted = 0;
    let totalGrnLines = 0;
    try {
      const gl = (await db.select().from(t.grnLines)) as Array<Record<string, any>>;
      const grnById = new Map<number, Record<string, any>>();
      for (const r of receipts) grnById.set(Number(r.id), r);
      for (const l of gl) {
        const g = grnById.get(Number(l.grnId));
        const d = g ? ymd(g.receivedDate) : null;
        if (!d || d < windowFrom || d > today) continue;
        totalGrnLines += 1;
        if (['qc_approved', 'released_to_stock'].includes(String(l.status))) accepted += 1;
      }
    } catch {
      /* goods receipt tables absent */
    }

    // ---------- Layer 2 ----------
    const monthTotals = new Map<string, { value: number; orders: number }>();
    for (const o of orders) {
      const d = ymd(o.orderDate);
      if (!LIVE(o) || !d || d < trendFrom) continue;
      const k = d.slice(0, 7);
      const cur = monthTotals.get(k) ?? { value: 0, orders: 0 };
      cur.value += orderValue(o);
      cur.orders += 1;
      monthTotals.set(k, cur);
    }
    const spendTrend = months.map((m) => ({
      month: m,
      value: Number((monthTotals.get(m)?.value ?? 0).toFixed(2)),
      orders: monthTotals.get(m)?.orders ?? 0,
    }));

    // Vendor spend over the trend window, plus each vendor's OTD.
    const vendorSpend = new Map<number, number>();
    for (const o of orders) {
      const d = ymd(o.orderDate);
      if (!LIVE(o) || !d || d < trendFrom || o.vendorId == null) continue;
      const id = Number(o.vendorId);
      vendorSpend.set(id, (vendorSpend.get(id) ?? 0) + orderValue(o));
    }
    const otdByVendorMap = new Map<number, { on: number; n: number }>();
    for (const j of judged) {
      if (j.vendorId == null) continue;
      const cur = otdByVendorMap.get(j.vendorId) ?? { on: 0, n: 0 };
      cur.n += 1;
      if (j.onTime) cur.on += 1;
      otdByVendorMap.set(j.vendorId, cur);
    }

    const vendorRowsForChart = [...vendorSpend.entries()].map(([vendorId, value]) => ({ vendorId, value }));
    const { top, otherValue, otherCount } = topNWithOther(vendorRowsForChart, 7);
    const totalVendorSpend = vendorRowsForChart.reduce((s, r) => s + r.value, 0);

    const topVendors = top.map((r) => {
      const o = otdByVendorMap.get(r.vendorId);
      return {
        vendorId: r.vendorId,
        name: vendorName.get(r.vendorId) ?? `#${r.vendorId}`,
        value: Number(r.value.toFixed(2)),
        otdPercent: o && o.n > 0 ? pct(o.on, o.n) : null,
      };
    });
    if (otherCount > 0) {
      topVendors.push({ vendorId: -1, name: '__other__', value: Number(otherValue.toFixed(2)), otdPercent: null });
    }

    // Concentration risk: share held by the three largest vendors.
    const sortedSpend = [...vendorSpend.values()].sort((a, b) => b - a);
    const top3 = sortedSpend.slice(0, 3).reduce((a, b) => a + b, 0);
    const concentration = pct(top3, totalVendorSpend);

    const otdByVendor = [...otdByVendorMap.entries()]
      .filter(([, c]) => c.n >= 1)
      .map(([vendorId, c]) => ({
        vendorId,
        name: vendorName.get(vendorId) ?? `#${vendorId}`,
        otdPercent: pct(c.on, c.n) ?? 0,
        target: KPI_TARGETS.purchasing.onTimeDeliveryPercent,
        receipts: c.n,
      }))
      .sort((a, b) => a.otdPercent - b.otdPercent)
      .slice(0, 8);

    // ---------- Layer 3 ----------
    const lateOrders = orders
      .filter((o) => {
        if (!LIVE(o)) return false;
        const exp = ymd(o.expectedDate);
        return exp != null && exp < today && (openByPo.get(Number(o.id)) ?? 0) > 0;
      })
      .map((o) => {
        const exp = ymd(o.expectedDate)!;
        return {
          id: Number(o.id),
          poNumber: String(o.poNumber ?? ''),
          vendorName: o.vendorId != null ? vendorName.get(Number(o.vendorId)) ?? null : null,
          expectedDate: exp,
          daysLate: Math.round((new Date(today).getTime() - new Date(exp).getTime()) / 86400000),
          outstandingValue: Number((openByPo.get(Number(o.id)) ?? 0).toFixed(2)),
        };
      })
      .sort((a, b) => b.daysLate - a.daysLate)
      .slice(0, 15);

    const otd = pct(onTimeCount, judged.length);
    const acceptance = pct(accepted, totalGrnLines);

    return {
      window: { from: windowFrom, to: today, days: KPI_WINDOW_DAYS },
      kpis: {
        spendWindow: { value: Number(spendWindow.toFixed(2)), orders: windowOrders.length },
        onTimeDelivery: {
          value: otd,
          target: KPI_TARGETS.purchasing.onTimeDeliveryPercent,
          status: kpiStatus(otd, KPI_TARGETS.purchasing.onTimeDeliveryPercent),
          onTime: onTimeCount,
          received: judged.length,
        },
        openReceipts: { count: openCount, value: Number(openValue.toFixed(2)) },
        poCycleDays: {
          value: avgCycle,
          target: KPI_TARGETS.purchasing.maxPoCycleDays,
          status: kpiStatus(avgCycle, KPI_TARGETS.purchasing.maxPoCycleDays, true),
          samples: cycleDays.length,
        },
        incomingAcceptance: {
          value: acceptance,
          target: KPI_TARGETS.purchasing.incomingAcceptancePercent,
          status: kpiStatus(acceptance, KPI_TARGETS.purchasing.incomingAcceptancePercent),
          accepted,
          total: totalGrnLines,
        },
        top3Concentration: {
          value: concentration,
          target: KPI_TARGETS.purchasing.maxTop3ConcentrationPercent,
          status: kpiStatus(concentration, KPI_TARGETS.purchasing.maxTop3ConcentrationPercent, true),
        },
        // Reported as unavailable rather than guessed — see the file header.
        ppv: {
          value: null,
          unavailableReason:
            KPI_DEFINITIONS.ppvBaseline === 'standard_cost' ? 'standard_cost_not_set' : 'baseline_not_agreed',
        },
      },
      spendTrend,
      topVendors,
      otdByVendor,
      lateOrders,
    };
  });
}

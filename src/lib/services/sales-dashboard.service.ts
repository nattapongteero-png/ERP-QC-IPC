/**
 * Sales dashboard — the KPIs the existing /sales page was missing.
 *
 * The old page showed revenue, order count, status split and top customers.
 * That answers "how much did we sell", not "did we keep the promise and did we
 * make money doing it". This adds gross margin, OTIF, backlog, win rate,
 * overdue receivables and the quote→cash funnel.
 *
 * Margin comes from sales_order_lines.marginAmount, which is computed at order
 * time — recomputing it here would risk two different margin numbers in one
 * system.
 */
import { executeDbOperation, getTableRef } from '../db/db-helper';
import { getTodayStr, formatDateFromDb } from '../db/date-utils';
import { KPI_TARGETS, KPI_DEFINITIONS, KPI_WINDOW_DAYS, KPI_TREND_MONTHS, kpiStatus } from '../constants/kpi-targets';
import { recentMonths } from './production-dashboard.service';

function getTables() {
  return {
    so: getTableRef('salesOrders'),
    soLines: getTableRef('salesOrderLines'),
    quotations: getTableRef('quotations'),
    customers: getTableRef('customers'),
    deliveries: getTableRef('salesDeliveries'),
    arInvoices: getTableRef('ARInvoices'),
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

export interface SalesDashboard {
  window: { from: string; to: string; days: number };
  kpis: {
    revenue: { value: number; orders: number };
    grossMargin: { value: number | null; target: number; status: string; amount: number };
    otif: { value: number | null; target: number; status: string; ok: number; total: number };
    backlog: { value: number; lines: number };
    winRate: { value: number | null; target: number; status: string; won: number; total: number };
    overdueAr: { value: number; percent: number | null; target: number; status: string };
  };
  revenueTrend: Array<{ month: string; value: number }>;
  marginTrend: Array<{ month: string; percent: number | null }>;
  topCustomers: Array<{ customerId: number | null; name: string; value: number; marginPercent: number | null }>;
  funnel: Array<{ stage: string; count: number; value: number }>;
  dueSoon: Array<{ id: number; soNumber: string; customerName: string | null; requiredDate: string | null; value: number }>;
}

export async function getSalesDashboard(opts?: { today?: string }): Promise<SalesDashboard> {
  const today = opts?.today ?? getTodayStr();
  const windowFrom = shiftDays(today, -KPI_WINDOW_DAYS);
  const months = recentMonths(today, KPI_TREND_MONTHS);
  const trendFrom = `${months[0]}-01`;

  return executeDbOperation(async (db) => {
    const t = getTables();

    const orders = (await db.select().from(t.so)) as Array<Record<string, any>>;
    const lines = (await db.select().from(t.soLines)) as Array<Record<string, any>>;
    const customerRows = (await db.select({ id: t.customers.id, name: t.customers.name }).from(t.customers)) as Array<Record<string, any>>;
    const customerName = new Map<number, string>();
    for (const c of customerRows) customerName.set(Number(c.id), String(c.name ?? ''));

    // Cancelled and rejected orders never count as revenue — the existing sales
    // report already excludes them, and the two must not disagree.
    const LIVE = (o: Record<string, any>) => !['cancelled', 'rejected'].includes(String(o.status));
    const orderValue = (o: Record<string, any>) => Number(o.totalAmount ?? 0) || 0;

    const linesByOrder = new Map<number, Array<Record<string, any>>>();
    for (const l of lines) {
      const k = Number(l.soId ?? l.salesOrderId);
      if (!Number.isFinite(k)) continue;
      const arr = linesByOrder.get(k) ?? [];
      arr.push(l);
      linesByOrder.set(k, arr);
    }

    // ---------- Layer 1 ----------
    const windowOrders = orders.filter((o) => {
      const d = ymd(o.orderDate);
      return LIVE(o) && d != null && d >= windowFrom && d <= today;
    });
    const revenue = windowOrders.reduce((s, o) => s + orderValue(o), 0);

    // Margin over the same window, summed from the stored per-line figures.
    let marginAmount = 0;
    let marginBase = 0;
    for (const o of windowOrders) {
      for (const l of linesByOrder.get(Number(o.id)) ?? []) {
        const m = Number(l.marginAmount);
        const rev = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
        if (Number.isFinite(m)) {
          marginAmount += m;
          marginBase += rev;
        }
      }
    }
    const grossMarginPct = marginBase > 0 ? Number(((marginAmount / marginBase) * 100).toFixed(1)) : null;

    // OTIF: an order counts only if every line shipped in full, and the shipment
    // was not later than the required date.
    const shippedOrders = orders.filter((o) => LIVE(o) && ymd(o.shippedDate) != null);
    const otifWindow = shippedOrders.filter((o) => {
      const s = ymd(o.shippedDate)!;
      return s >= windowFrom && s <= today;
    });
    const otifOk = otifWindow.filter((o) => {
      const shipped = ymd(o.shippedDate)!;
      const required = ymd(o.requiredDate);
      const onTime = required == null ? true : shipped <= required;
      const early = KPI_DEFINITIONS.otifEarlyToleranceDays;
      const notTooEarly =
        early == null || required == null ? true : shipped >= shiftDays(required, -early);
      const inFull = (linesByOrder.get(Number(o.id)) ?? []).every(
        (l) => (Number(l.shippedQuantity) || 0) >= (Number(l.quantity) || 0),
      );
      return onTime && notTooEarly && inFull;
    });

    // Backlog: sold but not shipped, valued at sale price.
    let backlogValue = 0;
    let backlogLines = 0;
    for (const o of orders) {
      if (!LIVE(o)) continue;
      for (const l of linesByOrder.get(Number(o.id)) ?? []) {
        const q = Number(l.quantity) || 0;
        const s = Number(l.shippedQuantity) || 0;
        if (s >= q) continue;
        backlogValue += (q - s) * (Number(l.unitPrice) || 0);
        backlogLines += 1;
      }
    }

    // Win rate over quotations raised in the window.
    let quotesTotal = 0;
    let quotesWon = 0;
    try {
      const qs = (await db.select().from(t.quotations)) as Array<Record<string, any>>;
      for (const q of qs) {
        const d = ymd(q.quotationDate) ?? ymd(q.createdAt);
        if (!d || d < windowFrom || d > today) continue;
        if (String(q.status) === 'draft') continue;
        quotesTotal += 1;
        if (q.soId != null || String(q.status) === 'converted' || String(q.status) === 'accepted') quotesWon += 1;
      }
    } catch {
      /* quotations table absent */
    }

    // Overdue receivables — read from the AR ledger rather than recomputed, so
    // this figure agrees with the AR aging report.
    let overdueAr = 0;
    let totalAr = 0;
    try {
      const invs = (await db.select().from(t.arInvoices)) as Array<Record<string, any>>;
      for (const inv of invs) {
        if (['paid', 'cancelled', 'void'].includes(String(inv.status))) continue;
        const outstanding =
          Number(inv.outstandingAmount ?? inv.balanceAmount ?? inv.totalAmount ?? 0) || 0;
        if (outstanding <= 0) continue;
        totalAr += outstanding;
        const due = ymd(inv.dueDate);
        if (due != null && due < today) overdueAr += outstanding;
      }
    } catch {
      /* AR tables absent */
    }

    // ---------- Layer 2 ----------
    const revByMonth = new Map<string, number>();
    const marginByMonth = new Map<string, { m: number; base: number }>();
    for (const o of orders) {
      const d = ymd(o.orderDate);
      if (!LIVE(o) || !d || d < trendFrom) continue;
      const key = d.slice(0, 7);
      revByMonth.set(key, (revByMonth.get(key) ?? 0) + orderValue(o));
      const cur = marginByMonth.get(key) ?? { m: 0, base: 0 };
      for (const l of linesByOrder.get(Number(o.id)) ?? []) {
        const m = Number(l.marginAmount);
        if (!Number.isFinite(m)) continue;
        cur.m += m;
        cur.base += (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
      }
      marginByMonth.set(key, cur);
    }
    // Revenue and margin are two charts on one time axis, never one dual-axis
    // chart — see the plan's display rules.
    const revenueTrend = months.map((m) => ({ month: m, value: Number((revByMonth.get(m) ?? 0).toFixed(2)) }));
    const marginTrend = months.map((m) => {
      const c = marginByMonth.get(m);
      return { month: m, percent: c && c.base > 0 ? Number(((c.m / c.base) * 100).toFixed(1)) : null };
    });

    // Top customers, each with its own margin — the point is to expose the big
    // customer who is also the thin-margin one.
    const byCustomer = new Map<number, { value: number; m: number; base: number }>();
    for (const o of orders) {
      const d = ymd(o.orderDate);
      if (!LIVE(o) || !d || d < trendFrom || o.customerId == null) continue;
      const id = Number(o.customerId);
      const cur = byCustomer.get(id) ?? { value: 0, m: 0, base: 0 };
      cur.value += orderValue(o);
      for (const l of linesByOrder.get(Number(o.id)) ?? []) {
        const m = Number(l.marginAmount);
        if (!Number.isFinite(m)) continue;
        cur.m += m;
        cur.base += (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
      }
      byCustomer.set(id, cur);
    }
    const topCustomers = [...byCustomer.entries()]
      .map(([customerId, c]) => ({
        customerId,
        name: customerName.get(customerId) ?? `#${customerId}`,
        value: Number(c.value.toFixed(2)),
        marginPercent: c.base > 0 ? Number(((c.m / c.base) * 100).toFixed(1)) : null,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);

    // Funnel: quote → order → delivery → invoice.
    const funnel: Array<{ stage: string; count: number; value: number }> = [];
    funnel.push({ stage: 'quotations', count: quotesTotal, value: 0 });
    funnel.push({
      stage: 'orders',
      count: windowOrders.length,
      value: Number(revenue.toFixed(2)),
    });
    funnel.push({
      stage: 'deliveries',
      count: otifWindow.length,
      value: 0,
    });
    try {
      const invs = (await db.select().from(t.arInvoices)) as Array<Record<string, any>>;
      const inWindow = invs.filter((i) => {
        const d = ymd(i.invoiceDate);
        return d != null && d >= windowFrom && d <= today;
      });
      funnel.push({
        stage: 'invoices',
        count: inWindow.length,
        value: Number(inWindow.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0).toFixed(2)),
      });
    } catch {
      funnel.push({ stage: 'invoices', count: 0, value: 0 });
    }

    // ---------- Layer 3 ----------
    const soon = shiftDays(today, 7);
    const dueSoon = orders
      .filter((o) => {
        if (!LIVE(o) || ymd(o.shippedDate) != null) return false;
        const req = ymd(o.requiredDate);
        return req != null && req >= today && req <= soon;
      })
      .map((o) => ({
        id: Number(o.id),
        soNumber: String(o.soNumber ?? o.orderNumber ?? ''),
        customerName: o.customerId != null ? customerName.get(Number(o.customerId)) ?? null : null,
        requiredDate: ymd(o.requiredDate),
        value: Number(orderValue(o).toFixed(2)),
      }))
      .sort((a, b) => (a.requiredDate ?? '').localeCompare(b.requiredDate ?? ''))
      .slice(0, 15);

    const otifPct = pct(otifOk.length, otifWindow.length);
    const winPct = pct(quotesWon, quotesTotal);
    const overduePct = pct(overdueAr, totalAr);

    return {
      window: { from: windowFrom, to: today, days: KPI_WINDOW_DAYS },
      kpis: {
        revenue: { value: Number(revenue.toFixed(2)), orders: windowOrders.length },
        grossMargin: {
          value: grossMarginPct,
          target: KPI_TARGETS.sales.grossMarginPercent,
          status: kpiStatus(grossMarginPct, KPI_TARGETS.sales.grossMarginPercent),
          amount: Number(marginAmount.toFixed(2)),
        },
        otif: {
          value: otifPct,
          target: KPI_TARGETS.sales.otifPercent,
          status: kpiStatus(otifPct, KPI_TARGETS.sales.otifPercent),
          ok: otifOk.length,
          total: otifWindow.length,
        },
        backlog: { value: Number(backlogValue.toFixed(2)), lines: backlogLines },
        winRate: {
          value: winPct,
          target: KPI_TARGETS.sales.winRatePercent,
          status: kpiStatus(winPct, KPI_TARGETS.sales.winRatePercent),
          won: quotesWon,
          total: quotesTotal,
        },
        overdueAr: {
          value: Number(overdueAr.toFixed(2)),
          percent: overduePct,
          target: KPI_TARGETS.sales.maxOverdueArPercent,
          status: kpiStatus(overduePct, KPI_TARGETS.sales.maxOverdueArPercent, true),
        },
      },
      revenueTrend,
      marginTrend,
      topCustomers,
      funnel,
      dueSoon,
    };
  });
}

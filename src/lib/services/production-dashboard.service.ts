/**
 * Production dashboard — the numbers behind /production.
 *
 * Structure follows the dashboard plan's three layers: status (KPIs), cause
 * (trends and Pareto), action (what is stuck and who holds it).
 *
 * Two deliberate omissions, both from the plan:
 *   - OEE is NOT computed. The system does not record machine run/stop time, so
 *     any OEE here would be arithmetic on absent data — worse than no number.
 *   - "Reason production ran late" is derived from deviations only, and is
 *     labelled as such, until work_orders carries a real delay-reason code.
 */
import { and, gte, lte, isNotNull, isNull, inArray, eq, type SQL } from 'drizzle-orm';
import { executeDbOperation, getTableRef } from '../db/db-helper';
import { getTodayStr, formatDateFromDb } from '../db/date-utils';
import { KPI_TARGETS, KPI_DEFINITIONS, KPI_WINDOW_DAYS, KPI_TREND_MONTHS, kpiStatus } from '../constants/kpi-targets';

function getTables() {
  return {
    wo: getTableRef('workOrders'),
    items: getTableRef('items'),
    deviations: getTableRef('deviations'),
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

/** Shift a YYYY-MM-DD string by whole days. */
function shiftDays(fromYmd: string, days: number): string {
  const [y, m, d] = fromYmd.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

/** The last N calendar months as YYYY-MM, oldest first, ending with `today`'s month. */
export function recentMonths(today: string, count: number): string[] {
  const [y, m] = today.split('-').map(Number);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const dt = new Date(y, (m || 1) - 1 - i, 1);
    out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

const pct = (num: number, den: number): number | null =>
  den > 0 ? Number(((num / den) * 100).toFixed(1)) : null;

export interface ProductionDashboard {
  window: { from: string; to: string; days: number };
  kpis: {
    scheduleAdherence: { value: number | null; target: number; status: string; completed: number; onTime: number };
    yieldAvg: { value: number | null; target: number; status: string };
    rightFirstTime: { value: number | null; target: number; status: string; clean: number; total: number };
    rejectRate: { value: number | null; target: number; status: string };
    wipCount: number;
    awaitingQa: { count: number; oldestDays: number | null };
    releasedThisWindow: number;
  };
  yieldTrend: Array<{ month: string; yieldPercent: number | null; target: number; orders: number }>;
  wipByStage: Array<{ stage: string; count: number }>;
  delayReasons: Array<{ reason: string; count: number }>;
  /** True while any late order still lacks a delayReason and was inferred from deviations. */
  delayReasonsAreProxy: boolean;
  leadTimeByProduct: Array<{ productId: number; productName: string; plannedDays: number; actualDays: number; orders: number }>;
  stuckOrders: Array<{
    id: number; woNumber: string; productName: string | null; status: string;
    plannedEndDate: string | null; daysLate: number; stage: string;
  }>;
}

export async function getProductionDashboard(opts?: { today?: string }): Promise<ProductionDashboard> {
  const today = opts?.today ?? getTodayStr();
  const windowFrom = shiftDays(today, -KPI_WINDOW_DAYS);
  const months = recentMonths(today, KPI_TREND_MONTHS);
  const trendFrom = `${months[0]}-01`;

  return executeDbOperation(async (db) => {
    const t = getTables();

    // Pull the orders once and reduce in JS. The alternative is a dozen
    // aggregate round-trips over the same rows; work-order volumes here are in
    // the thousands, not millions.
    const orders = (await db.select().from(t.wo)) as Array<Record<string, any>>;
    const itemRows = (await db.select({ id: t.items.id, nameTh: t.items.nameTh, name: t.items.nameEn }).from(t.items)) as Array<Record<string, any>>;
    const itemName = new Map<number, string>();
    for (const it of itemRows) itemName.set(Number(it.id), it.nameTh || it.name || '');

    const isCancelled = (o: Record<string, any>) => String(o.status) === 'cancelled';

    // ---------- Layer 1: KPIs ----------
    // Schedule adherence: of the orders COMPLETED in the window, how many
    // finished on or before their planned end date.
    const completedInWindow = orders.filter((o) => {
      const end = ymd(o.actualEndDate) ?? ymd(o.completedAt);
      return String(o.status) === 'completed' && end != null && end >= windowFrom && end <= today;
    });
    const onTime = completedInWindow.filter((o) => {
      const actual = ymd(o.actualEndDate) ?? ymd(o.completedAt);
      const planned = ymd(o.plannedEndDate);
      return actual != null && planned != null && actual <= planned;
    });

    // Yield: prefer the stored percentage; fall back to actual ÷ planned so an
    // order that never had the field written still counts.
    const yieldValues: number[] = [];
    for (const o of completedInWindow) {
      const stored = o.yieldPercentage != null ? Number(o.yieldPercentage) : null;
      if (stored != null && Number.isFinite(stored) && stored > 0) {
        yieldValues.push(stored);
        continue;
      }
      const planned = Number(o.plannedQuantity) || 0;
      const actual = Number(o.actualQuantity) || 0;
      if (planned > 0 && actual > 0) yieldValues.push((actual / planned) * 100);
    }
    const yieldAvg = yieldValues.length
      ? Number((yieldValues.reduce((a, b) => a + b, 0) / yieldValues.length).toFixed(1))
      : null;

    // Right First Time: completed orders with no deviation of a counted
    // severity. Which severities count is a stated definition, not a guess.
    const woIdsInWindow = completedInWindow.map((o) => Number(o.id));
    let dirtyWoIds = new Set<number>();
    if (woIdsInWindow.length > 0) {
      try {
        const devs = (await db
          .select({ workOrderId: t.deviations.workOrderId, severity: t.deviations.severity })
          .from(t.deviations)
          .where(inArray(t.deviations.workOrderId, woIdsInWindow))) as Array<Record<string, any>>;
        dirtyWoIds = new Set(
          devs
            .filter((d) => KPI_DEFINITIONS.rftDeviationSeverities.includes(String(d.severity)))
            .map((d) => Number(d.workOrderId)),
        );
      } catch {
        /* deviations table missing on an old database — RFT then reads as 100% */
      }
    }
    const cleanCount = completedInWindow.filter((o) => !dirtyWoIds.has(Number(o.id))).length;

    // Reject rate over the same completed set.
    let rejSum = 0;
    let goodSum = 0;
    for (const o of completedInWindow) {
      rejSum += Number(o.rejectQuantity) || 0;
      goodSum += Number(o.actualQuantity) || 0;
    }

    // WIP = anything opened but not finished or cancelled.
    const wipOrders = orders.filter((o) => !['completed', 'cancelled'].includes(String(o.status)));

    // Awaiting QA: finished but not yet released.
    const awaitingQa = orders.filter(
      (o) => (o.completedAt || o.actualEndDate) && !o.qaApprovedAt && String(o.status) !== 'cancelled',
    );
    const qaWaitDays = awaitingQa
      .map((o) => {
        const done = ymd(o.completedAt) ?? ymd(o.actualEndDate);
        if (!done) return null;
        return Math.round((new Date(today).getTime() - new Date(done).getTime()) / 86400000);
      })
      .filter((v): v is number => v != null && v >= 0);

    const releasedThisWindow = orders.filter((o) => {
      const rel = ymd(o.qaApprovedAt);
      return rel != null && rel >= windowFrom && rel <= today;
    }).length;

    // ---------- Layer 2: cause ----------
    // Yield trend by month of completion.
    const byMonth = new Map<string, { sum: number; n: number }>();
    for (const o of orders) {
      if (String(o.status) !== 'completed') continue;
      const end = ymd(o.actualEndDate) ?? ymd(o.completedAt);
      if (!end || end < trendFrom) continue;
      const key = end.slice(0, 7);
      const stored = o.yieldPercentage != null ? Number(o.yieldPercentage) : null;
      let v: number | null = stored != null && Number.isFinite(stored) && stored > 0 ? stored : null;
      if (v == null) {
        const p = Number(o.plannedQuantity) || 0;
        const a = Number(o.actualQuantity) || 0;
        v = p > 0 && a > 0 ? (a / p) * 100 : null;
      }
      if (v == null) continue;
      const cur = byMonth.get(key) ?? { sum: 0, n: 0 };
      cur.sum += v;
      cur.n += 1;
      byMonth.set(key, cur);
    }
    const yieldTrend = months.map((m) => {
      const c = byMonth.get(m);
      return {
        month: m,
        yieldPercent: c && c.n > 0 ? Number((c.sum / c.n).toFixed(1)) : null,
        target: KPI_TARGETS.production.yieldPercent,
        orders: c?.n ?? 0,
      };
    });

    // WIP by stage — the stage is where the order actually sits, which is finer
    // than status alone: a released order waiting on materials is a different
    // bottleneck from one already running.
    const stageOf = (o: Record<string, any>): string => {
      const st = String(o.status);
      if (st === 'planned') return 'planned';
      if (st === 'released') {
        if (String(o.requisitionStatus ?? 'none') !== 'approved') return 'awaiting_materials';
        if (String(o.lineClearanceStatus ?? '') !== 'cleared') return 'awaiting_line_clearance';
        return 'ready';
      }
      if (st === 'in_progress') return 'in_progress';
      return st;
    };
    const stageCounts = new Map<string, number>();
    for (const o of wipOrders) {
      const s = stageOf(o);
      stageCounts.set(s, (stageCounts.get(s) ?? 0) + 1);
    }
    const STAGE_ORDER = ['planned', 'awaiting_materials', 'awaiting_line_clearance', 'ready', 'in_progress'];
    const wipByStage = [...stageCounts.entries()]
      .sort((a, b) => {
        const ai = STAGE_ORDER.indexOf(a[0]);
        const bi = STAGE_ORDER.indexOf(b[0]);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      })
      .map(([stage, count]) => ({ stage, count }));

    // Delay reasons — derived from deviation type on LATE orders. Explicitly a
    // proxy: the plan calls for work_orders.delay_reason before this is real.
    const lateOrders = orders.filter((o) => {
      const planned = ymd(o.plannedEndDate);
      if (!planned) return false;
      const actual = ymd(o.actualEndDate) ?? ymd(o.completedAt);
      return actual != null ? actual > planned : planned < today && !isCancelled(o);
    });
    const delayCounts = new Map<string, number>();
    // Prefer the recorded reason code. Only orders that have none fall back to
    // the deviation proxy, so the Pareto sharpens as the field gets filled in
    // rather than needing a rewrite later.
    const withReason = lateOrders.filter((o) => o.delayReason);
    for (const o of withReason) {
      const key = String(o.delayReason);
      delayCounts.set(key, (delayCounts.get(key) ?? 0) + 1);
    }
    const needProxy = lateOrders.filter((o) => !o.delayReason);
    const usedProxy = needProxy.length > 0;
    if (needProxy.length > 0) {
      try {
        const devs = (await db
          .select({ workOrderId: t.deviations.workOrderId, type: t.deviations.type })
          .from(t.deviations)
          .where(inArray(t.deviations.workOrderId, needProxy.map((o) => Number(o.id))))) as Array<Record<string, any>>;
        const seen = new Set<number>();
        for (const d of devs) {
          const key = String(d.type || 'other');
          delayCounts.set(key, (delayCounts.get(key) ?? 0) + 1);
          seen.add(Number(d.workOrderId));
        }
        const unexplained = needProxy.filter((o) => !seen.has(Number(o.id))).length;
        if (unexplained > 0) delayCounts.set('unspecified', unexplained);
      } catch {
        delayCounts.set('unspecified', needProxy.length);
      }
    }
    const delayReasons = [...delayCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    // Planned vs actual lead time per product.
    const leadByProduct = new Map<number, { p: number; a: number; n: number }>();
    for (const o of orders) {
      if (String(o.status) !== 'completed') continue;
      const ps = ymd(o.plannedStartDate);
      const pe = ymd(o.plannedEndDate);
      const as_ = ymd(o.actualStartDate);
      const ae = ymd(o.actualEndDate) ?? ymd(o.completedAt);
      if (!ps || !pe || !as_ || !ae) continue;
      const pd = Math.round((new Date(pe).getTime() - new Date(ps).getTime()) / 86400000);
      const ad = Math.round((new Date(ae).getTime() - new Date(as_).getTime()) / 86400000);
      if (pd < 0 || ad < 0) continue;
      const pid = Number(o.productId);
      const cur = leadByProduct.get(pid) ?? { p: 0, a: 0, n: 0 };
      cur.p += pd;
      cur.a += ad;
      cur.n += 1;
      leadByProduct.set(pid, cur);
    }
    const leadTimeByProduct = [...leadByProduct.entries()]
      .map(([productId, c]) => ({
        productId,
        productName: itemName.get(productId) ?? `#${productId}`,
        plannedDays: Number((c.p / c.n).toFixed(1)),
        actualDays: Number((c.a / c.n).toFixed(1)),
        orders: c.n,
      }))
      // Biggest plan-vs-reality gap first: that is the row worth acting on.
      .sort((a, b) => (b.actualDays - b.plannedDays) - (a.actualDays - a.plannedDays))
      .slice(0, 8);

    // ---------- Layer 3: action ----------
    const stuckOrders = wipOrders
      .map((o) => {
        const planned = ymd(o.plannedEndDate);
        const daysLate = planned && planned < today
          ? Math.round((new Date(today).getTime() - new Date(planned).getTime()) / 86400000)
          : 0;
        return {
          id: Number(o.id),
          woNumber: String(o.woNumber ?? ''),
          productName: itemName.get(Number(o.productId)) ?? null,
          status: String(o.status),
          plannedEndDate: planned,
          daysLate,
          stage: stageOf(o),
        };
      })
      .filter((o) => o.daysLate > 0)
      .sort((a, b) => b.daysLate - a.daysLate)
      .slice(0, 15);

    const adherence = pct(onTime.length, completedInWindow.length);
    const rft = pct(cleanCount, completedInWindow.length);
    const reject = pct(rejSum, goodSum + rejSum);

    return {
      window: { from: windowFrom, to: today, days: KPI_WINDOW_DAYS },
      kpis: {
        scheduleAdherence: {
          value: adherence,
          target: KPI_TARGETS.production.scheduleAdherencePercent,
          status: kpiStatus(adherence, KPI_TARGETS.production.scheduleAdherencePercent),
          completed: completedInWindow.length,
          onTime: onTime.length,
        },
        yieldAvg: {
          value: yieldAvg,
          target: KPI_TARGETS.production.yieldPercent,
          status: kpiStatus(yieldAvg, KPI_TARGETS.production.yieldPercent),
        },
        rightFirstTime: {
          value: rft,
          target: KPI_TARGETS.production.rightFirstTimePercent,
          status: kpiStatus(rft, KPI_TARGETS.production.rightFirstTimePercent),
          clean: cleanCount,
          total: completedInWindow.length,
        },
        rejectRate: {
          value: reject,
          target: KPI_TARGETS.production.maxRejectPercent,
          status: kpiStatus(reject, KPI_TARGETS.production.maxRejectPercent, true),
        },
        wipCount: wipOrders.length,
        awaitingQa: {
          count: awaitingQa.length,
          oldestDays: qaWaitDays.length ? Math.max(...qaWaitDays) : null,
        },
        releasedThisWindow,
      },
      yieldTrend,
      wipByStage,
      delayReasons,
      delayReasonsAreProxy: usedProxy,
      leadTimeByProduct,
      stuckOrders,
    };
  });
}

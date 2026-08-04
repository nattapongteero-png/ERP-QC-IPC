'use client';

/**
 * Production dashboard.
 *
 * Replaces the redirect that used to bounce this route straight to the work-order
 * list — the menu said "Dashboard" and delivered a table. Three layers, per the
 * dashboard plan: status, then cause, then the rows someone has to act on.
 *
 * OEE is absent on purpose. It needs machine run/stop time, which the system does
 * not record; the note on the page says so rather than showing a number computed
 * from data that isn't there.
 */
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import {
  DashboardSection, KpiTile, ChartCard, BarList, TrendColumns,
  SEQUENTIAL_BLUES, SERIES_COLORS, STATUS_COLORS, type KpiStatus,
} from '@/components/dashboard/dashboard-shell';
import { formatNumber } from '@/lib/utils/number-format';
import { Factory, Info } from 'lucide-react';

interface Dash {
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
  delayReasonsAreProxy: boolean;
  leadTimeByProduct: Array<{ productId: number; productName: string; plannedDays: number; actualDays: number; orders: number }>;
  stuckOrders: Array<{ id: number; woNumber: string; productName: string | null; status: string; plannedEndDate: string | null; daysLate: number; stage: string }>;
}

export default function ProductionDashboardPage() {
  const router = useRouter();
  const tc = useTranslations('common');
  const tRoot = useTranslations('production');
  const t = (k: string, v?: Record<string, string | number>) => tRoot(`dashboard.${k}`, v as never);

  const { data, isLoading, error } = useQuery<Dash>({
    queryKey: ['production-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/production/dashboard');
      const j = await res.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
  });

  const stageLabel = (s: string) =>
    ({
      planned: t('stagePlanned'),
      awaiting_materials: t('stageAwaitingMaterials'),
      awaiting_line_clearance: t('stageAwaitingLineClearance'),
      ready: t('stageReady'),
      in_progress: t('stageInProgress'),
    } as Record<string, string>)[s] ?? s;

  const reasonLabel = (r: string) => (r === 'unspecified' ? t('reasonUnspecified') : r);
  const pctText = (v: number | null | undefined) => (v == null ? null : `${formatNumber(v, 1)}%`);
  const st = (s?: string): KpiStatus =>
    s === 'on_target' ? 'on_target' : s === 'below_target' ? 'below_target' : 'unknown';

  const k = data?.kpis;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      <ResponsivePageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        icon={Factory}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
      />

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {tc('dashboardShell.errorTitle')}: {(error as Error).message}
        </div>
      ) : isLoading || !data ? (
        <p className="py-16 text-center text-gray-400">{tc('dashboardShell.loading')}</p>
      ) : (
        <>
          <p className="text-xs text-gray-500">
            {tc('dashboardShell.windowNote', { days: data.window.days, from: data.window.from, to: data.window.to })}
            {' · '}
            <span className="text-amber-700">{tc('dashboardShell.provisionalTargets')}</span>
          </p>

          {/* ---------- Layer 1 ---------- */}
          <DashboardSection title={tc('dashboardShell.layer1')}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiTile
                hero
                label={t('kpiAdherence')}
                value={pctText(k?.scheduleAdherence.value)}
                sub={t('kpiAdherenceSub', { onTime: k?.scheduleAdherence.onTime ?? 0, completed: k?.scheduleAdherence.completed ?? 0 })}
                target={`≥ ${k?.scheduleAdherence.target}%`}
                status={st(k?.scheduleAdherence.status)}
                testId="kpi-adherence"
              />
              <KpiTile
                label={t('kpiYield')}
                value={pctText(k?.yieldAvg.value)}
                target={`≥ ${k?.yieldAvg.target}%`}
                status={st(k?.yieldAvg.status)}
                testId="kpi-yield"
              />
              <KpiTile
                label={t('kpiRft')}
                value={pctText(k?.rightFirstTime.value)}
                sub={t('kpiRftSub', { clean: k?.rightFirstTime.clean ?? 0, total: k?.rightFirstTime.total ?? 0 })}
                target={`≥ ${k?.rightFirstTime.target}%`}
                status={st(k?.rightFirstTime.status)}
                testId="kpi-rft"
              />
              <KpiTile
                label={t('kpiReject')}
                value={pctText(k?.rejectRate.value)}
                target={`≤ ${k?.rejectRate.target}%`}
                status={st(k?.rejectRate.status)}
                testId="kpi-reject"
              />
              <KpiTile label={t('kpiWip')} value={k?.wipCount ?? 0} sub={t('kpiWipSub')} testId="kpi-wip" />
              <KpiTile
                label={t('kpiAwaitingQa')}
                value={k?.awaitingQa.count ?? 0}
                sub={k?.awaitingQa.oldestDays != null ? t('kpiAwaitingQaSub', { days: k.awaitingQa.oldestDays }) : undefined}
                testId="kpi-awaiting-qa"
              />
              <KpiTile
                label={t('kpiReleased')}
                value={k?.releasedThisWindow ?? 0}
                sub={t('kpiReleasedSub', { days: data.window.days })}
                testId="kpi-released"
              />
            </div>
            <p className="flex items-start gap-1.5 text-[11px] text-gray-400">
              <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
              {t('oeeNote')}
            </p>
          </DashboardSection>

          {/* ---------- Layer 2 ---------- */}
          <DashboardSection title={tc('dashboardShell.layer2')}>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <ChartCard
                title={t('chartYieldTrend')}
                columns={[tc('dashboardShell.month'), t('kpiYield'), tc('dashboardShell.count')]}
                rows={data.yieldTrend.map((p) => [p.month, p.yieldPercent == null ? '—' : `${formatNumber(p.yieldPercent, 1)}%`, p.orders])}
                testId="chart-yield-trend"
              >
                <TrendColumns
                  points={data.yieldTrend.map((p) => ({ label: p.month, value: p.yieldPercent }))}
                  valueFormatter={(v) => `${formatNumber(v, 1)}%`}
                  targetValue={data.yieldTrend[0]?.target}
                  targetLabel={`${tc('dashboardShell.target')} ${data.yieldTrend[0]?.target}%`}
                  emptyText={tc('dashboardShell.noData')}
                />
              </ChartCard>

              <ChartCard
                title={t('chartWipByStage')}
                columns={[t('colStage'), tc('dashboardShell.count')]}
                rows={data.wipByStage.map((s) => [stageLabel(s.stage), s.count])}
                testId="chart-wip-stage"
              >
                {/* Stages have a real order, so a single-hue ramp — separate hues
                    would suggest they are unrelated categories. */}
                <BarList
                  rows={data.wipByStage.map((s) => ({ label: stageLabel(s.stage), value: s.count }))}
                  valueFormatter={(v) => formatNumber(v, 0)}
                  colorFor={(i) => SEQUENTIAL_BLUES[Math.min(i, SEQUENTIAL_BLUES.length - 1)]}
                  emptyText={tc('dashboardShell.noData')}
                />
              </ChartCard>

              <ChartCard
                title={t('chartDelayReasons')}
                // Only warn about the proxy while it is actually being used —
                // once every late order carries a reason code the caveat is wrong.
                note={data.delayReasonsAreProxy ? t('chartDelayReasonsNote') : undefined}
                columns={[t('colReason'), tc('dashboardShell.count')]}
                rows={data.delayReasons.map((r) => [reasonLabel(r.reason), r.count])}
                testId="chart-delay-reasons"
              >
                {/* Pareto: highlight only the top cause. Fixing the biggest one
                    beats spreading effort across five. */}
                <BarList
                  rows={data.delayReasons.map((r) => ({ label: reasonLabel(r.reason), value: r.count }))}
                  valueFormatter={(v) => formatNumber(v, 0)}
                  colorFor={(i) => (i === 0 ? SERIES_COLORS[1] : '#cbd5e1')}
                  emptyText={tc('dashboardShell.noData')}
                />
              </ChartCard>

              <ChartCard
                title={t('chartLeadTime')}
                columns={[t('colProduct'), t('colPlanned'), t('colActual')]}
                rows={data.leadTimeByProduct.map((p) => [p.productName, formatNumber(p.plannedDays, 1), formatNumber(p.actualDays, 1)])}
                testId="chart-lead-time"
              >
                <div className="space-y-2.5 pt-1">
                  {data.leadTimeByProduct.length === 0 ? (
                    <p className="py-10 text-center text-sm text-gray-400">{tc('dashboardShell.noData')}</p>
                  ) : (
                    data.leadTimeByProduct.map((p) => {
                      const worse = p.actualDays > p.plannedDays;
                      const max = Math.max(...data.leadTimeByProduct.flatMap((x) => [x.plannedDays, x.actualDays]), 1);
                      return (
                        <div key={p.productId}>
                          <div className="flex items-baseline justify-between gap-3 text-xs">
                            <span className="truncate text-gray-700" title={p.productName}>{p.productName}</span>
                            <span className={`flex-shrink-0 tabular-nums font-medium ${worse ? 'text-rose-700' : 'text-emerald-700'}`}>
                              {formatNumber(p.plannedDays, 1)} → {formatNumber(p.actualDays, 1)}
                            </span>
                          </div>
                          <div className="relative mt-1 h-2.5 w-full rounded-full bg-gray-100">
                            <div className="absolute inset-y-0 rounded-full" style={{ width: `${(p.plannedDays / max) * 100}%`, background: SEQUENTIAL_BLUES[1] }} />
                            <div
                              className="absolute inset-y-0 rounded-full opacity-80"
                              style={{
                                left: `${(Math.min(p.plannedDays, p.actualDays) / max) * 100}%`,
                                width: `${(Math.abs(p.actualDays - p.plannedDays) / max) * 100}%`,
                                background: worse ? STATUS_COLORS.bad : STATUS_COLORS.good,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ChartCard>
            </div>
          </DashboardSection>

          {/* ---------- Layer 3 ---------- */}
          <DashboardSection title={tc('dashboardShell.layer3')}>
            <div className="overflow-x-auto rounded-[14px] border border-emerald-100 bg-white p-4 shadow-[0_4px_14px_rgba(6,78,59,0.05)]">
              <h3 className="mb-2 text-sm font-semibold text-[#0F2E22]">{t('tableStuck')}</h3>
              {data.stuckOrders.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">{t('noStuck')}</p>
              ) : (
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                      <th className="pb-2 pr-3 font-medium">{t('colWo')}</th>
                      <th className="pb-2 pr-3 font-medium">{t('colProduct')}</th>
                      <th className="pb-2 pr-3 font-medium">{t('colStage')}</th>
                      <th className="pb-2 pr-3 font-medium">{t('colPlannedEnd')}</th>
                      <th className="pb-2 text-right font-medium">{t('colDaysLate')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stuckOrders.map((o) => (
                      <tr
                        key={o.id}
                        className="cursor-pointer border-b border-gray-100 hover:bg-emerald-50/40"
                        onClick={() => router.push(`/production/work-orders/${o.id}`)}
                      >
                        <td className="py-2 pr-3 font-mono text-xs font-semibold text-emerald-700">{o.woNumber}</td>
                        <td className="py-2 pr-3">{o.productName ?? '—'}</td>
                        <td className="py-2 pr-3 text-xs text-gray-600">{stageLabel(o.stage)}</td>
                        <td className="py-2 pr-3 whitespace-nowrap text-xs text-gray-600">{o.plannedEndDate ?? '—'}</td>
                        <td className="py-2 text-right font-semibold tabular-nums text-rose-700">{o.daysLate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </DashboardSection>
        </>
      )}
    </div>
  );
}

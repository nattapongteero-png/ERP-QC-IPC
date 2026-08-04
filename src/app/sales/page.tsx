'use client';

/**
 * Sales dashboard.
 *
 * Rebuilt to the same three layers as production and purchasing, so someone
 * switching modules reads the same shape of screen every time.
 *
 * What changed from the previous version, and why:
 *   - Revenue alone flatters: growth bought with discounts looks like growth.
 *     Gross margin now sits beside it, and the two are SEPARATE charts on a
 *     shared time axis — a dual-axis chart would imply a relationship that the
 *     data does not contain.
 *   - The status donut is gone. Comparing similar angles is something people do
 *     badly; the funnel answers the real question (where does it leak) instead.
 *   - Added the promises we make and the money we actually collect: OTIF,
 *     backlog, win rate, overdue receivables.
 *
 * This page wraps MainLayout itself — the sales layout deliberately does not.
 */
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { ResponsivePageHeader } from '@/components/shared';
import {
  DashboardSection, KpiTile, ChartCard, BarList, TrendColumns,
  SEQUENTIAL_BLUES, SERIES_COLORS, type KpiStatus,
} from '@/components/dashboard/dashboard-shell';
import { formatNumber, formatBaht } from '@/lib/utils/number-format';
import { Coins } from 'lucide-react';

interface Dash {
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

export default function SalesDashboardPage() {
  const router = useRouter();
  const tc = useTranslations('common');
  const tRoot = useTranslations('sales');
  const t = (k: string, v?: Record<string, string | number>) => tRoot(`dashboard.${k}`, v as never);

  const { data, isLoading, error } = useQuery<Dash>({
    queryKey: ['sales-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/sales/dashboard');
      const j = await res.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
  });

  const pctText = (v: number | null | undefined) => (v == null ? null : `${formatNumber(v, 1)}%`);
  const st = (s?: string): KpiStatus =>
    s === 'on_target' ? 'on_target' : s === 'below_target' ? 'below_target' : 'unknown';

  const stageLabel = (s: string) =>
    ({
      quotations: t('funnelQuotations'),
      orders: t('funnelOrders'),
      deliveries: t('funnelDeliveries'),
      invoices: t('funnelInvoices'),
    } as Record<string, string>)[s] ?? s;

  const k = data?.kpis;

  return (
    <MainLayout>
      <div className="flex flex-col gap-6 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
        <ResponsivePageHeader
          title={tRoot('page.title')}
          subtitle={tRoot('page.description')}
          icon={Coins}
          iconBgColor="bg-amber-100"
          iconColor="text-amber-600"
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
                  label={t('kpiRevenue')}
                  value={formatBaht(k?.revenue.value ?? 0)}
                  sub={`${k?.revenue.orders ?? 0} · ${data.window.days}d`}
                  testId="kpi-revenue"
                />
                <KpiTile
                  label={t('kpiGrossMargin')}
                  value={pctText(k?.grossMargin.value)}
                  sub={`${formatBaht(k?.grossMargin.amount ?? 0)} · ${t('kpiGrossMarginSub')}`}
                  target={`≥ ${k?.grossMargin.target}%`}
                  status={st(k?.grossMargin.status)}
                  testId="kpi-margin"
                />
                <KpiTile
                  label={t('kpiOtif')}
                  value={pctText(k?.otif.value)}
                  sub={t('kpiOtifSub', { ok: k?.otif.ok ?? 0, total: k?.otif.total ?? 0 })}
                  target={`≥ ${k?.otif.target}%`}
                  status={st(k?.otif.status)}
                  testId="kpi-otif"
                />
                <KpiTile
                  label={t('kpiBacklog')}
                  value={formatBaht(k?.backlog.value ?? 0)}
                  sub={t('kpiBacklogSub', { lines: k?.backlog.lines ?? 0 })}
                  testId="kpi-backlog"
                />
                <KpiTile
                  label={t('kpiWinRate')}
                  value={pctText(k?.winRate.value)}
                  sub={t('kpiWinRateSub', { won: k?.winRate.won ?? 0, total: k?.winRate.total ?? 0 })}
                  target={`≥ ${k?.winRate.target}%`}
                  status={st(k?.winRate.status)}
                  testId="kpi-winrate"
                />
                <KpiTile
                  label={t('kpiOverdueAr')}
                  value={formatBaht(k?.overdueAr.value ?? 0)}
                  sub={
                    k?.overdueAr.percent == null
                      ? undefined
                      : t('kpiOverdueArSub', { percent: formatNumber(k.overdueAr.percent, 1) })
                  }
                  target={`≤ ${k?.overdueAr.target}%`}
                  status={st(k?.overdueAr.status)}
                  testId="kpi-overdue-ar"
                />
              </div>
            </DashboardSection>

            {/* ---------- Layer 2 ---------- */}
            <DashboardSection title={tc('dashboardShell.layer2')} subtitle={t('marginSeparateNote')}>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <ChartCard
                  title={t('chartRevenueTrend')}
                  columns={[tc('dashboardShell.month'), t('kpiRevenue')]}
                  rows={data.revenueTrend.map((p) => [p.month, formatBaht(p.value)])}
                  testId="chart-revenue-trend"
                >
                  <TrendColumns
                    points={data.revenueTrend.map((p) => ({ label: p.month, value: p.value }))}
                    valueFormatter={(v) => formatBaht(v)}
                    emptyText={tc('dashboardShell.noData')}
                  />
                </ChartCard>

                <ChartCard
                  title={t('chartMarginTrend')}
                  columns={[tc('dashboardShell.month'), t('kpiGrossMargin')]}
                  rows={data.marginTrend.map((p) => [p.month, p.percent == null ? '—' : `${formatNumber(p.percent, 1)}%`])}
                  testId="chart-margin-trend"
                >
                  <TrendColumns
                    points={data.marginTrend.map((p) => ({ label: p.month, value: p.percent }))}
                    valueFormatter={(v) => `${formatNumber(v, 1)}%`}
                    targetValue={k?.grossMargin.target}
                    targetLabel={`${tc('dashboardShell.target')} ${k?.grossMargin.target}%`}
                    emptyText={tc('dashboardShell.noData')}
                  />
                </ChartCard>

                <ChartCard
                  title={t('colCustomer')}
                  columns={[t('colCustomer'), t('colValue'), t('kpiGrossMargin')]}
                  rows={data.topCustomers.map((c) => [c.name, formatBaht(c.value), c.marginPercent == null ? '—' : `${formatNumber(c.marginPercent, 1)}%`])}
                  testId="chart-top-customers"
                >
                  {/* The margin note under each bar is the point of this chart:
                      the biggest customer is often the thinnest-margin one. */}
                  <BarList
                    rows={data.topCustomers.map((c) => ({
                      label: c.name,
                      value: c.value,
                      note: c.marginPercent == null ? undefined : `${t('kpiGrossMargin')} ${formatNumber(c.marginPercent, 1)}%`,
                    }))}
                    valueFormatter={(v) => formatBaht(v)}
                    emptyText={tc('dashboardShell.noData')}
                  />
                </ChartCard>

                <ChartCard
                  title={t('chartFunnel')}
                  columns={[tc('dashboardShell.value'), tc('dashboardShell.count')]}
                  rows={data.funnel.map((f) => [stageLabel(f.stage), f.count])}
                  testId="chart-funnel"
                >
                  {/* Funnel stages are ordered, so a single-hue ramp. */}
                  <BarList
                    rows={data.funnel.map((f) => ({
                      label: stageLabel(f.stage),
                      value: f.count,
                      note: f.value > 0 ? formatBaht(f.value) : undefined,
                    }))}
                    valueFormatter={(v) => formatNumber(v, 0)}
                    colorFor={(i) => SEQUENTIAL_BLUES[Math.min(i, SEQUENTIAL_BLUES.length - 1)]}
                    emptyText={tc('dashboardShell.noData')}
                  />
                </ChartCard>
              </div>
            </DashboardSection>

            {/* ---------- Layer 3 ---------- */}
            <DashboardSection title={tc('dashboardShell.layer3')}>
              <div className="overflow-x-auto rounded-[14px] border border-emerald-100 bg-white p-4 shadow-[0_4px_14px_rgba(6,78,59,0.05)]">
                <h3 className="mb-2 text-sm font-semibold text-[#0F2E22]">{t('tableDueSoon')}</h3>
                {data.dueSoon.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">{t('noDueSoon')}</p>
                ) : (
                  <table className="w-full min-w-[680px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                        <th className="pb-2 pr-3 font-medium">{t('colSo')}</th>
                        <th className="pb-2 pr-3 font-medium">{t('colCustomer')}</th>
                        <th className="pb-2 pr-3 font-medium">{t('colRequired')}</th>
                        <th className="pb-2 text-right font-medium">{t('colValue')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.dueSoon.map((o) => (
                        <tr
                          key={o.id}
                          className="cursor-pointer border-b border-gray-100 hover:bg-amber-50/40"
                          onClick={() => router.push(`/sales/orders/${o.id}`)}
                        >
                          <td className="py-2 pr-3 font-mono text-xs font-semibold text-amber-700">{o.soNumber}</td>
                          <td className="py-2 pr-3">{o.customerName ?? '—'}</td>
                          <td className="py-2 pr-3 whitespace-nowrap text-xs text-gray-600">{o.requiredDate ?? '—'}</td>
                          <td className="py-2 text-right tabular-nums">{formatBaht(o.value)}</td>
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
    </MainLayout>
  );
}

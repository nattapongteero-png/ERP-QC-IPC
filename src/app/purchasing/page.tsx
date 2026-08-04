'use client';

/**
 * Purchasing dashboard.
 *
 * Replaces the redirect to the PO list. Same three layers as production so the
 * two screens read the same way.
 *
 * PPV is shown as a tile with an explicit "not available" reason rather than a
 * number: it needs an agreed baseline price, and inventing one would put a
 * figure in front of finance that nobody can defend.
 */
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import {
  DashboardSection, KpiTile, ChartCard, BarList, TrendColumns,
  SERIES_COLORS, STATUS_COLORS, type KpiStatus,
} from '@/components/dashboard/dashboard-shell';
import { formatNumber, formatBaht } from '@/lib/utils/number-format';
import { ShoppingCart } from 'lucide-react';

interface Dash {
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
  lateOrders: Array<{ id: number; poNumber: string; vendorName: string | null; expectedDate: string | null; daysLate: number; outstandingValue: number }>;
}

export default function PurchasingDashboardPage() {
  const router = useRouter();
  const tc = useTranslations('common');
  const tRoot = useTranslations('purchasing');
  const t = (k: string, v?: Record<string, string | number>) => tRoot(`dashboard.${k}`, v as never);

  const { data, isLoading, error } = useQuery<Dash>({
    queryKey: ['purchasing-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/purchasing/dashboard');
      const j = await res.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
  });

  const pctText = (v: number | null | undefined) => (v == null ? null : `${formatNumber(v, 1)}%`);
  const st = (s?: string): KpiStatus =>
    s === 'on_target' ? 'on_target' : s === 'below_target' ? 'below_target' : 'unknown';
  /** The tail bucket is a label, not a vendor name — translate it at the edge. */
  const vendorLabel = (n: string) => (n === '__other__' ? tc('dashboardShell.other') : n);

  const k = data?.kpis;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      <ResponsivePageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        icon={ShoppingCart}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
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
                label={t('kpiSpend')}
                value={formatBaht(k?.spendWindow.value ?? 0)}
                sub={t('kpiSpendSub', { orders: k?.spendWindow.orders ?? 0, days: data.window.days })}
                testId="kpi-spend"
              />
              <KpiTile
                label={t('kpiOtd')}
                value={pctText(k?.onTimeDelivery.value)}
                sub={t('kpiOtdSub', { onTime: k?.onTimeDelivery.onTime ?? 0, received: k?.onTimeDelivery.received ?? 0 })}
                target={`≥ ${k?.onTimeDelivery.target}%`}
                status={st(k?.onTimeDelivery.status)}
                testId="kpi-otd"
              />
              <KpiTile
                label={t('kpiOpenReceipts')}
                value={formatBaht(k?.openReceipts.value ?? 0)}
                sub={t('kpiOpenReceiptsSub', { count: k?.openReceipts.count ?? 0 })}
                testId="kpi-open-receipts"
              />
              <KpiTile
                label={t('kpiCycle')}
                value={k?.poCycleDays.value == null ? null : formatNumber(k.poCycleDays.value, 1)}
                unit={tc('dashboardShell.count') === 'Count' ? 'days' : 'วัน'}
                sub={t('kpiCycleSub', { samples: k?.poCycleDays.samples ?? 0 })}
                target={`≤ ${k?.poCycleDays.target}`}
                status={st(k?.poCycleDays.status)}
                testId="kpi-cycle"
              />
              <KpiTile
                label={t('kpiAcceptance')}
                value={pctText(k?.incomingAcceptance.value)}
                sub={t('kpiAcceptanceSub', { accepted: k?.incomingAcceptance.accepted ?? 0, total: k?.incomingAcceptance.total ?? 0 })}
                target={`≥ ${k?.incomingAcceptance.target}%`}
                status={st(k?.incomingAcceptance.status)}
                testId="kpi-acceptance"
              />
              <KpiTile
                label={t('kpiConcentration')}
                value={pctText(k?.top3Concentration.value)}
                sub={t('kpiConcentrationSub')}
                target={`≤ ${k?.top3Concentration.target}%`}
                status={st(k?.top3Concentration.status)}
                testId="kpi-concentration"
              />
              {/* Deliberately blank with a reason, not zero. */}
              <KpiTile
                label={t('kpiPpv')}
                value={null}
                sub={
                  k?.ppv.unavailableReason === 'standard_cost_not_set'
                    ? t('ppvUnavailableStandard')
                    : t('ppvUnavailableBaseline')
                }
                status="unknown"
                testId="kpi-ppv"
              />
            </div>
          </DashboardSection>

          {/* ---------- Layer 2 ---------- */}
          <DashboardSection title={tc('dashboardShell.layer2')}>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <ChartCard
                title={t('chartSpendTrend')}
                columns={[tc('dashboardShell.month'), t('colSpend'), tc('dashboardShell.count')]}
                rows={data.spendTrend.map((p) => [p.month, formatBaht(p.value), p.orders])}
                testId="chart-spend-trend"
              >
                <TrendColumns
                  points={data.spendTrend.map((p) => ({ label: p.month, value: p.value }))}
                  valueFormatter={(v) => formatBaht(v)}
                  emptyText={tc('dashboardShell.noData')}
                />
              </ChartCard>

              <ChartCard
                title={t('chartTopVendors')}
                columns={[t('colVendor'), t('colSpend'), t('colOtd')]}
                rows={data.topVendors.map((v) => [vendorLabel(v.name), formatBaht(v.value), v.otdPercent == null ? '—' : `${formatNumber(v.otdPercent, 1)}%`])}
                testId="chart-top-vendors"
              >
                <BarList
                  rows={data.topVendors.map((v) => ({
                    label: vendorLabel(v.name),
                    value: v.value,
                    note: v.otdPercent == null ? undefined : `${t('colOtd')} ${formatNumber(v.otdPercent, 1)}%`,
                  }))}
                  valueFormatter={(v) => formatBaht(v)}
                  emptyText={tc('dashboardShell.noData')}
                />
              </ChartCard>

              <ChartCard
                title={t('chartOtdByVendor')}
                columns={[t('colVendor'), t('colOtd'), t('colReceipts')]}
                rows={data.otdByVendor.map((v) => [v.name, `${formatNumber(v.otdPercent, 1)}%`, v.receipts])}
                testId="chart-otd-vendor"
              >
                {/* Colour carries meaning here: under the target is a problem, so
                    it is red — a status colour, never reused as a series colour. */}
                <BarList
                  rows={data.otdByVendor.map((v) => ({
                    label: v.name,
                    value: v.otdPercent,
                    note: `${v.receipts} × · ${tc('dashboardShell.target')} ${v.target}%`,
                  }))}
                  valueFormatter={(v) => `${formatNumber(v, 1)}%`}
                  colorFor={(_i, row) =>
                    row.value < (data.otdByVendor[0]?.target ?? 95) ? STATUS_COLORS.bad : STATUS_COLORS.good
                  }
                  emptyText={tc('dashboardShell.noData')}
                />
              </ChartCard>

              <ChartCard
                title={t('tableLate')}
                columns={[t('colPo'), t('colVendor'), t('colDaysLate')]}
                rows={data.lateOrders.slice(0, 8).map((o) => [o.poNumber, o.vendorName ?? '—', o.daysLate])}
                testId="chart-late-summary"
              >
                <BarList
                  rows={data.lateOrders.slice(0, 8).map((o) => ({
                    label: `${o.poNumber} · ${o.vendorName ?? '—'}`,
                    value: o.daysLate,
                    note: formatBaht(o.outstandingValue),
                  }))}
                  valueFormatter={(v) => `${formatNumber(v, 0)}`}
                  colorFor={() => SERIES_COLORS[1]}
                  emptyText={t('noLate')}
                />
              </ChartCard>
            </div>
          </DashboardSection>

          {/* ---------- Layer 3 ---------- */}
          <DashboardSection title={tc('dashboardShell.layer3')}>
            <div className="overflow-x-auto rounded-[14px] border border-emerald-100 bg-white p-4 shadow-[0_4px_14px_rgba(6,78,59,0.05)]">
              <h3 className="mb-2 text-sm font-semibold text-[#0F2E22]">{t('tableLate')}</h3>
              {data.lateOrders.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">{t('noLate')}</p>
              ) : (
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                      <th className="pb-2 pr-3 font-medium">{t('colPo')}</th>
                      <th className="pb-2 pr-3 font-medium">{t('colVendor')}</th>
                      <th className="pb-2 pr-3 font-medium">{t('colExpected')}</th>
                      <th className="pb-2 pr-3 text-right font-medium">{t('colDaysLate')}</th>
                      <th className="pb-2 text-right font-medium">{t('colOutstanding')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lateOrders.map((o) => (
                      <tr
                        key={o.id}
                        className="cursor-pointer border-b border-gray-100 hover:bg-blue-50/40"
                        onClick={() => router.push(`/purchasing/orders/${o.id}`)}
                      >
                        <td className="py-2 pr-3 font-mono text-xs font-semibold text-blue-700">{o.poNumber}</td>
                        <td className="py-2 pr-3">{o.vendorName ?? '—'}</td>
                        <td className="py-2 pr-3 whitespace-nowrap text-xs text-gray-600">{o.expectedDate ?? '—'}</td>
                        <td className="py-2 pr-3 text-right font-semibold tabular-nums text-rose-700">{o.daysLate}</td>
                        <td className="py-2 text-right tabular-nums">{formatBaht(o.outstandingValue)}</td>
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

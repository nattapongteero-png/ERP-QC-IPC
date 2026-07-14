'use client';

// Executive Accounting Dashboard - Redesign
// Feature: 014-unit-cost (Executive Dashboard Redesign) + 015-i18n responsive refactor
// Executive-level insights with actionable metrics and priority-based alerts

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toLocalDateStr } from '@/lib/utils/date-format';
import Link from 'next/link';
import {
  FileText,
  Receipt,
  DollarSign,
  Building2,
  Wrench,
  BarChart3,
  CalendarCheck,
  Landmark,
  RefreshCw,
} from 'lucide-react';
import { ResponsivePageHeader } from '@/components/shared';
import {
  ExecutiveKPICard,
  ExecutiveKPICardSkeleton,
  ExecutiveAlertBar,
  ExecutiveAlertBarSkeleton,
} from '@/components/accounting';
import { RevenueExpensesTrend, ExpenseBreakdownChart } from '@/components/accounting/charts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ExecutiveMetrics, ExecutiveAlert, ExpenseCategory } from '@/types/accounting';

type Period = 'MTD' | 'QTD' | 'YTD';

// Fetch executive metrics from API
async function fetchExecutiveMetrics(period: Period): Promise<ExecutiveMetrics> {
  const today = toLocalDateStr(new Date());
  const res = await fetch(`/api/accounting/dashboard/executive-metrics?asOfDate=${today}&period=${period}`);
  if (!res.ok) throw new Error('Failed to fetch executive metrics');
  const data = await res.json();
  return data.data;
}

// Fetch alerts from API
async function fetchAlerts(): Promise<ExecutiveAlert[]> {
  const today = toLocalDateStr(new Date());
  const res = await fetch(`/api/accounting/dashboard/alerts?asOfDate=${today}`);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  const data = await res.json();
  return data.data || [];
}

interface TrendDataPoint {
  month: string;
  revenue: number;
  cogs: number;
  operatingExpenses: number;
  netIncome: number;
  [key: string]: string | number; // Index signature for recharts compatibility
}

interface DashboardChartData {
  trend: TrendDataPoint[];
  expenseBreakdown: { categories: ExpenseCategory[]; totalExpenses: number };
}

// Fetch chart data from API — computed from posted journal lines
async function fetchChartData(): Promise<DashboardChartData> {
  const today = toLocalDateStr(new Date());
  const res = await fetch(`/api/accounting/dashboard/charts?asOfDate=${today}`);
  if (!res.ok) throw new Error('Failed to fetch chart data');
  const data = await res.json();
  return data.data;
}

export default function AccountingDashboardPage() {
  const t = useTranslations('accounting');
  const [period, setPeriod] = useState<Period>('YTD');

  // Quick links organized by category - needs to be inside component for translations
  const quickLinkGroups = useMemo(() => [
    {
      title: t('dashboard.quickLinks.financialStatements'),
      links: [
        { name: t('dashboard.quickLinks.trialBalance'), href: '/accounting/reports/trial-balance', icon: Landmark },
        { name: t('dashboard.quickLinks.balanceSheet'), href: '/accounting/reports/balance-sheet', icon: BarChart3 },
        { name: t('dashboard.quickLinks.incomeStatement'), href: '/accounting/reports/income-statement', icon: BarChart3 },
        { name: t('dashboard.quickLinks.cashFlow'), href: '/accounting/reports/cash-flow', icon: DollarSign },
      ],
    },
    {
      title: t('dashboard.quickLinks.receivables'),
      links: [
        { name: t('dashboard.quickLinks.arInvoices'), href: '/accounting/ar/invoices', icon: FileText },
        { name: t('dashboard.quickLinks.arAging'), href: '/accounting/ar/aging', icon: BarChart3 },
        { name: t('dashboard.quickLinks.receipts'), href: '/accounting/ar/receipts', icon: Receipt },
      ],
    },
    {
      title: t('dashboard.quickLinks.payables'),
      links: [
        { name: t('dashboard.quickLinks.apInvoices'), href: '/accounting/ap/invoices', icon: FileText },
        { name: t('dashboard.quickLinks.apAging'), href: '/accounting/ap/aging', icon: BarChart3 },
        { name: t('dashboard.quickLinks.payments'), href: '/accounting/ap/payments', icon: DollarSign },
      ],
    },
    {
      title: t('dashboard.quickLinks.assetsOperations'),
      links: [
        { name: t('dashboard.quickLinks.fixedAssets'), href: '/accounting/fixed-assets', icon: Building2 },
        { name: t('dashboard.quickLinks.equipment'), href: '/accounting/equipment', icon: Wrench },
        { name: t('dashboard.quickLinks.periodClose'), href: '/accounting/period-close', icon: CalendarCheck },
      ],
    },
  ], [t]);

  const {
    data: metrics,
    isLoading: metricsLoading,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ['executive-metrics', period],
    queryFn: () => fetchExecutiveMetrics(period),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const {
    data: chartData,
    isLoading: chartsLoading,
    refetch: refetchCharts,
  } = useQuery({
    queryKey: ['executive-charts'],
    queryFn: fetchChartData,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: alerts = [],
    isLoading: alertsLoading,
    refetch: refetchAlerts,
  } = useQuery({
    queryKey: ['executive-alerts'],
    queryFn: fetchAlerts,
    staleTime: 1 * 60 * 1000,
    refetchInterval: 1 * 60 * 1000,
  });

  const handleRefresh = () => {
    refetchMetrics();
    refetchAlerts();
    refetchCharts();
  };

  const trendData = chartData?.trend ?? [];
  const expenseData = chartData?.expenseBreakdown.categories ?? [];
  const totalExpenses = chartData?.expenseBreakdown.totalExpenses ?? 0;

  const kpiRow1 = metrics
    ? [metrics.workingCapital, metrics.currentRatio, metrics.quickRatio, metrics.dso]
    : [];
  const kpiRow2 = metrics
    ? [metrics.grossProfitMargin, metrics.operatingCashFlow, metrics.dpo, metrics.inventoryTurnover]
    : [];

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full" data-testid="accounting-dashboard">
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.description')}
        icon={BarChart3}
        iconBgColor="bg-indigo-100"
        iconColor="text-indigo-600"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Period Selector - always visible, compact on mobile */}
            <div
              className="flex rounded-lg border border-gray-200 bg-white p-1"
              data-testid="period-selector"
            >
              {(['MTD', 'QTD', 'YTD'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors min-h-[36px] ${
                    period === p
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  data-testid={`period-${p.toLowerCase()}`}
                >
                  {t(`dashboard.periods.${p.toLowerCase()}` as const)}
                </button>
              ))}
            </div>

            {/* Refresh Button - icon-only on very small screens */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="gap-2 min-h-[36px]"
              data-testid="refresh-button"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">{t('dashboard.refresh')}</span>
            </Button>
          </div>
        }
      />

      {/* Alert Bar */}
      {alertsLoading ? (
        <ExecutiveAlertBarSkeleton />
      ) : alerts.length > 0 ? (
        <ExecutiveAlertBar alerts={alerts} />
      ) : null}

      {/* KPI Row 1: Financial Health — 2 cols on mobile, 4 on desktop */}
      <div>
        <h2 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          {t('dashboard.sections.financialHealth')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {metricsLoading ? (
            <>
              <ExecutiveKPICardSkeleton />
              <ExecutiveKPICardSkeleton />
              <ExecutiveKPICardSkeleton />
              <ExecutiveKPICardSkeleton />
            </>
          ) : (
            kpiRow1.map((kpi) => (
              <ExecutiveKPICard key={kpi.id} kpi={kpi} data-testid={`kpi-${kpi.id}`} />
            ))
          )}
        </div>
      </div>

      {/* KPI Row 2: Business Performance — 2 cols on mobile, 4 on desktop */}
      <div>
        <h2 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          {t('dashboard.sections.businessPerformance')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {metricsLoading ? (
            <>
              <ExecutiveKPICardSkeleton />
              <ExecutiveKPICardSkeleton />
              <ExecutiveKPICardSkeleton />
              <ExecutiveKPICardSkeleton />
            </>
          ) : (
            kpiRow2.map((kpi) => (
              <ExecutiveKPICard key={kpi.id} kpi={kpi} data-testid={`kpi-${kpi.id}`} />
            ))
          )}
        </div>
      </div>

      {/* Charts Section — hidden on mobile (too cramped to read) */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {metricsLoading ? (
          <>
            <ChartSkeleton className="lg:col-span-2" height={320} />
            <ChartSkeleton height={320} />
          </>
        ) : (
          <>
            <RevenueExpensesTrend
              data={trendData}
              isLoading={chartsLoading}
              className="lg:col-span-2"
            />
            <ExpenseBreakdownChart
              data={expenseData}
              totalExpenses={totalExpenses}
              isLoading={chartsLoading}
            />
          </>
        )}
      </div>

      {/* Quick Access — touch-friendly tiles, 2 cols on mobile, 4 on desktop */}
      <div data-testid="quick-links">
        <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">
          {t('dashboard.sections.quickAccess')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {quickLinkGroups.map((group) => (
            <Card key={group.title} className="overflow-hidden">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm md:text-base">
                  {group.title}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
                  {group.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      data-testid={`quick-link-${link.href.split('/').pop()?.replace('?', '-')}`}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-indigo-50 active:bg-indigo-100 transition-colors text-xs md:text-sm text-gray-700 hover:text-indigo-700 min-h-[44px]"
                    >
                      <link.icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{link.name}</span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

/** Chart skeleton placeholder — used during metrics loading */
function ChartSkeleton({ className = '', height }: { className?: string; height: number }) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-gradient-to-br from-gray-100 to-gray-50 animate-pulse ${className}`}
      style={{ height }}
      aria-busy="true"
      aria-live="polite"
    />
  );
}

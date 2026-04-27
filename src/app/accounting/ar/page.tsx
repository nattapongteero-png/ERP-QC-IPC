'use client';

/**
 * AR Dashboard Page
 * Feature: 010-accounting-module-integration
 * Accounts Receivable overview with KPIs, navigation, and activity monitoring
 *
 * Refactored for responsive + informative + user-friendly:
 * - ResponsivePageHeader + StatCard KPI row
 * - Mobile Card View (44px tap targets)
 * - Empty / No-results / Skeleton states
 * - Responsive filters, scroll-snap tabs
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toLocalDateStr } from '@/lib/utils/date-format';
import Link from 'next/link';
import {
  FileText,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  ChevronRight,
  Users,
  Banknote,
  Wallet,
  Clock,
  CheckCircle2,
  RefreshCw,
  CalendarDays,
  Inbox,
  SearchX,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { AccountingStatusBadge } from '@/components/accounting';
import { DxButton } from '@/components/ui/dx-button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils/cn';

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

interface ARInvoice {
  id: number;
  invoiceNumber: string;
  customerId: number;
  customerName?: string;
  invoiceDate: string;
  dueDate: string;
  description: string | null;
  subtotal: number;
  vatAmount: number;
  whtAmount: number;
  totalAmount: number;
  paidAmount: number;
  currency: string;
  status: 'draft' | 'approved' | 'posted' | 'partial' | 'paid' | 'cancelled';
  journalEntryId: number | null;
}

interface DashboardMetrics {
  totalReceivables: number;
  pendingInvoices: number;
  overdueAmount: number;
  overdueCount: number;
  collectedThisMonth: number;
  collectedAmountThisMonth: number;
  recentInvoices: ARInvoice[];
  agingBuckets: {
    current: number;
    days30: number;
    days60: number;
    days90: number;
    over90: number;
  };
}

async function fetchARDashboardMetrics(): Promise<DashboardMetrics> {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStr = toLocalDateStr(firstDayOfMonth);

  const [allInvoicesRes, agingRes] = await Promise.all([
    fetch('/api/accounting/ar-invoices').catch(() => null),
    fetch(`/api/accounting/reports/aging?type=AR&asOfDate=${toLocalDateStr(new Date())}`).catch(() => null),
  ]);

  const allInvoices = allInvoicesRes?.ok ? await allInvoicesRes.json() : { data: [] };
  const agingData = agingRes?.ok ? await agingRes.json() : { data: { totals: {} } };

  const invoices = allInvoices.data || [];

  // Calculate metrics
  const totalReceivables = invoices
    .filter((i: ARInvoice) => ['posted', 'partial'].includes(i.status))
    .reduce((sum: number, i: ARInvoice) => sum + (i.totalAmount - i.paidAmount), 0);

  const pendingInvoices = invoices.filter(
    (i: ARInvoice) => i.status === 'draft' || i.status === 'approved'
  ).length;

  const today = toLocalDateStr(new Date());
  const overdueInvoices = invoices.filter(
    (i: ARInvoice) =>
      ['posted', 'partial'].includes(i.status) && i.dueDate < today
  );
  const overdueAmount = overdueInvoices.reduce(
    (sum: number, i: ARInvoice) => sum + (i.totalAmount - i.paidAmount),
    0
  );
  const overdueCount = overdueInvoices.length;

  const collectedThisMonthInvoices = invoices.filter(
    (i: ARInvoice) => i.status === 'paid' && i.invoiceDate >= monthStr
  );
  const collectedThisMonth = collectedThisMonthInvoices.length;
  const collectedAmountThisMonth = collectedThisMonthInvoices.reduce(
    (sum: number, i: ARInvoice) => sum + i.paidAmount,
    0
  );

  // Get recent invoices (last 10)
  const recentInvoices = [...invoices]
    .sort((a: ARInvoice, b: ARInvoice) =>
      new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime()
    )
    .slice(0, 10);

  const agingBuckets = {
    current: agingData.data?.totals?.current || 0,
    days30: agingData.data?.totals?.days30 || 0,
    days60: agingData.data?.totals?.days60 || 0,
    days90: agingData.data?.totals?.days90 || 0,
    over90: agingData.data?.totals?.over90 || 0,
  };

  return {
    totalReceivables,
    pendingInvoices,
    overdueAmount,
    overdueCount,
    collectedThisMonth,
    collectedAmountThisMonth,
    recentInvoices,
    agingBuckets,
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompactCurrency(amount: number): string {
  if (Math.abs(amount) >= 1000000) {
    return `฿${(amount / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1000) {
    return `฿${(amount / 1000).toFixed(0)}K`;
  }
  return formatCurrency(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function isOverdue(invoice: ARInvoice, todayStr: string): boolean {
  return ['posted', 'partial'].includes(invoice.status) && invoice.dueDate < todayStr;
}

type NavKey = 'invoices' | 'receipts' | 'aging';

const quickNavCards: Array<{
  key: NavKey;
  href: string;
  icon: typeof FileText;
  color: string;
  borderColor: string;
  hoverColor: string;
}> = [
  {
    key: 'invoices',
    href: '/accounting/ar/invoices',
    icon: FileText,
    color: 'bg-emerald-50 text-emerald-600',
    borderColor: 'border-emerald-200',
    hoverColor: 'hover:border-emerald-300',
  },
  {
    key: 'receipts',
    href: '/accounting/ar/receipts',
    icon: Banknote,
    color: 'bg-blue-50 text-blue-600',
    borderColor: 'border-blue-200',
    hoverColor: 'hover:border-blue-300',
  },
  {
    key: 'aging',
    href: '/accounting/ar/aging',
    icon: BarChart3,
    color: 'bg-purple-50 text-purple-600',
    borderColor: 'border-purple-200',
    hoverColor: 'hover:border-purple-300',
  },
];

type StatusFilter = 'all' | 'overdue' | 'open' | 'paid';

export default function ARDashboardPage() {
  const t = useTranslations('accounting');
  const { isMobile } = useMobile();
  const [filter, setFilter] = useState<StatusFilter>('all');

  const { data: metrics, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['ar-dashboard-metrics'],
    queryFn: fetchARDashboardMetrics,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const todayStr = useMemo(() => toLocalDateStr(new Date()), []);

  const agingData = metrics ? [
    { name: t('accountsReceivable.agingBuckets.current'), amount: metrics.agingBuckets.current },
    { name: t('accountsReceivable.agingBuckets.days1_30'), amount: metrics.agingBuckets.days30 },
    { name: t('accountsReceivable.agingBuckets.days31_60'), amount: metrics.agingBuckets.days60 },
    { name: t('accountsReceivable.agingBuckets.days61_90'), amount: metrics.agingBuckets.days90 },
    { name: t('accountsReceivable.agingBuckets.days90Plus'), amount: metrics.agingBuckets.over90 },
  ] : [];

  const hasOverdue = !!metrics && metrics.overdueAmount > 0;

  // Recent invoices filtered by tab
  const filteredRecent = useMemo(() => {
    const recent = metrics?.recentInvoices || [];
    switch (filter) {
      case 'overdue':
        return recent.filter((i) => isOverdue(i, todayStr));
      case 'open':
        return recent.filter((i) => ['draft', 'approved', 'posted', 'partial'].includes(i.status));
      case 'paid':
        return recent.filter((i) => i.status === 'paid');
      default:
        return recent;
    }
  }, [metrics, filter, todayStr]);

  const tabCounts: Record<StatusFilter, number> = {
    all: metrics?.recentInvoices.length || 0,
    overdue: metrics?.recentInvoices.filter((i) => isOverdue(i, todayStr)).length || 0,
    open: metrics?.recentInvoices.filter((i) =>
      ['draft', 'approved', 'posted', 'partial'].includes(i.status)
    ).length || 0,
    paid: metrics?.recentInvoices.filter((i) => i.status === 'paid').length || 0,
  };

  const tabs: Array<{ key: StatusFilter; labelKey: string; activeClass: string }> = [
    { key: 'all', labelKey: 'filters.all', activeClass: 'bg-gray-900 text-white' },
    { key: 'overdue', labelKey: 'filters.overdue', activeClass: 'bg-red-600 text-white' },
    { key: 'open', labelKey: 'filters.open', activeClass: 'bg-blue-600 text-white' },
    { key: 'paid', labelKey: 'filters.paid', activeClass: 'bg-emerald-600 text-white' },
  ];

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full" data-testid="ar-dashboard">
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title={t('accountsReceivable.title')}
        subtitle={t('accountsReceivable.description')}
        icon={Wallet}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              text={t('accountsReceivable.refresh')}
              stylingMode="outlined"
              onClick={() => refetch()}
              disabled={isFetching}
              className="hidden sm:inline-flex"
            />
            <DxButton
              icon="chart"
              text={t('accountsReceivable.actions.viewAging')}
              stylingMode="outlined"
              onClick={() => { window.location.href = '/accounting/ar/aging'; }}
              className="hidden md:inline-flex"
            />
            <DxButton
              text={t('accountsReceivable.actions.createInvoice')}
              icon="plus"
              type="success"
              onClick={() => { window.location.href = '/accounting/ar/invoices'; }}
            />
          </div>
        }
      />

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4" data-testid="ar-stats">
        <StatCard
          label={t('accountsReceivable.stats.totalReceivable')}
          value={isLoading ? '—' : formatCompactCurrency(metrics?.totalReceivables || 0)}
          icon={TrendingUp}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('accountsReceivable.stats.overdue')}
          value={isLoading ? '—' : formatCompactCurrency(metrics?.overdueAmount || 0)}
          icon={AlertTriangle}
          iconColor="text-red-500"
          accentColor="border-red-500"
          isLoading={isLoading}
          trend={metrics?.overdueCount
            ? { direction: 'up', value: t('accountsReceivable.stats.invoicesPastDue', { count: metrics.overdueCount }) }
            : { direction: 'neutral', value: t('accountsReceivable.stats.onTrack') }}
        />
        <StatCard
          label={t('accountsReceivable.stats.pendingInvoices')}
          value={isLoading ? '—' : (metrics?.pendingInvoices || 0)}
          icon={Clock}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('accountsReceivable.stats.collectedThisMonth')}
          value={isLoading ? '—' : formatCompactCurrency(metrics?.collectedAmountThisMonth || 0)}
          icon={CheckCircle2}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
          trend={metrics?.collectedThisMonth
            ? { direction: 'up', value: t('accountsReceivable.stats.receiptsCount', { count: metrics.collectedThisMonth }) }
            : undefined}
        />
      </div>

      {/* Alert Banner for Overdue */}
      {hasOverdue && metrics && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-amber-800">{t('accountsReceivable.alert.title')}</h3>
              <p className="text-sm text-amber-700 mt-1">
                {t('accountsReceivable.alert.message', {
                  amount: formatCurrency(metrics.overdueAmount),
                  count: metrics.overdueCount,
                })}
              </p>
              <Link
                href="/accounting/ar/invoices?status=overdue"
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-white/70 hover:bg-white rounded-lg transition-colors text-sm font-medium text-amber-700 min-h-[40px]"
              >
                {t('accountsReceivable.alert.viewOverdue')}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Quick Navigation Cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
          {t('accountsReceivable.quickAccess')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {quickNavCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={cn(
                'group flex flex-col p-4 sm:p-5 bg-white border rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer min-h-[120px]',
                card.borderColor,
                card.hoverColor
              )}
            >
              <div className={cn('p-3 rounded-lg w-fit', card.color)}>
                <card.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-3 sm:mt-4 font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                {t(`accountsReceivable.navCards.${card.key}.name`)}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {t(`accountsReceivable.navCards.${card.key}.description`)}
              </p>
              <div className="mt-3 sm:mt-4 flex items-center text-emerald-600 text-sm font-medium">
                {t('accountsReceivable.open')}
                <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Two Column Layout: Recent Activity + Aging Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Recent AR Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-w-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-500" />
              {t('accountsReceivable.recentInvoicesTitle')}
            </h3>
            <Link
              href="/accounting/ar/invoices"
              className="hidden sm:inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              {t('accountsReceivable.viewAll')} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Filter tabs with scroll-snap */}
          <div className="px-3 py-2 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
            <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-thin snap-x">
              {tabs.map((tab) => {
                const isActive = filter === tab.key;
                const count = tabCounts[tab.key];
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setFilter(tab.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 snap-start min-h-[36px]',
                      isActive
                        ? cn(tab.activeClass, 'shadow-sm')
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <span>{t(`accountsReceivable.${tab.labelKey}`)}</span>
                    <span
                      className={cn(
                        'ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold',
                        isActive ? 'bg-white/25 text-inherit' : 'bg-gray-200 text-gray-700'
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3 sm:p-4">
            {isLoading ? (
              <InvoiceListSkeleton />
            ) : (metrics?.recentInvoices.length ?? 0) === 0 ? (
              <RecentInvoicesEmpty t={t} />
            ) : filteredRecent.length === 0 ? (
              <NoResultsState onClear={() => setFilter('all')} t={t} />
            ) : isMobile ? (
              <InvoiceCardList invoices={filteredRecent} todayStr={todayStr} t={t} />
            ) : (
              <InvoiceListDesktop invoices={filteredRecent} todayStr={todayStr} t={t} />
            )}

            {/* Mobile: footer view-all link */}
            {!isLoading && filteredRecent.length > 0 && (
              <Link
                href="/accounting/ar/invoices"
                className="sm:hidden block mt-3 text-center text-sm text-emerald-600 hover:text-emerald-700 font-medium py-2 min-h-[44px] flex items-center justify-center gap-1"
              >
                {t('accountsReceivable.viewAllInvoices')} <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>

        {/* Aging Summary Chart */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              {t('accountsReceivable.agingSummaryTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[260px] sm:h-[300px] flex items-center justify-center">
                <div className="flex items-center gap-2 text-gray-400">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{t('accountsReceivable.loadingAgingData')}</span>
                </div>
              </div>
            ) : (
              <div className="h-[260px] sm:h-[300px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agingData} layout="vertical" margin={{ left: 0, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => formatCompactCurrency(value)}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fontSize: 11 }}
                      width={80}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(value as number)}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="amount"
                      name={t('accountsReceivable.agingLegend')}
                      fill="#22c55e"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats Footer */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {metrics?.recentInvoices?.length ?? 0}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                {t('accountsReceivable.footer.recentInvoices')}
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCompactCurrency(metrics?.totalReceivables || 0)}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                {t('accountsReceivable.footer.totalOutstanding')}
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">
                {formatCompactCurrency(metrics?.overdueAmount || 0)}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                {t('accountsReceivable.footer.overdue')}
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {metrics?.collectedThisMonth ?? 0}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                {t('accountsReceivable.footer.collectedThisMonth')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

/** Desktop inline row layout for recent invoices */
function InvoiceListDesktop({
  invoices,
  todayStr,
  t,
}: {
  invoices: ARInvoice[];
  todayStr: string;
  t: TranslateFn;
}) {
  return (
    <div className="space-y-2">
      {invoices.map((invoice) => {
        const overdue = isOverdue(invoice, todayStr);
        return (
          <Link
            key={invoice.id}
            href={`/accounting/ar/invoices?id=${invoice.id}`}
            className={cn(
              'block p-3 rounded-lg border transition-colors',
              overdue
                ? 'border-red-100 bg-red-50/40 hover:bg-red-50'
                : 'border-gray-100 hover:bg-gray-50'
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-medium text-gray-900 truncate">
                    {invoice.invoiceNumber}
                  </span>
                  <AccountingStatusBadge status={invoice.status} />
                  {overdue && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                      <AlertTriangle className="h-3 w-3" />
                      {t('accountsReceivable.overdueBadge')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1 truncate">
                  {invoice.customerName || invoice.description || t('accountsReceivable.details.noDescription')}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {formatDate(invoice.invoiceDate)} • {t('accountsReceivable.details.dueLabel')}: {formatDate(invoice.dueDate)}
                </p>
              </div>
              <div className="text-right ml-2 flex-shrink-0">
                <p className="font-semibold text-gray-900 whitespace-nowrap">
                  {formatCurrency(invoice.totalAmount)}
                </p>
                {invoice.paidAmount > 0 && (
                  <p className="text-xs text-emerald-600 whitespace-nowrap">
                    {t('accountsReceivable.details.received')}: {formatCurrency(invoice.paidAmount)}
                  </p>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/** Mobile card layout for recent invoices — tap targets 44px, overdue highlight */
function InvoiceCardList({
  invoices,
  todayStr,
  t,
}: {
  invoices: ARInvoice[];
  todayStr: string;
  t: TranslateFn;
}) {
  return (
    <div className="space-y-3">
      {invoices.map((invoice) => {
        const overdue = isOverdue(invoice, todayStr);
        const balance = invoice.totalAmount - invoice.paidAmount;
        return (
          <Link
            key={invoice.id}
            href={`/accounting/ar/invoices?id=${invoice.id}`}
            className={cn(
              'block bg-white border rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all',
              overdue ? 'border-red-200' : 'border-gray-200'
            )}
          >
            <div className="p-4 min-h-[44px]">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="font-mono font-semibold text-sm text-gray-900 truncate">
                    {invoice.invoiceNumber}
                  </p>
                  <p className="text-sm text-gray-600 truncate mt-0.5">
                    {invoice.customerName || invoice.description || t('accountsReceivable.details.noDescription')}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <AccountingStatusBadge status={invoice.status} />
                  {overdue && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {t('accountsReceivable.overdueBadge')}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-end justify-between gap-3 mt-2 pt-2 border-t border-gray-100">
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    'text-xs flex items-center gap-1',
                    overdue ? 'text-red-600 font-medium' : 'text-gray-500'
                  )}>
                    <CalendarDays className="h-3 w-3" />
                    {t('accountsReceivable.details.dueLabel')}: {formatDate(invoice.dueDate)}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {t('accountsReceivable.details.issuedLabel')}: {formatDate(invoice.invoiceDate)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-semibold text-gray-900 text-sm whitespace-nowrap">
                    {formatCurrency(invoice.totalAmount)}
                  </p>
                  {invoice.paidAmount > 0 && balance > 0 && (
                    <p className="text-[11px] text-amber-600 whitespace-nowrap">
                      {t('accountsReceivable.details.balance')}: {formatCurrency(balance)}
                    </p>
                  )}
                  {invoice.paidAmount > 0 && balance <= 0 && (
                    <p className="text-[11px] text-emerald-600 whitespace-nowrap">
                      {t('accountsReceivable.details.paidInFull')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/** Loading skeleton for invoice list */
function InvoiceListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="p-3 bg-white border border-gray-100 rounded-lg animate-pulse"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-4 w-16 bg-gray-200 rounded-full" />
              </div>
              <div className="h-3 w-1/2 bg-gray-200 rounded" />
              <div className="h-2.5 w-1/3 bg-gray-200 rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-20 bg-gray-200 rounded ml-auto" />
              <div className="h-3 w-16 bg-gray-200 rounded ml-auto" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Empty state when there are no AR invoices at all */
function RecentInvoicesEmpty({ t }: { t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
        <Inbox className="h-8 w-8 text-emerald-600" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {t('accountsReceivable.emptyRecent.title')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {t('accountsReceivable.emptyRecent.description')}
      </p>
      <Link
        href="/accounting/ar/invoices"
        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium min-h-[40px]"
      >
        <FileText className="h-4 w-4" />
        {t('accountsReceivable.createInvoice')}
      </Link>
    </div>
  );
}

/** No-results state when a filter yields nothing but invoices do exist */
function NoResultsState({ onClear, t }: { onClear: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
        <SearchX className="h-7 w-7 text-gray-400" />
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">
        {t('accountsReceivable.noResultsRecent.title')}
      </h3>
      <p className="text-xs text-gray-500 max-w-sm mb-3">
        {t('accountsReceivable.noResultsRecent.description')}
      </p>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium min-h-[36px]"
      >
        {t('accountsReceivable.noResultsRecent.clear')}
      </button>
    </div>
  );
}

'use client';

/**
 * AP Dashboard Page
 * Feature: 010-accounting-module-integration
 *
 * Accounts Payable overview with KPIs, quick navigation, recent activity, and aging.
 * Responsive: ResponsivePageHeader, StatCard KPI row, mobile card view for recent invoices,
 * empty/no-results states, loading skeletons, touch-friendly tap targets.
 */

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Receipt,
  FileText,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  ChevronRight,
  Clock,
  CheckCircle,
  DollarSign,
  Eye,
  SearchX,
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
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { useMobile } from '@/hooks/use-mobile';
import { toLocalDateStr } from '@/lib/utils/date-format';
import { cn } from '@/lib/utils/cn';

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

interface APInvoice {
  id: number;
  invoiceNumber: string;
  vendorId: number;
  vendorName?: string;
  invoiceDate: string;
  dueDate: string;
  receivedDate: string;
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
  totalPayables: number;
  pendingInvoices: number;
  overdueAmount: number;
  paidThisMonth: number;
  recentInvoices: APInvoice[];
  agingBuckets: {
    current: number;
    days30: number;
    days60: number;
    days90: number;
    over90: number;
  };
}

async function fetchAPDashboardMetrics(): Promise<DashboardMetrics> {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStr = toLocalDateStr(firstDayOfMonth);

  const [allInvoicesRes, agingRes] = await Promise.all([
    fetch('/api/accounting/ap-invoices').catch(() => null),
    fetch(`/api/accounting/reports/aging?type=AP&asOfDate=${toLocalDateStr(new Date())}`).catch(() => null),
  ]);

  const allInvoices = allInvoicesRes?.ok ? await allInvoicesRes.json() : { data: [] };
  const agingData = agingRes?.ok ? await agingRes.json() : { data: { totals: {} } };

  const invoices = allInvoices.data || [];

  const totalPayables = invoices
    .filter((i: APInvoice) => ['posted', 'partial'].includes(i.status))
    .reduce((sum: number, i: APInvoice) => sum + (i.totalAmount - i.paidAmount), 0);

  const pendingInvoices = invoices.filter(
    (i: APInvoice) => i.status === 'draft' || i.status === 'approved'
  ).length;

  const today = toLocalDateStr(new Date());
  const overdueAmount = invoices
    .filter(
      (i: APInvoice) =>
        ['posted', 'partial'].includes(i.status) && i.dueDate < today
    )
    .reduce((sum: number, i: APInvoice) => sum + (i.totalAmount - i.paidAmount), 0);

  const paidThisMonth = invoices.filter(
    (i: APInvoice) => i.status === 'paid' && i.invoiceDate >= monthStr
  ).length;

  const recentInvoices = invoices
    .sort(
      (a: APInvoice, b: APInvoice) =>
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
    totalPayables,
    pendingInvoices,
    overdueAmount,
    paidThisMonth,
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

type NavCardKey = 'invoices' | 'payments' | 'aging';

const quickNavCards: Array<{
  key: NavCardKey;
  href: string;
  icon: typeof Receipt;
  color: string;
  borderColor: string;
  hoverColor: string;
}> = [
  {
    key: 'invoices',
    href: '/accounting/ap/invoices',
    icon: Receipt,
    color: 'bg-orange-50 text-orange-600',
    borderColor: 'border-orange-200',
    hoverColor: 'hover:border-orange-300',
  },
  {
    key: 'payments',
    href: '/accounting/ap/payments',
    icon: CreditCard,
    color: 'bg-blue-50 text-blue-600',
    borderColor: 'border-blue-200',
    hoverColor: 'hover:border-blue-300',
  },
  {
    key: 'aging',
    href: '/accounting/ap/aging',
    icon: BarChart3,
    color: 'bg-purple-50 text-purple-600',
    borderColor: 'border-purple-200',
    hoverColor: 'hover:border-purple-300',
  },
];

export default function APDashboardPage() {
  const t = useTranslations('accounting');
  const router = useRouter();
  const { isMobile } = useMobile();

  const {
    data: metrics,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['ap-dashboard-metrics'],
    queryFn: fetchAPDashboardMetrics,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const agingChartData = metrics
    ? [
        { name: t('accountsPayable.agingBuckets.current'), amount: metrics.agingBuckets.current },
        { name: t('accountsPayable.agingBuckets.days1_30'), amount: metrics.agingBuckets.days30 },
        { name: t('accountsPayable.agingBuckets.days31_60'), amount: metrics.agingBuckets.days60 },
        { name: t('accountsPayable.agingBuckets.days61_90'), amount: metrics.agingBuckets.days90 },
        { name: t('accountsPayable.agingBuckets.days90Plus'), amount: metrics.agingBuckets.over90 },
      ]
    : [];

  const hasOverdue = metrics && metrics.overdueAmount > 0;
  const hasNoInvoices =
    !isLoading && metrics && (metrics.recentInvoices?.length || 0) === 0;

  const today = toLocalDateStr(new Date());

  return (
    <div
      className="flex flex-col gap-5 p-4 md:p-6 max-w-full"
      data-testid="ap-dashboard"
    >
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title={t('accountsPayable.title')}
        subtitle={t('accountsPayable.description')}
        icon={CreditCard}
        iconBgColor="bg-red-100"
        iconColor="text-red-600"
        breadcrumbs={[
          { label: t('page.title'), href: '/accounting' },
          { label: t('accountsPayable.title') },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              text={t('dashboard.refresh')}
              stylingMode="outlined"
              onClick={() => refetch()}
              className="hidden sm:inline-flex"
            />
            <DxButton
              icon="chart"
              text={t('accountsPayable.actions.viewAging')}
              stylingMode="outlined"
              onClick={() => router.push('/accounting/ap/aging')}
              className="hidden md:inline-flex"
            />
            <DxButton
              text={t('accountsPayable.navCards.invoices.name')}
              icon="plus"
              type="success"
              onClick={() => router.push('/accounting/ap/invoices')}
            />
          </div>
        }
      />

      {/* Overdue Alert Banner */}
      {hasOverdue && (
        <div
          role="alert"
          className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-4 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-red-800 text-sm sm:text-base">
                {t('accountsPayable.alert.title')}
              </h3>
              <p className="text-xs sm:text-sm text-red-600 mt-1">
                {t('accountsPayable.alert.message', { amount: formatCurrency(metrics!.overdueAmount) })}
              </p>
              <Link
                href="/accounting/ap/invoices?status=overdue"
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-white/80 rounded-lg hover:bg-white transition-colors text-sm font-medium text-red-700 min-h-[40px]"
              >
                {t('accountsPayable.alert.viewOverdue')}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* KPI Stat Cards — 4 cards, 2 cols on mobile, 4 cols on md+ */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
        data-testid="ap-stats"
      >
        <StatCard
          label={t('accountsPayable.stats.totalOutstanding')}
          value={formatCompactCurrency(metrics?.totalPayables || 0)}
          icon={DollarSign}
          iconColor="text-orange-500"
          accentColor="border-orange-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('accountsPayable.stats.overdueAmount')}
          value={formatCompactCurrency(metrics?.overdueAmount || 0)}
          icon={AlertTriangle}
          iconColor="text-red-500"
          accentColor="border-red-500"
          isLoading={isLoading}
          trend={
            metrics?.overdueAmount
              ? { direction: 'up', value: t('accountsPayable.stats.attentionNeeded') }
              : { direction: 'neutral', value: t('accountsPayable.stats.onTrack') }
          }
        />
        <StatCard
          label={t('accountsPayable.stats.pendingInvoices')}
          value={metrics?.pendingInvoices ?? 0}
          icon={Clock}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('accountsPayable.stats.paidThisMonth')}
          value={metrics?.paidThisMonth ?? 0}
          icon={CheckCircle}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={isLoading}
        />
      </div>

      {/* Quick Navigation Cards */}
      <div>
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">
          {t('accountsPayable.quickAccess')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
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
              <h3 className="mt-3 sm:mt-4 font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {t(`accountsPayable.navCards.${card.key}.name`)}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {t(`accountsPayable.navCards.${card.key}.description`)}
              </p>
              <div className="mt-3 flex items-center text-blue-600 text-sm font-medium">
                {t('accountsPayable.open')}
                <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Two Column Layout: Recent Activity + Aging Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Recent AP Invoices */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-orange-500" />
              {t('accountsPayable.recentInvoicesTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <RecentInvoicesSkeleton isMobile={isMobile} />
            ) : hasNoInvoices ? (
              <EmptyInvoicesState t={t} />
            ) : isMobile ? (
              <RecentInvoicesMobileList
                invoices={metrics!.recentInvoices}
                today={today}
                t={t}
              />
            ) : (
              <RecentInvoicesCompactList
                invoices={metrics!.recentInvoices}
                today={today}
                t={t}
              />
            )}
          </CardContent>
        </Card>

        {/* Aging Summary Chart */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              {t('accountsPayable.agingSummaryTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[260px] sm:h-[300px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400 text-sm">
                  {t('accountsPayable.loadingAgingData')}
                </div>
              </div>
            ) : agingChartData.every((d) => d.amount === 0) ? (
              <NoAgingState t={t} />
            ) : (
              <div className="h-[260px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agingChartData} layout="vertical">
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
                      width={isMobile ? 70 : 100}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(value as number)}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <Legend />
                    <Bar
                      dataKey="amount"
                      name={t('accountsPayable.agingLegend')}
                      fill="#f97316"
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
              <p className="text-xl md:text-2xl font-bold text-gray-900">
                {metrics?.recentInvoices?.length || 0}
              </p>
              <p className="text-xs sm:text-sm text-gray-500">
                {t('accountsPayable.footer.recentInvoices')}
              </p>
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold text-orange-600">
                {formatCompactCurrency(metrics?.totalPayables || 0)}
              </p>
              <p className="text-xs sm:text-sm text-gray-500">
                {t('accountsPayable.footer.totalOutstanding')}
              </p>
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold text-red-600">
                {formatCompactCurrency(metrics?.overdueAmount || 0)}
              </p>
              <p className="text-xs sm:text-sm text-gray-500">
                {t('accountsPayable.footer.overdue')}
              </p>
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold text-emerald-600">
                {metrics?.paidThisMonth || 0}
              </p>
              <p className="text-xs sm:text-sm text-gray-500">
                {t('accountsPayable.footer.paidThisMonth')}
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

/** Mobile-friendly card list for recent AP invoices. Touch-friendly 44px+ footer. */
function RecentInvoicesMobileList({
  invoices,
  today,
  t,
}: {
  invoices: APInvoice[];
  today: string;
  t: TranslateFn;
}) {
  return (
    <div className="space-y-3">
      {invoices.map((invoice) => {
        const outstanding = invoice.totalAmount - invoice.paidAmount;
        const isOverdue =
          ['posted', 'partial'].includes(invoice.status) &&
          invoice.dueDate < today &&
          outstanding > 0;
        return (
          <Link
            key={invoice.id}
            href={`/accounting/ap/invoices?id=${invoice.id}`}
            className={cn(
              'block bg-white border rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all',
              isOverdue ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-200'
            )}
          >
            <div className="p-4 flex items-start gap-3">
              <div
                className={cn(
                  'h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0',
                  isOverdue ? 'bg-red-100' : 'bg-orange-100'
                )}
              >
                <Receipt
                  className={cn(
                    'h-5 w-5',
                    isOverdue ? 'text-red-600' : 'text-orange-600'
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-gray-900 text-sm truncate">
                      {invoice.invoiceNumber}
                    </p>
                    {invoice.vendorName && (
                      <p className="text-sm text-gray-700 truncate mt-0.5">
                        {invoice.vendorName}
                      </p>
                    )}
                  </div>
                  <AccountingStatusBadge status={invoice.status} />
                </div>
                {invoice.description && (
                  <p className="text-xs text-gray-500 truncate mt-1">
                    {invoice.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                    <Clock className="h-3 w-3" />
                    {formatDate(invoice.invoiceDate)}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded',
                      isOverdue
                        ? 'bg-red-50 text-red-700 font-semibold'
                        : 'bg-blue-50 text-blue-700'
                    )}
                  >
                    {t('accountsPayable.details.dueLabel')}: {formatDate(invoice.dueDate)}
                    {isOverdue && <AlertTriangle className="h-3 w-3" />}
                  </span>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-xs text-gray-500">{t('accountsPayable.details.total')}</p>
                    <p className="font-semibold text-gray-900 text-sm">
                      {formatCurrency(invoice.totalAmount)}
                    </p>
                  </div>
                  {invoice.paidAmount > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{t('accountsPayable.details.paid')}</p>
                      <p className="font-medium text-emerald-600 text-sm">
                        {formatCurrency(invoice.paidAmount)}
                      </p>
                    </div>
                  )}
                  {outstanding > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{t('accountsPayable.details.outstanding')}</p>
                      <p
                        className={cn(
                          'font-semibold text-sm',
                          isOverdue ? 'text-red-600' : 'text-orange-600'
                        )}
                      >
                        {formatCurrency(outstanding)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Footer: tap target 44px+ */}
            <div className="flex items-center border-t border-gray-100">
              <div className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors min-h-[44px]">
                <Eye className="h-4 w-4" />
                <span>{t('accountsPayable.viewDetails')}</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          </Link>
        );
      })}
      <Link
        href="/accounting/ap/invoices"
        className="block mt-3 text-center text-sm text-blue-600 hover:text-blue-700 font-medium py-2 min-h-[44px] flex items-center justify-center"
      >
        {t('accountsPayable.viewAllInvoices')} <ChevronRight className="inline h-4 w-4" />
      </Link>
    </div>
  );
}

/** Compact list (desktop) for recent invoices. */
function RecentInvoicesCompactList({
  invoices,
  today,
  t,
}: {
  invoices: APInvoice[];
  today: string;
  t: TranslateFn;
}) {
  return (
    <div className="space-y-2">
      {invoices.map((invoice) => {
        const outstanding = invoice.totalAmount - invoice.paidAmount;
        const isOverdue =
          ['posted', 'partial'].includes(invoice.status) &&
          invoice.dueDate < today &&
          outstanding > 0;
        return (
          <Link
            key={invoice.id}
            href={`/accounting/ap/invoices?id=${invoice.id}`}
            className={cn(
              'block p-3 rounded-lg border transition-colors',
              isOverdue
                ? 'border-red-200 bg-red-50/30 hover:bg-red-50'
                : 'border-gray-100 hover:bg-gray-50'
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-medium text-gray-900 truncate">
                    {invoice.invoiceNumber}
                  </span>
                  <AccountingStatusBadge status={invoice.status} />
                  {isOverdue && (
                    <span className="inline-flex items-center gap-1 text-xs text-red-700 font-semibold">
                      <AlertTriangle className="h-3 w-3" />
                      {t('accountsPayable.details.overdueBadge')}
                    </span>
                  )}
                </div>
                {invoice.vendorName && (
                  <p className="text-sm text-gray-700 truncate mt-0.5">
                    {invoice.vendorName}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDate(invoice.invoiceDate)} • {t('accountsPayable.details.dueLabel')}: {formatDate(invoice.dueDate)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold text-gray-900">
                  {formatCurrency(invoice.totalAmount)}
                </p>
                {invoice.paidAmount > 0 && (
                  <p className="text-xs text-emerald-600">
                    {t('accountsPayable.details.paid')}: {formatCurrency(invoice.paidAmount)}
                  </p>
                )}
                {outstanding > 0 && (
                  <p
                    className={cn(
                      'text-xs font-medium',
                      isOverdue ? 'text-red-600' : 'text-orange-600'
                    )}
                  >
                    {t('accountsPayable.details.outstanding')}: {formatCurrency(outstanding)}
                  </p>
                )}
              </div>
            </div>
          </Link>
        );
      })}
      <Link
        href="/accounting/ap/invoices"
        className="block mt-4 text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        {t('accountsPayable.viewAllInvoices')} →
      </Link>
    </div>
  );
}

/** Skeleton for the recent invoices card while loading. */
function RecentInvoicesSkeleton({ isMobile }: { isMobile: boolean }) {
  const count = isMobile ? 3 : 5;
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'bg-gray-100 rounded-lg animate-pulse',
            isMobile ? 'h-28' : 'h-16'
          )}
        />
      ))}
    </div>
  );
}

/** Empty state — no AP invoices at all. */
function EmptyInvoicesState({ t }: { t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="h-16 w-16 rounded-2xl bg-orange-100 flex items-center justify-center mb-4">
        <Receipt className="h-8 w-8 text-orange-600" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {t('accountsPayable.emptyRecent.title')}
      </h3>
      <p className="text-sm text-gray-500 max-w-xs mb-4">
        {t('accountsPayable.emptyRecent.description')}
      </p>
      <Link
        href="/accounting/ap/invoices"
        className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium min-h-[40px]"
      >
        {t('accountsPayable.emptyRecent.cta')}
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

/** Aging data empty/no-results state. */
function NoAgingState({ t }: { t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center h-[260px] sm:h-[300px] text-center">
      <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
        <SearchX className="h-7 w-7 text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-600">{t('accountsPayable.noAging.title')}</p>
      <p className="text-xs text-gray-400 mt-1 max-w-xs">
        {t('accountsPayable.noAging.description')}
      </p>
    </div>
  );
}

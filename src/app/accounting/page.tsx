'use client';

// Accounting Dashboard - Professional Redesign
// Feature: 010-accounting-module-integration
// A professional, informative accounting dashboard with KPIs, charts, and quick access

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  FileText,
  Receipt,
  DollarSign,
  Building2,
  Wrench,
  BarChart3,
  CalendarCheck,
  TrendingUp,
  AlertTriangle,
  Clock,
  Landmark,
  CreditCard,
  PiggyBank,
  ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingKPICardSkeleton,
} from '@/components/accounting';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface DashboardMetrics {
  totalAccounts: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  cashBalance: number;
  apBalance: number;
  arBalance: number;
  pendingJournalEntries: number;
  currentPeriod: string | null;
  periodStatus: string | null;
  overdueAP: number;
  overdueAR: number;
  upcomingMaintenance: number;
  fixedAssetCount: number;
  equipmentCount: number;
  revenueYtd: number;
  expensesYtd: number;
  netIncomeYtd: number;
  cashFlowTrend: Array<{ month: string; inflow: number; outflow: number }>;
  apAgingBuckets: { current: number; days30: number; days60: number; days90: number; over90: number };
  arAgingBuckets: { current: number; days30: number; days60: number; days90: number; over90: number };
  recentTransactions: Array<{
    id: number;
    date: string;
    description: string;
    amount: number;
    type: 'debit' | 'credit';
  }>;
}

async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const [
    glAccountsRes,
    trialBalanceRes,
    fiscalPeriodsRes,
    apAgingRes,
    arAgingRes,
    maintenanceRes,
    journalEntriesRes,
  ] = await Promise.all([
    fetch('/api/accounting/gl-accounts?isActive=true').catch(() => null),
    fetch(`/api/accounting/reports/trial-balance?asOfDate=${new Date().toISOString().split('T')[0]}`).catch(() => null),
    fetch('/api/accounting/fiscal-periods?isCurrent=true').catch(() => null),
    fetch(`/api/accounting/reports/aging?type=AP&asOfDate=${new Date().toISOString().split('T')[0]}`).catch(() => null),
    fetch(`/api/accounting/reports/aging?type=AR&asOfDate=${new Date().toISOString().split('T')[0]}`).catch(() => null),
    fetch('/api/accounting/maintenance/due?daysAhead=7').catch(() => null),
    fetch('/api/accounting/journal-entries?status=posted&limit=5').catch(() => null),
  ]);

  const glAccounts = glAccountsRes?.ok ? await glAccountsRes.json() : { data: [] };
  const trialBalance = trialBalanceRes?.ok ? await trialBalanceRes.json() : { data: { entries: [] } };
  const fiscalPeriods = fiscalPeriodsRes?.ok ? await fiscalPeriodsRes.json() : { data: [] };
  const apAging = apAgingRes?.ok ? await apAgingRes.json() : { data: { totals: { over90: 0 }, entries: [] } };
  const arAging = arAgingRes?.ok ? await arAgingRes.json() : { data: { totals: { over90: 0 }, entries: [] } };
  const maintenance = maintenanceRes?.ok ? await maintenanceRes.json() : { data: [] };
  const journalEntries = journalEntriesRes?.ok ? await journalEntriesRes.json() : { data: [] };

  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  let cashBalance = 0;
  let revenueYtd = 0;
  let expensesYtd = 0;

  if (trialBalance.data?.entries) {
    for (const entry of trialBalance.data.entries) {
      const balance = entry.closingDebit - entry.closingCredit;
      if (entry.category === 'asset') {
        totalAssets += balance;
        if (entry.accountCode?.startsWith('11')) {
          cashBalance += balance;
        }
      } else if (entry.category === 'liability') {
        totalLiabilities += Math.abs(balance);
      } else if (entry.category === 'equity') {
        totalEquity += Math.abs(balance);
      } else if (entry.category === 'revenue') {
        revenueYtd += Math.abs(balance);
      } else if (entry.category === 'expense') {
        expensesYtd += balance;
      }
    }
  }

  const currentPeriod = fiscalPeriods.data?.[0];

  // Generate sample cash flow trend data
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const cashFlowTrend = months.map((month) => ({
    month,
    inflow: Math.round(Math.random() * 500000 + 300000),
    outflow: Math.round(Math.random() * 400000 + 200000),
  }));

  // Map aging data
  const apAgingBuckets = {
    current: apAging.data?.totals?.current || 0,
    days30: apAging.data?.totals?.days30 || 0,
    days60: apAging.data?.totals?.days60 || 0,
    days90: apAging.data?.totals?.days90 || 0,
    over90: apAging.data?.totals?.over90 || 0,
  };

  const arAgingBuckets = {
    current: arAging.data?.totals?.current || 0,
    days30: arAging.data?.totals?.days30 || 0,
    days60: arAging.data?.totals?.days60 || 0,
    days90: arAging.data?.totals?.days90 || 0,
    over90: arAging.data?.totals?.over90 || 0,
  };

  // Map recent transactions from journal entries
  const recentTransactions = (journalEntries.data || []).slice(0, 5).map((je: {
    id: number;
    entryDate: string;
    description: string;
    lines: Array<{ debit: number; credit: number }>;
  }) => ({
    id: je.id,
    date: je.entryDate,
    description: je.description,
    amount: je.lines?.reduce((sum: number, l: { debit: number; credit: number }) => sum + (l.debit || 0), 0) || 0,
    type: 'debit' as const,
  }));

  return {
    totalAccounts: glAccounts.data?.length || 0,
    totalAssets,
    totalLiabilities,
    totalEquity,
    cashBalance,
    apBalance: apAging.data?.totals?.total || 0,
    arBalance: arAging.data?.totals?.total || 0,
    pendingJournalEntries: 0,
    currentPeriod: currentPeriod?.periodName || null,
    periodStatus: currentPeriod?.status || null,
    overdueAP: apAging.data?.totals?.over90 || 0,
    overdueAR: arAging.data?.totals?.over90 || 0,
    upcomingMaintenance: maintenance.data?.length || 0,
    fixedAssetCount: 0,
    equipmentCount: 0,
    revenueYtd,
    expensesYtd,
    netIncomeYtd: revenueYtd - expensesYtd,
    cashFlowTrend,
    apAgingBuckets,
    arAgingBuckets,
    recentTransactions,
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

const quickLinks = [
  {
    name: 'Chart of Accounts',
    href: '/accounting/chart-of-accounts',
    icon: Landmark,
    description: 'Manage GL accounts and categories',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    name: 'Journal Entries',
    href: '/accounting/journal-entries',
    icon: FileText,
    description: 'Create and post journal entries',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    name: 'AP Invoices',
    href: '/accounting/ap/invoices',
    icon: Receipt,
    description: 'Manage vendor invoices and payments',
    color: 'bg-orange-50 text-orange-600',
  },
  {
    name: 'AR Invoices',
    href: '/accounting/ar/invoices',
    icon: DollarSign,
    description: 'Track customer invoices and collections',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    name: 'Fixed Assets',
    href: '/accounting/fixed-assets',
    icon: Building2,
    description: 'Asset register and depreciation',
    color: 'bg-cyan-50 text-cyan-600',
  },
  {
    name: 'Equipment',
    href: '/accounting/equipment',
    icon: Wrench,
    description: 'Equipment tracking and maintenance',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    name: 'Reports',
    href: '/accounting/reports',
    icon: BarChart3,
    description: 'Financial statements and analysis',
    color: 'bg-indigo-50 text-indigo-600',
  },
  {
    name: 'Period Close',
    href: '/accounting/period-close',
    icon: CalendarCheck,
    description: 'Manage fiscal period closings',
    color: 'bg-rose-50 text-rose-600',
  },
];

export default function AccountingDashboardPage() {
  const { data: metrics, isLoading, refetch } = useQuery({
    queryKey: ['accounting-dashboard-metrics'],
    queryFn: fetchDashboardMetrics,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const agingData = metrics ? [
    { name: 'Current', ap: metrics.apAgingBuckets.current, ar: metrics.arAgingBuckets.current },
    { name: '1-30 Days', ap: metrics.apAgingBuckets.days30, ar: metrics.arAgingBuckets.days30 },
    { name: '31-60 Days', ap: metrics.apAgingBuckets.days60, ar: metrics.arAgingBuckets.days60 },
    { name: '61-90 Days', ap: metrics.apAgingBuckets.days90, ar: metrics.arAgingBuckets.days90 },
    { name: '90+ Days', ap: metrics.apAgingBuckets.over90, ar: metrics.arAgingBuckets.over90 },
  ] : [];

  const balanceSheetData = metrics ? [
    { name: 'Assets', value: metrics.totalAssets, fill: '#22c55e' },
    { name: 'Liabilities', value: metrics.totalLiabilities, fill: '#ef4444' },
    { name: 'Equity', value: metrics.totalEquity, fill: '#3b82f6' },
  ] : [];

  const hasAlerts = metrics && (metrics.overdueAP > 0 || metrics.overdueAR > 0 || metrics.upcomingMaintenance > 0);

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <AccountingPageHeader
        title="Accounting Dashboard"
        subtitle="Financial management and reporting"
        icon="calculator"
        currentPeriod={metrics?.currentPeriod || undefined}
        periodStatus={metrics?.periodStatus as 'open' | 'closed' | 'soft_closed' | undefined}
        onRefresh={() => refetch()}
      />

      {/* Alerts Section */}
      {hasAlerts && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800">Action Required</h3>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                {metrics?.overdueAP ? (
                  <Link href="/accounting/ap/invoices?status=overdue" className="flex items-center gap-2 p-3 bg-white/60 rounded-lg hover:bg-white transition-colors">
                    <Clock className="h-4 w-4 text-red-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{formatCurrency(metrics.overdueAP)}</p>
                      <p className="text-xs text-gray-500">AP Overdue (90+ days)</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 ml-auto" />
                  </Link>
                ) : null}
                {metrics?.overdueAR ? (
                  <Link href="/accounting/ar/invoices?status=overdue" className="flex items-center gap-2 p-3 bg-white/60 rounded-lg hover:bg-white transition-colors">
                    <Clock className="h-4 w-4 text-red-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{formatCurrency(metrics.overdueAR)}</p>
                      <p className="text-xs text-gray-500">AR Overdue (90+ days)</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 ml-auto" />
                  </Link>
                ) : null}
                {metrics?.upcomingMaintenance ? (
                  <Link href="/accounting/equipment?filter=maintenance-due" className="flex items-center gap-2 p-3 bg-white/60 rounded-lg hover:bg-white transition-colors">
                    <Wrench className="h-4 w-4 text-orange-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{metrics.upcomingMaintenance} items</p>
                      <p className="text-xs text-gray-500">Maintenance due soon</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 ml-auto" />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            <AccountingKPICardSkeleton />
            <AccountingKPICardSkeleton />
            <AccountingKPICardSkeleton />
            <AccountingKPICardSkeleton />
          </>
        ) : (
          <>
            <AccountingKPICard
              label="Cash Balance"
              value={formatCurrency(metrics?.cashBalance || 0)}
              subtitle="Available cash"
              icon="wallet"
              variant="success"
            />
            <AccountingKPICard
              label="Accounts Receivable"
              value={formatCurrency(metrics?.arBalance || 0)}
              subtitle="Due from customers"
              icon="arrow-up"
              variant="info"
            />
            <AccountingKPICard
              label="Accounts Payable"
              value={formatCurrency(metrics?.apBalance || 0)}
              subtitle="Due to vendors"
              icon="arrow-down"
              variant="warning"
            />
            <AccountingKPICard
              label="Net Income (YTD)"
              value={formatCurrency(metrics?.netIncomeYtd || 0)}
              subtitle="Year to date"
              icon="activity"
              variant={(metrics?.netIncomeYtd || 0) >= 0 ? "success" : "danger"}
              trend={(metrics?.netIncomeYtd || 0) >= 0 ? 'up' : 'down'}
              trendValue={(metrics?.netIncomeYtd || 0) >= 0 ? 'Profit' : 'Loss'}
            />
          </>
        )}
      </div>

      {/* Financial Summary Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balance Sheet Summary */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-blue-500" />
              Financial Position
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[200px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">Loading...</div>
              </div>
            ) : (
              <>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={balanceSheetData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {balanceSheetData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3 mt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-sm text-gray-600">Total Assets</span>
                    </div>
                    <span className="font-semibold text-green-600">
                      {formatCompactCurrency(metrics?.totalAssets || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-sm text-gray-600">Total Liabilities</span>
                    </div>
                    <span className="font-semibold text-red-600">
                      {formatCompactCurrency(metrics?.totalLiabilities || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-sm text-gray-600">Total Equity</span>
                    </div>
                    <span className="font-semibold text-blue-600">
                      {formatCompactCurrency(metrics?.totalEquity || 0)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Cash Flow Trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Cash Flow Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[250px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">Loading...</div>
              </div>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics?.cashFlowTrend || []}>
                    <defs>
                      <linearGradient id="inflowGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="outflowGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      tickFormatter={(value) => formatCompactCurrency(value)}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="inflow"
                      name="Cash In"
                      stroke="#22c55e"
                      strokeWidth={2}
                      fill="url(#inflowGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="outflow"
                      name="Cash Out"
                      stroke="#ef4444"
                      strokeWidth={2}
                      fill="url(#outflowGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AP/AR Aging Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-purple-500" />
            Receivables & Payables Aging
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[200px] flex items-center justify-center">
              <div className="animate-pulse text-gray-400">Loading...</div>
            </div>
          ) : (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(value) => formatCompactCurrency(value)} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="ar" name="Receivables (AR)" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="ap" name="Payables (AP)" fill="#f97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Access Grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex flex-col p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
            >
              <div className={`p-2.5 rounded-lg w-fit ${link.color}`}>
                <link.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                {link.name}
              </h3>
              <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                {link.description}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* System Overview Footer */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{metrics?.totalAccounts || 0}</p>
              <p className="text-sm text-gray-500">GL Accounts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{metrics?.fixedAssetCount || 0}</p>
              <p className="text-sm text-gray-500">Fixed Assets</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{metrics?.equipmentCount || 0}</p>
              <p className="text-sm text-gray-500">Equipment</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{metrics?.pendingJournalEntries || 0}</p>
              <p className="text-sm text-gray-500">Pending JE</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

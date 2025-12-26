'use client';

/**
 * AR Dashboard Page
 * Feature: 010-accounting-module-integration
 * Accounts Receivable overview with KPIs, navigation, and activity monitoring
 */

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  FileText,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  ChevronRight,
  Users,
  Banknote,
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
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingKPICardSkeleton,
  AccountingStatusBadge,
} from '@/components/accounting';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

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
  collectedThisMonth: number;
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
  const monthStr = firstDayOfMonth.toISOString().split('T')[0];

  const [allInvoicesRes, agingRes] = await Promise.all([
    fetch('/api/accounting/ar-invoices').catch(() => null),
    fetch(`/api/accounting/reports/aging?type=AR&asOfDate=${new Date().toISOString().split('T')[0]}`).catch(() => null),
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

  const today = new Date().toISOString().split('T')[0];
  const overdueAmount = invoices
    .filter((i: ARInvoice) =>
      ['posted', 'partial'].includes(i.status) &&
      i.dueDate < today
    )
    .reduce((sum: number, i: ARInvoice) => sum + (i.totalAmount - i.paidAmount), 0);

  const collectedThisMonth = invoices.filter(
    (i: ARInvoice) =>
      i.status === 'paid' &&
      i.invoiceDate >= monthStr
  ).length;

  // Get recent invoices (last 10)
  const recentInvoices = invoices
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
    collectedThisMonth,
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

const quickNavCards = [
  {
    name: 'AR Invoices',
    href: '/accounting/ar/invoices',
    icon: FileText,
    description: 'Manage customer invoices and billing',
    color: 'bg-green-50 text-green-600',
    borderColor: 'border-green-200',
    hoverColor: 'hover:border-green-300',
  },
  {
    name: 'Receipts',
    href: '/accounting/ar/receipts',
    icon: Banknote,
    description: 'Record and track customer payments',
    color: 'bg-blue-50 text-blue-600',
    borderColor: 'border-blue-200',
    hoverColor: 'hover:border-blue-300',
  },
  {
    name: 'Aging Report',
    href: '/accounting/ar/aging',
    icon: BarChart3,
    description: 'View receivables aging analysis',
    color: 'bg-purple-50 text-purple-600',
    borderColor: 'border-purple-200',
    hoverColor: 'hover:border-purple-300',
  },
];

export default function ARDashboardPage() {
  const { data: metrics, isLoading, refetch } = useQuery({
    queryKey: ['ar-dashboard-metrics'],
    queryFn: fetchARDashboardMetrics,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const agingData = metrics ? [
    { name: 'Current', amount: metrics.agingBuckets.current },
    { name: '1-30 Days', amount: metrics.agingBuckets.days30 },
    { name: '31-60 Days', amount: metrics.agingBuckets.days60 },
    { name: '61-90 Days', amount: metrics.agingBuckets.days90 },
    { name: '90+ Days', amount: metrics.agingBuckets.over90 },
  ] : [];

  const hasOverdue = metrics && metrics.overdueAmount > 0;

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <AccountingPageHeader
        title="Accounts Receivable Dashboard"
        subtitle="Manage customer invoices and collections"
        icon="file-text"
        onRefresh={() => refetch()}
      />

      <div className="p-6 space-y-6">
        {/* Alert Banner for Overdue */}
        {hasOverdue && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800">Outstanding Receivables</h3>
                <p className="text-sm text-amber-600 mt-1">
                  You have {formatCurrency(metrics.overdueAmount)} in overdue receivables
                </p>
                <Link
                  href="/accounting/ar/invoices?status=overdue"
                  className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-white/60 rounded-lg hover:bg-white transition-colors text-sm font-medium text-amber-700"
                >
                  View Overdue Invoices
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                label="Total Receivables"
                value={formatCurrency(metrics?.totalReceivables || 0)}
                subtitle="Outstanding amount"
                icon="trending-up"
                variant="success"
              />
              <AccountingKPICard
                label="Pending Invoices"
                value={metrics?.pendingInvoices || 0}
                subtitle="Awaiting approval"
                icon="clock"
                variant="warning"
              />
              <AccountingKPICard
                label="Overdue Amount"
                value={formatCurrency(metrics?.overdueAmount || 0)}
                subtitle="Past due date"
                icon="trending-up"
                variant="danger"
                trend={metrics?.overdueAmount ? 'up' : 'neutral'}
                trendValue={metrics?.overdueAmount ? 'Follow up needed' : 'On track'}
              />
              <AccountingKPICard
                label="Collected This Month"
                value={metrics?.collectedThisMonth || 0}
                subtitle="Received payments"
                icon="check-circle"
                variant="info"
              />
            </>
          )}
        </div>

        {/* Quick Navigation Cards */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickNavCards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className={`group flex flex-col p-5 bg-white border ${card.borderColor} rounded-xl shadow-sm hover:shadow-md ${card.hoverColor} transition-all cursor-pointer`}
              >
                <div className={`p-3 rounded-lg w-fit ${card.color}`}>
                  <card.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {card.name}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {card.description}
                </p>
                <div className="mt-4 flex items-center text-blue-600 text-sm font-medium">
                  Open
                  <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Two Column Layout: Recent Activity + Aging Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent AR Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-green-500" />
                Recent AR Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : metrics?.recentInvoices && metrics.recentInvoices.length > 0 ? (
                <div className="space-y-2">
                  {metrics.recentInvoices.map((invoice) => (
                    <Link
                      key={invoice.id}
                      href={`/accounting/ar/invoices?id=${invoice.id}`}
                      className="block p-3 hover:bg-gray-50 rounded-lg transition-colors border border-gray-100"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 truncate">
                              {invoice.invoiceNumber}
                            </span>
                            <AccountingStatusBadge status={invoice.status} />
                          </div>
                          <p className="text-sm text-gray-500 mt-1 truncate">
                            {invoice.customerName || invoice.description || 'No description'}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatDate(invoice.invoiceDate)} • Due: {formatDate(invoice.dueDate)}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(invoice.totalAmount)}
                          </p>
                          {invoice.paidAmount > 0 && (
                            <p className="text-xs text-green-600">
                              Received: {formatCurrency(invoice.paidAmount)}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                  <Link
                    href="/accounting/ar/invoices"
                    className="block mt-4 text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View All Invoices →
                  </Link>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                  <p>No AR invoices yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Aging Summary Chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-500" />
                AR Aging Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="animate-pulse text-gray-400">Loading...</div>
                </div>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agingData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => formatCompactCurrency(value)}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tick={{ fontSize: 12 }}
                        width={100}
                      />
                      <Tooltip
                        formatter={(value) => formatCurrency(value as number)}
                        labelStyle={{ fontWeight: 600 }}
                      />
                      <Legend />
                      <Bar
                        dataKey="amount"
                        name="AR Amount"
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {metrics?.recentInvoices?.length || 0}
                </p>
                <p className="text-sm text-gray-500">Recent Invoices</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {formatCompactCurrency(metrics?.totalReceivables || 0)}
                </p>
                <p className="text-sm text-gray-500">Total Outstanding</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">
                  {formatCompactCurrency(metrics?.overdueAmount || 0)}
                </p>
                <p className="text-sm text-gray-500">Overdue</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {metrics?.collectedThisMonth || 0}
                </p>
                <p className="text-sm text-gray-500">Collected This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

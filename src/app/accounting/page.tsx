'use client';

// Executive Accounting Dashboard - Redesign
// Feature: 014-unit-cost (Executive Dashboard Redesign)
// Executive-level insights with actionable metrics and priority-based alerts

import { useState } from 'react';
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
  Landmark,
  RefreshCw,
} from 'lucide-react';
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
  const today = new Date().toISOString().split('T')[0];
  const res = await fetch(`/api/accounting/dashboard/executive-metrics?asOfDate=${today}&period=${period}`);
  if (!res.ok) throw new Error('Failed to fetch executive metrics');
  const data = await res.json();
  return data.data;
}

// Fetch alerts from API
async function fetchAlerts(): Promise<ExecutiveAlert[]> {
  const today = new Date().toISOString().split('T')[0];
  const res = await fetch(`/api/accounting/dashboard/alerts?asOfDate=${today}`);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  const data = await res.json();
  return data.data || [];
}

// Mock data for charts (to be replaced with real API data later)
function generateTrendData(metrics: ExecutiveMetrics | undefined) {
  // Generate 12-month trend data based on real YTD data
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = new Date().getMonth();

  // Scale based on actual metrics if available
  const baseRevenue = metrics?.grossProfitMargin?.sparklineData?.[5] || 500000;
  const baseCogs = baseRevenue * 0.6;
  const baseOpex = baseRevenue * 0.25;

  return months.slice(0, currentMonth + 1).map((month) => {
    const variance = 0.8 + Math.random() * 0.4; // 80%-120% variance
    return {
      month,
      revenue: Math.round(baseRevenue * variance),
      cogs: Math.round(baseCogs * variance),
      operatingExpenses: Math.round(baseOpex * variance),
      netIncome: Math.round((baseRevenue - baseCogs - baseOpex) * variance),
    };
  });
}

function generateExpenseData(): ExpenseCategory[] {
  return [
    { categoryName: 'Raw Materials', glAccountIds: [5101, 5102], amount: 450000, percentage: 35 },
    { categoryName: 'Labor', glAccountIds: [5201, 5202], amount: 320000, percentage: 25 },
    { categoryName: 'Utilities', glAccountIds: [5301], amount: 128000, percentage: 10 },
    { categoryName: 'Quality/Compliance', glAccountIds: [5401, 5402], amount: 192000, percentage: 15 },
    { categoryName: 'Maintenance', glAccountIds: [5501], amount: 128000, percentage: 10 },
    { categoryName: 'Other', glAccountIds: [5901], amount: 64000, percentage: 5 },
  ];
}

// Quick links organized by category
const quickLinkGroups = [
  {
    title: 'Financial Statements',
    links: [
      { name: 'Trial Balance', href: '/accounting/reports/trial-balance', icon: Landmark },
      { name: 'Balance Sheet', href: '/accounting/reports/balance-sheet', icon: BarChart3 },
      { name: 'Income Statement', href: '/accounting/reports/income-statement', icon: BarChart3 },
      { name: 'Cash Flow', href: '/accounting/reports/cash-flow', icon: DollarSign },
    ],
  },
  {
    title: 'Receivables',
    links: [
      { name: 'AR Invoices', href: '/accounting/ar/invoices', icon: FileText },
      { name: 'AR Aging', href: '/accounting/reports/aging?type=AR', icon: BarChart3 },
      { name: 'Receipts', href: '/accounting/ar/receipts', icon: Receipt },
    ],
  },
  {
    title: 'Payables',
    links: [
      { name: 'AP Invoices', href: '/accounting/ap/invoices', icon: FileText },
      { name: 'AP Aging', href: '/accounting/reports/aging?type=AP', icon: BarChart3 },
      { name: 'Payments', href: '/accounting/ap/payments', icon: DollarSign },
    ],
  },
  {
    title: 'Assets & Operations',
    links: [
      { name: 'Fixed Assets', href: '/accounting/fixed-assets', icon: Building2 },
      { name: 'Equipment', href: '/accounting/equipment', icon: Wrench },
      { name: 'Period Close', href: '/accounting/period-close', icon: CalendarCheck },
    ],
  },
];

export default function AccountingDashboardPage() {
  const [period, setPeriod] = useState<Period>('YTD');

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
  };

  const trendData = generateTrendData(metrics);
  const expenseData = generateExpenseData();
  const totalExpenses = expenseData.reduce((sum, e) => sum + e.amount, 0);

  const kpiRow1 = metrics
    ? [metrics.workingCapital, metrics.currentRatio, metrics.quickRatio, metrics.dso]
    : [];
  const kpiRow2 = metrics
    ? [metrics.grossProfitMargin, metrics.operatingCashFlow, metrics.dpo, metrics.inventoryTurnover]
    : [];

  return (
    <div className="space-y-6 p-1" data-testid="accounting-dashboard">
      {/* Header with Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Executive Accounting Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Financial insights and actionable metrics
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="flex rounded-lg border border-gray-200 bg-white p-1" data-testid="period-selector">
            {(['MTD', 'QTD', 'YTD'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  period === p
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                data-testid={`period-${p.toLowerCase()}`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="gap-2"
            data-testid="refresh-button"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alert Bar */}
      {alertsLoading ? (
        <ExecutiveAlertBarSkeleton />
      ) : alerts.length > 0 ? (
        <ExecutiveAlertBar alerts={alerts} />
      ) : null}

      {/* KPI Row 1: Financial Health */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Financial Health
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* KPI Row 2: Business Performance */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Business Performance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RevenueExpensesTrend
          data={trendData}
          isLoading={metricsLoading}
          className="lg:col-span-2"
        />
        <ExpenseBreakdownChart
          data={expenseData}
          totalExpenses={totalExpenses}
          isLoading={metricsLoading}
        />
      </div>

      {/* Quick Links by Category */}
      <div data-testid="quick-links">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickLinkGroups.map((group) => (
            <Card key={group.title}>
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">{group.title}</h3>
                <div className="space-y-2">
                  {group.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      data-testid={`quick-link-${link.href.split('/').pop()?.replace('?', '-')}`}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors text-sm text-gray-700 hover:text-blue-600"
                    >
                      <link.icon className="h-4 w-4 text-gray-400" />
                      {link.name}
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

'use client';

// Accounting Dashboard
// Feature: 010-accounting-module-integration
// Main entry point for the accounting module

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import {
  Calculator,
  FileText,
  Receipt,
  DollarSign,
  Building2,
  Wrench,
  BarChart3,
  CalendarCheck,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Landmark,
} from 'lucide-react';

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
}

async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  // Fetch multiple endpoints in parallel for dashboard metrics
  const [
    glAccountsRes,
    trialBalanceRes,
    fiscalPeriodsRes,
    apAgingRes,
    arAgingRes,
    maintenanceRes,
  ] = await Promise.all([
    fetch('/api/accounting/gl-accounts?isActive=true').catch(() => null),
    fetch(`/api/accounting/reports/trial-balance?asOfDate=${new Date().toISOString().split('T')[0]}`).catch(() => null),
    fetch('/api/accounting/fiscal-periods?isCurrent=true').catch(() => null),
    fetch(`/api/accounting/reports/aging?type=AP&asOfDate=${new Date().toISOString().split('T')[0]}`).catch(() => null),
    fetch(`/api/accounting/reports/aging?type=AR&asOfDate=${new Date().toISOString().split('T')[0]}`).catch(() => null),
    fetch('/api/accounting/maintenance/due?daysAhead=7').catch(() => null),
  ]);

  // Parse responses safely
  const glAccounts = glAccountsRes?.ok ? await glAccountsRes.json() : { data: [] };
  const trialBalance = trialBalanceRes?.ok ? await trialBalanceRes.json() : { data: { entries: [] } };
  const fiscalPeriods = fiscalPeriodsRes?.ok ? await fiscalPeriodsRes.json() : { data: [] };
  const apAging = apAgingRes?.ok ? await apAgingRes.json() : { data: { totals: { over90: 0 }, entries: [] } };
  const arAging = arAgingRes?.ok ? await arAgingRes.json() : { data: { totals: { over90: 0 }, entries: [] } };
  const maintenance = maintenanceRes?.ok ? await maintenanceRes.json() : { data: [] };

  // Calculate totals from trial balance
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  let cashBalance = 0;

  if (trialBalance.data?.entries) {
    for (const entry of trialBalance.data.entries) {
      const balance = entry.closingDebit - entry.closingCredit;
      if (entry.category === 'asset') {
        totalAssets += balance;
        // Check if it's a cash account (starts with 11)
        if (entry.accountCode?.startsWith('11')) {
          cashBalance += balance;
        }
      } else if (entry.category === 'liability') {
        totalLiabilities += Math.abs(balance);
      } else if (entry.category === 'equity') {
        totalEquity += Math.abs(balance);
      }
    }
  }

  const currentPeriod = fiscalPeriods.data?.[0];

  return {
    totalAccounts: glAccounts.data?.length || 0,
    totalAssets,
    totalLiabilities,
    totalEquity,
    cashBalance,
    apBalance: apAging.data?.totals?.total || 0,
    arBalance: arAging.data?.totals?.total || 0,
    pendingJournalEntries: 0, // Would need separate query
    currentPeriod: currentPeriod?.periodName || null,
    periodStatus: currentPeriod?.status || null,
    overdueAP: apAging.data?.totals?.over90 || 0,
    overdueAR: arAging.data?.totals?.over90 || 0,
    upcomingMaintenance: maintenance.data?.length || 0,
    fixedAssetCount: 0,
    equipmentCount: 0,
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
  }).format(amount);
}

const quickLinks = [
  { name: 'Chart of Accounts', href: '/accounting/chart-of-accounts', icon: Landmark, description: 'Manage GL accounts' },
  { name: 'Journal Entries', href: '/accounting/journal-entries', icon: FileText, description: 'Create and post entries' },
  { name: 'AP Invoices', href: '/accounting/ap/invoices', icon: Receipt, description: 'Accounts payable' },
  { name: 'AR Invoices', href: '/accounting/ar/invoices', icon: DollarSign, description: 'Accounts receivable' },
  { name: 'Fixed Assets', href: '/accounting/fixed-assets', icon: Building2, description: 'Asset management' },
  { name: 'Equipment', href: '/accounting/equipment', icon: Wrench, description: 'Equipment & maintenance' },
  { name: 'Reports', href: '/accounting/reports', icon: BarChart3, description: 'Financial statements' },
  { name: 'Period Close', href: '/accounting/period-close', icon: CalendarCheck, description: 'Close fiscal periods' },
];

export default function AccountingDashboardPage() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['accounting-dashboard-metrics'],
    queryFn: fetchDashboardMetrics,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-6">
      <ResponsivePageHeader
        title="Accounting"
        subtitle="Financial management and reporting"
        icon={Calculator}
        iconColor="text-primary"
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Cash Balance"
          value={isLoading ? '...' : formatCurrency(metrics?.cashBalance || 0)}
          icon={DollarSign}
          iconColor="text-green-500"
          accentColor="border-green-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Accounts Receivable"
          value={isLoading ? '...' : formatCurrency(metrics?.arBalance || 0)}
          icon={TrendingUp}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Accounts Payable"
          value={isLoading ? '...' : formatCurrency(metrics?.apBalance || 0)}
          icon={TrendingDown}
          iconColor="text-orange-500"
          accentColor="border-orange-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Current Period"
          value={isLoading ? '...' : metrics?.currentPeriod || 'Not Set'}
          icon={CalendarCheck}
          iconColor={metrics?.periodStatus === 'open' ? 'text-green-500' : 'text-yellow-500'}
          accentColor={metrics?.periodStatus === 'open' ? 'border-green-500' : 'border-yellow-500'}
          isLoading={isLoading}
        />
      </div>

      {/* Balance Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Assets</p>
              <p className="text-2xl font-bold text-green-600">
                {isLoading ? '...' : formatCurrency(metrics?.totalAssets || 0)}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Liabilities</p>
              <p className="text-2xl font-bold text-red-600">
                {isLoading ? '...' : formatCurrency(metrics?.totalLiabilities || 0)}
              </p>
            </div>
            <TrendingDown className="h-8 w-8 text-red-500" />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Equity</p>
              <p className="text-2xl font-bold text-blue-600">
                {isLoading ? '...' : formatCurrency(metrics?.totalEquity || 0)}
              </p>
            </div>
            <Building2 className="h-8 w-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(metrics?.overdueAP || metrics?.overdueAR || metrics?.upcomingMaintenance) ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="flex items-center gap-2 font-medium text-yellow-800">
            <AlertTriangle className="h-5 w-5" />
            Action Required
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-yellow-700">
            {metrics?.overdueAP ? (
              <li>
                <Clock className="mr-1 inline h-4 w-4" />
                {formatCurrency(metrics.overdueAP)} in AP invoices overdue (90+ days)
              </li>
            ) : null}
            {metrics?.overdueAR ? (
              <li>
                <Clock className="mr-1 inline h-4 w-4" />
                {formatCurrency(metrics.overdueAR)} in AR invoices overdue (90+ days)
              </li>
            ) : null}
            {metrics?.upcomingMaintenance ? (
              <li>
                <Wrench className="mr-1 inline h-4 w-4" />
                {metrics.upcomingMaintenance} equipment maintenance tasks due soon
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {/* Quick Links */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Quick Access</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-col items-center justify-center rounded-lg border bg-card p-4 text-center shadow-sm transition-all hover:border-primary hover:shadow-md"
            >
              <link.icon className="mb-2 h-8 w-8 text-primary" />
              <span className="font-medium">{link.name}</span>
              <span className="text-xs text-muted-foreground">{link.description}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Account Summary */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <h3 className="mb-2 font-medium">System Overview</h3>
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <p className="text-muted-foreground">GL Accounts</p>
            <p className="text-xl font-semibold">{metrics?.totalAccounts || 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Fixed Assets</p>
            <p className="text-xl font-semibold">{metrics?.fixedAssetCount || 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Equipment</p>
            <p className="text-xl font-semibold">{metrics?.equipmentCount || 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Pending JE</p>
            <p className="text-xl font-semibold">{metrics?.pendingJournalEntries || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

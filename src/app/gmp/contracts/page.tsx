'use client';

/**
 * Manufacturing Contracts Dashboard Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8)
 *
 * Responsive dashboard for managing manufacturing contracts and quality agreements.
 * Responsive: ResponsivePageHeader, StatCard KPI row, mobile card view,
 * empty state, no-results state, loading skeletons, scroll-snap tabs.
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ContractDataEntryDialog } from '@/components/contracts';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { useMobile } from '@/hooks/use-mobile';
import {
  PieChart,
  Series,
  Label,
  Legend,
  Tooltip,
  Connector,
} from 'devextreme-react/pie-chart';
import {
  Chart,
  CommonSeriesSettings,
  Series as ChartSeries,
  ArgumentAxis,
  ValueAxis,
  Legend as ChartLegend,
  Tooltip as ChartTooltip,
  Label as ChartLabel,
} from 'devextreme-react/chart';
import {
  ScrollText,
  Briefcase,
  AlertTriangle,
  CheckCircle,
  Calendar,
  XCircle,
  Building2,
  FlaskConical,
  Package,
  TrendingUp,
  BarChart3,
  ClipboardCheck,
  FileWarning,
  Search,
  Clock,
  Eye,
  SearchX,
  ChevronRight,
} from 'lucide-react';
import type {
  ManufacturingContract,
  ContractDashboard,
  ContractListResponse,
  ContractStatus,
  ContractorType,
} from '@/types/contracts';

// ============================================
// Types
// ============================================

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

// ============================================
// Constants
// ============================================

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  expired: '#ef4444',
  terminated: '#6b7280',
  pending: '#f59e0b',
};

const TYPE_COLORS: Record<string, string> = {
  manufacturer: '#3b82f6',
  laboratory: '#8b5cf6',
  both: '#14b8a6',
};

const STATUS_BADGE_CONFIG: Record<
  ContractStatus,
  { bgClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  active: { bgClass: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
  expired: { bgClass: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  terminated: { bgClass: 'bg-gray-100 text-gray-700 border-gray-200', icon: XCircle },
  pending: { bgClass: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
};

const TYPE_ICON_CONFIG: Record<
  ContractorType,
  { icon: React.ComponentType<{ className?: string }>; bgClass: string; iconColor: string }
> = {
  manufacturer: { icon: Building2, bgClass: 'bg-blue-100', iconColor: 'text-blue-600' },
  laboratory: { icon: FlaskConical, bgClass: 'bg-purple-100', iconColor: 'text-purple-600' },
  both: { icon: Package, bgClass: 'bg-teal-100', iconColor: 'text-teal-600' },
};

// ============================================
// API Functions
// ============================================

async function fetchDashboard(): Promise<ContractDashboard> {
  const response = await fetch('/api/contracts/dashboard');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function fetchContracts(status?: ContractStatus): Promise<ContractListResponse> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('limit', '200');

  const response = await fetch(`/api/contracts?${params}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

// ============================================
// Helpers
// ============================================

function formatDateStr(d: string | null | undefined) {
  if (!d) return '-';
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toISOString().slice(0, 10);
  } catch {
    return d;
  }
}

// ============================================
// Component
// ============================================

type TabKey = 'all' | 'active' | 'expired' | 'pending';

export default function ContractsDashboardPage() {
  const router = useRouter();
  const t = useTranslations('gmp');
  const { isMobile } = useMobile();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchText, setSearchText] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);

  const statusFilter: ContractStatus | undefined = activeTab === 'all' ? undefined : (activeTab as ContractStatus);

  // Fetch dashboard data
  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['contracts-dashboard'],
    queryFn: fetchDashboard,
  });

  // Fetch contracts with filter
  const { data: contractsData, isLoading: contractsLoading, refetch: refetchContracts } = useQuery({
    queryKey: ['contracts', statusFilter],
    queryFn: () => fetchContracts(statusFilter),
  });

  const allContracts = contractsData?.contracts || [];

  // Apply search filter
  const filteredContracts = useMemo(() => {
    const filtered = !searchText.trim()
      ? allContracts
      : (() => {
          const q = searchText.toLowerCase();
          return allContracts.filter((c) =>
            (c.contractNumber || '').toLowerCase().includes(q) ||
            (c.contractorName || '').toLowerCase().includes(q) ||
            (c.scope || '').toLowerCase().includes(q) ||
            (c.contactPerson || '').toLowerCase().includes(q)
          );
        })();
    return filtered.map((item, index) => ({ ...item, _rowNumber: index + 1 }));
  }, [allContracts, searchText]);

  // Tab counts
  const tabs: Array<{ key: TabKey; label: string; count: number }> = useMemo(() => [
    { key: 'all', label: t('contracts.tabs.all'), count: dashboard?.totalContracts ?? 0 },
    { key: 'active', label: t('contracts.tabs.active'), count: dashboard?.activeContracts ?? 0 },
    { key: 'expired', label: t('contracts.tabs.expired'), count: dashboard?.expiredContracts ?? 0 },
    { key: 'pending', label: t('contracts.tabs.pending'), count: dashboard?.pendingContracts ?? 0 },
  ], [t, dashboard]);

  // Prepare chart data
  const statusChartData = useMemo(() => {
    if (!dashboard) return [];
    const data = [];
    if (dashboard.activeContracts > 0) {
      data.push({ label: t('contracts.status.active'), value: dashboard.activeContracts, color: STATUS_COLORS.active });
    }
    if (dashboard.expiredContracts > 0) {
      data.push({ label: t('contracts.status.expired'), value: dashboard.expiredContracts, color: STATUS_COLORS.expired });
    }
    if (dashboard.terminatedContracts > 0) {
      data.push({ label: t('contracts.status.terminated'), value: dashboard.terminatedContracts, color: STATUS_COLORS.terminated });
    }
    if (dashboard.pendingContracts > 0) {
      data.push({ label: t('contracts.status.pending'), value: dashboard.pendingContracts, color: STATUS_COLORS.pending });
    }
    return data;
  }, [dashboard, t]);

  const typeChartData = useMemo(() => {
    if (!dashboard?.byContractorType) return [];
    return Object.entries(dashboard.byContractorType)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => ({
        type,
        label: t(`contracts.type.${type}`),
        value: count,
        color: TYPE_COLORS[type] || '#6b7280',
      }));
  }, [dashboard, t]);

  const activityChartData = useMemo(() => {
    if (!dashboard?.recentActivity) return [];
    return dashboard.recentActivity.map((item) => ({
      period: item.date,
      count: item.count,
    }));
  }, [dashboard]);

  // Handlers
  const handleContractSelect = (contract: ManufacturingContract) => {
    router.push(`/gmp/contracts/${contract.id}`);
  };

  const handleNewContract = () => {
    setShowNewDialog(true);
  };

  const handleContractSaved = (contract: ManufacturingContract) => {
    setShowNewDialog(false);
    router.push(`/gmp/contracts/${contract.id}`);
  };

  const handleRefresh = () => {
    refetchDashboard();
    refetchContracts();
  };

  const handleClearFilters = () => {
    setActiveTab('all');
    setSearchText('');
  };

  const showEmptyState = !contractsLoading && allContracts.length === 0 && !searchText;
  const showNoResultsState = !contractsLoading && allContracts.length > 0 && filteredContracts.length === 0;

  // ===== Cell renderers for DataGrid =====
  const renderContractorCell = (cell: { data: ManufacturingContract }) => {
    const typeCfg = TYPE_ICON_CONFIG[cell.data.contractorType];
    const TypeIcon = typeCfg?.icon || Briefcase;
    return (
      <div className="flex items-center gap-2 min-w-0">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${typeCfg?.bgClass || 'bg-gray-100'}`}>
          <TypeIcon className={`h-4 w-4 ${typeCfg?.iconColor || 'text-gray-600'}`} />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">{cell.data.contractorName}</p>
          <p className="font-mono text-xs text-gray-500 truncate">{cell.data.contractNumber}</p>
        </div>
      </div>
    );
  };

  const renderTypeCell = (cell: { data: ManufacturingContract }) => (
    <span className="text-sm text-gray-700">{t(`contracts.type.${cell.data.contractorType}`)}</span>
  );

  const renderExpirationCell = (cell: { data: ManufacturingContract }) => {
    const c = cell.data;
    if (!c.expirationDate) return <span className="text-gray-400">-</span>;
    const dateStr = formatDateStr(c.expirationDate);

    if (c.status !== 'active') {
      return <span className="text-sm text-gray-600">{dateStr}</span>;
    }
    if (c.isExpiringSoon) {
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
          <AlertTriangle className="h-3.5 w-3.5" />
          {dateStr} ({c.daysUntilExpiry}d)
        </span>
      );
    }
    if (c.daysUntilExpiry !== undefined && c.daysUntilExpiry < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
          <AlertTriangle className="h-3.5 w-3.5" />
          {dateStr}
        </span>
      );
    }
    return <span className="text-sm text-gray-700">{dateStr}</span>;
  };

  const renderAuditCell = (cell: { data: ManufacturingContract }) => {
    const c = cell.data;
    if (!c.nextAuditDue) return <span className="text-gray-400">-</span>;
    const dateStr = formatDateStr(c.nextAuditDue);
    if (c.isAuditOverdue) {
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
          <AlertTriangle className="h-3.5 w-3.5" />
          {dateStr}
        </span>
      );
    }
    return <span className="text-sm text-gray-700">{dateStr}</span>;
  };

  const renderStatusCell = (cell: { data: ManufacturingContract }) => {
    const cfg = STATUS_BADGE_CONFIG[cell.data.status];
    if (!cfg) return <span className="text-gray-500">{cell.data.status}</span>;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bgClass}`}>
        <Icon className="h-3 w-3" />
        {t(`contracts.status.${cell.data.status}`)}
      </span>
    );
  };

  const renderActionsCell = (cell: { data: ManufacturingContract }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleContractSelect(cell.data);
      }}
      className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
      title={t('contracts.actions.viewContract')}
      aria-label={t('contracts.actions.viewContract')}
    >
      <Eye className="h-4 w-4" />
    </button>
  );

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title={t('contracts.pageTitle')}
        subtitle={t('contracts.description')}
        icon={ScrollText}
        iconBgColor="bg-yellow-100"
        iconColor="text-yellow-700"
        breadcrumbs={[
          { label: 'GMP', href: '/gmp' },
          { label: t('contracts.title') },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              text={t('contracts.actions.refresh')}
              type="default"
              stylingMode="outlined"
              onClick={handleRefresh}
              className="hidden sm:inline-flex"
            />
            <DxButton
              icon="plus"
              text={t('contracts.actions.newContract')}
              type="success"
              onClick={handleNewContract}
            />
          </div>
        }
      />

      {/* KPI Stat Cards - 4 primary cards (Total / Active / Expiring Soon / Expired) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('contracts.stats.totalContracts')}
          value={dashboard?.totalContracts ?? 0}
          icon={Briefcase}
          iconColor="text-indigo-500"
          accentColor="border-indigo-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('contracts.stats.active')}
          value={dashboard?.activeContracts ?? 0}
          icon={CheckCircle}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('contracts.stats.expiringSoon')}
          value={dashboard?.expiringSoon ?? 0}
          icon={Calendar}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('contracts.stats.auditsOverdue')}
          value={dashboard?.auditsOverdue ?? 0}
          icon={AlertTriangle}
          iconColor="text-red-500"
          accentColor="border-red-500"
          isLoading={dashboardLoading}
        />
      </div>

      {/* Secondary KPI Row - visible on large screens */}
      <div className="hidden xl:grid grid-cols-3 gap-3 md:gap-4">
        <StatCard
          label={t('contracts.stats.totalBatches')}
          value={dashboard?.totalBatches ?? 0}
          icon={Package}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('contracts.stats.thisMonth')}
          value={dashboard?.batchesThisMonth ?? 0}
          icon={TrendingUp}
          iconColor="text-teal-500"
          accentColor="border-teal-500"
          isLoading={dashboardLoading}
          trend={dashboard?.batchesThisMonth ? { direction: 'up', value: t('contracts.labels.batches') } : undefined}
        />
        <StatCard
          label={t('contracts.status.expired')}
          value={dashboard?.expiredContracts ?? 0}
          icon={XCircle}
          iconColor="text-gray-400"
          accentColor="border-gray-400"
          isLoading={dashboardLoading}
        />
      </div>

      {/* Alerts Section - responsive with proper mobile stacking */}
      {((dashboard?.expiringContracts?.length ?? 0) > 0 || (dashboard?.overdueAudits?.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Expiring Contracts */}
          {dashboard?.expiringContracts && dashboard.expiringContracts.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-500" />
                  {t('contracts.sections.expiringSoon')}
                  <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                    {dashboard.expiringContracts.length}
                  </span>
                </h3>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {dashboard.expiringContracts.slice(0, 5).map((contract) => (
                  <button
                    key={contract.id}
                    type="button"
                    className="w-full flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100 cursor-pointer hover:bg-amber-100 active:bg-amber-200 transition-colors text-left min-h-[44px]"
                    onClick={() => router.push(`/gmp/contracts/${contract.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {contract.contractorName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {contract.contractNumber}
                      </p>
                    </div>
                    <span className="ml-3 px-2 py-1 bg-amber-200 text-amber-800 text-xs font-medium rounded whitespace-nowrap">
                      {contract.daysUntilExpiry}d
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Overdue Audits */}
          {dashboard?.overdueAudits && dashboard.overdueAudits.length > 0 && (
            <div className="bg-white rounded-xl border border-red-200 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-red-500" />
                  {t('contracts.sections.overdueAudits')}
                  <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                    {dashboard.overdueAudits.length}
                  </span>
                </h3>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {dashboard.overdueAudits.slice(0, 5).map((contract) => (
                  <button
                    key={contract.id}
                    type="button"
                    className="w-full flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100 cursor-pointer hover:bg-red-100 active:bg-red-200 transition-colors text-left min-h-[44px]"
                    onClick={() => router.push(`/gmp/contracts/${contract.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {contract.contractorName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {t('contracts.labels.due')}: {formatDateStr(contract.nextAuditDue)}
                      </p>
                    </div>
                    <span className="ml-3 px-2 py-1 bg-red-200 text-red-800 text-xs font-medium rounded whitespace-nowrap">
                      {t('contracts.labels.overdue')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts Section - hidden on small screens to prioritize the list */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Status Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-blue-500" />
              {t('contracts.sections.byStatus')}
            </h3>
          </div>
          {statusChartData.length > 0 ? (
            <PieChart
              id="status-pie"
              dataSource={statusChartData}
              type="doughnut"
              innerRadius={0.65}
              palette={statusChartData.map((d) => d.color)}
              size={{ height: 260 }}
            >
              <Series argumentField="label" valueField="value">
                <Label visible={false} />
                <Connector visible={false} />
              </Series>
              <Legend
                visible={true}
                orientation="horizontal"
                horizontalAlignment="center"
                verticalAlignment="bottom"
                itemTextPosition="right"
                font={{ size: 11 }}
                customizeText={(info: { pointName?: string; pointIndex?: number }) => {
                  const d = statusChartData[info.pointIndex ?? -1];
                  return d ? `${info.pointName} (${d.value})` : (info.pointName ?? '');
                }}
              />
              <Tooltip
                enabled={true}
                customizeTooltip={(arg: { argumentText?: string; valueText?: string; percentText?: string }) => ({
                  text: `${arg.argumentText}: ${arg.valueText} (${arg.percentText})`,
                })}
              />
            </PieChart>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <FileWarning className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('contracts.empty.noContracts')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Contractor Type Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-500" />
              {t('contracts.sections.byType')}
            </h3>
          </div>
          {typeChartData.length > 0 ? (
            <PieChart
              id="type-pie"
              dataSource={typeChartData}
              type="doughnut"
              innerRadius={0.65}
              palette={typeChartData.map((d) => d.color)}
              size={{ height: 260 }}
            >
              <Series argumentField="label" valueField="value">
                <Label visible={false} />
                <Connector visible={false} />
              </Series>
              <Legend
                visible={true}
                orientation="horizontal"
                horizontalAlignment="center"
                verticalAlignment="bottom"
                itemTextPosition="right"
                font={{ size: 11 }}
                customizeText={(info: { pointName?: string; pointIndex?: number }) => {
                  const d = typeChartData[info.pointIndex ?? -1];
                  return d ? `${info.pointName} (${d.value})` : (info.pointName ?? '');
                }}
              />
              <Tooltip
                enabled={true}
                customizeTooltip={(arg: { argumentText?: string; valueText?: string; percentText?: string }) => ({
                  text: `${arg.argumentText}: ${arg.valueText} (${arg.percentText})`,
                })}
              />
            </PieChart>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Building2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('contracts.empty.noData')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Contractor Types Summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              {t('contracts.sections.activeByType')}
            </h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('contracts.labels.manufacturers')}</p>
                  <p className="text-sm font-medium text-gray-900">{t('contracts.labels.production')}</p>
                </div>
              </div>
              <span className="text-xl font-bold text-blue-600">
                {dashboard?.byContractorType?.manufacturer ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg border border-purple-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FlaskConical className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('contracts.labels.laboratories')}</p>
                  <p className="text-sm font-medium text-gray-900">{t('contracts.labels.testing')}</p>
                </div>
              </div>
              <span className="text-xl font-bold text-purple-600">
                {dashboard?.byContractorType?.laboratory ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg border border-teal-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-100 rounded-lg">
                  <Package className="h-4 w-4 text-teal-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('contracts.labels.bothServices')}</p>
                  <p className="text-sm font-medium text-gray-900">{t('contracts.labels.fullService')}</p>
                </div>
              </div>
              <span className="text-xl font-bold text-teal-600">
                {dashboard?.byContractorType?.both ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-red-50 to-rose-50 rounded-lg border border-red-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('contracts.status.expired')}</p>
                  <p className="text-sm font-medium text-gray-900">{t('contracts.labels.needsRenewal')}</p>
                </div>
              </div>
              <span className="text-xl font-bold text-red-600">
                {dashboard?.expiredContracts ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-500" />
              {t('contracts.sections.activitySummary')}
            </h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Package className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('contracts.stats.totalBatches')}</p>
                  <p className="text-sm font-medium text-gray-900">{t('contracts.labels.allTime')}</p>
                </div>
              </div>
              <span className="text-xl font-bold text-indigo-600">
                {dashboard?.totalBatches ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('contracts.labels.manufacturing')}</p>
                  <p className="text-sm font-medium text-gray-900">{t('contracts.labels.production')}</p>
                </div>
              </div>
              <span className="text-xl font-bold text-blue-600">
                {dashboard?.byActivityType?.manufacturing ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg border border-purple-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FlaskConical className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('contracts.labels.testing')}</p>
                  <p className="text-sm font-medium text-gray-900">{t('contracts.labels.qcQa')}</p>
                </div>
              </div>
              <span className="text-xl font-bold text-purple-600">
                {dashboard?.byActivityType?.testing ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Package className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('contracts.labels.packaging')}</p>
                  <p className="text-sm font-medium text-gray-900">{t('contracts.labels.packOut')}</p>
                </div>
              </div>
              <span className="text-xl font-bold text-amber-600">
                {dashboard?.byActivityType?.packaging ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Timeline Chart - hidden on small screens */}
      {activityChartData.length > 0 && (
        <div className="hidden lg:block bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              {t('contracts.sections.contractActivity')}
            </h3>
          </div>
          <Chart
            id="activity-chart"
            dataSource={activityChartData}
            size={{ height: 180 }}
          >
            <CommonSeriesSettings argumentField="period" type="bar" color="#6366f1" />
            <ChartSeries valueField="count" name={t('contracts.labels.batchesProcessed')} color="#6366f1" />
            <ArgumentAxis>
              <ChartLabel overlappingBehavior="rotate" rotationAngle={-45} />
            </ArgumentAxis>
            <ValueAxis />
            <ChartLegend visible={false} />
            <ChartTooltip
              enabled={true}
              customizeTooltip={(arg: { argumentText?: string; valueText?: string }) => ({
                text: `${arg.argumentText}: ${arg.valueText} ${t('contracts.labels.batches')}`,
              })}
            />
          </Chart>
        </div>
      )}

      {/* Main Content - Tabs + Search + List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tabs - scroll-snap responsive */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
          <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-thin snap-x w-full">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 snap-start min-h-[36px] ${
                    isActive
                      ? 'bg-yellow-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold ${
                      isActive ? 'bg-white/25 text-inherit' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search + Count Row */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('contracts.actions.viewContract')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500"
            />
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
            <Briefcase className="h-4 w-4 text-gray-400" />
            <span>
              {filteredContracts.length} / {allContracts.length} {t('contracts.labels.contracts')}
            </span>
          </div>
        </div>

        {/* Content: Loading / Empty / No Results / Mobile Cards / Desktop Grid */}
        {contractsLoading ? (
          isMobile ? (
            <ContractCardSkeletonList count={4} />
          ) : (
            <DataGridLoadingSkeleton />
          )
        ) : showEmptyState ? (
          <EmptyState onCreate={handleNewContract} t={t} />
        ) : showNoResultsState ? (
          <NoResultsState onClear={handleClearFilters} t={t} />
        ) : isMobile ? (
          <ContractCardList
            contracts={filteredContracts}
            onView={handleContractSelect}
            t={t}
          />
        ) : (
          <div className="p-2 sm:p-4 overflow-x-auto">
            <DxDataGrid
              dataSource={filteredContracts}
              keyExpr="id"
              showBorders={false}
              rowAlternationEnabled
              loading={contractsLoading}
              height="auto"
              width="100%"
              columnAutoWidth
              onRowClick={(e) => {
                if (e.data) handleContractSelect(e.data);
              }}
            >
              <DxSearchPanel visible={false} />
              <DxPaging defaultPageSize={15} />

              <DxColumn
                dataField="_rowNumber"
                caption={t('items.grid.columns.rowNum')}
                width={60}
                alignment="center"
                allowFiltering={false}
                allowSorting={false}
                allowGrouping={false}
                cellRender={(cellInfo) => (
                  <span className="text-gray-500 text-sm font-medium">
                    {cellInfo.data._rowNumber}
                  </span>
                )}
              />
              <DxColumn
                dataField="contractorName"
                caption={t('contracts.type.manufacturer')}
                minWidth={220}
                cellRender={renderContractorCell}
              />
              <DxColumn
                dataField="contractorType"
                caption={t('contracts.sections.byType')}
                width={130}
                cellRender={renderTypeCell}
              />
              <DxColumn
                dataField="effectiveDate"
                caption={t('contracts.actions.newContract')}
                dataType="date"
                width={120}
              />
              <DxColumn
                caption={t('contracts.stats.expiringSoon')}
                width={170}
                cellRender={renderExpirationCell}
                allowFiltering={false}
                allowSorting={false}
              />
              <DxColumn
                dataField="batchCount"
                caption={t('contracts.labels.batches')}
                width={90}
                alignment="center"
              />
              <DxColumn
                caption={t('contracts.stats.auditsOverdue')}
                width={140}
                cellRender={renderAuditCell}
                allowFiltering={false}
                allowSorting={false}
              />
              <DxColumn
                dataField="status"
                caption={t('contracts.sections.byStatus')}
                width={130}
                cellRender={renderStatusCell}
              />
              <DxColumn
                caption=""
                width={60}
                cellRender={renderActionsCell}
                allowFiltering={false}
                allowSorting={false}
              />
            </DxDataGrid>
          </div>
        )}
      </div>

      {/* Top Contractors - hidden on small screens to prioritize list */}
      {dashboard?.topContractors && dashboard.topContractors.length > 0 && (
        <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-500" />
              {t('contracts.sections.topContractors')}
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {dashboard.topContractors.slice(0, 5).map((contractor, index) => (
              <button
                key={contractor.contractId}
                type="button"
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 active:bg-gray-200 transition-colors text-left min-h-[44px]"
                onClick={() => router.push(`/gmp/contracts/${contractor.contractId}`)}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                    index === 0
                      ? 'bg-indigo-500'
                      : index === 1
                      ? 'bg-blue-500'
                      : index === 2
                      ? 'bg-purple-500'
                      : 'bg-gray-400'
                  }`}
                >
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {contractor.contractorName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {contractor.batchCount} {t('contracts.labels.batches')}
                    <span className={`ml-2 ${contractor.status === 'active' ? 'text-green-600' : 'text-gray-400'}`}>
                      ({t(`contracts.status.${contractor.status}`)})
                    </span>
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* New Contract Dialog */}
      <ContractDataEntryDialog
        visible={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        onSaved={handleContractSaved}
        mode="create"
      />
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

/**
 * Mobile Card List — replaces DataGrid on mobile viewports.
 * Each card prioritizes: Contract Number → Contractor Name → Type → Expiry (highlighted if expiring) → Status.
 * Tap card to view; footer "View Details" action with min-h-[44px] touch target.
 */
function ContractCardList({
  contracts,
  onView,
  t,
}: {
  contracts: ManufacturingContract[];
  onView: (contract: ManufacturingContract) => void;
  t: TranslateFn;
}) {
  const statusBadge = (status: ContractStatus) => {
    const cfg = STATUS_BADGE_CONFIG[status];
    if (!cfg) return null;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bgClass}`}>
        <Icon className="h-3 w-3" />
        {t(`contracts.status.${status}`)}
      </span>
    );
  };

  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {contracts.map((c) => {
        const typeCfg = TYPE_ICON_CONFIG[c.contractorType];
        const TypeIcon = typeCfg?.icon || Briefcase;
        const isExpiringSoon = c.isExpiringSoon && c.status === 'active';
        const isExpired = c.daysUntilExpiry !== undefined && c.daysUntilExpiry < 0 && c.status === 'active';

        return (
          <div
            key={c.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all"
          >
            {/* Card body: tap to view */}
            <button
              type="button"
              onClick={() => onView(c)}
              className="w-full text-left p-4 flex items-start gap-3"
            >
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${typeCfg?.bgClass || 'bg-yellow-100'}`}>
                <TypeIcon className={`h-5 w-5 ${typeCfg?.iconColor || 'text-yellow-700'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-gray-900 text-sm truncate">{c.contractNumber}</p>
                    <p className="font-medium text-gray-900 text-base truncate mt-0.5" title={c.contractorName}>
                      {c.contractorName}
                    </p>
                  </div>
                  {statusBadge(c.status)}
                </div>

                {c.scope && (
                  <p className="text-sm text-gray-600 truncate mt-1" title={c.scope}>
                    {c.scope}
                  </p>
                )}

                {/* Tags row */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                    <TypeIcon className="h-3 w-3" />
                    {t(`contracts.type.${c.contractorType}`)}
                  </span>
                  {c.expirationDate && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${
                        isExpired
                          ? 'bg-red-50 text-red-700 border-red-200 font-semibold'
                          : isExpiringSoon
                          ? 'bg-amber-50 text-amber-700 border-amber-200 font-semibold'
                          : 'bg-blue-50 text-blue-700 border-blue-100'
                      }`}
                    >
                      {isExpired || isExpiringSoon ? <AlertTriangle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                      {formatDateStr(c.expirationDate)}
                      {isExpiringSoon && c.daysUntilExpiry !== undefined && ` (${c.daysUntilExpiry}d)`}
                    </span>
                  )}
                  {c.batchCount !== undefined && c.batchCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                      <Package className="h-3 w-3" />
                      {c.batchCount} {t('contracts.labels.batches')}
                    </span>
                  )}
                  {c.isAuditOverdue && (
                    <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-200 font-semibold">
                      <ClipboardCheck className="h-3 w-3" />
                      {t('contracts.labels.overdue')}
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Card footer: tap target 44px minimum */}
            <div className="flex items-center border-t border-gray-100">
              <button
                type="button"
                onClick={() => onView(c)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 active:bg-indigo-100 transition-colors min-h-[44px]"
              >
                <Eye className="h-4 w-4" />
                <span>{t('contracts.actions.viewContract')}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Loading skeleton for mobile card list */
function ContractCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 bg-gray-200 rounded" />
              <div className="h-4 w-2/3 bg-gray-200 rounded" />
              <div className="h-3 w-1/2 bg-gray-200 rounded" />
              <div className="flex gap-2 pt-1">
                <div className="h-5 w-16 bg-gray-200 rounded-full" />
                <div className="h-5 w-20 bg-gray-200 rounded-full" />
                <div className="h-5 w-14 bg-gray-200 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Loading skeleton for desktop DataGrid area */
function DataGridLoadingSkeleton() {
  return (
    <div className="p-4 space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-lg animate-pulse">
          <div className="h-8 w-8 rounded-lg bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/4 bg-gray-200 rounded" />
            <div className="h-2 w-1/6 bg-gray-200 rounded" />
          </div>
          <div className="h-6 w-20 bg-gray-200 rounded-full" />
          <div className="h-6 w-16 bg-gray-200 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Empty State — shown when there are zero contracts at all */
function EmptyState({ onCreate, t }: { onCreate: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-yellow-100 flex items-center justify-center mb-5">
        <ScrollText className="h-10 w-10 text-yellow-700" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {t('contracts.empty.noContracts')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {t('contracts.description')}
      </p>
      <DxButton
        text={t('contracts.actions.newContract')}
        icon="plus"
        type="success"
        onClick={onCreate}
      />
    </div>
  );
}

/** No Results State — shown when filter/search yields zero results */
function NoResultsState({ onClear, t }: { onClear: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {t('contracts.empty.noContracts')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {t('contracts.empty.noData')}
      </p>
      <DxButton
        text={t('contracts.actions.refresh')}
        icon="clear"
        stylingMode="outlined"
        onClick={onClear}
      />
    </div>
  );
}

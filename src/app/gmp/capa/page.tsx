'use client';

/**
 * CAPA Management Dashboard
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * Professional responsive dashboard for viewing and managing CAPAs with:
 * - ResponsivePageHeader with icon
 * - 4 StatCard KPI row
 * - Status and Priority distribution charts
 * - Risk matrix visualization
 * - Scroll-snap tabbed data views
 * - Mobile card view (< md) / DataGrid (>= md)
 * - Empty / No-results / Loading skeletons
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import DataGrid, {
  Column,
  Paging,
  Pager,
  SearchPanel,
  Sorting,
  Toolbar,
  Item,
  LoadPanel,
  MasterDetail,
  StateStoring,
} from 'devextreme-react/data-grid';
import { PieChart, Series, Label, Legend, Tooltip, Connector } from 'devextreme-react/pie-chart';
import { Chart, CommonSeriesSettings, Series as ChartSeries, ArgumentAxis, ValueAxis, Legend as ChartLegend, Tooltip as ChartTooltip } from 'devextreme-react/chart';
import { DxButton } from '@/components/ui/dx-button';
import { CapaDataEntryDialog } from '@/components/capa/CapaDataEntryDialog';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
import {
  FileCheck,
  Clock,
  AlertTriangle,
  CheckCircle,
  Shield,
  ClipboardList,
  ClipboardCheck,
  Users,
  Target,
  BarChart3,
  PieChartIcon,
  FileText,
  SearchX,
  ChevronRight,
  Calendar,
  Eye,
} from 'lucide-react';
import type { Capa, CapaStatus, CapaPriority, CapaDashboard, RiskSeverity, RiskProbability } from '@/types/capa';

// ============================================
// Types
// ============================================

interface ApiError extends Error {
  details?: string;
  stack?: string;
}

type TabKey = 'all' | 'active' | 'overdue' | 'pending_approval' | 'closed';

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

// ============================================
// API Functions
// ============================================

async function fetchDashboard(): Promise<CapaDashboard> {
  const response = await fetch('/api/capa/dashboard');
  const result = await response.json();
  if (!result.success) {
    const error = new Error(result.error || 'Failed to fetch dashboard') as ApiError;
    error.details = result.details;
    throw error;
  }
  return result.data;
}

async function fetchCapas(params: {
  status?: CapaStatus | CapaStatus[];
  overdue?: boolean;
}): Promise<{ capas: Capa[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params.status) {
    if (Array.isArray(params.status)) {
      params.status.forEach(s => searchParams.append('status', s));
    } else {
      searchParams.set('status', params.status);
    }
  }
  if (params.overdue) searchParams.set('overdue', 'true');
  searchParams.set('limit', '1000'); // Get all for client-side filtering

  const response = await fetch(`/api/capa?${searchParams.toString()}`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch CAPAs');
  }
  return result.data;
}

// ============================================
// Helper Functions
// ============================================

type RiskLevelKey = 'na' | 'low' | 'medium' | 'high' | 'critical';

function getRiskLevelKey(score: number | null): { key: RiskLevelKey; color: string } {
  if (!score) return { key: 'na', color: 'gray' };
  if (score <= 4) return { key: 'low', color: 'green' };
  if (score <= 9) return { key: 'medium', color: 'yellow' };
  if (score <= 16) return { key: 'high', color: 'orange' };
  return { key: 'critical', color: 'red' };
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '-';
  }
}

// Style-only priority config; labels come from translations via priorityLabels.*
const PRIORITY_CONFIG: Record<CapaPriority, { bg: string }> = {
  low: { bg: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
  medium: { bg: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
  high: { bg: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300' },
  critical: { bg: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
};

// Icon-only source type config; labels come from translations via sourceTypes.*
const SOURCE_TYPE_CONFIG: Record<string, { icon: React.ReactNode }> = {
  deviation: { icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  complaint: { icon: <Users className="w-3.5 h-3.5" /> },
  audit_finding: { icon: <ClipboardList className="w-3.5 h-3.5" /> },
  other: { icon: <FileText className="w-3.5 h-3.5" /> },
};

// ============================================
// Sub-Components
// ============================================

interface RiskMatrixProps {
  capas: Capa[];
  t: TranslateFn;
}

function RiskMatrix({ capas, t }: RiskMatrixProps) {
  const severityLevels: RiskSeverity[] = ['negligible', 'minor', 'moderate', 'major', 'critical'];
  const probabilityLevels: RiskProbability[] = ['rare', 'unlikely', 'possible', 'likely', 'certain'];

  const matrixData = useMemo(() => {
    const matrix: Record<string, number> = {};
    capas.forEach(capa => {
      if (capa.riskSeverity && capa.riskProbability) {
        const key = `${capa.riskSeverity}-${capa.riskProbability}`;
        matrix[key] = (matrix[key] || 0) + 1;
      }
    });
    return matrix;
  }, [capas]);

  const getCellColor = (sevIdx: number, probIdx: number): string => {
    const score = (sevIdx + 1) * (probIdx + 1);
    if (score <= 4) return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
    if (score <= 9) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
    if (score <= 16) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200';
    return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
        <Shield className="w-4 h-4" />
        {t('capa.charts.riskMatrixTitle')}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="p-1"></th>
              {probabilityLevels.map(p => (
                <th key={p} className="p-1 text-center font-medium text-gray-500 dark:text-gray-400 min-w-[60px]">
                  {t(`capa.riskMatrix.probability.${p}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...severityLevels].reverse().map((severity, sIdx) => (
              <tr key={severity}>
                <td className="p-1 text-right font-medium text-gray-500 dark:text-gray-400 pr-2">
                  {t(`capa.riskMatrix.severity.${severity}`)}
                </td>
                {probabilityLevels.map((probability, pIdx) => {
                  const count = matrixData[`${severity}-${probability}`] || 0;
                  return (
                    <td key={`${severity}-${probability}`} className="p-1">
                      <div
                        className={`rounded-lg h-10 flex items-center justify-center font-bold transition-all ${getCellColor(severityLevels.length - 1 - sIdx, pIdx)} ${
                          count > 0 ? 'ring-2 ring-offset-1 ring-gray-400' : ''
                        }`}
                      >
                        {count > 0 ? count : ''}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-green-100 dark:bg-green-900/30"></div>
            <span className="text-gray-500">{t('capa.riskMatrix.low')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-yellow-100 dark:bg-yellow-900/30"></div>
            <span className="text-gray-500">{t('capa.riskMatrix.medium')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-orange-100 dark:bg-orange-900/30"></div>
            <span className="text-gray-500">{t('capa.riskMatrix.high')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-red-100 dark:bg-red-900/30"></div>
            <span className="text-gray-500">{t('capa.riskMatrix.critical')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function CapaDashboardPage() {
  const router = useRouter();
  const t = useTranslations('gmp');
  // Force DataGrid remount on locale switch so column captions refresh.
  const locale = useLocale();
  const { isMobile } = useMobile();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [showNewCapaDialog, setShowNewCapaDialog] = useState(false);

  // Fetch dashboard data
  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['capa-dashboard'],
    queryFn: fetchDashboard,
  });

  // Fetch all CAPAs for the grid
  const { data: capaData, isLoading: capasLoading, refetch: refetchCapas } = useQuery({
    queryKey: ['capas-all'],
    queryFn: () => fetchCapas({}),
  });

  // Filter CAPAs based on active tab
  const filteredCapas = useMemo(() => {
    if (!capaData?.capas) return [];

    let filtered: Capa[];
    switch (activeTab) {
      case 'active':
        filtered = capaData.capas.filter(c =>
          ['open', 'investigation', 'action_pending', 'verification'].includes(c.status)
        );
        break;
      case 'overdue':
        filtered = capaData.capas.filter(c => c.isOverdue);
        break;
      case 'pending_approval':
        filtered = capaData.capas.filter(c => c.status === 'pending_approval');
        break;
      case 'closed':
        filtered = capaData.capas.filter(c => c.status === 'closed');
        break;
      default:
        filtered = capaData.capas;
    }
    return filtered.map((item, index) => ({ ...item, _rowNumber: index + 1 }));
  }, [capaData?.capas, activeTab]);

  // Chart data
  const statusChartData = useMemo(() => {
    if (!dashboard?.byStatus) return [];
    const statusColors: Record<string, string> = {
      open: '#3b82f6',
      investigation: '#8b5cf6',
      action_pending: '#f59e0b',
      verification: '#06b6d4',
      pending_approval: '#ec4899',
      closed: '#22c55e',
      cancelled: '#6b7280',
    };
    return Object.entries(dashboard.byStatus)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => {
        const key = `capa.charts.statusLabels.${status}`;
        const translated = t(key);
        return {
          status: translated === key ? status : translated,
          count,
          color: statusColors[status] || '#6b7280',
        };
      });
  }, [dashboard?.byStatus, t]);

  const priorityChartData = useMemo(() => {
    if (!dashboard?.byPriority) return [];
    const priorityColors: Record<string, string> = {
      low: '#22c55e',
      medium: '#eab308',
      high: '#f97316',
      critical: '#ef4444',
    };
    return Object.entries(dashboard.byPriority)
      .map(([priority, count]) => {
        const key = `capa.priority.${priority}`;
        const translated = t(key);
        return {
          priority: translated === key ? priority.charAt(0).toUpperCase() + priority.slice(1) : translated,
          count,
          color: priorityColors[priority] || '#6b7280',
        };
      });
  }, [dashboard?.byPriority, t]);

  // Tab configuration (scroll-snap responsive)
  const tabs: Array<{ id: TabKey; label: string; count: number; accent?: 'danger' | 'warn' | 'success' }> = useMemo(() => [
    { id: 'all', label: t('capa.tabs.all'), count: capaData?.total || 0 },
    { id: 'active', label: t('capa.tabs.active'), count: dashboard?.totalOpen || 0 },
    { id: 'overdue', label: t('capa.tabs.overdue'), count: dashboard?.overdue || 0, accent: 'danger' },
    { id: 'pending_approval', label: t('capa.tabs.pendingApproval'), count: dashboard?.byStatus?.pending_approval || 0, accent: 'warn' },
    { id: 'closed', label: t('capa.tabs.closed'), count: dashboard?.closedThisMonth || 0, accent: 'success' },
  ], [dashboard, capaData?.total, t]);

  // Handlers
  const handleRefresh = useCallback(() => {
    refetchDashboard();
    refetchCapas();
  }, [refetchDashboard, refetchCapas]);

  const handleRowClick = useCallback((e: { data: Capa }) => {
    router.push(`/gmp/capa/${e.data.id}`);
  }, [router]);

  const handleViewCapa = useCallback((capa: Capa) => {
    router.push(`/gmp/capa/${capa.id}`);
  }, [router]);

  const handleNewCapa = useCallback(() => {
    setShowNewCapaDialog(true);
  }, []);

  const handleDialogClose = useCallback(() => {
    setShowNewCapaDialog(false);
  }, []);

  const handleDialogSuccess = useCallback((capa?: Capa) => {
    handleDialogClose();
    handleRefresh();
    if (capa) {
      router.push(`/gmp/capa/${capa.id}`);
    }
  }, [handleDialogClose, handleRefresh, router]);

  const handleClearFilters = useCallback(() => {
    setActiveTab('all');
  }, []);

  // Cell renderers
  const renderPriority = useCallback((cellData: { value: CapaPriority }) => {
    const config = PRIORITY_CONFIG[cellData.value];
    if (!config) return null;
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg}`}>
        {t(`capa.priorityLabels.${cellData.value}`)}
      </span>
    );
  }, [t]);

  const renderStatus = useCallback((cellData: { value: CapaStatus }) => {
    return <WorkflowStatusBadge status={cellData.value} />;
  }, []);

  const renderRiskScore = useCallback((cellData: { data: Capa }) => {
    const { key, color } = getRiskLevelKey(cellData.data.riskScore);
    const colorClasses: Record<string, string> = {
      green: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
      yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
      orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
      red: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
      gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    };
    return (
      <div className="flex items-center gap-2">
        {cellData.data.riskScore && (
          <span className="text-sm font-mono">{cellData.data.riskScore}</span>
        )}
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClasses[color]}`}>
          {t(`capa.riskLevels.${key}`)}
        </span>
      </div>
    );
    // t re-evaluates every render; include to silence exhaustive-deps
  }, [t]);

  const renderOverdue = useCallback((cellData: { data: Capa }) => {
    if (cellData.data.isOverdue) {
      return (
        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
          <AlertTriangle className="h-4 w-4" />
        </span>
      );
    }
    return null;
  }, []);

  const renderActionProgress = useCallback((cellData: { data: Capa }) => {
    const { actionCount = 0, actionsCompleted = 0 } = cellData.data;
    if (actionCount === 0) return <span className="text-gray-400 text-xs">-</span>;

    const percentage = Math.round((actionsCompleted / actionCount) * 100);
    const isComplete = actionsCompleted === actionCount;

    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-[60px]">
          <div
            className={`h-full transition-all ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs text-gray-600 dark:text-gray-400 min-w-[32px]">
          {actionsCompleted}/{actionCount}
        </span>
      </div>
    );
  }, []);

  const renderSourceType = useCallback((cellData: { value: string }) => {
    const config = SOURCE_TYPE_CONFIG[cellData.value] || {
      icon: <FileText className="w-3.5 h-3.5" />,
    };
    const translationKey = `capa.sourceTypes.${cellData.value}`;
    const translated = t(translationKey);
    return (
      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
        {config.icon}
        <span className="text-xs">
          {translated === translationKey ? cellData.value : translated}
        </span>
      </div>
    );
  }, [t]);

  // Master detail template
  const masterDetailTemplate = useCallback((e: { data: Capa }) => {
    const capa = e.data;
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('capa.masterDetail.rootCause')}</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {capa.rootCauseAnalysis || t('capa.masterDetail.notAnalyzed')}
          </p>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('capa.masterDetail.impactAssessment')}</h4>
          <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <p>{t('capa.masterDetail.scope')}: <span className="font-medium">{capa.impactScope || t('capa.masterDetail.notAvailable')}</span></p>
            <p>{t('capa.masterDetail.patientImpact')}: <span className={capa.patientImpact ? 'text-red-600 font-medium' : ''}>{capa.patientImpact ? t('capa.masterDetail.yes') : t('capa.masterDetail.no')}</span></p>
            <p>{t('capa.masterDetail.regulatoryRequired')}: <span className={capa.regulatoryNotificationRequired ? 'text-orange-600 font-medium' : ''}>{capa.regulatoryNotificationRequired ? t('capa.masterDetail.yes') : t('capa.masterDetail.no')}</span></p>
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('capa.masterDetail.approvalStatus')}</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {capa.approvalStatus ? (
              <span className={`font-medium ${capa.approvalStatus === 'approved' ? 'text-green-600' : capa.approvalStatus === 'rejected' ? 'text-red-600' : 'text-yellow-600'}`}>
                {capa.approvalStatus.replace('_', ' ').toUpperCase()}
              </span>
            ) : t('capa.masterDetail.notSubmitted')}
          </p>
        </div>
      </div>
    );
  }, [t]);

  const isLoading = dashboardLoading || capasLoading;
  const totalCapas = capaData?.capas.length || 0;
  const showEmptyState = !isLoading && totalCapas === 0;
  const showNoResultsState = !isLoading && totalCapas > 0 && filteredCapas.length === 0;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title={t('capa.pageTitle')}
        subtitle={`${t('capa.description')} • GMP Chapter 1 Compliance`}
        icon={ClipboardCheck}
        iconBgColor="bg-orange-100"
        iconColor="text-orange-600"
        breadcrumbs={[
          { label: 'GMP', href: '/gmp' },
          { label: t('capa.title') },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              text={t('capa.actions.refresh')}
              type="default"
              stylingMode="outlined"
              onClick={handleRefresh}
              className="hidden sm:inline-flex"
            />
            <DxButton
              icon="plus"
              text={t('capa.actions.newCapa')}
              type="success"
              onClick={handleNewCapa}
            />
          </div>
        }
      />

      {/* KPI Stat Cards - 4 primary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('capa.stats.openCapas')}
          value={dashboard?.totalOpen || 0}
          icon={FileCheck}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
          onClick={() => setActiveTab('active')}
        />
        <StatCard
          label={t('capa.stats.overdue')}
          value={dashboard?.overdue || 0}
          icon={AlertTriangle}
          iconColor={dashboard?.overdue ? 'text-red-500' : 'text-gray-400'}
          accentColor={dashboard?.overdue ? 'border-red-500' : 'border-gray-300'}
          isLoading={isLoading}
          onClick={() => setActiveTab('overdue')}
        />
        <StatCard
          label={t('capa.stats.pendingApproval')}
          value={dashboard?.byStatus?.pending_approval || 0}
          icon={Clock}
          iconColor="text-purple-500"
          accentColor="border-purple-500"
          isLoading={isLoading}
          onClick={() => setActiveTab('pending_approval')}
        />
        <StatCard
          label={t('capa.stats.closedThisMonth')}
          value={dashboard?.closedThisMonth || 0}
          icon={CheckCircle}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={isLoading}
          onClick={() => setActiveTab('closed')}
        />
      </div>

      {/* Charts Row - hidden on small screens to prioritize the list */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        {/* Status Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4" />
            {t('capa.charts.statusDistribution')}
          </h3>
          {statusChartData.length > 0 ? (
            <PieChart
              key={locale}
              id="status-pie"
              dataSource={statusChartData}
              type="doughnut"
              innerRadius={0.65}
              palette={statusChartData.map(d => d.color)}
              size={{ height: 200 }}
            >
              <Series argumentField="status" valueField="count">
                <Label visible={true} position="inside" customizeText={(e: { valueText: string }) => e.valueText}>
                  <Connector visible={false} />
                </Label>
              </Series>
              <Legend
                visible={true}
                horizontalAlignment="right"
                verticalAlignment="top"
                itemTextPosition="right"
                font={{ size: 11 }}
                customizeText={(info: { pointName?: string; pointIndex?: number }) => {
                  const d = statusChartData[info.pointIndex ?? -1];
                  return d ? `${info.pointName} (${d.count})` : (info.pointName ?? '');
                }}
              />
              <Tooltip enabled={true} />
            </PieChart>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <PieChartIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('capa.charts.noDataAvailable')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Priority Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            {t('capa.charts.priorityDistribution')}
          </h3>
          {priorityChartData.length > 0 ? (
            <Chart
              key={locale}
              id="priority-chart"
              dataSource={priorityChartData}
              rotated={true}
              size={{ height: 200 }}
            >
              <CommonSeriesSettings type="bar" argumentField="priority" valueField="count" />
              <ChartSeries
                name="Count"
                color="#10b981"
                barWidth={30}
              />
              <ArgumentAxis />
              <ValueAxis />
              <ChartLegend visible={false} />
              <ChartTooltip enabled={true} />
            </Chart>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('capa.charts.noDataAvailable')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Risk Matrix */}
        <RiskMatrix capas={capaData?.capas || []} t={t} />
      </div>

      {/* Main Content - Tabs + Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {/* Tabs Header - scroll-snap responsive */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-50/50 to-white dark:from-gray-900/40 dark:to-gray-800">
          <div className="flex items-center gap-1 p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto scrollbar-thin snap-x w-full">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const badgeColorClass =
                isActive
                  ? 'bg-white/25 text-inherit'
                  : tab.accent === 'danger'
                  ? 'bg-red-500 text-white'
                  : tab.accent === 'warn'
                  ? 'bg-amber-500 text-white'
                  : tab.accent === 'success'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-200 text-gray-700';
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 snap-start min-h-[36px] ${
                    isActive
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold ${badgeColorClass}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Result count row */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            <ClipboardCheck className="w-4 h-4 text-gray-400" />
            <span>
              {t(
                filteredCapas.length === 1 ? 'capa.resultCountSingular' : 'capa.resultCount',
                { count: filteredCapas.length }
              )}
            </span>
          </div>
        </div>

        {/* Content: Loading / Empty / No Results / Mobile Cards / Desktop Grid */}
        {isLoading ? (
          isMobile ? (
            <CapaCardSkeletonList count={4} />
          ) : (
            <DataGridLoadingSkeleton />
          )
        ) : showEmptyState ? (
          <EmptyState onCreate={handleNewCapa} t={t} />
        ) : showNoResultsState ? (
          <NoResultsState onClear={handleClearFilters} t={t} />
        ) : isMobile ? (
          <CapaCardList capas={filteredCapas} onView={handleViewCapa} t={t} />
        ) : (
          <div className="overflow-x-auto">
            <DataGrid
              key={locale}
              dataSource={filteredCapas}
              showBorders={false}
              showRowLines={true}
              showColumnLines={false}
              rowAlternationEnabled={true}
              hoverStateEnabled={true}
              onRowClick={handleRowClick}
              wordWrapEnabled={false}
              columnAutoWidth={true}
              height={500}
              className="dx-card-grid"
              style={{ minWidth: 1000 }}
            >
              <LoadPanel enabled={true} />
              <StateStoring enabled={true} type="localStorage" storageKey="capaGridState" />
              <SearchPanel visible={true} width={250} placeholder={t('capa.search.placeholder')} />
              <Sorting mode="multiple" />
              <Paging defaultPageSize={20} />
              <Pager
                showPageSizeSelector={true}
                allowedPageSizes={[10, 20, 50, 100]}
                showInfo={true}
                showNavigationButtons={true}
              />
              <MasterDetail enabled={true} component={masterDetailTemplate} />

              <Column
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
              <Column dataField="capaNumber" caption={t('capa.table.columns.capaNumber')} width={130} fixed={true} />
              <Column dataField="title" caption={t('capa.table.columns.title')} minWidth={200} />
              <Column
                dataField="sourceType"
                caption={t('capa.table.columns.source')}
                width={130}
                cellRender={renderSourceType}
              />
              <Column dataField="type" caption={t('capa.table.columns.type')} width={100} cellRender={(e: { value: string }) => (
                <span className="capitalize text-sm">{e.value}</span>
              )} />
              <Column
                dataField="priority"
                caption={t('capa.table.columns.priority')}
                width={110}
                cellRender={renderPriority}
              />
              <Column
                dataField="status"
                caption={t('capa.table.columns.status')}
                width={140}
                cellRender={renderStatus}
              />
              <Column
                dataField="riskScore"
                caption={t('capa.table.columns.risk')}
                width={110}
                cellRender={renderRiskScore}
              />
              <Column
                dataField="isOverdue"
                caption=""
                width={40}
                cellRender={renderOverdue}
                allowFiltering={false}
                allowSorting={false}
              />
              <Column
                dataField="actionCount"
                caption={t('capa.table.columns.actions')}
                width={120}
                cellRender={renderActionProgress}
              />
              <Column dataField="ownerName" caption={t('capa.table.columns.owner')} width={150} />
              <Column
                dataField="dueDate"
                caption={t('capa.table.columns.dueDate')}
                width={110}
                dataType="date"
                format="dd MMM yyyy"
              />
              <Column
                dataField="createdAt"
                caption={t('capa.table.columns.created')}
                width={110}
                dataType="date"
                format="dd MMM yyyy"
                visible={false}
              />

              <Toolbar>
                <Item name="searchPanel" />
              </Toolbar>
            </DataGrid>
          </div>
        )}
      </div>

      {/* New CAPA Dialog */}
      <CapaDataEntryDialog
        visible={showNewCapaDialog}
        onClose={handleDialogClose}
        onSaved={handleDialogSuccess}
      />
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

/**
 * Mobile Card List — replaces DataGrid on mobile viewports.
 * Each card prioritizes: CAPA # → Title → Type (Corrective/Preventive) → Status + Priority + Due Date.
 * Tap card to view; footer "View Details" action with min-h-[44px].
 */
function CapaCardList({
  capas,
  onView,
  t,
}: {
  capas: Capa[];
  onView: (capa: Capa) => void;
  t: TranslateFn;
}) {
  const statusBadge = (status: CapaStatus) => <WorkflowStatusBadge status={status} />;

  const priorityBadge = (priority: CapaPriority | null | undefined) => {
    if (!priority) return null;
    const config = PRIORITY_CONFIG[priority];
    if (!config) return null;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${config.bg}`}>
        {t(`capa.priorityLabels.${priority}`)}
      </span>
    );
  };

  const typeBadge = (type: string | null | undefined) => {
    if (!type) return null;
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
        <Target className="h-3 w-3" />
        <span className="capitalize">{type}</span>
      </span>
    );
  };

  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30 dark:bg-gray-900/30">
      {capas.map((capa) => {
        const isOverdue = capa.isOverdue;
        return (
          <div
            key={capa.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 dark:active:bg-gray-700/50 transition-all"
          >
            {/* Card body: tap to view */}
            <button
              type="button"
              onClick={() => onView(capa)}
              className="w-full text-left p-4 flex items-start gap-3"
            >
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isOverdue ? 'bg-red-100 dark:bg-red-900/40' : 'bg-orange-100 dark:bg-orange-900/40'
              }`}>
                <ClipboardCheck className={`h-5 w-5 ${
                  isOverdue ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-blue-700 dark:text-blue-400 text-base truncate">
                      {capa.capaNumber || '-'}
                    </p>
                  </div>
                  {statusBadge(capa.status)}
                </div>

                {/* Title */}
                {capa.title && (
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2 mt-1" title={capa.title}>
                    {capa.title}
                  </p>
                )}

                {/* Tags row: type, priority, due date */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {typeBadge(capa.type)}
                  {priorityBadge(capa.priority)}
                  {capa.dueDate && (
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
                      isOverdue
                        ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-semibold'
                        : 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    }`}>
                      <Calendar className="h-3 w-3" />
                      {formatDateShort(capa.dueDate)}
                      {isOverdue && (
                        <AlertTriangle className="h-3 w-3 ml-0.5" />
                      )}
                    </span>
                  )}
                </div>

                {/* Owner */}
                {capa.ownerName && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1.5">
                    <Users className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{capa.ownerName}</span>
                  </p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-2" />
            </button>

            {/* Card footer: view action (touch-friendly 44px) */}
            <div className="flex items-center border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => onView(capa)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-700 dark:hover:text-orange-300 active:bg-orange-100 transition-colors min-h-[44px]"
              >
                <Eye className="h-4 w-4" />
                <span>{t('capa.mobile.viewDetails')}</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Loading skeleton for mobile card list */
function CapaCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30 dark:bg-gray-900/30" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="flex gap-2 pt-1">
                <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
                <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
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
        <div key={i} className="flex items-center gap-4 p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg animate-pulse">
          <div className="h-8 w-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/4 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-2 w-1/6 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Empty State — shown when there are zero CAPAs at all */
function EmptyState({ onCreate, t }: { onCreate: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center mb-5">
        <ClipboardCheck className="h-10 w-10 text-orange-600 dark:text-orange-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {t('capa.empty.title')}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
        {t('capa.empty.description')}
      </p>
      <DxButton
        text={t('capa.buttons.newCapa')}
        icon="plus"
        type="success"
        onClick={onCreate}
      />
    </div>
  );
}

/** No Results State — shown when filter yields zero results but data exists */
function NoResultsState({ onClear, t }: { onClear: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
        {t('capa.noResults.title')}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-4">
        {t('capa.noResults.description')}
      </p>
      <DxButton
        text={t('capa.buttons.showAll')}
        icon="clear"
        stylingMode="outlined"
        onClick={onClear}
      />
    </div>
  );
}

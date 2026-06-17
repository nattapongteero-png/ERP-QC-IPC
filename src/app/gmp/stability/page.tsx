'use client';

/**
 * Stability Dashboard Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * Professional, responsive dashboard for stability program management.
 * Uses ResponsivePageHeader + StatCard + mobile card list + scroll-snap tabs
 * to match the project-wide responsive design system.
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { StabilityStudyList } from '@/components/stability';
import { DxButton } from '@/components/ui/dx-button';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
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
  FlaskConical,
  AlertTriangle,
  CheckCircle,
  Clock,
  Pause,
  Activity,
  TrendingUp,
  Timer,
  BarChart3,
  Package,
  Beaker,
  ThermometerSun,
  Zap,
  ChevronRight,
  Target,
  Shield,
  Play,
  XCircle,
  SearchX,
  Search,
} from 'lucide-react';
import type {
  StabilityStudy,
  StabilityStudyListResponse,
  SampleAlert,
  StabilityStudyStatus,
} from '@/types/stability';

// ============================================
// Types
// ============================================

interface StabilityDashboard {
  totalActiveStudies: number;
  totalCompletedStudies: number;
  totalOnHoldStudies: number;
  overdueSamples: number;
  upcomingSamples: number;
  oosThisMonth: number;
  completedThisMonth: number;
  byStatus: Record<string, number>;
  byStudyType: Record<string, number>;
  byProduct: Array<{
    productId: number;
    productName: string;
    activeStudies: number;
    completedStudies: number;
  }>;
  recentActivity: Array<{
    date: string;
    count: number;
  }>;
}

// next-intl translator type (compatible superset for helper components)
type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

type TabKey = 'all' | 'active' | 'completed' | 'on_hold';

// ============================================
// Constants
// ============================================

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',
  completed: '#3b82f6',
  on_hold: '#f59e0b',
  cancelled: '#ef4444',
};

// Translation keys are nested under stability.studyList.statusLabels


// Translation keys under stability.studyList.typeLabels

const studyStatusStyle: Record<
  StabilityStudyStatus,
  { bg: string; text: string; border: string; ring: string }
> = {
  active: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    ring: 'ring-emerald-100',
  },
  completed: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    ring: 'ring-blue-100',
  },
  on_hold: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    ring: 'ring-amber-100',
  },
  cancelled: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    ring: 'ring-red-100',
  },
};

// ============================================
// API Functions
// ============================================

async function fetchDashboard(): Promise<StabilityDashboard> {
  const response = await fetch('/api/stability/dashboard');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function fetchStudies(status?: StabilityStudyStatus): Promise<StabilityStudyListResponse> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('limit', '50');

  const response = await fetch(`/api/stability/studies?${params}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function fetchAlerts(): Promise<SampleAlert[]> {
  const response = await fetch('/api/stability/samples/alerts?daysAhead=30');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

// ============================================
// Small Sub-components
// ============================================

function StudyTypeCard({
  label,
  condition,
  count,
  icon: Icon,
  bgGradient,
  iconBg,
  iconColor,
  textColor,
}: {
  label: string;
  condition: string;
  count: number;
  icon: React.ElementType;
  bgGradient: string;
  iconBg: string;
  iconColor: string;
  textColor: string;
}) {
  return (
    <div className={`p-4 rounded-xl ${bgGradient} border transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2.5 ${iconBg} rounded-xl flex-shrink-0`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{label}</p>
            <p className="text-xs text-gray-500 truncate">{condition}</p>
          </div>
        </div>
        <span className={`text-2xl font-bold ${textColor}`}>{count}</span>
      </div>
    </div>
  );
}

function AlertCard({
  alert,
  isOverdue,
  onClick,
  t,
}: {
  alert: SampleAlert;
  isOverdue: boolean;
  onClick: () => void;
  t: TranslateFn;
}) {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
        isOverdue
          ? 'bg-red-50 border-red-200 hover:bg-red-100'
          : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
      }`}
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`font-mono text-sm font-semibold ${isOverdue ? 'text-red-700' : 'text-amber-700'}`}>
            {alert.studyNumber}
          </span>
          <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
            isOverdue ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'
          }`}>
            {alert.timepoint}{t('stability.mobile.timepointSuffix')}
          </span>
        </div>
        <p className="text-xs text-gray-600 truncate mt-0.5">
          {alert.productName} | {alert.lotNumber}
        </p>
      </div>
      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold flex-shrink-0 ml-2 ${
        isOverdue ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'
      }`}>
        {isOverdue ? (
          <>
            <AlertTriangle className="h-3 w-3" />
            {t('stability.alerts.daysOverdue', { days: Math.abs(alert.daysUntilDue) })}
          </>
        ) : (
          <>
            <Clock className="h-3 w-3" />
            {t('stability.alerts.daysRemaining', { days: alert.daysUntilDue })}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function StabilityDashboardPage() {
  const router = useRouter();
  const t = useTranslations('gmp');
  const locale = useLocale();
  const { isMobile } = useMobile();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchText, setSearchText] = useState('');

  // Fetch dashboard data
  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['stability-dashboard'],
    queryFn: fetchDashboard,
  });

  // Fetch studies with filter
  const statusFilter = activeTab === 'all' ? undefined : activeTab;
  const { data: studiesData, isLoading: studiesLoading, refetch: refetchStudies } = useQuery({
    queryKey: ['stability-studies', statusFilter],
    queryFn: () => fetchStudies(statusFilter as StabilityStudyStatus | undefined),
  });

  // Fetch alerts
  const { data: alerts = [] } = useQuery({
    queryKey: ['stability-alerts'],
    queryFn: fetchAlerts,
  });

  const overdueAlerts = alerts.filter((a) => a.isOverdue);
  const upcomingAlerts = alerts.filter((a) => !a.isOverdue);

  const handleRefresh = useCallback(() => {
    refetchDashboard();
    refetchStudies();
  }, [refetchDashboard, refetchStudies]);

  const handleCreate = useCallback(() => {
    router.push('/gmp/stability/studies/new');
  }, [router]);

  const handleClearFilters = useCallback(() => {
    setSearchText('');
    setActiveTab('all');
  }, []);

  // Filter studies client-side for search
  const filteredStudies = useMemo(() => {
    const list = studiesData?.studies || [];
    const filtered = !searchText.trim()
      ? list
      : (() => {
          const q = searchText.toLowerCase();
          return list.filter(
            (s) =>
              (s.studyNumber || '').toLowerCase().includes(q) ||
              (s.productName || '').toLowerCase().includes(q) ||
              (s.lotNumber || '').toLowerCase().includes(q) ||
              (s.protocolNumber || '').toLowerCase().includes(q)
          );
        })();
    return filtered.map((item, index) => ({ ...item, _rowNumber: index + 1 }));
  }, [studiesData, searchText]);

  // Prepare chart data
  const statusChartData = useMemo(() => {
    if (!dashboard?.byStatus) return [];
    return Object.entries(dashboard.byStatus)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => {
        const key = `stability.studyList.statusLabels.${status}`;
        const translated = t(key);
        return {
          status,
          label: translated === key ? status : translated,
          value: count,
          color: STATUS_COLORS[status] || '#6b7280',
        };
      });
  }, [dashboard, t]);

  const activityChartData = useMemo(() => {
    if (!dashboard?.recentActivity) return [];
    return dashboard.recentActivity.map((item) => ({
      period: item.date,
      count: item.count,
    }));
  }, [dashboard]);

  // Calculate totals for tabs
  const totalStudies = dashboard
    ? Object.values(dashboard.byStatus).reduce((a, b) => a + b, 0)
    : 0;

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: 'all', label: t('stability.tabs.allStudies'), count: totalStudies },
    { key: 'active', label: t('stability.tabs.active'), count: dashboard?.byStatus?.active || 0 },
    { key: 'completed', label: t('stability.tabs.completed'), count: dashboard?.byStatus?.completed || 0 },
    { key: 'on_hold', label: t('stability.tabs.onHold'), count: dashboard?.byStatus?.on_hold || 0 },
  ];

  // Decide what state to show for the studies list area
  const allStudiesCount = studiesData?.total ?? 0;
  const showEmptyState = !studiesLoading && allStudiesCount === 0 && activeTab === 'all' && !searchText;
  const showNoResultsState =
    !studiesLoading && (allStudiesCount > 0 || activeTab !== 'all' || !!searchText) && filteredStudies.length === 0;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title={t('stability.pageTitle')}
        subtitle={t('stability.subtitle')}
        icon={TrendingUp}
        iconBgColor="bg-green-100"
        iconColor="text-green-600"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              text={t('stability.actions.refresh') || 'Refresh'}
              stylingMode="outlined"
              onClick={handleRefresh}
              className="hidden sm:inline-flex"
            />
            <DxButton
              icon="doc"
              text={t('stability.protocols.title') || 'Protocols'}
              stylingMode="outlined"
              onClick={() => router.push('/gmp/stability/protocols')}
              className="hidden md:inline-flex"
            />
            <DxButton
              icon="chart"
              text={t('stability.trends.title') || 'Trends'}
              stylingMode="outlined"
              onClick={() => router.push('/gmp/stability/trends')}
              className="hidden md:inline-flex"
            />
            <DxButton
              icon="plus"
              text={t('stability.actions.enrollBatch') || 'Enroll Batch'}
              type="success"
              onClick={handleCreate}
            />
          </div>
        }
      />

      {/* KPI Stat Cards - 4 responsive cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('stability.dashboard.totalStudies') || 'Total Studies'}
          value={totalStudies}
          icon={FlaskConical}
          iconColor="text-indigo-500"
          accentColor="border-indigo-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('stability.dashboard.activeStudies') || 'Active'}
          value={dashboard?.totalActiveStudies ?? 0}
          icon={Activity}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('stability.dashboard.completedStudies') || 'Completed'}
          value={dashboard?.totalCompletedStudies ?? 0}
          icon={CheckCircle}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('stability.dashboard.dueIn30Days') || 'Upcoming Timepoints'}
          value={dashboard?.upcomingSamples ?? 0}
          icon={Timer}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={dashboardLoading}
        />
      </div>

      {/* Secondary stats - large screens only */}
      <div className="hidden xl:grid grid-cols-3 gap-3 md:gap-4">
        <StatCard
          label={t('stability.dashboard.overdueSamples') || 'Overdue Samples'}
          value={dashboard?.overdueSamples ?? 0}
          icon={AlertTriangle}
          iconColor={(dashboard?.overdueSamples ?? 0) > 0 ? 'text-red-500' : 'text-gray-400'}
          accentColor={(dashboard?.overdueSamples ?? 0) > 0 ? 'border-red-500' : 'border-gray-400'}
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('stability.dashboard.oosThisMonth') || 'OOS This Month'}
          value={dashboard?.oosThisMonth ?? 0}
          icon={Shield}
          iconColor={(dashboard?.oosThisMonth ?? 0) > 0 ? 'text-orange-500' : 'text-gray-400'}
          accentColor={(dashboard?.oosThisMonth ?? 0) > 0 ? 'border-orange-500' : 'border-gray-400'}
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('stability.dashboard.testsThisMonth') || 'Tests This Month'}
          value={dashboard?.completedThisMonth ?? 0}
          icon={BarChart3}
          iconColor="text-indigo-500"
          accentColor="border-indigo-500"
          isLoading={dashboardLoading}
        />
      </div>

      {/* Alerts Section */}
      {(overdueAlerts.length > 0 || upcomingAlerts.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Overdue Alerts */}
          {overdueAlerts.length > 0 && (
            <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 sm:px-5 sm:py-4 bg-gradient-to-r from-red-50 to-red-100/50 border-b border-red-200">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-red-900">
                        {t('stability.alerts.overdueTitle') || 'Overdue Samples'}
                      </h3>
                      <p className="text-xs text-red-600">
                        {t('stability.alerts.overdueDescription', { count: overdueAlerts.length }) ||
                          `${overdueAlerts.length} samples require immediate attention`}
                      </p>
                    </div>
                  </div>
                  <DxButton
                    text={t('stability.actions.viewAll') || 'View All'}
                    stylingMode="text"
                    onClick={() => router.push('/gmp/stability/studies?filter=overdue')}
                  />
                </div>
              </div>
              <div className="p-3 sm:p-4 space-y-2 max-h-[280px] overflow-y-auto">
                {overdueAlerts.slice(0, 5).map((alert) => (
                  <AlertCard
                    key={alert.sampleId}
                    alert={alert}
                    isOverdue
                    onClick={() => router.push(`/gmp/stability/studies/${alert.studyId}`)}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Samples */}
          {upcomingAlerts.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 sm:px-5 sm:py-4 bg-gradient-to-r from-amber-50 to-amber-100/50 border-b border-amber-200">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-amber-900">
                        {t('stability.alerts.upcomingTitle') || 'Upcoming Samples'}
                      </h3>
                      <p className="text-xs text-amber-600">
                        {t('stability.alerts.upcomingDescription', { count: upcomingAlerts.length }) ||
                          `${upcomingAlerts.length} samples due within 30 days`}
                      </p>
                    </div>
                  </div>
                  <DxButton
                    text={t('stability.actions.viewAll') || 'View All'}
                    stylingMode="text"
                    onClick={() => router.push('/gmp/stability/studies?filter=upcoming')}
                  />
                </div>
              </div>
              <div className="p-3 sm:p-4 space-y-2 max-h-[280px] overflow-y-auto">
                {upcomingAlerts.slice(0, 5).map((alert) => (
                  <AlertCard
                    key={alert.sampleId}
                    alert={alert}
                    isOverdue={false}
                    onClick={() => router.push(`/gmp/stability/studies/${alert.studyId}`)}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts & Cards Section — hidden on small screens to prioritize the list */}
      <div className="hidden xl:grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Left: Study Types + Status Distribution */}
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Study Types */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 min-w-0">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-5 w-5 text-emerald-600" />
              <h3 className="font-semibold text-gray-900">
                {t('stability.dashboard.activeByType') || 'Active Studies by Type'}
              </h3>
            </div>
            <div className="space-y-3">
              <StudyTypeCard
                label={t('stability.studyList.typeLabels.long_term')}
                condition="25°C / 60%RH"
                count={dashboard?.byStudyType?.long_term ?? 0}
                icon={ThermometerSun}
                bgGradient="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200"
                iconBg="bg-blue-100"
                iconColor="text-blue-600"
                textColor="text-blue-700"
              />
              <StudyTypeCard
                label={t('stability.studyList.typeLabels.accelerated')}
                condition="40°C / 75%RH"
                count={dashboard?.byStudyType?.accelerated ?? 0}
                icon={Zap}
                bgGradient="bg-gradient-to-r from-red-50 to-rose-50 border-red-200"
                iconBg="bg-red-100"
                iconColor="text-red-600"
                textColor="text-red-700"
              />
              <StudyTypeCard
                label={t('stability.studyList.typeLabels.intermediate')}
                condition="30°C / 65%RH"
                count={dashboard?.byStudyType?.intermediate ?? 0}
                icon={Beaker}
                bgGradient="bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200"
                iconBg="bg-amber-100"
                iconColor="text-amber-600"
                textColor="text-amber-700"
              />
            </div>
          </div>

          {/* Status Distribution */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 min-w-0">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">
                {t('stability.dashboard.byStatus') || 'Studies by Status'}
              </h3>
            </div>
            {statusChartData.length > 0 ? (
              <PieChart
                key={locale}
                id="status-pie"
                dataSource={statusChartData}
                type="doughnut"
                innerRadius={0.65}
                palette={statusChartData.map((d) => d.color)}
                size={{ height: 280 }}
              >
                <Series argumentField="label" valueField="value">
                  <Label visible={false} />
                  <Connector visible={false} />
                </Series>
                <Legend
                  visible
                  orientation="vertical"
                horizontalAlignment="right"
                verticalAlignment="top"
                  font={{ size: 11 }}
                  customizeText={(info: { pointName?: string; pointIndex?: number }) => {
                    const d = statusChartData[info.pointIndex ?? -1];
                    return d ? `${info.pointName} (${d.value})` : (info.pointName ?? '');
                  }}
                />
                <Tooltip
                  enabled
                  customizeTooltip={(arg: { argumentText?: string; valueText?: string; percentText?: string }) => ({
                    text: `${arg.argumentText}: ${arg.valueText} (${arg.percentText})`,
                  })}
                />
              </PieChart>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Shield className="h-12 w-12 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">
                    {t('stability.dashboard.noStudyData') || 'No study data'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Program Summary */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical className="h-5 w-5 text-emerald-600" />
            <h3 className="font-semibold text-gray-900">
              {t('stability.dashboard.programSummary') || 'Program Summary'}
            </h3>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-emerald-100 rounded-lg flex-shrink-0">
                  <FlaskConical className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="text-sm font-medium text-gray-700 truncate">
                  {t('stability.dashboard.totalStudies') || 'Total Studies'}
                </span>
              </div>
              <span className="text-xl font-bold text-emerald-700">{totalStudies}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                  <Activity className="h-4 w-4 text-green-600" />
                </div>
                <span className="text-sm font-medium text-gray-700 truncate">
                  {t('stability.status.active') || 'Active'}
                </span>
              </div>
              <span className="text-xl font-bold text-green-700">{dashboard?.totalActiveStudies ?? 0}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-700 truncate">
                  {t('stability.status.completed') || 'Completed'}
                </span>
              </div>
              <span className="text-xl font-bold text-blue-700">{dashboard?.totalCompletedStudies ?? 0}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                  <Pause className="h-4 w-4 text-amber-600" />
                </div>
                <span className="text-sm font-medium text-gray-700 truncate">
                  {t('stability.status.onHold') || 'On Hold'}
                </span>
              </div>
              <span className="text-xl font-bold text-amber-700">{dashboard?.totalOnHoldStudies ?? 0}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-orange-100 rounded-lg flex-shrink-0">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                </div>
                <span className="text-sm font-medium text-gray-700 truncate">
                  {t('stability.dashboard.oosDetected') || 'OOS Detected'}
                </span>
              </div>
              <span className="text-xl font-bold text-orange-700">{dashboard?.oosThisMonth ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Chart - large screens only */}
      <div className="hidden xl:block bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold text-gray-900">
              {t('stability.dashboard.samplesTested') || 'Samples Tested (Last 6 Months)'}
            </h3>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Activity className="h-4 w-4" />
            <span>{dashboard?.completedThisMonth ?? 0} {t('stability.chart.thisMonth')}</span>
          </div>
        </div>
        {activityChartData.length > 0 ? (
          <Chart key={locale} id="activity-chart" dataSource={activityChartData} size={{ height: 260 }}>
            <CommonSeriesSettings argumentField="period" type="bar" barPadding={0.3} />
            <ChartSeries valueField="count" name={t('stability.chart.testsCompletedLegend')} color="#6366f1" />
            <ArgumentAxis>
              <ChartLabel overlappingBehavior="rotate" rotationAngle={-45} />
            </ArgumentAxis>
            <ValueAxis />
            <ChartLegend visible={false} />
            <ChartTooltip
              enabled
              customizeTooltip={(arg: { argumentText?: string; valueText?: string }) => ({
                text: `${arg.argumentText}: ${arg.valueText} ${t('stability.chart.samplesTestedSuffix')}`,
              })}
            />
          </Chart>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-gray-400">
            <div className="text-center">
              <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">
                {t('stability.dashboard.noActivityData') || 'No activity data'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Studies List Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-w-0 overflow-hidden">
        {/* Filter / Tab row - scroll-snap on mobile */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
          <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-thin snap-x">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 snap-start min-h-[36px] ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold ${
                      isActive ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search + count row */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('stability.search.placeholder')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
            <FlaskConical className="h-4 w-4 text-gray-400" />
            <span>
              {filteredStudies.length} / {allStudiesCount}
            </span>
          </div>
        </div>

        {/* Content: Loading / Empty / No results / Mobile Cards / Desktop Grid */}
        {studiesLoading ? (
          isMobile ? (
            <StudyCardSkeletonList count={4} />
          ) : (
            <DataGridLoadingSkeleton />
          )
        ) : showEmptyState ? (
          <EmptyState onCreate={handleCreate} t={t} />
        ) : showNoResultsState ? (
          <NoResultsState onClear={handleClearFilters} t={t} />
        ) : isMobile ? (
          <StudyCardList
            studies={filteredStudies}
            onView={(s) => router.push(`/gmp/stability/studies/${s.id}`)}
            t={t}
          />
        ) : (
          <StabilityStudyList
            studies={filteredStudies}
            loading={studiesLoading}
            height={500}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

/**
 * Mobile Card List — replaces DataGrid on mobile viewports.
 * Shows study number, product, storage/type, start date, progress, status
 * and a 44px-min tap footer.
 */
function StudyCardList({
  studies,
  onView,
  t,
}: {
  studies: StabilityStudy[];
  onView: (s: StabilityStudy) => void;
  t: TranslateFn;
}) {
  const statusIcon: Record<StabilityStudyStatus, React.ReactNode> = {
    active: <Play className="h-3 w-3" />,
    completed: <CheckCircle className="h-3 w-3" />,
    on_hold: <Pause className="h-3 w-3" />,
    cancelled: <XCircle className="h-3 w-3" />,
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '-';
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return '-';
      return date.toISOString().slice(0, 10);
    } catch {
      return '-';
    }
  };

  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {studies.map((study) => {
        const style = studyStatusStyle[study.status];
        const current = study.currentTimepoint ?? 0;
        // Progress bar: visualize OOS vs clean by studying the current timepoint.
        // We don't have total timepoints here, so we display the current month as chip.
        return (
          <div
            key={study.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all"
          >
            <button
              type="button"
              onClick={() => onView(study)}
              className="w-full text-left p-4 flex items-start gap-3"
            >
              <div className="h-11 w-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <FlaskConical className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-gray-900 text-base truncate">
                      {study.studyNumber}
                    </p>
                    {study.productName && (
                      <p className="text-sm text-gray-700 truncate mt-0.5" title={study.productName}>
                        {study.productName}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${style.bg} ${style.text} border ${style.border}`}
                  >
                    {statusIcon[study.status]}
                    {t(`stability.studyList.statusLabels.${study.status}`)}
                  </span>
                </div>

                {/* Lot + chamber */}
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-600">
                  {study.lotNumber && (
                    <span className="inline-flex items-center gap-1">
                      <Package className="h-3.5 w-3.5 text-gray-400" />
                      <span className="font-mono">{study.lotNumber}</span>
                    </span>
                  )}
                  {study.chamberLocation && (
                    <span className="inline-flex items-center gap-1">
                      <ThermometerSun className="h-3.5 w-3.5 text-gray-400" />
                      <span className="truncate max-w-[160px]">{study.chamberLocation}</span>
                    </span>
                  )}
                </div>

                {/* Tag row */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                    <Clock className="h-3 w-3" />
                    {t('stability.mobile.start')} {formatDate(study.startDate)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                    <Timer className="h-3 w-3" />
                    {t('stability.mobile.timepoint')}: {current}{t('stability.mobile.timepointSuffix')}
                  </span>
                  {study.nextDueDate && (
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                      <Clock className="h-3 w-3" />
                      {t('stability.mobile.next')}: {formatDate(study.nextDueDate)}
                    </span>
                  )}
                  {study.oosCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded">
                      <AlertTriangle className="h-3 w-3" />
                      {t('stability.mobile.oosLabel')}: {study.oosCount}
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Card footer: single-tap view action, 44px min-height */}
            <div className="flex items-center border-t border-gray-100">
              <button
                type="button"
                onClick={() => onView(study)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-100 transition-colors min-h-[44px]"
              >
                <span>{t('stability.mobile.viewStudyDetails')}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Loading skeleton for mobile study card list */
function StudyCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 bg-gray-200 rounded" />
              <div className="h-3 w-1/3 bg-gray-200 rounded" />
              <div className="h-3 w-2/3 bg-gray-200 rounded" />
              <div className="flex gap-2 pt-1">
                <div className="h-5 w-16 bg-gray-200 rounded-full" />
                <div className="h-5 w-20 bg-gray-200 rounded-full" />
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
        <div
          key={i}
          className="flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-lg animate-pulse"
        >
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

/** Empty State — shown when there are zero studies overall */
function EmptyState({ onCreate, t }: { onCreate: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-green-100 flex items-center justify-center mb-5">
        <FlaskConical className="h-10 w-10 text-green-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {t('stability.studies.noStudies') || 'No stability studies found'}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {t('stability.studies.enrollFirst') || 'Enroll a batch to start tracking stability'}
      </p>
      <DxButton
        text={t('stability.actions.enrollBatch') || 'Enroll Batch'}
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
        {t('stability.studies.noStudies')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {t('stability.studies.tryDifferentFilter')}
      </p>
      <DxButton
        text={t('common.clearFilters')}
        icon="clear"
        stylingMode="outlined"
        onClick={onClear}
      />
    </div>
  );
}

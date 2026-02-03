'use client';

/**
 * Stability Dashboard Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * Professional dashboard for stability program management.
 * Redesigned with DevExtreme UI components.
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { StabilityStudyList } from '@/components/stability';
import { DxButton } from '@/components/ui/dx-button';
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
  Calendar,
  Clock,
  Pause,
  XCircle,
  Activity,
  TrendingUp,
  BarChart3,
  Package,
  Beaker,
  ThermometerSun,
  Zap,
  RefreshCw,
  FileText,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Shield,
} from 'lucide-react';
import type {
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

// ============================================
// Constants
// ============================================

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',
  completed: '#3b82f6',
  on_hold: '#f59e0b',
  cancelled: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  completed: 'Completed',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
};

const STUDY_TYPE_COLORS: Record<string, string> = {
  long_term: '#3b82f6',
  accelerated: '#ef4444',
  intermediate: '#f59e0b',
};

const STUDY_TYPE_LABELS: Record<string, string> = {
  long_term: 'Long Term',
  accelerated: 'Accelerated',
  intermediate: 'Intermediate',
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
// Components
// ============================================

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBg,
  iconColor,
  trend,
  onClick,
  highlight,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  trend?: { direction: 'up' | 'down'; value: string };
  onClick?: () => void;
  highlight?: 'danger' | 'warning' | 'success';
}) {
  const highlightClasses = {
    danger: 'ring-2 ring-red-200 bg-red-50/50',
    warning: 'ring-2 ring-amber-200 bg-amber-50/50',
    success: 'ring-2 ring-emerald-200 bg-emerald-50/50',
  };

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-4 transition-all hover:shadow-md ${
        onClick ? 'cursor-pointer hover:border-emerald-300' : ''
      } ${highlight ? highlightClasses[highlight] : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 font-medium truncate">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs ${
              trend.direction === 'up' ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {trend.direction === 'up' ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              <span>{trend.value}</span>
            </div>
          )}
        </div>
        <div className={`p-2.5 rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

function StudyTypeCard({
  type,
  label,
  condition,
  count,
  icon: Icon,
  bgGradient,
  iconBg,
  iconColor,
  textColor,
}: {
  type: string;
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
        <div className="flex items-center gap-3">
          <div className={`p-2.5 ${iconBg} rounded-xl`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{label}</p>
            <p className="text-xs text-gray-500">{condition}</p>
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
}: {
  alert: SampleAlert;
  isOverdue: boolean;
  onClick: () => void;
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
            {alert.timepoint}M
          </span>
        </div>
        <p className="text-xs text-gray-600 truncate mt-0.5">
          {alert.productName} | {alert.lotNumber}
        </p>
      </div>
      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
        isOverdue ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'
      }`}>
        {isOverdue ? (
          <>
            <AlertTriangle className="h-3 w-3" />
            {Math.abs(alert.daysUntilDue)}d overdue
          </>
        ) : (
          <>
            <Clock className="h-3 w-3" />
            {alert.daysUntilDue}d
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
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed' | 'on_hold'>('all');

  // Fetch dashboard data
  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['stability-dashboard'],
    queryFn: fetchDashboard,
  });

  // Fetch studies with filter
  const statusFilter = activeTab === 'all' ? undefined : activeTab;
  const { data: studiesData, isLoading: studiesLoading } = useQuery({
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

  // Prepare chart data
  const statusChartData = useMemo(() => {
    if (!dashboard?.byStatus) return [];
    return Object.entries(dashboard.byStatus)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        status,
        label: STATUS_LABELS[status] || status,
        value: count,
        color: STATUS_COLORS[status] || '#6b7280',
      }));
  }, [dashboard]);

  const studyTypeChartData = useMemo(() => {
    if (!dashboard?.byStudyType) return [];
    return Object.entries(dashboard.byStudyType)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => ({
        type,
        label: STUDY_TYPE_LABELS[type] || type,
        value: count,
        color: STUDY_TYPE_COLORS[type] || '#6b7280',
      }));
  }, [dashboard]);

  const activityChartData = useMemo(() => {
    if (!dashboard?.recentActivity) return [];
    return dashboard.recentActivity.map((item) => ({
      period: item.date,
      count: item.count,
    }));
  }, [dashboard]);

  // Calculate totals
  const totalStudies = dashboard
    ? Object.values(dashboard.byStatus).reduce((a, b) => a + b, 0)
    : 0;

  const tabs = [
    { key: 'all', label: 'All Studies', count: totalStudies },
    { key: 'active', label: 'Active', count: dashboard?.byStatus?.active || 0 },
    { key: 'completed', label: 'Completed', count: dashboard?.byStatus?.completed || 0 },
    { key: 'on_hold', label: 'On Hold', count: dashboard?.byStatus?.on_hold || 0 },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-emerald-50/30 to-gray-50">
      <div className="p-4 md:p-6 space-y-6 max-w-[1800px] mx-auto">
        {/* Page Header */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 p-6 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <FlaskConical className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{t('stability.pageTitle')}</h1>
                  <p className="text-emerald-100 text-sm">
                    {t('stability.subtitle')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DxButton
                  icon="refresh"
                  text={t('stability.actions.refresh')}
                  stylingMode="outlined"
                  type="normal"
                  onClick={() => refetchDashboard()}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/30"
                />
                <DxButton
                  icon="doc"
                  text={t('stability.protocols.title')}
                  stylingMode="outlined"
                  type="normal"
                  onClick={() => router.push('/gmp/stability/protocols')}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/30"
                />
                <DxButton
                  icon="chart"
                  text={t('stability.trends.title')}
                  stylingMode="outlined"
                  type="normal"
                  onClick={() => router.push('/gmp/stability/trends')}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/30"
                />
                <DxButton
                  icon="plus"
                  text={t('stability.actions.enrollBatch')}
                  type="success"
                  onClick={() => router.push('/gmp/stability/studies/new')}
                />
              </div>
            </div>
          </div>

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 divide-x divide-gray-200 bg-gray-50">
            <div className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{dashboard?.totalActiveStudies ?? 0}</p>
              <p className="text-xs text-gray-500 font-medium">Active Studies</p>
            </div>
            <div className="p-4 text-center">
              <p className={`text-2xl font-bold ${(dashboard?.overdueSamples ?? 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {dashboard?.overdueSamples ?? 0}
              </p>
              <p className="text-xs text-gray-500 font-medium">Overdue Samples</p>
            </div>
            <div className="p-4 text-center">
              <p className={`text-2xl font-bold ${(dashboard?.upcomingSamples ?? 0) > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                {dashboard?.upcomingSamples ?? 0}
              </p>
              <p className="text-xs text-gray-500 font-medium">Due in 30 Days</p>
            </div>
            <div className="p-4 text-center">
              <p className={`text-2xl font-bold ${(dashboard?.oosThisMonth ?? 0) > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                {dashboard?.oosThisMonth ?? 0}
              </p>
              <p className="text-xs text-gray-500 font-medium">OOS This Month</p>
            </div>
            <div className="p-4 text-center hidden lg:block">
              <p className="text-2xl font-bold text-blue-600">{dashboard?.totalCompletedStudies ?? 0}</p>
              <p className="text-xs text-gray-500 font-medium">Completed</p>
            </div>
            <div className="p-4 text-center hidden lg:block">
              <p className="text-2xl font-bold text-indigo-600">{dashboard?.completedThisMonth ?? 0}</p>
              <p className="text-xs text-gray-500 font-medium">Tests This Month</p>
            </div>
          </div>
        </div>

        {/* Alerts Section */}
        {(overdueAlerts.length > 0 || upcomingAlerts.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Overdue Alerts */}
            {overdueAlerts.length > 0 && (
              <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 bg-gradient-to-r from-red-50 to-red-100/50 border-b border-red-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-red-900">Overdue Samples</h3>
                        <p className="text-xs text-red-600">{overdueAlerts.length} samples require immediate attention</p>
                      </div>
                    </div>
                    <DxButton
                      text="View All"
                      stylingMode="text"
                      onClick={() => router.push('/gmp/stability/studies?filter=overdue')}
                    />
                  </div>
                </div>
                <div className="p-4 space-y-2 max-h-[280px] overflow-y-auto">
                  {overdueAlerts.slice(0, 5).map((alert) => (
                    <AlertCard
                      key={alert.sampleId}
                      alert={alert}
                      isOverdue
                      onClick={() => router.push(`/gmp/stability/studies/${alert.studyId}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Samples */}
            {upcomingAlerts.length > 0 && (
              <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 bg-gradient-to-r from-amber-50 to-amber-100/50 border-b border-amber-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <Clock className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-amber-900">Upcoming Samples</h3>
                        <p className="text-xs text-amber-600">{upcomingAlerts.length} samples due within 30 days</p>
                      </div>
                    </div>
                    <DxButton
                      text="View All"
                      stylingMode="text"
                      onClick={() => router.push('/gmp/stability/studies?filter=upcoming')}
                    />
                  </div>
                </div>
                <div className="p-4 space-y-2 max-h-[280px] overflow-y-auto">
                  {upcomingAlerts.slice(0, 5).map((alert) => (
                    <AlertCard
                      key={alert.sampleId}
                      alert={alert}
                      isOverdue={false}
                      onClick={() => router.push(`/gmp/stability/studies/${alert.studyId}`)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Charts */}
          <div className="xl:col-span-2 space-y-6">
            {/* Study Types & Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Study Types Card */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-semibold text-gray-900">Active Studies by Type</h3>
                </div>
                <div className="space-y-3">
                  <StudyTypeCard
                    type="long_term"
                    label="Long Term"
                    condition="25°C / 60%RH"
                    count={dashboard?.byStudyType?.long_term ?? 0}
                    icon={ThermometerSun}
                    bgGradient="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200"
                    iconBg="bg-blue-100"
                    iconColor="text-blue-600"
                    textColor="text-blue-700"
                  />
                  <StudyTypeCard
                    type="accelerated"
                    label="Accelerated"
                    condition="40°C / 75%RH"
                    count={dashboard?.byStudyType?.accelerated ?? 0}
                    icon={Zap}
                    bgGradient="bg-gradient-to-r from-red-50 to-rose-50 border-red-200"
                    iconBg="bg-red-100"
                    iconColor="text-red-600"
                    textColor="text-red-700"
                  />
                  <StudyTypeCard
                    type="intermediate"
                    label="Intermediate"
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

              {/* Status Distribution Chart */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">Studies by Status</h3>
                </div>
                {statusChartData.length > 0 ? (
                  <PieChart
                    id="status-pie"
                    dataSource={statusChartData}
                    type="doughnut"
                    innerRadius={0.65}
                    palette={statusChartData.map((d) => d.color)}
                    size={{ height: 220 }}
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
                      font={{ size: 11 }}
                    />
                    <Tooltip
                      enabled={true}
                      customizeTooltip={(arg: { argumentText?: string; valueText?: string; percentText?: string }) => ({
                        text: `${arg.argumentText}: ${arg.valueText} (${arg.percentText})`,
                      })}
                    />
                  </PieChart>
                ) : (
                  <div className="h-[220px] flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <Shield className="h-12 w-12 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No study data</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Activity Chart */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-semibold text-gray-900">Samples Tested (Last 6 Months)</h3>
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Activity className="h-4 w-4" />
                  <span>{dashboard?.completedThisMonth ?? 0} this month</span>
                </div>
              </div>
              {activityChartData.length > 0 ? (
                <Chart
                  id="activity-chart"
                  dataSource={activityChartData}
                  size={{ height: 200 }}
                >
                  <CommonSeriesSettings argumentField="period" type="bar" barPadding={0.3} />
                  <ChartSeries valueField="count" name="Tests Completed" color="#6366f1" />
                  <ArgumentAxis>
                    <ChartLabel overlappingBehavior="rotate" rotationAngle={-45} />
                  </ArgumentAxis>
                  <ValueAxis />
                  <ChartLegend visible={false} />
                  <ChartTooltip
                    enabled={true}
                    customizeTooltip={(arg: { argumentText?: string; valueText?: string }) => ({
                      text: `${arg.argumentText}: ${arg.valueText} samples tested`,
                    })}
                  />
                </Chart>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No activity data</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Summary & Products */}
          <div className="space-y-6">
            {/* Program Summary */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <FlaskConical className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold text-gray-900">Program Summary</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <FlaskConical className="h-4 w-4 text-emerald-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Total Studies</span>
                  </div>
                  <span className="text-xl font-bold text-emerald-700">{totalStudies}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Activity className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </div>
                  <span className="text-xl font-bold text-green-700">{dashboard?.totalActiveStudies ?? 0}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Completed</span>
                  </div>
                  <span className="text-xl font-bold text-blue-700">{dashboard?.totalCompletedStudies ?? 0}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Pause className="h-4 w-4 text-amber-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">On Hold</span>
                  </div>
                  <span className="text-xl font-bold text-amber-700">{dashboard?.totalOnHoldStudies ?? 0}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">OOS Detected</span>
                  </div>
                  <span className="text-xl font-bold text-orange-700">{dashboard?.oosThisMonth ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Top Products */}
            {dashboard?.byProduct && dashboard.byProduct.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-teal-600" />
                    <h3 className="font-semibold text-gray-900">Top Products</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  {dashboard.byProduct.slice(0, 5).map((product, index) => (
                    <div
                      key={product.productId}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => router.push(`/gmp/stability/studies?productId=${product.productId}`)}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                          index === 0
                            ? 'bg-emerald-500'
                            : index === 1
                            ? 'bg-teal-500'
                            : index === 2
                            ? 'bg-cyan-500'
                            : 'bg-gray-400'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{product.productName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-emerald-600">{product.activeStudies} active</span>
                          <span className="text-gray-300">|</span>
                          <span className="text-xs text-blue-600">{product.completedStudies} completed</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Studies DataGrid Section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Tab Header */}
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === tab.key
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {tab.label}
                    <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
                      activeTab === tab.key
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <FlaskConical className="w-4 h-4" />
                <span>{studiesData?.total ?? 0} studies</span>
              </div>
            </div>
          </div>

          {/* Studies List */}
          <StabilityStudyList
            studies={studiesData?.studies || []}
            loading={studiesLoading}
            height={500}
          />
        </div>
      </div>
    </div>
  );
}

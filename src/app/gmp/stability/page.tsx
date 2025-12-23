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
import { StabilityStudyList } from '@/components/stability';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxTabs } from '@/components/ui/dx-tabs';
import type { DxTabItem } from '@/components/ui/dx-tabs';
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
  active: '#22c55e',
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
// Component
// ============================================

export default function StabilityDashboardPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StabilityStudyStatus | undefined>(undefined);

  // Fetch dashboard data
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['stability-dashboard'],
    queryFn: fetchDashboard,
  });

  // Fetch studies with filter
  const { data: studiesData, isLoading: studiesLoading } = useQuery({
    queryKey: ['stability-studies', statusFilter],
    queryFn: () => fetchStudies(statusFilter),
  });

  // Fetch alerts
  const { data: alerts = [] } = useQuery({
    queryKey: ['stability-alerts'],
    queryFn: fetchAlerts,
  });

  const overdueAlerts = alerts.filter((a) => a.isOverdue);
  const upcomingAlerts = alerts.filter((a) => !a.isOverdue);

  // Status tabs
  const statusTabs: DxTabItem[] = [
    { id: 0, text: 'All Studies', icon: 'selectall' },
    { id: 1, text: 'Active', icon: 'runner' },
    { id: 2, text: 'Completed', icon: 'check' },
    { id: 3, text: 'On Hold', icon: 'clock' },
  ];

  const handleTabChange = (index: number) => {
    const statusMap: (StabilityStudyStatus | undefined)[] = [
      undefined,
      'active',
      'completed',
      'on_hold',
    ];
    setStatusFilter(statusMap[index]);
  };

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

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1800px] mx-auto">
      {/* Page Header */}
      <ResponsivePageHeader
        title="Stability Program"
        subtitle="GMP หมวด 7.4 - Stability Testing Management"
        icon={FlaskConical}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        breadcrumbs={[
          { label: 'GMP', href: '/gmp' },
          { label: 'Stability' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <DxButton
              icon="doc"
              text="Protocols"
              type="default"
              stylingMode="outlined"
              onClick={() => router.push('/gmp/stability/protocols')}
            />
            <DxButton
              icon="chart"
              text="Trends"
              type="default"
              stylingMode="outlined"
              onClick={() => router.push('/gmp/stability/trends')}
            />
            <DxButton
              icon="plus"
              text="Enroll Batch"
              type="success"
              onClick={() => router.push('/gmp/stability/studies/new')}
            />
          </div>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <StatCard
          label="Active Studies"
          value={dashboard?.totalActiveStudies ?? 0}
          icon={FlaskConical}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Overdue Samples"
          value={dashboard?.overdueSamples ?? 0}
          icon={AlertTriangle}
          iconColor="text-red-500"
          accentColor="border-red-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Due in 30 Days"
          value={dashboard?.upcomingSamples ?? 0}
          icon={Calendar}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="OOS This Month"
          value={dashboard?.oosThisMonth ?? 0}
          icon={XCircle}
          iconColor="text-orange-500"
          accentColor="border-orange-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Completed Studies"
          value={dashboard?.totalCompletedStudies ?? 0}
          icon={CheckCircle}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Tests This Month"
          value={dashboard?.completedThisMonth ?? 0}
          icon={Activity}
          iconColor="text-indigo-500"
          accentColor="border-indigo-500"
          isLoading={dashboardLoading}
          trend={dashboard?.completedThisMonth ? { direction: 'up', value: 'completed' } : undefined}
        />
      </div>

      {/* Alerts Section */}
      {(overdueAlerts.length > 0 || upcomingAlerts.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Overdue Alerts */}
          {overdueAlerts.length > 0 && (
            <div className="bg-white rounded-xl border border-red-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Overdue Samples
                  <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                    {overdueAlerts.length}
                  </span>
                </h3>
                <DxButton
                  text="View All"
                  stylingMode="text"
                  onClick={() => router.push('/gmp/stability/studies?filter=overdue')}
                />
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {overdueAlerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.sampleId}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100 cursor-pointer hover:bg-red-100 transition-colors"
                    onClick={() => router.push(`/gmp/stability/studies/${alert.studyId}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {alert.studyNumber}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {alert.productName} - {alert.timepoint}M
                      </p>
                    </div>
                    <span className="ml-3 px-2 py-1 bg-red-200 text-red-800 text-xs font-medium rounded">
                      {Math.abs(alert.daysUntilDue)}d overdue
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Samples */}
          {upcomingAlerts.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  Upcoming Samples
                  <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                    {upcomingAlerts.length}
                  </span>
                </h3>
                <DxButton
                  text="View All"
                  stylingMode="text"
                  onClick={() => router.push('/gmp/stability/studies?filter=upcoming')}
                />
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {upcomingAlerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.sampleId}
                    className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100 cursor-pointer hover:bg-amber-100 transition-colors"
                    onClick={() => router.push(`/gmp/stability/studies/${alert.studyId}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {alert.studyNumber}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {alert.productName} - {alert.timepoint}M
                      </p>
                    </div>
                    <span className="ml-3 px-2 py-1 bg-amber-200 text-amber-800 text-xs font-medium rounded">
                      {alert.daysUntilDue}d
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Status Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              By Status
            </h3>
          </div>
          {statusChartData.length > 0 ? (
            <PieChart
              id="status-pie"
              dataSource={statusChartData}
              type="doughnut"
              innerRadius={0.65}
              palette={statusChartData.map((d) => d.color)}
              size={{ height: 200 }}
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
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Activity className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No studies</p>
              </div>
            </div>
          )}
        </div>

        {/* Study Type Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Beaker className="w-4 h-4 text-purple-500" />
              By Study Type
            </h3>
          </div>
          {studyTypeChartData.length > 0 ? (
            <PieChart
              id="type-pie"
              dataSource={studyTypeChartData}
              type="doughnut"
              innerRadius={0.65}
              palette={studyTypeChartData.map((d) => d.color)}
              size={{ height: 200 }}
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
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Beaker className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No data</p>
              </div>
            </div>
          )}
        </div>

        {/* Study Types Summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Active by Type
            </h3>
          </div>
          <div className="space-y-3">
            {/* Long Term */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ThermometerSun className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Long Term</p>
                  <p className="text-sm font-medium text-gray-900">25°C/60%RH</p>
                </div>
              </div>
              <span className="text-xl font-bold text-blue-600">
                {dashboard?.byStudyType?.long_term ?? 0}
              </span>
            </div>

            {/* Accelerated */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-red-50 to-rose-50 rounded-lg border border-red-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Zap className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Accelerated</p>
                  <p className="text-sm font-medium text-gray-900">40°C/75%RH</p>
                </div>
              </div>
              <span className="text-xl font-bold text-red-600">
                {dashboard?.byStudyType?.accelerated ?? 0}
              </span>
            </div>

            {/* Intermediate */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Beaker className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Intermediate</p>
                  <p className="text-sm font-medium text-gray-900">30°C/65%RH</p>
                </div>
              </div>
              <span className="text-xl font-bold text-amber-600">
                {dashboard?.byStudyType?.intermediate ?? 0}
              </span>
            </div>

            {/* On Hold Summary */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Pause className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">On Hold</p>
                  <p className="text-sm font-medium text-gray-900">Paused</p>
                </div>
              </div>
              <span className="text-xl font-bold text-gray-600">
                {dashboard?.totalOnHoldStudies ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-emerald-500" />
              Quick Summary
            </h3>
          </div>
          <div className="space-y-3">
            {/* Total Studies */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <FlaskConical className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Studies</p>
                  <p className="text-sm font-medium text-gray-900">All Records</p>
                </div>
              </div>
              <span className="text-xl font-bold text-emerald-600">{totalStudies}</span>
            </div>

            {/* Active */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Activity className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Active</p>
                  <p className="text-sm font-medium text-gray-900">In Progress</p>
                </div>
              </div>
              <span className="text-xl font-bold text-green-600">
                {dashboard?.totalActiveStudies ?? 0}
              </span>
            </div>

            {/* Completed */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Completed</p>
                  <p className="text-sm font-medium text-gray-900">Finished</p>
                </div>
              </div>
              <span className="text-xl font-bold text-blue-600">
                {dashboard?.totalCompletedStudies ?? 0}
              </span>
            </div>

            {/* OOS */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">OOS Detected</p>
                  <p className="text-sm font-medium text-gray-900">This Month</p>
                </div>
              </div>
              <span className="text-xl font-bold text-orange-600">
                {dashboard?.oosThisMonth ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Timeline Chart */}
      {activityChartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              Samples Tested (Last 6 Months)
            </h3>
          </div>
          <Chart
            id="activity-chart"
            dataSource={activityChartData}
            size={{ height: 180 }}
          >
            <CommonSeriesSettings argumentField="period" type="bar" color="#6366f1" />
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
        </div>
      )}

      {/* Main Content - Tabs + DataGrid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tabs Header */}
        <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <DxTabs
              items={statusTabs}
              selectedIndex={
                statusFilter === undefined
                  ? 0
                  : statusFilter === 'active'
                  ? 1
                  : statusFilter === 'completed'
                  ? 2
                  : 3
              }
              onSelectedIndexChange={handleTabChange}
              stylingMode="secondary"
            />
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <FlaskConical className="w-4 h-4" />
                {studiesData?.total ?? 0} studies
              </span>
            </div>
          </div>
        </div>

        {/* Studies List */}
        <div className="p-4">
          <StabilityStudyList
            studies={studiesData?.studies || []}
            loading={studiesLoading}
          />
        </div>
      </div>

      {/* Products with Most Studies */}
      {dashboard?.byProduct && dashboard.byProduct.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-teal-500" />
              Products with Most Stability Studies
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {dashboard.byProduct.slice(0, 5).map((product, index) => (
              <div
                key={product.productId}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => router.push(`/gmp/stability/studies?productId=${product.productId}`)}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
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
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {product.productName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {product.activeStudies} active, {product.completedStudies} completed
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

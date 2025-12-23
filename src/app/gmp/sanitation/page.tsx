'use client';

/**
 * Sanitation Dashboard Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * Professional dashboard for sanitation program management.
 * Redesigned with DevExtreme UI components.
 */

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxDataGrid, type DxDataGridColumn } from '@/components/ui/dx-data-grid';
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
  Sparkles,
  Calendar,
  AlertTriangle,
  Bug,
  CheckCircle,
  TrendingUp,
  ClipboardList,
  Clock,
  Shield,
  MapPin,
  BarChart3,
  XCircle,
  ArrowRight,
  FileCheck,
  Beaker,
} from 'lucide-react';
import type { PendingTask, SanitationTrends, AreaType } from '@/types/sanitation';

// ============================================
// Constants
// ============================================

const AREA_COLORS: Record<AreaType, string> = {
  production: '#3b82f6',
  warehouse: '#22c55e',
  lab: '#8b5cf6',
  office: '#6b7280',
};

const AREA_LABELS: Record<AreaType, string> = {
  production: 'Production',
  warehouse: 'Warehouse',
  lab: 'Laboratory',
  office: 'Office',
};

const AREA_ICONS: Record<AreaType, typeof Beaker> = {
  production: Beaker,
  warehouse: MapPin,
  lab: Beaker,
  office: ClipboardList,
};

// ============================================
// API Functions
// ============================================

async function fetchPendingTasks(): Promise<PendingTask[]> {
  const response = await fetch('/api/sanitation/pending?daysAhead=14');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function fetchTrends(): Promise<SanitationTrends> {
  const response = await fetch('/api/sanitation/trends?period=month');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

// ============================================
// Component
// ============================================

export default function SanitationDashboardPage() {
  const router = useRouter();

  const { data: pendingTasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['sanitation-pending'],
    queryFn: fetchPendingTasks,
  });

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['sanitation-trends-month'],
    queryFn: fetchTrends,
  });

  // Calculate stats
  const overdueCount = pendingTasks?.filter((t) => t.isOverdue).length || 0;
  const upcomingCount = pendingTasks?.filter((t) => !t.isOverdue).length || 0;
  const totalPestFindings = trends?.pestActivityTrend?.reduce((sum, t) => sum + t.findingsCount, 0) || 0;
  const totalCompleted = trends?.byArea?.reduce((sum, a) => sum + a.completedCount, 0) || 0;
  const totalMissed = trends?.byArea?.reduce((sum, a) => sum + a.missedCount, 0) || 0;

  // Prepare chart data
  const areaComplianceData = useMemo(() => {
    if (!trends?.byArea) return [];
    return trends.byArea.map((area) => ({
      area: area.areaType,
      label: AREA_LABELS[area.areaType],
      value: area.complianceRate,
      completed: area.completedCount,
      missed: area.missedCount,
      color: AREA_COLORS[area.areaType],
    }));
  }, [trends]);

  const pestTrendData = useMemo(() => {
    if (!trends?.pestActivityTrend) return [];
    return trends.pestActivityTrend.map((t) => ({
      period: t.period,
      findings: t.findingsCount,
    }));
  }, [trends]);

  const complianceTrendData = useMemo(() => {
    if (!trends?.dataPoints) return [];
    return trends.dataPoints.map((dp) => ({
      date: dp.date,
      completed: dp.completed,
      missed: dp.missed,
      rate: dp.complianceRate,
    }));
  }, [trends]);

  // Pending tasks grid columns
  const taskColumns: DxDataGridColumn[] = [
    {
      dataField: 'scheduleName',
      caption: 'Task',
      minWidth: 200,
    },
    {
      dataField: 'areaType',
      caption: 'Area',
      width: 120,
      cellRender: (cellData: { value: AreaType }) => {
        const IconComp = AREA_ICONS[cellData.value] || MapPin;
        return (
          <div className="flex items-center gap-2">
            <IconComp
              className="w-4 h-4"
              style={{ color: AREA_COLORS[cellData.value] }}
            />
            <span>{AREA_LABELS[cellData.value]}</span>
          </div>
        );
      },
    },
    {
      dataField: 'frequency',
      caption: 'Frequency',
      width: 100,
      cellRender: (cellData: { value: string }) => (
        <span className="capitalize">{cellData.value}</span>
      ),
    },
    {
      dataField: 'dueDate',
      caption: 'Due Date',
      width: 120,
      dataType: 'date',
    },
    {
      dataField: 'isOverdue',
      caption: 'Status',
      width: 120,
      cellRender: (cellData: { data: PendingTask }) => {
        if (cellData.data.isOverdue) {
          return (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              {cellData.data.daysOverdue}d overdue
            </span>
          );
        }
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Upcoming
          </span>
        );
      },
    },
    {
      dataField: 'scheduleId',
      caption: '',
      width: 100,
      cellRender: (cellData: { data: PendingTask }) => (
        <DxButton
          text="Record"
          stylingMode="text"
          type="default"
          onClick={() =>
            router.push(`/gmp/sanitation/logs?scheduleId=${cellData.data.scheduleId}&new=1`)
          }
        />
      ),
    },
  ];

  const isLoading = tasksLoading || trendsLoading;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1800px] mx-auto">
      {/* Page Header */}
      <ResponsivePageHeader
        title="Sanitation Management"
        subtitle="Thai FDA GMP หมวด 4 - Sanitation & Pest Control"
        icon={Sparkles}
        iconBgColor="bg-cyan-100"
        iconColor="text-cyan-600"
        breadcrumbs={[
          { label: 'GMP', href: '/gmp' },
          { label: 'Sanitation' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <DxButton
              icon="refresh"
              type="default"
              stylingMode="outlined"
              hint="Refresh"
              onClick={() => window.location.reload()}
            />
            <DxButton
              icon="event"
              text="Schedules"
              stylingMode="outlined"
              onClick={() => router.push('/gmp/sanitation/schedules')}
            />
            <DxButton
              icon="plus"
              text="Record Log"
              type="success"
              onClick={() => router.push('/gmp/sanitation/logs?new=1')}
            />
          </div>
        }
      />

      {/* Overdue Alert */}
      {overdueCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-800 dark:text-red-200">
                {overdueCount} Overdue Sanitation Task{overdueCount > 1 ? 's' : ''}
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                Please complete overdue tasks immediately to maintain GMP compliance.
              </p>
            </div>
            <DxButton
              text="View Tasks"
              icon="arrowright"
              stylingMode="outlined"
              onClick={() => router.push('/gmp/sanitation/logs')}
            />
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <StatCard
          label="Compliance Rate"
          value={`${trends?.overallComplianceRate?.toFixed(0) ?? 0}%`}
          icon={Shield}
          iconColor="text-green-500"
          accentColor="border-green-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Completed"
          value={totalCompleted}
          icon={CheckCircle}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Missed"
          value={totalMissed}
          icon={XCircle}
          iconColor="text-red-500"
          accentColor="border-red-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Overdue"
          value={overdueCount}
          icon={AlertTriangle}
          iconColor="text-orange-500"
          accentColor="border-orange-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Upcoming"
          value={upcomingCount}
          icon={Calendar}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Pest Findings"
          value={totalPestFindings}
          icon={Bug}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={isLoading}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        {/* Compliance by Area */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-500" />
              Compliance by Area
            </h3>
          </div>
          {areaComplianceData.length > 0 ? (
            <PieChart
              id="area-compliance-pie"
              dataSource={areaComplianceData}
              type="doughnut"
              innerRadius={0.65}
              palette={areaComplianceData.map((d) => d.color)}
              size={{ height: 220 }}
            >
              <Series argumentField="label" valueField="completed">
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
                customizeTooltip={(arg: { argumentText?: string; point?: { data?: { completed?: number; missed?: number; value?: number } } }) => ({
                  text: `${arg.argumentText}\nCompleted: ${arg.point?.data?.completed ?? 0}\nMissed: ${arg.point?.data?.missed ?? 0}\nRate: ${arg.point?.data?.value?.toFixed(0) ?? 0}%`,
                })}
              />
            </PieChart>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MapPin className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No data</p>
              </div>
            </div>
          )}
        </div>

        {/* Pest Activity Trend */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Bug className="w-4 h-4 text-amber-500" />
              Pest Activity
            </h3>
          </div>
          {pestTrendData.length > 0 ? (
            <Chart
              id="pest-trend-chart"
              dataSource={pestTrendData}
              size={{ height: 220 }}
            >
              <CommonSeriesSettings argumentField="period" type="bar" color="#f59e0b" />
              <ChartSeries valueField="findings" name="Findings" color="#f59e0b" />
              <ArgumentAxis>
                <ChartLabel overlappingBehavior="rotate" rotationAngle={-45} />
              </ArgumentAxis>
              <ValueAxis />
              <ChartLegend visible={false} />
              <ChartTooltip
                enabled={true}
                customizeTooltip={(arg: { argumentText?: string; valueText?: string }) => ({
                  text: `${arg.argumentText}: ${arg.valueText} findings`,
                })}
              />
            </Chart>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Bug className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No pest data</p>
              </div>
            </div>
          )}
        </div>

        {/* Quick Summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Quick Summary
            </h3>
          </div>
          <div className="space-y-3">
            {/* Compliance Rate */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Shield className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Overall Compliance</p>
                  <p className="text-sm font-medium text-gray-900">This Period</p>
                </div>
              </div>
              <span className="text-xl font-bold text-green-600">
                {trends?.overallComplianceRate?.toFixed(0) ?? 0}%
              </span>
            </div>

            {/* Area Breakdown */}
            {areaComplianceData.map((area) => (
              <div
                key={area.area}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: area.color }}
                  />
                  <span className="text-sm text-gray-700">{area.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    {area.completed}/{area.completed + area.missed}
                  </span>
                  <span
                    className="text-sm font-bold"
                    style={{ color: area.color }}
                  >
                    {area.value.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compliance Trend Chart */}
      {complianceTrendData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              Compliance Trend
            </h3>
            <span className="text-sm text-gray-500">{trends?.period}</span>
          </div>
          <Chart
            id="compliance-trend-chart"
            dataSource={complianceTrendData}
            size={{ height: 180 }}
          >
            <CommonSeriesSettings argumentField="date" type="bar" />
            <ChartSeries valueField="completed" name="Completed" color="#22c55e" />
            <ChartSeries valueField="missed" name="Missed" color="#ef4444" />
            <ArgumentAxis>
              <ChartLabel overlappingBehavior="rotate" rotationAngle={-45} />
            </ArgumentAxis>
            <ValueAxis />
            <ChartLegend
              visible={true}
              orientation="horizontal"
              horizontalAlignment="center"
              verticalAlignment="bottom"
            />
            <ChartTooltip
              enabled={true}
              customizeTooltip={(arg: { argumentText?: string; seriesName?: string; valueText?: string }) => ({
                text: `${arg.argumentText}\n${arg.seriesName}: ${arg.valueText}`,
              })}
            />
          </Chart>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={() => router.push('/gmp/sanitation/schedules')}
          className="bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
              <Sparkles className="h-5 w-5 text-blue-600" />
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 ml-auto group-hover:text-blue-500 transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900">Sanitation Schedules</h3>
          <p className="text-sm text-gray-500 mt-1">
            Manage cleaning schedules and frequencies
          </p>
        </button>

        <button
          onClick={() => router.push('/gmp/sanitation/logs')}
          className="bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-cyan-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-cyan-100 rounded-lg group-hover:bg-cyan-200 transition-colors">
              <FileCheck className="h-5 w-5 text-cyan-600" />
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 ml-auto group-hover:text-cyan-500 transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900">Sanitation Logs</h3>
          <p className="text-sm text-gray-500 mt-1">
            View and record sanitation activities
          </p>
        </button>

        <button
          onClick={() => router.push('/gmp/sanitation/pest-control')}
          className="bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-amber-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-amber-100 rounded-lg group-hover:bg-amber-200 transition-colors">
              <Bug className="h-5 w-5 text-amber-600" />
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 ml-auto group-hover:text-amber-500 transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900">Pest Control</h3>
          <p className="text-sm text-gray-500 mt-1">
            Record and track pest control services
          </p>
        </button>

        <button
          onClick={() => router.push('/gmp/sanitation/trends')}
          className="bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-green-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 ml-auto group-hover:text-green-500 transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900">Trends & Analytics</h3>
          <p className="text-sm text-gray-500 mt-1">
            View compliance trends and statistics
          </p>
        </button>
      </div>

      {/* Pending Tasks DataGrid */}
      {pendingTasks && pendingTasks.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 px-5 py-4 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              <h3 className="text-base font-semibold text-gray-900">
                Pending Tasks
              </h3>
              <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                {pendingTasks.length}
              </span>
            </div>
            <DxButton
              text="View All Logs"
              icon="arrowright"
              stylingMode="text"
              onClick={() => router.push('/gmp/sanitation/logs')}
            />
          </div>
          <DxDataGrid
            dataSource={pendingTasks.slice(0, 10)}
            columns={taskColumns}
            showBorders={false}
            rowAlternationEnabled
            height="auto"
            noDataText="No pending tasks"
          />
        </div>
      )}

      {/* No Pending Tasks */}
      {pendingTasks && pendingTasks.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <div className="p-3 bg-green-100 rounded-full w-14 h-14 mx-auto mb-4 flex items-center justify-center">
            <CheckCircle className="h-7 w-7 text-green-600" />
          </div>
          <h3 className="font-semibold text-green-800 mb-1">All Caught Up!</h3>
          <p className="text-sm text-green-700">
            No pending sanitation tasks for the next 14 days.
          </p>
        </div>
      )}
    </div>
  );
}

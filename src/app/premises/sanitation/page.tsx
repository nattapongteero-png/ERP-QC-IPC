'use client';

/**
 * Sanitation Dashboard Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * Professional, responsive dashboard for sanitation program management.
 * - Mobile card view for pending tasks (replaces DataGrid < md)
 * - Loading skeletons, empty states, no-results state
 * - Scroll-snap tabs, responsive grid, touch-friendly 44px footer
 */

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxDataGrid, type DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { useMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils/cn';
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
  production: 'พื้นที่ผลิต',
  warehouse: 'คลังจัดเก็บ',
  lab: 'ห้องปฏิบัติการ',
  office: 'สำนักงาน',
};

const AREA_ICONS: Record<AreaType, typeof Beaker> = {
  production: Beaker,
  warehouse: MapPin,
  lab: Beaker,
  office: ClipboardList,
};

const AREA_BG: Record<AreaType, string> = {
  production: 'bg-blue-100',
  warehouse: 'bg-green-100',
  lab: 'bg-purple-100',
  office: 'bg-gray-100',
};

const AREA_TEXT: Record<AreaType, string> = {
  production: 'text-blue-600',
  warehouse: 'text-green-600',
  lab: 'text-purple-600',
  office: 'text-gray-600',
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
  const t = useTranslations('gmp');
  const { isMobile } = useMobile();

  const { data: pendingTasks, isLoading: tasksLoading, refetch: refetchTasks } = useQuery({
    queryKey: ['sanitation-pending'],
    queryFn: fetchPendingTasks,
  });

  const { data: trends, isLoading: trendsLoading, refetch: refetchTrends } = useQuery({
    queryKey: ['sanitation-trends-month'],
    queryFn: fetchTrends,
  });

  // Calculate stats
  const overdueCount = pendingTasks?.filter((task) => task.isOverdue).length || 0;
  const upcomingCount = pendingTasks?.filter((task) => !task.isOverdue).length || 0;
  const totalPestFindings = trends?.pestActivityTrend?.reduce((sum, tr) => sum + tr.findingsCount, 0) || 0;
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
    return trends.pestActivityTrend.map((p) => ({
      period: p.period,
      findings: p.findingsCount,
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

  const handleRefresh = () => {
    refetchTasks();
    refetchTrends();
  };

  // Pending tasks with row numbers (top 10 used by both mobile and grid views)
  const pendingTasksWithRowNum = useMemo(
    () => (pendingTasks?.slice(0, 10) ?? []).map((item, index) => ({ ...item, _rowNumber: index + 1 })),
    [pendingTasks]
  );

  // Pending tasks grid columns (desktop)
  const taskColumns: DxDataGridColumn[] = [
    {
      dataField: '_rowNumber',
      caption: t('items.grid.columns.rowNum'),
      width: 60,
      alignment: 'center',
      allowFiltering: false,
      allowSorting: false,
      cellRender: (cell) => (
        <span className="text-gray-500 text-sm font-medium">
          {(cell.data as { _rowNumber?: number })._rowNumber}
        </span>
      ),
    },
    {
      dataField: 'scheduleName',
      caption: 'งาน',
      minWidth: 200,
    },
    {
      dataField: 'areaType',
      caption: 'พื้นที่',
      width: 140,
      cellRender: (cellData: { value?: AreaType }) => {
        const areaType = cellData.value || 'production';
        const IconComp = AREA_ICONS[areaType] || MapPin;
        return (
          <div className="flex items-center gap-2">
            <IconComp
              className="w-4 h-4"
              style={{ color: AREA_COLORS[areaType] }}
            />
            <span>{AREA_LABELS[areaType]}</span>
          </div>
        );
      },
    },
    {
      dataField: 'frequency',
      caption: 'ความถี่',
      width: 110,
      cellRender: (cellData: { value?: string }) => (
        <span className="capitalize">{cellData.value || '-'}</span>
      ),
    },
    {
      dataField: 'dueDate',
      caption: 'กำหนดส่ง',
      width: 130,
      dataType: 'date',
    },
    {
      dataField: 'isOverdue',
      caption: 'สถานะ',
      width: 130,
      cellRender: (cellData: { data?: PendingTask }) => {
        if (!cellData.data) return null;
        if (cellData.data.isOverdue) {
          return (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              เกินกำหนด {cellData.data.daysOverdue} วัน
            </span>
          );
        }
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {t('sanitation.status.upcoming')}
          </span>
        );
      },
    },
    {
      dataField: 'scheduleId',
      caption: '',
      width: 110,
      cellRender: (cellData: { data?: PendingTask }) => {
        if (!cellData.data) return null;
        return (
          <DxButton
            text={t('sanitation.actions.record')}
            stylingMode="text"
            type="default"
            onClick={() =>
              router.push(`/gmp/sanitation/logs?scheduleId=${cellData.data!.scheduleId}&new=1`)
            }
          />
        );
      },
    },
  ];

  const isLoading = tasksLoading || trendsLoading;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
      {/* Page Header */}
      <ResponsivePageHeader
        title={t('sanitation.pageTitle')}
        subtitle={t('sanitation.description')}
        icon={Sparkles}
        iconBgColor="bg-lime-100"
        iconColor="text-lime-600"
        breadcrumbs={[
          { label: 'อาคารและสถานที่', href: '/premises' },
          { label: t('sanitation.pageTitle') },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              type="default"
              stylingMode="outlined"
              hint={t('sanitation.actions.refresh')}
              onClick={handleRefresh}
              className="hidden sm:inline-flex"
            />
            <DxButton
              icon="event"
              text={t('sanitation.actions.schedules')}
              stylingMode="outlined"
              onClick={() => router.push('/premises/sanitation/schedules')}
              className="hidden md:inline-flex"
            />
            <DxButton
              icon="plus"
              text={t('sanitation.actions.recordLog')}
              type="success"
              onClick={() => router.push('/premises/sanitation/logs?new=1')}
            />
          </div>
        }
      />

      {/* Overdue Alert */}
      {overdueCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-red-800 dark:text-red-200">
                  {t('sanitation.alerts.overdueTasks', {
                    count: overdueCount,
                    plural: overdueCount > 1 ? 's' : '',
                  })}
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {t('sanitation.alerts.overdueAction')}
                </p>
              </div>
            </div>
            <DxButton
              text={t('sanitation.actions.viewTasks')}
              icon="arrowright"
              stylingMode="outlined"
              onClick={() => router.push('/premises/sanitation/logs')}
            />
          </div>
        </div>
      )}

      {/* 4 Primary KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('sanitation.stats.complianceRate')}
          value={`${trends?.overallComplianceRate?.toFixed(0) ?? 0}%`}
          icon={Shield}
          iconColor="text-green-500"
          accentColor="border-green-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('sanitation.stats.completed')}
          value={totalCompleted}
          icon={CheckCircle}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('sanitation.stats.pending')}
          value={upcomingCount}
          icon={Calendar}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('sanitation.stats.overdue')}
          value={overdueCount}
          icon={AlertTriangle}
          iconColor="text-orange-500"
          accentColor="border-orange-500"
          isLoading={isLoading}
        />
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-4">
        <StatCard
          label={t('sanitation.stats.missed')}
          value={totalMissed}
          icon={XCircle}
          iconColor="text-red-500"
          accentColor="border-red-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('sanitation.stats.pestFindings')}
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-500" />
              {t('sanitation.charts.complianceByArea')}
            </h3>
          </div>
          {trendsLoading ? (
            <ChartSkeleton height={220} />
          ) : areaComplianceData.length > 0 ? (
            <PieChart
              id="area-compliance-pie"
              dataSource={areaComplianceData}
              type="doughnut"
              innerRadius={0.65}
              palette={areaComplianceData.map((d) => d.color)}
              size={{ height: 280 }}
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
                itemTextPosition="right"
                font={{ size: 11 }}
                customizeText={(info: { pointName?: string; pointIndex?: number }) => {
                  const d = areaComplianceData[info.pointIndex ?? -1];
                  return d ? `${info.pointName} (${d.completed})` : (info.pointName ?? '');
                }}
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
                <p className="text-sm">{t('sanitation.charts.noData')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Pest Activity Trend */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Bug className="w-4 h-4 text-amber-500" />
              {t('sanitation.charts.pestActivity')}
            </h3>
          </div>
          {trendsLoading ? (
            <ChartSkeleton height={220} />
          ) : pestTrendData.length > 0 ? (
            <Chart
              id="pest-trend-chart"
              dataSource={pestTrendData}
              size={{ height: 280 }}
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
                <p className="text-sm">{t('sanitation.charts.pestActivityNoData')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Quick Summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              {t('sanitation.charts.quickSummary')}
            </h3>
          </div>
          {trendsLoading ? (
            <SummarySkeleton />
          ) : (
            <div className="space-y-3">
              {/* Compliance Rate */}
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                    <Shield className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 truncate">{t('sanitation.charts.overallCompliance')}</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{t('sanitation.charts.thisPeriod')}</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-green-600 flex-shrink-0">
                  {trends?.overallComplianceRate?.toFixed(0) ?? 0}%
                </span>
              </div>

              {/* Area Breakdown */}
              {areaComplianceData.map((area) => (
                <div
                  key={area.area}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: area.color }}
                    />
                    <span className="text-sm text-gray-700 truncate">{area.label}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
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
              {areaComplianceData.length === 0 && (
                <div className="py-8 text-center text-sm text-gray-400">
                  {t('sanitation.charts.noAreaData')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Compliance Trend Chart */}
      {(trendsLoading || complianceTrendData.some((d) => (d.completed ?? 0) + (d.missed ?? 0) > 0)) && (
        <div className="bg-white rounded-xl border border-emerald-100 shadow-[0_6px_20px_rgba(6,78,59,0.06)] p-4 md:p-5">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-500" />
              {t('sanitation.charts.complianceTrend')}
            </h3>
            <span className="text-xs sm:text-sm text-gray-500">{trends?.period}</span>
          </div>
          {trendsLoading ? (
            <ChartSkeleton height={180} />
          ) : (
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
                orientation="vertical"
                horizontalAlignment="right"
                verticalAlignment="top"
              />
              <ChartTooltip
                enabled={true}
                customizeTooltip={(arg: { argumentText?: string; seriesName?: string; valueText?: string }) => ({
                  text: `${arg.argumentText}\n${arg.seriesName}: ${arg.valueText}`,
                })}
              />
            </Chart>
          )}
        </div>
      )}

      {/* Quick Actions - scroll-snap on mobile, grid on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <QuickActionCard
          onClick={() => router.push('/premises/sanitation/schedules')}
          icon={Sparkles}
          iconBgColor="bg-blue-100 group-hover:bg-blue-200"
          iconColor="text-blue-600"
          hoverBorder="hover:border-blue-300"
          hoverArrow="group-hover:text-blue-500"
          title={t('sanitation.quickActions.schedulesTitle')}
          description={t('sanitation.quickActions.schedulesDescription')}
        />
        <QuickActionCard
          onClick={() => router.push('/premises/sanitation/logs')}
          icon={FileCheck}
          iconBgColor="bg-cyan-100 group-hover:bg-cyan-200"
          iconColor="text-cyan-600"
          hoverBorder="hover:border-cyan-300"
          hoverArrow="group-hover:text-cyan-500"
          title={t('sanitation.quickActions.logsTitle')}
          description={t('sanitation.quickActions.logsDescription')}
        />
        <QuickActionCard
          onClick={() => router.push('/premises/sanitation/pest-control')}
          icon={Bug}
          iconBgColor="bg-amber-100 group-hover:bg-amber-200"
          iconColor="text-amber-600"
          hoverBorder="hover:border-amber-300"
          hoverArrow="group-hover:text-amber-500"
          title={t('sanitation.quickActions.pestTitle')}
          description={t('sanitation.quickActions.pestDescription')}
        />
        <QuickActionCard
          onClick={() => router.push('/premises/sanitation/trends')}
          icon={TrendingUp}
          iconBgColor="bg-green-100 group-hover:bg-green-200"
          iconColor="text-green-600"
          hoverBorder="hover:border-green-300"
          hoverArrow="group-hover:text-green-500"
          title={t('sanitation.quickActions.trendsTitle')}
          description={t('sanitation.quickActions.trendsDescription')}
        />
      </div>

      {/* Pending Tasks Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-4 py-3 sm:px-5 sm:py-4 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-500" />
            <h3 className="text-base font-semibold text-gray-900">
              {t('sanitation.pendingTasks')}
            </h3>
            {pendingTasks && pendingTasks.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                {pendingTasks.length}
              </span>
            )}
          </div>
          <DxButton
            text={t('sanitation.actions.viewAllLogs')}
            icon="arrowright"
            stylingMode="text"
            onClick={() => router.push('/premises/sanitation/logs')}
          />
        </div>

        {/* Content: Loading / Empty / Mobile Cards / Desktop Grid */}
        {tasksLoading ? (
          isMobile ? <TaskCardSkeletonList count={3} /> : <TaskGridSkeleton />
        ) : !pendingTasks || pendingTasks.length === 0 ? (
          <AllCaughtUpState />
        ) : isMobile ? (
          <TaskCardList
            tasks={pendingTasks.slice(0, 10)}
            onRecord={(scheduleId) =>
              router.push(`/gmp/sanitation/logs?scheduleId=${scheduleId}&new=1`)
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <DxDataGrid
              dataSource={pendingTasksWithRowNum}
              keyExpr="_rowNumber"
              columns={taskColumns}
              showBorders={false}
              rowAlternationEnabled
              height="auto"
              noDataText="ไม่มีงานค้าง"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

/** Quick Action Card — reused for navigation tiles */
function QuickActionCard({
  onClick,
  icon: Icon,
  iconBgColor,
  iconColor,
  hoverBorder,
  hoverArrow,
  title,
  description,
}: {
  onClick: () => void;
  icon: typeof Sparkles;
  iconBgColor: string;
  iconColor: string;
  hoverBorder: string;
  hoverArrow: string;
  title: string;
  description: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'bg-white border border-gray-200 rounded-xl p-4 md:p-5 text-left hover:shadow-md active:bg-gray-50 transition-all group min-h-[44px]',
        hoverBorder
      )}
    >
      <div className="flex items-center gap-3 mb-2 md:mb-3">
        <div className={cn('p-2.5 rounded-lg transition-colors', iconBgColor)}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
        <ArrowRight className={cn('h-4 w-4 text-gray-300 ml-auto transition-colors', hoverArrow)} />
      </div>
      <h3 className="font-semibold text-gray-900 text-sm md:text-base truncate">{title}</h3>
      <p className="text-xs md:text-sm text-gray-500 mt-1 line-clamp-2">{description}</p>
    </button>
  );
}

/** Mobile card list for pending tasks — replaces DataGrid on < md viewports */
function TaskCardList({
  tasks,
  onRecord,
}: {
  tasks: PendingTask[];
  onRecord: (scheduleId: number) => void;
}) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {tasks.map((task) => {
        const areaType = (task.areaType || 'production') as AreaType;
        const IconComp = AREA_ICONS[areaType] || MapPin;
        return (
          <div
            key={task.scheduleId}
            className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all"
          >
            <div className="p-4 flex items-start gap-3">
              <div
                className={cn(
                  'h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0',
                  AREA_BG[areaType]
                )}
              >
                <IconComp className={cn('h-5 w-5', AREA_TEXT[areaType])} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-semibold text-gray-900 text-base truncate">
                    {task.scheduleName}
                  </p>
                  {task.isOverdue ? (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 whitespace-nowrap">
                      เกินกำหนด {task.daysOverdue} วัน
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 whitespace-nowrap">
                      ใกล้ถึงกำหนด
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                  <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                    <MapPin className="h-3 w-3" />
                    {AREA_LABELS[areaType]}
                  </span>
                  {task.frequency && (
                    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-0.5 rounded capitalize">
                      <Clock className="h-3 w-3" />
                      {task.frequency}
                    </span>
                  )}
                  {task.dueDate && (
                    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      <Calendar className="h-3 w-3" />
                      {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Touch-friendly footer: 44px min height */}
            <div className="border-t border-gray-100">
              <button
                type="button"
                onClick={() => onRecord(task.scheduleId)}
                className="w-full flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 transition-colors min-h-[44px]"
              >
                <FileCheck className="h-4 w-4" />
                <span>บันทึกผล</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Task card skeleton — mobile loading state */
function TaskCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 bg-gray-200 rounded" />
              <div className="h-3 w-1/2 bg-gray-200 rounded" />
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

/** Grid skeleton — desktop loading state */
function TaskGridSkeleton() {
  return (
    <div className="p-4 space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-lg animate-pulse"
        >
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 bg-gray-200 rounded" />
            <div className="h-2 w-1/6 bg-gray-200 rounded" />
          </div>
          <div className="h-6 w-20 bg-gray-200 rounded-full" />
          <div className="h-6 w-16 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

/** Chart skeleton placeholder */
function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="w-full rounded-lg bg-gradient-to-br from-gray-100 to-gray-50 animate-pulse"
      style={{ height }}
      aria-busy="true"
      aria-live="polite"
    />
  );
}

/** Summary list skeleton */
function SummarySkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-200" />
            <div className="space-y-1">
              <div className="h-3 w-24 bg-gray-200 rounded" />
              <div className="h-2 w-16 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="h-5 w-10 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

/** Empty state — no pending tasks */
function AllCaughtUpState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="p-3 bg-green-100 rounded-full w-14 h-14 mx-auto mb-4 flex items-center justify-center">
        <CheckCircle className="h-7 w-7 text-green-600" />
      </div>
      <h3 className="font-semibold text-green-800 mb-1">ไม่มีงานค้าง!</h3>
      <p className="text-sm text-green-700 max-w-sm">
        ไม่มีงานสุขาภิบาลที่ค้างในอีก 14 วันข้างหน้า
      </p>
    </div>
  );
}

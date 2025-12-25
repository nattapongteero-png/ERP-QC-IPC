'use client';

/**
 * Work Orders Dashboard Page
 *
 * Professional dashboard for viewing and managing production work orders.
 * Redesigned with DevExtreme UI components following GMP module patterns.
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  SearchPanel,
  HeaderFilter,
  Scrolling,
  Export,
} from 'devextreme-react/data-grid';
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
import { DxButton } from '@/components/ui/dx-button';
import { DxTabs } from '@/components/ui/dx-tabs';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { Workbook } from 'exceljs';
import { saveAs } from 'file-saver';
import { exportDataGrid } from 'devextreme/excel_exporter';
import type { ExportingEvent } from 'devextreme/ui/data_grid';
import {
  Factory,
  ClipboardList,
  Clock,
  PlayCircle,
  CheckCircle,
  XCircle,
  Rocket,
  TrendingUp,
  BarChart3,
  Calendar,
  Percent,
  Package,
  AlertTriangle,
  Eye,
  Target,
  Activity,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface WorkOrder {
  id: number;
  woNumber: string;
  batchNumber: string;
  plannedQuantity: number;
  actualQuantity: number;
  unit: string;
  status: 'planned' | 'released' | 'in_progress' | 'completed' | 'cancelled';
  priority: number;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
  yieldPercentage: number;
  productId: number;
  productCode: string;
  productName: string;
  createdAt: string;
}

// ============================================
// Constants
// ============================================

const STATUS_CONFIG = {
  planned: {
    label: 'Planned',
    labelTh: 'วางแผน',
    color: '#3b82f6',
    bgClass: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: ClipboardList,
  },
  released: {
    label: 'Released',
    labelTh: 'ปล่อยงาน',
    color: '#8b5cf6',
    bgClass: 'bg-violet-100 text-violet-700 border-violet-200',
    icon: Rocket,
  },
  in_progress: {
    label: 'In Progress',
    labelTh: 'กำลังผลิต',
    color: '#f59e0b',
    bgClass: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: PlayCircle,
  },
  completed: {
    label: 'Completed',
    labelTh: 'เสร็จสิ้น',
    color: '#22c55e',
    bgClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: CheckCircle,
  },
  cancelled: {
    label: 'Cancelled',
    labelTh: 'ยกเลิก',
    color: '#ef4444',
    bgClass: 'bg-red-100 text-red-700 border-red-200',
    icon: XCircle,
  },
} as const;

const PRIORITY_CONFIG = {
  high: {
    label: 'High',
    labelTh: 'สูง',
    color: '#ef4444',
    bgClass: 'bg-red-100 text-red-700 border-red-200',
    range: [1, 3],
  },
  medium: {
    label: 'Medium',
    labelTh: 'กลาง',
    color: '#f59e0b',
    bgClass: 'bg-amber-100 text-amber-700 border-amber-200',
    range: [4, 6],
  },
  low: {
    label: 'Low',
    labelTh: 'ต่ำ',
    color: '#22c55e',
    bgClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    range: [7, 10],
  },
} as const;

// ============================================
// API Functions
// ============================================

async function fetchWorkOrders(): Promise<WorkOrder[]> {
  const response = await fetch('/api/production/work-orders?limit=1000');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch work orders');
  }
  return result.data?.items || [];
}

// ============================================
// Helper Functions
// ============================================

function getPriorityLevel(priority: number): 'high' | 'medium' | 'low' {
  if (priority <= 3) return 'high';
  if (priority <= 6) return 'medium';
  return 'low';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ============================================
// Component
// ============================================

export default function WorkOrdersPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  // Fetch work orders
  const { data: workOrders = [], isLoading, refetch } = useQuery({
    queryKey: ['work-orders'],
    queryFn: fetchWorkOrders,
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const planned = workOrders.filter(wo => wo.status === 'planned').length;
    const released = workOrders.filter(wo => wo.status === 'released').length;
    const inProgress = workOrders.filter(wo => wo.status === 'in_progress').length;
    const completed = workOrders.filter(wo => wo.status === 'completed').length;
    const cancelled = workOrders.filter(wo => wo.status === 'cancelled').length;
    const total = workOrders.length;
    const active = planned + released + inProgress;

    // Priority breakdown
    const highPriority = workOrders.filter(wo => wo.priority <= 3 && wo.status !== 'completed' && wo.status !== 'cancelled').length;
    const mediumPriority = workOrders.filter(wo => wo.priority > 3 && wo.priority <= 6 && wo.status !== 'completed' && wo.status !== 'cancelled').length;

    // Today's work orders
    const today = new Date().toISOString().split('T')[0];
    const todayPlanned = workOrders.filter(wo => wo.plannedStartDate?.startsWith(today)).length;

    // Completion rate
    const closedOrders = completed + cancelled;
    const completionRate = closedOrders > 0 ? (completed / closedOrders) * 100 : 0;

    // Average yield
    const completedWithYield = workOrders.filter(wo => wo.status === 'completed' && wo.yieldPercentage > 0);
    const avgYield = completedWithYield.length > 0
      ? completedWithYield.reduce((sum, wo) => sum + wo.yieldPercentage, 0) / completedWithYield.length
      : 0;

    return {
      total,
      planned,
      released,
      inProgress,
      completed,
      cancelled,
      active,
      highPriority,
      mediumPriority,
      todayPlanned,
      completionRate,
      avgYield,
    };
  }, [workOrders]);

  // Filtered work orders based on status
  const filteredWorkOrders = useMemo(() => {
    if (!statusFilter) return workOrders;
    return workOrders.filter(wo => wo.status === statusFilter);
  }, [workOrders, statusFilter]);

  // Chart data
  const statusChartData = useMemo(() => {
    return [
      { status: 'Planned', count: stats.planned, color: STATUS_CONFIG.planned.color },
      { status: 'Released', count: stats.released, color: STATUS_CONFIG.released.color },
      { status: 'In Progress', count: stats.inProgress, color: STATUS_CONFIG.in_progress.color },
      { status: 'Completed', count: stats.completed, color: STATUS_CONFIG.completed.color },
      { status: 'Cancelled', count: stats.cancelled, color: STATUS_CONFIG.cancelled.color },
    ].filter(d => d.count > 0);
  }, [stats]);

  const priorityChartData = useMemo(() => {
    const activeOrders = workOrders.filter(wo => wo.status !== 'completed' && wo.status !== 'cancelled');
    return [
      { priority: 'High', count: activeOrders.filter(wo => wo.priority <= 3).length },
      { priority: 'Medium', count: activeOrders.filter(wo => wo.priority > 3 && wo.priority <= 6).length },
      { priority: 'Low', count: activeOrders.filter(wo => wo.priority > 6).length },
    ];
  }, [workOrders]);

  // Status tabs
  const statusTabs = [
    { id: 0, text: 'All', icon: 'selectall' },
    { id: 1, text: 'Planned', icon: 'event' },
    { id: 2, text: 'Released', icon: 'share' },
    { id: 3, text: 'In Progress', icon: 'runner' },
    { id: 4, text: 'Completed', icon: 'check' },
    { id: 5, text: 'Cancelled', icon: 'close' },
  ];

  const handleTabChange = (index: number) => {
    const statusMap: (string | undefined)[] = [undefined, 'planned', 'released', 'in_progress', 'completed', 'cancelled'];
    setStatusFilter(statusMap[index]);
  };

  // Export handler
  const handleExporting = useCallback((e: ExportingEvent) => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Work Orders');

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Work_Orders_${new Date().toISOString().split('T')[0]}.xlsx`
        );
      });
    });
    e.cancel = true;
  }, []);

  // Cell renderers
  const renderWOCell = useCallback((data: { data: WorkOrder }) => (
    <div className="min-w-0">
      <p className="font-mono font-semibold text-blue-600">{data.data.woNumber || '-'}</p>
      <p className="text-xs text-gray-500 font-mono">{data.data.batchNumber || '-'}</p>
    </div>
  ), []);

  const renderProductCell = useCallback((data: { data: WorkOrder }) => (
    <div className="min-w-0">
      <p className="font-medium text-gray-900 truncate">{data.data.productName || '-'}</p>
      <p className="text-xs text-gray-500 font-mono">{data.data.productCode || '-'}</p>
    </div>
  ), []);

  const renderQuantityCell = useCallback((data: { data: WorkOrder }) => {
    const wo = data.data;
    const progress = wo.plannedQuantity > 0 ? ((wo.actualQuantity || 0) / wo.plannedQuantity) * 100 : 0;
    return (
      <div className="min-w-0">
        <p className="font-medium">
          {wo.actualQuantity?.toLocaleString() || '0'} / {wo.plannedQuantity?.toLocaleString() || '-'} {wo.unit}
        </p>
        {wo.status === 'in_progress' && (
          <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-amber-500 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}
      </div>
    );
  }, []);

  const renderPriorityCell = useCallback((data: { data: WorkOrder }) => {
    const level = getPriorityLevel(data.data.priority);
    const config = PRIORITY_CONFIG[level];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bgClass}`}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }} />
        {config.labelTh}
      </span>
    );
  }, []);

  const renderDateCell = useCallback((data: { data: WorkOrder }) => {
    const wo = data.data;
    const startDate = wo.actualStartDate || wo.plannedStartDate;
    const endDate = wo.actualEndDate || wo.plannedEndDate;
    return (
      <div className="min-w-0 text-sm">
        <p>{formatDate(startDate)}</p>
        {endDate && <p className="text-xs text-gray-500">→ {formatDate(endDate)}</p>}
      </div>
    );
  }, []);

  const renderYieldCell = useCallback((data: { data: WorkOrder }) => {
    const yield_pct = data.data.yieldPercentage;
    if (!yield_pct || yield_pct === 0) return <span className="text-gray-400">-</span>;
    const colorClass = yield_pct >= 95 ? 'text-emerald-600' : yield_pct >= 85 ? 'text-amber-600' : 'text-red-600';
    return <span className={`font-semibold ${colorClass}`}>{yield_pct.toFixed(1)}%</span>;
  }, []);

  const renderStatusCell = useCallback((data: { data: WorkOrder }) => {
    const config = STATUS_CONFIG[data.data.status];
    if (!config) return <span className="text-gray-400">{data.data.status}</span>;
    const IconComponent = config.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bgClass}`}>
        <IconComponent className="h-3 w-3" />
        {config.labelTh}
      </span>
    );
  }, []);

  const renderActionsCell = useCallback((data: { data: WorkOrder }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        router.push(`/production/work-orders/${data.data.id}`);
      }}
      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
      title="View Details"
    >
      <Eye className="h-4 w-4" />
    </button>
  ), [router]);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1800px] mx-auto">
      {/* Page Header */}
      <ResponsivePageHeader
        title="Work Orders"
        subtitle="Production Management - ใบสั่งผลิต"
        icon={Factory}
        iconBgColor="bg-indigo-100"
        iconColor="text-indigo-600"
        breadcrumbs={[
          { label: 'Production', href: '/production' },
          { label: 'Work Orders' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <DxButton
              icon="refresh"
              type="default"
              stylingMode="outlined"
              hint="Refresh"
              onClick={() => refetch()}
            />
            <DxButton
              icon="chart"
              text="Analytics"
              type="default"
              stylingMode="outlined"
              onClick={() => router.push('/production/analytics')}
            />
            <DxButton
              icon="plus"
              text="New Work Order"
              type="success"
              onClick={() => router.push('/production/work-orders/new')}
            />
          </div>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 md:gap-4">
        <StatCard
          label="Total Orders"
          value={stats.total}
          icon={ClipboardList}
          iconColor="text-indigo-500"
          accentColor="border-indigo-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Planned"
          value={stats.planned}
          icon={Clock}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Released"
          value={stats.released}
          icon={Rocket}
          iconColor="text-violet-500"
          accentColor="border-violet-500"
          isLoading={isLoading}
        />
        <StatCard
          label="In Progress"
          value={stats.inProgress}
          icon={PlayCircle}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Completed"
          value={stats.completed}
          icon={CheckCircle}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={isLoading}
        />
        <StatCard
          label="High Priority"
          value={stats.highPriority}
          icon={AlertTriangle}
          iconColor="text-red-500"
          accentColor="border-red-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Today"
          value={stats.todayPlanned}
          icon={Calendar}
          iconColor="text-purple-500"
          accentColor="border-purple-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Avg Yield"
          value={stats.avgYield > 0 ? `${stats.avgYield.toFixed(1)}%` : '-'}
          icon={Percent}
          iconColor="text-cyan-500"
          accentColor="border-cyan-500"
          isLoading={isLoading}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Status Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              By Status
            </h3>
          </div>
          {statusChartData.length > 0 ? (
            <PieChart
              id="status-pie"
              dataSource={statusChartData}
              type="doughnut"
              innerRadius={0.65}
              palette={statusChartData.map(d => d.color)}
              size={{ height: 200 }}
            >
              <Series argumentField="status" valueField="count">
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
                <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No data</p>
              </div>
            </div>
          )}
        </div>

        {/* Priority Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-500" />
              Active Orders by Priority
            </h3>
          </div>
          {priorityChartData.some(d => d.count > 0) ? (
            <Chart id="priority-chart" dataSource={priorityChartData} size={{ height: 200 }}>
              <CommonSeriesSettings argumentField="priority" type="bar" />
              <ChartSeries valueField="count" name="Orders" color="#6366f1" />
              <ArgumentAxis>
                <ChartLabel overlappingBehavior="rotate" rotationAngle={-45} />
              </ArgumentAxis>
              <ValueAxis />
              <ChartLegend visible={false} />
              <ChartTooltip
                enabled={true}
                customizeTooltip={(arg: { argumentText?: string; valueText?: string }) => ({
                  text: `${arg.argumentText}: ${arg.valueText} orders`,
                })}
              />
            </Chart>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No active orders</p>
              </div>
            </div>
          )}
        </div>

        {/* Performance Summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              Performance
            </h3>
          </div>
          <div className="space-y-3">
            {/* Completion Rate */}
            <div className="p-3 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">Completion Rate</span>
                </div>
                <span className="text-lg font-bold text-emerald-600">
                  {stats.completionRate.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Active Orders */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-r from-amber-500 to-amber-600 rounded text-white">
                  <PlayCircle className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-medium text-gray-700">Active Orders</span>
              </div>
              <span className="text-sm font-bold text-amber-600">{stats.active}</span>
            </div>

            {/* Average Yield */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded text-white">
                  <Percent className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-medium text-gray-700">Average Yield</span>
              </div>
              <span className={`text-sm font-bold ${
                stats.avgYield >= 95 ? 'text-emerald-600' :
                stats.avgYield >= 85 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {stats.avgYield > 0 ? `${stats.avgYield.toFixed(1)}%` : 'N/A'}
              </span>
            </div>

            {/* Cancelled */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-r from-red-500 to-red-600 rounded text-white">
                  <XCircle className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-medium text-gray-700">Cancelled</span>
              </div>
              <span className="text-sm font-bold text-red-600">{stats.cancelled}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map(status => {
          const config = STATUS_CONFIG[status];
          const count = workOrders.filter(wo => wo.status === status).length;
          const IconComponent = config.icon;
          return (
            <div
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md ${
                statusFilter === status ? 'border-indigo-500 shadow-md' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config.bgClass.split(' ')[0]}`}>
                    <IconComponent className="h-5 w-5" style={{ color: config.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">{config.label}</p>
                    <p className="text-xs text-gray-400">{config.labelTh}</p>
                  </div>
                </div>
                <span className="text-2xl font-bold" style={{ color: config.color }}>{count}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content - Tabs + DataGrid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tabs Header */}
        <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <DxTabs
              items={statusTabs}
              selectedIndex={
                statusFilter === undefined ? 0 :
                statusFilter === 'planned' ? 1 :
                statusFilter === 'released' ? 2 :
                statusFilter === 'in_progress' ? 3 :
                statusFilter === 'completed' ? 4 : 5
              }
              onSelectedIndexChange={handleTabChange}
              stylingMode="secondary"
            />
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Factory className="w-4 h-4" />
                {filteredWorkOrders.length} orders
              </span>
            </div>
          </div>
        </div>

        {/* DataGrid */}
        <DataGrid
          dataSource={filteredWorkOrders}
          showBorders={false}
          showRowLines={true}
          showColumnLines={false}
          rowAlternationEnabled={true}
          hoverStateEnabled={true}
          height={500}
          columnAutoWidth={true}
          wordWrapEnabled={false}
          onExporting={handleExporting}
          onRowClick={(e) => {
            if (e.data && e.rowType === 'data') {
              router.push(`/production/work-orders/${e.data.id}`);
            }
          }}
        >
          <Scrolling mode="virtual" />
          <Paging defaultPageSize={15} />
          <Pager
            showPageSizeSelector={true}
            allowedPageSizes={[10, 15, 25, 50]}
            showInfo={true}
            showNavigationButtons={true}
          />
          <FilterRow visible={true} />
          <SearchPanel visible={true} placeholder="Search work orders..." width={250} />
          <HeaderFilter visible={true} />
          <Export enabled={true} formats={['xlsx']} />

          <Column
            dataField="woNumber"
            caption="WO / Batch"
            width={150}
            cellRender={renderWOCell}
          />
          <Column
            caption="Product"
            minWidth={200}
            cellRender={renderProductCell}
            calculateCellValue={(data: WorkOrder) => data.productName}
          />
          <Column
            caption="Quantity"
            width={180}
            cellRender={renderQuantityCell}
          />
          <Column
            dataField="priority"
            caption="Priority"
            width={100}
            cellRender={renderPriorityCell}
          />
          <Column
            caption="Schedule"
            width={130}
            cellRender={renderDateCell}
          />
          <Column
            dataField="yieldPercentage"
            caption="Yield"
            width={80}
            cellRender={renderYieldCell}
          />
          <Column
            dataField="status"
            caption="Status"
            width={130}
            cellRender={renderStatusCell}
          />
          <Column
            caption=""
            width={60}
            cellRender={renderActionsCell}
            allowFiltering={false}
            allowSorting={false}
          />
        </DataGrid>
      </div>
    </div>
  );
}

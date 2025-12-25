'use client';

/**
 * Batch Records (eBMR) Dashboard Page
 * Feature: Production Management
 *
 * Professional dashboard for Electronic Batch Manufacturing Records.
 * Tracks production steps, deviations, and manufacturing compliance.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PieChart, {
  Series,
  Label,
  Legend,
  Connector,
  Tooltip,
} from 'devextreme-react/pie-chart';
import Chart, {
  ArgumentAxis,
  ValueAxis,
  Series as ChartSeries,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  CommonSeriesSettings,
} from 'devextreme-react/chart';
import {
  ClipboardCheck,
  Clock,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Timer,
  ChevronRight,
  Activity,
  Layers,
} from 'lucide-react';
import type { BatchRecordsDashboard } from '@/app/api/production/batch-records/dashboard/route';

// Status configuration
const statusConfig = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-700', borderColor: 'border-gray-400' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800', borderColor: 'border-blue-500' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800', borderColor: 'border-green-500' },
  deviation: { label: 'Deviation', color: 'bg-red-100 text-red-800', borderColor: 'border-red-500' },
};

const statusFilters = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'deviation', label: 'Deviation' },
];

// Chart color palette - production/manufacturing theme
const chartColors = ['#6B7280', '#3B82F6', '#10B981', '#EF4444'];

export default function BatchRecordsDashboardPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // Fetch dashboard data
  const { data: dashboard, isLoading: dashboardLoading } = useQuery<BatchRecordsDashboard>({
    queryKey: ['batch-records-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/production/batch-records/dashboard');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  // Fetch batch records list
  const { data: recordsData, isLoading: recordsLoading } = useQuery({
    queryKey: ['batch-records-list', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/production/batch-records?${params}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data?.items || [];
    },
  });

  // Prepare chart data
  const statusChartData = dashboard
    ? Object.entries(dashboard.byStatus)
        .filter(([, value]) => value > 0)
        .map(([status, count]) => ({
          status: statusConfig[status as keyof typeof statusConfig]?.label || status,
          count,
        }))
    : [];

  const activityChartData = dashboard?.recentActivity || [];

  const renderStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return <span className="text-gray-500">{status}</span>;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {status === 'pending' && <Clock className="h-3 w-3" />}
        {status === 'in_progress' && <PlayCircle className="h-3 w-3" />}
        {status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
        {status === 'deviation' && <AlertTriangle className="h-3 w-3" />}
        {config.label}
      </span>
    );
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('th-TH', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  const filteredRecords = recordsData?.filter((record: { status: string }) => {
    if (activeTab === 'all') return true;
    return record.status === activeTab;
  }) || [];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <ResponsivePageHeader
        title="Electronic Batch Records (eBMR)"
        subtitle="Manufacturing process documentation and compliance tracking"
        icon={ClipboardCheck}
        iconBgColor="bg-indigo-100"
        iconColor="text-indigo-600"
        breadcrumbs={[
          { label: 'Production', href: '/production' },
          { label: 'Batch Records' },
        ]}
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Records"
          value={dashboard?.totalRecords ?? 0}
          icon={FileText}
          iconColor="text-indigo-500"
          accentColor="border-indigo-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="In Progress"
          value={dashboard?.inProgressRecords ?? 0}
          icon={PlayCircle}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Completed Today"
          value={dashboard?.completedToday ?? 0}
          icon={CheckCircle2}
          iconColor="text-green-500"
          accentColor="border-green-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Deviations"
          value={dashboard?.deviationRecords ?? 0}
          icon={AlertTriangle}
          iconColor="text-red-500"
          accentColor="border-red-500"
          isLoading={dashboardLoading}
        />
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          label="Pending Steps"
          value={dashboard?.pendingRecords ?? 0}
          icon={Clock}
          iconColor="text-gray-500"
          accentColor="border-gray-400"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Avg Completion Time"
          value={dashboard?.avgCompletionTime ? `${dashboard.avgCompletionTime} min` : '-'}
          icon={Timer}
          iconColor="text-purple-500"
          accentColor="border-purple-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Completed Steps"
          value={dashboard?.completedRecords ?? 0}
          icon={CheckCircle2}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={dashboardLoading}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Activity className="h-5 w-5 text-indigo-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Record Status Distribution</h3>
          </div>
          {statusChartData.length > 0 ? (
            <PieChart
              dataSource={statusChartData}
              palette={chartColors}
              type="doughnut"
              innerRadius={0.65}
              size={{ height: 260 }}
            >
              <Series argumentField="status" valueField="count">
                <Label visible format="fixedPoint">
                  <Connector visible width={1} />
                </Label>
              </Series>
              <Legend
                horizontalAlignment="center"
                verticalAlignment="bottom"
                itemTextPosition="right"
                rowCount={1}
              />
              <Tooltip enabled format="fixedPoint" />
            </PieChart>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-gray-400">
              <div className="text-center">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No records found</p>
              </div>
            </div>
          )}
        </div>

        {/* Weekly Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-green-50 rounded-lg">
              <Activity className="h-5 w-5 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Weekly Activity</h3>
          </div>
          {activityChartData.length > 0 ? (
            <Chart dataSource={activityChartData} size={{ height: 260 }}>
              <CommonSeriesSettings argumentField="date" type="bar" />
              <ArgumentAxis />
              <ValueAxis />
              <ChartSeries
                valueField="completed"
                name="Completed"
                color="#10B981"
              />
              <ChartSeries
                valueField="deviations"
                name="Deviations"
                color="#EF4444"
              />
              <ChartTooltip enabled />
              <ChartLegend
                horizontalAlignment="center"
                verticalAlignment="bottom"
              />
            </Chart>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-gray-400">
              <div className="text-center">
                <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No activity data yet</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Products & Recent Records Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Layers className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Top Products by Records</h3>
            </div>
          </div>
          <div className="space-y-2">
            {dashboard?.topProducts?.slice(0, 6).map((product, index) => (
              <div
                key={product.productId}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{product.productName}</p>
                    <p className="text-xs text-gray-500 font-mono">{product.productCode}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{product.recordCount} steps</p>
                  <p className="text-xs text-green-600">{product.completionRate}% complete</p>
                </div>
              </div>
            )) || (
              <div className="text-center py-8 text-gray-400">
                <Layers className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No product data</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Records */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-50 rounded-lg">
                <ClipboardCheck className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Recent Manufacturing Steps</h3>
            </div>
          </div>
          <div className="space-y-2">
            {dashboard?.recentRecords?.slice(0, 6).map((record) => (
              <div
                key={record.id}
                onClick={() => router.push(`/production/batch-records/${record.id}`)}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-1 h-10 rounded-full ${statusConfig[record.status as keyof typeof statusConfig]?.borderColor || 'border-gray-300'} bg-current opacity-60`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-medium text-gray-900">{record.woNumber}</p>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{record.stepName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    {renderStatusBadge(record.status)}
                    <p className="text-xs text-gray-400 mt-1">{record.productName}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                </div>
              </div>
            )) || (
              <div className="text-center py-8 text-gray-400">
                <ClipboardCheck className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No recent records</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {dashboard && dashboard.deviationRecords > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h4 className="font-semibold text-red-800">Deviations Detected</h4>
              <p className="text-sm text-red-700 mt-1">
                There are <strong>{dashboard.deviationRecords}</strong> batch record{dashboard.deviationRecords > 1 ? 's' : ''} with deviations that require attention.
                Review and address these deviations to maintain GMP compliance.
              </p>
              <button
                onClick={() => {
                  setStatusFilter('deviation');
                  setActiveTab('deviation');
                }}
                className="mt-2 text-sm font-medium text-red-800 hover:text-red-900 flex items-center gap-1"
              >
                View deviations <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {dashboard && dashboard.inProgressRecords > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <PlayCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h4 className="font-semibold text-blue-800">Active Production Steps</h4>
              <p className="text-sm text-blue-700 mt-1">
                <strong>{dashboard.inProgressRecords}</strong> manufacturing step{dashboard.inProgressRecords > 1 ? 's are' : ' is'} currently in progress.
                Monitor these steps to ensure timely completion.
              </p>
              <button
                onClick={() => {
                  setStatusFilter('in_progress');
                  setActiveTab('in_progress');
                }}
                className="mt-2 text-sm font-medium text-blue-800 hover:text-blue-900 flex items-center gap-1"
              >
                View in progress <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Records List Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tabs Header */}
        <div className="border-b border-gray-100 px-5 pt-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <FileText className="h-5 w-5 text-indigo-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Batch Records Registry</h3>
            </div>
            <div className="flex items-center gap-3">
              <DxSelectBox
                dataSource={statusFilters}
                displayExpr="label"
                valueExpr="value"
                value={statusFilter}
                onValueChanged={(e) => setStatusFilter(e.value)}
                width={160}
                placeholder="Filter by status"
              />
            </div>
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList>
              <TabsTrigger value="all">
                All ({recordsData?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="in_progress">
                In Progress ({recordsData?.filter((r: { status: string }) => r.status === 'in_progress').length || 0})
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pending ({recordsData?.filter((r: { status: string }) => r.status === 'pending').length || 0})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({recordsData?.filter((r: { status: string }) => r.status === 'completed').length || 0})
              </TabsTrigger>
              <TabsTrigger value="deviation">
                Deviations ({recordsData?.filter((r: { status: string }) => r.status === 'deviation').length || 0})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* DataGrid */}
        <div className="p-4">
          <DxDataGrid
            dataSource={filteredRecords}
            keyExpr="id"
            showBorders={false}
            rowAlternationEnabled
            loading={recordsLoading}
            onRowClick={(e) => {
              if (e.data?.id) {
                router.push(`/production/batch-records/${e.data.id}`);
              }
            }}
          >
            <DxSearchPanel visible placeholder="Search records..." />
            <DxPaging defaultPageSize={15} />

            <DxColumn
              dataField="woNumber"
              caption="Work Order"
              width={150}
              cellRender={(cell) => (
                <div>
                  <span className="font-mono font-medium text-indigo-700">{cell.data.woNumber}</span>
                  <p className="text-xs text-gray-500">{cell.data.batchNumber}</p>
                </div>
              )}
            />
            <DxColumn
              dataField="productCode"
              caption="Product"
              minWidth={150}
              cellRender={(cell) => (
                <div>
                  <p className="font-medium text-gray-900">{cell.data.productCode}</p>
                  <p className="text-xs text-gray-500 truncate">{cell.data.productName}</p>
                </div>
              )}
            />
            <DxColumn
              dataField="stepName"
              caption="Step"
              minWidth={180}
              cellRender={(cell) => (
                <div>
                  <p className="font-medium text-gray-900">#{cell.data.sequence} - {cell.data.stepName}</p>
                  <p className="text-xs text-gray-500">{cell.data.operationName}</p>
                </div>
              )}
            />
            <DxColumn
              dataField="startTime"
              caption="Start Time"
              width={140}
              cellRender={(cell) => (
                <span className="text-sm tabular-nums">{formatDateTime(cell.data.startTime)}</span>
              )}
            />
            <DxColumn
              dataField="endTime"
              caption="End Time"
              width={140}
              cellRender={(cell) => (
                <span className="text-sm tabular-nums">{formatDateTime(cell.data.endTime)}</span>
              )}
            />
            <DxColumn
              dataField="performerName"
              caption="Performer"
              width={120}
              cellRender={(cell) => cell.data.performerName || '-'}
            />
            <DxColumn
              dataField="status"
              caption="Status"
              width={130}
              cellRender={(cell) => renderStatusBadge(cell.value)}
            />
            <DxColumn
              caption=""
              width={50}
              cellRender={() => (
                <ChevronRight className="h-4 w-4 text-gray-300" />
              )}
              allowFiltering={false}
              allowSorting={false}
            />
          </DxDataGrid>
        </div>
      </div>
    </div>
  );
}

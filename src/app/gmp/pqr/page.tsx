'use client';

/**
 * PQR (Product Quality Review) Dashboard Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * Professional dashboard for viewing and managing annual product quality reviews.
 * Redesigned with DevExtreme UI components.
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  SearchPanel,
  HeaderFilter,
  Scrolling,
} from 'devextreme-react/data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTabs } from '@/components/ui/dx-tabs';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
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
  BarChart3,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Package,
  Calendar,
  Activity,
  TrendingUp,
  Search,
  FlaskConical,
  ClipboardCheck,
} from 'lucide-react';
import type {
  PqrReport,
  PqrStatus,
  PqrDashboard,
  PqrCreate,
} from '@/types/pqr';

// ============================================
// Constants
// ============================================

const STATUS_COLORS: Record<PqrStatus, string> = {
  draft: '#6b7280',
  under_review: '#f59e0b',
  approved: '#22c55e',
};

const STATUS_LABELS: Record<PqrStatus, string> = {
  draft: 'Draft',
  under_review: 'Under Review',
  approved: 'Approved',
};

// ============================================
// API Functions
// ============================================

async function fetchDashboard(): Promise<PqrDashboard> {
  const response = await fetch('/api/pqr/dashboard');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch dashboard');
  }
  return result.data;
}

async function fetchPqrList(params: {
  status?: PqrStatus;
  page?: number;
  limit?: number;
}): Promise<{ items: PqrReport[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));

  const response = await fetch(`/api/pqr?${searchParams.toString()}`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch PQR reports');
  }
  return result.data;
}

async function fetchProducts(): Promise<{ id: number; name: string; code: string }[]> {
  const response = await fetch('/api/items?category=finished_goods&limit=100');
  const result = await response.json();
  if (!result.success) return [];
  return (result.data?.items || []).map((item: { id: number; nameTh: string; code: string }) => ({
    id: item.id,
    name: item.nameTh,
    code: item.code,
  }));
}

async function createPqrReport(data: PqrCreate): Promise<PqrReport> {
  const response = await fetch('/api/pqr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to create PQR report');
  }
  return result.data;
}

// ============================================
// Component
// ============================================

export default function PqrDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<PqrStatus | undefined>(undefined);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newReportData, setNewReportData] = useState<Partial<PqrCreate>>({
    reviewYear: new Date().getFullYear(),
  });

  // Fetch dashboard statistics
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['pqr-dashboard'],
    queryFn: fetchDashboard,
  });

  // Fetch PQR list
  const { data: pqrData } = useQuery({
    queryKey: ['pqr-list', statusFilter],
    queryFn: () => fetchPqrList({ status: statusFilter, limit: 100 }),
  });

  // Fetch products for new report dialog
  const { data: products } = useQuery({
    queryKey: ['products-finished'],
    queryFn: fetchProducts,
    enabled: showNewDialog,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createPqrReport,
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: ['pqr-list'] });
      queryClient.invalidateQueries({ queryKey: ['pqr-dashboard'] });
      setShowNewDialog(false);
      setNewReportData({ reviewYear: new Date().getFullYear() });
      router.push(`/gmp/pqr/${report.id}`);
    },
  });

  // Status tabs
  const statusTabs = [
    { id: 0, text: 'All', icon: 'selectall' },
    { id: 1, text: 'Draft', icon: 'edit' },
    { id: 2, text: 'Under Review', icon: 'find' },
    { id: 3, text: 'Approved', icon: 'check' },
  ];

  const handleTabChange = (index: number) => {
    const statusMap: (PqrStatus | undefined)[] = [undefined, 'draft', 'under_review', 'approved'];
    setStatusFilter(statusMap[index]);
  };

  // Prepare chart data
  const statusChartData = useMemo(() => {
    if (!dashboard?.byStatus) return [];
    return Object.entries(dashboard.byStatus)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        status,
        label: STATUS_LABELS[status as PqrStatus],
        value: count,
        color: STATUS_COLORS[status as PqrStatus],
      }));
  }, [dashboard]);

  const yearChartData = useMemo(() => {
    if (!dashboard?.byYear) return [];
    return dashboard.byYear.map((item) => ({
      year: String(item.year),
      count: item.count,
    }));
  }, [dashboard]);

  // Cell renderers
  const renderStatus = useCallback((data: { value: PqrStatus }) => {
    const colors: Record<PqrStatus, string> = {
      draft: 'bg-gray-100 text-gray-700',
      under_review: 'bg-amber-100 text-amber-700',
      approved: 'bg-green-100 text-green-700',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[data.value]}`}>
        {STATUS_LABELS[data.value]}
      </span>
    );
  }, []);

  const renderProduct = useCallback((data: { data: PqrReport }) => {
    return (
      <div className="flex flex-col">
        <span className="font-medium text-sm">{data.data.productName || 'N/A'}</span>
        <span className="text-xs text-gray-500">{data.data.productCode}</span>
      </div>
    );
  }, []);

  const renderMetrics = useCallback((data: { data: PqrReport }) => {
    return (
      <div className="flex items-center gap-3 text-xs">
        <span title="Batches" className="flex items-center gap-1">
          <Package className="w-3 h-3" />
          {data.data.batchesProduced}
        </span>
        <span title="Deviations" className="flex items-center gap-1 text-amber-600">
          <AlertTriangle className="w-3 h-3" />
          {data.data.deviationCount}
        </span>
        <span title="CAPAs" className="flex items-center gap-1 text-blue-600">
          <ClipboardCheck className="w-3 h-3" />
          {data.data.capaCount}
        </span>
        <span title="OOS" className="flex items-center gap-1 text-red-600">
          <FlaskConical className="w-3 h-3" />
          {data.data.oosCount}
        </span>
      </div>
    );
  }, []);

  // Handle row click
  const handleRowClick = useCallback(
    (e: { data: PqrReport }) => {
      router.push(`/gmp/pqr/${e.data.id}`);
    },
    [router]
  );

  // Handle create new report
  const handleCreateReport = () => {
    if (!newReportData.productId || !newReportData.reviewYear) return;
    createMutation.mutate(newReportData as PqrCreate);
  };

  const totalAll = dashboard?.totalReports ?? 0;
  const currentYear = new Date().getFullYear();

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1800px] mx-auto">
      {/* Page Header */}
      <ResponsivePageHeader
        title="Product Quality Review (PQR)"
        subtitle="Annual Quality Review Reports (GMP หมวด 1)"
        icon={BarChart3}
        iconBgColor="bg-indigo-100"
        iconColor="text-indigo-600"
        breadcrumbs={[
          { label: 'GMP', href: '/gmp' },
          { label: 'PQR' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <DxButton
              icon="refresh"
              type="default"
              stylingMode="outlined"
              hint="Refresh"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['pqr-dashboard'] });
                queryClient.invalidateQueries({ queryKey: ['pqr-list'] });
              }}
            />
            <DxButton
              icon="plus"
              text="New PQR Report"
              type="success"
              onClick={() => setShowNewDialog(true)}
            />
          </div>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <StatCard
          label="Total Reports"
          value={dashboard?.totalReports ?? 0}
          icon={FileText}
          iconColor="text-indigo-500"
          accentColor="border-indigo-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Draft"
          value={dashboard?.byStatus?.draft ?? 0}
          icon={Clock}
          iconColor="text-gray-500"
          accentColor="border-gray-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Under Review"
          value={dashboard?.pendingReview ?? 0}
          icon={Search}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Approved"
          value={dashboard?.byStatus?.approved ?? 0}
          icon={CheckCircle}
          iconColor="text-green-500"
          accentColor="border-green-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={`Approved ${currentYear}`}
          value={dashboard?.approvedThisYear ?? 0}
          icon={Calendar}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Deviation Rate"
          value={dashboard?.averageMetrics?.deviationRate != null ? `${dashboard.averageMetrics.deviationRate}%` : 'N/A'}
          icon={AlertTriangle}
          iconColor="text-red-500"
          accentColor="border-red-500"
          isLoading={dashboardLoading}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Status Pie Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
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
                <p className="text-sm">No data</p>
              </div>
            </div>
          )}
        </div>

        {/* Year Bar Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              Reports by Year
            </h3>
          </div>
          {yearChartData.length > 0 ? (
            <Chart id="year-chart" dataSource={yearChartData} size={{ height: 200 }}>
              <CommonSeriesSettings argumentField="year" type="bar" color="#6366f1" />
              <ChartSeries valueField="count" name="Reports" color="#6366f1" />
              <ArgumentAxis>
                <ChartLabel overlappingBehavior="rotate" rotationAngle={-45} />
              </ArgumentAxis>
              <ValueAxis />
              <ChartLegend visible={false} />
              <ChartTooltip
                enabled={true}
                customizeTooltip={(arg: { argumentText?: string; valueText?: string }) => ({
                  text: `${arg.argumentText}: ${arg.valueText} reports`,
                })}
              />
            </Chart>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No data</p>
              </div>
            </div>
          )}
        </div>

        {/* Metrics Summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Average Metrics
            </h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-red-50 to-rose-50 rounded-lg border border-red-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-gray-700">Deviation Rate</span>
              </div>
              <span className="text-lg font-bold text-red-600">
                {dashboard?.averageMetrics?.deviationRate != null
                  ? `${dashboard.averageMetrics.deviationRate}%`
                  : 'N/A'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-100">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-gray-700">OOS Rate</span>
              </div>
              <span className="text-lg font-bold text-amber-600">
                {dashboard?.averageMetrics?.oosRate != null
                  ? `${dashboard.averageMetrics.oosRate}%`
                  : 'N/A'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-gray-700">CAPA Closure</span>
              </div>
              <span className="text-lg font-bold text-blue-600">
                {dashboard?.averageMetrics?.capaClosureRate != null
                  ? `${dashboard.averageMetrics.capaClosureRate}%`
                  : 'N/A'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg border border-purple-100">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-purple-600" />
                <span className="text-sm text-gray-700">Complaint Rate</span>
              </div>
              <span className="text-lg font-bold text-purple-600">
                {dashboard?.averageMetrics?.complaintRate != null
                  ? `${dashboard.averageMetrics.complaintRate}%`
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

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
                  : statusFilter === 'draft'
                  ? 1
                  : statusFilter === 'under_review'
                  ? 2
                  : 3
              }
              onSelectedIndexChange={handleTabChange}
              stylingMode="secondary"
            />
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                {totalAll} reports
              </span>
            </div>
          </div>
        </div>

        {/* DataGrid */}
        <DataGrid
          dataSource={pqrData?.items || []}
          showBorders={false}
          showRowLines={true}
          showColumnLines={false}
          rowAlternationEnabled={true}
          hoverStateEnabled={true}
          onRowClick={handleRowClick}
          height="auto"
          columnAutoWidth={true}
          wordWrapEnabled={true}
        >
          <Scrolling mode="standard" />
          <Paging defaultPageSize={10} />
          <Pager
            showPageSizeSelector={true}
            allowedPageSizes={[10, 25, 50]}
            showInfo={true}
            showNavigationButtons={true}
          />
          <FilterRow visible={true} />
          <SearchPanel visible={true} placeholder="Search reports..." width={200} />
          <HeaderFilter visible={true} />

          <Column
            dataField="reportNumber"
            caption="Report #"
            width={140}
            cellRender={(data: { value: string }) => (
              <span className="font-mono text-sm text-indigo-600">{data.value}</span>
            )}
          />
          <Column
            caption="Product"
            cellRender={renderProduct}
            calculateCellValue={(data: PqrReport) => data.productName}
            width={200}
          />
          <Column dataField="reviewYear" caption="Year" width={80} alignment="center" />
          <Column dataField="status" caption="Status" width={120} cellRender={renderStatus} />
          <Column caption="Key Metrics" cellRender={renderMetrics} width={200} />
          <Column
            dataField="batchesProduced"
            caption="Batches"
            width={90}
            alignment="center"
          />
          <Column
            dataField="approvedByName"
            caption="Approved By"
            width={150}
          />
          <Column
            dataField="createdAt"
            caption="Created"
            dataType="date"
            format="dd/MM/yyyy"
            width={110}
          />
        </DataGrid>
      </div>

      {/* New PQR Report Dialog */}
      <DxPopup
        visible={showNewDialog}
        onHiding={() => setShowNewDialog(false)}
        title="Create New PQR Report"
        showCloseButton={true}
        width={500}
        height="auto"
      >
        <div className="p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Product *</label>
            <DxSelectBox
              items={(products || []).map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))}
              value={newReportData.productId}
              valueExpr="value"
              displayExpr="label"
              onValueChange={(value) => setNewReportData((prev) => ({ ...prev, productId: value }))}
              placeholder="Select product..."
              searchEnabled
              showClearButton
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Review Year *</label>
            <DxNumberBox
              value={newReportData.reviewYear}
              onValueChange={(value) => setNewReportData((prev) => ({ ...prev, reviewYear: value }))}
              min={2020}
              max={currentYear + 1}
              showSpinButtons
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Period Start</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={newReportData.periodStart || ''}
                onChange={(e) =>
                  setNewReportData((prev) => ({ ...prev, periodStart: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Period End</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={newReportData.periodEnd || ''}
                onChange={(e) =>
                  setNewReportData((prev) => ({ ...prev, periodEnd: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton
              text="Cancel"
              type="default"
              stylingMode="outlined"
              onClick={() => setShowNewDialog(false)}
            />
            <DxButton
              text="Create Report"
              type="success"
              icon="plus"
              onClick={handleCreateReport}
              disabled={!newReportData.productId || !newReportData.reviewYear || createMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}

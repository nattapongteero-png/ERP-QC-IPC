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
import { MainLayout } from '@/components/layout/main-layout';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  SearchPanel,
  HeaderFilter,
  ColumnChooser,
  Export,
  Grouping,
  GroupPanel,
  Summary,
  TotalItem,
  Toolbar,
  Item,
  Scrolling,
  Selection,
} from 'devextreme-react/data-grid';
import { Workbook } from 'exceljs';
import { saveAs } from 'file-saver';
import { exportDataGrid } from 'devextreme/excel_exporter';
import type { ExportingEvent } from 'devextreme/ui/data_grid';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import PieChart, {
  Series as PieSeries,
  Label as PieLabel,
  Legend as PieLegend,
  Tooltip as PieTooltip,
  Connector,
} from 'devextreme-react/pie-chart';
import Chart, {
  CommonSeriesSettings,
  Series,
  ArgumentAxis,
  ValueAxis,
  Legend,
  Tooltip,
  Label,
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
  RefreshCw,
  Plus,
  Eye,
  MoreHorizontal,
  FileBarChart,
  Target,
  Percent,
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

const STATUS_CONFIG: Record<PqrStatus, {
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  chartColor: string;
  icon: React.ReactNode;
}> = {
  draft: {
    label: 'Draft',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-200',
    chartColor: '#64748b',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  under_review: {
    label: 'Under Review',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    chartColor: '#f59e0b',
    icon: <Search className="h-3.5 w-3.5" />,
  },
  approved: {
    label: 'Approved',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    chartColor: '#10b981',
    icon: <CheckCircle className="h-3.5 w-3.5" />,
  },
};

// ============================================
// Helper Components
// ============================================

function MetricCard({
  value,
  label,
  color = 'text-gray-900'
}: {
  value: number | string;
  label: string;
  color?: string;
}) {
  return (
    <div className="text-center px-4 py-3">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function StatusCard({
  status,
  count,
  total,
}: {
  status: PqrStatus;
  count: number;
  total: number;
}) {
  const config = STATUS_CONFIG[status];
  const percentage = total > 0 ? ((count / total) * 100).toFixed(0) : '0';

  return (
    <div className={`${config.bgColor} border ${config.borderColor} rounded-xl p-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 ${config.bgColor} border ${config.borderColor} rounded-lg`}>
            {config.icon}
          </div>
          <div>
            <p className={`font-semibold ${config.textColor}`}>{config.label}</p>
            <p className="text-xs text-gray-500">{percentage}% of total</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${config.textColor}`}>{count}</p>
        </div>
      </div>
    </div>
  );
}

function MetricIndicator({
  label,
  value,
  target,
  icon,
  iconColor,
  bgGradient,
}: {
  label: string;
  value: number | null;
  target?: number;
  icon: React.ReactNode;
  iconColor: string;
  bgGradient: string;
}) {
  const displayValue = value !== null ? `${value}%` : 'N/A';
  const isGood = target !== undefined && value !== null && value <= target;

  return (
    <div className={`flex items-center justify-between p-3 bg-gradient-to-r ${bgGradient} rounded-lg`}>
      <div className="flex items-center gap-2">
        <div className={iconColor}>{icon}</div>
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {target !== undefined && value !== null && (
          <span className={`text-xs ${isGood ? 'text-emerald-600' : 'text-red-600'}`}>
            {isGood ? '✓' : '!'}
          </span>
        )}
        <span className={`text-lg font-bold ${iconColor.replace('text-', 'text-')}`}>
          {displayValue}
        </span>
      </div>
    </div>
  );
}

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
// Main Component
// ============================================

export default function PqrDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('all');
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
    queryKey: ['pqr-list'],
    queryFn: () => fetchPqrList({ limit: 100 }),
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

  // Calculate stats
  const stats = useMemo(() => {
    const items = pqrData?.items || [];
    const draft = items.filter(r => r.status === 'draft').length;
    const underReview = items.filter(r => r.status === 'under_review').length;
    const approved = items.filter(r => r.status === 'approved').length;
    const total = items.length;

    return { draft, underReview, approved, total };
  }, [pqrData]);

  // Filtered data based on active tab
  const filteredReports = useMemo(() => {
    const items = pqrData?.items || [];
    if (activeTab === 'all') return items;
    if (activeTab === 'draft') return items.filter(r => r.status === 'draft');
    if (activeTab === 'under_review') return items.filter(r => r.status === 'under_review');
    if (activeTab === 'approved') return items.filter(r => r.status === 'approved');
    return items;
  }, [pqrData, activeTab]);

  // Chart data
  const statusChartData = useMemo(() => {
    if (!dashboard?.byStatus) return [];
    return Object.entries(dashboard.byStatus)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        status: STATUS_CONFIG[status as PqrStatus].label,
        count,
        color: STATUS_CONFIG[status as PqrStatus].chartColor,
      }));
  }, [dashboard]);

  const yearChartData = useMemo(() => {
    if (!dashboard?.byYear) return [];
    return dashboard.byYear.map((item) => ({
      year: String(item.year),
      count: item.count,
    }));
  }, [dashboard]);

  // Export handler
  const handleExporting = (e: ExportingEvent) => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('PQR Reports');

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }) => {
        if (gridCell?.rowType === 'header') {
          excelCell.font = { bold: true };
          excelCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE8EAF6' },
          };
        }
      },
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `PQR_Reports_${new Date().toISOString().split('T')[0]}.xlsx`
        );
      });
    });
    e.cancel = true;
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['pqr-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['pqr-list'] });
  };

  // Cell renderers
  const renderReportNumber = (cellData: { data: PqrReport }) => {
    return (
      <span className="font-mono font-semibold text-indigo-700">
        {cellData.data.reportNumber}
      </span>
    );
  };

  const renderProduct = (cellData: { data: PqrReport }) => {
    const report = cellData.data;
    return (
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">{report.productName || 'N/A'}</p>
        <p className="text-xs text-gray-500 truncate">{report.productCode}</p>
      </div>
    );
  };

  const renderStatus = (cellData: { data: PqrReport }) => {
    const status = cellData.data.status;
    const config = STATUS_CONFIG[status];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  const renderMetrics = useCallback((cellData: { data: PqrReport }) => {
    const report = cellData.data;
    return (
      <div className="flex items-center gap-3 text-xs">
        <span title="Batches" className="flex items-center gap-1 text-gray-600">
          <Package className="w-3.5 h-3.5" />
          {report.batchesProduced}
        </span>
        <span title="Deviations" className="flex items-center gap-1 text-amber-600">
          <AlertTriangle className="w-3.5 h-3.5" />
          {report.deviationCount}
        </span>
        <span title="CAPAs" className="flex items-center gap-1 text-blue-600">
          <ClipboardCheck className="w-3.5 h-3.5" />
          {report.capaCount}
        </span>
        <span title="OOS" className="flex items-center gap-1 text-red-600">
          <FlaskConical className="w-3.5 h-3.5" />
          {report.oosCount}
        </span>
      </div>
    );
  }, []);

  const renderActions = (cellData: { data: PqrReport }) => {
    const report = cellData.data;
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/gmp/pqr/${report.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
          title="View Details"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
          title="More Options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    );
  };

  // Handle create new report
  const handleCreateReport = () => {
    if (!newReportData.productId || !newReportData.reviewYear) return;
    createMutation.mutate(newReportData as PqrCreate);
  };

  const currentYear = new Date().getFullYear();

  return (
    <MainLayout>
      <div className="flex flex-col h-full gap-6 -m-4 md:-m-6">
        {/* Professional Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-500 p-6 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <FileBarChart className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Product Quality Review</h1>
                <p className="text-indigo-100 text-sm">PQR - Annual Quality Review Reports (GMP หมวด 1)</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors backdrop-blur-sm"
              >
                <RefreshCw className={`h-4 w-4 ${dashboardLoading ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium">Refresh</span>
              </button>
              <button
                onClick={() => router.push('/reports')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors backdrop-blur-sm"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="text-sm font-medium">Reports</span>
              </button>
              <button
                onClick={() => setShowNewDialog(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors font-medium"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm">New PQR</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="mx-4 md:mx-6 -mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 divide-x divide-gray-200 bg-white rounded-xl shadow-lg border border-gray-100">
            <MetricCard value={dashboard?.totalReports ?? 0} label="Total Reports" />
            <MetricCard value={dashboard?.byStatus?.draft ?? 0} label="Draft" color="text-slate-600" />
            <MetricCard value={dashboard?.pendingReview ?? 0} label="Under Review" color="text-amber-600" />
            <MetricCard value={dashboard?.byStatus?.approved ?? 0} label="Approved" color="text-emerald-600" />
            <MetricCard value={dashboard?.approvedThisYear ?? 0} label={`${currentYear} Approved`} color="text-blue-600" />
            <MetricCard
              value={dashboard?.averageMetrics?.deviationRate != null ? `${dashboard.averageMetrics.deviationRate}%` : 'N/A'}
              label="Avg Deviation"
              color="text-red-600"
            />
            <MetricCard
              value={dashboard?.averageMetrics?.oosRate != null ? `${dashboard.averageMetrics.oosRate}%` : 'N/A'}
              label="Avg OOS"
              color="text-purple-600"
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="px-4 md:px-6 pb-6 flex-1 flex flex-col gap-6">
          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left Column - Charts */}
            <div className="xl:col-span-2 space-y-6">
              {/* Status Cards */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-semibold text-gray-900">Reports by Status</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <StatusCard status="draft" count={stats.draft} total={stats.total} />
                  <StatusCard status="under_review" count={stats.underReview} total={stats.total} />
                  <StatusCard status="approved" count={stats.approved} total={stats.total} />
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Status Distribution */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                    <h3 className="font-semibold text-gray-900">Status Distribution</h3>
                  </div>
                  {statusChartData.length > 0 ? (
                    <PieChart
                      dataSource={statusChartData}
                      type="doughnut"
                      innerRadius={0.65}
                      palette={statusChartData.map(d => d.color)}
                      size={{ height: 220 }}
                    >
                      <PieSeries argumentField="status" valueField="count">
                        <PieLabel visible format="fixedPoint" customizeText={(arg) => `${arg.percentText}`}>
                          <Connector visible width={1} />
                        </PieLabel>
                      </PieSeries>
                      <PieLegend
                        verticalAlignment="bottom"
                        horizontalAlignment="center"
                        itemTextPosition="right"
                      />
                      <PieTooltip enabled />
                    </PieChart>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[220px] text-gray-400">
                      <TrendingUp className="h-12 w-12 mb-2 opacity-50" />
                      <p className="text-sm">No report data</p>
                    </div>
                  )}
                </div>

                {/* Reports by Year */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="h-5 w-5 text-indigo-600" />
                    <h3 className="font-semibold text-gray-900">Reports by Year</h3>
                  </div>
                  {yearChartData.length > 0 ? (
                    <Chart dataSource={yearChartData} size={{ height: 220 }}>
                      <CommonSeriesSettings
                        argumentField="year"
                        valueField="count"
                        type="bar"
                        barWidth={40}
                        color="#6366f1"
                      />
                      <Series />
                      <ArgumentAxis>
                        <Label visible />
                      </ArgumentAxis>
                      <ValueAxis />
                      <Legend visible={false} />
                      <Tooltip enabled />
                    </Chart>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[220px] text-gray-400">
                      <Calendar className="h-12 w-12 mb-2 opacity-50" />
                      <p className="text-sm">No yearly data</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Metrics Summary */}
            <div className="space-y-6">
              {/* Average Metrics */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-semibold text-gray-900">Average Metrics</h3>
                </div>
                <div className="space-y-3">
                  <MetricIndicator
                    label="Deviation Rate"
                    value={dashboard?.averageMetrics?.deviationRate ?? null}
                    target={5}
                    icon={<AlertTriangle className="h-4 w-4" />}
                    iconColor="text-red-600"
                    bgGradient="from-red-50 to-rose-50"
                  />
                  <MetricIndicator
                    label="OOS Rate"
                    value={dashboard?.averageMetrics?.oosRate ?? null}
                    target={2}
                    icon={<FlaskConical className="h-4 w-4" />}
                    iconColor="text-amber-600"
                    bgGradient="from-amber-50 to-yellow-50"
                  />
                  <MetricIndicator
                    label="CAPA Closure"
                    value={dashboard?.averageMetrics?.capaClosureRate ?? null}
                    target={95}
                    icon={<ClipboardCheck className="h-4 w-4" />}
                    iconColor="text-blue-600"
                    bgGradient="from-blue-50 to-indigo-50"
                  />
                  <MetricIndicator
                    label="Complaint Rate"
                    value={dashboard?.averageMetrics?.complaintRate ?? null}
                    target={1}
                    icon={<Package className="h-4 w-4" />}
                    iconColor="text-purple-600"
                    bgGradient="from-purple-50 to-violet-50"
                  />
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Percent className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-semibold text-gray-900">Quick Summary</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-indigo-600" />
                      <span className="text-sm text-indigo-700">Total Reports</span>
                    </div>
                    <span className="text-lg font-bold text-indigo-700">{dashboard?.totalReports ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm text-emerald-700">Approved {currentYear}</span>
                    </div>
                    <span className="text-lg font-bold text-emerald-700">{dashboard?.approvedThisYear ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-amber-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-amber-600" />
                      <span className="text-sm text-amber-700">Pending Review</span>
                    </div>
                    <span className="text-lg font-bold text-amber-700">{dashboard?.pendingReview ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-600" />
                      <span className="text-sm text-slate-700">Draft</span>
                    </div>
                    <span className="text-lg font-bold text-slate-700">{dashboard?.byStatus?.draft ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DataGrid Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1">
            {/* Tabs Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex gap-1">
                {[
                  { key: 'all', label: 'All Reports', count: stats.total },
                  { key: 'draft', label: 'Draft', count: stats.draft },
                  { key: 'under_review', label: 'Under Review', count: stats.underReview },
                  { key: 'approved', label: 'Approved', count: stats.approved },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tab.label}
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                      activeTab === tab.key
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <FileText className="h-4 w-4" />
                <span>{filteredReports.length} reports</span>
              </div>
            </div>

            {/* DataGrid */}
            <div className="pqr-grid">
              <DataGrid
                dataSource={filteredReports}
                showBorders={false}
                showRowLines
                showColumnLines={false}
                rowAlternationEnabled
                hoverStateEnabled
                height={500}
                columnAutoWidth
                wordWrapEnabled={false}
                onExporting={handleExporting}
                onRowClick={(e) => {
                  if (e.data && e.rowType === 'data') {
                    router.push(`/gmp/pqr/${e.data.id}`);
                  }
                }}
                className="dx-card"
              >
                {/* Toolbar */}
                <Toolbar>
                  <Item name="groupPanel" />
                  <Item location="after" name="columnChooserButton" />
                  <Item location="after" name="exportButton" />
                  <Item location="after" name="searchPanel" />
                </Toolbar>

                {/* Features */}
                <SearchPanel visible placeholder="Search reports..." width={250} />
                <FilterRow visible />
                <HeaderFilter visible />
                <ColumnChooser enabled mode="select" />
                <Grouping autoExpandAll={false} />
                <GroupPanel visible />
                <Scrolling mode="virtual" />
                <Selection mode="single" />

                {/* Export */}
                <Export enabled allowExportSelectedData formats={['xlsx']} />

                {/* Paging */}
                <Paging defaultPageSize={15} />
                <Pager
                  showPageSizeSelector
                  allowedPageSizes={[10, 15, 25, 50]}
                  showInfo
                  showNavigationButtons
                  displayMode="adaptive"
                />

                {/* Columns */}
                <Column
                  dataField="reportNumber"
                  caption="Report #"
                  width={140}
                  fixed
                  cellRender={renderReportNumber}
                />
                <Column
                  caption="Product"
                  minWidth={200}
                  cellRender={renderProduct}
                  allowFiltering={false}
                />
                <Column
                  dataField="reviewYear"
                  caption="Year"
                  width={80}
                  alignment="center"
                />
                <Column
                  dataField="status"
                  caption="Status"
                  width={130}
                  cellRender={renderStatus}
                />
                <Column
                  caption="Key Metrics"
                  width={200}
                  cellRender={renderMetrics}
                  allowFiltering={false}
                  allowSorting={false}
                />
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
                  format="dd MMM yyyy"
                  width={120}
                />
                <Column
                  caption=""
                  width={80}
                  cellRender={renderActions}
                  allowFiltering={false}
                  allowSorting={false}
                  allowGrouping={false}
                  fixed
                  fixedPosition="right"
                />

                {/* Summary */}
                <Summary>
                  <TotalItem column="reportNumber" summaryType="count" displayFormat="Total: {0}" />
                </Summary>
              </DataGrid>

              <style jsx global>{`
                .pqr-grid .dx-datagrid {
                  background: transparent;
                }
                .pqr-grid .dx-datagrid-headers {
                  background: linear-gradient(to bottom, #f9fafb, #f3f4f6);
                  border-bottom: 2px solid #e5e7eb;
                }
                .pqr-grid .dx-datagrid-headers .dx-header-row > td {
                  font-weight: 600;
                  color: #374151;
                  padding: 12px 8px;
                }
                .pqr-grid .dx-datagrid-rowsview .dx-row > td {
                  padding: 10px 8px;
                  vertical-align: middle;
                }
                .pqr-grid .dx-datagrid-rowsview .dx-row:hover {
                  background-color: #eef2ff !important;
                  cursor: pointer;
                }
                .pqr-grid .dx-datagrid-rowsview .dx-row-alt > td {
                  background-color: #fafafa;
                }
                .pqr-grid .dx-datagrid-search-panel {
                  margin-left: 0;
                }
                .pqr-grid .dx-toolbar {
                  padding: 8px 12px;
                  background: #f9fafb;
                  border-bottom: 1px solid #e5e7eb;
                }
                .pqr-grid .dx-datagrid-group-panel {
                  padding: 8px;
                }
                .pqr-grid .dx-datagrid-pager {
                  padding: 12px;
                  background: #f9fafb;
                  border-top: 1px solid #e5e7eb;
                }
              `}</style>
            </div>
          </div>
        </div>
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
            <button
              onClick={() => setShowNewDialog(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateReport}
              disabled={!newReportData.productId || !newReportData.reviewYear || createMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Report
            </button>
          </div>
        </div>
      </DxPopup>
    </MainLayout>
  );
}

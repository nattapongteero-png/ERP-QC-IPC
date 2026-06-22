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
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DataGrid, {
  Column,
  Paging,
  Pager,
  SearchPanel,
  Grouping,
  GroupPanel,
  Summary,
  TotalItem,
  Toolbar,
  Item,
  Scrolling,
} from 'devextreme-react/data-grid';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxButton } from '@/components/ui/dx-button';
import { ItemSearchDialog } from '@/components/ui/item-search-dialog';
import type { Item as InventoryItem } from '@/components/ui/item-search-dialog';
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
  PackageCheck,
  ChevronRight,
  Info,
  Sparkles,
  CalendarRange,
  Hash,
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

// Translation sub-key for each PQR status (resolved via t('pqr.status.*') at call site)
const STATUS_LABEL_KEY: Record<PqrStatus, string> = {
  draft: 'draftDoc',
  under_review: 'pendingReview',
  approved: 'approved',
};

const STATUS_CONFIG: Record<PqrStatus, {
  bgColor: string;
  textColor: string;
  borderColor: string;
  chartColor: string;
  icon: React.ReactNode;
}> = {
  draft: {
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-200',
    chartColor: '#64748b',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  under_review: {
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    chartColor: '#f59e0b',
    icon: <Search className="h-3.5 w-3.5" />,
  },
  approved: {
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

type KpiTone = 'blue' | 'gray' | 'amber' | 'emerald' | 'rose' | 'violet';

const KPI_TONE_BAR: Record<KpiTone, string> = {
  blue: 'border-l-blue-500',
  gray: 'border-l-gray-500',
  amber: 'border-l-amber-500',
  emerald: 'border-l-emerald-500',
  rose: 'border-l-rose-500',
  violet: 'border-l-violet-500',
};

function MetricCard({
  value,
  label,
  tone = 'gray',
}: {
  value: number | string;
  label: string;
  tone?: KpiTone;
}) {
  return (
    <div
      className={`bg-white border border-gray-200 border-l-4 ${KPI_TONE_BAR[tone]} rounded-[14px] px-4 py-3 shadow-[0_6px_20px_rgba(6,78,59,0.06)]`}
    >
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function StatusCard({
  status,
  count,
  total,
  label,
  percentLabel,
}: {
  status: PqrStatus;
  count: number;
  total: number;
  label: string;
  percentLabel: string;
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
            <p className={`font-semibold ${config.textColor}`}>{label}</p>
            <p className="text-xs text-gray-500">{percentLabel}</p>
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
  const t = useTranslations('gmp');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
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

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createPqrReport,
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: ['pqr-list'] });
      queryClient.invalidateQueries({ queryKey: ['pqr-dashboard'] });
      setShowNewDialog(false);
      setSelectedProduct(null);
      setNewReportData({ reviewYear: new Date().getFullYear() });
      router.push(`/gmp/pqr/${report.id}`);
    },
  });

  // Handle product selection from ItemSearchDialog
  const handleProductSelect = (item: InventoryItem) => {
    setSelectedProduct(item);
    setNewReportData((prev) => ({ ...prev, productId: item.id }));
    setShowProductDialog(false);
  };

  // Close new dialog and reset state
  const handleCloseNewDialog = () => {
    setShowNewDialog(false);
    setSelectedProduct(null);
    setNewReportData({ reviewYear: new Date().getFullYear() });
  };

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
        status: t(`pqr.list.statusLabel.${STATUS_LABEL_KEY[status as PqrStatus]}`),
        count,
        color: STATUS_CONFIG[status as PqrStatus].chartColor,
      }));
  }, [dashboard, t]);

  const yearChartData = useMemo(() => {
    if (!dashboard?.byYear) return [];
    return dashboard.byYear.map((item) => ({
      year: String(item.year),
      count: item.count,
    }));
  }, [dashboard]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['pqr-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['pqr-list'] });
  };

  // Cell renderers
  const renderReportNumber = (cellData: { data: PqrReport }) => {
    return (
      <span className="font-mono font-semibold text-emerald-700">
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
        {t(`pqr.list.statusLabel.${STATUS_LABEL_KEY[status]}`)}
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
          className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
          title={t('pqr.list.viewDetails')}
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
          title={t('pqr.list.moreOptions')}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    );
  };

  // Handle create new report
  const handleCreateReport = () => {
    if (!selectedProduct || !newReportData.reviewYear) return;
    createMutation.mutate({
      ...newReportData,
      productId: selectedProduct.id,
    } as PqrCreate);
  };

  const currentYear = new Date().getFullYear();

  return (
    <>
      <div className="flex flex-col h-full gap-6 -m-4 md:-m-6">
        {/* Professional Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-500 p-6 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <FileBarChart className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{t('pqr.pageTitle')}</h1>
                <p className="text-emerald-100 text-sm">{t('pqr.description')}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors backdrop-blur-sm"
              >
                <RefreshCw className={`h-4 w-4 ${dashboardLoading ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium">{t('common.refresh')}</span>
              </button>
              <button
                onClick={() => router.push('/reports')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors backdrop-blur-sm"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="text-sm font-medium">{t('pqr.list.reports')}</span>
              </button>
              <button
                onClick={() => setShowNewDialog(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors font-medium"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm">{t('pqr.list.newPqr')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="mx-4 md:mx-6 -mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <MetricCard value={dashboard?.totalReports ?? 0} label={t('pqr.list.kpi.totalReports')} tone="blue" />
            <MetricCard value={dashboard?.byStatus?.draft ?? 0} label={t('pqr.list.kpi.draft')} tone="gray" />
            <MetricCard value={dashboard?.pendingReview ?? 0} label={t('pqr.list.kpi.pendingReview')} tone="amber" />
            <MetricCard value={dashboard?.byStatus?.approved ?? 0} label={t('pqr.list.kpi.approved')} tone="emerald" />
            <MetricCard value={dashboard?.approvedThisYear ?? 0} label={t('pqr.list.kpi.approvedThisYear', { year: currentYear })} tone="blue" />
            <MetricCard
              value={dashboard?.averageMetrics?.deviationRate != null ? `${dashboard.averageMetrics.deviationRate}%` : 'N/A'}
              label={t('pqr.list.kpi.avgDeviation')}
              tone="rose"
            />
            <MetricCard
              value={dashboard?.averageMetrics?.oosRate != null ? `${dashboard.averageMetrics.oosRate}%` : 'N/A'}
              label={t('pqr.list.kpi.avgOos')}
              tone="violet"
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
                  <Activity className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-semibold text-gray-900">{t('pqr.list.sections.reportsByStatus')}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <StatusCard status="draft" count={stats.draft} total={stats.total} label={t('pqr.list.statusLabel.draftDoc')} percentLabel={t('pqr.list.percentOfTotal', { percent: stats.total > 0 ? ((stats.draft / stats.total) * 100).toFixed(0) : '0' })} />
                  <StatusCard status="under_review" count={stats.underReview} total={stats.total} label={t('pqr.list.statusLabel.pendingReview')} percentLabel={t('pqr.list.percentOfTotal', { percent: stats.total > 0 ? ((stats.underReview / stats.total) * 100).toFixed(0) : '0' })} />
                  <StatusCard status="approved" count={stats.approved} total={stats.total} label={t('pqr.list.statusLabel.approved')} percentLabel={t('pqr.list.percentOfTotal', { percent: stats.total > 0 ? ((stats.approved / stats.total) * 100).toFixed(0) : '0' })} />
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Status Distribution */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-semibold text-gray-900">{t('pqr.list.sections.statusDistribution')}</h3>
                  </div>
                  {statusChartData.length > 0 ? (
                    <PieChart
                      dataSource={statusChartData}
                      type="doughnut"
                      innerRadius={0.65}
                      palette={statusChartData.map(d => d.color)}
                      size={{ height: 280 }}
                    >
                      <PieSeries argumentField="status" valueField="count">
                        <PieLabel visible format="fixedPoint" customizeText={(arg) => `${arg.percentText}`}>
                          <Connector visible width={1} />
                        </PieLabel>
                      </PieSeries>
                      <PieLegend
                        orientation="horizontal"
                        horizontalAlignment="center"
                        verticalAlignment="bottom"
                        itemTextPosition="right"
                        customizeText={(info: { pointName?: string; pointIndex?: number }) => {
                          const d = statusChartData[info.pointIndex ?? -1];
                          return d ? `${info.pointName} (${d.count})` : (info.pointName ?? '');
                        }}
                      />
                      <PieTooltip enabled />
                    </PieChart>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[220px] text-gray-400">
                      <TrendingUp className="h-12 w-12 mb-2 opacity-50" />
                      <p className="text-sm">{t('pqr.list.noReportData')}</p>
                    </div>
                  )}
                </div>

                {/* Reports by Year */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-semibold text-gray-900">{t('pqr.list.sections.reportsByYear')}</h3>
                  </div>
                  {yearChartData.length > 0 ? (
                    <Chart dataSource={yearChartData} size={{ height: 280 }}>
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
                      <p className="text-sm">{t('pqr.list.noYearData')}</p>
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
                  <Target className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-semibold text-gray-900">{t('pqr.list.sections.avgMetrics')}</h3>
                </div>
                <div className="space-y-3">
                  <MetricIndicator
                    label={t('pqr.list.indicators.deviationRate')}
                    value={dashboard?.averageMetrics?.deviationRate ?? null}
                    target={5}
                    icon={<AlertTriangle className="h-4 w-4" />}
                    iconColor="text-red-600"
                    bgGradient="from-red-50 to-rose-50"
                  />
                  <MetricIndicator
                    label={t('pqr.list.indicators.oosRate')}
                    value={dashboard?.averageMetrics?.oosRate ?? null}
                    target={2}
                    icon={<FlaskConical className="h-4 w-4" />}
                    iconColor="text-amber-600"
                    bgGradient="from-amber-50 to-yellow-50"
                  />
                  <MetricIndicator
                    label={t('pqr.list.indicators.capaClosure')}
                    value={dashboard?.averageMetrics?.capaClosureRate ?? null}
                    target={95}
                    icon={<ClipboardCheck className="h-4 w-4" />}
                    iconColor="text-blue-600"
                    bgGradient="from-emerald-50 to-teal-50"
                  />
                  <MetricIndicator
                    label={t('pqr.list.indicators.complaintRate')}
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
                  <Percent className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-semibold text-gray-900">{t('pqr.list.sections.quickSummary')}</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm text-emerald-700">{t('pqr.list.kpi.totalReports')}</span>
                    </div>
                    <span className="text-lg font-bold text-emerald-700">{dashboard?.totalReports ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm text-emerald-700">{t('pqr.list.approvedYear', { year: currentYear })}</span>
                    </div>
                    <span className="text-lg font-bold text-emerald-700">{dashboard?.approvedThisYear ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-amber-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-amber-600" />
                      <span className="text-sm text-amber-700">{t('pqr.list.kpi.pendingReview')}</span>
                    </div>
                    <span className="text-lg font-bold text-amber-700">{dashboard?.pendingReview ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-600" />
                      <span className="text-sm text-slate-700">{t('pqr.list.kpi.draft')}</span>
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
                  { key: 'all', label: t('pqr.list.tabs.all'), count: stats.total },
                  { key: 'draft', label: t('pqr.list.tabs.draft'), count: stats.draft },
                  { key: 'under_review', label: t('pqr.list.tabs.underReview'), count: stats.underReview },
                  { key: 'approved', label: t('pqr.list.tabs.approved'), count: stats.approved },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'bg-emerald-600 text-white'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tab.label}
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
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
                <FileText className="h-4 w-4" />
                <span>{t('pqr.list.reportCount', { count: filteredReports.length })}</span>
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
                  <Item location="after" name="searchPanel" />
                </Toolbar>

                {/* Features */}
                <SearchPanel visible placeholder={t('pqr.list.searchPlaceholder')} width={250} />
                <Grouping autoExpandAll={false} />
                <GroupPanel visible />
                <Scrolling mode="virtual" />

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
                  caption={t('pqr.list.columns.reportNumber')}
                  width={140}
                  fixed
                  cellRender={renderReportNumber}
                />
                <Column
                  caption={t('pqr.list.columns.product')}
                  minWidth={200}
                  cellRender={renderProduct}
                  allowFiltering={false}
                />
                <Column
                  dataField="reviewYear"
                  caption={t('pqr.list.columns.year')}
                  width={80}
                  alignment="center"
                />
                <Column
                  dataField="status"
                  caption={t('pqr.list.columns.status')}
                  width={130}
                  cellRender={renderStatus}
                />
                <Column
                  caption={t('pqr.list.columns.keyMetrics')}
                  width={200}
                  cellRender={renderMetrics}
                  allowFiltering={false}
                  allowSorting={false}
                />
                <Column
                  dataField="batchesProduced"
                  caption={t('pqr.list.columns.batches')}
                  width={90}
                  alignment="center"
                />
                <Column
                  dataField="approvedByName"
                  caption={t('pqr.list.columns.approvedBy')}
                  width={150}
                />
                <Column
                  dataField="createdAt"
                  caption={t('pqr.list.columns.createdAt')}
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
                  <TotalItem column="reportNumber" summaryType="count" displayFormat={t('pqr.list.summaryTotal')} />
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

      {/* New PQR Report Dialog - Professional Redesign */}
      <DxPopup
        visible={showNewDialog}
        onHiding={handleCloseNewDialog}
        title=""
        showCloseButton
        showTitle={false}
        width={680}
        height="auto"
      >
        <div className="flex flex-col">
          {/* Professional Header */}
          <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 px-6 py-5 text-white">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <FileBarChart className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{t('pqr.list.dialog.title')}</h2>
                <p className="text-emerald-100 text-sm">{t('pqr.list.dialog.subtitle')}</p>
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-6 space-y-6">
            {/* Product Selection Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-emerald-600" />
                <label className="text-sm font-semibold text-gray-800">{t('pqr.list.dialog.selectProduct')}</label>
              </div>

              {selectedProduct ? (
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <PackageCheck className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-bold text-emerald-800">{selectedProduct.code}</p>
                      <p className="text-sm text-emerald-600">{selectedProduct.nameTh}</p>
                      {selectedProduct.nameEn && (
                        <p className="text-xs text-emerald-500">{selectedProduct.nameEn}</p>
                      )}
                    </div>
                  </div>
                  <DxButton
                    text={t('pqr.list.dialog.change')}
                    type="normal"
                    stylingMode="outlined"
                    icon="edit"
                    onClick={() => setShowProductDialog(true)}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowProductDialog(true)}
                  className="w-full flex items-center justify-between p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 transition-all group"
                >
                  <div className="flex items-center gap-3 text-gray-500 group-hover:text-emerald-600">
                    <div className="p-2 bg-gray-100 group-hover:bg-emerald-100 rounded-lg transition-colors">
                      <Package className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <span className="block font-medium">{t('pqr.list.dialog.clickToSelect')}</span>
                      <span className="text-xs text-gray-400 group-hover:text-emerald-400">{t('pqr.list.dialog.finishedGoodsOnly')}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-emerald-500" />
                </button>
              )}
            </div>

            {/* Review Year Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-emerald-600" />
                <label className="text-sm font-semibold text-gray-800">{t('pqr.list.dialog.reviewYear')}</label>
              </div>
              <div className="max-w-[200px]">
                <DxNumberBox
                  value={newReportData.reviewYear}
                  onValueChange={(value) => setNewReportData((prev) => ({ ...prev, reviewYear: value ?? undefined }))}
                  min={2020}
                  max={currentYear + 1}
                  showSpinButtons
                  height={42}
                />
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Info className="h-3.5 w-3.5" />
                {t('pqr.list.dialog.reviewYearHint')}
              </p>
            </div>

            {/* Review Period Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CalendarRange className="h-5 w-5 text-emerald-600" />
                <label className="text-sm font-semibold text-gray-800">{t('pqr.list.dialog.reviewPeriod')}</label>
                <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-100 rounded">{t('pqr.list.dialog.optional')}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500">{t('pqr.list.dialog.startDate')}</label>
                  <DxDateBox
                    value={newReportData.periodStart || ''}
                    onValueChange={(value) => setNewReportData((prev) => ({ ...prev, periodStart: value }))}
                    placeholder={t('pqr.list.dialog.startDatePlaceholder')}
                    showClearButton
                    height={42}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500">{t('pqr.list.dialog.endDate')}</label>
                  <DxDateBox
                    value={newReportData.periodEnd || ''}
                    onValueChange={(value) => setNewReportData((prev) => ({ ...prev, periodEnd: value }))}
                    placeholder={t('pqr.list.dialog.endDatePlaceholder')}
                    showClearButton
                    height={42}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Info className="h-3.5 w-3.5" />
                {t('pqr.list.dialog.reviewPeriodHint')}
              </p>
            </div>

            {/* Info Box */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-blue-800">{t('pqr.list.dialog.autoCollectTitle')}</p>
                  <ul className="text-sm text-blue-600 space-y-0.5">
                    <li>• {t('pqr.list.dialog.autoCollect.batches')}</li>
                    <li>• {t('pqr.list.dialog.autoCollect.deviations')}</li>
                    <li>• {t('pqr.list.dialog.autoCollect.quality')}</li>
                    <li>• {t('pqr.list.dialog.autoCollect.recall')}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              <span className="text-red-500">*</span> {t('pqr.list.dialog.requiredNote')}
            </p>
            <div className="flex items-center gap-3">
              <DxButton
                text={t('common.cancel')}
                type="normal"
                stylingMode="outlined"
                onClick={handleCloseNewDialog}
              />
              <DxButton
                text={createMutation.isPending ? t('pqr.list.dialog.creating') : t('pqr.list.dialog.create')}
                type="success"
                icon="check"
                onClick={handleCreateReport}
                disabled={!selectedProduct || !newReportData.reviewYear || createMutation.isPending}
              />
            </div>
          </div>
        </div>
      </DxPopup>

      {/* Item Search Dialog for Product Selection */}
      <ItemSearchDialog
        open={showProductDialog}
        onOpenChange={setShowProductDialog}
        onSelect={handleProductSelect}
        title={t('pqr.list.dialog.itemSearchTitle')}
        filterType="finished_goods"
        showPrice="none"
        showStock={false}
      />
    </>
  );
}

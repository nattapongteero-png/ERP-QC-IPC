'use client';

/**
 * Complaints Dashboard Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Responsive + informative dashboard for viewing and managing customer complaints.
 * Uses shared ResponsivePageHeader, StatCard, scroll-snap tabs,
 * mobile card view, empty/no-results/skeleton states.
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ComplaintDataEntryDialog } from '@/components/complaints';
import { DxButton } from '@/components/ui/dx-button';
import { DxDataGrid, type DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
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
  MessageSquare,
  MessageSquareWarning,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  BarChart3,
  Package,
  Calendar,
  Activity,
  FileWarning,
  Search,
  SearchX,
  User,
  Eye,
  ChevronRight,
} from 'lucide-react';
import type {
  Complaint,
  ComplaintStatus,
  ComplaintCategory,
  ComplaintSeverity,
  ComplaintTrends,
} from '@/types/complaints';

// ============================================
// Types
// ============================================

interface ComplaintDashboard {
  totalOpen: number;
  byStatus: Record<ComplaintStatus, number>;
  bySeverity: Record<ComplaintSeverity, number>;
  pendingInvestigation: number;
  resolvedThisMonth: number;
  criticalCount: number;
}

type StatusTab = 'all' | ComplaintStatus;

// ============================================
// Constants
// ============================================

const STATUS_COLORS: Record<ComplaintStatus, string> = {
  received: '#3b82f6',
  under_investigation: '#f59e0b',
  resolved: '#22c55e',
  closed: '#6b7280',
};

// Translation-key map (not display strings) — display strings come from
// t() at render time so the badge/chart/tabs follow the active locale.
const STATUS_TRANSLATION_KEYS: Record<ComplaintStatus, string> = {
  received: 'received',
  under_investigation: 'under_investigation',
  resolved: 'resolved',
  closed: 'closed',
};

const STATUS_TAB_STYLES: Record<StatusTab, { bgActive: string; color: string }> = {
  all: { bgActive: 'bg-gray-900', color: 'text-white' },
  received: { bgActive: 'bg-blue-600', color: 'text-white' },
  under_investigation: { bgActive: 'bg-amber-500', color: 'text-white' },
  resolved: { bgActive: 'bg-emerald-600', color: 'text-white' },
  closed: { bgActive: 'bg-gray-600', color: 'text-white' },
};

const SEVERITY_COLORS: Record<ComplaintSeverity, string> = {
  minor: '#22c55e',
  major: '#f59e0b',
  critical: '#ef4444',
};

const SEVERITY_BADGE_VARIANT: Record<ComplaintSeverity, 'success' | 'warning' | 'danger'> = {
  minor: 'success',
  major: 'warning',
  critical: 'danger',
};

const STATUS_BADGE_VARIANT: Record<ComplaintStatus, 'info' | 'warning' | 'success' | 'default'> = {
  received: 'info',
  under_investigation: 'warning',
  resolved: 'success',
  closed: 'default',
};

const CATEGORY_COLORS: Record<ComplaintCategory, string> = {
  quality: '#3b82f6',
  efficacy: '#22c55e',
  safety: '#ef4444',
  packaging: '#f59e0b',
  labeling: '#8b5cf6',
  other: '#6b7280',
};

// Translation-key map for complaint categories — display strings come from t()
const CATEGORY_TRANSLATION_KEYS: Record<ComplaintCategory, string> = {
  quality: 'quality',
  efficacy: 'efficacy',
  safety: 'safety',
  packaging: 'packaging',
  labeling: 'labeling',
  other: 'other',
};

// ============================================
// API Functions
// ============================================

async function fetchDashboard(): Promise<ComplaintDashboard> {
  const response = await fetch('/api/complaints/dashboard');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch dashboard');
  }
  return result.data;
}

async function fetchTrends(): Promise<ComplaintTrends> {
  const response = await fetch('/api/complaints/trends?period=month');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch trends');
  }
  return result.data;
}

async function fetchComplaints(): Promise<Complaint[]> {
  const params = new URLSearchParams();
  params.set('limit', '1000');
  const response = await fetch(`/api/complaints?${params.toString()}`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch complaints');
  }
  return result.data?.complaints || result.data?.items || [];
}

// ============================================
// Helper Functions
// ============================================

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '-';
  }
};

// ============================================
// Component
// ============================================

export default function ComplaintsListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations('gmp');
  // Force DataGrid remount on locale switch.
  const locale = useLocale();
  const { isMobile } = useMobile();
  const [statusFilter, setStatusFilter] = useState<StatusTab>('all');
  const [search, setSearch] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);

  // Fetch dashboard statistics
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['complaints-dashboard'],
    queryFn: fetchDashboard,
  });

  // Fetch trends
  const { data: trends } = useQuery({
    queryKey: ['complaint-trends', 'month'],
    queryFn: fetchTrends,
  });

  // Fetch all complaints (filter client-side)
  const { data: complaints = [], isLoading: listLoading } = useQuery<Complaint[]>({
    queryKey: ['complaints-all'],
    queryFn: fetchComplaints,
  });

  // Prepare chart data
  const severityChartData = useMemo(() => {
    if (!dashboard?.bySeverity) return [];
    return Object.entries(dashboard.bySeverity)
      .filter(([, count]) => count > 0)
      .map(([severity, count]) => ({
        severity,
        label: t(`complaints.severity.${severity}`),
        value: count,
        color: SEVERITY_COLORS[severity as ComplaintSeverity],
      }));
  }, [dashboard, t]);

  const statusChartData = useMemo(() => {
    if (!dashboard?.byStatus) return [];
    return Object.entries(dashboard.byStatus)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        status,
        label: t(`complaints.status.${STATUS_TRANSLATION_KEYS[status as ComplaintStatus]}`),
        value: count,
        color: STATUS_COLORS[status as ComplaintStatus],
      }));
  }, [dashboard, t]);

  const categoryChartData = useMemo(() => {
    if (!trends?.byCategory) return [];
    return Object.entries(trends.byCategory)
      .filter(([, count]) => count > 0)
      .map(([category, count]) => ({
        category,
        label: t(`complaints.categories.${CATEGORY_TRANSLATION_KEYS[category as ComplaintCategory]}`),
        value: count,
        color: CATEGORY_COLORS[category as ComplaintCategory],
      }));
  }, [trends, t]);

  const timelineChartData = useMemo(() => {
    if (!trends?.dataPoints) return [];
    return trends.dataPoints.map((dp) => ({
      period: dp.label,
      count: dp.count,
    }));
  }, [trends]);

  // Per-tab counts — independent of search filter
  const statusCounts = useMemo(() => {
    const counts: Record<StatusTab, number> = {
      all: complaints.length,
      received: 0,
      under_investigation: 0,
      resolved: 0,
      closed: 0,
    };
    complaints.forEach((c) => {
      if (c.status in counts) counts[c.status]++;
    });
    return counts;
  }, [complaints]);

  // Filter complaints based on tab + search
  const filteredComplaints = useMemo(() => {
    let result = complaints;
    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        (c.complaintNumber || '').toLowerCase().includes(q) ||
        (c.customerName || '').toLowerCase().includes(q) ||
        (c.productName || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q),
      );
    }
    return result.map((item, index) => ({ ...item, _rowNumber: index + 1 }));
  }, [complaints, statusFilter, search]);

  // Calculate totals (keeps same semantics as before)
  const totalAll = dashboard
    ? Object.values(dashboard.byStatus).reduce((a, b) => a + b, 0)
    : 0;

  // Handlers
  const handleComplaintSelect = useCallback((complaint: Complaint) => {
    router.push(`/gmp/complaints/${complaint.id}`);
  }, [router]);

  const handleNewComplaint = useCallback(() => {
    setShowNewDialog(true);
  }, []);

  const handleComplaintSaved = useCallback((complaint: Complaint) => {
    setShowNewDialog(false);
    queryClient.invalidateQueries({ queryKey: ['complaints-all'] });
    queryClient.invalidateQueries({ queryKey: ['complaints-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['complaint-trends', 'month'] });
    router.push(`/gmp/complaints/${complaint.id}`);
  }, [queryClient, router]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['complaints-all'] });
    queryClient.invalidateQueries({ queryKey: ['complaints-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['complaint-trends', 'month'] });
  }, [queryClient]);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('all');
  }, []);

  // Desktop DataGrid columns
  const columns: DxDataGridColumn[] = useMemo(() => [
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
      dataField: 'complaintNumber',
      caption: t('complaints.columns.complaintNumber'),
      width: 150,
      cellRender: (cell) => (
        <span className="font-mono font-semibold text-fuchsia-600">{cell.value}</span>
      ),
    },
    {
      dataField: 'description',
      caption: t('complaints.columns.subject'),
      minWidth: 220,
      cellRender: (cell) => {
        const c = cell.data as Complaint;
        return (
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">
              {c.description || '-'}
            </p>
            {c.productName && (
              <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
                <Package className="h-3 w-3" />
                {c.productName}
              </p>
            )}
          </div>
        );
      },
    },
    {
      dataField: 'customerName',
      caption: t('complaints.columns.customer'),
      width: 160,
      hideOnMobile: true,
      cellRender: (cell) => {
        const c = cell.data as Complaint;
        return c.customerName ? (
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-sm text-gray-700 truncate">{c.customerName}</span>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        );
      },
    },
    {
      dataField: 'category',
      caption: t('complaints.columns.category'),
      width: 120,
      hideOnMobile: true,
      cellRender: (cell) => {
        const cat = cell.value as ComplaintCategory;
        const key = CATEGORY_TRANSLATION_KEYS[cat];
        return <Badge variant="info">{key ? t(`complaints.categories.${key}`) : cell.value}</Badge>;
      },
    },
    {
      dataField: 'severity',
      caption: t('complaints.columns.severity'),
      width: 110,
      cellRender: (cell) => {
        const sev = cell.value as ComplaintSeverity;
        return (
          <Badge variant={SEVERITY_BADGE_VARIANT[sev] || 'default'}>
            {t(`complaints.severity.${sev}`)}
          </Badge>
        );
      },
    },
    {
      dataField: 'status',
      caption: t('complaints.table.columns.status'),
      width: 140,
      cellRender: (cell) => {
        const st = cell.value as ComplaintStatus;
        return (
          <Badge variant={STATUS_BADGE_VARIANT[st] || 'default'} dot>
            {STATUS_TRANSLATION_KEYS[st]
              ? t(`complaints.status.${STATUS_TRANSLATION_KEYS[st]}`)
              : st}
          </Badge>
        );
      },
    },
    {
      dataField: 'receivedDate',
      caption: t('complaints.columns.received'),
      width: 130,
      dataType: 'date',
      hideOnMobile: true,
      cellRender: (cell) => (
        <span className="text-sm text-gray-600">{formatDate(cell.value)}</span>
      ),
    },
  ], [t]);

  const showEmptyState = !listLoading && complaints.length === 0;
  const showNoResultsState = !listLoading && complaints.length > 0 && filteredComplaints.length === 0;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title={t('complaints.pageTitle')}
        subtitle={t('complaints.description')}
        icon={MessageSquare}
        iconBgColor="bg-fuchsia-100"
        iconColor="text-fuchsia-600"
        breadcrumbs={[
          { label: 'GMP', href: '/gmp' },
          { label: t('complaints.title') },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              text={t('complaints.actions.refresh')}
              stylingMode="outlined"
              onClick={handleRefresh}
              className="hidden sm:inline-flex"
            />
            <DxButton
              icon="plus"
              text={t('complaints.actions.newComplaint')}
              type="success"
              onClick={handleNewComplaint}
            />
          </div>
        }
      />

      {/* KPI Stat Cards — 4 cards (responsive 2/2 on mobile, 4 on desktop) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('complaints.stats.totalOpen')}
          value={dashboard?.totalOpen ?? 0}
          icon={MessageSquareWarning}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('complaints.stats.investigating')}
          value={dashboard?.pendingInvestigation ?? 0}
          icon={Search}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('complaints.stats.critical')}
          value={dashboard?.criticalCount ?? 0}
          icon={AlertTriangle}
          iconColor="text-red-500"
          accentColor="border-red-500"
          trend={(dashboard?.criticalCount ?? 0) > 0 ? { value: String(dashboard?.criticalCount ?? 0), direction: 'down' } : undefined}
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('complaints.stats.resolved')}
          value={dashboard?.byStatus?.resolved ?? 0}
          icon={CheckCircle}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={dashboardLoading}
        />
      </div>

      {/* Critical Alert */}
      {(dashboard?.criticalCount ?? 0) > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start sm:items-center gap-3 flex-col sm:flex-row">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-red-800 text-sm">
                  {t(
                    (dashboard?.criticalCount ?? 0) === 1
                      ? 'complaints.alerts.criticalCountSingle'
                      : 'complaints.alerts.criticalCountMany',
                    { count: dashboard?.criticalCount ?? 0 }
                  )}
                </p>
                <p className="text-xs text-red-600 mt-0.5">
                  {t('complaints.alerts.criticalSubtitle')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section — hidden on mobile to prioritize the list */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Severity Pie Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              {t('complaints.charts.bySeverity')}
            </h3>
          </div>
          {severityChartData.length > 0 ? (
            <PieChart
              key={locale}
              id="severity-pie"
              dataSource={severityChartData}
              type="doughnut"
              innerRadius={0.65}
              palette={severityChartData.map((d) => d.color)}
              size={{ height: 260 }}
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
                itemTextPosition="right"
                font={{ size: 11 }}
                customizeText={(info: { pointName?: string; pointIndex?: number }) => {
                  const d = severityChartData[info.pointIndex ?? -1];
                  return d ? `${info.pointName} (${d.value})` : (info.pointName ?? '');
                }}
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
                <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('complaints.charts.noData')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Status Pie Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              {t('complaints.charts.byStatus')}
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
              size={{ height: 260 }}
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
                itemTextPosition="right"
                font={{ size: 11 }}
                customizeText={(info: { pointName?: string; pointIndex?: number }) => {
                  const d = statusChartData[info.pointIndex ?? -1];
                  return d ? `${info.pointName} (${d.value})` : (info.pointName ?? '');
                }}
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
                <p className="text-sm">{t('complaints.charts.noData')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-purple-500" />
              {t('complaints.charts.byCategory')}
            </h3>
          </div>
          {categoryChartData.length > 0 ? (
            <PieChart
              key={locale}
              id="category-pie"
              dataSource={categoryChartData}
              type="doughnut"
              innerRadius={0.65}
              palette={categoryChartData.map((d) => d.color)}
              size={{ height: 260 }}
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
                itemTextPosition="right"
                font={{ size: 11 }}
                customizeText={(info: { pointName?: string; pointIndex?: number }) => {
                  const d = categoryChartData[info.pointIndex ?? -1];
                  return d ? `${info.pointName} (${d.value})` : (info.pointName ?? '');
                }}
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
                <FileWarning className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('complaints.charts.noData')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Summary Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              {t('complaints.charts.quickSummary')}
            </h3>
          </div>
          <div className="space-y-3">
            {/* Total Complaints */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                  <MessageSquareWarning className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">{t('complaints.summary.totalComplaints')}</p>
                  <p className="text-sm font-medium text-gray-900">{t('complaints.summary.allRecords')}</p>
                </div>
              </div>
              <span className="text-xl font-bold text-blue-600 shrink-0">{totalAll}</span>
            </div>

            {/* Minor */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-green-100 rounded-lg shrink-0">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">{t('complaints.summary.minorSeverity')}</p>
                  <p className="text-sm font-medium text-gray-900">{t('complaints.summary.lowRisk')}</p>
                </div>
              </div>
              <span className="text-xl font-bold text-green-600 shrink-0">
                {dashboard?.bySeverity?.minor ?? 0}
              </span>
            </div>

            {/* Major */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">{t('complaints.summary.majorSeverity')}</p>
                  <p className="text-sm font-medium text-gray-900">{t('complaints.summary.mediumRisk')}</p>
                </div>
              </div>
              <span className="text-xl font-bold text-amber-600 shrink-0">
                {dashboard?.bySeverity?.major ?? 0}
              </span>
            </div>

            {/* Critical */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-red-50 to-rose-50 rounded-lg border border-red-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-red-100 rounded-lg shrink-0">
                  <XCircle className="h-4 w-4 text-red-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">{t('complaints.summary.criticalSeverity')}</p>
                  <p className="text-sm font-medium text-gray-900">{t('complaints.summary.highRisk')}</p>
                </div>
              </div>
              <span className="text-xl font-bold text-red-600 shrink-0">
                {dashboard?.bySeverity?.critical ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Chart — hidden on mobile */}
      {timelineChartData.length > 0 && (
        <div className="hidden lg:block bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              {t('complaints.charts.monthlyTrend')}
            </h3>
            <span className="text-sm text-gray-500">{trends?.period}</span>
          </div>
          <Chart
            key={locale}
            id="timeline-chart"
            dataSource={timelineChartData}
            size={{ height: 180 }}
          >
            <CommonSeriesSettings argumentField="period" type="bar" color="#6366f1" />
            <ChartSeries valueField="count" name={t('complaints.charts.complaintsLegend')} color="#6366f1" />
            <ArgumentAxis>
              <ChartLabel overlappingBehavior="rotate" rotationAngle={-45} />
            </ArgumentAxis>
            <ValueAxis />
            <ChartLegend visible={false} />
            <ChartTooltip
              enabled={true}
              customizeTooltip={(arg: { argumentText?: string; valueText?: string }) => ({
                text: `${arg.argumentText}: ${arg.valueText} ${t('complaints.charts.tooltipComplaintsSuffix')}`,
              })}
            />
          </Chart>
        </div>
      )}

      {/* Main Content — Tabs + Search + List/Grid */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Filter Header: Status Tabs (scroll-snap on mobile) */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
          <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-thin snap-x">
            {(Object.keys(STATUS_TAB_STYLES) as StatusTab[]).map((tab) => {
              const isActive = statusFilter === tab;
              const styles = STATUS_TAB_STYLES[tab];
              const count = statusCounts[tab];
              const label =
                tab === 'all'
                  ? t('complaints.status.all')
                  : t(`complaints.status.${STATUS_TRANSLATION_KEYS[tab as ComplaintStatus]}`);
              return (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 snap-start min-h-[36px]',
                    isActive
                      ? `${styles.bgActive} ${styles.color} shadow-sm`
                      : 'text-gray-600 hover:bg-gray-100',
                  )}
                >
                  <span>{label}</span>
                  <span className={cn(
                    'ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold',
                    isActive ? 'bg-white/25 text-inherit' : 'bg-gray-200 text-gray-700',
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search + count row */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="w-full sm:max-w-md">
            <DxTextBox
              placeholder={t('complaints.search.placeholder')}
              value={search}
              onValueChange={setSearch}
              showClearButton
              mode="search"
            />
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
            <MessageSquareWarning className="h-4 w-4 text-gray-400" />
            <span>{filteredComplaints.length} / {complaints.length}</span>
          </div>
        </div>

        {/* Content: Loading / Empty / No Results / Mobile Cards / Desktop Grid */}
        {listLoading ? (
          isMobile ? (
            <ComplaintCardSkeletonList count={4} />
          ) : (
            <DataGridLoadingSkeleton />
          )
        ) : showEmptyState ? (
          <EmptyState onCreate={handleNewComplaint} t={t} />
        ) : showNoResultsState ? (
          <NoResultsState onClear={handleClearFilters} t={t} />
        ) : isMobile ? (
          <ComplaintCardList
            complaints={filteredComplaints}
            onSelect={handleComplaintSelect}
            t={t}
          />
        ) : (
          <DxDataGrid
            key={locale}
            dataSource={filteredComplaints}
            keyExpr="id"
            columns={columns}
            sorting
            responsiveColumns
            virtualScrolling={filteredComplaints.length > 100}
            height={600}
            mobileHeight={520}
            tabletHeight={560}
            noDataText={t('complaints.noDataText')}
            onRowClick={(e) => {
              const data = e.data as Complaint | undefined;
              if (data?.id) {
                router.push(`/gmp/complaints/${data.id}`);
              }
            }}
          />
        )}
      </div>

      {/* Top Products with Complaints — hidden on mobile */}
      {trends?.byProduct && trends.byProduct.length > 0 && (
        <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-500" />
              {t('complaints.charts.productsWithMostComplaints')}
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {trends.byProduct.slice(0, 5).map((product, index) => (
              <div
                key={product.productId}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${
                    index === 0
                      ? 'bg-red-500'
                      : index === 1
                      ? 'bg-orange-500'
                      : index === 2
                      ? 'bg-amber-500'
                      : 'bg-gray-400'
                  }`}
                >
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {product.productName}
                  </p>
                  <p className="text-xs text-gray-500">{product.count} {t('complaints.charts.complaintsCountSuffix')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Complaint Dialog */}
      <ComplaintDataEntryDialog
        visible={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        onSaved={handleComplaintSaved}
        mode="create"
      />
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

/** Mobile Card List — replaces DataGrid on mobile viewports.
 * Each card prioritizes: complaint # + subject + customer + severity + status + date.
 */
function ComplaintCardList({
  complaints,
  onSelect,
  t,
}: {
  complaints: Complaint[];
  onSelect: (c: Complaint) => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {complaints.map((c) => {
        const severity = c.severity;
        const status = c.status;
        const severityColor =
          severity === 'critical' ? 'border-l-red-500' :
          severity === 'major' ? 'border-l-amber-500' :
          'border-l-emerald-500';
        return (
          <div
            key={c.id}
            className={cn(
              'bg-white border border-gray-200 border-l-4 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all',
              severityColor,
            )}
          >
            {/* Card body */}
            <button
              type="button"
              onClick={() => onSelect(c)}
              className="w-full text-left p-4 flex items-start gap-3"
            >
              <div className="h-11 w-11 rounded-xl bg-fuchsia-100 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-5 w-5 text-fuchsia-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-gray-900 text-base truncate">
                      {c.complaintNumber}
                    </p>
                    {c.description && (
                      <p className="text-sm text-gray-700 truncate mt-0.5" title={c.description}>
                        {c.description}
                      </p>
                    )}
                  </div>
                  <Badge variant={STATUS_BADGE_VARIANT[status] || 'default'} size="sm" dot>
                    {STATUS_TRANSLATION_KEYS[status]
                      ? t(`complaints.status.${STATUS_TRANSLATION_KEYS[status]}`)
                      : status}
                  </Badge>
                </div>

                {/* Customer */}
                {c.customerName && (
                  <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                    <User className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                    <span className="truncate">{c.customerName}</span>
                  </p>
                )}

                {/* Product */}
                {c.productName && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <Package className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                    <span className="truncate">{c.productName}</span>
                    {c.lotNumber && (
                      <span className="text-gray-400">• {t('complaints.lotPrefix')} {c.lotNumber}</span>
                    )}
                  </p>
                )}

                {/* Tags row */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge variant={SEVERITY_BADGE_VARIANT[severity] || 'default'} size="sm">
                    {t(`complaints.severity.${severity}`)}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                    {CATEGORY_TRANSLATION_KEYS[c.category]
                      ? t(`complaints.categories.${CATEGORY_TRANSLATION_KEYS[c.category]}`)
                      : c.category}
                  </span>
                  {c.receivedDate && (
                    <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                      <Calendar className="h-3 w-3" />
                      {formatDate(c.receivedDate)}
                    </span>
                  )}
                  {c.regulatoryReportRequired && (
                    <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded">
                      <AlertTriangle className="h-3 w-3" />
                      {t('complaints.regulatoryTag')}
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Card footer: tap zone (44px+ touch-target) */}
            <button
              type="button"
              onClick={() => onSelect(c)}
              className="w-full flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 border-t border-gray-100 hover:bg-fuchsia-50 hover:text-fuchsia-700 active:bg-fuchsia-100 transition-colors min-h-[44px]"
            >
              <Eye className="h-4 w-4" />
              <span>{t('complaints.viewDetails')}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Loading skeleton for mobile card list */
function ComplaintCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 bg-gray-200 rounded" />
              <div className="h-3 w-2/3 bg-gray-200 rounded" />
              <div className="h-3 w-1/3 bg-gray-200 rounded" />
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
        <div key={i} className="flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-lg animate-pulse">
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

/** Empty State — shown when there are zero complaints at all */
function EmptyState({
  onCreate,
  t,
}: {
  onCreate: () => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-fuchsia-100 flex items-center justify-center mb-5">
        <MessageSquare className="h-10 w-10 text-fuchsia-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('complaints.empty.title')}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {t('complaints.empty.description')}
      </p>
      <DxButton
        text={t('complaints.actions.newComplaint')}
        icon="plus"
        type="success"
        onClick={onCreate}
      />
    </div>
  );
}

/** No Results State — shown when filter/search yields zero results */
function NoResultsState({
  onClear,
  t,
}: {
  onClear: () => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {t('complaints.noResults.title')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {t('complaints.noResults.description')}
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

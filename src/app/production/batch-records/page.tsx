'use client';

/**
 * Batch Records (eBMR) Dashboard Page
 * Feature: Production Management
 *
 * Shows Work Orders that have execution data (SOP, Cleaning, Environmental, Finished Inspection).
 * Each row = 1 Work Order with execution progress summary.
 *
 * Responsive: ResponsivePageHeader, StatCard KPI row, mobile card view,
 * empty state, no-results state, loading skeletons.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
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
  Search,
  SearchX,
  Package,
  Eye,
} from 'lucide-react';
import type { BatchRecordsDashboard } from '@/app/api/production/batch-records/dashboard/route';

// Status config: style-only. Labels come from translations at render time
// via t(`batchRecords.status.${key}`) so locale switches update them.
const statusConfig = {
  pending: { color: 'bg-gray-100 text-gray-700', borderColor: 'border-gray-400' },
  in_progress: { color: 'bg-blue-100 text-blue-800', borderColor: 'border-blue-500' },
  completed: { color: 'bg-green-100 text-green-800', borderColor: 'border-green-500' },
  deviation: { color: 'bg-red-100 text-red-800', borderColor: 'border-red-500' },
} as const;

type StatusKey = keyof typeof statusConfig;

// Chart color palette - production/manufacturing theme
const chartColors = ['#6B7280', '#3B82F6', '#10B981', '#EF4444'];

interface BatchRecordRow {
  id: number;
  workOrderId: number;
  woNumber: string;
  batchNumber: string;
  productCode: string;
  productName: string;
  status: string;
  woStatus: string;
  plannedQuantity: number;
  actualQuantity: number | null;
  unit: string;
  sopSteps: number;
  sopVerified: number;
  cleaningLogs: number;
  environmentalLogs: number;
  finishedInspection: number;
  totalExecutionRecords: number;
  startTime: string | null;
  endTime: string | null;
}

export default function BatchRecordsDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations('production');
  const locale = useLocale();
  const { isMobile } = useMobile();

  // Status filter options rebuilt each render to follow locale.
  const statusFilters = useMemo(
    () => [
      { value: '', label: t('batchRecords.statusFilters.all') },
      { value: 'pending', label: t('batchRecords.statusFilters.pending') },
      { value: 'in_progress', label: t('batchRecords.statusFilters.inProgress') },
      { value: 'completed', label: t('batchRecords.statusFilters.completed') },
    ],
    [t],
  );
  const [statusFilter, setStatusFilter] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [searchText, setSearchText] = useState('');

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

  // Fetch batch records list (WOs with execution data)
  const { data: recordsData, isLoading: recordsLoading } = useQuery<BatchRecordRow[]>({
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

  // Prepare chart data — legend labels translated from DB keys.
  const statusChartData = dashboard
    ? Object.entries(dashboard.byStatus)
        .filter(([, value]) => value > 0)
        .map(([status, count]) => ({
          status: statusConfig[status as keyof typeof statusConfig]
            ? t(`batchRecords.status.${status}`)
            : status,
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
        {t(`batchRecords.status.${status}`)}
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

  // Apply tab + text search on top of API-level status filter; tag rows with
  // display row number (mirrors /inventory/items).
  const filteredRecords = useMemo(() => {
    let result: BatchRecordRow[] = recordsData || [];
    if (activeTab !== 'all') {
      result = result.filter((r) => r.status === activeTab);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter((r) =>
        (r.woNumber || '').toLowerCase().includes(q) ||
        (r.batchNumber || '').toLowerCase().includes(q) ||
        (r.productCode || '').toLowerCase().includes(q) ||
        (r.productName || '').toLowerCase().includes(q)
      );
    }
    return result.map((r, index) => ({ ...r, _rowNumber: index + 1 }));
  }, [recordsData, activeTab, searchText]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['batch-records-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['batch-records-list'] });
  };

  // This is the eBMR (batch records) menu, so open the work order straight on
  // its eBMR tab — not the generic overview.
  const handleView = (id: number) => router.push(`/production/work-orders/${id}?tab=ebmr`);

  const handleClearFilters = () => {
    setSearchText('');
    setActiveTab('all');
    setStatusFilter('');
  };

  // Tab counts
  const totalCount = recordsData?.length || 0;
  const inProgressTabCount = recordsData?.filter((r) => r.status === 'in_progress').length || 0;
  const pendingTabCount = recordsData?.filter((r) => r.status === 'pending').length || 0;
  const completedTabCount = recordsData?.filter((r) => r.status === 'completed').length || 0;

  const showEmptyState = !recordsLoading && totalCount === 0;
  const showNoResultsState = !recordsLoading && totalCount > 0 && filteredRecords.length === 0;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title={t('batchRecords.title')}
        subtitle={t('batchRecords.subtitle')}
        icon={ClipboardCheck}
        iconBgColor="bg-cyan-100"
        iconColor="text-cyan-600"
        breadcrumbs={[
          { label: t('breadcrumbs.production'), href: '/production' },
          { label: t('batchRecords.title') },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              text={t('batchRecords.actions.refresh')}
              stylingMode="outlined"
              onClick={handleRefresh}
              className="hidden sm:inline-flex"
            />
            <DxButton
              icon="chart"
              text={t('batchRecords.actions.workOrders')}
              stylingMode="outlined"
              onClick={() => router.push('/production/work-orders')}
              className="hidden md:inline-flex"
            />
          </div>
        }
      />

      {/* KPI Stat Cards - 4 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('batchRecords.stats.total')}
          value={dashboard?.totalRecords ?? 0}
          icon={FileText}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('batchRecords.stats.inProgress')}
          value={dashboard?.inProgressRecords ?? 0}
          icon={PlayCircle}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('batchRecords.stats.completed')}
          value={dashboard?.completedRecords ?? 0}
          icon={CheckCircle2}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('batchRecords.stats.deviations')}
          value={dashboard?.deviationRecords ?? 0}
          icon={AlertTriangle}
          iconColor="text-red-500"
          accentColor="border-red-500"
          isLoading={dashboardLoading}
        />
      </div>

      {/* Secondary Stats Row - visible on large screens only */}
      <div className="hidden xl:grid grid-cols-3 gap-3 md:gap-4">
        <StatCard
          label={t('batchRecords.stats.completedToday')}
          value={dashboard?.completedToday ?? 0}
          icon={Timer}
          iconColor="text-purple-500"
          accentColor="border-purple-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('batchRecords.stats.pending')}
          value={dashboard?.pendingRecords ?? 0}
          icon={Clock}
          iconColor="text-gray-500"
          accentColor="border-gray-400"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('batchRecords.stats.avgCompletionTime')}
          value={dashboard?.avgCompletionTime ? `${dashboard.avgCompletionTime}${t('batchRecords.stats.minSuffix')}` : '-'}
          icon={Timer}
          iconColor="text-cyan-500"
          accentColor="border-cyan-500"
          isLoading={dashboardLoading}
        />
      </div>

      {/* Charts Section - hidden on small screens to prioritize the list */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Status Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Activity className="h-5 w-5 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-gray-900">{t('batchRecords.charts.statusDistribution')}</h3>
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
                <p>{t('batchRecords.charts.noRecords')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Weekly Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-green-50 rounded-lg">
              <Activity className="h-5 w-5 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900">{t('batchRecords.charts.weeklyActivity')}</h3>
          </div>
          {activityChartData.length > 0 ? (
            <Chart dataSource={activityChartData} size={{ height: 260 }}>
              <CommonSeriesSettings argumentField="date" type="bar" />
              <ArgumentAxis />
              <ValueAxis />
              <ChartSeries
                valueField="completed"
                name={t('batchRecords.charts.completed')}
                color="#10B981"
              />
              <ChartSeries
                valueField="deviations"
                name={t('batchRecords.charts.deviations')}
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
                <p>{t('batchRecords.charts.noActivity')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Products & Recent Records Section - hidden on small screens */}
      <div className="hidden xl:grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Layers className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900">{t('batchRecords.charts.topProducts')}</h3>
            </div>
          </div>
          <div className="space-y-2">
            {dashboard?.topProducts?.slice(0, 6).map((product, index) => (
              <div
                key={product.productId}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-medium shrink-0">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate" title={product.productName}>{product.productName}</p>
                    <p className="text-xs text-gray-500 font-mono">{product.productCode}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-gray-900">{t('batchRecords.charts.woCount', { count: product.recordCount })}</p>
                  <p className="text-xs text-green-600">{t('batchRecords.charts.completionRate', { rate: product.completionRate })}</p>
                </div>
              </div>
            )) || (
              <div className="text-center py-8 text-gray-400">
                <Layers className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>{t('batchRecords.charts.noProductData')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Records */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-50 rounded-lg">
                <ClipboardCheck className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="font-semibold text-gray-900">{t('batchRecords.charts.recentRecords')}</h3>
            </div>
          </div>
          <div className="space-y-2">
            {dashboard?.recentRecords?.slice(0, 6).map((record) => (
              <div
                key={record.id}
                onClick={() => router.push(`/production/work-orders/${record.id}?tab=ebmr`)}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-1 h-10 rounded-full shrink-0 ${statusConfig[record.status as keyof typeof statusConfig]?.borderColor || 'border-gray-300'} bg-current opacity-60`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-medium text-gray-900">{record.woNumber}</p>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{record.batchNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    {renderStatusBadge(record.status)}
                    <p className="text-xs text-gray-400 mt-1 truncate max-w-[140px]">{record.productName}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-emerald-600 transition-colors" />
                </div>
              </div>
            )) || (
              <div className="text-center py-8 text-gray-400">
                <ClipboardCheck className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>{t('batchRecords.charts.noRecentRecords')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {dashboard && dashboard.deviationRecords > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 rounded-lg shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-red-800">{t('batchRecords.alerts.deviationsTitle')}</h4>
              <p className="text-sm text-red-700 mt-1">
                {t('batchRecords.alerts.deviationsDescription', {
                  count: dashboard.deviationRecords,
                  plural: dashboard.deviationRecords > 1 ? 's' : '',
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {dashboard && dashboard.inProgressRecords > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg shrink-0">
              <PlayCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-emerald-800">{t('batchRecords.alerts.activeTitle')}</h4>
              <p className="text-sm text-emerald-700 mt-1">
                {t('batchRecords.alerts.activeDescription', {
                  count: dashboard.inProgressRecords,
                  suffix: dashboard.inProgressRecords > 1 ? 's ' : ' ',
                })}
              </p>
              <button
                onClick={() => {
                  setStatusFilter('in_progress');
                  setActiveTab('in_progress');
                }}
                className="mt-2 text-sm font-medium text-emerald-800 hover:text-emerald-900 flex items-center gap-1"
              >
                {t('batchRecords.alerts.viewInProgress')} <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Records List Section */}
      <div className="bg-white rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] border border-emerald-100 min-w-0 overflow-hidden">
        {/* Tabs Header */}
        <div className="border-b border-emerald-50 px-3 py-3 sm:px-4 bg-gradient-to-r from-white to-[#F6FCF9]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <FileText className="h-5 w-5 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-[#064E3B]">{t('batchRecords.registry.title')}</h3>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <DxSelectBox
                dataSource={statusFilters}
                displayExpr="label"
                valueExpr="value"
                value={statusFilter}
                onValueChanged={(e) => setStatusFilter(e.value)}
                width={isMobile ? '100%' : 180}
                placeholder={t('batchRecords.registry.filterByStatus')}
              />
            </div>
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-3">
            <TabsList className="flex items-center gap-1 p-1 bg-[#F1FAF5] border border-emerald-100 rounded-xl overflow-x-auto scrollbar-thin snap-x w-full justify-start">
              <TabsTrigger
                value="all"
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap flex-shrink-0 snap-start min-h-[36px]"
              >
                <span>{t('batchRecords.tabs.all')}</span>
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold bg-emerald-100 text-emerald-800">
                  {totalCount}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="in_progress"
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap flex-shrink-0 snap-start min-h-[36px]"
              >
                <span>{t('batchRecords.tabs.inProgress')}</span>
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold bg-emerald-100 text-emerald-800">
                  {inProgressTabCount}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="pending"
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap flex-shrink-0 snap-start min-h-[36px]"
              >
                <span>{t('batchRecords.tabs.pending')}</span>
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold bg-emerald-100 text-emerald-800">
                  {pendingTabCount}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="completed"
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap flex-shrink-0 snap-start min-h-[36px]"
              >
                <span>{t('batchRecords.tabs.completed')}</span>
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold bg-emerald-100 text-emerald-800">
                  {completedTabCount}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Search + result count row */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('batchRecords.registry.searchPlaceholder')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
            <FileText className="h-4 w-4 text-gray-400" />
            <span>
              {filteredRecords.length} / {totalCount}
            </span>
          </div>
        </div>

        {/* Content: Loading / Empty / No results / Mobile Cards / Desktop Grid */}
        {recordsLoading ? (
          isMobile ? (
            <BatchRecordCardSkeletonList count={4} />
          ) : (
            <DataGridLoadingSkeleton />
          )
        ) : showEmptyState ? (
          <EmptyState t={t} />
        ) : showNoResultsState ? (
          <NoResultsState onClear={handleClearFilters} t={t} />
        ) : isMobile ? (
          <BatchRecordCardList
            records={filteredRecords}
            onView={handleView}
            formatDateTime={formatDateTime}
            renderStatusBadge={renderStatusBadge}
            t={t}
          />
        ) : (
          <div className="p-4">
            <DxDataGrid
              key={locale}
              dataSource={filteredRecords}
              keyExpr="id"
              showBorders={false}
              rowAlternationEnabled
              loading={recordsLoading}
              onRowClick={(e) => {
                if (e.data?.id) {
                  router.push(`/production/work-orders/${e.data.id}?tab=ebmr`);
                }
              }}
            >
              <DxSearchPanel visible placeholder={t('batchRecords.registry.dataGridSearch')} />
              <DxPaging defaultPageSize={15} />

              <DxColumn
                dataField="_rowNumber"
                caption="#"
                width={60}
                alignment="center"
                allowFiltering={false}
                allowSorting={false}
                cellRender={(cell) => (
                  <span className="text-gray-500 text-sm font-medium">{cell.value}</span>
                )}
              />
              <DxColumn
                dataField="woNumber"
                caption={t('batchRecords.columns.workOrder')}
                minWidth={180}
                cellRender={(cell) => (
                  <div>
                    <span className="font-mono font-medium text-emerald-700">{cell.data.woNumber}</span>
                    <p className="text-xs text-gray-500">{cell.data.batchNumber}</p>
                  </div>
                )}
              />
              <DxColumn
                dataField="productCode"
                caption={t('batchRecords.columns.product')}
                minWidth={200}
                cellRender={(cell) => (
                  <div>
                    <p className="font-medium text-gray-900">{cell.data.productCode}</p>
                    <p className="text-xs text-gray-500 truncate">{cell.data.productName}</p>
                  </div>
                )}
              />
              <DxColumn
                dataField="totalExecutionRecords"
                caption={t('batchRecords.columns.executionRecords')}
                minWidth={200}
                cellRender={(cell) => {
                  const d = cell.data as BatchRecordRow;
                  return (
                    <div className="text-xs space-y-0.5">
                      <div className="flex gap-3">
                        {d.sopSteps > 0 && (
                          <span className="text-emerald-700">{t('batchRecords.execution.sopPrefix')} {d.sopVerified}/{d.sopSteps}</span>
                        )}
                        {d.cleaningLogs > 0 && (
                          <span className="text-green-700">{t('batchRecords.execution.cleanPrefix')} {d.cleaningLogs}</span>
                        )}
                      </div>
                      <div className="flex gap-3">
                        {d.environmentalLogs > 0 && (
                          <span className="text-purple-700">{t('batchRecords.execution.envPrefix')} {d.environmentalLogs}</span>
                        )}
                        {d.finishedInspection > 0 && (
                          <span className="text-amber-700">{t('batchRecords.execution.fiPrefix')} {d.finishedInspection}</span>
                        )}
                      </div>
                      <p className="font-medium text-gray-600">{d.totalExecutionRecords}{t('batchRecords.execution.totalSuffix')}</p>
                    </div>
                  );
                }}
              />
              <DxColumn
                dataField="startTime"
                caption={t('batchRecords.columns.startDate')}
                width={140}
                cellRender={(cell) => (
                  <span className="text-sm tabular-nums">{formatDateTime(cell.data.startTime)}</span>
                )}
              />
              <DxColumn
                dataField="endTime"
                caption={t('batchRecords.columns.endDate')}
                width={140}
                cellRender={(cell) => (
                  <span className="text-sm tabular-nums">{formatDateTime(cell.data.endTime)}</span>
                )}
              />
              <DxColumn
                dataField="status"
                caption={t('batchRecords.columns.status')}
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
        )}
      </div>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

type BatchRecordRowLite = BatchRecordRow;

/** Mobile Card List — replaces DataGrid on mobile viewports. */
function BatchRecordCardList({
  records,
  onView,
  formatDateTime,
  renderStatusBadge,
  t,
}: {
  records: BatchRecordRowLite[];
  onView: (id: number) => void;
  formatDateTime: (dateStr: string | null) => string;
  renderStatusBadge: (status: string) => React.ReactNode;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {records.map((r) => {
        const sopProgress = r.sopSteps > 0
          ? `${r.sopVerified}/${r.sopSteps}`
          : null;
        return (
          <div
            key={r.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all"
          >
            {/* Card body: tap to view */}
            <button
              type="button"
              onClick={() => onView(r.id)}
              className="w-full text-left p-4 flex items-start gap-3"
            >
              <div className="h-11 w-11 rounded-xl bg-cyan-100 flex items-center justify-center flex-shrink-0">
                <ClipboardCheck className="h-5 w-5 text-cyan-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-emerald-700 text-base truncate">{r.woNumber}</p>
                    <p className="text-xs text-gray-500 font-mono truncate mt-0.5">{r.batchNumber}</p>
                  </div>
                  {renderStatusBadge(r.status)}
                </div>

                {/* Product info */}
                {(r.productCode || r.productName) && (
                  <p className="text-xs text-gray-600 flex items-center gap-1 mt-1.5">
                    <Package className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                    <span className="font-mono text-gray-500">{r.productCode}</span>
                    {r.productName && <span className="truncate">- {r.productName}</span>}
                  </p>
                )}

                {/* Tags row: execution counts */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {sopProgress && (
                    <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                      SOP: {sopProgress}
                    </span>
                  )}
                  {r.cleaningLogs > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                      {t('batchRecords.execution.cleanPrefix')} {r.cleaningLogs}
                    </span>
                  )}
                  {r.environmentalLogs > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                      {t('batchRecords.execution.envPrefix')} {r.environmentalLogs}
                    </span>
                  )}
                  {r.finishedInspection > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                      {t('batchRecords.execution.fiPrefix')} {r.finishedInspection}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                    <Layers className="h-3 w-3" />
                    {r.totalExecutionRecords}{t('batchRecords.execution.totalSuffix')}
                  </span>
                </div>

                {/* Dates */}
                {(r.startTime || r.endTime) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-500">
                    {r.startTime && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3 text-gray-400" />
                        <span className="tabular-nums">{t('batchRecords.mobile.startPrefix')} {formatDateTime(r.startTime)}</span>
                      </span>
                    )}
                    {r.endTime && (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-gray-400" />
                        <span className="tabular-nums">{t('batchRecords.mobile.endPrefix')} {formatDateTime(r.endTime)}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>

            {/* Card footer: view action (touch-friendly) */}
            <div className="flex items-center border-t border-gray-100">
              <button
                type="button"
                onClick={() => onView(r.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-100 transition-colors min-h-[44px]"
              >
                <Eye className="h-4 w-4" />
                <span>{t('batchRecords.mobile.viewDetails')}</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Loading skeleton for mobile card list */
function BatchRecordCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 bg-gray-200 rounded" />
              <div className="h-3 w-1/3 bg-gray-200 rounded" />
              <div className="h-3 w-2/3 bg-gray-200 rounded" />
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

type BatchRecordsTFn = (key: string, values?: Record<string, string | number | Date>) => string;

/** Empty State — shown when there are zero batch records at all */
function EmptyState({ t }: { t: BatchRecordsTFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-cyan-100 flex items-center justify-center mb-5">
        <ClipboardCheck className="h-10 w-10 text-cyan-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {t('batchRecords.empty.title')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {t('batchRecords.empty.description')}
      </p>
    </div>
  );
}

/** No Results State — shown when filter/search yields zero results */
function NoResultsState({ onClear, t }: { onClear: () => void; t: BatchRecordsTFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {t('batchRecords.noResults.title')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {t('batchRecords.noResults.description')}
      </p>
      <DxButton
        text={t('batchRecords.noResults.clearFilters')}
        icon="clear"
        stylingMode="outlined"
        onClick={onClear}
      />
    </div>
  );
}

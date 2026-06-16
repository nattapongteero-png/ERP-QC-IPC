'use client';

/**
 * BOM (Bill of Materials) Dashboard Page
 * Feature: Production Management
 *
 * Professional dashboard for managing manufacturing BOMs with DevExtreme UI.
 * Responsive: ResponsivePageHeader, StatCard KPI row, mobile card view,
 * empty state, no-results state, loading skeletons.
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
import { DxDataGrid, DxColumn, DxPaging } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PieChart, {
  Series,
  Label,
  Legend,
  Connector,
  Tooltip,
} from 'devextreme-react/pie-chart';
import {
  ClipboardList,
  CheckCircle,
  FileEdit,
  Archive,
  Package,
  Layers,
  Factory,
  AlertTriangle,
  ChevronRight,
  Boxes,
  Pencil,
  Trash2,
  Search,
  XCircle,
  SearchX,
  Clock,
  Eye,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatNumber } from '@/lib/utils/number-format';
import { cn } from '@/lib/utils/cn';
import type { BOMDashboard } from '@/app/api/bom/dashboard/route';

// Status configuration — each status a DISTINCT hue so badges never blur
// together (approved=emerald and active were both greens before). Each entry
// also carries the tab "active pill" classes so the filter tabs up top use the
// SAME colour as the matching status badge below (visual correspondence).
//   approved = emerald (green) · active = blue · draft = amber · obsolete = gray
const statusConfig = {
  draft: {
    translationKey: 'draft',
    color: 'bg-amber-100 text-amber-800 font-semibold',
    borderColor: 'border-amber-500',
    tabActive: 'bg-amber-500 text-white',
    countBadge: 'bg-amber-100 text-amber-800',
  },
  active: {
    translationKey: 'active',
    color: 'bg-blue-100 text-blue-800 font-semibold',
    borderColor: 'border-blue-500',
    tabActive: 'bg-blue-600 text-white',
    countBadge: 'bg-blue-100 text-blue-800',
  },
  approved: {
    translationKey: 'approved',
    color: 'bg-emerald-100 text-emerald-800 font-semibold',
    borderColor: 'border-emerald-500',
    tabActive: 'bg-emerald-600 text-white',
    countBadge: 'bg-emerald-100 text-emerald-800',
  },
  obsolete: {
    translationKey: 'obsolete',
    color: 'bg-gray-200 text-gray-700 font-semibold',
    borderColor: 'border-gray-400',
    tabActive: 'bg-gray-500 text-white',
    countBadge: 'bg-gray-200 text-gray-700',
  },
};

// "All" tab uses a neutral emerald (theme primary) since it isn't a status.
const allTabConfig = {
  tabActive: 'bg-emerald-600 text-white',
  countBadge: 'bg-emerald-100 text-emerald-800',
};

// Chart color palette
const chartColors = ['#059669', '#3B82F6', '#F59E0B', '#6B7280'];

// BOM list item type (as returned by /api/bom)
type BOMListItem = {
  id: number;
  code: string;
  name: string;
  productId?: number;
  productCode?: string;
  productName?: string;
  productUnit?: string;
  version: string;
  status: string;
  standardBatchSize?: number | string | null;
  batchUnit?: string | null;
  createdAt?: string | Date | null;
  _rowNumber?: number;
};

export default function BOMDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useTranslations('production');
  const { isMobile } = useMobile();
  const [activeTab, setActiveTab] = useState('all');
  const [searchText, setSearchText] = useState('');

  // Fetch dashboard data
  const { data: dashboard, isLoading: dashboardLoading } = useQuery<BOMDashboard>({
    queryKey: ['bom-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/bom/dashboard');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  // Fetch BOM list — always fetch all, filter client-side
  const { data: bomData, isLoading: bomLoading } = useQuery<BOMListItem[]>({
    queryKey: ['bom-list'],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      const res = await fetch(`/api/bom?${params}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return (data.data?.items || []) as BOMListItem[];
    },
  });

  // Prepare chart data
  const statusChartData = useMemo(() => dashboard
    ? Object.entries(dashboard.byStatus)
        .filter(([, value]) => value > 0)
        .map(([status, count]) => ({
          status: t(`bom.status.${statusConfig[status as keyof typeof statusConfig]?.translationKey || status}`),
          count,
        }))
    : [], [dashboard, t]);

  const renderStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return <span className="text-gray-500">{status}</span>;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide ${config.color}`}>
        {status === 'active' && <CheckCircle className="h-3 w-3" />}
        {status === 'draft' && <FileEdit className="h-3 w-3" />}
        {status === 'approved' && <CheckCircle className="h-3 w-3" />}
        {status === 'obsolete' && <Archive className="h-3 w-3" />}
        {t(`bom.status.${config.translationKey}`)}
      </span>
    );
  };

  const deleteBomMutation = useMutation({
    mutationFn: async (bomId: number) => {
      const res = await fetch(`/api/bom/${bomId}`, { method: 'DELETE' });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-list'] });
      queryClient.invalidateQueries({ queryKey: ['bom-dashboard'] });
      toast.success('BOM Deleted', 'Draft BOM has been deleted.');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const filteredBOMs = useMemo(() => {
    let result: BOMListItem[] = bomData || [];
    // Tab filter
    if (activeTab !== 'all') {
      result = result.filter((bom) => {
        if (activeTab === 'legacy') return bom.status === 'active';
        return bom.status === activeTab;
      });
    }
    // Search filter
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter((bom) =>
        (bom.code || '').toLowerCase().includes(q) ||
        (bom.name || '').toLowerCase().includes(q) ||
        (bom.productCode || '').toLowerCase().includes(q)
      );
    }
    // Sort by createdAt descending (newest first); fallback to id desc
    result = [...result].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return (b.id || 0) - (a.id || 0);
    });
    // Tag with display row number (mirrors /inventory/items).
    return result.map((bom, index) => ({ ...bom, _rowNumber: index + 1 }));
  }, [bomData, activeTab, searchText]);

  const handleCreate = () => router.push('/production/bom/new');
  const handleView = (bom: BOMListItem) => router.push(`/production/bom/${bom.id}`);
  const handleEdit = (bom: BOMListItem) => router.push(`/production/bom/${bom.id}`);
  const handleDelete = (bom: BOMListItem) => {
    if (confirm('ต้องการลบ BOM นี้หรือไม่?')) {
      deleteBomMutation.mutate(bom.id);
    }
  };
  const handleClearFilters = () => {
    setSearchText('');
    setActiveTab('all');
  };

  // Tab configuration (scrollable on mobile)
  const totalCount = bomData?.length || 0;
  const approvedCount = bomData?.filter((b) => b.status === 'approved').length || 0;
  const activeCount = bomData?.filter((b) => b.status === 'active').length || 0;
  const draftCount = bomData?.filter((b) => b.status === 'draft').length || 0;
  const obsoleteCount = bomData?.filter((b) => b.status === 'obsolete').length || 0;

  // One tab per status the registry can display (statusConfig), so the filter
  // surface never has fewer options than the badges shown in the grid. Each tab
  // carries the colour of its matching status badge (tabActive when selected,
  // countBadge for the count pill) so the filter and the grid stay in sync.
  const tabs: Array<{ key: string; label: string; count: number; tabActive: string; countBadge: string }> = [
    { key: 'all', label: t('bom.tabs.all'), count: totalCount, ...allTabConfig },
    { key: 'approved', label: t('bom.tabs.approved'), count: approvedCount, tabActive: statusConfig.approved.tabActive, countBadge: statusConfig.approved.countBadge },
    { key: 'active', label: t('bom.tabs.active'), count: activeCount, tabActive: statusConfig.active.tabActive, countBadge: statusConfig.active.countBadge },
    { key: 'draft', label: t('bom.tabs.draft'), count: draftCount, tabActive: statusConfig.draft.tabActive, countBadge: statusConfig.draft.countBadge },
    { key: 'obsolete', label: t('bom.tabs.obsolete'), count: obsoleteCount, tabActive: statusConfig.obsolete.tabActive, countBadge: statusConfig.obsolete.countBadge },
  ];

  const showEmptyState = !bomLoading && (bomData?.length || 0) === 0;
  const showNoResultsState = !bomLoading && (bomData?.length || 0) > 0 && filteredBOMs.length === 0;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title={t('bom.pageTitle')}
        subtitle={t('bom.subtitle')}
        icon={ClipboardList}
        iconBgColor="bg-purple-100"
        iconColor="text-purple-600"
        breadcrumbs={[
          { label: t('breadcrumbs.production'), href: '/production' },
          { label: t('bom.breadcrumbs.bomManagement') },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              text={t('workOrders.actions.refresh') || 'Refresh'}
              stylingMode="outlined"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['bom-list'] });
                queryClient.invalidateQueries({ queryKey: ['bom-dashboard'] });
              }}
              className="hidden sm:inline-flex"
            />
            <DxButton
              icon="chart"
              text={t('workOrders.actions.analytics') || 'Analytics'}
              stylingMode="outlined"
              onClick={() => router.push('/production/work-orders')}
              className="hidden md:inline-flex"
            />
            <DxButton
              text={t('bom.actions.createNewBOM')}
              icon="plus"
              type="success"
              onClick={handleCreate}
            />
          </div>
        }
      />

      {/* KPI Stat Cards - 4 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('bom.stats.totalBOMs')}
          value={dashboard?.totalBOMs ?? 0}
          icon={ClipboardList}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('bom.stats.activeBOMs')}
          value={(dashboard?.activeBOMs ?? 0)}
          icon={CheckCircle}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('bom.stats.draftBOMs')}
          value={dashboard?.draftBOMs ?? 0}
          icon={Clock}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('bom.stats.obsolete')}
          value={dashboard?.obsoleteBOMs ?? 0}
          icon={XCircle}
          iconColor="text-gray-400"
          accentColor="border-gray-400"
          isLoading={dashboardLoading}
        />
      </div>

      {/* Secondary Stats - visible on large screens only */}
      <div className="hidden xl:grid grid-cols-3 gap-3 md:gap-4">
        <StatCard
          label={t('bom.stats.workOrders')}
          value={dashboard?.activeWorkOrders ?? 0}
          icon={Factory}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={dashboardLoading}
          href="/production/work-orders"
        />
        <StatCard
          label={t('bom.stats.materials')}
          value={dashboard?.totalMaterials ?? 0}
          icon={Package}
          iconColor="text-purple-500"
          accentColor="border-purple-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('bom.stats.avgPerBOM')}
          value={dashboard?.avgMaterialsPerBOM?.toFixed(1) ?? '0'}
          icon={Layers}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={dashboardLoading}
        />
      </div>

      {/* Charts & Cards Section - hidden on small screens to prioritize the list */}
      <div className="hidden xl:grid grid-cols-1 xl:grid-cols-3 gap-3">
        {/* Status Distribution */}
        <div className="bg-white rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] border border-emerald-100 p-5 min-w-0">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Boxes className="h-5 w-5 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-[#064E3B] text-base">{t('bom.charts.statusDistribution')}</h3>
          </div>
          {statusChartData.length > 0 ? (
            <PieChart
              dataSource={statusChartData}
              palette={chartColors}
              type="doughnut"
              innerRadius={0.65}
              size={{ height: 200 }}
            >
              <Series argumentField="status" valueField="count">
                <Label visible format="fixedPoint">
                  <Connector visible width={1} />
                </Label>
              </Series>
              <Legend horizontalAlignment="center" verticalAlignment="bottom" itemTextPosition="right" rowCount={1} />
              <Tooltip enabled format="fixedPoint" />
            </PieChart>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-gray-400">
              <div className="text-center">
                <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('bom.charts.noBOMsFound')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] border border-emerald-100 p-5 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Package className="h-5 w-5 text-purple-600" />
            </div>
            <h3 className="font-semibold text-[#064E3B] text-base">{t('bom.charts.topProducts')}</h3>
          </div>
          <div className="space-y-2.5">
            {dashboard?.topProducts?.slice(0, 4).map((product, index) => (
              <div key={product.productId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-medium shrink-0">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 text-sm truncate" title={product.productName}>{product.productName}</p>
                  <p className="text-xs text-gray-500 font-mono">{product.productCode}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-gray-900 text-sm">{product.bomCount}</p>
                  <p className="text-xs text-green-600">{product.activeBOMs} active</p>
                </div>
              </div>
            )) || (
              <div className="text-center py-6 text-gray-400">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('bom.charts.noData')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent BOMs */}
        <div className="bg-white rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] border border-emerald-100 p-5 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 bg-amber-50 rounded-lg">
              <ClipboardList className="h-5 w-5 text-amber-600" />
            </div>
            <h3 className="font-semibold text-[#064E3B] text-base">{t('bom.charts.recentBOMs')}</h3>
          </div>
          <div className="space-y-2.5">
            {dashboard?.recentBOMs?.slice(0, 4).map((bom) => (
              <div
                key={bom.id}
                onClick={() => router.push(`/production/bom/${bom.id}`)}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer group"
              >
                <div className={`w-1.5 h-10 rounded-full shrink-0 ${statusConfig[bom.status as keyof typeof statusConfig]?.borderColor || 'border-gray-300'} bg-current opacity-60`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-mono text-sm font-medium text-gray-900">{bom.code}</p>
                    <span className="text-xs text-gray-400">v{bom.version}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate" title={bom.productName}>{bom.productName}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {renderStatusBadge(bom.status)}
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-emerald-500" />
                </div>
              </div>
            )) || (
              <div className="text-center py-6 text-gray-400">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('bom.charts.noData')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {dashboard && dashboard.draftBOMs > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-start sm:items-center gap-3 flex-col sm:flex-row">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-amber-800 text-sm">{t('bom.alerts.pendingReview')}</span>
                <span className="text-sm text-amber-700 ml-2">
                  {t('bom.alerts.draftBOMsPending', { count: dashboard.draftBOMs })}
                </span>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('draft')}
              className="text-sm font-medium text-amber-800 hover:text-amber-900 flex items-center gap-1 shrink-0 self-end sm:self-auto"
            >
              {t('bom.alerts.viewDraftBOMs')} <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* BOM List Card */}
      <div className="bg-white rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] border border-emerald-100 min-w-0 overflow-hidden">
        {/* Filter / Tab row */}
        <div className="px-3 py-3 sm:px-4 border-b border-emerald-50 bg-gradient-to-r from-white to-[#F6FCF9]">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex items-center gap-1 p-1 bg-[#F1FAF5] border border-emerald-100 rounded-xl overflow-x-auto scrollbar-thin snap-x w-full justify-start">
              {tabs.map((tab) => {
                const isSelected = activeTab === tab.key;
                return (
                  <TabsTrigger
                    key={tab.key}
                    value={tab.key}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap flex-shrink-0 snap-start min-h-[36px]',
                      // When selected, paint the tab in its status colour so it
                      // matches the badge below; otherwise keep it neutral.
                      isSelected ? `${tab.tabActive} shadow-sm` : 'text-gray-600 hover:bg-white/60'
                    )}
                  >
                    <span>{tab.label}</span>
                    <span className={cn(
                      'ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold',
                      isSelected ? 'bg-white/25 text-white' : tab.countBadge
                    )}>
                      {tab.count}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        {/* Search row */}
        <div className="px-3 py-3 sm:px-4 border-b border-emerald-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('workOrders.grid.searchPlaceholder') || 'Search BOM code, name, product...'}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
            <Boxes className="h-4 w-4 text-gray-400" />
            <span>
              {filteredBOMs.length} / {bomData?.length || 0}
            </span>
          </div>
        </div>

        {/* Content: Loading / Empty / No results / Mobile Cards / Desktop Grid */}
        {bomLoading ? (
          isMobile ? (
            <BomCardSkeletonList count={4} />
          ) : (
            <DataGridLoadingSkeleton />
          )
        ) : showEmptyState ? (
          <EmptyState onCreate={handleCreate} t={t} />
        ) : showNoResultsState ? (
          <NoResultsState onClear={handleClearFilters} t={t} />
        ) : isMobile ? (
          <BomCardList
            boms={filteredBOMs}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            deleteDisabled={deleteBomMutation.isPending}
            t={t}
          />
        ) : (
          <div className="bom-compact-grid px-2 pb-1">
            <style>{`
              .bom-compact-grid .dx-datagrid-rowsview .dx-row > td {
                padding: 6px 10px !important;
                line-height: 1.4 !important;
                border-bottom: 1px solid #f1f5f9;
              }
              .bom-compact-grid .dx-datagrid-headers .dx-header-row > td {
                padding: 8px 10px !important;
                font-size: 0.72rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                color: #6b7280;
              }
              .bom-compact-grid .dx-datagrid-headers .dx-datagrid-text-content {
                white-space: normal !important;
                word-wrap: break-word;
              }
              .bom-compact-grid .dx-data-row:hover > td {
                background-color: #ecfdf5 !important;
                transition: background-color 0.15s ease;
              }
              .bom-compact-grid .dx-data-row.dx-row-alt > td {
                background-color: #f8fafc;
              }
              .bom-compact-grid .dx-datagrid {
                border: none;
              }
              .bom-compact-grid .dx-datagrid-pager {
                padding: 2px 8px !important;
              }
            `}</style>
            <DxDataGrid
              dataSource={filteredBOMs}
              keyExpr="id"
              showBorders={false}
              rowAlternationEnabled
              loading={bomLoading}
              height="auto"
              width="100%"
              columnAutoWidth
              showColumnLines={false}
              onRowClick={(e) => {
                if (e.data?.id) {
                  router.push(`/production/bom/${e.data.id}`);
                }
              }}
            >
              <DxPaging defaultPageSize={20} />

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
                dataField="code"
                caption={t('bom.table.columns.code')}
                minWidth={110}
                cellRender={(cell) => (
                  <span className="font-mono font-medium text-emerald-700 text-sm">{cell.value}</span>
                )}
              />
              <DxColumn
                dataField="name"
                caption={t('bom.table.columns.name')}
                minWidth={200}
                cellRender={(cell) => (
                  <div className="truncate text-sm" title={cell.value}>{cell.value}</div>
                )}
              />
              <DxColumn
                dataField="productCode"
                caption={t('bom.table.columns.product')}
                minWidth={110}
                cellRender={(cell) => (
                  <span className="font-mono text-gray-600 text-sm">{cell.value}</span>
                )}
              />
              <DxColumn
                dataField="standardBatchSize"
                caption={t('bom.table.columns.batch')}
                minWidth={130}
                alignment="right"
                cellRender={(cell) => (
                  <span className="tabular-nums text-sm">
                    {cell.data.standardBatchSize != null ? formatNumber(cell.data.standardBatchSize) : '-'} {cell.data.batchUnit || ''}
                  </span>
                )}
              />
              <DxColumn
                dataField="version"
                caption={t('bom.table.columns.version')}
                width={80}
                alignment="center"
                cellRender={(cell) => (
                  <span className="text-gray-500 text-sm">v{cell.value}</span>
                )}
              />
              <DxColumn
                dataField="status"
                caption={t('bom.table.columns.status')}
                width={130}
                cellRender={(cell) => renderStatusBadge(cell.value)}
              />
              <DxColumn
                dataField="createdAt"
                caption={t('bom.table.columns.created')}
                width={120}
                dataType="date"
                format="yyyy-MM-dd"
              />
              <DxColumn
                caption=""
                width={130}
                cellRender={(cell) => {
                  const bom = cell.data as BOMListItem;
                  const isDraft = bom.status === 'draft';
                  return (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleView(bom);
                        }}
                        className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {isDraft && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(bom);
                            }}
                            className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(bom);
                            }}
                            disabled={deleteBomMutation.isPending}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                }}
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

// next-intl's translator type; accept a compatible superset for helper components.
type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

/** Mobile Card List — replaces DataGrid on mobile viewports. */
function BomCardList({
  boms,
  onView,
  onEdit,
  onDelete,
  deleteDisabled,
  t,
}: {
  boms: BOMListItem[];
  onView: (bom: BOMListItem) => void;
  onEdit: (bom: BOMListItem) => void;
  onDelete: (bom: BOMListItem) => void;
  deleteDisabled: boolean;
  t: TranslateFn;
}) {
  const statusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return null;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide ${config.color}`}
      >
        {status === 'draft' && <FileEdit className="h-3 w-3" />}
        {(status === 'active' || status === 'approved') && <CheckCircle className="h-3 w-3" />}
        {status === 'obsolete' && <Archive className="h-3 w-3" />}
        {t(`bom.status.${config.translationKey}`)}
      </span>
    );
  };

  const formatDate = (d: string | Date | null | undefined) => {
    if (!d) return '-';
    try {
      const date = typeof d === 'string' ? new Date(d) : d;
      if (isNaN(date.getTime())) return '-';
      return date.toISOString().slice(0, 10);
    } catch {
      return '-';
    }
  };

  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {boms.map((bom) => {
        const isDraft = bom.status === 'draft';
        return (
          <div
            key={bom.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all"
          >
            {/* Card body: tap to view */}
            <button
              type="button"
              onClick={() => onView(bom)}
              className="w-full text-left p-4 flex items-start gap-3"
            >
              <div className="h-11 w-11 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                <ClipboardList className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-gray-900 text-base truncate">{bom.code}</p>
                    <p className="text-sm text-gray-700 truncate mt-0.5" title={bom.name}>{bom.name}</p>
                  </div>
                  {statusBadge(bom.status)}
                </div>

                {/* Product info */}
                {(bom.productCode || bom.productName) && (
                  <p className="text-xs text-gray-600 flex items-center gap-1 mt-1.5">
                    <Package className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                    <span className="font-mono text-gray-500">{bom.productCode}</span>
                    {bom.productName && <span className="truncate">- {bom.productName}</span>}
                  </p>
                )}

                {/* Tags row */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                    v{bom.version}
                  </span>
                  {bom.standardBatchSize != null && (
                    <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                      <Layers className="h-3 w-3" />
                      {formatNumber(bom.standardBatchSize)} {bom.batchUnit || ''}
                    </span>
                  )}
                  {bom.createdAt && (
                    <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                      <Clock className="h-3 w-3" />
                      {formatDate(bom.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Card footer: action buttons (touch-friendly) */}
            <div className="flex items-center border-t border-gray-100 divide-x divide-gray-100">
              <button
                type="button"
                onClick={() => onView(bom)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-100 transition-colors min-h-[44px]"
              >
                <Eye className="h-4 w-4" />
                <span>{t('workOrders.actions.viewDetails') || 'View'}</span>
              </button>
              <button
                type="button"
                onClick={() => onEdit(bom)}
                disabled={!isDraft}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-100 transition-colors min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <Pencil className="h-4 w-4" />
                <span>{t('bom.actions.editBOM') || 'Edit'}</span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(bom)}
                disabled={!isDraft || deleteDisabled}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 active:bg-red-100 transition-colors min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Loading skeleton for mobile card list */
function BomCardSkeletonList({ count = 3 }: { count?: number }) {
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

/** Empty State — shown when there are zero BOMs at all */
function EmptyState({ onCreate, t }: { onCreate: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-purple-100 flex items-center justify-center mb-5">
        <ClipboardList className="h-10 w-10 text-purple-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {t('bom.charts.noBOMsFound') || 'No BOMs found'}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {t('bom.description') || 'Start managing your manufacturing recipes by creating your first BOM.'}
      </p>
      <DxButton
        text={t('bom.actions.createNewBOM')}
        icon="plus"
        type="success"
        onClick={onCreate}
      />
    </div>
  );
}

/** No Results State — shown when filter/search yields zero results */
function NoResultsState({ onClear, t }: { onClear: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {t('bom.charts.noBOMsFound') || 'No matching BOMs'}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        Try changing your search or filter selection.
      </p>
      <DxButton
        text="Clear Filters"
        icon="clear"
        stylingMode="outlined"
        onClick={onClear}
      />
    </div>
  );
}

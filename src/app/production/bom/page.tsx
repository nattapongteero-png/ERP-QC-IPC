'use client';

/**
 * BOM (Bill of Materials) Dashboard Page
 * Feature: Production Management
 *
 * Professional dashboard for managing manufacturing BOMs with DevExtreme UI.
 * Redesigned with responsive layout that properly constrains width.
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
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
  Settings,
} from 'lucide-react';
import type { BOMDashboard } from '@/app/api/bom/dashboard/route';

// Status configuration - Simplified workflow: draft → approved → obsolete
const statusConfig = {
  draft: { translationKey: 'draft', color: 'bg-amber-100 text-amber-800', borderColor: 'border-amber-500' },
  active: { translationKey: 'active', color: 'bg-teal-100 text-teal-800', borderColor: 'border-teal-500' },
  approved: { translationKey: 'approved', color: 'bg-green-100 text-green-800', borderColor: 'border-green-500' },
  obsolete: { translationKey: 'obsolete', color: 'bg-gray-100 text-gray-600', borderColor: 'border-gray-400' },
};

// Chart color palette
const chartColors = ['#059669', '#3B82F6', '#F59E0B', '#6B7280'];

export default function BOMDashboardPage() {
  const router = useRouter();
  const t = useTranslations('production');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // Status filters with translations
  const statusFilters = useMemo(() => [
    { value: '', label: t('bom.filters.allStatuses') },
    { value: 'approved', label: t('bom.status.approved') },
    { value: 'draft', label: t('bom.status.draft') },
    { value: 'active', label: t('bom.status.active') },
    { value: 'obsolete', label: t('bom.status.obsolete') },
  ], [t]);

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

  // Fetch BOM list
  const { data: bomData, isLoading: bomLoading } = useQuery({
    queryKey: ['bom-list', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/bom?${params}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data?.items || [];
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
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${config.color}`}>
        {status === 'active' && <CheckCircle className="h-3.5 w-3.5" />}
        {status === 'draft' && <FileEdit className="h-3.5 w-3.5" />}
        {status === 'approved' && <CheckCircle className="h-3.5 w-3.5" />}
        {status === 'obsolete' && <Archive className="h-3.5 w-3.5" />}
        {t(`bom.status.${config.translationKey}`)}
      </span>
    );
  };

  const filteredBOMs = bomData?.filter((bom: { status: string }) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'approved') return bom.status === 'approved';
    if (activeTab === 'legacy') return bom.status === 'active';
    return bom.status === activeTab;
  }) || [];

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      {/* Header */}
      <ResponsivePageHeader
        title={t('bom.pageTitle')}
        subtitle={t('bom.subtitle')}
        icon={ClipboardList}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        breadcrumbs={[
          { label: t('breadcrumbs.production'), href: '/production' },
          { label: t('bom.breadcrumbs.bomManagement') },
        ]}
        actions={
          <DxButton
            text={t('bom.actions.createNewBOM')}
            icon="plus"
            type="success"
            onClick={() => router.push('/production/bom/new')}
          />
        }
      />

      {/* Stats Row - 4 columns on desktop, 2 on mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
          value={dashboard?.activeBOMs ?? 0}
          icon={CheckCircle}
          iconColor="text-green-500"
          accentColor="border-green-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('bom.stats.draftBOMs')}
          value={dashboard?.draftBOMs ?? 0}
          icon={FileEdit}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('bom.stats.workOrders')}
          value={dashboard?.activeWorkOrders ?? 0}
          icon={Factory}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={dashboardLoading}
          href="/production/work-orders"
        />
      </div>

      {/* Secondary Stats - 3 columns */}
      <div className="grid grid-cols-3 gap-3">
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
          iconColor="text-indigo-500"
          accentColor="border-indigo-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label={t('bom.stats.obsolete')}
          value={dashboard?.obsoleteBOMs ?? 0}
          icon={Archive}
          iconColor="text-gray-500"
          accentColor="border-gray-400"
          isLoading={dashboardLoading}
        />
      </div>

      {/* Charts & Cards Section - Responsive Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Status Distribution - Takes 1 column */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 min-w-0">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Boxes className="h-5 w-5 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-base">{t('bom.charts.statusDistribution')}</h3>
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
              <Legend
                horizontalAlignment="center"
                verticalAlignment="bottom"
                itemTextPosition="right"
                rowCount={1}
              />
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

        {/* Top Products - Takes 1 column */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Package className="h-5 w-5 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-base">{t('bom.charts.topProducts')}</h3>
          </div>
          <div className="space-y-2.5">
            {dashboard?.topProducts?.slice(0, 4).map((product, index) => (
              <div
                key={product.productId}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-medium shrink-0">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 text-sm truncate" title={product.productName}>
                    {product.productName}
                  </p>
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

        {/* Recent BOMs - Takes 1 column */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 bg-amber-50 rounded-lg">
              <ClipboardList className="h-5 w-5 text-amber-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-base">{t('bom.charts.recentBOMs')}</h3>
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
                  <p className="text-xs text-gray-500 truncate" title={bom.productName}>
                    {bom.productName}
                  </p>
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
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-amber-800 text-base">{t('bom.alerts.pendingReview')}</h4>
              <p className="text-sm text-amber-700 mt-0.5">
                {t('bom.alerts.draftBOMsPending', { count: dashboard.draftBOMs })}
              </p>
              <button
                onClick={() => {
                  setStatusFilter('draft');
                  setActiveTab('draft');
                }}
                className="mt-2 text-sm font-medium text-amber-800 hover:text-amber-900 flex items-center gap-1"
              >
                {t('bom.alerts.viewDraftBOMs')} <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOM List Section - Full Width */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-100 px-4 pt-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-50 rounded-lg">
                <Settings className="h-4 w-4 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900 text-base">{t('bom.registry.title')}</h3>
            </div>
            <DxSelectBox
              dataSource={statusFilters}
              displayExpr="label"
              valueExpr="value"
              value={statusFilter}
              onValueChanged={(e) => setStatusFilter(e.value)}
              width={140}
              placeholder="Filter"
            />
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-3">
            <TabsList className="text-sm">
              <TabsTrigger value="all" className="text-sm px-3 py-1.5">
                All ({bomData?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="approved" className="text-sm px-3 py-1.5">
                Approved ({bomData?.filter((b: { status: string }) => b.status === 'approved').length || 0})
              </TabsTrigger>
              <TabsTrigger value="draft" className="text-sm px-3 py-1.5">
                Draft ({bomData?.filter((b: { status: string }) => b.status === 'draft').length || 0})
              </TabsTrigger>
              <TabsTrigger value="obsolete" className="text-sm px-3 py-1.5">
                Obsolete ({bomData?.filter((b: { status: string }) => b.status === 'obsolete').length || 0})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* DataGrid */}
        <div className="p-3">
          <DxDataGrid
            dataSource={filteredBOMs}
            keyExpr="id"
            showBorders={false}
            rowAlternationEnabled
            loading={bomLoading}
            height={350}
            width="100%"
            columnAutoWidth
            showColumnLines={false}
            onRowClick={(e) => {
              if (e.data?.id) {
                router.push(`/production/bom/${e.data.id}`);
              }
            }}
          >
            <DxSearchPanel visible placeholder="Search..." width={160} />
            <DxPaging defaultPageSize={10} />

            <DxColumn
              dataField="code"
              caption="Code"
              minWidth={100}
              cellRender={(cell) => (
                <span className="font-mono font-medium text-emerald-700 text-sm">{cell.value}</span>
              )}
            />
            <DxColumn
              dataField="name"
              caption="Name"
              minWidth={180}
              width={400}
              cellRender={(cell) => (
                <div className="truncate text-sm" title={cell.value}>{cell.value}</div>
              )}
            />
            <DxColumn
              dataField="productCode"
              caption="Product"
              minWidth={80}
              cellRender={(cell) => (
                <span className="font-mono text-gray-600 text-sm">{cell.value}</span>
              )}
            />
            <DxColumn
              dataField="standardBatchSize"
              caption="Batch"
              minWidth={120}
              alignment="right"
              cellRender={(cell) => (
                <span className="tabular-nums text-sm">
                  {cell.data.standardBatchSize?.toLocaleString() || '-'} {cell.data.batchUnit || ''}
                </span>
              )}
            />
            <DxColumn
              dataField="version"
              caption="Version"
              width={70}
              alignment="center"
              cellRender={(cell) => (
                <span className="text-gray-500 text-sm">v{cell.value}</span>
              )}
            />
            <DxColumn
              dataField="status"
              caption="Status"
              minWidth={100}
              cellRender={(cell) => renderStatusBadge(cell.value)}
            />
            <DxColumn
              dataField="createdAt"
              caption="Created"
              minWidth={100}
              dataType="date"
              format="yyyy-MM-dd"
            />
            <DxColumn
              caption=""
              width={40}
              cellRender={(cell) => (
                <DxButton
                  icon="chevronright"
                  stylingMode="text"
                  onClick={(e) => {
                    e?.event?.stopPropagation();
                    router.push(`/production/bom/${cell.data.id}`);
                  }}
                />
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

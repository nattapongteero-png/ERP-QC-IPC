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
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { StatCard } from '@/components/shared/stat-card';
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
  Settings,
  Pencil,
  Trash2,
  Search,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useTranslations('production');
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
  const { data: bomData, isLoading: bomLoading } = useQuery({
    queryKey: ['bom-list'],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', '1000');
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
    let result = bomData || [];
    // Tab filter
    if (activeTab !== 'all') {
      result = result.filter((bom: { status: string }) => {
        if (activeTab === 'legacy') return bom.status === 'active';
        return bom.status === activeTab;
      });
    }
    // Search filter
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter((bom: { code?: string; name?: string; productCode?: string }) =>
        (bom.code || '').toLowerCase().includes(q) ||
        (bom.name || '').toLowerCase().includes(q) ||
        (bom.productCode || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [bomData, activeTab, searchText]);

  return (
    <div className="flex flex-col gap-3 p-3 md:p-4 w-full max-w-full box-border">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <ClipboardList className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <nav className="text-xs text-gray-500 hidden md:block">
              <Link href="/production" className="hover:text-emerald-600 transition-colors">
                {t('breadcrumbs.production')}
              </Link>
              <span className="mx-1.5">/</span>
              <span className="text-gray-700">{t('bom.breadcrumbs.bomManagement')}</span>
            </nav>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">{t('bom.pageTitle')}</h1>
          </div>
        </div>
        <DxButton
          text={t('bom.actions.createNewBOM')}
          icon="plus"
          type="success"
          onClick={() => router.push('/production/bom/new')}
        />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
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

      {/* Secondary Stats - 3 columns (hidden by default to save space) */}
      <div className="hidden xl:grid grid-cols-3 gap-2">
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

      {/* Charts & Cards Section - hidden by default to save space */}
      <div className="hidden xl:grid grid-cols-1 xl:grid-cols-3 gap-3">
        {/* Status Distribution */}
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Package className="h-5 w-5 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-base">{t('bom.charts.topProducts')}</h3>
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
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-amber-800 text-sm">{t('bom.alerts.pendingReview')}</span>
              <span className="text-sm text-amber-700 ml-2">
                {t('bom.alerts.draftBOMsPending', { count: dashboard.draftBOMs })}
              </span>
            </div>
            <button
              onClick={() => setActiveTab('draft')}
              className="text-sm font-medium text-amber-800 hover:text-amber-900 flex items-center gap-1 shrink-0"
            >
              {t('bom.alerts.viewDraftBOMs')} <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* BOM List Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-w-0 overflow-hidden">
        {/* Header — tabs + status filter + search ALL on one row */}
        <div className="border-b border-gray-100 px-3 py-1.5 flex items-center gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <Settings className="h-4 w-4 text-emerald-600" />
            <h3 className="font-semibold text-gray-900 text-sm whitespace-nowrap">{t('bom.registry.title')}</h3>
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto shrink-0">
            <TabsList className="text-xs">
              <TabsTrigger value="all" className="text-xs px-2 py-1">
                All ({bomData?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="approved" className="text-xs px-2 py-1">
                Approved ({bomData?.filter((b: { status: string }) => b.status === 'approved').length || 0})
              </TabsTrigger>
              <TabsTrigger value="draft" className="text-xs px-2 py-1">
                Draft ({bomData?.filter((b: { status: string }) => b.status === 'draft').length || 0})
              </TabsTrigger>
              <TabsTrigger value="obsolete" className="text-xs px-2 py-1">
                Obsolete ({bomData?.filter((b: { status: string }) => b.status === 'obsolete').length || 0})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative shrink-0">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-md w-[150px] focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* DataGrid — compact density */}
        <div className="bom-compact-grid px-2 pb-1">
          <style>{`
            .bom-compact-grid .dx-datagrid-rowsview .dx-row > td {
              padding: 1px 7px !important;
              line-height: 1.3 !important;
              border-bottom: 1px solid #f1f5f9;
            }
            .bom-compact-grid .dx-datagrid-headers .dx-header-row > td {
              padding: 4px 7px !important;
              font-size: 0.7rem;
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
                  {cell.data.standardBatchSize != null ? Number(cell.data.standardBatchSize).toLocaleString() : '-'} {cell.data.batchUnit || ''}
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
              caption="Actions"
              width={110}
              cellRender={(cell) => {
                const bom = cell.data as { id: number; status: string };
                const isDraft = bom.status === 'draft';
                return (
                  <div className="flex items-center gap-1">
                    {isDraft && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/production/bom/${bom.id}`);
                          }}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('ต้องการลบ BOM นี้หรือไม่?')) {
                              deleteBomMutation.mutate(bom.id);
                            }
                          }}
                          disabled={deleteBomMutation.isPending}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/production/bom/${bom.id}`);
                      }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                );
              }}
              allowFiltering={false}
              allowSorting={false}
            />
          </DxDataGrid>
        </div>
      </div>
    </div>
  );
}

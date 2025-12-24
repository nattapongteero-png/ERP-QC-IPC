'use client';

/**
 * BOM (Bill of Materials) Dashboard Page
 * Feature: Production Management
 *
 * Professional dashboard for managing manufacturing BOMs with DevExtreme UI.
 * Redesigned with responsive layout that properly constrains width.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
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
  draft: { label: 'Draft', color: 'bg-amber-100 text-amber-800', borderColor: 'border-amber-500' },
  active: { label: 'Active', color: 'bg-teal-100 text-teal-800', borderColor: 'border-teal-500' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800', borderColor: 'border-green-500' },
  obsolete: { label: 'Obsolete', color: 'bg-gray-100 text-gray-600', borderColor: 'border-gray-400' },
};

const statusFilters = [
  { value: '', label: 'All Statuses' },
  { value: 'approved', label: 'Approved' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'obsolete', label: 'Obsolete' },
];

// Chart color palette
const chartColors = ['#059669', '#3B82F6', '#F59E0B', '#6B7280'];

export default function BOMDashboardPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('');
  const [activeTab, setActiveTab] = useState('all');

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
  const statusChartData = dashboard
    ? Object.entries(dashboard.byStatus)
        .filter(([, value]) => value > 0)
        .map(([status, count]) => ({
          status: statusConfig[status as keyof typeof statusConfig]?.label || status,
          count,
        }))
    : [];

  const renderStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return <span className="text-gray-500">{status}</span>;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {status === 'active' && <CheckCircle className="h-3 w-3" />}
        {status === 'draft' && <FileEdit className="h-3 w-3" />}
        {status === 'approved' && <CheckCircle className="h-3 w-3" />}
        {status === 'obsolete' && <Archive className="h-3 w-3" />}
        {config.label}
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
        title="Bill of Materials (BOM)"
        subtitle="Manufacturing recipes and component management"
        icon={ClipboardList}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        breadcrumbs={[
          { label: 'Production', href: '/production' },
          { label: 'BOM Management' },
        ]}
        actions={
          <DxButton
            text="Create New BOM"
            icon="plus"
            type="success"
            onClick={() => router.push('/production/bom/new')}
          />
        }
      />

      {/* Stats Row - 4 columns on desktop, 2 on mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total BOMs"
          value={dashboard?.totalBOMs ?? 0}
          icon={ClipboardList}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Active BOMs"
          value={dashboard?.activeBOMs ?? 0}
          icon={CheckCircle}
          iconColor="text-green-500"
          accentColor="border-green-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Draft BOMs"
          value={dashboard?.draftBOMs ?? 0}
          icon={FileEdit}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Work Orders"
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
          label="Materials"
          value={dashboard?.totalMaterials ?? 0}
          icon={Package}
          iconColor="text-purple-500"
          accentColor="border-purple-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Avg/BOM"
          value={dashboard?.avgMaterialsPerBOM?.toFixed(1) ?? '0'}
          icon={Layers}
          iconColor="text-indigo-500"
          accentColor="border-indigo-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Obsolete"
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-emerald-50 rounded-lg">
              <Boxes className="h-4 w-4 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm">Status Distribution</h3>
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
                <p className="text-sm">No BOMs found</p>
              </div>
            </div>
          )}
        </div>

        {/* Top Products - Takes 1 column */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-purple-50 rounded-lg">
              <Package className="h-4 w-4 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm">Top Products</h3>
          </div>
          <div className="space-y-2">
            {dashboard?.topProducts?.slice(0, 4).map((product, index) => (
              <div
                key={product.productId}
                className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
              >
                <div className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-medium shrink-0">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 text-xs truncate" title={product.productName}>
                    {product.productName}
                  </p>
                  <p className="text-[10px] text-gray-500 font-mono">{product.productCode}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-gray-900 text-xs">{product.bomCount}</p>
                  <p className="text-[10px] text-green-600">{product.activeBOMs} active</p>
                </div>
              </div>
            )) || (
              <div className="text-center py-6 text-gray-400">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No data</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent BOMs - Takes 1 column */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-amber-50 rounded-lg">
              <ClipboardList className="h-4 w-4 text-amber-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm">Recent BOMs</h3>
          </div>
          <div className="space-y-2">
            {dashboard?.recentBOMs?.slice(0, 4).map((bom) => (
              <div
                key={bom.id}
                onClick={() => router.push(`/production/bom/${bom.id}`)}
                className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer group"
              >
                <div className={`w-1 h-8 rounded-full shrink-0 ${statusConfig[bom.status as keyof typeof statusConfig]?.borderColor || 'border-gray-300'} bg-current opacity-60`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="font-mono text-xs font-medium text-gray-900">{bom.code}</p>
                    <span className="text-[10px] text-gray-400">v{bom.version}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 truncate" title={bom.productName}>
                    {bom.productName}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {renderStatusBadge(bom.status)}
                  <ChevronRight className="h-3 w-3 text-gray-300 group-hover:text-emerald-500" />
                </div>
              </div>
            )) || (
              <div className="text-center py-6 text-gray-400">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No recent BOMs</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {dashboard && dashboard.draftBOMs > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-amber-800 text-sm">Pending Review</h4>
              <p className="text-xs text-amber-700 mt-0.5">
                You have <strong>{dashboard.draftBOMs}</strong> draft BOM{dashboard.draftBOMs > 1 ? 's' : ''} pending approval.
              </p>
              <button
                onClick={() => {
                  setStatusFilter('draft');
                  setActiveTab('draft');
                }}
                className="mt-1 text-xs font-medium text-amber-800 hover:text-amber-900 flex items-center gap-0.5"
              >
                View draft BOMs <ChevronRight className="h-3 w-3" />
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
              <h3 className="font-semibold text-gray-900 text-sm">BOM Registry</h3>
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
        </div>

        {/* DataGrid - Fixed width columns to prevent overflow */}
        <div className="p-3 overflow-hidden">
          <DxDataGrid
            dataSource={filteredBOMs}
            keyExpr="id"
            showBorders={false}
            rowAlternationEnabled
            loading={bomLoading}
            height={350}
            wordWrapEnabled={false}
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
              width={95}
              cellRender={(cell) => (
                <span className="font-mono font-medium text-emerald-700 text-xs">{cell.value}</span>
              )}
            />
            <DxColumn
              dataField="name"
              caption="Name"
              width={200}
              cssClass="dx-cell-truncate"
              cellRender={(cell) => (
                <div className="truncate text-xs" style={{ maxWidth: '180px' }} title={cell.value}>{cell.value}</div>
              )}
            />
            <DxColumn
              dataField="productCode"
              caption="Product"
              width={75}
              cellRender={(cell) => (
                <span className="font-mono text-gray-600 text-xs">{cell.value}</span>
              )}
            />
            <DxColumn
              dataField="standardBatchSize"
              caption="Batch"
              width={95}
              alignment="right"
              cellRender={(cell) => (
                <span className="tabular-nums text-xs">
                  {cell.data.standardBatchSize?.toLocaleString() || '-'} {cell.data.batchUnit || ''}
                </span>
              )}
            />
            <DxColumn
              dataField="version"
              caption="Ver"
              width={45}
              alignment="center"
              cellRender={(cell) => (
                <span className="text-gray-500 text-xs">v{cell.value}</span>
              )}
            />
            <DxColumn
              dataField="status"
              caption="Status"
              width={90}
              cellRender={(cell) => renderStatusBadge(cell.value)}
            />
            <DxColumn
              dataField="createdAt"
              caption="Created"
              width={85}
              dataType="date"
              format="yyyy-MM-dd"
            />
            <DxColumn
              caption=""
              width={35}
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

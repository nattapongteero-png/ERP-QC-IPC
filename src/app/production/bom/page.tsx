'use client';

/**
 * BOM (Bill of Materials) Dashboard Page
 * Feature: Production Management
 *
 * Professional dashboard for managing manufacturing BOMs with DevExtreme UI.
 * Redesigned for improved clarity and production workflow visibility.
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
import Chart, {
  ArgumentAxis,
  ValueAxis,
  Series as ChartSeries,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from 'devextreme-react/chart';
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

// Status configuration
const statusConfig = {
  draft: { label: 'Draft', color: 'bg-amber-100 text-amber-800', borderColor: 'border-amber-500' },
  active: { label: 'Active', color: 'bg-green-100 text-green-800', borderColor: 'border-green-500' },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-800', borderColor: 'border-blue-500' },
  obsolete: { label: 'Obsolete', color: 'bg-gray-100 text-gray-600', borderColor: 'border-gray-400' },
};

const statusFilters = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'approved', label: 'Approved' },
  { value: 'draft', label: 'Draft' },
  { value: 'obsolete', label: 'Obsolete' },
];

// Chart color palette - industrial/manufacturing theme
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

  const utilizationChartData = dashboard?.bomUtilization?.slice(0, 6) || [];

  const renderStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return <span className="text-gray-500">{status}</span>;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
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
    if (activeTab === 'active') return bom.status === 'active' || bom.status === 'approved';
    return bom.status === activeTab;
  }) || [];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
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

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            label="Active Work Orders"
            value={dashboard?.activeWorkOrders ?? 0}
            icon={Factory}
            iconColor="text-blue-500"
            accentColor="border-blue-500"
            isLoading={dashboardLoading}
            href="/production/work-orders"
          />
        </div>

        {/* Secondary Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            label="Materials Used"
            value={dashboard?.totalMaterials ?? 0}
            icon={Package}
            iconColor="text-purple-500"
            accentColor="border-purple-500"
            isLoading={dashboardLoading}
          />
          <StatCard
            label="Avg Materials/BOM"
            value={dashboard?.avgMaterialsPerBOM?.toFixed(1) ?? '0'}
            icon={Layers}
            iconColor="text-indigo-500"
            accentColor="border-indigo-500"
            isLoading={dashboardLoading}
          />
          <StatCard
            label="Obsolete BOMs"
            value={dashboard?.obsoleteBOMs ?? 0}
            icon={Archive}
            iconColor="text-gray-500"
            accentColor="border-gray-400"
            isLoading={dashboardLoading}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Boxes className="h-5 w-5 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900">BOM Status Distribution</h3>
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
                  <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No BOMs found</p>
                </div>
              </div>
            )}
          </div>

          {/* BOM Utilization */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Factory className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">BOM Production Usage</h3>
            </div>
            {utilizationChartData.length > 0 ? (
              <Chart dataSource={utilizationChartData} size={{ height: 260 }}>
                <ArgumentAxis label={{ overlappingBehavior: 'rotate', rotationAngle: -45 }}>
                  <Label wordWrap="none" />
                </ArgumentAxis>
                <ValueAxis />
                <ChartSeries
                  valueField="workOrderCount"
                  argumentField="bomCode"
                  name="Work Orders"
                  type="bar"
                  color="#3B82F6"
                />
                <ChartTooltip enabled />
                <ChartLegend visible={false} />
              </Chart>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-gray-400">
                <div className="text-center">
                  <Factory className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No production data yet</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top Products & Recent BOMs Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Products */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Package className="h-5 w-5 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Products with Most BOMs</h3>
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
                    <p className="font-semibold text-gray-900">{product.bomCount} BOMs</p>
                    <p className="text-xs text-green-600">{product.activeBOMs} active</p>
                  </div>
                </div>
              )) || (
                <div className="text-center py-8 text-gray-400">
                  <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No product data</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent BOMs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 rounded-lg">
                  <ClipboardList className="h-5 w-5 text-amber-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Recently Created BOMs</h3>
              </div>
            </div>
            <div className="space-y-2">
              {dashboard?.recentBOMs?.slice(0, 6).map((bom) => (
                <div
                  key={bom.id}
                  onClick={() => router.push(`/production/bom/${bom.id}`)}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-1 h-10 rounded-full ${statusConfig[bom.status as keyof typeof statusConfig]?.borderColor || 'border-gray-300'} bg-current opacity-60`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm font-medium text-gray-900">{bom.code}</p>
                        <span className="text-xs text-gray-400">v{bom.version}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{bom.productName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      {renderStatusBadge(bom.status)}
                      <p className="text-xs text-gray-400 mt-1">{bom.materialCount} materials</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-emerald-500 transition-colors" />
                  </div>
                </div>
              )) || (
                <div className="text-center py-8 text-gray-400">
                  <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No recent BOMs</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alerts Section */}
        {dashboard && dashboard.draftBOMs > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h4 className="font-semibold text-amber-800">Pending Review</h4>
                <p className="text-sm text-amber-700 mt-1">
                  You have <strong>{dashboard.draftBOMs}</strong> draft BOM{dashboard.draftBOMs > 1 ? 's' : ''} pending approval.
                  Review and approve them to make them available for production.
                </p>
                <button
                  onClick={() => {
                    setStatusFilter('draft');
                    setActiveTab('draft');
                  }}
                  className="mt-2 text-sm font-medium text-amber-800 hover:text-amber-900 flex items-center gap-1"
                >
                  View draft BOMs <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BOM List Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Tabs Header */}
          <div className="border-b border-gray-100 px-5 pt-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <Settings className="h-5 w-5 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-gray-900">BOM Registry</h3>
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
                  All ({bomData?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="active">
                  Active ({bomData?.filter((b: { status: string }) => b.status === 'active' || b.status === 'approved').length || 0})
                </TabsTrigger>
                <TabsTrigger value="draft">
                  Draft ({bomData?.filter((b: { status: string }) => b.status === 'draft').length || 0})
                </TabsTrigger>
                <TabsTrigger value="obsolete">
                  Obsolete ({bomData?.filter((b: { status: string }) => b.status === 'obsolete').length || 0})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* DataGrid */}
          <div className="p-4">
            <DxDataGrid
              dataSource={filteredBOMs}
              keyExpr="id"
              showBorders={false}
              rowAlternationEnabled
              loading={bomLoading}
              onRowClick={(e) => {
                if (e.data?.id) {
                  router.push(`/production/bom/${e.data.id}`);
                }
              }}
            >
              <DxSearchPanel visible placeholder="Search BOMs..." />
              <DxPaging defaultPageSize={15} />

              <DxColumn
                dataField="code"
                caption="BOM Code"
                width={130}
                cellRender={(cell) => (
                  <span className="font-mono font-medium text-emerald-700">{cell.value}</span>
                )}
              />
              <DxColumn dataField="name" caption="BOM Name" minWidth={180} />
              <DxColumn
                dataField="productCode"
                caption="Product"
                width={120}
                cellRender={(cell) => (
                  <span className="font-mono text-gray-600">{cell.value}</span>
                )}
              />
              <DxColumn dataField="productName" caption="Product Name" minWidth={150} />
              <DxColumn
                dataField="standardBatchSize"
                caption="Batch Size"
                width={130}
                alignment="right"
                cellRender={(cell) => (
                  <span className="tabular-nums">
                    {cell.data.standardBatchSize?.toLocaleString() || '-'} {cell.data.batchUnit || ''}
                  </span>
                )}
              />
              <DxColumn
                dataField="version"
                caption="Version"
                width={90}
                alignment="center"
                cellRender={(cell) => (
                  <span className="text-gray-500">v{cell.value}</span>
                )}
              />
              <DxColumn
                dataField="status"
                caption="Status"
                width={120}
                cellRender={(cell) => renderStatusBadge(cell.value)}
              />
              <DxColumn
                dataField="createdAt"
                caption="Created"
                width={110}
                dataType="date"
                format="yyyy-MM-dd"
              />
              <DxColumn
                caption=""
                width={60}
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

'use client';

// Template Dashboard - Professional ERP Module Prototype
// A professional, informative dashboard with KPIs, charts, and quick access

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  LayoutGrid,
  Package,
  FolderTree,
  TrendingUp,
  AlertCircle,
  Clock,
  Plus,
  ChevronRight,
  Layers,
  FileEdit,
  CheckCircle,
} from 'lucide-react';
// DevExtreme Chart imports
import { PieChart, Series, Label, Legend, Tooltip, Connector } from 'devextreme-react/pie-chart';
import {
  Chart,
  CommonSeriesSettings,
  Series as ChartSeries,
  ArgumentAxis,
  ValueAxis,
  Legend as ChartLegend,
  Tooltip as ChartTooltip,
} from 'devextreme-react/chart';
import { KPICard, KPICardSkeleton } from '@/components/ui/kpi-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from 'devextreme-react/button';
import { TemplatePageHeader, TemplateStatusBadge, TemplatePriorityBadge } from '@/components/template';
import type { TemplateDashboardMetrics, TemplateItem } from '@/types/template';

async function fetchDashboardMetrics(): Promise<TemplateDashboardMetrics> {
  const res = await fetch('/api/template/dashboard');
  if (!res.ok) throw new Error('Failed to fetch dashboard metrics');
  const data = await res.json();
  return data.data;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompactCurrency(amount: number): string {
  if (Math.abs(amount) >= 1000000) {
    return `฿${(amount / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1000) {
    return `฿${(amount / 1000).toFixed(0)}K`;
  }
  return formatCurrency(amount);
}

const quickLinks = [
  {
    name: 'All Items',
    href: '/template/items',
    icon: Package,
    description: 'View and manage all items',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    name: 'New Item',
    href: '/template/items/new',
    icon: Plus,
    description: 'Create a new item',
    color: 'bg-green-50 text-green-600',
  },
  {
    name: 'Categories',
    href: '/template/categories',
    icon: FolderTree,
    description: 'Manage categories',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    name: 'Reports',
    href: '/template/reports',
    icon: TrendingUp,
    description: 'View analytics and reports',
    color: 'bg-amber-50 text-amber-600',
  },
];

const STATUS_COLORS: Record<string, string> = {
  draft: '#6B7280',
  active: '#22C55E',
  archived: '#F59E0B',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#94A3B8',
  medium: '#3B82F6',
  high: '#F97316',
  urgent: '#EF4444',
};

export default function TemplateDashboardPage() {
  const { data: metrics, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['template-dashboard'],
    queryFn: fetchDashboardMetrics,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Prepare chart data for DevExtreme
  const statusChartData = metrics?.itemsByStatus.map((item) => ({
    status: item.status.charAt(0).toUpperCase() + item.status.slice(1),
    count: item.count,
    color: STATUS_COLORS[item.status] || '#6B7280',
  })) || [];

  const priorityChartData = metrics?.itemsByPriority.map((item) => ({
    priority: item.priority.charAt(0).toUpperCase() + item.priority.slice(1),
    count: item.count,
    color: PRIORITY_COLORS[item.priority] || '#6B7280',
  })) || [];

  const trendChartData = metrics?.monthlyTrend || [];
  const categoryChartData = metrics?.itemsByCategory.slice(0, 5) || [];

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <TemplatePageHeader
        title="Template Dashboard"
        subtitle="ERP Module Prototype"
        icon={LayoutGrid}
        iconClassName="from-blue-500 to-indigo-600"
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        actions={
          <Button
            text="New Item"
            icon="add"
            type="success"
            onClick={() => window.location.href = '/template/items/new'}
          />
        }
      />

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              label="Total Items"
              value={metrics?.totalItems || 0}
              subtitle="All items in system"
              icon={<Layers className="h-6 w-6" />}
              iconBgColor="bg-blue-100"
              iconColor="text-blue-600"
            />
            <KPICard
              label="Active Items"
              value={metrics?.activeItems || 0}
              subtitle="Currently active"
              icon={<CheckCircle className="h-6 w-6" />}
              iconBgColor="bg-green-100"
              iconColor="text-green-600"
              trend="up"
              trendValue={`${Math.round((metrics?.activeItems || 0) / Math.max(metrics?.totalItems || 1, 1) * 100)}%`}
            />
            <KPICard
              label="Draft Items"
              value={metrics?.draftItems || 0}
              subtitle="Pending review"
              icon={<FileEdit className="h-6 w-6" />}
              iconBgColor="bg-gray-100"
              iconColor="text-gray-600"
            />
            <KPICard
              label="Total Value"
              value={formatCurrency(metrics?.totalValue || 0)}
              subtitle="Portfolio value"
              icon={<TrendingUp className="h-6 w-6" />}
              iconBgColor="bg-emerald-100"
              iconColor="text-emerald-600"
            />
          </>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution - DevExtreme PieChart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-500" />
              Items by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[250px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">Loading...</div>
              </div>
            ) : statusChartData.length > 0 ? (
              <PieChart
                id="status-pie-chart"
                dataSource={statusChartData}
                type="doughnut"
                innerRadius={0.6}
                palette={statusChartData.map(d => d.color)}
              >
                <Series argumentField="status" valueField="count">
                  <Label
                    visible={true}
                    position="inside"
                    customizeText={(e: { valueText: string }) => e.valueText}
                  >
                    <Connector visible={false} />
                  </Label>
                </Series>
                <Legend
                  visible={true}
                  horizontalAlignment="center"
                  verticalAlignment="bottom"
                  itemTextPosition="right"
                />
                <Tooltip
                  enabled={true}
                  customizeTooltip={(arg: { argumentText: string; valueText: string }) => ({
                    text: `${arg.argumentText}: ${arg.valueText}`,
                  })}
                />
              </PieChart>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Priority Distribution - DevExtreme Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Items by Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[250px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">Loading...</div>
              </div>
            ) : priorityChartData.length > 0 ? (
              <Chart
                id="priority-bar-chart"
                dataSource={priorityChartData}
                rotated={true}
              >
                <CommonSeriesSettings
                  type="bar"
                  argumentField="priority"
                  valueField="count"
                  barWidth={25}
                />
                <ChartSeries
                  name="Count"
                  color="#3B82F6"
                  hoverMode="allArgumentPoints"
                />
                <ArgumentAxis />
                <ValueAxis />
                <ChartLegend visible={false} />
                <ChartTooltip
                  enabled={true}
                  customizeTooltip={(arg: { argumentText: string; valueText: string }) => ({
                    text: `${arg.argumentText}: ${arg.valueText} items`,
                  })}
                />
              </Chart>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Trend - DevExtreme Area Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Monthly Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[250px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">Loading...</div>
              </div>
            ) : trendChartData.length > 0 ? (
              <Chart
                id="trend-area-chart"
                dataSource={trendChartData}
              >
                <CommonSeriesSettings
                  type="area"
                  argumentField="month"
                  valueField="count"
                />
                <ChartSeries
                  name="Items"
                  color="#10B981"
                  opacity={0.6}
                />
                <ArgumentAxis />
                <ValueAxis />
                <ChartLegend visible={false} />
                <ChartTooltip
                  enabled={true}
                  customizeTooltip={(arg: { argumentText: string; valueText: string }) => ({
                    text: `${arg.argumentText}: ${arg.valueText} items`,
                  })}
                />
              </Chart>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown & Recent Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-purple-500" />
              Top Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[200px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">Loading...</div>
              </div>
            ) : categoryChartData.length > 0 ? (
              <div className="space-y-3">
                {categoryChartData.map((cat, index) => (
                  <div key={cat.categoryId} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{cat.categoryName}</p>
                      <p className="text-sm text-gray-500">{cat.count} items</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCompactCurrency(cat.value)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-400">
                No categories found
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Items */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              Recent Items
            </CardTitle>
            <Link href="/template/items" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[200px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">Loading...</div>
              </div>
            ) : (metrics?.recentItems?.length || 0) > 0 ? (
              <div className="space-y-3">
                {metrics?.recentItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/template/items/${item.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-colors cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{item.nameTh}</p>
                      <p className="text-sm text-gray-500">{item.code}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <TemplateStatusBadge status={item.status} size="sm" showIcon={false} />
                      <TemplatePriorityBadge priority={item.priority} size="sm" showIcon={false} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center text-gray-400">
                <Package className="h-12 w-12 mb-2 opacity-50" />
                <p>No items found</p>
                <Link href="/template/items/new" className="mt-2 text-sm text-blue-600 hover:text-blue-700">
                  Create your first item
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex flex-col p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
            >
              <div className={`p-2.5 rounded-lg w-fit ${link.color}`}>
                <link.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                {link.name}
              </h3>
              <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                {link.description}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* System Overview Footer */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{metrics?.totalItems || 0}</p>
              <p className="text-sm text-gray-500">Total Items</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{metrics?.activeItems || 0}</p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-600">{metrics?.draftItems || 0}</p>
              <p className="text-sm text-gray-500">Draft</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{metrics?.archivedItems || 0}</p>
              <p className="text-sm text-gray-500">Archived</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

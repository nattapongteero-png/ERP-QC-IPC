'use client';

// Template Dashboard - DevExtreme Charts Showcase
// Comprehensive demo of DevExtreme chart components for ERP dashboards

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
  Target,
  Activity,
  BarChart3,
  PieChartIcon,
  Gauge,
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
  Title,
  Size,
  Grid,
  Point,
  Border,
} from 'devextreme-react/chart';
import { CircularGauge, Scale, RangeContainer, Range, ValueIndicator, Geometry } from 'devextreme-react/circular-gauge';
import { LinearGauge, Scale as LinearScale, RangeContainer as LinearRangeContainer, Range as LinearRange, ValueIndicator as LinearValueIndicator } from 'devextreme-react/linear-gauge';
import { Sparkline, Tooltip as SparklineTooltip } from 'devextreme-react/sparkline';
import { BarGauge, Label as BarGaugeLabel, Legend as BarGaugeLegend } from 'devextreme-react/bar-gauge';
import Funnel, { Item, Label as FunnelLabel, Tooltip as FunnelTooltip } from 'devextreme-react/funnel';
import { PolarChart, CommonSeriesSettings as PolarCommonSeriesSettings, Series as PolarSeries, ArgumentAxis as PolarArgumentAxis, ValueAxis as PolarValueAxis } from 'devextreme-react/polar-chart';

import { KPICard, KPICardSkeleton } from '@/components/ui/kpi-card';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from 'devextreme-react/button';
import { TemplatePageHeader, TemplateStatusBadge, TemplatePriorityBadge } from '@/components/template';
import type { TemplateDashboardMetrics } from '@/types/template';

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

// Demo workflow data for funnel chart
const workflowData = [
  { stage: 'Created', count: 100 },
  { stage: 'In Review', count: 80 },
  { stage: 'Approved', count: 65 },
  { stage: 'Active', count: 50 },
  { stage: 'Completed', count: 35 },
];

// Demo performance data for polar chart
const performanceData = [
  { category: 'Quality', score: 85 },
  { category: 'Speed', score: 70 },
  { category: 'Accuracy', score: 90 },
  { category: 'Efficiency', score: 75 },
  { category: 'Cost', score: 60 },
  { category: 'Safety', score: 95 },
];

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

  // Calculate percentages for gauges
  const activePercentage = metrics ? Math.round((metrics.activeItems / Math.max(metrics.totalItems, 1)) * 100) : 0;
  const draftPercentage = metrics ? Math.round((metrics.draftItems / Math.max(metrics.totalItems, 1)) * 100) : 0;

  // Generate sparkline data from trend
  const sparklineData = trendChartData.map(t => t.count);
  const valueSparklineData = trendChartData.map(t => t.value / 10000); // Scale down for display

  // Bar gauge data for multiple metrics
  const barGaugeValues = [activePercentage, draftPercentage, 100 - activePercentage - draftPercentage];

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <TemplatePageHeader
        title="Template Dashboard"
        subtitle="DevExtreme Charts Showcase - ERP Module Demo"
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

      {/* Section 1: KPI Cards with Mini Sparklines */}
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
            {/* Total Items with Sparkline */}
            <Card className="relative overflow-hidden">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Items</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{metrics?.totalItems || 0}</p>
                    <p className="text-xs text-gray-400 mt-1">All items in system</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-100">
                    <Layers className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                {sparklineData.length > 0 && (
                  <div className="mt-4 h-[40px]">
                    <Sparkline
                      dataSource={sparklineData}
                      type="area"
                      lineColor="#3B82F6"
                      lineWidth={2}
                      showMinMax={false}
                      showFirstLast={false}
                    >
                      <SparklineTooltip enabled={true} format="fixedPoint" />
                    </Sparkline>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active Items with Gauge Preview */}
            <Card className="relative overflow-hidden">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Active Items</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">{metrics?.activeItems || 0}</p>
                    <p className="text-xs text-gray-400 mt-1">{activePercentage}% of total</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-green-100">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div className="mt-4 h-[40px]">
                  <Sparkline
                    dataSource={sparklineData}
                    type="splinearea"
                    lineColor="#22C55E"
                    lineWidth={2}
                    showMinMax={true}
                    minColor="#F97316"
                    maxColor="#22C55E"
                  >
                    <SparklineTooltip enabled={true} />
                  </Sparkline>
                </div>
              </CardContent>
            </Card>

            {/* Draft Items with Bar Sparkline */}
            <Card className="relative overflow-hidden">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Draft Items</p>
                    <p className="text-3xl font-bold text-gray-600 mt-1">{metrics?.draftItems || 0}</p>
                    <p className="text-xs text-gray-400 mt-1">Pending review</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-gray-100">
                    <FileEdit className="h-6 w-6 text-gray-600" />
                  </div>
                </div>
                <div className="mt-4 h-[40px]">
                  <Sparkline
                    dataSource={sparklineData}
                    type="bar"
                    barPositiveColor="#6B7280"
                    barNegativeColor="#EF4444"
                  >
                    <SparklineTooltip enabled={true} />
                  </Sparkline>
                </div>
              </CardContent>
            </Card>

            {/* Total Value with Win/Loss Sparkline */}
            <Card className="relative overflow-hidden">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Value</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCompactCurrency(metrics?.totalValue || 0)}</p>
                    <p className="text-xs text-gray-400 mt-1">Portfolio value</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-100">
                    <TrendingUp className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
                <div className="mt-4 h-[40px]">
                  <Sparkline
                    dataSource={valueSparklineData}
                    type="winloss"
                    winColor="#22C55E"
                    lossColor="#EF4444"
                  >
                    <SparklineTooltip enabled={true} />
                  </Sparkline>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Section 2: Gauges Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Circular Gauge - Active Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Gauge className="h-5 w-5 text-green-500" />
              Active Items Rate
            </CardTitle>
            <CardDescription>Percentage of active items</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            {isLoading ? (
              <div className="h-[200px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">Loading...</div>
              </div>
            ) : (
              <CircularGauge
                id="active-rate-gauge"
                value={activePercentage}
              >
                <Size height={200} />
                <Scale startValue={0} endValue={100} tickInterval={20} />
                <RangeContainer>
                  <Range startValue={0} endValue={30} color="#EF4444" />
                  <Range startValue={30} endValue={70} color="#F59E0B" />
                  <Range startValue={70} endValue={100} color="#22C55E" />
                </RangeContainer>
                <ValueIndicator type="rectangleNeedle" color="#3B82F6" />
                <Geometry startAngle={180} endAngle={0} />
              </CircularGauge>
            )}
          </CardContent>
        </Card>

        {/* Linear Gauge - Target Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              Monthly Target
            </CardTitle>
            <CardDescription>Progress towards 100 items goal</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[200px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">Loading...</div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center">
                <LinearGauge
                  id="target-gauge"
                  value={metrics?.totalItems || 0}
                >
                  <Size width={300} height={80} />
                  <LinearScale startValue={0} endValue={100} tickInterval={25}>
                  </LinearScale>
                  <LinearRangeContainer>
                    <LinearRange startValue={0} endValue={25} color="#EF4444" />
                    <LinearRange startValue={25} endValue={50} color="#F59E0B" />
                    <LinearRange startValue={50} endValue={75} color="#3B82F6" />
                    <LinearRange startValue={75} endValue={100} color="#22C55E" />
                  </LinearRangeContainer>
                  <LinearValueIndicator type="rectangle" color="#1F2937" />
                </LinearGauge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar Gauge - Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-500" />
              Status Distribution
            </CardTitle>
            <CardDescription>Active / Draft / Archived</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            {isLoading ? (
              <div className="h-[200px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">Loading...</div>
              </div>
            ) : (
              <BarGauge
                id="status-bar-gauge"
                values={barGaugeValues}
                startValue={0}
                endValue={100}
                palette={['#22C55E', '#6B7280', '#F59E0B']}
              >
                <Size height={200} />
                <BarGaugeLabel visible={true} indent={20} />
                <BarGaugeLegend
                  visible={true}
                  verticalAlignment="bottom"
                  horizontalAlignment="center"
                  customizeText={(arg: { item: { index: number } }) => {
                    const labels = ['Active', 'Draft', 'Archived'];
                    return labels[arg.item.index];
                  }}
                />
              </BarGauge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 3: Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie Chart - Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-blue-500" />
              Items by Status
            </CardTitle>
            <CardDescription>Doughnut chart visualization</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">Loading...</div>
              </div>
            ) : statusChartData.length > 0 ? (
              <PieChart
                id="status-pie-chart"
                dataSource={statusChartData}
                type="doughnut"
                innerRadius={0.65}
                palette={statusChartData.map(d => d.color)}
              >
                <Size height={280} />
                <Series argumentField="status" valueField="count">
                  <Label
                    visible={true}
                    position="columns"
                    customizeText={(e: { argumentText: string; percentText: string }) =>
                      `${e.argumentText}\n${e.percentText}`
                    }
                  >
                    <Connector visible={true} width={1} />
                  </Label>
                </Series>
                <Legend visible={false} />
                <Tooltip
                  enabled={true}
                  customizeTooltip={(arg: { argumentText: string; valueText: string; percentText: string }) => ({
                    text: `${arg.argumentText}: ${arg.valueText} (${arg.percentText})`,
                  })}
                />
              </PieChart>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart - Priority Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-orange-500" />
              Items by Priority
            </CardTitle>
            <CardDescription>Horizontal bar chart</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">Loading...</div>
              </div>
            ) : priorityChartData.length > 0 ? (
              <Chart
                id="priority-bar-chart"
                dataSource={priorityChartData}
                rotated={true}
              >
                <Size height={280} />
                <CommonSeriesSettings
                  type="bar"
                  argumentField="priority"
                  valueField="count"
                  barWidth={30}
                  cornerRadius={4}
                />
                <ChartSeries
                  name="Count"
                  color="#F97316"
                  hoverMode="allArgumentPoints"
                />
                <ArgumentAxis>
                  <Grid visible={false} />
                </ArgumentAxis>
                <ValueAxis>
                  <Grid visible={true} color="#E5E7EB" />
                </ValueAxis>
                <ChartLegend visible={false} />
                <ChartTooltip
                  enabled={true}
                  customizeTooltip={(arg: { argumentText: string; valueText: string }) => ({
                    text: `${arg.argumentText}: ${arg.valueText} items`,
                  })}
                />
              </Chart>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spline Area Chart - Monthly Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Monthly Trend
            </CardTitle>
            <CardDescription>Spline area chart with gradient</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">Loading...</div>
              </div>
            ) : trendChartData.length > 0 ? (
              <Chart
                id="trend-spline-chart"
                dataSource={trendChartData}
              >
                <Size height={280} />
                <CommonSeriesSettings
                  type="splinearea"
                  argumentField="month"
                />
                <ChartSeries
                  valueField="count"
                  name="Items"
                  color="#10B981"
                  opacity={0.4}
                />
                <ChartSeries
                  valueField="value"
                  name="Value (x1000)"
                  color="#3B82F6"
                  opacity={0.3}
                  axis="valueAxis"
                />
                <ArgumentAxis>
                  <Grid visible={false} />
                </ArgumentAxis>
                <ValueAxis name="countAxis" position="left">
                  <Grid visible={true} color="#E5E7EB" />
                </ValueAxis>
                <ValueAxis name="valueAxis" position="right">
                  <Grid visible={false} />
                </ValueAxis>
                <ChartLegend
                  visible={true}
                  verticalAlignment="bottom"
                  horizontalAlignment="center"
                />
                <ChartTooltip
                  enabled={true}
                  shared={true}
                />
              </Chart>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 4: Advanced Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel Chart - Workflow Pipeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-500" />
              Workflow Pipeline
            </CardTitle>
            <CardDescription>Funnel chart showing item lifecycle stages</CardDescription>
          </CardHeader>
          <CardContent>
            <Funnel
              id="workflow-funnel"
              dataSource={workflowData}
              argumentField="stage"
              valueField="count"
              palette="Soft Pastel"
              sortData={false}
            >
              <Size height={300} />
              <FunnelLabel
                visible={true}
                position="inside"
                backgroundColor="none"
                customizeText={(info: { item: { argument: string; value: number; percent: number } }) =>
                  `${info.item.argument}: ${info.item.value}`
                }
              />
              <Item>
                <Border visible={true} color="#fff" width={2} />
              </Item>
              <FunnelTooltip
                enabled={true}
                customizeTooltip={(info: { item: { argument: string; value: number; percent: number } }) => ({
                  text: `${info.item.argument}\nCount: ${info.item.value}\nConversion: ${(info.item.percent * 100).toFixed(1)}%`,
                })}
              />
            </Funnel>
          </CardContent>
        </Card>

        {/* Polar Chart - Performance Radar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="h-5 w-5 text-cyan-500" />
              Performance Metrics
            </CardTitle>
            <CardDescription>Polar/Radar chart for multi-dimensional analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <PolarChart
              id="performance-polar"
              dataSource={performanceData}
            >
              <Size height={300} />
              <PolarCommonSeriesSettings type="line" closed={true} />
              <PolarSeries
                valueField="score"
                argumentField="category"
                name="Score"
                color="#06B6D4"
              >
                <Point visible={true} size={8} color="#06B6D4" />
              </PolarSeries>
              <PolarArgumentAxis>
                <Grid visible={true} />
              </PolarArgumentAxis>
              <PolarValueAxis>
                <Grid visible={true} />
              </PolarValueAxis>
              <Tooltip
                enabled={true}
                customizeTooltip={(arg: { argumentText: string; valueText: string }) => ({
                  text: `${arg.argumentText}: ${arg.valueText}%`,
                })}
              />
              <Legend visible={false} />
            </PolarChart>
          </CardContent>
        </Card>
      </div>

      {/* Section 5: Category & Stacked Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stacked Bar - Category Comparison */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-purple-500" />
              Category Analysis
            </CardTitle>
            <CardDescription>Stacked bar showing items and value by category</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">Loading...</div>
              </div>
            ) : categoryChartData.length > 0 ? (
              <Chart
                id="category-stacked-chart"
                dataSource={categoryChartData}
              >
                <Size height={280} />
                <CommonSeriesSettings
                  type="bar"
                  argumentField="categoryName"
                  cornerRadius={4}
                />
                <ChartSeries
                  valueField="count"
                  name="Items Count"
                  color="#8B5CF6"
                  barWidth={25}
                />
                <ChartSeries
                  valueField="value"
                  name="Value (THB)"
                  color="#EC4899"
                  barWidth={25}
                  axis="valueAxis"
                />
                <ArgumentAxis>
                  <Grid visible={false} />
                </ArgumentAxis>
                <ValueAxis name="countAxis" position="left" title="Items" />
                <ValueAxis name="valueAxis" position="right" title="Value" />
                <ChartLegend
                  visible={true}
                  verticalAlignment="bottom"
                  horizontalAlignment="center"
                />
                <ChartTooltip enabled={true} shared={true} />
              </Chart>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-400">
                No categories found
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Items List */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-500" />
                Recent Items
              </CardTitle>
              <CardDescription>Latest items added to the system</CardDescription>
            </div>
            <Link href="/template/items" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[280px] flex items-center justify-center">
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
              <div className="h-[280px] flex flex-col items-center justify-center text-gray-400">
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
          {[
            { name: 'All Items', href: '/template/items', icon: Package, desc: 'View and manage all items', color: 'bg-blue-50 text-blue-600' },
            { name: 'New Item', href: '/template/items/new', icon: Plus, desc: 'Create a new item', color: 'bg-green-50 text-green-600' },
            { name: 'Categories', href: '/template/categories', icon: FolderTree, desc: 'Manage categories', color: 'bg-purple-50 text-purple-600' },
            { name: 'Reports', href: '/template/reports', icon: TrendingUp, desc: 'View analytics', color: 'bg-amber-50 text-amber-600' },
          ].map((link) => (
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
              <p className="mt-1 text-xs text-gray-500 line-clamp-2">{link.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Chart Types Reference */}
      <Card className="bg-gradient-to-br from-slate-50 to-blue-50">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">DevExtreme Charts Reference</CardTitle>
          <CardDescription>This dashboard demonstrates the following chart types available in DevExtreme React</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { name: 'Sparkline', types: 'Area, Bar, Line, WinLoss' },
              { name: 'Circular Gauge', types: 'With range indicators' },
              { name: 'Linear Gauge', types: 'Horizontal progress' },
              { name: 'Bar Gauge', types: 'Multi-value circular' },
              { name: 'Pie/Doughnut', types: 'With labels & legend' },
              { name: 'Bar Chart', types: 'Horizontal bars' },
              { name: 'Spline Area', types: 'Multi-series, dual axis' },
              { name: 'Funnel', types: 'Pipeline visualization' },
              { name: 'Polar/Radar', types: 'Performance metrics' },
              { name: 'Stacked Bar', types: 'Category comparison' },
            ].map((chart) => (
              <div key={chart.name} className="p-3 bg-white rounded-lg border border-gray-100">
                <p className="font-medium text-gray-900 text-sm">{chart.name}</p>
                <p className="text-xs text-gray-500 mt-1">{chart.types}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

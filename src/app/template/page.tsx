'use client';

// Template Dashboard - DevExtreme Charts Showcase
// Comprehensive demo of DevExtreme chart components for ERP dashboards

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
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

export default function TemplateDashboardPage() {
  const t = useTranslations('template.dashboard');
  const locale = useLocale();

  // Demo workflow data for funnel chart
  const workflowData = React.useMemo(() => [
    { stage: t('workflowStages.created'), count: 100 },
    { stage: t('workflowStages.inReview'), count: 80 },
    { stage: t('workflowStages.approved'), count: 65 },
    { stage: t('workflowStages.active'), count: 50 },
    { stage: t('workflowStages.completed'), count: 35 },
  ], [t]);

  // Demo performance data for polar chart
  const performanceData = React.useMemo(() => [
    { category: t('performance.quality'), score: 85 },
    { category: t('performance.speed'), score: 70 },
    { category: t('performance.accuracy'), score: 90 },
    { category: t('performance.efficiency'), score: 75 },
    { category: t('performance.cost'), score: 60 },
    { category: t('performance.safety'), score: 95 },
  ], [t]);

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
  const sparklineData = trendChartData.map(d => d.count);
  const valueSparklineData = trendChartData.map(d => d.value / 10000); // Scale down for display

  // Bar gauge data for multiple metrics
  const barGaugeValues = [activePercentage, draftPercentage, 100 - activePercentage - draftPercentage];

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      {/* Header */}
      <TemplatePageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        icon={LayoutGrid}
        iconClassName="from-blue-500 to-indigo-600"
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        actions={
          <Button
            text={t('newItem')}
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
                    <p className="text-sm font-medium text-gray-500">{t('kpi.totalItems')}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{metrics?.totalItems || 0}</p>
                    <p className="text-xs text-gray-400 mt-1">{t('kpi.totalItemsDescription')}</p>
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
                    <p className="text-sm font-medium text-gray-500">{t('kpi.activeItems')}</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">{metrics?.activeItems || 0}</p>
                    <p className="text-xs text-gray-400 mt-1">{t('kpi.activeItemsPercent', { percent: activePercentage })}</p>
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
                    <p className="text-sm font-medium text-gray-500">{t('kpi.draftItems')}</p>
                    <p className="text-3xl font-bold text-gray-600 mt-1">{metrics?.draftItems || 0}</p>
                    <p className="text-xs text-gray-400 mt-1">{t('kpi.draftItemsDescription')}</p>
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
                    <p className="text-sm font-medium text-gray-500">{t('kpi.totalValue')}</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCompactCurrency(metrics?.totalValue || 0)}</p>
                    <p className="text-xs text-gray-400 mt-1">{t('kpi.totalValueDescription')}</p>
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
              {t('cards.activeRate')}
            </CardTitle>
            <CardDescription>{t('cards.activeRateDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            {isLoading ? (
              <div className="h-[200px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">{t('loading')}</div>
              </div>
            ) : (
              <CircularGauge
                key={locale}
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
              {t('cards.monthlyTarget')}
            </CardTitle>
            <CardDescription>{t('cards.monthlyTargetDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[200px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">{t('loading')}</div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center">
                <LinearGauge
                  key={locale}
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
              {t('cards.statusDistribution')}
            </CardTitle>
            <CardDescription>{t('cards.statusDistributionDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            {isLoading ? (
              <div className="h-[200px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">{t('loading')}</div>
              </div>
            ) : (
              <BarGauge
                key={locale}
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
                  customizeText={(arg: { item: { index?: number } }) => {
                    const labels = [t('statuses.active'), t('statuses.draft'), t('statuses.archived')];
                    return labels[arg.item.index ?? 0];
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
              {t('cards.itemsByStatus')}
            </CardTitle>
            <CardDescription>{t('cards.itemsByStatusDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">{t('loading')}</div>
              </div>
            ) : statusChartData.length > 0 ? (
              <PieChart
                key={locale}
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
                <Legend
                  visible={true}
                  orientation="horizontal"
                  horizontalAlignment="center"
                  verticalAlignment="bottom"
                  itemTextPosition="right"
                  customizeText={(info: { pointName?: string; pointIndex?: number }) => {
                    const d = statusChartData[info.pointIndex ?? -1];
                    return d ? `${info.pointName} (${d.count})` : (info.pointName ?? '');
                  }}
                />
                <Tooltip
                  enabled={true}
                  customizeTooltip={(arg: { argumentText?: string; valueText?: string; percentText?: string }) => ({
                    text: `${arg.argumentText ?? ''}: ${arg.valueText ?? ''} (${arg.percentText ?? ''})`,
                  })}
                />
              </PieChart>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-400">
                {t('noData')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart - Priority Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-orange-500" />
              {t('cards.itemsByPriority')}
            </CardTitle>
            <CardDescription>{t('cards.itemsByPriorityDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">{t('loading')}</div>
              </div>
            ) : priorityChartData.length > 0 ? (
              <Chart
                key={locale}
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
                  name={t('chartSeries.count')}
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
                  customizeTooltip={(arg: { argumentText?: string; valueText?: string }) => ({
                    text: `${arg.argumentText ?? ''}: ${arg.valueText ?? ''} ${t('chartSeries.items').toLowerCase()}`,
                  })}
                />
              </Chart>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-400">
                {t('noData')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spline Area Chart - Monthly Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              {t('cards.monthlyTrend')}
            </CardTitle>
            <CardDescription>{t('cards.monthlyTrendDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">{t('loading')}</div>
              </div>
            ) : trendChartData.length > 0 ? (
              <Chart
                key={locale}
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
                  name={t('chartSeries.items')}
                  color="#10B981"
                  opacity={0.4}
                />
                <ChartSeries
                  valueField="value"
                  name={t('chartSeries.valueScaled')}
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
                {t('noData')}
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
              {t('cards.workflowPipeline')}
            </CardTitle>
            <CardDescription>{t('cards.workflowPipelineDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Funnel
              key={locale}
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
                customizeText={(info: { item: { argument?: string | number | Date; value?: number; percent?: number } }) =>
                  `${info.item.argument ?? ''}: ${info.item.value ?? 0}`
                }
              />
              <Item>
                <Border visible={true} color="#fff" width={2} />
              </Item>
              <FunnelTooltip
                enabled={true}
                customizeTooltip={(info: { item: { argument?: string | number | Date; value?: number; percent?: number } }) => ({
                  text: `${info.item.argument ?? ''}\n${t('chartSeries.count')}: ${info.item.value ?? 0}\n${t('chartSeries.conversion')}: ${((info.item.percent ?? 0) * 100).toFixed(1)}%`,
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
              {t('cards.performanceMetrics')}
            </CardTitle>
            <CardDescription>{t('cards.performanceMetricsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <PolarChart
              key={locale}
              id="performance-polar"
              dataSource={performanceData}
            >
              <Size height={300} />
              <PolarCommonSeriesSettings type="line" closed={true} />
              <PolarSeries
                valueField="score"
                argumentField="category"
                name={t('chartSeries.score')}
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
                customizeTooltip={(arg: { argumentText?: string; valueText?: string }) => ({
                  text: `${arg.argumentText ?? ''}: ${arg.valueText ?? ''}%`,
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
              {t('cards.categoryAnalysis')}
            </CardTitle>
            <CardDescription>{t('cards.categoryAnalysisDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">{t('loading')}</div>
              </div>
            ) : categoryChartData.length > 0 ? (
              <Chart
                key={locale}
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
                  name={t('chartSeries.itemsCount')}
                  color="#8B5CF6"
                  barWidth={25}
                />
                <ChartSeries
                  valueField="value"
                  name={t('chartSeries.valueThb')}
                  color="#EC4899"
                  barWidth={25}
                  axis="valueAxis"
                />
                <ArgumentAxis>
                  <Grid visible={false} />
                </ArgumentAxis>
                <ValueAxis name="countAxis" position="left" title={t('chartSeries.itemsAxis')} />
                <ValueAxis name="valueAxis" position="right" title={t('chartSeries.valueAxis')} />
                <ChartLegend
                  visible={true}
                  verticalAlignment="bottom"
                  horizontalAlignment="center"
                />
                <ChartTooltip enabled={true} shared={true} />
              </Chart>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-400">
                {t('noCategories')}
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
                {t('cards.recentItems')}
              </CardTitle>
              <CardDescription>{t('cards.recentItemsDescription')}</CardDescription>
            </div>
            <Link href="/template/items" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              {t('viewAll')} <ChevronRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="animate-pulse text-gray-400">{t('loading')}</div>
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
                <p>{t('noItemsFound')}</p>
                <Link href="/template/items/new" className="mt-2 text-sm text-blue-600 hover:text-blue-700">
                  {t('createFirstItem')}
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('quickAccess')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: t('quickLinks.allItems'), href: '/template/items', icon: Package, desc: t('quickLinks.allItemsDescription'), color: 'bg-blue-50 text-blue-600' },
            { name: t('quickLinks.newItem'), href: '/template/items/new', icon: Plus, desc: t('quickLinks.newItemDescription'), color: 'bg-green-50 text-green-600' },
            { name: t('quickLinks.categories'), href: '/template/categories', icon: FolderTree, desc: t('quickLinks.categoriesDescription'), color: 'bg-purple-50 text-purple-600' },
            { name: t('quickLinks.reports'), href: '/template/reports', icon: TrendingUp, desc: t('quickLinks.reportsDescription'), color: 'bg-amber-50 text-amber-600' },
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
          <CardTitle className="text-lg font-semibold">{t('chartsReference')}</CardTitle>
          <CardDescription>{t('chartsReferenceDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { name: t('chartTypes.sparkline'), types: t('chartTypes.sparklineDescription') },
              { name: t('chartTypes.circularGauge'), types: t('chartTypes.circularGaugeDescription') },
              { name: t('chartTypes.linearGauge'), types: t('chartTypes.linearGaugeDescription') },
              { name: t('chartTypes.barGauge'), types: t('chartTypes.barGaugeDescription') },
              { name: t('chartTypes.pieDoughnut'), types: t('chartTypes.pieDoughnutDescription') },
              { name: t('chartTypes.barChart'), types: t('chartTypes.barChartDescription') },
              { name: t('chartTypes.splineArea'), types: t('chartTypes.splineAreaDescription') },
              { name: t('chartTypes.funnel'), types: t('chartTypes.funnelDescription') },
              { name: t('chartTypes.polarRadar'), types: t('chartTypes.polarRadarDescription') },
              { name: t('chartTypes.stackedBar'), types: t('chartTypes.stackedBarDescription') },
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

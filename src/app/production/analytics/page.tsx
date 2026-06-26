'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
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
import { DxButton } from '@/components/ui/dx-button';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import {
  BarChart3,
  TrendingUp,
  CheckCircle,
  Percent,
  Clock,
  Package,
  Target,
  Timer,
  Truck,
} from 'lucide-react';
import { formatNumber } from '@/lib/utils/number-format';

// ============================================
// Types
// ============================================

interface WorkOrder {
  id: number;
  woNumber: string;
  batchNumber: string;
  plannedQuantity: number;
  actualQuantity: number;
  unit: string;
  status: string;
  priority: number;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
  deliveryDate: string;
  yieldPercentage: number;
  productId: number;
  productCode: string;
  productName: string;
  createdAt: string;
}

// ============================================
// API
// ============================================

async function fetchWorkOrders(): Promise<WorkOrder[]> {
  const response = await fetch('/api/production/work-orders?limit=1000');
  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'Failed to fetch');
  return result.data?.items || [];
}

// ============================================
// Helpers
// ============================================

function getMonthLabel(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function getMonthSortKey(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280',
  planned: '#3b82f6',
  released: '#8b5cf6',
  in_progress: '#f59e0b',
  completed: '#22c55e',
  cancelled: '#ef4444',
};

const STATUS_LABELS_TH: Record<string, string> = {
  draft: 'แบบร่าง',
  planned: 'วางแผน',
  released: 'ปล่อยงาน',
  in_progress: 'กำลังผลิต',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
};

// ============================================
// Component
// ============================================

export default function ProductionAnalyticsPage() {
  const router = useRouter();
  const t = useTranslations('production');

  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ['work-orders'],
    queryFn: fetchWorkOrders,
  });

  // ── Summary Stats ──
  const stats = useMemo(() => {
    const total = workOrders.length;
    const completed = workOrders.filter(wo => wo.status === 'completed');
    const completedCount = completed.length;
    const closedCount = completedCount + workOrders.filter(wo => wo.status === 'cancelled').length;
    const completionRate = closedCount > 0 ? (completedCount / closedCount) * 100 : 0;

    // Average yield of completed orders
    const withYield = completed.filter(wo => Number(wo.yieldPercentage) > 0);
    const avgYield = withYield.length > 0
      ? withYield.reduce((s, wo) => s + Number(wo.yieldPercentage), 0) / withYield.length
      : 0;

    // On-time delivery rate
    const withDelivery = completed.filter(wo => wo.deliveryDate && wo.actualEndDate);
    const onTime = withDelivery.filter(wo => new Date(wo.actualEndDate) <= new Date(wo.deliveryDate)).length;
    const onTimeRate = withDelivery.length > 0 ? (onTime / withDelivery.length) * 100 : 0;

    // Unique products produced
    const productIds = new Set(workOrders.map(wo => wo.productId));

    // Average lead time (planned start → actual end)
    const withLeadTime = completed.filter(wo => wo.plannedStartDate && wo.actualEndDate);
    const totalDays = withLeadTime.reduce((s, wo) => s + daysBetween(wo.plannedStartDate, wo.actualEndDate), 0);
    const avgLeadTime = withLeadTime.length > 0 ? totalDays / withLeadTime.length : 0;

    return { total, completedCount, completionRate, avgYield, onTimeRate, totalProducts: productIds.size, avgLeadTime };
  }, [workOrders]);

  // ── Monthly Volume ──
  const monthlyData = useMemo(() => {
    const map = new Map<string, { sortKey: string; month: string; planned: number; actual: number; completed: number }>();
    for (const wo of workOrders) {
      const dateStr = wo.plannedStartDate || wo.createdAt;
      if (!dateStr) continue;
      const key = getMonthSortKey(dateStr);
      const label = getMonthLabel(dateStr);
      if (!map.has(key)) map.set(key, { sortKey: key, month: label, planned: 0, actual: 0, completed: 0 });
      const entry = map.get(key)!;
      entry.planned += Number(wo.plannedQuantity) || 0;
      entry.actual += Number(wo.actualQuantity) || 0;
      if (wo.status === 'completed') entry.completed++;
    }
    return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [workOrders]);

  // ── Yield by Product ──
  const yieldByProduct = useMemo(() => {
    const map = new Map<string, { name: string; totalYield: number; count: number }>();
    for (const wo of workOrders) {
      if (wo.status !== 'completed' || !Number(wo.yieldPercentage)) continue;
      const name = wo.productName || wo.productCode || `ID:${wo.productId}`;
      if (!map.has(name)) map.set(name, { name, totalYield: 0, count: 0 });
      const entry = map.get(name)!;
      entry.totalYield += Number(wo.yieldPercentage);
      entry.count++;
    }
    return Array.from(map.values())
      .map(e => ({ product: e.name, yield: Number((e.totalYield / e.count).toFixed(1)) }))
      .sort((a, b) => b.yield - a.yield)
      .slice(0, 10);
  }, [workOrders]);

  // ── Production Count by Product ──
  const productionByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const wo of workOrders) {
      const name = wo.productName || wo.productCode || `ID:${wo.productId}`;
      map.set(name, (map.get(name) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([product, count]) => ({ product, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [workOrders]);

  // ── Status Distribution ──
  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    for (const wo of workOrders) {
      map.set(wo.status, (map.get(wo.status) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([status, count]) => ({
        status: STATUS_LABELS_TH[status] || status,
        count,
        color: STATUS_COLORS[status] || '#6b7280',
      }))
      .sort((a, b) => b.count - a.count);
  }, [workOrders]);

  // ── Lead Time by Product ──
  const leadTimeByProduct = useMemo(() => {
    const map = new Map<string, { name: string; totalDays: number; count: number }>();
    for (const wo of workOrders) {
      if (wo.status !== 'completed' || !wo.plannedStartDate || !wo.actualEndDate) continue;
      const name = wo.productName || wo.productCode || `ID:${wo.productId}`;
      if (!map.has(name)) map.set(name, { name, totalDays: 0, count: 0 });
      const entry = map.get(name)!;
      entry.totalDays += daysBetween(wo.plannedStartDate, wo.actualEndDate);
      entry.count++;
    }
    return Array.from(map.values())
      .map(e => ({ product: e.name, days: Number((e.totalDays / e.count).toFixed(1)) }))
      .sort((a, b) => b.days - a.days)
      .slice(0, 10);
  }, [workOrders]);

  // ── On-Time Delivery ──
  const onTimeData = useMemo(() => {
    const completed = workOrders.filter(wo => wo.status === 'completed');
    const withDate = completed.filter(wo => wo.deliveryDate && wo.actualEndDate);
    const onTime = withDate.filter(wo => new Date(wo.actualEndDate) <= new Date(wo.deliveryDate)).length;
    const late = withDate.length - onTime;
    const noDate = completed.length - withDate.length;
    return [
      { label: t('analytics.charts.onTime'), count: onTime, color: '#22c55e' },
      { label: t('analytics.charts.late'), count: late, color: '#ef4444' },
      { label: t('analytics.charts.noDeliveryDate'), count: noDate, color: '#d1d5db' },
    ].filter(d => d.count > 0);
  }, [workOrders, t]);

  // ── Priority Completion Rate ──
  const priorityCompletionData = useMemo(() => {
    const groups = [
      { label: t('workOrders.priority.high'), range: [1, 3] as [number, number] },
      { label: t('workOrders.priority.normal'), range: [4, 6] as [number, number] },
      { label: t('workOrders.priority.low'), range: [7, 10] as [number, number] },
    ];
    return groups.map(g => {
      const inRange = workOrders.filter(wo => wo.priority >= g.range[0] && wo.priority <= g.range[1]);
      const completed = inRange.filter(wo => wo.status === 'completed').length;
      const closed = inRange.filter(wo => wo.status === 'completed' || wo.status === 'cancelled').length;
      return {
        priority: g.label,
        rate: closed > 0 ? Number(((completed / closed) * 100).toFixed(1)) : 0,
        total: inRange.length,
      };
    });
  }, [workOrders, t]);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1800px] mx-auto">
      {/* Header */}
      <ResponsivePageHeader
        title={t('analytics.pageTitle')}
        subtitle={t('analytics.description')}
        icon={BarChart3}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        breadcrumbs={[
          { label: t('breadcrumbs.production'), href: '/production' },
          { label: t('workOrders.breadcrumbs.workOrders'), href: '/production/work-orders' },
          { label: t('analytics.breadcrumbs.analytics') },
        ]}
        actions={
          <DxButton
            icon="arrowleft"
            text={t('analytics.actions.backToWorkOrders')}
            type="default"
            stylingMode="outlined"
            onClick={() => router.push('/production/work-orders')}
          />
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 md:gap-4">
        <StatCard
          label={t('analytics.stats.totalOrders')}
          value={stats.total}
          icon={Package}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('analytics.stats.completedOrders')}
          value={stats.completedCount}
          icon={CheckCircle}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('analytics.stats.completionRate')}
          value={stats.completionRate > 0 ? `${stats.completionRate.toFixed(1)}%` : '-'}
          icon={Target}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('analytics.stats.avgYield')}
          value={stats.avgYield > 0 ? `${stats.avgYield.toFixed(1)}%` : '-'}
          icon={Percent}
          iconColor="text-cyan-500"
          accentColor="border-cyan-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('analytics.stats.onTimeRate')}
          value={stats.onTimeRate > 0 ? `${stats.onTimeRate.toFixed(1)}%` : '-'}
          icon={Truck}
          iconColor="text-green-500"
          accentColor="border-green-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('analytics.stats.totalProducts')}
          value={stats.totalProducts}
          icon={Package}
          iconColor="text-purple-500"
          accentColor="border-purple-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('analytics.stats.avgLeadTime')}
          value={stats.avgLeadTime > 0 ? `${stats.avgLeadTime.toFixed(1)} ${t('analytics.stats.days')}` : '-'}
          icon={Timer}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={isLoading}
        />
      </div>

      {/* Row 1: Monthly Volume + Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        {/* Monthly Volume */}
        <div className="lg:col-span-2 bg-white rounded-[18px] border border-emerald-100 shadow-[0_6px_20px_rgba(6,78,59,0.07)] p-5">
          <h3 className="text-base font-semibold text-[#064E3B] flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            {t('analytics.charts.monthlyVolume')}
          </h3>
          {monthlyData.length > 0 ? (
            <Chart dataSource={monthlyData} size={{ height: 320 }}>
              <CommonSeriesSettings argumentField="month" type="bar" />
              <ChartSeries valueField="planned" name={t('analytics.charts.planned')} color="#93c5fd" />
              <ChartSeries valueField="actual" name={t('analytics.charts.actual')} color="#3b82f6" />
              <ArgumentAxis>
                <ChartLabel font={{ size: 11 }} displayMode="stagger" overlappingBehavior="stagger" wordWrap="none" textOverflow="none" />
              </ArgumentAxis>
              <ValueAxis allowDecimals={false} />
              <ChartLegend visible={true} verticalAlignment="bottom" horizontalAlignment="center" />
              <ChartTooltip
                enabled={true}
                customizeTooltip={(arg: { seriesName?: string; valueText?: string; argumentText?: string }) => ({
                  text: `${arg.seriesName}: ${formatNumber(arg.valueText || 0)}`,
                })}
              />
            </Chart>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              <p>{t('analytics.charts.noData')}</p>
            </div>
          )}
        </div>

        {/* Status Overview */}
        <div className="bg-white rounded-[18px] border border-emerald-100 shadow-[0_6px_20px_rgba(6,78,59,0.07)] p-5">
          <h3 className="text-base font-semibold text-[#064E3B] flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-violet-500" />
            {t('analytics.charts.statusOverview')}
          </h3>
          {statusData.length > 0 ? (
            <div className="flex flex-col">
              <PieChart
                dataSource={statusData}
                type="doughnut"
                innerRadius={0.6}
                palette={statusData.map(d => d.color)}
                size={{ height: 260 }}
              >
                <Series argumentField="status" valueField="count">
                  <Label visible={false} />
                  <Connector visible={false} />
                </Series>
                <Legend visible={false} />
                <Tooltip
                  enabled={true}
                  customizeTooltip={(arg: { argumentText?: string; valueText?: string; percentText?: string }) => ({
                    text: `${arg.argumentText}: ${arg.valueText} (${arg.percentText})`,
                  })}
                />
              </PieChart>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-3 pt-3 border-t border-gray-100">
                {statusData.map(d => (
                  <div key={d.status} className="flex items-center gap-1.5 text-sm">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-gray-700">{d.status}</span>
                    <span className="text-gray-400 font-medium">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              <p>{t('analytics.charts.noData')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Yield by Product + Production Count by Product */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        {/* Yield by Product */}
        <div className="bg-white rounded-[18px] border border-emerald-100 shadow-[0_6px_20px_rgba(6,78,59,0.07)] p-5">
          <h3 className="text-base font-semibold text-[#064E3B] flex items-center gap-2 mb-4">
            <Percent className="w-4 h-4 text-cyan-500" />
            {t('analytics.charts.yieldByProduct')}
          </h3>
          {yieldByProduct.length > 0 ? (
            <Chart dataSource={yieldByProduct} rotated size={{ height: Math.max(200, yieldByProduct.length * 40) }}>
              <CommonSeriesSettings argumentField="product" type="bar" barWidth={20} />
              <ChartSeries valueField="yield" name={t('analytics.charts.yieldPercent')} color="#06b6d4" />
              <ArgumentAxis placeholderSize={150}>
                <ChartLabel font={{ size: 11 }} textOverflow="none" wordWrap="none" />
              </ArgumentAxis>
              <ValueAxis visualRange={[0, 100]} />
              <ChartLegend visible={false} />
              <ChartTooltip
                enabled={true}
                customizeTooltip={(arg: { argumentText?: string; valueText?: string }) => ({
                  text: `${arg.argumentText}: ${arg.valueText}%`,
                })}
              />
            </Chart>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              <p>{t('analytics.charts.noData')}</p>
            </div>
          )}
        </div>

        {/* Production Count by Product */}
        <div className="bg-white rounded-[18px] border border-emerald-100 shadow-[0_6px_20px_rgba(6,78,59,0.07)] p-5">
          <h3 className="text-base font-semibold text-[#064E3B] flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-emerald-500" />
            {t('analytics.charts.productionByProduct')}
          </h3>
          {productionByProduct.length > 0 ? (
            <Chart dataSource={productionByProduct} rotated size={{ height: Math.max(200, productionByProduct.length * 40) }}>
              <CommonSeriesSettings argumentField="product" type="bar" barWidth={20} />
              <ChartSeries valueField="count" name={t('analytics.charts.count')} color="#6366f1" />
              <ArgumentAxis placeholderSize={150}>
                <ChartLabel font={{ size: 11 }} textOverflow="none" wordWrap="none" />
              </ArgumentAxis>
              <ValueAxis allowDecimals={false} />
              <ChartLegend visible={false} />
              <ChartTooltip
                enabled={true}
                customizeTooltip={(arg: { argumentText?: string; valueText?: string }) => ({
                  text: `${arg.argumentText}: ${arg.valueText} ${t('analytics.charts.orders')}`,
                })}
              />
            </Chart>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              <p>{t('analytics.charts.noData')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Lead Time + On-Time Delivery + Priority Completion */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        {/* Lead Time by Product */}
        <div className="bg-white rounded-[18px] border border-emerald-100 shadow-[0_6px_20px_rgba(6,78,59,0.07)] p-5">
          <h3 className="text-base font-semibold text-[#064E3B] flex items-center gap-2 mb-4">
            <Timer className="w-4 h-4 text-amber-500" />
            {t('analytics.charts.leadTimeByProduct')}
          </h3>
          {leadTimeByProduct.length > 0 ? (
            <Chart dataSource={leadTimeByProduct} rotated size={{ height: Math.max(200, leadTimeByProduct.length * 40) }}>
              <CommonSeriesSettings argumentField="product" type="bar" barWidth={18} />
              <ChartSeries valueField="days" name={t('analytics.charts.averageDays')} color="#f59e0b" />
              <ArgumentAxis placeholderSize={150}>
                <ChartLabel font={{ size: 11 }} textOverflow="none" wordWrap="none" />
              </ArgumentAxis>
              <ValueAxis allowDecimals={false} />
              <ChartLegend visible={false} />
              <ChartTooltip
                enabled={true}
                customizeTooltip={(arg: { argumentText?: string; valueText?: string }) => ({
                  text: `${arg.argumentText}: ${arg.valueText} ${t('analytics.stats.days')}`,
                })}
              />
            </Chart>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              <p>{t('analytics.charts.noData')}</p>
            </div>
          )}
        </div>

        {/* On-Time Delivery */}
        <div className="bg-white rounded-[18px] border border-emerald-100 shadow-[0_6px_20px_rgba(6,78,59,0.07)] p-5">
          <h3 className="text-base font-semibold text-[#064E3B] flex items-center gap-2 mb-4">
            <Truck className="w-4 h-4 text-green-500" />
            {t('analytics.charts.onTimeDelivery')}
          </h3>
          {onTimeData.length > 0 ? (
            <div className="flex flex-col">
              <PieChart
                dataSource={onTimeData}
                type="doughnut"
                innerRadius={0.6}
                palette={onTimeData.map(d => d.color)}
                size={{ height: 260 }}
              >
                <Series argumentField="label" valueField="count">
                  <Label visible={false} />
                  <Connector visible={false} />
                </Series>
                <Legend visible={false} />
                <Tooltip
                  enabled={true}
                  customizeTooltip={(arg: { argumentText?: string; valueText?: string; percentText?: string }) => ({
                    text: `${arg.argumentText}: ${arg.valueText} (${arg.percentText})`,
                  })}
                />
              </PieChart>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-3 pt-3 border-t border-gray-100">
                {onTimeData.map(d => (
                  <div key={d.label} className="flex items-center gap-1.5 text-sm">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-gray-700">{d.label}</span>
                    <span className="text-gray-400 font-medium">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              <p>{t('analytics.charts.noData')}</p>
            </div>
          )}
        </div>

        {/* Priority Completion Rate */}
        <div className="bg-white rounded-[18px] border border-emerald-100 shadow-[0_6px_20px_rgba(6,78,59,0.07)] p-5">
          <h3 className="text-base font-semibold text-[#064E3B] flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-emerald-500" />
            {t('analytics.charts.priorityCompletion')}
          </h3>
          {priorityCompletionData.some(d => d.total > 0) ? (
            <Chart dataSource={priorityCompletionData} size={{ height: 250 }}>
              <CommonSeriesSettings argumentField="priority" type="bar" barWidth={40} />
              <ChartSeries valueField="rate" name={t('analytics.charts.rate')} color="#3b82f6" />
              <ArgumentAxis>
                <ChartLabel font={{ size: 12 }} />
              </ArgumentAxis>
              <ValueAxis visualRange={[0, 100]} />
              <ChartLegend visible={false} />
              <ChartTooltip
                enabled={true}
                customizeTooltip={(arg: { argumentText?: string; valueText?: string; data?: { total?: number } }) => ({
                  text: `${arg.argumentText}: ${arg.valueText}% (${arg.data?.total || 0} ${t('analytics.charts.orders')})`,
                })}
              />
            </Chart>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              <p>{t('analytics.charts.noData')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

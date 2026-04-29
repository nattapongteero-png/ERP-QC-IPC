'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, getStatusVariant } from '@/components/ui/badge';
import { CardSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { KPICard, KPICardSkeleton } from '@/components/ui/kpi-card';
import { StatCard, StatCardSkeleton } from '@/components/ui/stat-card';
import { ModuleKpiTabs } from '@/components/dashboard/module-kpi-tabs';
import type { DashboardModuleKpis } from '@/lib/services/dashboard.service';
import {
  Package,
  Factory,
  AlertTriangle,
  ShoppingCart,
  Truck,
  Clock,
  Inbox,
  TrendingUp,
  Calendar,
  Warehouse,
  Boxes,
  Activity,
  ShieldAlert,
  XCircle,
  Snowflake,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// Warehouse type configuration — flat colors only
const warehouseTypeConfig: Record<string, {
  translationKey: string;
  icon: typeof Package;
  textColor: string;
  iconBg: string;
  iconText: string;
  topBorder: string;
  ringColor: string;
}> = {
  raw_material: {
    translationKey: 'rawMaterial', icon: Package,
    textColor: 'text-blue-700', iconBg: 'bg-blue-100', iconText: 'text-blue-700',
    topBorder: 'border-t-blue-500', ringColor: 'ring-blue-100',
  },
  wip: {
    translationKey: 'wip', icon: Activity,
    textColor: 'text-orange-700', iconBg: 'bg-orange-100', iconText: 'text-orange-700',
    topBorder: 'border-t-orange-500', ringColor: 'ring-orange-100',
  },
  finished_goods: {
    translationKey: 'finishedGoods', icon: Boxes,
    textColor: 'text-emerald-700', iconBg: 'bg-emerald-100', iconText: 'text-emerald-700',
    topBorder: 'border-t-emerald-500', ringColor: 'ring-emerald-100',
  },
  quarantine: {
    translationKey: 'quarantine', icon: ShieldAlert,
    textColor: 'text-amber-700', iconBg: 'bg-amber-100', iconText: 'text-amber-700',
    topBorder: 'border-t-amber-500', ringColor: 'ring-amber-100',
  },
  rejected: {
    translationKey: 'rejected', icon: XCircle,
    textColor: 'text-rose-700', iconBg: 'bg-rose-100', iconText: 'text-rose-700',
    topBorder: 'border-t-rose-500', ringColor: 'ring-rose-100',
  },
  cold_storage: {
    translationKey: 'coldStorage', icon: Snowflake,
    textColor: 'text-cyan-700', iconBg: 'bg-cyan-100', iconText: 'text-cyan-700',
    topBorder: 'border-t-cyan-500', ringColor: 'ring-cyan-100',
  },
};

const getWarehouseTypeConfig = (type: string) => {
  return warehouseTypeConfig[type] || {
    translationKey: type,
    icon: Warehouse,
    textColor: 'text-slate-700',
    iconBg: 'bg-slate-100',
    iconText: 'text-slate-700',
    topBorder: 'border-t-slate-500',
    ringColor: 'ring-slate-100',
  };
};

interface DashboardData {
  summary: {
    totalItems: number;
    lotsInQuarantine: number;
    lotsExpiringSoon: number;
    activeWorkOrders: number;
    pendingPOs: number;
    pendingSOs: number;
    openDeviations: number;
  };
  recentWorkOrders: Array<{
    id: number;
    woNumber: string;
    batchNumber: string;
    status: string;
    plannedQuantity: number;
    unit: string;
  }>;
  inventoryByStatus: Array<{
    status: string;
    count: number;
    totalQuantity: number;
  }>;
  workOrdersByStatus: Array<{
    status: string;
    count: number;
  }>;
  inventoryByWarehouseType: Array<{
    warehouseType: string;
    warehouseName: string;
    lotCount: number;
    totalQuantity: number;
  }>;
  moduleKpis: DashboardModuleKpis | null;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const t = useTranslations('dashboard');

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setData(result.data);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  // Hero summary stats — derived from existing data, no new fetches
  const activeWO = data?.summary.activeWorkOrders ?? 0;
  const openDev = data?.summary.openDeviations ?? 0;
  const expSoon = data?.summary.lotsExpiringSoon ?? 0;
  const inQuar = data?.summary.lotsInQuarantine ?? 0;

  return (
    <MainLayout>
      <div className="space-y-6 md:space-y-8">
        {/* Style E Hero — Pharma Pro clinical pharmaceutical layout */}
        <div className="bg-white rounded-md p-5 lg:p-6 border-2 border-sky-100">
          <div className="border-l-4 border-sky-600 bg-sky-50 rounded-r-md p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-md bg-sky-600 flex items-center justify-center flex-shrink-0">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-sky-700 uppercase tracking-wider">
                  GMP Pharmaceutical ERP · Audit-Ready
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mt-0.5">
                  {t('title')}
                </h1>
                <p className="text-sm text-slate-600 mt-0.5 max-w-2xl">{t('description')}</p>
              </div>
            </div>

            {/* At-a-glance inline stat chips with colored numbers */}
            {!isLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:flex md:items-center gap-2 md:gap-3">
                <div className="rounded-md border-2 border-emerald-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {t('kpis.activeWorkOrders.label')}
                  </p>
                  <p className="mt-0.5 text-xl font-bold text-emerald-600 tabular-nums">{activeWO}</p>
                </div>
                <div className="rounded-md border-2 border-rose-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {t('kpis.openDeviations.label')}
                  </p>
                  <p className="mt-0.5 text-xl font-bold text-rose-600 tabular-nums">{openDev}</p>
                </div>
                <div className="rounded-md border-2 border-amber-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {t('kpis.expiringSoon.label')}
                  </p>
                  <p className="mt-0.5 text-xl font-bold text-amber-600 tabular-nums">{expSoon}</p>
                </div>
                <div className="rounded-md border-2 border-amber-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {t('kpis.lotsInQuarantine.label')}
                  </p>
                  <p className="mt-0.5 text-xl font-bold text-amber-600 tabular-nums">{inQuar}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            {/* Primary KPIs Skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <KPICardSkeleton key={i} showIcon showTrend />
              ))}
            </div>

            {/* Secondary Stats Skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <StatCardSkeleton key={i} size="md" />
              ))}
            </div>

            {/* Module KPIs Skeleton */}
            <CardSkeleton lines={6} />

            {/* Cards Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CardSkeleton lines={4} />
              <CardSkeleton lines={4} />
            </div>
            <div className="grid grid-cols-1 gap-6">
              <CardSkeleton lines={4} />
            </div>
          </div>
        ) : (
          <>
            {/* Primary KPIs — Style E clinical accent borders */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                label={t('kpis.totalItems.label')}
                value={data?.summary.totalItems || 0}
                subtitle={t('kpis.totalItems.subtitle')}
                icon={<Package className="h-6 w-6" />}
                iconBgColor="bg-sky-600"
                iconColor="text-white"
                trend="up"
                trendValue="+12%"
                className="motion-safe:animate-fade-in motion-reduce:animate-none rounded-md border-2 border-sky-200 bg-sky-50/50 shadow-none"
                style={{ animationDelay: '0ms' }}
              />

              <KPICard
                label={t('kpis.activeWorkOrders.label')}
                value={data?.summary.activeWorkOrders || 0}
                subtitle={t('kpis.activeWorkOrders.subtitle')}
                icon={<Factory className="h-6 w-6" />}
                iconBgColor="bg-emerald-600"
                iconColor="text-white"
                className="motion-safe:animate-fade-in motion-reduce:animate-none rounded-md border-2 border-emerald-200 bg-emerald-50/50 shadow-none"
                style={{ animationDelay: '50ms' }}
              />

              <KPICard
                label={t('kpis.openDeviations.label')}
                value={data?.summary.openDeviations || 0}
                subtitle={t('kpis.openDeviations.subtitle')}
                icon={<AlertTriangle className="h-6 w-6" />}
                iconBgColor="bg-rose-600"
                iconColor="text-white"
                trend={data?.summary.openDeviations && data.summary.openDeviations > 0 ? 'up' : 'neutral'}
                trendValue={data?.summary.openDeviations && data.summary.openDeviations > 0 ? t('kpis.openDeviations.actionNeeded') : t('kpis.openDeviations.allClear')}
                className="motion-safe:animate-fade-in motion-reduce:animate-none rounded-md border-2 border-rose-200 bg-rose-50/50 shadow-none"
                style={{ animationDelay: '100ms' }}
              />

              <KPICard
                label={t('kpis.expiringSoon.label')}
                value={data?.summary.lotsExpiringSoon || 0}
                subtitle={t('kpis.expiringSoon.subtitle')}
                icon={<Calendar className="h-6 w-6" />}
                iconBgColor="bg-amber-600"
                iconColor="text-white"
                trend={data?.summary.lotsExpiringSoon && data.summary.lotsExpiringSoon > 5 ? 'up' : 'down'}
                trendValue={data?.summary.lotsExpiringSoon && data.summary.lotsExpiringSoon > 5 ? t('kpis.expiringSoon.monitorClosely') : t('kpis.expiringSoon.lowRisk')}
                className="motion-safe:animate-fade-in motion-reduce:animate-none rounded-md border-2 border-amber-200 bg-amber-50/50 shadow-none"
                style={{ animationDelay: '150ms' }}
              />
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label={t('kpis.lotsInQuarantine.label')}
                value={data?.summary.lotsInQuarantine || 0}
                icon={<Clock className="h-5 w-5" />}
                variant="warning"
                size="md"
                className="motion-safe:animate-fade-in motion-reduce:animate-none"
                style={{ animationDelay: '200ms' }}
              />

              <StatCard
                label={t('kpis.pendingPOs.label')}
                value={data?.summary.pendingPOs || 0}
                icon={<ShoppingCart className="h-5 w-5" />}
                variant="info"
                size="md"
                className="motion-safe:animate-fade-in motion-reduce:animate-none"
                style={{ animationDelay: '250ms' }}
              />

              <StatCard
                label={t('kpis.pendingSOs.label')}
                value={data?.summary.pendingSOs || 0}
                icon={<Truck className="h-5 w-5" />}
                variant="primary"
                size="md"
                className="motion-safe:animate-fade-in motion-reduce:animate-none"
                style={{ animationDelay: '300ms' }}
              />

              <StatCard
                label={t('kpis.monthlyGrowth.label')}
                value="+8.5%"
                icon={<TrendingUp className="h-5 w-5" />}
                variant="success"
                size="md"
                className="motion-safe:animate-fade-in motion-reduce:animate-none"
                style={{ animationDelay: '350ms' }}
              />
            </div>

            {/* Module KPIs Tabs */}
            <ModuleKpiTabs
              data={data?.moduleKpis || null}
              isLoading={isLoading}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Work Orders — Style E section panel */}
              <Card
                elevation="raised"
                className={cn(
                  'motion-safe:animate-fade-in motion-reduce:animate-none',
                  'overflow-hidden bg-white',
                  'rounded-md border-2 border-slate-200 shadow-none'
                )}
                style={{ animationDelay: '400ms' }}
              >
                {/* Style E section panel header */}
                <div className="flex items-center justify-between px-4 py-3 bg-sky-50 border-b-2 border-sky-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <Factory className="h-4 w-4 text-sky-700 flex-shrink-0" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide truncate">
                      {t('sections.recentWorkOrders.title')}
                    </h3>
                  </div>
                  {data?.recentWorkOrders && data.recentWorkOrders.length > 0 && (
                    <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-sm text-[11px] font-semibold border border-sky-300 bg-white text-sky-800">
                      {data.recentWorkOrders.length}
                    </span>
                  )}
                </div>
                <CardContent className="p-4 md:p-5">
                  {data?.recentWorkOrders && data.recentWorkOrders.length > 0 ? (
                    <div className="space-y-2">
                      {data.recentWorkOrders.map((wo) => (
                        <div
                          key={wo.id}
                          className={cn(
                            'group flex items-center justify-between gap-3',
                            'p-3 rounded-md border border-slate-200',
                            'bg-white hover:bg-sky-50/30 hover:border-sky-300',
                            'transition-colors duration-150',
                            'motion-reduce:transition-none',
                            'cursor-pointer'
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="flex-shrink-0 w-9 h-9 rounded-md bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center">
                              <Factory className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-mono font-semibold text-sky-700 truncate">{wo.woNumber}</p>
                              <p className="text-xs text-slate-500 truncate">
                                {t('sections.recentWorkOrders.batchPrefix')}: <span className="font-mono">{wo.batchNumber}</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <Badge variant={getStatusVariant(wo.status)} dot>
                              {wo.status}
                            </Badge>
                            <p className="text-xs text-slate-500 mt-1 tabular-nums">
                              {wo.plannedQuantity.toLocaleString()} {wo.unit}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Inbox className="h-6 w-6" />}
                      title={t('sections.recentWorkOrders.emptyMessage')}
                      description=""
                      size="sm"
                    />
                  )}
                </CardContent>
              </Card>

              {/* Inventory by Status — Style E section panel */}
              <Card
                elevation="raised"
                className={cn(
                  'motion-safe:animate-fade-in motion-reduce:animate-none',
                  'overflow-hidden bg-white',
                  'rounded-md border-2 border-slate-200 shadow-none'
                )}
                style={{ animationDelay: '450ms' }}
              >
                <div className="flex items-center justify-between px-4 py-3 bg-sky-50 border-b-2 border-sky-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="h-4 w-4 text-sky-700 flex-shrink-0" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide truncate">
                      {t('sections.inventoryByStatus.title')}
                    </h3>
                  </div>
                  {data?.inventoryByStatus && data.inventoryByStatus.length > 0 && (
                    <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-sm text-[11px] font-semibold border border-sky-300 bg-white text-sky-800">
                      {data.inventoryByStatus.length}
                    </span>
                  )}
                </div>
                <CardContent className="p-4 md:p-5">
                  {data?.inventoryByStatus && data.inventoryByStatus.length > 0 ? (
                    <div className="space-y-2">
                      {(() => {
                        const maxCount = Math.max(
                          1,
                          ...data.inventoryByStatus.map((i) => Number(i.count) || 0)
                        );
                        return data.inventoryByStatus.map((item) => {
                          const pct = Math.round(((Number(item.count) || 0) / maxCount) * 100);
                          return (
                            <div
                              key={item.status}
                              className={cn(
                                'group p-3 rounded-md border border-slate-200',
                                'bg-white hover:bg-sky-50/30 hover:border-sky-300',
                                'transition-colors duration-150',
                                'motion-reduce:transition-none'
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="flex-shrink-0 w-9 h-9 rounded-md bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center">
                                    <Package className="h-4 w-4" />
                                  </div>
                                  <Badge variant={getStatusVariant(item.status)} dot>
                                    {item.status}
                                  </Badge>
                                </div>
                                <div className="flex-shrink-0 text-right">
                                  <p className="font-bold text-slate-900 tabular-nums">
                                    {item.count}{' '}
                                    <span className="text-xs font-medium text-slate-500">
                                      {t('sections.inventoryByStatus.lotsUnit')}
                                    </span>
                                  </p>
                                  <p className="text-xs text-slate-500 tabular-nums">
                                    {t('sections.inventoryByStatus.totalPrefix')}:{' '}
                                    {Number(item.totalQuantity || 0).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              {/* Progress bar visualization — sky accent */}
                              <div className="mt-2 h-1.5 w-full rounded-full bg-sky-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-sky-600 transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Package className="h-6 w-6" />}
                      title={t('sections.inventoryByStatus.emptyMessage')}
                      description=""
                      size="sm"
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Inventory by Warehouse Type — Style E section panel */}
            <Card
              elevation="raised"
              className={cn(
                'motion-safe:animate-fade-in motion-reduce:animate-none',
                'overflow-hidden bg-white',
                'rounded-md border-2 border-slate-200 shadow-none'
              )}
              style={{ animationDelay: '500ms' }}
            >
              <div className="flex items-center justify-between px-4 py-3 bg-sky-50 border-b-2 border-sky-200">
                <div className="flex items-center gap-2 min-w-0">
                  <Warehouse className="h-4 w-4 text-sky-700 flex-shrink-0" />
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide truncate">
                    {t('sections.warehouseOverview.title')}
                  </h3>
                </div>
                {data?.inventoryByWarehouseType && data.inventoryByWarehouseType.length > 0 && (
                  <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-sm text-[11px] font-semibold border border-sky-300 bg-white text-sky-800">
                    {data.inventoryByWarehouseType.length}
                  </span>
                )}
              </div>
              <CardContent className="p-4 md:p-6">
                {data?.inventoryByWarehouseType && data.inventoryByWarehouseType.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.inventoryByWarehouseType.map((item, index) => {
                      const config = getWarehouseTypeConfig(item.warehouseType);
                      const Icon = config.icon;
                      return (
                        <div
                          key={`${item.warehouseType}-${item.warehouseName}-${index}`}
                          className={cn(
                            'group bg-white rounded-md border-2 border-slate-200 p-4',
                            'hover:border-sky-400 transition-colors',
                            'motion-reduce:transition-none'
                          )}
                        >
                          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200">
                            <Icon className={cn('w-4 h-4', config.iconText)} />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              {t(`warehouseTypes.${config.translationKey}`)}
                            </span>
                          </div>
                          <p className="font-semibold text-slate-900 truncate text-sm" title={item.warehouseName}>
                            {item.warehouseName}
                          </p>
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                                {t('sections.warehouseOverview.lotsLabel')}
                              </p>
                              <p className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
                                {Number(item.lotCount || 0).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                                {t('sections.warehouseOverview.totalQtyLabel')}
                              </p>
                              <p className="text-xl font-bold text-sky-700 tabular-nums mt-0.5">
                                {Number(item.totalQuantity || 0).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Warehouse className="h-6 w-6" />}
                    title={t('sections.warehouseOverview.emptyMessage')}
                    description={t('sections.warehouseOverview.emptyDescription')}
                    size="sm"
                  />
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}

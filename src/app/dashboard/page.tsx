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
        {/* Hero — clean white card with welcome + inline stat chips */}
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm px-5 py-6 md:px-8 md:py-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1 flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Activity className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-slate-500">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">
                    GMP Pharmaceutical ERP
                  </span>
                </div>
                <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
                  {t('title')}
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
                  {t('description')}
                </p>
              </div>
            </div>

            {/* At-a-glance inline stat chips with colored numbers */}
            {!isLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:flex md:items-center gap-2 md:gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    {t('kpis.activeWorkOrders.label')}
                  </p>
                  <p className="mt-0.5 text-xl font-bold text-emerald-600 tabular-nums">{activeWO}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    {t('kpis.openDeviations.label')}
                  </p>
                  <p className="mt-0.5 text-xl font-bold text-rose-600 tabular-nums">{openDev}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    {t('kpis.expiringSoon.label')}
                  </p>
                  <p className="mt-0.5 text-xl font-bold text-amber-600 tabular-nums">{expSoon}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
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
            {/* Primary KPIs - Most Important Metrics — flat colored icon tiles */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                label={t('kpis.totalItems.label')}
                value={data?.summary.totalItems || 0}
                subtitle={t('kpis.totalItems.subtitle')}
                icon={<Package className="h-6 w-6" />}
                iconBgColor="bg-blue-600"
                iconColor="text-white"
                trend="up"
                trendValue="+12%"
                className="motion-safe:animate-fade-in motion-reduce:animate-none ring-1 ring-slate-200 hover:ring-blue-300"
                style={{ animationDelay: '0ms' }}
              />

              <KPICard
                label={t('kpis.activeWorkOrders.label')}
                value={data?.summary.activeWorkOrders || 0}
                subtitle={t('kpis.activeWorkOrders.subtitle')}
                icon={<Factory className="h-6 w-6" />}
                iconBgColor="bg-emerald-600"
                iconColor="text-white"
                className="motion-safe:animate-fade-in motion-reduce:animate-none ring-1 ring-slate-200 hover:ring-emerald-300"
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
                className="motion-safe:animate-fade-in motion-reduce:animate-none ring-1 ring-slate-200 hover:ring-rose-300"
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
                className="motion-safe:animate-fade-in motion-reduce:animate-none ring-1 ring-slate-200 hover:ring-amber-300"
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
              {/* Recent Work Orders — flat clean card */}
              <Card
                elevation="raised"
                className={cn(
                  'motion-safe:animate-fade-in motion-reduce:animate-none',
                  'overflow-hidden bg-white',
                  'border border-slate-200 shadow-sm hover:shadow'
                )}
                style={{ animationDelay: '400ms' }}
              >
                {/* Custom header with icon + count badge */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Factory className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base md:text-lg font-semibold text-slate-900 truncate">
                        {t('sections.recentWorkOrders.title')}
                      </h3>
                    </div>
                  </div>
                  {data?.recentWorkOrders && data.recentWorkOrders.length > 0 && (
                    <span className="flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
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
                            'p-3 rounded-lg border border-slate-200',
                            'bg-white hover:bg-emerald-50 hover:border-emerald-200',
                            'hover:shadow-sm',
                            'transition-all duration-150',
                            'motion-reduce:transition-none',
                            'cursor-pointer'
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                              <Factory className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{wo.woNumber}</p>
                              <p className="text-xs text-slate-500 truncate">
                                {t('sections.recentWorkOrders.batchPrefix')}: {wo.batchNumber}
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

              {/* Inventory by Status — flat clean card */}
              <Card
                elevation="raised"
                className={cn(
                  'motion-safe:animate-fade-in motion-reduce:animate-none',
                  'overflow-hidden bg-white',
                  'border border-slate-200 shadow-sm hover:shadow'
                )}
                style={{ animationDelay: '450ms' }}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Package className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base md:text-lg font-semibold text-slate-900 truncate">
                        {t('sections.inventoryByStatus.title')}
                      </h3>
                    </div>
                  </div>
                  {data?.inventoryByStatus && data.inventoryByStatus.length > 0 && (
                    <span className="flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
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
                                'group p-3 rounded-lg border border-slate-200',
                                'bg-white hover:bg-blue-50 hover:border-blue-200',
                                'hover:shadow-sm transition-all duration-150',
                                'motion-reduce:transition-none'
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
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
                              {/* Progress bar visualization — flat */}
                              <div className="mt-2 h-1.5 w-full rounded-full bg-blue-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-blue-500 transition-all duration-500"
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

            {/* Inventory by Warehouse Type — flat */}
            <Card
              elevation="raised"
              className={cn(
                'motion-safe:animate-fade-in motion-reduce:animate-none',
                'overflow-hidden bg-white',
                'border border-slate-200 shadow-sm'
              )}
              style={{ animationDelay: '500ms' }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
                    <Warehouse className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base md:text-lg font-semibold text-slate-900 truncate">
                      {t('sections.warehouseOverview.title')}
                    </h3>
                  </div>
                </div>
                {data?.inventoryByWarehouseType && data.inventoryByWarehouseType.length > 0 && (
                  <span className="flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 border border-violet-200">
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
                            'group relative p-4 rounded-xl bg-white',
                            'border border-slate-200 border-t-4',
                            config.topBorder,
                            'hover:shadow-md',
                            'transition-all duration-200',
                            'motion-reduce:transition-none'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              'flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center',
                              config.iconBg,
                              config.iconText
                            )}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-900 truncate">
                                {item.warehouseName}
                              </p>
                              <p className={cn('text-xs font-semibold mt-0.5', config.textColor)}>
                                {t(`warehouseTypes.${config.translationKey}`)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider font-medium text-slate-500">
                                {t('sections.warehouseOverview.lotsLabel')}
                              </p>
                              <p className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
                                {Number(item.lotCount || 0).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider font-medium text-slate-500">
                                {t('sections.warehouseOverview.totalQtyLabel')}
                              </p>
                              <p className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
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

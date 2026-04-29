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

// Warehouse type configuration (icon, color, bgColor only - labels come from translations)
const warehouseTypeConfig: Record<string, {
  translationKey: string;
  icon: typeof Package;
  color: string;
  bgColor: string;
  // Modern theming additions (gradient + soft tint for the card surface)
  iconGradient: string;
  cardTint: string;
  ringColor: string;
}> = {
  raw_material: {
    translationKey: 'rawMaterial', icon: Package, color: 'text-blue-700', bgColor: 'bg-blue-100',
    iconGradient: 'from-blue-500 to-cyan-500', cardTint: 'from-white to-blue-50/40', ringColor: 'ring-blue-100',
  },
  wip: {
    translationKey: 'wip', icon: Activity, color: 'text-orange-700', bgColor: 'bg-orange-100',
    iconGradient: 'from-orange-500 to-amber-500', cardTint: 'from-white to-orange-50/40', ringColor: 'ring-orange-100',
  },
  finished_goods: {
    translationKey: 'finishedGoods', icon: Boxes, color: 'text-green-700', bgColor: 'bg-green-100',
    iconGradient: 'from-emerald-500 to-green-500', cardTint: 'from-white to-emerald-50/40', ringColor: 'ring-emerald-100',
  },
  quarantine: {
    translationKey: 'quarantine', icon: ShieldAlert, color: 'text-yellow-700', bgColor: 'bg-yellow-100',
    iconGradient: 'from-yellow-500 to-amber-500', cardTint: 'from-white to-yellow-50/40', ringColor: 'ring-yellow-100',
  },
  rejected: {
    translationKey: 'rejected', icon: XCircle, color: 'text-red-700', bgColor: 'bg-red-100',
    iconGradient: 'from-rose-500 to-red-500', cardTint: 'from-white to-rose-50/40', ringColor: 'ring-rose-100',
  },
  cold_storage: {
    translationKey: 'coldStorage', icon: Snowflake, color: 'text-cyan-700', bgColor: 'bg-cyan-100',
    iconGradient: 'from-cyan-500 to-sky-500', cardTint: 'from-white to-cyan-50/40', ringColor: 'ring-cyan-100',
  },
};

const getWarehouseTypeConfig = (type: string) => {
  return warehouseTypeConfig[type] || {
    translationKey: type,
    icon: Warehouse,
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    iconGradient: 'from-gray-400 to-gray-500',
    cardTint: 'from-white to-gray-50/40',
    ringColor: 'ring-gray-100',
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
        {/* Hero Banner — gradient header with at-a-glance summary */}
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl',
            'bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600',
            'shadow-lg ring-1 ring-emerald-500/20',
            'px-5 py-6 md:px-8 md:py-8'
          )}
        >
          {/* Decorative blurred orbs */}
          <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-emerald-50/90">
                <Activity className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">
                  GMP Pharmaceutical ERP
                </span>
              </div>
              <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight text-white">
                {t('title')}
              </h1>
              <p className="mt-2 max-w-2xl text-sm md:text-base text-emerald-50/90">
                {t('description')}
              </p>
            </div>

            {/* At-a-glance pill stats (desktop) */}
            {!isLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:flex md:items-center gap-2 md:gap-3">
                <div className="rounded-xl bg-white/15 backdrop-blur px-3 py-2 ring-1 ring-white/20">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-50/80">
                    {t('kpis.activeWorkOrders.label')}
                  </p>
                  <p className="mt-0.5 text-xl font-bold text-white">{activeWO}</p>
                </div>
                <div className="rounded-xl bg-white/15 backdrop-blur px-3 py-2 ring-1 ring-white/20">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-50/80">
                    {t('kpis.openDeviations.label')}
                  </p>
                  <p className="mt-0.5 text-xl font-bold text-white">{openDev}</p>
                </div>
                <div className="rounded-xl bg-white/15 backdrop-blur px-3 py-2 ring-1 ring-white/20">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-50/80">
                    {t('kpis.expiringSoon.label')}
                  </p>
                  <p className="mt-0.5 text-xl font-bold text-white">{expSoon}</p>
                </div>
                <div className="rounded-xl bg-white/15 backdrop-blur px-3 py-2 ring-1 ring-white/20">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-50/80">
                    {t('kpis.lotsInQuarantine.label')}
                  </p>
                  <p className="mt-0.5 text-xl font-bold text-white">{inQuar}</p>
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
            {/* Primary KPIs - Most Important Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                label={t('kpis.totalItems.label')}
                value={data?.summary.totalItems || 0}
                subtitle={t('kpis.totalItems.subtitle')}
                icon={<Package className="h-6 w-6" />}
                iconBgColor="bg-gradient-to-br from-blue-500 to-cyan-500"
                iconColor="text-white"
                trend="up"
                trendValue="+12%"
                className="motion-safe:animate-fade-in motion-reduce:animate-none ring-1 ring-blue-100 hover:ring-blue-300/60 hover:shadow-blue-100/40"
                style={{ animationDelay: '0ms' }}
              />

              <KPICard
                label={t('kpis.activeWorkOrders.label')}
                value={data?.summary.activeWorkOrders || 0}
                subtitle={t('kpis.activeWorkOrders.subtitle')}
                icon={<Factory className="h-6 w-6" />}
                iconBgColor="bg-gradient-to-br from-emerald-500 to-teal-500"
                iconColor="text-white"
                className="motion-safe:animate-fade-in motion-reduce:animate-none ring-1 ring-emerald-100 hover:ring-emerald-300/60 hover:shadow-emerald-100/40"
                style={{ animationDelay: '50ms' }}
              />

              <KPICard
                label={t('kpis.openDeviations.label')}
                value={data?.summary.openDeviations || 0}
                subtitle={t('kpis.openDeviations.subtitle')}
                icon={<AlertTriangle className="h-6 w-6" />}
                iconBgColor="bg-gradient-to-br from-rose-500 to-orange-500"
                iconColor="text-white"
                trend={data?.summary.openDeviations && data.summary.openDeviations > 0 ? 'up' : 'neutral'}
                trendValue={data?.summary.openDeviations && data.summary.openDeviations > 0 ? t('kpis.openDeviations.actionNeeded') : t('kpis.openDeviations.allClear')}
                className="motion-safe:animate-fade-in motion-reduce:animate-none ring-1 ring-rose-100 hover:ring-rose-300/60 hover:shadow-rose-100/40"
                style={{ animationDelay: '100ms' }}
              />

              <KPICard
                label={t('kpis.expiringSoon.label')}
                value={data?.summary.lotsExpiringSoon || 0}
                subtitle={t('kpis.expiringSoon.subtitle')}
                icon={<Calendar className="h-6 w-6" />}
                iconBgColor="bg-gradient-to-br from-amber-500 to-orange-500"
                iconColor="text-white"
                trend={data?.summary.lotsExpiringSoon && data.summary.lotsExpiringSoon > 5 ? 'up' : 'down'}
                trendValue={data?.summary.lotsExpiringSoon && data.summary.lotsExpiringSoon > 5 ? t('kpis.expiringSoon.monitorClosely') : t('kpis.expiringSoon.lowRisk')}
                className="motion-safe:animate-fade-in motion-reduce:animate-none ring-1 ring-amber-100 hover:ring-amber-300/60 hover:shadow-amber-100/40"
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
              {/* Recent Work Orders */}
              <Card
                elevation="raised"
                className={cn(
                  'motion-safe:animate-fade-in motion-reduce:animate-none',
                  'overflow-hidden bg-gradient-to-br from-white to-emerald-50/30',
                  'ring-1 ring-emerald-100/60 hover:ring-emerald-200'
                )}
                style={{ animationDelay: '400ms' }}
              >
                {/* Custom header with icon + count badge */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-100/60">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm">
                      <Factory className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base md:text-lg font-semibold text-gray-900 truncate">
                        {t('sections.recentWorkOrders.title')}
                      </h3>
                    </div>
                  </div>
                  {data?.recentWorkOrders && data.recentWorkOrders.length > 0 && (
                    <span className="flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
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
                            'p-3 rounded-xl border border-transparent',
                            'bg-white hover:bg-emerald-50/50 hover:border-emerald-200',
                            'hover:shadow-sm hover:-translate-y-0.5',
                            'transition-all duration-150',
                            'motion-reduce:transition-none motion-reduce:hover:transform-none',
                            'cursor-pointer'
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center group-hover:from-emerald-200 group-hover:to-teal-200 transition-colors">
                              <Factory className="h-4 w-4 text-emerald-700" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate">{wo.woNumber}</p>
                              <p className="text-xs text-gray-500 truncate">
                                {t('sections.recentWorkOrders.batchPrefix')}: {wo.batchNumber}
                              </p>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <Badge variant={getStatusVariant(wo.status)} dot>
                              {wo.status}
                            </Badge>
                            <p className="text-xs text-gray-500 mt-1 tabular-nums">
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

              {/* Inventory by Status */}
              <Card
                elevation="raised"
                className={cn(
                  'motion-safe:animate-fade-in motion-reduce:animate-none',
                  'overflow-hidden bg-gradient-to-br from-white to-blue-50/30',
                  'ring-1 ring-blue-100/60 hover:ring-blue-200'
                )}
                style={{ animationDelay: '450ms' }}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100/60">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-sm">
                      <Package className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base md:text-lg font-semibold text-gray-900 truncate">
                        {t('sections.inventoryByStatus.title')}
                      </h3>
                    </div>
                  </div>
                  {data?.inventoryByStatus && data.inventoryByStatus.length > 0 && (
                    <span className="flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
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
                                'group p-3 rounded-xl border border-transparent',
                                'bg-white hover:bg-blue-50/50 hover:border-blue-200',
                                'hover:shadow-sm transition-all duration-150',
                                'motion-reduce:transition-none'
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
                                    <Package className="h-4 w-4 text-blue-700" />
                                  </div>
                                  <Badge variant={getStatusVariant(item.status)} dot>
                                    {item.status}
                                  </Badge>
                                </div>
                                <div className="flex-shrink-0 text-right">
                                  <p className="font-bold text-gray-900 tabular-nums">
                                    {item.count}{' '}
                                    <span className="text-xs font-medium text-gray-500">
                                      {t('sections.inventoryByStatus.lotsUnit')}
                                    </span>
                                  </p>
                                  <p className="text-xs text-gray-500 tabular-nums">
                                    {t('sections.inventoryByStatus.totalPrefix')}:{' '}
                                    {Number(item.totalQuantity || 0).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              {/* Progress bar visualization */}
                              <div className="mt-2 h-1.5 w-full rounded-full bg-blue-100/50 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
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

            {/* Inventory by Warehouse Type */}
            <Card
              elevation="raised"
              className={cn(
                'motion-safe:animate-fade-in motion-reduce:animate-none',
                'overflow-hidden bg-gradient-to-br from-white to-slate-50/50',
                'ring-1 ring-slate-200/60'
              )}
              style={{ animationDelay: '500ms' }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-sm">
                    <Warehouse className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base md:text-lg font-semibold text-gray-900 truncate">
                      {t('sections.warehouseOverview.title')}
                    </h3>
                  </div>
                </div>
                {data?.inventoryByWarehouseType && data.inventoryByWarehouseType.length > 0 && (
                  <span className="flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
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
                            'group relative p-4 rounded-2xl',
                            'bg-gradient-to-br',
                            config.cardTint,
                            'ring-1',
                            config.ringColor,
                            'hover:shadow-lg hover:-translate-y-0.5',
                            'transition-all duration-200',
                            'motion-reduce:transition-none motion-reduce:hover:transform-none'
                          )}
                        >
                          {/* Top gradient accent stripe */}
                          <div className={cn(
                            'absolute top-0 left-4 right-4 h-1 rounded-b-full bg-gradient-to-r',
                            config.iconGradient
                          )} />
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              'flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center shadow-sm',
                              'bg-gradient-to-br',
                              config.iconGradient
                            )}>
                              <Icon className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 truncate">
                                {item.warehouseName}
                              </p>
                              <p className={cn('text-xs font-semibold mt-0.5', config.color)}>
                                {t(`warehouseTypes.${config.translationKey}`)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 pt-3 border-t border-gray-200/60 grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider font-medium text-gray-500">
                                {t('sections.warehouseOverview.lotsLabel')}
                              </p>
                              <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">
                                {Number(item.lotCount || 0).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider font-medium text-gray-500">
                                {t('sections.warehouseOverview.totalQtyLabel')}
                              </p>
                              <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">
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

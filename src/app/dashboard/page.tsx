'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, getStatusVariant } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
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
}> = {
  raw_material: { translationKey: 'rawMaterial', icon: Package, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  wip: { translationKey: 'wip', icon: Activity, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  finished_goods: { translationKey: 'finishedGoods', icon: Boxes, color: 'text-green-600', bgColor: 'bg-green-100' },
  quarantine: { translationKey: 'quarantine', icon: ShieldAlert, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  rejected: { translationKey: 'rejected', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
  cold_storage: { translationKey: 'coldStorage', icon: Snowflake, color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
};

const getWarehouseTypeConfig = (type: string) => {
  return warehouseTypeConfig[type] || {
    translationKey: type,
    icon: Warehouse,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100'
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

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title={t('title')}
          description={t('description')}
        />

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
              <Link
                href="/inventory/items"
                data-testid="kpi-link-total-items"
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                <KPICard
                  label={t('kpis.totalItems.label')}
                  value={data?.summary.totalItems || 0}
                  subtitle={t('kpis.totalItems.subtitle')}
                  icon={<Package className="h-6 w-6" />}
                  iconBgColor="bg-emerald-100"
                  iconColor="text-emerald-600"
                  trend="up"
                  trendValue="+12%"
                  className="h-full cursor-pointer motion-safe:animate-fade-in motion-reduce:animate-none"
                  style={{ animationDelay: '0ms' }}
                />
              </Link>

              <Link
                href="/production/work-orders"
                data-testid="kpi-link-active-work-orders"
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                <KPICard
                  label={t('kpis.activeWorkOrders.label')}
                  value={data?.summary.activeWorkOrders || 0}
                  subtitle={t('kpis.activeWorkOrders.subtitle')}
                  icon={<Factory className="h-6 w-6" />}
                  iconBgColor="bg-emerald-100"
                  iconColor="text-emerald-600"
                  className="h-full cursor-pointer motion-safe:animate-fade-in motion-reduce:animate-none"
                  style={{ animationDelay: '50ms' }}
                />
              </Link>

              <Link
                href="/quality/deviations"
                data-testid="kpi-link-open-deviations"
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                <KPICard
                  label={t('kpis.openDeviations.label')}
                  value={data?.summary.openDeviations || 0}
                  subtitle={t('kpis.openDeviations.subtitle')}
                  icon={<AlertTriangle className="h-6 w-6" />}
                  iconBgColor="bg-red-100"
                  iconColor="text-red-600"
                  trend={data?.summary.openDeviations && data.summary.openDeviations > 0 ? 'up' : 'neutral'}
                  trendValue={data?.summary.openDeviations && data.summary.openDeviations > 0 ? t('kpis.openDeviations.actionNeeded') : t('kpis.openDeviations.allClear')}
                  className="h-full cursor-pointer motion-safe:animate-fade-in motion-reduce:animate-none"
                  style={{ animationDelay: '100ms' }}
                />
              </Link>

              <Link
                href="/inventory/expiry-alerts"
                data-testid="kpi-link-expiring-soon"
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                <KPICard
                  label={t('kpis.expiringSoon.label')}
                  value={data?.summary.lotsExpiringSoon || 0}
                  subtitle={t('kpis.expiringSoon.subtitle')}
                  icon={<Calendar className="h-6 w-6" />}
                  iconBgColor="bg-orange-100"
                  iconColor="text-orange-600"
                  trend={data?.summary.lotsExpiringSoon && data.summary.lotsExpiringSoon > 5 ? 'up' : 'down'}
                  trendValue={data?.summary.lotsExpiringSoon && data.summary.lotsExpiringSoon > 5 ? t('kpis.expiringSoon.monitorClosely') : t('kpis.expiringSoon.lowRisk')}
                  className="h-full cursor-pointer motion-safe:animate-fade-in motion-reduce:animate-none"
                  style={{ animationDelay: '150ms' }}
                />
              </Link>
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link
                href="/inventory/lots?status=quarantine"
                data-testid="stat-link-lots-in-quarantine"
                className="block rounded-xl"
              >
                <StatCard
                  label={t('kpis.lotsInQuarantine.label')}
                  value={data?.summary.lotsInQuarantine || 0}
                  icon={<Clock className="h-5 w-5" />}
                  variant="warning"
                  size="md"
                  clickable
                  className="h-full motion-safe:animate-fade-in motion-reduce:animate-none"
                  style={{ animationDelay: '200ms' }}
                />
              </Link>

              <Link
                href="/purchasing/orders?status=draft"
                data-testid="stat-link-pending-pos"
                className="block rounded-xl"
              >
                <StatCard
                  label={t('kpis.pendingPOs.label')}
                  value={data?.summary.pendingPOs || 0}
                  icon={<ShoppingCart className="h-5 w-5" />}
                  variant="info"
                  size="md"
                  clickable
                  className="h-full motion-safe:animate-fade-in motion-reduce:animate-none"
                  style={{ animationDelay: '250ms' }}
                />
              </Link>

              <Link
                href="/sales/orders?status=draft"
                data-testid="stat-link-pending-sos"
                className="block rounded-xl"
              >
                <StatCard
                  label={t('kpis.pendingSOs.label')}
                  value={data?.summary.pendingSOs || 0}
                  icon={<Truck className="h-5 w-5" />}
                  variant="primary"
                  size="md"
                  clickable
                  className="h-full motion-safe:animate-fade-in motion-reduce:animate-none"
                  style={{ animationDelay: '300ms' }}
                />
              </Link>

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
                title={t('sections.recentWorkOrders.title')}
                description=""
                elevation="raised"
                className="motion-safe:animate-fade-in motion-reduce:animate-none"
                style={{ animationDelay: '400ms' }}
              >
                <CardContent>
                  {data?.recentWorkOrders && data.recentWorkOrders.length > 0 ? (
                    <div className="space-y-3">
                      {data.recentWorkOrders.map((wo, index) => (
                        <Link
                          key={wo.id}
                          href={`/production/work-orders/${wo.id}`}
                          data-testid={`work-order-link-${wo.id}`}
                          className={cn(
                            'flex items-center justify-between',
                            'p-3 bg-emerald-50/60 rounded-lg',
                            'hover:bg-emerald-100/70 hover:shadow-sm',
                            'transition-all duration-150',
                            'motion-reduce:transition-none',
                            'cursor-pointer',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                              <Factory className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{wo.woNumber}</p>
                              <p className="text-sm text-gray-500">{t('sections.recentWorkOrders.batchPrefix')}: {wo.batchNumber}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={getStatusVariant(wo.status)} dot>
                              {wo.status}
                            </Badge>
                            <p className="text-sm text-gray-500 mt-1">
                              {wo.plannedQuantity.toLocaleString()} {wo.unit}
                            </p>
                          </div>
                        </Link>
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
                title={t('sections.inventoryByStatus.title')}
                description=""
                elevation="raised"
                className="motion-safe:animate-fade-in motion-reduce:animate-none"
                style={{ animationDelay: '450ms' }}
              >
                <CardContent>
                  {data?.inventoryByStatus && data.inventoryByStatus.length > 0 ? (
                    <div className="space-y-3">
                      {data.inventoryByStatus.map((item) => (
                        <Link
                          key={item.status}
                          href={`/inventory/lots?status=${encodeURIComponent(item.status)}`}
                          data-testid={`inventory-status-link-${item.status}`}
                          className={cn(
                            'flex items-center justify-between',
                            'p-3 bg-emerald-50/60 rounded-lg',
                            'hover:bg-emerald-100/70 hover:shadow-sm',
                            'transition-all duration-150',
                            'motion-reduce:transition-none',
                            'cursor-pointer',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                              <Package className="h-4 w-4 text-emerald-600" />
                            </div>
                            <Badge variant={getStatusVariant(item.status)} dot>
                              {item.status}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">{item.count} {t('sections.inventoryByStatus.lotsUnit')}</p>
                            <p className="text-sm text-gray-500">
                              {t('sections.inventoryByStatus.totalPrefix')}: {Number(item.totalQuantity || 0).toLocaleString()}
                            </p>
                          </div>
                        </Link>
                      ))}
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
              title={t('sections.warehouseOverview.title')}
              description=""
              elevation="raised"
              className="motion-safe:animate-fade-in motion-reduce:animate-none"
              style={{ animationDelay: '500ms' }}
            >
              <CardContent>
                {data?.inventoryByWarehouseType && data.inventoryByWarehouseType.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.inventoryByWarehouseType.map((item, index) => {
                      const config = getWarehouseTypeConfig(item.warehouseType);
                      const Icon = config.icon;
                      return (
                        <Link
                          key={`${item.warehouseType}-${item.warehouseName}-${index}`}
                          href={`/inventory/warehouses?type=${encodeURIComponent(item.warehouseType)}`}
                          data-testid={`warehouse-link-${item.warehouseType}-${index}`}
                          className={cn(
                            'block p-4 rounded-xl border border-emerald-100',
                            'bg-gradient-to-br from-white to-emerald-50/50',
                            'hover:shadow-md hover:border-emerald-200',
                            'transition-all duration-200',
                            'motion-reduce:transition-none',
                            'cursor-pointer',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
                              config.bgColor
                            )}>
                              <Icon className={cn('h-5 w-5', config.color)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 truncate">
                                {item.warehouseName}
                              </p>
                              <p className={cn('text-xs font-medium', config.color)}>
                                {t(`warehouseTypes.${config.translationKey}`)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs text-gray-500">{t('sections.warehouseOverview.lotsLabel')}</p>
                              <p className="text-lg font-bold text-gray-900">
                                {Number(item.lotCount || 0).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">{t('sections.warehouseOverview.totalQtyLabel')}</p>
                              <p className="text-lg font-bold text-gray-900">
                                {Number(item.totalQuantity || 0).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </Link>
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

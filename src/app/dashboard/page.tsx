'use client';

import { useEffect, useState } from 'react';
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

// Warehouse type configuration
const warehouseTypeConfig: Record<string, {
  label: string;
  icon: typeof Package;
  color: string;
  bgColor: string;
}> = {
  raw_material: { label: 'Raw Material', icon: Package, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  wip: { label: 'Work in Progress', icon: Activity, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  finished_goods: { label: 'Finished Goods', icon: Boxes, color: 'text-green-600', bgColor: 'bg-green-100' },
  quarantine: { label: 'Quarantine', icon: ShieldAlert, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
  cold_storage: { label: 'Cold Storage', icon: Snowflake, color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
};

const getWarehouseTypeConfig = (type: string) => {
  return warehouseTypeConfig[type] || {
    label: type.replace(/_/g, ' '),
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
          title="Dashboard"
          description="ภาพรวมระบบบริหารจัดการการผลิตยาสมุนไพร"
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
              <KPICard
                label="Total Items"
                value={data?.summary.totalItems || 0}
                subtitle="Active inventory items"
                icon={<Package className="h-6 w-6" />}
                iconBgColor="bg-blue-100"
                iconColor="text-blue-600"
                trend="up"
                trendValue="+12%"
                className="motion-safe:animate-fade-in motion-reduce:animate-none"
                style={{ animationDelay: '0ms' }}
              />

              <KPICard
                label="Active Work Orders"
                value={data?.summary.activeWorkOrders || 0}
                subtitle="Currently in production"
                icon={<Factory className="h-6 w-6" />}
                iconBgColor="bg-emerald-100"
                iconColor="text-emerald-600"
                className="motion-safe:animate-fade-in motion-reduce:animate-none"
                style={{ animationDelay: '50ms' }}
              />

              <KPICard
                label="Open Deviations"
                value={data?.summary.openDeviations || 0}
                subtitle="Requires attention"
                icon={<AlertTriangle className="h-6 w-6" />}
                iconBgColor="bg-red-100"
                iconColor="text-red-600"
                trend={data?.summary.openDeviations && data.summary.openDeviations > 0 ? 'up' : 'neutral'}
                trendValue={data?.summary.openDeviations && data.summary.openDeviations > 0 ? 'Action needed' : 'All clear'}
                className="motion-safe:animate-fade-in motion-reduce:animate-none"
                style={{ animationDelay: '100ms' }}
              />

              <KPICard
                label="Expiring Soon"
                value={data?.summary.lotsExpiringSoon || 0}
                subtitle="Within 30 days"
                icon={<Calendar className="h-6 w-6" />}
                iconBgColor="bg-orange-100"
                iconColor="text-orange-600"
                trend={data?.summary.lotsExpiringSoon && data.summary.lotsExpiringSoon > 5 ? 'up' : 'down'}
                trendValue={data?.summary.lotsExpiringSoon && data.summary.lotsExpiringSoon > 5 ? 'Monitor closely' : 'Low risk'}
                className="motion-safe:animate-fade-in motion-reduce:animate-none"
                style={{ animationDelay: '150ms' }}
              />
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Lots in Quarantine"
                value={data?.summary.lotsInQuarantine || 0}
                icon={<Clock className="h-5 w-5" />}
                variant="warning"
                size="md"
                className="motion-safe:animate-fade-in motion-reduce:animate-none"
                style={{ animationDelay: '200ms' }}
              />

              <StatCard
                label="Pending POs"
                value={data?.summary.pendingPOs || 0}
                icon={<ShoppingCart className="h-5 w-5" />}
                variant="info"
                size="md"
                className="motion-safe:animate-fade-in motion-reduce:animate-none"
                style={{ animationDelay: '250ms' }}
              />

              <StatCard
                label="Pending SOs"
                value={data?.summary.pendingSOs || 0}
                icon={<Truck className="h-5 w-5" />}
                variant="primary"
                size="md"
                className="motion-safe:animate-fade-in motion-reduce:animate-none"
                style={{ animationDelay: '300ms' }}
              />

              <StatCard
                label="Monthly Growth"
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
                title="Recent Work Orders"
                description="ใบสั่งผลิตล่าสุด"
                elevation="raised"
                className="motion-safe:animate-fade-in motion-reduce:animate-none"
                style={{ animationDelay: '400ms' }}
              >
                <CardContent>
                  {data?.recentWorkOrders && data.recentWorkOrders.length > 0 ? (
                    <div className="space-y-3">
                      {data.recentWorkOrders.map((wo, index) => (
                        <div
                          key={wo.id}
                          className={cn(
                            'flex items-center justify-between',
                            'p-3 bg-gray-50 rounded-lg',
                            'hover:bg-gray-100 hover:shadow-sm',
                            'transition-all duration-150',
                            'motion-reduce:transition-none',
                            'cursor-pointer'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                              <Factory className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{wo.woNumber}</p>
                              <p className="text-sm text-gray-500">Batch: {wo.batchNumber}</p>
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
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Inbox className="h-6 w-6" />}
                      title="No recent work orders"
                      description="Work orders will appear here once created"
                      size="sm"
                    />
                  )}
                </CardContent>
              </Card>

              {/* Inventory by Status */}
              <Card
                title="Inventory by Status"
                description="สถานะสินค้าคงคลัง"
                elevation="raised"
                className="motion-safe:animate-fade-in motion-reduce:animate-none"
                style={{ animationDelay: '450ms' }}
              >
                <CardContent>
                  {data?.inventoryByStatus && data.inventoryByStatus.length > 0 ? (
                    <div className="space-y-3">
                      {data.inventoryByStatus.map((item) => (
                        <div
                          key={item.status}
                          className={cn(
                            'flex items-center justify-between',
                            'p-3 bg-gray-50 rounded-lg',
                            'hover:bg-gray-100 hover:shadow-sm',
                            'transition-all duration-150',
                            'motion-reduce:transition-none'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                              <Package className="h-4 w-4 text-blue-600" />
                            </div>
                            <Badge variant={getStatusVariant(item.status)} dot>
                              {item.status}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">{item.count} lots</p>
                            <p className="text-sm text-gray-500">
                              Total: {Number(item.totalQuantity || 0).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Package className="h-6 w-6" />}
                      title="No inventory data"
                      description="Inventory status will appear here"
                      size="sm"
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Inventory by Warehouse Type */}
            <Card
              title="Inventory by Warehouse Type"
              description="สินค้าคงคลังแยกตามประเภทคลัง"
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
                        <div
                          key={`${item.warehouseType}-${item.warehouseName}-${index}`}
                          className={cn(
                            'p-4 rounded-xl border border-gray-100',
                            'bg-gradient-to-br from-white to-gray-50',
                            'hover:shadow-md hover:border-gray-200',
                            'transition-all duration-200',
                            'motion-reduce:transition-none'
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
                                {config.label}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs text-gray-500">Lots</p>
                              <p className="text-lg font-bold text-gray-900">
                                {Number(item.lotCount || 0).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Total Qty</p>
                              <p className="text-lg font-bold text-gray-900">
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
                    title="No warehouse data"
                    description="Warehouse inventory will appear here once warehouses are set up"
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

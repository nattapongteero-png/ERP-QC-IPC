'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, getStatusVariant } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { CardSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Package,
  Factory,
  AlertTriangle,
  ShoppingCart,
  Truck,
  Clock,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

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

  const stats = data?.summary
    ? [
        {
          name: 'Total Items',
          value: data.summary.totalItems,
          icon: Package,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
        },
        {
          name: 'Lots in Quarantine',
          value: data.summary.lotsInQuarantine,
          icon: Clock,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
        },
        {
          name: 'Active Work Orders',
          value: data.summary.activeWorkOrders,
          icon: Factory,
          color: 'text-emerald-600',
          bgColor: 'bg-emerald-100',
        },
        {
          name: 'Open Deviations',
          value: data.summary.openDeviations,
          icon: AlertTriangle,
          color: 'text-red-600',
          bgColor: 'bg-red-100',
        },
        {
          name: 'Pending POs',
          value: data.summary.pendingPOs,
          icon: ShoppingCart,
          color: 'text-purple-600',
          bgColor: 'bg-purple-100',
        },
        {
          name: 'Pending SOs',
          value: data.summary.pendingSOs,
          icon: Truck,
          color: 'text-indigo-600',
          bgColor: 'bg-indigo-100',
        },
      ]
    : [];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          description="ภาพรวมระบบบริหารจัดการการผลิตยาสมุนไพร"
        />

        {isLoading ? (
          <div className="space-y-6">
            {/* Stats Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} elevation="raised" padding="md">
                  <div className="flex items-center gap-4 animate-pulse">
                    <div className="h-12 w-12 rounded-lg bg-gray-200" />
                    <div className="space-y-2">
                      <div className="h-3 w-20 bg-gray-200 rounded" />
                      <div className="h-6 w-12 bg-gray-200 rounded" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            {/* Cards Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CardSkeleton lines={4} />
              <CardSkeleton lines={4} />
            </div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {stats.map((stat, index) => (
                <Card
                  key={stat.name}
                  elevation="raised"
                  padding="md"
                  className={cn(
                    'motion-safe:animate-fade-in',
                    'motion-reduce:animate-none'
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center">
                    <div className={cn('p-3 rounded-lg', stat.bgColor)}>
                      <stat.icon className={cn('h-6 w-6', stat.color)} />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-gray-500">{stat.name}</p>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Work Orders */}
              <Card
                title="Recent Work Orders"
                description="ใบสั่งผลิตล่าสุด"
                elevation="raised"
              >
                <CardContent>
                  {data?.recentWorkOrders && data.recentWorkOrders.length > 0 ? (
                    <div className="space-y-3">
                      {data.recentWorkOrders.map((wo) => (
                        <div
                          key={wo.id}
                          className={cn(
                            'flex items-center justify-between',
                            'p-3 bg-gray-50 rounded-lg',
                            'hover:bg-gray-100 transition-colors duration-150',
                            'motion-reduce:transition-none'
                          )}
                        >
                          <div>
                            <p className="font-medium text-gray-900">{wo.woNumber}</p>
                            <p className="text-sm text-gray-500">Batch: {wo.batchNumber}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant={getStatusVariant(wo.status)} dot>
                              {wo.status}
                            </Badge>
                            <p className="text-sm text-gray-500 mt-1">
                              {wo.plannedQuantity} {wo.unit}
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
                            'hover:bg-gray-100 transition-colors duration-150',
                            'motion-reduce:transition-none'
                          )}
                        >
                          <div className="flex items-center">
                            <Badge variant={getStatusVariant(item.status)} dot>
                              {item.status}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900">{item.count} lots</p>
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
          </>
        )}
      </div>
    </MainLayout>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card } from '@/components/ui/card';
import { Badge, getStatusVariant } from '@/components/ui/badge';
import {
  Package,
  Factory,
  AlertTriangle,
  ShoppingCart,
  Truck,
  Clock,
} from 'lucide-react';

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
  recentWorkOrders: any[];
  inventoryByStatus: any[];
  workOrdersByStatus: any[];
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">ภาพรวมระบบบริหารจัดการการผลิตยาสมุนไพร</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {stats.map((stat) => (
                <Card key={stat.name} className="p-4">
                  <div className="flex items-center">
                    <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                      <stat.icon className={`h-6 w-6 ${stat.color}`} />
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
              <Card title="Recent Work Orders" description="ใบสั่งผลิตล่าสุด">
                {data?.recentWorkOrders && data.recentWorkOrders.length > 0 ? (
                  <div className="space-y-3">
                    {data.recentWorkOrders.map((wo: any) => (
                      <div
                        key={wo.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{wo.woNumber}</p>
                          <p className="text-sm text-gray-500">Batch: {wo.batchNumber}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={getStatusVariant(wo.status)}>
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
                  <p className="text-gray-500 text-center py-4">No recent work orders</p>
                )}
              </Card>

              {/* Inventory by Status */}
              <Card title="Inventory by Status" description="สถานะสินค้าคงคลัง">
                {data?.inventoryByStatus && data.inventoryByStatus.length > 0 ? (
                  <div className="space-y-3">
                    {data.inventoryByStatus.map((item: any) => (
                      <div
                        key={item.status}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center">
                          <Badge variant={getStatusVariant(item.status)}>
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
                  <p className="text-gray-500 text-center py-4">No inventory data</p>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}

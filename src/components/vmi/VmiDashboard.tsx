'use client';

/**
 * VMI Dashboard Component
 *
 * Displays VMI sync status, order statistics, and quick actions.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { cn } from '@/lib/utils/cn';
import { useQuery } from '@tanstack/react-query';
import {
  Package,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

// ============================================
// Types
// ============================================

interface DashboardStats {
  sync: {
    lastInventorySync?: string;
    lastItemsSync?: string;
    lastPricesSync?: string;
    inventorySyncStatus?: string;
    itemsSyncStatus?: string;
    pricesSyncStatus?: string;
  };
  orders: {
    pendingOrders: number;
    confirmedOrders: number;
    processingOrders: number;
    shippedToday: number;
    unmatchedItems: number;
    urgentOrders: number;
  };
  portals: {
    activePortals: number;
    totalPortals: number;
  };
}

interface VmiDashboardProps {
  className?: string;
}

// ============================================
// API Functions
// ============================================

async function fetchDashboardStats(): Promise<DashboardStats> {
  const [syncResponse, ordersResponse, portalsResponse] = await Promise.all([
    fetch('/api/vmi-sync/status?limit=3'),
    fetch('/api/sales/vmi-orders?limit=100'),
    fetch('/api/settings/vmi-portal'),
  ]);

  const syncData = await syncResponse.json();
  const ordersData = await ordersResponse.json();
  const portalsData = await portalsResponse.json();

  // Process sync data
  const syncItems = syncData.success ? syncData.data?.items || [] : [];
  const lastInventorySync = syncItems.find((s: { syncType: string }) => s.syncType === 'inventory');
  const lastItemsSync = syncItems.find((s: { syncType: string }) => s.syncType === 'items');
  const lastPricesSync = syncItems.find((s: { syncType: string }) => s.syncType === 'prices');

  // Process orders data
  const orders = ordersData.success ? ordersData.data?.items || [] : [];
  const pendingOrders = orders.filter((o: { status: string }) => o.status === 'pending').length;
  const confirmedOrders = orders.filter((o: { status: string }) => o.status === 'confirmed').length;
  const processingOrders = orders.filter((o: { status: string }) => o.status === 'processing').length;
  const today = new Date().toISOString().split('T')[0];
  const shippedToday = orders.filter((o: { status: string; shippedAt?: string }) =>
    o.status === 'shipped' && o.shippedAt?.startsWith(today)
  ).length;
  const unmatchedItems = orders
    .filter((o: { status: string }) => o.status === 'pending')
    .reduce((sum: number, o: { unmatchedItems?: number }) => sum + (o.unmatchedItems || 0), 0);
  const urgentOrders = orders.filter((o: { priority: string; status: string }) =>
    o.priority === 'urgent' && o.status !== 'shipped' && o.status !== 'delivered' && o.status !== 'cancelled'
  ).length;

  // Process portals data
  const portals = portalsData.success ? portalsData.data || [] : [];
  const activePortals = portals.filter((p: { isActive: boolean }) => p.isActive).length;

  return {
    sync: {
      lastInventorySync: lastInventorySync?.startedAt,
      lastItemsSync: lastItemsSync?.startedAt,
      lastPricesSync: lastPricesSync?.startedAt,
      inventorySyncStatus: lastInventorySync?.status,
      itemsSyncStatus: lastItemsSync?.status,
      pricesSyncStatus: lastPricesSync?.status,
    },
    orders: {
      pendingOrders,
      confirmedOrders,
      processingOrders,
      shippedToday,
      unmatchedItems,
      urgentOrders,
    },
    portals: {
      activePortals,
      totalPortals: portals.length,
    },
  };
}

// ============================================
// Component
// ============================================

export function VmiDashboard({ className }: VmiDashboardProps) {
  const { data: stats, isLoading, error, refetch } = useQuery({
    queryKey: ['vmi-dashboard'],
    queryFn: fetchDashboardStats,
    refetchInterval: 60000, // Refetch every minute
  });

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getStatusIcon = (status?: string) => {
    if (!status) return <Clock className="h-4 w-4 text-gray-400" />;
    if (status === 'completed') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === 'running') return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
    if (status === 'failed') return <AlertTriangle className="h-4 w-4 text-red-500" />;
    return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  };

  if (isLoading) {
    return (
      <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6 h-32 bg-gray-100" />
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center text-red-600">
          Failed to load dashboard data
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Pending Orders */}
        <Card className={cn(
          'transition-colors',
          stats?.orders.pendingOrders && stats.orders.pendingOrders > 0 ? 'border-yellow-200 bg-yellow-50' : ''
        )}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Pending Orders</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.orders.pendingOrders || 0}</p>
              </div>
              <ShoppingCart className="h-10 w-10 text-yellow-500" />
            </div>
            {stats?.orders.urgentOrders && stats.orders.urgentOrders > 0 && (
              <p className="mt-2 text-sm text-red-600 font-medium">
                {stats.orders.urgentOrders} urgent
              </p>
            )}
          </CardContent>
        </Card>

        {/* Unmatched Items */}
        <Card className={cn(
          'transition-colors',
          stats?.orders.unmatchedItems && stats.orders.unmatchedItems > 0 ? 'border-orange-200 bg-orange-50' : ''
        )}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Unmatched Items</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.orders.unmatchedItems || 0}</p>
              </div>
              <AlertTriangle className="h-10 w-10 text-orange-500" />
            </div>
            {stats?.orders.unmatchedItems && stats.orders.unmatchedItems > 0 && (
              <p className="mt-2 text-sm text-orange-600">
                Require manual matching
              </p>
            )}
          </CardContent>
        </Card>

        {/* Processing */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">In Processing</p>
                <p className="text-3xl font-bold text-gray-900">
                  {(stats?.orders.confirmedOrders || 0) + (stats?.orders.processingOrders || 0)}
                </p>
              </div>
              <Package className="h-10 w-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        {/* Shipped Today */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Shipped Today</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.orders.shippedToday || 0}</p>
              </div>
              <TrendingUp className="h-10 w-10 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Status and Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Sync Status */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle>Sync Status</CardTitle>
              <DxButton
                icon="refresh"
                type="normal"
                stylingMode="text"
                onClick={() => refetch()}
                hint="Refresh"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2">
                  {getStatusIcon(stats?.sync.inventorySyncStatus)}
                  <span className="font-medium">Inventory</span>
                </div>
                <span className="text-sm text-gray-500">
                  {formatTimeAgo(stats?.sync.lastInventorySync)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2">
                  {getStatusIcon(stats?.sync.itemsSyncStatus)}
                  <span className="font-medium">Items</span>
                </div>
                <span className="text-sm text-gray-500">
                  {formatTimeAgo(stats?.sync.lastItemsSync)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2">
                  {getStatusIcon(stats?.sync.pricesSyncStatus)}
                  <span className="font-medium">Prices</span>
                </div>
                <span className="text-sm text-gray-500">
                  {formatTimeAgo(stats?.sync.lastPricesSync)}
                </span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">
                <strong>{stats?.portals.activePortals || 0}</strong> of{' '}
                <strong>{stats?.portals.totalPortals || 0}</strong> portals active
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card elevation="raised">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Link href="/sales/vmi-orders" className="block">
                <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Manage Orders</span>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </div>
              </Link>
              <Link href="/vmi/sync" className="block">
                <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Sync Management</span>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </div>
              </Link>
              <Link href="/settings/vmi" className="block">
                <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-purple-600" />
                    <span className="font-medium">Portal Settings</span>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default VmiDashboard;

'use client';

/**
 * VMI Dashboard Page
 *
 * Main landing page for VMI (Vendor Managed Inventory) features.
 * Shows sync status, order statistics, and quick actions.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
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
  Link2,
  Database,
  DollarSign,
  Truck,
  Building2,
  Settings,
  Activity,
  BarChart3,
  Zap,
  Server,
  Globe,
  Bell,
  FileText,
  Users,
} from 'lucide-react';
import Link from 'next/link';

// ============================================================================
// Types
// ============================================================================

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
    totalOrders: number;
    deliveredOrders: number;
  };
  portals: {
    activePortals: number;
    totalPortals: number;
  };
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchDashboardStats(): Promise<DashboardStats> {
  const [syncResponse, ordersResponse, portalsResponse] = await Promise.all([
    fetch('/api/vmi-sync/status?limit=3'),
    fetch('/api/sales/vmi-orders?limit=500'),
    fetch('/api/settings/vmi'),
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
  const deliveredOrders = orders.filter((o: { status: string }) => o.status === 'delivered').length;
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
      totalOrders: orders.length,
      deliveredOrders,
    },
    portals: {
      activePortals,
      totalPortals: portals.length,
    },
  };
}

// ============================================================================
// Main Component
// ============================================================================

export default function VmiPage() {
  const t = useTranslations('vmi');
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['vmi-dashboard'],
    queryFn: fetchDashboardStats,
    refetchInterval: 60000,
  });

  // ============================================================================
  // Helper Functions (inside component to use t())
  // ============================================================================

  const formatTimeAgo = useCallback((dateString?: string) => {
    if (!dateString) return t('syncStatus.never');
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t('syncStatus.justNow');
    if (diffMins < 60) return t('syncStatus.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('syncStatus.hoursAgo', { count: diffHours });
    return t('syncStatus.daysAgo', { count: diffDays });
  }, [t]);

  const getSyncStatusConfig = useCallback((status?: string) => {
    if (!status) return { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-100', label: t('syncStatus.unknown') };
    if (status === 'completed') return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: t('syncStatus.completed') };
    if (status === 'running') return { icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-100', label: t('syncStatus.running'), animate: true };
    if (status === 'failed') return { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100', label: t('syncStatus.failed') };
    return { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100', label: t('syncStatus.hasIssues') };
  }, [t]);

  // ============================================================================
  // Loading State
  // ============================================================================

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="h-40 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-80 bg-gray-200 rounded-xl animate-pulse" />
            <div className="h-80 bg-gray-200 rounded-xl animate-pulse" />
          </div>
        </div>
      </MainLayout>
    );
  }

  const totalActiveOrders = (stats?.orders.pendingOrders || 0) +
    (stats?.orders.confirmedOrders || 0) +
    (stats?.orders.processingOrders || 0);

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <MainLayout>
      <div className="flex flex-col h-full gap-4">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600">
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-24 -translate-x-24" />

          <div className="relative z-10 p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Link2 className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{t('dashboard.title')}</h1>
                  <p className="text-white/80 text-sm">{t('dashboard.subtitle')}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => refetch()}
                  className="h-10 w-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg flex items-center justify-center text-white transition-colors"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
                <Link href="/vmi/sync">
                  <DxButton
                    text={t('dashboard.manageSync')}
                    icon="refresh"
                    type="default"
                  />
                </Link>
                <Link href="/sales/vmi-orders">
                  <DxButton
                    text={t('dashboard.viewOrders')}
                    icon="cart"
                    type="success"
                  />
                </Link>
              </div>
            </div>

            {/* Quick Stats in Header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                <p className="text-white/70 text-xs">{t('dashboard.connectedPortals')}</p>
                <p className="text-2xl font-bold text-white">
                  {stats?.portals.activePortals || 0}/{stats?.portals.totalPortals || 0}
                </p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                <p className="text-white/70 text-xs">{t('dashboard.pendingOrders')}</p>
                <p className="text-2xl font-bold text-white">{totalActiveOrders}</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                <p className="text-white/70 text-xs">{t('dashboard.shippedToday')}</p>
                <p className="text-2xl font-bold text-white">{stats?.orders.shippedToday || 0}</p>
              </div>
              <div className={cn(
                'backdrop-blur-sm rounded-lg p-3',
                (stats?.orders.urgentOrders || 0) > 0 ? 'bg-red-500/50' : 'bg-white/20'
              )}>
                <p className="text-white/70 text-xs">{t('dashboard.urgentOrders')}</p>
                <p className="text-2xl font-bold text-white">{stats?.orders.urgentOrders || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Order Status Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <Card elevation="raised" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="w-1 bg-amber-500" />
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 bg-amber-100 rounded-lg flex items-center justify-center">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{t('orderStatus.pending')}</p>
                      <p className="text-lg font-bold text-amber-600">{stats?.orders.pendingOrders || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card elevation="raised" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="w-1 bg-blue-500" />
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 bg-blue-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{t('orderStatus.confirmed')}</p>
                      <p className="text-lg font-bold text-blue-600">{stats?.orders.confirmedOrders || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card elevation="raised" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="w-1 bg-violet-500" />
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 bg-violet-100 rounded-lg flex items-center justify-center">
                      <Package className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{t('orderStatus.processing')}</p>
                      <p className="text-lg font-bold text-violet-600">{stats?.orders.processingOrders || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card elevation="raised" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="w-1 bg-cyan-500" />
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 bg-cyan-100 rounded-lg flex items-center justify-center">
                      <Truck className="h-5 w-5 text-cyan-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{t('orderStatus.shippedToday')}</p>
                      <p className="text-lg font-bold text-cyan-600">{stats?.orders.shippedToday || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card elevation="raised" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="w-1 bg-green-500" />
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 bg-green-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{t('orderStatus.delivered')}</p>
                      <p className="text-lg font-bold text-green-600">{stats?.orders.deliveredOrders || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card elevation="raised" className={cn(
            'overflow-hidden',
            (stats?.orders.unmatchedItems || 0) > 0 && 'ring-2 ring-red-200'
          )}>
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className={cn('w-1', (stats?.orders.unmatchedItems || 0) > 0 ? 'bg-red-500' : 'bg-gray-300')} />
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'h-9 w-9 rounded-lg flex items-center justify-center',
                      (stats?.orders.unmatchedItems || 0) > 0 ? 'bg-red-100' : 'bg-gray-100'
                    )}>
                      <AlertTriangle className={cn(
                        'h-5 w-5',
                        (stats?.orders.unmatchedItems || 0) > 0 ? 'text-red-600' : 'text-gray-400'
                      )} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{t('orderStatus.unmatched')}</p>
                      <p className={cn(
                        'text-lg font-bold',
                        (stats?.orders.unmatchedItems || 0) > 0 ? 'text-red-600' : 'text-gray-400'
                      )}>
                        {stats?.orders.unmatchedItems || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
          {/* Sync Status */}
          <Card elevation="raised" className="lg:col-span-1">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-5 w-5 text-cyan-500" />
                  {t('syncStatus.title')}
                </CardTitle>
                <button
                  onClick={() => refetch()}
                  className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
                >
                  <RefreshCw className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {/* Inventory Sync */}
              {(() => {
                const config = getSyncStatusConfig(stats?.sync.inventorySyncStatus);
                const Icon = config.icon;
                return (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border">
                    <div className="flex items-center gap-3">
                      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', config.bg)}>
                        <Icon className={cn('h-5 w-5', config.color, config.animate && 'animate-spin')} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Inventory</p>
                        <p className="text-xs text-gray-500">{t('syncStatus.inventory')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-sm font-medium', config.color)}>{config.label}</p>
                      <p className="text-xs text-gray-400">{formatTimeAgo(stats?.sync.lastInventorySync)}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Items Sync */}
              {(() => {
                const config = getSyncStatusConfig(stats?.sync.itemsSyncStatus);
                const Icon = config.icon;
                return (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border">
                    <div className="flex items-center gap-3">
                      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', config.bg)}>
                        <Icon className={cn('h-5 w-5', config.color, config.animate && 'animate-spin')} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Items</p>
                        <p className="text-xs text-gray-500">{t('syncStatus.items')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-sm font-medium', config.color)}>{config.label}</p>
                      <p className="text-xs text-gray-400">{formatTimeAgo(stats?.sync.lastItemsSync)}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Prices Sync */}
              {(() => {
                const config = getSyncStatusConfig(stats?.sync.pricesSyncStatus);
                const Icon = config.icon;
                return (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border">
                    <div className="flex items-center gap-3">
                      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', config.bg)}>
                        <Icon className={cn('h-5 w-5', config.color, config.animate && 'animate-spin')} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Prices</p>
                        <p className="text-xs text-gray-500">{t('syncStatus.prices')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-sm font-medium', config.color)}>{config.label}</p>
                      <p className="text-xs text-gray-400">{formatTimeAgo(stats?.sync.lastPricesSync)}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Portal Status */}
              <div className="mt-4 p-4 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl border border-cyan-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                      <Globe className="h-5 w-5 text-cyan-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{t('portals.title')}</p>
                      <p className="text-xs text-gray-500">{t('portals.subtitle')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-cyan-600">
                      {stats?.portals.activePortals || 0}
                      <span className="text-sm font-normal text-gray-500">/{stats?.portals.totalPortals || 0}</span>
                    </p>
                    <p className="text-xs text-gray-500">{t('portals.activePortals')}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions & Recent Activity */}
          <Card elevation="raised" className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-5 w-5 text-amber-500" />
                {t('quickActions.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Link href="/sales/vmi-orders" className="block">
                  <div className="p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all group">
                    <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <ShoppingCart className="h-6 w-6 text-blue-600" />
                    </div>
                    <p className="font-semibold text-gray-900">{t('quickActions.manageOrders')}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('quickActions.manageOrdersDescription')}</p>
                    <div className="flex items-center gap-1 text-blue-600 text-xs mt-2">
                      <span>{t('quickActions.viewList')}</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                </Link>

                <Link href="/vmi/sync" className="block">
                  <div className="p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all group">
                    <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <RefreshCw className="h-6 w-6 text-green-600" />
                    </div>
                    <p className="font-semibold text-gray-900">{t('quickActions.syncManagement')}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('quickActions.syncDescription')}</p>
                    <div className="flex items-center gap-1 text-green-600 text-xs mt-2">
                      <span>{t('quickActions.goToSync')}</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                </Link>

                <Link href="/settings/vmi" className="block">
                  <div className="p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all group">
                    <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Settings className="h-6 w-6 text-purple-600" />
                    </div>
                    <p className="font-semibold text-gray-900">{t('quickActions.portalSettings')}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('quickActions.portalSettingsDescription')}</p>
                    <div className="flex items-center gap-1 text-purple-600 text-xs mt-2">
                      <span>{t('quickActions.settings')}</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                </Link>

                <Link href="/inventory/items" className="block">
                  <div className="p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group">
                    <div className="h-12 w-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Database className="h-6 w-6 text-indigo-600" />
                    </div>
                    <p className="font-semibold text-gray-900">{t('quickActions.itemMapping')}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('quickActions.itemMappingDescription')}</p>
                    <div className="flex items-center gap-1 text-indigo-600 text-xs mt-2">
                      <span>{t('quickActions.manageItems')}</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                </Link>

                <Link href="/inventory/lots" className="block">
                  <div className="p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-cyan-300 hover:bg-cyan-50 transition-all group">
                    <div className="h-12 w-12 bg-cyan-100 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Package className="h-6 w-6 text-cyan-600" />
                    </div>
                    <p className="font-semibold text-gray-900">{t('quickActions.inventoryLots')}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('quickActions.lotsDescription')}</p>
                    <div className="flex items-center gap-1 text-cyan-600 text-xs mt-2">
                      <span>{t('quickActions.viewLots')}</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                </Link>

                <Link href="/sales/customers" className="block">
                  <div className="p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-all group">
                    <div className="h-12 w-12 bg-amber-100 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Building2 className="h-6 w-6 text-amber-600" />
                    </div>
                    <p className="font-semibold text-gray-900">{t('quickActions.hospitalPartners')}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('quickActions.partnersDescription')}</p>
                    <div className="flex items-center gap-1 text-amber-600 text-xs mt-2">
                      <span>{t('quickActions.viewList')}</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                </Link>
              </div>

              {/* Alert Section */}
              {((stats?.orders.unmatchedItems || 0) > 0 || (stats?.orders.urgentOrders || 0) > 0) && (
                <div className="mt-4 space-y-3">
                  {(stats?.orders.unmatchedItems || 0) > 0 && (
                    <div className="flex items-center gap-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                      <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                        <AlertTriangle className="h-6 w-6 text-red-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-red-800">{t('alerts.unmatchedTitle')}</p>
                        <p className="text-sm text-red-600">
                          {t('alerts.unmatchedDescription', { count: stats?.orders.unmatchedItems ?? 0 })}
                        </p>
                      </div>
                      <Link href="/sales/vmi-orders?filter=unmatched">
                        <DxButton text={t('alerts.viewItems')} type="danger" stylingMode="outlined" />
                      </Link>
                    </div>
                  )}

                  {(stats?.orders.urgentOrders || 0) > 0 && (
                    <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="h-12 w-12 bg-amber-100 rounded-lg flex items-center justify-center">
                        <Bell className="h-6 w-6 text-amber-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-amber-800">{t('alerts.urgentTitle')}</p>
                        <p className="text-sm text-amber-600">
                          {t('alerts.urgentDescription', { count: stats?.orders.urgentOrders ?? 0 })}
                        </p>
                      </div>
                      <Link href="/sales/vmi-orders?priority=urgent">
                        <DxButton text={t('alerts.viewItems')} type="default" stylingMode="outlined" />
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}

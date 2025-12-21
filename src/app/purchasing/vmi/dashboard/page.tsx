'use client';

/**
 * VMI Dashboard Page
 *
 * Main dashboard for monitoring VMI Portal integration status
 */

import * as React from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import VmiTransactionLog, { Transaction } from '@/components/vmi/VmiTransactionLog';
import VmiSyncStatus, { SyncInfo, SyncStatus } from '@/components/vmi/VmiSyncStatus';
import {
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Package,
  Building2,
  TrendingUp,
  ShoppingCart,
  ArrowRight,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface DashboardData {
  summary: {
    totalVendors: number;
    connectedVendors: number;
    disconnectedVendors: number;
    healthPercentage: number;
    totalVmiItems: number;
  };
  transactions: {
    total: number;
    success: number;
    error: number;
    byType: Record<string, { success: number; error: number }>;
  };
  orders: {
    total: number;
    byStatus: Record<string, number>;
  };
  vendors: Array<{
    vendorId: number;
    vendorName: string;
    isConnected: boolean;
    itemsSync: SyncInfo;
    pricesSync: SyncInfo;
    inventorySync: SyncInfo;
  }>;
}

interface TransactionData {
  transactions: Transaction[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// ============================================================================
// Stats Card Component
// ============================================================================

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
}

function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  bgColor,
  trend,
}: StatsCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div className={cn('p-3 rounded-lg', bgColor)}>
          <Icon className={cn('h-6 w-6', iconColor)} />
        </div>
        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 text-sm',
              trend.isPositive ? 'text-emerald-600' : 'text-red-600'
            )}
          >
            <TrendingUp
              className={cn('h-4 w-4', !trend.isPositive && 'rotate-180')}
            />
            <span>{trend.value}%</span>
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 mt-1">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ============================================================================
// Vendor Status Card Component
// ============================================================================

interface VendorStatusCardProps {
  vendor: DashboardData['vendors'][0];
  onViewDetails: () => void;
}

function VendorStatusCard({ vendor, onViewDetails }: VendorStatusCardProps) {
  const getOverallStatus = (): SyncStatus => {
    if (!vendor.isConnected) return 'error';
    const statuses = [
      vendor.itemsSync.enabled ? vendor.itemsSync.status : null,
      vendor.pricesSync.enabled ? vendor.pricesSync.status : null,
      vendor.inventorySync.enabled ? vendor.inventorySync.status : null,
    ].filter(Boolean) as SyncStatus[];

    if (statuses.length === 0) return 'disabled';
    if (statuses.includes('error')) return 'error';
    if (statuses.includes('partial') || statuses.includes('pending')) return 'partial';
    if (statuses.every((s) => s === 'synced')) return 'synced';
    return 'never';
  };

  const overallStatus = getOverallStatus();
  const statusConfig: Record<SyncStatus, { label: string; color: string; bgColor: string }> = {
    synced: { label: 'Healthy', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
    partial: { label: 'Partial', color: 'text-amber-700', bgColor: 'bg-amber-50' },
    pending: { label: 'Pending', color: 'text-blue-700', bgColor: 'bg-blue-50' },
    error: { label: 'Error', color: 'text-red-700', bgColor: 'bg-red-50' },
    never: { label: 'Never Synced', color: 'text-gray-700', bgColor: 'bg-gray-50' },
    disabled: { label: 'Disabled', color: 'text-gray-500', bgColor: 'bg-gray-50' },
  };

  const config = statusConfig[overallStatus];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Building2 className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900">{vendor.vendorName}</h4>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={vendor.isConnected ? 'success' : 'danger'} className="text-xs">
                {vendor.isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
              <span className={cn('px-2 py-0.5 rounded text-xs font-medium', config.bgColor, config.color)}>
                {config.label}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onViewDetails}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowRight className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100">
        <div className="text-center">
          <p className="text-xs text-gray-500">Items</p>
          <Badge
            variant={vendor.itemsSync.enabled ? (vendor.itemsSync.status === 'synced' ? 'success' : 'warning') : 'secondary'}
            className="mt-1 text-xs"
          >
            {vendor.itemsSync.enabled ? vendor.itemsSync.status : 'Off'}
          </Badge>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">Prices</p>
          <Badge
            variant={vendor.pricesSync.enabled ? (vendor.pricesSync.status === 'synced' ? 'success' : 'warning') : 'secondary'}
            className="mt-1 text-xs"
          >
            {vendor.pricesSync.enabled ? vendor.pricesSync.status : 'Off'}
          </Badge>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">Inventory</p>
          <Badge
            variant={vendor.inventorySync.enabled ? (vendor.inventorySync.status === 'synced' ? 'success' : 'warning') : 'secondary'}
            className="mt-1 text-xs"
          >
            {vendor.inventorySync.enabled ? vendor.inventorySync.status : 'Off'}
          </Badge>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function VmiDashboardPage() {
  const [dashboardData, setDashboardData] = React.useState<DashboardData | null>(null);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [transactionPagination, setTransactionPagination] = React.useState({
    total: 0,
    hasMore: false,
    offset: 0,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isTransactionsLoading, setIsTransactionsLoading] = React.useState(false);
  const [selectedVendor, setSelectedVendor] = React.useState<DashboardData['vendors'][0] | null>(null);

  // Load dashboard data
  const loadDashboardData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/purchasing/vmi/dashboard');
      const result = await response.json();
      if (result.success) {
        setDashboardData(result.data);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load transactions
  const loadTransactions = React.useCallback(async (reset = false) => {
    setIsTransactionsLoading(true);
    try {
      const offset = reset ? 0 : transactionPagination.offset;
      const response = await fetch(
        `/api/purchasing/vmi/transactions?limit=50&offset=${offset}`
      );
      const result: { success: boolean; data: TransactionData } = await response.json();
      if (result.success) {
        setTransactions((prev) =>
          reset ? result.data.transactions : [...prev, ...result.data.transactions]
        );
        setTransactionPagination({
          total: result.data.pagination.total,
          hasMore: result.data.pagination.hasMore,
          offset: offset + result.data.pagination.limit,
        });
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setIsTransactionsLoading(false);
    }
  }, [transactionPagination.offset]);

  // Initial load
  React.useEffect(() => {
    loadDashboardData();
    loadTransactions(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle refresh
  const handleRefresh = () => {
    loadDashboardData();
    loadTransactions(true);
  };

  // Handle load more transactions
  const handleLoadMore = () => {
    loadTransactions(false);
  };

  if (isLoading && !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">VMI Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Monitor VMI Portal integration status and activity
          </p>
        </div>

        <div className="flex items-center gap-3">
          <DxButton
            icon="refresh"
            text="Refresh"
            type="default"
            stylingMode="outlined"
            onClick={handleRefresh}
            disabled={isLoading}
          />
          <DxButton
            icon="add"
            text="Configure Vendor"
            type="default"
            stylingMode="contained"
            onClick={() => (window.location.href = '/purchasing/vendors')}
          />
        </div>
      </div>

      {/* Stats Cards */}
      {dashboardData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Connected Vendors"
            value={dashboardData.summary.connectedVendors}
            subtitle={`of ${dashboardData.summary.totalVendors} total`}
            icon={Building2}
            iconColor="text-blue-600"
            bgColor="bg-blue-100"
          />
          <StatsCard
            title="VMI Items"
            value={dashboardData.summary.totalVmiItems}
            subtitle="with TPP/TTMT codes"
            icon={Package}
            iconColor="text-emerald-600"
            bgColor="bg-emerald-100"
          />
          <StatsCard
            title="Orders"
            value={dashboardData.orders.total}
            subtitle={`${dashboardData.orders.byStatus['submitted'] || 0} pending`}
            icon={ShoppingCart}
            iconColor="text-amber-600"
            bgColor="bg-amber-100"
          />
          <StatsCard
            title="API Calls (24h)"
            value={dashboardData.transactions.total}
            subtitle={`${dashboardData.transactions.error} errors`}
            icon={Activity}
            iconColor="text-purple-600"
            bgColor="bg-purple-100"
          />
        </div>
      )}

      {/* Health Overview */}
      {dashboardData && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Health</h2>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center',
                  dashboardData.summary.healthPercentage >= 80
                    ? 'bg-emerald-100'
                    : dashboardData.summary.healthPercentage >= 50
                      ? 'bg-amber-100'
                      : 'bg-red-100'
                )}
              >
                {dashboardData.summary.healthPercentage >= 80 ? (
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                ) : dashboardData.summary.healthPercentage >= 50 ? (
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardData.summary.healthPercentage}%
                </p>
                <p className="text-sm text-gray-500">Overall Health</p>
              </div>
            </div>

            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  dashboardData.summary.healthPercentage >= 80
                    ? 'bg-emerald-500'
                    : dashboardData.summary.healthPercentage >= 50
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                )}
                style={{ width: `${dashboardData.summary.healthPercentage}%` }}
              />
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-sm text-gray-600">
                  {dashboardData.summary.connectedVendors} Connected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm text-gray-600">
                  {dashboardData.summary.disconnectedVendors} Disconnected
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Status and Transaction Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vendor Status Grid */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Vendor Status</h2>
          {dashboardData && dashboardData.vendors.length > 0 ? (
            <div className="space-y-3">
              {dashboardData.vendors.map((vendor) => (
                <VendorStatusCard
                  key={vendor.vendorId}
                  vendor={vendor}
                  onViewDetails={() => setSelectedVendor(vendor)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-8 text-center">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No VMI vendors configured</p>
              <DxButton
                text="Configure Vendor"
                type="default"
                stylingMode="text"
                onClick={() => (window.location.href = '/purchasing/vendors')}
                className="mt-3"
              />
            </div>
          )}
        </div>

        {/* Transaction Log */}
        <div className="lg:col-span-2">
          <VmiTransactionLog
            transactions={transactions}
            onRefresh={() => loadTransactions(true)}
            onLoadMore={handleLoadMore}
            hasMore={transactionPagination.hasMore}
            isLoading={isTransactionsLoading}
          />
        </div>
      </div>

      {/* Selected Vendor Sync Status */}
      {selectedVendor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedVendor.vendorName} - Sync Status
                </h2>
                <button
                  onClick={() => setSelectedVendor(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <XCircle className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <VmiSyncStatus
                vendorName={selectedVendor.vendorName}
                isConnected={selectedVendor.isConnected}
                itemsSync={selectedVendor.itemsSync}
                pricesSync={selectedVendor.pricesSync}
                inventorySync={selectedVendor.inventorySync}
                onSyncItems={async () => {
                  await fetch('/api/purchasing/vmi/sync/items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vendorId: selectedVendor.vendorId }),
                  });
                  loadDashboardData();
                }}
                onSyncPrices={async () => {
                  await fetch('/api/purchasing/vmi/sync/prices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vendorId: selectedVendor.vendorId }),
                  });
                  loadDashboardData();
                }}
                onSyncInventory={async () => {
                  await fetch('/api/purchasing/vmi/sync/inventory', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vendorId: selectedVendor.vendorId }),
                  });
                  loadDashboardData();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

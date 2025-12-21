'use client';

/**
 * VMI Sync Status Component
 *
 * Displays the sync status for items, prices, and inventory for a VMI vendor
 */

import * as React from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import {
  Package,
  DollarSign,
  Warehouse,
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type SyncStatus = 'synced' | 'partial' | 'pending' | 'error' | 'never' | 'disabled';

export interface SyncInfo {
  enabled: boolean;
  lastSyncAt: string | null;
  pendingCount?: number;
  status: SyncStatus;
  errorMessage?: string;
}

export interface VmiSyncStatusProps {
  vendorName: string;
  isConnected: boolean;
  itemsSync: SyncInfo;
  pricesSync: SyncInfo;
  inventorySync: SyncInfo;
  onSyncItems?: () => Promise<void>;
  onSyncPrices?: () => Promise<void>;
  onSyncInventory?: () => Promise<void>;
  isSyncingItems?: boolean;
  isSyncingPrices?: boolean;
  isSyncingInventory?: boolean;
  className?: string;
}

// ============================================================================
// Status Config
// ============================================================================

const statusConfig: Record<
  SyncStatus,
  {
    label: string;
    labelTh: string;
    icon: React.ElementType;
    variant: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'secondary';
    color: string;
  }
> = {
  synced: {
    label: 'Synced',
    labelTh: 'ซิงค์แล้ว',
    icon: CheckCircle,
    variant: 'success',
    color: 'text-emerald-600',
  },
  partial: {
    label: 'Partial',
    labelTh: 'บางส่วน',
    icon: AlertCircle,
    variant: 'warning',
    color: 'text-amber-600',
  },
  pending: {
    label: 'Pending',
    labelTh: 'รอดำเนินการ',
    icon: Clock,
    variant: 'info',
    color: 'text-blue-600',
  },
  error: {
    label: 'Error',
    labelTh: 'ผิดพลาด',
    icon: XCircle,
    variant: 'danger',
    color: 'text-red-600',
  },
  never: {
    label: 'Never Synced',
    labelTh: 'ยังไม่เคยซิงค์',
    icon: Clock,
    variant: 'default',
    color: 'text-gray-500',
  },
  disabled: {
    label: 'Disabled',
    labelTh: 'ปิดใช้งาน',
    icon: XCircle,
    variant: 'secondary',
    color: 'text-gray-400',
  },
};

// ============================================================================
// Sync Card Component
// ============================================================================

interface SyncCardProps {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  syncInfo: SyncInfo;
  onSync?: () => Promise<void>;
  isSyncing?: boolean;
  isConnected: boolean;
}

function SyncCard({
  title,
  icon: Icon,
  iconColor,
  bgColor,
  syncInfo,
  onSync,
  isSyncing,
  isConnected,
}: SyncCardProps) {
  const status = statusConfig[syncInfo.status];
  const StatusIcon = status.icon;

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', bgColor)}>
              <Icon className={cn('h-5 w-5', iconColor)} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={status.variant} className="gap-1">
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </Badge>
                {syncInfo.pendingCount !== undefined && syncInfo.pendingCount > 0 && (
                  <span className="text-xs text-gray-500">
                    {syncInfo.pendingCount} pending
                  </span>
                )}
              </div>
            </div>
          </div>

          {syncInfo.enabled && isConnected && onSync && (
            <DxButton
              icon={isSyncing ? undefined : 'refresh'}
              text={isSyncing ? 'Syncing...' : 'Sync'}
              type="default"
              stylingMode="outlined"
              onClick={onSync}
              disabled={isSyncing || !isConnected}
            />
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Last Sync</span>
            <span className="font-medium text-gray-900">
              {formatDateTime(syncInfo.lastSyncAt)}
            </span>
          </div>

          {!syncInfo.enabled && (
            <div className="mt-2 px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-500">
              Sync is disabled for this vendor
            </div>
          )}

          {syncInfo.errorMessage && (
            <div className="mt-2 px-3 py-2 bg-red-50 rounded-lg text-sm text-red-600">
              {syncInfo.errorMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function VmiSyncStatus({
  vendorName,
  isConnected,
  itemsSync,
  pricesSync,
  inventorySync,
  onSyncItems,
  onSyncPrices,
  onSyncInventory,
  isSyncingItems = false,
  isSyncingPrices = false,
  isSyncingInventory = false,
  className,
}: VmiSyncStatusProps) {
  // Calculate overall health
  const getOverallStatus = (): SyncStatus => {
    if (!isConnected) return 'error';

    const statuses = [
      itemsSync.enabled ? itemsSync.status : null,
      pricesSync.enabled ? pricesSync.status : null,
      inventorySync.enabled ? inventorySync.status : null,
    ].filter(Boolean) as SyncStatus[];

    if (statuses.length === 0) return 'disabled';
    if (statuses.includes('error')) return 'error';
    if (statuses.includes('partial') || statuses.includes('pending')) return 'partial';
    if (statuses.every((s) => s === 'synced')) return 'synced';
    if (statuses.every((s) => s === 'never')) return 'never';
    return 'partial';
  };

  const overallStatus = getOverallStatus();
  const overallConfig = statusConfig[overallStatus];
  const OverallIcon = overallConfig.icon;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">VMI Sync Status</h2>
          <p className="text-gray-500 mt-1">{vendorName}</p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={isConnected ? 'success' : 'danger'} className="gap-1">
            {isConnected ? (
              <>
                <CheckCircle className="h-3 w-3" />
                Connected
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3" />
                Disconnected
              </>
            )}
          </Badge>

          <Badge variant={overallConfig.variant} className="gap-1">
            <OverallIcon className="h-3 w-3" />
            {overallConfig.label}
          </Badge>
        </div>
      </div>

      {/* Sync Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SyncCard
          title="Items"
          icon={Package}
          iconColor="text-blue-600"
          bgColor="bg-blue-100"
          syncInfo={itemsSync}
          onSync={onSyncItems}
          isSyncing={isSyncingItems}
          isConnected={isConnected}
        />

        <SyncCard
          title="Prices"
          icon={DollarSign}
          iconColor="text-emerald-600"
          bgColor="bg-emerald-100"
          syncInfo={pricesSync}
          onSync={onSyncPrices}
          isSyncing={isSyncingPrices}
          isConnected={isConnected}
        />

        <SyncCard
          title="Inventory"
          icon={Warehouse}
          iconColor="text-purple-600"
          bgColor="bg-purple-100"
          syncInfo={inventorySync}
          onSync={onSyncInventory}
          isSyncing={isSyncingInventory}
          isConnected={isConnected}
        />
      </div>

      {/* Connection Warning */}
      {!isConnected && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800">VMI Portal Not Connected</h4>
            <p className="text-sm text-amber-700 mt-1">
              Please configure and test the VMI Portal connection to enable syncing.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default VmiSyncStatus;

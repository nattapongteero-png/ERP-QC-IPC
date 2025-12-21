'use client';

/**
 * VMI Sync Status Card Component
 *
 * Displays sync status for a specific sync type (inventory, items, prices).
 *
 * Feature: 008-vmi-vendor-sync
 */

import { cn } from '@/lib/utils/cn';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Package,
  Tag,
  DollarSign,
  ShoppingCart,
} from 'lucide-react';
import type { VmiSyncType, VmiSyncStatus } from '@/types/vmi';

// ============================================
// Types
// ============================================

interface SyncHistoryItem {
  id: number;
  portalId: number;
  portalName?: string;
  syncType: VmiSyncType;
  status: VmiSyncStatus;
  itemsTotal: number;
  itemsProcessed: number;
  itemsFailed: number;
  startedAt: string;
  completedAt?: string | null;
}

interface VmiSyncStatusCardProps {
  syncType: VmiSyncType;
  lastSync?: SyncHistoryItem | null;
  isRunning?: boolean;
  className?: string;
}

// ============================================
// Constants
// ============================================

const syncTypeConfig: Record<VmiSyncType, { icon: typeof Package; label: string; color: string }> = {
  inventory: { icon: Package, label: 'Inventory', color: 'text-blue-600 bg-blue-50' },
  items: { icon: Tag, label: 'Item Catalog', color: 'text-purple-600 bg-purple-50' },
  prices: { icon: DollarSign, label: 'Prices', color: 'text-green-600 bg-green-50' },
  orders: { icon: ShoppingCart, label: 'Orders', color: 'text-orange-600 bg-orange-50' },
};

const statusConfig: Record<VmiSyncStatus, { icon: typeof CheckCircle; label: string; color: string }> = {
  running: { icon: Loader2, label: 'Running', color: 'text-blue-600' },
  completed: { icon: CheckCircle, label: 'Completed', color: 'text-green-600' },
  partial: { icon: AlertTriangle, label: 'Partial', color: 'text-yellow-600' },
  failed: { icon: XCircle, label: 'Failed', color: 'text-red-600' },
};

// ============================================
// Component
// ============================================

export function VmiSyncStatusCard({
  syncType,
  lastSync,
  isRunning = false,
  className,
}: VmiSyncStatusCardProps) {
  const typeConfig = syncTypeConfig[syncType];
  const TypeIcon = typeConfig.icon;

  const getStatusDisplay = () => {
    if (isRunning) {
      return statusConfig.running;
    }
    if (!lastSync) {
      return null;
    }
    return statusConfig[lastSync.status];
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay?.icon;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getTimeAgo = (dateString: string) => {
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

  return (
    <div
      className={cn(
        'p-4 rounded-lg border bg-white shadow-sm',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('p-2 rounded-lg', typeConfig.color)}>
            <TypeIcon className="h-5 w-5" />
          </div>
          <h3 className="font-medium text-gray-900">{typeConfig.label}</h3>
        </div>
        {statusDisplay && StatusIcon && (
          <div className={cn('flex items-center gap-1', statusDisplay.color)}>
            <StatusIcon
              className={cn('h-4 w-4', isRunning && 'animate-spin')}
            />
            <span className="text-sm font-medium">{statusDisplay.label}</span>
          </div>
        )}
      </div>

      {/* Content */}
      {lastSync ? (
        <div className="space-y-2">
          {/* Stats */}
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-gray-500">Total:</span>{' '}
              <span className="font-medium">{lastSync.itemsTotal}</span>
            </div>
            <div>
              <span className="text-gray-500">Synced:</span>{' '}
              <span className="font-medium text-green-600">{lastSync.itemsProcessed}</span>
            </div>
            {lastSync.itemsFailed > 0 && (
              <div>
                <span className="text-gray-500">Failed:</span>{' '}
                <span className="font-medium text-red-600">{lastSync.itemsFailed}</span>
              </div>
            )}
          </div>

          {/* Time */}
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span title={formatTime(lastSync.startedAt)}>
              {getTimeAgo(lastSync.startedAt)}
            </span>
            {lastSync.portalName && (
              <span className="text-gray-400">• {lastSync.portalName}</span>
            )}
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-500">
          No sync history available
        </div>
      )}
    </div>
  );
}

export default VmiSyncStatusCard;

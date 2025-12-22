'use client';

/**
 * VMI Sync Trigger Component
 *
 * Provides manual sync trigger buttons for inventory, items, and prices.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { useState } from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import {
  Package,
  Tag,
  DollarSign,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Settings,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { VmiSyncType, VmiSyncStatus } from '@/types/vmi';

// ============================================
// Types
// ============================================

interface SyncResult {
  syncId: number;
  portalId: number;
  portalName: string;
  syncType: VmiSyncType;
  status: VmiSyncStatus;
  itemsTotal: number;
  itemsProcessed: number;
  itemsFailed: number;
  duration: number;
  errors?: Array<{ itemId: number; itemCode?: string; error: string }>;
}

interface VmiSyncTriggerProps {
  portalId?: number;
  onSyncComplete?: (result: SyncResult[]) => void;
}

// ============================================
// API Functions
// ============================================

async function triggerSync(syncType: VmiSyncType, portalId?: number): Promise<SyncResult[]> {
  const response = await fetch(`/api/vmi-sync/${syncType}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ portalId }),
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Sync failed');
  }

  // Handle single or multiple results
  if (result.data.results) {
    return result.data.results;
  }
  return [result.data];
}

// ============================================
// Component
// ============================================

export function VmiSyncTrigger({ portalId, onSyncComplete }: VmiSyncTriggerProps) {
  const queryClient = useQueryClient();
  const [lastResults, setLastResults] = useState<Record<VmiSyncType, SyncResult[] | null>>({
    inventory: null,
    items: null,
    prices: null,
    orders: null,
  });

  // Inventory sync mutation
  const inventoryMutation = useMutation({
    mutationFn: () => triggerSync('inventory', portalId),
    onSuccess: (results) => {
      setLastResults((prev) => ({ ...prev, inventory: results }));
      queryClient.invalidateQueries({ queryKey: ['vmi-sync-history'] });
      onSyncComplete?.(results);
    },
  });

  // Items sync mutation
  const itemsMutation = useMutation({
    mutationFn: () => triggerSync('items', portalId),
    onSuccess: (results) => {
      setLastResults((prev) => ({ ...prev, items: results }));
      queryClient.invalidateQueries({ queryKey: ['vmi-sync-history'] });
      onSyncComplete?.(results);
    },
  });

  // Prices sync mutation
  const pricesMutation = useMutation({
    mutationFn: () => triggerSync('prices', portalId),
    onSuccess: (results) => {
      setLastResults((prev) => ({ ...prev, prices: results }));
      queryClient.invalidateQueries({ queryKey: ['vmi-sync-history'] });
      onSyncComplete?.(results);
    },
  });

  const getSyncButton = (
    syncType: VmiSyncType,
    label: string,
    icon: typeof Package,
    mutation: typeof inventoryMutation
  ) => {
    const Icon = icon;
    const isLoading = mutation.isPending;
    const result = lastResults[syncType];
    const error = mutation.error;

    const getStatusIcon = () => {
      if (error) return <XCircle className="h-4 w-4 text-red-500" />;
      if (!result) return null;
      const status = result[0]?.status;
      if (status === 'completed') return <CheckCircle className="h-4 w-4 text-green-500" />;
      if (status === 'partial') return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      if (status === 'failed') return <XCircle className="h-4 w-4 text-red-500" />;
      return null;
    };

    const getResultSummary = (): { text: string; showHelp: boolean } => {
      if (error) return { text: (error as Error).message, showHelp: true };
      if (!result || result.length === 0) return { text: '', showHelp: false };

      const totalProcessed = result.reduce((sum, r) => sum + r.itemsProcessed, 0);
      const totalFailed = result.reduce((sum, r) => sum + r.itemsFailed, 0);
      const totalItems = result.reduce((sum, r) => sum + r.itemsTotal, 0);
      const duration = result.reduce((sum, r) => sum + r.duration, 0);

      // Show help if 0 items were found
      if (totalItems === 0) {
        return {
          text: 'No items found to sync',
          showHelp: true,
        };
      }

      if (result.length === 1) {
        return {
          text: `${totalProcessed} synced${totalFailed > 0 ? `, ${totalFailed} failed` : ''} (${Math.round(duration / 1000)}s)`,
          showHelp: false,
        };
      }
      return {
        text: `${result.length} portals, ${totalProcessed} items (${Math.round(duration / 1000)}s)`,
        showHelp: false,
      };
    };

    const summary = getResultSummary();

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <DxButton
            text={isLoading ? `Syncing ${label}...` : `Sync ${label}`}
            icon={isLoading ? undefined : 'refresh'}
            type="default"
            onClick={() => mutation.mutate()}
            disabled={isLoading || inventoryMutation.isPending || itemsMutation.isPending || pricesMutation.isPending}
            className="min-w-[140px]"
          >
            {isLoading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
          </DxButton>
          <div className={cn('p-2 rounded-lg', getButtonColor(syncType))}>
            <Icon className="h-5 w-5" />
          </div>
          {getStatusIcon()}
        </div>
        {(result || error) && summary.text && (
          <div className={cn(
            'text-sm px-2',
            error ? 'text-red-600' : summary.showHelp ? 'text-amber-600' : 'text-gray-500'
          )}>
            {summary.showHelp && <Info className="inline h-3 w-3 mr-1" />}
            {summary.text}
          </div>
        )}
      </div>
    );
  };

  const getButtonColor = (syncType: VmiSyncType) => {
    switch (syncType) {
      case 'inventory':
        return 'bg-blue-50 text-blue-600';
      case 'items':
        return 'bg-purple-50 text-purple-600';
      case 'prices':
        return 'bg-green-50 text-green-600';
      default:
        return 'bg-gray-50 text-gray-600';
    }
  };

  return (
    <Card elevation="raised">
      <CardHeader>
        <CardTitle>Manual Sync</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-gray-500 mb-4">
            Trigger manual synchronization to VMI Portals. This will sync data to all enabled portals
            {portalId ? ' for the selected portal' : ''}.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {getSyncButton('inventory', 'Inventory', Package, inventoryMutation)}
            {getSyncButton('items', 'Items', Tag, itemsMutation)}
            {getSyncButton('prices', 'Prices', DollarSign, pricesMutation)}
          </div>

          {/* Sync All Button */}
          <div className="pt-4 border-t">
            <DxButton
              text={
                inventoryMutation.isPending || itemsMutation.isPending || pricesMutation.isPending
                  ? 'Syncing All...'
                  : 'Sync All'
              }
              icon="refresh"
              type="success"
              onClick={async () => {
                await inventoryMutation.mutateAsync();
                await itemsMutation.mutateAsync();
                await pricesMutation.mutateAsync();
              }}
              disabled={inventoryMutation.isPending || itemsMutation.isPending || pricesMutation.isPending}
            />
          </div>

          {/* Help Section - Show when any sync returned 0 items */}
          {(lastResults.inventory?.[0]?.itemsTotal === 0 ||
            lastResults.items?.[0]?.itemsTotal === 0 ||
            lastResults.prices?.[0]?.itemsTotal === 0) && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h4 className="font-medium text-amber-800 flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4" />
                No Items to Sync?
              </h4>
              <div className="text-sm text-amber-700 space-y-2">
                <p>To sync items to VMI portals, you need to:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>
                    <strong>Configure VMI Portal</strong> - Set up at least one VMI portal connection in{' '}
                    <Link href="/settings/vmi" className="underline hover:text-amber-900">
                      Settings → VMI Portals
                    </Link>
                  </li>
                  <li>
                    <strong>Enable VMI Sync on Items</strong> - Go to{' '}
                    <Link href="/inventory/items" className="underline hover:text-amber-900">
                      Inventory → Items
                    </Link>{' '}
                    and enable &quot;VMI Sync Enabled&quot; checkbox for items you want to sync
                  </li>
                  <li>
                    <strong>Add VMI Standard Codes</strong> - For Items sync, add TPP/TTMT codes to items in the VMI Standard Codes section
                  </li>
                </ol>
                <p className="mt-3 pt-2 border-t border-amber-200">
                  <strong>Quick Setup:</strong> Edit any item → scroll to &quot;VMI Settings&quot; → check &quot;Enable VMI Sync&quot;
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default VmiSyncTrigger;

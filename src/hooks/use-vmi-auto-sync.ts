/**
 * VMI Auto Sync Hook
 *
 * Automatically syncs VMI data every 15 minutes when the app is open.
 * This runs in the background while the user is using the application.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { useEffect, useRef, useCallback, useState } from 'react';

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

interface SyncResult {
  success: boolean;
  syncType: string;
  itemsProcessed?: number;
  error?: string;
}

interface UseVmiAutoSyncOptions {
  enabled?: boolean;
}

export function useVmiAutoSync(options: UseVmiAutoSyncOptions = {}) {
  const { enabled = true } = options;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const runSync = useCallback(async (): Promise<SyncResult[]> => {
    const results: SyncResult[] = [];

    if (!enabled) {
      return results;
    }

    console.log('[VMI Auto Sync] Starting automatic sync...');
    setIsSyncing(true);

    const syncTypes = ['inventory', 'items', 'prices'] as const;

    for (const syncType of syncTypes) {
      try {
        const response = await fetch(`/api/vmi-sync/${syncType}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        const result = await response.json();

        if (result.success) {
          const data = result.data.results?.[0] || result.data;
          console.log(`[VMI Auto Sync] ${syncType} sync completed:`, {
            itemsProcessed: data.itemsProcessed,
            itemsTotal: data.itemsTotal,
          });
          results.push({
            success: true,
            syncType,
            itemsProcessed: data.itemsProcessed,
          });
        } else {
          console.warn(`[VMI Auto Sync] ${syncType} sync failed:`, result.error);
          results.push({
            success: false,
            syncType,
            error: result.error,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[VMI Auto Sync] ${syncType} sync error:`, error);
        results.push({
          success: false,
          syncType,
          error: errorMessage,
        });
      }
    }

    const now = new Date();
    setLastSync(now);
    setIsSyncing(false);
    console.log('[VMI Auto Sync] Automatic sync completed at', now.toISOString());

    return results;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    console.log('[VMI Auto Sync] Setting up auto-sync interval (every 15 minutes)');

    // Run initial sync after a short delay (to not slow down page load)
    const initialTimeout = setTimeout(() => {
      runSync();
    }, 10000); // Wait 10 seconds after mount

    // Set up interval for subsequent syncs
    intervalRef.current = setInterval(() => {
      runSync();
    }, SYNC_INTERVAL_MS);

    return () => {
      console.log('[VMI Auto Sync] Cleaning up auto-sync interval');
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, runSync]);

  return {
    lastSync,
    isSyncing,
    runSyncNow: runSync,
  };
}

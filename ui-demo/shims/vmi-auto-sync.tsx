/** VMI polling stub — the demo has no VMI endpoint and nothing to sync. */
export function useVmiAutoSync() {
  return { isSyncing: false, lastSyncAt: null };
}

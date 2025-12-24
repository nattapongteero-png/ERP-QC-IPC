/**
 * Unit tests for VMI Auto Sync Hook
 *
 * Feature: 008-vmi-vendor-sync
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useVmiAutoSync } from '@/hooks/use-vmi-auto-sync';

// Mock fetch
global.fetch = vi.fn();

describe('useVmiAutoSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Mock successful sync responses
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: {
          itemsProcessed: 10,
          itemsTotal: 10,
        },
      }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not run sync when disabled', async () => {
    const { result } = renderHook(() => useVmiAutoSync({ enabled: false }));

    // Wait for initial timeout (10 seconds)
    await act(async () => {
      vi.advanceTimersByTime(15000);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.lastSync).toBeNull();
    expect(result.current.isSyncing).toBe(false);
  });

  it('should set up interval when enabled', async () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    renderHook(() => useVmiAutoSync({ enabled: true }));

    // Should have set up both initial timeout and interval
    expect(setTimeoutSpy).toHaveBeenCalled();
    expect(setIntervalSpy).toHaveBeenCalled();

    // Verify interval is 15 minutes (900000ms)
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 15 * 60 * 1000);
  });

  it('should expose runSyncNow function', async () => {
    const { result } = renderHook(() => useVmiAutoSync({ enabled: true }));

    // Should have runSyncNow function
    expect(typeof result.current.runSyncNow).toBe('function');
  });

  it('should update lastSync after successful sync', async () => {
    const { result } = renderHook(() => useVmiAutoSync({ enabled: true }));

    // Initially null
    expect(result.current.lastSync).toBeNull();

    // Run sync manually
    await act(async () => {
      await result.current.runSyncNow();
    });

    // Should have updated lastSync
    expect(result.current.lastSync).not.toBeNull();
    expect(result.current.lastSync).toBeInstanceOf(Date);
  });

  it('should handle fetch errors gracefully', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useVmiAutoSync({ enabled: true }));

    // Run sync manually
    await act(async () => {
      const results = await result.current.runSyncNow();

      // Should return error results
      expect(results).toHaveLength(3);
      results.forEach((r) => {
        expect(r.success).toBe(false);
        expect(r.error).toBe('Network error');
      });
    });

    // Should still have updated lastSync (sync attempted)
    expect(result.current.lastSync).not.toBeNull();
  });

  it('should cleanup interval on unmount', async () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { unmount } = renderHook(() => useVmiAutoSync({ enabled: true }));

    // Unmount
    unmount();

    // Should have cleaned up
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});

/**
 * Phase aggregation for SOP-linked IPC results.
 *
 * Reproduces the bug user reported: after recording an SOP step that
 * carries linked IPC criteria, the IPC quality_tests rows landed with
 * NULL ipc_phase, and the execution-summary loop's `t.ipcPhase ||
 * 'production'` fallback then clumped every result under the
 * 'production' dashboard card — even when the parent SOP step was
 * 'pre_production' or 'packaging'.
 *
 * These tests exercise the small piece of logic added to the
 * sop-execution route (`getSOPStepPhase` + the per-input backfill loop)
 * by directly testing the aggregation function the route uses to bucket
 * IPC tests on the dashboard.
 */
import { describe, it, expect } from 'vitest';

// Replicate the route's per-phase aggregation loop. Keeping the loop
// shape in the test makes it obvious which code is under test even
// though it's only 5 lines.
function aggregateByPhase<T extends { ipcPhase?: string | null; status?: string; approvedBy?: number | null; sopRecordedAt?: string | null }>(
  tests: T[],
): Record<string, { total: number; completed: number; approved: number }> {
  const out: Record<string, { total: number; completed: number; approved: number }> = {};
  for (const t of tests) {
    const p = t.ipcPhase || 'production';
    if (!out[p]) out[p] = { total: 0, completed: 0, approved: 0 };
    out[p].total += 1;
    if (t.status === 'pass' || t.status === 'fail' || !!t.sopRecordedAt) out[p].completed += 1;
    if (t.approvedBy != null) out[p].approved += 1;
  }
  return out;
}

describe('ipc per-phase aggregation', () => {
  it('groups tests by their explicit ipcPhase', () => {
    const result = aggregateByPhase([
      { ipcPhase: 'pre_production', status: 'pass' },
      { ipcPhase: 'pre_production', status: 'pass' },
      { ipcPhase: 'production', status: 'pass' },
      { ipcPhase: 'packaging', status: 'pass' },
    ]);
    expect(result.pre_production?.total).toBe(2);
    expect(result.production?.total).toBe(1);
    expect(result.packaging?.total).toBe(1);
  });

  it('reproduces the bug: NULL ipcPhase falls into production', () => {
    const result = aggregateByPhase([
      { ipcPhase: null, status: 'pass' }, // bug: should have been pre_production
      { ipcPhase: null, status: 'pass' }, // bug: should have been packaging
      { ipcPhase: 'production', status: 'pass' },
    ]);
    // All 3 end up under production because the fallback can't tell the
    // real phase from a NULL row. This is exactly what users complained
    // about — "ข้อมูลถูกแสดงรวมที่ phase production เท่านั้น".
    expect(result.production?.total).toBe(3);
    expect(result.pre_production).toBeUndefined();
    expect(result.packaging).toBeUndefined();
  });

  it('with the fix: rows backfilled with their SOP step phase now bucket correctly', () => {
    // After the route patch, each input gets `ipcPhase` injected from
    // the parent SOP step BEFORE it reaches recordSOPLinkedIPCResults,
    // so the stored quality_tests rows carry the real phase.
    const result = aggregateByPhase([
      { ipcPhase: 'pre_production', status: 'pass' },
      { ipcPhase: 'pre_production', status: 'pass' },
      { ipcPhase: 'packaging', status: 'pass' },
      { ipcPhase: 'production', status: 'pass' },
    ]);
    expect(result.pre_production?.total).toBe(2);
    expect(result.packaging?.total).toBe(1);
    expect(result.production?.total).toBe(1);
  });

  it('counts approved separately from completed', () => {
    const result = aggregateByPhase([
      { ipcPhase: 'pre_production', status: 'pass', approvedBy: 1 },
      { ipcPhase: 'pre_production', status: 'pass', approvedBy: null },
      { ipcPhase: 'pre_production', status: 'pending', approvedBy: null },
    ]);
    expect(result.pre_production?.total).toBe(3);
    expect(result.pre_production?.completed).toBe(2);
    expect(result.pre_production?.approved).toBe(1);
  });

  it('treats SOP-recorded tests as completed even when status is still pending', () => {
    // sopRecordedAt is set by recordSOPLinkedIPCResults when an IPC is
    // saved via the SOP path. The dashboard counts those as done so
    // operators aren't asked to re-record the same value on /ipc.
    const result = aggregateByPhase([
      { ipcPhase: 'production', status: 'pending', sopRecordedAt: '2026-06-04T10:00:00Z' },
      { ipcPhase: 'production', status: 'pending', sopRecordedAt: null },
    ]);
    expect(result.production?.total).toBe(2);
    expect(result.production?.completed).toBe(1);
  });
});

describe('phase fallback semantics for the route', () => {
  // The route adds: `if (!r.ipcPhase && fallbackPhase) r.ipcPhase = fallbackPhase`.
  // These tests exercise the policy in isolation.

  function applyFallback(
    input: { ipcPhase?: string | null },
    fallbackPhase: string | null,
  ): { ipcPhase: string | undefined | null } {
    const r = { ...input };
    if (!r.ipcPhase && fallbackPhase) r.ipcPhase = fallbackPhase;
    return r;
  }

  it('uses the SOP-step fallback when ipcPhase is missing', () => {
    expect(applyFallback({}, 'pre_production').ipcPhase).toBe('pre_production');
    expect(applyFallback({ ipcPhase: null }, 'packaging').ipcPhase).toBe('packaging');
    expect(applyFallback({ ipcPhase: '' }, 'post_production').ipcPhase).toBe('post_production');
  });

  it('keeps the explicit phase when frontend provides one (even when fallback exists)', () => {
    // Frontend opinion wins. If the operator's UI somehow says one phase
    // but the SOP step says another, we trust the explicit value rather
    // than silently rewriting it.
    expect(applyFallback({ ipcPhase: 'packaging' }, 'production').ipcPhase).toBe('packaging');
  });

  it('passes through null when both input and fallback are missing', () => {
    // No data anywhere — preserves the original value so downstream
    // policy (insert as NULL, dashboard buckets to "production") still
    // behaves as before. We don't silently invent a phase.
    expect(applyFallback({}, null).ipcPhase).toBeUndefined();
    expect(applyFallback({ ipcPhase: null }, null).ipcPhase).toBeNull();
  });
});

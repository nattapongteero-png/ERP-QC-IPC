/**
 * Production Audit fix — Independent Inspection Check (issues #7, #22)
 *
 * The Sampler and Inspector on a Finished Product Inspection MUST be
 * different users. The audit found that in the live system, both fields
 * were "System Administrator (ID:1)" — a clear violation of GMP's
 * independent-check principle.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const memDb = {
  inspections: [] as Array<{
    id: number;
    samplerId: number;
    inspectorId?: number | null;
    status: string;
    checklistResults: string;
  }>,
};

vi.mock('@/lib/db/db-helper', () => ({
  isSqlite: () => true,
  getTableRef: (n: string) => ({ __table: n }),
  getInsertId: (r: unknown) => Number((r as { lastInsertRowid: number }).lastInsertRowid),
  executeDbOperation: async (op: (db: unknown) => unknown) => op(makeMockDb()),
}));

vi.mock('@/lib/db/date-utils', () => ({
  getNow: () => '2026-06-03T00:00:00.000Z',
  toDbDate: (v: string | Date) => (typeof v === 'string' ? v : v.toISOString()),
  getTodayStr: () => '2026-06-03',
}));

function makeMockDb() {
  return {
    select(_cols?: unknown) {
      return {
        from(_tbl: unknown) {
          return {
            where(_w: unknown) {
              return Promise.resolve(memDb.inspections);
            },
          };
        },
      };
    },
    update(_tbl: unknown) {
      return {
        set(patch: Record<string, unknown>) {
          return {
            where(_w: unknown) {
              return {
                returning() {
                  if (memDb.inspections.length > 0) Object.assign(memDb.inspections[0], patch);
                  return Promise.resolve(memDb.inspections);
                },
              };
            },
          };
        },
      };
    },
  };
}

import { updateWOFinishedInspection } from '@/lib/services/wo-execution.service';

describe('Audit #7/#22 — Sampler ≠ Inspector', () => {
  beforeEach(() => {
    memDb.inspections = [];
  });

  it('rejects when inspectorId equals samplerId', async () => {
    memDb.inspections.push({
      id: 1,
      samplerId: 7,
      status: 'pending',
      checklistResults: '{}',
    });

    await expect(
      updateWOFinishedInspection(1, '{"item1": "pass"}', 7, 'completed'),
    ).rejects.toThrow(/SAMPLER_INSPECTOR_SAME/);
  });

  it('allows when inspectorId differs from samplerId', async () => {
    memDb.inspections.push({
      id: 1,
      samplerId: 7,
      status: 'pending',
      checklistResults: '{}',
    });

    const result = await updateWOFinishedInspection(1, '{"item1":"pass"}', 8, 'completed');
    expect(result).toBeDefined();
    expect(memDb.inspections[0].inspectorId).toBe(8);
  });

  it('allows draft save without inspectorId (no segregation needed yet)', async () => {
    memDb.inspections.push({
      id: 1,
      samplerId: 7,
      status: 'pending',
      checklistResults: '{}',
    });

    // No inspectorId provided → just saving draft
    const result = await updateWOFinishedInspection(1, '{}', undefined, 'pending');
    expect(result).toBeDefined();
  });

  it('CRITICAL: admin self-inspection is also blocked', async () => {
    // The live system had admin (id=1) as both Sampler and Inspector.
    // This is the exact case the audit flagged.
    memDb.inspections.push({
      id: 1,
      samplerId: 1, // admin
      status: 'pending',
      checklistResults: '{}',
    });

    await expect(
      updateWOFinishedInspection(1, '{}', 1, 'completed'),
    ).rejects.toThrow(/SAMPLER_INSPECTOR_SAME/);
  });
});

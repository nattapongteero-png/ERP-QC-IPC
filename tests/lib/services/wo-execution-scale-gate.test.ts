/**
 * Integration test: recordMaterialWeight + scale verification gate
 * Feature: 021 (integration with WO weighing)
 *
 * The service must:
 *   - reject when scaleId is given but no current passing verification exists
 *   - accept when scaleId is given AND a valid verification exists, persisting scaleVerificationId
 *   - skip the gate entirely when requireScaleVerification=false (water materials)
 *   - skip the gate when no scaleId was supplied (back-compat)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory mock state
type Row = Record<string, unknown>;
const memDb: {
  workOrderMaterials: Row[];
  verifications: Row[];
} = {
  workOrderMaterials: [],
  verifications: [],
};

vi.mock('@/lib/db/db-helper', () => ({
  isSqlite: () => true,
  getTableRef: (n: string) => ({ __table: n }),
  executeDbOperation: async (op: (db: unknown) => unknown) => op(makeMockDb()),
}));

vi.mock('@/lib/db/date-utils', () => ({
  getNow: () => '2026-06-03T12:00:00.000Z',
  toDbDate: (v: string | Date) => (typeof v === 'string' ? v : v.toISOString()),
  getTodayStr: () => '2026-06-03',
}));

const mockGetCurrentVerification = vi.fn();
vi.mock('@/lib/services/scale-verification.service', () => ({
  getCurrentVerificationForScale: (id: number) => mockGetCurrentVerification(id),
}));

function makeMockDb() {
  return {
    select() {
      return {
        from(_tbl: unknown) {
          return {
            where(_w: unknown) {
              return {
                limit(_n: number) {
                  return Promise.resolve(memDb.workOrderMaterials);
                },
                then(resolve: (rows: Row[]) => unknown) {
                  return resolve(memDb.workOrderMaterials);
                },
              };
            },
            then(resolve: (rows: Row[]) => unknown) {
              return resolve(memDb.workOrderMaterials);
            },
          };
        },
      };
    },
    update(_tbl: unknown) {
      return {
        set(patch: Row) {
          return {
            where(_w: unknown) {
              return {
                returning() {
                  if (memDb.workOrderMaterials.length > 0) {
                    Object.assign(memDb.workOrderMaterials[0], patch);
                  } else {
                    memDb.workOrderMaterials.push({ id: 1, ...patch });
                  }
                  return Promise.resolve([memDb.workOrderMaterials[0]]);
                },
              };
            },
          };
        },
      };
    },
  };
}

import { recordMaterialWeight } from '@/lib/services/wo-execution.service';
import { ScaleVerificationError } from '@/types/scale-verification';

describe('recordMaterialWeight + scale verification gate', () => {
  beforeEach(() => {
    memDb.workOrderMaterials = [{ id: 1 }];
    memDb.verifications = [];
    mockGetCurrentVerification.mockReset();
  });

  it('rejects when scaleId is provided but no current verification exists', async () => {
    mockGetCurrentVerification.mockResolvedValue(null);
    await expect(
      recordMaterialWeight({
        materialId: 1,
        weighedQty: 5.0,
        weighedBy: 7,
        scaleId: 42,
      }),
    ).rejects.toBeInstanceOf(ScaleVerificationError);
  });

  it('saves with scaleVerificationId when a valid verification is found', async () => {
    mockGetCurrentVerification.mockResolvedValue({
      id: 99,
      scaleId: 42,
      result: 'pass',
      validUntil: '2099-01-01T00:00:00.000Z',
    });
    const result = await recordMaterialWeight({
      materialId: 1,
      weighedQty: 5.0,
      weighedBy: 7,
      scaleId: 42,
    });
    expect((result as Row).scaleVerificationId).toBe(99);
    expect((result as Row).scaleId).toBe(42);
    expect((result as Row).weighedQty).toBe(5.0);
  });

  it('skips the gate when requireScaleVerification=false (water materials)', async () => {
    mockGetCurrentVerification.mockResolvedValue(null); // would normally reject
    const result = await recordMaterialWeight({
      materialId: 1,
      weighedQty: 5.0,
      weighedBy: 7,
      scaleId: 42,
      requireScaleVerification: false,
    });
    // No throw — water materials may proceed
    expect((result as Row).scaleId).toBe(42);
    // Should NOT have a verification id since the gate was skipped
    expect((result as Row).scaleVerificationId).toBeUndefined();
  });

  it('skips the gate when no scaleId is supplied (back-compat)', async () => {
    const result = await recordMaterialWeight({
      materialId: 1,
      weighedQty: 5.0,
      weighedBy: 7,
    });
    expect((result as Row).weighedQty).toBe(5.0);
    expect((result as Row).scaleVerificationId).toBeUndefined();
    expect(mockGetCurrentVerification).not.toHaveBeenCalled();
  });
});

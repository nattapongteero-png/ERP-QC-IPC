/**
 * QC Sampling Plan service — Audit QC5
 * Validation + create / update guards.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let nextInserted: any = null;

vi.mock('@/lib/db', () => ({ isSqlite: () => true, getDb: vi.fn() }));
vi.mock('@/lib/db/db-helper', () => ({
  isSqlite: () => true,
  executeDbOperation: vi.fn(async (fn: any) => {
    const fakeDb: any = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => Promise.resolve([])),
            })),
            orderBy: vi.fn(() => Promise.resolve([])),
          })),
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve(nextInserted ? [nextInserted] : [])),
            })),
            limit: vi.fn(() => Promise.resolve(nextInserted ? [nextInserted] : [])),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((v: any) => ({
          returning: vi.fn().mockResolvedValue([{ ...v, id: 7 }]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((vals: any) => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ ...vals, id: 1 }]),
          })),
        })),
      })),
    };
    return fn(fakeDb);
  }),
  getTableRef: vi.fn(() => ({})),
  getInsertId: vi.fn(() => 7),
}));
vi.mock('@/lib/db/date-utils', () => ({
  getNow: vi.fn(() => new Date('2026-06-03T00:00:00.000Z')),
}));

import {
  createSamplingPlan,
  updateSamplingPlan,
  deactivateSamplingPlan,
  VALID_FREQUENCIES,
} from '@/lib/services/qc-sampling-plan.service';

beforeEach(() => {
  nextInserted = null;
});

describe('createSamplingPlan', () => {
  it('rejects when code is missing', async () => {
    await expect(createSamplingPlan({ code: '', name: 'X' } as any)).rejects.toThrow(/code/);
  });

  it('rejects when name is missing', async () => {
    await expect(createSamplingPlan({ code: 'X', name: '' } as any)).rejects.toThrow(/name/);
  });

  it('lowercases the code and applies defaults', async () => {
    const row = await createSamplingPlan({
      code: 'RM-DEFAULT',
      name: 'Raw material default',
    });
    expect(row.code).toBe('rm-default');
    expect(row.inspectionLevel).toBe('II');
    expect(row.aql).toBe(1.0);
    expect(row.frequency).toBe('every_lot');
    expect(row.isActive).toBe(true);
  });

  it('respects explicit fields when provided', async () => {
    const row = await createSamplingPlan({
      code: 'fg-tightened',
      name: 'FG Tightened',
      inspectionLevel: 'III',
      aql: 0.65,
      frequency: 'tightened',
      sampleSize: 20,
      acceptNumber: 0,
      rejectNumber: 1,
      defaultSampleQty: 100,
      defaultRetainQty: 50,
      standardRef: 'USP <1010>',
    });
    expect(row.inspectionLevel).toBe('III');
    expect(row.aql).toBe(0.65);
    expect(row.frequency).toBe('tightened');
    expect(row.sampleSize).toBe(20);
    expect(row.standardRef).toBe('USP <1010>');
  });
});

describe('updateSamplingPlan / deactivateSamplingPlan', () => {
  it('passes through only the fields provided', async () => {
    const row = await updateSamplingPlan(1, { name: 'New name', aql: 2.5 });
    expect(row.name).toBe('New name');
    expect(row.aql).toBe(2.5);
  });

  it('deactivate sets isActive to false', async () => {
    const row = await deactivateSamplingPlan(1);
    expect(row.isActive).toBe(false);
  });
});

describe('VALID_FREQUENCIES', () => {
  it('exports the 6 supported frequency tokens', () => {
    expect(VALID_FREQUENCIES).toEqual([
      'every_lot',
      'random_30pct',
      'random_10pct',
      'skip_lot',
      'reduced',
      'tightened',
    ]);
  });
});

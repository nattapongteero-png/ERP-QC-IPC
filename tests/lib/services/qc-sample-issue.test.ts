/**
 * QC Sample Issue + Retain Sample logic — Audit QC2 + QC3
 *
 * Lock the pure math + lookup contract for `computeRetainExpiry` and
 * verify the issue/retain flow honors stock & retention rules.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockLots: any[] = [];
let warehouseRows: any[] = [];
let inserted: { lot: any; tx: any[] } = { lot: null, tx: [] };
let updatedLot: any = null;

vi.mock('@/lib/db', () => ({ isSqlite: () => true, getDb: vi.fn() }));
vi.mock('@/lib/db/db-helper', () => ({
  isSqlite: () => true,
  executeDbOperation: vi.fn(async (fn: any) => {
    const fakeDb: any = {
      select: vi.fn((cols?: any) => ({
        from: vi.fn((tbl?: any) => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => {
              if (cols && 'code' in cols && 'name' in cols) return Promise.resolve(warehouseRows);
              return Promise.resolve(mockLots);
            }),
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve(mockLots)),
            })),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((vals: any) => {
          updatedLot = vals;
          return { where: vi.fn().mockResolvedValue([{}]) };
        }),
      })),
      insert: vi.fn((tbl: any) => ({
        values: vi.fn((vals: any) => {
          const isLot = tbl?._name === 'inventoryLots' || tbl?.itemId !== undefined;
          if (vals.lotNumber) inserted.lot = vals;
          else inserted.tx.push(vals);
          return {
            returning: vi.fn().mockResolvedValue([{ ...vals, id: 999 }]),
          };
        }),
      })),
    };
    return fn(fakeDb);
  }),
  getTableRef: vi.fn((name: string) => ({ _name: name })),
  getInsertId: vi.fn(() => 999),
}));
vi.mock('@/lib/db/date-utils', () => ({
  getNow: vi.fn(() => new Date('2026-06-03T00:00:00.000Z')),
  toDbDate: vi.fn((v: string) => v),
  getTodayStr: vi.fn(() => '2026-06-03'),
}));

import {
  computeRetainExpiry,
  issueSampleFromLot,
  ensureRetainSampleWarehouse,
} from '@/lib/services/qc-sample-issue.service';

describe('computeRetainExpiry', () => {
  it('returns sourceExpiry + 1 year', () => {
    expect(computeRetainExpiry('2026-12-31')).toBe('2027-12-31');
  });

  it('handles a Date object', () => {
    expect(computeRetainExpiry(new Date('2026-01-15'))).toBe('2027-01-15');
  });

  it('falls back to today + 1 year when source expiry missing', () => {
    const r = computeRetainExpiry(null);
    expect(r).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // year part should be next year's
    const expectedYear = new Date().getFullYear() + 1;
    expect(r.startsWith(String(expectedYear))).toBe(true);
  });

  it('falls back to today + 1 year when source expiry is invalid', () => {
    const r = computeRetainExpiry('not-a-date');
    const expectedYear = new Date().getFullYear() + 1;
    expect(r.startsWith(String(expectedYear))).toBe(true);
  });
});

describe('issueSampleFromLot — no-op when zero qty', () => {
  beforeEach(() => {
    mockLots = [];
    warehouseRows = [];
    inserted = { lot: null, tx: [] };
    updatedLot = null;
  });

  it('returns zero result when both qty=0', async () => {
    const r = await issueSampleFromLot({
      sampleId: 1,
      sampleNumber: 'QC-1',
      productId: 1,
      sampleQty: 0,
      retainSampleQty: 0,
      userId: 5,
    });
    expect(r.sourceLotId).toBeNull();
    expect(r.sampleIssuedQty).toBe(0);
    expect(r.retainLotId).toBeNull();
  });
});

describe('issueSampleFromLot — guards', () => {
  beforeEach(() => {
    mockLots = [];
    warehouseRows = [];
    inserted = { lot: null, tx: [] };
    updatedLot = null;
  });

  it('throws SOURCE_LOT_NOT_FOUND when lot cannot be resolved', async () => {
    mockLots = [];
    await expect(
      issueSampleFromLot({
        sampleId: 1,
        sampleNumber: 'QC-1',
        productId: 1,
        sourceLotId: 999,
        sampleQty: 5,
        userId: 5,
      }),
    ).rejects.toThrow(/SOURCE_LOT_NOT_FOUND/);
  });

  it('throws INSUFFICIENT_LOT_STOCK when draw > available', async () => {
    mockLots = [
      {
        id: 1,
        itemId: 1,
        lotNumber: 'L1',
        quantity: 10,
        reservedQuantity: 0,
        unit: 'g',
        warehouseId: 1,
        expiryDate: '2027-01-01',
      },
    ];
    await expect(
      issueSampleFromLot({
        sampleId: 1,
        sampleNumber: 'QC-1',
        productId: 1,
        sourceLotId: 1,
        sampleQty: 8,
        retainSampleQty: 5,
        userId: 5,
      }),
    ).rejects.toThrow(/INSUFFICIENT_LOT_STOCK/);
  });
});

describe('ensureRetainSampleWarehouse', () => {
  beforeEach(() => {
    warehouseRows = [];
  });

  it('returns existing retain warehouse when one is present', async () => {
    warehouseRows = [{ id: 42, code: 'WH-RS-001', name: 'Retain' }];
    const r = await ensureRetainSampleWarehouse(1);
    expect(r.id).toBe(42);
    expect(r.created).toBe(false);
  });
});

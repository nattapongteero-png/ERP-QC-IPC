/**
 * Production Audit fix — Material weighing positive-qty guard
 * Audit issue: #11
 *
 * The UI no longer pre-fills the BOM planned qty. The service must
 * therefore reject any attempt to save weighedQty <= 0, since that
 * would mean the operator never actually read the scale.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: vi.fn(),
}));

vi.mock('@/lib/db/db-helper', () => ({
  executeDbOperation: vi.fn(async (fn: any) => fn({} as any)),
  getTableRef: vi.fn(),
  dbDate: vi.fn(() => new Date('2026-06-03T00:00:00.000Z')),
  getInsertId: vi.fn(() => 1),
}));

vi.mock('@/lib/db/date-utils', () => ({
  getNow: vi.fn(() => new Date('2026-06-03T00:00:00.000Z')),
  getTodayStr: vi.fn(() => '2026-06-03'),
  toDbDate: vi.fn((v: string) => v),
  toDateSafe: vi.fn((v: any) => v),
  formatDateFromDb: vi.fn((v: any) => v),
  toQueryDate: vi.fn((v: any) => v),
}));

vi.mock('@/lib/db/audit-wrapper', () => ({
  auditedInsert: vi.fn(),
  auditedUpdate: vi.fn(),
  auditedDelete: vi.fn(),
}));

import { recordMaterialWeight } from '@/lib/services/wo-execution.service';

describe('Audit #11 — weighedQty must be positive', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects weighedQty = 0 with INVALID_WEIGHED_QTY', async () => {
    await expect(
      recordMaterialWeight({
        materialId: 1,
        weighedQty: 0,
        weighedBy: 5,
      }),
    ).rejects.toThrow(/INVALID_WEIGHED_QTY/);
  });

  it('rejects negative weighedQty', async () => {
    await expect(
      recordMaterialWeight({
        materialId: 1,
        weighedQty: -1.5,
        weighedBy: 5,
      }),
    ).rejects.toThrow(/INVALID_WEIGHED_QTY/);
  });

  it('rejects NaN weighedQty', async () => {
    await expect(
      recordMaterialWeight({
        materialId: 1,
        weighedQty: Number.NaN,
        weighedBy: 5,
      }),
    ).rejects.toThrow(/INVALID_WEIGHED_QTY/);
  });

  it('rejects undefined weighedQty (no value typed)', async () => {
    await expect(
      recordMaterialWeight({
        materialId: 1,
        weighedQty: undefined as unknown as number,
        weighedBy: 5,
      }),
    ).rejects.toThrow(/INVALID_WEIGHED_QTY/);
  });
});

/**
 * Unit tests for GRN Number Generator
 * Feature: 020-goods-receipt
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sequences: Array<{ year: number; nextValue: number; updatedAt?: string }> = [];

vi.mock('@/lib/db/db-helper', () => ({
  isSqlite: () => true,
  getTableRef: (n: string) => ({ __table: n }),
  getInsertId: (r: unknown) => Number((r as { lastInsertRowid: number }).lastInsertRowid),
  dbDate: () => '2026-06-03T00:00:00.000Z',
  executeDbOperation: async (op: (db: unknown) => unknown) => op(makeMockDb()),
}));

vi.mock('@/lib/db/date-utils', () => ({
  getNow: () => '2026-06-03T00:00:00.000Z',
  toDbDate: (v: string | Date) => (typeof v === 'string' ? v : v.toISOString()),
}));

function makeMockDb() {
  return {
    select() {
      const ctx: { table: string; whereFn?: (row: { year: number }) => boolean; limit?: number } = {
        table: '',
      };
      const builder = {
        from(tbl: { __table: string }) {
          ctx.table = tbl.__table;
          return builder;
        },
        where(predicate: unknown) {
          // We can't introspect the drizzle eq() helper — fake by matching all
          // and let limit narrow to one
          ctx.whereFn = () => true;
          return builder;
        },
        limit(n: number) {
          ctx.limit = n;
          return builder;
        },
        then(resolve: (rows: unknown[]) => unknown) {
          return resolve(sequences.slice(0, ctx.limit ?? sequences.length));
        },
      };
      return builder;
    },
    insert() {
      return {
        values(v: { year: number; nextValue: number }) {
          sequences.push({ year: v.year, nextValue: v.nextValue });
          return { lastInsertRowid: 1 };
        },
      };
    },
    update() {
      return {
        set(patch: { nextValue: number }) {
          return {
            where(_w: unknown) {
              if (sequences.length > 0) sequences[0].nextValue = patch.nextValue;
              return { changes: 1 };
            },
          };
        },
      };
    },
  };
}

import { generateGrnNumber } from '@/lib/services/goods-receipt-numbering.service';

describe('GRN Numbering', () => {
  beforeEach(() => {
    sequences.length = 0;
  });

  it('produces GRN-YYYY-00001 for the first GRN of the year', async () => {
    const result = await generateGrnNumber(2026);
    expect(result).toMatch(/^GRN-2026-\d{5}$/);
    expect(result).toBe('GRN-2026-00001');
  });

  it('increments sequentially within the same year', async () => {
    const a = await generateGrnNumber(2026);
    const b = await generateGrnNumber(2026);
    const c = await generateGrnNumber(2026);
    expect(a).toBe('GRN-2026-00001');
    expect(b).toBe('GRN-2026-00002');
    expect(c).toBe('GRN-2026-00003');
  });

  it('zero-pads to 5 digits', async () => {
    for (let i = 0; i < 10; i++) {
      await generateGrnNumber(2026);
    }
    const eleventh = await generateGrnNumber(2026);
    expect(eleventh).toBe('GRN-2026-00011');
    expect(eleventh.length).toBe(14); // GRN-YYYY-NNNNN = 3+1+4+1+5 = 14

  });

  it('uses current year when no year argument is passed', async () => {
    const result = await generateGrnNumber();
    expect(result).toMatch(/^GRN-\d{4}-\d{5}$/);
  });
});

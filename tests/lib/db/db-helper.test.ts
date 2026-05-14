import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the underlying isSqlite check before importing the helper.
// Each test toggles the flag to simulate either driver.
let sqliteFlag = true;

vi.mock('@/lib/db', () => ({
  isSqlite: () => sqliteFlag,
  getDb: vi.fn(),
}));

import { getAffectedRows } from '@/lib/db/db-helper';

describe('getAffectedRows', () => {
  beforeEach(() => {
    sqliteFlag = true;
  });

  describe('SQLite', () => {
    it('returns changes count', () => {
      sqliteFlag = true;
      expect(getAffectedRows({ changes: 1 })).toBe(1);
      expect(getAffectedRows({ changes: 5 })).toBe(5);
    });

    it('returns 0 when changes is missing', () => {
      sqliteFlag = true;
      expect(getAffectedRows({})).toBe(0);
      expect(getAffectedRows(undefined)).toBe(0);
    });

    it('returns 0 for failed update', () => {
      sqliteFlag = true;
      expect(getAffectedRows({ changes: 0 })).toBe(0);
    });
  });

  describe('MySQL', () => {
    it('returns affectedRows from array result', () => {
      sqliteFlag = false;
      expect(getAffectedRows([{ affectedRows: 1 }])).toBe(1);
      expect(getAffectedRows([{ affectedRows: 3 }])).toBe(3);
    });

    it('returns affectedRows from object result', () => {
      sqliteFlag = false;
      expect(getAffectedRows({ affectedRows: 2 })).toBe(2);
    });

    it('returns 0 when affectedRows missing', () => {
      sqliteFlag = false;
      expect(getAffectedRows([{}])).toBe(0);
      expect(getAffectedRows({})).toBe(0);
      expect(getAffectedRows(undefined)).toBe(0);
    });

    it('returns 0 for failed update', () => {
      sqliteFlag = false;
      expect(getAffectedRows([{ affectedRows: 0 }])).toBe(0);
    });
  });
});

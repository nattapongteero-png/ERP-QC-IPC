/**
 * Lot Pattern service — composeLotNumber + previewSystemLot + validateVendorLot.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({ isSqlite: () => true, getDb: vi.fn() }));

let mockPatternRow: any = null;
let mockExisting: { lotNumber: string }[] = [];

vi.mock('@/lib/db/db-helper', () => ({
  isSqlite: () => true,
  executeDbOperation: vi.fn(async (fn: any) => {
    const fakeDb: any = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(mockPatternRow ? [mockPatternRow] : [])),
            then: (resolve: (v: any) => any) => resolve(mockExisting),
          })),
        })),
      })),
      insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })) })),
    };
    return fn(fakeDb);
  }),
  getTableRef: vi.fn(() => ({ patternType: 'pattern_type', lotNumber: 'lot_number' })),
}));

vi.mock('@/lib/db/date-utils', () => ({
  getNow: vi.fn(() => new Date('2026-06-03T00:00:00.000Z')),
}));

import {
  composeLotNumber,
  previewSystemLot,
  generateSystemLot,
  validateVendorLot,
  getVendorHint,
} from '@/lib/services/lot-pattern.service';

beforeEach(() => {
  mockPatternRow = null;
  mockExisting = [];
});

describe('composeLotNumber', () => {
  const base = {
    id: 0, patternType: 'system' as const,
    regexPattern: null, hintTh: null, hintEn: null,
    isActive: true, notes: null, updatedBy: null,
    createdAt: '', updatedAt: '',
  };

  it('LOT-YYYYMMDD-NNN default', () => {
    const code = composeLotNumber(
      { ...base, prefix: 'LOT', separator: '-', includeDate: true, dateFormat: 'YYYYMMDD', sequenceType: 'random', sequenceLength: 3, sequenceStart: 1 },
      42,
      new Date('2026-06-03'),
    );
    expect(code).toBe('LOT-20260603-042');
  });

  it('BE-YYYYMMDD (Thai พ.ศ.)', () => {
    const code = composeLotNumber(
      { ...base, prefix: 'B', separator: '.', includeDate: true, dateFormat: 'BE-YYYYMMDD', sequenceType: 'random', sequenceLength: 4, sequenceStart: 1 },
      1,
      new Date('2026-06-03'),
    );
    expect(code).toBe('B.25690603.0001');
  });

  it('no date, no separator', () => {
    const code = composeLotNumber(
      { ...base, prefix: 'X', separator: '', includeDate: false, dateFormat: 'none', sequenceType: 'sequential', sequenceLength: 5, sequenceStart: 1 },
      777,
    );
    expect(code).toBe('X00777');
  });

  it('empty prefix is dropped', () => {
    const code = composeLotNumber(
      { ...base, prefix: '', separator: '-', includeDate: true, dateFormat: 'YYYYMMDD', sequenceType: 'random', sequenceLength: 3, sequenceStart: 1 },
      9,
      new Date('2026-06-03'),
    );
    expect(code).toBe('20260603-009');
  });

  it('YYMMDD short year', () => {
    const code = composeLotNumber(
      { ...base, prefix: 'LOT', separator: '-', includeDate: true, dateFormat: 'YYMMDD', sequenceType: 'random', sequenceLength: 3, sequenceStart: 1 },
      5,
      new Date('2026-06-03'),
    );
    expect(code).toBe('LOT-260603-005');
  });
});

describe('previewSystemLot', () => {
  it('uses sequenceStart when no explicit seq', () => {
    const code = previewSystemLot({
      patternType: 'system', prefix: 'LOT', separator: '-', includeDate: false,
      dateFormat: 'none', sequenceType: 'sequential', sequenceLength: 4, sequenceStart: 100,
      regexPattern: null, hintTh: null, hintEn: null, isActive: true, notes: null,
    });
    expect(code).toBe('LOT-0100');
  });
});

describe('generateSystemLot — sequential gap-filling', () => {
  it('returns first free slot', async () => {
    mockPatternRow = {
      id: 1, patternType: 'system', prefix: 'LOT', separator: '-',
      includeDate: false, dateFormat: 'none',
      sequenceType: 'sequential', sequenceLength: 3, sequenceStart: 1,
      regexPattern: null, hintTh: null, hintEn: null,
      isActive: true, notes: null, updatedBy: null,
      createdAt: '', updatedAt: '',
    };
    mockExisting = [{ lotNumber: 'LOT-001' }, { lotNumber: 'LOT-003' }];
    const code = await generateSystemLot();
    expect(code).toBe('LOT-002');
  });

  it('skips non-matching lot numbers', async () => {
    mockPatternRow = {
      id: 1, patternType: 'system', prefix: 'LOT', separator: '-',
      includeDate: false, dateFormat: 'none',
      sequenceType: 'sequential', sequenceLength: 3, sequenceStart: 1,
      regexPattern: null, hintTh: null, hintEn: null,
      isActive: true, notes: null, updatedBy: null,
      createdAt: '', updatedAt: '',
    };
    mockExisting = [{ lotNumber: 'LOT-001' }, { lotNumber: 'LOT-junk' }, { lotNumber: 'OTHER-002' }];
    const code = await generateSystemLot();
    expect(code).toBe('LOT-002');
  });
});

describe('validateVendorLot', () => {
  it('returns ok when no value given (optional)', async () => {
    mockPatternRow = null;
    const res = await validateVendorLot('');
    expect(res.ok).toBe(true);
  });

  it('returns ok when no regex configured', async () => {
    mockPatternRow = {
      id: 1, patternType: 'vendor', prefix: '', separator: '-',
      includeDate: false, dateFormat: 'none', sequenceType: 'random',
      sequenceLength: 3, sequenceStart: 1,
      regexPattern: null, hintTh: 'x', hintEn: 'x',
      isActive: true, notes: null, updatedBy: null,
      createdAt: '', updatedAt: '',
    };
    const res = await validateVendorLot('whatever-format-99');
    expect(res.ok).toBe(true);
  });

  it('passes when value matches regex', async () => {
    mockPatternRow = {
      id: 1, patternType: 'vendor', prefix: '', separator: '-',
      includeDate: false, dateFormat: 'none', sequenceType: 'random',
      sequenceLength: 3, sequenceStart: 1,
      regexPattern: '^V-LOT-\\d{4}$', hintTh: null, hintEn: null,
      isActive: true, notes: null, updatedBy: null,
      createdAt: '', updatedAt: '',
    };
    const res = await validateVendorLot('V-LOT-1234');
    expect(res.ok).toBe(true);
  });

  it('fails with message when value does not match regex', async () => {
    mockPatternRow = {
      id: 1, patternType: 'vendor', prefix: '', separator: '-',
      includeDate: false, dateFormat: 'none', sequenceType: 'random',
      sequenceLength: 3, sequenceStart: 1,
      regexPattern: '^V-LOT-\\d{4}$', hintTh: null, hintEn: null,
      isActive: true, notes: null, updatedBy: null,
      createdAt: '', updatedAt: '',
    };
    const res = await validateVendorLot('XX-99');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/ไม่ตรงข้อกำหนด/);
  });

  it('fails open on malformed regex in DB', async () => {
    mockPatternRow = {
      id: 1, patternType: 'vendor', prefix: '', separator: '-',
      includeDate: false, dateFormat: 'none', sequenceType: 'random',
      sequenceLength: 3, sequenceStart: 1,
      regexPattern: '[unclosed', hintTh: null, hintEn: null,
      isActive: true, notes: null, updatedBy: null,
      createdAt: '', updatedAt: '',
    };
    const res = await validateVendorLot('anything');
    expect(res.ok).toBe(true); // do not block on bad regex
  });
});

describe('getVendorHint', () => {
  it('returns TH hint when locale=th', async () => {
    mockPatternRow = {
      id: 1, patternType: 'vendor', prefix: '', separator: '-',
      includeDate: false, dateFormat: 'none', sequenceType: 'random',
      sequenceLength: 3, sequenceStart: 1,
      regexPattern: '^V-\\d+$', hintTh: 'เช่น V-1234',
      hintEn: 'e.g. V-1234',
      isActive: true, notes: null, updatedBy: null,
      createdAt: '', updatedAt: '',
    };
    const res = await getVendorHint('th');
    expect(res.hint).toBe('เช่น V-1234');
    expect(res.regex).toBe('^V-\\d+$');
  });

  it('returns EN hint when locale=en', async () => {
    mockPatternRow = {
      id: 1, patternType: 'vendor', prefix: '', separator: '-',
      includeDate: false, dateFormat: 'none', sequenceType: 'random',
      sequenceLength: 3, sequenceStart: 1,
      regexPattern: null, hintTh: 'TH',
      hintEn: 'EN hint',
      isActive: true, notes: null, updatedBy: null,
      createdAt: '', updatedAt: '',
    };
    const res = await getVendorHint('en');
    expect(res.hint).toBe('EN hint');
  });

  it('falls back to defaults when nothing configured', async () => {
    mockPatternRow = null;
    const res = await getVendorHint('th');
    expect(res.hint).toBe('เลข Lot ผู้ขาย');
  });
});

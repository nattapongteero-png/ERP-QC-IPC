/**
 * Item Code Pattern service — code composition + DB-backed generation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({ isSqlite: () => true, getDb: vi.fn() }));

let mockExisting: { code: string }[] = [];
let mockPatternRow: any = null;

vi.mock('@/lib/db/db-helper', () => ({
  isSqlite: () => true,
  executeDbOperation: vi.fn(async (fn: any) => {
    const fakeDb: any = {
      select: vi.fn((shape?: any) => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(mockPatternRow ? [mockPatternRow] : [])),
          })),
          // for items.code scan
          // when called without where().limit() but with where() only
        })),
      })),
      insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })) })),
    };
    // override: we need select().from().where(like) for items.code scan
    fakeDb.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          // return either: pattern row (when limit chained) OR full code scan
          return {
            limit: vi.fn(() => Promise.resolve(mockPatternRow ? [mockPatternRow] : [])),
            then: (resolve: (v: any) => any) => resolve(mockExisting),
            [Symbol.asyncIterator]: undefined,
          };
        }),
      })),
    }));
    return fn(fakeDb);
  }),
  getTableRef: vi.fn(() => ({ code: 'code', itemType: 'item_type' })),
}));

vi.mock('@/lib/db/date-utils', () => ({
  getNow: vi.fn(() => new Date('2026-06-03T00:00:00.000Z')),
}));

import {
  composeCode,
  previewCode,
  generateNextCode,
  getPatternForType,
} from '@/lib/services/item-code-pattern.service';
import { DEFAULT_PATTERNS } from '@/lib/validation/item-code-pattern';

beforeEach(() => {
  mockExisting = [];
  mockPatternRow = null;
});

describe('composeCode', () => {
  it('basic RM-0001 with default pattern', () => {
    const code = composeCode(
      { prefix: 'RM', separator: '-', padding: 4, includeYear: false, yearFormat: 'YYYY', yearPosition: 'after_prefix' },
      1,
    );
    expect(code).toBe('RM-0001');
  });

  it('padding 5 → RM-00042', () => {
    const code = composeCode(
      { prefix: 'RM', separator: '-', padding: 5, includeYear: false, yearFormat: 'YYYY', yearPosition: 'after_prefix' },
      42,
    );
    expect(code).toBe('RM-00042');
  });

  it('underscore separator', () => {
    const code = composeCode(
      { prefix: 'PK', separator: '_', padding: 4, includeYear: false, yearFormat: 'YYYY', yearPosition: 'after_prefix' },
      7,
    );
    expect(code).toBe('PK_0007');
  });

  it('no separator', () => {
    const code = composeCode(
      { prefix: 'WIP', separator: '', padding: 4, includeYear: false, yearFormat: 'YYYY', yearPosition: 'after_prefix' },
      1,
    );
    expect(code).toBe('WIP0001');
  });

  it('include AD year (YYYY)', () => {
    const code = composeCode(
      { prefix: 'RM', separator: '-', padding: 4, includeYear: true, yearFormat: 'YYYY', yearPosition: 'after_prefix' },
      1,
      new Date('2026-06-03'),
    );
    expect(code).toBe('RM-2026-0001');
  });

  it('include BE year (BE-YYYY) — Thai พ.ศ.', () => {
    const code = composeCode(
      { prefix: 'ม', separator: '.', padding: 4, includeYear: true, yearFormat: 'BE-YYYY', yearPosition: 'after_prefix' },
      1,
      new Date('2026-06-03'),
    );
    expect(code).toBe('ม.2569.0001');
  });

  it('YY short form', () => {
    const code = composeCode(
      { prefix: 'FG', separator: '-', padding: 4, includeYear: true, yearFormat: 'YY', yearPosition: 'after_prefix' },
      99,
      new Date('2026-06-03'),
    );
    expect(code).toBe('FG-26-0099');
  });
});

describe('previewCode', () => {
  it('uses sequenceStart by default', () => {
    const code = previewCode(
      {
        itemType: 'raw_material',
        prefix: 'RM',
        separator: '-',
        padding: 4,
        includeYear: false,
        yearFormat: 'YYYY',
        yearPosition: 'after_prefix',
        sequenceStart: 100,
        isActive: true,
        notes: null,
      },
    );
    expect(code).toBe('RM-0100');
  });

  it('respects explicit sequence', () => {
    const code = previewCode(
      {
        itemType: 'finished_goods',
        prefix: 'FG',
        separator: '-',
        padding: 4,
        includeYear: false,
        yearFormat: 'YYYY',
        yearPosition: 'after_prefix',
        sequenceStart: 1,
        isActive: true,
        notes: null,
      },
      777,
    );
    expect(code).toBe('FG-0777');
  });
});

describe('getPatternForType', () => {
  it('returns synthesized default when no DB row exists', async () => {
    mockPatternRow = null;
    const p = await getPatternForType('raw_material');
    expect(p.prefix).toBe(DEFAULT_PATTERNS.raw_material.prefix);
    expect(p.separator).toBe('-');
    expect(p.padding).toBe(4);
    expect(p.id).toBe(0); // marker for synthesized
  });

  it('returns saved row when present', async () => {
    mockPatternRow = {
      id: 5,
      itemType: 'raw_material',
      prefix: 'HRB',
      separator: '/',
      padding: 5,
      includeYear: true,
      yearFormat: 'BE-YYYY',
      yearPosition: 'after_prefix',
      sequenceStart: 1,
      isActive: true,
      notes: 'custom',
      updatedBy: 1,
      createdAt: '2026-01-01',
      updatedAt: '2026-06-03',
    };
    const p = await getPatternForType('raw_material');
    expect(p.id).toBe(5);
    expect(p.prefix).toBe('HRB');
    expect(p.separator).toBe('/');
    expect(p.padding).toBe(5);
    expect(p.includeYear).toBe(true);
  });
});

describe('generateNextCode — gap filling', () => {
  it('returns first free slot when codes 1,2,3 used', async () => {
    mockPatternRow = null; // use defaults
    mockExisting = [{ code: 'RM-0001' }, { code: 'RM-0002' }, { code: 'RM-0003' }];
    const code = await generateNextCode('raw_material');
    expect(code).toBe('RM-0004');
  });

  it('fills gap when 1 and 3 used but 2 free', async () => {
    mockPatternRow = null;
    mockExisting = [{ code: 'RM-0001' }, { code: 'RM-0003' }];
    const code = await generateNextCode('raw_material');
    expect(code).toBe('RM-0002');
  });

  it('ignores codes that do not match the pattern', async () => {
    mockPatternRow = null;
    mockExisting = [{ code: 'RM-0001' }, { code: 'RM-junk' }, { code: 'RMabc' }];
    const code = await generateNextCode('raw_material');
    expect(code).toBe('RM-0002');
  });

  it('honors sequenceStart from saved pattern', async () => {
    mockPatternRow = {
      id: 5,
      itemType: 'raw_material',
      prefix: 'RM',
      separator: '-',
      padding: 4,
      includeYear: false,
      yearFormat: 'YYYY',
      yearPosition: 'after_prefix',
      sequenceStart: 1000,
      isActive: true,
      notes: null,
      updatedBy: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-06-03',
    };
    mockExisting = [];
    const code = await generateNextCode('raw_material');
    expect(code).toBe('RM-1000');
  });
});

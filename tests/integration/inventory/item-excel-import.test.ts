/**
 * Integration test — Item "นำเข้า Excel" end-to-end (minus the browser file
 * picker + network):  build an .xlsx workbook  ->  XLSX.read  ->
 * sheet_to_json  ->  parseImportSheet (the button's parser)  ->  insert each
 * payload into the items table  ->  assert every field round-tripped.
 *
 * Uses an in-memory SQLite DB built from the real schema (same approach as
 * tests/api/items.test.ts) so column types/constraints match production.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import * as schema from '../../../src/lib/db/schema';
import { generateCreateTableSql } from '../../helpers/schema-sync';
import {
  ITEM_COLUMNS,
  ITEM_TYPES_CONFIG,
  parseImportSheet,
  type ImportRow,
} from '../../../src/lib/inventory/item-import';

// One realistic example row per type, keyed by Excel header (as a user would
// fill the downloaded template). Mirrors the template's example data shape.
const headerFor = (field: string) =>
  ITEM_COLUMNS.find((c) => c.field === field)!.header;

function row(fields: Record<string, string | number>): ImportRow {
  const r: ImportRow = {};
  for (const [field, val] of Object.entries(fields)) r[headerFor(field)] = val;
  return r;
}

const SHEETS: Record<string, ImportRow[]> = {
  'Raw Material': [
    row({ code: 'RM-9001', nameTh: 'การบูร', nameEn: 'Camphor', category: 'herb', primaryUnit: 'kg', secondaryUnit: 'g', conversionRate: 1000, weightUnit: 'g', secondaryToWeightRate: 1, weightTrackingEnabled: 'true', shelfLifeDays: 730, storageCondition: 'แห้ง', minStock: 50, maxStock: 500, reorderPoint: 100, isLotControlled: 'true', isFEFO: 'true', confidentialityLevel: 'public' }),
  ],
  Packaging: [
    row({ code: 'PK-9001', nameTh: 'ขวดแก้ว 100ml', nameEn: 'Glass Bottle', category: 'bottle', primaryUnit: 'box', secondaryUnit: 'pcs', conversionRate: 100, isPrimaryPacking: 'true', unitWeightMg: 140000, isLotControlled: 'false' }),
  ],
  'Finished Goods': [
    row({ code: 'FG-9001', nameTh: 'แคปซูลขมิ้นชัน 500mg', nameEn: 'Turmeric Capsule', category: 'finished', primaryUnit: 'bottle', secondaryUnit: 'cap', conversionRate: 60, strength: '500 mg', strengthValue: 500, strengthUnit: 'mg', unitWeightMg: 500, isLotControlled: 'true', isFEFO: 'true', gRegNumber: 'G-123' }),
  ],
  WIP: [
    row({ code: 'WIP-9001', nameTh: 'ผงผสม bulk', primaryUnit: 'kg', secondaryUnit: 'g', conversionRate: 1000, weightTrackingEnabled: 'true', confidentialityLevel: 'internal' }),
  ],
  Consumable: [
    row({ code: 'CS-9001', nameTh: 'ถุงมือไนไตรล์', primaryUnit: 'box', secondaryUnit: 'pcs', conversionRate: 100, shelfLifeDays: 1825 }),
  ],
};

/** Build an .xlsx (as the operator would) and return its bytes. */
function buildWorkbookBytes(): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const [sheetName, rows] of Object.entries(SHEETS)) {
    const ws = XLSX.utils.json_to_sheet(rows as Record<string, unknown>[]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

describe('Item Excel import (integration)', () => {
  let sqliteDb: ReturnType<typeof Database>;
  let db: ReturnType<typeof drizzle>;

  beforeAll(() => {
    sqliteDb = new Database(':memory:');
    db = drizzle(sqliteDb, { schema });
    sqliteDb.exec(generateCreateTableSql(schema.sqliteItems));
  });
  afterAll(() => sqliteDb.close());
  beforeEach(() => sqliteDb.exec('DELETE FROM items'));

  // Mirror the page handler: parse each sheet for its type, insert payloads.
  function importWorkbook(bytes: Uint8Array) {
    const wb = XLSX.read(bytes, { type: 'array' });
    let inserted = 0;
    const errors: string[] = [];
    for (const tc of ITEM_TYPES_CONFIG) {
      const sheetName = wb.SheetNames.find((n) => n === tc.sheetName);
      if (!sheetName) continue;
      const json = XLSX.utils.sheet_to_json<ImportRow>(wb.Sheets[sheetName]);
      const { payloads, errors: rowErrors } = parseImportSheet(json, tc.key);
      rowErrors.forEach((e) => errors.push(`${tc.sheetName}#${e.rowIndex}: ${e.error}`));
      for (const p of payloads) {
        db.insert(schema.sqliteItems).values(p as typeof schema.sqliteItems.$inferInsert).run();
        inserted++;
      }
    }
    return { inserted, errors };
  }

  it('imports one item of every type from a generated workbook', () => {
    const { inserted, errors } = importWorkbook(buildWorkbookBytes());
    expect(errors).toEqual([]);
    expect(inserted).toBe(5);

    const all = db.select().from(schema.sqliteItems).all();
    expect(all).toHaveLength(5);
    expect(all.map((i) => i.type).sort()).toEqual(
      ['consumable', 'finished_goods', 'packaging', 'raw_material', 'wip'],
    );
  });

  it('persists numbers, booleans and text correctly (FG row)', () => {
    importWorkbook(buildWorkbookBytes());
    const [fg] = db.select().from(schema.sqliteItems).where(eq(schema.sqliteItems.code, 'FG-9001')).all();
    expect(fg).toBeDefined();
    expect(fg.nameTh).toBe('แคปซูลขมิ้นชัน 500mg');         // Thai text intact
    expect(fg.type).toBe('finished_goods');
    expect(Number(fg.conversionRate)).toBe(60);             // number
    expect(Number(fg.strengthValue)).toBe(500);
    expect(Number(fg.unitWeightMg)).toBe(500);
    expect(fg.isLotControlled).toBeTruthy();                // boolean -> truthy
    expect(fg.isFEFO).toBeTruthy();
    expect(fg.strengthUnit).toBe('mg');                     // text
    expect(fg.gRegNumber).toBe('G-123');
    expect(fg.isActive).toBeTruthy();                       // defaulted by parser
  });

  it('coerces booleans: RM lot-control/FEFO true, PK lot-control false', () => {
    importWorkbook(buildWorkbookBytes());
    const [rm] = db.select().from(schema.sqliteItems).where(eq(schema.sqliteItems.code, 'RM-9001')).all();
    const [pk] = db.select().from(schema.sqliteItems).where(eq(schema.sqliteItems.code, 'PK-9001')).all();
    // weightTrackingEnabled / isLotControlled / isFEFO are boolean cols in both schemas.
    expect(rm.weightTrackingEnabled).toBeTruthy();
    expect(rm.isLotControlled).toBeTruthy();
    expect(rm.isFEFO).toBeTruthy();
    expect(pk.isLotControlled).toBeFalsy(); // PK sheet sets isLotControlled='false'
  });

  it('reports a row error for a sheet row missing the required name', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      row({ code: 'RM-OK', nameTh: 'ดีอยู่', primaryUnit: 'kg' }) as Record<string, unknown>,
      // missing nameTh -> rejected, not inserted
      { [headerFor('code')]: 'RM-BAD', [headerFor('primaryUnit')]: 'kg' } as Record<string, unknown>,
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Raw Material');
    const bytes = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);

    const { inserted, errors } = importWorkbook(bytes);
    expect(inserted).toBe(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('ชื่อ TH');
    expect(db.select().from(schema.sqliteItems).all()).toHaveLength(1);
  });

  it('ignores sheets for types the operator did not include', () => {
    // workbook with only the Packaging sheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([SHEETS['Packaging'][0] as Record<string, unknown>]),
      'Packaging',
    );
    const bytes = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
    const { inserted } = importWorkbook(bytes);
    expect(inserted).toBe(1);
    expect(db.select().from(schema.sqliteItems).all()[0].type).toBe('packaging');
  });
});

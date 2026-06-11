/**
 * Unit tests — Item Excel import parsing (the "นำเข้า Excel" button logic).
 *
 * Covers the pure parser extracted to src/lib/inventory/item-import.ts:
 * column model completeness, header/field mapping, number/boolean/text
 * coercion, required-field validation, and per-sheet aggregation across all
 * item types. No DB / no network.
 */
import { describe, it, expect } from 'vitest';
import {
  ITEM_COLUMNS,
  ITEM_TYPES_CONFIG,
  ALL_TYPE_KEYS,
  parseBoolean,
  parseImportRow,
  parseImportSheet,
} from '@/lib/inventory/item-import';

describe('item-import: column model', () => {
  it('exposes the 5 item types with sheet names', () => {
    expect(ITEM_TYPES_CONFIG.map((t) => t.key)).toEqual([
      'raw_material', 'packaging', 'finished_goods', 'wip', 'consumable',
    ]);
    expect(ALL_TYPE_KEYS).toHaveLength(5);
    ITEM_TYPES_CONFIG.forEach((t) => expect(t.sheetName).toBeTruthy());
  });

  it('covers every POST /api/items field the create route accepts', () => {
    // Keep this list in sync with src/app/api/items/route.ts destructuring.
    const apiFields = [
      'code', 'nameTh', 'nameEn', 'category', 'primaryUnit', 'secondaryUnit',
      'conversionRate', 'weightUnit', 'secondaryToWeightRate', 'weightTrackingEnabled',
      'shelfLifeDays', 'storageCondition', 'minStock', 'maxStock', 'reorderPoint',
      'isLotControlled', 'isFEFO', 'strength', 'strengthValue', 'strengthUnit',
      'unitWeightMg', 'isPrimaryPacking', 'confidentialityLevel',
      'tppCode', 'tppName', 'ttmtCode', 'ttmtName', 'gRegNumber',
    ];
    const columnFields = ITEM_COLUMNS.map((c) => c.field);
    for (const f of apiFields) {
      expect(columnFields, `missing import column for API field "${f}"`).toContain(f);
    }
  });

  it('every column has a header, field and a valid kind', () => {
    for (const c of ITEM_COLUMNS) {
      expect(c.header).toBeTruthy();
      expect(c.field).toBeTruthy();
      expect(['text', 'number', 'boolean']).toContain(c.kind);
    }
  });

  it('marks nameTh and primaryUnit as the required fields', () => {
    const required = ITEM_COLUMNS.filter((c) => c.required).map((c) => c.field);
    expect(required).toEqual(['nameTh', 'primaryUnit']);
  });
});

describe('item-import: parseBoolean', () => {
  it.each(['true', 'TRUE', '1', 'yes', 'y', 'ใช่', 't'])('parses "%s" as true', (v) => {
    expect(parseBoolean(v)).toBe(true);
  });
  it.each(['false', '0', 'no', '', 'ไม่', 'maybe'])('parses "%s" as false', (v) => {
    expect(parseBoolean(v)).toBe(false);
  });
});

describe('item-import: parseImportRow', () => {
  it('maps a full row (Thai headers) to a complete payload with correct types', () => {
    const row = {
      'รหัส (Code)*': 'FG-9001',
      'ชื่อ TH (Name TH)*': 'แคปซูลทดสอบ',
      'ชื่อ EN (Name EN)': 'Test Capsule',
      'หมวดหมู่ (Category)': 'finished',
      'หน่วยหลัก (Primary Unit)*': 'bottle',
      'หน่วยรอง (Secondary Unit)': 'cap',
      'อัตราแปลง (Conversion Rate)': 60,
      'หน่วยน้ำหนัก (Weight Unit)': 'mg',
      'อัตราหน่วยรอง→น้ำหนัก (Sec→Weight Rate)': 500,
      'ติดตามน้ำหนัก (Weight Tracking: true/false)': 'false',
      'อายุการเก็บ (วัน)': 730,
      'เงื่อนไขจัดเก็บ': 'เก็บที่ 30C',
      'สต็อกขั้นต่ำ': 100,
      'สต็อกสูงสุด': 5000,
      'จุดสั่งซื้อ': 500,
      'ควบคุมล็อต (Lot Controlled: true/false)': 'true',
      'FEFO (true/false)': 'true',
      'ความแรง (Strength)': '500 mg',
      'ค่าความแรง (Strength Value)': 500,
      'หน่วยความแรง (Strength Unit)': 'mg',
      'น้ำหนักต่อหน่วย mg (Unit Weight mg)': 500,
      'บรรจุภัณฑ์หลัก (Primary Packing: true/false)': 'false',
      'ระดับความลับ (Confidentiality: public/internal/confidential)': 'public',
      'รหัส TPP': 'TPP-1',
      'ชื่อ TPP': 'แคปซูลทดสอบ',
      'รหัส TTMT': 'TTMT-1',
      'ชื่อ TTMT': 'Test herb',
      'เลขทะเบียนยา (G Reg Number)': 'G-123',
    };
    const { ok, payload } = parseImportRow(row, 'finished_goods');
    expect(ok).toBe(true);
    expect(payload).toMatchObject({
      type: 'finished_goods',
      isActive: true,
      code: 'FG-9001',
      nameTh: 'แคปซูลทดสอบ',
      nameEn: 'Test Capsule',
      primaryUnit: 'bottle',
      // numbers coerced to number
      conversionRate: 60,
      secondaryToWeightRate: 500,
      shelfLifeDays: 730,
      minStock: 100,
      strengthValue: 500,
      unitWeightMg: 500,
      // booleans coerced to boolean
      weightTrackingEnabled: false,
      isLotControlled: true,
      isFEFO: true,
      isPrimaryPacking: false,
      // text
      strength: '500 mg',
      confidentialityLevel: 'public',
      gRegNumber: 'G-123',
    });
  });

  it('also accepts camelCase field keys (e.g. exported file)', () => {
    const row = { nameTh: 'ผงทดสอบ', primaryUnit: 'kg', conversionRate: 1000, isLotControlled: 'true' };
    const { ok, payload } = parseImportRow(row, 'raw_material');
    expect(ok).toBe(true);
    expect(payload).toMatchObject({ type: 'raw_material', nameTh: 'ผงทดสอบ', primaryUnit: 'kg', conversionRate: 1000, isLotControlled: true });
  });

  it('skips blank cells (does not emit those fields)', () => {
    const row = { 'ชื่อ TH (Name TH)*': 'A', 'หน่วยหลัก (Primary Unit)*': 'kg', 'ชื่อ EN (Name EN)': '', 'อัตราแปลง (Conversion Rate)': '' };
    const { payload } = parseImportRow(row, 'raw_material');
    expect(payload).not.toHaveProperty('nameEn');
    expect(payload).not.toHaveProperty('conversionRate');
  });

  it('ignores non-numeric values for number columns', () => {
    const row = { 'ชื่อ TH (Name TH)*': 'A', 'หน่วยหลัก (Primary Unit)*': 'kg', 'อัตราแปลง (Conversion Rate)': 'abc' };
    const { payload } = parseImportRow(row, 'raw_material');
    expect(payload).not.toHaveProperty('conversionRate');
  });

  it('rejects a row missing Name(TH)', () => {
    const r = parseImportRow({ 'หน่วยหลัก (Primary Unit)*': 'kg' }, 'raw_material');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('ชื่อ TH');
  });

  it('rejects a row missing Primary Unit', () => {
    const r = parseImportRow({ 'ชื่อ TH (Name TH)*': 'A' }, 'raw_material');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('หน่วยหลัก');
  });

  it('trims whitespace from values', () => {
    const row = { 'ชื่อ TH (Name TH)*': '  ขมิ้น  ', 'หน่วยหลัก (Primary Unit)*': ' kg ' };
    const { payload } = parseImportRow(row, 'raw_material');
    expect(payload?.nameTh).toBe('ขมิ้น');
    expect(payload?.primaryUnit).toBe('kg');
  });
});

describe('item-import: parseImportSheet', () => {
  it('separates valid payloads from row errors', () => {
    const rows = [
      { 'ชื่อ TH (Name TH)*': 'A', 'หน่วยหลัก (Primary Unit)*': 'kg' },
      { 'หน่วยหลัก (Primary Unit)*': 'kg' },                 // missing name -> error
      { 'ชื่อ TH (Name TH)*': 'B', 'หน่วยหลัก (Primary Unit)*': 'box', 'FEFO (true/false)': 'yes' },
    ];
    const { payloads, errors } = parseImportSheet(rows, 'packaging');
    expect(payloads).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].rowIndex).toBe(1);
    expect(payloads[1]).toMatchObject({ type: 'packaging', nameTh: 'B', isFEFO: true });
  });

  it('every item type produces a typed payload', () => {
    for (const tc of ITEM_TYPES_CONFIG) {
      const { payloads } = parseImportSheet(
        [{ 'ชื่อ TH (Name TH)*': `ทดสอบ-${tc.key}`, 'หน่วยหลัก (Primary Unit)*': 'kg' }],
        tc.key,
      );
      expect(payloads).toHaveLength(1);
      expect(payloads[0].type).toBe(tc.key);
    }
  });
});

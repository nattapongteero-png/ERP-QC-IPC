/**
 * Unit tests — Master Data Excel import (the /master-data "นำเข้า Excel" button).
 *
 * Covers the IMPORT_CONFIGS coverage (every master-data hub module that
 * supports flat import has a config) + the pure parseSheetRows logic:
 * required-field validation, enum validation with canonical-case
 * preservation, and number/boolean/text coercion. No DB / no network.
 */
import { describe, it, expect } from 'vitest';
import { IMPORT_CONFIGS, parseSheetRows, type ImportConfig } from '@/lib/master-data/import';

describe('master-data import: config coverage', () => {
  // Every importable master-data module the hub exposes. receipt-checklist-
  // templates is intentionally excluded (needs a nested items[] array, not a
  // flat Excel row).
  const EXPECTED_MODULES = [
    'productionRooms', 'productionEquipment', 'environmentalConditions',
    'sopTemplates', 'packagingQCCriteria', 'ipcCriteria',
    'packagingTolerances', 'receiptTolerances', 'standardWeights',
    'maintenancePlanTemplates', 'itemCodePatterns', 'lotPatterns',
  ];

  it('covers all 12 importable master-data modules (incl. the new ones)', () => {
    expect(Object.keys(IMPORT_CONFIGS).sort()).toEqual([...EXPECTED_MODULES].sort());
  });

  it('every config has label, sheetName, apiUrl, columns and exampleRows', () => {
    for (const [key, cfg] of Object.entries(IMPORT_CONFIGS)) {
      expect(cfg.label, key).toBeTruthy();
      expect(cfg.sheetName, key).toBeTruthy();
      expect(cfg.apiUrl, key).toMatch(/^\/api\/master-data\//);
      expect(cfg.columns.length, key).toBeGreaterThan(0);
      expect(Array.isArray(cfg.exampleRows), key).toBe(true);
    }
  });

  it('each required column has a non-empty value in the first example row', () => {
    for (const [key, cfg] of Object.entries(IMPORT_CONFIGS)) {
      const ex = cfg.exampleRows[0];
      if (!ex) continue;
      for (const col of cfg.columns.filter((c) => c.required)) {
        const v = ex[col.header] ?? ex[col.field];
        expect(v, `${key}.${col.field} example value`).not.toBe(undefined);
        expect(String(v).trim().length, `${key}.${col.field} example value`).toBeGreaterThan(0);
      }
    }
  });

  it('validValues keys reference real columns and are lowercase', () => {
    for (const [key, cfg] of Object.entries(IMPORT_CONFIGS)) {
      for (const [field, values] of Object.entries(cfg.validValues ?? {})) {
        expect(cfg.columns.some((c) => c.field === field), `${key}.${field}`).toBe(true);
        values.forEach((v) => expect(v, `${key}.${field}`).toBe(v.toLowerCase()));
      }
    }
  });

  it('newly-added modules expose the right API endpoints', () => {
    expect(IMPORT_CONFIGS.packagingTolerances.apiUrl).toBe('/api/master-data/packaging-tolerances');
    expect(IMPORT_CONFIGS.receiptTolerances.apiUrl).toBe('/api/master-data/receipt-tolerances');
    expect(IMPORT_CONFIGS.standardWeights.apiUrl).toBe('/api/master-data/standard-weights');
    expect(IMPORT_CONFIGS.maintenancePlanTemplates.apiUrl).toBe('/api/master-data/maintenance-plan-templates');
    expect(IMPORT_CONFIGS.itemCodePatterns.apiUrl).toBe('/api/master-data/item-code-patterns');
    expect(IMPORT_CONFIGS.lotPatterns.apiUrl).toBe('/api/master-data/lot-patterns');
  });
});

describe('master-data import: parseSheetRows', () => {
  it('parses a production-rooms sheet (lowercase enum)', () => {
    const { validRows, errors } = parseSheetRows(
      IMPORT_CONFIGS.productionRooms.exampleRows,
      IMPORT_CONFIGS.productionRooms,
    );
    expect(errors).toEqual([]);
    expect(validRows).toHaveLength(2);
    expect(validRows[0]).toMatchObject({ name: 'Weighing Room 1', nameTh: 'ห้องชั่งยา 1', roomType: 'weighing' });
  });

  it('coerces numbers for packaging-tolerances (tolerancePercent)', () => {
    const { validRows } = parseSheetRows(
      [{ 'หมวดบรรจุภัณฑ์ (Category)*': 'capsule', 'ค่าพิกัด % (Tolerance Percent)*': '5', 'หมายเหตุ (Notes)': 'x' }],
      IMPORT_CONFIGS.packagingTolerances,
    );
    expect(validRows[0]).toMatchObject({ packagingCategory: 'capsule', tolerancePercent: 5, notes: 'x' });
    expect(typeof validRows[0].tolerancePercent).toBe('number');
  });

  it('preserves canonical case for uppercase enums (standard-weights accuracyClass, units)', () => {
    const { validRows, errors } = parseSheetRows(
      IMPORT_CONFIGS.standardWeights.exampleRows,
      IMPORT_CONFIGS.standardWeights,
    );
    expect(errors).toEqual([]);
    // accuracyClass entered as "E2" must stay "E2" (not lowercased to "e2")
    expect(validRows[0].accuracyClass).toBe('E2');
    expect(validRows[0].denominationUnit).toBe('g');
    expect(typeof validRows[0].denominationValue).toBe('number');
  });

  it('coerces booleans for item-code-patterns (includeYear)', () => {
    const { validRows } = parseSheetRows(
      [{ 'ประเภทสินค้า (Item Type)*': 'extract', 'คำนำหน้า (Prefix)*': 'EXT', 'ใส่ปี (Include Year: true/false)': 'true', 'จำนวนหลัก (Padding)': '4' }],
      IMPORT_CONFIGS.itemCodePatterns,
    );
    expect(validRows[0]).toMatchObject({ itemType: 'extract', prefix: 'EXT', includeYear: true, padding: 4 });
    expect(typeof validRows[0].includeYear).toBe('boolean');
    expect(typeof validRows[0].padding).toBe('number');
  });

  it('keeps the dateFormat canonical case for lot-patterns', () => {
    const { validRows, errors } = parseSheetRows(
      IMPORT_CONFIGS.lotPatterns.exampleRows,
      IMPORT_CONFIGS.lotPatterns,
    );
    expect(errors).toEqual([]);
    expect(validRows[0].dateFormat).toBe('YYYYMMDD');
    expect(validRows[0].includeDate).toBe(true);
  });

  it('rejects a row with a missing required field', () => {
    const { validRows, errors } = parseSheetRows(
      [{ 'ค่าพิกัด % (Tolerance Percent)*': '5' }], // missing category
      IMPORT_CONFIGS.packagingTolerances,
    );
    expect(validRows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Category');
  });

  it('rejects an invalid enum value', () => {
    const { validRows, errors } = parseSheetRows(
      [{ 'หมวด (Category)*': 'unknown_cat', 'ค่าพิกัด % (Tolerance Percent)*': '2' }],
      IMPORT_CONFIGS.receiptTolerances,
    );
    expect(validRows).toHaveLength(0);
    expect(errors[0]).toContain('ไม่ถูกต้อง');
  });

  it('every config can parse its own example rows without errors', () => {
    for (const cfg of Object.values(IMPORT_CONFIGS) as ImportConfig[]) {
      const { errors } = parseSheetRows(cfg.exampleRows, cfg);
      expect(errors, cfg.label).toEqual([]);
    }
  });
});

/**
 * Item bulk-import column model + row parsing.
 *
 * Extracted from the /inventory/items page so the import logic (column
 * mapping, type coercion, required-field validation) is pure and testable,
 * and shared by the template download + the import handler.
 */

export type ItemColumnKind = 'text' | 'number' | 'boolean';

export interface ItemImportColumn {
  /** Excel header (Thai label) used in the template + read on import. */
  header: string;
  /** API payload field (camelCase) it maps to. */
  field: string;
  /** Drives import coercion. */
  kind: ItemColumnKind;
  /** Marked with * in the template. */
  required: boolean;
}

export interface ItemTypeConfig {
  key: string;       // item.type
  label: string;     // human label
  sheetName: string; // Excel sheet name
}

export const ITEM_TYPES_CONFIG: ItemTypeConfig[] = [
  { key: 'raw_material', label: 'วัตถุดิบ (Raw Material)', sheetName: 'Raw Material' },
  { key: 'packaging', label: 'บรรจุภัณฑ์ (Packaging)', sheetName: 'Packaging' },
  { key: 'finished_goods', label: 'สินค้าสำเร็จรูป (Finished Goods)', sheetName: 'Finished Goods' },
  { key: 'wip', label: 'งานระหว่างผลิต (WIP)', sheetName: 'WIP' },
  { key: 'consumable', label: 'วัสดุสิ้นเปลือง (Consumable)', sheetName: 'Consumable' },
];

export const ALL_TYPE_KEYS = ITEM_TYPES_CONFIG.map((t) => t.key);

/**
 * Full field set accepted by POST /api/items. Keep in sync with that route.
 */
export const ITEM_COLUMNS: ItemImportColumn[] = [
  { header: 'รหัส (Code)*', field: 'code', kind: 'text', required: false },
  { header: 'ชื่อ TH (Name TH)*', field: 'nameTh', kind: 'text', required: true },
  { header: 'ชื่อ EN (Name EN)', field: 'nameEn', kind: 'text', required: false },
  { header: 'หมวดหมู่ (Category)', field: 'category', kind: 'text', required: false },
  { header: 'หน่วยหลัก (Primary Unit)*', field: 'primaryUnit', kind: 'text', required: true },
  { header: 'หน่วยรอง (Secondary Unit)', field: 'secondaryUnit', kind: 'text', required: false },
  { header: 'อัตราแปลง (Conversion Rate)', field: 'conversionRate', kind: 'number', required: false },
  { header: 'หน่วยน้ำหนัก (Weight Unit)', field: 'weightUnit', kind: 'text', required: false },
  { header: 'อัตราหน่วยรอง→น้ำหนัก (Sec→Weight Rate)', field: 'secondaryToWeightRate', kind: 'number', required: false },
  { header: 'ติดตามน้ำหนัก (Weight Tracking: true/false)', field: 'weightTrackingEnabled', kind: 'boolean', required: false },
  { header: 'อายุการเก็บ (วัน)', field: 'shelfLifeDays', kind: 'number', required: false },
  { header: 'เงื่อนไขจัดเก็บ', field: 'storageCondition', kind: 'text', required: false },
  { header: 'สต็อกขั้นต่ำ', field: 'minStock', kind: 'number', required: false },
  { header: 'สต็อกสูงสุด', field: 'maxStock', kind: 'number', required: false },
  { header: 'จุดสั่งซื้อ', field: 'reorderPoint', kind: 'number', required: false },
  { header: 'ควบคุมล็อต (Lot Controlled: true/false)', field: 'isLotControlled', kind: 'boolean', required: false },
  { header: 'FEFO (true/false)', field: 'isFEFO', kind: 'boolean', required: false },
  { header: 'ความแรง (Strength)', field: 'strength', kind: 'text', required: false },
  { header: 'ค่าความแรง (Strength Value)', field: 'strengthValue', kind: 'number', required: false },
  { header: 'หน่วยความแรง (Strength Unit)', field: 'strengthUnit', kind: 'text', required: false },
  { header: 'น้ำหนักต่อหน่วย mg (Unit Weight mg)', field: 'unitWeightMg', kind: 'number', required: false },
  { header: 'บรรจุภัณฑ์หลัก (Primary Packing: true/false)', field: 'isPrimaryPacking', kind: 'boolean', required: false },
  { header: 'ระดับความลับ (Confidentiality: public/internal/confidential)', field: 'confidentialityLevel', kind: 'text', required: false },
  { header: 'รหัส TPP', field: 'tppCode', kind: 'text', required: false },
  { header: 'ชื่อ TPP', field: 'tppName', kind: 'text', required: false },
  { header: 'รหัส TTMT', field: 'ttmtCode', kind: 'text', required: false },
  { header: 'ชื่อ TTMT', field: 'ttmtName', kind: 'text', required: false },
  { header: 'เลขทะเบียนยา (G Reg Number)', field: 'gRegNumber', kind: 'text', required: false },
];

/** A raw worksheet row: header (or field) -> cell value. */
export type ImportRow = Record<string, string | number | null | undefined>;

export interface ParsedRow {
  ok: boolean;
  /** Ready-to-POST payload (when ok). */
  payload?: Record<string, unknown>;
  /** Reason it was rejected (when !ok). */
  error?: string;
}

/** Coerce a string "true/1/yes/ใช่/t" (case-insensitive) to boolean. */
export function parseBoolean(val: string): boolean {
  return /^(true|1|yes|y|ใช่|t)$/i.test(val);
}

/**
 * Map one sheet row to an API payload for the given item type.
 * - Reads each column by its Thai header OR its camelCase field name.
 * - Coerces number/boolean per column kind; skips blank cells.
 * - Rejects rows missing the required Name(TH) / Primary Unit.
 */
export function parseImportRow(row: ImportRow, typeKey: string): ParsedRow {
  const read = (header: string, field: string): string =>
    String(row[header] ?? row[field] ?? '').trim();

  const nameTh = read('ชื่อ TH (Name TH)*', 'nameTh');
  const primaryUnit = read('หน่วยหลัก (Primary Unit)*', 'primaryUnit');
  if (!nameTh || !primaryUnit) {
    return { ok: false, error: 'ไม่มี ชื่อ TH หรือ หน่วยหลัก' };
  }

  const payload: Record<string, unknown> = { type: typeKey, nameTh, primaryUnit, isActive: true };
  for (const col of ITEM_COLUMNS) {
    if (col.field === 'nameTh' || col.field === 'primaryUnit') continue;
    const val = read(col.header, col.field);
    if (!val) continue;
    if (col.kind === 'number') {
      const num = Number(val);
      if (!isNaN(num)) payload[col.field] = num;
    } else if (col.kind === 'boolean') {
      payload[col.field] = parseBoolean(val);
    } else {
      payload[col.field] = val;
    }
  }
  return { ok: true, payload };
}

/** Parse a whole sheet (array of rows) for a type; returns payloads + per-row errors. */
export function parseImportSheet(
  rows: ImportRow[],
  typeKey: string,
): { payloads: Record<string, unknown>[]; errors: { rowIndex: number; error: string }[] } {
  const payloads: Record<string, unknown>[] = [];
  const errors: { rowIndex: number; error: string }[] = [];
  rows.forEach((row, i) => {
    const r = parseImportRow(row, typeKey);
    if (r.ok && r.payload) payloads.push(r.payload);
    else errors.push({ rowIndex: i, error: r.error || 'invalid row' });
  });
  return { payloads, errors };
}

/**
 * Master-data bulk-import types + pure row parser.
 *
 * Extracted from the /master-data hub page so the import parsing (required-
 * field check, enum validation with canonical-case preservation, number/
 * boolean coercion) is testable and shared with the template builder.
 */

export interface ImportColumn {
  header: string;
  field: string;
  required: boolean;
  /** Import coercion. Omit for the legacy numeric heuristic. */
  kind?: 'text' | 'number' | 'boolean';
  note?: string;
  lookupValues?: { value: string; label: string }[];
}

export interface ImportConfig {
  label: string;
  sheetName: string;
  apiUrl: string;
  columns: ImportColumn[];
  /** field -> allowed (lowercased) values, validated case-insensitively. */
  validValues?: Record<string, string[]>;
  exampleRows: Record<string, string | number>[];
}

export interface ParseResult {
  validRows: Record<string, unknown>[];
  errors: string[];
}

/**
 * Parse the rows of one sheet against its module config into API-ready
 * payloads + human-readable per-row errors. Pure: no DB / no network.
 */
export function parseSheetRows(
  jsonData: Record<string, string | number>[],
  config: ImportConfig,
): ParseResult {
  const validRows: Record<string, unknown>[] = [];
  const errors: string[] = [];

  jsonData.forEach((row, index) => {
    const rowNum = index + 2; // +1 header, +1 to 1-base
    const parsed: Record<string, unknown> = {};
    let hasError = false;

    for (const col of config.columns) {
      const val = row[col.header] ?? row[col.field] ?? '';
      const strVal = String(val).trim();

      if (col.required && !strVal) {
        errors.push(`${config.label} แถว ${rowNum}: ไม่มี ${col.header}`);
        hasError = true;
        break;
      }

      if (strVal) {
        if (config.validValues?.[col.field]) {
          const lower = strVal.toLowerCase();
          if (!config.validValues[col.field].includes(lower)) {
            errors.push(`${config.label} แถว ${rowNum}: ${col.field} "${strVal}" ไม่ถูกต้อง`);
            hasError = true;
            break;
          }
          // Preserve canonical case from lookupValues (e.g. "E1", "YYYYMMDD")
          // so the API enum check passes; fall back to lowercase otherwise.
          const canonical = col.lookupValues?.find((lv) => lv.value.toLowerCase() === lower)?.value;
          parsed[col.field] = canonical ?? lower;
        } else if (col.kind === 'number') {
          const num = Number(strVal);
          if (!isNaN(num)) parsed[col.field] = num;
        } else if (col.kind === 'boolean') {
          parsed[col.field] = /^(true|1|yes|y|ใช่|t)$/i.test(strVal);
        } else if (col.kind === 'text') {
          parsed[col.field] = strVal;
        } else {
          // legacy heuristic for columns without an explicit kind
          const num = Number(strVal);
          parsed[col.field] =
            !isNaN(num) && col.field.match(/Min|Max|Size|Failures|Interval|Value|Percent/) ? num : strVal;
        }
      }
    }

    if (!hasError && Object.keys(parsed).length > 0) {
      validRows.push(parsed);
    }
  });

  return { validRows, errors };
}

// ─── Lookup values + per-module import configs ────────────────────────
export const ROOM_TYPES = [
  { value: 'weighing', label: 'Weighing Room (ห้องชั่งยา)' },
  { value: 'mixing', label: 'Mixing Room (ห้องผสม)' },
  { value: 'packaging', label: 'Packaging Room (ห้องบรรจุ)' },
  { value: 'storage', label: 'Storage Area (พื้นที่จัดเก็บ)' },
  { value: 'preparation', label: 'Preparation Room (ห้องเตรียม)' },
  { value: 'production', label: 'Production Room (ห้องผลิต)' },
];

export const EQUIPMENT_TYPES = [
  { value: 'scale', label: 'Scale (เครื่องชั่ง)' },
  { value: 'mixer', label: 'Mixer (เครื่องผสม)' },
  { value: 'hotplate', label: 'Hotplate (เตาร้อน)' },
  { value: 'container', label: 'Container (ภาชนะ)' },
  { value: 'tool', label: 'Tool (เครื่องมือ)' },
  { value: 'filler', label: 'Filler (เครื่องบรรจุ)' },
];

export const SOP_CATEGORIES = [
  { value: 'line_clearance', label: 'Line Clearance' },
  { value: 'dispensing', label: 'Dispensing' },
  { value: 'preparation', label: 'Preparation' },
  { value: 'milling', label: 'Milling' },
  { value: 'sieving', label: 'Sieving' },
  { value: 'drying', label: 'Drying' },
  { value: 'blending', label: 'Blending' },
  { value: 'mixing', label: 'Mixing' },
  { value: 'heating', label: 'Heating' },
  { value: 'cooling', label: 'Cooling' },
  { value: 'filling', label: 'Filling' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'ipc', label: 'IPC' },
  { value: 'weighing', label: 'Weighing' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' },
];

// ─── Import config per module ─────────────────────────────────────────
// Types + the pure row parser live in @/lib/master-data/import so they can be
// unit-tested. IMPORT_CONFIGS is exported for config-completeness tests.
export const IMPORT_CONFIGS: Record<string, ImportConfig> = {
  productionRooms: {
    label: 'Production Rooms',
    sheetName: 'Production Rooms',
    apiUrl: '/api/master-data/production-rooms',
    columns: [
      { header: 'รหัส (Code)*', field: 'code', required: false, note: 'สร้างอัตโนมัติถ้าไม่กรอก' },
      { header: 'ชื่อ EN (Name)*', field: 'name', required: true },
      { header: 'ชื่อ TH (Name TH)*', field: 'nameTh', required: true },
      { header: 'ประเภท (Room Type)*', field: 'roomType', required: true, lookupValues: ROOM_TYPES },
      { header: 'รายละเอียด (Description)', field: 'description', required: false },
    ],
    validValues: { roomType: ROOM_TYPES.map(r => r.value) },
    exampleRows: [
      { 'รหัส (Code)*': 'ROOM-001', 'ชื่อ EN (Name)*': 'Weighing Room 1', 'ชื่อ TH (Name TH)*': 'ห้องชั่งยา 1', 'ประเภท (Room Type)*': 'weighing', 'รายละเอียด (Description)': 'ห้องชั่งวัตถุดิบ ชั้น 2' },
      { 'รหัส (Code)*': 'ROOM-002', 'ชื่อ EN (Name)*': 'Mixing Room A', 'ชื่อ TH (Name TH)*': 'ห้องผสม A', 'ประเภท (Room Type)*': 'mixing', 'รายละเอียด (Description)': '' },
    ],
  },
  productionEquipment: {
    label: 'Production Equipment',
    sheetName: 'Production Equipment',
    apiUrl: '/api/master-data/production-equipment',
    columns: [
      { header: 'รหัส (Code)*', field: 'code', required: false, note: 'สร้างอัตโนมัติถ้าไม่กรอก' },
      { header: 'ชื่อ EN (Name)*', field: 'name', required: true },
      { header: 'ชื่อ TH (Name TH)*', field: 'nameTh', required: true },
      { header: 'ประเภท (Equipment Type)*', field: 'equipmentType', required: true, lookupValues: EQUIPMENT_TYPES },
      { header: 'ขนาด/ความจุ (Capacity)', field: 'capacity', required: false },
      { header: 'รายละเอียด (Description)', field: 'description', required: false },
    ],
    validValues: { equipmentType: EQUIPMENT_TYPES.map(e => e.value) },
    exampleRows: [
      { 'รหัส (Code)*': 'EQ-001', 'ชื่อ EN (Name)*': 'Digital Scale 200kg', 'ชื่อ TH (Name TH)*': 'เครื่องชั่งดิจิตอล 200kg', 'ประเภท (Equipment Type)*': 'scale', 'ขนาด/ความจุ (Capacity)': '200 kg', 'รายละเอียด (Description)': '' },
      { 'รหัส (Code)*': 'EQ-002', 'ชื่อ EN (Name)*': 'Ribbon Mixer 500L', 'ชื่อ TH (Name TH)*': 'เครื่องผสมริบบอน 500L', 'ประเภท (Equipment Type)*': 'mixer', 'ขนาด/ความจุ (Capacity)': '500 liters', 'รายละเอียด (Description)': '' },
    ],
  },
  environmentalConditions: {
    label: 'Environmental Conditions',
    sheetName: 'Env Conditions',
    apiUrl: '/api/master-data/environmental-conditions',
    columns: [
      { header: 'รหัส (Code)*', field: 'code', required: false, note: 'สร้างอัตโนมัติถ้าไม่กรอก' },
      { header: 'ชื่อ (Name)*', field: 'name', required: true },
      { header: 'อุณหภูมิต่ำสุด °C', field: 'temperatureMin', required: false, note: 'ค่าเริ่มต้น: 20' },
      { header: 'อุณหภูมิสูงสุด °C', field: 'temperatureMax', required: false, note: 'ค่าเริ่มต้น: 30' },
      { header: 'ความชื้นสูงสุด %', field: 'humidityMax', required: false, note: 'ค่าเริ่มต้น: 60' },
      { header: 'ตรวจทุก (นาที)', field: 'monitoringIntervalMinutes', required: false, note: 'ค่าเริ่มต้น: 60' },
      { header: 'หมายเหตุ (Notes)', field: 'notes', required: false },
    ],
    exampleRows: [
      { 'รหัส (Code)*': 'ENV-001', 'ชื่อ (Name)*': 'Standard Room', 'อุณหภูมิต่ำสุด °C': 20, 'อุณหภูมิสูงสุด °C': 30, 'ความชื้นสูงสุด %': 60, 'ตรวจทุก (นาที)': 60, 'หมายเหตุ (Notes)': '' },
      { 'รหัส (Code)*': 'ENV-002', 'ชื่อ (Name)*': 'Controlled Room', 'อุณหภูมิต่ำสุด °C': 22, 'อุณหภูมิสูงสุด °C': 28, 'ความชื้นสูงสุด %': 55, 'ตรวจทุก (นาที)': 30, 'หมายเหตุ (Notes)': 'ห้องควบคุมพิเศษ' },
    ],
  },
  sopTemplates: {
    label: 'SOP Templates',
    sheetName: 'SOP Templates',
    apiUrl: '/api/master-data/sop-templates',
    columns: [
      { header: 'รหัส (Code)*', field: 'code', required: false, note: 'สร้างอัตโนมัติถ้าไม่กรอก' },
      { header: 'ชื่อ EN (Name)', field: 'name', required: false },
      { header: 'ชื่อ TH (Name TH)*', field: 'nameTh', required: true },
      { header: 'หมวด (Category)*', field: 'category', required: true, lookupValues: SOP_CATEGORIES },
      { header: 'คำแนะนำ EN', field: 'instructions', required: false },
      { header: 'คำแนะนำ TH', field: 'instructionsTh', required: false },
    ],
    validValues: { category: SOP_CATEGORIES.map(c => c.value) },
    exampleRows: [
      { 'รหัส (Code)*': 'SOP-001', 'ชื่อ EN (Name)': 'Line Clearance', 'ชื่อ TH (Name TH)*': 'ตรวจสอบสายการผลิต', 'หมวด (Category)*': 'line_clearance', 'คำแนะนำ EN': 'Check production line', 'คำแนะนำ TH': 'ตรวจสอบความสะอาดสายการผลิต' },
    ],
  },
  packagingQCCriteria: {
    label: 'Packaging QC Criteria',
    sheetName: 'Packaging QC',
    apiUrl: '/api/master-data/packaging-qc-criteria',
    columns: [
      { header: 'รหัส (Code)*', field: 'code', required: false, note: 'สร้างอัตโนมัติถ้าไม่กรอก' },
      { header: 'ชื่อ (Name)*', field: 'name', required: true },
      { header: 'น้ำหนักต่ำสุด*', field: 'weightMin', required: true },
      { header: 'น้ำหนักสูงสุด*', field: 'weightMax', required: true },
      { header: 'จำนวนตัวอย่าง', field: 'sampleSize', required: false, note: 'ค่าเริ่มต้น: 20' },
      { header: 'ไม่ผ่านสูงสุด', field: 'maxFailures', required: false, note: 'ค่าเริ่มต้น: 2' },
      { header: 'ตรวจทุก (นาที)', field: 'checkIntervalMinutes', required: false, note: 'ค่าเริ่มต้น: 30' },
    ],
    exampleRows: [
      { 'รหัส (Code)*': 'PKG-001', 'ชื่อ (Name)*': 'Capsule 500mg', 'น้ำหนักต่ำสุด*': 480, 'น้ำหนักสูงสุด*': 520, 'จำนวนตัวอย่าง': 20, 'ไม่ผ่านสูงสุด': 2, 'ตรวจทุก (นาที)': 30 },
    ],
  },
  ipcCriteria: {
    label: 'IPC Criteria',
    sheetName: 'IPC Criteria',
    apiUrl: '/api/master-data/ipc-criteria',
    columns: [
      { header: 'รหัส (Code)*', field: 'code', required: false, note: 'สร้างอัตโนมัติถ้าไม่กรอก' },
      { header: 'ชื่อ EN (Name)*', field: 'name', required: true },
      { header: 'ชื่อ TH', field: 'nameTh', required: false },
      { header: 'วิธีทดสอบ', field: 'testMethod', required: false },
      { header: 'Specification', field: 'specification', required: false, note: 'เช่น 300 ± 5%' },
      { header: 'ค่าต่ำสุด (Min)', field: 'minValue', required: false },
      { header: 'ค่าสูงสุด (Max)', field: 'maxValue', required: false },
      { header: 'หน่วย (Unit)', field: 'unit', required: false },
      { header: 'จำนวนตัวอย่าง', field: 'sampleSize', required: false, note: 'ค่าเริ่มต้น: 5' },
    ],
    exampleRows: [
      { 'รหัส (Code)*': 'IPC-001', 'ชื่อ EN (Name)*': 'Average Weight', 'ชื่อ TH': 'น้ำหนักเฉลี่ย', 'วิธีทดสอบ': 'USP <905>', 'Specification': '300 ± 5%', 'ค่าต่ำสุด (Min)': 285, 'ค่าสูงสุด (Max)': 315, 'หน่วย (Unit)': 'mg', 'จำนวนตัวอย่าง': 10 },
    ],
  },
  packagingTolerances: {
    label: 'Packaging Tolerances',
    sheetName: 'Packaging Tolerances',
    apiUrl: '/api/master-data/packaging-tolerances',
    columns: [
      { header: 'หมวดบรรจุภัณฑ์ (Category)*', field: 'packagingCategory', required: true, lookupValues: [
        { value: 'capsule', label: 'แคปซูล' }, { value: 'bottle', label: 'ขวด' }, { value: 'cap', label: 'ฝา' }, { value: 'label', label: 'ฉลาก' }, { value: 'other', label: 'อื่นๆ' } ] },
      { header: 'ค่าพิกัด % (Tolerance Percent)*', field: 'tolerancePercent', required: true, kind: 'number' },
      { header: 'หมายเหตุ (Notes)', field: 'notes', required: false, kind: 'text' },
    ],
    validValues: { packagingCategory: ['capsule', 'bottle', 'cap', 'label', 'other'] },
    exampleRows: [
      { 'หมวดบรรจุภัณฑ์ (Category)*': 'capsule', 'ค่าพิกัด % (Tolerance Percent)*': 5, 'หมายเหตุ (Notes)': 'พิกัดน้ำหนักแคปซูล' },
      { 'หมวดบรรจุภัณฑ์ (Category)*': 'bottle', 'ค่าพิกัด % (Tolerance Percent)*': 2, 'หมายเหตุ (Notes)': '' },
    ],
  },
  receiptTolerances: {
    label: 'Receipt Tolerances',
    sheetName: 'Receipt Tolerances',
    apiUrl: '/api/master-data/receipt-tolerances',
    columns: [
      { header: 'หมวด (Category)*', field: 'category', required: true, lookupValues: [
        { value: 'raw_material', label: 'วัตถุดิบ' }, { value: 'finished_goods', label: 'สินค้าสำเร็จรูป' } ] },
      { header: 'ค่าพิกัด % (Tolerance Percent)*', field: 'tolerancePercent', required: true, kind: 'number' },
      { header: 'หมายเหตุ (Notes)', field: 'notes', required: false, kind: 'text' },
    ],
    validValues: { category: ['raw_material', 'finished_goods'] },
    exampleRows: [
      { 'หมวด (Category)*': 'raw_material', 'ค่าพิกัด % (Tolerance Percent)*': 3, 'หมายเหตุ (Notes)': 'พิกัดรับเข้าวัตถุดิบ' },
      { 'หมวด (Category)*': 'finished_goods', 'ค่าพิกัด % (Tolerance Percent)*': 1, 'หมายเหตุ (Notes)': '' },
    ],
  },
  standardWeights: {
    label: 'Standard Weights',
    sheetName: 'Standard Weights',
    apiUrl: '/api/master-data/standard-weights',
    columns: [
      { header: 'รหัส (Code)*', field: 'code', required: true, kind: 'text' },
      { header: 'ค่าพิกัด (Denomination Value)*', field: 'denominationValue', required: true, kind: 'number' },
      { header: 'หน่วย (Unit)*', field: 'denominationUnit', required: true, lookupValues: [
        { value: 'g', label: 'กรัม' }, { value: 'kg', label: 'กิโลกรัม' }, { value: 'mg', label: 'มิลลิกรัม' } ] },
      { header: 'ชั้นความแม่นยำ (Accuracy Class)*', field: 'accuracyClass', required: true, lookupValues: [
        { value: 'E1', label: 'E1' }, { value: 'E2', label: 'E2' }, { value: 'F1', label: 'F1' }, { value: 'F2', label: 'F2' }, { value: 'M1', label: 'M1' } ] },
      { header: 'เลขที่ใบรับรอง (Certificate Number)*', field: 'certificateNumber', required: true, kind: 'text' },
      { header: 'ผู้ออกใบรับรอง (Issuer)*', field: 'certificateIssuer', required: true, kind: 'text' },
      { header: 'วันที่ออกใบรับรอง YYYY-MM-DD*', field: 'certificateIssueDate', required: true, kind: 'text' },
      { header: 'วันหมดอายุใบรับรอง YYYY-MM-DD*', field: 'certificateExpiryDate', required: true, kind: 'text' },
      { header: 'แผนกเจ้าของ (Owner Department)', field: 'ownerDepartment', required: false, kind: 'text' },
      { header: 'หมายเหตุ (Notes)', field: 'notes', required: false, kind: 'text' },
    ],
    validValues: { denominationUnit: ['g', 'kg', 'mg'], accuracyClass: ['e1', 'e2', 'f1', 'f2', 'm1'] },
    exampleRows: [
      { 'รหัส (Code)*': 'SW-1G', 'ค่าพิกัด (Denomination Value)*': 1, 'หน่วย (Unit)*': 'g', 'ชั้นความแม่นยำ (Accuracy Class)*': 'E2', 'เลขที่ใบรับรอง (Certificate Number)*': 'CERT-SW-1G-2026', 'ผู้ออกใบรับรอง (Issuer)*': 'สถาบันมาตรวิทยาแห่งชาติ', 'วันที่ออกใบรับรอง YYYY-MM-DD*': '2026-01-05', 'วันหมดอายุใบรับรอง YYYY-MM-DD*': '2027-01-04', 'แผนกเจ้าของ (Owner Department)': 'QC', 'หมายเหตุ (Notes)': 'ลูกตุ้มมาตรฐาน 1 กรัม' },
    ],
  },
  maintenancePlanTemplates: {
    label: 'Maintenance Plan Templates',
    sheetName: 'Maintenance Plans',
    apiUrl: '/api/master-data/maintenance-plan-templates',
    columns: [
      { header: 'ชื่อแผน (Name)*', field: 'name', required: true, kind: 'text' },
      { header: 'รายละเอียด (Description)', field: 'description', required: false, kind: 'text' },
      { header: 'ประเภท (Maintenance Type)*', field: 'maintenanceType', required: true, lookupValues: [
        { value: 'preventive', label: 'บำรุงรักษาเชิงป้องกัน' }, { value: 'calibration', label: 'สอบเทียบ' }, { value: 'inspection', label: 'ตรวจสอบ' }, { value: 'corrective', label: 'แก้ไข' } ] },
      { header: 'หน่วยรอบ (Interval Type)*', field: 'intervalType', required: true, lookupValues: [
        { value: 'days', label: 'วัน' }, { value: 'weeks', label: 'สัปดาห์' }, { value: 'months', label: 'เดือน' }, { value: 'hours', label: 'ชั่วโมง' }, { value: 'units', label: 'ครั้ง/หน่วย' } ] },
      { header: 'ค่ารอบ (Interval Value)*', field: 'intervalValue', required: true, kind: 'number' },
      { header: 'แจ้งเตือนล่วงหน้า (วัน)*', field: 'alertDaysBefore', required: true, kind: 'number' },
    ],
    validValues: {
      maintenanceType: ['preventive', 'calibration', 'inspection', 'corrective'],
      intervalType: ['days', 'weeks', 'months', 'hours', 'units'],
    },
    exampleRows: [
      { 'ชื่อแผน (Name)*': 'สอบเทียบเครื่องชั่งประจำปี', 'รายละเอียด (Description)': 'สอบเทียบเครื่องชั่งทุกตัว', 'ประเภท (Maintenance Type)*': 'calibration', 'หน่วยรอบ (Interval Type)*': 'months', 'ค่ารอบ (Interval Value)*': 12, 'แจ้งเตือนล่วงหน้า (วัน)*': 30 },
      { 'ชื่อแผน (Name)*': 'ตรวจเช็คเครื่องผสมรายเดือน', 'รายละเอียด (Description)': '', 'ประเภท (Maintenance Type)*': 'preventive', 'หน่วยรอบ (Interval Type)*': 'months', 'ค่ารอบ (Interval Value)*': 1, 'แจ้งเตือนล่วงหน้า (วัน)*': 7 },
    ],
  },
  itemCodePatterns: {
    label: 'Item Code Patterns',
    sheetName: 'Item Code Patterns',
    apiUrl: '/api/master-data/item-code-patterns',
    columns: [
      { header: 'ประเภทสินค้า (Item Type)*', field: 'itemType', required: true, lookupValues: [
        { value: 'raw_material', label: 'วัตถุดิบ' }, { value: 'packaging', label: 'บรรจุภัณฑ์' }, { value: 'wip', label: 'WIP' }, { value: 'finished_goods', label: 'สินค้าสำเร็จรูป' }, { value: 'extract', label: 'สารสกัด' }, { value: 'consumable', label: 'วัสดุสิ้นเปลือง' } ] },
      { header: 'คำนำหน้า (Prefix)*', field: 'prefix', required: true, kind: 'text' },
      { header: 'ตัวคั่น (Separator)', field: 'separator', required: false, kind: 'text', note: 'ค่าเริ่มต้น: -' },
      { header: 'จำนวนหลัก (Padding)', field: 'padding', required: false, kind: 'number', note: 'ค่าเริ่มต้น: 4' },
      { header: 'ใส่ปี (Include Year: true/false)', field: 'includeYear', required: false, kind: 'boolean' },
      { header: 'รูปแบบปี (Year Format)', field: 'yearFormat', required: false, lookupValues: [
        { value: 'YY', label: 'YY' }, { value: 'YYYY', label: 'YYYY' }, { value: 'BE-YY', label: 'BE-YY' }, { value: 'BE-YYYY', label: 'BE-YYYY' } ] },
      { header: 'ตำแหน่งปี (Year Position)', field: 'yearPosition', required: false, lookupValues: [
        { value: 'after_prefix', label: 'หลังคำนำหน้า' }, { value: 'before_seq', label: 'ก่อนเลขลำดับ' } ] },
      { header: 'เริ่มลำดับที่ (Sequence Start)', field: 'sequenceStart', required: false, kind: 'number', note: 'ค่าเริ่มต้น: 1' },
      { header: 'หมายเหตุ (Notes)', field: 'notes', required: false, kind: 'text' },
    ],
    validValues: {
      itemType: ['raw_material', 'packaging', 'wip', 'finished_goods', 'extract', 'consumable'],
      yearFormat: ['yy', 'yyyy', 'be-yy', 'be-yyyy'],
      yearPosition: ['after_prefix', 'before_seq'],
    },
    exampleRows: [
      { 'ประเภทสินค้า (Item Type)*': 'raw_material', 'คำนำหน้า (Prefix)*': 'RM', 'ตัวคั่น (Separator)': '-', 'จำนวนหลัก (Padding)': 4, 'ใส่ปี (Include Year: true/false)': 'false', 'รูปแบบปี (Year Format)': 'YYYY', 'ตำแหน่งปี (Year Position)': 'after_prefix', 'เริ่มลำดับที่ (Sequence Start)': 1, 'หมายเหตุ (Notes)': 'รหัสวัตถุดิบ เช่น RM-0001' },
    ],
  },
  lotPatterns: {
    label: 'Lot Patterns',
    sheetName: 'Lot Patterns',
    apiUrl: '/api/master-data/lot-patterns',
    columns: [
      { header: 'ประเภท (Pattern Type)*', field: 'patternType', required: true, lookupValues: [
        { value: 'system', label: 'ระบบสร้าง' }, { value: 'vendor', label: 'ผู้ขาย' } ] },
      { header: 'คำนำหน้า (Prefix)', field: 'prefix', required: false, kind: 'text', note: 'ค่าเริ่มต้น: LOT' },
      { header: 'ตัวคั่น (Separator)', field: 'separator', required: false, kind: 'text', note: 'ค่าเริ่มต้น: -' },
      { header: 'ใส่วันที่ (Include Date: true/false)', field: 'includeDate', required: false, kind: 'boolean' },
      { header: 'รูปแบบวันที่ (Date Format)', field: 'dateFormat', required: false, lookupValues: [
        { value: 'YYYYMMDD', label: 'YYYYMMDD' }, { value: 'YYMMDD', label: 'YYMMDD' }, { value: 'BE-YYMMDD', label: 'BE-YYMMDD' }, { value: 'BE-YYYYMMDD', label: 'BE-YYYYMMDD' }, { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }, { value: 'none', label: 'ไม่ใส่' } ] },
      { header: 'ประเภทลำดับ (Sequence Type)', field: 'sequenceType', required: false, lookupValues: [
        { value: 'random', label: 'สุ่ม' }, { value: 'sequential', label: 'เรียงลำดับ' } ] },
      { header: 'ความยาวลำดับ (Sequence Length)', field: 'sequenceLength', required: false, kind: 'number', note: 'ค่าเริ่มต้น: 3' },
      { header: 'เริ่มลำดับที่ (Sequence Start)', field: 'sequenceStart', required: false, kind: 'number', note: 'ค่าเริ่มต้น: 1' },
      { header: 'Regex Pattern', field: 'regexPattern', required: false, kind: 'text' },
      { header: 'คำอธิบาย TH (Hint TH)', field: 'hintTh', required: false, kind: 'text' },
      { header: 'คำอธิบาย EN (Hint EN)', field: 'hintEn', required: false, kind: 'text' },
      { header: 'หมายเหตุ (Notes)', field: 'notes', required: false, kind: 'text' },
    ],
    validValues: {
      patternType: ['system', 'vendor'],
      dateFormat: ['yyyymmdd', 'yymmdd', 'be-yymmdd', 'be-yyyymmdd', 'yyyy-mm-dd', 'none'],
      sequenceType: ['random', 'sequential'],
    },
    exampleRows: [
      { 'ประเภท (Pattern Type)*': 'system', 'คำนำหน้า (Prefix)': 'LOT', 'ตัวคั่น (Separator)': '-', 'ใส่วันที่ (Include Date: true/false)': 'true', 'รูปแบบวันที่ (Date Format)': 'YYYYMMDD', 'ประเภทลำดับ (Sequence Type)': 'sequential', 'ความยาวลำดับ (Sequence Length)': 3, 'เริ่มลำดับที่ (Sequence Start)': 1, 'Regex Pattern': '', 'คำอธิบาย TH (Hint TH)': 'เลขล็อตระบบ', 'คำอธิบาย EN (Hint EN)': 'System lot number', 'หมายเหตุ (Notes)': '' },
    ],
  },
};

/**
 * IPC Test Catalog — USP / Pharmacopoeia standard test definitions.
 *
 * When the user picks a test name, these defaults populate the form so the
 * operator does not retype standard values for every new criterion. Custom
 * test names skip auto-fill and require manual entry.
 *
 * References: USP <711> Dissolution, USP <905> Uniformity of Dosage Units,
 * USP <701> Disintegration, USP <1216> Tablet Friability, ICH Q9/Q10.
 */

export type CriteriaType = 'numeric' | 'pass_fail' | 'visual' | 'text';

export interface TestNameEntry {
  /** Stable identifier — used as code prefix and dropdown value */
  key: string;
  /** Code prefix used by auto-fill, e.g. "WV" → IPC-WV-001 */
  codePrefix: string;
  /** English label */
  nameEn: string;
  /** Thai label shown to operators */
  nameTh: string;
  /** Test category for grouping in the dropdown */
  category: 'physical' | 'chemical' | 'micro' | 'herbal';
  /** Default unit (empty for non-numeric tests) */
  defaultUnit: string;
  /** Default criteria type */
  defaultCriteriaType: CriteriaType;
  /** Default sample size from USP recommendation */
  defaultSampleSize: number;
  /** Default sample-failure tolerance % per stage */
  defaultTolerancePercent: number;
  /** True if test is critical for batch release */
  defaultCritical: boolean;
  /** Recommended dosage forms */
  dosageForms: string[];
}

export const IPC_TEST_CATALOG: TestNameEntry[] = [
  // ═══════════════════════ PHYSICAL ═══════════════════════
  {
    key: 'weight_variation',
    codePrefix: 'WV',
    nameEn: 'Weight Variation',
    nameTh: 'การทดสอบความแปรผันของน้ำหนัก',
    category: 'physical',
    defaultUnit: 'mg',
    defaultCriteriaType: 'numeric',
    defaultSampleSize: 20,
    defaultTolerancePercent: 5,
    defaultCritical: false,
    dosageForms: ['capsule', 'tablet'],
  },
  {
    key: 'hardness',
    codePrefix: 'HD',
    nameEn: 'Hardness Test',
    nameTh: 'การทดสอบความแข็งของเม็ดยา',
    category: 'physical',
    defaultUnit: 'N',
    defaultCriteriaType: 'numeric',
    defaultSampleSize: 10,
    defaultTolerancePercent: 10,
    defaultCritical: false,
    dosageForms: ['tablet'],
  },
  {
    key: 'friability',
    codePrefix: 'FR',
    nameEn: 'Friability Test',
    nameTh: 'การทดสอบความกร่อนของเม็ดยา',
    category: 'physical',
    defaultUnit: '%',
    defaultCriteriaType: 'numeric',
    defaultSampleSize: 10,
    defaultTolerancePercent: 0,
    defaultCritical: false,
    dosageForms: ['tablet'],
  },
  {
    key: 'thickness',
    codePrefix: 'TH',
    nameEn: 'Thickness & Diameter',
    nameTh: 'การวัดความหนาและเส้นผ่านศูนย์กลาง',
    category: 'physical',
    defaultUnit: 'mm',
    defaultCriteriaType: 'numeric',
    defaultSampleSize: 10,
    defaultTolerancePercent: 5,
    defaultCritical: false,
    dosageForms: ['tablet'],
  },
  {
    key: 'disintegration',
    codePrefix: 'DT',
    nameEn: 'Disintegration Time',
    nameTh: 'การทดสอบการแตกตัว',
    category: 'physical',
    defaultUnit: 'min',
    defaultCriteriaType: 'numeric',
    defaultSampleSize: 6,
    defaultTolerancePercent: 0,
    defaultCritical: true,
    dosageForms: ['capsule', 'tablet'],
  },
  {
    key: 'dissolution',
    codePrefix: 'DS',
    nameEn: 'Dissolution Test (USP <711>)',
    nameTh: 'การทดสอบการละลาย',
    category: 'physical',
    defaultUnit: '%',
    defaultCriteriaType: 'numeric',
    defaultSampleSize: 6,
    defaultTolerancePercent: 0,
    defaultCritical: true,
    dosageForms: ['capsule', 'tablet'],
  },
  {
    key: 'uniformity',
    codePrefix: 'UD',
    nameEn: 'Uniformity of Dosage Units (USP <905>)',
    nameTh: 'การทดสอบความสม่ำเสมอของขนาดยา',
    category: 'physical',
    defaultUnit: '%',
    defaultCriteriaType: 'numeric',
    defaultSampleSize: 10,
    defaultTolerancePercent: 0,
    defaultCritical: true,
    dosageForms: ['capsule', 'tablet'],
  },
  {
    key: 'appearance',
    codePrefix: 'AP',
    nameEn: 'Appearance / Color / Odor',
    nameTh: 'การตรวจสอบลักษณะภายนอก สี และกลิ่น',
    category: 'physical',
    defaultUnit: '',
    defaultCriteriaType: 'visual',
    defaultSampleSize: 5,
    defaultTolerancePercent: 0,
    defaultCritical: false,
    dosageForms: ['capsule', 'tablet', 'liquid', 'cream', 'ointment'],
  },
  {
    key: 'viscosity',
    codePrefix: 'VS',
    nameEn: 'Viscosity',
    nameTh: 'การวัดความหนืด',
    category: 'physical',
    defaultUnit: 'cP',
    defaultCriteriaType: 'numeric',
    defaultSampleSize: 3,
    defaultTolerancePercent: 10,
    defaultCritical: false,
    dosageForms: ['liquid', 'cream', 'ointment'],
  },
  {
    key: 'specific_gravity',
    codePrefix: 'SG',
    nameEn: 'Specific Gravity / Density',
    nameTh: 'การวัดความถ่วงจำเพาะ',
    category: 'physical',
    defaultUnit: 'g/mL',
    defaultCriteriaType: 'numeric',
    defaultSampleSize: 3,
    defaultTolerancePercent: 2,
    defaultCritical: false,
    dosageForms: ['liquid'],
  },
  {
    key: 'homogeneity',
    codePrefix: 'HG',
    nameEn: 'Homogeneity',
    nameTh: 'การตรวจสอบความเป็นเนื้อเดียวกัน',
    category: 'physical',
    defaultUnit: '',
    defaultCriteriaType: 'visual',
    defaultSampleSize: 3,
    defaultTolerancePercent: 0,
    defaultCritical: false,
    dosageForms: ['cream', 'ointment'],
  },

  // ═══════════════════════ CHEMICAL ═══════════════════════
  {
    key: 'ph',
    codePrefix: 'PH',
    nameEn: 'pH Value',
    nameTh: 'การวัดค่าความเป็นกรด-ด่าง',
    category: 'chemical',
    defaultUnit: '',
    defaultCriteriaType: 'numeric',
    defaultSampleSize: 3,
    defaultTolerancePercent: 5,
    defaultCritical: false,
    dosageForms: ['liquid', 'cream', 'ointment'],
  },
  {
    key: 'moisture',
    codePrefix: 'MC',
    nameEn: 'Moisture Content',
    nameTh: 'การทดสอบความชื้น',
    category: 'chemical',
    defaultUnit: '%',
    defaultCriteriaType: 'numeric',
    defaultSampleSize: 3,
    defaultTolerancePercent: 0,
    defaultCritical: false,
    dosageForms: ['capsule', 'powder'],
  },
  {
    key: 'assay',
    codePrefix: 'AS',
    nameEn: 'Assay (Active Content)',
    nameTh: 'การหาปริมาณสารสำคัญ',
    category: 'chemical',
    defaultUnit: '%',
    defaultCriteriaType: 'numeric',
    defaultSampleSize: 3,
    defaultTolerancePercent: 0,
    defaultCritical: true,
    dosageForms: ['capsule', 'tablet', 'liquid'],
  },
  {
    key: 'loss_on_drying',
    codePrefix: 'LD',
    nameEn: 'Loss on Drying',
    nameTh: 'การสูญเสียน้ำหนักเมื่อทำให้แห้ง',
    category: 'chemical',
    defaultUnit: '%',
    defaultCriteriaType: 'numeric',
    defaultSampleSize: 3,
    defaultTolerancePercent: 0,
    defaultCritical: false,
    dosageForms: ['capsule', 'powder', 'tablet'],
  },
  {
    key: 'residue_on_ignition',
    codePrefix: 'RI',
    nameEn: 'Residue on Ignition / Sulphated Ash',
    nameTh: 'ปริมาณเถ้าของกรดซัลฟิวริก',
    category: 'chemical',
    defaultUnit: '%',
    defaultCriteriaType: 'numeric',
    defaultSampleSize: 3,
    defaultTolerancePercent: 0,
    defaultCritical: false,
    dosageForms: ['capsule', 'powder', 'tablet'],
  },
  {
    key: 'heavy_metals',
    codePrefix: 'HM',
    nameEn: 'Heavy Metals',
    nameTh: 'การทดสอบโลหะหนัก',
    category: 'chemical',
    defaultUnit: 'ppm',
    defaultCriteriaType: 'numeric',
    defaultSampleSize: 1,
    defaultTolerancePercent: 0,
    defaultCritical: true,
    dosageForms: ['capsule', 'powder', 'tablet', 'liquid'],
  },

  // ═══════════════════════ MICRO ═══════════════════════
  {
    key: 'tamc',
    codePrefix: 'TC',
    nameEn: 'Total Aerobic Microbial Count (TAMC)',
    nameTh: 'จำนวนจุลินทรีย์รวม',
    category: 'micro',
    defaultUnit: 'cfu/g',
    defaultCriteriaType: 'numeric',
    defaultSampleSize: 1,
    defaultTolerancePercent: 0,
    defaultCritical: true,
    dosageForms: ['capsule', 'powder', 'tablet', 'liquid', 'cream'],
  },
  {
    key: 'tymc',
    codePrefix: 'TY',
    nameEn: 'Total Yeasts & Molds Count (TYMC)',
    nameTh: 'จำนวนยีสต์และรา',
    category: 'micro',
    defaultUnit: 'cfu/g',
    defaultCriteriaType: 'numeric',
    defaultSampleSize: 1,
    defaultTolerancePercent: 0,
    defaultCritical: true,
    dosageForms: ['capsule', 'powder', 'tablet', 'liquid', 'cream'],
  },
  {
    key: 'specified_micro',
    codePrefix: 'SM',
    nameEn: 'Specified Microorganisms (E. coli / Salmonella)',
    nameTh: 'จุลินทรีย์ก่อโรคที่กำหนด',
    category: 'micro',
    defaultUnit: '',
    defaultCriteriaType: 'pass_fail',
    defaultSampleSize: 1,
    defaultTolerancePercent: 0,
    defaultCritical: true,
    dosageForms: ['capsule', 'powder', 'tablet', 'liquid', 'cream'],
  },
  {
    key: 'sterility',
    codePrefix: 'ST',
    nameEn: 'Sterility Test',
    nameTh: 'การทดสอบปลอดเชื้อ',
    category: 'micro',
    defaultUnit: '',
    defaultCriteriaType: 'pass_fail',
    defaultSampleSize: 20,
    defaultTolerancePercent: 0,
    defaultCritical: true,
    dosageForms: ['liquid'],
  },

  // ═══════════════════════ HERBAL-SPECIFIC ═══════════════════════
  {
    key: 'foreign_matter',
    codePrefix: 'FM',
    nameEn: 'Foreign Matter',
    nameTh: 'สิ่งแปลกปลอม',
    category: 'herbal',
    defaultUnit: '%',
    defaultCriteriaType: 'numeric',
    defaultSampleSize: 1,
    defaultTolerancePercent: 0,
    defaultCritical: false,
    dosageForms: ['powder', 'capsule'],
  },
  {
    key: 'extractive_value',
    codePrefix: 'EV',
    nameEn: 'Extractive Value (Water/Alcohol)',
    nameTh: 'ปริมาณสารสกัดได้',
    category: 'herbal',
    defaultUnit: '%',
    defaultCriteriaType: 'numeric',
    defaultSampleSize: 3,
    defaultTolerancePercent: 0,
    defaultCritical: false,
    dosageForms: ['capsule', 'powder', 'liquid'],
  },
  {
    key: 'tlc',
    codePrefix: 'TL',
    nameEn: 'Thin Layer Chromatography (TLC) Identification',
    nameTh: 'การระบุชนิดด้วย TLC',
    category: 'herbal',
    defaultUnit: '',
    defaultCriteriaType: 'pass_fail',
    defaultSampleSize: 1,
    defaultTolerancePercent: 0,
    defaultCritical: false,
    dosageForms: ['capsule', 'powder', 'liquid'],
  },
  {
    key: 'pesticide_residue',
    codePrefix: 'PR',
    nameEn: 'Pesticide Residue',
    nameTh: 'สารตกค้างยาฆ่าแมลง',
    category: 'herbal',
    defaultUnit: 'ppm',
    defaultCriteriaType: 'numeric',
    defaultSampleSize: 1,
    defaultTolerancePercent: 0,
    defaultCritical: true,
    dosageForms: ['capsule', 'powder', 'liquid'],
  },
];

/**
 * Standard unit options for dropdown.
 * Each entry: value used in DB + label shown to operator.
 */
export const UNIT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'mg', label: 'mg — มิลลิกรัม' },
  { value: 'g', label: 'g — กรัม' },
  { value: 'kg', label: 'kg — กิโลกรัม' },
  { value: 'mcg', label: 'mcg — ไมโครกรัม' },
  { value: 'mm', label: 'mm — มิลลิเมตร' },
  { value: 'cm', label: 'cm — เซนติเมตร' },
  { value: 'mL', label: 'mL — มิลลิลิตร' },
  { value: 'L', label: 'L — ลิตร' },
  { value: '%', label: '% — เปอร์เซ็นต์' },
  { value: 'ppm', label: 'ppm — ส่วนในล้านส่วน' },
  { value: 'min', label: 'min — นาที' },
  { value: 'sec', label: 'sec — วินาที' },
  { value: '°C', label: '°C — องศาเซลเซียส' },
  { value: 'N', label: 'N — นิวตัน' },
  { value: 'cP', label: 'cP — เซนติพอยส์' },
  { value: 'g/mL', label: 'g/mL — กรัม/มิลลิลิตร' },
  { value: 'cfu/g', label: 'cfu/g — โคโลนีต่อกรัม' },
  { value: 'cfu/mL', label: 'cfu/mL — โคโลนีต่อมิลลิลิตร' },
  { value: '', label: '— ไม่ระบุหน่วย —' },
];

/**
 * Standard dosage forms for Herbal ERP — covers conventional + Thai herbal.
 */
export const DOSAGE_FORM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'capsule', label: 'Capsule — แคปซูล' },
  { value: 'tablet', label: 'Tablet — เม็ด' },
  { value: 'powder', label: 'Powder — ผง' },
  { value: 'liquid', label: 'Liquid — ของเหลว' },
  { value: 'syrup', label: 'Syrup — ยาน้ำเชื่อม' },
  { value: 'tincture', label: 'Tincture — ยาดอง/สารสกัดแอลกอฮอล์' },
  { value: 'decoction', label: 'Decoction — ยาต้ม' },
  { value: 'cream', label: 'Cream — ครีม' },
  { value: 'ointment', label: 'Ointment — ขี้ผึ้ง' },
  { value: 'balm', label: 'Balm — ยาหม่อง' },
  { value: 'oil', label: 'Oil — น้ำมัน' },
  { value: 'gel', label: 'Gel — เจล' },
  { value: 'lotion', label: 'Lotion — โลชั่น' },
  { value: 'pill', label: 'Pill / Bolus — ลูกกลอน' },
  { value: 'tea_bag', label: 'Tea Bag — ชาชง' },
  { value: 'patch', label: 'Patch — แผ่นแปะ' },
  { value: 'suppository', label: 'Suppository — ยาเหน็บ' },
  { value: 'spray', label: 'Spray — สเปรย์' },
  { value: 'other', label: 'Other — อื่นๆ' },
];

/**
 * Sampling method options used to communicate how operators draw samples.
 */
export const SAMPLING_METHOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'random', label: 'Random — สุ่มทั่วไป (เหมาะกับ batch ที่เป็นเนื้อเดียว)' },
  { value: 'systematic', label: 'Systematic — สุ่มตามช่วงเวลา/ลำดับ (ทุก N units)' },
  { value: 'stratified', label: 'Stratified — สุ่มแบ่งชั้น (ต้น/กลาง/ปลาย batch)' },
  { value: 'square_root', label: '√n + 1 — ตามมาตรฐานเภสัชกรรม' },
];

export const CRITERIA_TYPE_META: Record<CriteriaType, {
  label: string;
  desc: string;
  bgColor: string;
  textColor: string;
}> = {
  numeric: {
    label: 'Numeric',
    desc: 'วัดเป็นตัวเลข เทียบกับ Min/Max',
    bgColor: 'bg-emerald-50 border-emerald-200',
    textColor: 'text-emerald-800',
  },
  pass_fail: {
    label: 'Pass / Fail',
    desc: 'บันทึกผลเป็น ผ่าน หรือ ไม่ผ่าน',
    bgColor: 'bg-blue-50 border-blue-200',
    textColor: 'text-blue-800',
  },
  visual: {
    label: 'Visual',
    desc: 'ตรวจด้วยสายตาตาม checklist',
    bgColor: 'bg-amber-50 border-amber-200',
    textColor: 'text-amber-800',
  },
  text: {
    label: 'Text',
    desc: 'บันทึกเป็นข้อความอิสระ',
    bgColor: 'bg-slate-50 border-slate-200',
    textColor: 'text-slate-800',
  },
};

/**
 * Map legacy 'checkbox' criteriaType to new 'pass_fail' for display.
 * Existing DB rows stored 'checkbox' before this redesign — UI shows them
 * as Pass/Fail but writes back the new value going forward.
 */
export function normalizeCriteriaType(value: string | null | undefined): CriteriaType {
  if (value === 'pass_fail' || value === 'visual' || value === 'text') return value;
  if (value === 'checkbox') return 'pass_fail';
  return 'numeric';
}

export function findTestByName(nameEn: string | null | undefined): TestNameEntry | undefined {
  if (!nameEn) return undefined;
  return IPC_TEST_CATALOG.find((t) => t.nameEn === nameEn);
}

/**
 * Generate a code suggestion based on a test name's prefix and a 3-digit
 * pseudo-random sequence. Caller can override; this is just a starter value.
 */
export function suggestCodeForTest(test: TestNameEntry): string {
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `IPC-${test.codePrefix}-${seq}`;
}

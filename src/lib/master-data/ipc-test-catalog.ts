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

export type CriteriaType =
  | 'numeric' | 'pass_fail' | 'visual' | 'text'
  | 'multi_point' | 'tare' | 'calibration' | 'calculated' | 'custom_multi_field';

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

// ════════════════════ QC STAGE → TEST SCOPE ════════════════════
// Which tests belong to which QC stage. Kept as one table rather than a field
// on each catalog entry so QA can review the whole scope in one place.
//
// ⚠ NOT taken from an existing spec — drafted from GMP practice against the
// catalog above and pending QA sign-off. Units are intentionally NOT scoped by
// stage: the unit follows the test (Hardness → N, Weight → mg) and is already
// auto-filled when a test is picked.

export type QcStage = 'raw_material' | 'ipc' | 'fg_release';

export const STAGE_TEST_KEYS: Record<QcStage, string[]> = {
  // Incoming herbal raw material: identity, purity, contamination.
  raw_material: [
    'appearance', 'moisture', 'loss_on_drying', 'residue_on_ignition',
    'heavy_metals', 'foreign_matter', 'extractive_value', 'tlc',
    'pesticide_residue', 'tamc', 'tymc',
  ],
  // In-process control: what an operator can measure on the line.
  ipc: [
    'weight_variation', 'hardness', 'friability', 'thickness',
    'disintegration', 'uniformity', 'appearance', 'homogeneity',
    'viscosity', 'ph', 'moisture', 'loss_on_drying',
  ],
  // Finished goods release: potency, performance, microbial safety.
  fg_release: [
    'assay', 'dissolution', 'disintegration', 'uniformity', 'appearance',
    'ph', 'viscosity', 'specific_gravity', 'heavy_metals', 'tamc', 'tymc',
    'specified_micro', 'sterility', 'extractive_value', 'tlc',
  ],
};

/** Catalog entries in scope for a stage, in catalog order. */
export function testsForStage(stage: QcStage): TestNameEntry[] {
  const keys = new Set(STAGE_TEST_KEYS[stage] ?? []);
  return IPC_TEST_CATALOG.filter((t) => keys.has(t.key));
}

/**
 * Dosage forms offered for a stage. Raw material has no dosage form yet — it is
 * crude drug — so offering "capsule"/"balm" there would be meaningless.
 */
export function dosageFormOptionsForStage(
  stage: QcStage,
): Array<{ value: string; label: string }> {
  if (stage !== 'raw_material') return DOSAGE_FORM_OPTIONS;
  return DOSAGE_FORM_OPTIONS.filter((o) => o.value === 'powder' || o.value === 'other');
}

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

// ════════════════ DOSAGE FORM → UNIT SCOPE ════════════════
// Most units do not depend on the dosage form at all: hardness is N, pH has no
// unit, assay/LOD/friability are %, heavy metals are ppm, whatever the product
// is. Only three families actually depend on whether the product is measured by
// mass or by volume, and those are the only ones filtered here — over-filtering
// would hide a unit QA legitimately needs.
//
//   · mL / L      volume, meaningless for a tablet or capsule
//   · g/mL        density, only measured on liquids
//   · cfu/g vs cfu/mL   microbial counts follow mass vs volume

export type DosageFormState = 'solid' | 'semi_solid' | 'liquid';

export const DOSAGE_FORM_STATE: Record<string, DosageFormState> = {
  capsule: 'solid', tablet: 'solid', powder: 'solid', pill: 'solid',
  tea_bag: 'solid', patch: 'solid', suppository: 'solid',
  cream: 'semi_solid', ointment: 'semi_solid', balm: 'semi_solid',
  gel: 'semi_solid', lotion: 'semi_solid',
  liquid: 'liquid', syrup: 'liquid', tincture: 'liquid',
  decoction: 'liquid', oil: 'liquid', spray: 'liquid',
  // 'other' is intentionally absent — unknown state means no filtering.
};

/** Units that make no sense for a given physical state. */
const UNITS_EXCLUDED_BY_STATE: Record<DosageFormState, string[]> = {
  solid: ['mL', 'L', 'g/mL', 'cfu/mL'],
  semi_solid: ['cfu/mL'],
  liquid: ['cfu/g'],
};

/** Unit options in scope for a dosage form. Unknown/blank form → all units. */
// ════════════════ TEST → UNIT SCOPE ════════════════
// What a test measures decides its unit far more narrowly than the dosage form
// does: Weight Variation is a mass whatever the product is, Hardness is a
// force, Disintegration is a time. Offering all 19 units for every test makes
// the picker a haystack and lets a criterion be saved with "cfu/g" hardness.
//
// A test that is absent from this map keeps the full list — that is deliberate.
// Custom test names and anything QA adds later must not be silently narrowed.

const UNITS_BY_TEST: Record<string, string[]> = {
  weight_variation: ['mcg', 'mg', 'g', 'kg'],
  hardness: ['N'],
  thickness: ['mm', 'cm'],
  disintegration: ['sec', 'min'],
  viscosity: ['cP'],
  specific_gravity: ['g/mL'],
  // Percentage results — of label claim, of released drug, of weight lost.
  friability: ['%'],
  dissolution: ['%'],
  uniformity: ['%'],
  moisture: ['%'],
  loss_on_drying: ['%'],
  residue_on_ignition: ['%'],
  foreign_matter: ['%'],
  extractive_value: ['%'],
  // Assay is reported as % of claim, or as content per unit.
  assay: ['%', 'mg', 'mcg'],
  // Trace contaminants.
  heavy_metals: ['ppm'],
  pesticide_residue: ['ppm'],
  // Plate counts follow mass or volume; the dosage-form filter picks which.
  tamc: ['cfu/g', 'cfu/mL'],
  tymc: ['cfu/g', 'cfu/mL'],
  // Judged by eye or as pass/fail — a unit would be meaningless.
  appearance: [''],
  homogeneity: [''],
  ph: [''],
  specified_micro: [''],
  sterility: [''],
  tlc: [''],
};

/**
 * Units offered for a test, narrowed further by the product's physical state.
 *
 * Both filters apply: TAMC allows cfu/g and cfu/mL, but on a tablet only cfu/g
 * survives. The blank "no unit" entry is always kept so a unit can be cleared.
 */
export function unitOptionsForTest(
  testKey: string | null | undefined,
  dosageForm: string | null | undefined,
): Array<{ value: string; label: string }> {
  const byForm = unitOptionsForDosageForm(dosageForm);
  const allowed = testKey ? UNITS_BY_TEST[testKey] : undefined;
  if (!allowed) return byForm;
  const scope = new Set(allowed);
  const scoped = byForm.filter((u) => scope.has(u.value));
  // Never return an empty picker: if the state filter removed everything the
  // test allows, fall back to what the product permits.
  if (scoped.length === 0) return byForm;
  return scoped.some((u) => u.value === '')
    ? scoped
    : [...scoped, ...byForm.filter((u) => u.value === '')];
}

/** Test entry for a display name such as "Weight Variation — การทดสอบ…". */
export function testKeyFromName(nameEn: string | null | undefined): string | null {
  if (!nameEn) return null;
  return IPC_TEST_CATALOG.find((t) => t.nameEn === nameEn)?.key ?? null;
}

export function unitOptionsForDosageForm(
  dosageForm: string | null | undefined,
): Array<{ value: string; label: string }> {
  const state = dosageForm ? DOSAGE_FORM_STATE[dosageForm] : undefined;
  if (!state) return UNIT_OPTIONS;
  const excluded = new Set(UNITS_EXCLUDED_BY_STATE[state]);
  return UNIT_OPTIONS.filter((u) => !excluded.has(u.value));
}

/**
 * Microbial counts are reported per gram for solids and per millilitre for
 * liquids. The catalog defaults to cfu/g, so a liquid product would otherwise
 * be auto-filled with the wrong unit.
 */
export function adaptUnitToDosageForm(
  unit: string,
  dosageForm: string | null | undefined,
): string {
  const state = dosageForm ? DOSAGE_FORM_STATE[dosageForm] : undefined;
  if (!state) return unit;
  if (state === 'liquid' && unit === 'cfu/g') return 'cfu/mL';
  if (state !== 'liquid' && unit === 'cfu/mL') return 'cfu/g';
  return unit;
}

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

/**
 * How often each sampling method draws a sample.
 *
 * Two of the four methods are not clock-driven at all: Stratified samples at
 * three points of the batch's progress, and √n + 1 is a sample-*size* rule with
 * a single draw per batch. Offering "every N minutes" there invites a plan that
 * cannot be followed — a 20-minute batch on a 30-minute interval yields one
 * point where the method requires three.
 *
 * The minute presets are drafts from general GMP practice, not from a site SOP.
 * QA should confirm them before this is used to write real criteria.
 */
export interface SamplingCadence {
  /** 'minutes' — operator picks a clock interval. 'per_batch' — no interval applies. */
  mode: 'minutes' | 'per_batch';
  /** Minute presets offered as chips, when mode is 'minutes'. */
  presets: number[];
  /** Fixed sampling points shown in place of chips, when mode is 'per_batch'. */
  points: string[];
}

/** Offered before a method is chosen. */
export const DEFAULT_SAMPLING_CADENCE: SamplingCadence = {
  mode: 'minutes',
  presets: [30, 45, 60],
  points: [],
};

export const SAMPLING_CADENCE: Record<string, SamplingCadence> = {
  // Sampled across the whole batch, so the rhythm is a plain clock interval.
  random: { mode: 'minutes', presets: [30, 60, 120], points: [] },
  // Tied to production order, so it runs tighter than the others.
  systematic: { mode: 'minutes', presets: [15, 30, 60], points: [] },
  // Three points of batch progress — a clock interval cannot express this.
  stratified: {
    mode: 'per_batch',
    presets: [],
    points: ['ต้น batch', 'กลาง batch', 'ปลาย batch'],
  },
  // A sample-size formula with a single draw per batch, not a cadence at all.
  square_root: { mode: 'per_batch', presets: [], points: ['ครั้งเดียวต่อรุ่น'] },
};

export function cadenceForSamplingMethod(
  method: string | null | undefined,
): SamplingCadence {
  return (method && SAMPLING_CADENCE[method]) || DEFAULT_SAMPLING_CADENCE;
}

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
  multi_point: {
    label: 'Multi-Point',
    desc: 'วัดหลายจุดต่อ batch + aggregate (mean / rsd / all-pass)',
    bgColor: 'bg-teal-50 border-teal-200',
    textColor: 'text-teal-800',
  },
  tare: {
    label: 'Tare (น้ำหนักภาชนะ)',
    desc: 'เก็บน้ำหนักภาชนะเปล่า เพื่อ multi_point อื่นมา reference Gross−Tare',
    bgColor: 'bg-cyan-50 border-cyan-200',
    textColor: 'text-cyan-800',
  },
  calibration: {
    label: 'Calibration',
    desc: 'เทียบสอบ instrument กับ standard ก่อนเริ่มผลิต',
    bgColor: 'bg-purple-50 border-purple-200',
    textColor: 'text-purple-800',
  },
  calculated: {
    label: 'Calculated',
    desc: 'คำนวณจาก criteria อื่น (Yield, %LOD ฯลฯ)',
    bgColor: 'bg-indigo-50 border-indigo-200',
    textColor: 'text-indigo-800',
  },
  custom_multi_field: {
    label: 'Custom Multi-Field',
    desc: 'กรอกหลายฟิลด์พร้อมกัน (mix-and-match types)',
    bgColor: 'bg-rose-50 border-rose-200',
    textColor: 'text-rose-800',
  },
};

/**
 * Map legacy 'checkbox' criteriaType to new 'pass_fail' for display.
 * Existing DB rows stored 'checkbox' before this redesign — UI shows them
 * as Pass/Fail but writes back the new value going forward.
 */
export function normalizeCriteriaType(value: string | null | undefined): CriteriaType {
  // Legacy alias: old rows used 'checkbox' before pass_fail was the canonical name.
  if (value === 'checkbox') return 'pass_fail';
  const allowed: CriteriaType[] = [
    'numeric', 'pass_fail', 'visual', 'text',
    'multi_point', 'tare', 'calibration', 'calculated', 'custom_multi_field',
  ];
  if (typeof value === 'string' && (allowed as string[]).includes(value)) {
    return value as CriteriaType;
  }
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

/**
 * Code for a topic that is not in the catalogue.
 *
 * The form has no Code field — the code has always come from the chosen test —
 * so a topic entered by hand had no way to get one, and Create stayed disabled
 * for good. `prefix` lets a caller mark what kind of topic it is (TARE for a
 * tare reference), otherwise CUS for a plain custom topic.
 */
export function suggestCodeForCustom(prefix = 'CUS'): string {
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `IPC-${prefix}-${seq}`;
}

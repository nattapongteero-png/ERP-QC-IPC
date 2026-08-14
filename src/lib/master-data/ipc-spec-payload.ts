/**
 * Per-criteria-type structured payload, stored as JSON in `specification`.
 *
 * Numeric criteria don't use a type payload — their spec lives in
 * specTarget / specTolerancePercent / minValue / maxValue / unit. But they
 * still have shared extras (use context / SOP ref / triggers / derived calcs)
 * which are stored alongside in the same JSON envelope:
 *
 *   { type: 'pass_fail', passDefinition: ..., useContext: [...], triggers: {...} }
 *   { type: 'numeric',   useContext: [...], triggers: {...} }
 *
 * Older rows may have plain text in `specification`. parseSpecPayload
 * silently falls back to a legacy mapping so existing data still renders.
 */

// ─── Shared extras (apply to every criteria type) ──────────────────

export interface SopStepRef {
  sopCode: string;
  sopVersion: string;
  stepNumber: string;
  stepDescription: string;
  link: string;
}

export interface TriggerOption {
  id: string;
  label?: string;
  on: boolean;
}

export interface Triggers {
  time: { on: boolean; every: string };
  quantity: { on: boolean; every: string; unit: string; mode: 'fixed' | 'percent'; percent: string };
  milestone: { on: boolean; options: TriggerOption[] };
  event: { on: boolean; options: TriggerOption[] };
  oncePerBatch: { on: boolean };
}

export interface DerivedCalc {
  id: string;
  label: string;
  formula: string;
  sources: string;
  resultUnit: string;
  triggerWhen: string;
  acceptanceMin: string;
  acceptanceMax: string;
  onFail: 'reject' | 'deviation' | 'note';
  note: string;
}

export interface SharedSpecExtras {
  /**
   * QC stage this criteria belongs to — Raw Material / IPC / FG Release.
   * Lives in the spec JSON envelope rather than its own column: ipc_criteria
   * has no stage column and adding one is a schema change.
   */
  stage: StageValue;
  useContext: string[];
  /**
   * What the sampling interval counts, for methods that count something other
   * than minutes — systematic sampling takes every Nth unit, and only the
   * plant knows whether N is tablets, bottles or pallets. The number itself
   * stays in the checkIntervalMinutes column.
   */
  samplingUnit: string;
  sopStepRef: SopStepRef;
  triggers: Triggers;
  derivedCalcs: DerivedCalc[];
}

export type StageValue = 'raw_material' | 'ipc' | 'fg_release';

export const STAGE_OPTIONS: { value: StageValue; titleEn: string; titleTh: string }[] = [
  { value: 'raw_material', titleEn: 'Raw Material', titleTh: 'วัตถุดิบ' },
  { value: 'ipc', titleEn: 'In Process Control', titleTh: 'ระหว่างผลิต' },
  { value: 'fg_release', titleEn: 'FG Release', titleTh: 'ปล่อยผ่าน' },
];

function parseStage(raw: unknown): StageValue {
  return STAGE_OPTIONS.some((o) => o.value === raw) ? (raw as StageValue) : 'ipc';
}

/** The five "ตรวจสอบเมื่อ" triggers, addressable by key. */
export type TriggerKey = 'time' | 'quantity' | 'milestone' | 'event' | 'oncePerBatch';

export interface UseContextOption {
  value: string;
  label: string;
  /** One line on the chip explaining when this context applies. */
  desc: string;
  /**
   * QC stages this context belongs to. Receiving a raw material and releasing
   * a finished batch are different jobs, and offering all eight everywhere
   * asked the user to filter the list in their head.
   */
  stages: StageValue[];
  /**
   * Triggers that make sense for this context. Selecting the context switches
   * these on and keeps the rest out of the way — it does not forbid them, so a
   * plant with its own procedure can still reach every trigger.
   */
  triggers: TriggerKey[];
  /** Sub-options pre-selected inside the milestone / event trigger. */
  milestoneIds?: string[];
  eventIds?: string[];
}

/**
 * Why this criterion gets measured.
 *
 * Scoped deliberately to the production process and to QC of the product and
 * its raw materials. Equipment-side contexts (cleaning verification,
 * equipment qualification) are not here: they judge a machine, not a batch,
 * and they belong to their own criteria rather than to an IPC spec.
 */
export const USE_CONTEXT_OPTIONS: UseContextOption[] = [
  {
    value: 'incoming_material',
    stages: ['raw_material'],
    label: 'รับวัตถุดิบเข้า',
    desc: 'ตรวจวัตถุดิบก่อนรับเข้าคลัง',
    triggers: ['oncePerBatch'],
  },
  {
    value: 'line_clearance',
    stages: ['ipc'],
    label: 'ก่อนเริ่มผลิต / Line Clearance',
    desc: 'ตรวจความพร้อมก่อนเดินเครื่อง',
    triggers: ['milestone'],
    milestoneIds: ['batch_start'],
  },
  {
    value: 'routine_ipc',
    stages: ['ipc'],
    label: 'ระหว่างผลิต รอบปกติ',
    desc: 'สุ่มตรวจตามรอบตลอดการผลิต',
    triggers: ['time', 'quantity'],
  },
  {
    value: 'lot_change',
    stages: ['raw_material', 'ipc'],
    label: 'หลังเปลี่ยน lot วัตถุดิบ',
    desc: 'ยืนยันคุณภาพหลังสลับล็อต',
    triggers: ['event'],
    eventIds: ['lot_change'],
  },
  {
    value: 'changeover',
    stages: ['ipc'],
    label: 'หลัง changeover / ปรับตั้งเครื่อง',
    desc: 'ตรวจหลังเปลี่ยนรุ่นหรือปรับพารามิเตอร์',
    triggers: ['event'],
    eventIds: ['changeover', 'param'],
  },
  {
    value: 'release',
    stages: ['fg_release'],
    label: 'ก่อนปิดรุ่น / ปล่อยผ่าน',
    desc: 'ตรวจสรุปก่อนปล่อยผลิตภัณฑ์',
    triggers: ['milestone', 'oncePerBatch'],
    milestoneIds: ['batch_end'],
  },
  {
    value: 'validation',
    stages: ['ipc', 'fg_release'],
    label: 'ทวนสอบกระบวนการ (Process Validation)',
    desc: 'เก็บข้อมูลถี่กว่าปกติเพื่อพิสูจน์กระบวนการ',
    triggers: ['time', 'milestone'],
    milestoneIds: ['batch_start', 'batch_mid', 'batch_end'],
  },
  {
    value: 'investigation',
    stages: ['raw_material', 'ipc', 'fg_release'],
    label: 'สอบสวนผลผิดปกติ (OOS)',
    desc: 'ตรวจเพิ่มเมื่อผลหลุดเกณฑ์',
    triggers: ['event'],
  },
];

/**
 * Values written by the previous option list. Kept so a criterion saved before
 * this change still shows a chip instead of silently losing its context.
 */
const LEGACY_USE_CONTEXT: Record<string, string> = {
  routine: 'routine_ipc',
  troubleshoot: 'investigation',
};

/** The contexts that apply to a stage, in list order. */
export function contextOptionsForStage(stage: StageValue): UseContextOption[] {
  return USE_CONTEXT_OPTIONS.filter((o) => o.stages.includes(stage));
}

/** Triggers recommended by the contexts currently selected, as a union. */
export function triggersForContexts(values: string[]): Set<TriggerKey> {
  const out = new Set<TriggerKey>();
  for (const v of values) {
    const opt = USE_CONTEXT_OPTIONS.find((o) => o.value === v);
    opt?.triggers.forEach((t) => out.add(t));
  }
  return out;
}

export const MILESTONE_DEFAULTS: TriggerOption[] = [
  { id: 'batch_start', label: 'เริ่ม batch', on: false },
  { id: 'batch_mid', label: 'กลาง batch', on: false },
  { id: 'batch_end', label: 'ก่อนปิด batch', on: false },
  { id: 'pre_compress', label: 'ก่อน compression', on: false },
  { id: 'post_coat', label: 'หลัง coating', on: false },
];

export const EVENT_DEFAULTS: TriggerOption[] = [
  { id: 'changeover', label: 'หลัง changeover', on: false },
  { id: 'lot_change', label: 'หลังเปลี่ยน lot วัตถุดิบ', on: false },
  { id: 'cleaning', label: 'หลัง equipment cleaning', on: false },
  { id: 'param', label: 'หลัง parameter change', on: false },
  { id: 'maintenance', label: 'หลัง maintenance', on: false },
];

export function defaultSharedExtras(): SharedSpecExtras {
  return {
    stage: 'ipc',
    useContext: [],
    samplingUnit: '',
    sopStepRef: { sopCode: '', sopVersion: '', stepNumber: '', stepDescription: '', link: '' },
    triggers: {
      time: { on: false, every: '' },
      quantity: { on: false, every: '', unit: '', mode: 'fixed', percent: '' },
      milestone: { on: false, options: MILESTONE_DEFAULTS.map((o) => ({ ...o })) },
      event: { on: false, options: EVENT_DEFAULTS.map((o) => ({ ...o })) },
      oncePerBatch: { on: false },
    },
    derivedCalcs: [],
  };
}

export function parseSharedExtras(raw: unknown): SharedSpecExtras {
  const fallback = defaultSharedExtras();
  let obj: Record<string, unknown> | null = null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (isObject(parsed)) obj = parsed;
    } catch {
      return fallback;
    }
  } else if (isObject(raw)) {
    obj = raw;
  }
  if (!obj) return fallback;

  const useContext = Array.isArray(obj.useContext)
    ? [
        ...new Set(
          (obj.useContext as unknown[])
            .filter((x): x is string => typeof x === 'string')
            .map((x) => LEGACY_USE_CONTEXT[x] ?? x)
            .filter((x) => USE_CONTEXT_OPTIONS.some((o) => o.value === x)),
        ),
      ]
    : [];
  const sopStepRefRaw = isObject(obj.sopStepRef) ? obj.sopStepRef : {};
  const sopStepRef: SopStepRef = {
    sopCode: typeof sopStepRefRaw.sopCode === 'string' ? sopStepRefRaw.sopCode : '',
    sopVersion: typeof sopStepRefRaw.sopVersion === 'string' ? sopStepRefRaw.sopVersion : '',
    stepNumber: typeof sopStepRefRaw.stepNumber === 'string' ? sopStepRefRaw.stepNumber : '',
    stepDescription: typeof sopStepRefRaw.stepDescription === 'string' ? sopStepRefRaw.stepDescription : '',
    link: typeof sopStepRefRaw.link === 'string' ? sopStepRefRaw.link : '',
  };
  const triggers = parseTriggers(obj.triggers);
  const derivedCalcs = Array.isArray(obj.derivedCalcs)
    ? (obj.derivedCalcs as unknown[]).filter(isObject).map(parseDerivedCalc)
    : [];

  return {
    stage: parseStage(obj.stage),
    useContext,
    samplingUnit: typeof obj.samplingUnit === 'string' ? obj.samplingUnit : '',
    sopStepRef,
    triggers,
    derivedCalcs,
  };
}

function parseTriggers(raw: unknown): Triggers {
  const fallback = defaultSharedExtras().triggers;
  if (!isObject(raw)) return fallback;
  const t = (k: string) => (isObject(raw[k]) ? (raw[k] as Record<string, unknown>) : {});
  const parseOptions = (input: unknown, defaults: TriggerOption[]): TriggerOption[] => {
    if (!Array.isArray(input)) return defaults.map((o) => ({ ...o }));
    return input
      .filter(isObject)
      .map((o) => ({
        id: typeof o.id === 'string' ? o.id : '',
        label: typeof o.label === 'string' ? o.label : undefined,
        on: o.on === true,
      }))
      .filter((o) => o.id);
  };
  return {
    time: { on: t('time').on === true, every: String(t('time').every ?? '') },
    quantity: {
      on: t('quantity').on === true,
      every: String(t('quantity').every ?? ''),
      unit: String(t('quantity').unit ?? ''),
      mode: t('quantity').mode === 'percent' ? 'percent' : 'fixed',
      percent: String(t('quantity').percent ?? ''),
    },
    milestone: {
      on: t('milestone').on === true,
      options: parseOptions(t('milestone').options, MILESTONE_DEFAULTS),
    },
    event: { on: t('event').on === true, options: parseOptions(t('event').options, EVENT_DEFAULTS) },
    oncePerBatch: { on: t('oncePerBatch').on === true },
  };
}

function parseDerivedCalc(raw: Record<string, unknown>): DerivedCalc {
  const onFail = raw.onFail === 'deviation' || raw.onFail === 'note' ? (raw.onFail as 'deviation' | 'note') : 'reject';
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `dc-${Math.random().toString(36).slice(2, 8)}`,
    label: typeof raw.label === 'string' ? raw.label : '',
    formula: typeof raw.formula === 'string' ? raw.formula : '',
    sources: typeof raw.sources === 'string' ? raw.sources : '',
    resultUnit: typeof raw.resultUnit === 'string' ? raw.resultUnit : '',
    triggerWhen: typeof raw.triggerWhen === 'string' ? raw.triggerWhen : '',
    acceptanceMin: typeof raw.acceptanceMin === 'string' ? raw.acceptanceMin : '',
    acceptanceMax: typeof raw.acceptanceMax === 'string' ? raw.acceptanceMax : '',
    onFail,
    note: typeof raw.note === 'string' ? raw.note : '',
  };
}

export function serializeSpecification(
  typePayload: SpecPayload | null,
  extras: SharedSpecExtras,
  criteriaType: string,
): string | null {
  // Build envelope: type-specific fields ∪ shared extras.
  // Numeric has no type payload, so envelope is just { type: 'numeric', ...extras }.
  // 'ipc' is the default stage, so on its own it is not a reason to write an
  // envelope where there previously was none (specification stays null).
  const hasExtras =
    extras.stage !== 'ipc' ||
    extras.useContext.length > 0 ||
    extras.derivedCalcs.length > 0 ||
    Object.values(extras.triggers).some((v: { on?: boolean }) => v.on === true) ||
    Object.values(extras.sopStepRef).some((v) => typeof v === 'string' && v.trim() !== '');

  if (!typePayload && !hasExtras) return null;

  const envelope: Record<string, unknown> = { type: typePayload?.type ?? criteriaType };
  if (typePayload) {
    Object.assign(envelope, typePayload);
  }
  envelope.stage = extras.stage;
  if (extras.useContext.length > 0) envelope.useContext = extras.useContext;
  if (Object.values(extras.sopStepRef).some((v) => typeof v === 'string' && v.trim() !== '')) {
    envelope.sopStepRef = extras.sopStepRef;
  }
  if (Object.values(extras.triggers).some((v: { on?: boolean }) => v.on === true)) {
    envelope.triggers = extras.triggers;
  }
  if (extras.derivedCalcs.length > 0) envelope.derivedCalcs = extras.derivedCalcs;
  return JSON.stringify(envelope);
}

export interface PassFailPayload {
  type: 'pass_fail';
  passDefinition: string;
  failDefinition: string;
  defaultExpected: 'pass' | 'fail';
}

export interface VisualPayload {
  type: 'visual';
  description: string;
  checklist: string[];
  referenceImage: string;
}

export interface TextPayload {
  type: 'text';
  format: string;
  example: string;
  required: boolean;
}

// Multi-Point Numeric — measures N points per batch, aggregates with a rule.
// `tareSourceCode` is the human-readable code of the linked tare criteria;
// the DB also stores `ipc_criteria.tareSourceCriteriaId` as the FK target for
// efficient lookup. UI keeps the code so it survives criteria-id renumbering.
/**
 * How the operator captures the weights.
 *
 *  · per_unit — one row per unit, so every unit is judged on its own. USP
 *    <905> Weight Variation needs this: the limit is per unit, not on the mean.
 *  · bulk     — weigh N units together and enter one figure; the mean per unit
 *    is derived. Faster on a line, but it cannot see a single bad unit, so it
 *    only suits checks written against an average.
 */
export type TareRecordMode = 'per_unit' | 'bulk';

export interface MultiPointPayload {
  type: 'multi_point';
  /** Defaults to per_unit — the stricter of the two. */
  tareMode: TareRecordMode;
  /**
   * How many empty shells are weighed to establish the tare.
   *
   * Separate from pointCount on purpose: the shells are weighed before
   * filling, so they are not the same units measured afterwards. USP <905>
   * weighs 10 shells against 20 filled capsules.
   */
  tareCount: string;
  /**
   * What the tare step is called on the recording screen — e.g. "น้ำหนัก
   * แคปซูลเปล่า เบอร์ 0". A criterion may weigh shells, lids or trays; the
   * operator needs to be told which, and only the person writing the
   * criterion knows. Blank falls back to a generic wording.
   */
  tareLabel: string;
  /** Filled units measured — the sample the verdict is taken on. */
  pointCount: string;       // e.g. "20"
  pointLabel: string;       // e.g. "หัวตอก" → "หัวตอก 1", "หัวตอก 2"...
  perPointTarget: string;   // numeric target per point
  perPointTolerance: string; // ± %
  aggregateRule: 'all_pass' | 'mean' | 'rsd' | 'min_max';
  aggregateLimit: string;   // computed for mean/min_max; editable for rsd
  tareSourceCode: string;   // code of linked tare criteria; '' if none
}

// Tare reference — operator records once per shift/batch; multi_point criteria
// reference it to auto-subtract: Net = Gross − Tare(mean of latest submitted).
export interface TarePayload {
  type: 'tare';
  referenceLabel: string;   // e.g. "น้ำหนักภาชนะเปล่า"
  referenceUnit: string;    // e.g. "g"
  storeAs: string;          // symbolic name for cross-reference
  acceptanceMin: string;
  acceptanceMax: string;
  expireAfter: 'batch' | 'shift' | 'permanent';
}

// Calibration — verify instrument against a standard before recording.
export interface CalibrationPayload {
  type: 'calibration';
  instrumentName: string;
  instrumentId: string;
  standardValue: string;
  standardUnit: string;
  toleranceType: 'absolute' | 'percent';
  toleranceValue: string;
  lastCalibrationDate: string;
  nextDueDate: string;
  requiresPriorPass: boolean;
}

// Calculated — derived from other criteria via a safe formula.
export interface CalculatedInput {
  id: string;
  name: string;             // variable name in formula, e.g. "gross"
  source: 'this_step' | 'derived' | 'constant';
  criteriaCode: string;     // code of source criteria when source != 'constant'
  constantValue: string;    // numeric constant when source === 'constant'
}

export interface CalculatedPayload {
  type: 'calculated';
  formula: string;          // e.g. "(gross - tare) / batch_size * 100"
  inputs: CalculatedInput[];
  resultUnit: string;
  resultMin: string;
  resultMax: string;
  displayDecimals: string;  // default '2'
}

// Custom Multi-Field — operator fills several typed fields in one record.
export interface CustomField {
  id: string;
  label: string;
  fieldType: 'number' | 'text' | 'select';
  unit: string;
  target: string;
  tolerance: string;        // ± %
  required: boolean;
  note: string;
  options: string;          // comma-separated for select
}

export interface CustomMultiFieldPayload {
  type: 'custom_multi_field';
  fields: CustomField[];
  generalNote: string;
}

export type SpecPayload =
  | PassFailPayload | VisualPayload | TextPayload
  | MultiPointPayload | TarePayload
  | CalibrationPayload | CalculatedPayload | CustomMultiFieldPayload;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

export function parseSpecPayload(
  criteriaType: string,
  raw: unknown,
): SpecPayload | null {
  if (criteriaType === 'numeric' || criteriaType === 'checkbox') return null;
  if (raw === null || raw === undefined || raw === '') {
    return defaultPayload(criteriaType);
  }

  // Try JSON first
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (isObject(parsed) && parsed.type === criteriaType) {
        return validatePayload(parsed) ?? defaultPayload(criteriaType);
      }
    } catch {
      // fall through to legacy text handling
    }
  }
  if (isObject(raw) && raw.type === criteriaType) {
    return validatePayload(raw) ?? defaultPayload(criteriaType);
  }

  // Legacy plain-text fallback — best-effort migration of pre-redesign rows
  const text = typeof raw === 'string' ? raw : '';
  if (criteriaType === 'pass_fail') {
    return { type: 'pass_fail', passDefinition: text, failDefinition: '', defaultExpected: 'pass' };
  }
  if (criteriaType === 'visual') {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    return {
      type: 'visual',
      description: lines[0] ?? '',
      checklist: lines.slice(1).map((l) => l.replace(/^[-•]\s*/, '')),
      referenceImage: '',
    };
  }
  if (criteriaType === 'text') {
    return { type: 'text', format: text, example: '', required: true };
  }
  if (
    criteriaType === 'multi_point' ||
    criteriaType === 'tare' ||
    criteriaType === 'calibration' ||
    criteriaType === 'calculated' ||
    criteriaType === 'custom_multi_field'
  ) {
    return defaultPayload(criteriaType);
  }
  return null;
}

function validatePayload(obj: Record<string, unknown>): SpecPayload | null {
  if (obj.type === 'pass_fail') {
    return {
      type: 'pass_fail',
      passDefinition: typeof obj.passDefinition === 'string' ? obj.passDefinition : '',
      failDefinition: typeof obj.failDefinition === 'string' ? obj.failDefinition : '',
      defaultExpected: obj.defaultExpected === 'fail' ? 'fail' : 'pass',
    };
  }
  if (obj.type === 'visual') {
    return {
      type: 'visual',
      description: typeof obj.description === 'string' ? obj.description : '',
      checklist: Array.isArray(obj.checklist)
        ? obj.checklist.filter((x): x is string => typeof x === 'string')
        : [],
      referenceImage: typeof obj.referenceImage === 'string' ? obj.referenceImage : '',
    };
  }
  if (obj.type === 'text') {
    return {
      type: 'text',
      format: typeof obj.format === 'string' ? obj.format : '',
      example: typeof obj.example === 'string' ? obj.example : '',
      required: obj.required !== false,
    };
  }
  if (obj.type === 'multi_point') {
    const rule = obj.aggregateRule;
    return {
      type: 'multi_point',
      // Records saved before this field existed were all per-unit.
      tareMode: obj.tareMode === 'bulk' ? 'bulk' : 'per_unit',
      tareCount: typeof obj.tareCount === 'string' ? obj.tareCount : String(obj.tareCount ?? '10'),
      tareLabel: typeof obj.tareLabel === 'string' ? obj.tareLabel : '',
      pointCount: typeof obj.pointCount === 'string' ? obj.pointCount : String(obj.pointCount ?? '20'),
      pointLabel: typeof obj.pointLabel === 'string' ? obj.pointLabel : '',
      perPointTarget: typeof obj.perPointTarget === 'string' ? obj.perPointTarget : String(obj.perPointTarget ?? ''),
      perPointTolerance: typeof obj.perPointTolerance === 'string' ? obj.perPointTolerance : String(obj.perPointTolerance ?? ''),
      aggregateRule: rule === 'mean' || rule === 'rsd' || rule === 'min_max' ? rule : 'all_pass',
      aggregateLimit: typeof obj.aggregateLimit === 'string' ? obj.aggregateLimit : String(obj.aggregateLimit ?? ''),
      tareSourceCode: typeof obj.tareSourceCode === 'string' ? obj.tareSourceCode : '',
    };
  }
  if (obj.type === 'tare') {
    const exp = obj.expireAfter;
    return {
      type: 'tare',
      referenceLabel: typeof obj.referenceLabel === 'string' ? obj.referenceLabel : '',
      referenceUnit: typeof obj.referenceUnit === 'string' ? obj.referenceUnit : '',
      storeAs: typeof obj.storeAs === 'string' ? obj.storeAs : '',
      acceptanceMin: typeof obj.acceptanceMin === 'string' ? obj.acceptanceMin : '',
      acceptanceMax: typeof obj.acceptanceMax === 'string' ? obj.acceptanceMax : '',
      expireAfter: exp === 'shift' || exp === 'permanent' ? exp : 'batch',
    };
  }
  if (obj.type === 'calibration') {
    const tt = obj.toleranceType === 'percent' ? 'percent' : 'absolute';
    return {
      type: 'calibration',
      instrumentName: typeof obj.instrumentName === 'string' ? obj.instrumentName : '',
      instrumentId: typeof obj.instrumentId === 'string' ? obj.instrumentId : '',
      standardValue: typeof obj.standardValue === 'string' ? obj.standardValue : String(obj.standardValue ?? ''),
      standardUnit: typeof obj.standardUnit === 'string' ? obj.standardUnit : '',
      toleranceType: tt,
      toleranceValue: typeof obj.toleranceValue === 'string' ? obj.toleranceValue : String(obj.toleranceValue ?? ''),
      lastCalibrationDate: typeof obj.lastCalibrationDate === 'string' ? obj.lastCalibrationDate : '',
      nextDueDate: typeof obj.nextDueDate === 'string' ? obj.nextDueDate : '',
      requiresPriorPass: obj.requiresPriorPass === true,
    };
  }
  if (obj.type === 'calculated') {
    return {
      type: 'calculated',
      formula: typeof obj.formula === 'string' ? obj.formula : '',
      inputs: Array.isArray(obj.inputs)
        ? (obj.inputs as unknown[]).filter(isObject).map(parseCalculatedInput)
        : [],
      resultUnit: typeof obj.resultUnit === 'string' ? obj.resultUnit : '',
      resultMin: typeof obj.resultMin === 'string' ? obj.resultMin : '',
      resultMax: typeof obj.resultMax === 'string' ? obj.resultMax : '',
      displayDecimals: typeof obj.displayDecimals === 'string' ? obj.displayDecimals : String(obj.displayDecimals ?? '2'),
    };
  }
  if (obj.type === 'custom_multi_field') {
    return {
      type: 'custom_multi_field',
      fields: Array.isArray(obj.fields)
        ? (obj.fields as unknown[]).filter(isObject).map(parseCustomField)
        : [],
      generalNote: typeof obj.generalNote === 'string' ? obj.generalNote : '',
    };
  }
  return null;
}

function parseCalculatedInput(raw: Record<string, unknown>): CalculatedInput {
  const src = raw.source === 'this_step' || raw.source === 'constant' ? raw.source : 'derived';
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `inp-${Math.random().toString(36).slice(2, 8)}`,
    name: typeof raw.name === 'string' ? raw.name : '',
    source: src,
    criteriaCode: typeof raw.criteriaCode === 'string' ? raw.criteriaCode : '',
    constantValue: typeof raw.constantValue === 'string' ? raw.constantValue : '',
  };
}

function parseCustomField(raw: Record<string, unknown>): CustomField {
  const ft = raw.fieldType === 'text' || raw.fieldType === 'select' ? raw.fieldType : 'number';
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `f-${Math.random().toString(36).slice(2, 8)}`,
    label: typeof raw.label === 'string' ? raw.label : '',
    fieldType: ft,
    unit: typeof raw.unit === 'string' ? raw.unit : '',
    target: typeof raw.target === 'string' ? raw.target : '',
    tolerance: typeof raw.tolerance === 'string' ? raw.tolerance : '',
    required: raw.required !== false,
    note: typeof raw.note === 'string' ? raw.note : '',
    options: typeof raw.options === 'string' ? raw.options : '',
  };
}

export function defaultPayload(criteriaType: string): SpecPayload | null {
  if (criteriaType === 'pass_fail') {
    return { type: 'pass_fail', passDefinition: '', failDefinition: '', defaultExpected: 'pass' };
  }
  if (criteriaType === 'visual') {
    return { type: 'visual', description: '', checklist: [], referenceImage: '' };
  }
  if (criteriaType === 'text') {
    return { type: 'text', format: '', example: '', required: true };
  }
  if (criteriaType === 'multi_point') {
    return {
      type: 'multi_point',
      tareMode: 'per_unit',
      tareCount: '10',
      tareLabel: '',
      pointCount: '20', pointLabel: 'จุด', perPointTarget: '', perPointTolerance: '',
      aggregateRule: 'all_pass', aggregateLimit: '', tareSourceCode: '',
    };
  }
  if (criteriaType === 'tare') {
    return {
      type: 'tare',
      referenceLabel: 'น้ำหนักภาชนะเปล่า', referenceUnit: 'g', storeAs: '',
      acceptanceMin: '', acceptanceMax: '', expireAfter: 'batch',
    };
  }
  if (criteriaType === 'calibration') {
    return {
      type: 'calibration',
      instrumentName: '', instrumentId: '', standardValue: '', standardUnit: '',
      toleranceType: 'percent', toleranceValue: '', lastCalibrationDate: '',
      nextDueDate: '', requiresPriorPass: true,
    };
  }
  if (criteriaType === 'calculated') {
    return {
      type: 'calculated',
      formula: '', inputs: [], resultUnit: '', resultMin: '', resultMax: '',
      displayDecimals: '2',
    };
  }
  if (criteriaType === 'custom_multi_field') {
    return {
      type: 'custom_multi_field',
      fields: [], generalNote: '',
    };
  }
  return null;
}

export function serializeSpecPayload(payload: SpecPayload | null): string | null {
  if (!payload) return null;
  return JSON.stringify(payload);
}

// ---------------------------------------------------------------------------
// Human-readable summary
// ---------------------------------------------------------------------------
//
// `specification` is stored as a JSON envelope. Rendering it raw to operators
// shows JSON, which is unreadable. `formatSpecSummary()` parses the envelope
// and returns a small set of lines suitable for inline display (BOM config
// row, SOP step chips, QC entry, deviation messages).

export interface SpecSummaryLine {
  icon: string;
  text: string;
  tone?: 'pass' | 'fail' | 'meta';
}

const TYPE_LABEL_TH: Record<string, string> = {
  numeric: 'Numeric',
  pass_fail: 'Pass/Fail',
  visual: 'Visual',
  text: 'Text',
  multi_point: 'Multi-point',
  tare: 'Tare',
  calibration: 'Calibration',
  calculated: 'Calculated',
  custom_multi_field: 'Multi-field',
};

function describeTriggers(triggers: Triggers): string {
  const parts: string[] = [];
  if (triggers.milestone.on) {
    const labels = triggers.milestone.options
      .filter((o) => o.on)
      .map((o) => o.label || o.id);
    if (labels.length) parts.push(labels.join(', '));
  }
  if (triggers.event.on) {
    const labels = triggers.event.options.filter((o) => o.on).map((o) => o.label || o.id);
    if (labels.length) parts.push(labels.join(', '));
  }
  if (triggers.time.on && triggers.time.every) {
    parts.push(`ทุก ${triggers.time.every} นาที`);
  }
  if (triggers.quantity.on && triggers.quantity.every) {
    const unit = triggers.quantity.unit || '';
    parts.push(`ทุก ${triggers.quantity.every} ${unit}`.trim());
  }
  if (triggers.oncePerBatch.on) parts.push('ครั้งเดียว/batch');
  return parts.join(' • ');
}

export function formatSpecSummary(args: {
  criteriaType: string;
  specification: string | null | undefined;
  sampleSize?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
  unit?: string | null;
}): SpecSummaryLine[] {
  const { criteriaType, specification, sampleSize, minValue, maxValue, unit } = args;
  const lines: SpecSummaryLine[] = [];

  let payload: SpecPayload | null = null;
  let extras: SharedSpecExtras = defaultSharedExtras();
  let plainText: string | null = null;

  if (specification && typeof specification === 'string') {
    const trimmed = specification.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        payload = parseSpecPayload(criteriaType, parsed);
        extras = parseSharedExtras(parsed);
      } catch {
        plainText = trimmed;
      }
    } else {
      plainText = trimmed;
    }
  }

  if (payload?.type === 'pass_fail') {
    if (payload.passDefinition) lines.push({ icon: '✓', text: `Pass: ${payload.passDefinition}`, tone: 'pass' });
    if (payload.failDefinition) lines.push({ icon: '✗', text: `Fail: ${payload.failDefinition}`, tone: 'fail' });
  } else if (payload?.type === 'visual') {
    if (payload.description) lines.push({ icon: '👁', text: payload.description });
    if (payload.checklist.length) lines.push({ icon: '☑', text: `${payload.checklist.length} จุดตรวจ`, tone: 'meta' });
  } else if (payload?.type === 'text') {
    if (payload.format) lines.push({ icon: '✎', text: `รูปแบบ: ${payload.format}` });
    if (payload.example) lines.push({ icon: '·', text: `ตัวอย่าง: ${payload.example}`, tone: 'meta' });
  } else if (payload?.type === 'multi_point') {
    const tgt = payload.perPointTarget || '-';
    const tol = payload.perPointTolerance ? `±${payload.perPointTolerance}%` : '';
    lines.push({ icon: '⊞', text: `${payload.pointCount || '?'} ${payload.pointLabel || 'จุด'} × ${tgt} ${tol}`.trim() });
    lines.push({ icon: '∑', text: `รวมผล: ${payload.aggregateRule}${payload.aggregateLimit ? ` (${payload.aggregateLimit})` : ''}`, tone: 'meta' });
    if (payload.tareSourceCode) lines.push({ icon: '⤴', text: `อ้างอิง tare: ${payload.tareSourceCode}`, tone: 'meta' });
  } else if (payload?.type === 'tare') {
    lines.push({ icon: '⚖', text: `${payload.referenceLabel || 'tare'} (${payload.referenceUnit || '-'})` });
    if (payload.acceptanceMin || payload.acceptanceMax) {
      lines.push({ icon: '·', text: `ช่วง ${payload.acceptanceMin || '-'} ถึง ${payload.acceptanceMax || '-'}`, tone: 'meta' });
    }
    lines.push({ icon: '⏳', text: `หมดอายุ: ${payload.expireAfter}`, tone: 'meta' });
  } else if (payload?.type === 'calibration') {
    const tol = payload.toleranceValue
      ? `±${payload.toleranceValue}${payload.toleranceType === 'percent' ? '%' : ''}`
      : '';
    lines.push({ icon: '🛠', text: `${payload.instrumentName || 'instrument'} = ${payload.standardValue || '-'} ${payload.standardUnit || ''} ${tol}`.trim() });
    if (payload.nextDueDate) lines.push({ icon: '📅', text: `due: ${payload.nextDueDate}`, tone: 'meta' });
  } else if (payload?.type === 'calculated') {
    if (payload.formula) lines.push({ icon: 'ƒ', text: payload.formula });
    if (payload.resultMin || payload.resultMax) {
      lines.push({ icon: '·', text: `ช่วงผล: ${payload.resultMin || '-'} ถึง ${payload.resultMax || '-'} ${payload.resultUnit || ''}`.trim(), tone: 'meta' });
    }
  } else if (payload?.type === 'custom_multi_field') {
    const labels = payload.fields.map((f) => f.label).filter(Boolean);
    lines.push({ icon: '☰', text: labels.length ? `${labels.length} ฟิลด์: ${labels.join(', ')}` : 'ไม่มีฟิลด์' });
  } else if (criteriaType === 'numeric') {
    if (minValue != null && maxValue != null) {
      lines.push({ icon: '⟷', text: `ช่วง ${minValue}–${maxValue} ${unit || ''}`.trim() });
    } else if (plainText) {
      lines.push({ icon: '·', text: plainText });
    }
  } else if (plainText) {
    lines.push({ icon: '·', text: plainText });
  }

  const trigText = describeTriggers(extras.triggers);
  if (trigText) lines.push({ icon: '⏱', text: trigText, tone: 'meta' });

  if (sampleSize != null) {
    lines.push({ icon: '#', text: `${sampleSize} ตัวอย่าง`, tone: 'meta' });
  }

  if (lines.length === 0) {
    lines.push({ icon: '·', text: TYPE_LABEL_TH[criteriaType] || criteriaType, tone: 'meta' });
  }

  return lines;
}

export function getCriteriaTypeLabel(criteriaType: string): string {
  return TYPE_LABEL_TH[criteriaType] || criteriaType;
}

/**
 * One-line, human-readable spec summary for INLINE labels (dropdown options,
 * chips, single-line cells) where the multi-line `formatSpecSummary` doesn't
 * fit. NEVER returns raw JSON: if `specification` is a JSON envelope it is
 * parsed and condensed; an unparned blob is suppressed entirely so operators
 * never see `{"type":"visual",...}`.
 *
 * @returns a short plain string (no leading separator), or '' when there is
 *          nothing meaningful to show.
 */
export function formatSpecInline(args: {
  criteriaType?: string | null;
  specification: string | null | undefined;
  minValue?: number | null;
  maxValue?: number | null;
  unit?: string | null;
  maxLen?: number;
}): string {
  const { criteriaType, specification, minValue, maxValue, unit, maxLen = 80 } = args;

  // Guard: a raw JSON blob must never reach the UI as-is.
  const rawIsJson =
    typeof specification === 'string' && specification.trim().startsWith('{');

  const lines = formatSpecSummary({
    criteriaType: criteriaType || 'numeric',
    specification,
    minValue,
    maxValue,
    unit,
  });

  // Keep only the substantive lines (drop pure meta like "5 ตัวอย่าง" / type label).
  const primary = lines.filter((l) => l.tone !== 'meta').map((l) => l.text);
  let text = primary.join(' • ').trim();

  // If summary produced nothing useful and the source was raw JSON, show the
  // readable type label instead of the JSON — better an honest "Visual" than a blob.
  if (!text) {
    if (rawIsJson) return getCriteriaTypeLabel(criteriaType || 'numeric');
    text = lines.map((l) => l.text).join(' • ').trim();
  }

  if (text.length > maxLen) text = text.slice(0, maxLen - 1).trimEnd() + '…';
  return text;
}

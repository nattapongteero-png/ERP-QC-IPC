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
  useContext: string[];
  sopStepRef: SopStepRef;
  triggers: Triggers;
  derivedCalcs: DerivedCalc[];
}

export const USE_CONTEXT_OPTIONS: { value: string; label: string }[] = [
  { value: 'routine', label: 'Routine (รอบปกติ)' },
  { value: 'release', label: 'Release (ก่อนปล่อยสินค้า)' },
  { value: 'validation', label: 'Validation' },
  { value: 'troubleshoot', label: 'Troubleshoot' },
  { value: 'changeover', label: 'Changeover' },
  { value: 'cleaning_verify', label: 'Cleaning Verification' },
  { value: 'equipment_qual', label: 'Equipment Qualification' },
];

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
    useContext: [],
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
    ? (obj.useContext as unknown[]).filter((x): x is string => typeof x === 'string')
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

  return { useContext, sopStepRef, triggers, derivedCalcs };
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
  const hasExtras =
    extras.useContext.length > 0 ||
    extras.derivedCalcs.length > 0 ||
    Object.values(extras.triggers).some((v: { on?: boolean }) => v.on === true) ||
    Object.values(extras.sopStepRef).some((v) => typeof v === 'string' && v.trim() !== '');

  if (!typePayload && !hasExtras) return null;

  const envelope: Record<string, unknown> = { type: typePayload?.type ?? criteriaType };
  if (typePayload) {
    Object.assign(envelope, typePayload);
  }
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
export interface MultiPointPayload {
  type: 'multi_point';
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

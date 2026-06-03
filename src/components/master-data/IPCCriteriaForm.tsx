'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ResponsivePageHeader } from '@/components/shared';
import { SearchableSelect, type SearchableSelectOption } from '@/components/master-data/SearchableSelect';
import { FlaskConical, Shield, Eye, FileText, Layers, Dice5, Plus, Trash2, AlertTriangle, Sparkles, ArrowDown, Clock, Package, Target, Zap, RotateCcw, Calculator, BookOpen, X } from 'lucide-react';
import { calculateMinMax, validateSpecInputs } from '@/lib/utils/ipc-criteria-calc';
import { cn } from '@/lib/utils/cn';
import {
  IPC_TEST_CATALOG,
  UNIT_OPTIONS,
  DOSAGE_FORM_OPTIONS,
  SAMPLING_METHOD_OPTIONS,
  CRITERIA_TYPE_META,
  normalizeCriteriaType,
  findTestByName,
  suggestCodeForTest,
  type CriteriaType,
} from '@/lib/master-data/ipc-test-catalog';
import {
  parseAcceptanceStages,
  calcStageAcceptance,
  totalStageSamples,
  emptyStage,
  USP_DISSOLUTION_PLAN,
  USP_UNIFORMITY_PLAN,
  type AcceptanceStage,
} from '@/lib/master-data/ipc-stages';
import {
  parseSpecPayload,
  defaultPayload,
  parseSharedExtras,
  serializeSpecification,
  USE_CONTEXT_OPTIONS,
  type SpecPayload,
  type PassFailPayload,
  type VisualPayload,
  type TextPayload,
  type MultiPointPayload,
  type TarePayload,
  type CalibrationPayload,
  type CalculatedPayload,
  type CalculatedInput,
  type CustomMultiFieldPayload,
  type CustomField,
  type SharedSpecExtras,
  type SopStepRef,
  type Triggers,
  type DerivedCalc,
} from '@/lib/master-data/ipc-spec-payload';

// ────────────────────────────────────────────────────────────────────
// Style constants — mirror the prototype's CSS classes via Tailwind
// so the form looks identical to https://oommiemie.github.io/ipc-criteria-prototype/.
// ────────────────────────────────────────────────────────────────────
const FIELD_INPUT =
  'w-full px-3 py-2.5 border border-slate-200 rounded-[10px] bg-white text-sm text-slate-900 transition outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15';
const FIELD_LABEL = 'block text-[13px] font-semibold text-slate-700 mb-1.5';
const FIELD_HELPER = 'text-xs text-slate-500 mt-1.5';
const PANEL = 'bg-white border border-slate-200 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04),_0_8px_24px_rgba(15,23,42,0.04)]';
const SUB_PANEL = 'bg-emerald-50 border border-emerald-200 rounded-[14px]';
const CHIP_GREEN = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[12px] font-medium';
const SECTION_BADGE = 'w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0';

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────
interface IPCCriteria {
  id: number;
  code: string;
  name: string;
  nameTh: string | null;
  testMethod: string | null;
  specification: string | null;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
  sampleSize: number;
  checkIntervalMinutes: number;
  isCritical: boolean;
  isActive: boolean;
  dosageForm: string | null;
  criteriaType: string;
  tolerancePercent: number;
  specTarget: number | null;
  specTolerancePercent: number;
  acceptanceStages: string | AcceptanceStage[] | null;
  // FDA OOS 2006 / PIC/S retest budget. 0 = deviation immediately on round 1 fail.
  // Critical criteria force this to 0 at runtime.
  maxRetestRounds: number;
  // Multi-Point criteria reference a Tare criteria via this FK (id of another
  // ipc_criteria row with criteriaType='tare'). Persisted alongside the
  // tareSourceCode in spec payload to survive criteria-code renames.
  tareSourceCriteriaId: number | null;
}

interface Props {
  mode: 'create' | 'edit';
  id?: number;
}

function normalizeRecord(raw: IPCCriteria | undefined): IPCCriteria | undefined {
  if (!raw) return raw;
  const toNum = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    ...raw,
    minValue: toNum(raw.minValue),
    maxValue: toNum(raw.maxValue),
    tolerancePercent: toNum(raw.tolerancePercent) ?? 0,
    specTarget: toNum(raw.specTarget),
    specTolerancePercent: toNum(raw.specTolerancePercent) ?? 0,
    maxRetestRounds: toNum(raw.maxRetestRounds) ?? 1,
    tareSourceCriteriaId: toNum(raw.tareSourceCriteriaId),
    isCritical: !!raw.isCritical,
    isActive: raw.isActive !== false,
    criteriaType: normalizeCriteriaType(raw.criteriaType),
  };
}

// ────────────────────────────────────────────────────────────────────
// Outer wrapper — fetches existing record in edit mode
// ────────────────────────────────────────────────────────────────────
export function IPCCriteriaForm({ mode, id }: Props) {
  const { data: existing, isLoading } = useQuery<IPCCriteria>({
    queryKey: ['ipc-criteria', id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/ipc-criteria?id=${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    enabled: mode === 'edit' && !!id,
  });

  if (mode === 'edit' && (isLoading || !existing)) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading...</div></div>;
  }

  const normalized = normalizeRecord(existing);
  const initialData: Partial<IPCCriteria> = normalized || {
    code: '', name: '', nameTh: '', testMethod: '', specification: '',
    minValue: null, maxValue: null, unit: '', sampleSize: 5,
    checkIntervalMinutes: 30, isCritical: false, isActive: true,
    dosageForm: null, criteriaType: 'numeric', tolerancePercent: 0,
    specTarget: null, specTolerancePercent: 0, acceptanceStages: null,
    maxRetestRounds: 1, tareSourceCriteriaId: null,
  };

  return <IPCCriteriaFormInner key={id || 'new'} mode={mode} id={id} initialData={initialData} />;
}

// ────────────────────────────────────────────────────────────────────
// Inner form
// ────────────────────────────────────────────────────────────────────
function IPCCriteriaFormInner({ mode, id, initialData }: Props & { initialData: Partial<IPCCriteria> }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [formData, setFormData] = React.useState<Partial<IPCCriteria>>(initialData);
  const [stages, setStages] = React.useState<AcceptanceStage[]>(() =>
    parseAcceptanceStages(initialData.acceptanceStages)
  );
  const [multiStageEnabled, setMultiStageEnabled] = React.useState<boolean>(() =>
    parseAcceptanceStages(initialData.acceptanceStages).length > 0
  );

  // Per-criteria-type structured payloads (pass_fail, visual, text).
  // Numeric uses target/tolerance fields directly.
  const [specPayload, setSpecPayload] = React.useState<SpecPayload | null>(() =>
    parseSpecPayload(initialData.criteriaType ?? 'numeric', initialData.specification)
  );
  // Shared extras (apply regardless of criteria type): use context, SOP step ref,
  // triggers, derived calcs. Persisted into the same `specification` JSON envelope.
  const [sharedExtras, setSharedExtras] = React.useState<SharedSpecExtras>(() =>
    parseSharedExtras(initialData.specification),
  );

  const [autoFilled, setAutoFilled] = React.useState<Set<string>>(new Set());
  const [autoFillNote, setAutoFillNote] = React.useState<string>('');
  const [isCustomName, setIsCustomName] = React.useState(() => {
    if (mode === 'edit' && initialData.name) {
      return !IPC_TEST_CATALOG.some((t) => t.nameEn === initialData.name);
    }
    return false;
  });

  const criteriaType = (formData.criteriaType || 'numeric') as CriteriaType;
  const typeMeta = CRITERIA_TYPE_META[criteriaType];

  // When user switches criteria type, reset structured payload to defaults
  // for that type so the relevant section renders empty fields.
  const handleCriteriaTypeChange = (next: CriteriaType) => {
    setFormData((prev) => ({ ...prev, criteriaType: next }));
    if (next === 'numeric') {
      setSpecPayload(null);
    } else {
      setSpecPayload((prev) => (prev && prev.type === next ? prev : defaultPayload(next)));
    }
  };

  const filteredTests = React.useMemo(() => {
    if (!formData.dosageForm) return IPC_TEST_CATALOG;
    return IPC_TEST_CATALOG.filter((t) => t.dosageForms.includes(formData.dosageForm!));
  }, [formData.dosageForm]);

  const calculatedMinMax = React.useMemo(() => {
    if (formData.specTarget === null || formData.specTarget === undefined) return null;
    return calculateMinMax(
      Number(formData.specTarget),
      Number(formData.specTolerancePercent ?? 0),
    );
  }, [formData.specTarget, formData.specTolerancePercent]);

  React.useEffect(() => {
    if (criteriaType !== 'numeric') return;
    if (calculatedMinMax) {
      setFormData((prev) => ({
        ...prev,
        minValue: calculatedMinMax.min,
        maxValue: calculatedMinMax.max,
      }));
    }
  }, [calculatedMinMax?.min, calculatedMinMax?.max, criteriaType]);

  const acceptanceMath = React.useMemo(() => {
    const n = Number(formData.sampleSize) || 0;
    const tol = Number(formData.tolerancePercent) || 0;
    if (n <= 0) return null;
    const allowed = Math.floor((n * tol) / 100);
    return { sampleSize: n, allowedFail: allowed, mustPass: n - allowed };
  }, [formData.sampleSize, formData.tolerancePercent]);

  const hasTarget = formData.specTarget !== null && formData.specTarget !== undefined;

  const handleSelectTest = (nameEn: string | null | undefined) => {
    if (!nameEn || nameEn === '__custom__') {
      setIsCustomName(true);
      setFormData((p) => ({ ...p, name: '', nameTh: '' }));
      setAutoFilled(new Set());
      setAutoFillNote('');
      return;
    }
    setIsCustomName(false);
    const test = findTestByName(nameEn);
    if (!test) return;

    setFormData((prev) => {
      const next: Partial<IPCCriteria> = { ...prev };
      next.name = test.nameEn;
      next.nameTh = test.nameTh;

      const filled = new Set<string>();
      const labels: string[] = [];

      if (!prev.code?.trim()) {
        next.code = suggestCodeForTest(test);
        filled.add('code');
        labels.push('Code');
      }
      if (!prev.unit) {
        next.unit = test.defaultUnit;
        filled.add('unit');
        if (test.defaultUnit) labels.push('Unit');
      }
      next.criteriaType = test.defaultCriteriaType;
      filled.add('criteriaType');

      if (!prev.sampleSize || prev.sampleSize === 5) {
        next.sampleSize = test.defaultSampleSize;
        filled.add('sampleSize');
        labels.push('Sample Size');
      }
      if (!prev.tolerancePercent) {
        next.tolerancePercent = test.defaultTolerancePercent;
        filled.add('tolerancePercent');
        labels.push('Tolerance');
      }
      if (test.defaultCritical && !prev.isCritical) {
        next.isCritical = true;
        filled.add('isCritical');
        labels.push('Critical');
      }

      setAutoFilled(filled);
      setAutoFillNote(labels.length > 0 ? `เติมให้อัตโนมัติ: ${labels.join(' · ')}` : '');

      // Reset spec payload to default for the new criteria type
      setSpecPayload(test.defaultCriteriaType === 'numeric' ? null : defaultPayload(test.defaultCriteriaType));

      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<IPCCriteria> & { acceptanceStages?: AcceptanceStage[] | null }) => {
      const method = mode === 'edit' ? 'PUT' : 'POST';
      const payload = mode === 'edit' ? { ...data, id } : data;
      const res = await fetch('/api/master-data/ipc-criteria', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ipc-criteria'] });
      toast.success(mode === 'edit' ? 'Updated' : 'Created', 'IPC criteria saved successfully.');
      router.push('/master-data/ipc-criteria');
    },
    onError: (error: Error) => toast.error('Error', error.message),
  });

  const handleSave = () => {
    if (!formData.code || !formData.name) {
      toast.error('Validation', 'Code and Test Name are required.');
      return;
    }
    if (criteriaType === 'numeric' && hasTarget) {
      const err = validateSpecInputs(
        Number(formData.specTarget),
        Number(formData.specTolerancePercent ?? 0),
      );
      if (err) {
        toast.error('Validation', err);
        return;
      }
    }
    if (multiStageEnabled && stages.length === 0) {
      toast.error('Validation', 'Multi-Stage โหมด ต้องมี Stage อย่างน้อย 1 ขั้น');
      return;
    }

    // Serialize per-type payload + shared extras into a single JSON envelope.
    // Numeric criteria still use specTarget/tolerance columns; the envelope only
    // carries the shared extras for them.
    const specification = serializeSpecification(specPayload, sharedExtras, criteriaType);

    saveMutation.mutate({
      ...formData,
      specification,
      acceptanceStages: multiStageEnabled ? stages : null,
    });
  };

  // ── Stage helpers ────────────────────────────────────────────────
  const addStage = () => setStages((prev) => {
    const next = [...prev, { ...emptyStage() }];
    // Last stage in chain should reject by default; previous stages advance
    return next.map((s, i) => ({
      ...s,
      onFail: i === next.length - 1 ? 'reject_batch' : 'next_stage',
    }));
  });
  const removeStage = (idx: number) => setStages((prev) => {
    const next = prev.filter((_, i) => i !== idx);
    return next.map((s, i) => ({
      ...s,
      onFail: i === next.length - 1 && next.length > 0 ? (s.onFail === 'next_stage' ? 'reject_batch' : s.onFail) : s.onFail,
    }));
  });
  const updateStage = (idx: number, patch: Partial<AcceptanceStage>) =>
    setStages((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  const loadUSPDissolution = () => setStages([...USP_DISSOLUTION_PLAN]);
  const loadUSPUniformity = () => setStages([...USP_UNIFORMITY_PLAN]);

  const cumulative = React.useMemo(() => {
    const out: number[] = [];
    let running = 0;
    for (const s of stages) {
      running += s.sampleSize;
      out.push(running);
    }
    return out;
  }, [stages]);

  const isAutoFilled = (k: string) => autoFilled.has(k);

  // ── Shared extras helpers ─────────────────────────────────────────
  const updateSopStepRef = (key: keyof SopStepRef, value: string) =>
    setSharedExtras((prev) => ({ ...prev, sopStepRef: { ...prev.sopStepRef, [key]: value } }));

  const updateTriggers = (patch: (t: Triggers) => Triggers) =>
    setSharedExtras((prev) => ({ ...prev, triggers: patch(prev.triggers) }));

  const toggleMilestoneOption = (id: string) =>
    updateTriggers((t) => ({
      ...t,
      milestone: {
        ...t.milestone,
        options: t.milestone.options.map((o) => (o.id === id ? { ...o, on: !o.on } : o)),
      },
    }));

  const toggleEventOption = (id: string) =>
    updateTriggers((t) => ({
      ...t,
      event: {
        ...t.event,
        options: t.event.options.map((o) => (o.id === id ? { ...o, on: !o.on } : o)),
      },
    }));

  const addDerivedCalc = () => setSharedExtras((prev) => ({
    ...prev,
    derivedCalcs: [
      ...prev.derivedCalcs,
      {
        id: `dc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: '', formula: '', sources: '', resultUnit: '',
        triggerWhen: '', acceptanceMin: '', acceptanceMax: '',
        onFail: 'reject', note: '',
      },
    ],
  }));

  const updateDerivedCalc = (id: string, patch: Partial<DerivedCalc>) =>
    setSharedExtras((prev) => ({
      ...prev,
      derivedCalcs: prev.derivedCalcs.map((dc) => (dc.id === id ? { ...dc, ...patch } : dc)),
    }));

  const removeDerivedCalc = (id: string) =>
    setSharedExtras((prev) => ({
      ...prev,
      derivedCalcs: prev.derivedCalcs.filter((dc) => dc.id !== id),
    }));

  const activeTriggerCount = (() => {
    const t = sharedExtras.triggers;
    return [t.time.on, t.quantity.on, t.milestone.on, t.event.on, t.oncePerBatch.on].filter(Boolean).length;
  })();

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-7xl mx-auto pb-24"
      style={{ fontFamily: 'var(--font-inter), var(--font-sarabun), system-ui, -apple-system, sans-serif' }}
    >
      <ResponsivePageHeader
        title={mode === 'edit' ? 'Edit QC & IPC Criteria' : 'New QC & IPC Criteria'}
        subtitle={mode === 'edit' ? `Editing ${initialData.name || ''}` : 'สร้างเกณฑ์ควบคุมคุณภาพระหว่างการผลิต (In-Process Control) ตามมาตรฐาน GMP / USP'}
        icon={FlaskConical}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'QC & IPC Criteria', href: '/master-data/ipc-criteria' },
          { label: mode === 'edit' ? 'Edit' : 'New' },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* ─── Form column (2/3) ─────────────────────────────────── */}
        <div className="xl:col-span-2">
          <div className={cn(PANEL, 'p-5 sm:p-6')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              {/* Section 1 — Basic */}
              <SectionHeader number={1} thai="ข้อมูลพื้นฐาน" en="Basic Information" />

              {/* Test Name */}
              <div className="sm:col-span-2">
                <label className={cn(FIELD_LABEL, 'flex items-center gap-1.5')}>
                  หัวข้อการทดสอบ (Test Name) <span className="text-red-500">*</span>
                  <span className="ml-auto text-[10px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">⚡ Smart auto-fill</span>
                </label>
                <SearchableSelect
                  value={isCustomName ? '__custom__' : formData.name || ''}
                  onChange={(v) => handleSelectTest(v)}
                  options={[
                    ...filteredTests.map((t): SearchableSelectOption => ({
                      value: t.nameEn,
                      label: `${t.nameEn} — ${t.nameTh}`,
                    })),
                    { value: '__custom__', label: '➕ เพิ่มหัวข้อใหม่ (Add Custom)' },
                  ]}
                  placeholder="เริ่มจากเลือกหัวข้อทดสอบ — ระบบจะเติมช่องอื่นให้อัตโนมัติ"
                />
                {autoFillNote ? (
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="flex-1 font-medium">{autoFillNote}</span>
                    <button
                      type="button"
                      onClick={() => { setAutoFilled(new Set()); setAutoFillNote(''); }}
                      className="text-emerald-600 hover:text-emerald-800 text-[11px] underline"
                    >
                      รับทราบ
                    </button>
                  </div>
                ) : (
                  <p className={FIELD_HELPER}>มี {IPC_TEST_CATALOG.length} หัวข้อมาตรฐานจาก USP/Pharmacopoeia — เลือกแล้วระบบจะเติม Code, Unit, Sample Plan ให้</p>
                )}
              </div>

              {/* Custom name fields */}
              {isCustomName && (
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div>
                    <label className={FIELD_LABEL}>Name (EN) <span className="text-red-500">*</span></label>
                    <input
                      className={FIELD_INPUT}
                      placeholder="เช่น Tablet Friability"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>ชื่อ (TH)</label>
                    <input
                      className={FIELD_INPUT}
                      placeholder="เช่น ความเปราะของเม็ดยา"
                      value={formData.nameTh || ''}
                      onChange={(e) => setFormData({ ...formData, nameTh: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Code */}
              <div>
                <label className={cn(FIELD_LABEL, 'flex items-center')}>
                  Code <span className="text-red-500 ml-0.5">*</span>
                  {isAutoFilled('code') && <AutoBadge />}
                </label>
                <input
                  className={cn(FIELD_INPUT, isAutoFilled('code') && 'bg-emerald-50/40 border-emerald-200')}
                  placeholder="เช่น IPC-WV-001"
                  value={formData.code || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, code: e.target.value });
                    if (autoFilled.has('code')) {
                      const next = new Set(autoFilled); next.delete('code'); setAutoFilled(next);
                    }
                  }}
                />
                <p className={FIELD_HELPER}>{isAutoFilled('code') ? 'สร้างจาก Test Name — แก้ไขได้' : 'รหัสเฉพาะของ criteria นี้'}</p>
              </div>

              {/* Unit */}
              <div>
                <label className={cn(FIELD_LABEL, 'flex items-center')}>
                  Unit
                  {isAutoFilled('unit') && <AutoBadge />}
                </label>
                <SearchableSelect
                  value={formData.unit || ''}
                  onChange={(v) => setFormData({ ...formData, unit: v || '' })}
                  options={UNIT_OPTIONS}
                  placeholder="เลือกหน่วยวัด"
                />
                <p className={FIELD_HELPER}>{isAutoFilled('unit') ? 'แนะนำตาม Test Name — เปลี่ยนได้' : 'หน่วยวัดของค่าที่บันทึก'}</p>
              </div>

              {/* Dosage Form */}
              <div>
                <label className={FIELD_LABEL}>รูปแบบยา (Dosage Form)</label>
                <SearchableSelect
                  value={formData.dosageForm || ''}
                  onChange={(v) => setFormData({ ...formData, dosageForm: v || null })}
                  options={DOSAGE_FORM_OPTIONS}
                  placeholder="เลือกรูปแบบยา"
                />
              </div>

              {/* Criteria Type */}
              <div>
                <label className={FIELD_LABEL}>ประเภทเกณฑ์ (Criteria Type) <span className="text-red-500">*</span></label>
                <SearchableSelect
                  value={criteriaType}
                  onChange={(v) => handleCriteriaTypeChange(v as CriteriaType)}
                  options={[
                    { value: 'numeric', label: 'ตัวเลข (Numeric) — ใส่ค่าวัด + เทียบ Min/Max' },
                    { value: 'pass_fail', label: 'Pass/Fail — ผ่าน/ไม่ผ่าน' },
                    { value: 'visual', label: 'Visual — ตรวจด้วยสายตา' },
                    { value: 'text', label: 'Text — บันทึกข้อความ' },
                    { value: 'multi_point', label: 'Multi-Point — วัดหลายจุด + aggregate (mean/rsd/all-pass)' },
                    { value: 'tare', label: 'Tare — น้ำหนักภาชนะเปล่า (ใช้ reference โดย multi_point)' },
                    { value: 'calibration', label: 'Calibration — เทียบสอบ instrument' },
                    { value: 'calculated', label: 'Calculated — คำนวณจาก criteria อื่น (Yield, %LOD)' },
                    { value: 'custom_multi_field', label: 'Custom Multi-Field — หลายฟิลด์ผสม' },
                  ]}
                  showClear={false}
                />
              </div>

              {/* Use Context — multi-select chips */}
              <div className="sm:col-span-2">
                <label className={FIELD_LABEL}>Use Context <span className="text-slate-400 font-normal">(เลือกได้หลายข้อ)</span></label>
                <div className="flex flex-wrap gap-2">
                  {USE_CONTEXT_OPTIONS.map((opt) => {
                    const active = sharedExtras.useContext.includes(opt.value);
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => setSharedExtras((prev) => ({
                          ...prev,
                          useContext: active
                            ? prev.useContext.filter((v) => v !== opt.value)
                            : [...prev.useContext, opt.value],
                        }))}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                          active
                            ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700',
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <p className={FIELD_HELPER}>เกณฑ์นี้ใช้ในบริบทใดบ้าง — ช่วยกรอง criteria ตอน operator เลือก</p>
              </div>

              {/* SOP Step Reference — collapsible fieldset */}
              <div className="sm:col-span-2 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4 text-slate-500" />
                  <h4 className="text-sm font-semibold text-slate-700">SOP Step Reference</h4>
                  <span className="text-[11px] text-slate-400 ml-auto">เชื่อมกับขั้นตอนใน SOP (ถ้ามี)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    className={FIELD_INPUT}
                    placeholder="SOP Code (เช่น SOP-PRD-001)"
                    value={sharedExtras.sopStepRef.sopCode}
                    onChange={(e) => updateSopStepRef('sopCode', e.target.value)}
                  />
                  <input
                    className={FIELD_INPUT}
                    placeholder="Version"
                    value={sharedExtras.sopStepRef.sopVersion}
                    onChange={(e) => updateSopStepRef('sopVersion', e.target.value)}
                  />
                  <input
                    className={FIELD_INPUT}
                    placeholder="Step #"
                    value={sharedExtras.sopStepRef.stepNumber}
                    onChange={(e) => updateSopStepRef('stepNumber', e.target.value)}
                  />
                  <input
                    className={FIELD_INPUT}
                    placeholder="Link (URL)"
                    value={sharedExtras.sopStepRef.link}
                    onChange={(e) => updateSopStepRef('link', e.target.value)}
                  />
                  <input
                    className={cn(FIELD_INPUT, 'sm:col-span-4')}
                    placeholder="คำอธิบายขั้นตอน (Step Description)"
                    value={sharedExtras.sopStepRef.stepDescription}
                    onChange={(e) => updateSopStepRef('stepDescription', e.target.value)}
                  />
                </div>
              </div>

              {/* Section 2 — Specification */}
              <SectionHeader number={2} thai="เกณฑ์มาตรฐาน" en="Specification" />

              {/* Type indicator banner */}
              <div className="sm:col-span-2">
                <div className={cn('flex items-center gap-3 p-3 rounded-xl border', typeMeta.bgColor)}>
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', typeMeta.bgColor.replace('50', '100'))}>
                    {criteriaType === 'numeric' && <FlaskConical className="w-4 h-4 text-emerald-700" />}
                    {criteriaType === 'pass_fail' && <Shield className="w-4 h-4 text-blue-700" />}
                    {criteriaType === 'visual' && <Eye className="w-4 h-4 text-amber-700" />}
                    {criteriaType === 'text' && <FileText className="w-4 h-4 text-slate-700" />}
                  </div>
                  <div className="flex-1">
                    <div className={cn('text-xs font-semibold', typeMeta.textColor)}>รูปแบบการบันทึก: {typeMeta.label}</div>
                    <div className={cn('text-[11px]', typeMeta.textColor, 'opacity-70')}>{typeMeta.desc}</div>
                  </div>
                </div>
              </div>

              {/* Numeric */}
              {criteriaType === 'numeric' && (
                <div className={cn(SUB_PANEL, 'sm:col-span-2 p-5 mt-2')}>
                  <div className="flex items-center gap-2 mb-4">
                    <FlaskConical className="w-4 h-4 text-emerald-700" />
                    <h3 className="font-semibold text-emerald-800 text-sm">Specification Target & Tolerance</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <div>
                      <label className={FIELD_LABEL}>Target (Specification) <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        className={FIELD_INPUT}
                        placeholder="เช่น 300"
                        value={formData.specTarget ?? ''}
                        onChange={(e) => setFormData({ ...formData, specTarget: e.target.value === '' ? null : Number(e.target.value) })}
                      />
                      <p className={FIELD_HELPER}>ค่าเป้าหมาย (ต้องมากกว่า 0)</p>
                    </div>
                    <div>
                      <label className={FIELD_LABEL}>±% Tolerance (Spec Range)</label>
                      <div className="relative">
                        <input
                          type="number"
                          className={cn(FIELD_INPUT, 'pr-8')}
                          placeholder="0"
                          value={formData.specTolerancePercent ?? 0}
                          onChange={(e) => setFormData({ ...formData, specTolerancePercent: Number(e.target.value) || 0 })}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                      </div>
                      <p className={FIELD_HELPER}>ช่วงยอมรับ ± % รอบค่าเป้าหมาย</p>
                    </div>
                    <div>
                      <label className={cn(FIELD_LABEL, 'flex items-center gap-1.5')}>
                        Min Value <AutoBadge />
                      </label>
                      <input
                        readOnly
                        className={cn(FIELD_INPUT, 'bg-white cursor-not-allowed text-slate-800 font-semibold')}
                        placeholder="—"
                        value={calculatedMinMax?.min ?? ''}
                      />
                      <p className={FIELD_HELPER}>
                        {calculatedMinMax
                          ? `= ${formData.specTarget} − (${formData.specTarget} × ${formData.specTolerancePercent ?? 0}%)`
                          : 'รอกรอก Target และ Tolerance'}
                      </p>
                    </div>
                    <div>
                      <label className={cn(FIELD_LABEL, 'flex items-center gap-1.5')}>
                        Max Value <AutoBadge />
                      </label>
                      <input
                        readOnly
                        className={cn(FIELD_INPUT, 'bg-white cursor-not-allowed text-slate-800 font-semibold')}
                        placeholder="—"
                        value={calculatedMinMax?.max ?? ''}
                      />
                      <p className={FIELD_HELPER}>
                        {calculatedMinMax
                          ? `= ${formData.specTarget} + (${formData.specTarget} × ${formData.specTolerancePercent ?? 0}%)`
                          : 'รอกรอก Target และ Tolerance'}
                      </p>
                    </div>
                    {calculatedMinMax && (
                      <div className="sm:col-span-2 flex flex-wrap items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-white border border-emerald-300 text-sm text-emerald-800">
                        <span className="font-semibold">ช่วงที่ยอมรับ:</span>
                        <span className="font-mono font-bold text-emerald-700">{calculatedMinMax.min}</span>
                        <span className="text-emerald-500">≤</span>
                        <span className="font-mono text-slate-500">value</span>
                        <span className="text-emerald-500">≤</span>
                        <span className="font-mono font-bold text-emerald-700">{calculatedMinMax.max}</span>
                        <span className="text-emerald-600 text-xs ml-1">({formData.specTarget} ± {formData.specTolerancePercent ?? 0}%)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pass / Fail */}
              {criteriaType === 'pass_fail' && specPayload?.type === 'pass_fail' && (
                <PassFailSection payload={specPayload} onChange={setSpecPayload} />
              )}

              {/* Visual */}
              {criteriaType === 'visual' && specPayload?.type === 'visual' && (
                <VisualSection payload={specPayload} onChange={setSpecPayload} />
              )}

              {/* Text */}
              {criteriaType === 'text' && specPayload?.type === 'text' && (
                <TextSection payload={specPayload} onChange={setSpecPayload} />
              )}

              {/* Multi-Point */}
              {criteriaType === 'multi_point' && specPayload?.type === 'multi_point' && (
                <MultiPointSection
                  payload={specPayload}
                  onChange={setSpecPayload}
                  tareSourceId={formData.tareSourceCriteriaId ?? null}
                  onTareSourceIdChange={(id) => setFormData((prev) => ({ ...prev, tareSourceCriteriaId: id }))}
                  currentId={id}
                />
              )}

              {/* Tare */}
              {criteriaType === 'tare' && specPayload?.type === 'tare' && (
                <TareSection payload={specPayload} onChange={setSpecPayload} />
              )}

              {/* Calibration */}
              {criteriaType === 'calibration' && specPayload?.type === 'calibration' && (
                <CalibrationSection payload={specPayload} onChange={setSpecPayload} />
              )}

              {/* Calculated */}
              {criteriaType === 'calculated' && specPayload?.type === 'calculated' && (
                <CalculatedSection payload={specPayload} onChange={setSpecPayload} />
              )}

              {/* Custom Multi-Field */}
              {criteriaType === 'custom_multi_field' && specPayload?.type === 'custom_multi_field' && (
                <CustomFieldsSection payload={specPayload} onChange={setSpecPayload} />
              )}

              {/* Section 3 — Sampling Plan */}
              <SectionHeader number={3} thai="แผนการสุ่ม" en="Sampling Plan" />

              {/* Sampling Plan sub-panel */}
              <div className={cn(SUB_PANEL, 'sm:col-span-2 p-5')}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Dice5 className="w-4 h-4 text-emerald-700" />
                    <h3 className="font-semibold text-emerald-800 text-sm">Sampling Plan</h3>
                  </div>
                  <span className={CHIP_GREEN}>GMP / USP Standard</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <div>
                    <label className={FIELD_LABEL}>Sampling Method</label>
                    <SearchableSelect
                      value={formData.testMethod || ''}
                      onChange={(v) => setFormData({ ...formData, testMethod: v || null })}
                      options={SAMPLING_METHOD_OPTIONS}
                      placeholder="เลือกวิธีสุ่ม"
                    />
                    <p className={FIELD_HELPER}>วิธีการสุ่มตัวอย่างที่ operator ต้องใช้</p>
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Check Interval (min)</label>
                    <input
                      type="number"
                      className={FIELD_INPUT}
                      value={formData.checkIntervalMinutes ?? 30}
                      onChange={(e) => setFormData({ ...formData, checkIntervalMinutes: Number(e.target.value) || 30 })}
                    />
                    <p className={FIELD_HELPER}>ความถี่ในการเก็บตัวอย่าง</p>
                  </div>
                </div>
              </div>

              {/* Section 4 — Multi-Stage Acceptance */}
              <SectionHeader number={4} thai="เกณฑ์การยอมรับแบบหลายขั้น" en="Multi-Stage Acceptance" />

              {/* Multi-Stage Acceptance panel */}
              <div className="sm:col-span-2 rounded-2xl border-2 border-dashed border-emerald-200 bg-white p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-emerald-700" />
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">Multi-Stage Acceptance Criteria</h3>
                      <p className="text-xs text-slate-500">
                        เกณฑ์การยอมรับแบบหลายขั้น (ตามหลัก GMP / USP &lt;711&gt;, &lt;905&gt;)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {multiStageEnabled && (
                      <span className={CHIP_GREEN}>{stages.length} stage{stages.length > 1 ? 's' : ''}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (multiStageEnabled) {
                          setMultiStageEnabled(false);
                        } else {
                          setMultiStageEnabled(true);
                          if (stages.length === 0) {
                            setStages([
                              { sampleSize: formData.sampleSize ?? 10, tolerancePercent: formData.tolerancePercent ?? 0, onFail: 'next_stage' },
                              { sampleSize: 20, tolerancePercent: 10, onFail: 'reject_batch' },
                            ]);
                          }
                        }
                      }}
                      className={cn(
                        'text-xs font-medium px-3 py-1 rounded-full border transition-colors',
                        multiStageEnabled
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      {multiStageEnabled ? '✓ Enabled' : '+ Enable Multi-Stage'}
                    </button>
                  </div>
                </div>

                {multiStageEnabled && (
                  <>
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>หลัก GMP:</strong> หากการทดสอบครั้งแรก (Stage 1) ไม่ผ่าน ให้สุ่มตัวอย่างเพิ่มเพื่อทดสอบครั้งที่ 2
                        โดยใช้เกณฑ์ที่เข้มขึ้น (รวมจำนวนทั้งหมด) ก่อนตัดสิน Reject batch
                      </div>
                    </div>

                    {/* USP quick-load */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="text-xs text-slate-500">Preset:</span>
                      <button type="button" onClick={loadUSPDissolution}
                        className="text-xs font-medium px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100">
                        USP &lt;711&gt; Dissolution (6 → 6 → 12)
                      </button>
                      <button type="button" onClick={loadUSPUniformity}
                        className="text-xs font-medium px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100">
                        USP &lt;905&gt; Uniformity (10 → 20)
                      </button>
                    </div>

                    <div className="space-y-3">
                      {stages.map((stage, idx) => (
                        <React.Fragment key={idx}>
                          <StageCard
                            idx={idx}
                            isLast={idx === stages.length - 1}
                            stage={stage}
                            cumulativeBefore={cumulative[idx] ?? 0}
                            onChange={(patch) => updateStage(idx, patch)}
                            onRemove={() => removeStage(idx)}
                          />
                          {idx < stages.length - 1 && (
                            <div className="flex justify-center">
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <ArrowDown className="w-3 h-3" />
                                <span>ถ้า Stage {idx + 1} ไม่ผ่าน</span>
                                <ArrowDown className="w-3 h-3" />
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      ))}

                      {stages.length < 5 && (
                        <button
                          type="button"
                          onClick={addStage}
                          className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 text-sm font-medium hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/30 transition-all flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          เพิ่ม Stage {stages.length + 1} (Retest)
                        </button>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-[11px] text-slate-500 uppercase tracking-wide">Total Stages</div>
                        <div className="text-lg font-bold text-emerald-700">{stages.length}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500 uppercase tracking-wide">Max Samples</div>
                        <div className="text-lg font-bold text-emerald-700">{totalStageSamples(stages)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500 uppercase tracking-wide">First Test</div>
                        <div className="text-lg font-bold text-emerald-700">{stages[0]?.sampleSize ?? 0} units</div>
                      </div>
                    </div>
                  </>
                )}

                {!multiStageEnabled && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                      <div>
                        <label className={cn(FIELD_LABEL, 'flex items-center')}>
                          Sample Size <span className="text-red-500 ml-0.5">*</span>
                          {isAutoFilled('sampleSize') && <AutoBadge />}
                        </label>
                        <input
                          type="number"
                          className={FIELD_INPUT}
                          value={formData.sampleSize ?? 5}
                          onChange={(e) => setFormData({ ...formData, sampleSize: Number(e.target.value) || 1 })}
                        />
                        <p className={FIELD_HELPER}>จำนวนหน่วยที่ต้องสุ่มทดสอบ</p>
                      </div>
                      <div>
                        <label className={cn(FIELD_LABEL, 'flex items-center')}>
                          Tolerance ±%
                          {isAutoFilled('tolerancePercent') && <AutoBadge />}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            className={cn(FIELD_INPUT, 'pr-8')}
                            value={formData.tolerancePercent ?? 0}
                            onChange={(e) => setFormData({ ...formData, tolerancePercent: Number(e.target.value) || 0 })}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                        </div>
                        <p className={FIELD_HELPER}>ยอมให้ตัวอย่างเสียได้กี่ %</p>
                      </div>
                    </div>
                    {acceptanceMath && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <StatTile label="ทดสอบ" value={acceptanceMath.sampleSize} unit="ชิ้น" tone="default" />
                        <StatTile label="ยอมเสียได้" value={acceptanceMath.allowedFail} unit="ไม่เกินกี่ชิ้น" tone="warn" />
                        <StatTile label="ต้องผ่าน" value={acceptanceMath.mustPass} unit="ขั้นต่ำ" tone="success" />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Section 5 — Multi-Trigger Inspection (Triggers) */}
              <SectionHeader number={5} thai="ตรวจสอบเมื่อ" en="Multi-Trigger Inspection" />
              <div className="sm:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">เลือกได้หลายแบบ — เปิด toggle เพื่อตั้งรายละเอียด</p>
                  <span className={CHIP_GREEN}>เปิด {activeTriggerCount}/5</span>
                </div>

                {/* Time trigger */}
                <TriggerCard
                  icon={<Clock className="w-4 h-4" />}
                  title="ตามช่วงเวลา (Time)"
                  desc="ทุก N นาที"
                  on={sharedExtras.triggers.time.on}
                  onToggle={() => updateTriggers((t) => ({ ...t, time: { ...t.time, on: !t.time.on } }))}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">ทุก</span>
                    <input
                      type="number"
                      className={cn(FIELD_INPUT, 'w-24')}
                      placeholder="30"
                      value={sharedExtras.triggers.time.every}
                      onChange={(e) => updateTriggers((t) => ({ ...t, time: { ...t.time, every: e.target.value } }))}
                    />
                    <span className="text-xs text-slate-500">นาที</span>
                  </div>
                </TriggerCard>

                {/* Quantity trigger */}
                <TriggerCard
                  icon={<Package className="w-4 h-4" />}
                  title="ตามจำนวนผลิต (Quantity)"
                  desc="ทุก N หน่วย / % ของ batch"
                  on={sharedExtras.triggers.quantity.on}
                  onToggle={() => updateTriggers((t) => ({ ...t, quantity: { ...t.quantity, on: !t.quantity.on } }))}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">โหมด</span>
                    <select
                      className={cn(FIELD_INPUT, 'w-32')}
                      value={sharedExtras.triggers.quantity.mode}
                      onChange={(e) => updateTriggers((t) => ({
                        ...t,
                        quantity: { ...t.quantity, mode: e.target.value === 'percent' ? 'percent' : 'fixed' },
                      }))}
                    >
                      <option value="fixed">Fixed (หน่วย)</option>
                      <option value="percent">Percent (% ของ batch)</option>
                    </select>
                    {sharedExtras.triggers.quantity.mode === 'fixed' ? (
                      <>
                        <span className="text-xs text-slate-500">ทุก</span>
                        <input
                          type="number"
                          className={cn(FIELD_INPUT, 'w-24')}
                          placeholder="1000"
                          value={sharedExtras.triggers.quantity.every}
                          onChange={(e) => updateTriggers((t) => ({ ...t, quantity: { ...t.quantity, every: e.target.value } }))}
                        />
                        <input
                          className={cn(FIELD_INPUT, 'w-20')}
                          placeholder="หน่วย"
                          value={sharedExtras.triggers.quantity.unit}
                          onChange={(e) => updateTriggers((t) => ({ ...t, quantity: { ...t.quantity, unit: e.target.value } }))}
                        />
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-slate-500">ทุก</span>
                        <input
                          type="number"
                          className={cn(FIELD_INPUT, 'w-24')}
                          placeholder="25"
                          value={sharedExtras.triggers.quantity.percent}
                          onChange={(e) => updateTriggers((t) => ({ ...t, quantity: { ...t.quantity, percent: e.target.value } }))}
                        />
                        <span className="text-xs text-slate-500">%</span>
                      </>
                    )}
                  </div>
                </TriggerCard>

                {/* Milestone trigger */}
                <TriggerCard
                  icon={<Target className="w-4 h-4" />}
                  title="ที่ milestone"
                  desc="ตามขั้นตอนสำคัญใน batch"
                  on={sharedExtras.triggers.milestone.on}
                  onToggle={() => updateTriggers((t) => ({ ...t, milestone: { ...t.milestone, on: !t.milestone.on } }))}
                >
                  <div className="flex flex-wrap gap-2">
                    {sharedExtras.triggers.milestone.options.map((opt) => (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => toggleMilestoneOption(opt.id)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                          opt.on
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300',
                        )}
                      >
                        {opt.label ?? opt.id}
                      </button>
                    ))}
                  </div>
                </TriggerCard>

                {/* Event trigger */}
                <TriggerCard
                  icon={<Zap className="w-4 h-4" />}
                  title="เมื่อมีเหตุการณ์ (Event)"
                  desc="changeover / lot change / cleaning / parameter / maintenance"
                  on={sharedExtras.triggers.event.on}
                  onToggle={() => updateTriggers((t) => ({ ...t, event: { ...t.event, on: !t.event.on } }))}
                >
                  <div className="flex flex-wrap gap-2">
                    {sharedExtras.triggers.event.options.map((opt) => (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => toggleEventOption(opt.id)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                          opt.on
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300',
                        )}
                      >
                        {opt.label ?? opt.id}
                      </button>
                    ))}
                  </div>
                </TriggerCard>

                {/* Once-per-batch */}
                <TriggerCard
                  icon={<RotateCcw className="w-4 h-4" />}
                  title="ครั้งเดียวต่อ batch"
                  desc="บันทึกเพียง 1 ครั้งตลอด batch"
                  on={sharedExtras.triggers.oncePerBatch.on}
                  onToggle={() => updateTriggers((t) => ({ ...t, oncePerBatch: { on: !t.oncePerBatch.on } }))}
                />
              </div>

              {/* Section 6 — Derived Calculations */}
              <SectionHeader number={6} thai="การคำนวณที่ได้จากผล" en="Derived Calculations" />
              <div className="sm:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">คำนวณข้ามขั้นตอน เช่น Yield = output / input, %LOD = (wet − dry) / wet × 100</p>
                  <button
                    type="button"
                    onClick={addDerivedCalc}
                    className="text-xs font-medium px-3 py-1.5 rounded-full border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มสูตร
                  </button>
                </div>
                {sharedExtras.derivedCalcs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-5 text-center text-xs text-slate-400">
                    ยังไม่มีสูตรคำนวณ — กด "เพิ่มสูตร" เพื่อเริ่ม
                  </div>
                ) : (
                  sharedExtras.derivedCalcs.map((dc) => (
                    <DerivedCalcCard
                      key={dc.id}
                      calc={dc}
                      onChange={(patch) => updateDerivedCalc(dc.id, patch)}
                      onRemove={() => removeDerivedCalc(dc.id)}
                    />
                  ))
                )}
              </div>

              {/* Section 7 — Settings */}
              <SectionHeader number={7} thai="การตั้งค่า" en="Settings" />

              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <ToggleCard
                  active={!!formData.isCritical}
                  onToggle={() => setFormData({ ...formData, isCritical: !formData.isCritical })}
                  title="Critical Test"
                  desc="ถ้า fail จะ block batch ทันที"
                  activeColor="bg-red-50 border-red-300 text-red-700"
                  autoFilled={isAutoFilled('isCritical')}
                />
                <ToggleCard
                  active={formData.isActive !== false}
                  onToggle={() => setFormData({ ...formData, isActive: !(formData.isActive !== false) })}
                  title="Active"
                  desc="เปิดใช้กับ batch ใหม่"
                  activeColor="bg-emerald-50 border-emerald-300 text-emerald-700"
                />
              </div>

              {/* Retest budget (FDA OOS 2006 / PIC/S) */}
              <div className="sm:col-span-2 mt-2">
                <label className={cn(FIELD_LABEL, 'flex items-center')}>
                  จำนวน Retest สูงสุด <span className="text-slate-400 ml-1 font-normal">(Max Retest Rounds)</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={5}
                    className={cn(FIELD_INPUT, 'w-24')}
                    value={formData.maxRetestRounds ?? 1}
                    disabled={!!formData.isCritical}
                    onChange={(e) => {
                      const n = Math.max(0, Math.min(5, Number(e.target.value) || 0));
                      setFormData({ ...formData, maxRetestRounds: n });
                    }}
                  />
                  <div className="text-xs text-slate-600">
                    {formData.isCritical ? (
                      <span className="text-red-600 font-medium">
                        Critical = 0 (Deviation ทันทีถ้า fail รอบ 1)
                      </span>
                    ) : (
                      <>
                        อนุญาตให้ทดสอบซ้ำได้กี่รอบก่อนต้องสร้าง <span className="font-semibold">Deviation</span>
                        <br />
                        <span className="text-slate-500">
                          เริ่มต้น 1 (ทำได้รวม 2 รอบ). 0 = Deviation ทันทีถ้า fail รอบ 1
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <p className={cn(FIELD_HELPER, 'mt-2')}>
                  ตามมาตรฐาน FDA OOS 2006: Justified retest (พบสาเหตุ) นับเป็นรอบเพิ่ม / Unjustified
                  retest (ไม่มีเหตุผลชัดเจน) จะสร้าง Deviation ทันที
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Live Preview column (1/3) ────────────────────────── */}
        <aside className="xl:col-span-1">
          <div className="xl:sticky xl:top-4 space-y-4">
            <LivePreviewPanel
              formData={formData}
              criteriaType={criteriaType}
              calculatedMinMax={calculatedMinMax}
              acceptanceMath={acceptanceMath}
              multiStageEnabled={multiStageEnabled}
              stages={stages}
              specPayload={specPayload}
            />
          </div>
        </aside>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-slate-200 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-xs text-slate-500 truncate">
            {formData.name ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
                <span className="truncate">พร้อมบันทึก: <span className="font-semibold text-slate-700">{formData.code || '(ยังไม่มี Code)'}</span></span>
              </span>
            ) : (
              <span className="text-amber-600">⚠ กรุณาเลือก Test Name ก่อน</span>
            )}
          </div>
          <div className="flex gap-2 sm:gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => router.push('/master-data/ipc-criteria')}
              className="px-5 py-2.5 rounded-[10px] border border-slate-200 bg-white text-slate-600 font-semibold text-sm hover:bg-slate-50 transition"
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending || !formData.name || !formData.code}
              className="px-5 py-2.5 rounded-[10px] bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saveMutation.isPending ? 'SAVING...' : (mode === 'edit' ? 'UPDATE' : 'CREATE')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────

function SectionHeader({ number, thai, en }: { number: number; thai: string; en: string }) {
  return (
    <div className="sm:col-span-2 flex items-center gap-3 mt-2">
      <span className={SECTION_BADGE}>{number}</span>
      <h3 className="font-semibold text-slate-900 text-sm">
        {thai} <span className="text-slate-400 font-normal">— {en}</span>
      </h3>
      <div className="flex-1 h-px bg-slate-100"></div>
    </div>
  );
}

function AutoBadge() {
  return (
    <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-medium">
      <Sparkles className="w-2.5 h-2.5" /> Auto
    </span>
  );
}

interface ToggleCardProps {
  active: boolean;
  onToggle: () => void;
  title: string;
  desc: string;
  activeColor: string;
  autoFilled?: boolean;
}

function ToggleCard({ active, onToggle, title, desc, activeColor, autoFilled }: ToggleCardProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex items-center gap-3 p-4 rounded-xl border text-left cursor-pointer transition-all',
        active ? activeColor : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
      )}
    >
      <span className={cn(
        'relative w-10 h-6 rounded-full transition-colors flex-shrink-0',
        active ? 'bg-current' : 'bg-slate-300'
      )}>
        <span className={cn(
          'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
          active ? 'translate-x-4' : 'translate-x-0'
        )} />
      </span>
      <div className="flex-1">
        <div className="text-sm font-semibold flex items-center gap-1.5">
          {title}
          {autoFilled && <AutoBadge />}
        </div>
        <div className="text-[11px] opacity-70 mt-0.5">{desc}</div>
      </div>
    </button>
  );
}

interface StatTileProps {
  label: string;
  value: number;
  unit: string;
  tone: 'default' | 'warn' | 'success';
}

function StatTile({ label, value, unit, tone }: StatTileProps) {
  const styles = {
    default: 'bg-slate-50 border-slate-200 text-slate-700',
    warn: 'bg-red-50 border-red-200 text-red-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  };
  return (
    <div className={cn('rounded-lg border p-2.5 text-center', styles[tone])}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-base font-bold">{value}</div>
      <div className="text-[10px] opacity-60">{unit}</div>
    </div>
  );
}

// ── Trigger card (collapsible toggle + nested config) ──────────────
interface TriggerCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  on: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

function TriggerCard({ icon, title, desc, on, onToggle, children }: TriggerCardProps) {
  return (
    <div className={cn(
      'rounded-xl border transition-colors',
      on ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-white',
    )}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50/40"
      >
        <span className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
          on ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500',
        )}>
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="text-[11px] text-slate-500 truncate">{desc}</div>
        </div>
        <span className={cn(
          'relative w-9 h-5 rounded-full transition-colors flex-shrink-0',
          on ? 'bg-emerald-500' : 'bg-slate-300',
        )}>
          <span className={cn(
            'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
            on ? 'translate-x-4' : 'translate-x-0',
          )} />
        </span>
      </button>
      {on && children && (
        <div className="border-t border-emerald-200 px-4 py-3">{children}</div>
      )}
    </div>
  );
}

// ── Derived calc card ──────────────────────────────────────────────
interface DerivedCalcCardProps {
  calc: DerivedCalc;
  onChange: (patch: Partial<DerivedCalc>) => void;
  onRemove: () => void;
}

function DerivedCalcCard({ calc, onChange, onRemove }: DerivedCalcCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="w-4 h-4 text-emerald-600" />
        <input
          className={cn('flex-1 px-2 py-1 border border-slate-200 rounded text-sm font-semibold text-slate-800 focus:outline-none focus:border-emerald-500')}
          placeholder="ชื่อสูตร เช่น Yield"
          value={calc.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />
        <button
          type="button"
          onClick={onRemove}
          className="text-slate-400 hover:text-red-600 p-1 rounded transition"
          title="ลบ"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className={cn(FIELD_LABEL, 'text-[11px]')}>Formula</label>
          <input
            className={cn(FIELD_INPUT, 'font-mono text-xs')}
            placeholder="(output - waste) / input * 100"
            value={calc.formula}
            onChange={(e) => onChange({ formula: e.target.value })}
          />
        </div>
        <div>
          <label className={cn(FIELD_LABEL, 'text-[11px]')}>Sources (criteria codes, comma-separated)</label>
          <input
            className={cn(FIELD_INPUT, 'text-xs')}
            placeholder="IPC-WV-001, IPC-LOD-001"
            value={calc.sources}
            onChange={(e) => onChange({ sources: e.target.value })}
          />
        </div>
        <div>
          <label className={cn(FIELD_LABEL, 'text-[11px]')}>Result Unit</label>
          <input
            className={cn(FIELD_INPUT, 'text-xs')}
            placeholder="%"
            value={calc.resultUnit}
            onChange={(e) => onChange({ resultUnit: e.target.value })}
          />
        </div>
        <div>
          <label className={cn(FIELD_LABEL, 'text-[11px]')}>Trigger When</label>
          <input
            className={cn(FIELD_INPUT, 'text-xs')}
            placeholder="ปิด batch / หลังสูตร X"
            value={calc.triggerWhen}
            onChange={(e) => onChange({ triggerWhen: e.target.value })}
          />
        </div>
        <div>
          <label className={cn(FIELD_LABEL, 'text-[11px]')}>On Fail</label>
          <select
            className={cn(FIELD_INPUT, 'text-xs')}
            value={calc.onFail}
            onChange={(e) => onChange({ onFail: e.target.value as DerivedCalc['onFail'] })}
          >
            <option value="reject">Reject Batch</option>
            <option value="deviation">Create Deviation</option>
            <option value="note">Note only</option>
          </select>
        </div>
        <div>
          <label className={cn(FIELD_LABEL, 'text-[11px]')}>Acceptance Min</label>
          <input
            className={cn(FIELD_INPUT, 'text-xs')}
            placeholder="90"
            value={calc.acceptanceMin}
            onChange={(e) => onChange({ acceptanceMin: e.target.value })}
          />
        </div>
        <div>
          <label className={cn(FIELD_LABEL, 'text-[11px]')}>Acceptance Max</label>
          <input
            className={cn(FIELD_INPUT, 'text-xs')}
            placeholder="105"
            value={calc.acceptanceMax}
            onChange={(e) => onChange({ acceptanceMax: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={cn(FIELD_LABEL, 'text-[11px]')}>Note</label>
          <input
            className={cn(FIELD_INPUT, 'text-xs')}
            placeholder="หมายเหตุ"
            value={calc.note}
            onChange={(e) => onChange({ note: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ── Multi-Point section ────────────────────────────────────────────
interface TareCriteriaOption {
  id: number;
  code: string;
  name: string;
}

function MultiPointSection({
  payload,
  onChange,
  tareSourceId,
  onTareSourceIdChange,
  currentId,
}: {
  payload: MultiPointPayload;
  onChange: (p: MultiPointPayload) => void;
  tareSourceId: number | null;
  onTareSourceIdChange: (id: number | null) => void;
  currentId?: number;
}) {
  // Fetch list of tare criteria for cross-reference dropdown
  const { data: tareList = [], refetch } = useQuery<TareCriteriaOption[]>({
    queryKey: ['ipc-criteria-tare-list'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/ipc-criteria?isActive=true');
      const data = await res.json();
      if (!data.success) return [];
      const all: { id: number; code: string; name: string; criteriaType: string }[] = data.data || [];
      return all
        .filter((c) => c.criteriaType === 'tare' && c.id !== currentId)
        .map((c) => ({ id: c.id, code: c.code, name: c.name }));
    },
    staleTime: 30_000,
  });

  // Auto-compute aggregateLimit for mean/min_max (target ± tolerance%)
  React.useEffect(() => {
    if (payload.aggregateRule !== 'mean' && payload.aggregateRule !== 'min_max') return;
    const tgt = Number(payload.perPointTarget);
    const tol = Number(payload.perPointTolerance);
    if (!Number.isFinite(tgt) || !Number.isFinite(tol) || tgt === 0) return;
    const min = tgt * (1 - tol / 100);
    const max = tgt * (1 + tol / 100);
    const next = `${min.toFixed(4)}-${max.toFixed(4)}`;
    if (next !== payload.aggregateLimit) onChange({ ...payload, aggregateLimit: next });
  }, [payload, onChange]);

  return (
    <div className="sm:col-span-2 rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50/30 p-5 mt-2 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <FlaskConical className="w-4 h-4 text-teal-700" />
        <h3 className="font-semibold text-teal-800 text-sm">Multi-Point Numeric Specification</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={FIELD_LABEL}>จำนวนจุด (Point Count) <span className="text-red-500">*</span></label>
          <input
            type="number"
            min={2}
            className={FIELD_INPUT}
            placeholder="20"
            value={payload.pointCount}
            onChange={(e) => onChange({ ...payload, pointCount: e.target.value })}
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>Label ของจุด (Point Label)</label>
          <input
            className={FIELD_INPUT}
            placeholder='เช่น "หัวตอก" → "หัวตอก 1", "หัวตอก 2"...'
            value={payload.pointLabel}
            onChange={(e) => onChange({ ...payload, pointLabel: e.target.value })}
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>Target ต่อจุด <span className="text-red-500">*</span></label>
          <input
            type="number"
            step="any"
            className={FIELD_INPUT}
            placeholder="0.500"
            value={payload.perPointTarget}
            onChange={(e) => onChange({ ...payload, perPointTarget: e.target.value })}
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>±% Tolerance ต่อจุด</label>
          <div className="relative">
            <input
              type="number"
              step="any"
              className={cn(FIELD_INPUT, 'pr-8')}
              placeholder="7.5"
              value={payload.perPointTolerance}
              onChange={(e) => onChange({ ...payload, perPointTolerance: e.target.value })}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
          </div>
        </div>
      </div>

      <div>
        <label className={FIELD_LABEL}>Aggregate Rule <span className="text-red-500">*</span></label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { v: 'all_pass', t: 'ทุกจุดต้องผ่าน', d: 'All Pass' },
            { v: 'mean', t: 'เฉลี่ยอยู่ในช่วง', d: 'Mean in range' },
            { v: 'rsd', t: 'ความเบี่ยงเบนต่ำ', d: 'RSD ≤ limit' },
            { v: 'min_max', t: 'ทุกจุดอยู่ในช่วง', d: 'Min/Max bound' },
          ].map((opt) => {
            const active = payload.aggregateRule === opt.v;
            return (
              <button
                type="button"
                key={opt.v}
                onClick={() => onChange({ ...payload, aggregateRule: opt.v as MultiPointPayload['aggregateRule'] })}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-xs font-medium transition-colors',
                  active
                    ? 'bg-teal-100 border-teal-400 text-teal-900'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-teal-300',
                )}
              >
                <span className="font-semibold">{opt.t}</span>
                <span className="text-[10px] opacity-70">{opt.d}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className={cn(FIELD_LABEL, 'flex items-center gap-1.5')}>
          Aggregate Limit
          {(payload.aggregateRule === 'mean' || payload.aggregateRule === 'min_max') && <AutoBadge />}
        </label>
        <input
          className={cn(
            FIELD_INPUT,
            (payload.aggregateRule === 'mean' || payload.aggregateRule === 'min_max') && 'bg-emerald-50/40 border-emerald-200',
          )}
          placeholder={payload.aggregateRule === 'rsd' ? 'เช่น 2.0 (% RSD)' : '0.4625-0.5375'}
          value={payload.aggregateLimit}
          readOnly={payload.aggregateRule === 'mean' || payload.aggregateRule === 'min_max'}
          onChange={(e) => onChange({ ...payload, aggregateLimit: e.target.value })}
        />
        <p className={FIELD_HELPER}>
          {payload.aggregateRule === 'rsd'
            ? 'ระบุ RSD limit เป็น %'
            : payload.aggregateRule === 'all_pass'
            ? 'ใช้ Target ± Tolerance ของแต่ละจุด'
            : 'คำนวณอัตโนมัติจาก Target ± Tolerance%'}
        </p>
      </div>

      {/* Tare cross-reference */}
      <div className="rounded-xl border-2 border-cyan-300 bg-cyan-50/40 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-cyan-700" />
          <h4 className="text-sm font-semibold text-cyan-800">Tare Source (optional)</h4>
          <button
            type="button"
            onClick={() => refetch()}
            className="ml-auto text-[11px] text-cyan-600 hover:text-cyan-800 underline"
          >
            ⟳ refresh
          </button>
        </div>
        <SearchableSelect
          value={tareSourceId ? String(tareSourceId) : ''}
          onChange={(v) => {
            if (!v) {
              onTareSourceIdChange(null);
              onChange({ ...payload, tareSourceCode: '' });
            } else {
              const opt = tareList.find((t) => String(t.id) === v);
              onTareSourceIdChange(Number(v));
              onChange({ ...payload, tareSourceCode: opt?.code ?? '' });
            }
          }}
          options={tareList.map((t) => ({ value: String(t.id), label: `${t.code} — ${t.name}` }))}
          placeholder="— ไม่ใช้ tare —"
        />
        <p className={cn(FIELD_HELPER, 'text-cyan-700')}>
          เลือก Tare criteria เพื่อให้ operator ตอน record บันทึก Gross weight แล้วระบบหัก Tare ให้อัตโนมัติ (Net = Gross − Tare)
        </p>
      </div>
    </div>
  );
}

// ── Tare section ───────────────────────────────────────────────────
function TareSection({ payload, onChange }: { payload: TarePayload; onChange: (p: TarePayload) => void }) {
  return (
    <div className="sm:col-span-2 rounded-2xl border-2 border-dashed border-cyan-300 bg-cyan-50/30 p-5 mt-2 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Layers className="w-4 h-4 text-cyan-700" />
        <h3 className="font-semibold text-cyan-800 text-sm">Tare Reference Specification</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={FIELD_LABEL}>Reference Label <span className="text-red-500">*</span></label>
          <input
            className={FIELD_INPUT}
            placeholder="น้ำหนักภาชนะเปล่า"
            value={payload.referenceLabel}
            onChange={(e) => onChange({ ...payload, referenceLabel: e.target.value })}
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>Reference Unit</label>
          <input
            className={FIELD_INPUT}
            placeholder="g"
            value={payload.referenceUnit}
            onChange={(e) => onChange({ ...payload, referenceUnit: e.target.value })}
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>Store As (symbol)</label>
          <input
            className={FIELD_INPUT}
            placeholder="tare_empty_cap"
            value={payload.storeAs}
            onChange={(e) => onChange({ ...payload, storeAs: e.target.value })}
          />
          <p className={FIELD_HELPER}>ชื่อย่อสำหรับอ้างอิงในสูตร calculated</p>
        </div>
        <div>
          <label className={FIELD_LABEL}>Expire After</label>
          <select
            className={FIELD_INPUT}
            value={payload.expireAfter}
            onChange={(e) => onChange({ ...payload, expireAfter: e.target.value as TarePayload['expireAfter'] })}
          >
            <option value="batch">หมดอายุเมื่อจบ batch</option>
            <option value="shift">หมดอายุเมื่อจบกะ</option>
            <option value="permanent">ใช้ได้ตลอด (permanent)</option>
          </select>
        </div>
        <div>
          <label className={FIELD_LABEL}>Acceptance Min</label>
          <input
            type="number"
            step="any"
            className={FIELD_INPUT}
            placeholder="0.0900"
            value={payload.acceptanceMin}
            onChange={(e) => onChange({ ...payload, acceptanceMin: e.target.value })}
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>Acceptance Max</label>
          <input
            type="number"
            step="any"
            className={FIELD_INPUT}
            placeholder="0.1100"
            value={payload.acceptanceMax}
            onChange={(e) => onChange({ ...payload, acceptanceMax: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ── Calibration section ────────────────────────────────────────────
function CalibrationSection({ payload, onChange }: { payload: CalibrationPayload; onChange: (p: CalibrationPayload) => void }) {
  return (
    <div className="sm:col-span-2 rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50/30 p-5 mt-2 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <FlaskConical className="w-4 h-4 text-purple-700" />
        <h3 className="font-semibold text-purple-800 text-sm">Calibration Specification</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={FIELD_LABEL}>Instrument Name <span className="text-red-500">*</span></label>
          <input className={FIELD_INPUT} placeholder="เช่น Digital Caliper"
            value={payload.instrumentName}
            onChange={(e) => onChange({ ...payload, instrumentName: e.target.value })} />
        </div>
        <div>
          <label className={FIELD_LABEL}>Instrument ID</label>
          <input className={FIELD_INPUT} placeholder="INS-001"
            value={payload.instrumentId}
            onChange={(e) => onChange({ ...payload, instrumentId: e.target.value })} />
        </div>
        <div>
          <label className={FIELD_LABEL}>Standard Value <span className="text-red-500">*</span></label>
          <input type="number" step="any" className={FIELD_INPUT} placeholder="100.000"
            value={payload.standardValue}
            onChange={(e) => onChange({ ...payload, standardValue: e.target.value })} />
        </div>
        <div>
          <label className={FIELD_LABEL}>Standard Unit</label>
          <input className={FIELD_INPUT} placeholder="mm"
            value={payload.standardUnit}
            onChange={(e) => onChange({ ...payload, standardUnit: e.target.value })} />
        </div>
        <div>
          <label className={FIELD_LABEL}>Tolerance Type</label>
          <select className={FIELD_INPUT}
            value={payload.toleranceType}
            onChange={(e) => onChange({ ...payload, toleranceType: e.target.value as CalibrationPayload['toleranceType'] })}>
            <option value="percent">Percent (%)</option>
            <option value="absolute">Absolute (unit)</option>
          </select>
        </div>
        <div>
          <label className={FIELD_LABEL}>Tolerance Value</label>
          <input type="number" step="any" className={FIELD_INPUT} placeholder={payload.toleranceType === 'percent' ? '5' : '0.05'}
            value={payload.toleranceValue}
            onChange={(e) => onChange({ ...payload, toleranceValue: e.target.value })} />
        </div>
        <div>
          <label className={FIELD_LABEL}>Last Calibration Date</label>
          <input type="date" className={FIELD_INPUT}
            value={payload.lastCalibrationDate}
            onChange={(e) => onChange({ ...payload, lastCalibrationDate: e.target.value })} />
        </div>
        <div>
          <label className={FIELD_LABEL}>Next Due Date</label>
          <input type="date" className={FIELD_INPUT}
            value={payload.nextDueDate}
            onChange={(e) => onChange({ ...payload, nextDueDate: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input type="checkbox" checked={payload.requiresPriorPass}
              onChange={(e) => onChange({ ...payload, requiresPriorPass: e.target.checked })} />
            ต้องผ่าน calibration ก่อนจึงจะเริ่มผลิตได้ (block production until pass)
          </label>
        </div>
      </div>
    </div>
  );
}

// ── Calculated section ─────────────────────────────────────────────
function CalculatedSection({ payload, onChange }: { payload: CalculatedPayload; onChange: (p: CalculatedPayload) => void }) {
  const addInput = () => onChange({
    ...payload,
    inputs: [
      ...payload.inputs,
      {
        id: `inp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: '', source: 'derived', criteriaCode: '', constantValue: '',
      },
    ],
  });
  const updateInput = (id: string, patch: Partial<CalculatedInput>) =>
    onChange({ ...payload, inputs: payload.inputs.map((i) => i.id === id ? { ...i, ...patch } : i) });
  const removeInput = (id: string) =>
    onChange({ ...payload, inputs: payload.inputs.filter((i) => i.id !== id) });

  return (
    <div className="sm:col-span-2 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/30 p-5 mt-2 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Calculator className="w-4 h-4 text-indigo-700" />
        <h3 className="font-semibold text-indigo-800 text-sm">Calculated Specification</h3>
      </div>

      <div>
        <label className={FIELD_LABEL}>Formula <span className="text-red-500">*</span></label>
        <input className={cn(FIELD_INPUT, 'font-mono text-sm')}
          placeholder="(gross - tare) / batch_size * 100"
          value={payload.formula}
          onChange={(e) => onChange({ ...payload, formula: e.target.value })} />
        <p className={FIELD_HELPER}>ตัวแปรในสูตรต้องตรงกับ name ของ Inputs ด้านล่าง — ตัวอย่าง: <code>Yield = output / input * 100</code>, <code>%LOD = (wet - dry) / wet * 100</code></p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={FIELD_LABEL}>Inputs (ตัวแปรในสูตร)</label>
          <button type="button" onClick={addInput}
            className="text-xs font-medium px-2.5 py-1 rounded-md border border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 flex items-center gap-1">
            <Plus className="w-3 h-3" /> เพิ่ม input
          </button>
        </div>
        {payload.inputs.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded">
            ยังไม่มี input — กด "เพิ่ม input" เพื่อกำหนดตัวแปรในสูตร
          </div>
        ) : (
          <div className="space-y-2">
            {payload.inputs.map((inp) => (
              <div key={inp.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end p-2 rounded-lg bg-white border border-slate-200">
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-slate-500">name (in formula)</label>
                  <input className={cn(FIELD_INPUT, 'text-xs font-mono')}
                    placeholder="gross" value={inp.name}
                    onChange={(e) => updateInput(inp.id, { name: e.target.value })} />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-[10px] text-slate-500">source</label>
                  <select className={cn(FIELD_INPUT, 'text-xs')}
                    value={inp.source}
                    onChange={(e) => updateInput(inp.id, { source: e.target.value as CalculatedInput['source'] })}>
                    <option value="derived">From criteria code</option>
                    <option value="this_step">From this step</option>
                    <option value="constant">Constant</option>
                  </select>
                </div>
                <div className="sm:col-span-6">
                  {inp.source === 'constant' ? (
                    <>
                      <label className="text-[10px] text-slate-500">constant value</label>
                      <input type="number" step="any" className={cn(FIELD_INPUT, 'text-xs font-mono')}
                        placeholder="100" value={inp.constantValue}
                        onChange={(e) => updateInput(inp.id, { constantValue: e.target.value })} />
                    </>
                  ) : (
                    <>
                      <label className="text-[10px] text-slate-500">criteria code</label>
                      <input className={cn(FIELD_INPUT, 'text-xs font-mono')}
                        placeholder="IPC-WV-001" value={inp.criteriaCode}
                        onChange={(e) => updateInput(inp.id, { criteriaCode: e.target.value })} />
                    </>
                  )}
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  <button type="button" onClick={() => removeInput(inp.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className={FIELD_LABEL}>Result Unit</label>
          <input className={FIELD_INPUT} placeholder="%"
            value={payload.resultUnit}
            onChange={(e) => onChange({ ...payload, resultUnit: e.target.value })} />
        </div>
        <div>
          <label className={FIELD_LABEL}>Result Min</label>
          <input type="number" step="any" className={FIELD_INPUT} placeholder="90"
            value={payload.resultMin}
            onChange={(e) => onChange({ ...payload, resultMin: e.target.value })} />
        </div>
        <div>
          <label className={FIELD_LABEL}>Result Max</label>
          <input type="number" step="any" className={FIELD_INPUT} placeholder="105"
            value={payload.resultMax}
            onChange={(e) => onChange({ ...payload, resultMax: e.target.value })} />
        </div>
        <div>
          <label className={FIELD_LABEL}>Decimals</label>
          <input type="number" min={0} max={6} className={FIELD_INPUT}
            value={payload.displayDecimals}
            onChange={(e) => onChange({ ...payload, displayDecimals: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

// ── Custom Multi-Field section ─────────────────────────────────────
function CustomFieldsSection({ payload, onChange }: { payload: CustomMultiFieldPayload; onChange: (p: CustomMultiFieldPayload) => void }) {
  const addField = () => onChange({
    ...payload,
    fields: [
      ...payload.fields,
      {
        id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: '', fieldType: 'number', unit: '', target: '', tolerance: '',
        required: true, note: '', options: '',
      },
    ],
  });
  const updateField = (id: string, patch: Partial<CustomField>) =>
    onChange({ ...payload, fields: payload.fields.map((f) => f.id === id ? { ...f, ...patch } : f) });
  const removeField = (id: string) =>
    onChange({ ...payload, fields: payload.fields.filter((f) => f.id !== id) });

  return (
    <div className="sm:col-span-2 rounded-2xl border-2 border-dashed border-rose-300 bg-rose-50/30 p-5 mt-2 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Layers className="w-4 h-4 text-rose-700" />
        <h3 className="font-semibold text-rose-800 text-sm">Custom Multi-Field Specification</h3>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={FIELD_LABEL}>Fields ({payload.fields.length})</label>
          <button type="button" onClick={addField}
            className="text-xs font-medium px-2.5 py-1 rounded-md border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 flex items-center gap-1">
            <Plus className="w-3 h-3" /> เพิ่มฟิลด์
          </button>
        </div>
        {payload.fields.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded">
            ยังไม่มีฟิลด์ — กด "เพิ่มฟิลด์" เพื่อกำหนด
          </div>
        ) : (
          <div className="space-y-2">
            {payload.fields.map((f) => (
              <div key={f.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-3">
                    <label className="text-[10px] text-slate-500">Label</label>
                    <input className={cn(FIELD_INPUT, 'text-xs')}
                      placeholder="ความหนา" value={f.label}
                      onChange={(e) => updateField(f.id, { label: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-500">Type</label>
                    <select className={cn(FIELD_INPUT, 'text-xs')}
                      value={f.fieldType}
                      onChange={(e) => updateField(f.id, { fieldType: e.target.value as CustomField['fieldType'] })}>
                      <option value="number">Number</option>
                      <option value="text">Text</option>
                      <option value="select">Select</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-500">Unit</label>
                    <input className={cn(FIELD_INPUT, 'text-xs')}
                      placeholder="mm" value={f.unit}
                      onChange={(e) => updateField(f.id, { unit: e.target.value })} />
                  </div>
                  {f.fieldType === 'number' && (
                    <>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-slate-500">Target</label>
                        <input type="number" step="any" className={cn(FIELD_INPUT, 'text-xs')}
                          value={f.target}
                          onChange={(e) => updateField(f.id, { target: e.target.value })} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-slate-500">± %</label>
                        <input type="number" step="any" className={cn(FIELD_INPUT, 'text-xs')}
                          value={f.tolerance}
                          onChange={(e) => updateField(f.id, { tolerance: e.target.value })} />
                      </div>
                    </>
                  )}
                  {f.fieldType === 'select' && (
                    <div className="sm:col-span-4">
                      <label className="text-[10px] text-slate-500">Options (comma-separated)</label>
                      <input className={cn(FIELD_INPUT, 'text-xs')}
                        placeholder="opt1, opt2, opt3" value={f.options}
                        onChange={(e) => updateField(f.id, { options: e.target.value })} />
                    </div>
                  )}
                  <div className="sm:col-span-1 flex items-end justify-end">
                    <button type="button" onClick={() => removeField(f.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={f.required}
                      onChange={(e) => updateField(f.id, { required: e.target.checked })} />
                    required
                  </label>
                  <input className={cn(FIELD_INPUT, 'text-xs flex-1 ml-3')}
                    placeholder="note (optional)" value={f.note}
                    onChange={(e) => updateField(f.id, { note: e.target.value })} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className={FIELD_LABEL}>General Note</label>
        <textarea className={cn(FIELD_INPUT, 'min-h-[60px]')}
          placeholder="หมายเหตุทั่วไป"
          value={payload.generalNote}
          onChange={(e) => onChange({ ...payload, generalNote: e.target.value })} />
      </div>
    </div>
  );
}

// ── Pass / Fail section ────────────────────────────────────────────
function PassFailSection({ payload, onChange }: { payload: PassFailPayload; onChange: (p: PassFailPayload) => void }) {
  return (
    <div className="sm:col-span-2 p-5 mt-2 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-blue-700" />
        <h3 className="font-semibold text-blue-800 text-sm">เกณฑ์การตัดสินใจ Pass / Fail</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 border border-emerald-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">✓</span>
            <label className="text-sm font-semibold text-emerald-700">เกณฑ์ &quot;ผ่าน&quot; (PASS)</label>
          </div>
          <textarea
            className={cn(FIELD_INPUT, 'min-h-[80px] resize-none')}
            placeholder="เช่น ฉลากติดถูกต้อง ครบถ้วน ไม่บิดเบี้ยว"
            value={payload.passDefinition}
            onChange={(e) => onChange({ ...payload, passDefinition: e.target.value })}
          />
        </div>
        <div className="bg-white rounded-xl p-4 border border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">✕</span>
            <label className="text-sm font-semibold text-red-700">เกณฑ์ &quot;ไม่ผ่าน&quot; (FAIL)</label>
          </div>
          <textarea
            className={cn(FIELD_INPUT, 'min-h-[80px] resize-none')}
            placeholder="เช่น ฉลากบิด ฉีกขาด หรือพิมพ์ไม่ชัด"
            value={payload.failDefinition}
            onChange={(e) => onChange({ ...payload, failDefinition: e.target.value })}
          />
        </div>
      </div>
      <div className="mt-3">
        <label className={FIELD_LABEL}>ค่าที่คาดหวังโดยปริยาย (Default Expected)</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...payload, defaultExpected: 'pass' })}
            className={cn(
              'flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all',
              payload.defaultExpected === 'pass'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
            )}
          >
            ✓ ปกติต้องผ่าน
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...payload, defaultExpected: 'fail' })}
            className={cn(
              'flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all',
              payload.defaultExpected === 'fail'
                ? 'bg-red-50 border-red-300 text-red-700'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
            )}
          >
            ✕ ปกติต้องไม่พบ
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Visual section ─────────────────────────────────────────────────
function VisualSection({ payload, onChange }: { payload: VisualPayload; onChange: (p: VisualPayload) => void }) {
  return (
    <div className="sm:col-span-2 p-5 mt-2 rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/40">
      <div className="flex items-center gap-2 mb-4">
        <Eye className="w-4 h-4 text-amber-700" />
        <h3 className="font-semibold text-amber-800 text-sm">เกณฑ์การตรวจด้วยสายตา (Visual Inspection)</h3>
      </div>
      <div className="mb-4">
        <label className={FIELD_LABEL}>คำอธิบายลักษณะที่ยอมรับ <span className="text-red-500">*</span></label>
        <textarea
          className={cn(FIELD_INPUT, 'min-h-[80px] resize-none')}
          placeholder="เช่น เม็ดยาสีน้ำตาลอ่อน ผิวเรียบ ไม่มีรอยร้าว ไม่มีจุดดำ"
          value={payload.description}
          onChange={(e) => onChange({ ...payload, description: e.target.value })}
        />
      </div>
      <div className="mb-4">
        <label className={FIELD_LABEL}>Checklist รายการที่ต้องตรวจ</label>
        <div className="space-y-2">
          {payload.checklist.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                {idx + 1}
              </span>
              <input
                className={cn(FIELD_INPUT, 'flex-1')}
                placeholder="ระบุจุดที่ต้องตรวจ"
                value={item}
                onChange={(e) => {
                  const next = [...payload.checklist];
                  next[idx] = e.target.value;
                  onChange({ ...payload, checklist: next });
                }}
              />
              <button
                type="button"
                onClick={() => onChange({ ...payload, checklist: payload.checklist.filter((_, i) => i !== idx) })}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...payload, checklist: [...payload.checklist, ''] })}
            className="w-full py-2 rounded-lg border-2 border-dashed border-amber-300 text-amber-700 text-xs font-medium hover:bg-amber-50 transition-all flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" /> เพิ่มรายการตรวจ
          </button>
        </div>
      </div>
      <div>
        <label className={FIELD_LABEL}>รูปอ้างอิง (Reference Image)</label>
        <input
          className={FIELD_INPUT}
          placeholder="URL หรือ path รูปภาพมาตรฐาน"
          value={payload.referenceImage}
          onChange={(e) => onChange({ ...payload, referenceImage: e.target.value })}
        />
        <p className={FIELD_HELPER}>รูปตัวอย่างที่ operator ใช้เปรียบเทียบ</p>
      </div>
    </div>
  );
}

// ── Text section ───────────────────────────────────────────────────
function TextSection({ payload, onChange }: { payload: TextPayload; onChange: (p: TextPayload) => void }) {
  return (
    <div className="sm:col-span-2 p-5 mt-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4 text-slate-700" />
        <h3 className="font-semibold text-slate-800 text-sm">รูปแบบการบันทึกข้อความ</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <div>
          <label className={FIELD_LABEL}>รูปแบบที่คาดหวัง (Format)</label>
          <input
            className={FIELD_INPUT}
            placeholder="เช่น Lot YYYY-MM-DD-NNN"
            value={payload.format}
            onChange={(e) => onChange({ ...payload, format: e.target.value })}
          />
          <p className={FIELD_HELPER}>รูปแบบ / pattern ของข้อความที่ต้องบันทึก</p>
        </div>
        <div>
          <label className={FIELD_LABEL}>ตัวอย่าง (Example)</label>
          <input
            className={FIELD_INPUT}
            placeholder="เช่น Lot 2025-11-25-001"
            value={payload.example}
            onChange={(e) => onChange({ ...payload, example: e.target.value })}
          />
          <p className={FIELD_HELPER}>ตัวอย่างค่าที่ถูกต้อง</p>
        </div>
        <div className="sm:col-span-2">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <span className={cn('relative w-10 h-6 rounded-full transition-colors', payload.required ? 'bg-emerald-500' : 'bg-slate-300')}>
              <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', payload.required ? 'translate-x-4' : 'translate-x-0')} />
            </span>
            <span className="text-sm font-medium text-slate-700">บังคับให้กรอก (Required)</span>
            <input type="checkbox" className="sr-only" checked={payload.required} onChange={(e) => onChange({ ...payload, required: e.target.checked })} />
          </label>
        </div>
      </div>
    </div>
  );
}

// ── Stage card (multi-stage) ───────────────────────────────────────
interface StageCardProps {
  idx: number;
  isLast: boolean;
  stage: AcceptanceStage;
  cumulativeBefore: number;
  onChange: (patch: Partial<AcceptanceStage>) => void;
  onRemove: () => void;
}

function StageCard({ idx, isLast, stage, cumulativeBefore, onChange, onRemove }: StageCardProps) {
  const math = calcStageAcceptance(stage);
  const isFirst = idx === 0;

  return (
    <div className={cn(
      'rounded-xl border p-4',
      isFirst ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-white'
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
            isFirst ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white'
          )}>
            S{idx + 1}
          </span>
          <div>
            <div className="font-semibold text-slate-900 text-sm">
              Stage {idx + 1}
              {isFirst && <span className="text-xs text-emerald-700 font-normal ml-1">— First Test</span>}
            </div>
            <div className="text-[11px] text-slate-500">
              สุ่ม {stage.sampleSize} units · รวมทดสอบทั้งหมด {cumulativeBefore} units
            </div>
          </div>
        </div>
        {idx > 0 && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={FIELD_LABEL}>Sample Size</label>
          <input
            type="number"
            className={FIELD_INPUT}
            value={stage.sampleSize}
            onChange={(e) => onChange({ sampleSize: Number(e.target.value) || 1 })}
          />
          <p className={FIELD_HELPER}>จำนวน units ที่สุ่มในขั้นนี้</p>
        </div>
        <div>
          <label className={FIELD_LABEL}>Tolerance ±%</label>
          <div className="relative">
            <input
              type="number"
              className={cn(FIELD_INPUT, 'pr-8')}
              value={stage.tolerancePercent}
              onChange={(e) => onChange({ tolerancePercent: Number(e.target.value) || 0 })}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
          </div>
          <p className={FIELD_HELPER}>% ที่ยอมเสียได้ของขั้นนี้</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatTile label="ทดสอบ" value={math.sampleSize} unit="ชิ้น" tone="default" />
        <StatTile label="ยอมเสียได้" value={math.allowedFail} unit="ไม่เกินกี่ชิ้น" tone="warn" />
        <StatTile label="ต้องผ่าน" value={math.mustPass} unit="ขั้นต่ำ" tone="success" />
      </div>

      <p className="mt-2 text-[11px] text-slate-500 text-center">
        สูตร: <span className="font-mono">{stage.sampleSize} × {stage.tolerancePercent}% = {math.allowedFail}</span> (ปัดลง)
      </p>

      <div className="mt-3 pt-3 border-t border-slate-100">
        <label className={FIELD_LABEL}>เมื่อ Stage นี้ไม่ผ่าน (On Fail)</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <OnFailButton
            active={stage.onFail === 'next_stage'}
            disabled={isLast}
            onClick={() => onChange({ onFail: 'next_stage' })}
            label="→ ทดสอบ Stage ถัดไป"
            activeStyle="bg-amber-50 border-amber-300 text-amber-800"
          />
          <OnFailButton
            active={stage.onFail === 'reject_batch'}
            onClick={() => onChange({ onFail: 'reject_batch' })}
            label="✕ Reject Batch"
            activeStyle="bg-red-50 border-red-300 text-red-700"
          />
          <OnFailButton
            active={stage.onFail === 'deviation'}
            onClick={() => onChange({ onFail: 'deviation' })}
            label="⚠ บันทึก Deviation"
            activeStyle="bg-orange-50 border-orange-300 text-orange-700"
          />
        </div>

        {stage.onFail === 'deviation' && (
          <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-orange-600">⚠</span>
                <span className="text-xs font-semibold text-orange-800">Deviation Record (Auto-generated)</span>
              </div>
              <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-orange-200 text-orange-700">
                DEV-{new Date().getFullYear()}-XXXX
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-slate-600">
              <DevField label="Type" value="Quality / IPC Failure" />
              <DevField label="Severity" value="Minor → Investigate" />
              <DevField label="Source" value={`Stage ${idx + 1}`} />
              <DevField label="Status" value="Pending Investigation" valueColor="text-amber-600" />
              <DevField label="Assignee" value="QA Manager" />
              <DevField label="SLA" value="24 ชม." />
            </div>
            <div className="mt-2 pt-2 border-t border-orange-200/70 text-[11px] text-orange-800">
              Batch จะถูก <strong>HOLD</strong> รอ QA ตัดสินใจ — Accept with justification, Rework, หรือ Reject
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OnFailButton({ active, disabled, onClick, label, activeStyle }: { active: boolean; disabled?: boolean; onClick: () => void; label: string; activeStyle: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all',
        active && !disabled ? activeStyle : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {label}
    </button>
  );
}

function DevField({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}:</span>
      <span className={cn('font-medium', valueColor || 'text-slate-700')}>{value}</span>
    </div>
  );
}

// ── Live Preview Panel ─────────────────────────────────────────────
interface LivePreviewProps {
  formData: Partial<IPCCriteria>;
  criteriaType: CriteriaType;
  calculatedMinMax: { min: number; max: number } | null;
  acceptanceMath: { sampleSize: number; allowedFail: number; mustPass: number } | null;
  multiStageEnabled: boolean;
  stages: AcceptanceStage[];
  specPayload: SpecPayload | null;
}

function LivePreviewPanel({ formData, criteriaType, calculatedMinMax, acceptanceMath, multiStageEnabled, stages, specPayload }: LivePreviewProps) {
  const lastStage = stages[stages.length - 1];
  const finalAction = multiStageEnabled && lastStage ? lastStage.onFail : 'reject_batch';

  return (
    <>
      <div className={cn(PANEL, 'p-5')}>
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-sm">
            <FlaskConical className="w-5 h-5" />
          </span>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
              Live Preview
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </h3>
            <p className="text-[11px] text-slate-500">ตัวอย่างที่ operator จะเห็น</p>
          </div>
        </div>

        {/* Preview card */}
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 mb-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex flex-wrap gap-1.5">
              {formData.code && <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">{formData.code}</span>}
              {formData.isCritical && <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded">⚠ CRITICAL</span>}
              {formData.isActive === false && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded">INACTIVE</span>}
            </div>
          </div>
          <div className="text-sm font-semibold text-slate-900 mb-1">
            {formData.name || <span className="text-slate-400 italic font-normal">— ยังไม่ได้เลือก Test —</span>}
          </div>
          {formData.dosageForm && (
            <div className="text-[11px] text-slate-500 mb-3">
              {DOSAGE_FORM_OPTIONS.find((d) => d.value === formData.dosageForm)?.label}
            </div>
          )}

          {criteriaType === 'numeric' && calculatedMinMax && (
            <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
              <div className="text-[10px] text-emerald-600 uppercase tracking-wide">Spec Range</div>
              <div className="font-mono font-bold text-emerald-800 text-sm mt-1">
                {calculatedMinMax.min} ≤ value ≤ {calculatedMinMax.max}
              </div>
              <div className="text-[10px] text-emerald-600 mt-0.5">
                {formData.specTarget} ± {formData.specTolerancePercent ?? 0}%
                {formData.unit && ` (${formData.unit})`}
              </div>
            </div>
          )}

          {criteriaType === 'pass_fail' && specPayload?.type === 'pass_fail' && (
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              <div className="bg-emerald-50 rounded-lg p-2 text-[11px]">
                <div className="font-semibold text-emerald-700 mb-0.5">✓ PASS</div>
                <div className="text-emerald-900/80 line-clamp-2">
                  {specPayload.passDefinition || <span className="italic text-emerald-600/50">—</span>}
                </div>
              </div>
              <div className="bg-red-50 rounded-lg p-2 text-[11px]">
                <div className="font-semibold text-red-700 mb-0.5">✕ FAIL</div>
                <div className="text-red-900/80 line-clamp-2">
                  {specPayload.failDefinition || <span className="italic text-red-600/50">—</span>}
                </div>
              </div>
            </div>
          )}

          {criteriaType === 'visual' && specPayload?.type === 'visual' && (
            <div className="bg-amber-50 rounded-lg p-2.5 text-[11px]">
              <div className="font-semibold text-amber-700 mb-1">👁 ตรวจด้วยสายตา</div>
              <div className="text-amber-900/80 line-clamp-2">
                {specPayload.description || <span className="italic">—</span>}
              </div>
              {specPayload.checklist.filter(Boolean).length > 0 && (
                <div className="mt-1.5 text-[10px] text-amber-700">
                  {specPayload.checklist.filter(Boolean).length} จุดตรวจ
                </div>
              )}
            </div>
          )}

          {criteriaType === 'text' && specPayload?.type === 'text' && (
            <div className="bg-slate-100 rounded-lg p-2.5 text-[11px]">
              <div className="text-slate-500 mb-0.5">Format:</div>
              <div className="font-mono text-slate-700">
                {specPayload.format || <span className="italic text-slate-400">—</span>}
              </div>
              {specPayload.example && (
                <div className="mt-1 text-slate-500 text-[10px]">
                  e.g. <span className="font-mono">{specPayload.example}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Operator Recording Preview — mirrors the actual /work-orders/[id]/ipc
            recording UI so the criteria designer can see how the form will
            appear to the operator before saving. */}
        <OperatorRecordingPreview
          formData={formData}
          criteriaType={criteriaType}
          calculatedMinMax={calculatedMinMax}
          acceptanceMath={acceptanceMath}
          multiStageEnabled={multiStageEnabled}
          stages={stages}
          specPayload={specPayload}
        />

        {/* Acceptance Flow */}
        <div>
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Acceptance Flow</div>
          <div className="space-y-1.5">
            {multiStageEnabled && stages.length > 0 ? (
              <>
                {stages.map((s, i) => {
                  const m = calcStageAcceptance(s);
                  return (
                    <React.Fragment key={i}>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={cn(
                          'w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] flex-shrink-0',
                          i === 0 ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                        )}>
                          S{i + 1}
                        </span>
                        <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                          <div className="font-medium text-slate-700 truncate">
                            สุ่ม {m.sampleSize} ชิ้น · เสียได้ {m.allowedFail}
                          </div>
                          <div className="text-[10px] text-slate-400">tolerance {s.tolerancePercent}%</div>
                        </div>
                      </div>
                      {i < stages.length - 1 && (
                        <div className="ml-3 text-[10px] text-slate-400 pl-2 border-l-2 border-dashed border-slate-200">
                          ↓ ถ้าไม่ผ่าน
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
                <div className="flex items-center gap-2 text-xs mt-1">
                  <span className={cn(
                    'w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] flex-shrink-0',
                    finalAction === 'reject_batch' && 'bg-red-500 text-white',
                    finalAction === 'deviation' && 'bg-orange-500 text-white',
                    finalAction === 'next_stage' && 'bg-slate-300 text-white',
                  )}>!</span>
                  <div className="text-[11px] font-semibold">
                    {finalAction === 'reject_batch' && <span className="text-red-600">✕ Reject Batch</span>}
                    {finalAction === 'deviation' && <span className="text-orange-600">⚠ บันทึก Deviation</span>}
                    {finalAction === 'next_stage' && <span className="text-slate-500">→ ทดสอบต่อ</span>}
                  </div>
                </div>
              </>
            ) : acceptanceMath ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] flex-shrink-0 bg-emerald-600 text-white">S1</span>
                <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                  <div className="font-medium text-slate-700">
                    สุ่ม {acceptanceMath.sampleSize} ชิ้น · เสียได้ {acceptanceMath.allowedFail}
                  </div>
                  <div className="text-[10px] text-slate-400">tolerance {formData.tolerancePercent ?? 0}%</div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic">— ยังไม่ได้กำหนด sampling plan —</div>
            )}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className={cn(PANEL, 'p-4')}>
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">Summary</div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Stages:</span>
            <span className="font-bold text-slate-700">{multiStageEnabled ? stages.length : 1}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Max samples:</span>
            <span className="font-bold text-slate-700">
              {multiStageEnabled ? totalStageSamples(stages) : (formData.sampleSize ?? 0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Check every:</span>
            <span className="font-bold text-slate-700">{formData.checkIntervalMinutes ?? 30} min</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Sampling:</span>
            <span className="font-medium text-slate-700 truncate ml-2">
              {SAMPLING_METHOD_OPTIONS.find((m) => m.value === formData.testMethod)?.label.split(' —')[0] || '—'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Operator Recording Preview ─────────────────────────────────────
// Renders a read-only mock of the actual /work-orders/[id]/ipc recording
// UI so the criteria designer can verify exactly what the operator will
// see (sample inputs, button grids, checklist labels) before saving.
interface OperatorRecordingPreviewProps {
  formData: Partial<IPCCriteria>;
  criteriaType: CriteriaType;
  calculatedMinMax: { min: number; max: number } | null;
  acceptanceMath: { sampleSize: number; allowedFail: number; mustPass: number } | null;
  multiStageEnabled: boolean;
  stages: AcceptanceStage[];
  specPayload: SpecPayload | null;
}

function OperatorRecordingPreview({
  formData,
  criteriaType,
  calculatedMinMax,
  acceptanceMath,
  multiStageEnabled,
  stages,
  specPayload,
}: OperatorRecordingPreviewProps) {
  // Use Stage 1 sample size when multi-stage, otherwise the form's sampleSize.
  const effectiveSampleSize = multiStageEnabled && stages[0]
    ? (stages[0].sampleSize ?? formData.sampleSize ?? 1)
    : (acceptanceMath?.sampleSize ?? formData.sampleSize ?? 1);

  const visualChecklist =
    criteriaType === 'visual' && specPayload?.type === 'visual'
      ? specPayload.checklist.filter((s): s is string => !!s)
      : [];
  const isVisualLayout = visualChecklist.length > 0;
  const totalSize = isVisualLayout ? visualChecklist.length : effectiveSampleSize;

  const isNumeric = criteriaType === 'numeric';
  const isText = criteriaType === 'text';
  const isChecklist = criteriaType === 'pass_fail' || criteriaType === 'visual';

  return (
    <div className="mt-4 border border-dashed border-emerald-300 rounded-xl bg-emerald-50/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide flex items-center gap-1.5">
          📝 Operator Recording Preview
        </div>
        <span className="text-[10px] text-emerald-600/70">read-only mock</span>
      </div>
      <div className="text-[10px] text-slate-500 mb-3">
        ตัวอย่าง UI ที่ operator จะเห็นในหน้า WO IPC recording
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-3">
        {/* Spec banner — matches SpecInfoCard in the recording page */}
        {isNumeric && calculatedMinMax && (
          <div className="text-[11px] bg-slate-50 border border-slate-100 rounded p-2">
            <span className="text-slate-500">Spec:</span>{' '}
            <span className="font-mono font-medium text-slate-800">
              {calculatedMinMax.min} – {calculatedMinMax.max}
            </span>
            {formData.unit && <span className="text-slate-500 ml-1">{formData.unit}</span>}
          </div>
        )}

        {/* Numeric — single value */}
        {isNumeric && totalSize <= 1 && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Measured Value {formData.unit ? `(${formData.unit})` : ''}
            </label>
            <div className="h-9 border border-slate-300 rounded bg-slate-50 px-3 flex items-center text-slate-400 text-xs">
              0.00
            </div>
          </div>
        )}

        {/* Numeric — multi-sample grid (mirrors lines 944-970 of WO IPC page) */}
        {isNumeric && totalSize > 1 && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Sample Values ({totalSize} samples)
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: Math.min(totalSize, 25) }).map((_, idx) => (
                <div key={idx} className={idx === 0 ? '' : 'opacity-40'}>
                  <label className="block text-[10px] text-slate-500 mb-0.5">#{idx + 1}</label>
                  <div className="h-7 border border-slate-300 rounded bg-slate-50 px-1.5 flex items-center text-slate-400 text-[10px]">
                    0.00
                  </div>
                </div>
              ))}
            </div>
            {totalSize > 25 && (
              <div className="mt-1 text-[10px] text-slate-400">
                + อีก {totalSize - 25} samples (ตัดการแสดงไว้ที่ 25 เพื่อความกระชับ)
              </div>
            )}
          </div>
        )}

        {/* Text — textarea preview */}
        {isText && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              ผลตรวจ (ข้อความ) <span className="text-red-500">*</span>
            </label>
            <div className="h-16 border border-slate-300 rounded bg-slate-50 p-2 text-[11px] text-slate-400">
              {specPayload?.type === 'text' && specPayload.example
                ? `เช่น ${specPayload.example}`
                : 'พิมพ์ผลที่บันทึก'}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">บันทึกเป็น sample #1 พร้อมข้อความ</p>
          </div>
        )}

        {/* Pass/Fail / Visual checklist */}
        {isChecklist && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label className="block text-xs font-medium text-slate-700">
                ผลการตรวจ ({totalSize} {isVisualLayout ? 'จุดตรวจ' : 'ตัวอย่าง'})
              </label>
              <div className="flex gap-1">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-600 text-white font-semibold">
                  ผ่านทั้งหมด
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-600 text-white font-semibold">
                  ไม่ผ่านทั้งหมด
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-300">
                  ล้างค่า
                </span>
              </div>
            </div>
            <div className={isVisualLayout ? 'space-y-1' : 'grid grid-cols-5 gap-1.5'}>
              {Array.from({ length: Math.min(totalSize, isVisualLayout ? 10 : 25) }).map((_, idx) => {
                const labelText = isVisualLayout
                  ? (visualChecklist[idx] || `#${idx + 1}`)
                  : `#${idx + 1}`;
                return (
                  <div
                    key={idx}
                    className={
                      isVisualLayout
                        ? 'flex items-center gap-1.5 bg-white border border-amber-200 rounded px-1.5 py-1'
                        : 'text-center'
                    }
                  >
                    <label
                      className={
                        isVisualLayout
                          ? 'flex-1 text-[10px] text-slate-700 font-medium truncate'
                          : 'block text-[10px] text-slate-500 mb-0.5'
                      }
                    >
                      {isVisualLayout && (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-amber-100 text-amber-700 text-[9px] font-bold mr-1">
                          {idx + 1}
                        </span>
                      )}
                      {labelText}
                    </label>
                    <div className="flex gap-0.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200">
                        ✓
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold border border-red-200">
                        ✕
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {totalSize > (isVisualLayout ? 10 : 25) && (
              <div className="mt-1 text-[10px] text-slate-400">
                + อีก {totalSize - (isVisualLayout ? 10 : 25)} รายการ
              </div>
            )}
            {/* Live result hint */}
            <div className="mt-2 text-[10px] text-slate-500 italic">
              ระบบจะแสดงผล Pass/Fail แบบเรียลไทม์
              {formData.tolerancePercent != null &&
                ` — Tolerance ±${formData.tolerancePercent}% (เสียได้ ${
                  acceptanceMath?.allowedFail ?? 0
                } / ${totalSize})`}
            </div>
          </div>
        )}

        {/* Catch-all for criteria types not yet supported in this preview */}
        {!isNumeric && !isText && !isChecklist && (
          <div className="text-[11px] text-slate-400 italic text-center py-3">
            Preview สำหรับ criteria type &quot;{criteriaType}&quot; ยังไม่รองรับ
          </div>
        )}
      </div>
    </div>
  );
}

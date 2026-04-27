'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ResponsivePageHeader } from '@/components/shared';
import { SearchableSelect, type SearchableSelectOption } from '@/components/master-data/SearchableSelect';
import { FlaskConical, Shield, Eye, FileText, Layers, Dice5, Plus, Trash2, AlertTriangle, Sparkles, ArrowDown } from 'lucide-react';
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
  serializeSpecPayload,
  defaultPayload,
  type SpecPayload,
  type PassFailPayload,
  type VisualPayload,
  type TextPayload,
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

    // Serialize per-type payload back into specification field
    const specification = criteriaType === 'numeric' ? null : serializeSpecPayload(specPayload);

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

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-7xl mx-auto pb-24"
      style={{ fontFamily: 'var(--font-inter), var(--font-sarabun), system-ui, -apple-system, sans-serif' }}
    >
      <ResponsivePageHeader
        title={mode === 'edit' ? 'Edit IPC Criteria' : 'New IPC Criteria'}
        subtitle={mode === 'edit' ? `Editing ${initialData.name || ''}` : 'สร้างเกณฑ์ควบคุมคุณภาพระหว่างการผลิต (In-Process Control) ตามมาตรฐาน GMP / USP'}
        icon={FlaskConical}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'IPC Criteria', href: '/master-data/ipc-criteria' },
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
                  ]}
                  showClear={false}
                />
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

              {/* Section 3 — Sampling & Acceptance */}
              <SectionHeader number={3} thai="การสุ่มและเกณฑ์ยอมรับ" en="Sampling & Acceptance" />

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

              {/* Multi-Stage Acceptance panel */}
              <div className="sm:col-span-2 mt-2 rounded-2xl border-2 border-dashed border-emerald-200 bg-white p-5">
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

              {/* Section 4 — Settings */}
              <SectionHeader number={4} thai="การตั้งค่า" en="Settings" />

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

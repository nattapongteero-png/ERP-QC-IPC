'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { useToast } from '@/hooks/use-toast';
import { FlaskConical, Beaker, Eye, Sparkles, AlertTriangle, CheckCircle2, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const CUSTOM_OPTION_VALUE = '__custom__';

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
}

interface Props {
  mode: 'create' | 'edit';
  id?: number;
}

/**
 * Coerce MySQL decimal strings to numbers so DxNumberBox renders them correctly.
 * MySQL decimal columns come back over JSON as strings like "300.0000" — DxNumberBox
 * expects numbers. Booleans are normalized too (MySQL tinyint(1) arrives as 0/1).
 */
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
    specTarget: null, specTolerancePercent: 0,
  };

  return <IPCCriteriaFormInner key={id || 'new'} mode={mode} id={id} initialData={initialData} />;
}

function IPCCriteriaFormInner({ mode, id, initialData }: Props & { initialData: Partial<IPCCriteria> }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formData, setFormData] = React.useState<Partial<IPCCriteria>>(initialData);
  const [autoFilled, setAutoFilled] = React.useState<Set<string>>(new Set());
  const [autoFillNote, setAutoFillNote] = React.useState<string>('');
  const [isCustomName, setIsCustomName] = React.useState(() => {
    if (mode === 'edit' && initialData.name) {
      return !IPC_TEST_CATALOG.some((t) => t.nameEn === initialData.name);
    }
    return false;
  });
  const [showPreview, setShowPreview] = React.useState(true);

  const criteriaType = (formData.criteriaType || 'numeric') as CriteriaType;
  const typeMeta = CRITERIA_TYPE_META[criteriaType];

  // Test catalog filtered by selected dosage form. When no dosage form is
  // chosen, show all tests so users can browse the full catalog.
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

  // Sync calculated min/max into form fields as user adjusts target/tolerance.
  // Only applies to numeric criteria — other types do not use min/max.
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

  // Per-stage acceptance counts derived from sample size + tolerance.
  // Floor matches USP recommendation: "round down to next whole unit failure".
  const acceptanceMath = React.useMemo(() => {
    const n = Number(formData.sampleSize) || 0;
    const tol = Number(formData.tolerancePercent) || 0;
    if (n <= 0) return null;
    const allowed = Math.floor((n * tol) / 100);
    return { sampleSize: n, allowedFail: allowed, mustPass: n - allowed };
  }, [formData.sampleSize, formData.tolerancePercent]);

  const hasTarget = formData.specTarget !== null && formData.specTarget !== undefined;

  const handleSelectTest = (nameEn: string) => {
    if (nameEn === CUSTOM_OPTION_VALUE) {
      setIsCustomName(true);
      setFormData({ ...formData, name: '', nameTh: '' });
      setAutoFilled(new Set());
      setAutoFillNote('');
      return;
    }
    setIsCustomName(false);
    const test = findTestByName(nameEn);
    if (!test) return;

    const next: Partial<IPCCriteria> = { ...formData };
    const filled = new Set<string>();
    const filledLabels: string[] = [];

    next.name = test.nameEn;
    next.nameTh = test.nameTh;

    // Code — only auto-fill when blank, never overwrite user-typed code
    if (!formData.code?.trim()) {
      next.code = suggestCodeForTest(test);
      filled.add('code');
      filledLabels.push('Code');
    }

    if (!formData.unit) {
      next.unit = test.defaultUnit;
      filled.add('unit');
      if (test.defaultUnit) filledLabels.push('Unit');
    }

    next.criteriaType = test.defaultCriteriaType;
    filled.add('criteriaType');

    if (!formData.sampleSize || formData.sampleSize === 5) {
      next.sampleSize = test.defaultSampleSize;
      filled.add('sampleSize');
      filledLabels.push('Sample Size');
    }

    if (!formData.tolerancePercent) {
      next.tolerancePercent = test.defaultTolerancePercent;
      filled.add('tolerancePercent');
    }

    if (test.defaultCritical && !formData.isCritical) {
      next.isCritical = true;
      filled.add('isCritical');
      filledLabels.push('Critical');
    }

    setFormData(next);
    setAutoFilled(filled);
    setAutoFillNote(
      filledLabels.length > 0
        ? `เติมให้อัตโนมัติ: ${filledLabels.join(' · ')}`
        : ''
    );
  };

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<IPCCriteria>) => {
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
    saveMutation.mutate(formData);
  };

  const isAutoFilled = (field: string) => autoFilled.has(field);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-7xl mx-auto">
      <ResponsivePageHeader
        title={mode === 'edit' ? 'Edit IPC Criteria' : 'New IPC Criteria'}
        subtitle={mode === 'edit' ? `Editing ${initialData.name || ''}` : 'สร้างเกณฑ์ควบคุมคุณภาพระหว่างการผลิต (In-Process Control)'}
        icon={FlaskConical}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'IPC Criteria', href: '/master-data/ipc-criteria' },
          { label: mode === 'edit' ? 'Edit' : 'New' },
        ]}
        actions={
          <div className="flex gap-2">
            <DxButton
              text={showPreview ? 'Hide Preview' : 'Show Preview'}
              icon="eyeopen"
              stylingMode="outlined"
              onClick={() => setShowPreview((v) => !v)}
            />
            <DxButton text="Cancel" icon="back" stylingMode="outlined" onClick={() => router.push('/master-data/ipc-criteria')} />
            <DxButton text={saveMutation.isPending ? 'Saving...' : 'Save'} icon="save" type="success" onClick={handleSave} disabled={saveMutation.isPending} />
          </div>
        }
      />

      <div className={cn('grid gap-5', showPreview ? 'grid-cols-1 xl:grid-cols-3' : 'grid-cols-1')}>
        {/* ── Form Column ─────────────────────────────────────────────── */}
        <div className={cn('flex flex-col gap-5', showPreview ? 'xl:col-span-2' : '')}>
          {autoFillNote && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
              <Sparkles className="h-4 w-4" />
              <span>{autoFillNote}</span>
            </div>
          )}

          {/* ── Section 1: Basic Information ─────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">1</span>
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Test Name (searchable) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  หัวข้อการทดสอบ (Test Name) <span className="text-red-500">*</span>
                </label>
                <DxSelectBox
                  value={isCustomName ? CUSTOM_OPTION_VALUE : formData.name || ''}
                  onValueChanged={(e) => handleSelectTest(e.value)}
                  dataSource={[
                    ...filteredTests.map((t) => ({
                      value: t.nameEn,
                      display: `${t.nameEn} — ${t.nameTh}`,
                      category: t.category,
                    })),
                    { value: CUSTOM_OPTION_VALUE, display: '➕ เพิ่มหัวข้อใหม่ (Add Custom)', category: 'other' },
                  ]}
                  valueExpr="value"
                  displayExpr="display"
                  placeholder="พิมพ์เพื่อค้นหา หรือเลือกจากมาตรฐาน USP/Pharmacopoeia"
                  searchEnabled
                  showClearButton
                />
                {formData.name && !isCustomName && formData.nameTh && (
                  <p className="text-xs text-emerald-600 mt-1">
                    TH: {formData.nameTh}
                  </p>
                )}
              </div>

              {/* Custom name inputs */}
              {isCustomName && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name (EN) <span className="text-red-500">*</span></label>
                    <DxTextBox value={formData.name || ''} onValueChanged={(e) => setFormData({ ...formData, name: e.value })} placeholder="e.g., Custom Test Name" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ (TH)</label>
                    <DxTextBox value={formData.nameTh || ''} onValueChanged={(e) => setFormData({ ...formData, nameTh: e.value })} placeholder="เช่น หัวข้อทดสอบกำหนดเอง" />
                  </div>
                </div>
              )}

              {/* Code + Dosage Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code <span className="text-red-500">*</span>
                    {isAutoFilled('code') && <AutoBadge />}
                  </label>
                  <DxTextBox value={formData.code || ''} onValueChanged={(e) => setFormData({ ...formData, code: e.value })} placeholder="e.g., IPC-WV-001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">รูปแบบยา (Dosage Form)</label>
                  <DxSelectBox
                    value={formData.dosageForm || ''}
                    onValueChanged={(e) => setFormData({ ...formData, dosageForm: e.value || null })}
                    items={DOSAGE_FORM_OPTIONS}
                    valueExpr="value"
                    displayExpr="label"
                    placeholder="Select dosage form"
                    searchEnabled
                    showClearButton
                  />
                </div>
              </div>

              {/* Criteria Type — 4 buttons */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ประเภทเกณฑ์ (Criteria Type) <span className="text-red-500">*</span>
                  {isAutoFilled('criteriaType') && <AutoBadge />}
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(Object.keys(CRITERIA_TYPE_META) as CriteriaType[]).map((type) => {
                    const meta = CRITERIA_TYPE_META[type];
                    const active = criteriaType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, criteriaType: type })}
                        className={cn(
                          'text-left p-3 rounded-lg border-2 transition-all',
                          active
                            ? `${meta.bgColor} ${meta.textColor} border-current ring-2 ring-current/20`
                            : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                        )}
                      >
                        <div className="font-semibold text-sm">{meta.label}</div>
                        <div className="text-xs mt-0.5 opacity-80">{meta.desc}</div>
                      </button>
                    );
                  })}
                </div>
                <div className={cn('mt-2 text-xs px-2 py-1 rounded inline-flex items-center gap-1', typeMeta.bgColor, typeMeta.textColor)}>
                  <Activity className="h-3 w-3" />
                  กำลังบันทึกประเภท: <strong>{typeMeta.label}</strong> — {typeMeta.desc}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Section 2: Specification (type-specific) ─────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">2</span>
                Specification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {criteriaType === 'numeric' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      หน่วย (Unit)
                      {isAutoFilled('unit') && <AutoBadge />}
                    </label>
                    <DxSelectBox
                      value={formData.unit || ''}
                      onValueChanged={(e) => setFormData({ ...formData, unit: e.value || '' })}
                      items={UNIT_OPTIONS}
                      valueExpr="value"
                      displayExpr="label"
                      placeholder="Select unit"
                      searchEnabled
                      showClearButton
                    />
                    <p className="text-xs text-gray-500 mt-1">หากต้องการหน่วยอื่น สามารถพิมพ์ในช่องค้นหา และเลือก -- ไม่ระบุหน่วย -- แล้วใช้ Specification field</p>
                  </div>

                  <div className="bg-emerald-50/40 border border-emerald-200 rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Beaker className="h-4 w-4 text-emerald-600" />
                      <h3 className="text-sm font-semibold text-emerald-900">
                        Specification Target & Tolerance
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Target *</label>
                        <DxNumberBox
                          value={formData.specTarget ?? undefined}
                          onValueChanged={(e) => setFormData({ ...formData, specTarget: e.value ?? null })}
                          placeholder="เช่น 300"
                          showClearButton
                        />
                        <p className="text-xs text-gray-500 mt-1">ค่าเป้าหมาย</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">±% Tolerance (Spec Range)</label>
                        <DxNumberBox
                          value={formData.specTolerancePercent ?? 0}
                          onValueChanged={(e) => setFormData({ ...formData, specTolerancePercent: e.value ?? 0 })}
                          min={0}
                          max={100}
                          format="#0.##'%'"
                        />
                        <p className="text-xs text-gray-500 mt-1">ช่วงยอมรับ ± % รอบค่าเป้าหมาย</p>
                      </div>
                    </div>
                    {hasTarget && calculatedMinMax && (
                      <div className="bg-white border border-emerald-300 rounded-lg px-3 py-2 text-sm">
                        <span className="text-emerald-800 font-medium">
                          ✓ Auto-calculated: <strong>{calculatedMinMax.min}</strong> ≤ value ≤ <strong>{calculatedMinMax.max}</strong>
                          {formData.unit ? ` ${formData.unit}` : ''}
                        </span>
                      </div>
                    )}
                    {hasTarget && !calculatedMinMax && (
                      <div className="bg-red-50 border border-red-300 rounded-lg px-3 py-2 text-sm text-red-700 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Target ต้องมากกว่า 0 และ Tolerance อยู่ระหว่าง 0–100
                      </div>
                    )}
                  </div>
                </>
              )}

              {criteriaType === 'pass_fail' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    <h3 className="text-sm font-semibold text-blue-900">Pass / Fail Criteria</h3>
                  </div>
                  <p className="text-sm text-blue-800">
                    Operator จะเห็น 2 ปุ่ม: <strong>ผ่าน (Pass)</strong> หรือ <strong>ไม่ผ่าน (Fail)</strong>
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-blue-900 mb-1">เงื่อนไขที่ถือว่าผ่าน (Pass Condition)</label>
                    <DxTextArea
                      value={formData.specification || ''}
                      onValueChanged={(e) => setFormData({ ...formData, specification: e.value })}
                      placeholder="เช่น ไม่พบเชื้อ E. coli ใน 1 g, จุดสารอ้างอิงปรากฏที่ตำแหน่งเดียวกัน"
                      height={80}
                    />
                  </div>
                </div>
              )}

              {criteriaType === 'visual' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-amber-600" />
                    <h3 className="text-sm font-semibold text-amber-900">Visual Inspection Checklist</h3>
                  </div>
                  <p className="text-sm text-amber-800">
                    Operator จะตรวจด้วยสายตาตามรายการที่ระบุ
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-amber-900 mb-1">รายการที่ต้องตรวจ (1 รายการต่อบรรทัด)</label>
                    <DxTextArea
                      value={formData.specification || ''}
                      onValueChanged={(e) => setFormData({ ...formData, specification: e.value })}
                      placeholder="ตัวอย่าง:&#10;- ไม่มีรอยร้าว&#10;- สีสม่ำเสมอตามมาตรฐาน&#10;- ไม่มีจุดดำ/สิ่งแปลกปลอม"
                      height={120}
                    />
                  </div>
                </div>
              )}

              {criteriaType === 'text' && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-slate-600" />
                    <h3 className="text-sm font-semibold text-slate-900">Text Specification</h3>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">รูปแบบหรือตัวอย่างที่คาดหวัง</label>
                    <DxTextArea
                      value={formData.specification || ''}
                      onValueChanged={(e) => setFormData({ ...formData, specification: e.value })}
                      placeholder="ระบุรูปแบบที่ operator ต้องบันทึก เช่น สี กลิ่น รสชาติ ฯลฯ"
                      height={100}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Section 3: Sampling Plan ────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">3</span>
                Sampling Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sample Size <span className="text-red-500">*</span>
                    {isAutoFilled('sampleSize') && <AutoBadge />}
                  </label>
                  <DxNumberBox
                    value={formData.sampleSize ?? 5}
                    onValueChanged={(e) => setFormData({ ...formData, sampleSize: Number(e.value) || 1 })}
                    min={1}
                    max={1000}
                    step={1}
                  />
                  <p className="text-xs text-gray-500 mt-1">จำนวนหน่วยที่ต้องสุ่มทดสอบ</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Failure Tolerance ±%
                  </label>
                  <DxNumberBox
                    value={formData.tolerancePercent ?? 0}
                    onValueChanged={(e) => setFormData({ ...formData, tolerancePercent: Number(e.value) || 0 })}
                    min={0}
                    max={100}
                    format="#0.##'%'"
                  />
                  <p className="text-xs text-gray-500 mt-1">ยอมให้ตัวอย่างเสียได้กี่ %</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Check Interval (min)
                  </label>
                  <DxNumberBox
                    value={formData.checkIntervalMinutes ?? 30}
                    onValueChanged={(e) => setFormData({ ...formData, checkIntervalMinutes: Number(e.value) || 30 })}
                    min={1}
                    max={1440}
                    step={5}
                  />
                  <p className="text-xs text-gray-500 mt-1">ระยะเวลาตรวจซ้ำ</p>
                </div>
              </div>

              {acceptanceMath && (
                <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <StatTile label="ทดสอบ" value={acceptanceMath.sampleSize} unit="ชิ้น" tone="default" />
                  <StatTile label="ยอมเสียได้" value={acceptanceMath.allowedFail} unit="ชิ้น" tone="warn" />
                  <StatTile label="ต้องผ่าน" value={acceptanceMath.mustPass} unit="ชิ้น" tone="success" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Section 4: Settings ──────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">4</span>
                Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sampling Method</label>
                <DxSelectBox
                  value={formData.testMethod || ''}
                  onValueChanged={(e) => setFormData({ ...formData, testMethod: e.value || null })}
                  items={SAMPLING_METHOD_OPTIONS}
                  valueExpr="value"
                  displayExpr="label"
                  placeholder="เลือกวิธีสุ่มตัวอย่าง"
                  searchEnabled
                  showClearButton
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ToggleCard
                  active={!!formData.isCritical}
                  onToggle={() => setFormData({ ...formData, isCritical: !formData.isCritical })}
                  title="Critical"
                  desc="Critical Quality Attribute (CQA) — ถ้าไม่ผ่าน batch fail"
                  activeColor="bg-red-50 border-red-300 text-red-700"
                  autoFilled={isAutoFilled('isCritical')}
                />
                <ToggleCard
                  active={formData.isActive !== false}
                  onToggle={() => setFormData({ ...formData, isActive: !(formData.isActive !== false) })}
                  title="Active"
                  desc="ใช้งานในระบบหรือไม่"
                  activeColor="bg-green-50 border-green-300 text-green-700"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Live Preview Panel ──────────────────────────────────────── */}
        {showPreview && (
          <div className="hidden xl:block">
            <div className="sticky top-4">
              <LivePreviewPanel formData={formData} acceptanceMath={acceptanceMath} calculatedMinMax={calculatedMinMax} />
            </div>
          </div>
        )}
      </div>

      {/* Mobile preview (below form) */}
      {showPreview && (
        <div className="xl:hidden">
          <LivePreviewPanel formData={formData} acceptanceMath={acceptanceMath} calculatedMinMax={calculatedMinMax} />
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────

function AutoBadge() {
  return (
    <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-medium">
      <Sparkles className="h-2.5 w-2.5" /> Auto
    </span>
  );
}

interface StatTileProps {
  label: string;
  value: number;
  unit: string;
  tone: 'default' | 'warn' | 'success';
}

function StatTile({ label, value, unit, tone }: StatTileProps) {
  const colors = {
    default: 'text-slate-700',
    warn: 'text-amber-700',
    success: 'text-green-700',
  };
  return (
    <div className="text-center">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={cn('text-2xl font-bold', colors[tone])}>{value}</div>
      <div className="text-xs text-slate-500">{unit}</div>
    </div>
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
        'flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all',
        active ? activeColor : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
      )}
    >
      <div className={cn(
        'mt-0.5 w-9 h-5 rounded-full transition-colors flex items-center px-0.5',
        active ? 'bg-current' : 'bg-gray-300'
      )}>
        <div className={cn(
          'h-4 w-4 rounded-full bg-white shadow transition-transform',
          active ? 'translate-x-4' : 'translate-x-0'
        )} />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-sm flex items-center">
          {title}
          {autoFilled && <AutoBadge />}
        </div>
        <div className="text-xs opacity-80 mt-0.5">{desc}</div>
      </div>
    </button>
  );
}

interface LivePreviewProps {
  formData: Partial<IPCCriteria>;
  acceptanceMath: { sampleSize: number; allowedFail: number; mustPass: number } | null;
  calculatedMinMax: { min: number; max: number } | null;
}

function LivePreviewPanel({ formData, acceptanceMath, calculatedMinMax }: LivePreviewProps) {
  const criteriaType = (formData.criteriaType || 'numeric') as CriteriaType;
  const typeMeta = CRITERIA_TYPE_META[criteriaType];

  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-emerald-50 to-blue-50">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Live Preview
        </CardTitle>
        <p className="text-xs text-gray-600 mt-1">
          ตัวอย่างที่ Operator จะเห็นจริง — อัปเดต real-time
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {/* Header */}
        <div className={cn('rounded-lg border-2 p-3', typeMeta.bgColor)}>
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="text-xs opacity-70">{formData.code || 'IPC-???-???'}</div>
              <div className="font-semibold truncate">{formData.name || '— Test Name —'}</div>
              {formData.nameTh && (
                <div className="text-xs opacity-80 truncate">{formData.nameTh}</div>
              )}
            </div>
            <div className="ml-2 flex flex-col gap-1 items-end">
              <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold', typeMeta.bgColor, typeMeta.textColor)}>
                {typeMeta.label}
              </span>
              {formData.isCritical && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
                  ⚠ Critical
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Type-specific preview */}
        {criteriaType === 'numeric' && (
          <div className="bg-white border rounded-lg p-3 space-y-2">
            <div className="text-xs font-medium text-gray-500">Specification</div>
            {formData.specTarget !== null && formData.specTarget !== undefined && calculatedMinMax ? (
              <div className="text-sm">
                <div className="font-mono text-emerald-700">
                  {calculatedMinMax.min} ≤ value ≤ {calculatedMinMax.max} {formData.unit}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Target: {formData.specTarget} ± {formData.specTolerancePercent || 0}%
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400">— ยังไม่ได้กำหนด target —</div>
            )}
          </div>
        )}

        {criteriaType === 'pass_fail' && (
          <div className="bg-white border rounded-lg p-3 space-y-2">
            <div className="text-xs font-medium text-gray-500">Pass Condition</div>
            <div className="text-sm whitespace-pre-wrap">
              {formData.specification || <span className="text-gray-400">— ยังไม่ได้ระบุเงื่อนไข —</span>}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button disabled className="bg-green-100 text-green-800 py-1.5 rounded text-sm font-medium opacity-70 cursor-not-allowed">
                ✓ ผ่าน
              </button>
              <button disabled className="bg-red-100 text-red-800 py-1.5 rounded text-sm font-medium opacity-70 cursor-not-allowed">
                ✗ ไม่ผ่าน
              </button>
            </div>
          </div>
        )}

        {criteriaType === 'visual' && (
          <div className="bg-white border rounded-lg p-3 space-y-2">
            <div className="text-xs font-medium text-gray-500">Checklist</div>
            {formData.specification ? (
              <ul className="space-y-1 text-sm">
                {formData.specification.split('\n').filter(Boolean).map((line, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <input type="checkbox" disabled className="mt-1" />
                    <span>{line.replace(/^[-•]\s*/, '')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-400">— ยังไม่ได้ระบุรายการ —</div>
            )}
          </div>
        )}

        {criteriaType === 'text' && (
          <div className="bg-white border rounded-lg p-3 space-y-2">
            <div className="text-xs font-medium text-gray-500">Expected Format</div>
            <div className="text-sm whitespace-pre-wrap text-gray-700">
              {formData.specification || <span className="text-gray-400">— ยังไม่ได้ระบุรูปแบบ —</span>}
            </div>
            <div className="bg-slate-50 rounded p-2 text-xs text-slate-500">
              Operator จะกรอกข้อความได้อิสระ
            </div>
          </div>
        )}

        {/* Sampling */}
        {acceptanceMath && (
          <div className="bg-white border rounded-lg p-3">
            <div className="text-xs font-medium text-gray-500 mb-1.5">Sampling Plan</div>
            <div className="grid grid-cols-3 gap-1 text-center">
              <div>
                <div className="text-xs text-slate-500">ทดสอบ</div>
                <div className="text-base font-bold text-slate-700">{acceptanceMath.sampleSize}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">ยอมเสีย</div>
                <div className="text-base font-bold text-amber-700">{acceptanceMath.allowedFail}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">ต้องผ่าน</div>
                <div className="text-base font-bold text-green-700">{acceptanceMath.mustPass}</div>
              </div>
            </div>
            {formData.testMethod && (
              <div className="mt-2 text-[11px] text-gray-500 truncate">
                Method: {SAMPLING_METHOD_OPTIONS.find((s) => s.value === formData.testMethod)?.label.split(' — ')[0] || formData.testMethod}
              </div>
            )}
          </div>
        )}

        {/* Footer status */}
        <div className="text-xs text-gray-500 italic flex items-center gap-1">
          <span className={cn('inline-block w-2 h-2 rounded-full', formData.isActive !== false ? 'bg-green-500' : 'bg-gray-400')} />
          Status: {formData.isActive !== false ? 'Active' : 'Inactive'}
          {formData.dosageForm && (
            <>
              <span className="mx-1">·</span>
              {DOSAGE_FORM_OPTIONS.find((d) => d.value === formData.dosageForm)?.label.split(' — ')[0] || formData.dosageForm}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Lock, Save, Check, X, Layers } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { CRITERIA_TYPE_META, type CriteriaType } from '@/lib/master-data/ipc-test-catalog';
import {
  parseSpecPayload,
  type SpecPayload,
  type MultiPointPayload,
  type CalibrationPayload,
  type CalculatedPayload,
  type CustomMultiFieldPayload,
} from '@/lib/master-data/ipc-spec-payload';
import { evaluateFormula } from '@/lib/utils/safe-formula';

interface Criteria {
  id: number;
  code: string;
  name: string;
  nameTh: string | null;
  unit: string | null;
  criteriaType: string;
  isCritical: boolean;
  isActive: boolean;
  specification: string | null;
  specTarget: number | null;
  specTolerancePercent: number;
  minValue: number | null;
  maxValue: number | null;
  tareSourceCriteriaId: number | null;
}

interface RecordingRound {
  id: number;
  criteriaId: number;
  batchNumber: string;
  roundNumber: number;
  reason: string | null;
  data: string;
  startedAt: string;
  submittedAt: string | null;
  passed: boolean | null;
  computedMean: number | null;
  outcomeNote: string | null;
}

interface TareLookupResult {
  criteria: Criteria | null;
  latestRound: RecordingRound | null;
  mean: number | null;
}

export default function IPCRecordPage() {
  const params = useParams<{ criteriaId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const criteriaId = Number(params.criteriaId);
  const initialRoundId = search.get('roundId');

  const { data: criteria } = useQuery<Criteria>({
    queryKey: ['criteria', criteriaId],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/ipc-criteria?id=${criteriaId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    enabled: Number.isFinite(criteriaId),
  });

  const { data: rounds = [] } = useQuery<RecordingRound[]>({
    queryKey: ['recording-rounds', criteriaId],
    queryFn: async () => {
      const res = await fetch(`/api/recording/rounds?criteriaId=${criteriaId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data || [];
    },
    enabled: Number.isFinite(criteriaId),
    refetchOnWindowFocus: false,
  });

  // Active round: prefer URL param, else latest in-progress, else latest submitted, else first
  const [activeRoundId, setActiveRoundId] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (rounds.length === 0) return;
    if (initialRoundId) {
      const id = Number(initialRoundId);
      if (rounds.some((r) => r.id === id)) {
        setActiveRoundId(id);
        return;
      }
    }
    const inProgress = rounds.find((r) => !r.submittedAt);
    if (inProgress) {
      setActiveRoundId(inProgress.id);
      return;
    }
    setActiveRoundId(rounds[rounds.length - 1].id);
  }, [rounds, initialRoundId]);

  const activeRound = rounds.find((r) => r.id === activeRoundId) ?? null;
  const isLocked = !!activeRound?.submittedAt;

  const criteriaType = (criteria?.criteriaType ?? 'numeric') as CriteriaType;
  const meta = CRITERIA_TYPE_META[criteriaType] ?? CRITERIA_TYPE_META.numeric;
  const spec = React.useMemo<SpecPayload | null>(
    () => criteria ? parseSpecPayload(criteria.criteriaType, criteria.specification) : null,
    [criteria],
  );

  // Local form state for the active in-progress round
  const [formData, setFormData] = React.useState<Record<string, unknown>>({});
  React.useEffect(() => {
    if (!activeRound) return;
    try {
      setFormData(JSON.parse(activeRound.data || '{}'));
    } catch {
      setFormData({});
    }
  }, [activeRound]);

  // Auto-save (debounced) when formData changes for an in-progress round
  const saveData = useMutation({
    mutationFn: async (vars: { roundId: number; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/recording/rounds/${vars.roundId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: vars.data }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'save failed');
      return json.data as RecordingRound;
    },
  });
  React.useEffect(() => {
    if (!activeRound || isLocked) return;
    const t = setTimeout(() => {
      saveData.mutate({ roundId: activeRound.id, data: formData });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, activeRound?.id, isLocked]);

  const submitMutation = useMutation({
    mutationFn: async (roundId: number) => {
      const res = await fetch(`/api/recording/rounds/${roundId}/submit`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'submit failed');
      return json.data as RecordingRound;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recording-rounds', criteriaId] });
      qc.invalidateQueries({ queryKey: ['ipc-recording-rounds-all'] });
      toast.success('ส่งผลแล้ว', 'รอบนี้ถูกล็อก ไม่สามารถแก้ไขได้');
    },
    onError: (e: Error) => toast.error('ส่งผลไม่สำเร็จ', e.message),
  });

  if (!criteria || !Number.isFinite(criteriaId)) {
    return (
      <MainLayout>
        <div className="p-8 text-center text-slate-500">Loading criteria...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto pb-32">
        <button
          type="button"
          onClick={() => router.push('/ipc-recording')}
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> รายการ
        </button>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 mb-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-mono text-xs font-bold text-slate-900">{criteria.code}</span>
            <span className={cn('text-[10px] uppercase font-bold px-1.5 py-0.5 rounded', meta.bgColor, meta.textColor)}>
              {meta.label}
            </span>
            {criteria.isCritical && (
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800">! CRITICAL</span>
            )}
          </div>
          <h1 className="text-lg font-bold text-slate-900">{criteria.nameTh || criteria.name}</h1>
        </div>

        {/* Round tabs */}
        <RoundTabs
          rounds={rounds}
          activeId={activeRoundId}
          onSelect={setActiveRoundId}
        />

        {!activeRound ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500">
            ยังไม่มีรอบบันทึก — กลับไปหน้ารายการเพื่อกด "+ รอบใหม่"
          </div>
        ) : (
          <>
            {isLocked && (
              <div className="mt-3 rounded-xl bg-slate-100 border border-slate-200 px-4 py-3 flex items-center gap-2 text-sm text-slate-700">
                <Lock className="w-4 h-4 flex-shrink-0" />
                <span>
                  รอบนี้ส่งผลไปแล้วเมื่อ {activeRound.submittedAt} — ดูได้แต่แก้ไขไม่ได้
                  {activeRound.passed != null && (
                    <span className={cn(
                      'ml-2 px-2 py-0.5 rounded text-xs font-bold',
                      activeRound.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800',
                    )}>
                      {activeRound.passed ? '✓ PASS' : '✕ FAIL'}
                    </span>
                  )}
                </span>
              </div>
            )}

            <div className={cn('mt-4 rounded-2xl border border-slate-200 bg-white p-5', isLocked && 'pointer-events-none opacity-70')}>
              <RecorderByType
                criteria={criteria}
                spec={spec}
                value={formData}
                onChange={setFormData}
              />
            </div>

            {/* Sticky footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 z-30">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
                <div className="text-xs text-slate-500 truncate">
                  {isLocked ? (
                    <span className="flex items-center gap-1.5"><Lock className="w-3 h-3" /> ล็อกแล้ว</span>
                  ) : saveData.isPending ? (
                    <span className="flex items-center gap-1.5"><Save className="w-3 h-3 animate-pulse" /> กำลังบันทึกอัตโนมัติ...</span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      บันทึกอัตโนมัติแล้ว
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={isLocked || submitMutation.isPending}
                  onClick={() => submitMutation.mutate(activeRound.id)}
                  className="px-5 py-2.5 rounded-[10px] bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLocked ? 'ส่งแล้ว' : submitMutation.isPending ? 'กำลังส่ง...' : 'ส่งผล'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}

// ── Round tabs ─────────────────────────────────────────────────────
function RoundTabs({ rounds, activeId, onSelect }: { rounds: RecordingRound[]; activeId: number | null; onSelect: (id: number) => void }) {
  if (rounds.length === 0) return null;
  const submittedCount = rounds.filter((r) => r.submittedAt).length;
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-700">รอบการบันทึก ({submittedCount}/{rounds.length} ส่งแล้ว)</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {rounds.map((r) => {
          const isActive = r.id === activeId;
          const submitted = !!r.submittedAt;
          return (
            <button
              type="button"
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={cn(
                'flex-shrink-0 min-w-[120px] px-3 py-2 rounded-xl border text-left transition',
                isActive
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : submitted
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
              )}
            >
              <div className="text-xs font-semibold">รอบ {r.roundNumber}</div>
              <div className={cn('text-[10px] opacity-80 mt-0.5', isActive && 'opacity-90')}>
                {submitted ? '✓ ส่งแล้ว' : '• กำลังบันทึก'}
              </div>
              {r.reason && (
                <div className={cn('text-[10px] mt-0.5 truncate max-w-[120px]', isActive ? 'text-emerald-100' : 'text-slate-500')}>
                  {r.reason}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Recorder switch ────────────────────────────────────────────────
function RecorderByType({
  criteria,
  spec,
  value,
  onChange,
}: {
  criteria: Criteria;
  spec: SpecPayload | null;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const type = criteria.criteriaType;
  if (type === 'numeric' || type === 'tare') {
    return <NumericRecorder criteria={criteria} value={value} onChange={onChange} />;
  }
  if (type === 'pass_fail') {
    return <PassFailRecorder spec={spec} value={value} onChange={onChange} />;
  }
  if (type === 'visual') {
    return <VisualRecorder spec={spec} value={value} onChange={onChange} />;
  }
  if (type === 'text') {
    return <TextRecorder spec={spec} value={value} onChange={onChange} />;
  }
  if (type === 'multi_point' && spec?.type === 'multi_point') {
    return <MultiPointRecorder criteria={criteria} spec={spec} value={value} onChange={onChange} />;
  }
  if (type === 'calibration' && spec?.type === 'calibration') {
    return <CalibrationRecorder spec={spec} value={value} onChange={onChange} />;
  }
  if (type === 'calculated' && spec?.type === 'calculated') {
    return <CalculatedRecorder spec={spec} value={value} onChange={onChange} />;
  }
  if (type === 'custom_multi_field' && spec?.type === 'custom_multi_field') {
    return <CustomFieldsRecorder spec={spec} value={value} onChange={onChange} />;
  }
  return <div className="text-sm text-slate-500">ยังไม่รองรับประเภทนี้ ({type})</div>;
}

// ── Calibration recorder ───────────────────────────────────────────
function CalibrationRecorder({
  spec, value, onChange,
}: { spec: CalibrationPayload; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const v = String(value.value ?? '');
  const measured = Number(v);
  const standard = Number(spec.standardValue);
  const tol = Number(spec.toleranceValue);
  let inRange: boolean | null = null;
  if (Number.isFinite(measured) && Number.isFinite(standard) && Number.isFinite(tol)) {
    const limit = spec.toleranceType === 'percent' ? standard * (tol / 100) : tol;
    inRange = Math.abs(measured - standard) <= limit;
  }
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-purple-50 border border-purple-200 px-4 py-3 text-sm">
        <div className="font-bold text-purple-900">{spec.instrumentName} {spec.instrumentId && <span className="text-xs text-purple-600">({spec.instrumentId})</span>}</div>
        <div className="text-purple-700 text-xs">
          Standard: <span className="font-mono">{spec.standardValue} {spec.standardUnit}</span>
          {' · '}Tolerance: ±{spec.toleranceValue}{spec.toleranceType === 'percent' ? '%' : ' ' + spec.standardUnit}
        </div>
        {spec.nextDueDate && (
          <div className="text-[11px] text-purple-600 mt-1">Next due: {spec.nextDueDate}</div>
        )}
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">ค่าที่วัดได้ ({spec.standardUnit})</label>
        <input type="number" step="any"
          className={cn(
            'w-full px-4 py-3 text-2xl font-mono rounded-xl border-2 outline-none',
            v === '' ? 'border-slate-200 bg-white' :
            inRange ? 'border-emerald-400 bg-emerald-50' : 'border-red-400 bg-red-50',
          )}
          placeholder={spec.standardValue}
          value={v}
          onChange={(e) => onChange({ ...value, value: e.target.value })} />
        {inRange != null && (
          <div className={cn('mt-2 text-xs font-medium', inRange ? 'text-emerald-700' : 'text-red-700')}>
            {inRange ? '✓ ผ่าน calibration' : '✕ นอกช่วงยอมรับ — ห้ามใช้งาน instrument'}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Calculated recorder ────────────────────────────────────────────
function CalculatedRecorder({
  spec, value, onChange,
}: { spec: CalculatedPayload; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const inputs: Record<string, string> = (value.inputs as Record<string, string>) ?? {};

  // Build vars map from inputs (operator-entered) + constants (from spec)
  const vars: Record<string, number> = {};
  for (const inp of spec.inputs) {
    if (!inp.name) continue;
    if (inp.source === 'constant') {
      const n = Number(inp.constantValue);
      if (Number.isFinite(n)) vars[inp.name] = n;
    } else {
      const raw = inputs[inp.id];
      const n = Number(raw);
      if (Number.isFinite(n)) vars[inp.name] = n;
    }
  }

  const allFilled = spec.inputs
    .filter((i) => i.source !== 'constant')
    .every((i) => i.name && inputs[i.id] != null && inputs[i.id] !== '');
  const result = allFilled ? evaluateFormula(spec.formula, vars) : null;
  const decimals = Math.max(0, Math.min(6, Number(spec.displayDecimals) || 2));
  const min = spec.resultMin === '' ? null : Number(spec.resultMin);
  const max = spec.resultMax === '' ? null : Number(spec.resultMax);
  const inRange = result != null && (min == null || result >= min) && (max == null || result <= max);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm">
        <div className="font-bold text-indigo-900 mb-1">Formula</div>
        <div className="font-mono text-xs text-indigo-700 bg-white px-2 py-1 rounded border border-indigo-200">{spec.formula}</div>
        {(min != null || max != null) && (
          <div className="text-xs text-indigo-700 mt-2">
            Acceptance: <span className="font-mono">{min ?? '—'} ≤ result ≤ {max ?? '—'} {spec.resultUnit}</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {spec.inputs.map((inp) => {
          const isConst = inp.source === 'constant';
          const v = String(inputs[inp.id] ?? '');
          return (
            <div key={inp.id} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center p-3 rounded-xl border border-slate-200 bg-white">
              <div>
                <div className="text-xs font-semibold text-slate-700">{inp.name || '(no name)'}</div>
                <div className="text-[10px] text-slate-500">
                  {isConst ? `constant = ${inp.constantValue}` : `from ${inp.criteriaCode || 'this step'}`}
                </div>
              </div>
              <div className="sm:col-span-2">
                {isConst ? (
                  <div className="font-mono text-sm text-slate-500">{inp.constantValue}</div>
                ) : (
                  <input type="number" step="any"
                    className="w-full px-3 py-2 text-base font-mono rounded-lg border border-slate-200 focus:border-indigo-500 outline-none"
                    placeholder="0"
                    value={v}
                    onChange={(e) => onChange({ ...value, inputs: { ...inputs, [inp.id]: e.target.value } })} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Result */}
      <div className={cn(
        'rounded-xl border-2 px-4 py-4',
        result == null ? 'border-slate-200 bg-slate-50' :
        inRange ? 'border-emerald-400 bg-emerald-50' : 'border-red-400 bg-red-50',
      )}>
        <div className="text-xs font-semibold text-slate-600 mb-1">Auto Result</div>
        <div className="font-mono text-3xl font-bold text-slate-900">
          {result != null ? result.toFixed(decimals) : '—'} {spec.resultUnit}
        </div>
        {result != null && (
          <div className={cn('mt-1 text-sm font-medium', inRange ? 'text-emerald-700' : 'text-red-700')}>
            {inRange ? '✓ ผ่าน' : '✕ นอกช่วงยอมรับ'}
          </div>
        )}
        {!allFilled && (
          <div className="text-xs text-slate-500 mt-1">กรอก input ให้ครบเพื่อคำนวณ</div>
        )}
      </div>
    </div>
  );
}

// ── Custom Multi-Field recorder ────────────────────────────────────
function CustomFieldsRecorder({
  spec, value, onChange,
}: { spec: CustomMultiFieldPayload; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const values: Record<string, string> = (value.values as Record<string, string>) ?? {};
  return (
    <div className="space-y-4">
      {spec.generalNote && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800">
          {spec.generalNote}
        </div>
      )}
      <div className="space-y-3">
        {spec.fields.map((f) => {
          const v = values[f.id] ?? '';
          let status: { ok: boolean | null; hint: string } = { ok: null, hint: '' };
          if (f.fieldType === 'number' && v !== '') {
            const n = Number(v);
            const target = Number(f.target);
            const tol = Number(f.tolerance);
            if (Number.isFinite(n) && Number.isFinite(target) && Number.isFinite(tol)) {
              const limit = target * (tol / 100);
              status = {
                ok: Math.abs(n - target) <= limit,
                hint: `target ${target} ± ${tol}%`,
              };
            }
          }
          return (
            <div key={f.id} className={cn(
              'rounded-xl border-2 p-3',
              status.ok == null ? 'border-slate-200 bg-white' :
              status.ok ? 'border-emerald-400 bg-emerald-50' : 'border-red-400 bg-red-50',
            )}>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1">
                {f.label} {f.required && <span className="text-red-500">*</span>}
                {f.unit && <span className="text-xs text-slate-500 font-normal">({f.unit})</span>}
                {status.hint && <span className="text-[10px] text-slate-400 ml-auto">{status.hint}</span>}
              </label>
              {f.fieldType === 'number' && (
                <input type="number" step="any"
                  className="w-full px-3 py-2 text-base font-mono rounded-lg border border-slate-200 focus:border-rose-500 outline-none"
                  value={v}
                  onChange={(e) => onChange({ ...value, values: { ...values, [f.id]: e.target.value } })} />
              )}
              {f.fieldType === 'text' && (
                <input className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-rose-500 outline-none"
                  value={v}
                  onChange={(e) => onChange({ ...value, values: { ...values, [f.id]: e.target.value } })} />
              )}
              {f.fieldType === 'select' && (
                <select className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-rose-500 outline-none"
                  value={v}
                  onChange={(e) => onChange({ ...value, values: { ...values, [f.id]: e.target.value } })}>
                  <option value="">— เลือก —</option>
                  {f.options.split(',').map((o) => o.trim()).filter(Boolean).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              )}
              {f.note && <div className="text-[10px] text-slate-400 mt-1">{f.note}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Numeric / Tare ─────────────────────────────────────────────────
function NumericRecorder({ criteria, value, onChange }: { criteria: Criteria; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const v = String(value.value ?? '');
  const n = Number(v);
  const inRange = Number.isFinite(n) &&
    (criteria.minValue == null || n >= criteria.minValue) &&
    (criteria.maxValue == null || n <= criteria.maxValue);
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200 px-4 py-3 text-sm">
        <span className="font-semibold text-emerald-800">ช่วงยอมรับ:</span>{' '}
        <span className="font-mono text-emerald-700">
          {criteria.minValue ?? '—'} ≤ value ≤ {criteria.maxValue ?? '—'} {criteria.unit ?? ''}
        </span>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">ค่าวัด ({criteria.unit ?? ''})</label>
        <input
          type="number"
          step="any"
          className={cn(
            'w-full px-4 py-3 text-2xl font-mono rounded-xl border-2 transition outline-none',
            v === '' ? 'border-slate-200 bg-white' : inRange ? 'border-emerald-400 bg-emerald-50' : 'border-red-400 bg-red-50',
          )}
          placeholder="0.0000"
          value={v}
          onChange={(e) => onChange({ ...value, value: e.target.value })}
        />
        {v !== '' && (
          <div className={cn('mt-2 text-xs font-medium', inRange ? 'text-emerald-700' : 'text-red-700')}>
            {inRange ? '✓ อยู่ในช่วงยอมรับ' : '✕ อยู่นอกช่วงยอมรับ'}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pass / Fail ────────────────────────────────────────────────────
function PassFailRecorder({ spec, value, onChange }: { spec: SpecPayload | null; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const v = String(value.value ?? '');
  const pass = spec?.type === 'pass_fail' ? spec.passDefinition : 'ผ่านเกณฑ์';
  const fail = spec?.type === 'pass_fail' ? spec.failDefinition : 'ไม่ผ่านเกณฑ์';
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
          <div className="text-xs font-bold text-emerald-800 mb-1">PASS</div>
          <div className="text-sm text-emerald-700">{pass}</div>
        </div>
        <div className="rounded-xl bg-red-50 border border-red-200 p-3">
          <div className="text-xs font-bold text-red-800 mb-1">FAIL</div>
          <div className="text-sm text-red-700">{fail}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange({ ...value, value: 'pass' })}
          className={cn(
            'py-6 rounded-xl border-2 font-bold text-xl transition',
            v === 'pass' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400',
          )}
        >
          <Check className="w-6 h-6 inline mr-2" /> PASS
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...value, value: 'fail' })}
          className={cn(
            'py-6 rounded-xl border-2 font-bold text-xl transition',
            v === 'fail' ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-red-400',
          )}
        >
          <X className="w-6 h-6 inline mr-2" /> FAIL
        </button>
      </div>
    </div>
  );
}

// ── Visual ─────────────────────────────────────────────────────────
function VisualRecorder({ spec, value, onChange }: { spec: SpecPayload | null; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const checklist = spec?.type === 'visual' ? spec.checklist : [];
  const description = spec?.type === 'visual' ? spec.description : '';
  const checks: Record<string, boolean> = (value.checks as Record<string, boolean>) ?? {};
  const checkedCount = Object.values(checks).filter(Boolean).length;
  return (
    <div className="space-y-4">
      {description && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          {description}
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Checklist</span>
        <span className={cn(
          'text-xs font-semibold px-2 py-0.5 rounded',
          checkedCount === checklist.length && checklist.length > 0
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-slate-100 text-slate-600',
        )}>
          {checkedCount}/{checklist.length}{checkedCount === checklist.length && checklist.length > 0 ? ' ✓ ครบทุกข้อ' : ''}
        </span>
      </div>
      <div className="space-y-2">
        {checklist.map((item, idx) => {
          const on = checks[idx] === true;
          return (
            <button
              type="button"
              key={idx}
              onClick={() => onChange({ ...value, checks: { ...checks, [idx]: !on } })}
              className={cn(
                'w-full px-4 py-3 rounded-xl border-2 text-left text-sm font-medium transition flex items-center gap-3',
                on ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300',
              )}
            >
              <span className={cn(
                'w-6 h-6 rounded flex items-center justify-center flex-shrink-0',
                on ? 'bg-white text-emerald-600' : 'bg-slate-100 text-slate-400',
              )}>
                {on && <Check className="w-4 h-4" />}
              </span>
              <span className="flex-1">{item}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Text ───────────────────────────────────────────────────────────
function TextRecorder({ spec, value, onChange }: { spec: SpecPayload | null; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const format = spec?.type === 'text' ? spec.format : '';
  const example = spec?.type === 'text' ? spec.example : '';
  const v = String(value.value ?? '');
  return (
    <div className="space-y-4">
      {format && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700">
          <span className="font-semibold">รูปแบบ:</span> {format}
          {example && <div className="text-xs text-slate-500 mt-1">ตัวอย่าง: {example}</div>}
        </div>
      )}
      <textarea
        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-emerald-500 outline-none text-sm min-h-[120px] resize-y"
        placeholder="พิมพ์ข้อความบันทึก..."
        value={v}
        onChange={(e) => onChange({ ...value, value: e.target.value })}
      />
      <div className="text-xs text-slate-500">{v.length} ตัวอักษร</div>
    </div>
  );
}

// ── Multi-Point ────────────────────────────────────────────────────
function MultiPointRecorder({
  criteria,
  spec,
  value,
  onChange,
}: {
  criteria: Criteria;
  spec: MultiPointPayload;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const pointCount = Math.max(2, Math.min(200, Number(spec.pointCount) || 20));
  const points: string[] = Array.isArray(value.points) ? (value.points as string[]) : [];

  // Tare lookup (only when tareSourceCode set)
  const { data: tareLookup } = useQuery<TareLookupResult>({
    queryKey: ['tare-lookup', spec.tareSourceCode],
    queryFn: async () => {
      const res = await fetch(`/api/recording/tare-lookup?code=${encodeURIComponent(spec.tareSourceCode)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    enabled: !!spec.tareSourceCode,
    staleTime: 30_000,
  });
  const tareMean = tareLookup?.mean ?? null;
  const usingTare = !!spec.tareSourceCode;

  const target = Number(spec.perPointTarget);
  const tol = Number(spec.perPointTolerance);
  const min = Number.isFinite(target) && Number.isFinite(tol) ? target * (1 - tol / 100) : null;
  const max = Number.isFinite(target) && Number.isFinite(tol) ? target * (1 + tol / 100) : null;

  const updatePoint = (idx: number, v: string) => {
    const next = points.slice();
    while (next.length < pointCount) next.push('');
    next[idx] = v;
    onChange({ ...value, points: next });
  };

  const filledCount = points.filter((p) => p !== '' && Number.isFinite(Number(p))).length;
  const validNums = points.map(Number).filter((n) => Number.isFinite(n));

  let aggregateStatus: { passed: boolean | null; meanGross: number | null; meanNet: number | null } = {
    passed: null, meanGross: null, meanNet: null,
  };
  if (filledCount === pointCount && validNums.length === pointCount) {
    const meanGross = validNums.reduce((a, b) => a + b, 0) / validNums.length;
    const meanNet = tareMean != null ? meanGross - tareMean : null;
    const checkValue = (n: number) => {
      const vv = usingTare && tareMean != null ? n - tareMean : n;
      return (min == null || vv >= min) && (max == null || vv <= max);
    };
    let passed: boolean | null = null;
    if (spec.aggregateRule === 'all_pass' || spec.aggregateRule === 'min_max') {
      passed = validNums.every(checkValue);
    } else if (spec.aggregateRule === 'mean') {
      const checkMean = meanNet ?? meanGross;
      passed = (min == null || checkMean >= min) && (max == null || checkMean <= max);
    }
    aggregateStatus = { passed, meanGross, meanNet };
  }

  return (
    <div className="space-y-4">
      {/* Tare banner */}
      {usingTare && (
        tareMean != null ? (
          <div className="rounded-xl bg-cyan-50 border border-cyan-300 px-4 py-3 text-sm flex items-start gap-2">
            <Layers className="w-4 h-4 text-cyan-700 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-cyan-900">⚖️ Tare หักลบอัตโนมัติ</div>
              <div className="font-mono text-lg font-bold text-cyan-700">{tareMean.toFixed(4)} {criteria.unit ?? ''}</div>
              <div className="text-xs text-cyan-700">
                จาก {spec.tareSourceCode} — รอบล่าสุดที่ส่งผล. Net = Gross − {tareMean.toFixed(4)}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 text-sm flex items-start gap-2">
            <Layers className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-900">⚠️ ต้องมีค่า Tare ก่อนบันทึก</div>
              <div className="text-xs text-amber-700">
                ยังไม่มีรอบที่ส่งผลของ Tare criteria: {spec.tareSourceCode}
              </div>
            </div>
          </div>
        )
      )}

      {/* Spec banner */}
      <div className="rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 px-4 py-3 text-sm">
        <div className="font-bold text-teal-900">{usingTare ? 'ค่า NET ที่ยอมรับต่อจุด' : 'ค่าที่ยอมรับต่อจุด'}</div>
        <div className="font-mono text-teal-700">
          {min?.toFixed(4) ?? '—'} ≤ value ≤ {max?.toFixed(4) ?? '—'} {criteria.unit ?? ''}
          {' '}({target} ± {tol}%)
        </div>
        <div className="text-xs text-teal-600 mt-1">
          Rule: <strong>{spec.aggregateRule.toUpperCase()}</strong>
          {spec.aggregateLimit && ` · range ${spec.aggregateLimit}`}
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">
          {spec.pointLabel || 'จุด'} ({filledCount}/{pointCount})
        </span>
        <div className="flex-1 mx-3 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(filledCount / pointCount) * 100}%` }} />
        </div>
        <span className="text-xs text-slate-500">{Math.round((filledCount / pointCount) * 100)}%</span>
      </div>

      {/* Cells grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {Array.from({ length: pointCount }, (_, idx) => {
          const v = points[idx] ?? '';
          const n = Number(v);
          const hasValue = v !== '' && Number.isFinite(n);
          const net = hasValue && tareMean != null ? n - tareMean : null;
          const checkV = net ?? (hasValue ? n : null);
          const inRange = checkV != null && (min == null || checkV >= min) && (max == null || checkV <= max);
          const stateClass = !hasValue
            ? 'border-slate-200 bg-white'
            : inRange
            ? 'border-emerald-400 bg-emerald-50'
            : 'border-red-400 bg-red-50';
          return (
            <div key={idx} className={cn('rounded-xl border-2 px-3 py-2', stateClass)}>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                <span>{(spec.pointLabel || 'จุด')} {idx + 1}</span>
                {hasValue && (inRange ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-red-600" />)}
              </div>
              <input
                type="number"
                step="any"
                className="w-full px-2 py-1 text-sm font-mono border-0 bg-transparent focus:outline-none"
                placeholder={usingTare ? 'Gross' : 'value'}
                value={v}
                onChange={(e) => updatePoint(idx, e.target.value)}
              />
              {usingTare && hasValue && net != null && (
                <div className="text-[10px] text-cyan-700 font-mono mt-0.5">Net: {net.toFixed(4)}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Aggregate result */}
      {filledCount === pointCount && (
        <div className={cn(
          'rounded-xl border-2 px-4 py-3',
          aggregateStatus.passed == null ? 'border-slate-200 bg-slate-50' :
          aggregateStatus.passed ? 'border-emerald-400 bg-emerald-50' : 'border-red-400 bg-red-50',
        )}>
          <div className="text-xs font-semibold text-slate-600 mb-1">ผลรวม (auto) — Rule: {spec.aggregateRule}</div>
          {aggregateStatus.meanGross != null && (
            <div className="font-mono text-sm">Mean (Gross): <span className="font-bold">{aggregateStatus.meanGross.toFixed(4)}</span></div>
          )}
          {aggregateStatus.meanNet != null && (
            <div className="font-mono text-lg">Mean (Net): <span className="font-bold text-cyan-700">{aggregateStatus.meanNet.toFixed(4)}</span></div>
          )}
          <div className={cn(
            'mt-1 text-sm font-bold',
            aggregateStatus.passed == null ? 'text-slate-500' :
            aggregateStatus.passed ? 'text-emerald-700' : 'text-red-700',
          )}>
            {aggregateStatus.passed == null ? 'รอข้อมูล' : aggregateStatus.passed ? '✓ ผ่าน' : '✕ ไม่ผ่าน'}
          </div>
        </div>
      )}
    </div>
  );
}

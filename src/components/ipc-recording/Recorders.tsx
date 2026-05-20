'use client';

/**
 * Shared IPC type-specific recorder components.
 *
 * Used by both the WO IPC tab (/production/work-orders/[id]/ipc) and the SOP
 * step inline recorder (/production/work-orders/[id]/sop-execution). All
 * recorders operate on a free-form `value: Record<string, unknown>` so the
 * caller can persist to either `quality_tests` (legacy types) or
 * `ipc_recording_rounds` (new types) without coupling.
 *
 * Old types (numeric/pass_fail/visual/text) are NOT exported here — the
 * existing WO IPC tab already renders them with its per-sample model. These
 * recorders are for the 5 new types added in the redesign:
 *   - multi_point  (N points, optional tare cross-reference)
 *   - tare         (single value with acceptance min/max)
 *   - calibration  (single value vs standard ± tolerance)
 *   - calculated   (formula evaluator over named inputs)
 *   - custom_multi_field (typed fields: number/text/select)
 */

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, X, Layers } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type {
  MultiPointPayload,
  TarePayload,
  CalibrationPayload,
  CalculatedPayload,
  CustomMultiFieldPayload,
} from '@/lib/master-data/ipc-spec-payload';
import { evaluateFormula } from '@/lib/utils/safe-formula';

interface TareLookupResult {
  mean: number | null;
  latestRound: { submittedAt: string | null } | null;
}

// ── Multi-Point ────────────────────────────────────────────────────
export function MultiPointRecorder({
  spec,
  unit,
  value,
  onChange,
}: {
  spec: MultiPointPayload;
  unit: string;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const pointCount = Math.max(2, Math.min(200, Number(spec.pointCount) || 20));
  const points: string[] = Array.isArray(value.points) ? (value.points as string[]) : [];

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

  let agg: { passed: boolean | null; meanGross: number | null; meanNet: number | null } = {
    passed: null, meanGross: null, meanNet: null,
  };
  if (filledCount === pointCount && validNums.length === pointCount) {
    const meanGross = validNums.reduce((a, b) => a + b, 0) / validNums.length;
    const meanNet = tareMean != null ? meanGross - tareMean : null;
    const checkValue = (n: number) => {
      const v = usingTare && tareMean != null ? n - tareMean : n;
      return (min == null || v >= min) && (max == null || v <= max);
    };
    let passed: boolean | null = null;
    if (spec.aggregateRule === 'all_pass' || spec.aggregateRule === 'min_max') {
      passed = validNums.every(checkValue);
    } else if (spec.aggregateRule === 'mean') {
      const checkMean = meanNet ?? meanGross;
      passed = (min == null || checkMean >= min) && (max == null || checkMean <= max);
    }
    agg = { passed, meanGross, meanNet };
  }

  return (
    <div className="space-y-3">
      {usingTare && (
        tareMean != null ? (
          <div className="rounded-lg bg-cyan-50 border border-cyan-300 px-3 py-2 text-xs flex items-start gap-2">
            <Layers className="w-3.5 h-3.5 text-cyan-700 mt-0.5" />
            <div>
              <div className="font-bold text-cyan-900">⚖️ Tare หักลบอัตโนมัติ</div>
              <div className="font-mono text-sm font-bold text-cyan-700">{tareMean.toFixed(4)} {unit}</div>
              <div className="text-[10px] text-cyan-700">จาก {spec.tareSourceCode} — Net = Gross − {tareMean.toFixed(4)}</div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-amber-50 border border-amber-300 px-3 py-2 text-xs flex items-start gap-2">
            <Layers className="w-3.5 h-3.5 text-amber-700 mt-0.5" />
            <div>
              <div className="font-bold text-amber-900">⚠️ ยังไม่มี Tare ที่ส่งผล</div>
              <div className="text-[10px] text-amber-700">Tare criteria: {spec.tareSourceCode}</div>
            </div>
          </div>
        )
      )}

      <div className="rounded-lg bg-teal-50 border border-teal-200 px-3 py-2 text-xs">
        <div className="font-semibold text-teal-900">{usingTare ? 'ค่า NET ที่ยอมรับ' : 'ค่าที่ยอมรับ'}</div>
        <div className="font-mono text-teal-700">
          {min?.toFixed(4) ?? '—'} ≤ value ≤ {max?.toFixed(4) ?? '—'} {unit} ({target} ± {tol}%)
        </div>
        <div className="text-[10px] text-teal-600 mt-0.5">Rule: <strong>{spec.aggregateRule.toUpperCase()}</strong></div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700">{spec.pointLabel || 'จุด'} ({filledCount}/{pointCount})</span>
        <div className="flex-1 mx-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(filledCount / pointCount) * 100}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1.5">
        {Array.from({ length: pointCount }, (_, idx) => {
          const v = points[idx] ?? '';
          const n = Number(v);
          const hasValue = v !== '' && Number.isFinite(n);
          const net = hasValue && tareMean != null ? n - tareMean : null;
          const checkV = net ?? (hasValue ? n : null);
          const inRange = checkV != null && (min == null || checkV >= min) && (max == null || checkV <= max);
          return (
            <div key={idx} className={cn(
              'rounded border-2 px-2 py-1 text-xs',
              !hasValue ? 'border-slate-200 bg-white' : inRange ? 'border-emerald-400 bg-emerald-50' : 'border-red-400 bg-red-50',
            )}>
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>{idx + 1}</span>
                {hasValue && (inRange ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <X className="w-2.5 h-2.5 text-red-600" />)}
              </div>
              <input
                type="number" step="any"
                className="w-full px-1 py-0.5 text-xs font-mono border-0 bg-transparent focus:outline-none"
                placeholder={usingTare ? 'Gross' : ''}
                value={v}
                onChange={(e) => updatePoint(idx, e.target.value)}
              />
              {usingTare && hasValue && net != null && (
                <div className="text-[9px] text-cyan-700 font-mono">Net: {net.toFixed(3)}</div>
              )}
            </div>
          );
        })}
      </div>

      {filledCount === pointCount && (
        <div className={cn(
          'rounded-lg border-2 px-3 py-2 text-xs',
          agg.passed == null ? 'border-slate-200 bg-slate-50' :
          agg.passed ? 'border-emerald-400 bg-emerald-50' : 'border-red-400 bg-red-50',
        )}>
          <div className="text-[10px] font-semibold text-slate-600">Aggregate (auto) — {spec.aggregateRule}</div>
          {agg.meanGross != null && <div className="font-mono">Mean (Gross): <strong>{agg.meanGross.toFixed(4)}</strong></div>}
          {agg.meanNet != null && <div className="font-mono text-cyan-700">Mean (Net): <strong>{agg.meanNet.toFixed(4)}</strong></div>}
          <div className={cn(
            'mt-0.5 font-bold',
            agg.passed == null ? 'text-slate-500' : agg.passed ? 'text-emerald-700' : 'text-red-700',
          )}>
            {agg.passed == null ? 'รอข้อมูล' : agg.passed ? '✓ ผ่าน' : '✕ ไม่ผ่าน'}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tare ───────────────────────────────────────────────────────────
export function TareRecorder({
  spec,
  value,
  onChange,
}: {
  spec: TarePayload;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const v = String(value.value ?? '');
  const n = Number(v);
  const min = spec.acceptanceMin === '' ? null : Number(spec.acceptanceMin);
  const max = spec.acceptanceMax === '' ? null : Number(spec.acceptanceMax);
  const inRange = Number.isFinite(n) && (min == null || n >= min) && (max == null || n <= max);
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-cyan-50 border border-cyan-300 px-3 py-2 text-xs">
        <div className="font-semibold text-cyan-900">{spec.referenceLabel}</div>
        <div className="text-cyan-700">
          Acceptance: <span className="font-mono">{min ?? '—'} ≤ value ≤ {max ?? '—'} {spec.referenceUnit}</span>
        </div>
        {spec.storeAs && <div className="text-[10px] text-cyan-600 mt-0.5">stored as: {spec.storeAs}</div>}
      </div>
      <input
        type="number" step="any"
        className={cn(
          'w-full px-3 py-2 text-xl font-mono rounded-lg border-2 outline-none',
          v === '' ? 'border-slate-200 bg-white' : inRange ? 'border-emerald-400 bg-emerald-50' : 'border-red-400 bg-red-50',
        )}
        placeholder="0.0000"
        value={v}
        onChange={(e) => onChange({ ...value, value: e.target.value })}
      />
      {v !== '' && (
        <div className={cn('text-xs font-medium', inRange ? 'text-emerald-700' : 'text-red-700')}>
          {inRange ? '✓ อยู่ในช่วงยอมรับ' : '✕ อยู่นอกช่วงยอมรับ'}
        </div>
      )}
    </div>
  );
}

// ── Calibration ────────────────────────────────────────────────────
export function CalibrationRecorder({
  spec,
  value,
  onChange,
}: {
  spec: CalibrationPayload;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
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
    <div className="space-y-3">
      <div className="rounded-lg bg-purple-50 border border-purple-200 px-3 py-2 text-xs">
        <div className="font-semibold text-purple-900">{spec.instrumentName}{spec.instrumentId && ` (${spec.instrumentId})`}</div>
        <div className="text-purple-700">
          Standard: <span className="font-mono">{spec.standardValue} {spec.standardUnit}</span>
          {' · '}Tolerance: ±{spec.toleranceValue}{spec.toleranceType === 'percent' ? '%' : ` ${spec.standardUnit}`}
        </div>
        {spec.nextDueDate && <div className="text-[10px] text-purple-600 mt-0.5">Next due: {spec.nextDueDate}</div>}
      </div>
      <input
        type="number" step="any"
        className={cn(
          'w-full px-3 py-2 text-xl font-mono rounded-lg border-2 outline-none',
          v === '' ? 'border-slate-200 bg-white' :
          inRange ? 'border-emerald-400 bg-emerald-50' : 'border-red-400 bg-red-50',
        )}
        placeholder={spec.standardValue}
        value={v}
        onChange={(e) => onChange({ ...value, value: e.target.value })}
      />
      {inRange != null && (
        <div className={cn('text-xs font-medium', inRange ? 'text-emerald-700' : 'text-red-700')}>
          {inRange ? '✓ ผ่าน calibration' : '✕ นอกช่วงยอมรับ — ห้ามใช้งาน instrument'}
        </div>
      )}
    </div>
  );
}

// ── Calculated ─────────────────────────────────────────────────────
export function CalculatedRecorder({
  spec,
  value,
  onChange,
}: {
  spec: CalculatedPayload;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const inputs: Record<string, string> = (value.inputs as Record<string, string>) ?? {};
  const vars: Record<string, number> = {};
  for (const inp of spec.inputs) {
    if (!inp.name) continue;
    if (inp.source === 'constant') {
      const n = Number(inp.constantValue);
      if (Number.isFinite(n)) vars[inp.name] = n;
    } else {
      const n = Number(inputs[inp.id]);
      if (Number.isFinite(n)) vars[inp.name] = n;
    }
  }
  const allFilled = spec.inputs.filter((i) => i.source !== 'constant').every((i) => i.name && inputs[i.id] != null && inputs[i.id] !== '');
  const result = allFilled ? evaluateFormula(spec.formula, vars) : null;
  const decimals = Math.max(0, Math.min(6, Number(spec.displayDecimals) || 2));
  const min = spec.resultMin === '' ? null : Number(spec.resultMin);
  const max = spec.resultMax === '' ? null : Number(spec.resultMax);
  const inRange = result != null && (min == null || result >= min) && (max == null || result <= max);

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2 text-xs">
        <div className="font-semibold text-indigo-900">Formula</div>
        <div className="font-mono text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-indigo-200 mt-0.5">{spec.formula}</div>
        {(min != null || max != null) && (
          <div className="text-[10px] text-indigo-700 mt-1">
            Acceptance: <span className="font-mono">{min ?? '—'} ≤ result ≤ {max ?? '—'} {spec.resultUnit}</span>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        {spec.inputs.map((inp) => {
          const isConst = inp.source === 'constant';
          return (
            <div key={inp.id} className="grid grid-cols-3 gap-2 items-center px-2 py-1.5 rounded border border-slate-200 bg-white">
              <div>
                <div className="text-xs font-semibold text-slate-700">{inp.name || '(no name)'}</div>
                <div className="text-[9px] text-slate-500">{isConst ? `const = ${inp.constantValue}` : (inp.criteriaCode || 'this step')}</div>
              </div>
              <div className="col-span-2">
                {isConst ? (
                  <div className="font-mono text-xs text-slate-500">{inp.constantValue}</div>
                ) : (
                  <input
                    type="number" step="any"
                    className="w-full px-2 py-1 text-sm font-mono rounded border border-slate-200 focus:border-indigo-500 outline-none"
                    value={inputs[inp.id] ?? ''}
                    onChange={(e) => onChange({ ...value, inputs: { ...inputs, [inp.id]: e.target.value } })}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className={cn(
        'rounded-lg border-2 px-3 py-2',
        result == null ? 'border-slate-200 bg-slate-50' : inRange ? 'border-emerald-400 bg-emerald-50' : 'border-red-400 bg-red-50',
      )}>
        <div className="text-[10px] font-semibold text-slate-600">Auto Result</div>
        <div className="font-mono text-xl font-bold text-slate-900">
          {result != null ? result.toFixed(decimals) : '—'} {spec.resultUnit}
        </div>
        {result != null && (
          <div className={cn('text-xs font-medium', inRange ? 'text-emerald-700' : 'text-red-700')}>
            {inRange ? '✓ ผ่าน' : '✕ นอกช่วง'}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Custom Multi-Field ─────────────────────────────────────────────
export function CustomFieldsRecorder({
  spec,
  value,
  onChange,
}: {
  spec: CustomMultiFieldPayload;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const values: Record<string, string> = (value.values as Record<string, string>) ?? {};
  return (
    <div className="space-y-3">
      {spec.generalNote && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-800">{spec.generalNote}</div>
      )}
      <div className="space-y-2">
        {spec.fields.map((f) => {
          const v = values[f.id] ?? '';
          let status: { ok: boolean | null } = { ok: null };
          if (f.fieldType === 'number' && v !== '') {
            const n = Number(v);
            const target = Number(f.target);
            const tol = Number(f.tolerance);
            if (Number.isFinite(n) && Number.isFinite(target) && Number.isFinite(tol)) {
              status = { ok: Math.abs(n - target) <= target * (tol / 100) };
            }
          }
          return (
            <div key={f.id} className={cn(
              'rounded-lg border-2 p-2',
              status.ok == null ? 'border-slate-200 bg-white' :
              status.ok ? 'border-emerald-400 bg-emerald-50' : 'border-red-400 bg-red-50',
            )}>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                {f.label} {f.required && <span className="text-red-500">*</span>}
                {f.unit && <span className="text-[10px] text-slate-500 font-normal">({f.unit})</span>}
              </label>
              {f.fieldType === 'number' && (
                <input type="number" step="any"
                  className="w-full mt-1 px-2 py-1 text-sm font-mono rounded border border-slate-200 focus:border-rose-500 outline-none"
                  value={v} onChange={(e) => onChange({ ...value, values: { ...values, [f.id]: e.target.value } })} />
              )}
              {f.fieldType === 'text' && (
                <input className="w-full mt-1 px-2 py-1 text-xs rounded border border-slate-200 focus:border-rose-500 outline-none"
                  value={v} onChange={(e) => onChange({ ...value, values: { ...values, [f.id]: e.target.value } })} />
              )}
              {f.fieldType === 'select' && (
                <select className="w-full mt-1 px-2 py-1 text-xs rounded border border-slate-200 focus:border-rose-500 outline-none"
                  value={v} onChange={(e) => onChange({ ...value, values: { ...values, [f.id]: e.target.value } })}>
                  <option value="">— เลือก —</option>
                  {f.options.split(',').map((o) => o.trim()).filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

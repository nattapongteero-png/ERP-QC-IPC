'use client';

/**
 * NewTypeRecorderPanel — self-contained recorder for a single criteria of one
 * of the 5 new types (multi_point/tare/calibration/calculated/custom_multi_field).
 *
 * Lifecycle per (criteriaId, batchNumber):
 *   1. On mount: GET /api/recording/rounds?criteriaId=&batchNumber=
 *   2. If no in-progress round exists: POST a new round (round 1+)
 *   3. Edit auto-saves (debounced 800ms) via PUT
 *   4. "ส่งผล" button locks the round via POST .../submit
 *   5. After lock: shows read-only summary + offers "+ บันทึกรอบใหม่"
 *
 * Used by both the WO IPC tab and the SOP step inline. Caller passes the
 * criteria + batchNumber (typically WO.batchNumber).
 */

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Plus, Save } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  parseSpecPayload,
  type SpecPayload,
} from '@/lib/master-data/ipc-spec-payload';
import { CRITERIA_TYPE_META, type CriteriaType } from '@/lib/master-data/ipc-test-catalog';
import {
  MultiPointRecorder,
  TareRecorder,
  CalibrationRecorder,
  CalculatedRecorder,
  CustomFieldsRecorder,
} from '@/components/ipc-recording/Recorders';

interface CriteriaLite {
  id: number;
  code: string;
  name: string;
  nameTh?: string | null;
  unit?: string | null;
  criteriaType: string;
  specification: string | null;
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
}

const NEW_TYPES = new Set<string>(['multi_point', 'tare', 'calibration', 'calculated', 'custom_multi_field']);

export function isNewType(t: string | null | undefined): boolean {
  return !!t && NEW_TYPES.has(t);
}

export function NewTypeRecorderPanel({
  criteria,
  batchNumber,
  compact = false,
}: {
  criteria: CriteriaLite;
  batchNumber: string;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const queryKey = ['ipc-rounds', criteria.id, batchNumber];

  const { data: rounds = [] } = useQuery<RecordingRound[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(
        `/api/recording/rounds?criteriaId=${criteria.id}&batchNumber=${encodeURIComponent(batchNumber)}`,
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data || [];
    },
  });

  const inProgress = rounds.find((r) => !r.submittedAt) ?? null;
  const submitted = rounds.filter((r) => r.submittedAt);

  const createRound = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/recording/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteriaId: criteria.id, batchNumber }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as RecordingRound;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  // Auto-create initial round when there's nothing yet
  React.useEffect(() => {
    if (rounds.length === 0 && !createRound.isPending) {
      createRound.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds.length]);

  const spec = React.useMemo<SpecPayload | null>(
    () => parseSpecPayload(criteria.criteriaType, criteria.specification),
    [criteria.criteriaType, criteria.specification],
  );
  const meta = CRITERIA_TYPE_META[(criteria.criteriaType as CriteriaType) ?? 'numeric'] ?? CRITERIA_TYPE_META.numeric;

  const activeRound = inProgress ?? submitted[submitted.length - 1] ?? null;
  const isLocked = !!activeRound?.submittedAt;

  const [formData, setFormData] = React.useState<Record<string, unknown>>({});
  React.useEffect(() => {
    if (!activeRound) return;
    try {
      setFormData(JSON.parse(activeRound.data || '{}'));
    } catch {
      setFormData({});
    }
  }, [activeRound?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  const saveData = useMutation({
    mutationFn: async (vars: { roundId: number; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/recording/rounds/${vars.roundId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: vars.data }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as RecordingRound;
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

  const submitRound = useMutation({
    mutationFn: async (roundId: number) => {
      const res = await fetch(`/api/recording/rounds/${roundId}/submit`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as RecordingRound;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const renderRecorder = () => {
    if (!spec) return <div className="text-xs text-slate-400">spec ไม่พบ</div>;
    if (spec.type === 'multi_point') {
      return <MultiPointRecorder spec={spec} unit={criteria.unit ?? ''} value={formData} onChange={setFormData} />;
    }
    if (spec.type === 'tare') {
      return <TareRecorder spec={spec} value={formData} onChange={setFormData} />;
    }
    if (spec.type === 'calibration') {
      return <CalibrationRecorder spec={spec} value={formData} onChange={setFormData} />;
    }
    if (spec.type === 'calculated') {
      return <CalculatedRecorder spec={spec} value={formData} onChange={setFormData} />;
    }
    if (spec.type === 'custom_multi_field') {
      return <CustomFieldsRecorder spec={spec} value={formData} onChange={setFormData} />;
    }
    return null;
  };

  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white', compact ? 'p-3' : 'p-4 sm:p-5')}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="font-mono text-xs font-bold text-slate-900">{criteria.code}</span>
        <span className={cn('text-[10px] uppercase font-bold px-1.5 py-0.5 rounded', meta.bgColor, meta.textColor)}>
          {meta.label}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-800 truncate">{criteria.nameTh || criteria.name}</div>
        </div>
        {submitted.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-medium">
            ✓ {submitted.length} รอบ
          </span>
        )}
      </div>

      {!activeRound ? (
        <div className="text-xs text-slate-400 italic">
          {createRound.isPending ? 'กำลังเตรียมรอบบันทึก...' : 'ยังไม่มีรอบ'}
        </div>
      ) : (
        <>
          {isLocked && (
            <div className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 mb-3 flex items-center gap-2 text-xs text-slate-700">
              <Lock className="w-3.5 h-3.5" />
              <span>รอบ {activeRound.roundNumber} ส่งผลเมื่อ {activeRound.submittedAt} — แก้ไขไม่ได้</span>
              {activeRound.passed != null && (
                <span className={cn(
                  'ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold',
                  activeRound.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800',
                )}>
                  {activeRound.passed ? '✓ PASS' : '✕ FAIL'}
                </span>
              )}
            </div>
          )}

          <div className={cn(isLocked && 'pointer-events-none opacity-70')}>
            {renderRecorder()}
          </div>

          <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100">
            <div className="text-[10px] text-slate-500">
              {isLocked ? '🔒 ล็อกแล้ว' :
               saveData.isPending ? (<span className="inline-flex items-center gap-1"><Save className="w-3 h-3 animate-pulse" />บันทึกอัตโนมัติ...</span>) :
               'บันทึกอัตโนมัติแล้ว'}
            </div>
            <div className="flex gap-2">
              {isLocked ? (
                <button
                  type="button"
                  onClick={() => createRound.mutate()}
                  disabled={createRound.isPending}
                  className="px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-xs font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> รอบใหม่
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitRound.isPending}
                  onClick={() => submitRound.mutate(activeRound.id)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitRound.isPending ? 'กำลังส่ง...' : 'ส่งผล'}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

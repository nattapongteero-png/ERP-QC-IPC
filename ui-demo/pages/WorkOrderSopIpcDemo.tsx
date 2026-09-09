import * as React from 'react';
import {
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  FlaskConical,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ResponsivePageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { IPCRecordDialog, type RecordableCriterion } from '@/components/ipc-recording/IPCRecordDialog';
import type { RecordedIPCCriterion } from '@/components/ipc-recording/IPCRoundHistory';

/**
 * ใบสั่งผลิต → ดำเนินการผลิต (SOP / IPC) — review build.
 *
 * Shows the flow as proposed rather than as it is today: the operator works
 * down the SOP steps, and an IPC topic opens a recording dialog *on this
 * screen* instead of throwing them onto the SOP execution page. The dialog
 * body is the very component the criteria author previewed, so "built like
 * this → recorded like this" holds by construction.
 *
 * Data is fixed sample data held in this file. Nothing is fetched and nothing
 * is written.
 */

import {
  STEPS,
  RECORDED,
  WORK_ORDER,
  type Step,
  type StepStatus,
} from '../data/demo-batch';

// ── Chrome ─────────────────────────────────────────────────────────
const STATUS_STYLE: Record<StepStatus, { dot: string; label: string; chip: string }> = {
  done: { dot: 'text-emerald-600', label: 'เสร็จแล้ว', chip: 'bg-emerald-50 text-emerald-700' },
  active: { dot: 'text-[#2f6fd0]', label: 'กำลังดำเนินการ', chip: 'bg-[#e8effc] text-[#2f6fd0]' },
  todo: { dot: 'text-slate-300', label: 'ยังไม่เริ่ม', chip: 'bg-[#f1f3f5] text-slate-500' },
};

function ipcState(c: RecordableCriterion): 'pass' | 'fail' | 'pending' {
  const r = RECORDED[c.criteriaId];
  if (!r) return 'pending';
  return r.recordedStatus === 'pass' ? 'pass' : r.recordedStatus === 'fail' ? 'fail' : 'pending';
}

const IPC_CHIP: Record<'pass' | 'fail' | 'pending', string> = {
  pass: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400',
  fail: 'border-rose-200 bg-rose-50 text-rose-800 hover:border-rose-400',
  pending: 'border-[#e1e4e8] bg-white text-slate-700 hover:border-[#9db9e8]',
};

export function WorkOrderSopIpcDemo({ onBack }: { onBack?: () => void }) {
  const [openFor, setOpenFor] = React.useState<RecordableCriterion | null>(null);
  const [openStep, setOpenStep] = React.useState<Step | null>(null);

  const allIpc = STEPS.flatMap((s) => s.ipc);
  const doneCount = allIpc.filter((c) => RECORDED[c.criteriaId]).length;

  return (
    <div className="box-border flex w-full max-w-full flex-col gap-5 overflow-y-auto p-4 md:p-6">
      <ResponsivePageHeader
        title="ควบคุมคุณภาพระหว่างการผลิต — ระหว่างการผลิต"
        subtitle="WO-2568-0142 - B25-0142"
        icon={FlaskConical}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        onBack={onBack}
      />

      {/* Progress — matches the card the real IPC page opens with. */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-gray-900">ฟ้าทะลายโจรแคปซูล 400 mg</p>
              <p className="text-sm text-gray-500">
                รุ่นการผลิต B25-0142 · 50,000 แคปซูล · SOP-PRD-014 rev.3
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-40 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-sky-500"
                  style={{ width: `${(doneCount / Math.max(1, allIpc.length)) * 100}%` }}
                />
              </div>
              <span className="text-sm text-gray-600">
                <ClipboardList className="mr-1 inline h-4 w-4 text-gray-400" />
                บันทึกแล้ว {doneCount}/{allIpc.length} หัวข้อ
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── SOP steps ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {STEPS.map((step) => {
          const st = STATUS_STYLE[step.status];
          return (
            <div
              key={step.seq}
              className={cn(
                'rounded-[20px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
                step.status === 'active' && 'ring-2 ring-[#2f6fd0]/25',
              )}
            >
              <div className="flex items-start gap-3">
                {step.status === 'done' ? (
                  <CheckCircle2 className={cn('mt-0.5 h-5 w-5 shrink-0', st.dot)} />
                ) : step.status === 'active' ? (
                  <Loader2 className={cn('mt-0.5 h-5 w-5 shrink-0', st.dot)} />
                ) : (
                  <CircleDashed className={cn('mt-0.5 h-5 w-5 shrink-0', st.dot)} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Counts from 1. The database row id used to be shown here,
                        which read as "ขั้นตอนที่ 317". */}
                    <span className="text-sm font-semibold text-black">
                      ขั้นตอนที่ {step.seq}
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', st.chip)}>
                      {st.label}
                    </span>
                    <span className="text-[10px] text-[#d5d8dc]">ref #{step.refId}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-900">{step.title}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{step.detail}</p>
                </div>
              </div>

              {step.ipc.length > 0 && (
                <div className="mt-4 rounded-[14px] bg-[#f9fafb] p-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <FlaskConical className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-[11px] font-medium text-slate-500">
                      หัวข้อควบคุมคุณภาพระหว่างการผลิต ({step.ipc.length})
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {step.ipc.map((c) => {
                      const state = ipcState(c);
                      return (
                        <button
                          key={c.criteriaId}
                          type="button"
                          data-testid={`ipc-topic-${c.criteriaId}`}
                          onClick={() => {
                            setOpenStep(step);
                            setOpenFor(c);
                          }}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition',
                            IPC_CHIP[state],
                          )}
                        >
                          <span className="rounded-md bg-black/5 px-1.5 py-0.5 font-mono text-[10px] font-bold">
                            {c.formData.code}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                            {c.formData.name}
                          </span>
                          {c.formData.isCritical && (
                            <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-[#c0362c]" />
                          )}
                          <span className="shrink-0 text-[11px] font-semibold">
                            {state === 'pass'
                              ? 'ผ่าน'
                              : state === 'fail'
                                ? 'ไม่ผ่าน'
                                : 'บันทึกผล'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <IPCRecordDialog
        open={!!openFor}
        onClose={() => setOpenFor(null)}
        criterion={
          openFor ? { ...openFor, recorded: RECORDED[openFor.criteriaId] } : null
        }
        context={{
          workOrderNumber: 'WO-2568-0142',
          batchNumber: 'B25-0142',
          stepLabel: openStep ? `ขั้นตอนที่ ${openStep.seq}` : undefined,
        }}
        onSubmit={() => setOpenFor(null)}
      />
    </div>
  );
}

export default WorkOrderSopIpcDemo;

'use client';

/**
 * Record an IPC result without leaving the screen you started from.
 *
 * Two things this fixes, both raised in review:
 *
 *  1. Pressing an IPC topic on the work order used to navigate to the SOP
 *     execution screen. The operator loses their place, and the button that
 *     said "ดู / แก้ที่ SOP" could not in fact edit anything — the system only
 *     ever allows a new round. So recording happens here, in a dialog, and the
 *     work order stays underneath.
 *
 *  2. The recording surface is the *same component* the criteria author saw in
 *     Live Preview. Whatever they built is literally what the operator meets;
 *     the two cannot drift apart, because there is only one of them.
 *
 * Presentational on purpose: it takes a criterion and existing rounds, and
 * calls back on save. It issues no requests and knows no endpoints, so the
 * screen that owns the data owns the write.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldAlert, Lock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { SOFT_PRIMARY_BTN, SOFT_SECONDARY_BTN } from '@/components/shared/soft-form';
import {
  IPCLivePreviewCard,
  type PreviewCriteria,
} from '@/components/master-data/IPCLivePreviewCard';
import type { CriteriaType } from '@/lib/master-data/ipc-test-catalog';
import type { SpecPayload, StageValue, TriggerOption } from '@/lib/master-data/ipc-spec-payload';
import type { AcceptanceStage } from '@/lib/master-data/ipc-stages';
import {
  IPCRoundHistory,
  getNextRetestStage,
  retestBlockedReason,
  type RecordedIPCCriterion,
} from '@/components/ipc-recording/IPCRoundHistory';

/** Everything the dialog needs to draw one criterion. */
export interface RecordableCriterion {
  criteriaId: number;
  criteriaType: CriteriaType;
  formData: PreviewCriteria;
  specPayload: SpecPayload | null;
  stage: StageValue;
  calculatedMinMax: { min: number; max: number } | null;
  acceptanceMath: { sampleSize: number; allowedFail: number; mustPass: number } | null;
  multiStageEnabled: boolean;
  stages: AcceptanceStage[];
  /** Rounds already on file, in the shape IPCRoundHistory reads. */
  recorded?: RecordedIPCCriterion;
  /**
   * Events the criterion says can call for an unscheduled round — "หลัง
   * changeover", "หลัง equipment cleaning" and the rest, as switched on in the
   * criterion's trigger settings.
   *
   * Only the ones switched on arrive here; a criterion with none gets no
   * buttons rather than a row of greyed-out ones.
   */
  events?: TriggerOption[];
  /**
   * Boxes the criterion names, when the count of readings is not the count of
   * units drawn.
   *
   * √n + 1 is the case: the plan draws 201 units from a 40,000-unit lot, the
   * plant tests a portion of them, and three readings come back. Without this
   * the dialog fell back to one box per unit drawn and put thirty numbered
   * boxes in front of the operator — a screen that does not match the one the
   * criterion was written on.
   */
  resultFields?: { labels: string[]; caption?: string };
}

export interface IPCRecordDialogProps {
  open: boolean;
  onClose: () => void;
  criterion: RecordableCriterion | null;
  /** Where the result belongs — shown so the operator can check before signing. */
  context: { workOrderNumber: string; batchNumber: string; stepLabel?: string };
  /** Called when the operator commits the round. */
  onSubmit?: (args: { criteriaId: number; round: number }) => void;
  saving?: boolean;
}

const HEAD_META = 'text-[11px] leading-relaxed text-[#bfbfbf]';

export function IPCRecordDialog({
  open,
  onClose,
  criterion,
  context,
  onSubmit,
  saving = false,
}: IPCRecordDialogProps) {
  // Escape closes, and the page behind must not scroll while the dialog owns
  // the screen — otherwise the work order drifts under the operator's cursor.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  /*
   * Which event the operator says prompted this round.
   *
   * Local to the dialog and cleared each time it opens: nothing is written
   * anywhere yet, so this is what the button does and all it does. Wiring it
   * to the saved round means a column to put it in, which is a schema change.
   */
  const [eventId, setEventId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) setEventId(null);
  }, [open, criterion?.criteriaId]);

  if (!open || !criterion || typeof document === 'undefined') return null;

  // Only the events the criterion actually switched on, and the label for the
  // one the operator picked — that label is what the preview badge shows.
  const activeEvents = (criterion.events ?? []).filter((ev) => ev.on);
  const pickedEvent = activeEvents.find((ev) => ev.id === eventId);
  const eventTags = pickedEvent ? [pickedEvent.label ?? pickedEvent.id] : undefined;

  const recorded = criterion.recorded;
  const hasRounds = !!recorded?.recordedTestId && !!recorded?.recordedSamples?.length;
  const retestNext = recorded ? getNextRetestStage(recorded) : null;
  const blockedReason = recorded ? retestBlockedReason(recorded) : null;

  // A signed round is never overwritten — GMP data integrity. So the dialog is
  // either recording round 1, recording the retest the plan allows, or showing
  // history read-only with the reason no further round is on offer.
  const round = hasRounds ? (retestNext?.nextRound ?? null) : 1;
  const canRecord = round !== null;

  // Named boxes are the round: the header must count what the operator is
  // actually going to fill in, not the units the plan drew from the lot.
  const planSampleSize =
    criterion.resultFields?.labels.length
    ?? retestNext?.stage.sampleSize
    ?? criterion.acceptanceMath?.sampleSize
    ?? criterion.formData.sampleSize
    ?? 1;

  /**
   * The acceptance rule for the round about to be recorded.
   *
   * A retest stage carries its own sample size and tolerance, so the round's
   * allowance is recomputed from that stage rather than from the criterion's
   * first-round figures — otherwise the header would quote round 1's plan
   * while the operator fills in round 2's samples.
   */
  const tolerancePercent = retestNext?.isMultiStage
    ? retestNext.stage.tolerancePercent
    : (criterion.formData.tolerancePercent ?? 0);
  const plan = (() => {
    const allowedFail = Math.floor((planSampleSize * tolerancePercent) / 100);
    return { sampleSize: planSampleSize, allowedFail, mustPass: planSampleSize - allowedFail };
  })();
  // A checklist is judged item by item and every point must pass, so the
  // sample-based allowance does not apply to it.
  const checklistCount =
    criterion.specPayload?.type === 'visual'
      ? criterion.specPayload.checklist.filter(Boolean).length
      : 0;
  const isChecklist = criterion.criteriaType === 'visual' && checklistCount > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[1200] flex items-start justify-center overflow-y-auto bg-black/35 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="ipc-record-dialog"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-[680px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.28)]"
      >
        {/* ── Header — stays put while the body scrolls ─────────── */}
        <div className="flex shrink-0 items-start gap-3 border-b border-[#f1f3f5] px-6 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-black">
              บันทึกผลการควบคุมคุณภาพระหว่างการผลิต
            </p>
            <p className={cn(HEAD_META, 'mt-0.5 truncate')}>
              {context.workOrderNumber} · รุ่นการผลิต {context.batchNumber}
              {context.stepLabel ? ` · ${context.stepLabel}` : ''}
            </p>
          </div>
          <button
            type="button"
            aria-label="ปิด"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition hover:bg-[#f1f3f5] hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Body — the only part that scrolls ─────────────────── */}
        <div
          data-testid="ipc-record-scroll"
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain bg-[#f5f6f8] px-6 py-5"
        >
          {criterion.formData.isCritical && (
            <div className="flex items-start gap-2 rounded-[12px] border border-[#f3c7c2] bg-[#fbeceb] px-3 py-2.5">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#c0362c]" />
              <p className="text-[11px] leading-relaxed text-[#8f2b23]">
                <strong className="font-semibold">เกณฑ์วิกฤต</strong> — ไม่มีสิทธิ์ทดสอบซ้ำ
                หากผลไม่ผ่านต้องเปิด Deviation ทันที
              </p>
            </div>
          )}

          {canRecord && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[12px] bg-white px-3 py-2 text-[11px] text-slate-600">
              <span className="font-semibold text-black">รอบที่ {round}</span>
              <span className="text-[#d5d8dc]">·</span>
              {/* A checklist is not sampled — it is walked point by point, so
                  quoting a sample size of 1 next to four checkpoints described
                  a plan the criterion does not have. */}
              <span>
                {isChecklist ? `จุดตรวจ ${checklistCount}` : `เก็บตัวอย่าง ${planSampleSize}`}
              </span>
              {/* The pass threshold, spelled out. It used to print only the
                  bare allowance ("ไม่ผ่านได้ไม่เกิน 0") — a number with no
                  rule behind it, so the operator could not tell what the
                  criterion actually demanded or where the figure came from.
                  Only a multi-stage plan has a tolerance of its own; the
                  single-stage retest reuses the criterion's own budget, and
                  printing the synthetic stage's 0% read as "nothing may fail"
                  when that was never the rule. */}
              {retestNext?.isMultiStage ? (
                <>
                  <span className="text-[#d5d8dc]">·</span>
                  <span>
                    ต้องผ่าน{' '}
                    <strong className="font-semibold text-black">
                      {plan.mustPass}/{plan.sampleSize}
                    </strong>
                  </span>
                  <span className="text-[#d5d8dc]">·</span>
                  <span>
                    ไม่ผ่านได้ไม่เกิน {plan.allowedFail} (ยอมรับ{' '}
                    {retestNext.stage.tolerancePercent}%)
                  </span>
                </>
              ) : criterion.acceptanceMath ? (
                <>
                  <span className="text-[#d5d8dc]">·</span>
                  <span>
                    {isChecklist ? (
                      <>
                        ต้องผ่าน{' '}
                        <strong className="font-semibold text-black">ครบทุกข้อ</strong>
                      </>
                    ) : (
                      <>
                        ต้องผ่าน{' '}
                        <strong className="font-semibold text-black">
                          {plan.mustPass}/{plan.sampleSize}
                        </strong>
                      </>
                    )}
                  </span>
                  <span className="text-[#d5d8dc]">·</span>
                  <span>
                    ไม่ผ่านได้ไม่เกิน {isChecklist ? 0 : plan.allowedFail} (ยอมรับ{' '}
                    {isChecklist ? 0 : tolerancePercent}%)
                  </span>
                </>
              ) : null}
            </div>
          )}

          {/* Events — why this round is being taken, when it is not the clock.
              A round drawn after a changeover is read differently from a
              routine one, and until now the screen had nowhere to say so. */}
          {canRecord && activeEvents.length > 0 && (
            <div
              data-testid="record-event-picker"
              className="flex flex-col gap-2 rounded-[12px] border border-[#ffe1bf] bg-[#fffaf3] px-3 py-3"
            >
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 shrink-0 text-[#c2410c]" />
                <span className="text-[11px] font-semibold text-[#c2410c]">
                  ตรวจรอบนี้เพราะมีเหตุการณ์
                </span>
                <span className="text-[11px] text-[#c2410c]/60">(ถ้ามี)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeEvents.map((ev) => {
                  const on = eventId === ev.id;
                  return (
                    <button
                      type="button"
                      key={ev.id}
                      aria-pressed={on}
                      data-testid={`record-event-${ev.id}`}
                      // Pressing the chosen one again clears it: the operator
                      // may have tapped the wrong row, and a picker with no way
                      // back forces them to cancel the whole dialog.
                      onClick={() => setEventId(on ? null : ev.id)}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-[12px] font-medium transition',
                        on
                          ? 'bg-[#c2410c] text-white'
                          : 'border border-[#ffd9b0] bg-white text-[#8a5324] hover:border-[#f0a860]',
                      )}
                    >
                      {ev.label ?? ev.id}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {canRecord ? (
            /* The criteria author's Live Preview, now being used for real. */
            <IPCLivePreviewCard
              formData={criterion.formData}
              criteriaType={criterion.criteriaType}
              calculatedMinMax={criterion.calculatedMinMax}
              acceptanceMath={criterion.acceptanceMath}
              multiStageEnabled={criterion.multiStageEnabled}
              stages={criterion.stages}
              specPayload={criterion.specPayload}
              stage={criterion.stage}
              eventTags={eventTags}
              fixedResultFields={criterion.resultFields}
              blank
            />
          ) : (
            <div className="flex items-start gap-2 rounded-[12px] border border-[#e1e4e8] bg-white px-3 py-3">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p className="text-[11px] leading-relaxed text-slate-600">
                {blockedReason ?? 'บันทึกผลครบแล้ว'} — ผลที่ลงนามแล้วแก้ไขไม่ได้
                ดูประวัติการบันทึกด้านล่าง
              </p>
            </div>
          )}

          {!canRecord && !hasRounds && (
            <div className="rounded-[16px] bg-white px-4 py-6 text-center text-[13px] text-slate-500">
              ยังไม่มีค่าตัวอย่างที่บันทึกไว้สำหรับหัวข้อนี้
            </div>
          )}

          {hasRounds && recorded && (
            <div className="rounded-[16px] bg-white p-4">
              <p className="mb-1 text-sm font-semibold text-black">ประวัติการบันทึก</p>
              {/* Read-only here: the retest button lives in the footer, so the
                  operator has one place to commit rather than two. */}
              <IPCRoundHistory ipc={recorded} />
            </div>
          )}
        </div>

        {/* ── Footer — outside the scroller, always reachable ───── */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#f1f3f5] px-6 py-4">
          <button type="button" onClick={onClose} className={SOFT_SECONDARY_BTN}>
            {canRecord ? 'ยกเลิก' : 'ปิด'}
          </button>
          {canRecord && (
            <button
              type="button"
              data-testid="ipc-record-submit"
              disabled={saving}
              onClick={() => onSubmit?.({ criteriaId: criterion.criteriaId, round })}
              className={SOFT_PRIMARY_BTN}
            >
              {saving ? 'กำลังบันทึก…' : `บันทึกผลรอบที่ ${round}`}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default IPCRecordDialog;

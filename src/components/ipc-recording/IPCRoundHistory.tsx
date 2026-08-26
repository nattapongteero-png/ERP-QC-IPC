'use client';

/**
 * Recorded IPC rounds — history, and the gate on recording another one.
 *
 * Lifted verbatim out of the SOP execution screen so the IPC screen can show
 * the same thing. It is deliberately shared rather than copied: the rule for
 * *when* a retest is allowed is a compliance rule (FDA OOS 2006 for the
 * single-stage path, the criterion's own acceptance plan for the multi-stage
 * one), and two copies of it would eventually disagree — one screen offering
 * a round the other refuses.
 *
 * Presentational only. It reads what the SOP execution API already returns
 * and calls back when the operator asks for the next round; the caller owns
 * the form and the request.
 */

import * as React from 'react';
import { formatNumber } from '@/lib/utils/number-format';

export interface AcceptanceStageLike {
  sampleSize: number;
  tolerancePercent: number;
  onFail: 'next_stage' | 'reject_batch' | 'deviation';
}

/** The fields of a linked IPC criterion this component reads. */
export interface RecordedIPCCriterion {
  criteriaId: number;
  criteriaType: string;
  unit?: string | null;
  sampleSize: number;
  /**
   * Share of the samples in a round that may fail and the round still pass.
   *
   * Without it the history judged every round against a hard zero, so a
   * criterion that allows 5% failures showed its passing round as ✗ while the
   * card beside it read ผ่าน — the two disagreeing about the same result.
   */
  tolerancePercent?: number | null;
  isCriteriaCritical: boolean;
  recordedTestId?: number | null;
  recordedStatus?: 'pass' | 'fail' | 'pending' | null;
  recordedSamples?: Array<{
    sampleNumber: number;
    testRound: number;
    numericValue: number | null;
    textValue: string | null;
    result: string | null;
  }>;
  recordedTestedByName?: string | null;
  recordedTestDate?: string | null;
  recordedAcceptanceStages?: string | null;
  maxRetestRounds?: number | null;
  recordedRetestReason?: string | null;
}

/**
 * Types whose samples carry a number rather than a verdict.
 *
 * `numeric` alone used to qualify, so a multi-point weight check replayed its
 * history as a row of ผ่าน/ไม่ผ่าน chips and the weights the operator recorded
 * were nowhere on screen — exactly the figures an investigator needs.
 */
const NUMERIC_VALUED = new Set([
  'numeric',
  'multi_point',
  'tare',
  'calculated',
  'calibration',
]);

export const parseStages = (raw: string | null | undefined): AcceptanceStageLike[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s) => s && typeof s.sampleSize === 'number' && typeof s.tolerancePercent === 'number',
    );
  } catch {
    return [];
  }
};

/**
 * The next retest round the plan allows, or null when none is.
 *
 * Multi-stage: only when the last round exceeded its stage's tolerance *and*
 * that stage says to move on (reject_batch / deviation end it here).
 * Single-stage: only when the last round had a failure and the retest budget
 * is not spent — critical criteria have a budget of zero, so a failure goes
 * straight to a deviation.
 */
export function getNextRetestStage(
  ipc: RecordedIPCCriterion,
): { nextRound: number; stage: AcceptanceStageLike; isMultiStage: boolean } | null {
  if (!ipc.recordedTestId || !ipc.recordedSamples?.length) return null;

  let lastRound = 1;
  for (const s of ipc.recordedSamples) if (s.testRound > lastRound) lastRound = s.testRound;
  const lastSamples = ipc.recordedSamples.filter((s) => s.testRound === lastRound);
  const lastFailCount = lastSamples.filter((s) => s.result === 'fail').length;

  const stages = parseStages(ipc.recordedAcceptanceStages);

  if (stages.length > 0) {
    const lastStage = stages[lastRound - 1];
    const nextStage = stages[lastRound];
    if (!lastStage || !nextStage) return null;
    const failPct = lastSamples.length === 0 ? 0 : (lastFailCount / lastSamples.length) * 100;
    if (failPct <= lastStage.tolerancePercent) return null;
    if (lastStage.onFail !== 'next_stage') return null;
    return { nextRound: lastRound + 1, stage: nextStage, isMultiStage: true };
  }

  const tolPct = Number(ipc.tolerancePercent) || 0;
  const lastFailPct = lastSamples.length === 0 ? 0 : (lastFailCount / lastSamples.length) * 100;
  if (lastFailPct <= tolPct) return null;
  const maxRetestRounds = ipc.isCriteriaCritical
    ? 0
    : ipc.maxRetestRounds == null
      ? 1
      : Number(ipc.maxRetestRounds);
  const maxRoundsTotal = 1 + (Number.isFinite(maxRetestRounds) ? maxRetestRounds : 1);
  if (lastRound >= maxRoundsTotal) return null;

  const sampleSize = Number(ipc.sampleSize) || lastSamples.length || 1;
  return {
    nextRound: lastRound + 1,
    stage: { sampleSize, tolerancePercent: 0, onFail: 'next_stage' },
    isMultiStage: false,
  };
}

/**
 * Why another round is not on offer — so a screen can say so instead of
 * showing nothing where a button used to be.
 */
export function retestBlockedReason(ipc: RecordedIPCCriterion): string | null {
  if (getNextRetestStage(ipc)) return null;
  if (!ipc.recordedTestId || !ipc.recordedSamples?.length) return null;
  if (ipc.recordedStatus === 'pass') return 'ผลผ่านแล้ว ไม่ต้องบันทึกรอบใหม่';

  const stages = parseStages(ipc.recordedAcceptanceStages);
  let lastRound = 1;
  for (const s of ipc.recordedSamples) if (s.testRound > lastRound) lastRound = s.testRound;

  if (stages.length > 0) {
    const lastStage = stages[lastRound - 1];
    if (lastStage?.onFail === 'reject_batch') return 'แผนการยอมรับกำหนดให้ปฏิเสธรุ่นเมื่อไม่ผ่าน';
    if (lastStage?.onFail === 'deviation') return 'แผนการยอมรับกำหนดให้เปิด Deviation เมื่อไม่ผ่าน';
    return 'ครบทุกขั้นของแผนการยอมรับแล้ว';
  }
  if (ipc.isCriteriaCritical) return 'เกณฑ์วิกฤต — ไม่มีสิทธิ์ทดสอบซ้ำ ต้องเปิด Deviation';
  return 'ใช้สิทธิ์ทดสอบซ้ำครบแล้ว';
}

export function IPCRoundHistory({
  ipc,
  onStartRetest,
}: {
  ipc: RecordedIPCCriterion;
  /** Omit to render the history read-only. */
  onStartRetest?: (next: { nextRound: number; stage: AcceptanceStageLike }) => void;
}) {
  if (!ipc.recordedTestId || !ipc.recordedSamples) return null;
  const samples = ipc.recordedSamples;
  const testedDate = ipc.recordedTestDate ? new Date(ipc.recordedTestDate) : null;
  const stages = parseStages(ipc.recordedAcceptanceStages);

  const byRound = new Map<number, typeof samples>();
  for (const s of samples) {
    if (!byRound.has(s.testRound)) byRound.set(s.testRound, []);
    byRound.get(s.testRound)!.push(s);
  }
  const rounds = Array.from(byRound.keys()).sort((a, b) => a - b);
  const retestNext = getNextRetestStage(ipc);
  const maxRetestRounds = ipc.isCriteriaCritical
    ? 0
    : ipc.maxRetestRounds == null
      ? 1
      : Number(ipc.maxRetestRounds);
  const maxRoundsTotal = 1 + (Number.isFinite(maxRetestRounds) ? maxRetestRounds : 1);
  const isMultiStage = stages.length > 0;

  return (
    <div className="flex flex-col gap-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#bfbfbf]">
        <span>
          {ipc.recordedTestedByName && (
            <>
              โดย <span className="font-medium text-slate-700">{ipc.recordedTestedByName}</span> ·{' '}
            </>
          )}
          {testedDate && (
            <>เมื่อ {testedDate.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</>
          )}
        </span>
        <div className="flex items-center gap-2">
          {!isMultiStage && rounds.length > 0 && (
            <span className="rounded-full bg-[#f1f3f5] px-2 py-0.5 text-[10px] font-medium text-[#6b7280]">
              รอบที่ {Math.max(...rounds)}/{maxRoundsTotal}
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              ipc.recordedStatus === 'pass'
                ? 'bg-[#e8f6ee] text-[#1a8a4a]'
                : ipc.recordedStatus === 'fail'
                  ? 'bg-[#fbeceb] text-[#c0362c]'
                  : 'bg-[#fdf0e6] text-[#b45309]'
            }`}
          >
            สถานะล่าสุด:{' '}
            {ipc.recordedStatus === 'pass'
              ? 'ผ่าน'
              : ipc.recordedStatus === 'fail'
                ? 'ไม่ผ่าน'
                : 'รอผล'}
          </span>
        </div>
      </div>

      {/* The recorded rounds live in one white frame; the byline above sits
          straight on the surrounding surface. */}
      <div className="flex flex-col gap-3 rounded-[12px] border border-[#eef0f2] bg-white p-3">
      {!isMultiStage && ipc.recordedRetestReason && (
        <div
          className={`rounded-[10px] px-3 py-2 text-[11px] ${
            ipc.recordedRetestReason === 'unjustified'
              ? 'bg-[#fbeceb] text-[#8f2b23]'
              : 'bg-[#e8f6ee] text-[#186c3c]'
          }`}
        >
          เหตุผล Retest ล่าสุด:{' '}
          <strong>
            {ipc.recordedRetestReason === 'justified'
              ? 'Justified — พบสาเหตุ'
              : 'Unjustified — ไม่พบสาเหตุ (Deviation)'}
          </strong>
        </div>
      )}

      {rounds.map((roundNum) => {
        const rs = byRound.get(roundNum)!;
        const passCount = rs.filter((s) => s.result === 'pass').length;
        const failCount = rs.filter((s) => s.result === 'fail').length;
        const stage = stages[roundNum - 1];
        const tolPct = stage?.tolerancePercent ?? (Number(ipc.tolerancePercent) || 0);
        const failPct = rs.length === 0 ? 0 : (failCount / rs.length) * 100;
        const roundPass = failPct <= tolPct;
        return (
          <div key={roundNum} className="overflow-hidden rounded-[12px] bg-[#f9fafb]">
            <div
              className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px] ${
                roundPass ? 'text-[#186c3c]' : 'text-[#8f2b23]'
              }`}
            >
              <span className="font-semibold">
                รอบ {roundNum}
                {stage
                  ? ` · Stage sample ${formatNumber(stage.sampleSize)} · tolerance ${formatNumber(stage.tolerancePercent)}%`
                  : ''}
              </span>
              <span>
                {passCount}/{rs.length} ผ่าน
                {tolPct > 0 ? ` · ยอมรับ ${formatNumber(tolPct)}%` : ''} ·{' '}
                {roundPass ? '✓' : '✗'}
              </span>
            </div>
            <div className="p-2 pt-0">
              {NUMERIC_VALUED.has(ipc.criteriaType) && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1">
                  {rs.map((s, idx) => (
                    <div
                      key={idx}
                      className={`rounded-[10px] px-2 py-1.5 text-center text-[11px] ${
                        s.result === 'pass'
                          ? 'bg-[#e8f6ee] text-[#186c3c]'
                          : s.result === 'fail'
                            ? 'bg-[#fbeceb] text-[#8f2b23]'
                            : 'bg-white text-slate-500'
                      }`}
                    >
                      <div className="text-[9px] text-[#bfbfbf]">#{s.sampleNumber}</div>
                      <div className="font-mono font-semibold">
                        {s.numericValue != null
                          ? `${formatNumber(s.numericValue)}${ipc.unit ? ` ${ipc.unit}` : ''}`
                          : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!NUMERIC_VALUED.has(ipc.criteriaType) && ipc.criteriaType !== 'text' && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1">
                  {rs.map((s, idx) => (
                    <div
                      key={idx}
                      className={`rounded-[10px] px-2 py-1.5 text-center text-[11px] ${
                        s.result === 'pass'
                          ? 'bg-[#e8f6ee] text-[#186c3c]'
                          : s.result === 'fail'
                            ? 'bg-[#fbeceb] text-[#8f2b23]'
                            : 'bg-white text-slate-500'
                      }`}
                    >
                      <div className="text-[9px] text-[#bfbfbf]">#{s.sampleNumber}</div>
                      <div className="font-semibold">
                        {s.result === 'pass' ? 'ผ่าน' : s.result === 'fail' ? 'ไม่ผ่าน' : '–'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {ipc.criteriaType === 'text' && rs[0]?.textValue && (
                <div className="whitespace-pre-wrap rounded-[10px] bg-white px-3 py-2 text-slate-700">
                  {rs[0].textValue}
                </div>
              )}
            </div>
          </div>
        );
      })}
      </div>

      {retestNext && onStartRetest && (
        <button
          type="button"
          data-testid="ipc-start-retest"
          onClick={(e) => {
            e.stopPropagation();
            onStartRetest(retestNext);
          }}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#2f6fd0] px-3.5 py-2 text-[12px] font-medium text-white transition hover:bg-[#2a61b8]"
        >
          ▶ บันทึกรอบ {retestNext.nextRound} (Stage sample {retestNext.stage.sampleSize} · tolerance{' '}
          {retestNext.stage.tolerancePercent}%)
        </button>
      )}
    </div>
  );
}

export default IPCRoundHistory;

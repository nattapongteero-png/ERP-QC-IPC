'use client';

/**
 * StatusStepper — a reusable "สถานะการดำเนินงาน" progress indicator.
 *
 * Shows the lifecycle/workflow of a record as a row (or column) of steps with
 * a connecting line, so a user can see at a glance "ทำถึงไหนแล้ว". Drop it at
 * the top of a detail / edit / create page that has a meaningful sequence of
 * states.
 *
 *   <StatusStepper
 *     steps={[
 *       { key: 'open', label: 'เปิด' },
 *       { key: 'investigating', label: 'สืบสวน' },
 *       { key: 'pending', label: 'รอดำเนินการ' },
 *       { key: 'review', label: 'ตรวจสอบ' },
 *       { key: 'approval', label: 'รออนุมัติ' },
 *       { key: 'closed', label: 'ปิด' },
 *     ]}
 *     current="pending"
 *   />
 *
 * Colours follow the organic theme: done = emerald, current = emerald (filled,
 * pulsing clock), upcoming = grey. Pass `tone="violet"` to match the mock's
 * violet "current" dot if preferred per-screen.
 */

import type { LucideIcon } from 'lucide-react';
import { Check, Clock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface StepperStep {
  /** Stable key matched against `current` to find the active step. */
  key: string;
  /** Extra status values that also land on this step (aliases / terminal states). */
  matches?: string[];
  /** Thai label shown under (horizontal) / beside (vertical) the dot. */
  label: string;
  /** Optional icon for the step dot (defaults: done=Check, current=Clock). */
  icon?: LucideIcon;
  /** Optional helper/sub text (mainly for vertical master-data steps). */
  description?: string;
}

export interface StatusStepperProps {
  steps: StepperStep[];
  /** Key of the current step. Steps before it render "done", after it "upcoming". */
  current?: string;
  /** Layout: horizontal workflow row (default) or vertical master-data list. */
  orientation?: 'horizontal' | 'vertical';
  /** Accent for the CURRENT step dot. Default emerald; 'violet' matches the mock. */
  tone?: 'emerald' | 'violet';
  /** Optional section title shown above the stepper. */
  title?: string;
  className?: string;
}

type StepState = 'done' | 'current' | 'upcoming';

const TONE = {
  emerald: { ring: 'bg-emerald-600 border-emerald-600 text-white', text: 'text-emerald-700' },
  violet: { ring: 'bg-violet-600 border-violet-600 text-white', text: 'text-violet-700' },
};

export function StatusStepper({
  steps,
  current,
  orientation = 'horizontal',
  tone = 'emerald',
  title,
  className,
}: StatusStepperProps) {
  // A status that isn't in `steps` must NOT be reported as step 0 — that made a
  // fully-processed record (e.g. a PR already converted to a PO, a QC sample
  // already released) render as if it were still at "ร่าง", i.e. no progress at
  // all. Unmatched now yields -1, so every step draws as "upcoming" and nothing
  // claims to be the current step. Pages map their terminal/extra statuses onto
  // a step with `matches`.
  const currentIndex = steps.findIndex(
    (s) => s.key === current || s.matches?.includes(current ?? ''),
  );

  const stateOf = (idx: number): StepState =>
    currentIndex < 0 ? 'upcoming' : idx < currentIndex ? 'done' : idx === currentIndex ? 'current' : 'upcoming';

  const toneStyle = TONE[tone] ?? TONE.emerald;

  const Dot = ({ step, state }: { step: StepperStep; state: StepState }) => {
    const Icon = step.icon ?? (state === 'done' ? Check : Clock);
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full border-2 transition-all',
          orientation === 'horizontal' ? 'h-9 w-9' : 'h-8 w-8 shrink-0',
          state === 'done' && 'bg-emerald-500 border-emerald-500 text-white',
          state === 'current' && toneStyle.ring,
          state === 'upcoming' && 'bg-gray-100 border-gray-200 text-gray-400'
        )}
      >
        <Icon className={orientation === 'horizontal' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
      </div>
    );
  };

  const labelClass = (state: StepState) =>
    cn(
      'text-xs font-medium',
      state === 'done' && 'text-emerald-700',
      state === 'current' && toneStyle.text + ' font-semibold',
      state === 'upcoming' && 'text-gray-400'
    );

  const lineClass = (idx: number) =>
    cn(idx < currentIndex ? 'bg-emerald-500' : 'bg-gray-200');

  if (orientation === 'vertical') {
    return (
      <div className={cn('w-full', className)}>
        {title && (
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#064E3B]">
            {title}
          </h3>
        )}
        <ol className="relative">
          {steps.map((step, idx) => {
            const state = stateOf(idx);
            const last = idx === steps.length - 1;
            return (
              <li key={step.key} className="flex gap-3 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <Dot step={step} state={state} />
                  {!last && <span className={cn('mt-1 w-0.5 flex-1', lineClass(idx))} />}
                </div>
                <div className="pt-1">
                  <p className={labelClass(state)}>{step.label}</p>
                  {step.description && (
                    <p className="mt-0.5 text-[11px] text-gray-400">{step.description}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      {title && (
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#064E3B]">
          {title}
        </h3>
      )}
      <div className="rounded-[14px] border border-emerald-100 bg-[#FBFEFC] px-4 py-4 shadow-[0_6px_20px_rgba(6,78,59,0.05)]">
        <ol className="flex items-start">
          {steps.map((step, idx) => {
            const state = stateOf(idx);
            const last = idx === steps.length - 1;
            return (
              <li key={step.key} className={cn('flex flex-col items-center', !last && 'flex-1')}>
                <div className="flex w-full items-center">
                  <div className="flex flex-col items-center">
                    <Dot step={step} state={state} />
                  </div>
                  {!last && (
                    <span className={cn('mx-2 h-0.5 flex-1 rounded-full', lineClass(idx))} />
                  )}
                </div>
                <span className={cn('mt-2 text-center', labelClass(state))}>{step.label}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export default StatusStepper;

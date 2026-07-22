'use client';

/**
 * Production Plan Calendar (แผนการผลิต / ปฏิทินการผลิต) — list item 47.
 *
 * A read-only month calendar that plots each work order across the days it is
 * planned to run (plannedStartDate → plannedEndDate). Lets the planner see
 * *what* is produced *when* at a glance, instead of only a flat list.
 *
 * Deliberately a lightweight self-contained grid (no DevExtreme Scheduler): it
 * renders cleanly under SSR + jsdom tests, has no editing surface, and needs no
 * extra data plumbing — it reuses the work orders the page already fetched.
 */

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

// Minimal shape this calendar needs from a work order. Kept structural so the
// page's richer WorkOrder type is assignable without a shared import.
export interface PlanCalendarWorkOrder {
  id: number;
  woNumber: string;
  productName?: string | null;
  status: 'draft' | 'planned' | 'released' | 'in_progress' | 'completed' | 'cancelled';
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
}

interface ProductionPlanCalendarProps {
  workOrders: PlanCalendarWorkOrder[];
  /** i18n accessor bound to the `production` namespace by the parent. */
  t: (key: string, values?: Record<string, string | number>) => string;
  /** Row click → navigate to the WO detail. */
  onSelect?: (id: number) => void;
}

// Status → dot/label colour, aligned with the list badge colours on the page.
const STATUS_DOT: Record<PlanCalendarWorkOrder['status'], { dot: string; chip: string }> = {
  draft: { dot: 'bg-gray-400', chip: 'bg-gray-100 text-gray-700 border-gray-200' },
  planned: { dot: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700 border-blue-200' },
  released: { dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700 border-violet-200' },
  in_progress: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  completed: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { dot: 'bg-red-500', chip: 'bg-red-50 text-red-700 border-red-200' },
};

// Parse a DB date value to a local Y/M/D at midnight (ignoring time-of-day) so
// day-range membership tests are stable regardless of stored time component.
function toDayStart(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const MAX_CHIPS_PER_DAY = 3;

export function ProductionPlanCalendar({ workOrders, t, onSelect }: ProductionPlanCalendarProps) {
  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  // Current month view anchor (first day of the displayed month).
  const [anchor, setAnchor] = useState<Date>(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const monthLabel = anchor.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

  // Normalise each WO to a start/end day span. WOs missing a start date are
  // skipped (nothing to plot); missing end defaults to the start (single day).
  const spans = useMemo(() => {
    return workOrders
      .map((wo) => {
        const start = toDayStart(wo.plannedStartDate);
        if (!start) return null;
        const end = toDayStart(wo.plannedEndDate) ?? start;
        // Guard against inverted ranges (bad data) — clamp end to start.
        const safeEnd = end.getTime() < start.getTime() ? start : end;
        return { wo, start, end: safeEnd };
      })
      .filter((s): s is { wo: PlanCalendarWorkOrder; start: Date; end: Date } => s !== null);
  }, [workOrders]);

  // Build the 6-week grid (42 cells) covering the displayed month.
  const weeks = useMemo(() => {
    const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    // Grid starts on the Sunday on/before the 1st.
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

    const cells: { date: Date; inMonth: boolean; wos: PlanCalendarWorkOrder[] }[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      const wos = spans
        .filter((s) => date.getTime() >= s.start.getTime() && date.getTime() <= s.end.getTime())
        .map((s) => s.wo);
      cells.push({ date, inMonth: date.getMonth() === anchor.getMonth(), wos });
    }

    const grouped: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) grouped.push(cells.slice(i, i + 7));
    return grouped;
  }, [anchor, spans]);

  const plannedThisMonth = useMemo(
    () => spans.filter((s) => s.start.getMonth() === anchor.getMonth() && s.start.getFullYear() === anchor.getFullYear()).length
      + spans.filter((s) => s.end.getMonth() === anchor.getMonth() && s.end.getFullYear() === anchor.getFullYear() && !(s.start.getMonth() === anchor.getMonth() && s.start.getFullYear() === anchor.getFullYear())).length,
    [spans, anchor],
  );

  const goPrev = () => setAnchor((a) => new Date(a.getFullYear(), a.getMonth() - 1, 1));
  const goNext = () => setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + 1, 1));
  const goToday = () => setAnchor(new Date(today.getFullYear(), today.getMonth(), 1));

  // Weekday headers in Thai short form (อา จ อ …).
  const weekdayLabels = useMemo(() => {
    const base = new Date(2024, 0, 7); // a Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d.toLocaleDateString('th-TH', { weekday: 'short' });
    });
  }, []);

  return (
    <div data-testid="production-plan-calendar">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
            title={t('workOrders.plan.prevMonth')}
            aria-label={t('workOrders.plan.prevMonth')}
            data-testid="plan-prev-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[140px] text-center text-sm font-semibold text-[#064E3B]">{monthLabel}</span>
          <button
            type="button"
            onClick={goNext}
            className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
            title={t('workOrders.plan.nextMonth')}
            aria-label={t('workOrders.plan.nextMonth')}
            data-testid="plan-next-month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="ml-1 px-2.5 py-1 text-xs rounded-md border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            data-testid="plan-today"
          >
            {t('workOrders.plan.today')}
          </button>
        </div>
        {/* Status legend */}
        <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
          {(['planned', 'released', 'in_progress', 'completed'] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[s].dot}`} />
              {t(`workOrders.status.${s === 'in_progress' ? 'inProgress' : s}`)}
            </span>
          ))}
        </div>
      </div>

      {plannedThisMonth === 0 && (
        <div className="mb-3 flex items-center gap-2 text-sm text-gray-400">
          <CalendarDays className="h-4 w-4" />
          {t('workOrders.plan.noPlanned')}
        </div>
      )}

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdayLabels.map((w, i) => (
          <div key={i} className="text-center text-xs font-medium text-gray-500 py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((cell, idx) => {
          const isToday = sameDay(cell.date, today);
          const extra = cell.wos.length - MAX_CHIPS_PER_DAY;
          return (
            <div
              key={idx}
              className={`min-h-[92px] rounded-lg border p-1.5 flex flex-col ${
                cell.inMonth ? 'bg-white border-gray-100' : 'bg-gray-50/60 border-transparent'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full text-xs ${
                    isToday
                      ? 'bg-emerald-600 text-white font-semibold'
                      : cell.inMonth
                        ? 'text-gray-700'
                        : 'text-gray-400'
                  }`}
                >
                  {cell.date.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-1 overflow-hidden">
                {cell.wos.slice(0, MAX_CHIPS_PER_DAY).map((wo) => {
                  const style = STATUS_DOT[wo.status] ?? STATUS_DOT.planned;
                  return (
                    <button
                      key={wo.id}
                      type="button"
                      onClick={() => onSelect?.(wo.id)}
                      title={`${wo.woNumber}${wo.productName ? ' — ' + wo.productName : ''}`}
                      className={`text-left truncate rounded border px-1.5 py-0.5 text-[11px] leading-tight hover:opacity-80 transition ${style.chip}`}
                      data-testid={`plan-wo-${wo.id}`}
                    >
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle ${style.dot}`} />
                      <span className="font-mono">{wo.woNumber}</span>
                    </button>
                  );
                })}
                {extra > 0 && (
                  <span className="text-[10px] text-gray-400 pl-1">
                    {t('workOrders.plan.moreCount', { count: extra })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ProductionPlanCalendar;

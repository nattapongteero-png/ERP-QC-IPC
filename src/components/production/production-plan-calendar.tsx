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

  // Build the 6-week grid. Each week yields its 7 day cells PLUS the set of work
  // orders that run through it, each collapsed into ONE continuous bar spanning
  // the days it covers within that week (so a multi-day WO reads as a single
  // dragged bar, not a chip repeated on every day). Bars are packed into lanes
  // so overlapping WOs stack instead of covering each other.
  const weekRows = useMemo(() => {
    const DAY = 86400000;
    const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

    const rows: {
      days: { date: Date; inMonth: boolean }[];
      segments: {
        wo: PlanCalendarWorkOrder;
        startCol: number;
        endCol: number;
        lane: number;
        startsHere: boolean;
        endsHere: boolean;
      }[];
      laneCount: number;
    }[] = [];

    for (let w = 0; w < 6; w++) {
      const weekStart = new Date(gridStart);
      weekStart.setDate(gridStart.getDate() + w * 7);
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return { date: d, inMonth: d.getMonth() === anchor.getMonth() };
      });
      const weekStartMs = days[0].date.getTime();
      const weekEndMs = days[6].date.getTime();

      const segments = spans
        .filter((s) => s.end.getTime() >= weekStartMs && s.start.getTime() <= weekEndMs)
        .map((s) => ({
          wo: s.wo,
          startCol: Math.max(0, Math.round((s.start.getTime() - weekStartMs) / DAY)),
          endCol: Math.min(6, Math.round((s.end.getTime() - weekStartMs) / DAY)),
          startsHere: s.start.getTime() >= weekStartMs,
          endsHere: s.end.getTime() <= weekEndMs,
          lane: 0,
        }))
        // Earliest, then longest, first — stable packing so bars don't jump.
        .sort((a, b) => a.startCol - b.startCol || (b.endCol - b.startCol) - (a.endCol - a.startCol));

      // Greedy lane packing: put each bar in the first lane whose last bar ends
      // before this one starts.
      const laneEnds: number[] = [];
      for (const seg of segments) {
        let lane = laneEnds.findIndex((end) => seg.startCol > end);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(seg.endCol);
        } else {
          laneEnds[lane] = seg.endCol;
        }
        seg.lane = lane;
      }
      rows.push({ days, segments, laneCount: laneEnds.length });
    }
    return rows;
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

      {/* Month grid — one bordered row per week. Day-number cells form the
          background; each work order is drawn ONCE as a continuous bar spanning
          the columns it covers (a WO that runs Mon→Thu is a single bar, not four
          separate chips), overlaid on the same 7-column track so it lines up
          with the day cells. Overlapping WOs stack in lanes. */}
      <div className="flex flex-col gap-1">
        {weekRows.map((week, wi) => {
          const laneHeight = 22; // px per stacked bar
          const barsTop = 30; // px reserved for the date-number row
          const cellMinHeight = barsTop + Math.max(week.laneCount, 1) * laneHeight + 4;
          return (
            <div key={wi} className="relative">
              {/* Day-number cells (background track) */}
              <div className="grid grid-cols-7 gap-1">
                {week.days.map((d, i) => {
                  const isToday = sameDay(d.date, today);
                  return (
                    <div
                      key={i}
                      className={`rounded-lg border p-1.5 ${
                        d.inMonth ? 'bg-white border-gray-100' : 'bg-gray-50/60 border-transparent'
                      }`}
                      style={{ minHeight: cellMinHeight }}
                    >
                      <span
                        className={`inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full text-xs ${
                          isToday
                            ? 'bg-emerald-600 text-white font-semibold'
                            : d.inMonth
                              ? 'text-gray-700'
                              : 'text-gray-400'
                        }`}
                      >
                        {d.date.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Spanning-bar overlay — same 7-column track, positioned below the
                  date numbers. Each bar spans its column range in one piece. */}
              <div
                className="absolute left-0 right-0 grid grid-cols-7 gap-1 pointer-events-none"
                style={{ top: barsTop, gridAutoRows: `${laneHeight}px` }}
              >
                {week.segments.map((seg) => {
                  const style = STATUS_DOT[seg.wo.status] ?? STATUS_DOT.planned;
                  return (
                    <button
                      key={`${seg.wo.id}-${seg.startCol}`}
                      type="button"
                      onClick={() => onSelect?.(seg.wo.id)}
                      title={`${seg.wo.woNumber}${seg.wo.productName ? ' — ' + seg.wo.productName : ''}`}
                      className={`pointer-events-auto self-start h-[19px] flex items-center truncate border px-1.5 text-[11px] leading-tight hover:opacity-80 transition ${style.chip} ${
                        seg.startsHere ? 'rounded-l-md' : 'rounded-l-none border-l-0'
                      } ${seg.endsHere ? 'rounded-r-md' : 'rounded-r-none border-r-0'}`}
                      style={{
                        gridColumn: `${seg.startCol + 1} / ${seg.endCol + 2}`,
                        gridRow: seg.lane + 1,
                        marginLeft: seg.startsHere ? undefined : -4,
                        marginRight: seg.endsHere ? undefined : -4,
                      }}
                      data-testid={`plan-wo-${seg.wo.id}`}
                    >
                      {seg.startsHere && (
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 flex-shrink-0 ${style.dot}`} />
                      )}
                      <span className="font-mono truncate">{seg.wo.woNumber}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ProductionPlanCalendar;

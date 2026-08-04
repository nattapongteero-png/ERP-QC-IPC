'use client';

/**
 * Shared building blocks for the three module dashboards.
 *
 * They exist so production / purchasing / sales look and behave identically —
 * someone switching modules should not have to relearn the screen. The rules
 * encoded here come from the dashboard plan:
 *
 *   - every KPI shows its target, not a bare number
 *   - status is never carried by colour alone; there is always an icon + words
 *   - every chart has a table view, because colour-blind users, screen-reader
 *     users and anyone copying figures out must be able to read the values
 *   - no dual-axis charts: two series that need different scales get two charts
 */
import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, AlertTriangle, MinusCircle, Table2, BarChart3 } from 'lucide-react';

/**
 * Categorical series colours. Checked with a contrast/colour-blindness script
 * rather than by eye — the closest pair under a protan simulation still sits at
 * ΔE 9.1 against a threshold of 8. Never add a ninth: fold the tail into
 * "other" instead, because a ninth hue stops being distinguishable.
 */
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] as const;

/** Single-hue ramp for values that have an inherent order (stages, funnels). */
export const SEQUENTIAL_BLUES = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'] as const;

/** Status colours are reserved for meaning and must never be used as series colours. */
export const STATUS_COLORS = {
  good: '#047857',
  warn: '#b45309',
  bad: '#b91c1c',
} as const;

export function DashboardSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#064E3B]">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export type KpiStatus = 'on_target' | 'below_target' | 'unknown';

/**
 * One KPI tile. `hero` doubles its width and enlarges the figure — the plan
 * allows exactly one per page, top-left, because eye-tracking says that is
 * where reading starts.
 */
export function KpiTile({
  label,
  value,
  unit,
  sub,
  target,
  status,
  hero = false,
  testId,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
  sub?: string;
  target?: string;
  status?: KpiStatus;
  hero?: boolean;
  testId?: string;
}) {
  const t = useTranslations('common');
  const shown = value == null || value === '' ? '—' : value;

  const chip =
    status === 'on_target'
      ? { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2, text: t('dashboardShell.onTarget') }
      : status === 'below_target'
        ? { cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: AlertTriangle, text: t('dashboardShell.belowTarget') }
        : status === 'unknown'
          ? { cls: 'bg-gray-50 text-gray-500 border-gray-200', Icon: MinusCircle, text: t('dashboardShell.noData') }
          : null;

  return (
    <div
      className={`rounded-[14px] border border-emerald-100 bg-white p-4 shadow-[0_4px_14px_rgba(6,78,59,0.05)] ${
        hero ? 'sm:col-span-2' : ''
      }`}
      data-testid={testId}
    >
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 font-bold tabular-nums text-[#0F2E22] ${hero ? 'text-4xl' : 'text-2xl'}`}>
        {shown}
        {unit && shown !== '—' && <span className="ml-1 text-base font-medium text-gray-400">{unit}</span>}
      </p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {chip && (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${chip.cls}`}>
            <chip.Icon className="h-3 w-3" />
            {chip.text}
          </span>
        )}
        {target && <span className="text-[11px] text-gray-400">{t('dashboardShell.target')} {target}</span>}
      </div>
    </div>
  );
}

/**
 * Chart frame with a built-in table toggle. The table is not a fallback — it is
 * the accessible reading of the same data, required on every chart.
 */
export function ChartCard({
  title,
  note,
  columns,
  rows,
  children,
  testId,
}: {
  title: string;
  note?: string;
  /** Column headers for the table view. */
  columns: string[];
  /** Rows for the table view, already formatted for display. */
  rows: Array<Array<string | number>>;
  children: ReactNode;
  testId?: string;
}) {
  const t = useTranslations('common');
  const [asTable, setAsTable] = useState(false);

  return (
    <div className="rounded-[14px] border border-emerald-100 bg-white p-4 shadow-[0_4px_14px_rgba(6,78,59,0.05)]" data-testid={testId}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0F2E22]">{title}</h3>
          {note && <p className="text-[11px] text-gray-500">{note}</p>}
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50"
          data-testid={testId ? `${testId}-toggle` : undefined}
        >
          {asTable ? <BarChart3 className="h-3 w-3" /> : <Table2 className="h-3 w-3" />}
          {asTable ? t('dashboardShell.chartView') : t('dashboardShell.tableView')}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                {columns.map((c) => (
                  <th key={c} className="pb-1 pr-3 font-medium">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={columns.length} className="py-6 text-center text-gray-400">{t('dashboardShell.noData')}</td></tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {r.map((cell, j) => (
                      <td key={j} className={`py-1.5 pr-3 ${j === 0 ? '' : 'tabular-nums'}`}>{cell}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="min-h-[240px]">{children}</div>
      )}
    </div>
  );
}

/** Simple horizontal bar list — readable at any width, no chart library needed. */
export function BarList({
  rows,
  valueFormatter,
  colorFor,
  emptyText,
}: {
  rows: Array<{ label: string; value: number; note?: string }>;
  valueFormatter: (v: number) => string;
  /** Index-based colour picker; sequential ramps pass their own. */
  colorFor?: (index: number, row: { label: string; value: number }) => string;
  emptyText: string;
}) {
  if (rows.length === 0) return <p className="py-10 text-center text-sm text-gray-400">{emptyText}</p>;
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <div className="space-y-2 pt-1">
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-gray-700" title={r.label}>{r.label}</span>
            <span className="flex-shrink-0 font-medium tabular-nums text-gray-900">{valueFormatter(r.value)}</span>
          </div>
          <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, (Math.abs(r.value) / max) * 100)}%`,
                background: colorFor ? colorFor(i, r) : SERIES_COLORS[i % SERIES_COLORS.length],
              }}
            />
          </div>
          {r.note && <p className="mt-0.5 text-[11px] text-gray-400">{r.note}</p>}
        </div>
      ))}
    </div>
  );
}

/**
 * Column chart over a time axis, drawn as SVG.
 *
 * Deliberately hand-rolled rather than pulled from a chart library: it needs a
 * dashed target line, labels only on the points that carry a story (latest,
 * highest, lowest), and no second Y axis — constraints that are quicker to
 * honour directly than to configure around.
 */
export function TrendColumns({
  points,
  valueFormatter,
  targetValue,
  targetLabel,
  emptyText,
}: {
  points: Array<{ label: string; value: number | null }>;
  valueFormatter: (v: number) => string;
  targetValue?: number;
  targetLabel?: string;
  emptyText: string;
}) {
  const real = points.filter((p) => p.value != null) as Array<{ label: string; value: number }>;
  if (real.length === 0) return <p className="py-10 text-center text-sm text-gray-400">{emptyText}</p>;

  const values = real.map((p) => p.value);
  const maxV = Math.max(...values, targetValue ?? 0);
  const minV = Math.min(...values, 0);
  const span = maxV - minV || 1;

  const H = 200;
  const W = 100;
  const barW = W / points.length;

  const latest = real[real.length - 1];
  const highest = real.reduce((a, b) => (b.value > a.value ? b : a));
  const lowest = real.reduce((a, b) => (b.value < a.value ? b : a));
  const storyLabels = new Set([latest.label, highest.label, lowest.label]);

  const y = (v: number) => H - ((v - minV) / span) * (H - 24) - 4;

  return (
    <div className="pt-2">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[200px] w-full" role="img">
        {targetValue != null && (
          <line
            x1={0} x2={W} y1={y(targetValue)} y2={y(targetValue)}
            stroke={STATUS_COLORS.warn} strokeWidth={0.5} strokeDasharray="2 1.5"
          />
        )}
        {points.map((p, i) => {
          if (p.value == null) return null;
          const top = y(p.value);
          return (
            <rect
              key={p.label}
              x={i * barW + barW * 0.2}
              y={top}
              width={barW * 0.6}
              height={Math.max(1, H - 4 - top)}
              rx={0.8}
              fill={SERIES_COLORS[0]}
            />
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-gray-400">
        {points.map((p) => (
          <span key={p.label} className="flex-1 text-center">
            {storyLabels.has(p.label) && p.value != null ? valueFormatter(p.value) : ''}
          </span>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-500">
        {points.map((p) => (
          <span key={p.label} className="flex-1 truncate text-center">{p.label.slice(-2)}</span>
        ))}
      </div>
      {targetValue != null && targetLabel && (
        <p className="mt-1 text-[11px] text-amber-700">┈ {targetLabel}</p>
      )}
    </div>
  );
}

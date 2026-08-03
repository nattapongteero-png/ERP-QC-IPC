'use client';

/**
 * StatCard Component
 * Feature: 007-hr-personnel-management
 *
 * A summary statistic card for dashboards showing key metrics.
 * Supports optional trends, icons, and click interactions.
 */

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface TrendIndicator {
  direction: 'up' | 'down' | 'neutral';
  value: string;
}

/**
 * Soft-tinted card surfaces (the goods-receipt "concept" the team standardised
 * on): coloured background + matching border so each KPI reads at a glance
 * instead of a wall of white cards. `tone` picks the palette; default 'emerald'
 * keeps every card on the organic theme.
 */
export type StatCardTone =
  | 'emerald' | 'blue' | 'amber' | 'rose' | 'violet' | 'cyan' | 'gray' | 'plain';

/* White card surface + a tone-coloured LEFT ACCENT BAR + tone-coloured icon.
   Label is a neutral grey, value is near-black — the colour comes from the
   left bar and the icon, not a tinted fill (matches the agreed design). */
const TONE_STYLES: Record<StatCardTone, { bg: string; border: string; label: string; value: string; icon: string; accent: string }> = {
  emerald: { bg: 'bg-white', border: 'border-gray-200', label: 'text-gray-500', value: 'text-gray-900', icon: 'text-emerald-500', accent: 'border-l-emerald-500' },
  blue:    { bg: 'bg-white', border: 'border-gray-200', label: 'text-gray-500', value: 'text-gray-900', icon: 'text-blue-500',    accent: 'border-l-blue-500' },
  amber:   { bg: 'bg-white', border: 'border-gray-200', label: 'text-gray-500', value: 'text-gray-900', icon: 'text-amber-500',   accent: 'border-l-amber-500' },
  rose:    { bg: 'bg-white', border: 'border-gray-200', label: 'text-gray-500', value: 'text-gray-900', icon: 'text-rose-500',    accent: 'border-l-rose-500' },
  violet:  { bg: 'bg-white', border: 'border-gray-200', label: 'text-gray-500', value: 'text-gray-900', icon: 'text-violet-500',  accent: 'border-l-violet-500' },
  cyan:    { bg: 'bg-white', border: 'border-gray-200', label: 'text-gray-500', value: 'text-gray-900', icon: 'text-cyan-500',    accent: 'border-l-cyan-500' },
  gray:    { bg: 'bg-white', border: 'border-gray-200', label: 'text-gray-500', value: 'text-gray-900', icon: 'text-gray-400',    accent: 'border-l-gray-400' },
  plain:   { bg: 'bg-white', border: 'border-gray-200', label: 'text-gray-500', value: 'text-gray-900', icon: 'text-emerald-500', accent: 'border-l-emerald-500' },
};

export interface StatCardProps {
  /** Label text describing the statistic */
  label: string;
  /** The main value to display (number or formatted string) */
  value: string | number;
  /**
   * A second, smaller figure shown under the value — e.g. the baht amount that
   * sits behind a count, so a card answers "how many" and "how much" at once.
   */
  subValue?: string;
  /** Caption for subValue (e.g. a unit or "รวมมูลค่า"). Ignored without subValue. */
  subLabel?: string;
  /** Icon component from lucide-react */
  icon?: LucideIcon;
  /** Soft-tinted surface palette (goods-receipt concept). Default 'emerald'. */
  tone?: StatCardTone;
  /** Icon color class (e.g., "text-emerald-500"). Overrides tone's icon colour. */
  iconColor?: string;
  /** Left border accent color (legacy; ignored when tone is set). */
  accentColor?: string;
  /** Trend indicator showing change */
  trend?: TrendIndicator;
  /** Click handler for interactive cards */
  onClick?: () => void;
  /** Link destination - makes entire card clickable */
  href?: string;
  /** Loading state - shows skeleton */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Test id passed through to the card element. */
  'data-testid'?: string;
}

export function StatCard({
  label,
  value,
  subValue,
  subLabel,
  icon: Icon,
  tone = 'emerald',
  iconColor,
  accentColor,
  trend,
  onClick,
  href,
  isLoading = false,
  className = '',
  'data-testid': dataTestId,
}: StatCardProps) {
  const isClickable = onClick || href;
  const toneStyle = TONE_STYLES[tone] ?? TONE_STYLES.emerald;

  const getTrendIcon = () => {
    if (!trend) return null;
    switch (trend.direction) {
      case 'up':
        return <TrendingUp className="h-3 w-3" />;
      case 'down':
        return <TrendingDown className="h-3 w-3" />;
      default:
        return <Minus className="h-3 w-3" />;
    }
  };

  const getTrendColor = () => {
    if (!trend) return '';
    switch (trend.direction) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  const content = (
    <div
      data-testid={dataTestId}
      className={`rounded-[14px] border border-l-4 p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)] ${toneStyle.bg} ${toneStyle.border} ${toneStyle.accent} ${
        isClickable ? 'hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer' : ''
      } ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* `truncate` forced one line, so on a 390px screen (two cards per
              row) labels were cut to "TOTAL O..." / "คำสั่งซื้อทั้..." — the
              label needs 82px but only gets 64px. Allow two lines and clamp,
              so the label reads in full instead of being chopped. */}
          {/* `leading-relaxed` (not the tight text-xs default): line-clamp forces
              overflow:hidden, and a short line-box clipped the TOP of stacked Thai
              marks — "ทั้งหมด" (ท+◌ั+◌้), "อนุมัติ" — so the label heads looked cut.
              A taller line box gives the upper marks room; the clamp still caps 2
              lines. */}
          <p className={`text-xs font-medium uppercase tracking-wide leading-relaxed line-clamp-2 ${toneStyle.label}`}>{label}</p>
          {isLoading ? (
            <div className="h-8 w-16 bg-black/5 rounded animate-pulse mt-1" />
          ) : (
            <p className={`text-3xl font-bold truncate mt-1 ${toneStyle.value}`}>{value}</p>
          )}
          {subValue && !isLoading && (
            <p className="mt-1 flex items-baseline gap-1.5 truncate">
              <span className="text-sm font-semibold text-gray-700">{subValue}</span>
              {subLabel && <span className="text-xs text-gray-400">{subLabel}</span>}
            </p>
          )}
          {trend && !isLoading && (
            <p className={`text-xs flex items-center gap-1 mt-1 ${getTrendColor()}`}>
              {getTrendIcon()}
              <span>{trend.value}</span>
            </p>
          )}
        </div>
        {Icon && (
          <div className={`flex-shrink-0 w-11 h-11 flex items-center justify-center`}>
            <Icon className={`h-6 w-6 ${iconColor || toneStyle.icon}`} />
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

export default StatCard;

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

const TONE_STYLES: Record<StatCardTone, { bg: string; border: string; label: string; value: string; icon: string }> = {
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'text-emerald-700', value: 'text-emerald-900', icon: 'text-emerald-500' },
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    label: 'text-blue-700',    value: 'text-blue-900',    icon: 'text-blue-500' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   label: 'text-amber-700',   value: 'text-amber-900',   icon: 'text-amber-500' },
  rose:    { bg: 'bg-rose-50',    border: 'border-rose-200',    label: 'text-rose-700',    value: 'text-rose-900',    icon: 'text-rose-500' },
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-200',  label: 'text-violet-700',  value: 'text-violet-900',  icon: 'text-violet-500' },
  cyan:    { bg: 'bg-cyan-50',    border: 'border-cyan-200',    label: 'text-cyan-700',    value: 'text-cyan-900',    icon: 'text-cyan-500' },
  gray:    { bg: 'bg-gray-50',    border: 'border-gray-200',    label: 'text-gray-600',    value: 'text-gray-900',    icon: 'text-gray-400' },
  plain:   { bg: 'bg-white',      border: 'border-gray-200',    label: 'text-gray-500',    value: 'text-gray-900',    icon: 'text-emerald-500' },
};

export interface StatCardProps {
  /** Label text describing the statistic */
  label: string;
  /** The main value to display (number or formatted string) */
  value: string | number;
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
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'emerald',
  iconColor,
  accentColor,
  trend,
  onClick,
  href,
  isLoading = false,
  className = '',
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
      className={`rounded-[14px] border p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)] ${toneStyle.bg} ${toneStyle.border} ${
        isClickable ? 'hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer' : ''
      } ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-medium uppercase tracking-wide truncate ${toneStyle.label}`}>{label}</p>
          {isLoading ? (
            <div className="h-8 w-16 bg-black/5 rounded animate-pulse mt-1" />
          ) : (
            <p className={`text-3xl font-bold truncate mt-1 ${toneStyle.value}`}>{value}</p>
          )}
          {trend && !isLoading && (
            <p className={`text-xs flex items-center gap-1 mt-1 ${getTrendColor()}`}>
              {getTrendIcon()}
              <span>{trend.value}</span>
            </p>
          )}
        </div>
        {Icon && (
          <div className={`flex-shrink-0 w-11 h-11 rounded-xl bg-white/60 flex items-center justify-center`}>
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

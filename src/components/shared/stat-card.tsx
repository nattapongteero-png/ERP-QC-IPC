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

export interface StatCardProps {
  /** Label text describing the statistic */
  label: string;
  /** The main value to display (number or formatted string) */
  value: string | number;
  /** Icon component from lucide-react */
  icon?: LucideIcon;
  /** Icon color class (e.g., "text-emerald-500") */
  iconColor?: string;
  /** Left border accent color (e.g., "border-emerald-500") */
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
  iconColor = 'text-emerald-500',
  accentColor = 'border-emerald-500',
  trend,
  onClick,
  href,
  isLoading = false,
  className = '',
}: StatCardProps) {
  const isClickable = onClick || href;

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
      className={`bg-white rounded-lg shadow p-4 border-l-4 ${accentColor} ${
        isClickable ? 'hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer' : ''
      } ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-500 truncate">{label}</p>
          {isLoading ? (
            <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-2xl font-bold truncate">{value}</p>
          )}
          {trend && !isLoading && (
            <p className={`text-xs flex items-center gap-1 mt-1 ${getTrendColor()}`}>
              {getTrendIcon()}
              <span>{trend.value}</span>
            </p>
          )}
        </div>
        {Icon && <Icon className={`h-8 w-8 flex-shrink-0 ${iconColor}`} />}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

export default StatCard;

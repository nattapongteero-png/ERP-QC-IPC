'use client';

import { HTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps extends HTMLAttributes<HTMLDivElement> {
  /** Main value to display prominently */
  value: string | number;
  /** Label/title for the KPI */
  label: string;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Icon component to display */
  icon?: ReactNode;
  /** Icon background color class */
  iconBgColor?: string;
  /** Icon color class */
  iconColor?: string;
  /** Trend direction */
  trend?: 'up' | 'down' | 'neutral';
  /** Trend value (e.g., "+12%", "-5%") */
  trendValue?: string;
  /** Optional footer content */
  footer?: ReactNode;
}

export const KPICard = forwardRef<HTMLDivElement, KPICardProps>(
  (
    {
      className,
      value,
      label,
      subtitle,
      icon,
      iconBgColor = 'bg-emerald-100',
      iconColor = 'text-emerald-600',
      trend,
      trendValue,
      footer,
      ...props
    },
    ref
  ) => {
    const getTrendIcon = () => {
      switch (trend) {
        case 'up':
          return <TrendingUp className="h-4 w-4" />;
        case 'down':
          return <TrendingDown className="h-4 w-4" />;
        case 'neutral':
          return <Minus className="h-4 w-4" />;
        default:
          return null;
      }
    };

    const getTrendColor = () => {
      switch (trend) {
        case 'up':
          return 'text-green-600 bg-green-50';
        case 'down':
          return 'text-red-600 bg-red-50';
        case 'neutral':
          return 'text-gray-600 bg-gray-50';
        default:
          return '';
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          'bg-white rounded-xl border border-gray-200',
          'shadow-sm hover:shadow-lg',
          'transition-all duration-200 ease-out',
          'motion-reduce:transition-none motion-reduce:hover:shadow-sm',
          'p-5',
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Label */}
            <p className="text-sm font-medium text-gray-500 truncate">{label}</p>

            {/* Value */}
            <p className="mt-2 text-3xl font-bold text-gray-900 tracking-tight">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>

            {/* Subtitle and Trend */}
            <div className="mt-2 flex items-center gap-2">
              {subtitle && (
                <span className="text-sm text-gray-500">{subtitle}</span>
              )}
              {trend && trendValue && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                    getTrendColor()
                  )}
                >
                  {getTrendIcon()}
                  {trendValue}
                </span>
              )}
            </div>
          </div>

          {/* Icon */}
          {icon && (
            <div
              className={cn(
                'flex-shrink-0 p-3 rounded-xl',
                iconBgColor
              )}
            >
              <div className={cn('h-6 w-6', iconColor)}>{icon}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        {footer && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {footer}
          </div>
        )}
      </div>
    );
  }
);

KPICard.displayName = 'KPICard';

// Skeleton variant for loading state
interface KPICardSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Show icon placeholder */
  showIcon?: boolean;
  /** Show trend placeholder */
  showTrend?: boolean;
}

export const KPICardSkeleton = forwardRef<HTMLDivElement, KPICardSkeletonProps>(
  ({ className, showIcon = true, showTrend = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-white rounded-xl border border-gray-200 p-5',
          'animate-pulse',
          className
        )}
        aria-label="Loading KPI data"
        role="status"
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            {/* Label skeleton */}
            <div className="h-4 w-24 bg-gray-200 rounded" />
            {/* Value skeleton */}
            <div className="h-8 w-32 bg-gray-200 rounded" />
            {/* Subtitle/Trend skeleton */}
            {showTrend && (
              <div className="flex items-center gap-2">
                <div className="h-3 w-16 bg-gray-200 rounded" />
                <div className="h-5 w-12 bg-gray-200 rounded-full" />
              </div>
            )}
          </div>
          {/* Icon skeleton */}
          {showIcon && (
            <div className="h-12 w-12 bg-gray-200 rounded-xl" />
          )}
        </div>
        <span className="sr-only">Loading...</span>
      </div>
    );
  }
);

KPICardSkeleton.displayName = 'KPICardSkeleton';

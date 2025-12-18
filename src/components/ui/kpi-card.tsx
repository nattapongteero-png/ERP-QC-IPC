'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from './card';
import { Skeleton } from './skeleton';

const trendVariants = cva(
  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
  {
    variants: {
      trend: {
        up: 'text-green-600 bg-green-50',
        down: 'text-red-600 bg-red-50',
        neutral: 'text-gray-600 bg-gray-50',
      },
    },
    defaultVariants: {
      trend: 'neutral',
    },
  }
);

export interface KPICardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Main value to display prominently */
  value: string | number;
  /** Label/title for the KPI */
  label: string;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Icon component to display */
  icon?: React.ReactNode;
  /** Icon background color class */
  iconBgColor?: string;
  /** Icon color class */
  iconColor?: string;
  /** Trend direction */
  trend?: 'up' | 'down' | 'neutral';
  /** Trend value (e.g., "+12%", "-5%") */
  trendValue?: string;
  /** Optional footer content */
  footer?: React.ReactNode;
}

const KPICard = React.forwardRef<HTMLDivElement, KPICardProps>(
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

    return (
      <Card
        ref={ref}
        elevation="raised"
        className={cn('p-5', className)}
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
                <span className={cn(trendVariants({ trend }))}>
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
      </Card>
    );
  }
);

KPICard.displayName = 'KPICard';

// Skeleton variant for loading state
interface KPICardSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Show icon placeholder */
  showIcon?: boolean;
  /** Show trend placeholder */
  showTrend?: boolean;
}

const KPICardSkeleton = React.forwardRef<HTMLDivElement, KPICardSkeletonProps>(
  ({ className, showIcon = true, showTrend = true, ...props }, ref) => {
    return (
      <Card
        ref={ref}
        elevation="flat"
        className={cn('p-5', className)}
        aria-label="Loading KPI data"
        role="status"
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            {/* Label skeleton */}
            <Skeleton width={96} height={16} />
            {/* Value skeleton */}
            <Skeleton width={128} height={32} />
            {/* Subtitle/Trend skeleton */}
            {showTrend && (
              <div className="flex items-center gap-2">
                <Skeleton width={64} height={12} />
                <Skeleton width={48} height={20} variant="text" className="rounded-full" />
              </div>
            )}
          </div>
          {/* Icon skeleton */}
          {showIcon && (
            <Skeleton variant="rectangular" width={48} height={48} className="rounded-xl" />
          )}
        </div>
        <span className="sr-only">Loading...</span>
      </Card>
    );
  }
);

KPICardSkeleton.displayName = 'KPICardSkeleton';

export { KPICard, KPICardSkeleton, trendVariants };

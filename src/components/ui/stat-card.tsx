'use client';

import { HTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Stat value */
  value: string | number;
  /** Stat label */
  label: string;
  /** Icon component */
  icon?: ReactNode;
  /** Color variant */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the card is clickable */
  clickable?: boolean;
}

const variantStyles = {
  default: {
    bg: 'bg-gray-50',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
    labelColor: 'text-gray-600',
    valueColor: 'text-gray-900',
  },
  primary: {
    bg: 'bg-emerald-50',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    labelColor: 'text-emerald-600',
    valueColor: 'text-emerald-900',
  },
  success: {
    bg: 'bg-green-50',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    labelColor: 'text-green-600',
    valueColor: 'text-green-900',
  },
  warning: {
    bg: 'bg-yellow-50',
    iconBg: 'bg-yellow-100',
    iconColor: 'text-yellow-600',
    labelColor: 'text-yellow-600',
    valueColor: 'text-yellow-900',
  },
  danger: {
    bg: 'bg-red-50',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    labelColor: 'text-red-600',
    valueColor: 'text-red-900',
  },
  info: {
    bg: 'bg-blue-50',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    labelColor: 'text-blue-600',
    valueColor: 'text-blue-900',
  },
};

const sizeStyles = {
  sm: {
    padding: 'p-3',
    iconSize: 'h-8 w-8',
    iconPadding: 'p-1.5',
    iconInner: 'h-4 w-4',
    labelSize: 'text-xs',
    valueSize: 'text-lg',
    gap: 'gap-2',
  },
  md: {
    padding: 'p-4',
    iconSize: 'h-10 w-10',
    iconPadding: 'p-2',
    iconInner: 'h-5 w-5',
    labelSize: 'text-sm',
    valueSize: 'text-xl',
    gap: 'gap-3',
  },
  lg: {
    padding: 'p-5',
    iconSize: 'h-12 w-12',
    iconPadding: 'p-2.5',
    iconInner: 'h-6 w-6',
    labelSize: 'text-sm',
    valueSize: 'text-2xl',
    gap: 'gap-4',
  },
};

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  (
    {
      className,
      value,
      label,
      icon,
      variant = 'default',
      size = 'md',
      clickable = false,
      onClick,
      ...props
    },
    ref
  ) => {
    const variantStyle = variantStyles[variant];
    const sizeStyle = sizeStyles[size];

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl border border-gray-200',
          variantStyle.bg,
          sizeStyle.padding,
          clickable && [
            'cursor-pointer',
            'hover:shadow-md hover:-translate-y-0.5',
            'active:translate-y-0 active:shadow-sm',
            'transition-all duration-200 ease-out',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
          ],
          'motion-reduce:transition-none motion-reduce:hover:transform-none',
          className
        )}
        onClick={onClick}
        tabIndex={clickable ? 0 : undefined}
        role={clickable ? 'button' : undefined}
        {...props}
      >
        <div className={cn('flex items-center', sizeStyle.gap)}>
          {icon && (
            <div
              className={cn(
                'flex-shrink-0 rounded-lg',
                variantStyle.iconBg,
                sizeStyle.iconPadding
              )}
            >
              <div className={cn(variantStyle.iconColor, sizeStyle.iconInner)}>
                {icon}
              </div>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className={cn('font-medium truncate', variantStyle.labelColor, sizeStyle.labelSize)}>
              {label}
            </p>
            <p className={cn('font-bold', variantStyle.valueColor, sizeStyle.valueSize)}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          </div>
        </div>
      </div>
    );
  }
);

StatCard.displayName = 'StatCard';

// Skeleton variant for loading state
interface StatCardSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show icon placeholder */
  showIcon?: boolean;
}

export const StatCardSkeleton = forwardRef<HTMLDivElement, StatCardSkeletonProps>(
  ({ className, size = 'md', showIcon = true, ...props }, ref) => {
    const sizeStyle = sizeStyles[size];

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl border border-gray-200 bg-gray-50',
          sizeStyle.padding,
          'animate-pulse',
          className
        )}
        aria-label="Loading stat data"
        role="status"
        {...props}
      >
        <div className={cn('flex items-center', sizeStyle.gap)}>
          {showIcon && (
            <div className={cn('bg-gray-200 rounded-lg', sizeStyle.iconSize)} />
          )}
          <div className="flex-1 space-y-2">
            <div className="h-3 w-20 bg-gray-200 rounded" />
            <div className="h-5 w-12 bg-gray-200 rounded" />
          </div>
        </div>
        <span className="sr-only">Loading...</span>
      </div>
    );
  }
);

StatCardSkeleton.displayName = 'StatCardSkeleton';

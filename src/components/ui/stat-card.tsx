'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';
import { Card } from './card';
import { Skeleton } from './skeleton';

const statCardVariants = cva(
  'motion-reduce:transition-none motion-reduce:hover:transform-none',
  {
    variants: {
      variant: {
        default: 'bg-gray-50',
        primary: 'bg-emerald-50',
        success: 'bg-green-50',
        warning: 'bg-yellow-50',
        danger: 'bg-red-50',
        info: 'bg-blue-50',
      },
      size: {
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

const iconVariants = {
  default: { bg: 'bg-gray-100', color: 'text-gray-600' },
  primary: { bg: 'bg-emerald-100', color: 'text-emerald-600' },
  success: { bg: 'bg-green-100', color: 'text-green-600' },
  warning: { bg: 'bg-yellow-100', color: 'text-yellow-600' },
  danger: { bg: 'bg-red-100', color: 'text-red-600' },
  info: { bg: 'bg-blue-100', color: 'text-blue-600' },
};

const textVariants = {
  default: { label: 'text-gray-600', value: 'text-gray-900' },
  primary: { label: 'text-emerald-600', value: 'text-emerald-900' },
  success: { label: 'text-green-600', value: 'text-green-900' },
  warning: { label: 'text-yellow-600', value: 'text-yellow-900' },
  danger: { label: 'text-red-600', value: 'text-red-900' },
  info: { label: 'text-blue-600', value: 'text-blue-900' },
};

const sizeStyles = {
  sm: {
    iconSize: 'h-8 w-8',
    iconPadding: 'p-1.5',
    iconInner: 'h-4 w-4',
    labelSize: 'text-xs',
    valueSize: 'text-lg',
    gap: 'gap-2',
  },
  md: {
    iconSize: 'h-10 w-10',
    iconPadding: 'p-2',
    iconInner: 'h-5 w-5',
    labelSize: 'text-sm',
    valueSize: 'text-xl',
    gap: 'gap-3',
  },
  lg: {
    iconSize: 'h-12 w-12',
    iconPadding: 'p-2.5',
    iconInner: 'h-6 w-6',
    labelSize: 'text-sm',
    valueSize: 'text-2xl',
    gap: 'gap-4',
  },
};

export interface StatCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statCardVariants> {
  /** Stat value */
  value: string | number;
  /** Stat label */
  label: string;
  /** Icon component */
  icon?: React.ReactNode;
  /** Whether the card is clickable */
  clickable?: boolean;
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
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
    const iconStyle = iconVariants[variant || 'default'];
    const textStyle = textVariants[variant || 'default'];
    const sizeStyle = sizeStyles[size || 'md'];

    return (
      <Card
        ref={ref}
        elevation="flat"
        interactive={clickable}
        className={cn(
          statCardVariants({ variant, size }),
          clickable && [
            'cursor-pointer',
            'hover:shadow-md hover:-translate-y-0.5',
            'active:translate-y-0 active:shadow-sm',
            'transition-all duration-200 ease-out',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
          ],
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
                iconStyle.bg,
                sizeStyle.iconPadding
              )}
            >
              <div className={cn(iconStyle.color, sizeStyle.iconInner)}>
                {icon}
              </div>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className={cn('font-medium truncate', textStyle.label, sizeStyle.labelSize)}>
              {label}
            </p>
            <p className={cn('font-bold tracking-tight', textStyle.value, sizeStyle.valueSize)}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          </div>
        </div>
      </Card>
    );
  }
);

StatCard.displayName = 'StatCard';

// Skeleton variant for loading state
interface StatCardSkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    Pick<VariantProps<typeof statCardVariants>, 'size'> {
  /** Show icon placeholder */
  showIcon?: boolean;
}

const StatCardSkeleton = React.forwardRef<HTMLDivElement, StatCardSkeletonProps>(
  ({ className, size = 'md', showIcon = true, ...props }, ref) => {
    const sizeStyle = sizeStyles[size || 'md'];

    return (
      <Card
        ref={ref}
        elevation="flat"
        className={cn(
          statCardVariants({ variant: 'default', size }),
          className
        )}
        aria-label="Loading stat data"
        role="status"
        {...props}
      >
        <div className={cn('flex items-center', sizeStyle.gap)}>
          {showIcon && (
            <Skeleton variant="rectangular" className={cn('rounded-lg', sizeStyle.iconSize)} />
          )}
          <div className="flex-1 space-y-2">
            <Skeleton width={80} height={12} />
            <Skeleton width={48} height={20} />
          </div>
        </div>
        <span className="sr-only">Loading...</span>
      </Card>
    );
  }
);

StatCardSkeleton.displayName = 'StatCardSkeleton';

export { StatCard, StatCardSkeleton, statCardVariants };

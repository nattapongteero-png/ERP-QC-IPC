'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const skeletonVariants = cva(
  'bg-gray-200 motion-reduce:animate-none motion-reduce:before:animate-none',
  {
    variants: {
      variant: {
        text: 'h-4 w-full rounded-md',
        circular: 'h-10 w-10 rounded-full',
        rectangular: 'h-20 w-full rounded-lg',
        // shadcn/ui default
        default: 'rounded-md',
      },
      animation: {
        pulse: 'animate-pulse-subtle',
        shimmer: 'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent',
        none: '',
      },
    },
    defaultVariants: {
      variant: 'text',
      animation: 'pulse',
    },
  }
);

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  /** Width (number for px, string for any CSS value) */
  width?: number | string;
  /** Height (number for px, string for any CSS value) */
  height?: number | string;
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      className,
      variant,
      animation,
      width,
      height,
      style,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(skeletonVariants({ variant, animation }), className)}
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          ...style,
        }}
        aria-hidden="true"
        role="presentation"
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

// Card skeleton preset
interface CardSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of text lines */
  lines?: number;
  /** Show avatar */
  avatar?: boolean;
  /** Show button placeholder */
  button?: boolean;
}

const CardSkeleton = React.forwardRef<HTMLDivElement, CardSkeletonProps>(
  ({ className, lines = 3, avatar = false, button = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-white rounded-xl border border-gray-200 p-6',
          className
        )}
        aria-label="Loading content"
        role="status"
        {...props}
      >
        <div className="flex items-start gap-4">
          {avatar && <Skeleton variant="circular" className="flex-shrink-0" />}
          <div className="flex-1 space-y-3">
            <Skeleton variant="text" width="60%" height={20} />
            {Array.from({ length: lines }).map((_, index) => (
              <Skeleton
                key={index}
                variant="text"
                width={index === lines - 1 ? '40%' : '100%'}
              />
            ))}
            {button && (
              <div className="pt-2">
                <Skeleton variant="rectangular" width={100} height={36} className="rounded-lg" />
              </div>
            )}
          </div>
        </div>
        <span className="sr-only">Loading...</span>
      </div>
    );
  }
);

CardSkeleton.displayName = 'CardSkeleton';

// Table row skeleton preset
interface TableRowSkeletonProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Number of columns */
  columns: number;
}

const TableRowSkeleton = React.forwardRef<HTMLTableRowElement, TableRowSkeletonProps>(
  ({ className, columns, ...props }, ref) => {
    return (
      <tr ref={ref} className={cn('animate-pulse', className)} {...props}>
        {Array.from({ length: columns }).map((_, index) => (
          <td key={index} className="px-6 py-4">
            <Skeleton variant="text" width={index === 0 ? '80%' : '60%'} />
          </td>
        ))}
      </tr>
    );
  }
);

TableRowSkeleton.displayName = 'TableRowSkeleton';

export { Skeleton, CardSkeleton, TableRowSkeleton, skeletonVariants };

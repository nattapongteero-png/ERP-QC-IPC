'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  // whitespace-nowrap: a status badge must always stay on a single line — in a
  // narrow grid cell it would otherwise wrap (e.g. "ไม่ผ่าน (เกินเกณฑ์)" breaking
  // mid-label). This is the system-wide default for every Badge.
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-800 ring-gray-500/10',
        primary: 'bg-emerald-100 text-emerald-800 ring-emerald-500/10',
        secondary: 'bg-gray-200 text-gray-700 ring-gray-500/10',
        success: 'bg-green-100 text-green-800 ring-green-500/10',
        warning: 'bg-yellow-100 text-yellow-800 ring-yellow-500/10',
        danger: 'bg-red-100 text-red-800 ring-red-500/10',
        info: 'bg-blue-100 text-blue-800 ring-blue-500/10',
        // shadcn/ui standard variants (aliases)
        destructive: 'bg-red-100 text-red-800 ring-red-500/10',
        outline: 'bg-transparent text-gray-800 ring-gray-300',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-sm',
        // shadcn/ui standard size
        default: 'px-2.5 py-0.5 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  }
);

const dotColors: Record<string, string> = {
  default: 'bg-gray-500',
  primary: 'bg-emerald-500',
  secondary: 'bg-gray-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  destructive: 'bg-red-500',
  outline: 'bg-gray-500',
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Dot indicator for status badges */
  dot?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size, dot = false, children, ...props }, ref) => {
    const variantKey = variant || 'default';

    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        {...props}
      >
        {dot && (
          <span
            className={cn('h-1.5 w-1.5 rounded-full', dotColors[variantKey])}
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

// Helper function to get badge variant based on status
function getStatusVariant(status: string): BadgeProps['variant'] {
  const statusMap: Record<string, BadgeProps['variant']> = {
    // Inventory statuses
    quarantine: 'warning',
    under_test: 'info',
    released: 'success',
    rejected: 'danger',
    blocked: 'danger',
    // Work order statuses
    planned: 'default',
    in_progress: 'info',
    completed: 'success',
    cancelled: 'danger',
    // Order statuses
    draft: 'default',
    approved: 'success',
    sent: 'info',
    partial: 'warning',
    received: 'success',
    confirmed: 'success',
    processing: 'info',
    shipped: 'info',
    delivered: 'success',
    // Quality statuses
    pending: 'warning',
    pass: 'success',
    fail: 'danger',
    retest: 'warning',
    // Deviation statuses
    open: 'warning',
    investigating: 'info',
    resolved: 'success',
    closed: 'default',
    // Severity
    minor: 'default',
    major: 'warning',
    critical: 'danger',
  };

  return statusMap[status] || 'default';
}

export { Badge, badgeVariants, getStatusVariant };

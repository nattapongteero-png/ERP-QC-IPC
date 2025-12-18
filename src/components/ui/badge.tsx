'use client';

import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Visual variant */
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  /** Size variant */
  size?: 'sm' | 'md';
  /** Dot indicator */
  dot?: boolean;
}

const variantStyles = {
  default: 'bg-gray-100 text-gray-800 ring-gray-500/10',
  primary: 'bg-emerald-100 text-emerald-800 ring-emerald-500/10',
  secondary: 'bg-gray-200 text-gray-700 ring-gray-500/10',
  success: 'bg-green-100 text-green-800 ring-green-500/10',
  warning: 'bg-yellow-100 text-yellow-800 ring-yellow-500/10',
  danger: 'bg-red-100 text-red-800 ring-red-500/10',
  info: 'bg-blue-100 text-blue-800 ring-blue-500/10',
};

const dotColors = {
  default: 'bg-gray-500',
  primary: 'bg-emerald-500',
  secondary: 'bg-gray-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'sm', dot = false, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          // Base styles
          'inline-flex items-center gap-1.5 rounded-full font-medium',
          'ring-1 ring-inset',
          // Variant and size
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              dotColors[variant]
            )}
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
export function getStatusVariant(status: string): BadgeProps['variant'] {
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

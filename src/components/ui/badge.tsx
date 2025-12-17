'use client';

import { HTMLAttributes, forwardRef } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const variants = {
  default: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = '', variant = 'default', children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}
        {...props}
      >
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

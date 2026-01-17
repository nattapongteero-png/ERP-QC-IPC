'use client';

/**
 * Issue Status Badge Component
 * Feature: Issue Tracker
 *
 * Displays issue status with appropriate color coding.
 */

import type { IssueStatus } from '@/types/issues';

export interface StatusBadgeProps {
  status: IssueStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

interface StatusConfig {
  label: string;
  bgColor: string;
  textColor: string;
}

const STATUS_CONFIG: Record<IssueStatus, StatusConfig> = {
  draft: {
    label: 'Draft',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
  },
  submitted: {
    label: 'Submitted',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
  },
  triaged: {
    label: 'Triaged',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-800',
  },
  in_progress: {
    label: 'In Progress',
    bgColor: 'bg-indigo-100',
    textColor: 'text-indigo-800',
  },
  resolved: {
    label: 'Resolved',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
  },
  verified: {
    label: 'Verified',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-800',
  },
  closed: {
    label: 'Closed',
    bgColor: 'bg-gray-200',
    textColor: 'text-gray-600',
  },
};

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
};

export function StatusBadge({ status, size = 'md', className = '' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.bgColor} ${config.textColor} ${SIZE_CLASSES[size]} ${className}`}
    >
      {config.label}
    </span>
  );
}

export default StatusBadge;

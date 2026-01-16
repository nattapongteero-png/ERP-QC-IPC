'use client';

/**
 * Issue Priority Badge Component
 * Feature: Issue Tracker
 *
 * Displays issue priority (Immediate/Urgent/Scheduled/Backlog) with appropriate color coding.
 */

import type { IssuePriority } from '@/types/issues';

export interface PriorityBadgeProps {
  priority: IssuePriority | null;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

interface PriorityConfig {
  label: string;
  bgColor: string;
  textColor: string;
  icon?: string;
}

const PRIORITY_CONFIG: Record<IssuePriority | 'unassigned', PriorityConfig> = {
  immediate: {
    label: 'Immediate',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    icon: '>>>',
  },
  urgent: {
    label: 'Urgent',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
    icon: '>>',
  },
  scheduled: {
    label: 'Scheduled',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    icon: '>',
  },
  backlog: {
    label: 'Backlog',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
    icon: '-',
  },
  unassigned: {
    label: 'Unassigned',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-500',
    icon: '?',
  },
};

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
};

export function PriorityBadge({
  priority,
  size = 'md',
  showIcon = false,
  className = '',
}: PriorityBadgeProps) {
  const configKey = priority || 'unassigned';
  const config = PRIORITY_CONFIG[configKey] || PRIORITY_CONFIG.unassigned;

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.bgColor} ${config.textColor} ${SIZE_CLASSES[size]} ${className}`}
    >
      {showIcon && config.icon && (
        <span className="mr-1 font-bold">{config.icon}</span>
      )}
      {config.label}
    </span>
  );
}

export default PriorityBadge;

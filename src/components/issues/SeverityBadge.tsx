'use client';

/**
 * Issue Severity Badge Component
 * Feature: Issue Tracker
 *
 * Displays issue severity (Critical/Major/Minor) with appropriate color coding.
 * Follows GMP-aligned severity levels.
 */

import type { IssueSeverity } from '@/types/issues';

export interface SeverityBadgeProps {
  severity: IssueSeverity;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

interface SeverityConfig {
  label: string;
  bgColor: string;
  textColor: string;
  icon?: string;
}

const SEVERITY_CONFIG: Record<IssueSeverity, SeverityConfig> = {
  critical: {
    label: 'Critical',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    icon: '!!',
  },
  major: {
    label: 'Major',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
    icon: '!',
  },
  minor: {
    label: 'Minor',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    icon: '-',
  },
};

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
};

export function SeverityBadge({
  severity,
  size = 'md',
  showIcon = false,
  className = '',
}: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[severity] || {
    label: severity,
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
  };

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

export default SeverityBadge;

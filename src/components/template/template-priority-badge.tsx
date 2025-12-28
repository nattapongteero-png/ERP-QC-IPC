'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { ArrowDown, Minus, ArrowUp, AlertTriangle } from 'lucide-react';

export type TemplateItemPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TemplatePriorityBadgeProps {
  priority: TemplateItemPriority;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const priorityConfig: Record<TemplateItemPriority, {
  label: string;
  className: string;
  icon: React.ElementType;
}> = {
  low: {
    label: 'Low',
    className: 'bg-slate-50 text-slate-600 border-slate-200',
    icon: ArrowDown,
  },
  medium: {
    label: 'Medium',
    className: 'bg-blue-50 text-blue-600 border-blue-200',
    icon: Minus,
  },
  high: {
    label: 'High',
    className: 'bg-orange-50 text-orange-600 border-orange-200',
    icon: ArrowUp,
  },
  urgent: {
    label: 'Urgent',
    className: 'bg-red-50 text-red-600 border-red-200',
    icon: AlertTriangle,
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export function TemplatePriorityBadge({
  priority,
  showIcon = true,
  size = 'md',
}: TemplatePriorityBadgeProps) {
  const config = priorityConfig[priority] || priorityConfig.medium;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded-full border',
        config.className,
        sizeClasses[size]
      )}
    >
      {showIcon && <Icon className={cn(size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4')} />}
      {config.label}
    </span>
  );
}

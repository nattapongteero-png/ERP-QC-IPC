'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { FileEdit, CheckCircle, Archive } from 'lucide-react';

export type TemplateItemStatus = 'draft' | 'active' | 'archived';

export interface TemplateStatusBadgeProps {
  status: TemplateItemStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<TemplateItemStatus, {
  label: string;
  className: string;
  icon: React.ElementType;
}> = {
  draft: {
    label: 'Draft',
    className: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: FileEdit,
  },
  active: {
    label: 'Active',
    className: 'bg-green-50 text-green-700 border-green-200',
    icon: CheckCircle,
  },
  archived: {
    label: 'Archived',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Archive,
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export function TemplateStatusBadge({
  status,
  showIcon = true,
  size = 'md',
}: TemplateStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft;
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

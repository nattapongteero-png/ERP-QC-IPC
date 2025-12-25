'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { RefreshCcw, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface TemplatePageHeaderProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  iconClassName?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export function TemplatePageHeader({
  title,
  subtitle,
  icon: Icon,
  iconClassName = 'from-blue-500 to-blue-600',
  onRefresh,
  isRefreshing,
  actions,
  children,
}: TemplatePageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className={cn(
          'p-3 bg-gradient-to-br rounded-xl shadow-lg shadow-blue-500/20',
          iconClassName
        )}>
          <Icon className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {children}
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCcw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
        )}
        {actions}
      </div>
    </div>
  );
}

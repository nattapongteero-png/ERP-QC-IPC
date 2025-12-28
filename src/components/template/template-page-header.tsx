'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { LucideIcon } from 'lucide-react';
import { Button } from 'devextreme-react/button';

export interface TemplatePageHeaderProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  iconClassName?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
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
  className = '',
}: TemplatePageHeaderProps) {
  return (
    <div className={cn(
      'bg-gradient-to-r from-slate-50 via-white to-blue-50 border-b border-gray-100 -mx-1 px-6 py-5 rounded-t-xl',
      className
    )}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Icon + Title */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className={cn(
              'p-3.5 bg-gradient-to-br rounded-xl shadow-lg shadow-blue-500/25',
              iconClassName
            )}>
              <Icon className="h-7 w-7 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {children}

          {onRefresh && (
            <Button
              text="Refresh"
              icon={isRefreshing ? 'spindown' : 'refresh'}
              stylingMode="outlined"
              disabled={isRefreshing}
              onClick={onRefresh}
            />
          )}

          {actions}
        </div>
      </div>
    </div>
  );
}

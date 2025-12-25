'use client';

/**
 * KPI Card Component
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US11)
 *
 * Reusable card component for displaying KPI metrics on the audit dashboard
 */

import { ReactNode } from 'react';

export interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    label: string;
  };
  status?: 'normal' | 'warning' | 'critical';
  onClick?: () => void;
  children?: ReactNode;
}

const statusColors = {
  normal: 'border-l-green-500',
  warning: 'border-l-yellow-500',
  critical: 'border-l-red-500',
};

const statusBgColors = {
  normal: 'bg-green-50',
  warning: 'bg-yellow-50',
  critical: 'bg-red-50',
};

export function KpiCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  status = 'normal',
  onClick,
  children,
}: KpiCardProps) {
  return (
    <div
      className={`
        bg-white rounded-lg shadow-sm border-l-4 ${statusColors[status]}
        p-4 hover:shadow-md transition-shadow cursor-pointer
        ${onClick ? 'cursor-pointer' : ''}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-600">{title}</h3>
          <div className="mt-1 flex items-baseline">
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
            {subtitle && (
              <span className="ml-2 text-sm text-gray-500">{subtitle}</span>
            )}
          </div>
          {trend && (
            <div className="mt-1 flex items-center">
              <span
                className={`text-sm ${
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {trend.isPositive ? '+' : '-'}
                {Math.abs(trend.value)}%
              </span>
              <span className="ml-1 text-xs text-gray-500">{trend.label}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`p-2 rounded-full ${statusBgColors[status]}`}>
            {icon}
          </div>
        )}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export interface KpiGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
}

export function KpiGrid({ children, columns = 4 }: KpiGridProps) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {children}
    </div>
  );
}

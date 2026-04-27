'use client';

import React from 'react';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import * as Icons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RefreshCcw, CalendarCheck, ArrowLeft } from 'lucide-react';

type IconName = 'book' | 'file-text' | 'receipt' | 'dollar-sign' | 'building' | 'wrench' | 'bar-chart' | 'calendar' | 'calculator' | 'clock' | 'credit-card' | 'wallet' | 'banknote';

const iconMap: Record<IconName, LucideIcon> = {
  'book': Icons.BookOpen,
  'file-text': Icons.FileText,
  'receipt': Icons.Receipt,
  'dollar-sign': Icons.DollarSign,
  'building': Icons.Building2,
  'wrench': Icons.Wrench,
  'bar-chart': Icons.BarChart3,
  'calendar': Icons.CalendarCheck,
  'calculator': Icons.Calculator,
  'clock': Icons.Clock,
  'credit-card': Icons.CreditCard,
  'wallet': Icons.Wallet,
  'banknote': Icons.Banknote,
};

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface AccountingPageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  currentPeriod?: string;
  periodStatus?: 'open' | 'closed' | 'soft_closed';
  onRefresh?: () => void;
  onBack?: () => void;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function AccountingPageHeader({
  title,
  subtitle,
  icon = 'calculator',
  currentPeriod,
  periodStatus,
  onRefresh,
  onBack,
  breadcrumbs,
  actions,
  className = '',
}: AccountingPageHeaderProps) {
  const IconComponent = iconMap[icon] || Icons.Calculator;

  const periodStatusColors = {
    open: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-700',
    soft_closed: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className={`bg-gradient-to-r from-slate-50 via-white to-blue-50 border-b border-gray-100 px-6 py-5 ${className}`}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="text-sm text-gray-500 mb-2">
          {breadcrumbs.map((crumb, index) => (
            <span key={index}>
              {index > 0 && <span className="mx-2">/</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-blue-600 transition-colors">{crumb.label}</Link>
              ) : (
                <span className="text-gray-700">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Back + Icon + Title */}
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="p-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="relative">
            <div className="p-3.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/25">
              <IconComponent className="h-7 w-7 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight" data-testid="page-title">{title}</h1>
            {subtitle && (
              <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right: Period + Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {currentPeriod && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200 shadow-sm">
              <CalendarCheck className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">{currentPeriod}</span>
              {periodStatus && (
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${periodStatusColors[periodStatus]}`}>
                  {periodStatus === 'open' ? 'เปิด' : periodStatus === 'closed' ? 'ปิด' : 'ปิดชั่วคราว'}
                </span>
              )}
            </div>
          )}

          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="gap-2 bg-white/80 backdrop-blur-sm"
            >
              <RefreshCcw className="h-4 w-4" />
              รีเฟรช
            </Button>
          )}

          {actions}
        </div>
      </div>
    </div>
  );
}

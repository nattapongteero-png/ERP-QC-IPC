'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

type Status =
  | 'draft' | 'posted' | 'reversed' | 'approved' | 'cancelled'
  | 'partial' | 'paid' | 'overdue' | 'open' | 'closed'
  | 'active' | 'inactive' | 'pending' | 'confirmed'
  | 'cleared' | 'bounced' | 'rejected';

// NOTE: labels are resolved at render time via t('common.statusBadge.<status>').
// Only the bg/text CSS classes are kept here.
const statusConfig: Record<Status, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700' },
  posted: { bg: 'bg-green-100', text: 'text-green-700' },
  reversed: { bg: 'bg-red-100', text: 'text-red-700' },
  approved: { bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700' },
  partial: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  paid: { bg: 'bg-green-100', text: 'text-green-700' },
  overdue: { bg: 'bg-red-100', text: 'text-red-700' },
  open: { bg: 'bg-blue-100', text: 'text-blue-700' },
  closed: { bg: 'bg-gray-100', text: 'text-gray-700' },
  active: { bg: 'bg-green-100', text: 'text-green-700' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-700' },
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-700' },
  cleared: { bg: 'bg-green-100', text: 'text-green-700' },
  bounced: { bg: 'bg-red-100', text: 'text-red-700' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700' },
};

export interface AccountingStatusBadgeProps {
  status: Status;
  size?: 'sm' | 'md';
  className?: string;
}

export function AccountingStatusBadge({
  status,
  size = 'sm',
  className = '',
}: AccountingStatusBadgeProps) {
  const t = useTranslations('accounting');
  const config = statusConfig[status] || statusConfig.draft;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  const labelKey = statusConfig[status] ? status : 'draft';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.bg} ${config.text} ${sizeClasses} ${className}`}
    >
      {t(`common.statusBadge.${labelKey}`)}
    </span>
  );
}

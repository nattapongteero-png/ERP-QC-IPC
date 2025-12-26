'use client';

import React from 'react';

type Status =
  | 'draft' | 'posted' | 'reversed' | 'approved' | 'cancelled'
  | 'partial' | 'paid' | 'overdue' | 'open' | 'closed'
  | 'active' | 'inactive' | 'pending' | 'confirmed'
  | 'cleared' | 'bounced';

const statusConfig: Record<Status, { label: string; bg: string; text: string }> = {
  draft: { label: 'ร่าง', bg: 'bg-gray-100', text: 'text-gray-700' },
  posted: { label: 'ผ่านแล้ว', bg: 'bg-green-100', text: 'text-green-700' },
  reversed: { label: 'กลับรายการ', bg: 'bg-red-100', text: 'text-red-700' },
  approved: { label: 'อนุมัติ', bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { label: 'ยกเลิก', bg: 'bg-red-100', text: 'text-red-700' },
  partial: { label: 'บางส่วน', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  paid: { label: 'ชำระแล้ว', bg: 'bg-green-100', text: 'text-green-700' },
  overdue: { label: 'ค้างชำระ', bg: 'bg-red-100', text: 'text-red-700' },
  open: { label: 'เปิด', bg: 'bg-blue-100', text: 'text-blue-700' },
  closed: { label: 'ปิด', bg: 'bg-gray-100', text: 'text-gray-700' },
  active: { label: 'ใช้งาน', bg: 'bg-green-100', text: 'text-green-700' },
  inactive: { label: 'ไม่ใช้งาน', bg: 'bg-gray-100', text: 'text-gray-700' },
  pending: { label: 'รอดำเนินการ', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  confirmed: { label: 'ยืนยัน', bg: 'bg-blue-100', text: 'text-blue-700' },
  cleared: { label: 'เคลียร์แล้ว', bg: 'bg-green-100', text: 'text-green-700' },
  bounced: { label: 'เช็คคืน', bg: 'bg-red-100', text: 'text-red-700' },
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
  const config = statusConfig[status] || statusConfig.draft;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.bg} ${config.text} ${sizeClasses} ${className}`}
    >
      {config.label}
    </span>
  );
}

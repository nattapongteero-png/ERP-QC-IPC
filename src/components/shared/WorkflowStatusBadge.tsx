'use client';

/**
 * WorkflowStatusBadge Component
 * Feature: 009-gmp-compliance-gap-analysis
 *
 * A reusable badge component for displaying workflow statuses across
 * Document Control, CAPA, Complaints, and other GMP compliance modules.
 */

import React from 'react';

export type WorkflowStatusType =
  // Document statuses
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'obsolete'
  | 'superseded'
  | 'archived'
  // CAPA statuses
  | 'open'
  | 'investigation'
  | 'action_pending'
  | 'verification'
  | 'closed'
  | 'cancelled'
  // Complaint statuses
  | 'received'
  | 'under_investigation'
  | 'resolved'
  // Recall statuses
  | 'initiated'
  | 'in_progress'
  | 'completed'
  // Audit statuses
  | 'scheduled'
  // CAPA action statuses
  | 'pending'
  | 'overdue'
  // General
  | 'effective'
  | 'not_effective'
  | 'partial';

export interface WorkflowStatusBadgeProps {
  /** The status to display */
  status: WorkflowStatusType | string;
  /** Optional custom label (defaults to formatted status) */
  label?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

interface StatusConfig {
  label: string;
  bgColor: string;
  textColor: string;
  borderColor?: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  // Draft/Pending states - Gray/Yellow
  draft: {
    label: 'ร่าง',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
  },
  pending: {
    label: 'รอดำเนินการ',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
  },
  pending_approval: {
    label: 'รอการอนุมัติ',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
  },
  scheduled: {
    label: 'กำหนดการแล้ว',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
  },

  // In Progress states - Blue
  in_progress: {
    label: 'กำลังดำเนินการ',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
  },
  investigation: {
    label: 'กำลังสืบสวน',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
  },
  under_investigation: {
    label: 'กำลังสืบสวน',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
  },
  action_pending: {
    label: 'รอดำเนินการแก้ไข',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
  },
  verification: {
    label: 'กำลังตรวจสอบ',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-800',
  },

  // Success states - Green
  approved: {
    label: 'อนุมัติแล้ว',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
  },
  active: {
    label: 'ใช้งาน',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
  },
  completed: {
    label: 'เสร็จสิ้น',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
  },
  closed: {
    label: 'ปิดแล้ว',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
  },
  resolved: {
    label: 'แก้ไขแล้ว',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
  },
  effective: {
    label: 'มีประสิทธิผล',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
  },

  // Warning/Partial states - Orange
  partial: {
    label: 'บางส่วน',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
  },
  received: {
    label: 'รับเรื่องแล้ว',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
  },
  initiated: {
    label: 'เริ่มดำเนินการ',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
  },

  // Error/Danger states - Red
  rejected: {
    label: 'ถูกปฏิเสธ',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
  },
  cancelled: {
    label: 'ยกเลิก',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
  },
  overdue: {
    label: 'เกินกำหนด',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
  },
  not_effective: {
    label: 'ไม่มีประสิทธิผล',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
  },

  // Inactive states - Gray
  obsolete: {
    label: 'ล้าสมัย',
    bgColor: 'bg-gray-200',
    textColor: 'text-gray-600',
  },
  superseded: {
    label: 'ถูกแทนที่',
    bgColor: 'bg-gray-200',
    textColor: 'text-gray-600',
  },
  archived: {
    label: 'เก็บถาวร',
    bgColor: 'bg-gray-200',
    textColor: 'text-gray-600',
  },

  // Special - Open (CAPA)
  open: {
    label: 'เปิดอยู่',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
  },
};

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
};

function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function WorkflowStatusBadge({
  status,
  label,
  size = 'md',
  className = '',
}: WorkflowStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: formatStatusLabel(status),
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
  };

  const displayLabel = label || config.label;

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.bgColor} ${config.textColor} ${SIZE_CLASSES[size]} ${className}`}
    >
      {displayLabel}
    </span>
  );
}

export default WorkflowStatusBadge;

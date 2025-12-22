'use client';

/**
 * AuditTrailViewer Component
 * Feature: 009-gmp-compliance-gap-analysis
 *
 * Displays a chronological list of audit log entries for GMP compliance modules.
 * Shows who did what and when, supporting various action types.
 */

import React from 'react';
import {
  Clock,
  User,
  FileText,
  Edit3,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  PlusCircle,
  ArrowRight,
  RefreshCw,
  Eye,
  Download,
} from 'lucide-react';

export type AuditActionType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'approved'
  | 'rejected'
  | 'submitted'
  | 'viewed'
  | 'downloaded'
  | 'status_changed'
  | 'assigned'
  | 'comment_added'
  | 'version_created'
  | 'closed'
  | 'reopened';

export interface AuditLogEntry {
  /** Unique identifier */
  id: number | string;
  /** Type of action performed */
  action: AuditActionType | string;
  /** Description of the action */
  description?: string;
  /** User who performed the action */
  userName: string;
  /** User's role/position */
  userRole?: string;
  /** When the action occurred */
  timestamp: string;
  /** Old value (for changes) */
  oldValue?: string | null;
  /** New value (for changes) */
  newValue?: string | null;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface AuditTrailViewerProps {
  /** Array of audit log entries */
  entries: AuditLogEntry[];
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Maximum entries to show (0 = all) */
  maxEntries?: number;
  /** Loading state */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface ActionConfig {
  icon: React.ReactNode;
  label: string;
  color: string;
  bgColor: string;
}

const ACTION_CONFIG: Record<string, ActionConfig> = {
  created: {
    icon: <PlusCircle className="h-4 w-4" />,
    label: 'สร้าง',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  updated: {
    icon: <Edit3 className="h-4 w-4" />,
    label: 'แก้ไข',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  deleted: {
    icon: <Trash2 className="h-4 w-4" />,
    label: 'ลบ',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  approved: {
    icon: <CheckCircle className="h-4 w-4" />,
    label: 'อนุมัติ',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  rejected: {
    icon: <XCircle className="h-4 w-4" />,
    label: 'ปฏิเสธ',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  submitted: {
    icon: <ArrowRight className="h-4 w-4" />,
    label: 'ส่ง',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  viewed: {
    icon: <Eye className="h-4 w-4" />,
    label: 'ดู',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  downloaded: {
    icon: <Download className="h-4 w-4" />,
    label: 'ดาวน์โหลด',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  status_changed: {
    icon: <RefreshCw className="h-4 w-4" />,
    label: 'เปลี่ยนสถานะ',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  assigned: {
    icon: <User className="h-4 w-4" />,
    label: 'มอบหมาย',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  comment_added: {
    icon: <FileText className="h-4 w-4" />,
    label: 'เพิ่มความคิดเห็น',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  version_created: {
    icon: <PlusCircle className="h-4 w-4" />,
    label: 'สร้างเวอร์ชันใหม่',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  closed: {
    icon: <CheckCircle className="h-4 w-4" />,
    label: 'ปิด',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  reopened: {
    icon: <AlertCircle className="h-4 w-4" />,
    label: 'เปิดใหม่',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
};

function getActionConfig(action: string): ActionConfig {
  return (
    ACTION_CONFIG[action] || {
      icon: <Clock className="h-4 w-4" />,
      label: action,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
    }
  );
}

function formatTimestamp(timestamp: string): { date: string; time: string; relative: string } {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let relative: string;
  if (diffMins < 1) {
    relative = 'เมื่อสักครู่';
  } else if (diffMins < 60) {
    relative = `${diffMins} นาทีที่แล้ว`;
  } else if (diffHours < 24) {
    relative = `${diffHours} ชั่วโมงที่แล้ว`;
  } else if (diffDays < 7) {
    relative = `${diffDays} วันที่แล้ว`;
  } else {
    relative = date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  return {
    date: date.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    relative,
  };
}

export function AuditTrailViewer({
  entries,
  compact = false,
  maxEntries = 0,
  isLoading = false,
  className = '',
}: AuditTrailViewerProps) {
  if (isLoading) {
    return (
      <div className={`space-y-3 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 bg-gray-200 rounded" />
              <div className="h-3 w-2/3 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p>ยังไม่มีประวัติการดำเนินการ</p>
      </div>
    );
  }

  const displayEntries = maxEntries > 0 ? entries.slice(0, maxEntries) : entries;

  if (compact) {
    return (
      <div className={`space-y-2 ${className}`}>
        {displayEntries.map((entry) => {
          const config = getActionConfig(entry.action);
          const time = formatTimestamp(entry.timestamp);

          return (
            <div
              key={entry.id}
              className="flex items-center gap-2 text-sm"
            >
              <span className={`${config.color}`}>{config.icon}</span>
              <span className="font-medium">{entry.userName}</span>
              <span className="text-gray-500">{config.label}</span>
              <span className="text-gray-400 text-xs">{time.relative}</span>
            </div>
          );
        })}
        {maxEntries > 0 && entries.length > maxEntries && (
          <p className="text-xs text-gray-500 text-center pt-2">
            + อีก {entries.length - maxEntries} รายการ
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {displayEntries.map((entry, index) => {
        const config = getActionConfig(entry.action);
        const time = formatTimestamp(entry.timestamp);
        const isLast = index === displayEntries.length - 1;

        return (
          <div key={entry.id} className="relative flex gap-4">
            {/* Vertical line connector */}
            {!isLast && (
              <div className="absolute left-4 top-10 w-0.5 h-[calc(100%-2.5rem)] bg-gray-200" />
            )}

            {/* Action icon */}
            <div
              className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${config.bgColor} ${config.color}`}
            >
              {config.icon}
            </div>

            {/* Entry content */}
            <div className="flex-1 min-w-0 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm">
                    <span className="font-medium text-gray-900">
                      {entry.userName}
                    </span>
                    {entry.userRole && (
                      <span className="text-gray-500 text-xs ml-1">
                        ({entry.userRole})
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className={`font-medium ${config.color}`}>
                      {config.label}
                    </span>
                    {entry.description && (
                      <span className="text-gray-600">
                        : {entry.description}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-500">{time.date}</p>
                  <p className="text-xs text-gray-400">{time.time}</p>
                </div>
              </div>

              {/* Value changes */}
              {(entry.oldValue || entry.newValue) && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                  {entry.oldValue && (
                    <p className="text-red-600">
                      <span className="font-medium">เดิม:</span> {entry.oldValue}
                    </p>
                  )}
                  {entry.newValue && (
                    <p className="text-green-600">
                      <span className="font-medium">ใหม่:</span> {entry.newValue}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {maxEntries > 0 && entries.length > maxEntries && (
        <p className="text-sm text-gray-500 text-center pt-2">
          แสดง {maxEntries} จาก {entries.length} รายการ
        </p>
      )}
    </div>
  );
}

export default AuditTrailViewer;

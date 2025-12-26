'use client';

/**
 * AuditLogViewerDialog Component
 *
 * Reusable dialog for viewing audit logs of any entity.
 * Similar to DocumentAttachment but for audit trails.
 *
 * Features:
 * - Intelligent Filtering: Filter by user, action type, date range, text search
 * - Field-Level Diff: Expandable view showing exact field changes (old → new values)
 * - Thai Language: Full Thai support for action labels and UI
 * - Timeline View: Visual timeline with action icons and colors
 * - Pagination: Page size selector (10/20/50/100) with navigation controls
 *
 * Usage:
 * ```tsx
 * <AuditLogViewerDialog
 *   entityType="templateItems"
 *   entityId={itemId}
 *   visible={showDialog}
 *   onClose={() => setShowDialog(false)}
 *   fieldLabels={{ nameTh: 'ชื่อ (ไทย)', status: 'สถานะ' }}
 * />
 * ```
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { DxTextBox } from '@/components/ui/dx-text-box';
import {
  History,
  Clock,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Edit3,
  Trash2,
  CheckCircle,
  XCircle,
  ArrowRight,
  RefreshCw,
  Eye,
  Download,
  AlertCircle,
} from 'lucide-react';
import type {
  AuditLog,
  AuditLogViewerDialogProps,
} from '@/types/audit-log';
import { ACTION_LABELS_TH } from '@/types/audit-log';
import { parseFieldChanges } from '@/lib/utils/audit-utils';

// Action icon and color configuration
interface ActionConfig {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const ACTION_CONFIG: Record<string, ActionConfig> = {
  CREATE: {
    icon: <PlusCircle className="h-4 w-4" />,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  UPDATE: {
    icon: <Edit3 className="h-4 w-4" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  DELETE: {
    icon: <Trash2 className="h-4 w-4" />,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  APPROVE: {
    icon: <CheckCircle className="h-4 w-4" />,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  REJECT: {
    icon: <XCircle className="h-4 w-4" />,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  SUBMIT: {
    icon: <ArrowRight className="h-4 w-4" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  VIEW: {
    icon: <Eye className="h-4 w-4" />,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  DOWNLOAD: {
    icon: <Download className="h-4 w-4" />,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  SYNC: {
    icon: <RefreshCw className="h-4 w-4" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  CLOSE: {
    icon: <CheckCircle className="h-4 w-4" />,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  REOPEN: {
    icon: <AlertCircle className="h-4 w-4" />,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
};

function getActionConfig(action: string): ActionConfig {
  return (
    ACTION_CONFIG[action] || {
      icon: <Clock className="h-4 w-4" />,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
    }
  );
}

// Format timestamp
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

// Format value for display
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? 'ใช่' : 'ไม่';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

// Single audit log entry component
interface AuditLogEntryProps {
  log: AuditLog;
  isLast: boolean;
  fieldLabels: Record<string, string>;
  expanded: boolean;
  onToggle: () => void;
}

function AuditLogEntry({ log, isLast, fieldLabels, expanded, onToggle }: AuditLogEntryProps) {
  const config = getActionConfig(log.action);
  const time = formatTimestamp(log.createdAt);
  const changes = parseFieldChanges(log.oldValue, log.newValue, fieldLabels);
  const hasChanges = changes.length > 0;

  return (
    <div className="relative flex gap-4">
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
          <div className="flex-1">
            <p className="text-sm">
              <span className="font-medium text-gray-900">{log.userName || 'ระบบ'}</span>
              {log.userRole && (
                <span className="text-gray-500 text-xs ml-1">({log.userRole})</span>
              )}
            </p>
            <p className="text-sm text-gray-700">
              <span className={`font-medium ${config.color}`}>
                {ACTION_LABELS_TH[log.action] || log.action}
              </span>
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-500">{time.date}</p>
            <p className="text-xs text-gray-400">{time.time}</p>
          </div>
        </div>

        {/* Expandable changes section */}
        {hasChanges && (
          <div className="mt-2">
            <button
              onClick={onToggle}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  ซ่อนรายละเอียด
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  ดูการเปลี่ยนแปลง ({changes.length} รายการ)
                </>
              )}
            </button>

            {expanded && (
              <div className="mt-2 space-y-1 rounded-lg bg-gray-50 p-3">
                {changes.map((change, idx) => (
                  <div key={idx} className="text-xs">
                    <span className="font-medium text-gray-700">{change.fieldLabel}:</span>
                    {log.action === 'CREATE' ? (
                      <span className="ml-2 text-green-600">{formatValue(change.newValue)}</span>
                    ) : log.action === 'DELETE' ? (
                      <span className="ml-2 text-red-600 line-through">
                        {formatValue(change.oldValue)}
                      </span>
                    ) : (
                      <>
                        <span className="ml-2 text-red-600 line-through">
                          {formatValue(change.oldValue)}
                        </span>
                        <span className="mx-1 text-gray-400">→</span>
                        <span className="text-green-600">{formatValue(change.newValue)}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* IP Address */}
        {log.ipAddress && log.ipAddress !== 'unknown' && (
          <p className="mt-1 text-xs text-gray-400">IP: {log.ipAddress}</p>
        )}
      </div>
    </div>
  );
}

// Main component
export function AuditLogViewerDialog({
  entityType,
  entityId,
  title = 'ประวัติการเปลี่ยนแปลง',
  visible,
  onClose,
  fieldLabels = {},
}: AuditLogViewerDialogProps) {
  // State
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filterUser, setFilterUser] = useState<number | null>(null);
  const [filterAction, setFilterAction] = useState<string | null>(null);
  const [filterFromDate, setFilterFromDate] = useState<Date | null>(null);
  const [filterToDate, setFilterToDate] = useState<Date | null>(null);
  const [searchText, setSearchText] = useState('');

  // Expansion state for each log entry
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  // Available filter options
  const [availableUsers, setAvailableUsers] = useState<
    Array<{ userId: number; userName: string }>
  >([]);
  const [availableActions, setAvailableActions] = useState<string[]>([]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    if (!entityId) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('tableName', entityType);
      params.set('recordId', String(entityId));
      params.set('limit', String(pageSize));
      params.set('offset', String((currentPage - 1) * pageSize));

      if (filterUser) params.set('userId', String(filterUser));
      if (filterAction) params.set('action', filterAction);
      if (filterFromDate) params.set('fromDate', filterFromDate.toISOString().split('T')[0]);
      if (filterToDate) params.set('toDate', filterToDate.toISOString().split('T')[0]);
      if (searchText) params.set('searchText', searchText);

      const res = await fetch(`/api/audit-logs?${params}`);
      const result = await res.json();

      if (result.success) {
        setLogs(result.data || []);
        setTotal(result.total || 0);
      } else {
        setError(result.error || 'Failed to load audit logs');
      }
    } catch (err) {
      setError('Failed to load audit logs');
      console.error('Fetch audit logs error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [entityType, entityId, filterUser, filterAction, filterFromDate, filterToDate, searchText, currentPage, pageSize]);

  // Total pages calculation
  const totalPages = Math.ceil(total / pageSize);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterUser, filterAction, filterFromDate, filterToDate, searchText]);

  // Fetch filter options
  const fetchFilterOptions = useCallback(async () => {
    if (!entityId) return;

    try {
      // Fetch modifiers
      const modifiersRes = await fetch(
        `/api/audit-logs?tableName=${entityType}&recordId=${entityId}&getModifiers=true`
      );
      const modifiersResult = await modifiersRes.json();
      if (modifiersResult.success) {
        setAvailableUsers(modifiersResult.data || []);
      }

      // Fetch actions
      const actionsRes = await fetch(
        `/api/audit-logs?tableName=${entityType}&recordId=${entityId}&getActions=true`
      );
      const actionsResult = await actionsRes.json();
      if (actionsResult.success) {
        setAvailableActions(actionsResult.data || []);
      }
    } catch (err) {
      console.error('Fetch filter options error:', err);
    }
  }, [entityType, entityId]);

  // Load data when dialog opens
  useEffect(() => {
    if (visible) {
      fetchLogs();
      fetchFilterOptions();
    }
  }, [visible, fetchLogs, fetchFilterOptions]);

  // Toggle log expansion
  const toggleLogExpansion = (logId: number) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  // Expand/collapse all
  const expandAll = () => {
    setExpandedLogs(new Set(logs.map((l) => l.id)));
  };

  const collapseAll = () => {
    setExpandedLogs(new Set());
  };

  // Clear filters
  const clearFilters = () => {
    setFilterUser(null);
    setFilterAction(null);
    setFilterFromDate(null);
    setFilterToDate(null);
    setSearchText('');
  };

  // Check if any filter is active
  const hasActiveFilters = filterUser || filterAction || filterFromDate || filterToDate || searchText;

  // User options for select
  const userOptions = useMemo(
    () =>
      availableUsers.map((u) => ({
        id: u.userId,
        name: u.userName,
      })),
    [availableUsers]
  );

  // Action options for select
  const actionOptions = useMemo(
    () =>
      availableActions.map((action) => ({
        id: action,
        name: ACTION_LABELS_TH[action] || action,
      })),
    [availableActions]
  );

  return (
    <DxPopup
      visible={visible}
      onHiding={onClose}
      title={title}
      width={700}
      height="80%"
      maxHeight="90vh"
      showCloseButton
      dragEnabled
      resizeEnabled
    >
      <div className="flex h-full flex-col">
        {/* Header with filters */}
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-gray-500" />
              <span className="text-sm text-gray-600">
                {total} รายการ
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <DxTextBox
                  value={searchText}
                  onValueChange={setSearchText}
                  placeholder="ค้นหา..."
                  width={150}
                  showClearButton
                />
              </div>

              {/* Filter toggle */}
              <DxButton
                icon="filter"
                text={showFilters ? 'ซ่อนตัวกรอง' : 'ตัวกรอง'}
                type={hasActiveFilters ? 'default' : 'normal'}
                stylingMode="outlined"
                onClick={() => setShowFilters(!showFilters)}
              />

              {/* Expand/Collapse buttons */}
              <DxButton
                icon="expand"
                hint="ขยายทั้งหมด"
                type="normal"
                stylingMode="text"
                onClick={expandAll}
              />
              <DxButton
                icon="collapse"
                hint="ยุบทั้งหมด"
                type="normal"
                stylingMode="text"
                onClick={collapseAll}
              />
            </div>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-3">
              <div className="grid grid-cols-2 gap-3">
                {/* User filter */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    ผู้ทำรายการ
                  </label>
                  <DxSelectBox
                    value={filterUser}
                    onValueChange={setFilterUser}
                    dataSource={userOptions}
                    displayExpr="name"
                    valueExpr="id"
                    placeholder="ทั้งหมด"
                    showClearButton
                  />
                </div>

                {/* Action filter */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    ประเภท
                  </label>
                  <DxSelectBox
                    value={filterAction}
                    onValueChange={setFilterAction}
                    dataSource={actionOptions}
                    displayExpr="name"
                    valueExpr="id"
                    placeholder="ทั้งหมด"
                    showClearButton
                  />
                </div>

                {/* Date range */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    ตั้งแต่วันที่
                  </label>
                  <DxDateBox
                    value={filterFromDate}
                    onValueChange={setFilterFromDate}
                    type="date"
                    displayFormat="dd/MM/yyyy"
                    showClearButton
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    ถึงวันที่
                  </label>
                  <DxDateBox
                    value={filterToDate}
                    onValueChange={setFilterToDate}
                    type="date"
                    displayFormat="dd/MM/yyyy"
                    showClearButton
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                {hasActiveFilters && (
                  <DxButton
                    text="ล้างตัวกรอง"
                    icon="clear"
                    type="normal"
                    stylingMode="text"
                    onClick={clearFilters}
                  />
                )}
                <DxButton
                  text="ค้นหา"
                  icon="search"
                  type="default"
                  onClick={fetchLogs}
                />
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <DxLoadIndicator />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-red-500">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p>{error}</p>
              <DxButton
                text="ลองใหม่"
                type="default"
                stylingMode="text"
                onClick={fetchLogs}
                className="mt-2"
              />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <History className="h-12 w-12 mb-3 text-gray-300" />
              <p className="text-lg font-medium">ยังไม่มีประวัติ</p>
              <p className="text-sm">ยังไม่มีการบันทึกการเปลี่ยนแปลงสำหรับรายการนี้</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log, index) => (
                <AuditLogEntry
                  key={log.id}
                  log={log}
                  isLast={index === logs.length - 1}
                  fieldLabels={fieldLabels}
                  expanded={expandedLogs.has(log.id)}
                  onToggle={() => toggleLogExpansion(log.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer with pagination */}
        <div className="border-t px-4 py-3 flex items-center justify-between">
          {/* Pagination info and controls */}
          {total > 0 && (
            <div className="flex items-center gap-4">
              {/* Page size selector */}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>แสดง</span>
                <DxSelectBox
                  value={pageSize}
                  onValueChange={(val) => {
                    setPageSize(val);
                    setCurrentPage(1);
                  }}
                  dataSource={[10, 20, 50, 100]}
                  width={70}
                />
                <span>รายการ</span>
              </div>

              {/* Page navigation */}
              <div className="flex items-center gap-1">
                <DxButton
                  icon="chevrondoubleleft"
                  type="normal"
                  stylingMode="text"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  hint="หน้าแรก"
                />
                <DxButton
                  icon="chevronleft"
                  type="normal"
                  stylingMode="text"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  hint="หน้าก่อน"
                />
                <span className="px-3 text-sm text-gray-600">
                  หน้า {currentPage} / {totalPages || 1}
                </span>
                <DxButton
                  icon="chevronright"
                  type="normal"
                  stylingMode="text"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  hint="หน้าถัดไป"
                />
                <DxButton
                  icon="chevrondoubleright"
                  type="normal"
                  stylingMode="text"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  hint="หน้าสุดท้าย"
                />
              </div>

              {/* Total count */}
              <span className="text-sm text-gray-500">
                (ทั้งหมด {total} รายการ)
              </span>
            </div>
          )}

          {/* Close button */}
          <DxButton
            text="ปิด"
            type="normal"
            stylingMode="outlined"
            onClick={onClose}
          />
        </div>
      </div>
    </DxPopup>
  );
}

export default AuditLogViewerDialog;

'use client';

// HR Audit Log Page
// Feature: 007-hr-personnel-management

import { useState } from 'react';
import DataGrid, {
  Column,
  SearchPanel,
  HeaderFilter,
  FilterRow,
  Paging,
  Pager,
  Scrolling,
} from 'devextreme-react/data-grid';
import { Popup } from 'devextreme-react/popup';
import { useQuery } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Calendar,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';
import type { HRAuditAction } from '@/types/hr';
import type { HRAuditLogWithDetails, AuditSummary, AccessReviewEntry } from '@/lib/services/hr.service';

async function fetchAuditLogs(params: {
  fromDate?: string;
  toDate?: string;
  skip?: number;
  take?: number;
}): Promise<{ data: HRAuditLogWithDetails[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params.fromDate) searchParams.set('fromDate', params.fromDate);
  if (params.toDate) searchParams.set('toDate', params.toDate);
  if (params.skip) searchParams.set('skip', String(params.skip));
  if (params.take) searchParams.set('take', String(params.take));

  const response = await fetch('/api/hr/audit?' + searchParams.toString());
  if (!response.ok) throw new Error('Failed to fetch audit logs');
  const result = await response.json();
  return result.data || { data: [], total: 0 };
}

async function fetchAuditSummary(
  fromDate?: string,
  toDate?: string
): Promise<AuditSummary[]> {
  const searchParams = new URLSearchParams();
  if (fromDate) searchParams.set('fromDate', fromDate);
  if (toDate) searchParams.set('toDate', toDate);

  const response = await fetch('/api/hr/audit/summary?' + searchParams.toString());
  if (!response.ok) throw new Error('Failed to fetch audit summary');
  const result = await response.json();
  return result.data || [];
}

async function fetchAccessReview(): Promise<AccessReviewEntry[]> {
  const response = await fetch('/api/hr/audit/access-review');
  if (!response.ok) throw new Error('Failed to fetch access review');
  const result = await response.json();
  return result.data || [];
}

const ACTION_COLORS: Partial<Record<HRAuditAction, string>> = {
  HR_EMP_CREATE: 'bg-green-100 text-green-800',
  HR_EMP_UPDATE: 'bg-blue-100 text-blue-800',
  HR_EMP_TERMINATE: 'bg-red-100 text-red-800',
  HR_AUTH_GRANT: 'bg-purple-100 text-purple-800',
  HR_AUTH_REVOKE: 'bg-orange-100 text-orange-800',
  HR_ROLE_ASSIGN: 'bg-indigo-100 text-indigo-800',
  HR_ROLE_REVOKE: 'bg-yellow-100 text-yellow-800',
};

export default function AuditLogPage() {
  const [activeTab, setActiveTab] = useState<'logs' | 'summary' | 'access-review'>('logs');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [showDetailPopup, setShowDetailPopup] = useState(false);
  const [selectedLog, setSelectedLog] = useState<HRAuditLogWithDetails | null>(null);

  const { data: auditResult } = useQuery({
    queryKey: ['hr', 'audit', 'logs', fromDate, toDate],
    queryFn: () => fetchAuditLogs({ fromDate, toDate, take: 100 }),
  });

  const { data: summary = [] } = useQuery({
    queryKey: ['hr', 'audit', 'summary', fromDate, toDate],
    queryFn: () => fetchAuditSummary(fromDate, toDate),
  });

  const { data: accessReview = [] } = useQuery({
    queryKey: ['hr', 'audit', 'access-review'],
    queryFn: fetchAccessReview,
    enabled: activeTab === 'access-review',
  });

  const auditLogs = auditResult?.data || [];
  const totalLogs = auditResult?.total || 0;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderActionCell = (cellData: { data: HRAuditLogWithDetails }) => {
    const log = cellData.data;
    const colorClass = ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colorClass}`}>
        {log.actionLabel}
      </span>
    );
  };

  const renderDateCell = (cellData: { value: string }) => {
    return <span className="text-sm">{formatDate(cellData.value)}</span>;
  };

  const renderActionsCell = (cellData: { data: HRAuditLogWithDetails }) => {
    return (
      <DxButton
        icon="info"
        hint="ดูรายละเอียด"
        type="default"
        stylingMode="text"
        onClick={() => {
          setSelectedLog(cellData.data);
          setShowDetailPopup(true);
        }}
      />
    );
  };

  const clearFilters = () => {
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            บันทึกการตรวจสอบ
          </h1>
          <p className="text-gray-600 mt-1">
            ประวัติการเปลี่ยนแปลงข้อมูล HR และการตรวจสอบสิทธิ์
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-full">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalLogs}</div>
              <div className="text-gray-600 text-sm">รายการทั้งหมด</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-full">
              <BarChart3 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary.length}</div>
              <div className="text-gray-600 text-sm">ประเภทกิจกรรม</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-full">
              <ShieldCheck className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{accessReview.length}</div>
              <div className="text-gray-600 text-sm">ผู้มีสิทธิ์</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-full">
              <Calendar className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {summary.reduce((acc, s) => acc + s.count, 0)}
              </div>
              <div className="text-gray-600 text-sm">กิจกรรมทั้งหมด</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'logs'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('logs')}
        >
          บันทึกกิจกรรม
        </button>
        <button
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'summary'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('summary')}
        >
          สรุปตามประเภท
        </button>
        <button
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'access-review'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('access-review')}
        >
          ตรวจสอบสิทธิ์
        </button>
      </div>

      {/* Date Filters */}
      {(activeTab === 'logs' || activeTab === 'summary') && (
        <div className="bg-white rounded-lg shadow p-4 flex items-end gap-4">
          <DxDateBox
            label="จากวันที่"
            value={fromDate || ''}
            onValueChange={setFromDate}
            width={180}
            showClearButton
          />
          <DxDateBox
            label="ถึงวันที่"
            value={toDate || ''}
            onValueChange={setToDate}
            width={180}
            showClearButton
          />
          {(fromDate || toDate) && (
            <DxButton
              text="ล้างตัวกรอง"
              type="normal"
              onClick={clearFilters}
            />
          )}
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-lg shadow">
          <DataGrid
            dataSource={auditLogs}
            showBorders
            rowAlternationEnabled
            columnAutoWidth
            wordWrapEnabled
            height={500}
          >
            <SearchPanel visible placeholder="ค้นหา..." />
            <HeaderFilter visible />
            <FilterRow visible />
            <Scrolling mode="virtual" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50]}
              showInfo
            />

            <Column
              dataField="createdAt"
              caption="วันที่/เวลา"
              width={180}
              cellRender={renderDateCell}
            />
            <Column
              dataField="actionLabel"
              caption="กิจกรรม"
              width={160}
              cellRender={renderActionCell}
            />
            <Column
              dataField="userName"
              caption="ผู้ดำเนินการ"
              width={150}
            />
            <Column
              dataField="tableName"
              caption="ตาราง"
              width={180}
            />
            <Column
              dataField="recordId"
              caption="รหัส"
              width={80}
              alignment="center"
            />
            <Column
              caption=""
              width={60}
              alignment="center"
              cellRender={renderActionsCell}
            />
          </DataGrid>
        </div>
      )}

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium mb-4">สรุปกิจกรรมตามประเภท</h3>
          <div className="grid grid-cols-3 gap-4">
            {summary.map((item) => (
              <div
                key={item.action}
                className="border rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <div className="text-sm text-gray-600">{item.actionLabel}</div>
                  <div className="text-2xl font-bold">{item.count}</div>
                </div>
                <div className="text-4xl text-gray-200">
                  <FileText className="h-10 w-10" />
                </div>
              </div>
            ))}
            {summary.length === 0 && (
              <div className="col-span-3 text-center text-gray-500 py-12">
                ไม่พบข้อมูลสรุป
              </div>
            )}
          </div>
        </div>
      )}

      {/* Access Review Tab */}
      {activeTab === 'access-review' && (
        <div className="bg-white rounded-lg shadow">
          <DataGrid
            dataSource={accessReview}
            showBorders
            rowAlternationEnabled
            columnAutoWidth
            wordWrapEnabled
            height={500}
          >
            <SearchPanel visible placeholder="ค้นหา..." />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50]}
              showInfo
            />

            <Column
              dataField="employeeName"
              caption="พนักงาน"
              width={200}
            />
            <Column
              caption="บทบาท"
              cellRender={(cellData: { data: AccessReviewEntry }) => (
                <div className="flex flex-wrap gap-1">
                  {cellData.data.roles.map((r, i) => (
                    <Badge
                      key={i}
                      variant={r.isActive ? 'success' : 'secondary'}
                      className="text-xs"
                    >
                      {r.roleName}
                    </Badge>
                  ))}
                  {cellData.data.roles.length === 0 && (
                    <span className="text-gray-400">-</span>
                  )}
                </div>
              )}
            />
            <Column
              caption="สิทธิ์อนุมัติ"
              cellRender={(cellData: { data: AccessReviewEntry }) => (
                <div className="flex flex-wrap gap-1">
                  {cellData.data.authorizations.map((a, i) => (
                    <Badge
                      key={i}
                      variant={a.isActive ? 'info' : 'secondary'}
                      className="text-xs"
                    >
                      {a.authType}
                    </Badge>
                  ))}
                  {cellData.data.authorizations.length === 0 && (
                    <span className="text-gray-400">-</span>
                  )}
                </div>
              )}
            />
            <Column
              caption="บทบาทใช้งาน"
              width={120}
              alignment="center"
              calculateCellValue={(data: AccessReviewEntry) =>
                data.roles.filter((r) => r.isActive).length
              }
            />
            <Column
              caption="สิทธิ์ใช้งาน"
              width={120}
              alignment="center"
              calculateCellValue={(data: AccessReviewEntry) =>
                data.authorizations.filter((a) => a.isActive).length
              }
            />
          </DataGrid>
        </div>
      )}

      {/* Detail Popup */}
      <Popup
        visible={showDetailPopup}
        onHiding={() => {
          setShowDetailPopup(false);
          setSelectedLog(null);
        }}
        title="รายละเอียดบันทึก"
        width={600}
        height="auto"
        showCloseButton
      >
        {selectedLog && (
          <div className="space-y-4 p-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">
                  วันที่/เวลา
                </label>
                <div>{formatDate(selectedLog.createdAt)}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">
                  ผู้ดำเนินการ
                </label>
                <div>{selectedLog.userName || '-'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">
                  กิจกรรม
                </label>
                <div>{selectedLog.actionLabel}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">
                  ตาราง / รหัส
                </label>
                <div>
                  {selectedLog.tableName} / {selectedLog.recordId}
                </div>
              </div>
            </div>

            {selectedLog.oldValue && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  ค่าเดิม
                </label>
                <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                  {JSON.stringify(JSON.parse(selectedLog.oldValue), null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.newValue && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  ค่าใหม่
                </label>
                <pre className="bg-green-50 p-3 rounded text-sm overflow-x-auto">
                  {JSON.stringify(JSON.parse(selectedLog.newValue), null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Popup>
    </div>
  );
}

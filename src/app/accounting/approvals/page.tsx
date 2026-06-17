/**
 * Approval Dashboard Page (T126)
 * Shows pending approvals and recent approval activity
 * Part of 011-accounting-spec-gap - User Story 5
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import DataGrid, {
  Column,
  Paging,
  Toolbar,
  Item,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import { Popup } from 'devextreme-react/popup';
import { TextArea } from 'devextreme-react/text-area';
import type { DocumentType } from '@/types/approval-workflow';

interface PendingApproval {
  id: number;
  documentType: DocumentType;
  documentId: number;
  flowId: number;
  flowName: string;
  currentStepOrder: number;
  requestedBy: number;
  requestedByName: string;
  requestedAt: string;
  amount?: number;
  description?: string;
}

interface ApprovalDashboard {
  pendingApprovals: PendingApproval[];
  recentActions: {
    id: number;
    documentType: string;
    documentId: number;
    action: string;
    actionBy: number;
    actionByName: string;
    actionAt: string;
    comments: string | null;
  }[];
  stats: {
    pendingCount: number;
    approvedToday: number;
    rejectedToday: number;
  };
}

const documentTypeLabels: Record<DocumentType, string> = {
  purchase_requisition: 'ใบขอซื้อ',
  purchase_order: 'ใบสั่งซื้อ',
  ap_invoice: 'ใบแจ้งหนี้เจ้าหนี้',
  ar_invoice: 'ใบแจ้งหนี้ลูกหนี้',
  payment: 'การชำระเงิน',
  credit_note: 'ใบลดหนี้',
  debit_note: 'ใบเพิ่มหนี้',
};

const statusColors = {
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
};

export default function ApprovalDashboardPage() {
  const t = useTranslations('accounting');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<ApprovalDashboard | null>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [actionComments, setActionComments] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/accounting/approvals/dashboard');
      const result = await response.json();
      if (result.success) {
        // The API returns flat counts (pendingCount, approvedTodayCount,
        // rejectedTodayCount); this page renders dashboard.stats.{...}. Normalize
        // so the stats cards don't crash on a missing `.stats` object.
        const d = result.data || {};
        setDashboard({
          ...d,
          stats: d.stats ?? {
            pendingCount: d.pendingCount ?? 0,
            approvedToday: d.approvedTodayCount ?? d.approvedToday ?? 0,
            rejectedToday: d.rejectedTodayCount ?? d.rejectedToday ?? 0,
          },
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleAction = (approval: PendingApproval, action: 'approve' | 'reject') => {
    setSelectedApproval(approval);
    setActionType(action);
    setActionComments('');
    setShowActionDialog(true);
  };

  const submitAction = async () => {
    if (!selectedApproval) return;

    setActionLoading(true);
    try {
      const response = await fetch(
        `/api/accounting/approvals/${selectedApproval.id}/${actionType}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comments: actionComments }),
        }
      );

      const result = await response.json();
      if (result.success) {
        setShowActionDialog(false);
        await fetchDashboard();
      } else {
        alert(result.error || `Failed to ${actionType} request`);
      }
    } catch (error) {
      console.error('Error submitting action:', error);
      alert(`Failed to ${actionType} request`);
    } finally {
      setActionLoading(false);
    }
  };

  const renderDocType = (cellData: any) => {
    const docType = cellData.value as DocumentType;
    return documentTypeLabels[docType] || docType;
  };

  const renderActions = (cellData: any) => {
    const approval = cellData.data as PendingApproval;
    return (
      <div className="flex gap-1">
        <Button
          icon="check"
          hint="อนุมัติ"
          stylingMode="text"
          type="success"
          onClick={() => handleAction(approval, 'approve')}
          data-testid={`approve-btn-${approval.id}`}
        />
        <Button
          icon="close"
          hint="ปฏิเสธ"
          stylingMode="text"
          type="danger"
          onClick={() => handleAction(approval, 'reject')}
          data-testid={`reject-btn-${approval.id}`}
        />
      </div>
    );
  };

  const renderRecentAction = (cellData: any) => {
    const action = cellData.value as string;
    const colorClass = statusColors[action as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {action.toUpperCase()}
      </span>
    );
  };

  if (loading && !dashboard) {
    return (
        <div className="flex items-center justify-center h-64">
          <LoadIndicator />
        </div>
    );
  }

  return (
      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">
            {t('page.title')}
          </h1>
          <p className="text-gray-600">
            {t('page.description')}
          </p>
        </div>

        {/* Dashboard Stats */}
        {dashboard && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
              <div className="text-sm text-gray-500">รออนุมัติ</div>
              <div className="text-3xl font-bold text-yellow-600">
                {dashboard.stats.pendingCount}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="text-sm text-gray-500">อนุมัติวันนี้</div>
              <div className="text-3xl font-bold text-green-600">
                {dashboard.stats.approvedToday}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
              <div className="text-sm text-gray-500">ปฏิเสธวันนี้</div>
              <div className="text-3xl font-bold text-red-600">
                {dashboard.stats.rejectedToday}
              </div>
            </div>
          </div>
        )}

        {/* Pending Approvals Grid */}
        <div className="bg-white rounded-lg shadow mb-6">
          <DataGrid
            dataSource={dashboard?.pendingApprovals || []}
            keyExpr="id"
            showBorders={true}
            rowAlternationEnabled={true}
            loadPanel={{ enabled: loading }}
            data-testid="pending-approvals-grid"
          >
            <Paging defaultPageSize={10} />
            <Toolbar>
              <Item location="before">
                <span className="text-lg font-medium">รายการรออนุมัติ</span>
              </Item>
              <Item location="after">
                <Button
                  icon="refresh"
                  onClick={fetchDashboard}
                  hint="รีเฟรช"
                  data-testid="refresh-btn"
                />
              </Item>
            </Toolbar>

            <Column dataField="id" caption="รหัสคำขอ" width={100} />
            <Column
              dataField="documentType"
              caption="ประเภท"
              width={180}
              cellRender={renderDocType}
            />
            <Column dataField="documentId" caption="รหัสเอกสาร" width={80} />
            <Column dataField="flowName" caption="ขั้นตอน" width={150} />
            <Column dataField="currentStepOrder" caption="ขั้น" width={60} />
            <Column dataField="requestedByName" caption="ขอโดย" width={150} />
            <Column
              dataField="amount"
              caption="จำนวนเงิน"
              width={120}
              dataType="number"
              format="#,##0.00"
            />
            <Column
              dataField="requestedAt"
              caption="ขอเมื่อ"
              width={180}
              dataType="datetime"
            />
            <Column
              caption="การดำเนินการ"
              width={100}
              cellRender={renderActions}
            />
          </DataGrid>
        </div>

        {/* Recent Actions Grid */}
        <div className="bg-white rounded-lg shadow">
          <DataGrid
            dataSource={dashboard?.recentActions || []}
            keyExpr="id"
            showBorders={true}
            rowAlternationEnabled={true}
            data-testid="recent-actions-grid"
          >
            <Paging defaultPageSize={5} />
            <Toolbar>
              <Item location="before">
                <span className="text-lg font-medium">การดำเนินการล่าสุด</span>
              </Item>
            </Toolbar>

            <Column dataField="documentType" caption="ประเภท" width={150} />
            <Column dataField="documentId" caption="รหัสเอกสาร" width={80} />
            <Column
              dataField="action"
              caption="การดำเนินการ"
              width={100}
              cellRender={renderRecentAction}
            />
            <Column dataField="actionByName" caption="โดย" width={150} />
            <Column
              dataField="actionAt"
              caption="เมื่อ"
              width={180}
              dataType="datetime"
            />
            <Column dataField="comments" caption="ความคิดเห็น" />
          </DataGrid>
        </div>

        {/* Action Dialog */}
        <Popup
          visible={showActionDialog}
          onHiding={() => setShowActionDialog(false)}
          title={actionType === 'approve' ? 'อนุมัติคำขอ' : 'ปฏิเสธคำขอ'}
          width={400}
          height="auto"
          showCloseButton={true}
        >
          <div className="p-4">
            {selectedApproval && (
              <div className="mb-4 p-3 bg-gray-50 rounded">
                <div className="text-sm text-gray-500">รายละเอียดคำขอ</div>
                <div className="font-medium">
                  {documentTypeLabels[selectedApproval.documentType]} #{selectedApproval.documentId}
                </div>
                <div className="text-sm text-gray-600">
                  ขอโดย: {selectedApproval.requestedByName}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ความคิดเห็น {actionType === 'reject' && <span className="text-red-500">*</span>}
              </label>
              <TextArea
                value={actionComments}
                onValueChanged={(e) => setActionComments(e.value || '')}
                height={100}
                placeholder={actionType === 'approve' ? 'กรอกความคิดเห็นการอนุมัติ...' : 'กรอกความคิดเห็นการปฏิเสธ...'}
                data-testid="action-comments-input"
              />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button text="ยกเลิก" onClick={() => setShowActionDialog(false)} />
              <Button
                text={actionLoading ? 'กำลังดำเนินการ...' : actionType === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}
                type={actionType === 'approve' ? 'success' : 'danger'}
                stylingMode="contained"
                onClick={submitAction}
                disabled={actionLoading || (actionType === 'reject' && !actionComments.trim())}
                data-testid="submit-action-btn"
              />
            </div>
          </div>
        </Popup>
      </div>
  );
}

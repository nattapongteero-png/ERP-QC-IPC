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
import notify from 'devextreme/ui/notify';
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

const documentTypeKeys: DocumentType[] = [
  'purchase_requisition',
  'purchase_order',
  'ap_invoice',
  'ar_invoice',
  'payment',
  'credit_note',
  'debit_note',
];

const statusColors = {
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
};

export default function ApprovalDashboardPage() {
  const t = useTranslations('accounting');

  const documentTypeLabel = (docType: DocumentType) =>
    documentTypeKeys.includes(docType) ? t(`approvals.documentTypes.${docType}`) : docType;
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
        // Confirm the action landed. Silence after a click reads as "nothing
        // happened" and gets the approver clicking again.
        notify(
          actionType === 'approve' ? 'อนุมัติเรียบร้อย' : 'ปฏิเสธเรียบร้อย',
          'success',
          2000,
        );
        await fetchDashboard();
      } else {
        // notify, not alert(): a native alert is a grey browser box titled with
        // the hostname — it looks like a phishing popup rather than part of the
        // system, blocks the page, and cannot be styled or translated.
        notify(result.error || 'ไม่สามารถดำเนินการได้ กรุณาลองใหม่', 'error', 4000);
      }
    } catch (error) {
      console.error('Error submitting action:', error);
      notify('ไม่สามารถดำเนินการได้ กรุณาลองใหม่', 'error', 4000);
    } finally {
      setActionLoading(false);
    }
  };

  const renderDocType = (cellData: any) => {
    const docType = cellData.value as DocumentType;
    return documentTypeLabel(docType);
  };

  const renderActions = (cellData: any) => {
    const approval = cellData.data as PendingApproval;
    return (
      <div className="flex gap-1">
        <Button
          icon="check"
          hint={t('approvals.actions.approve')}
          stylingMode="text"
          type="success"
          onClick={() => handleAction(approval, 'approve')}
          data-testid={`approve-btn-${approval.id}`}
        />
        <Button
          icon="close"
          hint={t('approvals.actions.reject')}
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
    // Was action.toUpperCase(), which printed the raw English "APPROVE" in Thai
    // mode and got clipped to "APPROV…". approvals.actions.approve/reject
    // already exist; anything unexpected falls back to the raw value rather
    // than showing an empty badge.
    const key = `approvals.actions.${action}`;
    const label = t(key) === key ? action : t(key);
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${colorClass}`}>
        {label}
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
            {t('approvals.title')}
          </h1>
          <p className="text-gray-600">
            {t('approvals.subtitle')}
          </p>
        </div>

        {/* Dashboard Stats */}
        {dashboard && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
              <div className="text-sm text-gray-500">{t('approvals.stats.pending')}</div>
              <div className="text-3xl font-bold text-yellow-600">
                {dashboard.stats.pendingCount}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="text-sm text-gray-500">{t('approvals.stats.approvedToday')}</div>
              <div className="text-3xl font-bold text-green-600">
                {dashboard.stats.approvedToday}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
              <div className="text-sm text-gray-500">{t('approvals.stats.rejectedToday')}</div>
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
                <span className="text-lg font-medium">{t('approvals.pendingGridTitle')}</span>
              </Item>
              <Item location="after">
                <Button
                  icon="refresh"
                  onClick={fetchDashboard}
                  hint={t('approvals.actions.refresh')}
                  elementAttr={{ 'data-testid': 'refresh-btn' }}
                />
              </Item>
            </Toolbar>

            <Column dataField="id" caption={t('approvals.columns.requestId')} width={100} />
            <Column
              dataField="documentType"
              caption={t('approvals.columns.type')}
              width={180}
              cellRender={renderDocType}
            />
            <Column dataField="documentId" caption={t('approvals.columns.documentId')} width={80} />
            <Column dataField="flowName" caption={t('approvals.columns.flow')} width={150} />
            <Column dataField="currentStepOrder" caption={t('approvals.columns.step')} width={60} />
            <Column dataField="requestedByName" caption={t('approvals.columns.requestedBy')} width={150} />
            <Column
              dataField="amount"
              caption={t('approvals.columns.amount')}
              width={120}
              dataType="number"
              format="#,##0.00"
            />
            <Column
              dataField="requestedAt"
              caption={t('approvals.columns.requestedAt')}
              width={180}
              dataType="datetime"
            />
            <Column
              caption={t('approvals.columns.actions')}
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
                <span className="text-lg font-medium">{t('approvals.recentGridTitle')}</span>
              </Item>
            </Toolbar>

            {/* dataField must match what the API returns. It sends
                documentNumber / actionBy / actionDate, but these columns asked
                for documentId / actionByName / actionAt — three fields that do
                not exist in the payload, so the columns rendered blank while
                the data was there all along. */}
            <Column
              dataField="documentType"
              caption={t('approvals.columns.type')}
              width={180}
              minWidth={180}
              // documentTypeLabel already exists and is used by the pending
              // grid; this column was printing the raw "purchase_requisition".
              cellRender={({ data }) => (
                <span className="whitespace-nowrap">
                  {documentTypeLabel(data.documentType)}
                </span>
              )}
            />
            <Column
              dataField="documentNumber"
              caption={t('approvals.columns.documentId')}
              width={200}
              minWidth={200}
            />
            <Column
              dataField="action"
              caption={t('approvals.columns.action')}
              width={110}
              minWidth={110}
              cellRender={renderRecentAction}
            />
            <Column dataField="actionBy" caption={t('approvals.columns.actionBy')} width={150} />
            <Column
              dataField="actionDate"
              caption={t('approvals.columns.actionAt')}
              width={180}
              dataType="datetime"
            />
            <Column dataField="comments" caption={t('approvals.columns.comments')} />
          </DataGrid>
        </div>

        {/* Action Dialog */}
        <Popup
          visible={showActionDialog}
          onHiding={() => setShowActionDialog(false)}
          title={actionType === 'approve' ? t('approvals.dialog.approveTitle') : t('approvals.dialog.rejectTitle')}
          width={400}
          height="auto"
          showCloseButton={true}
        >
          <div className="p-4">
            {selectedApproval && (
              <div className="mb-4 p-3 bg-gray-50 rounded">
                <div className="text-sm text-gray-500">{t('approvals.dialog.requestDetails')}</div>
                <div className="font-medium">
                  {documentTypeLabel(selectedApproval.documentType)} #{selectedApproval.documentId}
                </div>
                <div className="text-sm text-gray-600">
                  {t('approvals.dialog.requestedBy')}: {selectedApproval.requestedByName}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('approvals.dialog.comments')} {actionType === 'reject' && <span className="text-red-500">*</span>}
              </label>
              <TextArea
                value={actionComments}
                onValueChanged={(e) => setActionComments(e.value || '')}
                height={100}
                placeholder={actionType === 'approve' ? t('approvals.dialog.approvePlaceholder') : t('approvals.dialog.rejectPlaceholder')}
                data-testid="action-comments-input"
              />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button text={t('common.cancel')} onClick={() => setShowActionDialog(false)} />
              <Button
                text={actionLoading ? t('common.processing') : actionType === 'approve' ? t('approvals.actions.approve') : t('approvals.actions.reject')}
                type={actionType === 'approve' ? 'success' : 'danger'}
                stylingMode="contained"
                onClick={submitAction}
                disabled={actionLoading || (actionType === 'reject' && !actionComments.trim())}
                elementAttr={{ 'data-testid': 'submit-action-btn' }}
              />
            </div>
          </div>
        </Popup>
      </div>
  );
}

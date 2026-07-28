/**
 * Credit/Debit Note Detail Page (T097-T098)
 */

'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import { Popup } from 'devextreme-react/popup';
import { TextArea } from 'devextreme-react/text-area';
import { StatusStepper } from '@/components/shared';
import { useCurrentUser } from '@/hooks/use-current-user';
import { expandRole } from '@/lib/auth/role-mapping';
import type {
  CreditDebitNoteWithLines,
  NoteStatus,
  NoteType,
} from '@/types/credit-debit-notes';

interface PageProps {
  params: Promise<{ id: string }>;
}

// Roles allowed to approve / reject credit-debit notes
const NOTE_APPROVE_ROLES = ['admin', 'manager', 'accounting_manager', 'finance_manager'];

const statusColors: Record<NoteStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  posted: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const noteTypeLabels: Record<NoteType, string> = {
  ar_credit: 'AR Credit Note',
  ap_credit: 'AP Credit Note',
  ar_debit: 'AR Debit Note',
  ap_debit: 'AP Debit Note',
};

const reasonCodeLabels: Record<string, string> = {
  return: 'Goods Return',
  price_adjustment: 'Price Adjustment',
  quantity_adjustment: 'Quantity Adjustment',
  defect: 'Defective Goods',
  discount: 'Early Payment Discount',
  other: 'Other',
};

export default function CreditDebitNoteDetailPage({ params }: PageProps) {
  const t = useTranslations('accounting');
  const { id } = use(params);
  const noteId = parseInt(id, 10);
  const router = useRouter();

  const [note, setNote] = useState<CreditDebitNoteWithLines | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  // Current user (for role-gated Approve / Reject buttons)
  const { data: currentUser } = useCurrentUser();
  // expandRole() normalises the stored role (e.g. "ADMIN") to lowercase legacy
  // aliases so this check is case-insensitive — without it an admin saw no
  // approve/reject buttons.
  const canApproveRole = expandRole(currentUser?.role).some((r) =>
    NOTE_APPROVE_ROLES.includes(r),
  );

  useEffect(() => {
    fetchNote();
  }, [noteId]);

  const fetchNote = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/accounting/credit-debit-notes/${noteId}`);
      const data = await response.json();
      if (data.success) {
        setNote(data.data);
      } else {
        alert(data.error || t('creditDebitNotes.toast.loadFailed'));
        router.push('/accounting/credit-debit-notes');
      }
    } catch (error) {
      console.error('Error fetching note:', error);
      alert(t('creditDebitNotes.toast.loadFailed'));
      router.push('/accounting/credit-debit-notes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!confirm(t('creditDebitNotes.dialog.submitConfirm'))) return;

    setActionLoading(true);
    try {
      const response = await fetch(
        `/api/accounting/credit-debit-notes/${noteId}/submit`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (data.success) {
        await fetchNote();
      } else {
        alert(data.error || t('creditDebitNotes.toast.submitFailed'));
      }
    } catch (error) {
      console.error('Error submitting note:', error);
      alert(t('creditDebitNotes.toast.submitFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm(t('creditDebitNotes.dialog.approveConfirm'))) return;

    setActionLoading(true);
    try {
      // approverId is derived from the session server-side, do not send it from the client
      const response = await fetch(
        `/api/accounting/credit-debit-notes/${noteId}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const data = await response.json();
      if (data.success) {
        await fetchNote();
      } else {
        alert(data.error || t('creditDebitNotes.toast.approveFailed'));
      }
    } catch (error) {
      console.error('Error approving note:', error);
      alert(t('creditDebitNotes.toast.approveFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert(t('creditDebitNotes.toast.rejectReasonRequired'));
      return;
    }

    setActionLoading(true);
    try {
      // approverId is derived from the session server-side
      const response = await fetch(
        `/api/accounting/credit-debit-notes/${noteId}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: rejectReason,
          }),
        }
      );
      const data = await response.json();
      if (data.success) {
        setShowRejectDialog(false);
        setRejectReason('');
        await fetchNote();
      } else {
        alert(data.error || t('creditDebitNotes.toast.rejectFailed'));
      }
    } catch (error) {
      console.error('Error rejecting note:', error);
      alert(t('creditDebitNotes.toast.rejectFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePost = async () => {
    if (!confirm(t('creditDebitNotes.dialog.postConfirm'))) return;

    setActionLoading(true);
    try {
      const response = await fetch(
        `/api/accounting/credit-debit-notes/${noteId}/post`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (data.success) {
        await fetchNote();
      } else {
        alert(data.error || t('creditDebitNotes.toast.postFailed'));
      }
    } catch (error) {
      console.error('Error posting note:', error);
      alert(t('creditDebitNotes.toast.postFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      alert(t('creditDebitNotes.toast.cancelReasonRequired'));
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(
        `/api/accounting/credit-debit-notes/${noteId}/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: cancelReason }),
        }
      );
      const data = await response.json();
      if (data.success) {
        setShowCancelDialog(false);
        setCancelReason('');
        await fetchNote();
      } else {
        alert(data.error || t('creditDebitNotes.toast.cancelFailed'));
      }
    } catch (error) {
      console.error('Error cancelling note:', error);
      alert(t('creditDebitNotes.toast.cancelFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('creditDebitNotes.dialog.deleteConfirm'))) return;

    setActionLoading(true);
    try {
      const response = await fetch(
        `/api/accounting/credit-debit-notes/${noteId}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      if (data.success) {
        router.push('/accounting/credit-debit-notes');
      } else {
        alert(data.error || t('creditDebitNotes.toast.deleteFailed'));
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      alert(t('creditDebitNotes.toast.deleteFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('th-TH');
  };

  const formatDateTime = (date: Date | string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('th-TH');
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('th-TH', { minimumFractionDigits: 2 });
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center h-64">
          <LoadIndicator />
        </div>
    );
  }

  if (!note) {
    return (
        <div className="p-4">
          <div className="text-center text-gray-500">{t('creditDebitNotes.empty.notFound')}</div>
        </div>
    );
  }

  const canEdit = note.status === 'draft';
  const canSubmit = note.status === 'draft';
  const canApprove = note.status === 'submitted' && canApproveRole;
  const canReject = note.status === 'submitted' && canApproveRole;
  const canPost = note.status === 'approved';
  const canCancel = ['draft', 'submitted', 'approved'].includes(note.status);
  const canDelete = note.status === 'draft';

  return (
      <div className="p-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">
                {t('page.title')}: {note.noteNumber}
              </h1>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  statusColors[note.status]
                }`}
                data-testid="note-status"
              >
                {t(`creditDebitNotes.status.${note.status}`)}
              </span>
            </div>
            <p className="text-gray-600">{noteTypeLabels[note.noteType]}</p>
          </div>
          <div className="flex gap-2">
            <Button
              text={t('creditDebitNotes.actions.back')}
              icon="back"
              onClick={() => router.push('/accounting/credit-debit-notes')}
              data-testid="back-btn"
            />
            {canEdit && (
              <Button
                text={t('creditDebitNotes.actions.edit')}
                icon="edit"
                onClick={() => router.push(`/accounting/credit-debit-notes/${noteId}/edit`)}
                data-testid="edit-btn"
              />
            )}
          </div>
        </div>

        {/* Status Stepper */}
        <div className="mb-6">
          {note.status === 'cancelled' ? (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800"
              data-testid="note-cancelled-banner"
            >
              <span className="font-medium">{t('creditDebitNotes.empty.cancelledBanner')}</span>
            </div>
          ) : (
            <StatusStepper
              title={t('creditDebitNotes.stepper.title')}
              steps={[
                { key: 'draft', label: t('creditDebitNotes.status.draft') },
                { key: 'submitted', label: t('creditDebitNotes.status.submitted') },
                { key: 'approved', label: t('creditDebitNotes.status.approved') },
                { key: 'posted', label: t('creditDebitNotes.status.posted') },
              ]}
              current={String(note.status).toLowerCase()}
            />
          )}
        </div>

        {/* Note Details */}
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-lg font-semibold mb-4">{t('creditDebitNotes.detail.noteDetails')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-500">{t('creditDebitNotes.form.noteType')}</label>
              <div className="font-medium">{noteTypeLabels[note.noteType]}</div>
            </div>
            <div>
              <label className="block text-sm text-gray-500">{t('creditDebitNotes.form.date')}</label>
              <div className="font-medium">{formatDate(note.noteDate)}</div>
            </div>
            <div>
              <label className="block text-sm text-gray-500">{t('creditDebitNotes.form.referenceInvoice')}</label>
              <div className="font-medium">
                {note.referenceInvoiceNumber || `#${note.referenceInvoiceId}`}
              </div>
            </div>
            {note.customerName && (
              <div>
                <label className="block text-sm text-gray-500">{t('creditDebitNotes.form.customer')}</label>
                <div className="font-medium">{note.customerName}</div>
              </div>
            )}
            {note.vendorName && (
              <div>
                <label className="block text-sm text-gray-500">{t('creditDebitNotes.form.vendor')}</label>
                <div className="font-medium">{note.vendorName}</div>
              </div>
            )}
            <div>
              <label className="block text-sm text-gray-500">{t('creditDebitNotes.form.reason')}</label>
              <div className="font-medium">
                {reasonCodeLabels[note.reasonCode] || note.reasonCode}
              </div>
            </div>
            {note.reasonDescription && (
              <div className="md:col-span-3">
                <label className="block text-sm text-gray-500">{t('creditDebitNotes.form.reasonDescription')}</label>
                <div className="font-medium">{note.reasonDescription}</div>
              </div>
            )}
            {note.notes && (
              <div className="md:col-span-3">
                <label className="block text-sm text-gray-500">{t('creditDebitNotes.form.notes')}</label>
                <div className="font-medium">{note.notes}</div>
              </div>
            )}
          </div>

          {/* Approval Info */}
          {note.approvedByName && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500">{t('creditDebitNotes.detail.approvedBy')}</label>
                  <div className="font-medium">{note.approvedByName}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500">{t('creditDebitNotes.detail.approvedAt')}</label>
                  <div className="font-medium">{formatDateTime(note.approvedAt)}</div>
                </div>
              </div>
            </div>
          )}

          {note.postedAt && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500">{t('creditDebitNotes.detail.postedAt')}</label>
                  <div className="font-medium">{formatDateTime(note.postedAt)}</div>
                </div>
                {note.journalEntryId && (
                  <div>
                    <label className="block text-sm text-gray-500">{t('creditDebitNotes.detail.journalEntry')}</label>
                    <div className="font-medium">#{note.journalEntryId}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-lg font-semibold mb-4">{t('creditDebitNotes.form.lines')}</h2>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                  {t('creditDebitNotes.columns.description')}
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                  {t('creditDebitNotes.columns.quantity')}
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                  {t('creditDebitNotes.columns.unitPrice')}
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                  {t('creditDebitNotes.columns.lineTotal')}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                  {t('creditDebitNotes.columns.glAccount')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {note.lines.map((line, index) => (
                <tr key={line.id}>
                  <td className="px-3 py-2">{index + 1}</td>
                  <td className="px-3 py-2">{line.description}</td>
                  <td className="px-3 py-2 text-right">{line.quantity}</td>
                  <td className="px-3 py-2 text-right">{formatAmount(line.unitPrice)}</td>
                  <td className="px-3 py-2 text-right">{formatAmount(line.lineTotal)}</td>
                  <td className="px-3 py-2">
                    {line.glAccountCode} - {line.glAccountName}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">{t('creditDebitNotes.form.subtotal')}:</span>
                <span className="font-medium">{formatAmount(note.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('creditDebitNotes.form.vat', { rate: (note.vatRate * 100).toFixed(0) })}</span>
                <span className="font-medium">{formatAmount(note.vatAmount)}</span>
              </div>
              {note.whtAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('creditDebitNotes.form.wht')}:</span>
                  <span className="font-medium">-{formatAmount(note.whtAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>{t('creditDebitNotes.form.grandTotal')}:</span>
                <span>{formatAmount(note.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">{t('creditDebitNotes.detail.actionsTitle')}</h2>
          <div className="flex flex-wrap gap-2">
            {canSubmit && (
              <Button
                text={t('creditDebitNotes.actions.submit')}
                type="default"
                stylingMode="contained"
                icon="check"
                onClick={handleSubmit}
                disabled={actionLoading}
                elementAttr={{ 'data-testid': 'submit-btn' }}
              />
            )}
            {canApprove && (
              <Button
                text={t('creditDebitNotes.actions.approve')}
                type="success"
                stylingMode="contained"
                icon="check"
                onClick={handleApprove}
                disabled={actionLoading}
                elementAttr={{ 'data-testid': 'approve-btn' }}
              />
            )}
            {canReject && (
              <Button
                text={t('creditDebitNotes.actions.reject')}
                type="danger"
                stylingMode="outlined"
                icon="close"
                onClick={() => setShowRejectDialog(true)}
                disabled={actionLoading}
                data-testid="reject-btn"
              />
            )}
            {canPost && (
              <Button
                text={t('creditDebitNotes.actions.post')}
                type="success"
                stylingMode="contained"
                icon="save"
                onClick={handlePost}
                disabled={actionLoading}
                elementAttr={{ 'data-testid': 'post-btn' }}
              />
            )}
            {canCancel && (
              <Button
                text={t('creditDebitNotes.actions.cancelNote')}
                type="danger"
                stylingMode="outlined"
                icon="close"
                onClick={() => setShowCancelDialog(true)}
                disabled={actionLoading}
                data-testid="cancel-btn"
              />
            )}
            {canDelete && (
              <Button
                text={t('creditDebitNotes.actions.delete')}
                type="danger"
                stylingMode="text"
                icon="trash"
                onClick={handleDelete}
                disabled={actionLoading}
                elementAttr={{ 'data-testid': 'delete-btn' }}
              />
            )}
          </div>
        </div>

        {/* Cancel Dialog */}
        <Popup
          visible={showCancelDialog}
          onHiding={() => setShowCancelDialog(false)}
          title={t('creditDebitNotes.dialog.cancelTitle')}
          width={400}
          height="auto"
          showCloseButton={true}
        >
          <div className="p-4">
            <p className="mb-4">{t('creditDebitNotes.dialog.cancelReasonPrompt')}</p>
            <TextArea
              value={cancelReason}
              onValueChanged={(e) => setCancelReason(e.value || '')}
              height={100}
              placeholder={t('creditDebitNotes.dialog.cancelReasonPlaceholder')}
              data-testid="cancel-reason-input"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button
                text={t('creditDebitNotes.actions.cancel')}
                onClick={() => setShowCancelDialog(false)}
              />
              <Button
                text={t('creditDebitNotes.dialog.confirmCancel')}
                type="danger"
                stylingMode="contained"
                onClick={handleCancel}
                disabled={actionLoading}
                elementAttr={{ 'data-testid': 'confirm-cancel-btn' }}
              />
            </div>
          </div>
        </Popup>

        {/* Reject Dialog */}
        <Popup
          visible={showRejectDialog}
          onHiding={() => setShowRejectDialog(false)}
          title={t('creditDebitNotes.dialog.rejectTitle')}
          width={400}
          height="auto"
          showCloseButton={true}
        >
          <div className="p-4">
            <p className="mb-4">{t('creditDebitNotes.dialog.rejectReasonPrompt')}</p>
            <TextArea
              value={rejectReason}
              onValueChanged={(e) => setRejectReason(e.value || '')}
              height={100}
              placeholder={t('creditDebitNotes.dialog.rejectReasonPlaceholder')}
              data-testid="reject-reason-input"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button
                text={t('creditDebitNotes.actions.cancel')}
                onClick={() => setShowRejectDialog(false)}
              />
              <Button
                text={t('creditDebitNotes.dialog.confirmReject')}
                type="danger"
                stylingMode="contained"
                onClick={handleReject}
                disabled={actionLoading}
                elementAttr={{ 'data-testid': 'confirm-reject-btn' }}
              />
            </div>
          </div>
        </Popup>
      </div>
  );
}

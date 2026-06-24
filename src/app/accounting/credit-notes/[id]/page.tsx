/**
 * Credit Note Detail Page (T096)
 * Part of 011-accounting-spec-gap - User Story 3
 */

'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import { Popup } from 'devextreme-react/popup';
import { TextArea } from 'devextreme-react/text-area';
import notify from 'devextreme/ui/notify';
import { StatusStepper } from '@/components/shared';
import type { CreditDebitNoteWithLines, NoteStatus } from '@/types/credit-debit-notes';

const statusColors: Record<NoteStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  posted: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function CreditNoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useTranslations('accounting');
  const { id } = use(params);
  const router = useRouter();
  const noteId = parseInt(id, 10);

  const [note, setNote] = useState<CreditDebitNoteWithLines | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelPopup, setShowCancelPopup] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const fetchNote = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/accounting/credit-notes/${noteId}`);
      const data = await response.json();

      if (data.success) {
        setNote(data.data);
      } else {
        notify(data.error || t('creditNotes.toast.loadFailed'), 'error', 3000);
      }
    } catch (error) {
      console.error('Error fetching note:', error);
      notify(t('creditNotes.toast.loadFailed'), 'error', 3000);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  const handleSubmit = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/accounting/credit-notes/${noteId}/submit`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        notify(t('creditNotes.toast.submitSuccess'), 'success', 3000);
        fetchNote();
      } else {
        notify(data.error || t('creditNotes.toast.submitFailed'), 'error', 3000);
      }
    } catch (error) {
      console.error('Error submitting:', error);
      notify(t('creditNotes.toast.submitFailed'), 'error', 3000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/accounting/credit-notes/${noteId}/approve`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        notify(t('creditNotes.toast.approveSuccess'), 'success', 3000);
        fetchNote();
      } else {
        notify(data.error || t('creditNotes.toast.approveFailed'), 'error', 3000);
      }
    } catch (error) {
      console.error('Error approving:', error);
      notify(t('creditNotes.toast.approveFailed'), 'error', 3000);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePost = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/accounting/credit-notes/${noteId}/post`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        notify(t('creditNotes.toast.postSuccess', { journalEntryNumber: data.journalEntryNumber }), 'success', 3000);
        fetchNote();
      } else {
        notify(data.error || t('creditNotes.toast.postFailed'), 'error', 3000);
      }
    } catch (error) {
      console.error('Error posting:', error);
      notify(t('creditNotes.toast.postFailed'), 'error', 3000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      notify(t('creditNotes.toast.cancelReasonRequired'), 'warning', 3000);
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/accounting/credit-notes/${noteId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const data = await response.json();

      if (data.success) {
        notify(t('creditNotes.toast.cancelSuccess'), 'success', 3000);
        setShowCancelPopup(false);
        fetchNote();
      } else {
        notify(data.error || t('creditNotes.toast.cancelFailed'), 'error', 3000);
      }
    } catch (error) {
      console.error('Error cancelling:', error);
      notify(t('creditNotes.toast.cancelFailed'), 'error', 3000);
    } finally {
      setActionLoading(false);
    }
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
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {t('creditNotes.empty.notFound')}
          </div>
        </div>
    );
  }

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('th-TH');
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('th-TH', { minimumFractionDigits: 2 });
  };

  return (
      <div className="p-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">
              {t('page.title')}: {note.noteNumber}
            </h1>
            <span className={`mt-2 inline-block px-3 py-1 rounded-full text-sm font-medium ${statusColors[note.status]}`}>
              {t(`creditNotes.status.${note.status}`)}
            </span>
          </div>
          <div className="flex gap-2">
            {note.status === 'draft' && (
              <>
                <Button
                  text={t('creditNotes.actions.submit')}
                  type="success"
                  stylingMode="contained"
                  onClick={handleSubmit}
                  disabled={actionLoading}
                />
                <Button
                  text={t('creditNotes.actions.cancelNote')}
                  type="danger"
                  stylingMode="outlined"
                  onClick={() => setShowCancelPopup(true)}
                  disabled={actionLoading}
                />
              </>
            )}
            {note.status === 'submitted' && (
              <Button
                text={t('creditNotes.actions.approve')}
                type="success"
                stylingMode="contained"
                onClick={handleApprove}
                disabled={actionLoading}
              />
            )}
            {note.status === 'approved' && (
              <Button
                text={t('creditNotes.actions.post')}
                type="success"
                stylingMode="contained"
                onClick={handlePost}
                disabled={actionLoading}
              />
            )}
            <Button
              text={t('creditNotes.actions.backToList')}
              stylingMode="outlined"
              onClick={() => router.push('/accounting/credit-notes')}
            />
          </div>
        </div>

        {/* Status Stepper */}
        <div className="mb-6">
          <StatusStepper
            title={t('creditNotes.stepper.title')}
            steps={[
              { key: 'draft', label: t('creditNotes.status.draft') },
              { key: 'submitted', label: t('creditNotes.status.submitted') },
              { key: 'approved', label: t('creditNotes.status.approved') },
            ]}
            current={String(note.status).toLowerCase()}
          />
        </div>

        {/* Note Details */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">{t('creditNotes.detail.noteDetails')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-sm text-gray-500">{t('creditNotes.form.noteType')}:</span>
              <p className="font-medium">{note.noteType === 'ar_credit' ? t('creditNotes.filters.arCredit') : t('creditNotes.filters.apCredit')}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">{t('creditNotes.form.date')}:</span>
              <p className="font-medium">{formatDate(note.noteDate)}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">{t('creditNotes.form.referenceInvoice')}:</span>
              <p className="font-medium">{note.referenceInvoiceNumber || '-'}</p>
            </div>
            {note.noteType.startsWith('ar_') ? (
              <div>
                <span className="text-sm text-gray-500">{t('creditNotes.form.customer')}:</span>
                <p className="font-medium">{note.customerName || '-'}</p>
              </div>
            ) : (
              <div>
                <span className="text-sm text-gray-500">{t('creditNotes.form.vendor')}:</span>
                <p className="font-medium">{note.vendorName || '-'}</p>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-500">{t('creditNotes.form.reason')}:</span>
              <p className="font-medium">{note.reasonCode}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">{t('creditNotes.form.reasonDescription')}:</span>
              <p className="font-medium">{note.reasonDescription || '-'}</p>
            </div>
            {note.journalEntryNumber && (
              <div>
                <span className="text-sm text-gray-500">{t('creditNotes.detail.journalEntry')}:</span>
                <p className="font-medium">{note.journalEntryNumber}</p>
              </div>
            )}
            {note.approvedAt && (
              <div>
                <span className="text-sm text-gray-500">{t('creditNotes.detail.approvedAt')}:</span>
                <p className="font-medium">{formatDate(note.approvedAt)}</p>
              </div>
            )}
            {note.postedAt && (
              <div>
                <span className="text-sm text-gray-500">{t('creditNotes.detail.postedAt')}:</span>
                <p className="font-medium">{formatDate(note.postedAt)}</p>
              </div>
            )}
          </div>
          {note.notes && (
            <div className="mt-4">
              <span className="text-sm text-gray-500">{t('creditNotes.form.notes')}:</span>
              <p className="font-medium whitespace-pre-wrap">{note.notes}</p>
            </div>
          )}
        </div>

        {/* Lines */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">{t('creditNotes.form.lines')}</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('creditNotes.columns.description')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('creditNotes.columns.glAccount')}</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('creditNotes.columns.quantity')}</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('creditNotes.columns.unitPrice')}</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('creditNotes.columns.lineTotal')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {note.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-2">{line.lineNumber}</td>
                    <td className="px-4 py-2">{line.description}</td>
                    <td className="px-4 py-2">{line.glAccountCode} - {line.glAccountName}</td>
                    <td className="px-4 py-2 text-right">{line.quantity.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{formatAmount(line.unitPrice)}</td>
                    <td className="px-4 py-2 text-right">{formatAmount(line.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={5} className="px-4 py-2 text-right font-medium">{t('creditNotes.form.subtotal')}:</td>
                  <td className="px-4 py-2 text-right font-medium">{formatAmount(note.subtotal)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td colSpan={5} className="px-4 py-2 text-right font-medium">{t('creditNotes.form.vat', { rate: (note.vatRate * 100).toFixed(0) })}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatAmount(note.vatAmount)}</td>
                </tr>
                <tr className="bg-gray-100">
                  <td colSpan={5} className="px-4 py-2 text-right font-bold">{t('creditNotes.form.grandTotal')}:</td>
                  <td className="px-4 py-2 text-right font-bold text-lg">{formatAmount(note.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Cancel Popup */}
        <Popup
          visible={showCancelPopup}
          onHiding={() => setShowCancelPopup(false)}
          title={t('creditNotes.dialog.cancelTitle')}
          width={400}
          height={250}
          showCloseButton={true}
        >
          <div className="p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('creditNotes.dialog.cancelReasonLabel')} *
            </label>
            <TextArea
              value={cancelReason}
              onValueChanged={(e) => setCancelReason(e.value || '')}
              height={80}
              placeholder={t('creditNotes.dialog.cancelReasonPlaceholder')}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button
                text={t('creditNotes.actions.cancel')}
                stylingMode="outlined"
                onClick={() => setShowCancelPopup(false)}
              />
              <Button
                text={t('creditNotes.dialog.confirmCancel')}
                type="danger"
                stylingMode="contained"
                onClick={handleCancel}
                disabled={actionLoading}
              />
            </div>
          </div>
        </Popup>
      </div>
  );
}

/**
 * Credit Note Detail Page (T096)
 * Part of 011-accounting-spec-gap - User Story 3
 */

'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import { Popup } from 'devextreme-react/popup';
import { TextArea } from 'devextreme-react/text-area';
import notify from 'devextreme/ui/notify';
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
        notify(data.error || 'Failed to load credit note', 'error', 3000);
      }
    } catch (error) {
      console.error('Error fetching note:', error);
      notify('Failed to load credit note', 'error', 3000);
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
        notify('Credit note submitted for approval', 'success', 3000);
        fetchNote();
      } else {
        notify(data.error || 'Failed to submit', 'error', 3000);
      }
    } catch (error) {
      console.error('Error submitting:', error);
      notify('Failed to submit', 'error', 3000);
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
        notify('Credit note approved', 'success', 3000);
        fetchNote();
      } else {
        notify(data.error || 'Failed to approve', 'error', 3000);
      }
    } catch (error) {
      console.error('Error approving:', error);
      notify('Failed to approve', 'error', 3000);
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
        notify(`Credit note posted. Journal Entry: ${data.journalEntryNumber}`, 'success', 3000);
        fetchNote();
      } else {
        notify(data.error || 'Failed to post', 'error', 3000);
      }
    } catch (error) {
      console.error('Error posting:', error);
      notify('Failed to post', 'error', 3000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      notify('Please enter a cancellation reason', 'warning', 3000);
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
        notify('Credit note cancelled', 'success', 3000);
        setShowCancelPopup(false);
        fetchNote();
      } else {
        notify(data.error || 'Failed to cancel', 'error', 3000);
      }
    } catch (error) {
      console.error('Error cancelling:', error);
      notify('Failed to cancel', 'error', 3000);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <LoadIndicator />
        </div>
      </MainLayout>
    );
  }

  if (!note) {
    return (
      <MainLayout>
        <div className="p-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            Credit note not found
          </div>
        </div>
      </MainLayout>
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
    <MainLayout>
      <div className="p-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">
              Credit Note: {note.noteNumber}
            </h1>
            <span className={`mt-2 inline-block px-3 py-1 rounded-full text-sm font-medium ${statusColors[note.status]}`}>
              {note.status}
            </span>
          </div>
          <div className="flex gap-2">
            {note.status === 'draft' && (
              <>
                <Button
                  text="Submit"
                  type="success"
                  stylingMode="contained"
                  onClick={handleSubmit}
                  disabled={actionLoading}
                />
                <Button
                  text="Cancel Note"
                  type="danger"
                  stylingMode="outlined"
                  onClick={() => setShowCancelPopup(true)}
                  disabled={actionLoading}
                />
              </>
            )}
            {note.status === 'submitted' && (
              <Button
                text="Approve"
                type="success"
                stylingMode="contained"
                onClick={handleApprove}
                disabled={actionLoading}
              />
            )}
            {note.status === 'approved' && (
              <Button
                text="Post to GL"
                type="success"
                stylingMode="contained"
                onClick={handlePost}
                disabled={actionLoading}
              />
            )}
            <Button
              text="Back to List"
              stylingMode="outlined"
              onClick={() => router.push('/accounting/credit-notes')}
            />
          </div>
        </div>

        {/* Note Details */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Note Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-sm text-gray-500">Note Type:</span>
              <p className="font-medium">{note.noteType === 'ar_credit' ? 'AR Credit Note' : 'AP Credit Note'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Note Date:</span>
              <p className="font-medium">{formatDate(note.noteDate)}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Reference Invoice:</span>
              <p className="font-medium">{note.referenceInvoiceNumber || '-'}</p>
            </div>
            {note.noteType.startsWith('ar_') ? (
              <div>
                <span className="text-sm text-gray-500">Customer:</span>
                <p className="font-medium">{note.customerName || '-'}</p>
              </div>
            ) : (
              <div>
                <span className="text-sm text-gray-500">Vendor:</span>
                <p className="font-medium">{note.vendorName || '-'}</p>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-500">Reason Code:</span>
              <p className="font-medium">{note.reasonCode}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Reason Description:</span>
              <p className="font-medium">{note.reasonDescription || '-'}</p>
            </div>
            {note.journalEntryNumber && (
              <div>
                <span className="text-sm text-gray-500">Journal Entry:</span>
                <p className="font-medium">{note.journalEntryNumber}</p>
              </div>
            )}
            {note.approvedAt && (
              <div>
                <span className="text-sm text-gray-500">Approved At:</span>
                <p className="font-medium">{formatDate(note.approvedAt)}</p>
              </div>
            )}
            {note.postedAt && (
              <div>
                <span className="text-sm text-gray-500">Posted At:</span>
                <p className="font-medium">{formatDate(note.postedAt)}</p>
              </div>
            )}
          </div>
          {note.notes && (
            <div className="mt-4">
              <span className="text-sm text-gray-500">Notes:</span>
              <p className="font-medium whitespace-pre-wrap">{note.notes}</p>
            </div>
          )}
        </div>

        {/* Lines */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Lines</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">GL Account</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Line Total</th>
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
                  <td colSpan={5} className="px-4 py-2 text-right font-medium">Subtotal:</td>
                  <td className="px-4 py-2 text-right font-medium">{formatAmount(note.subtotal)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td colSpan={5} className="px-4 py-2 text-right font-medium">VAT ({(note.vatRate * 100).toFixed(0)}%):</td>
                  <td className="px-4 py-2 text-right font-medium">{formatAmount(note.vatAmount)}</td>
                </tr>
                <tr className="bg-gray-100">
                  <td colSpan={5} className="px-4 py-2 text-right font-bold">Total:</td>
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
          title="Cancel Credit Note"
          width={400}
          height={250}
          showCloseButton={true}
        >
          <div className="p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cancellation Reason *
            </label>
            <TextArea
              value={cancelReason}
              onValueChanged={(e) => setCancelReason(e.value || '')}
              height={80}
              placeholder="Enter reason for cancellation"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button
                text="Cancel"
                stylingMode="outlined"
                onClick={() => setShowCancelPopup(false)}
              />
              <Button
                text="Confirm Cancel"
                type="danger"
                stylingMode="contained"
                onClick={handleCancel}
                disabled={actionLoading}
              />
            </div>
          </div>
        </Popup>
      </div>
    </MainLayout>
  );
}

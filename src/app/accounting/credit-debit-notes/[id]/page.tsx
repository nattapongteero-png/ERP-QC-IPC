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

const statusLabels: Record<NoteStatus, string> = {
  draft: 'ร่าง',
  submitted: 'ส่งอนุมัติ',
  approved: 'อนุมัติแล้ว',
  posted: 'ลงบัญชีแล้ว',
  cancelled: 'ยกเลิก',
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
        alert(data.error || 'ไม่สามารถโหลดข้อมูลใบได้');
        router.push('/accounting/credit-debit-notes');
      }
    } catch (error) {
      console.error('Error fetching note:', error);
      alert('ไม่สามารถโหลดข้อมูลใบได้');
      router.push('/accounting/credit-debit-notes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!confirm('ส่งใบนี้เพื่อขออนุมัติ?')) return;

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
        alert(data.error || 'ไม่สามารถส่งใบเพื่ออนุมัติได้');
      }
    } catch (error) {
      console.error('Error submitting note:', error);
      alert('ไม่สามารถส่งใบเพื่ออนุมัติได้');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm('อนุมัติใบนี้?')) return;

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
        alert(data.error || 'ไม่สามารถอนุมัติใบได้');
      }
    } catch (error) {
      console.error('Error approving note:', error);
      alert('ไม่สามารถอนุมัติใบได้');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('กรุณาระบุเหตุผลในการปฏิเสธ');
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
        alert(data.error || 'ไม่สามารถปฏิเสธใบได้');
      }
    } catch (error) {
      console.error('Error rejecting note:', error);
      alert('ไม่สามารถปฏิเสธใบได้');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePost = async () => {
    if (!confirm('ลงบัญชีใบนี้ในบัญชีแยกประเภท?')) return;

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
        alert(data.error || 'ไม่สามารถลงบัญชีใบได้');
      }
    } catch (error) {
      console.error('Error posting note:', error);
      alert('ไม่สามารถลงบัญชีใบได้');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      alert('กรุณาระบุเหตุผลในการยกเลิก');
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
        alert(data.error || 'ไม่สามารถยกเลิกใบได้');
      }
    } catch (error) {
      console.error('Error cancelling note:', error);
      alert('ไม่สามารถยกเลิกใบได้');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('ลบใบนี้? การกระทำนี้ไม่สามารถย้อนกลับได้')) return;

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
        alert(data.error || 'ไม่สามารถลบใบได้');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('ไม่สามารถลบใบได้');
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
          <div className="text-center text-gray-500">ไม่พบใบลด/เพิ่มหนี้</div>
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
                {statusLabels[note.status] || note.status}
              </span>
            </div>
            <p className="text-gray-600">{noteTypeLabels[note.noteType]}</p>
          </div>
          <div className="flex gap-2">
            <Button
              text="ย้อนกลับ"
              icon="back"
              onClick={() => router.push('/accounting/credit-debit-notes')}
              data-testid="back-btn"
            />
            {canEdit && (
              <Button
                text="แก้ไข"
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
              <span className="font-medium">ใบนี้ถูกยกเลิกแล้ว</span>
            </div>
          ) : (
            <StatusStepper
              title="สถานะการดำเนินงาน"
              steps={[
                { key: 'draft', label: 'ร่าง' },
                { key: 'submitted', label: 'ส่งอนุมัติ' },
                { key: 'approved', label: 'อนุมัติแล้ว' },
                { key: 'posted', label: 'ลงบัญชีแล้ว' },
              ]}
              current={String(note.status).toLowerCase()}
            />
          )}
        </div>

        {/* Note Details */}
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-lg font-semibold mb-4">รายละเอียดใบ</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-500">ประเภทใบ</label>
              <div className="font-medium">{noteTypeLabels[note.noteType]}</div>
            </div>
            <div>
              <label className="block text-sm text-gray-500">วันที่</label>
              <div className="font-medium">{formatDate(note.noteDate)}</div>
            </div>
            <div>
              <label className="block text-sm text-gray-500">ใบแจ้งหนี้อ้างอิง</label>
              <div className="font-medium">
                {note.referenceInvoiceNumber || `#${note.referenceInvoiceId}`}
              </div>
            </div>
            {note.customerName && (
              <div>
                <label className="block text-sm text-gray-500">ลูกค้า</label>
                <div className="font-medium">{note.customerName}</div>
              </div>
            )}
            {note.vendorName && (
              <div>
                <label className="block text-sm text-gray-500">ผู้ขาย</label>
                <div className="font-medium">{note.vendorName}</div>
              </div>
            )}
            <div>
              <label className="block text-sm text-gray-500">เหตุผล</label>
              <div className="font-medium">
                {reasonCodeLabels[note.reasonCode] || note.reasonCode}
              </div>
            </div>
            {note.reasonDescription && (
              <div className="md:col-span-3">
                <label className="block text-sm text-gray-500">รายละเอียดเหตุผล</label>
                <div className="font-medium">{note.reasonDescription}</div>
              </div>
            )}
            {note.notes && (
              <div className="md:col-span-3">
                <label className="block text-sm text-gray-500">หมายเหตุ</label>
                <div className="font-medium">{note.notes}</div>
              </div>
            )}
          </div>

          {/* Approval Info */}
          {note.approvedByName && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500">อนุมัติโดย</label>
                  <div className="font-medium">{note.approvedByName}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500">อนุมัติเมื่อ</label>
                  <div className="font-medium">{formatDateTime(note.approvedAt)}</div>
                </div>
              </div>
            </div>
          )}

          {note.postedAt && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500">ลงบัญชีเมื่อ</label>
                  <div className="font-medium">{formatDateTime(note.postedAt)}</div>
                </div>
                {note.journalEntryId && (
                  <div>
                    <label className="block text-sm text-gray-500">รายการบัญชี</label>
                    <div className="font-medium">#{note.journalEntryId}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-lg font-semibold mb-4">รายการ</h2>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                  รายละเอียด
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                  จำนวน
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                  ราคาต่อหน่วย
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                  รวมรายการ
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                  บัญชีแยกประเภท
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
                <span className="text-gray-600">ยอดรวมย่อย:</span>
                <span className="font-medium">{formatAmount(note.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">VAT ({(note.vatRate * 100).toFixed(0)}%):</span>
                <span className="font-medium">{formatAmount(note.vatAmount)}</span>
              </div>
              {note.whtAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">ภาษีหัก ณ ที่จ่าย:</span>
                  <span className="font-medium">-{formatAmount(note.whtAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>รวมทั้งสิ้น:</span>
                <span>{formatAmount(note.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">การดำเนินการ</h2>
          <div className="flex flex-wrap gap-2">
            {canSubmit && (
              <Button
                text="ส่งเพื่ออนุมัติ"
                type="default"
                stylingMode="contained"
                icon="check"
                onClick={handleSubmit}
                disabled={actionLoading}
                data-testid="submit-btn"
              />
            )}
            {canApprove && (
              <Button
                text="อนุมัติ"
                type="success"
                stylingMode="contained"
                icon="check"
                onClick={handleApprove}
                disabled={actionLoading}
                data-testid="approve-btn"
              />
            )}
            {canReject && (
              <Button
                text="ปฏิเสธ"
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
                text="ลงบัญชีแยกประเภท"
                type="success"
                stylingMode="contained"
                icon="save"
                onClick={handlePost}
                disabled={actionLoading}
                data-testid="post-btn"
              />
            )}
            {canCancel && (
              <Button
                text="ยกเลิกใบ"
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
                text="ลบ"
                type="danger"
                stylingMode="text"
                icon="trash"
                onClick={handleDelete}
                disabled={actionLoading}
                data-testid="delete-btn"
              />
            )}
          </div>
        </div>

        {/* Cancel Dialog */}
        <Popup
          visible={showCancelDialog}
          onHiding={() => setShowCancelDialog(false)}
          title="ยกเลิกใบ"
          width={400}
          height="auto"
          showCloseButton={true}
        >
          <div className="p-4">
            <p className="mb-4">กรุณาระบุเหตุผลในการยกเลิก:</p>
            <TextArea
              value={cancelReason}
              onValueChanged={(e) => setCancelReason(e.value || '')}
              height={100}
              placeholder="เหตุผลการยกเลิก..."
              data-testid="cancel-reason-input"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button
                text="ยกเลิก"
                onClick={() => setShowCancelDialog(false)}
              />
              <Button
                text="ยืนยันการยกเลิก"
                type="danger"
                stylingMode="contained"
                onClick={handleCancel}
                disabled={actionLoading}
                data-testid="confirm-cancel-btn"
              />
            </div>
          </div>
        </Popup>

        {/* Reject Dialog */}
        <Popup
          visible={showRejectDialog}
          onHiding={() => setShowRejectDialog(false)}
          title="ปฏิเสธใบ"
          width={400}
          height="auto"
          showCloseButton={true}
        >
          <div className="p-4">
            <p className="mb-4">กรุณาระบุเหตุผลในการปฏิเสธ:</p>
            <TextArea
              value={rejectReason}
              onValueChanged={(e) => setRejectReason(e.value || '')}
              height={100}
              placeholder="เหตุผลการปฏิเสธ..."
              data-testid="reject-reason-input"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button
                text="ยกเลิก"
                onClick={() => setShowRejectDialog(false)}
              />
              <Button
                text="ยืนยันการปฏิเสธ"
                type="danger"
                stylingMode="contained"
                onClick={handleReject}
                disabled={actionLoading}
                data-testid="confirm-reject-btn"
              />
            </div>
          </div>
        </Popup>
      </div>
  );
}

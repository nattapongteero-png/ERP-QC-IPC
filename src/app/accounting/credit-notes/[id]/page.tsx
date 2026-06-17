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
        notify(data.error || 'ไม่สามารถโหลดใบลดหนี้ได้', 'error', 3000);
      }
    } catch (error) {
      console.error('Error fetching note:', error);
      notify('ไม่สามารถโหลดใบลดหนี้ได้', 'error', 3000);
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
        notify('ส่งใบลดหนี้เพื่อขออนุมัติแล้ว', 'success', 3000);
        fetchNote();
      } else {
        notify(data.error || 'ไม่สามารถส่งได้', 'error', 3000);
      }
    } catch (error) {
      console.error('Error submitting:', error);
      notify('ไม่สามารถส่งได้', 'error', 3000);
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
        notify('อนุมัติใบลดหนี้แล้ว', 'success', 3000);
        fetchNote();
      } else {
        notify(data.error || 'ไม่สามารถอนุมัติได้', 'error', 3000);
      }
    } catch (error) {
      console.error('Error approving:', error);
      notify('ไม่สามารถอนุมัติได้', 'error', 3000);
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
        notify(`ลงบัญชีใบลดหนี้แล้ว เลขที่รายการบันทึกบัญชี: ${data.journalEntryNumber}`, 'success', 3000);
        fetchNote();
      } else {
        notify(data.error || 'ไม่สามารถลงบัญชีได้', 'error', 3000);
      }
    } catch (error) {
      console.error('Error posting:', error);
      notify('ไม่สามารถลงบัญชีได้', 'error', 3000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      notify('กรุณากรอกเหตุผลการยกเลิก', 'warning', 3000);
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
        notify('ยกเลิกใบลดหนี้แล้ว', 'success', 3000);
        setShowCancelPopup(false);
        fetchNote();
      } else {
        notify(data.error || 'ไม่สามารถยกเลิกได้', 'error', 3000);
      }
    } catch (error) {
      console.error('Error cancelling:', error);
      notify('ไม่สามารถยกเลิกได้', 'error', 3000);
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
            ไม่พบใบลดหนี้
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
              {note.status}
            </span>
          </div>
          <div className="flex gap-2">
            {note.status === 'draft' && (
              <>
                <Button
                  text="ส่ง"
                  type="success"
                  stylingMode="contained"
                  onClick={handleSubmit}
                  disabled={actionLoading}
                />
                <Button
                  text="ยกเลิกใบ"
                  type="danger"
                  stylingMode="outlined"
                  onClick={() => setShowCancelPopup(true)}
                  disabled={actionLoading}
                />
              </>
            )}
            {note.status === 'submitted' && (
              <Button
                text="อนุมัติ"
                type="success"
                stylingMode="contained"
                onClick={handleApprove}
                disabled={actionLoading}
              />
            )}
            {note.status === 'approved' && (
              <Button
                text="ลงบัญชีแยกประเภท"
                type="success"
                stylingMode="contained"
                onClick={handlePost}
                disabled={actionLoading}
              />
            )}
            <Button
              text="กลับสู่รายการ"
              stylingMode="outlined"
              onClick={() => router.push('/accounting/credit-notes')}
            />
          </div>
        </div>

        {/* Status Stepper */}
        <div className="mb-6">
          <StatusStepper
            title="สถานะการดำเนินงาน"
            steps={[
              { key: 'draft', label: 'ร่าง' },
              { key: 'submitted', label: 'ส่งอนุมัติ' },
              { key: 'approved', label: 'อนุมัติแล้ว' },
            ]}
            current={String(note.status).toLowerCase()}
          />
        </div>

        {/* Note Details */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">รายละเอียดใบ</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-sm text-gray-500">ประเภทใบ:</span>
              <p className="font-medium">{note.noteType === 'ar_credit' ? 'ใบลดหนี้ลูกหนี้' : 'ใบลดหนี้เจ้าหนี้'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">วันที่:</span>
              <p className="font-medium">{formatDate(note.noteDate)}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">ใบแจ้งหนี้อ้างอิง:</span>
              <p className="font-medium">{note.referenceInvoiceNumber || '-'}</p>
            </div>
            {note.noteType.startsWith('ar_') ? (
              <div>
                <span className="text-sm text-gray-500">ลูกค้า:</span>
                <p className="font-medium">{note.customerName || '-'}</p>
              </div>
            ) : (
              <div>
                <span className="text-sm text-gray-500">ผู้ขาย:</span>
                <p className="font-medium">{note.vendorName || '-'}</p>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-500">เหตุผล:</span>
              <p className="font-medium">{note.reasonCode}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">รายละเอียดเหตุผล:</span>
              <p className="font-medium">{note.reasonDescription || '-'}</p>
            </div>
            {note.journalEntryNumber && (
              <div>
                <span className="text-sm text-gray-500">รายการบัญชี:</span>
                <p className="font-medium">{note.journalEntryNumber}</p>
              </div>
            )}
            {note.approvedAt && (
              <div>
                <span className="text-sm text-gray-500">อนุมัติเมื่อ:</span>
                <p className="font-medium">{formatDate(note.approvedAt)}</p>
              </div>
            )}
            {note.postedAt && (
              <div>
                <span className="text-sm text-gray-500">ลงบัญชีเมื่อ:</span>
                <p className="font-medium">{formatDate(note.postedAt)}</p>
              </div>
            )}
          </div>
          {note.notes && (
            <div className="mt-4">
              <span className="text-sm text-gray-500">หมายเหตุ:</span>
              <p className="font-medium whitespace-pre-wrap">{note.notes}</p>
            </div>
          )}
        </div>

        {/* Lines */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">รายการ</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">รายละเอียด</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">บัญชีแยกประเภท</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">จำนวน</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">ราคาต่อหน่วย</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">รวมรายการ</th>
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
                  <td colSpan={5} className="px-4 py-2 text-right font-medium">ยอดรวมย่อย:</td>
                  <td className="px-4 py-2 text-right font-medium">{formatAmount(note.subtotal)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td colSpan={5} className="px-4 py-2 text-right font-medium">ภาษีมูลค่าเพิ่ม ({(note.vatRate * 100).toFixed(0)}%):</td>
                  <td className="px-4 py-2 text-right font-medium">{formatAmount(note.vatAmount)}</td>
                </tr>
                <tr className="bg-gray-100">
                  <td colSpan={5} className="px-4 py-2 text-right font-bold">รวมทั้งสิ้น:</td>
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
          title="ยกเลิกใบลดหนี้"
          width={400}
          height={250}
          showCloseButton={true}
        >
          <div className="p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              เหตุผลการยกเลิก *
            </label>
            <TextArea
              value={cancelReason}
              onValueChanged={(e) => setCancelReason(e.value || '')}
              height={80}
              placeholder="กรอกเหตุผลในการยกเลิก"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button
                text="ยกเลิก"
                stylingMode="outlined"
                onClick={() => setShowCancelPopup(false)}
              />
              <Button
                text="ยืนยันการยกเลิก"
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

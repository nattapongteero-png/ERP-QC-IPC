/**
 * Debit Note Detail Page (T098)
 * Part of 011-accounting-spec-gap - User Story 3
 */

'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import notify from 'devextreme/ui/notify';
import type { CreditDebitNoteWithLines, NoteStatus } from '@/types/credit-debit-notes';

const statusColors: Record<NoteStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  posted: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function DebitNoteDetailPage({
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

  const fetchNote = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/accounting/debit-notes/${noteId}`);
      const data = await response.json();

      if (data.success) {
        setNote(data.data);
      } else {
        notify(data.error || 'ไม่สามารถโหลดใบเพิ่มหนี้ได้', 'error', 3000);
      }
    } catch (error) {
      console.error('Error fetching note:', error);
      notify('ไม่สามารถโหลดใบเพิ่มหนี้ได้', 'error', 3000);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  const handlePost = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/accounting/debit-notes/${noteId}/post`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        notify(`ลงบัญชีใบเพิ่มหนี้แล้ว เลขที่รายการบันทึกบัญชี: ${data.journalEntryNumber}`, 'success', 3000);
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
            ไม่พบใบเพิ่มหนี้
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
              onClick={() => router.push('/accounting/debit-notes')}
            />
          </div>
        </div>

        {/* Note Details */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">รายละเอียดใบ</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-sm text-gray-500">ประเภทใบ:</span>
              <p className="font-medium">{note.noteType === 'ar_debit' ? 'ใบเพิ่มหนี้ลูกหนี้' : 'ใบเพิ่มหนี้เจ้าหนี้'}</p>
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
            {note.postedAt && (
              <div>
                <span className="text-sm text-gray-500">ลงบัญชีเมื่อ:</span>
                <p className="font-medium">{formatDate(note.postedAt)}</p>
              </div>
            )}
          </div>
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
      </div>
  );
}

/**
 * New Credit Note Page (T095)
 * Part of 011-accounting-spec-gap - User Story 3
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toLocalDateStr } from '@/lib/utils/date-format';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import { TextBox } from 'devextreme-react/text-box';
import { TextArea } from 'devextreme-react/text-area';
import { SelectBox } from 'devextreme-react/select-box';
import { DateBox } from 'devextreme-react/date-box';
import { NumberBox } from 'devextreme-react/number-box';
import notify from 'devextreme/ui/notify';
import type { NoteType, ReasonCode } from '@/types/credit-debit-notes';

interface InvoiceLine {
  lineId: number;
  itemCode?: string;
  description: string;
  availableQuantity: number;
  unitPrice: number;
  glAccountId: number;
}

interface InvoiceInfo {
  invoiceId: number;
  invoiceNumber: string;
  availableForCredit: number;
  lines: InvoiceLine[];
}

interface NoteLine {
  referenceInvoiceLineId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  glAccountId: number;
  lineTotal: number;
}

const reasonCodes: { id: ReasonCode; text: string }[] = [
  { id: 'return', text: 'คืนสินค้า' },
  { id: 'price_adjustment', text: 'ปรับราคา' },
  { id: 'quantity_adjustment', text: 'ปรับจำนวน' },
  { id: 'defect', text: 'สินค้าชำรุด' },
  { id: 'discount', text: 'ส่วนลดเพิ่มเติม' },
  { id: 'other', text: 'อื่นๆ' },
];

function NewCreditNoteContent() {
  const t = useTranslations('accounting');
  const router = useRouter();
  const searchParams = useSearchParams();
  const noteType = (searchParams.get('type') || 'ar_credit') as NoteType;

  const [saving, setSaving] = useState(false);
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [invoiceInfo, setInvoiceInfo] = useState<InvoiceInfo | null>(null);
  const [noteDate, setNoteDate] = useState<Date>(new Date());
  const [reasonCode, setReasonCode] = useState<ReasonCode>('return');
  const [reasonDescription, setReasonDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<NoteLine[]>([]);

  const fetchInvoiceInfo = useCallback(async () => {
    if (!invoiceId) return;

    try {
      const invoiceType = noteType.startsWith('ar_') ? 'ar' : 'ap';
      const response = await fetch(
        `/api/accounting/invoices/${invoiceId}/available-for-credit?invoiceType=${invoiceType}`
      );
      const data = await response.json();

      if (data.success) {
        setInvoiceInfo(data.data);
        // Auto-populate lines from invoice
        if (data.data.lines.length > 0) {
          setLines(
            data.data.lines.map((line: InvoiceLine) => ({
              referenceInvoiceLineId: line.lineId,
              description: line.description,
              quantity: line.availableQuantity,
              unitPrice: line.unitPrice,
              glAccountId: line.glAccountId,
              lineTotal: line.availableQuantity * line.unitPrice,
            }))
          );
        }
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
    }
  }, [invoiceId, noteType]);

  useEffect(() => {
    if (invoiceId) {
      fetchInvoiceInfo();
    }
  }, [invoiceId, fetchInvoiceInfo]);

  const updateLineQuantity = (index: number, quantity: number) => {
    const newLines = [...lines];
    newLines[index].quantity = quantity;
    newLines[index].lineTotal = quantity * newLines[index].unitPrice;
    setLines(newLines);
  };

  const updateLinePrice = (index: number, unitPrice: number) => {
    const newLines = [...lines];
    newLines[index].unitPrice = unitPrice;
    newLines[index].lineTotal = newLines[index].quantity * unitPrice;
    setLines(newLines);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return lines.reduce((sum, line) => sum + line.lineTotal, 0);
  };

  const handleSave = async () => {
    if (!invoiceId) {
      notify('กรุณาเลือกใบแจ้งหนี้', 'error', 3000);
      return;
    }

    if (lines.length === 0) {
      notify('กรุณาเพิ่มรายการอย่างน้อยหนึ่งรายการ', 'error', 3000);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/accounting/credit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteType,
          referenceInvoiceId: invoiceId,
          noteDate: toLocalDateStr(noteDate),
          reasonCode,
          reasonDescription,
          notes,
          lines: lines.map((line) => ({
            referenceInvoiceLineId: line.referenceInvoiceLineId,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            glAccountId: line.glAccountId,
          })),
        }),
      });

      const data = await response.json();

      if (data.success) {
        notify('สร้างใบลดหนี้สำเร็จ', 'success', 3000);
        router.push(`/accounting/credit-notes/${data.id}`);
      } else {
        notify(data.error || 'ไม่สามารถสร้างใบลดหนี้ได้', 'error', 3000);
      }
    } catch (error) {
      console.error('Error creating credit note:', error);
      notify('ไม่สามารถสร้างใบลดหนี้ได้', 'error', 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">
            {t('page.title')}
          </h1>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          {/* Header Form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                รหัสใบแจ้งหนี้{noteType.startsWith('ar_') ? 'ลูกค้า' : 'ผู้ขาย'} *
              </label>
              <NumberBox
                value={invoiceId || undefined}
                onValueChanged={(e) => setInvoiceId(e.value)}
                placeholder="กรอกรหัสใบแจ้งหนี้"
                width="100%"
              />
              {invoiceInfo && (
                <div className="mt-1 text-sm text-gray-600">
                  ใบแจ้งหนี้: {invoiceInfo.invoiceNumber} | คงเหลือ: {invoiceInfo.availableForCredit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                วันที่ *
              </label>
              <DateBox
                value={noteDate}
                onValueChanged={(e) => setNoteDate(e.value)}
                displayFormat="dd/MM/yyyy"
                width="100%"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เหตุผล *
              </label>
              <SelectBox
                items={reasonCodes}
                displayExpr="text"
                valueExpr="id"
                value={reasonCode}
                onValueChanged={(e) => setReasonCode(e.value)}
                width="100%"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                รายละเอียดเหตุผล
              </label>
              <TextBox
                value={reasonDescription}
                onValueChanged={(e) => setReasonDescription(e.value || '')}
                placeholder="กรอกคำอธิบายเหตุผล"
                width="100%"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                หมายเหตุ
              </label>
              <TextArea
                value={notes}
                onValueChanged={(e) => setNotes(e.value || '')}
                placeholder="หมายเหตุเพิ่มเติม"
                width="100%"
                height={60}
              />
            </div>
          </div>

          {/* Lines */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 mb-3">รายการ</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">รายละเอียด</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-32">จำนวน</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-32">ราคาต่อหน่วย</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-32">รวมรายการ</th>
                    <th className="px-4 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lines.map((line, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2">{line.description}</td>
                      <td className="px-4 py-2">
                        <NumberBox
                          value={line.quantity}
                          onValueChanged={(e) => updateLineQuantity(index, e.value || 0)}
                          min={0}
                          format="#,##0.##"
                          width={100}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <NumberBox
                          value={line.unitPrice}
                          onValueChanged={(e) => updateLinePrice(index, e.value || 0)}
                          min={0}
                          format="#,##0.00"
                          width={100}
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        {line.lineTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2">
                        <Button
                          icon="trash"
                          stylingMode="text"
                          type="danger"
                          onClick={() => removeLine(index)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="px-4 py-2 text-right font-medium">ยอดรวมย่อย:</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {calculateTotal().toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="px-4 py-2 text-right font-medium">ภาษีมูลค่าเพิ่ม (7%):</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {(calculateTotal() * 0.07).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                  <tr className="bg-gray-100">
                    <td colSpan={3} className="px-4 py-2 text-right font-bold">รวมทั้งสิ้น:</td>
                    <td className="px-4 py-2 text-right font-bold text-lg">
                      {(calculateTotal() * 1.07).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              text="ยกเลิก"
              stylingMode="outlined"
              onClick={() => router.push('/accounting/credit-notes')}
            />
            <Button
              text="บันทึกใบร่าง"
              type="default"
              stylingMode="contained"
              onClick={handleSave}
              disabled={saving}
            />
          </div>
        </div>
      </div>
  );
}

export default function NewCreditNotePage() {
  return (
    <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <LoadIndicator />
        </div>
    }>
      <NewCreditNoteContent />
    </Suspense>
  );
}

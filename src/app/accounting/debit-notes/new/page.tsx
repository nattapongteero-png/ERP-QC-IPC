/**
 * New Debit Note Page (T097)
 * Part of 011-accounting-spec-gap - User Story 3
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
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
  { id: 'price_adjustment', text: 'Price Adjustment' },
  { id: 'quantity_adjustment', text: 'Quantity Adjustment' },
  { id: 'other', text: 'Other' },
];

function NewDebitNoteContent() {
  const t = useTranslations('accounting');
  const router = useRouter();
  const searchParams = useSearchParams();
  const noteType = (searchParams.get('type') || 'ar_debit') as NoteType;

  const [saving, setSaving] = useState(false);
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [invoiceInfo, setInvoiceInfo] = useState<InvoiceInfo | null>(null);
  const [noteDate, setNoteDate] = useState<Date>(new Date());
  const [reasonCode, setReasonCode] = useState<ReasonCode>('price_adjustment');
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

  const addLine = () => {
    setLines([
      ...lines,
      {
        description: '',
        quantity: 1,
        unitPrice: 0,
        glAccountId: 0,
        lineTotal: 0,
      },
    ]);
  };

  const updateLine = (index: number, field: keyof NoteLine, value: any) => {
    const newLines = [...lines];
    (newLines[index] as any)[field] = value;
    if (field === 'quantity' || field === 'unitPrice') {
      newLines[index].lineTotal = newLines[index].quantity * newLines[index].unitPrice;
    }
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
      notify('Please select an invoice', 'error', 3000);
      return;
    }

    if (lines.length === 0) {
      notify('Please add at least one line', 'error', 3000);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/accounting/debit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteType,
          referenceInvoiceId: invoiceId,
          noteDate: noteDate.toISOString().split('T')[0],
          reasonCode,
          reasonDescription,
          notes,
          lines: lines.map((line) => ({
            referenceInvoiceLineId: line.referenceInvoiceLineId,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            glAccountId: line.glAccountId || 500,
          })),
        }),
      });

      const data = await response.json();

      if (data.success) {
        notify('Debit note created successfully', 'success', 3000);
        router.push(`/accounting/debit-notes/${data.id}`);
      } else {
        notify(data.error || 'Failed to create debit note', 'error', 3000);
      }
    } catch (error) {
      console.error('Error creating debit note:', error);
      notify('Failed to create debit note', 'error', 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
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
                {noteType.startsWith('ar_') ? 'Customer' : 'Vendor'} Invoice ID *
              </label>
              <NumberBox
                value={invoiceId || undefined}
                onValueChanged={(e) => setInvoiceId(e.value)}
                placeholder="Enter invoice ID"
                width="100%"
              />
              {invoiceInfo && (
                <div className="mt-1 text-sm text-gray-600">
                  Invoice: {invoiceInfo.invoiceNumber}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note Date *
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
                Reason Code *
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
                Reason Description
              </label>
              <TextBox
                value={reasonDescription}
                onValueChanged={(e) => setReasonDescription(e.value || '')}
                placeholder="Enter reason description"
                width="100%"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <TextArea
                value={notes}
                onValueChanged={(e) => setNotes(e.value || '')}
                placeholder="Additional notes"
                width="100%"
                height={60}
              />
            </div>
          </div>

          {/* Lines */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium text-gray-800">Lines</h3>
              <Button
                text="Add Line"
                icon="plus"
                stylingMode="outlined"
                onClick={addLine}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-32">Quantity</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-32">Unit Price</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-32">Line Total</th>
                    <th className="px-4 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lines.map((line, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2">
                        <TextBox
                          value={line.description}
                          onValueChanged={(e) => updateLine(index, 'description', e.value || '')}
                          placeholder="Description"
                          width="100%"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <NumberBox
                          value={line.quantity}
                          onValueChanged={(e) => updateLine(index, 'quantity', e.value || 0)}
                          min={0}
                          format="#,##0.##"
                          width={100}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <NumberBox
                          value={line.unitPrice}
                          onValueChanged={(e) => updateLine(index, 'unitPrice', e.value || 0)}
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
                    <td colSpan={3} className="px-4 py-2 text-right font-medium">Subtotal:</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {calculateTotal().toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="px-4 py-2 text-right font-medium">VAT (7%):</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {(calculateTotal() * 0.07).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                  <tr className="bg-gray-100">
                    <td colSpan={3} className="px-4 py-2 text-right font-bold">Total:</td>
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
              text="Cancel"
              stylingMode="outlined"
              onClick={() => router.push('/accounting/debit-notes')}
            />
            <Button
              text="Save Draft"
              type="default"
              stylingMode="contained"
              onClick={handleSave}
              disabled={saving}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

export default function NewDebitNotePage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <LoadIndicator />
        </div>
      </MainLayout>
    }>
      <NewDebitNoteContent />
    </Suspense>
  );
}

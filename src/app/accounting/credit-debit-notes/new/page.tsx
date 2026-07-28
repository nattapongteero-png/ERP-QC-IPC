/**
 * New Credit/Debit Note Page (T096)
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toLocalDateStr } from '@/lib/utils/date-format';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import { DateBox } from 'devextreme-react/date-box';
import { TextArea } from 'devextreme-react/text-area';
import { NumberBox } from 'devextreme-react/number-box';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import DataGrid, { Column, Editing, Lookup } from 'devextreme-react/data-grid';
import type { NoteType, ReasonCode, InvoiceReference } from '@/types/credit-debit-notes';
import { NOTE_TYPE_OPTIONS, REASON_CODE_OPTIONS } from '@/types/credit-debit-notes';

interface LineItem {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  glAccountId: number;
}

export default function NewCreditDebitNotePage() {
  const t = useTranslations('accounting');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceReference[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [glAccounts, setGlAccounts] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    noteType: '' as NoteType | '',
    referenceInvoiceId: 0,
    customerId: 0,
    vendorId: 0,
    noteDate: toLocalDateStr(new Date()),
    reasonCode: '' as ReasonCode | '',
    reasonDescription: '',
    vatRate: 0.07,
    notes: '',
  });

  const [lines, setLines] = useState<LineItem[]>([
    { id: 1, description: '', quantity: 1, unitPrice: 0, lineTotal: 0, glAccountId: 0 },
  ]);

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    if (formData.noteType) {
      fetchInvoices();
    }
  }, [formData.noteType, formData.customerId, formData.vendorId]);

  const fetchMasterData = async () => {
    setLoading(true);
    try {
      const [custRes, vendRes, accRes] = await Promise.all([
        fetch('/api/customers?isActive=true&limit=1000'),
        fetch('/api/vendors?isActive=true&limit=1000'),
        fetch('/api/accounting/gl-accounts?isActive=true&isPostable=true'),
      ]);

      const custData = await custRes.json();
      const vendData = await vendRes.json();
      const accData = await accRes.json();

      // /api/customers + /api/vendors return paginated { items, total } inside .data
      if (custData.success) setCustomers(custData.data?.items || custData.data || []);
      if (vendData.success) setVendors(vendData.data?.items || vendData.data || []);
      // /api/accounting/gl-accounts returns a plain array in .data
      if (accData.success) setGlAccounts(accData.data || []);
    } catch (error) {
      console.error('Error fetching master data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    const type = formData.noteType.startsWith('ar_') ? 'ar' : 'ap';
    const params = new URLSearchParams({ type });
    if (formData.customerId) params.set('customerId', formData.customerId.toString());
    if (formData.vendorId) params.set('vendorId', formData.vendorId.toString());

    try {
      const response = await fetch(
        `/api/accounting/credit-debit-notes/reference-invoices?${params}`
      );
      const data = await response.json();
      if (data.success) {
        setInvoices(data.data);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  };

  const calculateTotals = () => {
    const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const vatAmount = subtotal * formData.vatRate;
    const totalAmount = subtotal + vatAmount;
    return { subtotal, vatAmount, totalAmount };
  };

  const handleLineUpdate = (lineId: number, field: string, value: any) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id === lineId) {
          const updated = { ...line, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            updated.lineTotal = updated.quantity * updated.unitPrice;
          }
          return updated;
        }
        return line;
      })
    );
  };

  const addLine = () => {
    const newId = Math.max(...lines.map((l) => l.id)) + 1;
    setLines([
      ...lines,
      { id: newId, description: '', quantity: 1, unitPrice: 0, lineTotal: 0, glAccountId: 0 },
    ]);
  };

  const removeLine = (lineId: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((l) => l.id !== lineId));
    }
  };

  const handleSave = async () => {
    if (
      !formData.noteType ||
      !formData.referenceInvoiceId ||
      !formData.reasonCode
    ) {
      alert(t('creditDebitNotes.toast.requiredFields'));
      return;
    }

    const validLines = lines.filter((l) => l.description && l.glAccountId);
    if (validLines.length === 0) {
      alert(t('creditDebitNotes.toast.atLeastOneLine'));
      return;
    }

    setSaving(true);
    try {
      const referenceType = formData.noteType.startsWith('ar_') ? 'ar_invoice' : 'ap_invoice';
      const response = await fetch('/api/accounting/credit-debit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteType: formData.noteType,
          referenceType,
          referenceInvoiceId: formData.referenceInvoiceId,
          customerId: formData.customerId || undefined,
          vendorId: formData.vendorId || undefined,
          noteDate: formData.noteDate,
          reasonCode: formData.reasonCode,
          reasonDescription: formData.reasonDescription,
          vatRate: formData.vatRate,
          notes: formData.notes,
          lines: validLines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            glAccountId: l.glAccountId,
          })),
        }),
      });

      const result = await response.json();
      if (result.success) {
        router.push(`/accounting/credit-debit-notes/${result.id}`);
      } else {
        alert(result.error || t('creditDebitNotes.toast.createFailed'));
      }
    } catch (error) {
      console.error('Error saving note:', error);
      alert(t('creditDebitNotes.toast.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  const { subtotal, vatAmount, totalAmount } = calculateTotals();

  if (loading) {
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
          <p className="text-gray-600">{t('creditDebitNotes.form.newSubtitle')}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          {/* Header Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('creditDebitNotes.form.noteType')} <span className="text-red-500">*</span>
              </label>
              <SelectBox
                items={NOTE_TYPE_OPTIONS}
                value={formData.noteType}
                valueExpr="value"
                displayExpr="label"
                onValueChanged={(e) =>
                  setFormData({
                    ...formData,
                    noteType: e.value,
                    referenceInvoiceId: 0,
                  })
                }
                placeholder={t('creditDebitNotes.form.noteTypePlaceholder')}
                data-testid="note-type-select"
              />
            </div>

            {formData.noteType.startsWith('ar_') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('creditDebitNotes.form.customer')} <span className="text-red-500">*</span>
                </label>
                <SelectBox
                  items={customers}
                  value={formData.customerId}
                  valueExpr="id"
                  displayExpr="name"
                  onValueChanged={(e) =>
                    setFormData({ ...formData, customerId: e.value })
                  }
                  searchEnabled={true}
                  placeholder={t('creditDebitNotes.form.customerPlaceholder')}
                />
              </div>
            )}

            {formData.noteType.startsWith('ap_') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('creditDebitNotes.form.vendor')} <span className="text-red-500">*</span>
                </label>
                <SelectBox
                  items={vendors}
                  value={formData.vendorId}
                  valueExpr="id"
                  displayExpr="name"
                  onValueChanged={(e) =>
                    setFormData({ ...formData, vendorId: e.value })
                  }
                  searchEnabled={true}
                  placeholder={t('creditDebitNotes.form.vendorPlaceholder')}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('creditDebitNotes.form.referenceInvoice')} <span className="text-red-500">*</span>
              </label>
              <SelectBox
                items={invoices}
                value={formData.referenceInvoiceId}
                valueExpr="id"
                displayExpr="invoiceNumber"
                onValueChanged={(e) =>
                  setFormData({ ...formData, referenceInvoiceId: e.value })
                }
                searchEnabled={true}
                placeholder={t('creditDebitNotes.form.referenceInvoicePlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('creditDebitNotes.form.date')} <span className="text-red-500">*</span>
              </label>
              <DateBox
                value={formData.noteDate}
                onValueChanged={(e) =>
                  setFormData({
                    ...formData,
                    noteDate: e.value ? toLocalDateStr(e.value) : '',
                  })
                }
                type="date"
                displayFormat="dd/MM/yyyy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('creditDebitNotes.form.reason')} <span className="text-red-500">*</span>
              </label>
              <SelectBox
                items={REASON_CODE_OPTIONS}
                value={formData.reasonCode}
                valueExpr="value"
                displayExpr="label"
                onValueChanged={(e) =>
                  setFormData({ ...formData, reasonCode: e.value })
                }
                placeholder={t('creditDebitNotes.form.reasonPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('creditDebitNotes.form.vatRate')}
              </label>
              <NumberBox
                value={formData.vatRate * 100}
                onValueChanged={(e) =>
                  setFormData({ ...formData, vatRate: (e.value || 0) / 100 })
                }
                format="#0.##'%'"
                min={0}
                max={100}
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('creditDebitNotes.form.reasonDescription')}
            </label>
            <TextArea
              value={formData.reasonDescription}
              onValueChanged={(e) =>
                setFormData({ ...formData, reasonDescription: e.value || '' })
              }
              height={60}
              placeholder={t('creditDebitNotes.form.reasonDescriptionPlaceholder')}
            />
          </div>

          {/* Lines Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">{t('creditDebitNotes.form.lines')}</h3>
              <Button text={t('creditDebitNotes.form.addLine')} icon="plus" onClick={addLine} />
            </div>

            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">{t('creditDebitNotes.columns.description')}</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">{t('creditDebitNotes.columns.quantity')}</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">{t('creditDebitNotes.columns.unitPrice')}</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">{t('creditDebitNotes.columns.lineTotal')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">{t('creditDebitNotes.columns.glAccount')}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lines.map((line, index) => (
                  <tr key={line.id}>
                    <td className="px-3 py-2">{index + 1}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) =>
                          handleLineUpdate(line.id, 'description', e.target.value)
                        }
                        className="w-full border rounded px-2 py-1"
                        placeholder={t('creditDebitNotes.columns.description')}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) =>
                          handleLineUpdate(line.id, 'quantity', parseFloat(e.target.value) || 0)
                        }
                        className="w-20 border rounded px-2 py-1 text-right"
                        min={0}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={line.unitPrice}
                        onChange={(e) =>
                          handleLineUpdate(line.id, 'unitPrice', parseFloat(e.target.value) || 0)
                        }
                        className="w-28 border rounded px-2 py-1 text-right"
                        min={0}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      {line.lineTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={line.glAccountId}
                        onChange={(e) =>
                          handleLineUpdate(line.id, 'glAccountId', parseInt(e.target.value) || 0)
                        }
                        className="w-full border rounded px-2 py-1"
                      >
                        <option value={0}>{t('creditDebitNotes.form.selectAccount')}</option>
                        {glAccounts.map((acc: any) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.accountNumber} - {acc.accountName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      {lines.length > 1 && (
                        <Button
                          icon="trash"
                          stylingMode="text"
                          onClick={() => removeLine(line.id)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">{t('creditDebitNotes.form.subtotal')}:</span>
                <span className="font-medium">
                  {subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('creditDebitNotes.form.vat', { rate: (formData.vatRate * 100).toFixed(0) })}</span>
                <span className="font-medium">
                  {vatAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>{t('creditDebitNotes.form.grandTotal')}:</span>
                <span>
                  {totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
            <Button
              text={t('creditDebitNotes.actions.cancel')}
              onClick={() => router.push('/accounting/credit-debit-notes')}
            />
            <Button
              text={saving ? t('creditDebitNotes.actions.saving') : t('creditDebitNotes.actions.saveDraft')}
              type="default"
              stylingMode="contained"
              onClick={handleSave}
              disabled={saving}
              elementAttr={{ 'data-testid': 'save-btn' }}
            />
          </div>
        </div>
      </div>
  );
}

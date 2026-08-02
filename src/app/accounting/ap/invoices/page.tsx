'use client';

/**
 * AP Invoices Page
 * Feature: 010-accounting-module-integration
 * User Story 2: Record Purchase-to-Pay Transactions
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import DataGrid, {
  Column,
  Paging,
  Pager,
  SearchPanel,
  Toolbar,
  Item,
  Sorting,
  Summary,
  TotalItem,
  Format,
} from 'devextreme-react/data-grid';
import type { DataGridRef } from 'devextreme-react/data-grid';
import { exportGridToExcel } from '@/lib/utils/export-grid-excel';
import { Popup } from 'devextreme-react/popup';
import Form, {
  SimpleItem,
  GroupItem,
  RequiredRule,
} from 'devextreme-react/form';
import { Button } from 'devextreme-react/button';
import DropDownButton from 'devextreme-react/drop-down-button';
import { formatMoney } from '@/lib/utils/number-format';
import { calcLineVat } from '@/lib/utils/vat';
import { SelectBox } from 'devextreme-react/select-box';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingFilterPanel,
  AccountingStatusBadge,
} from '@/components/accounting';
import {
  APInvoicePrintDocument,
  type APInvoicePrintData,
} from '@/components/accounting/APInvoicePrintDocument';

// Types
interface APInvoice {
  id: number;
  invoiceNumber: string;
  vendorId: number;
  vendorName?: string;
  invoiceDate: string;
  dueDate: string;
  receivedDate: string;
  description: string | null;
  subtotal: number;
  vatAmount: number;
  whtAmount: number;
  totalAmount: number;
  paidAmount: number;
  currency: string;
  status: 'draft' | 'approved' | 'posted' | 'partial' | 'paid' | 'cancelled';
  journalEntryId: number | null;
}

interface Vendor {
  id: number;
  code: string;
  name: string;
  // Carried through for the printable invoice — the print document shows the
  // vendor's tax id and address on the ผู้ขาย block.
  taxId?: string | null;
  address?: string | null;
  contactPerson?: string | null;
}

interface GLAccount {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string;
}

interface FormData {
  invoiceNumber: string;
  vendorId: number | null;
  invoiceDate: string;
  dueDate: string;
  receivedDate: string;
  description: string;
  vatRate: number;
  vatAmountOverride: number | null; // null = auto-calculate, number = manual override
  vatInclusive: boolean;
  lines: {
    description: string;
    glAccountId: number | null;
    quantity: number;
    unitPrice: number;
  }[];
}

const VAT_RATE_OPTIONS = [
  { value: 0, label: 'VAT 0%' },
  { value: 7, label: 'VAT 7%' },
];

// API functions
async function fetchAPInvoices(filters?: { status?: string }): Promise<APInvoice[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  const res = await fetch(`/api/accounting/ap-invoices?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch invoices');
  const json = await res.json();
  return json.data;
}

async function fetchVendors(): Promise<Vendor[]> {
  const res = await fetch('/api/vendors?isActive=true&limit=1000');
  if (!res.ok) throw new Error('Failed to fetch vendors');
  const json = await res.json();
  return json.data?.items || json.data || [];
}

async function fetchGLAccounts(): Promise<GLAccount[]> {
  const res = await fetch('/api/accounting/gl-accounts?isActive=true&isPostable=true');
  if (!res.ok) throw new Error('Failed to fetch accounts');
  const json = await res.json();
  return json.data;
}

async function createAPInvoice(data: any): Promise<APInvoice> {
  const res = await fetch('/api/accounting/ap-invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to create invoice');
  }
  return (await res.json()).data;
}

async function approveInvoice(id: number): Promise<APInvoice> {
  const res = await fetch(`/api/accounting/ap-invoices/${id}/approve`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to approve invoice');
  }
  return (await res.json()).data;
}

export default function APInvoicesPage() {
  const t = useTranslations('accounting');
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);
  const [printData, setPrintData] = useState<APInvoicePrintData | null>(null);
  const [printing, setPrinting] = useState(false);
  const gridRef = useRef<DataGridRef>(null);

  const handleExportExcel = useCallback(() => {
    exportGridToExcel(gridRef.current, 'ap-invoices', t('accountsPayable.bills.title'));
  }, [t]);
  const [formData, setFormData] = useState<FormData>({
    invoiceNumber: '',
    vendorId: null,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    receivedDate: new Date().toISOString().split('T')[0],
    description: '',
    vatRate: 7,
    vatAmountOverride: null,
    vatInclusive: false,
    lines: [{ description: '', glAccountId: null, quantity: 1, unitPrice: 0 }],
  });

  // Queries
  const { data: invoices = [] } = useQuery({
    queryKey: ['ap-invoices', statusFilter],
    queryFn: () => fetchAPInvoices({ status: statusFilter || undefined }),
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: fetchVendors,
  });

  const { data: glAccounts = [] } = useQuery({
    queryKey: ['gl-accounts'],
    queryFn: fetchGLAccounts,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createAPInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-invoices'] });
      notify(t('accountsPayable.invoicesPage.toast.createSuccess'), 'success', 3000);
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      notify(error.message || t('accountsPayable.invoicesPage.toast.createError'), 'error', 4000);
    },
  });

  const approveMutation = useMutation({
    mutationFn: approveInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-invoices'] });
      notify(t('accountsPayable.invoicesPage.toast.approveSuccess'), 'success', 3000);
    },
    onError: (error: Error) => {
      notify(error.message || t('accountsPayable.invoicesPage.toast.approveError'), 'error', 4000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/accounting/ap-invoices/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to delete invoice');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-invoices'] });
      notify(t('accountsPayable.invoicesPage.toast.deleteSuccess'), 'success', 3000);
    },
    onError: (error: Error) => {
      notify(error.message || t('accountsPayable.invoicesPage.toast.deleteError'), 'error', 4000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/accounting/ap-invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update invoice');
      }
      return (await res.json()).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-invoices'] });
      notify(t('accountsPayable.invoicesPage.toast.updateSuccess'), 'success', 3000);
      setIsDialogOpen(false);
      setEditingInvoiceId(null);
      resetForm();
    },
    onError: (error: Error) => {
      notify(error.message || t('accountsPayable.invoicesPage.toast.updateError'), 'error', 4000);
    },
  });

  // Handlers
  const resetForm = useCallback(() => {
    setFormData({
      invoiceNumber: '',
      vendorId: null,
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      receivedDate: new Date().toISOString().split('T')[0],
      description: '',
      vatRate: 7,
      vatAmountOverride: null,
      vatInclusive: false,
      lines: [{ description: '', glAccountId: null, quantity: 1, unitPrice: 0 }],
    });
  }, []);

  const handleOpenDialog = useCallback(() => {
    resetForm();
    setEditingInvoiceId(null);
    setIsDialogOpen(true);
  }, [resetForm]);

  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
    setEditingInvoiceId(null);
  }, []);

  const handleSave = useCallback(() => {
    if (!formData.vendorId || !formData.invoiceNumber) {
      notify(t('accountsPayable.invoicesPage.toast.fillRequired'), 'warning', 3000);
      return;
    }

    const validLines = formData.lines.filter(
      (l) => l.description && l.glAccountId && l.quantity > 0 && l.unitPrice > 0
    );

    if (validLines.length === 0) {
      notify(t('accountsPayable.invoicesPage.toast.addAtLeastOneLine'), 'warning', 3000);
      return;
    }

    const payload = {
      invoiceNumber: formData.invoiceNumber,
      vendorId: formData.vendorId,
      invoiceDate: formData.invoiceDate,
      dueDate: formData.dueDate,
      receivedDate: formData.receivedDate,
      description: formData.description || null,
      vatRate: formData.vatRate,
      vatAmountOverride: formData.vatAmountOverride,
      vatInclusive: formData.vatInclusive,
      lines: validLines,
    };

    if (editingInvoiceId) {
      updateMutation.mutate({ id: editingInvoiceId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }, [formData, createMutation, updateMutation, editingInvoiceId]);

  const handleApprove = useCallback(
    async (invoice: APInvoice) => {
      const result = await confirm(
        t('accountsPayable.invoicesPage.confirm.approveMessage', { number: invoice.invoiceNumber }),
        t('accountsPayable.invoicesPage.confirm.approveTitle')
      );
      if (result) {
        approveMutation.mutate(invoice.id);
      }
    },
    [approveMutation]
  );

  const handleEdit = useCallback(async (invoice: APInvoice) => {
    try {
      const res = await fetch(`/api/accounting/ap-invoices/${invoice.id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      const detail = json.data;
      const editLines = (detail.lines || []).map((l: any) => ({
        description: l.description || '',
        glAccountId: l.glAccountId || null,
        quantity: l.quantity || 1,
        unitPrice: l.unitPrice || 0,
      }));
      const editVatRate = detail.vatAmount > 0 ? 7 : 0;
      const editLineTotal = editLines.reduce(
        (sum: number, l: { quantity: number; unitPrice: number }) => sum + l.quantity * l.unitPrice,
        0
      );
      const autoVat = Math.round(editLineTotal * (editVatRate / 100) * 100) / 100;
      // Preserve a manual VAT override when the stored VAT differs from the auto-calculated value
      const editVatOverride =
        detail.vatAmount != null && Math.abs(Number(detail.vatAmount) - autoVat) > 0.005
          ? Number(detail.vatAmount)
          : null;
      setFormData({
        invoiceNumber: detail.invoiceNumber || '',
        vendorId: detail.vendorId || null,
        invoiceDate: detail.invoiceDate ? detail.invoiceDate.split('T')[0] : '',
        dueDate: detail.dueDate ? detail.dueDate.split('T')[0] : '',
        receivedDate: detail.receivedDate ? detail.receivedDate.split('T')[0] : '',
        description: detail.description || '',
        vatRate: editVatRate,
        vatAmountOverride: editVatOverride,
        vatInclusive: false,
        lines: editLines,
      });
      setEditingInvoiceId(invoice.id);
      setIsDialogOpen(true);
    } catch (err: any) {
      notify(err.message || t('accountsPayable.invoicesPage.toast.loadError'), 'error', 4000);
    }
  }, []);

  const handlePrint = useCallback(
    async (invoice: APInvoice) => {
      try {
        const res = await fetch(`/api/accounting/ap-invoices/${invoice.id}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        const detail = json.data;
        const vendor = vendors.find((v) => v.id === detail.vendorId);
        setPrintData({
          invoiceNumber: detail.invoiceNumber,
          invoiceDate: detail.invoiceDate,
          dueDate: detail.dueDate,
          receivedDate: detail.receivedDate,
          description: detail.description,
          subtotal: Number(detail.subtotal) || 0,
          vatAmount: Number(detail.vatAmount) || 0,
          whtAmount: Number(detail.whtAmount) || 0,
          totalAmount: Number(detail.totalAmount) || 0,
          paidAmount: Number(detail.paidAmount) || 0,
          lines: (detail.lines || []).map((l: any) => ({
            description: l.description || '',
            quantity: Number(l.quantity) || 0,
            unitPrice: Number(l.unitPrice) || 0,
            amount: Number(l.amount) || 0,
          })),
          vendor: vendor
            ? {
                name: vendor.name,
                taxId: vendor.taxId,
                address: vendor.address,
                contactPerson: vendor.contactPerson,
              }
            : { name: invoice.vendorName },
        });
        setPrinting(true);
        // Let React paint the hidden document before handing off to the browser.
        requestAnimationFrame(() => {
          window.print();
          setPrinting(false);
        });
      } catch (err: any) {
        notify(err.message || t('accountsPayable.invoicesPage.toast.loadError'), 'error', 4000);
      }
    },
    [vendors, t]
  );

  const handleDelete = useCallback(
    async (invoice: APInvoice) => {
      const result = await confirm(
        t('accountsPayable.invoicesPage.confirm.deleteMessage', { number: invoice.invoiceNumber }),
        t('accountsPayable.invoicesPage.confirm.deleteTitle')
      );
      if (result) {
        deleteMutation.mutate(invoice.id);
      }
    },
    [deleteMutation]
  );

  const addLine = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      lines: [...prev.lines, { description: '', glAccountId: null, quantity: 1, unitPrice: 0 }],
    }));
  }, []);

  const removeLine = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  }, []);

  const updateLine = useCallback((index: number, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) =>
        i === index ? { ...line, [field]: value } : line
      ),
    }));
  }, []);

  // Calculate totals
  const lineTotal = useMemo(() => {
    return formData.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  }, [formData.lines]);

  const apDocVat = useMemo(
    () => calcLineVat(lineTotal, formData.vatInclusive, formData.vatRate / 100),
    [lineTotal, formData.vatRate, formData.vatInclusive],
  );
  const subtotalAmount = apDocVat.base;
  const vatAmount = useMemo(() => {
    if (formData.vatAmountOverride !== null) return formData.vatAmountOverride;
    return apDocVat.vat;
  }, [apDocVat.vat, formData.vatAmountOverride]);

  // Status badge render using AccountingStatusBadge
  /** Compact Thai date (28/7/69) for the secondary line under a date. */
  const formatShortDate = useCallback((value: string | Date | null | undefined): string => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'numeric', year: '2-digit' });
  }, []);

  const statusCellRender = useCallback((cellData: any) => {
    const statusValue = cellData.value as 'draft' | 'posted' | 'partial' | 'paid' | 'cancelled' | 'approved';
    // Map AP-specific statuses to badge statuses
    const statusMap: Record<string, 'draft' | 'posted' | 'partial' | 'paid' | 'cancelled' | 'approved'> = {
      draft: 'draft',
      approved: 'approved',
      posted: 'posted',
      partial: 'partial',
      paid: 'paid',
      cancelled: 'cancelled',
    };
    const mappedStatus = statusMap[statusValue] || 'draft';
    return <AccountingStatusBadge status={mappedStatus} />;
  }, []);

  // Action buttons render
  const actionsCellRender = useCallback(
    (cellData: any) => {
      const invoice = cellData.data as APInvoice;
      return (
        // One primary action per row, the rest behind an overflow menu —
        // same rule as the AR invoice list. Showing every applicable control
        // side by side is what forced these action columns wide enough to push
        // the grid past its container.
        <div className="flex items-center justify-end gap-1">
          {invoice.status === 'draft' && (
            <Button
              text={t('accountsPayable.invoicesPage.actions.approve')}
              type="success"
              stylingMode="contained"
              height={28}
              onClick={() => handleApprove(invoice)}
              elementAttr={{ 'data-testid': `ap-approve-btn-${invoice.id}` }}
            />
          )}
          {['posted', 'partial'].includes(invoice.status) && (
            <Button
              text={t('accountsPayable.invoicesPage.actions.pay')}
              type="default"
              stylingMode="contained"
              height={28}
              onClick={() => notify(t('accountsPayable.invoicesPage.toast.paymentUnderDevelopment'), 'info', 3000)}
              elementAttr={{ 'data-testid': `ap-pay-btn-${invoice.id}` }}
            />
          )}
          <DropDownButton
            icon="overflow"
            stylingMode="text"
            height={28}
            width={36}
            showArrowIcon={false}
            dropDownOptions={{ width: 190 }}
            displayExpr="text"
            keyExpr="key"
            items={[
              { key: 'print', text: t('accountsPayable.invoicesPage.actions.print'), icon: 'print' },
              ...(invoice.status === 'draft'
                ? [
                    { key: 'edit', text: t('accountsPayable.invoicesPage.actions.edit'), icon: 'edit' },
                    { key: 'delete', text: t('accountsPayable.invoicesPage.actions.delete'), icon: 'trash' },
                  ]
                : []),
            ]}
            onItemClick={(e: { itemData?: { key?: string } }) => {
              switch (e.itemData?.key) {
                case 'print': handlePrint(invoice); break;
                case 'edit': handleEdit(invoice); break;
                case 'delete': handleDelete(invoice); break;
              }
            }}
            elementAttr={{ 'data-testid': `ap-actions-menu-${invoice.id}` }}
          />
        </div>
      );
    },
    [handleApprove, handleEdit, handleDelete, handlePrint, t]
  );

  // Calculate stats
  const stats = useMemo(() => {
    const total = invoices.length;
    const pending = invoices.filter((i) => i.status === 'draft').length;
    const outstanding = invoices.filter((i) => ['posted', 'partial'].includes(i.status)).length;
    const paid = invoices.filter((i) => i.status === 'paid').length;
    const totalAmount = invoices.reduce((sum, i) => sum + i.totalAmount, 0);
    const outstandingAmount = invoices
      .filter((i) => ['posted', 'partial'].includes(i.status))
      .reduce((sum, i) => sum + (i.totalAmount - i.paidAmount), 0);

    return { total, pending, outstanding, paid, totalAmount, outstandingAmount };
  }, [invoices]);

  // Add row sequence numbers for the grid
  const invoicesWithRowNumber = useMemo(
    () => invoices.map((item, index) => ({ ...item, _rowNumber: index + 1 })),
    [invoices]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50" data-testid="ap-invoices-page">
      {/* Professional Header */}
      <AccountingPageHeader
        title={t('accountsPayable.bills.title')}
        subtitle={t('accountsPayable.title')}
        icon="receipt"
        onBack={() => window.location.href = '/accounting/ap'}
        breadcrumbs={[
          { label: t('accountsPayable.title'), href: '/accounting/ap' },
          { label: t('accountsPayable.bills.title') },
        ]}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['ap-invoices'] })}
        actions={
          <Button
            text={t('accountsPayable.invoicesPage.addInvoice')}
            icon="plus"
            type="success"
            onClick={handleOpenDialog}
            elementAttr={{ 'data-testid': 'ap-add-invoice-btn' }}
          />
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <AccountingKPICard
            label={t('accountsPayable.invoicesPage.kpi.totalItems')}
            value={stats.total.toLocaleString('th-TH')}
            subtitle={`฿${stats.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}
            icon="file-text"
            variant="info"
          />
          <AccountingKPICard
            label={t('accountsPayable.invoicesPage.kpi.pending')}
            value={stats.pending.toLocaleString('th-TH')}
            subtitle={t('accountsPayable.invoicesPage.kpi.pendingSubtitle')}
            icon="clock"
            variant="warning"
          />
          <AccountingKPICard
            label={t('accountsPayable.invoicesPage.kpi.outstanding')}
            value={stats.outstanding.toLocaleString('th-TH')}
            subtitle={`฿${stats.outstandingAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}
            icon="credit-card"
            variant="danger"
          />
          <AccountingKPICard
            label={t('accountsPayable.invoicesPage.kpi.paid')}
            value={stats.paid.toLocaleString('th-TH')}
            subtitle={t('accountsPayable.invoicesPage.kpi.paidSubtitle')}
            icon="check-circle"
            variant="success"
          />
        </div>

        {/* Filter Panel */}
        <AccountingFilterPanel>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('accountsPayable.statusLabels.status')}
              </label>
              <SelectBox
                dataSource={[
                  { value: '', label: t('accountsPayable.statusLabels.all') },
                  { value: 'draft', label: t('accountsPayable.statusLabels.draft') },
                  { value: 'posted', label: t('accountsPayable.statusLabels.posted') },
                  { value: 'partial', label: t('accountsPayable.statusLabels.partial') },
                  { value: 'paid', label: t('accountsPayable.statusLabels.paid') },
                ]}
                displayExpr="label"
                valueExpr="value"
                value={statusFilter}
                onValueChanged={(e) => setStatusFilter(e.value)}
                placeholder={t('accountsPayable.invoicesPage.filterStatusPlaceholder')}
                width={200}
              />
            </div>
          </div>
        </AccountingFilterPanel>

        {/* Mobile card list — a 10-column grid is unreadable on a phone. */}
        <div className="md:hidden space-y-3" data-testid="ap-invoices-cards">
          {invoicesWithRowNumber.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
              ไม่พบใบแจ้งหนี้
            </div>
          ) : (
            invoicesWithRowNumber.map((invoice: APInvoice) => {
              const total = Number(invoice.totalAmount) || 0;
              const paid = Number(invoice.paidAmount) || 0;
              const outstanding = total - paid;
              return (
                <div
                  key={invoice.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
                  data-testid={`ap-invoice-card-${invoice.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{invoice.invoiceNumber}</div>
                      {invoice.vendorName && (
                        <div className="text-xs text-gray-500 truncate">{invoice.vendorName}</div>
                      )}
                    </div>
                    {statusCellRender({ value: invoice.status })}
                  </div>

                  <p className="mt-2 text-sm text-gray-600 line-clamp-2">{invoice.description}</p>

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="text-xs text-gray-500">
                      <div>{t(`accountsPayable.invoicesPage.dateLabel`)} {formatShortDate(invoice.invoiceDate)}</div>
                      {invoice.dueDate && <div>{t(`accountsPayable.invoicesPage.dueLabel`)} {formatShortDate(invoice.dueDate)}</div>}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900 tabular-nums">
                        {formatMoney(total, 2)} บาท
                      </div>
                      {paid > 0 && outstanding > 0.004 && (
                        <div className="text-xs text-amber-600 tabular-nums">
                          ค้าง {formatMoney(outstanding, 2)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
                    {invoice.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => handleApprove(invoice)}
                        className="flex-1 h-11 rounded-lg bg-emerald-600 text-white text-sm font-medium active:bg-emerald-700"
                      >
                        {t('accountsPayable.invoicesPage.actions.approve')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handlePrint(invoice)}
                      className="h-11 px-4 rounded-lg border border-gray-300 text-sm text-gray-700 active:bg-gray-50"
                    >
                      {t('accountsPayable.invoicesPage.actions.print')}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Data Grid — desktop / tablet only */}
        <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200" data-testid="ap-invoices-grid" data-build="ar-ap-export-20260727-v2">
        <DataGrid
          ref={gridRef}
          dataSource={invoicesWithRowNumber}
          keyExpr="id"
          showBorders={true}
          showRowLines={true}
          showColumnLines={false}
          rowAlternationEnabled={true}
          allowColumnReordering={true}
          allowColumnResizing={true}
          // See the AR invoice list: autoWidth lets a long description stretch
          // the table past its container and pushes the actions off-screen.
          columnAutoWidth={false}
          columnHidingEnabled={true}
          wordWrapEnabled={false}
        >
          <Paging defaultPageSize={20} />
          <Pager
            visible={true}
            showPageSizeSelector={true}
            allowedPageSizes={[10, 20, 50]}
            showInfo={true}
          />
          <SearchPanel visible={true} placeholder={t('accountsPayable.invoicesPage.searchPlaceholder')} />
          <Sorting mode="multiple" />

          {/* A labelled "ส่งออก Excel" button that actually writes the file
              (DevExtreme's built-in <Export> only shows a button; it produced no
              file here). Runs exportGridToExcel via the grid ref. */}
          <Toolbar>
            <Item name="searchPanel" location="before" />
            <Item location="after" widget="dxButton" options={{
              icon: 'xlsxfile',
              text: t('accountsPayable.invoicesPage.exportExcel'),
              stylingMode: 'contained',
              type: 'success',
              onClick: handleExportExcel,
              elementAttr: { 'data-testid': 'ap-export-excel-btn' },
            }} />
          </Toolbar>

          <Column
            dataField="_rowNumber"
            caption={t('items.grid.columns.rowNum')}
            width={60}
            alignment="center"
            allowFiltering={false}
            allowSorting={false}
            allowGrouping={false}
            cellRender={(cellInfo) => (
              <span className="text-gray-500 text-sm font-medium">
                {cellInfo.data._rowNumber}
              </span>
            )}
          />
          <Column dataField="invoiceNumber" caption={t('accountsPayable.bills.table.columns.billNumber')} width={165} />
          <Column dataField="vendorId" caption={t('accountsPayable.invoicesPage.columns.vendor')} width={150} visible={false} />
          {/* Bill date over due date: read together, so one column instead of
              two 110px ones. */}
          <Column
            dataField="invoiceDate"
            caption={t('accountsPayable.bills.table.columns.billDate')}
            dataType="date"
            // 115px clipped the Thai second line to "ครบกำหนด 24/7/6" — the
            // label "ครบกำหนด" is far longer than the English "Due", so the
            // width has to clear the longer of the two languages.
            width={150}
            minWidth={150}
            cellRender={(c: { data: APInvoice; text: string }) => (
              <div className="leading-tight">
                <div>{c.text}</div>
                {c.data.dueDate && (
                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    {t(`accountsPayable.invoicesPage.dueLabel`)} {formatShortDate(c.data.dueDate)}
                  </div>
                )}
              </div>
            )}
          />
          <Column dataField="dueDate" caption={t('accountsPayable.bills.table.columns.dueDate')} dataType="date" width={110} visible={false} />
          {/* Truncate instead of letting a long description size the table and
              push the action column off-screen. */}
          <Column
            dataField="description"
            caption={t('accountsPayable.invoicesPage.columns.description')}
            minWidth={180}
            cellRender={(c: { data: APInvoice }) => (
              <span className="block truncate text-gray-700" title={c.data.description ?? ''}>
                {c.data.description}
              </span>
            )}
          />
          {/* Total with the outstanding balance underneath, so the reader does
              not have to subtract two columns in their head. */}
          <Column
            dataField="totalAmount"
            caption={t('accountsPayable.invoicesPage.columns.total')}
            dataType="number"
            width={140}
            alignment="right"
            cellRender={(c: { data: APInvoice }) => {
              const total = Number(c.data.totalAmount) || 0;
              const paid = Number(c.data.paidAmount) || 0;
              const outstanding = total - paid;
              return (
                <div className="leading-tight text-right">
                  <div className="font-medium text-gray-900 tabular-nums">{formatMoney(total, 2)}</div>
                  {paid > 0 && outstanding > 0.004 && (
                    <div className="text-xs text-amber-600 tabular-nums">{t(`accountsPayable.invoicesPage.outstandingLabel`)} {formatMoney(outstanding, 2)}</div>
                  )}
                  {outstanding <= 0.004 && paid > 0 && (
                    <div className="text-xs text-emerald-600">{t(`accountsPayable.invoicesPage.paidInFull`)}</div>
                  )}
                </div>
              );
            }}
          />
          <Column
            dataField="paidAmount"
            caption={t('accountsPayable.bills.table.columns.paidAmount')}
            dataType="number"
            width={120}
            alignment="right"
            visible={false}
          >
            <Format type="fixedPoint" precision={2} />
          </Column>
          <Column
            dataField="status"
            caption={t('accountsPayable.bills.table.columns.status')}
            width={120}
            cellRender={statusCellRender}
          />
          {/* Pinned right so the action is always reachable; 140px is enough
              now that the cell holds one button plus an overflow menu. */}
          <Column
            caption={t('accountsPayable.invoicesPage.columns.actions')}
            width={140}
            fixed={true}
            fixedPosition="right"
            cellRender={actionsCellRender}
            allowFiltering={false}
            allowSorting={false}
          />

          <Summary>
            <TotalItem
              column="totalAmount"
              summaryType="sum"
              // DevExtreme's <Format type="fixedPoint"> renders no thousand
              // separators and no unit, so the footer read "206124.8".
              // formatMoney() is the project-wide rule for any displayed figure.
              customizeText={(item: { value: string | number | Date }) =>
                t(`accountsPayable.invoicesPage.summaryTotalCount`, {
                  count: invoices.length,
                  amount: formatMoney(Number(item.value) || 0, 2),
                })
              }
            />
          </Summary>
        </DataGrid>
        </div>

        {/* Add/Edit Invoice Dialog */}
        <Popup
          visible={isDialogOpen}
          onHiding={handleCloseDialog}
          title={editingInvoiceId ? t('accountsPayable.invoicesPage.dialog.editTitle') : t('accountsPayable.invoicesPage.dialog.addTitle')}
          width={800}
          height="auto"
          showCloseButton={true}
          dragEnabled={true}
        >
        <div className="p-4" data-testid="ap-invoice-dialog">
          <Form formData={formData} labelLocation="top" showColonAfterLabel={true}>
            <GroupItem colCount={3}>
              <SimpleItem
                dataField="invoiceNumber"
                label={{ text: t('accountsPayable.invoicesPage.form.invoiceNumber') }}
                editorOptions={{ placeholder: 'INV-YYYY-NNNN' }}
              >
                <RequiredRule message={t('accountsPayable.invoicesPage.form.invoiceNumberRequired')} />
              </SimpleItem>
              <SimpleItem
                dataField="vendorId"
                editorType="dxSelectBox"
                label={{ text: t('accountsPayable.invoicesPage.form.vendor') }}
                editorOptions={{
                  dataSource: vendors,
                  displayExpr: 'name',
                  valueExpr: 'id',
                  searchEnabled: true,
                }}
              >
                <RequiredRule message={t('accountsPayable.invoicesPage.form.vendorRequired')} />
              </SimpleItem>
            </GroupItem>
            <GroupItem colCount={3}>
              <SimpleItem
                dataField="invoiceDate"
                editorType="dxDateBox"
                label={{ text: t('accountsPayable.invoicesPage.form.invoiceDate') }}
                editorOptions={{ type: 'date', displayFormat: 'dd/MM/yyyy' }}
              >
                <RequiredRule message={t('accountsPayable.invoicesPage.form.invoiceDateRequired')} />
              </SimpleItem>
              <SimpleItem
                dataField="receivedDate"
                editorType="dxDateBox"
                label={{ text: t('accountsPayable.invoicesPage.form.receivedDate') }}
                editorOptions={{ type: 'date', displayFormat: 'dd/MM/yyyy' }}
              >
                <RequiredRule message={t('accountsPayable.invoicesPage.form.receivedDateRequired')} />
              </SimpleItem>
              <SimpleItem
                dataField="dueDate"
                editorType="dxDateBox"
                label={{ text: t('accountsPayable.invoicesPage.form.dueDate') }}
                editorOptions={{ type: 'date', displayFormat: 'dd/MM/yyyy' }}
              >
                <RequiredRule message={t('accountsPayable.invoicesPage.form.dueDateRequired')} />
              </SimpleItem>
            </GroupItem>
            <SimpleItem
              dataField="description"
              editorType="dxTextArea"
              label={{ text: t('accountsPayable.invoicesPage.form.description') }}
              editorOptions={{ height: 60 }}
            />
          </Form>

          {/* Line Items */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">{t('accountsPayable.invoicesPage.lineItems.title')}</h3>
              <Button text={t('accountsPayable.invoicesPage.lineItems.addLine')} icon="plus" type="default" onClick={addLine} />
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">{t('accountsPayable.invoicesPage.lineItems.colDescription')}</th>
                  <th className="border p-2 text-left" style={{ width: 200 }}>
                    {t('accountsPayable.invoicesPage.lineItems.colAccount')}
                  </th>
                  <th className="border p-2 text-right" style={{ width: 80 }}>
                    {t('accountsPayable.invoicesPage.lineItems.colQuantity')}
                  </th>
                  <th className="border p-2 text-right" style={{ width: 120 }}>
                    {t('accountsPayable.invoicesPage.lineItems.colUnitPrice')}
                  </th>
                  <th className="border p-2 text-right" style={{ width: 120 }}>
                    {t('accountsPayable.invoicesPage.lineItems.colTotal')}
                  </th>
                  <th className="border p-2" style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {formData.lines.map((line, index) => (
                  <tr key={index}>
                    <td className="border p-1">
                      <input
                        type="text"
                        className="w-full p-1 border rounded"
                        value={line.description}
                        onChange={(e) => updateLine(index, 'description', e.target.value)}
                        placeholder={t('accountsPayable.invoicesPage.lineItems.colDescription')}
                      />
                    </td>
                    <td className="border p-1">
                      <select
                        className="w-full p-1 border rounded"
                        value={line.glAccountId || ''}
                        onChange={(e) =>
                          updateLine(index, 'glAccountId', e.target.value ? Number(e.target.value) : null)
                        }
                      >
                        <option value="">{t('accountsPayable.invoicesPage.lineItems.selectAccount')}</option>
                        {glAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.nameTh}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border p-1">
                      <input
                        type="number"
                        className="w-full p-1 border rounded text-right"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, 'quantity', Number(e.target.value))}
                        min={1}
                      />
                    </td>
                    <td className="border p-1">
                      <input
                        type="number"
                        className="w-full p-1 border rounded text-right"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(index, 'unitPrice', Number(e.target.value))}
                        min={0}
                      />
                    </td>
                    <td className="border p-1 text-right">
                      {(line.quantity * line.unitPrice).toLocaleString('th-TH', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="border p-1 text-center">
                      {formData.lines.length > 1 && (
                        <Button icon="trash" type="danger" stylingMode="text" onClick={() => removeLine(index)} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={4} className="border p-2 text-right text-sm text-gray-600">
                    {t('creditDebitNotes.form.priceBasis')}
                  </td>
                  <td colSpan={2} className="border p-1 text-center">
                    <div className="inline-flex rounded-md overflow-hidden border border-gray-300 bg-white" data-testid="ap-vat-basis-toggle">
                      <button type="button" onClick={() => setFormData(prev => ({ ...prev, vatInclusive: false }))}
                        className={`px-2 py-0.5 text-[11px] ${!formData.vatInclusive ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
                        data-testid="ap-vat-basis-exclusive">{t('creditDebitNotes.form.priceExclusive')}</button>
                      <button type="button" onClick={() => setFormData(prev => ({ ...prev, vatInclusive: true }))}
                        className={`px-2 py-0.5 text-[11px] border-l border-gray-300 ${formData.vatInclusive ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
                        data-testid="ap-vat-basis-inclusive">{t('creditDebitNotes.form.priceInclusive')}</button>
                    </div>
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td colSpan={4} className="border p-2 text-right font-semibold">
                    {t('accountsPayable.invoicesPage.lineItems.beforeVat')}
                  </td>
                  <td className="border p-2 text-right font-semibold">
                    {subtotalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="border"></td>
                </tr>
                <tr className="bg-gray-50">
                  <td colSpan={3} className="border p-2 text-right">
                    VAT
                  </td>
                  <td className="border p-1 text-center">
                    <select
                      className="w-full border rounded px-2 py-1 text-sm text-center bg-white"
                      value={formData.vatRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, vatRate: Number(e.target.value), vatAmountOverride: null }))}
                      data-testid="vat-rate-select"
                    >
                      <option value={0}>0%</option>
                      <option value={7}>7%</option>
                    </select>
                  </td>
                  <td className="border p-1 text-right">
                    <input
                      type="number"
                      className="w-full border rounded px-2 py-1 text-sm text-right bg-white"
                      value={formData.vatAmountOverride !== null ? formData.vatAmountOverride : vatAmount}
                      onChange={(e) => setFormData(prev => ({ ...prev, vatAmountOverride: Number(e.target.value) || 0 }))}
                      onBlur={() => {
                        if (formData.vatAmountOverride !== null && formData.vatAmountOverride === vatAmount) {
                          setFormData(prev => ({ ...prev, vatAmountOverride: null }));
                        }
                      }}
                      step="0.01"
                      min="0"
                      data-testid="vat-amount-input"
                    />
                  </td>
                  <td className="border"></td>
                </tr>
                <tr className="bg-gray-100">
                  <td colSpan={4} className="border p-2 text-right font-bold">
                    {t('accountsPayable.invoicesPage.lineItems.netTotal')}
                  </td>
                  <td className="border p-2 text-right font-bold text-lg">
                    {(subtotalAmount + vatAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="border"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Dialog Actions */}
          <div className="mt-6 flex justify-end gap-2">
            <Button text={t('accountsPayable.invoicesPage.dialog.cancel')} type="normal" stylingMode="outlined" onClick={handleCloseDialog} elementAttr={{ 'data-testid': 'ap-cancel-btn' }} />
            <Button
              text={editingInvoiceId ? t('accountsPayable.invoicesPage.dialog.saveEdit') : t('accountsPayable.invoicesPage.dialog.save')}
              type="success"
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              elementAttr={{ 'data-testid': 'ap-save-btn' }}
            />
          </div>
        </div>
        </Popup>
      </div>

      {/* Hidden on screen; the global @media print rules reveal .print-only. */}
      {printing && printData && <APInvoicePrintDocument invoice={printData} />}
    </div>
  );
}

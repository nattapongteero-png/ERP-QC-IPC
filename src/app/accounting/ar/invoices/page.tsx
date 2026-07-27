'use client';

/**
 * AR Invoices Page
 * Feature: 010-accounting-module-integration
 * User Story 3: Record Order-to-Cash Transactions
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
import { SelectBox } from 'devextreme-react/select-box';
import { TextArea } from 'devextreme-react/text-area';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingFilterPanel,
  AccountingStatusBadge,
} from '@/components/accounting';
import {
  ARInvoicePrintDocument,
  type ARInvoicePrintData,
} from '@/components/accounting/ARInvoicePrintDocument';
import { formatNumber } from '@/lib/utils/number-format';

// Types
interface ARInvoice {
  id: number;
  invoiceNumber: string;
  taxInvoiceNumber: string;
  customerId: number;
  customerName?: string;
  invoiceDate: string;
  dueDate: string;
  description: string | null;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  paidAmount: number;
  currency: string;
  status: 'draft' | 'confirmed' | 'posted' | 'partial' | 'paid' | 'cancelled' | 'rejected';
  journalEntryId: number | null;
}

interface ARInvoiceLine {
  lineNumber: number;
  description: string | null;
  itemId: number | null;
  glAccountId: number | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatAmount: number | null;
  lotId: number | null;
}

interface ARInvoiceDetail extends ARInvoice {
  salesOrderId: number | null;
  lines: ARInvoiceLine[];
  rejectedBy?: number | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
}

interface Customer {
  id: number;
  code: string;
  name: string;
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

interface BankAccount {
  id: number;
  code: string;
  nameTh: string;
}

interface FormData {
  invoiceNumber: string;
  customerId: number | null;
  invoiceDate: string;
  dueDate: string;
  description: string;
  vatRate: number;
  vatAmountOverride: number | null;
  lines: {
    description: string;
    glAccountId: number | null;
    quantity: number;
    unitPrice: number;
  }[];
}

interface PaymentFormData {
  paymentDate: string;
  bankAccountId: number | null;
  paymentMethod: 'cash' | 'check' | 'transfer' | 'other';
  referenceNumber: string;
  amount: number;
  description: string;
}

// API functions
async function fetchARInvoices(filters?: { status?: string }): Promise<ARInvoice[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  const res = await fetch(`/api/accounting/ar-invoices?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch invoices');
  const json = await res.json();
  return json.data;
}

async function fetchCustomers(): Promise<Customer[]> {
  const res = await fetch('/api/customers?isActive=true&limit=500');
  if (!res.ok) throw new Error('Failed to fetch customers');
  const json = await res.json();
  return json.data?.items || json.data || [];
}

async function fetchGLAccounts(): Promise<GLAccount[]> {
  const res = await fetch('/api/accounting/gl-accounts?isActive=true&isPostable=true');
  if (!res.ok) throw new Error('Failed to fetch accounts');
  const json = await res.json();
  return json.data;
}

async function fetchBankAccounts(): Promise<BankAccount[]> {
  const res = await fetch('/api/accounting/gl-accounts?isActive=true&accountType=asset');
  if (!res.ok) throw new Error('Failed to fetch bank accounts');
  const json = await res.json();
  // Filter for bank/cash accounts (typically codes starting with 11)
  return json.data.filter((acc: GLAccount) => acc.code.startsWith('11'));
}

async function createARInvoice(data: {
  invoiceNumber: string;
  customerId: number;
  invoiceDate: string;
  dueDate: string;
  description?: string | null;
  vatRate?: number;
  vatAmountOverride?: number | null;
  lines: { description: string; glAccountId: number; quantity: number; unitPrice: number }[];
}): Promise<ARInvoice> {
  const res = await fetch('/api/accounting/ar-invoices', {
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

async function confirmInvoice(id: number): Promise<ARInvoice> {
  const res = await fetch(`/api/accounting/ar-invoices/${id}/confirm`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to confirm invoice');
  }
  return (await res.json()).data;
}

async function rejectInvoice(id: number, reason: string): Promise<ARInvoice> {
  const res = await fetch(`/api/accounting/ar-invoices/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  const result = await res.json();
  if (!res.ok || !result.success) {
    throw new Error(result.error || result.message || 'Failed to reject invoice');
  }
  return result.data;
}

async function receivePayment(
  invoiceId: number,
  data: {
    paymentDate: string;
    bankAccountId: number;
    paymentMethod: 'cash' | 'check' | 'transfer' | 'other';
    referenceNumber?: string;
    amount: number;
    description?: string;
  }
): Promise<{ payment: { paymentNumber: string }; invoice: ARInvoice }> {
  const res = await fetch(`/api/accounting/ar-invoices/${invoiceId}/receive-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to receive payment');
  }
  return (await res.json()).data;
}

export default function ARInvoicesPage() {
  const t = useTranslations('accounting');
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<ARInvoice | null>(null);
  const [printData, setPrintData] = useState<ARInvoicePrintData | null>(null);
  const [printing, setPrinting] = useState(false);
  const gridRef = useRef<DataGridRef>(null);

  const handleExportExcel = useCallback(() => {
    exportGridToExcel(gridRef.current, 'ar-invoices', t('accountsReceivable.invoicesPage.title'));
  }, [t]);
  const [detailInvoice, setDetailInvoice] = useState<ARInvoiceDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ARInvoice | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [formData, setFormData] = useState<FormData>({
    invoiceNumber: '',
    customerId: null,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    description: '',
    vatRate: 7,
    vatAmountOverride: null,
    lines: [{ description: '', glAccountId: null, quantity: 1, unitPrice: 0 }],
  });
  const [paymentFormData, setPaymentFormData] = useState<PaymentFormData>({
    paymentDate: new Date().toISOString().split('T')[0],
    bankAccountId: null,
    paymentMethod: 'transfer',
    referenceNumber: '',
    amount: 0,
    description: '',
  });

  // Queries
  const { data: invoices = [] } = useQuery({
    queryKey: ['ar-invoices', statusFilter],
    queryFn: () => fetchARInvoices({ status: statusFilter || undefined }),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: fetchCustomers,
  });

  const { data: glAccounts = [] } = useQuery({
    queryKey: ['gl-accounts'],
    queryFn: fetchGLAccounts,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: fetchBankAccounts,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createARInvoice,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      notify(t('accountsReceivable.invoicesPage.toast.createSuccess', { taxInvoiceNumber: data.taxInvoiceNumber }), 'success', 3000);
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      notify(error.message || t('accountsReceivable.invoicesPage.toast.createError'), 'error', 4000);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: confirmInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      notify(t('accountsReceivable.invoicesPage.toast.confirmSuccess'), 'success', 3000);
    },
    onError: (error: Error) => {
      notify(error.message || t('accountsReceivable.invoicesPage.toast.confirmError'), 'error', 4000);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => rejectInvoice(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      notify(t('accountsReceivable.invoicesPage.toast.rejectSuccess'), 'success', 3000);
      setRejectTarget(null);
      setRejectReason('');
    },
    onError: (error: Error) => {
      notify(error.message || t('accountsReceivable.invoicesPage.toast.rejectError'), 'error', 4000);
    },
  });

  const paymentMutation = useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: number; data: Parameters<typeof receivePayment>[1] }) =>
      receivePayment(invoiceId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      notify(t('accountsReceivable.invoicesPage.toast.paymentSuccess', { receiptNumber: result.payment.paymentNumber }), 'success', 3000);
      setIsPaymentDialogOpen(false);
      setSelectedInvoice(null);
    },
    onError: (error: Error) => {
      notify(error.message || t('accountsReceivable.invoicesPage.toast.paymentError'), 'error', 4000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/accounting/ar-invoices/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to delete invoice');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      notify(t('accountsReceivable.invoicesPage.toast.deleteSuccess'), 'success', 3000);
    },
    onError: (error: Error) => {
      notify(error.message || t('accountsReceivable.invoicesPage.toast.deleteError'), 'error', 4000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/accounting/ar-invoices/${id}`, {
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
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      notify(t('accountsReceivable.invoicesPage.toast.updateSuccess'), 'success', 3000);
      setIsDialogOpen(false);
      setEditingInvoiceId(null);
      resetForm();
    },
    onError: (error: Error) => {
      notify(error.message || t('accountsReceivable.invoicesPage.toast.updateError'), 'error', 4000);
    },
  });

  // Handlers
  const resetForm = useCallback(() => {
    setFormData({
      invoiceNumber: '',
      customerId: null,
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      description: '',
      vatRate: 7,
      vatAmountOverride: null,
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
    if (!formData.customerId || !formData.invoiceNumber) {
      notify(t('accountsReceivable.invoicesPage.toast.fillRequired'), 'warning', 3000);
      return;
    }

    const validLines = formData.lines.filter(
      (l) => l.description && l.glAccountId && l.quantity > 0 && l.unitPrice > 0
    );

    if (validLines.length === 0) {
      notify(t('accountsReceivable.invoicesPage.toast.addAtLeastOneLine'), 'warning', 3000);
      return;
    }

    const payload = {
      invoiceNumber: formData.invoiceNumber,
      customerId: formData.customerId,
      invoiceDate: formData.invoiceDate,
      dueDate: formData.dueDate,
      description: formData.description || null,
      vatRate: formData.vatRate,
      vatAmountOverride: formData.vatAmountOverride,
      lines: validLines.map((l) => ({
        description: l.description,
        glAccountId: l.glAccountId!,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
    };

    if (editingInvoiceId) {
      updateMutation.mutate({ id: editingInvoiceId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }, [formData, createMutation, updateMutation, editingInvoiceId, t]);

  const handleConfirm = useCallback(
    async (invoice: ARInvoice) => {
      const result = await confirm(
        t('accountsReceivable.invoicesPage.confirmInvoice.message', {
          invoiceNumber: invoice.invoiceNumber,
          taxInvoiceNumber: invoice.taxInvoiceNumber,
        }),
        t('accountsReceivable.invoicesPage.confirmInvoice.title')
      );
      if (result) {
        confirmMutation.mutate(invoice.id);
      }
    },
    [confirmMutation, t]
  );

  const handleOpenReject = useCallback((invoice: ARInvoice) => {
    setRejectTarget(invoice);
    setRejectReason('');
  }, []);

  const handleCloseReject = useCallback(() => {
    setRejectTarget(null);
    setRejectReason('');
  }, []);

  const handleReject = useCallback(() => {
    if (!rejectTarget || !rejectReason.trim()) return;
    rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason.trim() });
  }, [rejectTarget, rejectReason, rejectMutation]);

  const handlePrint = useCallback(
    async (invoice: ARInvoice) => {
      try {
        const res = await fetch(`/api/accounting/ar-invoices/${invoice.id}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        const detail = json.data;
        const cust = customers.find((c) => c.id === detail.customerId);
        setPrintData({
          invoiceNumber: detail.invoiceNumber,
          taxInvoiceNumber: detail.taxInvoiceNumber,
          invoiceDate: detail.invoiceDate,
          dueDate: detail.dueDate,
          description: detail.description,
          subtotal: Number(detail.subtotal) || 0,
          vatAmount: Number(detail.vatAmount) || 0,
          totalAmount: Number(detail.totalAmount) || 0,
          paidAmount: Number(detail.paidAmount) || 0,
          lines: (detail.lines || []).map((l: any) => ({
            description: l.description || '',
            quantity: Number(l.quantity) || 0,
            unitPrice: Number(l.unitPrice) || 0,
            amount: Number(l.amount) || 0,
            vatAmount: l.vatAmount != null ? Number(l.vatAmount) : null,
          })),
          customer: cust
            ? {
                name: cust.name,
                taxId: cust.taxId,
                address: cust.address,
                contactPerson: cust.contactPerson,
              }
            : { name: invoice.customerName },
        });
        setPrinting(true);
        // Let React paint the hidden document before handing off to the browser.
        requestAnimationFrame(() => {
          window.print();
          setPrinting(false);
        });
      } catch (err: any) {
        notify(err.message || t('accountsReceivable.invoicesPage.toast.loadError'), 'error', 4000);
      }
    },
    [customers, t]
  );

  const handleView = useCallback(
    async (invoice: ARInvoice) => {
      try {
        const res = await fetch(`/api/accounting/ar-invoices/${invoice.id}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        const detail = json.data;
        setDetailInvoice({
          ...detail,
          subtotal: Number(detail.subtotal) || 0,
          vatAmount: Number(detail.vatAmount) || 0,
          totalAmount: Number(detail.totalAmount) || 0,
          paidAmount: Number(detail.paidAmount) || 0,
          lines: (detail.lines || []).map((l: any) => ({
            lineNumber: Number(l.lineNumber) || 0,
            description: l.description || '',
            itemId: l.itemId ?? null,
            glAccountId: l.glAccountId ?? null,
            quantity: Number(l.quantity) || 0,
            unitPrice: Number(l.unitPrice) || 0,
            amount: Number(l.amount) || 0,
            vatAmount: l.vatAmount != null ? Number(l.vatAmount) : null,
            lotId: l.lotId ?? null,
          })),
        });
        setDetailOpen(true);
      } catch (err: any) {
        notify(err.message || t('accountsReceivable.invoicesPage.toast.loadError'), 'error', 4000);
      }
    },
    [t]
  );

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false);
    setDetailInvoice(null);
  }, []);

  const handleEdit = useCallback(async (invoice: ARInvoice) => {
    try {
      const res = await fetch(`/api/accounting/ar-invoices/${invoice.id}`);
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
        customerId: detail.customerId || null,
        invoiceDate: detail.invoiceDate ? detail.invoiceDate.split('T')[0] : '',
        dueDate: detail.dueDate ? detail.dueDate.split('T')[0] : '',
        description: detail.description || '',
        vatRate: editVatRate,
        vatAmountOverride: editVatOverride,
        lines: editLines,
      });
      setEditingInvoiceId(invoice.id);
      setIsDialogOpen(true);
    } catch (err: any) {
      notify(err.message || t('accountsReceivable.invoicesPage.toast.loadError'), 'error', 4000);
    }
  }, [t]);

  const handleDelete = useCallback(
    async (invoice: ARInvoice) => {
      const result = await confirm(
        t('accountsReceivable.invoicesPage.confirmDelete.message', { invoiceNumber: invoice.invoiceNumber }),
        t('accountsReceivable.invoicesPage.confirmDelete.title')
      );
      if (result) {
        deleteMutation.mutate(invoice.id);
      }
    },
    [deleteMutation, t]
  );

  const handleOpenPaymentDialog = useCallback((invoice: ARInvoice) => {
    setSelectedInvoice(invoice);
    const outstanding = invoice.totalAmount - invoice.paidAmount;
    setPaymentFormData({
      paymentDate: new Date().toISOString().split('T')[0],
      bankAccountId: null,
      paymentMethod: 'transfer',
      referenceNumber: '',
      amount: outstanding,
      description: '',
    });
    setIsPaymentDialogOpen(true);
  }, []);

  const handleClosePaymentDialog = useCallback(() => {
    setIsPaymentDialogOpen(false);
    setSelectedInvoice(null);
  }, []);

  const handleReceivePayment = useCallback(() => {
    if (!selectedInvoice || !paymentFormData.bankAccountId) {
      notify(t('accountsReceivable.invoicesPage.toast.selectPaymentAccount'), 'warning', 3000);
      return;
    }

    if (paymentFormData.amount <= 0) {
      notify(t('accountsReceivable.invoicesPage.toast.amountMustBePositive'), 'warning', 3000);
      return;
    }

    paymentMutation.mutate({
      invoiceId: selectedInvoice.id,
      data: {
        paymentDate: paymentFormData.paymentDate,
        bankAccountId: paymentFormData.bankAccountId,
        paymentMethod: paymentFormData.paymentMethod,
        referenceNumber: paymentFormData.referenceNumber || undefined,
        amount: paymentFormData.amount,
        description: paymentFormData.description || undefined,
      },
    });
  }, [selectedInvoice, paymentFormData, paymentMutation, t]);

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

  const updateLine = useCallback((index: number, field: string, value: string | number | null) => {
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

  const vatAmount = useMemo(() => {
    if (formData.vatAmountOverride !== null) return formData.vatAmountOverride;
    return Math.round(lineTotal * (formData.vatRate / 100) * 100) / 100;
  }, [lineTotal, formData.vatRate, formData.vatAmountOverride]);

  // Status badge render using AccountingStatusBadge
  const statusCellRender = useCallback((cellData: { value: string }) => {
    const statusValue = cellData.value as 'draft' | 'posted' | 'partial' | 'paid' | 'cancelled' | 'confirmed' | 'rejected';
    // Map AR-specific statuses to badge statuses
    const statusMap: Record<string, 'draft' | 'posted' | 'partial' | 'paid' | 'cancelled' | 'confirmed' | 'rejected'> = {
      draft: 'draft',
      confirmed: 'confirmed',
      posted: 'posted',
      partial: 'partial',
      paid: 'paid',
      cancelled: 'cancelled',
      rejected: 'rejected',
    };
    const mappedStatus = statusMap[statusValue] || 'draft';
    return <AccountingStatusBadge status={mappedStatus} />;
  }, []);

  // Action buttons render
  const actionsCellRender = useCallback(
    (cellData: { data: ARInvoice }) => {
      const invoice = cellData.data;
      return (
        <div style={{ display: 'flex', gap: '4px' }}>
          <Button
            icon="find"
            hint={t('accountsReceivable.invoicesPage.detailDialog.view')}
            stylingMode="text"
            height={28}
            onClick={() => handleView(invoice)}
            elementAttr={{ 'data-testid': 'view-invoice-btn' }}
          />
          <Button
            icon="print"
            hint="พิมพ์ใบกำกับภาษี"
            stylingMode="text"
            height={28}
            onClick={() => handlePrint(invoice)}
            elementAttr={{ 'data-testid': 'print-invoice-btn' }}
          />
          {invoice.status === 'draft' && (
            <>
              <Button
                icon="edit"
                hint={t('accountsReceivable.invoicesPage.actions.edit')}
                stylingMode="text"
                height={28}
                onClick={() => handleEdit(invoice)}
              />
              <Button
                icon="trash"
                hint={t('accountsReceivable.invoicesPage.actions.delete')}
                stylingMode="text"
                height={28}
                onClick={() => handleDelete(invoice)}
              />
              <Button
                text={t('accountsReceivable.invoicesPage.actions.confirm')}
                type="success"
                stylingMode="outlined"
                height={24}
                onClick={() => handleConfirm(invoice)}
              />
              <Button
                text={t('accountsReceivable.invoicesPage.actions.reject')}
                type="danger"
                stylingMode="outlined"
                height={24}
                onClick={() => handleOpenReject(invoice)}
                elementAttr={{ 'data-testid': 'reject-invoice-btn' }}
              />
            </>
          )}
          {['posted', 'partial'].includes(invoice.status) && (
            <Button
              text={t('accountsReceivable.invoicesPage.actions.receivePayment')}
              type="default"
              stylingMode="outlined"
              height={24}
              onClick={() => handleOpenPaymentDialog(invoice)}
            />
          )}
        </div>
      );
    },
    [handleConfirm, handleOpenReject, handleEdit, handleDelete, handleOpenPaymentDialog, handlePrint, handleView, t]
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50" data-testid="ar-invoices-page">
      {/* Professional Header */}
      <AccountingPageHeader
        title={t('accountsReceivable.invoices.title')}
        subtitle={t('accountsReceivable.title')}
        icon="dollar-sign"
        onBack={() => window.location.href = '/accounting/ar'}
        breadcrumbs={[
          { label: t('accountsReceivable.title'), href: '/accounting/ar' },
          { label: t('accountsReceivable.invoices.title') },
        ]}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['ar-invoices'] })}
        actions={
          <Button
            text={t('accountsReceivable.invoicesPage.addInvoice')}
            icon="plus"
            type="success"
            onClick={handleOpenDialog}
            elementAttr={{ 'data-testid': 'ar-add-invoice-btn' }}
          />
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <AccountingKPICard
            label={t('accountsReceivable.invoicesPage.kpi.total')}
            value={stats.total.toLocaleString('th-TH')}
            subtitle={`฿${stats.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}
            icon="file-text"
            variant="info"
          />
          <AccountingKPICard
            label={t('accountsReceivable.invoicesPage.kpi.pending')}
            value={stats.pending.toLocaleString('th-TH')}
            subtitle={t('accountsReceivable.invoicesPage.kpi.pendingSubtitle')}
            icon="clock"
            variant="warning"
          />
          <AccountingKPICard
            label={t('accountsReceivable.invoicesPage.kpi.outstanding')}
            value={stats.outstanding.toLocaleString('th-TH')}
            subtitle={`฿${stats.outstandingAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}
            icon="dollar-sign"
            variant="danger"
          />
          <AccountingKPICard
            label={t('accountsReceivable.invoicesPage.kpi.paid')}
            value={stats.paid.toLocaleString('th-TH')}
            subtitle={t('accountsReceivable.invoicesPage.kpi.paidSubtitle')}
            icon="check-circle"
            variant="success"
          />
        </div>

        {/* Filter Panel */}
        <AccountingFilterPanel>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('accountsReceivable.invoicesPage.filters.statusLabel')}
              </label>
              <SelectBox
                dataSource={[
                  { value: '', label: t('accountsReceivable.invoicesPage.filters.all') },
                  { value: 'draft', label: t('accountsReceivable.invoicesPage.statusLabels.draft') },
                  { value: 'posted', label: t('accountsReceivable.invoicesPage.statusLabels.posted') },
                  { value: 'partial', label: t('accountsReceivable.invoicesPage.statusLabels.partial') },
                  { value: 'paid', label: t('accountsReceivable.invoicesPage.statusLabels.paid') },
                ]}
                displayExpr="label"
                valueExpr="value"
                value={statusFilter}
                onValueChanged={(e) => setStatusFilter(e.value)}
                placeholder={t('accountsReceivable.invoicesPage.filters.statusPlaceholder')}
                width={200}
              />
            </div>
          </div>
        </AccountingFilterPanel>

        {/* Data Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200" data-testid="ar-invoices-grid" data-build="ar-ap-export-20260727-v2">
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
          columnAutoWidth={true}
          wordWrapEnabled={true}
        >
          <Paging defaultPageSize={20} />
          <Pager
            visible={true}
            showPageSizeSelector={true}
            allowedPageSizes={[10, 20, 50]}
            showInfo={true}
          />
          <SearchPanel visible={true} placeholder={t('accountsReceivable.invoicesPage.searchPlaceholder')} />
          <Sorting mode="multiple" />

          {/* A labelled "ส่งออก Excel" button that actually writes the file
              (DevExtreme's built-in <Export> only shows a button; it produced no
              file here). Runs exportGridToExcel via the grid ref. */}
          <Toolbar>
            <Item name="searchPanel" location="before" />
            <Item location="after" widget="dxButton" options={{
              icon: 'xlsxfile',
              text: t('accountsReceivable.invoicesPage.exportExcel'),
              stylingMode: 'contained',
              type: 'success',
              onClick: handleExportExcel,
              elementAttr: { 'data-testid': 'ar-export-excel-btn' },
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
          <Column dataField="invoiceNumber" caption={t('accountsReceivable.invoices.table.columns.invoiceNumber')} width={150} />
          <Column dataField="taxInvoiceNumber" caption={t('accountsReceivable.invoicesPage.columns.taxInvoiceNumber')} width={160} />
          <Column dataField="customerId" caption={t('accountsReceivable.invoices.table.columns.customer')} width={150} visible={false} />
          <Column dataField="invoiceDate" caption={t('accountsReceivable.invoicesPage.columns.date')} dataType="date" width={110} />
          <Column dataField="dueDate" caption={t('accountsReceivable.invoices.table.columns.dueDate')} dataType="date" width={110} />
          <Column dataField="description" caption={t('accountsReceivable.invoicesPage.columns.description')} minWidth={150} />
          <Column
            dataField="totalAmount"
            caption={t('accountsReceivable.invoicesPage.columns.totalAmount')}
            dataType="number"
            width={120}
            alignment="right"
          >
            <Format type="fixedPoint" precision={2} />
          </Column>
          <Column
            dataField="paidAmount"
            caption={t('accountsReceivable.invoicesPage.columns.paidAmount')}
            dataType="number"
            width={120}
            alignment="right"
          >
            <Format type="fixedPoint" precision={2} />
          </Column>
          <Column
            dataField="status"
            caption={t('accountsReceivable.invoices.table.columns.status')}
            width={120}
            cellRender={statusCellRender}
          />
          {/* Pinned right: the fixed column widths plus the auto-sized
              description add up to more than the container, so an unfixed
              actions column was pushed outside the grid and rendered over the
              page background. Fixing it keeps the buttons reachable and inside
              the card at any width. */}
          <Column
            caption={t('accountsReceivable.invoicesPage.columns.actions')}
            width={200}
            fixed={true}
            fixedPosition="right"
            cellRender={actionsCellRender}
            allowFiltering={false}
            allowSorting={false}
          />

          <Summary>
            <TotalItem column="totalAmount" summaryType="sum" displayFormat={t('accountsReceivable.invoicesPage.summaryTotal')}>
              <Format type="fixedPoint" precision={2} />
            </TotalItem>
          </Summary>
        </DataGrid>
        </div>

        {/* Add Invoice Dialog */}
        <Popup
          visible={isDialogOpen}
          onHiding={handleCloseDialog}
          title={editingInvoiceId ? t('accountsReceivable.invoicesPage.dialog.editTitle') : t('accountsReceivable.invoicesPage.dialog.createTitle')}
          width={800}
          height="auto"
          showCloseButton={true}
          dragEnabled={true}
        >
          <div className="p-4" data-testid="ar-invoice-dialog">
            <Form formData={formData} labelLocation="top" showColonAfterLabel={true}>
            <GroupItem colCount={3}>
              <SimpleItem
                dataField="invoiceNumber"
                label={{ text: t('accountsReceivable.invoicesPage.form.invoiceNumber') }}
                editorOptions={{ placeholder: 'AR-YYYYMM-NNNNNN' }}
              >
                <RequiredRule message={t('accountsReceivable.invoicesPage.form.invoiceNumberRequired')} />
              </SimpleItem>
              <SimpleItem
                dataField="customerId"
                editorType="dxSelectBox"
                label={{ text: t('accountsReceivable.invoicesPage.form.customer') }}
                editorOptions={{
                  dataSource: customers,
                  displayExpr: 'name',
                  valueExpr: 'id',
                  searchEnabled: true,
                }}
              >
                <RequiredRule message={t('accountsReceivable.invoicesPage.form.customerRequired')} />
              </SimpleItem>
            </GroupItem>
            <GroupItem colCount={2}>
              <SimpleItem
                dataField="invoiceDate"
                editorType="dxDateBox"
                label={{ text: t('accountsReceivable.invoicesPage.form.invoiceDate') }}
                editorOptions={{ type: 'date', displayFormat: 'dd/MM/yyyy' }}
              >
                <RequiredRule message={t('accountsReceivable.invoicesPage.form.dateRequired')} />
              </SimpleItem>
              <SimpleItem
                dataField="dueDate"
                editorType="dxDateBox"
                label={{ text: t('accountsReceivable.invoicesPage.form.dueDate') }}
                editorOptions={{ type: 'date', displayFormat: 'dd/MM/yyyy' }}
              >
                <RequiredRule message={t('accountsReceivable.invoicesPage.form.dueDateRequired')} />
              </SimpleItem>
            </GroupItem>
            <SimpleItem
              dataField="description"
              editorType="dxTextArea"
              label={{ text: t('accountsReceivable.invoicesPage.form.description') }}
              editorOptions={{ height: 60 }}
            />
            </Form>

            {/* Line Items */}
            <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">{t('accountsReceivable.invoicesPage.lineItems.title')}</h3>
              <Button text={t('accountsReceivable.invoicesPage.lineItems.addLine')} icon="plus" type="default" onClick={addLine} />
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">{t('accountsReceivable.invoicesPage.lineItems.description')}</th>
                  <th className="border p-2 text-left" style={{ width: 200 }}>
                    {t('accountsReceivable.invoicesPage.lineItems.revenueAccount')}
                  </th>
                  <th className="border p-2 text-right" style={{ width: 80 }}>
                    {t('accountsReceivable.invoicesPage.lineItems.quantity')}
                  </th>
                  <th className="border p-2 text-right" style={{ width: 120 }}>
                    {t('accountsReceivable.invoicesPage.lineItems.unitPrice')}
                  </th>
                  <th className="border p-2 text-right" style={{ width: 120 }}>
                    {t('accountsReceivable.invoicesPage.lineItems.lineTotal')}
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
                        placeholder={t('accountsReceivable.invoicesPage.lineItems.description')}
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
                        <option value="">{t('accountsReceivable.invoicesPage.lineItems.selectAccount')}</option>
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
                  <td colSpan={4} className="border p-2 text-right font-semibold">
                    {t('accountsReceivable.invoicesPage.lineItems.subtotalBeforeVat')}
                  </td>
                  <td className="border p-2 text-right font-semibold">
                    {lineTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
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
                    {t('accountsReceivable.invoicesPage.lineItems.grandTotal')}
                  </td>
                  <td className="border p-2 text-right font-bold text-lg">
                    {(lineTotal + vatAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="border"></td>
                </tr>
              </tfoot>
            </table>
            </div>

            {/* Dialog Actions */}
            <div className="mt-6 flex justify-end gap-2">
              <Button text={t('accountsReceivable.invoicesPage.dialog.cancel')} type="normal" stylingMode="outlined" onClick={handleCloseDialog} elementAttr={{ 'data-testid': 'ar-cancel-btn' }} />
              <Button
                text={editingInvoiceId ? t('accountsReceivable.invoicesPage.dialog.saveEdit') : t('accountsReceivable.invoicesPage.dialog.save')}
                type="success"
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                elementAttr={{ 'data-testid': 'ar-save-btn' }}
              />
            </div>
          </div>
        </Popup>

        {/* Payment Dialog */}
        <Popup
          visible={isPaymentDialogOpen}
          onHiding={handleClosePaymentDialog}
          title={t('accountsReceivable.invoicesPage.paymentDialog.title', { invoiceNumber: selectedInvoice?.invoiceNumber || '' })}
          width={500}
          height="auto"
          showCloseButton={true}
          dragEnabled={true}
        >
          <div className="p-4">
            {selectedInvoice && (
              <>
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>{t('accountsReceivable.invoicesPage.paymentDialog.taxInvoiceNumber')}:</div>
                    <div className="font-semibold">{selectedInvoice.taxInvoiceNumber}</div>
                    <div>{t('accountsReceivable.invoicesPage.paymentDialog.totalAmount')}:</div>
                    <div className="font-semibold">
                      {selectedInvoice.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} {t('accountsReceivable.invoicesPage.paymentDialog.baht')}
                    </div>
                    <div>{t('accountsReceivable.invoicesPage.paymentDialog.received')}:</div>
                    <div className="font-semibold">
                      {selectedInvoice.paidAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} {t('accountsReceivable.invoicesPage.paymentDialog.baht')}
                    </div>
                    <div>{t('accountsReceivable.invoicesPage.paymentDialog.outstanding')}:</div>
                    <div className="font-bold text-orange-600">
                      {(selectedInvoice.totalAmount - selectedInvoice.paidAmount).toLocaleString('th-TH', {
                        minimumFractionDigits: 2,
                      })}{' '}
                      {t('accountsReceivable.invoicesPage.paymentDialog.baht')}
                    </div>
                  </div>
                </div>

                <Form formData={paymentFormData} labelLocation="top" showColonAfterLabel={true}>
                  <SimpleItem
                    dataField="paymentDate"
                    editorType="dxDateBox"
                    label={{ text: t('accountsReceivable.invoicesPage.paymentDialog.paymentDate') }}
                    editorOptions={{ type: 'date', displayFormat: 'dd/MM/yyyy' }}
                  >
                    <RequiredRule message={t('accountsReceivable.invoicesPage.form.dateRequired')} />
                  </SimpleItem>
                  <SimpleItem
                    dataField="bankAccountId"
                    editorType="dxSelectBox"
                    label={{ text: t('accountsReceivable.invoicesPage.paymentDialog.bankAccount') }}
                    editorOptions={{
                      dataSource: bankAccounts,
                      displayExpr: (item: BankAccount) => item ? `${item.code} - ${item.nameTh}` : '',
                      valueExpr: 'id',
                      searchEnabled: true,
                    }}
                  >
                    <RequiredRule message={t('accountsReceivable.invoicesPage.paymentDialog.bankAccountRequired')} />
                  </SimpleItem>
                  <SimpleItem
                    dataField="paymentMethod"
                    editorType="dxSelectBox"
                    label={{ text: t('accountsReceivable.invoicesPage.paymentDialog.paymentMethod') }}
                    editorOptions={{
                      dataSource: [
                        { value: 'transfer', label: t('accountsReceivable.paymentMethods.transfer') },
                        { value: 'cash', label: t('accountsReceivable.paymentMethods.cash') },
                        { value: 'check', label: t('accountsReceivable.paymentMethods.check') },
                        { value: 'other', label: t('accountsReceivable.paymentMethods.other') },
                      ],
                      displayExpr: 'label',
                      valueExpr: 'value',
                    }}
                  />
                  <SimpleItem
                    dataField="referenceNumber"
                    label={{ text: t('accountsReceivable.invoicesPage.paymentDialog.referenceNumber') }}
                    editorOptions={{ placeholder: t('accountsReceivable.invoicesPage.paymentDialog.referencePlaceholder') }}
                  />
                  <SimpleItem
                    dataField="amount"
                    editorType="dxNumberBox"
                    label={{ text: t('accountsReceivable.invoicesPage.paymentDialog.amountBaht') }}
                    editorOptions={{
                      format: '#,##0.00',
                      min: 0.01,
                      max: selectedInvoice.totalAmount - selectedInvoice.paidAmount,
                    }}
                  >
                    <RequiredRule message={t('accountsReceivable.invoicesPage.paymentDialog.amountRequired')} />
                  </SimpleItem>
                  <SimpleItem
                    dataField="description"
                    editorType="dxTextArea"
                    label={{ text: t('accountsReceivable.invoicesPage.paymentDialog.note') }}
                    editorOptions={{ height: 60 }}
                  />
                </Form>

                <div className="mt-6 flex justify-end gap-2">
                  <Button text={t('accountsReceivable.invoicesPage.dialog.cancel')} type="normal" stylingMode="outlined" onClick={handleClosePaymentDialog} />
                  <Button
                    text={t('accountsReceivable.invoicesPage.actions.receivePayment')}
                    type="success"
                    onClick={handleReceivePayment}
                    disabled={paymentMutation.isPending}
                  />
                </div>
              </>
            )}
          </div>
        </Popup>

        {/* Detail (read-only) Dialog */}
        <Popup
          visible={detailOpen}
          onHiding={handleCloseDetail}
          title={t('accountsReceivable.invoicesPage.detailDialog.title')}
          width={820}
          height="auto"
          showCloseButton={true}
          dragEnabled={true}
        >
          <div className="p-4" data-testid="ar-invoice-detail-dialog">
            {detailInvoice && (
              <>
                {/* Header block */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">{t('accountsReceivable.invoicesPage.detailDialog.invoiceNumber')}</span>
                    <span className="font-semibold">{detailInvoice.invoiceNumber || '-'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">{t('accountsReceivable.invoicesPage.detailDialog.taxInvoiceNumber')}</span>
                    <span className="font-semibold">{detailInvoice.taxInvoiceNumber || '-'}</span>
                  </div>
                  <div className="flex justify-between gap-2 items-center">
                    <span className="text-gray-500">{t('accountsReceivable.invoicesPage.detailDialog.status')}</span>
                    {statusCellRender({ value: detailInvoice.status })}
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">{t('accountsReceivable.invoicesPage.detailDialog.customer')}</span>
                    <span className="font-semibold">
                      {customers.find((c) => c.id === detailInvoice.customerId)?.name ||
                        detailInvoice.customerName ||
                        '-'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">{t('accountsReceivable.invoicesPage.detailDialog.invoiceDate')}</span>
                    <span className="font-semibold">
                      {detailInvoice.invoiceDate ? String(detailInvoice.invoiceDate).split('T')[0] : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">{t('accountsReceivable.invoicesPage.detailDialog.dueDate')}</span>
                    <span className="font-semibold">
                      {detailInvoice.dueDate ? String(detailInvoice.dueDate).split('T')[0] : '-'}
                    </span>
                  </div>
                  {detailInvoice.salesOrderId != null && (
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500">{t('accountsReceivable.invoicesPage.detailDialog.salesOrder')}</span>
                      <span className="font-semibold">#{detailInvoice.salesOrderId}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2 md:col-span-2">
                    <span className="text-gray-500">{t('accountsReceivable.invoicesPage.detailDialog.description')}</span>
                    <span className="font-semibold text-right">{detailInvoice.description || '-'}</span>
                  </div>
                  {detailInvoice.status === 'rejected' && detailInvoice.rejectionReason && (
                    <div
                      className="flex justify-between gap-2 md:col-span-2"
                      data-testid="ar-detail-rejection-reason"
                    >
                      <span className="text-red-500">
                        {t('accountsReceivable.invoicesPage.detailDialog.rejectionReason')}
                      </span>
                      <span className="font-semibold text-right text-red-600">
                        {detailInvoice.rejectionReason}
                      </span>
                    </div>
                  )}
                </div>

                {/* Line items table */}
                <h3 className="font-semibold mb-2">
                  {t('accountsReceivable.invoicesPage.detailDialog.lineItemsTitle')}
                </h3>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-2 text-center" style={{ width: 50 }}>
                          {t('accountsReceivable.invoicesPage.detailDialog.lineNumber')}
                        </th>
                        <th className="p-2 text-left">
                          {t('accountsReceivable.invoicesPage.detailDialog.colDescription')}
                        </th>
                        <th className="p-2 text-right" style={{ width: 90 }}>
                          {t('accountsReceivable.invoicesPage.detailDialog.colQuantity')}
                        </th>
                        <th className="p-2 text-right" style={{ width: 120 }}>
                          {t('accountsReceivable.invoicesPage.detailDialog.colUnitPrice')}
                        </th>
                        <th className="p-2 text-right" style={{ width: 120 }}>
                          {t('accountsReceivable.invoicesPage.detailDialog.colAmount')}
                        </th>
                        <th className="p-2 text-right" style={{ width: 100 }}>
                          {t('accountsReceivable.invoicesPage.detailDialog.colVat')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailInvoice.lines.map((line, index) => (
                        <tr key={index} className="border-t border-gray-100">
                          <td className="p-2 text-center text-gray-500">
                            {line.lineNumber || index + 1}
                          </td>
                          <td className="p-2 text-left">{line.description || '-'}</td>
                          <td className="p-2 text-right">{formatNumber(line.quantity)}</td>
                          <td className="p-2 text-right">{formatNumber(line.unitPrice)}</td>
                          <td className="p-2 text-right">{formatNumber(line.amount)}</td>
                          <td className="p-2 text-right">
                            {line.vatAmount != null ? formatNumber(line.vatAmount) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals block */}
                <div className="mt-4 flex justify-end">
                  <div className="w-full md:w-1/2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('accountsReceivable.invoicesPage.detailDialog.subtotal')}</span>
                      <span className="font-semibold">{formatNumber(detailInvoice.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('accountsReceivable.invoicesPage.detailDialog.vatAmount')}</span>
                      <span className="font-semibold">{formatNumber(detailInvoice.vatAmount)}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-1 text-base">
                      <span className="font-bold">{t('accountsReceivable.invoicesPage.detailDialog.totalAmount')}</span>
                      <span className="font-bold">{formatNumber(detailInvoice.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('accountsReceivable.invoicesPage.detailDialog.paidAmount')}</span>
                      <span className="font-semibold">{formatNumber(detailInvoice.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('accountsReceivable.invoicesPage.detailDialog.outstanding')}</span>
                      <span className="font-bold text-orange-600">
                        {formatNumber(detailInvoice.totalAmount - detailInvoice.paidAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Detail Actions */}
                <div className="mt-6 flex justify-end gap-2">
                  <Button
                    text={t('accountsReceivable.invoicesPage.detailDialog.print')}
                    icon="print"
                    type="default"
                    stylingMode="outlined"
                    onClick={() => handlePrint(detailInvoice)}
                    elementAttr={{ 'data-testid': 'ar-detail-print-btn' }}
                  />
                  <Button
                    text={t('accountsReceivable.invoicesPage.detailDialog.close')}
                    type="normal"
                    stylingMode="outlined"
                    onClick={handleCloseDetail}
                    elementAttr={{ 'data-testid': 'ar-detail-close-btn' }}
                  />
                </div>
              </>
            )}
          </div>
        </Popup>

        {/* Reject Dialog */}
        <Popup
          visible={rejectTarget !== null}
          onHiding={handleCloseReject}
          title={t('accountsReceivable.invoicesPage.rejectDialog.title')}
          width={480}
          height="auto"
          showCloseButton={true}
          dragEnabled={true}
        >
          <div className="p-4" data-testid="ar-reject-dialog">
            {rejectTarget && (
              <>
                <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-gray-500">
                      {t('accountsReceivable.invoicesPage.detailDialog.invoiceNumber')}
                    </div>
                    <div className="font-semibold">{rejectTarget.invoiceNumber}</div>
                    <div className="text-gray-500">
                      {t('accountsReceivable.invoicesPage.detailDialog.taxInvoiceNumber')}
                    </div>
                    <div className="font-semibold">{rejectTarget.taxInvoiceNumber}</div>
                  </div>
                </div>

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('accountsReceivable.invoicesPage.rejectDialog.reasonLabel')}
                </label>
                <TextArea
                  value={rejectReason}
                  onValueChanged={(e) => setRejectReason(e.value ?? '')}
                  height={90}
                  placeholder={t('accountsReceivable.invoicesPage.rejectDialog.reasonPlaceholder')}
                  elementAttr={{ 'data-testid': 'ar-reject-reason' }}
                />

                <div className="mt-6 flex justify-end gap-2">
                  <Button
                    text={t('accountsReceivable.invoicesPage.rejectDialog.cancel')}
                    type="normal"
                    stylingMode="outlined"
                    onClick={handleCloseReject}
                    elementAttr={{ 'data-testid': 'ar-reject-cancel' }}
                  />
                  <Button
                    text={t('accountsReceivable.invoicesPage.rejectDialog.confirm')}
                    type="danger"
                    onClick={handleReject}
                    disabled={!rejectReason.trim() || rejectMutation.isPending}
                    elementAttr={{ 'data-testid': 'ar-reject-confirm' }}
                  />
                </div>
              </>
            )}
          </div>
        </Popup>
      </div>

      {/* Hidden on screen; the global @media print rules reveal .print-only. */}
      {printing && printData && <ARInvoicePrintDocument invoice={printData} />}
    </div>
  );
}

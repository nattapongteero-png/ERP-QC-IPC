'use client';

/**
 * AR Receipts Page
 * Feature: 010-accounting-module-integration
 * Track and manage customer payment receipts
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toLocalDateStr } from '@/lib/utils/date-format';
import DataGrid, {
  Column,
  Paging,
  SearchPanel,
  Summary,
  TotalItem,
  Toolbar,
  Item as ToolbarItem,
} from 'devextreme-react/data-grid';
import { Popup } from 'devextreme-react/popup';
import Form, { SimpleItem, GroupItem, RequiredRule } from 'devextreme-react/form';
import { DateBox } from 'devextreme-react/date-box';
import { SelectBox } from 'devextreme-react/select-box';
import { Button } from 'devextreme-react/button';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';
import {
  Banknote,
  CreditCard,
  Building2,
  Calendar,
} from 'lucide-react';
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingKPICardSkeleton,
  AccountingFilterPanel,
  AccountingStatusBadge,
} from '@/components/accounting';

interface Receipt {
  id: number;
  receiptNumber: string;
  customerId: number;
  customerName?: string;
  receiptDate: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'cheque' | 'credit_card';
  amount: number;
  currency: string;
  reference: string | null;
  description: string | null;
  bankAccountId: number | null;
  bankAccountName?: string;
  chequeNumber: string | null;
  chequeDate: string | null;
  status: 'pending' | 'cleared' | 'bounced' | 'cancelled';
  invoiceAllocations?: Array<{
    invoiceId: number;
    invoiceNumber: string;
    allocatedAmount: number;
  }>;
  createdAt: string;
}

interface ReceiptSummary {
  totalReceipts: number;
  totalAmount: number;
  pendingAmount: number;
  clearedAmount: number;
  receiptsByMethod: Record<string, { count: number; amount: number }>;
}

type TFn = (key: string, values?: Record<string, string | number | Date>) => string;

function buildPaymentMethodOptions(t: TFn) {
  return [
    { value: '', text: t('accountsReceivable.receiptsPage.methodFilter.all') },
    { value: 'cash', text: t('accountsReceivable.paymentMethods.cash') },
    { value: 'bank_transfer', text: t('accountsReceivable.paymentMethods.bankTransfer') },
    { value: 'cheque', text: t('accountsReceivable.paymentMethods.cheque') },
    { value: 'credit_card', text: t('accountsReceivable.paymentMethods.creditCard') },
  ];
}

interface ARInvoice {
  id: number;
  invoiceNumber: string;
  customerId: number;
  customerName?: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
}

interface GLAccount {
  id: number;
  code: string;
  nameTh: string;
}

interface ReceiptFormData {
  arInvoiceId: number | null;
  paymentDate: string;
  bankAccountId: number | null;
  paymentMethod: 'cash' | 'check' | 'transfer' | 'other';
  referenceNumber: string;
  amount: number;
  description: string;
}

function buildStatusOptions(t: TFn) {
  return [
    { value: '', text: t('accountsReceivable.receiptsPage.statusFilter.all') },
    { value: 'pending', text: t('accountsReceivable.receiptsPage.statusFilter.pending') },
    { value: 'cleared', text: t('accountsReceivable.receiptsPage.statusFilter.cleared') },
    { value: 'bounced', text: t('accountsReceivable.receiptsPage.statusFilter.bounced') },
    { value: 'cancelled', text: t('accountsReceivable.receiptsPage.statusFilter.cancelled') },
  ];
}

async function fetchReceipts(params: {
  paymentMethod?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  customerId?: number;
}): Promise<Receipt[]> {
  const searchParams = new URLSearchParams();
  searchParams.set('paymentType', 'ar');

  if (params.paymentMethod) searchParams.set('paymentMethod', params.paymentMethod);
  if (params.status) searchParams.set('status', params.status);
  if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
  if (params.dateTo) searchParams.set('dateTo', params.dateTo);
  if (params.customerId) searchParams.set('customerId', String(params.customerId));

  const res = await fetch(`/api/accounting/payments?${searchParams.toString()}`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch receipts');
  }
  const json = await res.json();
  const items: any[] = json.data || [];
  // Map API payment fields → Receipt interface fields
  return items.map((p) => ({
    id: p.id,
    receiptNumber: p.paymentNumber,
    customerId: p.customerId,
    customerName: p.customerName,
    receiptDate: p.paymentDate,
    paymentMethod: p.paymentMethod,
    amount: Number(p.amount),
    currency: 'THB',
    reference: p.referenceNumber,
    description: p.description,
    bankAccountId: p.bankAccountId,
    bankAccountName: p.bankAccountName,
    chequeNumber: null,
    chequeDate: null,
    status: p.status,
    createdAt: '',
  }));
}

async function fetchARInvoicesPayable(): Promise<ARInvoice[]> {
  const res = await fetch('/api/accounting/ar-invoices?status=posted&status=partial');
  if (!res.ok) return [];
  const json = await res.json();
  return json.data || [];
}

async function fetchBankAccounts(): Promise<GLAccount[]> {
  const res = await fetch('/api/accounting/gl-accounts?isActive=true&accountType=asset');
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data || []).filter((acc: GLAccount) => acc.code.startsWith('11'));
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
): Promise<{ payment: { paymentNumber: string } }> {
  const res = await fetch(`/api/accounting/ar-invoices/${invoiceId}/receive-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to record receipt');
  }
  return (await res.json()).data;
}

async function fetchReceiptSummary(): Promise<ReceiptSummary> {
  const res = await fetch('/api/accounting/payments?paymentType=receipt&summary=true');
  if (!res.ok) {
    return {
      totalReceipts: 0,
      totalAmount: 0,
      pendingAmount: 0,
      clearedAmount: 0,
      receiptsByMethod: {},
    };
  }
  const data = await res.json();
  return data.data || {
    totalReceipts: 0,
    totalAmount: 0,
    pendingAmount: 0,
    clearedAmount: 0,
    receiptsByMethod: {},
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getPaymentMethodLabel(method: string, t: TFn): string {
  const labels: Record<string, string> = {
    cash: t('accountsReceivable.paymentMethods.cash'),
    bank_transfer: t('accountsReceivable.paymentMethods.bankTransfer'),
    cheque: t('accountsReceivable.paymentMethods.cheque'),
    credit_card: t('accountsReceivable.paymentMethods.creditCard'),
  };
  return labels[method] || method;
}

export default function ARReceiptsPage() {
  const t = useTranslations('accounting');
  const queryClient = useQueryClient();
  const paymentMethodOptions = useMemo(() => buildPaymentMethodOptions(t), [t]);
  const statusOptions = useMemo(() => buildStatusOptions(t), [t]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReceiptId, setEditingReceiptId] = useState<number | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<ARInvoice | null>(null);
  const [formData, setFormData] = useState<ReceiptFormData>({
    arInvoiceId: null,
    paymentDate: toLocalDateStr(new Date()),
    bankAccountId: null,
    paymentMethod: 'transfer',
    referenceNumber: '',
    amount: 0,
    description: '',
  });

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ['ar-receipts', paymentMethod, status, dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: () => fetchReceipts({
      paymentMethod: paymentMethod || undefined,
      status: status || undefined,
      dateFrom: dateFrom ? toLocalDateStr(dateFrom) : undefined,
      dateTo: dateTo ? toLocalDateStr(dateTo) : undefined,
    }),
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['ar-receipts-summary'],
    queryFn: fetchReceiptSummary,
  });

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['ar-receipts'] });
    queryClient.invalidateQueries({ queryKey: ['ar-receipts-summary'] });
  }, [queryClient]);

  const { data: arInvoices = [] } = useQuery({
    queryKey: ['ar-invoices-payable'],
    queryFn: fetchARInvoicesPayable,
    enabled: isDialogOpen,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: fetchBankAccounts,
    enabled: isDialogOpen,
  });

  const receiptMutation = useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: number; data: Parameters<typeof receivePayment>[1] }) =>
      receivePayment(invoiceId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['ar-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['ar-receipts-summary'] });
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      notify(t('accountsReceivable.receiptsPage.toast.recordSuccess', { receiptNumber: result.payment.paymentNumber }), 'success', 3000);
      setIsDialogOpen(false);
      setSelectedInvoice(null);
      resetReceiptForm();
    },
    onError: (error: Error) => {
      notify(error.message || t('accountsReceivable.receiptsPage.toast.recordError'), 'error', 4000);
    },
  });

  const resetReceiptForm = useCallback(() => {
    setFormData({
      arInvoiceId: null,
      paymentDate: toLocalDateStr(new Date()),
      bankAccountId: null,
      paymentMethod: 'transfer',
      referenceNumber: '',
      amount: 0,
      description: '',
    });
    setSelectedInvoice(null);
  }, []);

  const handleOpenReceiptDialog = useCallback(() => {
    resetReceiptForm();
    setEditingReceiptId(null);
    setIsDialogOpen(true);
  }, [resetReceiptForm]);

  const handleCloseReceiptDialog = useCallback(() => {
    setIsDialogOpen(false);
    setEditingReceiptId(null);
    setEditingReceipt(null);
    resetReceiptForm();
  }, [resetReceiptForm]);

  const handleInvoiceChange = useCallback((invoiceId: number | null) => {
    const invoice = arInvoices.find((inv) => inv.id === invoiceId);
    setSelectedInvoice(invoice || null);
    if (invoice) {
      const outstanding = invoice.totalAmount - invoice.paidAmount;
      setFormData((prev) => ({
        ...prev,
        arInvoiceId: invoiceId,
        amount: outstanding,
        description: `Receipt for ${invoice.invoiceNumber}`,
      }));
    } else {
      setFormData((prev) => ({ ...prev, arInvoiceId: null, amount: 0, description: '' }));
    }
  }, [arInvoices]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/accounting/payments/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to delete receipt');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['ar-receipts-summary'] });
      notify(t('accountsReceivable.receiptsPage.toast.deleteSuccess'), 'success', 3000);
    },
    onError: (error: Error) => {
      notify(error.message || t('accountsReceivable.receiptsPage.toast.deleteError'), 'error', 4000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/accounting/payments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update receipt');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['ar-receipts-summary'] });
      notify(t('accountsReceivable.receiptsPage.toast.updateSuccess'), 'success', 3000);
      setIsDialogOpen(false);
      setEditingReceiptId(null);
      resetReceiptForm();
    },
    onError: (error: Error) => {
      notify(error.message || t('accountsReceivable.receiptsPage.toast.updateError'), 'error', 4000);
    },
  });

  const handleDelete = useCallback(
    async (receipt: Receipt) => {
      const result = await confirm(
        t('accountsReceivable.receiptsPage.confirmDelete.message', { receiptNumber: receipt.receiptNumber || receipt.id }),
        t('accountsReceivable.receiptsPage.confirmDelete.title')
      );
      if (result) {
        deleteMutation.mutate(receipt.id);
      }
    },
    [deleteMutation, t]
  );

  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);

  const handleEdit = useCallback((receipt: Receipt) => {
    setFormData({
      arInvoiceId: null,
      paymentDate: receipt.receiptDate ? receipt.receiptDate.split('T')[0] : '',
      bankAccountId: receipt.bankAccountId,
      paymentMethod: (receipt.paymentMethod === 'bank_transfer' ? 'transfer' : receipt.paymentMethod) as ReceiptFormData['paymentMethod'],
      referenceNumber: receipt.reference || '',
      amount: receipt.amount,
      description: receipt.description || '',
    });
    setEditingReceipt(receipt);
    setEditingReceiptId(receipt.id);
    setIsDialogOpen(true);
  }, []);

  const handleRecordReceipt = useCallback(() => {
    if (editingReceiptId) {
      updateMutation.mutate({
        id: editingReceiptId,
        data: {
          paymentDate: formData.paymentDate,
          paymentMethod: formData.paymentMethod,
          bankAccountId: formData.bankAccountId,
          referenceNumber: formData.referenceNumber || null,
          description: formData.description || null,
        },
      });
      return;
    }

    if (!formData.arInvoiceId || !formData.bankAccountId) {
      notify(t('accountsReceivable.receiptsPage.toast.selectInvoiceAndAccount'), 'warning', 3000);
      return;
    }
    if (formData.amount <= 0) {
      notify(t('accountsReceivable.receiptsPage.toast.amountMustBePositive'), 'warning', 3000);
      return;
    }
    receiptMutation.mutate({
      invoiceId: formData.arInvoiceId,
      data: {
        paymentDate: formData.paymentDate,
        bankAccountId: formData.bankAccountId,
        paymentMethod: formData.paymentMethod,
        referenceNumber: formData.referenceNumber || undefined,
        amount: formData.amount,
        description: formData.description || undefined,
      },
    });
  }, [formData, receiptMutation, updateMutation, editingReceiptId, t]);

  const handleExportJSON = useCallback(() => {
    if (!receipts || receipts.length === 0) return;
    const blob = new Blob([JSON.stringify(receipts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ar-receipts-${toLocalDateStr(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify(t('accountsReceivable.receiptsPage.toast.exportSuccess'), 'success', 3000);
  }, [receipts, t]);

  const statusCellRender = useCallback((cellData: { value: string }) => {
    return <AccountingStatusBadge status={cellData.value as 'pending' | 'cleared' | 'bounced' | 'cancelled'} />;
  }, []);

  const paymentMethodCellRender = useCallback((cellData: { value: string }) => {
    const icons: Record<string, React.ReactNode> = {
      cash: <Banknote className="h-4 w-4 text-green-600" />,
      bank_transfer: <Building2 className="h-4 w-4 text-blue-600" />,
      cheque: <CreditCard className="h-4 w-4 text-purple-600" />,
      credit_card: <CreditCard className="h-4 w-4 text-orange-600" />,
    };

    return (
      <div className="flex items-center gap-2">
        {icons[cellData.value]}
        <span>{getPaymentMethodLabel(cellData.value, t)}</span>
      </div>
    );
  }, [t]);

  // Add row sequence numbers for the grid
  const receiptsWithRowNumber = useMemo(
    () => receipts.map((item, index) => ({ ...item, _rowNumber: index + 1 })),
    [receipts]
  );

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <AccountingPageHeader
        title={t('accountsReceivable.receipts.title')}
        subtitle={t('accountsReceivable.description')}
        icon="file-text"
        onBack={() => window.location.href = '/accounting/ar'}
        breadcrumbs={[
          { label: t('accountsReceivable.title'), href: '/accounting/ar' },
          { label: t('accountsReceivable.receipts.title') },
        ]}
        onRefresh={handleRefresh}
        actions={
          <Button
            text={t('accountsReceivable.receiptsPage.recordReceipt')}
            icon="plus"
            type="success"
            onClick={handleOpenReceiptDialog}
          />
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryLoading ? (
            <>
              <AccountingKPICardSkeleton />
              <AccountingKPICardSkeleton />
              <AccountingKPICardSkeleton />
              <AccountingKPICardSkeleton />
            </>
          ) : (
            <>
              <AccountingKPICard
                label={t('accountsReceivable.receiptsPage.kpi.totalReceipts')}
                value={summary?.totalReceipts || 0}
                subtitle={t('accountsReceivable.receiptsPage.kpi.totalReceiptsSubtitle')}
                icon="file-text"
                variant="info"
              />
              <AccountingKPICard
                label={t('accountsReceivable.receiptsPage.kpi.totalAmount')}
                value={formatCurrency(summary?.totalAmount || 0)}
                subtitle={t('accountsReceivable.receiptsPage.kpi.totalAmountSubtitle')}
                icon="trending-up"
                variant="success"
              />
              <AccountingKPICard
                label={t('accountsReceivable.receiptsPage.kpi.cleared')}
                value={formatCurrency(summary?.clearedAmount || 0)}
                subtitle={t('accountsReceivable.receiptsPage.kpi.clearedSubtitle')}
                icon="check-circle"
                variant="success"
              />
              <AccountingKPICard
                label={t('accountsReceivable.receiptsPage.kpi.pending')}
                value={formatCurrency(summary?.pendingAmount || 0)}
                subtitle={t('accountsReceivable.receiptsPage.kpi.pendingSubtitle')}
                icon="clock"
                variant="warning"
              />
            </>
          )}
        </div>

        {/* Filters */}
        <AccountingFilterPanel>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              {t('accountsReceivable.receiptsPage.filters.paymentMethod')}
            </label>
            <SelectBox
              items={paymentMethodOptions}
              value={paymentMethod}
              onValueChanged={(e) => setPaymentMethod(e.value)}
              valueExpr="value"
              displayExpr="text"
              width={180}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{t('accountsReceivable.receiptsPage.filters.status')}</label>
            <SelectBox
              items={statusOptions}
              value={status}
              onValueChanged={(e) => setStatus(e.value)}
              valueExpr="value"
              displayExpr="text"
              width={150}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t('accountsReceivable.receiptsPage.filters.dateFrom')}
            </label>
            <DateBox
              value={dateFrom}
              onValueChanged={(e) => setDateFrom(e.value)}
              type="date"
              displayFormat="dd/MM/yyyy"
              width={150}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{t('accountsReceivable.receiptsPage.filters.dateTo')}</label>
            <DateBox
              value={dateTo}
              onValueChanged={(e) => setDateTo(e.value)}
              type="date"
              displayFormat="dd/MM/yyyy"
              width={150}
            />
          </div>
          <div className="flex gap-2 items-end">
            <Button
              text={t('common.clearFilters')}
              stylingMode="outlined"
              onClick={() => {
                setPaymentMethod('');
                setStatus('');
                setDateFrom(null);
                setDateTo(null);
              }}
            />
            {receipts.length > 0 && (
              <Button
                text={t('accountsReceivable.receiptsPage.export')}
                icon="export"
                stylingMode="outlined"
                onClick={handleExportJSON}
              />
            )}
          </div>
        </AccountingFilterPanel>

        {/* Data Grid */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-green-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <Banknote className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('accountsReceivable.receiptsPage.grid.title')}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('accountsReceivable.receiptsPage.grid.found', { count: receipts.length })}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-green-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">{t('accountsReceivable.receiptsPage.grid.loading')}</p>
              </div>
            ) : (
              <DataGrid
                dataSource={receiptsWithRowNumber}
                keyExpr="id"
                showBorders={false}
                showRowLines
                showColumnLines={false}
                rowAlternationEnabled
                allowColumnReordering
                allowColumnResizing
                columnAutoWidth
                hoverStateEnabled
              >
                <Paging defaultPageSize={20} />
                <SearchPanel visible placeholder={t('accountsReceivable.receiptsPage.grid.searchPlaceholder')} />

                <Toolbar>
                  <ToolbarItem name="searchPanel" location="before" />
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
                <Column dataField="receiptNumber" caption={t('accountsReceivable.receipts.table.columns.receiptNumber')} width={150} />
                <Column
                  dataField="receiptDate"
                  caption={t('accountsReceivable.receipts.table.columns.date')}
                  dataType="date"
                  width={120}
                  cellRender={(data) => formatDate(data.value)}
                />
                <Column dataField="customerName" caption={t('accountsReceivable.receipts.table.columns.customer')} minWidth={200} />
                <Column
                  dataField="paymentMethod"
                  caption={t('accountsReceivable.receiptsPage.columns.method')}
                  width={150}
                  cellRender={paymentMethodCellRender}
                />
                <Column
                  dataField="amount"
                  caption={t('accountsReceivable.receipts.table.columns.amount')}
                  dataType="number"
                  format="#,##0.00"
                  width={130}
                  alignment="right"
                />
                <Column dataField="reference" caption={t('accountsReceivable.receiptsPage.columns.reference')} width={150} />
                <Column dataField="bankAccountName" caption={t('accountsReceivable.receiptsPage.columns.bankAccount')} width={150} />
                <Column
                  dataField="status"
                  caption={t('accountsReceivable.receiptsPage.columns.status')}
                  width={120}
                  cellRender={statusCellRender}
                />
                <Column
                  caption={t('accountsReceivable.receiptsPage.columns.actions')}
                  width={120}
                  allowFiltering={false}
                  allowSorting={false}
                  cellRender={(cellData: { data: Receipt }) => {
                    const receipt = cellData.data;
                    if (receipt.status === 'cancelled') return null;
                    return (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <Button icon="edit" hint={t('accountsReceivable.receiptsPage.actions.edit')} stylingMode="text" height={28} onClick={() => handleEdit(receipt)} />
                        <Button icon="trash" hint={t('accountsReceivable.receiptsPage.actions.delete')} stylingMode="text" height={28} onClick={() => handleDelete(receipt)} />
                      </div>
                    );
                  }}
                />

                <Summary>
                  <TotalItem
                    column="amount"
                    summaryType="sum"
                    valueFormat="#,##0.00"
                    displayFormat={t('accountsReceivable.receiptsPage.summary.total')}
                  />
                  <TotalItem
                    column="receiptNumber"
                    summaryType="count"
                    displayFormat={t('accountsReceivable.receiptsPage.summary.count')}
                  />
                </Summary>
              </DataGrid>
            )}
          </div>
        </div>

        {/* Record Receipt Dialog */}
        <Popup
          visible={isDialogOpen}
          onHiding={handleCloseReceiptDialog}
          title={editingReceiptId ? t('accountsReceivable.receiptsPage.dialog.editTitle') : t('accountsReceivable.receiptsPage.dialog.createTitle')}
          width={600}
          height="auto"
          showCloseButton={true}
          dragEnabled={true}
        >
          <div className="p-4">
            {selectedInvoice && (
              <div className="mb-4 p-3 bg-green-50 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>{t('accountsReceivable.receiptsPage.invoiceInfo.invoiceNumber')}:</div>
                  <div className="font-semibold">{selectedInvoice.invoiceNumber}</div>
                  <div>{t('accountsReceivable.receiptsPage.invoiceInfo.customer')}:</div>
                  <div className="font-semibold">{selectedInvoice.customerName || '-'}</div>
                  <div>{t('accountsReceivable.receiptsPage.invoiceInfo.totalAmount')}:</div>
                  <div className="font-semibold">{selectedInvoice.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} THB</div>
                  <div>{t('accountsReceivable.receiptsPage.invoiceInfo.paidAmount')}:</div>
                  <div className="font-semibold">{selectedInvoice.paidAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} THB</div>
                  <div>{t('accountsReceivable.receiptsPage.invoiceInfo.outstanding')}:</div>
                  <div className="font-bold text-orange-600">
                    {(selectedInvoice.totalAmount - selectedInvoice.paidAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} THB
                  </div>
                </div>
              </div>
            )}

            {/* Edit mode: show read-only receipt info */}
            {editingReceipt && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-600">{t('accountsReceivable.receiptsPage.receiptInfo.receiptNumber')}:</div>
                  <div className="font-semibold">{editingReceipt.receiptNumber || '-'}</div>
                  <div className="text-gray-600">{t('accountsReceivable.receiptsPage.invoiceInfo.customer')}:</div>
                  <div className="font-semibold">{editingReceipt.customerName || '-'}</div>
                  <div className="text-gray-600">{t('accountsReceivable.receiptsPage.receiptInfo.amountThb')}:</div>
                  <div className="font-semibold">{Number(editingReceipt.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} THB</div>
                </div>
              </div>
            )}

            <Form key={editingReceiptId || 'new'} formData={formData} labelLocation="top" showColonAfterLabel={true}>
              {!editingReceiptId && (
                <SimpleItem
                  dataField="arInvoiceId"
                  editorType="dxSelectBox"
                  label={{ text: t('accountsReceivable.receiptsPage.form.arInvoice') }}
                  editorOptions={{
                    dataSource: arInvoices,
                    displayExpr: (item: ARInvoice) =>
                      item ? `${item.invoiceNumber} - ${item.customerName || t('accountsReceivable.receiptsPage.form.unknownCustomer')} (${t('accountsReceivable.receiptsPage.form.outstandingShort')}: ${(item.totalAmount - item.paidAmount).toFixed(2)})` : '',
                    valueExpr: 'id',
                    searchEnabled: true,
                    onValueChanged: (e: { value: number | null }) => handleInvoiceChange(e.value),
                  }}
                >
                  <RequiredRule message={t('accountsReceivable.receiptsPage.form.arInvoiceRequired')} />
                </SimpleItem>
              )}
              <GroupItem colCount={2}>
                <SimpleItem
                  dataField="paymentDate"
                  editorType="dxDateBox"
                  label={{ text: t('accountsReceivable.receiptsPage.form.paymentDate') }}
                  editorOptions={{ type: 'date', displayFormat: 'dd/MM/yyyy' }}
                >
                  <RequiredRule message={t('accountsReceivable.receiptsPage.form.dateRequired')} />
                </SimpleItem>
                <SimpleItem
                  dataField="paymentMethod"
                  editorType="dxSelectBox"
                  label={{ text: t('accountsReceivable.receiptsPage.form.paymentMethod') }}
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
              </GroupItem>
              <SimpleItem
                dataField="bankAccountId"
                editorType="dxSelectBox"
                label={{ text: t('accountsReceivable.receiptsPage.form.bankAccount') }}
                editorOptions={{
                  dataSource: bankAccounts,
                  displayExpr: (item: GLAccount) => item ? `${item.code} - ${item.nameTh}` : '',
                  valueExpr: 'id',
                  searchEnabled: true,
                }}
              >
                <RequiredRule message={t('accountsReceivable.receiptsPage.form.bankAccountRequired')} />
              </SimpleItem>
              {!editingReceiptId && (
                <GroupItem colCount={2}>
                  <SimpleItem
                    dataField="amount"
                    editorType="dxNumberBox"
                    label={{ text: t('accountsReceivable.receiptsPage.form.amountThb') }}
                    editorOptions={{
                      format: '#,##0.00',
                      min: 0.01,
                      max: selectedInvoice ? selectedInvoice.totalAmount - selectedInvoice.paidAmount : undefined,
                    }}
                  >
                    <RequiredRule message={t('accountsReceivable.receiptsPage.form.amountRequired')} />
                  </SimpleItem>
                  <SimpleItem
                    dataField="referenceNumber"
                    label={{ text: t('accountsReceivable.receiptsPage.form.referenceNumber') }}
                    editorOptions={{ placeholder: t('accountsReceivable.receiptsPage.form.referencePlaceholder') }}
                  />
                </GroupItem>
              )}
              {editingReceiptId && (
                <SimpleItem
                  dataField="referenceNumber"
                  label={{ text: t('accountsReceivable.receiptsPage.form.referenceNumber') }}
                  editorOptions={{ placeholder: t('accountsReceivable.receiptsPage.form.referencePlaceholder') }}
                />
              )}
              <SimpleItem
                dataField="description"
                editorType="dxTextArea"
                label={{ text: t('accountsReceivable.receiptsPage.form.description') }}
                editorOptions={{ height: 60 }}
              />
            </Form>

            <div className="mt-6 flex justify-end gap-2">
              <Button text={t('accountsReceivable.receiptsPage.dialog.cancel')} type="normal" stylingMode="outlined" onClick={handleCloseReceiptDialog} />
              <Button
                text={editingReceiptId ? t('accountsReceivable.receiptsPage.dialog.saveEdit') : t('accountsReceivable.receiptsPage.dialog.save')}
                type="success"
                onClick={handleRecordReceipt}
                disabled={receiptMutation.isPending || updateMutation.isPending}
              />
            </div>
          </div>
        </Popup>
      </div>
    </div>
  );
}

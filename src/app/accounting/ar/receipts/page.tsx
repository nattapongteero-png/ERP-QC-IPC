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

const paymentMethodOptions = [
  { value: '', text: 'ทุกวิธี' },
  { value: 'cash', text: 'เงินสด' },
  { value: 'bank_transfer', text: 'โอนเงินผ่านธนาคาร' },
  { value: 'cheque', text: 'เช็ค' },
  { value: 'credit_card', text: 'บัตรเครดิต' },
];

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

const statusOptions = [
  { value: '', text: 'ทุกสถานะ' },
  { value: 'pending', text: 'รอดำเนินการ' },
  { value: 'cleared', text: 'เคลียร์แล้ว' },
  { value: 'bounced', text: 'เช็คเด้ง' },
  { value: 'cancelled', text: 'ยกเลิก' },
];

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

function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'เงินสด',
    bank_transfer: 'โอนเงินผ่านธนาคาร',
    cheque: 'เช็ค',
    credit_card: 'บัตรเครดิต',
  };
  return labels[method] || method;
}

export default function ARReceiptsPage() {
  const t = useTranslations('accounting');
  const queryClient = useQueryClient();
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
      notify(`บันทึกการรับชำระเงินสำเร็จ (${result.payment.paymentNumber})`, 'success', 3000);
      setIsDialogOpen(false);
      setSelectedInvoice(null);
      resetReceiptForm();
    },
    onError: (error: Error) => {
      notify(error.message || 'ไม่สามารถบันทึกการรับชำระเงินได้', 'error', 4000);
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
      notify('ลบรายการรับชำระสำเร็จ', 'success', 3000);
    },
    onError: (error: Error) => {
      notify(error.message || 'ไม่สามารถลบรายการรับชำระได้', 'error', 4000);
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
      notify('แก้ไขรายการรับชำระสำเร็จ', 'success', 3000);
      setIsDialogOpen(false);
      setEditingReceiptId(null);
      resetReceiptForm();
    },
    onError: (error: Error) => {
      notify(error.message || 'ไม่สามารถแก้ไขรายการรับชำระได้', 'error', 4000);
    },
  });

  const handleDelete = useCallback(
    async (receipt: Receipt) => {
      const result = await confirm(
        `คุณต้องการลบรายการรับชำระ ${receipt.receiptNumber || receipt.id} หรือไม่?<br/>การลบจะไม่สามารถย้อนกลับได้`,
        'ยืนยันการลบ'
      );
      if (result) {
        deleteMutation.mutate(receipt.id);
      }
    },
    [deleteMutation]
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
      notify('กรุณาเลือกใบแจ้งหนี้และบัญชีรับชำระ', 'warning', 3000);
      return;
    }
    if (formData.amount <= 0) {
      notify('จำนวนเงินต้องมากกว่า 0', 'warning', 3000);
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
  }, [formData, receiptMutation, updateMutation, editingReceiptId]);

  const handleExportJSON = useCallback(() => {
    if (!receipts || receipts.length === 0) return;
    const blob = new Blob([JSON.stringify(receipts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ar-receipts-${toLocalDateStr(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('ส่งออกใบเสร็จรับเงินสำเร็จ', 'success', 3000);
  }, [receipts]);

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
        <span>{getPaymentMethodLabel(cellData.value)}</span>
      </div>
    );
  }, []);

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
          { label: 'ลูกหนี้การค้า', href: '/accounting/ar' },
          { label: t('accountsReceivable.receipts.title') },
        ]}
        onRefresh={handleRefresh}
        actions={
          <Button
            text="บันทึกใบเสร็จรับเงิน"
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
                label="ใบเสร็จทั้งหมด"
                value={summary?.totalReceipts || 0}
                subtitle="ทั้งหมด"
                icon="file-text"
                variant="info"
              />
              <AccountingKPICard
                label="จำนวนเงินรวม"
                value={formatCurrency(summary?.totalAmount || 0)}
                subtitle="ยอดรับชำระทั้งหมด"
                icon="trending-up"
                variant="success"
              />
              <AccountingKPICard
                label="เคลียร์แล้ว"
                value={formatCurrency(summary?.clearedAmount || 0)}
                subtitle="การชำระที่ยืนยันแล้ว"
                icon="check-circle"
                variant="success"
              />
              <AccountingKPICard
                label="รอดำเนินการ"
                value={formatCurrency(summary?.pendingAmount || 0)}
                subtitle="รอการเคลียร์"
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
              วิธีชำระเงิน
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
            <label className="text-sm font-medium text-gray-700">สถานะ</label>
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
              ตั้งแต่วันที่
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
            <label className="text-sm font-medium text-gray-700">ถึงวันที่</label>
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
              text="ล้างตัวกรอง"
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
                text="ส่งออก"
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
                  Receipt List
                </h3>
                <p className="text-sm text-gray-600">
                  {receipts.length} receipt(s) found
                </p>
              </div>
            </div>
          </div>

          <div className="p-4">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-green-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading receipts...</p>
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
                <SearchPanel visible placeholder="ค้นหาใบเสร็จรับเงิน..." />

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
                <Column dataField="receiptNumber" caption="เลขที่ใบเสร็จ" width={150} />
                <Column
                  dataField="receiptDate"
                  caption="วันที่"
                  dataType="date"
                  width={120}
                  cellRender={(data) => formatDate(data.value)}
                />
                <Column dataField="customerName" caption="ลูกค้า" minWidth={200} />
                <Column
                  dataField="paymentMethod"
                  caption="วิธีการ"
                  width={150}
                  cellRender={paymentMethodCellRender}
                />
                <Column
                  dataField="amount"
                  caption="จำนวนเงิน"
                  dataType="number"
                  format="#,##0.00"
                  width={130}
                  alignment="right"
                />
                <Column dataField="reference" caption="อ้างอิง" width={150} />
                <Column dataField="bankAccountName" caption="บัญชีธนาคาร" width={150} />
                <Column
                  dataField="status"
                  caption="สถานะ"
                  width={120}
                  cellRender={statusCellRender}
                />
                <Column
                  caption="การดำเนินการ"
                  width={120}
                  allowFiltering={false}
                  allowSorting={false}
                  cellRender={(cellData: { data: Receipt }) => {
                    const receipt = cellData.data;
                    if (receipt.status === 'cancelled') return null;
                    return (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <Button icon="edit" hint="แก้ไข" stylingMode="text" height={28} onClick={() => handleEdit(receipt)} />
                        <Button icon="trash" hint="ลบ" stylingMode="text" height={28} onClick={() => handleDelete(receipt)} />
                      </div>
                    );
                  }}
                />

                <Summary>
                  <TotalItem
                    column="amount"
                    summaryType="sum"
                    valueFormat="#,##0.00"
                    displayFormat="Total: {0}"
                  />
                  <TotalItem
                    column="receiptNumber"
                    summaryType="count"
                    displayFormat="{0} receipts"
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
          title={editingReceiptId ? 'แก้ไขรายการรับชำระ' : 'บันทึกการรับชำระเงิน'}
          width={600}
          height="auto"
          showCloseButton={true}
          dragEnabled={true}
        >
          <div className="p-4">
            {selectedInvoice && (
              <div className="mb-4 p-3 bg-green-50 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Invoice Number:</div>
                  <div className="font-semibold">{selectedInvoice.invoiceNumber}</div>
                  <div>Customer:</div>
                  <div className="font-semibold">{selectedInvoice.customerName || '-'}</div>
                  <div>Total Amount:</div>
                  <div className="font-semibold">{selectedInvoice.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} THB</div>
                  <div>Paid Amount:</div>
                  <div className="font-semibold">{selectedInvoice.paidAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} THB</div>
                  <div>Outstanding:</div>
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
                  <div className="text-gray-600">Receipt Number:</div>
                  <div className="font-semibold">{editingReceipt.receiptNumber || '-'}</div>
                  <div className="text-gray-600">Customer:</div>
                  <div className="font-semibold">{editingReceipt.customerName || '-'}</div>
                  <div className="text-gray-600">Amount (THB):</div>
                  <div className="font-semibold">{Number(editingReceipt.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} THB</div>
                </div>
              </div>
            )}

            <Form key={editingReceiptId || 'new'} formData={formData} labelLocation="top" showColonAfterLabel={true}>
              {!editingReceiptId && (
                <SimpleItem
                  dataField="arInvoiceId"
                  editorType="dxSelectBox"
                  label={{ text: 'ใบแจ้งหนี้ (AR Invoice)' }}
                  editorOptions={{
                    dataSource: arInvoices,
                    displayExpr: (item: ARInvoice) =>
                      item ? `${item.invoiceNumber} - ${item.customerName || 'Unknown'} (ค้าง: ${(item.totalAmount - item.paidAmount).toFixed(2)})` : '',
                    valueExpr: 'id',
                    searchEnabled: true,
                    onValueChanged: (e: { value: number | null }) => handleInvoiceChange(e.value),
                  }}
                >
                  <RequiredRule message="กรุณาเลือกใบแจ้งหนี้" />
                </SimpleItem>
              )}
              <GroupItem colCount={2}>
                <SimpleItem
                  dataField="paymentDate"
                  editorType="dxDateBox"
                  label={{ text: 'วันที่รับชำระ' }}
                  editorOptions={{ type: 'date', displayFormat: 'dd/MM/yyyy' }}
                >
                  <RequiredRule message="กรุณาเลือกวันที่" />
                </SimpleItem>
                <SimpleItem
                  dataField="paymentMethod"
                  editorType="dxSelectBox"
                  label={{ text: 'วิธีชำระ' }}
                  editorOptions={{
                    dataSource: [
                      { value: 'transfer', label: 'โอนเงิน' },
                      { value: 'cash', label: 'เงินสด' },
                      { value: 'check', label: 'เช็ค' },
                      { value: 'other', label: 'อื่นๆ' },
                    ],
                    displayExpr: 'label',
                    valueExpr: 'value',
                  }}
                />
              </GroupItem>
              <SimpleItem
                dataField="bankAccountId"
                editorType="dxSelectBox"
                label={{ text: 'บัญชีรับเงิน' }}
                editorOptions={{
                  dataSource: bankAccounts,
                  displayExpr: (item: GLAccount) => item ? `${item.code} - ${item.nameTh}` : '',
                  valueExpr: 'id',
                  searchEnabled: true,
                }}
              >
                <RequiredRule message="กรุณาเลือกบัญชีรับเงิน" />
              </SimpleItem>
              {!editingReceiptId && (
                <GroupItem colCount={2}>
                  <SimpleItem
                    dataField="amount"
                    editorType="dxNumberBox"
                    label={{ text: 'จำนวนเงิน (THB)' }}
                    editorOptions={{
                      format: '#,##0.00',
                      min: 0.01,
                      max: selectedInvoice ? selectedInvoice.totalAmount - selectedInvoice.paidAmount : undefined,
                    }}
                  >
                    <RequiredRule message="กรุณาระบุจำนวนเงิน" />
                  </SimpleItem>
                  <SimpleItem
                    dataField="referenceNumber"
                    label={{ text: 'เลขอ้างอิง' }}
                    editorOptions={{ placeholder: 'เลขที่เช็ค / Ref.' }}
                  />
                </GroupItem>
              )}
              {editingReceiptId && (
                <SimpleItem
                  dataField="referenceNumber"
                  label={{ text: 'เลขอ้างอิง' }}
                  editorOptions={{ placeholder: 'เลขที่เช็ค / Ref.' }}
                />
              )}
              <SimpleItem
                dataField="description"
                editorType="dxTextArea"
                label={{ text: 'รายละเอียด' }}
                editorOptions={{ height: 60 }}
              />
            </Form>

            <div className="mt-6 flex justify-end gap-2">
              <Button text="ยกเลิก" type="normal" stylingMode="outlined" onClick={handleCloseReceiptDialog} />
              <Button
                text={editingReceiptId ? 'บันทึกการแก้ไข' : 'บันทึกการรับชำระ'}
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

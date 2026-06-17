'use client';

/**
 * AP Payments Page
 * Feature: 010-accounting-module-integration
 * Shows payment records for Accounts Payable with filtering and payment recording
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toLocalDateStr } from '@/lib/utils/date-format';
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
import { Popup } from 'devextreme-react/popup';
import Form, {
  SimpleItem,
  GroupItem,
  RequiredRule,
} from 'devextreme-react/form';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import { DateBox } from 'devextreme-react/date-box';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingFilterPanel,
  AccountingStatusBadge,
} from '@/components/accounting';

// Types
interface Payment {
  id: number;
  paymentNumber: string;
  paymentType: 'ap' | 'ar';
  paymentDate: string;
  vendorId: number | null;
  vendorName?: string;
  customerId: number | null;
  customerName?: string;
  bankAccountId: number;
  bankAccountCode?: string;
  bankAccountName?: string;
  paymentMethod: 'cash' | 'check' | 'transfer' | 'other';
  referenceNumber: string | null;
  amount: number;
  whtAmount: number;
  description: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  invoiceNumber?: string;
  apInvoiceId?: number;
}

interface APInvoice {
  id: number;
  invoiceNumber: string;
  vendorId: number;
  vendorName?: string;
  totalAmount: number;
  paidAmount: number;
  status: 'draft' | 'approved' | 'posted' | 'partial' | 'paid' | 'cancelled';
}

interface GLAccount {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string;
}

interface PaymentFormData {
  apInvoiceId: number | null;
  paymentDate: string;
  bankAccountId: number | null;
  paymentMethod: 'cash' | 'check' | 'transfer' | 'other';
  referenceNumber: string;
  amount: number;
  whtRate: number;
  description: string;
}

// API functions
async function fetchPayments(filters?: {
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<Payment[]> {
  const params = new URLSearchParams();
  params.append('paymentType', 'ap');
  if (filters?.paymentMethod) params.append('paymentMethod', filters.paymentMethod);
  if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters?.dateTo) params.append('dateTo', filters.dateTo);

  const res = await fetch(`/api/accounting/payments?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch payments');
  const json = await res.json();
  return json.data;
}

async function fetchAPInvoices(): Promise<APInvoice[]> {
  const res = await fetch('/api/accounting/ap-invoices?status=posted&status=partial');
  if (!res.ok) throw new Error('Failed to fetch invoices');
  const json = await res.json();
  return json.data;
}

async function fetchBankAccounts(): Promise<GLAccount[]> {
  const res = await fetch('/api/accounting/gl-accounts?isActive=true&accountType=asset');
  if (!res.ok) throw new Error('Failed to fetch bank accounts');
  const json = await res.json();
  // Filter for bank/cash accounts (typically codes starting with 11)
  return json.data.filter((acc: GLAccount) => acc.code.startsWith('11'));
}

async function recordPayment(
  invoiceId: number,
  data: {
    paymentDate: string;
    bankAccountId: number;
    paymentMethod: 'cash' | 'check' | 'transfer' | 'other';
    referenceNumber?: string;
    amount: number;
    whtRate?: number;
    description?: string;
  }
): Promise<{ payment: { paymentNumber: string }; invoice: APInvoice }> {
  const res = await fetch(`/api/accounting/ap-invoices/${invoiceId}/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to record payment');
  }
  return (await res.json()).data;
}

export default function APPaymentsPage() {
  const t = useTranslations('accounting');
  const queryClient = useQueryClient();
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<APInvoice | null>(null);
  const [formData, setFormData] = useState<PaymentFormData>({
    apInvoiceId: null,
    paymentDate: toLocalDateStr(new Date()),
    bankAccountId: null,
    paymentMethod: 'transfer',
    referenceNumber: '',
    amount: 0,
    whtRate: 0,
    description: '',
  });

  // Build filter object
  const filters = useMemo(() => {
    const f: { paymentMethod?: string; dateFrom?: string; dateTo?: string } = {};
    if (paymentMethodFilter) f.paymentMethod = paymentMethodFilter;
    if (dateFrom) f.dateFrom = toLocalDateStr(dateFrom);
    if (dateTo) f.dateTo = toLocalDateStr(dateTo);
    return f;
  }, [paymentMethodFilter, dateFrom, dateTo]);

  // Queries
  const { data: payments = [] } = useQuery({
    queryKey: ['payments', 'ap', filters],
    queryFn: () => fetchPayments(filters),
  });

  const { data: apInvoices = [] } = useQuery({
    queryKey: ['ap-invoices-payable'],
    queryFn: fetchAPInvoices,
    enabled: isDialogOpen,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: fetchBankAccounts,
    enabled: isDialogOpen,
  });

  // Mutations
  const paymentMutation = useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: number; data: Parameters<typeof recordPayment>[1] }) =>
      recordPayment(invoiceId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['ap-invoices'] });
      notify(`บันทึกการจ่ายเงินสำเร็จ (Payment: ${result.payment.paymentNumber})`, 'success', 3000);
      setIsDialogOpen(false);
      setSelectedInvoice(null);
      resetForm();
    },
    onError: (error: Error) => {
      notify(error.message || 'ไม่สามารถบันทึกการจ่ายเงินได้', 'error', 4000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/accounting/payments/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to delete payment');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      notify('ลบรายการชำระเงินสำเร็จ', 'success', 3000);
    },
    onError: (error: Error) => {
      notify(error.message || 'ไม่สามารถลบรายการชำระเงินได้', 'error', 4000);
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
        throw new Error(err.message || 'Failed to update payment');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      notify('แก้ไขรายการชำระเงินสำเร็จ', 'success', 3000);
      setIsDialogOpen(false);
      setEditingPaymentId(null);
      resetForm();
    },
    onError: (error: Error) => {
      notify(error.message || 'ไม่สามารถแก้ไขรายการชำระเงินได้', 'error', 4000);
    },
  });

  // Handlers
  const handleDelete = useCallback(
    async (payment: Payment) => {
      const result = await confirm(
        `คุณต้องการลบรายการชำระเงิน ${payment.paymentNumber} หรือไม่?<br/>การลบจะไม่สามารถย้อนกลับได้`,
        'ยืนยันการลบ'
      );
      if (result) {
        deleteMutation.mutate(payment.id);
      }
    },
    [deleteMutation]
  );

  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  const handleEdit = useCallback((payment: Payment) => {
    setFormData({
      apInvoiceId: payment.apInvoiceId || null,
      paymentDate: payment.paymentDate ? payment.paymentDate.split('T')[0] : '',
      bankAccountId: payment.bankAccountId,
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.referenceNumber || '',
      amount: payment.amount,
      whtRate: 0,
      description: payment.description || '',
    });
    setEditingPayment(payment);
    setEditingPaymentId(payment.id);
    setIsDialogOpen(true);
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      apInvoiceId: null,
      paymentDate: toLocalDateStr(new Date()),
      bankAccountId: null,
      paymentMethod: 'transfer',
      referenceNumber: '',
      amount: 0,
      whtRate: 0,
      description: '',
    });
    setSelectedInvoice(null);
  }, []);

  const handleOpenDialog = useCallback(() => {
    resetForm();
    setEditingPaymentId(null);
    setIsDialogOpen(true);
  }, [resetForm]);

  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
    setEditingPaymentId(null);
    setEditingPayment(null);
    resetForm();
  }, [resetForm]);

  const handleInvoiceChange = useCallback((invoiceId: number | null) => {
    const invoice = apInvoices.find((inv) => inv.id === invoiceId);
    setSelectedInvoice(invoice || null);
    if (invoice) {
      const outstanding = invoice.totalAmount - invoice.paidAmount;
      setFormData((prev) => ({
        ...prev,
        apInvoiceId: invoiceId,
        amount: outstanding,
        description: `Payment for ${invoice.invoiceNumber}`,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        apInvoiceId: null,
        amount: 0,
        description: '',
      }));
    }
  }, [apInvoices]);

  const handleRecordPayment = useCallback(() => {
    if (editingPaymentId) {
      // Update mode — save editable fields
      updateMutation.mutate({
        id: editingPaymentId,
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

    // Create mode
    if (!formData.apInvoiceId || !formData.bankAccountId) {
      notify('กรุณาเลือกใบแจ้งหนี้และบัญชีจ่าย', 'warning', 3000);
      return;
    }

    if (formData.amount <= 0) {
      notify('จำนวนเงินต้องมากกว่า 0', 'warning', 3000);
      return;
    }

    paymentMutation.mutate({
      invoiceId: formData.apInvoiceId,
      data: {
        paymentDate: formData.paymentDate,
        bankAccountId: formData.bankAccountId,
        paymentMethod: formData.paymentMethod,
        referenceNumber: formData.referenceNumber || undefined,
        amount: formData.amount,
        whtRate: formData.whtRate > 0 ? formData.whtRate : undefined,
        description: formData.description || undefined,
      },
    });
  }, [formData, paymentMutation, updateMutation, editingPaymentId]);

  const handleClearDateFilter = useCallback(() => {
    setDateFrom(null);
    setDateTo(null);
  }, []);

  // Status badge render
  const statusCellRender = useCallback((cellData: { value: string }) => {
    const statusValue = cellData.value as 'pending' | 'completed' | 'cancelled';
    // Map payment statuses to badge statuses
    const statusMap: Record<string, 'draft' | 'posted' | 'paid' | 'cancelled'> = {
      pending: 'draft',
      completed: 'paid',
      cancelled: 'cancelled',
    };
    const mappedStatus = statusMap[statusValue] || 'draft';
    return <AccountingStatusBadge status={mappedStatus} />;
  }, []);

  // Payment method render
  const paymentMethodCellRender = useCallback((cellData: { value: string }) => {
    const methodLabels: Record<string, string> = {
      cash: 'เงินสด',
      check: 'เช็ค',
      transfer: 'โอนเงิน',
      other: 'อื่นๆ',
    };
    return <span>{methodLabels[cellData.value] || cellData.value}</span>;
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const total = payments.length;

    // Calculate this month's date range
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStr = toLocalDateStr(firstDayOfMonth);

    const paidThisMonth = payments
      .filter((p) => p.status === 'completed' && p.paymentDate >= monthStr)
      .reduce((sum, p) => sum + p.amount, 0);

    const pending = payments.filter((p) => p.status === 'pending').length;

    // Outstanding is calculated from invoices, not payments
    // We'll need to fetch this from the invoices API
    const outstanding = 0; // Placeholder - would need to query AP invoices

    return { total, paidThisMonth, pending, outstanding };
  }, [payments]);

  // Add row sequence numbers for the grid
  const paymentsWithRowNumber = useMemo(
    () => payments.map((item, index) => ({ ...item, _rowNumber: index + 1 })),
    [payments]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Professional Header */}
      <AccountingPageHeader
        title={t('accountsPayable.payments.title')}
        subtitle={t('accountsPayable.description')}
        icon="credit-card"
        onBack={() => window.location.href = '/accounting/ap'}
        breadcrumbs={[
          { label: 'เจ้าหนี้การค้า', href: '/accounting/ap' },
          { label: t('accountsPayable.payments.title') },
        ]}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['payments'] })}
        actions={
          <Button
            text="บันทึกการชำระเงิน"
            icon="plus"
            type="success"
            onClick={handleOpenDialog}
          />
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <AccountingKPICard
            label="การชำระเงินทั้งหมด"
            value={stats.total.toLocaleString('th-TH')}
            subtitle="รายการชำระเงินทั้งหมด"
            icon="file-text"
            variant="info"
          />
          <AccountingKPICard
            label="ชำระแล้วเดือนนี้"
            value={`฿${stats.paidThisMonth.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}
            subtitle="เดือนปัจจุบัน"
            icon="check-circle"
            variant="success"
          />
          <AccountingKPICard
            label="รอดำเนินการ"
            value={stats.pending.toLocaleString('th-TH')}
            subtitle="รอการประมวลผล"
            icon="clock"
            variant="warning"
          />
          <AccountingKPICard
            label="ยอดค้างชำระ"
            value={`฿${stats.outstanding.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}
            subtitle="จากใบแจ้งหนี้ที่ยังไม่ชำระ"
            icon="trending-up"
            variant="danger"
          />
        </div>

        {/* Filter Panel */}
        <AccountingFilterPanel>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                วิธีชำระเงิน
              </label>
              <SelectBox
                dataSource={[
                  { value: '', label: 'ทั้งหมด' },
                  { value: 'cash', label: 'เงินสด' },
                  { value: 'check', label: 'เช็ค' },
                  { value: 'transfer', label: 'โอนเงิน' },
                  { value: 'other', label: 'อื่นๆ' },
                ]}
                displayExpr="label"
                valueExpr="value"
                value={paymentMethodFilter}
                onValueChanged={(e) => setPaymentMethodFilter(e.value)}
                placeholder="กรองตามวิธีชำระ"
                width={200}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ถึงวันที่
              </label>
              <DateBox
                value={dateTo}
                onValueChanged={(e) => setDateTo(e.value)}
                type="date"
                displayFormat="dd/MM/yyyy"
                width={150}
              />
            </div>
            {(dateFrom || dateTo) && (
              <div className="self-end">
                <Button
                  text="ล้างวันที่"
                  icon="clear"
                  type="normal"
                  stylingMode="outlined"
                  onClick={handleClearDateFilter}
                />
              </div>
            )}
          </div>
        </AccountingFilterPanel>

        {/* Data Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <DataGrid
            dataSource={paymentsWithRowNumber}
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
            <SearchPanel visible={true} placeholder="ค้นหา..." />
            <Sorting mode="multiple" />

            <Toolbar>
              <Item name="searchPanel" location="before" />
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
            <Column dataField="paymentNumber" caption="เลขที่การชำระ" width={150} />
            <Column dataField="invoiceNumber" caption="เลขที่ใบแจ้งหนี้" width={150} />
            <Column dataField="vendorName" caption="ชื่อผู้ขาย" minWidth={180} />
            <Column dataField="paymentDate" caption="วันที่ชำระ" dataType="date" width={120} />
            <Column
              dataField="amount"
              caption="จำนวนเงิน"
              dataType="number"
              width={120}
              alignment="right"
            >
              <Format type="fixedPoint" precision={2} />
            </Column>
            <Column
              dataField="whtAmount"
              caption="ภาษีหัก ณ ที่จ่าย"
              dataType="number"
              width={120}
              alignment="right"
            >
              <Format type="fixedPoint" precision={2} />
            </Column>
            <Column
              dataField="paymentMethod"
              caption="วิธีชำระเงิน"
              width={130}
              cellRender={paymentMethodCellRender}
            />
            <Column dataField="referenceNumber" caption="เลขที่อ้างอิง" width={150} />
            <Column
              dataField="status"
              caption="สถานะ"
              width={100}
              cellRender={statusCellRender}
            />
            <Column
              caption="การดำเนินการ"
              width={120}
              allowFiltering={false}
              allowSorting={false}
              cellRender={(cellData: { data: Payment }) => {
                const payment = cellData.data;
                if (payment.status === 'cancelled') return null;
                return (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <Button
                      icon="edit"
                      hint="แก้ไข"
                      stylingMode="text"
                      height={28}
                      onClick={() => handleEdit(payment)}
                    />
                    <Button
                      icon="trash"
                      hint="ลบ"
                      stylingMode="text"
                      height={28}
                      onClick={() => handleDelete(payment)}
                    />
                  </div>
                );
              }}
            />

            <Summary>
              <TotalItem column="amount" summaryType="sum" displayFormat="รวม: {0}">
                <Format type="fixedPoint" precision={2} />
              </TotalItem>
              <TotalItem column="whtAmount" summaryType="sum" displayFormat="ภาษีหัก ณ ที่จ่าย: {0}">
                <Format type="fixedPoint" precision={2} />
              </TotalItem>
            </Summary>
          </DataGrid>
        </div>

        {/* Record Payment Dialog */}
        <Popup
          visible={isDialogOpen}
          onHiding={handleCloseDialog}
          title={editingPaymentId ? 'แก้ไขรายการชำระเงิน' : 'บันทึกการชำระเงินผู้ขาย'}
          width={600}
          height="auto"
          showCloseButton={true}
          dragEnabled={true}
        >
          <div className="p-4">
            {selectedInvoice && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>เลขที่ใบแจ้งหนี้:</div>
                  <div className="font-semibold">{selectedInvoice.invoiceNumber}</div>
                  <div>ยอดรวม:</div>
                  <div className="font-semibold">
                    {selectedInvoice.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                  </div>
                  <div>ชำระแล้ว:</div>
                  <div className="font-semibold">
                    {selectedInvoice.paidAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                  </div>
                  <div>ยอดค้างชำระ:</div>
                  <div className="font-bold text-orange-600">
                    {(selectedInvoice.totalAmount - selectedInvoice.paidAmount).toLocaleString('th-TH', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    บาท
                  </div>
                </div>
              </div>
            )}

            {/* Edit mode: show read-only invoice & amount info */}
            {editingPayment && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-600">เลขที่ใบแจ้งหนี้:</div>
                  <div className="font-semibold">{editingPayment.invoiceNumber || '-'}</div>
                  <div className="text-gray-600">ผู้ขาย:</div>
                  <div className="font-semibold">{editingPayment.vendorName || '-'}</div>
                  <div className="text-gray-600">จำนวนเงิน (บาท):</div>
                  <div className="font-semibold">{Number(editingPayment.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</div>
                  <div className="text-gray-600">ภาษีหัก ณ ที่จ่าย:</div>
                  <div className="font-semibold">{Number(editingPayment.whtAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</div>
                </div>
              </div>
            )}

            <Form key={editingPaymentId || 'new'} formData={formData} labelLocation="top" showColonAfterLabel={true}>
              {!editingPaymentId && (
                <SimpleItem
                  dataField="apInvoiceId"
                  editorType="dxSelectBox"
                  label={{ text: 'ใบแจ้งหนี้เจ้าหนี้' }}
                  editorOptions={{
                    dataSource: apInvoices,
                    displayExpr: (item: APInvoice) =>
                      item ? `${item.invoiceNumber} - ${item.vendorName || 'ไม่ระบุ'} (ค้างชำระ: ${(item.totalAmount - item.paidAmount).toFixed(2)})` : '',
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
                  label={{ text: 'วันที่ชำระ' }}
                  editorOptions={{ type: 'date', displayFormat: 'dd/MM/yyyy' }}
                >
                  <RequiredRule message="กรุณาเลือกวันที่ชำระ" />
                </SimpleItem>
                <SimpleItem
                  dataField="paymentMethod"
                  editorType="dxSelectBox"
                  label={{ text: 'วิธีชำระเงิน' }}
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
                label={{ text: 'บัญชีธนาคาร' }}
                editorOptions={{
                  dataSource: bankAccounts,
                  displayExpr: (item: GLAccount) => item ? `${item.code} - ${item.nameTh}` : '',
                  valueExpr: 'id',
                  searchEnabled: true,
                }}
              >
                <RequiredRule message="กรุณาเลือกบัญชีธนาคาร" />
              </SimpleItem>
              {!editingPaymentId && (
                <GroupItem colCount={2}>
                  <SimpleItem
                    dataField="amount"
                    editorType="dxNumberBox"
                    label={{ text: 'จำนวนเงิน (บาท)' }}
                    editorOptions={{
                      format: '#,##0.00',
                      min: 0.01,
                      max: selectedInvoice ? selectedInvoice.totalAmount - selectedInvoice.paidAmount : undefined,
                    }}
                  >
                    <RequiredRule message="กรุณากรอกจำนวนเงิน" />
                  </SimpleItem>
                  <SimpleItem
                    dataField="whtRate"
                    editorType="dxNumberBox"
                    label={{ text: 'อัตราภาษีหัก ณ ที่จ่าย (%)' }}
                    editorOptions={{
                      format: '#,##0.00',
                      min: 0,
                      max: 100,
                    }}
                  />
                </GroupItem>
              )}
              <SimpleItem
                dataField="referenceNumber"
                label={{ text: 'เลขที่อ้างอิง' }}
                editorOptions={{ placeholder: 'เลขที่เช็ค / เลขที่อ้างอิงการโอน' }}
              />
              <SimpleItem
                dataField="description"
                editorType="dxTextArea"
                label={{ text: 'รายละเอียด' }}
                editorOptions={{ height: 60 }}
              />
            </Form>

            <div className="mt-6 flex justify-end gap-2">
              <Button text="ยกเลิก" type="normal" stylingMode="outlined" onClick={handleCloseDialog} />
              <Button
                text={editingPaymentId ? 'บันทึกการแก้ไข' : 'บันทึกการชำระเงิน'}
                type="success"
                onClick={handleRecordPayment}
                disabled={paymentMutation.isPending || updateMutation.isPending}
              />
            </div>
          </div>
        </Popup>
      </div>
    </div>
  );
}

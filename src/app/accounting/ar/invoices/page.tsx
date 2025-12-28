'use client';

/**
 * AR Invoices Page
 * Feature: 010-accounting-module-integration
 * User Story 3: Record Order-to-Cash Transactions
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Toolbar,
  Item,
  Selection,
  Export,
  ColumnChooser,
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
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingFilterPanel,
  AccountingStatusBadge,
} from '@/components/accounting';

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
  status: 'draft' | 'confirmed' | 'posted' | 'partial' | 'paid' | 'cancelled';
  journalEntryId: number | null;
}

interface Customer {
  id: number;
  code: string;
  name: string;
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
  const res = await fetch('/api/customers?isActive=true');
  if (!res.ok) throw new Error('Failed to fetch customers');
  const json = await res.json();
  return json.data;
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
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<ARInvoice | null>(null);
  const [formData, setFormData] = useState<FormData>({
    invoiceNumber: '',
    customerId: null,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    description: '',
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
      notify(`สร้างใบแจ้งหนี้สำเร็จ (Tax Invoice: ${data.taxInvoiceNumber})`, 'success', 3000);
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      notify(error.message || 'ไม่สามารถสร้างใบแจ้งหนี้ได้', 'error', 4000);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: confirmInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      notify('ยืนยันใบแจ้งหนี้และบันทึกรายการบัญชีแล้ว', 'success', 3000);
    },
    onError: (error: Error) => {
      notify(error.message || 'ไม่สามารถยืนยันใบแจ้งหนี้ได้', 'error', 4000);
    },
  });

  const paymentMutation = useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: number; data: Parameters<typeof receivePayment>[1] }) =>
      receivePayment(invoiceId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      notify(`รับชำระเงินสำเร็จ (Receipt: ${result.payment.paymentNumber})`, 'success', 3000);
      setIsPaymentDialogOpen(false);
      setSelectedInvoice(null);
    },
    onError: (error: Error) => {
      notify(error.message || 'ไม่สามารถรับชำระเงินได้', 'error', 4000);
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
      lines: [{ description: '', glAccountId: null, quantity: 1, unitPrice: 0 }],
    });
  }, []);

  const handleOpenDialog = useCallback(() => {
    resetForm();
    setIsDialogOpen(true);
  }, [resetForm]);

  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const handleSave = useCallback(() => {
    if (!formData.customerId || !formData.invoiceNumber) {
      notify('กรุณากรอกข้อมูลให้ครบ', 'warning', 3000);
      return;
    }

    const validLines = formData.lines.filter(
      (l) => l.description && l.glAccountId && l.quantity > 0 && l.unitPrice > 0
    );

    if (validLines.length === 0) {
      notify('กรุณาเพิ่มรายการอย่างน้อย 1 รายการ', 'warning', 3000);
      return;
    }

    createMutation.mutate({
      invoiceNumber: formData.invoiceNumber,
      customerId: formData.customerId,
      invoiceDate: formData.invoiceDate,
      dueDate: formData.dueDate,
      description: formData.description || null,
      lines: validLines.map((l) => ({
        description: l.description,
        glAccountId: l.glAccountId!,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
    });
  }, [formData, createMutation]);

  const handleConfirm = useCallback(
    async (invoice: ARInvoice) => {
      const result = await confirm(
        `คุณต้องการยืนยันใบแจ้งหนี้ ${invoice.invoiceNumber} หรือไม่?<br/>` +
          `<strong>Tax Invoice: ${invoice.taxInvoiceNumber}</strong><br/>` +
          `ระบบจะสร้างรายการบันทึกบัญชีและ Output VAT อัตโนมัติ`,
        'ยืนยันใบแจ้งหนี้'
      );
      if (result) {
        confirmMutation.mutate(invoice.id);
      }
    },
    [confirmMutation]
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
      notify('กรุณาเลือกบัญชีรับชำระ', 'warning', 3000);
      return;
    }

    if (paymentFormData.amount <= 0) {
      notify('จำนวนเงินต้องมากกว่า 0', 'warning', 3000);
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
  }, [selectedInvoice, paymentFormData, paymentMutation]);

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
    return Math.round(lineTotal * 0.07 * 100) / 100;
  }, [lineTotal]);

  // Status badge render using AccountingStatusBadge
  const statusCellRender = useCallback((cellData: { value: string }) => {
    const statusValue = cellData.value as 'draft' | 'posted' | 'partial' | 'paid' | 'cancelled' | 'confirmed';
    // Map AR-specific statuses to badge statuses
    const statusMap: Record<string, 'draft' | 'posted' | 'partial' | 'paid' | 'cancelled' | 'confirmed'> = {
      draft: 'draft',
      confirmed: 'confirmed',
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
    (cellData: { data: ARInvoice }) => {
      const invoice = cellData.data;
      return (
        <div style={{ display: 'flex', gap: '4px' }}>
          {invoice.status === 'draft' && (
            <Button
              text="ยืนยัน"
              type="success"
              stylingMode="outlined"
              height={24}
              onClick={() => handleConfirm(invoice)}
            />
          )}
          {['posted', 'partial'].includes(invoice.status) && (
            <Button
              text="รับชำระ"
              type="default"
              stylingMode="outlined"
              height={24}
              onClick={() => handleOpenPaymentDialog(invoice)}
            />
          )}
        </div>
      );
    },
    [handleConfirm, handleOpenPaymentDialog]
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50" data-testid="ar-invoices-page">
      {/* Professional Header */}
      <AccountingPageHeader
        title="ใบแจ้งหนี้ขาย"
        subtitle="AR Invoices / Tax Invoices"
        icon="dollar-sign"
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['ar-invoices'] })}
        actions={
          <Button
            text="เพิ่มใบแจ้งหนี้"
            icon="plus"
            type="success"
            onClick={handleOpenDialog}
            data-testid="ar-add-invoice-btn"
          />
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <AccountingKPICard
            label="รายการทั้งหมด"
            value={stats.total.toLocaleString('th-TH')}
            subtitle={`฿${stats.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}
            icon="file-text"
            variant="info"
          />
          <AccountingKPICard
            label="รอดำเนินการ"
            value={stats.pending.toLocaleString('th-TH')}
            subtitle="รอการยืนยัน"
            icon="clock"
            variant="warning"
          />
          <AccountingKPICard
            label="ค้างรับ"
            value={stats.outstanding.toLocaleString('th-TH')}
            subtitle={`฿${stats.outstandingAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}
            icon="dollar-sign"
            variant="danger"
          />
          <AccountingKPICard
            label="ชำระแล้ว"
            value={stats.paid.toLocaleString('th-TH')}
            subtitle="เสร็จสมบูรณ์"
            icon="check-circle"
            variant="success"
          />
        </div>

        {/* Filter Panel */}
        <AccountingFilterPanel>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                สถานะ
              </label>
              <SelectBox
                dataSource={[
                  { value: '', label: 'ทั้งหมด' },
                  { value: 'draft', label: 'ร่าง' },
                  { value: 'posted', label: 'ลงบัญชี' },
                  { value: 'partial', label: 'รับบางส่วน' },
                  { value: 'paid', label: 'ชำระแล้ว' },
                ]}
                displayExpr="label"
                valueExpr="value"
                value={statusFilter}
                onValueChanged={(e) => setStatusFilter(e.value)}
                placeholder="กรองสถานะ"
                width={200}
              />
            </div>
          </div>
        </AccountingFilterPanel>

        {/* Data Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200" data-testid="ar-invoices-grid">
        <DataGrid
          dataSource={invoices}
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
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <SearchPanel visible={true} placeholder="ค้นหา..." />
          <Sorting mode="multiple" />
          <Selection mode="single" />
          <ColumnChooser enabled={true} />
          <Export enabled={true} />

          <Toolbar>
            <Item name="searchPanel" location="before" />
            <Item name="exportButton" location="after" />
            <Item name="columnChooserButton" location="after" />
          </Toolbar>

          <Column dataField="invoiceNumber" caption="เลขที่ใบแจ้งหนี้" width={150} />
          <Column dataField="taxInvoiceNumber" caption="เลขที่ใบกำกับภาษี" width={160} />
          <Column dataField="customerId" caption="ลูกค้า" width={150} visible={false} />
          <Column dataField="invoiceDate" caption="วันที่" dataType="date" width={110} />
          <Column dataField="dueDate" caption="วันครบกำหนด" dataType="date" width={110} />
          <Column dataField="description" caption="รายละเอียด" minWidth={150} />
          <Column
            dataField="totalAmount"
            caption="ยอดรวม"
            dataType="number"
            width={120}
            alignment="right"
          >
            <Format type="fixedPoint" precision={2} />
          </Column>
          <Column
            dataField="paidAmount"
            caption="รับแล้ว"
            dataType="number"
            width={120}
            alignment="right"
          >
            <Format type="fixedPoint" precision={2} />
          </Column>
          <Column
            dataField="status"
            caption="สถานะ"
            width={120}
            cellRender={statusCellRender}
          />
          <Column
            caption="การดำเนินการ"
            width={150}
            cellRender={actionsCellRender}
            allowFiltering={false}
            allowSorting={false}
          />

          <Summary>
            <TotalItem column="totalAmount" summaryType="sum" displayFormat="รวม: {0}">
              <Format type="fixedPoint" precision={2} />
            </TotalItem>
          </Summary>
        </DataGrid>
        </div>

        {/* Add Invoice Dialog */}
        <Popup
          visible={isDialogOpen}
          onHiding={handleCloseDialog}
          title="สร้างใบแจ้งหนี้ขาย"
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
                label={{ text: 'เลขที่ใบแจ้งหนี้' }}
                editorOptions={{ placeholder: 'AR-YYYYMM-NNNNNN' }}
              >
                <RequiredRule message="กรุณากรอกเลขที่ใบแจ้งหนี้" />
              </SimpleItem>
              <SimpleItem
                dataField="customerId"
                editorType="dxSelectBox"
                label={{ text: 'ลูกค้า' }}
                editorOptions={{
                  dataSource: customers,
                  displayExpr: 'name',
                  valueExpr: 'id',
                  searchEnabled: true,
                }}
              >
                <RequiredRule message="กรุณาเลือกลูกค้า" />
              </SimpleItem>
            </GroupItem>
            <GroupItem colCount={2}>
              <SimpleItem
                dataField="invoiceDate"
                editorType="dxDateBox"
                label={{ text: 'วันที่ใบแจ้งหนี้' }}
                editorOptions={{ type: 'date', displayFormat: 'dd/MM/yyyy' }}
              >
                <RequiredRule message="กรุณาเลือกวันที่" />
              </SimpleItem>
              <SimpleItem
                dataField="dueDate"
                editorType="dxDateBox"
                label={{ text: 'วันครบกำหนดชำระ' }}
                editorOptions={{ type: 'date', displayFormat: 'dd/MM/yyyy' }}
              >
                <RequiredRule message="กรุณาเลือกวันครบกำหนด" />
              </SimpleItem>
            </GroupItem>
            <SimpleItem
              dataField="description"
              editorType="dxTextArea"
              label={{ text: 'รายละเอียด' }}
              editorOptions={{ height: 60 }}
            />
            </Form>

            {/* Line Items */}
            <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">รายการ</h3>
              <Button text="เพิ่มรายการ" icon="plus" type="default" onClick={addLine} />
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">รายละเอียด</th>
                  <th className="border p-2 text-left" style={{ width: 200 }}>
                    บัญชีรายได้
                  </th>
                  <th className="border p-2 text-right" style={{ width: 80 }}>
                    จำนวน
                  </th>
                  <th className="border p-2 text-right" style={{ width: 120 }}>
                    ราคา/หน่วย
                  </th>
                  <th className="border p-2 text-right" style={{ width: 120 }}>
                    รวม
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
                        placeholder="รายละเอียด"
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
                        <option value="">เลือกบัญชี</option>
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
                    ยอดก่อน VAT
                  </td>
                  <td className="border p-2 text-right font-semibold">
                    {lineTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="border"></td>
                </tr>
                <tr className="bg-gray-50">
                  <td colSpan={4} className="border p-2 text-right">
                    VAT 7%
                  </td>
                  <td className="border p-2 text-right">
                    {vatAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="border"></td>
                </tr>
                <tr className="bg-gray-100">
                  <td colSpan={4} className="border p-2 text-right font-bold">
                    ยอดรวมสุทธิ
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
              <Button text="ยกเลิก" type="normal" stylingMode="outlined" onClick={handleCloseDialog} data-testid="ar-cancel-btn" />
              <Button
                text="บันทึก"
                type="success"
                onClick={handleSave}
                disabled={createMutation.isPending}
                data-testid="ar-save-btn"
              />
            </div>
          </div>
        </Popup>

        {/* Payment Dialog */}
        <Popup
          visible={isPaymentDialogOpen}
          onHiding={handleClosePaymentDialog}
          title={`รับชำระเงิน - ${selectedInvoice?.invoiceNumber || ''}`}
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
                    <div>เลขที่ใบกำกับภาษี:</div>
                    <div className="font-semibold">{selectedInvoice.taxInvoiceNumber}</div>
                    <div>ยอดรวม:</div>
                    <div className="font-semibold">
                      {selectedInvoice.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                    </div>
                    <div>รับแล้ว:</div>
                    <div className="font-semibold">
                      {selectedInvoice.paidAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                    </div>
                    <div>ค้างรับ:</div>
                    <div className="font-bold text-orange-600">
                      {(selectedInvoice.totalAmount - selectedInvoice.paidAmount).toLocaleString('th-TH', {
                        minimumFractionDigits: 2,
                      })}{' '}
                      บาท
                    </div>
                  </div>
                </div>

                <Form formData={paymentFormData} labelLocation="top" showColonAfterLabel={true}>
                  <SimpleItem
                    dataField="paymentDate"
                    editorType="dxDateBox"
                    label={{ text: 'วันที่รับชำระ' }}
                    editorOptions={{ type: 'date', displayFormat: 'dd/MM/yyyy' }}
                  >
                    <RequiredRule message="กรุณาเลือกวันที่" />
                  </SimpleItem>
                  <SimpleItem
                    dataField="bankAccountId"
                    editorType="dxSelectBox"
                    label={{ text: 'บัญชีรับเงิน' }}
                    editorOptions={{
                      dataSource: bankAccounts,
                      displayExpr: (item: BankAccount) => item ? `${item.code} - ${item.nameTh}` : '',
                      valueExpr: 'id',
                      searchEnabled: true,
                    }}
                  >
                    <RequiredRule message="กรุณาเลือกบัญชี" />
                  </SimpleItem>
                  <SimpleItem
                    dataField="paymentMethod"
                    editorType="dxSelectBox"
                    label={{ text: 'วิธีการรับชำระ' }}
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
                  <SimpleItem
                    dataField="referenceNumber"
                    label={{ text: 'เลขที่อ้างอิง' }}
                    editorOptions={{ placeholder: 'เลขที่เช็ค / Ref. No.' }}
                  />
                  <SimpleItem
                    dataField="amount"
                    editorType="dxNumberBox"
                    label={{ text: 'จำนวนเงิน (บาท)' }}
                    editorOptions={{
                      format: '#,##0.00',
                      min: 0.01,
                      max: selectedInvoice.totalAmount - selectedInvoice.paidAmount,
                    }}
                  >
                    <RequiredRule message="กรุณากรอกจำนวนเงิน" />
                  </SimpleItem>
                  <SimpleItem
                    dataField="description"
                    editorType="dxTextArea"
                    label={{ text: 'หมายเหตุ' }}
                    editorOptions={{ height: 60 }}
                  />
                </Form>

                <div className="mt-6 flex justify-end gap-2">
                  <Button text="ยกเลิก" type="normal" stylingMode="outlined" onClick={handleClosePaymentDialog} />
                  <Button
                    text="รับชำระ"
                    type="success"
                    onClick={handleReceivePayment}
                    disabled={paymentMutation.isPending}
                  />
                </div>
              </>
            )}
          </div>
        </Popup>
      </div>
    </div>
  );
}

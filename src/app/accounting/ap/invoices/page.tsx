'use client';

/**
 * AP Invoices Page
 * Feature: 010-accounting-module-integration
 * User Story 2: Record Purchase-to-Pay Transactions
 */

import React, { useState, useCallback, useMemo } from 'react';
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
  const [formData, setFormData] = useState<FormData>({
    invoiceNumber: '',
    vendorId: null,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    receivedDate: new Date().toISOString().split('T')[0],
    description: '',
    vatRate: 7,
    vatAmountOverride: null,
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
      notify('สร้างใบแจ้งหนี้สำเร็จ', 'success', 3000);
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      notify(error.message || 'ไม่สามารถสร้างใบแจ้งหนี้ได้', 'error', 4000);
    },
  });

  const approveMutation = useMutation({
    mutationFn: approveInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-invoices'] });
      notify('อนุมัติใบแจ้งหนี้และบันทึกรายการบัญชีแล้ว', 'success', 3000);
    },
    onError: (error: Error) => {
      notify(error.message || 'ไม่สามารถอนุมัติใบแจ้งหนี้ได้', 'error', 4000);
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
      notify('ลบใบแจ้งหนี้สำเร็จ', 'success', 3000);
    },
    onError: (error: Error) => {
      notify(error.message || 'ไม่สามารถลบใบแจ้งหนี้ได้', 'error', 4000);
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
      notify('แก้ไขใบแจ้งหนี้สำเร็จ', 'success', 3000);
      setIsDialogOpen(false);
      setEditingInvoiceId(null);
      resetForm();
    },
    onError: (error: Error) => {
      notify(error.message || 'ไม่สามารถแก้ไขใบแจ้งหนี้ได้', 'error', 4000);
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

    const payload = {
      invoiceNumber: formData.invoiceNumber,
      vendorId: formData.vendorId,
      invoiceDate: formData.invoiceDate,
      dueDate: formData.dueDate,
      receivedDate: formData.receivedDate,
      description: formData.description || null,
      vatRate: formData.vatRate,
      vatAmountOverride: formData.vatAmountOverride,
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
        `คุณต้องการอนุมัติใบแจ้งหนี้ ${invoice.invoiceNumber} หรือไม่?<br/>ระบบจะสร้างรายการบันทึกบัญชีอัตโนมัติ`,
        'ยืนยันการอนุมัติ'
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
      setFormData({
        invoiceNumber: detail.invoiceNumber || '',
        vendorId: detail.vendorId || null,
        invoiceDate: detail.invoiceDate ? detail.invoiceDate.split('T')[0] : '',
        dueDate: detail.dueDate ? detail.dueDate.split('T')[0] : '',
        receivedDate: detail.receivedDate ? detail.receivedDate.split('T')[0] : '',
        description: detail.description || '',
        vatRate: detail.vatAmount > 0 ? 7 : 0,
        vatAmountOverride: null,
        lines: (detail.lines || []).map((l: any) => ({
          description: l.description || '',
          glAccountId: l.glAccountId || null,
          quantity: l.quantity || 1,
          unitPrice: l.unitPrice || 0,
        })),
      });
      setEditingInvoiceId(invoice.id);
      setIsDialogOpen(true);
    } catch (err: any) {
      notify(err.message || 'ไม่สามารถโหลดข้อมูลใบแจ้งหนี้ได้', 'error', 4000);
    }
  }, []);

  const handleDelete = useCallback(
    async (invoice: APInvoice) => {
      const result = await confirm(
        `คุณต้องการลบใบแจ้งหนี้ ${invoice.invoiceNumber} หรือไม่?<br/>การลบจะไม่สามารถย้อนกลับได้`,
        'ยืนยันการลบ'
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

  const vatAmount = useMemo(() => {
    if (formData.vatAmountOverride !== null) return formData.vatAmountOverride;
    return Math.round(lineTotal * (formData.vatRate / 100) * 100) / 100;
  }, [lineTotal, formData.vatRate, formData.vatAmountOverride]);

  // Status badge render using AccountingStatusBadge
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
        <div style={{ display: 'flex', gap: '4px' }}>
          {invoice.status === 'draft' && (
            <>
              <Button
                icon="edit"
                hint="แก้ไข"
                stylingMode="text"
                height={28}
                onClick={() => handleEdit(invoice)}
              />
              <Button
                icon="trash"
                hint="ลบ"
                stylingMode="text"
                height={28}
                onClick={() => handleDelete(invoice)}
              />
              <Button
                text="อนุมัติ"
                type="success"
                stylingMode="outlined"
                height={24}
                onClick={() => handleApprove(invoice)}
              />
            </>
          )}
          {['posted', 'partial'].includes(invoice.status) && (
            <Button
              text="ชำระ"
              type="default"
              stylingMode="outlined"
              height={24}
              onClick={() => notify('ฟังก์ชันชำระเงินอยู่ระหว่างพัฒนา', 'info', 3000)}
            />
          )}
        </div>
      );
    },
    [handleApprove, handleEdit, handleDelete]
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
          { label: 'เจ้าหนี้การค้า', href: '/accounting/ap' },
          { label: t('accountsPayable.bills.title') },
        ]}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['ap-invoices'] })}
        actions={
          <Button
            text="เพิ่มใบแจ้งหนี้"
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
            label="รายการทั้งหมด"
            value={stats.total.toLocaleString('th-TH')}
            subtitle={`฿${stats.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}
            icon="file-text"
            variant="info"
          />
          <AccountingKPICard
            label="รอดำเนินการ"
            value={stats.pending.toLocaleString('th-TH')}
            subtitle="รอการอนุมัติ"
            icon="clock"
            variant="warning"
          />
          <AccountingKPICard
            label="ค้างชำระ"
            value={stats.outstanding.toLocaleString('th-TH')}
            subtitle={`฿${stats.outstandingAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}
            icon="credit-card"
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
                  { value: 'partial', label: 'ชำระบางส่วน' },
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200" data-testid="ap-invoices-grid">
        <DataGrid
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
          <Column dataField="invoiceNumber" caption="เลขที่ใบแจ้งหนี้" width={150} />
          <Column dataField="vendorId" caption="ผู้จำหน่าย" width={150} visible={false} />
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
            caption="ชำระแล้ว"
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
            width={200}
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

        {/* Add/Edit Invoice Dialog */}
        <Popup
          visible={isDialogOpen}
          onHiding={handleCloseDialog}
          title={editingInvoiceId ? 'แก้ไขใบแจ้งหนี้ซื้อ' : 'เพิ่มใบแจ้งหนี้ซื้อ'}
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
                label={{ text: 'เลขที่ใบแจ้งหนี้' }}
                editorOptions={{ placeholder: 'INV-YYYY-NNNN' }}
              >
                <RequiredRule message="กรุณากรอกเลขที่ใบแจ้งหนี้" />
              </SimpleItem>
              <SimpleItem
                dataField="vendorId"
                editorType="dxSelectBox"
                label={{ text: 'ผู้จำหน่าย' }}
                editorOptions={{
                  dataSource: vendors,
                  displayExpr: 'name',
                  valueExpr: 'id',
                  searchEnabled: true,
                }}
              >
                <RequiredRule message="กรุณาเลือกผู้จำหน่าย" />
              </SimpleItem>
            </GroupItem>
            <GroupItem colCount={3}>
              <SimpleItem
                dataField="invoiceDate"
                editorType="dxDateBox"
                label={{ text: 'วันที่ใบแจ้งหนี้' }}
                editorOptions={{ type: 'date', displayFormat: 'dd/MM/yyyy' }}
              >
                <RequiredRule message="กรุณาเลือกวันที่" />
              </SimpleItem>
              <SimpleItem
                dataField="receivedDate"
                editorType="dxDateBox"
                label={{ text: 'วันที่รับเอกสาร' }}
                editorOptions={{ type: 'date', displayFormat: 'dd/MM/yyyy' }}
              >
                <RequiredRule message="กรุณาเลือกวันที่รับ" />
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
                    บัญชี
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
            <Button text="ยกเลิก" type="normal" stylingMode="outlined" onClick={handleCloseDialog} elementAttr={{ 'data-testid': 'ap-cancel-btn' }} />
            <Button
              text={editingInvoiceId ? 'บันทึกการแก้ไข' : 'บันทึก'}
              type="success"
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              elementAttr={{ 'data-testid': 'ap-save-btn' }}
            />
          </div>
        </div>
        </Popup>
      </div>
    </div>
  );
}

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
  lines: {
    description: string;
    glAccountId: number | null;
    quantity: number;
    unitPrice: number;
  }[];
}

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
  const res = await fetch('/api/vendors?isActive=true');
  if (!res.ok) throw new Error('Failed to fetch vendors');
  const json = await res.json();
  return json.data;
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
  const [formData, setFormData] = useState<FormData>({
    invoiceNumber: '',
    vendorId: null,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    receivedDate: new Date().toISOString().split('T')[0],
    description: '',
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

  // Handlers
  const resetForm = useCallback(() => {
    setFormData({
      invoiceNumber: '',
      vendorId: null,
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      receivedDate: new Date().toISOString().split('T')[0],
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

    createMutation.mutate({
      invoiceNumber: formData.invoiceNumber,
      vendorId: formData.vendorId,
      invoiceDate: formData.invoiceDate,
      dueDate: formData.dueDate,
      receivedDate: formData.receivedDate,
      description: formData.description || null,
      lines: validLines,
    });
  }, [formData, createMutation]);

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
    return Math.round(lineTotal * 0.07 * 100) / 100;
  }, [lineTotal]);

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
            <Button
              text="อนุมัติ"
              type="success"
              stylingMode="outlined"
              height={24}
              onClick={() => handleApprove(invoice)}
            />
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
    [handleApprove]
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50" data-testid="ap-invoices-page">
      {/* Professional Header */}
      <AccountingPageHeader
        title={t('accountsPayable.bills.title')}
        subtitle={t('accountsPayable.title')}
        icon="receipt"
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
          title="เพิ่มใบแจ้งหนี้ซื้อ"
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
            <Button text="ยกเลิก" type="normal" stylingMode="outlined" onClick={handleCloseDialog} elementAttr={{ 'data-testid': 'ap-cancel-btn' }} />
            <Button
              text="บันทึก"
              type="success"
              onClick={handleSave}
              disabled={createMutation.isPending}
              elementAttr={{ 'data-testid': 'ap-save-btn' }}
            />
          </div>
        </div>
        </Popup>
      </div>
    </div>
  );
}

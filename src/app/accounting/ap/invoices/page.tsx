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
  PatternRule,
} from 'devextreme-react/form';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';

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
  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
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

  // Status badge render
  const statusCellRender = useCallback((cellData: any) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      draft: { label: 'ร่าง', color: '#6c757d' },
      approved: { label: 'อนุมัติ', color: '#28a745' },
      posted: { label: 'ลงบัญชี', color: '#17a2b8' },
      partial: { label: 'ชำระบางส่วน', color: '#ffc107' },
      paid: { label: 'ชำระแล้ว', color: '#28a745' },
      cancelled: { label: 'ยกเลิก', color: '#dc3545' },
    };
    const status = statusMap[cellData.value] || { label: cellData.value, color: '#6c757d' };
    return (
      <span
        style={{
          backgroundColor: status.color,
          color: 'white',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '12px',
        }}
      >
        {status.label}
      </span>
    );
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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">ใบแจ้งหนี้ซื้อ</h1>
        <p className="text-gray-600">AP Invoices</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-gray-600 text-sm">รายการทั้งหมด</div>
          <div className="text-2xl font-bold">{invoices.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="text-gray-600 text-sm">รอดำเนินการ</div>
          <div className="text-2xl font-bold">
            {invoices.filter((i) => i.status === 'draft').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="text-gray-600 text-sm">ค้างชำระ</div>
          <div className="text-2xl font-bold">
            {invoices.filter((i) => ['posted', 'partial'].includes(i.status)).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-gray-600 text-sm">ชำระแล้ว</div>
          <div className="text-2xl font-bold">
            {invoices.filter((i) => i.status === 'paid').length}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-4 flex items-center gap-4">
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
          width={180}
        />
        <Button
          text="เพิ่มใบแจ้งหนี้"
          icon="plus"
          type="success"
          onClick={handleOpenDialog}
        />
      </div>

      {/* Data Grid */}
      <div className="bg-white rounded-lg shadow">
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
        <div className="p-4">
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
            <Button text="ยกเลิก" type="normal" stylingMode="outlined" onClick={handleCloseDialog} />
            <Button
              text="บันทึก"
              type="success"
              onClick={handleSave}
              disabled={createMutation.isPending}
            />
          </div>
        </div>
      </Popup>
    </div>
  );
}

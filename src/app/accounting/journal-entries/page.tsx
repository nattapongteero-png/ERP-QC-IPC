'use client';

/**
 * Journal Entries Page
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
  MasterDetail,
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
interface JournalLine {
  id: number;
  lineNumber: number;
  glAccountId: number;
  accountCode?: string;
  accountName?: string;
  debit: number;
  credit: number;
  description: string | null;
}

interface JournalEntry {
  id: number;
  entryNumber: string;
  entryDate: string;
  fiscalPeriodId: number | null;
  description: string | null;
  sourceType: string | null;
  sourceId: number | null;
  status: 'draft' | 'posted' | 'reversed';
  totalDebit: number;
  totalCredit: number;
  postedBy: number | null;
  postedAt: string | null;
  lines?: JournalLine[];
}

interface GLAccount {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string;
}

interface FormData {
  entryDate: string;
  description: string;
  lines: {
    glAccountId: number | null;
    debit: number;
    credit: number;
    description: string;
  }[];
}

// API functions
async function fetchJournalEntries(filters?: { status?: string; sourceType?: string }): Promise<JournalEntry[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.sourceType) params.append('sourceType', filters.sourceType);
  const res = await fetch(`/api/accounting/journal-entries?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch entries');
  const json = await res.json();
  return json.data;
}

async function fetchJournalEntryById(id: number): Promise<JournalEntry> {
  const res = await fetch(`/api/accounting/journal-entries/${id}`);
  if (!res.ok) throw new Error('Failed to fetch entry');
  const json = await res.json();
  return json.data;
}

async function fetchGLAccounts(): Promise<GLAccount[]> {
  const res = await fetch('/api/accounting/gl-accounts?isActive=true&isPostable=true');
  if (!res.ok) throw new Error('Failed to fetch accounts');
  const json = await res.json();
  return json.data;
}

interface CreateJournalEntryData {
  entryDate: string;
  description: string | null;
  sourceType: string;
  lines: {
    glAccountId: number;
    debit: number;
    credit: number;
    description: string;
  }[];
}

async function createJournalEntry(data: CreateJournalEntryData): Promise<JournalEntry> {
  const res = await fetch('/api/accounting/journal-entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to create entry');
  }
  return (await res.json()).data;
}

async function postJournalEntry(id: number): Promise<JournalEntry> {
  const res = await fetch(`/api/accounting/journal-entries/${id}/post`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to post entry');
  }
  return (await res.json()).data;
}

async function reverseJournalEntry(id: number): Promise<JournalEntry> {
  const res = await fetch(`/api/accounting/journal-entries/${id}/reverse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Manual reversal' }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to reverse entry');
  }
  return (await res.json()).data;
}

export default function JournalEntriesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    entryDate: new Date().toISOString().split('T')[0],
    description: '',
    lines: [
      { glAccountId: null, debit: 0, credit: 0, description: '' },
      { glAccountId: null, debit: 0, credit: 0, description: '' },
    ],
  });

  // Queries
  const { data: entries = [] } = useQuery({
    queryKey: ['journal-entries', statusFilter, sourceTypeFilter],
    queryFn: () =>
      fetchJournalEntries({
        status: statusFilter || undefined,
        sourceType: sourceTypeFilter || undefined,
      }),
  });

  const { data: glAccounts = [] } = useQuery({
    queryKey: ['gl-accounts'],
    queryFn: fetchGLAccounts,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createJournalEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      notify('สร้างรายการบันทึกบัญชีสำเร็จ', 'success', 3000);
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      notify(error.message || 'ไม่สามารถสร้างรายการได้', 'error', 4000);
    },
  });

  const postMutation = useMutation({
    mutationFn: postJournalEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      notify('ผ่านรายการบันทึกบัญชีแล้ว', 'success', 3000);
    },
    onError: (error: Error) => {
      notify(error.message || 'ไม่สามารถผ่านรายการได้', 'error', 4000);
    },
  });

  const reverseMutation = useMutation({
    mutationFn: reverseJournalEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      notify('กลับรายการบันทึกบัญชีแล้ว', 'success', 3000);
    },
    onError: (error: Error) => {
      notify(error.message || 'ไม่สามารถกลับรายการได้', 'error', 4000);
    },
  });

  // Handlers
  const resetForm = useCallback(() => {
    setFormData({
      entryDate: new Date().toISOString().split('T')[0],
      description: '',
      lines: [
        { glAccountId: null, debit: 0, credit: 0, description: '' },
        { glAccountId: null, debit: 0, credit: 0, description: '' },
      ],
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
    const validLines = formData.lines.filter(
      (l) => l.glAccountId && (l.debit > 0 || l.credit > 0)
    );

    if (validLines.length < 2) {
      notify('กรุณาเพิ่มรายการอย่างน้อย 2 รายการ', 'warning', 3000);
      return;
    }

    const totalDebit = validLines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = validLines.reduce((sum, l) => sum + l.credit, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      notify('ยอดเดบิตและเครดิตไม่เท่ากัน', 'error', 3000);
      return;
    }

    createMutation.mutate({
      entryDate: formData.entryDate,
      description: formData.description || null,
      sourceType: 'MANUAL',
      lines: validLines,
    });
  }, [formData, createMutation]);

  const handlePost = useCallback(
    async (entry: JournalEntry) => {
      const result = await confirm(
        `คุณต้องการผ่านรายการบันทึก ${entry.entryNumber} หรือไม่?`,
        'ยืนยันการผ่านรายการ'
      );
      if (result) {
        postMutation.mutate(entry.id);
      }
    },
    [postMutation]
  );

  const handleReverse = useCallback(
    async (entry: JournalEntry) => {
      const result = await confirm(
        `คุณต้องการกลับรายการ ${entry.entryNumber} หรือไม่?<br/>ระบบจะสร้างรายการกลับอัตโนมัติ`,
        'ยืนยันการกลับรายการ'
      );
      if (result) {
        reverseMutation.mutate(entry.id);
      }
    },
    [reverseMutation]
  );

  const addLine = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      lines: [...prev.lines, { glAccountId: null, debit: 0, credit: 0, description: '' }],
    }));
  }, []);

  const removeLine = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  }, []);

  const updateLine = useCallback((index: number, field: string, value: number | string | null) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) =>
        i === index ? { ...line, [field]: value } : line
      ),
    }));
  }, []);

  // Calculate totals
  const totalDebit = useMemo(() => {
    return formData.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  }, [formData.lines]);

  const totalCredit = useMemo(() => {
    return formData.lines.reduce((sum, l) => sum + (l.credit || 0), 0);
  }, [formData.lines]);

  const isBalanced = useMemo(() => {
    return Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;
  }, [totalDebit, totalCredit]);

  // Status badge render
  const statusCellRender = useCallback((cellData: { value: 'draft' | 'posted' | 'reversed' }) => {
    return <AccountingStatusBadge status={cellData.value} />;
  }, []);

  // Source type label
  const sourceTypeCellRender = useCallback((cellData: { value: string | null }) => {
    const typeMap: Record<string, string> = {
      MANUAL: 'บันทึกมือ',
      PO_RECEIPT: 'รับสินค้า',
      SO_SHIPMENT: 'ส่งสินค้า',
      AP_PAYMENT: 'จ่ายเงิน',
      AR_RECEIPT: 'รับเงิน',
      DEPRECIATION: 'ค่าเสื่อม',
      PAYROLL: 'เงินเดือน',
      COST_ALLOCATION: 'จัดสรรต้นทุน',
      PERIOD_CLOSE: 'ปิดงวด',
    };
    return typeMap[cellData.value] || cellData.value || '-';
  }, []);

  // Action buttons render
  const actionsCellRender = useCallback(
    (cellData: { data: JournalEntry }) => {
      const entry = cellData.data as JournalEntry;
      return (
        <div style={{ display: 'flex', gap: '4px' }}>
          {entry.status === 'draft' && (
            <Button
              text="ผ่าน"
              type="success"
              stylingMode="outlined"
              height={24}
              onClick={() => handlePost(entry)}
            />
          )}
          {entry.status === 'posted' && (
            <Button
              text="กลับ"
              type="danger"
              stylingMode="outlined"
              height={24}
              onClick={() => handleReverse(entry)}
            />
          )}
        </div>
      );
    },
    [handlePost, handleReverse]
  );

  // Master-detail for journal lines
  const renderDetail = useCallback((props: { data: { key: number } }) => {
    const { key } = props.data;
    return <JournalLinesDetail entryId={key} />;
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const total = entries.length;
    const draft = entries.filter((e) => e.status === 'draft').length;
    const posted = entries.filter((e) => e.status === 'posted').length;
    const reversed = entries.filter((e) => e.status === 'reversed').length;

    return { total, draft, posted, reversed };
  }, [entries]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
  }, [queryClient]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <AccountingPageHeader
        title="รายการบันทึกบัญชี"
        subtitle="Journal Entries"
        icon="file-text"
        onRefresh={handleRefresh}
        actions={
          <Button
            text="เพิ่มรายการ"
            icon="plus"
            type="success"
            onClick={handleOpenDialog}
          />
        }
      />

      <div className="p-4 md:p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AccountingKPICard
            label="รายการทั้งหมด"
            value={stats.total}
            icon="file-text"
            variant="info"
          />
          <AccountingKPICard
            label="ร่าง"
            value={stats.draft}
            icon="clock"
            variant="default"
          />
          <AccountingKPICard
            label="ผ่านแล้ว"
            value={stats.posted}
            icon="check-circle"
            variant="success"
          />
          <AccountingKPICard
            label="กลับรายการ"
            value={stats.reversed}
            icon="arrow-down"
            variant="danger"
          />
        </div>

        {/* Filter Panel */}
        <AccountingFilterPanel>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              สถานะ
            </label>
            <SelectBox
              dataSource={[
                { value: '', label: 'ทั้งหมด' },
                { value: 'draft', label: 'ร่าง' },
                { value: 'posted', label: 'ผ่านแล้ว' },
                { value: 'reversed', label: 'กลับรายการ' },
              ]}
              displayExpr="label"
              valueExpr="value"
              value={statusFilter}
              onValueChanged={(e) => setStatusFilter(e.value)}
              placeholder="กรองสถานะ"
              width={150}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              ประเภท
            </label>
            <SelectBox
              dataSource={[
                { value: '', label: 'ทุกประเภท' },
                { value: 'MANUAL', label: 'บันทึกมือ' },
                { value: 'PO_RECEIPT', label: 'รับสินค้า' },
                { value: 'SO_SHIPMENT', label: 'ส่งสินค้า' },
                { value: 'AP_PAYMENT', label: 'จ่ายเงิน' },
                { value: 'AR_RECEIPT', label: 'รับเงิน' },
              ]}
              displayExpr="label"
              valueExpr="value"
              value={sourceTypeFilter}
              onValueChanged={(e) => setSourceTypeFilter(e.value)}
              placeholder="กรองประเภท"
              width={180}
            />
          </div>
        </AccountingFilterPanel>

        {/* Data Grid */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200">
          <DataGrid
            dataSource={entries}
            keyExpr="id"
            showBorders={false}
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

          <MasterDetail enabled={true} component={renderDetail} />

          <Toolbar>
            <Item name="searchPanel" location="before" />
            <Item name="exportButton" location="after" />
            <Item name="columnChooserButton" location="after" />
          </Toolbar>

          <Column dataField="entryNumber" caption="เลขที่รายการ" width={160} />
          <Column dataField="entryDate" caption="วันที่" dataType="date" width={110} />
          <Column
            dataField="sourceType"
            caption="ประเภท"
            width={110}
            cellRender={sourceTypeCellRender}
          />
          <Column dataField="description" caption="รายละเอียด" minWidth={200} />
          <Column
            dataField="totalDebit"
            caption="เดบิต"
            dataType="number"
            width={120}
            alignment="right"
          >
            <Format type="fixedPoint" precision={2} />
          </Column>
          <Column
            dataField="totalCredit"
            caption="เครดิต"
            dataType="number"
            width={120}
            alignment="right"
          >
            <Format type="fixedPoint" precision={2} />
          </Column>
          <Column
            dataField="status"
            caption="สถานะ"
            width={100}
            cellRender={statusCellRender}
          />
          <Column
            caption="การดำเนินการ"
            width={100}
            cellRender={actionsCellRender}
            allowFiltering={false}
            allowSorting={false}
          />

          <Summary>
            <TotalItem column="totalDebit" summaryType="sum" displayFormat="รวม: {0}">
              <Format type="fixedPoint" precision={2} />
            </TotalItem>
            <TotalItem column="totalCredit" summaryType="sum" displayFormat="รวม: {0}">
              <Format type="fixedPoint" precision={2} />
            </TotalItem>
          </Summary>
          </DataGrid>
        </div>
      </div>

      {/* Add Entry Dialog */}
      <Popup
        visible={isDialogOpen}
        onHiding={handleCloseDialog}
        title="เพิ่มรายการบันทึกบัญชี"
        width={900}
        height="auto"
        showCloseButton={true}
        dragEnabled={true}
      >
        <div className="p-4">
          <Form formData={formData} labelLocation="top" showColonAfterLabel={true}>
            <GroupItem colCount={2}>
              <SimpleItem
                dataField="entryDate"
                editorType="dxDateBox"
                label={{ text: 'วันที่' }}
                editorOptions={{ type: 'date', displayFormat: 'dd/MM/yyyy' }}
              >
                <RequiredRule message="กรุณาเลือกวันที่" />
              </SimpleItem>
              <SimpleItem
                dataField="description"
                label={{ text: 'รายละเอียด' }}
                editorOptions={{ placeholder: 'คำอธิบายรายการ' }}
              />
            </GroupItem>
          </Form>

          {/* Line Items */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">รายการบัญชี</h3>
              <Button text="เพิ่มบรรทัด" icon="plus" type="default" onClick={addLine} />
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">บัญชี</th>
                  <th className="border p-2 text-left" style={{ width: 200 }}>
                    รายละเอียด
                  </th>
                  <th className="border p-2 text-right" style={{ width: 130 }}>
                    เดบิต
                  </th>
                  <th className="border p-2 text-right" style={{ width: 130 }}>
                    เครดิต
                  </th>
                  <th className="border p-2" style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {formData.lines.map((line, index) => (
                  <tr key={index}>
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
                        type="text"
                        className="w-full p-1 border rounded"
                        value={line.description}
                        onChange={(e) => updateLine(index, 'description', e.target.value)}
                        placeholder="รายละเอียด"
                      />
                    </td>
                    <td className="border p-1">
                      <input
                        type="number"
                        className="w-full p-1 border rounded text-right"
                        value={line.debit || ''}
                        onChange={(e) =>
                          updateLine(index, 'debit', Number(e.target.value) || 0)
                        }
                        onFocus={() => line.credit > 0 && updateLine(index, 'credit', 0)}
                        min={0}
                      />
                    </td>
                    <td className="border p-1">
                      <input
                        type="number"
                        className="w-full p-1 border rounded text-right"
                        value={line.credit || ''}
                        onChange={(e) =>
                          updateLine(index, 'credit', Number(e.target.value) || 0)
                        }
                        onFocus={() => line.debit > 0 && updateLine(index, 'debit', 0)}
                        min={0}
                      />
                    </td>
                    <td className="border p-1 text-center">
                      {formData.lines.length > 2 && (
                        <Button icon="trash" type="danger" stylingMode="text" onClick={() => removeLine(index)} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={`${isBalanced ? 'bg-green-50' : 'bg-red-50'}`}>
                  <td colSpan={2} className="border p-2 text-right font-bold">
                    รวม
                  </td>
                  <td className="border p-2 text-right font-bold">
                    {totalDebit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="border p-2 text-right font-bold">
                    {totalCredit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="border"></td>
                </tr>
                <tr>
                  <td colSpan={5} className="border p-2 text-center">
                    {isBalanced ? (
                      <span className="text-green-600">ยอดเดบิตและเครดิตเท่ากัน</span>
                    ) : (
                      <span className="text-red-600">
                        ผลต่าง: {Math.abs(totalDebit - totalCredit).toLocaleString('th-TH', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    )}
                  </td>
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
              disabled={createMutation.isPending || !isBalanced}
            />
          </div>
        </div>
      </Popup>
    </div>
  );
}

// Journal Lines Detail Component
function JournalLinesDetail({ entryId }: { entryId: number }) {
  const { data: entry, isLoading } = useQuery({
    queryKey: ['journal-entry', entryId],
    queryFn: () => fetchJournalEntryById(entryId),
  });

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  if (!entry || !entry.lines) {
    return <div className="p-4">No lines found</div>;
  }

  return (
    <div className="p-4 bg-gray-50">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2 text-left">บัญชี</th>
            <th className="border p-2 text-left">รายละเอียด</th>
            <th className="border p-2 text-right" style={{ width: 120 }}>
              เดบิต
            </th>
            <th className="border p-2 text-right" style={{ width: 120 }}>
              เครดิต
            </th>
          </tr>
        </thead>
        <tbody>
          {entry.lines.map((line) => (
            <tr key={line.id}>
              <td className="border p-2">
                {line.accountCode} - {line.accountName}
              </td>
              <td className="border p-2">{line.description || '-'}</td>
              <td className="border p-2 text-right">
                {line.debit > 0 ? line.debit.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : ''}
              </td>
              <td className="border p-2 text-right">
                {line.credit > 0 ? line.credit.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

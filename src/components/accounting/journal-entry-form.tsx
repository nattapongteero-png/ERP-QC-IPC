'use client';

/**
 * Journal Entry Form Component
 * Shared component for create and edit modes following the template pattern
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from 'devextreme-react/button';
import { Trash2 } from 'lucide-react';
import { AuditLogViewerDialog } from '@/components/shared/AuditLogViewerDialog';
import { AccountingStatusBadge } from './accounting-status-badge';

// DevExtreme imports
import SelectBox from 'devextreme-react/select-box';
import NumberBox from 'devextreme-react/number-box';
import TextBox from 'devextreme-react/text-box';
import DateBox from 'devextreme-react/date-box';
import LoadIndicator from 'devextreme-react/load-indicator';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';

// Types
interface JournalLine {
  id?: number;
  lineNumber?: number;
  glAccountId: number | null;
  accountCode?: string;
  accountName?: string;
  debit: number;
  credit: number;
  description: string;
  costCenterId?: number | null;
}

interface JournalEntry {
  id: number;
  entryNumber: string;
  entryDate: string;
  fiscalPeriodId: number | null;
  description: string | null;
  referenceNumber?: string | null;
  sourceType: string | null;
  sourceId: number | null;
  status: 'draft' | 'posted' | 'reversed';
  totalDebit: number;
  totalCredit: number;
  postedBy: number | null;
  postedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  lines?: JournalLine[];
}

interface GLAccount {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string;
}

interface CostCenter {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  type: string;
}

export interface JournalEntryFormProps {
  mode: 'create' | 'edit';
  entryId?: number;
  onSuccess?: (entry: JournalEntry) => void;
  onCancel?: () => void;
}

interface FormData {
  entryDate: Date | null;
  description: string;
  referenceNumber: string;
  lines: {
    glAccountId: number | null;
    debit: number;
    credit: number;
    description: string;
    costCenterId: number | null;
  }[];
}

// API functions
async function fetchJournalEntry(id: number): Promise<JournalEntry> {
  const res = await fetch(`/api/accounting/journal-entries/${id}`);
  if (!res.ok) throw new Error('Failed to fetch entry');
  const json = await res.json();
  return json.data;
}

async function fetchGLAccounts(): Promise<GLAccount[]> {
  const res = await fetch('/api/accounting/gl-accounts?isActive=true&isPostable=true');
  if (!res.ok) throw new Error('Failed to fetch accounts');
  const json = await res.json();
  return json.data || [];
}

async function fetchCostCenters(): Promise<CostCenter[]> {
  const res = await fetch('/api/hr/org-units?type=department,section,unit');
  if (!res.ok) throw new Error('Failed to fetch cost centers');
  const json = await res.json();
  return json.data || [];
}

interface CreateJournalEntryData {
  entryDate: string;
  description: string | null;
  referenceNumber?: string | null;
  sourceType: string;
  lines: {
    glAccountId: number;
    debit: number;
    credit: number;
    description: string;
    costCenterId?: number | null;
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

async function updateJournalEntry(id: number, data: Partial<CreateJournalEntryData>): Promise<JournalEntry> {
  const res = await fetch(`/api/accounting/journal-entries/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to update entry');
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

async function reverseJournalEntry(id: number, reason: string): Promise<JournalEntry> {
  const res = await fetch(`/api/accounting/journal-entries/${id}/reverse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to reverse entry');
  }
  return (await res.json()).data;
}

// Helper function to format date
function formatDateForApi(date: Date | null): string {
  if (!date) return new Date().toISOString().split('T')[0];
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Source type labels
const sourceTypeLabels: Record<string, string> = {
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

const defaultFormData: FormData = {
  entryDate: new Date(),
  description: '',
  referenceNumber: '',
  lines: [
    { glAccountId: null, debit: 0, credit: 0, description: '', costCenterId: null },
    { glAccountId: null, debit: 0, credit: 0, description: '', costCenterId: null },
  ],
};

export function JournalEntryForm({
  mode,
  entryId,
  onSuccess,
  onCancel,
}: JournalEntryFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState<FormData>(defaultFormData);
  const [showAuditLog, setShowAuditLog] = React.useState(false);

  // Fetch GL accounts
  const { data: glAccounts = [] } = useQuery({
    queryKey: ['gl-accounts'],
    queryFn: fetchGLAccounts,
  });

  // Fetch cost centers
  const { data: costCenters = [] } = useQuery({
    queryKey: ['cost-centers'],
    queryFn: fetchCostCenters,
  });

  // Fetch entry for edit mode
  const { data: existingEntry, isLoading: isLoadingEntry } = useQuery({
    queryKey: ['journal-entry', entryId],
    queryFn: () => fetchJournalEntry(entryId!),
    enabled: mode === 'edit' && !!entryId,
  });

  // Set form data when entry is loaded
  React.useEffect(() => {
    if (existingEntry) {
      setFormData({
        entryDate: new Date(existingEntry.entryDate),
        description: existingEntry.description || '',
        referenceNumber: existingEntry.referenceNumber || '',
        lines: existingEntry.lines?.map((line) => ({
          glAccountId: line.glAccountId,
          debit: line.debit,
          credit: line.credit,
          description: line.description || '',
          costCenterId: line.costCenterId || null,
        })) || [
          { glAccountId: null, debit: 0, credit: 0, description: '', costCenterId: null },
          { glAccountId: null, debit: 0, credit: 0, description: '', costCenterId: null },
        ],
      });
    }
  }, [existingEntry]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createJournalEntry,
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      notify('สร้างรายการบันทึกบัญชีสำเร็จ', 'success', 3000);
      if (onSuccess) {
        onSuccess(entry);
      } else {
        router.push('/accounting/journal-entries');
      }
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateJournalEntryData>) => updateJournalEntry(entryId!, data),
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entry', entryId] });
      notify('บันทึกการแก้ไขสำเร็จ', 'success', 3000);
      if (onSuccess) {
        onSuccess(entry);
      } else {
        router.push('/accounting/journal-entries');
      }
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Post mutation
  const postMutation = useMutation({
    mutationFn: () => postJournalEntry(entryId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entry', entryId] });
      notify('ผ่านรายการบันทึกบัญชีแล้ว', 'success', 3000);
      router.push('/accounting/journal-entries');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Reverse mutation
  const reverseMutation = useMutation({
    mutationFn: (reason: string) => reverseJournalEntry(entryId!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entry', entryId] });
      notify('กลับรายการบันทึกบัญชีแล้ว', 'success', 3000);
      router.push('/accounting/journal-entries');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Calculate totals
  const totalDebit = React.useMemo(() => {
    return formData.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  }, [formData.lines]);

  const totalCredit = React.useMemo(() => {
    return formData.lines.reduce((sum, l) => sum + (l.credit || 0), 0);
  }, [formData.lines]);

  const isBalanced = React.useMemo(() => {
    return Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;
  }, [totalDebit, totalCredit]);

  // Line handlers
  const addLine = React.useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      lines: [...prev.lines, { glAccountId: null, debit: 0, credit: 0, description: '', costCenterId: null }],
    }));
  }, []);

  const removeLine = React.useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  }, []);

  const updateLine = React.useCallback((index: number, field: string, value: number | string | null) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) =>
        i === index ? { ...line, [field]: value } : line
      ),
    }));
  }, []);

  const handleSubmit = () => {
    const validLines = formData.lines
      .filter((l) => l.glAccountId && (l.debit > 0 || l.credit > 0))
      .map((l) => ({
        glAccountId: l.glAccountId as number,
        debit: l.debit,
        credit: l.credit,
        description: l.description,
        costCenterId: l.costCenterId,
      }));

    if (validLines.length < 2) {
      notify('กรุณาเพิ่มรายการอย่างน้อย 2 รายการ', 'warning', 3000);
      return;
    }

    if (!isBalanced) {
      notify('ยอดเดบิตและเครดิตไม่เท่ากัน', 'error', 3000);
      return;
    }

    const data = {
      entryDate: formatDateForApi(formData.entryDate),
      description: formData.description || null,
      referenceNumber: formData.referenceNumber || null,
      sourceType: 'MANUAL',
      lines: validLines,
    };

    if (mode === 'create') {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  const handlePost = async () => {
    const result = await confirm(
      'คุณต้องการผ่านรายการบันทึกนี้หรือไม่?',
      'ยืนยันการผ่านรายการ'
    );
    if (result) {
      postMutation.mutate();
    }
  };

  const handleReverse = async () => {
    const result = await confirm(
      'คุณต้องการกลับรายการนี้หรือไม่?<br/>ระบบจะสร้างรายการกลับอัตโนมัติ',
      'ยืนยันการกลับรายการ'
    );
    if (result) {
      reverseMutation.mutate('Manual reversal from form');
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isPosting = postMutation.isPending;
  const isReversing = reverseMutation.isPending;
  const isReadOnly = mode === 'edit' && existingEntry?.status !== 'draft';

  if (mode === 'edit' && isLoadingEntry) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-3 text-gray-500">
            <LoadIndicator height={24} width={24} />
            <span>กำลังโหลดข้อมูล...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            text="ย้อนกลับ"
            icon="back"
            stylingMode="text"
            onClick={handleCancel}
          />
          <div className="h-6 w-px bg-gray-200" />
          <h1 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'สร้างรายการบันทึกบัญชี' : `รายการ: ${existingEntry?.entryNumber}`}
          </h1>
          {mode === 'edit' && existingEntry && (
            <AccountingStatusBadge status={existingEntry.status} />
          )}
        </div>
        <div className="flex items-center gap-2">
          {mode === 'edit' && existingEntry?.status === 'draft' && (
            <Button
              text="ผ่านรายการ"
              icon={isPosting ? 'spindown' : 'check'}
              type="success"
              stylingMode="outlined"
              onClick={handlePost}
              disabled={isPosting}
            />
          )}
          {mode === 'edit' && existingEntry?.status === 'posted' && (
            <Button
              text="กลับรายการ"
              icon={isReversing ? 'spindown' : 'revert'}
              type="danger"
              stylingMode="outlined"
              onClick={handleReverse}
              disabled={isReversing}
            />
          )}
          <Button
            text="ยกเลิก"
            icon="close"
            stylingMode="outlined"
            onClick={handleCancel}
            disabled={isSubmitting}
          />
          {!isReadOnly && (
            <Button
              text={mode === 'create' ? 'บันทึก' : 'บันทึกการแก้ไข'}
              icon={isSubmitting ? 'spindown' : 'save'}
              type="success"
              onClick={handleSubmit}
              disabled={isSubmitting || !isBalanced}
            />
          )}
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Form - 3/4 width */}
        <div className="lg:col-span-3 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ข้อมูลทั่วไป</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    วันที่ <span className="text-red-500">*</span>
                  </label>
                  <DateBox
                    value={formData.entryDate}
                    onValueChanged={(e) => setFormData((prev) => ({ ...prev, entryDate: e.value }))}
                    type="date"
                    displayFormat="dd/MM/yyyy"
                    readOnly={isReadOnly}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    เลขที่อ้างอิง
                  </label>
                  <TextBox
                    value={formData.referenceNumber}
                    onValueChanged={(e) => setFormData((prev) => ({ ...prev, referenceNumber: e.value || '' }))}
                    placeholder="เลขที่เอกสารอ้างอิง"
                    readOnly={isReadOnly}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    รายละเอียด
                  </label>
                  <TextBox
                    value={formData.description}
                    onValueChanged={(e) => setFormData((prev) => ({ ...prev, description: e.value || '' }))}
                    placeholder="คำอธิบายรายการ"
                    readOnly={isReadOnly}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Journal Lines */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">รายการบัญชี</CardTitle>
                {!isReadOnly && (
                  <Button
                    text="เพิ่มบรรทัด"
                    icon="plus"
                    type="default"
                    stylingMode="outlined"
                    onClick={addLine}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-200 p-2 text-left font-medium">บัญชี</th>
                      <th className="border border-gray-200 p-2 text-left font-medium" style={{ width: 150 }}>
                        ศูนย์ต้นทุน
                      </th>
                      <th className="border border-gray-200 p-2 text-left font-medium" style={{ width: 180 }}>
                        รายละเอียด
                      </th>
                      <th className="border border-gray-200 p-2 text-right font-medium" style={{ width: 130 }}>
                        เดบิต
                      </th>
                      <th className="border border-gray-200 p-2 text-right font-medium" style={{ width: 130 }}>
                        เครดิต
                      </th>
                      {!isReadOnly && (
                        <th className="border border-gray-200 p-2" style={{ width: 50 }}></th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {formData.lines.map((line, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="border border-gray-200 p-1">
                          <SelectBox
                            dataSource={glAccounts}
                            displayExpr={(item) => item ? `${item.code} - ${item.nameTh}` : ''}
                            valueExpr="id"
                            value={line.glAccountId}
                            onValueChanged={(e) => updateLine(index, 'glAccountId', e.value)}
                            placeholder="เลือกบัญชี"
                            searchEnabled
                            showClearButton={!isReadOnly}
                            readOnly={isReadOnly}
                          />
                        </td>
                        <td className="border border-gray-200 p-1">
                          <SelectBox
                            dataSource={costCenters}
                            displayExpr={(item) => item ? `${item.code} - ${item.name}` : ''}
                            valueExpr="id"
                            value={line.costCenterId}
                            onValueChanged={(e) => updateLine(index, 'costCenterId', e.value)}
                            placeholder="- ไม่ระบุ -"
                            searchEnabled
                            showClearButton={!isReadOnly}
                            readOnly={isReadOnly}
                          />
                        </td>
                        <td className="border border-gray-200 p-1">
                          <TextBox
                            value={line.description}
                            onValueChanged={(e) => updateLine(index, 'description', e.value || '')}
                            placeholder="รายละเอียด"
                            readOnly={isReadOnly}
                          />
                        </td>
                        <td className="border border-gray-200 p-1">
                          <NumberBox
                            value={line.debit || 0}
                            onValueChanged={(e) => updateLine(index, 'debit', e.value || 0)}
                            onFocusIn={() => line.credit > 0 && !isReadOnly && updateLine(index, 'credit', 0)}
                            min={0}
                            format="#,##0.00"
                            readOnly={isReadOnly}
                          />
                        </td>
                        <td className="border border-gray-200 p-1">
                          <NumberBox
                            value={line.credit || 0}
                            onValueChanged={(e) => updateLine(index, 'credit', e.value || 0)}
                            onFocusIn={() => line.debit > 0 && !isReadOnly && updateLine(index, 'debit', 0)}
                            min={0}
                            format="#,##0.00"
                            readOnly={isReadOnly}
                          />
                        </td>
                        {!isReadOnly && (
                          <td className="border border-gray-200 p-1 text-center">
                            {formData.lines.length > 2 && (
                              <button
                                onClick={() => removeLine(index)}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="ลบ"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className={`font-bold ${isBalanced ? 'bg-green-50' : 'bg-red-50'}`}>
                      <td colSpan={3} className="border border-gray-200 p-2 text-right">
                        รวม
                      </td>
                      <td className="border border-gray-200 p-2 text-right font-mono">
                        {totalDebit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="border border-gray-200 p-2 text-right font-mono">
                        {totalCredit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      {!isReadOnly && <td className="border border-gray-200"></td>}
                    </tr>
                    <tr>
                      <td colSpan={isReadOnly ? 5 : 6} className="border border-gray-200 p-2 text-center">
                        {isBalanced ? (
                          <span className="text-green-600 font-medium">
                            ✓ ยอดเดบิตและเครดิตเท่ากัน
                          </span>
                        ) : (
                          <span className="text-red-600 font-medium">
                            ✗ ผลต่าง: {Math.abs(totalDebit - totalCredit).toLocaleString('th-TH', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - 1/4 width */}
        <div className="space-y-6">
          {/* Entry Info - only show in edit mode */}
          {mode === 'edit' && existingEntry && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ข้อมูลรายการ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">เลขที่</span>
                  <span className="font-mono text-gray-900">{existingEntry.entryNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ประเภท</span>
                  <span className="text-gray-900">
                    {existingEntry.sourceType ? sourceTypeLabels[existingEntry.sourceType] || existingEntry.sourceType : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">สถานะ</span>
                  <AccountingStatusBadge status={existingEntry.status} />
                </div>
                {existingEntry.postedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">ผ่านรายการเมื่อ</span>
                    <span className="text-gray-900">
                      {new Date(existingEntry.postedAt).toLocaleDateString('th-TH')}
                    </span>
                  </div>
                )}
                {existingEntry.createdAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">สร้างเมื่อ</span>
                    <span className="text-gray-900">
                      {new Date(existingEntry.createdAt).toLocaleDateString('th-TH')}
                    </span>
                  </div>
                )}
                {existingEntry.updatedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">แก้ไขล่าสุด</span>
                    <span className="text-gray-900">
                      {new Date(existingEntry.updatedAt).toLocaleDateString('th-TH')}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t">
                  <Button
                    text="ประวัติการเปลี่ยนแปลง"
                    icon="clock"
                    stylingMode="outlined"
                    type="default"
                    width="100%"
                    onClick={() => setShowAuditLog(true)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">สรุปยอด</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-blue-700">ยอดเดบิต</span>
                <span className="font-mono font-semibold text-blue-900">
                  {totalDebit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <span className="text-purple-700">ยอดเครดิต</span>
                <span className="font-mono font-semibold text-purple-900">
                  {totalCredit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className={`flex justify-between items-center p-3 rounded-lg ${
                isBalanced ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <span className={isBalanced ? 'text-green-700' : 'text-red-700'}>
                  ผลต่าง
                </span>
                <span className={`font-mono font-semibold ${
                  isBalanced ? 'text-green-900' : 'text-red-900'
                }`}>
                  {Math.abs(totalDebit - totalCredit).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">คำแนะนำ</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-2">
              <p>• ยอดเดบิตและเครดิตต้องเท่ากัน</p>
              <p>• ต้องมีอย่างน้อย 2 รายการ</p>
              <p>• รายการที่ผ่านแล้วจะแก้ไขไม่ได้</p>
              <p>• ใช้ &quot;กลับรายการ&quot; เพื่อยกเลิก</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Audit Log Dialog */}
      {mode === 'edit' && entryId && (
        <AuditLogViewerDialog
          entityType="journalEntries"
          entityId={entryId}
          visible={showAuditLog}
          onClose={() => setShowAuditLog(false)}
          title={`ประวัติการเปลี่ยนแปลง: ${existingEntry?.entryNumber || ''}`}
          fieldLabels={{
            entryNumber: 'เลขที่รายการ',
            entryDate: 'วันที่',
            description: 'รายละเอียด',
            referenceNumber: 'เลขที่อ้างอิง',
            sourceType: 'ประเภท',
            status: 'สถานะ',
            totalDebit: 'ยอดเดบิต',
            totalCredit: 'ยอดเครดิต',
          }}
        />
      )}
    </div>
  );
}

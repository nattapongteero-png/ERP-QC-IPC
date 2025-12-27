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
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

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

interface GLAccountType {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string;
  category: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  normalBalance: 'debit' | 'credit';
}

interface GLAccount {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string;
  accountType?: GLAccountType;
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
  const res = await fetch('/api/accounting/cost-centers');
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

  // Custom confirm dialog state
  const [confirmDialog, setConfirmDialog] = React.useState<{
    visible: boolean;
    title: string;
    message: string;
    testIdPrefix: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    testIdPrefix: 'confirm-dialog',
    onConfirm: () => {},
  });
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

  // Compute line-level validation errors
  const getLineValidationError = React.useCallback((line: FormData['lines'][0]): string | null => {
    // Check if line has both debit and credit
    if (line.debit > 0 && line.credit > 0) {
      return 'ต้องเป็นเดบิตหรือเครดิตอย่างใดอย่างหนึ่ง';
    }
    // Check if line has amount but no account
    if ((line.debit > 0 || line.credit > 0) && !line.glAccountId) {
      return 'กรุณาเลือกบัญชี';
    }
    // Check if line has account but no amount
    if (line.glAccountId && line.debit === 0 && line.credit === 0) {
      return 'กรุณาระบุยอดเงิน';
    }
    return null;
  }, []);

  // Check if the entry is valid for submission
  const isValidForSubmit = React.useMemo(() => {
    const validLines = formData.lines.filter(
      (l) => l.glAccountId && (l.debit > 0 || l.credit > 0) && !(l.debit > 0 && l.credit > 0)
    );
    return validLines.length >= 2 &&
      validLines.some((l) => l.debit > 0) &&
      validLines.some((l) => l.credit > 0) &&
      isBalanced;
  }, [formData.lines, isBalanced]);

  // Detect duplicate accounts on the same side (debit or credit)
  const getDuplicateAccountWarnings = React.useCallback((): string[] => {
    const warnings: string[] = [];
    const debitAccounts: Record<number, number> = {};
    const creditAccounts: Record<number, number> = {};

    formData.lines.forEach((line) => {
      if (line.glAccountId) {
        if (line.debit > 0) {
          debitAccounts[line.glAccountId] = (debitAccounts[line.glAccountId] || 0) + 1;
        }
        if (line.credit > 0) {
          creditAccounts[line.glAccountId] = (creditAccounts[line.glAccountId] || 0) + 1;
        }
      }
    });

    // Find accounts used more than once on debit side
    Object.entries(debitAccounts).forEach(([accountId, count]) => {
      if (count > 1) {
        const account = glAccounts.find((a) => a.id === Number(accountId));
        if (account) {
          warnings.push(`บัญชี "${account.code} - ${account.nameTh}" ถูกใช้ฝั่งเดบิต ${count} ครั้ง`);
        }
      }
    });

    // Find accounts used more than once on credit side
    Object.entries(creditAccounts).forEach(([accountId, count]) => {
      if (count > 1) {
        const account = glAccounts.find((a) => a.id === Number(accountId));
        if (account) {
          warnings.push(`บัญชี "${account.code} - ${account.nameTh}" ถูกใช้ฝั่งเครดิต ${count} ครั้ง`);
        }
      }
    });

    return warnings;
  }, [formData.lines, glAccounts]);

  // Check for accounts used against their normal balance
  const getNormalBalanceWarnings = React.useCallback((): string[] => {
    // Category labels for Thai display
    const catLabels: Record<string, string> = {
      asset: 'สินทรัพย์',
      liability: 'หนี้สิน',
      equity: 'ส่วนของเจ้าของ',
      revenue: 'รายได้',
      expense: 'ค่าใช้จ่าย',
    };
    const warnings: string[] = [];

    formData.lines.forEach((line, index) => {
      if (!line.glAccountId) return;

      const account = glAccounts.find((a) => a.id === line.glAccountId);
      if (!account?.accountType) return;

      const { category, normalBalance } = account.accountType;
      const isDebit = line.debit > 0;
      const isCredit = line.credit > 0;

      // Debit-normal accounts (asset, expense) should usually be debited
      // Credit-normal accounts (liability, equity, revenue) should usually be credited
      if (normalBalance === 'debit' && isCredit) {
        warnings.push(
          `บรรทัด ${index + 1}: บัญชี "${account.code}" (${catLabels[category] || category}) ` +
          `ปกติเป็นเดบิต แต่ถูกบันทึกเครดิต - กรุณาตรวจสอบ`
        );
      } else if (normalBalance === 'credit' && isDebit) {
        warnings.push(
          `บรรทัด ${index + 1}: บัญชี "${account.code}" (${catLabels[category] || category}) ` +
          `ปกติเป็นเครดิต แต่ถูกบันทึกเดบิต - กรุณาตรวจสอบ`
        );
      }
    });

    return warnings;
  }, [formData.lines, glAccounts]);

  // Check for invalid account pairings (accounts that shouldn't be used together)
  const getInvalidAccountPairings = React.useCallback((): string[] => {
    const errors: string[] = [];

    // Get debit and credit accounts with their categories
    const debitAccounts: Array<{ account: GLAccount; line: number }> = [];
    const creditAccounts: Array<{ account: GLAccount; line: number }> = [];

    formData.lines.forEach((line, index) => {
      if (!line.glAccountId) return;
      const account = glAccounts.find((a) => a.id === line.glAccountId);
      if (!account?.accountType) return;

      if (line.debit > 0) {
        debitAccounts.push({ account, line: index + 1 });
      }
      if (line.credit > 0) {
        creditAccounts.push({ account, line: index + 1 });
      }
    });

    // Rule 1: Revenue accounts should not be credited with expense accounts debited
    // (This is the wrong way - should be expense credited, revenue debited for reversals)
    const debitExpenses = debitAccounts.filter((d) => d.account.accountType?.category === 'expense');
    const creditRevenues = creditAccounts.filter((c) => c.account.accountType?.category === 'revenue');

    if (debitExpenses.length > 0 && creditRevenues.length > 0) {
      errors.push(
        `ไม่ควรบันทึกค่าใช้จ่าย (เดบิต) พร้อมกับรายได้ (เครดิต) ในรายการเดียวกัน - ` +
        `กรุณาตรวจสอบรายการ`
      );
    }

    // Rule 2: Same account on both debit and credit (contra entry should have explanation)
    const debitAccountIds = new Set(debitAccounts.map((d) => d.account.id));
    const creditAccountIds = new Set(creditAccounts.map((c) => c.account.id));
    const sameAccountBothSides = [...debitAccountIds].filter((id) => creditAccountIds.has(id));

    sameAccountBothSides.forEach((accountId) => {
      const account = glAccounts.find((a) => a.id === accountId);
      if (account) {
        errors.push(
          `บัญชี "${account.code} - ${account.nameTh}" ถูกใช้ทั้งฝั่งเดบิตและเครดิต - ` +
          `กรุณาตรวจสอบความถูกต้อง`
        );
      }
    });

    // Rule 3: Cash/Bank account cannot be both debited and credited in same entry
    const debitBankAccounts = debitAccounts.filter((d) => {
      const acc = d.account as any; // Access isBankAccount if available
      return acc.isBankAccount || d.account.code?.startsWith('1101') || d.account.code?.startsWith('1102');
    });
    const creditBankAccounts = creditAccounts.filter((c) => {
      const acc = c.account as any;
      return acc.isBankAccount || c.account.code?.startsWith('1101') || c.account.code?.startsWith('1102');
    });

    if (debitBankAccounts.length > 0 && creditBankAccounts.length > 0) {
      errors.push(
        `บัญชีเงินสด/ธนาคารถูกใช้ทั้งฝั่งเดบิตและเครดิต - กรุณาตรวจสอบ`
      );
    }

    return errors;
  }, [formData.lines, glAccounts]);

  // Get validation summary
  const validationSummary = React.useMemo(() => {
    const issues: { type: 'error' | 'warning'; message: string }[] = [];

    // Check for required entry date
    if (!formData.entryDate) {
      issues.push({ type: 'error', message: 'กรุณาระบุวันที่บันทึก' });
    }

    // Check for valid lines
    const validLines = formData.lines.filter(
      (l) => l.glAccountId && (l.debit > 0 || l.credit > 0) && !(l.debit > 0 && l.credit > 0)
    );

    if (validLines.length < 2) {
      issues.push({ type: 'error', message: 'ต้องมีรายการที่ถูกต้องอย่างน้อย 2 รายการ' });
    }

    // Check for debit lines
    if (!validLines.some((l) => l.debit > 0)) {
      issues.push({ type: 'error', message: 'ต้องมีรายการเดบิตอย่างน้อย 1 รายการ' });
    }

    // Check for credit lines
    if (!validLines.some((l) => l.credit > 0)) {
      issues.push({ type: 'error', message: 'ต้องมีรายการเครดิตอย่างน้อย 1 รายการ' });
    }

    // Check balance
    if (!isBalanced && totalDebit > 0) {
      issues.push({
        type: 'error',
        message: `ยอดไม่สมดุล (ผลต่าง: ${Math.abs(totalDebit - totalCredit).toLocaleString('th-TH', { minimumFractionDigits: 2 })})`
      });
    }

    // Add duplicate account warnings
    getDuplicateAccountWarnings().forEach((warning) => {
      issues.push({ type: 'warning', message: warning });
    });

    // Add normal balance warnings (accounts used against their normal balance)
    getNormalBalanceWarnings().forEach((warning) => {
      issues.push({ type: 'warning', message: warning });
    });

    // Add invalid account pairing errors
    getInvalidAccountPairings().forEach((error) => {
      issues.push({ type: 'warning', message: error });
    });

    // Check for lines with both debit and credit
    const linesWithBoth = formData.lines.filter((l) => l.debit > 0 && l.credit > 0);
    if (linesWithBoth.length > 0) {
      issues.push({ type: 'error', message: `${linesWithBoth.length} รายการมีทั้งเดบิตและเครดิต` });
    }

    // Check for lines without account but with amounts
    const linesWithoutAccount = formData.lines.filter(
      (l) => !l.glAccountId && (l.debit > 0 || l.credit > 0)
    );
    if (linesWithoutAccount.length > 0) {
      issues.push({ type: 'error', message: `${linesWithoutAccount.length} รายการไม่ได้ระบุบัญชี` });
    }

    return issues;
  }, [formData.entryDate, formData.lines, isBalanced, totalDebit, totalCredit, getDuplicateAccountWarnings, getNormalBalanceWarnings, getInvalidAccountPairings]);

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
    // Validate entry date
    if (!formData.entryDate) {
      notify('กรุณาระบุวันที่บันทึก', 'error', 3000);
      return;
    }

    // Check for lines with both debit AND credit
    const linesWithBoth = formData.lines.filter((l) => l.debit > 0 && l.credit > 0);
    if (linesWithBoth.length > 0) {
      notify('รายการต้องเป็นเดบิตหรือเครดิตอย่างใดอย่างหนึ่ง ไม่ใช่ทั้งสอง', 'error', 3000);
      return;
    }

    // Check for lines without account selected but have amounts
    const linesWithoutAccount = formData.lines.filter(
      (l) => !l.glAccountId && (l.debit > 0 || l.credit > 0)
    );
    if (linesWithoutAccount.length > 0) {
      notify('กรุณาระบุบัญชีสำหรับทุกรายการที่มียอดเงิน', 'error', 3000);
      return;
    }

    // Get valid lines (have account and have either debit or credit)
    const validLines = formData.lines
      .filter((l) => l.glAccountId && (l.debit > 0 || l.credit > 0))
      .map((l) => ({
        glAccountId: l.glAccountId as number,
        debit: l.debit,
        credit: l.credit,
        description: l.description,
        costCenterId: l.costCenterId,
      }));

    // Must have at least 2 valid lines
    if (validLines.length < 2) {
      notify('กรุณาเพิ่มรายการอย่างน้อย 2 รายการ (ต้องมีทั้งเดบิตและเครดิต)', 'warning', 3000);
      return;
    }

    // Check that we have at least one debit line
    const hasDebit = validLines.some((l) => l.debit > 0);
    if (!hasDebit) {
      notify('ต้องมีรายการเดบิตอย่างน้อย 1 รายการ', 'error', 3000);
      return;
    }

    // Check that we have at least one credit line
    const hasCredit = validLines.some((l) => l.credit > 0);
    if (!hasCredit) {
      notify('ต้องมีรายการเครดิตอย่างน้อย 1 รายการ', 'error', 3000);
      return;
    }

    // Check balance
    if (!isBalanced) {
      const diff = Math.abs(totalDebit - totalCredit);
      notify(`ยอดเดบิตและเครดิตไม่เท่ากัน (ผลต่าง: ${diff.toLocaleString('th-TH', { minimumFractionDigits: 2 })})`, 'error', 3000);
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

  const handlePost = () => {
    setConfirmDialog({
      visible: true,
      title: 'ยืนยันการผ่านรายการ',
      message: 'คุณต้องการผ่านรายการบันทึกนี้หรือไม่?',
      testIdPrefix: 'je-post',
      onConfirm: () => {
        postMutation.mutate();
        setConfirmDialog((prev) => ({ ...prev, visible: false }));
      },
    });
  };

  const handleReverse = () => {
    setConfirmDialog({
      visible: true,
      title: 'ยืนยันการกลับรายการ',
      message: 'คุณต้องการกลับรายการนี้หรือไม่?<br/>ระบบจะสร้างรายการกลับอัตโนมัติ',
      testIdPrefix: 'je-reverse',
      onConfirm: () => {
        reverseMutation.mutate('Manual reversal from form');
        setConfirmDialog((prev) => ({ ...prev, visible: false }));
      },
    });
  };

  const handleConfirmDialogCancel = React.useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, visible: false }));
  }, []);

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
      <div className="flex items-center justify-between" data-testid="je-form-header">
        <div className="flex items-center gap-3">
          <Button
            text="ย้อนกลับ"
            icon="back"
            stylingMode="text"
            onClick={handleCancel}
            elementAttr={{ 'data-testid': 'je-back-btn' }}
          />
          <div className="h-6 w-px bg-gray-200" />
          <h1 className="text-xl font-semibold text-gray-900" data-testid="je-form-title">
            {mode === 'create' ? 'สร้างรายการบันทึกบัญชี' : `รายการ: ${existingEntry?.entryNumber}`}
          </h1>
          {mode === 'edit' && existingEntry && (
            <span data-testid="je-status-badge">
              <AccountingStatusBadge status={existingEntry.status} />
            </span>
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
              elementAttr={{ 'data-testid': 'je-post-btn' }}
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
              elementAttr={{ 'data-testid': 'je-reverse-btn' }}
            />
          )}
          <span data-testid="je-cancel-btn">
            <Button
              text="ยกเลิก"
              icon="close"
              stylingMode="outlined"
              onClick={handleCancel}
              disabled={isSubmitting}
            />
          </span>
          {!isReadOnly && (
            <span data-testid="je-submit-btn">
              <Button
                text={mode === 'create' ? 'บันทึก' : 'บันทึกการแก้ไข'}
                icon={isSubmitting ? 'spindown' : 'save'}
                type="success"
                onClick={handleSubmit}
                disabled={isSubmitting || !isBalanced}
              />
            </span>
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
                <div data-testid="je-entry-date-field">
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
                <div data-testid="je-reference-number-field">
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
                <div data-testid="je-description-field">
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
                  <span data-testid="je-add-line-btn">
                    <Button
                      text="เพิ่มบรรทัด"
                      icon="plus"
                      type="default"
                      stylingMode="outlined"
                      onClick={addLine}
                    />
                  </span>
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
                  <tbody data-testid="je-lines-body">
                    {formData.lines.map((line, index) => {
                      const lineError = getLineValidationError(line);
                      return (
                      <tr
                        key={index}
                        className={`hover:bg-gray-50 ${lineError ? 'bg-red-50' : ''}`}
                        data-testid={`je-line-row-${index}`}
                        title={lineError || undefined}
                      >
                        <td className={`border p-1 ${lineError ? 'border-red-300' : 'border-gray-200'}`} data-testid={`je-line-account-${index}`}>
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
                        <td className={`border p-1 ${lineError ? 'border-red-300' : 'border-gray-200'}`} data-testid={`je-line-cost-center-${index}`}>
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
                        <td className={`border p-1 ${lineError ? 'border-red-300' : 'border-gray-200'}`} data-testid={`je-line-description-${index}`}>
                          <TextBox
                            value={line.description}
                            onValueChanged={(e) => updateLine(index, 'description', e.value || '')}
                            placeholder="รายละเอียด"
                            readOnly={isReadOnly}
                          />
                        </td>
                        <td className={`border p-1 ${lineError ? 'border-red-300' : 'border-gray-200'}`} data-testid={`je-line-debit-${index}`}>
                          <NumberBox
                            value={line.debit || 0}
                            onValueChanged={(e) => updateLine(index, 'debit', e.value || 0)}
                            onFocusIn={() => line.credit > 0 && !isReadOnly && updateLine(index, 'credit', 0)}
                            min={0}
                            format="#,##0.00"
                            readOnly={isReadOnly}
                          />
                        </td>
                        <td className={`border p-1 ${lineError ? 'border-red-300' : 'border-gray-200'}`} data-testid={`je-line-credit-${index}`}>
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
                                data-testid={`je-line-delete-${index}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                      );
                    })}
                  </tbody>
                  <tfoot data-testid="je-lines-footer">
                    <tr className={`font-bold ${isBalanced ? 'bg-green-50' : 'bg-red-50'}`}>
                      <td colSpan={3} className="border border-gray-200 p-2 text-right">
                        รวม
                      </td>
                      <td className="border border-gray-200 p-2 text-right font-mono" data-testid="je-total-debit">
                        {totalDebit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="border border-gray-200 p-2 text-right font-mono" data-testid="je-total-credit">
                        {totalCredit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      {!isReadOnly && <td className="border border-gray-200"></td>}
                    </tr>
                    <tr>
                      <td colSpan={isReadOnly ? 5 : 6} className="border border-gray-200 p-2 text-center" data-testid="je-balance-status">
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
          {/* Validation Summary - show when there are issues */}
          {!isReadOnly && validationSummary.length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-red-700">ตรวจสอบข้อมูล</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {validationSummary.map((issue, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-2 ${
                        issue.type === 'error' ? 'text-red-600' : 'text-amber-600'
                      }`}
                    >
                      <span className="mt-0.5">
                        {issue.type === 'error' ? '✗' : '⚠'}
                      </span>
                      <span>{issue.message}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

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

      {/* Custom Confirm Dialog with data-testid */}
      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        testIdPrefix={confirmDialog.testIdPrefix}
        onConfirm={confirmDialog.onConfirm}
        onCancel={handleConfirmDialogCancel}
      />
    </div>
  );
}

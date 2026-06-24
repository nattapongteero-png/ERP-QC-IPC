'use client';

/**
 * Journal Entry Form Component
 * Shared component for create and edit modes following the template pattern
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
import { toLocalDateStr } from '@/lib/utils/date-format';

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
  if (!date) return toLocalDateStr(new Date());
  return toLocalDateStr(date);
}

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
  const t = useTranslations('accounting');
  const sourceTypeLabel = React.useCallback(
    (sourceType: string): string => {
      const key = `journalEntries.sourceTypes.${sourceType}`;
      const label = t(key);
      // next-intl returns the key path when missing; fall back to the raw value
      return label === key ? sourceType : label;
    },
    [t]
  );
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
      notify(t('journalEntries.form.toast.createSuccess'), 'success', 3000);
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
      notify(t('journalEntries.form.toast.updateSuccess'), 'success', 3000);
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
      notify(t('journalEntries.toast.postSuccess'), 'success', 3000);
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
      notify(t('journalEntries.toast.reverseSuccess'), 'success', 3000);
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
      return t('journalEntries.form.lineError.debitOrCredit');
    }
    // Check if line has amount but no account
    if ((line.debit > 0 || line.credit > 0) && !line.glAccountId) {
      return t('journalEntries.form.lineError.selectAccount');
    }
    // Check if line has account but no amount
    if (line.glAccountId && line.debit === 0 && line.credit === 0) {
      return t('journalEntries.form.lineError.enterAmount');
    }
    return null;
  }, [t]);

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
          warnings.push(t('journalEntries.form.warning.duplicateDebit', { account: `${account.code} - ${account.nameTh}`, count }));
        }
      }
    });

    // Find accounts used more than once on credit side
    Object.entries(creditAccounts).forEach(([accountId, count]) => {
      if (count > 1) {
        const account = glAccounts.find((a) => a.id === Number(accountId));
        if (account) {
          warnings.push(t('journalEntries.form.warning.duplicateCredit', { account: `${account.code} - ${account.nameTh}`, count }));
        }
      }
    });

    return warnings;
  }, [formData.lines, glAccounts, t]);

  // Check for accounts used against their normal balance
  const getNormalBalanceWarnings = React.useCallback((): string[] => {
    // Category labels for display
    const catLabels: Record<string, string> = {
      asset: t('journalEntries.form.category.asset'),
      liability: t('journalEntries.form.category.liability'),
      equity: t('journalEntries.form.category.equity'),
      revenue: t('journalEntries.form.category.revenue'),
      expense: t('journalEntries.form.category.expense'),
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
          t('journalEntries.form.warning.normalDebit', {
            line: index + 1,
            account: account.code,
            category: catLabels[category] || category,
          })
        );
      } else if (normalBalance === 'credit' && isDebit) {
        warnings.push(
          t('journalEntries.form.warning.normalCredit', {
            line: index + 1,
            account: account.code,
            category: catLabels[category] || category,
          })
        );
      }
    });

    return warnings;
  }, [formData.lines, glAccounts, t]);

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
      errors.push(t('journalEntries.form.error.expenseWithRevenue'));
    }

    // Rule 2: Same account on both debit and credit (contra entry should have explanation)
    const debitAccountIds = new Set(debitAccounts.map((d) => d.account.id));
    const creditAccountIds = new Set(creditAccounts.map((c) => c.account.id));
    const sameAccountBothSides = [...debitAccountIds].filter((id) => creditAccountIds.has(id));

    sameAccountBothSides.forEach((accountId) => {
      const account = glAccounts.find((a) => a.id === accountId);
      if (account) {
        errors.push(
          t('journalEntries.form.error.sameAccountBothSides', {
            account: `${account.code} - ${account.nameTh}`,
          })
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
      errors.push(t('journalEntries.form.error.bankBothSides'));
    }

    return errors;
  }, [formData.lines, glAccounts, t]);

  // Get validation summary
  const validationSummary = React.useMemo(() => {
    const issues: { type: 'error' | 'warning'; message: string }[] = [];

    // Check for required entry date
    if (!formData.entryDate) {
      issues.push({ type: 'error', message: t('journalEntries.form.validation.entryDateRequired') });
    }

    // Check for valid lines
    const validLines = formData.lines.filter(
      (l) => l.glAccountId && (l.debit > 0 || l.credit > 0) && !(l.debit > 0 && l.credit > 0)
    );

    if (validLines.length < 2) {
      issues.push({ type: 'error', message: t('journalEntries.form.validation.minTwoLines') });
    }

    // Check for debit lines
    if (!validLines.some((l) => l.debit > 0)) {
      issues.push({ type: 'error', message: t('journalEntries.form.validation.minOneDebit') });
    }

    // Check for credit lines
    if (!validLines.some((l) => l.credit > 0)) {
      issues.push({ type: 'error', message: t('journalEntries.form.validation.minOneCredit') });
    }

    // Check balance
    if (!isBalanced && totalDebit > 0) {
      issues.push({
        type: 'error',
        message: t('journalEntries.form.validation.unbalancedDiff', {
          diff: Math.abs(totalDebit - totalCredit).toLocaleString('th-TH', { minimumFractionDigits: 2 }),
        }),
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
      issues.push({ type: 'error', message: t('journalEntries.form.validation.linesWithBoth', { count: linesWithBoth.length }) });
    }

    // Check for lines without account but with amounts
    const linesWithoutAccount = formData.lines.filter(
      (l) => !l.glAccountId && (l.debit > 0 || l.credit > 0)
    );
    if (linesWithoutAccount.length > 0) {
      issues.push({ type: 'error', message: t('journalEntries.form.validation.linesWithoutAccount', { count: linesWithoutAccount.length }) });
    }

    return issues;
  }, [formData.entryDate, formData.lines, isBalanced, totalDebit, totalCredit, getDuplicateAccountWarnings, getNormalBalanceWarnings, getInvalidAccountPairings, t]);

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
      notify(t('journalEntries.form.validation.entryDateRequired'), 'error', 3000);
      return;
    }

    // Check for lines with both debit AND credit
    const linesWithBoth = formData.lines.filter((l) => l.debit > 0 && l.credit > 0);
    if (linesWithBoth.length > 0) {
      notify(t('journalEntries.form.validation.debitOrCreditNotBoth'), 'error', 3000);
      return;
    }

    // Check for lines without account selected but have amounts
    const linesWithoutAccount = formData.lines.filter(
      (l) => !l.glAccountId && (l.debit > 0 || l.credit > 0)
    );
    if (linesWithoutAccount.length > 0) {
      notify(t('journalEntries.form.validation.accountRequiredForAmounts'), 'error', 3000);
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
      notify(t('journalEntries.form.validation.addAtLeastTwoLines'), 'warning', 3000);
      return;
    }

    // Check that we have at least one debit line
    const hasDebit = validLines.some((l) => l.debit > 0);
    if (!hasDebit) {
      notify(t('journalEntries.form.validation.minOneDebit'), 'error', 3000);
      return;
    }

    // Check that we have at least one credit line
    const hasCredit = validLines.some((l) => l.credit > 0);
    if (!hasCredit) {
      notify(t('journalEntries.form.validation.minOneCredit'), 'error', 3000);
      return;
    }

    // Check balance
    if (!isBalanced) {
      const diff = Math.abs(totalDebit - totalCredit);
      notify(t('journalEntries.form.validation.debitCreditNotEqual', { diff: diff.toLocaleString('th-TH', { minimumFractionDigits: 2 }) }), 'error', 3000);
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
      title: t('journalEntries.dialogs.postTitle'),
      message: t('journalEntries.form.dialogs.postMessage'),
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
      title: t('journalEntries.dialogs.reverseTitle'),
      message: t('journalEntries.form.dialogs.reverseMessage'),
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
            <span>{t('journalEntries.form.loading')}</span>
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
            text={t('journalEntries.form.back')}
            icon="back"
            stylingMode="text"
            onClick={handleCancel}
            elementAttr={{ 'data-testid': 'je-back-btn' }}
          />
          <div className="h-6 w-px bg-gray-200" />
          <h1 className="text-xl font-semibold text-gray-900" data-testid="je-form-title">
            {mode === 'create' ? t('journalEntries.form.header.create') : t('journalEntries.form.header.edit', { entryNumber: existingEntry?.entryNumber ?? '' })}
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
              text={t('journalEntries.actions.post')}
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
              text={t('journalEntries.actions.reverse')}
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
              text={t('common.cancel')}
              icon="close"
              stylingMode="outlined"
              onClick={handleCancel}
              disabled={isSubmitting}
            />
          </span>
          {!isReadOnly && (
            <span data-testid="je-submit-btn">
              <Button
                text={mode === 'create' ? t('common.save') : t('journalEntries.form.saveEdit')}
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
              <CardTitle className="text-base">{t('journalEntries.form.sections.general')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div data-testid="je-entry-date-field">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('journalEntries.columns.date')} <span className="text-red-500">*</span>
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
                    {t('journalEntries.form.referenceNumber')}
                  </label>
                  <TextBox
                    value={formData.referenceNumber}
                    onValueChanged={(e) => setFormData((prev) => ({ ...prev, referenceNumber: e.value || '' }))}
                    placeholder={t('journalEntries.form.referenceNumberPlaceholder')}
                    readOnly={isReadOnly}
                  />
                </div>
                <div data-testid="je-description-field">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('journalEntries.columns.description')}
                  </label>
                  <TextBox
                    value={formData.description}
                    onValueChanged={(e) => setFormData((prev) => ({ ...prev, description: e.value || '' }))}
                    placeholder={t('journalEntries.form.descriptionPlaceholder')}
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
                <CardTitle className="text-base">{t('journalEntries.form.sections.lines')}</CardTitle>
                {!isReadOnly && (
                  <span data-testid="je-add-line-btn">
                    <Button
                      text={t('journalEntries.form.addLine')}
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
                      <th className="border border-gray-200 p-2 text-left font-medium">{t('journalEntries.columns.account')}</th>
                      <th className="border border-gray-200 p-2 text-left font-medium" style={{ width: 150 }}>
                        {t('journalEntries.form.costCenter')}
                      </th>
                      <th className="border border-gray-200 p-2 text-left font-medium" style={{ width: 180 }}>
                        {t('journalEntries.columns.description')}
                      </th>
                      <th className="border border-gray-200 p-2 text-right font-medium" style={{ width: 130 }}>
                        {t('common.debit')}
                      </th>
                      <th className="border border-gray-200 p-2 text-right font-medium" style={{ width: 130 }}>
                        {t('common.credit')}
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
                            placeholder={t('journalEntries.form.selectAccount')}
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
                            placeholder={t('journalEntries.form.noneOption')}
                            searchEnabled
                            showClearButton={!isReadOnly}
                            readOnly={isReadOnly}
                          />
                        </td>
                        <td className={`border p-1 ${lineError ? 'border-red-300' : 'border-gray-200'}`} data-testid={`je-line-description-${index}`}>
                          <TextBox
                            value={line.description}
                            onValueChanged={(e) => updateLine(index, 'description', e.value || '')}
                            placeholder={t('journalEntries.columns.description')}
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
                                title={t('journalEntries.form.deleteLine')}
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
                        {t('common.total')}
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
                            ✓ {t('journalEntries.form.balanced')}
                          </span>
                        ) : (
                          <span className="text-red-600 font-medium">
                            ✗ {t('journalEntries.form.differenceLabel', {
                              diff: Math.abs(totalDebit - totalCredit).toLocaleString('th-TH', {
                                minimumFractionDigits: 2,
                              }),
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
                <CardTitle className="text-base text-red-700">{t('journalEntries.form.validationSummaryTitle')}</CardTitle>
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
                <CardTitle className="text-base">{t('journalEntries.form.entryInfo.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('journalEntries.form.entryInfo.number')}</span>
                  <span className="font-mono text-gray-900">{existingEntry.entryNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('journalEntries.columns.type')}</span>
                  <span className="text-gray-900">
                    {existingEntry.sourceType ? sourceTypeLabel(existingEntry.sourceType) : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('common.status')}</span>
                  <AccountingStatusBadge status={existingEntry.status} />
                </div>
                {existingEntry.postedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('journalEntries.form.entryInfo.postedAt')}</span>
                    <span className="text-gray-900">
                      {new Date(existingEntry.postedAt).toLocaleDateString('th-TH')}
                    </span>
                  </div>
                )}
                {existingEntry.createdAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('journalEntries.form.entryInfo.createdAt')}</span>
                    <span className="text-gray-900">
                      {new Date(existingEntry.createdAt).toLocaleDateString('th-TH')}
                    </span>
                  </div>
                )}
                {existingEntry.updatedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('journalEntries.form.entryInfo.updatedAt')}</span>
                    <span className="text-gray-900">
                      {new Date(existingEntry.updatedAt).toLocaleDateString('th-TH')}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t">
                  <Button
                    text={t('journalEntries.form.auditHistory')}
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
              <CardTitle className="text-base">{t('journalEntries.form.summaryTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-blue-700">{t('journalEntries.form.totalDebit')}</span>
                <span className="font-mono font-semibold text-blue-900">
                  {totalDebit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <span className="text-purple-700">{t('journalEntries.form.totalCredit')}</span>
                <span className="font-mono font-semibold text-purple-900">
                  {totalCredit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className={`flex justify-between items-center p-3 rounded-lg ${
                isBalanced ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <span className={isBalanced ? 'text-green-700' : 'text-red-700'}>
                  {t('journalEntries.form.difference')}
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
              <CardTitle className="text-base">{t('journalEntries.form.tips.title')}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-2">
              <p>• {t('journalEntries.form.tips.balanced')}</p>
              <p>• {t('journalEntries.form.tips.minLines')}</p>
              <p>• {t('journalEntries.form.tips.postedReadOnly')}</p>
              <p>• {t('journalEntries.form.tips.useReverse')}</p>
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
          title={t('journalEntries.form.auditHistoryTitle', { entryNumber: existingEntry?.entryNumber || '' })}
          fieldLabels={{
            entryNumber: t('journalEntries.columns.entryNumber'),
            entryDate: t('journalEntries.columns.date'),
            description: t('journalEntries.columns.description'),
            referenceNumber: t('journalEntries.form.referenceNumber'),
            sourceType: t('journalEntries.columns.type'),
            status: t('common.status'),
            totalDebit: t('journalEntries.form.totalDebit'),
            totalCredit: t('journalEntries.form.totalCredit'),
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

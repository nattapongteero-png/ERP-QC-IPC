/**
 * Bank Statement Form Component
 * Shared form for create/edit bank statements
 * Matches /template form patterns
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from 'devextreme-react/button';
import { TextBox } from 'devextreme-react/text-box';
import { NumberBox } from 'devextreme-react/number-box';
import { DateBox } from 'devextreme-react/date-box';
import { SelectBox } from 'devextreme-react/select-box';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import notify from 'devextreme/ui/notify';
import { CSVImportDialog } from './CSVImportDialog';
import type { BankStatement, BankStatementCreateInput } from '@/types/bank-reconciliation';
import { toLocalDateStr } from '@/lib/utils/date-format';

interface BankAccount {
  id: number;
  name: string;
  accountNumber: string;
}

export interface BankStatementFormProps {
  mode: 'create' | 'edit';
  statementId?: number;
  onSuccess?: (statement: BankStatement) => void;
  onCancel?: () => void;
}

interface FormData {
  bankAccountId: number;
  statementDate: string;
  startDate: string;
  endDate: string;
  openingBalance: number;
  closingBalance: number;
  reference: string;
}

const defaultFormData: FormData = {
  bankAccountId: 0,
  statementDate: toLocalDateStr(new Date()),
  startDate: '',
  endDate: '',
  openingBalance: 0,
  closingBalance: 0,
  reference: '',
};

async function fetchBankAccounts(): Promise<BankAccount[]> {
  const res = await fetch('/api/accounting/bank-reconciliation/bank-accounts');
  if (!res.ok) throw new Error('Failed to fetch bank accounts');
  const data = await res.json();
  return data.data || [];
}

async function fetchStatement(id: number): Promise<BankStatement> {
  const res = await fetch(`/api/accounting/bank-reconciliation/statements/${id}`);
  if (!res.ok) throw new Error('Failed to fetch statement');
  const data = await res.json();
  return data.data;
}

async function createStatement(data: BankStatementCreateInput): Promise<{ id: number }> {
  const res = await fetch('/api/accounting/bank-reconciliation/statements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create statement');
  }
  return res.json();
}

async function updateStatement(id: number, data: Partial<BankStatementCreateInput>): Promise<BankStatement> {
  const res = await fetch(`/api/accounting/bank-reconciliation/statements/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update statement');
  }
  const result = await res.json();
  return result.data;
}

async function deleteStatement(id: number): Promise<void> {
  const res = await fetch(`/api/accounting/bank-reconciliation/statements/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete statement');
  }
}

// Helper to format date string from Date object
function formatDateForApi(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return toLocalDateStr(d);
}

// Helper to parse date string to display
function parseDateValue(dateStr: string | Date | null): Date | null {
  if (!dateStr) return null;
  return typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
}

export function BankStatementForm({
  mode,
  statementId,
  onSuccess,
  onCancel,
}: BankStatementFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState<FormData>(defaultFormData);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [showImportDialog, setShowImportDialog] = React.useState(false);
  const [createdStatementId, setCreatedStatementId] = React.useState<number | null>(null);

  // Fetch bank accounts
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: fetchBankAccounts,
  });

  // Fetch statement for edit mode
  const { data: existingStatement, isLoading: isLoadingStatement } = useQuery({
    queryKey: ['bank-statement', statementId],
    queryFn: () => fetchStatement(statementId!),
    enabled: mode === 'edit' && !!statementId,
  });

  // Set form data when statement is loaded
  React.useEffect(() => {
    if (existingStatement) {
      setFormData({
        bankAccountId: existingStatement.bankAccountId,
        statementDate: formatDateForApi(existingStatement.statementDate),
        startDate: formatDateForApi(existingStatement.startDate),
        endDate: formatDateForApi(existingStatement.endDate),
        openingBalance: existingStatement.openingBalance,
        closingBalance: existingStatement.closingBalance,
        reference: existingStatement.reference || '',
      });
    }
  }, [existingStatement]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createStatement,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['bank-statements'] });
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliation-summary'] });
      setCreatedStatementId(result.id);
      setShowImportDialog(true);
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: Partial<BankStatementCreateInput>) => updateStatement(statementId!, data),
    onSuccess: (statement) => {
      queryClient.invalidateQueries({ queryKey: ['bank-statements'] });
      queryClient.invalidateQueries({ queryKey: ['bank-statement', statementId] });
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliation-summary'] });
      notify('Statement updated successfully', 'success', 3000);
      if (onSuccess) {
        onSuccess(statement);
      } else {
        router.push('/accounting/bank-reconciliation');
      }
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteStatement(statementId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-statements'] });
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliation-summary'] });
      notify('Statement deleted successfully', 'success', 3000);
      router.push('/accounting/bank-reconciliation');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleSubmit = () => {
    if (!formData.bankAccountId || !formData.statementDate) {
      notify('Please fill in required fields', 'warning', 3000);
      return;
    }

    const submitData: BankStatementCreateInput = {
      bankAccountId: formData.bankAccountId,
      statementDate: formData.statementDate,
      startDate: formData.startDate,
      endDate: formData.endDate,
      openingBalance: formData.openingBalance,
      closingBalance: formData.closingBalance,
      reference: formData.reference || undefined,
    };

    if (mode === 'create') {
      createMutation.mutate(submitData);
    } else {
      updateMutation.mutate(submitData);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(false);
    deleteMutation.mutate();
  };

  const handleImport = async (lines: unknown[]) => {
    if (!createdStatementId) return;

    const response = await fetch(
      `/api/accounting/bank-reconciliation/statements/${createdStatementId}/lines`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines }),
      }
    );

    const result = await response.json();
    if (result.success) {
      notify('Lines imported successfully', 'success', 3000);
      router.push(`/accounting/bank-reconciliation/reconcile/${createdStatementId}`);
    } else {
      throw new Error(result.error || 'Import failed');
    }
  };

  const handleSkipImport = () => {
    setShowImportDialog(false);
    if (createdStatementId) {
      notify('Statement created successfully', 'success', 3000);
      router.push(`/accounting/bank-reconciliation/reconcile/${createdStatementId}`);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const isLocked = existingStatement?.status === 'reconciled' || existingStatement?.status === 'closed';

  if (mode === 'edit' && isLoadingStatement) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-3 text-gray-500">
            <LoadIndicator height={24} width={24} />
            <span>Loading statement...</span>
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
            text="Back"
            icon="back"
            stylingMode="text"
            onClick={handleCancel}
          />
          <div className="h-6 w-px bg-gray-200" />
          <h1 className="text-xl font-semibold text-gray-900" data-testid="page-title">
            {mode === 'create' ? 'Import Bank Statement' : `Edit: ${existingStatement?.statementNumber}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'edit' && !isLocked && (
            <Button
              text="Delete"
              icon={isDeleting ? 'spindown' : 'trash'}
              type="danger"
              stylingMode="outlined"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
            />
          )}
          <Button
            text="Cancel"
            icon="close"
            stylingMode="outlined"
            onClick={handleCancel}
            disabled={isSubmitting}
          />
          <Button
            text={mode === 'create' ? 'Create & Import CSV' : 'Save Changes'}
            icon={isSubmitting ? 'spindown' : 'save'}
            type="success"
            onClick={handleSubmit}
            disabled={isSubmitting || isLocked}
            data-testid="save-btn"
          />
        </div>
      </div>

      {/* Locked Warning */}
      {isLocked && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-4">
            <p className="text-yellow-800">
              This statement is {existingStatement?.status} and cannot be modified.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-800">Confirm Delete</p>
                <p className="text-sm text-red-600">
                  Are you sure you want to delete this statement? This will also delete all associated lines.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text="Cancel"
                  stylingMode="outlined"
                  onClick={() => setShowDeleteConfirm(false)}
                />
                <Button
                  text="Delete"
                  icon="trash"
                  type="danger"
                  onClick={handleDelete}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Statement Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bank Account <span className="text-red-500">*</span>
                </label>
                <SelectBox
                  items={bankAccounts}
                  value={formData.bankAccountId}
                  valueExpr="id"
                  displayExpr={(item: BankAccount) =>
                    item ? `${item.accountNumber} - ${item.name}` : ''
                  }
                  onValueChanged={(e) =>
                    setFormData({ ...formData, bankAccountId: e.value })
                  }
                  placeholder="Select bank account"
                  searchEnabled
                  disabled={mode === 'edit' || isLocked}
                  data-testid="bank-account-select"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Statement Date <span className="text-red-500">*</span>
                  </label>
                  <DateBox
                    value={parseDateValue(formData.statementDate)}
                    onValueChanged={(e) =>
                      setFormData({
                        ...formData,
                        statementDate: formatDateForApi(e.value),
                      })
                    }
                    type="date"
                    displayFormat="dd/MM/yyyy"
                    disabled={isLocked}
                    data-testid="statement-date"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <DateBox
                    value={parseDateValue(formData.startDate)}
                    onValueChanged={(e) =>
                      setFormData({
                        ...formData,
                        startDate: formatDateForApi(e.value),
                      })
                    }
                    type="date"
                    displayFormat="dd/MM/yyyy"
                    disabled={isLocked}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <DateBox
                    value={parseDateValue(formData.endDate)}
                    onValueChanged={(e) =>
                      setFormData({
                        ...formData,
                        endDate: formatDateForApi(e.value),
                      })
                    }
                    type="date"
                    displayFormat="dd/MM/yyyy"
                    disabled={isLocked}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference
                </label>
                <TextBox
                  value={formData.reference}
                  onValueChanged={(e) =>
                    setFormData({ ...formData, reference: e.value || '' })
                  }
                  placeholder="Optional reference"
                  disabled={isLocked}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Balances</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Opening Balance
                  </label>
                  <NumberBox
                    value={formData.openingBalance}
                    onValueChanged={(e) =>
                      setFormData({ ...formData, openingBalance: e.value || 0 })
                    }
                    format="#,##0.00"
                    disabled={isLocked}
                    data-testid="opening-balance"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Closing Balance
                  </label>
                  <NumberBox
                    value={formData.closingBalance}
                    onValueChanged={(e) =>
                      setFormData({ ...formData, closingBalance: e.value || 0 })
                    }
                    format="#,##0.00"
                    disabled={isLocked}
                    data-testid="closing-balance"
                  />
                </div>
              </div>

              {/* Balance Difference Indicator */}
              {(formData.openingBalance !== 0 || formData.closingBalance !== 0) && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Net Change:</span>
                    <span className={`font-mono font-medium ${
                      formData.closingBalance - formData.openingBalance >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {(formData.closingBalance - formData.openingBalance).toLocaleString('th-TH', {
                        minimumFractionDigits: 2,
                        signDisplay: 'always',
                      })}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {mode === 'edit' && existingStatement && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Statement Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">ID</span>
                  <span className="font-mono text-gray-900">{existingStatement.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Statement #</span>
                  <span className="font-mono text-gray-900">{existingStatement.statementNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    existingStatement.status === 'reconciled'
                      ? 'bg-green-100 text-green-700'
                      : existingStatement.status === 'closed'
                      ? 'bg-blue-100 text-blue-700'
                      : existingStatement.status === 'in_progress'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {existingStatement.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Bank Account</span>
                  <span className="text-gray-900">{existingStatement.bankAccountName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Account #</span>
                  <span className="font-mono text-gray-900">{existingStatement.bankAccountNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Created</span>
                  <span className="text-gray-900">
                    {new Date(existingStatement.createdAt).toLocaleDateString('th-TH')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Updated</span>
                  <span className="text-gray-900">
                    {new Date(existingStatement.updatedAt).toLocaleDateString('th-TH')}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {mode === 'edit' && existingStatement && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Reconciliation Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Lines</span>
                  <span className="font-semibold text-gray-900">
                    {(existingStatement.matchedCount || 0) + (existingStatement.unmatchedCount || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Matched</span>
                  <span className="font-semibold text-green-600">{existingStatement.matchedCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Unmatched</span>
                  <span className={`font-semibold ${
                    (existingStatement.unmatchedCount || 0) > 0 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {existingStatement.unmatchedCount || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Debits</span>
                  <span className="font-mono text-red-600">
                    -{Number(existingStatement.totalDebits || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Credits</span>
                  <span className="font-mono text-green-600">
                    +{Number(existingStatement.totalCredits || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="pt-3 border-t">
                  <Button
                    text="Go to Reconciliation"
                    icon="check"
                    type="default"
                    stylingMode="outlined"
                    width="100%"
                    onClick={() => router.push(`/accounting/bank-reconciliation/reconcile/${statementId}`)}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* CSV Import Dialog */}
      <CSVImportDialog
        visible={showImportDialog}
        onClose={handleSkipImport}
        onImport={handleImport}
      />
    </div>
  );
}

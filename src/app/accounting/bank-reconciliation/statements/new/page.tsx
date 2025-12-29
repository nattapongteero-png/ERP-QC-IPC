/**
 * New Bank Statement Page (T072)
 * Create new statement and import CSV
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'devextreme-react/button';
import { TextBox } from 'devextreme-react/text-box';
import { NumberBox } from 'devextreme-react/number-box';
import { DateBox } from 'devextreme-react/date-box';
import { SelectBox } from 'devextreme-react/select-box';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import { CSVImportDialog } from '@/components/accounting/bank-reconciliation/CSVImportDialog';

interface BankAccount {
  id: number;
  name: string;
  accountNumber: string;
}

export default function NewBankStatementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [createdStatementId, setCreatedStatementId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    bankAccountId: 0,
    statementDate: new Date().toISOString().split('T')[0],
    startDate: '',
    endDate: '',
    openingBalance: 0,
    closingBalance: 0,
    reference: '',
  });

  useEffect(() => {
    fetchBankAccounts();
  }, []);

  const fetchBankAccounts = async () => {
    try {
      const response = await fetch('/api/accounting/bank-reconciliation/bank-accounts');
      const result = await response.json();
      if (result.success) {
        setBankAccounts(result.data);
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStatement = async () => {
    if (!formData.bankAccountId || !formData.statementDate) {
      alert('Please fill in required fields');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/accounting/bank-reconciliation/statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (result.success) {
        setCreatedStatementId(result.id);
        setShowImportDialog(true);
      } else {
        alert(result.error || 'Failed to create statement');
      }
    } catch (error) {
      console.error('Error creating statement:', error);
      alert('Failed to create statement');
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async (lines: any[]) => {
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
      // Navigate to reconciliation page
      router.push(`/accounting/bank-reconciliation/reconcile/${createdStatementId}`);
    } else {
      throw new Error(result.error || 'Import failed');
    }
  };

  const handleCancel = () => {
    router.push('/accounting/bank-reconciliation');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadIndicator />
      </div>
    );
  }

  return (
    <div className="p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">
            Import Bank Statement
          </h1>
          <p className="text-gray-600">
            Create a new bank statement and import transactions from CSV
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
          <div className="space-y-4">
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
                searchEnabled={true}
                data-testid="bank-account-select"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Statement Date <span className="text-red-500">*</span>
                </label>
                <DateBox
                  value={formData.statementDate}
                  onValueChanged={(e) =>
                    setFormData({
                      ...formData,
                      statementDate: e.value?.toISOString().split('T')[0] || '',
                    })
                  }
                  type="date"
                  displayFormat="dd/MM/yyyy"
                  data-testid="statement-date"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <DateBox
                  value={formData.startDate}
                  onValueChanged={(e) =>
                    setFormData({
                      ...formData,
                      startDate: e.value?.toISOString().split('T')[0] || '',
                    })
                  }
                  type="date"
                  displayFormat="dd/MM/yyyy"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <DateBox
                  value={formData.endDate}
                  onValueChanged={(e) =>
                    setFormData({
                      ...formData,
                      endDate: e.value?.toISOString().split('T')[0] || '',
                    })
                  }
                  type="date"
                  displayFormat="dd/MM/yyyy"
                />
              </div>
            </div>

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
                  data-testid="closing-balance"
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
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
            <Button text="Cancel" onClick={handleCancel} />
            <Button
              text={saving ? 'Creating...' : 'Create & Import CSV'}
              type="default"
              stylingMode="contained"
              onClick={handleCreateStatement}
              disabled={saving || !formData.bankAccountId}
              data-testid="create-btn"
            />
          </div>
        </div>

        <CSVImportDialog
          visible={showImportDialog}
          onClose={() => setShowImportDialog(false)}
          onImport={handleImport}
        />
    </div>
  );
}

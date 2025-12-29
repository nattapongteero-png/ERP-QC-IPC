/**
 * Reconciliation Detail Page (T073)
 * View statement and reconcile lines
 */

'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import { Popup } from 'devextreme-react/popup';
import { SelectBox } from 'devextreme-react/select-box';
import { TextBox } from 'devextreme-react/text-box';
import { StatementLineGrid } from '@/components/accounting/bank-reconciliation/StatementLineGrid';
import { MatchingDialog } from '@/components/accounting/bank-reconciliation/MatchingDialog';
import type { BankStatementWithLines, BankStatementLine, ReconciliationSummary } from '@/types/bank-reconciliation';

interface PageProps {
  params: Promise<{ id: string }>;
}

const chargeTypes = [
  { value: 'bank_fee', label: 'Bank Fee' },
  { value: 'interest_expense', label: 'Interest Expense' },
  { value: 'interest_income', label: 'Interest Income' },
  { value: 'other', label: 'Other' },
];

export default function ReconciliationPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [statement, setStatement] = useState<BankStatementWithLines | null>(null);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLine, setSelectedLine] = useState<BankStatementLine | null>(null);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [showJournalDialog, setShowJournalDialog] = useState(false);
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
  const [journalData, setJournalData] = useState({
    chargeType: 'bank_fee',
    accountId: 0,
    description: '',
  });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [stmtRes, summaryRes, accountsRes] = await Promise.all([
        fetch(`/api/accounting/bank-reconciliation/statements/${id}`),
        fetch(`/api/accounting/bank-reconciliation/statements/${id}/finalize`),
        fetch('/api/accounting/gl-accounts?type=expense'),
      ]);

      const stmtData = await stmtRes.json();
      const summaryData = await summaryRes.json();
      const accountsData = await accountsRes.json();

      if (stmtData.success) {
        setStatement(stmtData.data);
      }
      if (summaryData.success) {
        setSummary(summaryData.data);
      }
      if (accountsData.success) {
        setExpenseAccounts(accountsData.data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoMatch = async () => {
    setProcessing(true);
    try {
      const response = await fetch(
        `/api/accounting/bank-reconciliation/statements/${id}/auto-match`,
        { method: 'POST' }
      );
      const result = await response.json();
      if (result.success) {
        alert(`Auto-match complete: ${result.matchedCount} of ${result.totalProcessed} lines matched`);
        fetchData();
      } else {
        alert(result.error || 'Auto-match failed');
      }
    } catch (error) {
      console.error('Auto-match error:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleMatch = (lineId: number) => {
    const line = statement?.lines.find((l) => l.id === lineId);
    if (line) {
      setSelectedLine(line);
      setShowMatchDialog(true);
    }
  };

  const handleManualMatch = async (
    lineId: number,
    entityType: string,
    entityId: number,
    notes?: string
  ) => {
    const response = await fetch('/api/accounting/bank-reconciliation/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        statementLineId: lineId,
        matchedEntityType: entityType,
        matchedEntityId: entityId,
        notes,
      }),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Match failed');
    }
    fetchData();
  };

  const handleUnmatch = async (lineId: number) => {
    if (!confirm('Are you sure you want to unmatch this line?')) return;

    try {
      const response = await fetch('/api/accounting/bank-reconciliation/unmatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statementLineId: lineId }),
      });

      const result = await response.json();
      if (result.success) {
        fetchData();
      } else {
        alert(result.error || 'Unmatch failed');
      }
    } catch (error) {
      console.error('Unmatch error:', error);
    }
  };

  const handleIgnore = async (lineId: number) => {
    const notes = prompt('Enter reason for ignoring (optional):');

    try {
      const response = await fetch('/api/accounting/bank-reconciliation/unmatch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statementLineId: lineId, notes }),
      });

      const result = await response.json();
      if (result.success) {
        fetchData();
      } else {
        alert(result.error || 'Ignore failed');
      }
    } catch (error) {
      console.error('Ignore error:', error);
    }
  };

  const handleCreateJournal = (lineId: number) => {
    const line = statement?.lines.find((l) => l.id === lineId);
    if (line) {
      setSelectedLine(line);
      setJournalData({
        chargeType: 'bank_fee',
        accountId: 0,
        description: `Bank charge: ${line.description}`,
      });
      setShowJournalDialog(true);
    }
  };

  const handleSubmitJournal = async () => {
    if (!selectedLine || !journalData.accountId) return;

    setProcessing(true);
    try {
      const response = await fetch('/api/accounting/bank-reconciliation/bank-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statementLineId: selectedLine.id,
          chargeType: journalData.chargeType,
          accountId: journalData.accountId,
          description: journalData.description,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setShowJournalDialog(false);
        fetchData();
      } else {
        alert(result.error || 'Failed to create journal');
      }
    } catch (error) {
      console.error('Journal error:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleFinalize = async () => {
    if (!summary?.isBalanced) {
      if (!confirm('Reconciliation is not balanced. Force close anyway?')) return;
    }

    setProcessing(true);
    try {
      const response = await fetch(
        `/api/accounting/bank-reconciliation/statements/${id}/finalize`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forceClose: !summary?.isBalanced }),
        }
      );

      const result = await response.json();
      if (result.success) {
        alert('Reconciliation finalized successfully');
        router.push('/accounting/bank-reconciliation');
      } else {
        alert(result.error || 'Failed to finalize');
      }
    } catch (error) {
      console.error('Finalize error:', error);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadIndicator />
      </div>
    );
  }

  if (!statement) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Statement not found
        </div>
        <button
          className="mt-4 text-blue-600 hover:underline"
          onClick={() => router.push('/accounting/bank-reconciliation')}
        >
          ← Back to Bank Reconciliation
        </button>
      </div>
    );
  }

  const isReconciled = statement.status === 'reconciled' || statement.status === 'closed';

  return (
    <div className="p-4">
        <div className="mb-4 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">
              Reconcile Statement: {statement.statementNumber}
            </h1>
            <p className="text-gray-600">
              {statement.bankAccountName} | {statement.bankAccountNumber}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              text="Back"
              icon="back"
              onClick={() => router.push('/accounting/bank-reconciliation')}
            />
            {!isReconciled && (
              <>
                <Button
                  text="Auto Match"
                  icon="refresh"
                  type="default"
                  onClick={handleAutoMatch}
                  disabled={processing}
                  data-testid="auto-match-btn"
                />
                <Button
                  text="Finalize"
                  icon="check"
                  type="success"
                  stylingMode="contained"
                  onClick={handleFinalize}
                  disabled={processing}
                  data-testid="finalize-btn"
                />
              </>
            )}
          </div>
        </div>

        {/* Statement Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Opening Balance</div>
            <div className="text-lg font-bold">
              {Number(statement.openingBalance).toLocaleString('th-TH', {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Closing Balance</div>
            <div className="text-lg font-bold">
              {Number(statement.closingBalance).toLocaleString('th-TH', {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Total Debits</div>
            <div className="text-lg font-bold text-red-600">
              -{Number(statement.totalDebits).toLocaleString('th-TH', {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Total Credits</div>
            <div className="text-lg font-bold text-green-600">
              +{Number(statement.totalCredits).toLocaleString('th-TH', {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>
          {summary && (
            <div
              className={`rounded-lg shadow p-4 ${
                summary.isBalanced ? 'bg-green-50' : 'bg-yellow-50'
              }`}
            >
              <div className="text-sm text-gray-500">Status</div>
              <div
                className={`text-lg font-bold ${
                  summary.isBalanced ? 'text-green-600' : 'text-yellow-600'
                }`}
              >
                {summary.isBalanced ? 'Balanced' : 'Not Balanced'}
              </div>
              {!summary.isBalanced && (
                <div className="text-xs text-gray-500">
                  Diff: {summary.difference.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Matching Progress */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span>Matching Progress</span>
                <span>
                  {statement.matchedCount} / {statement.lines.length} lines matched
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${
                      statement.lines.length > 0
                        ? (statement.matchedCount / statement.lines.length) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">
                {statement.lines.length > 0
                  ? Math.round((statement.matchedCount / statement.lines.length) * 100)
                  : 0}%
              </div>
            </div>
          </div>
        </div>

        {/* Statement Lines */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-medium">Statement Lines</h2>
          </div>
          <StatementLineGrid
            lines={statement.lines}
            onMatch={handleMatch}
            onUnmatch={handleUnmatch}
            onIgnore={handleIgnore}
            onCreateJournal={handleCreateJournal}
            readOnly={isReconciled}
          />
        </div>

        {/* Matching Dialog */}
        <MatchingDialog
          visible={showMatchDialog}
          statementLine={selectedLine}
          bankAccountId={statement.bankAccountId}
          onClose={() => setShowMatchDialog(false)}
          onMatch={handleManualMatch}
        />

        {/* Bank Charge Journal Dialog */}
        <Popup
          visible={showJournalDialog}
          onHiding={() => setShowJournalDialog(false)}
          title="Create Bank Charge Journal"
          width={500}
          height={350}
          showCloseButton={true}
        >
          <div className="p-4">
            {selectedLine && (
              <div className="bg-gray-50 rounded p-3 mb-4">
                <div className="text-sm text-gray-500">Amount</div>
                <div className="text-lg font-bold text-red-600">
                  -{selectedLine.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Charge Type
                </label>
                <SelectBox
                  items={chargeTypes}
                  value={journalData.chargeType}
                  valueExpr="value"
                  displayExpr="label"
                  onValueChanged={(e) =>
                    setJournalData({ ...journalData, chargeType: e.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expense Account
                </label>
                <SelectBox
                  items={expenseAccounts}
                  value={journalData.accountId}
                  valueExpr="id"
                  displayExpr={(item: any) =>
                    item ? `${item.accountNumber} - ${item.accountName}` : ''
                  }
                  onValueChanged={(e) =>
                    setJournalData({ ...journalData, accountId: e.value })
                  }
                  searchEnabled={true}
                  placeholder="Select expense account"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <TextBox
                  value={journalData.description}
                  onValueChanged={(e) =>
                    setJournalData({ ...journalData, description: e.value || '' })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button text="Cancel" onClick={() => setShowJournalDialog(false)} />
              <Button
                text={processing ? 'Creating...' : 'Create Journal'}
                type="success"
                stylingMode="contained"
                onClick={handleSubmitJournal}
                disabled={processing || !journalData.accountId}
              />
            </div>
          </div>
        </Popup>
    </div>
  );
}

/**
 * Reconciliation Detail Page (T073)
 * View statement and reconcile lines
 */

'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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

export default function ReconciliationPage({ params }: PageProps) {
  const t = useTranslations('accounting');
  const chargeTypes = [
    { value: 'bank_fee', label: t('bankReconciliation.reconcile.chargeTypes.bankFee') },
    { value: 'interest_expense', label: t('bankReconciliation.reconcile.chargeTypes.interestExpense') },
    { value: 'interest_income', label: t('bankReconciliation.reconcile.chargeTypes.interestIncome') },
    { value: 'other', label: t('bankReconciliation.reconcile.chargeTypes.other') },
  ];
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
        alert(t('bankReconciliation.reconcile.autoMatchResult', { matched: result.matchedCount, total: result.totalProcessed }));
        fetchData();
      } else {
        alert(result.error || t('bankReconciliation.reconcile.autoMatchFailed'));
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
    if (!confirm(t('bankReconciliation.reconcile.unmatchConfirm'))) return;

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
        alert(result.error || t('bankReconciliation.reconcile.unmatchFailed'));
      }
    } catch (error) {
      console.error('Unmatch error:', error);
    }
  };

  const handleIgnore = async (lineId: number) => {
    const notes = prompt(t('bankReconciliation.reconcile.ignorePrompt'));

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
        alert(result.error || t('bankReconciliation.reconcile.ignoreFailed'));
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
        description: t('bankReconciliation.reconcile.defaultChargeDescription', { description: line.description }),
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
        alert(result.error || t('bankReconciliation.reconcile.createJournalFailed'));
      }
    } catch (error) {
      console.error('Journal error:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleFinalize = async () => {
    if (!summary?.isBalanced) {
      if (!confirm(t('bankReconciliation.reconcile.finalizeUnbalancedConfirm'))) return;
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
        alert(t('bankReconciliation.reconcile.finalizeSuccess'));
        router.push('/accounting/bank-reconciliation');
      } else {
        alert(result.error || t('bankReconciliation.reconcile.finalizeFailed'));
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
          {t('bankReconciliation.notFound')}
        </div>
        <button
          className="mt-4 text-blue-600 hover:underline"
          onClick={() => router.push('/accounting/bank-reconciliation')}
        >
          ← {t('bankReconciliation.backToList')}
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
              {t('bankReconciliation.title')}: {statement.statementNumber}
            </h1>
            <p className="text-gray-600">
              {statement.bankAccountName} | {statement.bankAccountNumber}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              text={t('bankReconciliation.reconcile.back')}
              icon="back"
              onClick={() => router.push('/accounting/bank-reconciliation')}
            />
            {!isReconciled && (
              <>
                <Button
                  text={t('bankReconciliation.reconcile.autoMatch')}
                  icon="refresh"
                  type="default"
                  onClick={handleAutoMatch}
                  disabled={processing}
                  elementAttr={{ 'data-testid': 'auto-match-btn' }}
                />
                <Button
                  text={t('bankReconciliation.reconcile.finalize')}
                  icon="check"
                  type="success"
                  stylingMode="contained"
                  onClick={handleFinalize}
                  disabled={processing}
                  elementAttr={{ 'data-testid': 'finalize-btn' }}
                />
              </>
            )}
          </div>
        </div>

        {/* Statement Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">{t('bankReconciliation.reconcile.openingBalance')}</div>
            <div className="text-lg font-bold">
              {Number(statement.openingBalance).toLocaleString('th-TH', {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">{t('bankReconciliation.reconcile.closingBalance')}</div>
            <div className="text-lg font-bold">
              {Number(statement.closingBalance).toLocaleString('th-TH', {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">{t('bankReconciliation.reconcile.totalDebits')}</div>
            <div className="text-lg font-bold text-red-600">
              -{Number(statement.totalDebits).toLocaleString('th-TH', {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">{t('bankReconciliation.reconcile.totalCredits')}</div>
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
              <div className="text-sm text-gray-500">{t('bankReconciliation.reconcile.status')}</div>
              <div
                className={`text-lg font-bold ${
                  summary.isBalanced ? 'text-green-600' : 'text-yellow-600'
                }`}
              >
                {summary.isBalanced ? t('bankReconciliation.reconcile.balanced') : t('bankReconciliation.reconcile.unbalanced')}
              </div>
              {!summary.isBalanced && (
                <div className="text-xs text-gray-500">
                  {t('bankReconciliation.reconcile.difference', { amount: summary.difference.toLocaleString('th-TH', { minimumFractionDigits: 2 }) })}
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
                <span>{t('bankReconciliation.reconcile.matchingProgress')}</span>
                <span>
                  {t('bankReconciliation.reconcile.matchedProgress', { matched: statement.matchedCount, total: statement.lines.length })}
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
            <h2 className="text-lg font-medium">{t('bankReconciliation.reconcile.statementLines')}</h2>
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
          title={t('bankReconciliation.reconcile.journalDialogTitle')}
          width={500}
          height={350}
          showCloseButton={true}
        >
          <div className="p-4">
            {selectedLine && (
              <div className="bg-gray-50 rounded p-3 mb-4">
                <div className="text-sm text-gray-500">{t('bankReconciliation.reconcile.amount')}</div>
                <div className="text-lg font-bold text-red-600">
                  -{selectedLine.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('bankReconciliation.reconcile.chargeTypeLabel')}
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
                  {t('bankReconciliation.reconcile.expenseAccountLabel')}
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
                  placeholder={t('bankReconciliation.reconcile.expenseAccountPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('bankReconciliation.reconcile.descriptionLabel')}
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
              <Button text={t('bankReconciliation.reconcile.cancel')} onClick={() => setShowJournalDialog(false)} />
              <Button
                text={processing ? t('bankReconciliation.reconcile.creating') : t('bankReconciliation.reconcile.createJournal')}
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

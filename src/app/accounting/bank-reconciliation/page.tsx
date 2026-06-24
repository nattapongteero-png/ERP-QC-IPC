/**
 * Bank Reconciliation Dashboard Page (T072)
 * Refactored to match /template page patterns
 */

'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import DataGrid, {
  Column,
  Paging,
  Pager,
  Sorting,
} from 'devextreme-react/data-grid';
import { Landmark, FileText, Clock, CheckCircle, AlertCircle, Eye, Edit, Trash2 } from 'lucide-react';
import notify from 'devextreme/ui/notify';
import { AccountingPageHeader } from '@/components/accounting/accounting-page-header';
import { KPICard, KPICardSkeleton } from '@/components/ui/kpi-card';
import { Card, CardContent } from '@/components/ui/card';
import type { BankStatement } from '@/types/bank-reconciliation';

interface DashboardSummary {
  totalStatements: number;
  pendingReconciliation: number;
  reconciledThisMonth: number;
  unmatchedLines: number;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  imported: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  reconciled: 'bg-green-100 text-green-800',
  closed: 'bg-blue-100 text-blue-800',
};

async function fetchStatements(): Promise<BankStatement[]> {
  const res = await fetch('/api/accounting/bank-reconciliation/statements');
  if (!res.ok) throw new Error('Failed to fetch statements');
  const data = await res.json();
  return data.data || [];
}

async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await fetch('/api/accounting/bank-reconciliation/dashboard');
  if (!res.ok) throw new Error('Failed to fetch dashboard summary');
  const data = await res.json();
  return data.data;
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

export default function BankReconciliationPage() {
  const t = useTranslations('accounting');
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: statements = [], isLoading: isLoadingStatements, refetch, isFetching } = useQuery({
    queryKey: ['bank-statements'],
    queryFn: fetchStatements,
  });

  const { data: summary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['bank-reconciliation-summary'],
    queryFn: fetchDashboardSummary,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStatement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-statements'] });
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliation-summary'] });
      notify(t('bankReconciliation.toast.deleteSuccess'), 'success', 3000);
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleNewStatement = () => {
    router.push('/accounting/bank-reconciliation/statements/new');
  };

  const handleViewStatement = (id: number) => {
    router.push(`/accounting/bank-reconciliation/reconcile/${id}`);
  };

  const handleEditStatement = (id: number) => {
    router.push(`/accounting/bank-reconciliation/statements/${id}`);
  };

  const handleDeleteStatement = (statement: BankStatement) => {
    if (statement.status === 'reconciled' || statement.status === 'closed') {
      notify(t('bankReconciliation.toast.deleteLocked'), 'warning', 3000);
      return;
    }
    if (confirm(t('bankReconciliation.toast.deleteConfirm', { number: statement.statementNumber }))) {
      deleteMutation.mutate(statement.id);
    }
  };

  const renderStatus = (cellData: { value: string }) => {
    const status = cellData.value as string;
    const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800';
    const displayText = status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {displayText}
      </span>
    );
  };

  const renderAmount = (cellData: { value: number }) => {
    const amount = Number(cellData.value || 0);
    return (
      <span className="font-mono">
        {amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
      </span>
    );
  };

  const formatDate = (cellData: { value: string | Date }) => {
    const date = cellData.value;
    if (!date) return '';
    return new Date(date).toLocaleDateString('th-TH');
  };

  const renderUnmatched = (cellData: { value: number }) => (
    <span className={cellData.value > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
      {cellData.value}
    </span>
  );

  const renderActions = (cellData: { data: BankStatement }) => {
    const statement = cellData.data;
    const isLocked = statement.status === 'reconciled' || statement.status === 'closed';
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleViewStatement(statement.id);
          }}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title={t('bankReconciliation.rowActions.viewReconcile')}
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleEditStatement(statement.id);
          }}
          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
          title={t('bankReconciliation.rowActions.edit')}
        >
          <Edit className="h-4 w-4" />
        </button>
        {!isLocked && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteStatement(statement);
            }}
            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title={t('bankReconciliation.rowActions.delete')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  };

  const isLoading = isLoadingStatements || isLoadingSummary;

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <AccountingPageHeader
        title={t('bankReconciliation.title')}
        subtitle={t('bankReconciliation.subtitle')}
        icon="banknote"
        onRefresh={() => refetch()}
        actions={
          <Button
            text={t('bankReconciliation.importStatement')}
            icon="upload"
            type="success"
            stylingMode="contained"
            onClick={handleNewStatement}
            data-testid="import-btn"
          />
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              value={summary?.totalStatements || 0}
              label={t('bankReconciliation.stats.totalStatements')}
              subtitle={t('bankReconciliation.stats.totalStatementsSubtitle')}
              icon={<FileText className="h-6 w-6" />}
              iconBgColor="bg-blue-100"
              iconColor="text-blue-600"
            />
            <KPICard
              value={summary?.pendingReconciliation || 0}
              label={t('bankReconciliation.stats.pending')}
              subtitle={t('bankReconciliation.stats.pendingSubtitle')}
              icon={<Clock className="h-6 w-6" />}
              iconBgColor="bg-yellow-100"
              iconColor="text-yellow-600"
            />
            <KPICard
              value={summary?.reconciledThisMonth || 0}
              label={t('bankReconciliation.stats.reconciledThisMonth')}
              subtitle={t('bankReconciliation.stats.reconciledThisMonthSubtitle')}
              icon={<CheckCircle className="h-6 w-6" />}
              iconBgColor="bg-green-100"
              iconColor="text-green-600"
            />
            <KPICard
              value={summary?.unmatchedLines || 0}
              label={t('bankReconciliation.stats.unmatchedLines')}
              subtitle={t('bankReconciliation.stats.unmatchedLinesSubtitle')}
              icon={<AlertCircle className="h-6 w-6" />}
              iconBgColor="bg-red-100"
              iconColor="text-red-600"
            />
          </>
        )}
      </div>

      {/* Statements Grid */}
      <Card>
        <CardContent className="p-0">
          <DataGrid
            dataSource={statements}
            keyExpr="id"
            showBorders={false}
            showRowLines
            rowAlternationEnabled
            hoverStateEnabled
            columnAutoWidth
            allowColumnResizing
            onRowClick={(e) => handleViewStatement(e.data.id)}
            className="min-h-[400px]"
            data-testid="statements-grid"
          >
            <Sorting mode="multiple" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo
              showNavigationButtons
            />

            <Column
              dataField="statementNumber"
              caption={t('bankReconciliation.columns.statementNumber')}
              width={150}
            />
            <Column
              dataField="bankAccountName"
              caption={t('bankReconciliation.columns.bankAccount')}
              minWidth={180}
            />
            <Column
              dataField="statementDate"
              caption={t('bankReconciliation.columns.date')}
              dataType="date"
              width={110}
              cellRender={formatDate}
            />
            <Column
              dataField="openingBalance"
              caption={t('bankReconciliation.columns.openingBalance')}
              width={130}
              alignment="right"
              cellRender={renderAmount}
            />
            <Column
              dataField="closingBalance"
              caption={t('bankReconciliation.columns.closingBalance')}
              width={130}
              alignment="right"
              cellRender={renderAmount}
            />
            <Column
              dataField="matchedCount"
              caption={t('bankReconciliation.columns.matched')}
              width={90}
              alignment="center"
            />
            <Column
              dataField="unmatchedCount"
              caption={t('bankReconciliation.columns.unmatched')}
              width={100}
              alignment="center"
              cellRender={renderUnmatched}
            />
            <Column
              dataField="status"
              caption={t('bankReconciliation.columns.status')}
              width={130}
              alignment="center"
              cellRender={renderStatus}
            />
            <Column
              caption={t('bankReconciliation.columns.actions')}
              width={120}
              alignment="center"
              cellRender={renderActions}
              allowFiltering={false}
              allowSorting={false}
            />
          </DataGrid>
        </CardContent>
      </Card>
    </div>
  );
}

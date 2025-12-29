/**
 * Bank Reconciliation Dashboard Page (T072)
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import DataGrid, {
  Column,
  Paging,
  FilterRow,
  Toolbar,
  Item,
  SearchPanel,
} from 'devextreme-react/data-grid';
import type { BankStatement } from '@/types/bank-reconciliation';

interface DashboardSummary {
  totalStatements: number;
  pendingReconciliation: number;
  reconciledThisMonth: number;
  unmatchedLines: number;
}

const statusColors: Record<string, string> = {
  imported: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  reconciled: 'bg-green-100 text-green-800',
  closed: 'bg-blue-100 text-blue-800',
};

export default function BankReconciliationPage() {
  const router = useRouter();
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statementsRes, summaryRes] = await Promise.all([
        fetch('/api/accounting/bank-reconciliation/statements'),
        fetch('/api/accounting/bank-reconciliation/dashboard'),
      ]);

      const statementsData = await statementsRes.json();
      const summaryData = await summaryRes.json();

      if (statementsData.success) {
        setStatements(statementsData.data);
      }
      if (summaryData.success) {
        setSummary(summaryData.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewStatement = () => {
    router.push('/accounting/bank-reconciliation/statements/new');
  };

  const handleViewStatement = (id: number) => {
    router.push(`/accounting/bank-reconciliation/reconcile/${id}`);
  };

  const renderStatus = (cellData: any) => {
    const status = cellData.value as string;
    const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const renderAmount = (cellData: any) => {
    const amount = Number(cellData.value || 0);
    return amount.toLocaleString('th-TH', { minimumFractionDigits: 2 });
  };

  const formatDate = (cellData: any) => {
    const date = cellData.value;
    if (!date) return '';
    return new Date(date).toLocaleDateString('th-TH');
  };

  const renderActions = (cellData: any) => {
    const statement = cellData.data as BankStatement;
    return (
      <div className="flex gap-1">
        <Button
          icon="search"
          hint="View/Reconcile"
          stylingMode="text"
          onClick={() => handleViewStatement(statement.id)}
        />
      </div>
    );
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
            Bank Reconciliation
          </h1>
          <p className="text-gray-600">
            Import bank statements and reconcile transactions with payments and receipts
          </p>
        </div>

        {/* Dashboard Summary */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
              <div className="text-sm text-gray-500">Total Statements</div>
              <div className="text-2xl font-bold text-gray-900">
                {summary.totalStatements}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
              <div className="text-sm text-gray-500">Pending Reconciliation</div>
              <div className="text-2xl font-bold text-yellow-600">
                {summary.pendingReconciliation}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="text-sm text-gray-500">Reconciled This Month</div>
              <div className="text-2xl font-bold text-green-600">
                {summary.reconciledThisMonth}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
              <div className="text-sm text-gray-500">Unmatched Lines</div>
              <div className="text-2xl font-bold text-red-600">
                {summary.unmatchedLines}
              </div>
            </div>
          </div>
        )}

        {/* Statements Grid */}
        <div className="bg-white rounded-lg shadow">
          <DataGrid
            dataSource={statements}
            keyExpr="id"
            showBorders={true}
            rowAlternationEnabled={true}
            allowColumnResizing={true}
            columnAutoWidth={true}
            data-testid="statements-grid"
          >
            <SearchPanel visible={true} placeholder="Search statements..." />
            <FilterRow visible={true} />
            <Paging defaultPageSize={20} />
            <Toolbar>
              <Item location="before">
                <span className="text-lg font-medium">Bank Statements</span>
              </Item>
              <Item location="after">
                <Button
                  text="Import Statement"
                  icon="upload"
                  type="default"
                  stylingMode="contained"
                  onClick={handleNewStatement}
                  data-testid="import-btn"
                />
              </Item>
            </Toolbar>

            <Column
              dataField="statementNumber"
              caption="Statement #"
              width={150}
            />
            <Column
              dataField="bankAccountName"
              caption="Bank Account"
              minWidth={180}
            />
            <Column
              dataField="statementDate"
              caption="Date"
              dataType="date"
              width={100}
              cellRender={formatDate}
            />
            <Column
              dataField="openingBalance"
              caption="Opening"
              width={120}
              alignment="right"
              cellRender={renderAmount}
            />
            <Column
              dataField="closingBalance"
              caption="Closing"
              width={120}
              alignment="right"
              cellRender={renderAmount}
            />
            <Column
              dataField="matchedCount"
              caption="Matched"
              width={80}
              alignment="center"
            />
            <Column
              dataField="unmatchedCount"
              caption="Unmatched"
              width={90}
              alignment="center"
              cellRender={(cellData: any) => (
                <span className={cellData.value > 0 ? 'text-red-600 font-medium' : ''}>
                  {cellData.value}
                </span>
              )}
            />
            <Column
              dataField="status"
              caption="Status"
              width={120}
              alignment="center"
              cellRender={renderStatus}
            />
            <Column
              caption="Actions"
              width={80}
              alignment="center"
              cellRender={renderActions}
            />
          </DataGrid>
        </div>
      </div>
  );
}

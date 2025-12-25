'use client';

// Financial Reports Dashboard
// Feature: 010-accounting-module-integration
// User Story 5: Generate Financial Statements

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DateBox } from 'devextreme-react/date-box';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import DataGrid, { Column, Export, Summary, TotalItem } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingFilterPanel,
} from '@/components/accounting';
import { BarChart3 } from 'lucide-react';
import type {
  TrialBalanceReport,
  BalanceSheetReport,
  IncomeStatementReport,
  AgingReport,
} from '@/types/accounting';

type ReportType = 'trial-balance' | 'balance-sheet' | 'income-statement' | 'cash-flow' | 'aging-ap' | 'aging-ar';

const reportTypes = [
  { value: 'trial-balance', text: 'Trial Balance' },
  { value: 'balance-sheet', text: 'Balance Sheet' },
  { value: 'income-statement', text: 'Income Statement' },
  { value: 'cash-flow', text: 'Cash Flow Statement' },
  { value: 'aging-ap', text: 'AP Aging Report' },
  { value: 'aging-ar', text: 'AR Aging Report' },
];

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function fetchReport(
  reportType: ReportType,
  asOfDate: string,
  periodStart?: string,
  periodEnd?: string
) {
  let url = '';

  switch (reportType) {
    case 'trial-balance':
      url = `/api/accounting/reports/trial-balance?asOfDate=${asOfDate}`;
      break;
    case 'balance-sheet':
      url = `/api/accounting/reports/balance-sheet?asOfDate=${asOfDate}`;
      break;
    case 'income-statement':
      url = `/api/accounting/reports/income-statement?periodStart=${periodStart}&periodEnd=${periodEnd}`;
      break;
    case 'cash-flow':
      url = `/api/accounting/reports/cash-flow?periodStart=${periodStart}&periodEnd=${periodEnd}`;
      break;
    case 'aging-ap':
      url = `/api/accounting/reports/aging?type=AP&asOfDate=${asOfDate}`;
      break;
    case 'aging-ar':
      url = `/api/accounting/reports/aging?type=AR&asOfDate=${asOfDate}`;
      break;
  }

  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch report');
  }
  const data = await res.json();
  return data.data;
}

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportType>('trial-balance');
  const [asOfDate, setAsOfDate] = useState<Date>(new Date());
  const [periodStart, setPeriodStart] = useState<Date>(new Date(new Date().getFullYear(), 0, 1));
  const [periodEnd, setPeriodEnd] = useState<Date>(new Date());
  const [generateReport, setGenerateReport] = useState(false);

  const needsPeriodDates = ['income-statement', 'cash-flow'].includes(selectedReport);

  const {
    data: reportData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'report',
      selectedReport,
      formatDate(asOfDate),
      needsPeriodDates ? formatDate(periodStart) : null,
      needsPeriodDates ? formatDate(periodEnd) : null,
    ],
    queryFn: () =>
      fetchReport(
        selectedReport,
        formatDate(asOfDate),
        needsPeriodDates ? formatDate(periodStart) : undefined,
        needsPeriodDates ? formatDate(periodEnd) : undefined
      ),
    enabled: generateReport,
  });

  const handleGenerateReport = useCallback(() => {
    setGenerateReport(true);
    refetch();
  }, [refetch]);

  const handleReportChange = useCallback((e: { value: ReportType }) => {
    setSelectedReport(e.value);
    setGenerateReport(false);
  }, []);

  const handleExport = useCallback(() => {
    if (!reportData) return;

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedReport}-${formatDate(asOfDate)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Report exported successfully', 'success', 2000);
  }, [reportData, selectedReport, asOfDate]);

  const renderReportContent = () => {
    if (isLoading) {
      return (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-gray-600">Loading report...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-red-600 font-medium">
            Error: {error instanceof Error ? error.message : 'Failed to load report'}
          </p>
        </div>
      );
    }

    if (!reportData) {
      return (
        <div className="text-center py-16" data-testid="no-report-message">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
            <BarChart3 className="w-10 h-10 text-gray-400" />
          </div>
          <p className="text-gray-500 text-lg font-medium mb-2">No Report Generated</p>
          <p className="text-gray-400 text-sm">Select a report type and click Generate Report to view data.</p>
        </div>
      );
    }

    // Render based on report type
    switch (selectedReport) {
      case 'trial-balance':
        return renderTrialBalance(reportData as TrialBalanceReport);
      case 'balance-sheet':
        return renderBalanceSheet(reportData as BalanceSheetReport);
      case 'income-statement':
        return renderIncomeStatement(reportData as IncomeStatementReport);
      case 'aging-ap':
      case 'aging-ar':
        return renderAgingReport(reportData as AgingReport);
      default:
        return (
          <pre className="p-4 bg-gray-100 rounded overflow-auto" data-testid="report-json">
            {JSON.stringify(reportData, null, 2)}
          </pre>
        );
    }
  };

  const renderTrialBalance = (report: TrialBalanceReport) => (
    <div data-testid="trial-balance-report">
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-900">Trial Balance</h3>
        <p className="text-sm text-gray-500 mt-1">As of {report.asOfDate}</p>
      </div>
      <DataGrid
        dataSource={report.entries}
        showBorders
        columnAutoWidth
        keyExpr="accountCode"
        className="report-grid"
      >
        <Column dataField="accountCode" caption="Account Code" width={120} />
        <Column dataField="accountName" caption="Account Name" />
        <Column dataField="accountType" caption="Type" width={100} />
        <Column dataField="periodDebit" caption="Debit" format="#,##0.00" width={120} />
        <Column dataField="periodCredit" caption="Credit" format="#,##0.00" width={120} />
        <Column dataField="closingDebit" caption="Closing Debit" format="#,##0.00" width={120} />
        <Column dataField="closingCredit" caption="Closing Credit" format="#,##0.00" width={120} />
        <Export enabled allowExportSelectedData={false} />
        <Summary>
          <TotalItem column="periodDebit" summaryType="sum" valueFormat="#,##0.00" />
          <TotalItem column="periodCredit" summaryType="sum" valueFormat="#,##0.00" />
          <TotalItem column="closingDebit" summaryType="sum" valueFormat="#,##0.00" />
          <TotalItem column="closingCredit" summaryType="sum" valueFormat="#,##0.00" />
        </Summary>
      </DataGrid>
    </div>
  );

  const renderBalanceSheet = (report: BalanceSheetReport) => (
    <div data-testid="balance-sheet-report">
      <div className="mb-6 pb-4 border-b border-gray-200 flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Balance Sheet</h3>
          <p className="text-sm text-gray-500 mt-1">As of {report.asOfDate}</p>
        </div>
        <div className={`px-4 py-2 rounded-lg font-semibold ${report.isBalanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {report.isBalanced ? '✓ Balanced' : '✗ Not Balanced'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Assets */}
        <div className="border border-gray-200 rounded-xl p-6 bg-gradient-to-br from-blue-50/50 to-white">
          <h4 className="font-bold text-lg mb-4 text-blue-900">Assets</h4>
          <div className="space-y-4">
            <div>
              <h5 className="font-semibold">Current Assets</h5>
              <DataGrid
                dataSource={report.assets.currentAssets.accounts}
                showBorders
                keyExpr="code"
              >
                <Column dataField="code" caption="Code" width={80} />
                <Column dataField="name" caption="Account" />
                <Column dataField="amount" caption="Amount" format="#,##0.00" width={120} />
              </DataGrid>
              <div className="text-right font-semibold mt-2">
                Subtotal: {report.assets.currentAssets.subtotal.toLocaleString()}
              </div>
            </div>
            <div>
              <h5 className="font-semibold">Non-Current Assets</h5>
              <DataGrid
                dataSource={report.assets.nonCurrentAssets.accounts}
                showBorders
                keyExpr="code"
              >
                <Column dataField="code" caption="Code" width={80} />
                <Column dataField="name" caption="Account" />
                <Column dataField="amount" caption="Amount" format="#,##0.00" width={120} />
              </DataGrid>
              <div className="text-right font-semibold mt-2">
                Subtotal: {report.assets.nonCurrentAssets.subtotal.toLocaleString()}
              </div>
            </div>
            <div className="text-right font-bold text-lg border-t pt-2">
              Total Assets: {report.assets.totalAssets.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Liabilities & Equity */}
        <div className="border border-gray-200 rounded-xl p-6 bg-gradient-to-br from-green-50/50 to-white">
          <h4 className="font-bold text-lg mb-4 text-green-900">Liabilities & Equity</h4>
          <div className="space-y-4">
            <div>
              <h5 className="font-semibold">Current Liabilities</h5>
              <DataGrid
                dataSource={report.liabilities.currentLiabilities.accounts}
                showBorders
                keyExpr="code"
              >
                <Column dataField="code" caption="Code" width={80} />
                <Column dataField="name" caption="Account" />
                <Column dataField="amount" caption="Amount" format="#,##0.00" width={120} />
              </DataGrid>
              <div className="text-right font-semibold mt-2">
                Subtotal: {report.liabilities.currentLiabilities.subtotal.toLocaleString()}
              </div>
            </div>
            <div>
              <h5 className="font-semibold">Equity</h5>
              <DataGrid
                dataSource={report.equity.section.accounts}
                showBorders
                keyExpr="code"
              >
                <Column dataField="code" caption="Code" width={80} />
                <Column dataField="name" caption="Account" />
                <Column dataField="amount" caption="Amount" format="#,##0.00" width={120} />
              </DataGrid>
              <div className="text-right font-semibold mt-2">
                Subtotal: {report.equity.totalEquity.toLocaleString()}
              </div>
            </div>
            <div className="text-right font-bold text-lg border-t pt-2">
              Total: {report.totalLiabilitiesAndEquity.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderIncomeStatement = (report: IncomeStatementReport) => (
    <div data-testid="income-statement-report">
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-900">Income Statement</h3>
        <p className="text-sm text-gray-500 mt-1">{report.periodStart} to {report.periodEnd}</p>
      </div>

      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Revenue */}
        <div>
          <h5 className="font-semibold border-b pb-2">Revenue</h5>
          <DataGrid dataSource={report.revenue.accounts} showBorders keyExpr="code">
            <Column dataField="code" caption="Code" width={80} />
            <Column dataField="name" caption="Account" />
            <Column dataField="amount" caption="Amount" format="#,##0.00" width={120} />
          </DataGrid>
          <div className="text-right font-semibold">Total Revenue: {report.revenue.subtotal.toLocaleString()}</div>
        </div>

        {/* COGS */}
        <div>
          <h5 className="font-semibold border-b pb-2">Cost of Goods Sold</h5>
          <DataGrid dataSource={report.costOfGoodsSold.accounts} showBorders keyExpr="code">
            <Column dataField="code" caption="Code" width={80} />
            <Column dataField="name" caption="Account" />
            <Column dataField="amount" caption="Amount" format="#,##0.00" width={120} />
          </DataGrid>
          <div className="text-right font-semibold">Total COGS: {report.costOfGoodsSold.subtotal.toLocaleString()}</div>
        </div>

        <div className="text-right font-bold text-lg bg-blue-50 border border-blue-200 p-3 rounded-lg">
          Gross Profit: {report.grossProfit.toLocaleString()}
        </div>

        {/* Operating Expenses */}
        <div>
          <h5 className="font-semibold border-b pb-2">Operating Expenses</h5>
          <DataGrid dataSource={report.operatingExpenses.accounts} showBorders keyExpr="code">
            <Column dataField="code" caption="Code" width={80} />
            <Column dataField="name" caption="Account" />
            <Column dataField="amount" caption="Amount" format="#,##0.00" width={120} />
          </DataGrid>
          <div className="text-right font-semibold">
            Total OPEX: {report.operatingExpenses.subtotal.toLocaleString()}
          </div>
        </div>

        <div className="text-right font-bold text-lg bg-blue-50 border border-blue-200 p-3 rounded-lg">
          Operating Income: {report.operatingIncome.toLocaleString()}
        </div>

        <div className="text-right font-bold text-xl bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 p-4 rounded-xl shadow-sm">
          Net Income: <span className="text-green-700">{report.netIncome.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );

  const renderAgingReport = (report: AgingReport) => (
    <div data-testid="aging-report">
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-900">
          {report.reportType === 'AP' ? 'Accounts Payable' : 'Accounts Receivable'} Aging
        </h3>
        <p className="text-sm text-gray-500 mt-1">As of {report.asOfDate}</p>
      </div>

      {/* Summary Buckets */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {report.buckets.map((bucket, idx) => {
          const colors = [
            'from-green-50 to-emerald-50 border-green-200',
            'from-blue-50 to-cyan-50 border-blue-200',
            'from-yellow-50 to-amber-50 border-yellow-200',
            'from-orange-50 to-red-50 border-orange-200',
            'from-red-50 to-rose-50 border-red-300',
          ];
          return (
            <div key={bucket.range} className={`border rounded-xl p-4 text-center bg-gradient-to-br ${colors[idx]}`}>
              <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">{bucket.range}</div>
              <div className="text-2xl font-bold text-gray-900 mt-2">{bucket.amount.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-1">{bucket.count} invoices</div>
            </div>
          );
        })}
      </div>

      {/* Detail Grid */}
      <DataGrid dataSource={report.entries} showBorders columnAutoWidth keyExpr="entityId">
        <Column dataField="entityName" caption={report.reportType === 'AP' ? 'Vendor' : 'Customer'} />
        <Column dataField="current" caption="Current" format="#,##0.00" width={100} />
        <Column dataField="days1to30" caption="1-30 Days" format="#,##0.00" width={100} />
        <Column dataField="days31to60" caption="31-60 Days" format="#,##0.00" width={100} />
        <Column dataField="days61to90" caption="61-90 Days" format="#,##0.00" width={100} />
        <Column dataField="over90" caption="90+ Days" format="#,##0.00" width={100} />
        <Column dataField="total" caption="Total" format="#,##0.00" width={120} />
        <Summary>
          <TotalItem column="current" summaryType="sum" valueFormat="#,##0.00" />
          <TotalItem column="days1to30" summaryType="sum" valueFormat="#,##0.00" />
          <TotalItem column="days31to60" summaryType="sum" valueFormat="#,##0.00" />
          <TotalItem column="days61to90" summaryType="sum" valueFormat="#,##0.00" />
          <TotalItem column="over90" summaryType="sum" valueFormat="#,##0.00" />
          <TotalItem column="total" summaryType="sum" valueFormat="#,##0.00" />
        </Summary>
      </DataGrid>

      <div className="text-right font-bold text-lg mt-6 p-4 bg-gradient-to-r from-gray-50 to-slate-100 border border-gray-300 rounded-xl">
        Grand Total: <span className="text-blue-700">{report.totals.total.toLocaleString()}</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
      <AccountingPageHeader
        title="Financial Reports"
        subtitle="Generate TFRS-compliant financial statements"
        icon="bar-chart"
      />

      <div className="p-6 space-y-6">
        {/* Report Quick Access Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AccountingKPICard
            label="Trial Balance"
            value="View Report"
            subtitle="Account balances summary"
            icon="file-text"
            variant="info"
            onClick={() => {
              setSelectedReport('trial-balance');
              handleGenerateReport();
            }}
          />
          <AccountingKPICard
            label="Balance Sheet"
            value="View Report"
            subtitle="Assets & liabilities"
            icon="trending-up"
            variant="success"
            onClick={() => {
              setSelectedReport('balance-sheet');
              handleGenerateReport();
            }}
          />
          <AccountingKPICard
            label="Income Statement"
            value="View Report"
            subtitle="P&L statement"
            icon="trending-up"
            variant="warning"
            onClick={() => {
              setSelectedReport('income-statement');
              handleGenerateReport();
            }}
          />
          <AccountingKPICard
            label="Aging Reports"
            value="View Report"
            subtitle="AP/AR aging analysis"
            icon="clock"
            variant="default"
            onClick={() => {
              setSelectedReport('aging-ap');
              handleGenerateReport();
            }}
          />
        </div>

        {/* Report Selection & Filter Panel */}
        <AccountingFilterPanel>
          {/* Report Type */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Report Type</label>
            <SelectBox
              dataSource={reportTypes}
              valueExpr="value"
              displayExpr="text"
              value={selectedReport}
              onValueChanged={handleReportChange}
              data-testid="report-type-select"
              stylingMode="outlined"
            />
          </div>

          {/* Date Selection */}
          {needsPeriodDates ? (
            <>
              <div className="flex-1 min-w-[160px]">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Period Start</label>
                <DateBox
                  value={periodStart}
                  onValueChanged={(e) => setPeriodStart(e.value)}
                  displayFormat="yyyy-MM-dd"
                  data-testid="period-start-date"
                  stylingMode="outlined"
                />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Period End</label>
                <DateBox
                  value={periodEnd}
                  onValueChanged={(e) => setPeriodEnd(e.value)}
                  displayFormat="yyyy-MM-dd"
                  data-testid="period-end-date"
                  stylingMode="outlined"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 min-w-[160px]">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">As of Date</label>
              <DateBox
                value={asOfDate}
                onValueChanged={(e) => setAsOfDate(e.value)}
                displayFormat="yyyy-MM-dd"
                data-testid="as-of-date"
                stylingMode="outlined"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 items-end">
            <Button
              text="Generate Report"
              type="default"
              stylingMode="contained"
              onClick={handleGenerateReport}
              data-testid="generate-report-btn"
            />
            {reportData && (
              <Button
                text="Export JSON"
                type="normal"
                stylingMode="outlined"
                onClick={handleExport}
                data-testid="export-btn"
              />
            )}
          </div>
        </AccountingFilterPanel>

        {/* Report Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6" data-testid="report-content">
          {renderReportContent()}
        </div>
      </div>
    </div>
  );
}

'use client';

// Financial Reports Dashboard
// Feature: 010-accounting-module-integration
// User Story 5: Generate Financial Statements

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { DateBox } from 'devextreme-react/date-box';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import DataGrid, { Column, Summary, TotalItem } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingFilterPanel,
} from '@/components/accounting';
import { BarChart3, FileText, TrendingUp, DollarSign, Clock, ChevronRight } from 'lucide-react';
import type {
  TrialBalanceReport,
  BalanceSheetReport,
  IncomeStatementReport,
  AgingReport,
} from '@/types/accounting';

type ReportType = 'trial-balance' | 'balance-sheet' | 'income-statement' | 'cash-flow' | 'aging-ap' | 'aging-ar';

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
  const t = useTranslations('accounting');
  const reportTypes = [
    { value: 'trial-balance', text: t('reports.type.trialBalance') },
    { value: 'balance-sheet', text: t('reports.type.balanceSheet') },
    { value: 'income-statement', text: t('reports.type.incomeStatement') },
    { value: 'cash-flow', text: t('reports.type.cashFlow') },
    { value: 'aging-ap', text: t('reports.type.agingAp') },
    { value: 'aging-ar', text: t('reports.type.agingAr') },
  ];
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

  const handleReportChange = useCallback((e: { value?: ReportType }) => {
    if (e.value) {
      setSelectedReport(e.value);
      setGenerateReport(false);
    }
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
    notify(t('reports.toast.exportSuccess'), 'success', 2000);
  }, [reportData, selectedReport, asOfDate]);

  const renderReportContent = () => {
    if (isLoading) {
      return (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-gray-600">{t('reports.loading')}</p>
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
            {t('reports.errorPrefix')}: {error instanceof Error ? error.message : t('reports.errorGeneric')}
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
          <p className="text-gray-500 text-lg font-medium mb-2">{t('reports.empty.title')}</p>
          <p className="text-gray-400 text-sm">{t('reports.empty.description')}</p>
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
        <h3 className="text-xl font-bold text-gray-900">{t('reports.type.trialBalance')}</h3>
        <p className="text-sm text-gray-500 mt-1">{t('asOfDate')} {report.asOfDate}</p>
      </div>
      <DataGrid
        dataSource={report.entries}
        showBorders
        columnAutoWidth
        keyExpr="accountCode"
        className="report-grid"
      >
        <Column dataField="accountCode" caption={t('accountCode')} width={120} />
        <Column dataField="accountName" caption={t('accountName')} />
        <Column dataField="accountType" caption={t('reports.common.accountType')} width={100} />
        <Column dataField="periodDebit" caption={t('debit')} format="#,##0.00" width={120} />
        <Column dataField="periodCredit" caption={t('credit')} format="#,##0.00" width={120} />
        <Column dataField="closingDebit" caption={t('reports.trialBalance.closingDebit')} format="#,##0.00" width={120} />
        <Column dataField="closingCredit" caption={t('reports.trialBalance.closingCredit')} format="#,##0.00" width={120} />
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
          <h3 className="text-xl font-bold text-gray-900">{t('reports.type.balanceSheet')}</h3>
          <p className="text-sm text-gray-500 mt-1">{t('asOfDate')} {report.asOfDate}</p>
        </div>
        <div className={`px-4 py-2 rounded-lg font-semibold ${report.isBalanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {report.isBalanced ? `✓ ${t('reports.common.balancedYes')}` : `✗ ${t('reports.common.balancedNo')}`}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Assets */}
        <div className="border border-gray-200 rounded-xl p-6 bg-gradient-to-br from-blue-50/50 to-white">
          <h4 className="font-bold text-lg mb-4 text-blue-900">{t('assets')}</h4>
          <div className="space-y-4">
            <div>
              <h5 className="font-semibold">{t('currentAssets')}</h5>
              <DataGrid
                dataSource={report.assets.currentAssets.accounts}
                showBorders
                keyExpr="code"
              >
                <Column dataField="code" caption={t('reports.common.code')} width={80} />
                <Column dataField="name" caption={t('reports.common.account')} />
                <Column dataField="amount" caption={t('amount')} format="#,##0.00" width={120} />
              </DataGrid>
              <div className="text-right font-semibold mt-2">
                {t('reports.common.subtotal')}: {report.assets.currentAssets.subtotal.toLocaleString()}
              </div>
            </div>
            <div>
              <h5 className="font-semibold">{t('nonCurrentAssets')}</h5>
              <DataGrid
                dataSource={report.assets.nonCurrentAssets.accounts}
                showBorders
                keyExpr="code"
              >
                <Column dataField="code" caption={t('reports.common.code')} width={80} />
                <Column dataField="name" caption={t('reports.common.account')} />
                <Column dataField="amount" caption={t('amount')} format="#,##0.00" width={120} />
              </DataGrid>
              <div className="text-right font-semibold mt-2">
                {t('reports.common.subtotal')}: {report.assets.nonCurrentAssets.subtotal.toLocaleString()}
              </div>
            </div>
            <div className="text-right font-bold text-lg border-t pt-2">
              {t('totalAssets')}: {report.assets.totalAssets.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Liabilities & Equity */}
        <div className="border border-gray-200 rounded-xl p-6 bg-gradient-to-br from-green-50/50 to-white">
          <h4 className="font-bold text-lg mb-4 text-green-900">{t('reports.common.totalLiabilitiesAndEquity')}</h4>
          <div className="space-y-4">
            <div>
              <h5 className="font-semibold">{t('currentLiabilities')}</h5>
              <DataGrid
                dataSource={report.liabilities.currentLiabilities.accounts}
                showBorders
                keyExpr="code"
              >
                <Column dataField="code" caption={t('reports.common.code')} width={80} />
                <Column dataField="name" caption={t('reports.common.account')} />
                <Column dataField="amount" caption={t('amount')} format="#,##0.00" width={120} />
              </DataGrid>
              <div className="text-right font-semibold mt-2">
                {t('reports.common.subtotal')}: {report.liabilities.currentLiabilities.subtotal.toLocaleString()}
              </div>
            </div>
            <div>
              <h5 className="font-semibold">{t('equity')}</h5>
              <DataGrid
                dataSource={report.equity.section.accounts}
                showBorders
                keyExpr="code"
              >
                <Column dataField="code" caption={t('reports.common.code')} width={80} />
                <Column dataField="name" caption={t('reports.common.account')} />
                <Column dataField="amount" caption={t('amount')} format="#,##0.00" width={120} />
              </DataGrid>
              <div className="text-right font-semibold mt-2">
                {t('reports.common.subtotal')}: {report.equity.totalEquity.toLocaleString()}
              </div>
            </div>
            <div className="text-right font-bold text-lg border-t pt-2">
              {t('reports.common.total')}: {report.totalLiabilitiesAndEquity.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderIncomeStatement = (report: IncomeStatementReport) => (
    <div data-testid="income-statement-report">
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-900">{t('reports.type.incomeStatement')}</h3>
        <p className="text-sm text-gray-500 mt-1">{report.periodStart} - {report.periodEnd}</p>
      </div>

      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Revenue */}
        <div>
          <h5 className="font-semibold border-b pb-2">{t('revenue')}</h5>
          <DataGrid dataSource={report.revenue.accounts} showBorders keyExpr="code">
            <Column dataField="code" caption={t('reports.common.code')} width={80} />
            <Column dataField="name" caption={t('reports.common.account')} />
            <Column dataField="amount" caption={t('amount')} format="#,##0.00" width={120} />
          </DataGrid>
          <div className="text-right font-semibold">{t('reports.common.total')}{t('revenue')}: {report.revenue.subtotal.toLocaleString()}</div>
        </div>

        {/* COGS */}
        <div>
          <h5 className="font-semibold border-b pb-2">{t('costOfGoodsSold')}</h5>
          <DataGrid dataSource={report.costOfGoodsSold.accounts} showBorders keyExpr="code">
            <Column dataField="code" caption={t('reports.common.code')} width={80} />
            <Column dataField="name" caption={t('reports.common.account')} />
            <Column dataField="amount" caption={t('amount')} format="#,##0.00" width={120} />
          </DataGrid>
          <div className="text-right font-semibold">{t('reports.common.total')}{t('costOfGoodsSold')}: {report.costOfGoodsSold.subtotal.toLocaleString()}</div>
        </div>

        <div className="text-right font-bold text-lg bg-blue-50 border border-blue-200 p-3 rounded-lg">
          {t('grossProfit')}: {report.grossProfit.toLocaleString()}
        </div>

        {/* Operating Expenses */}
        <div>
          <h5 className="font-semibold border-b pb-2">{t('operatingExpenses')}</h5>
          <DataGrid dataSource={report.operatingExpenses.accounts} showBorders keyExpr="code">
            <Column dataField="code" caption={t('reports.common.code')} width={80} />
            <Column dataField="name" caption={t('reports.common.account')} />
            <Column dataField="amount" caption={t('amount')} format="#,##0.00" width={120} />
          </DataGrid>
          <div className="text-right font-semibold">
            {t('reports.common.total')}{t('operatingExpenses')}: {report.operatingExpenses.subtotal.toLocaleString()}
          </div>
        </div>

        <div className="text-right font-bold text-lg bg-blue-50 border border-blue-200 p-3 rounded-lg">
          {t('operatingIncome')}: {report.operatingIncome.toLocaleString()}
        </div>

        <div className="text-right font-bold text-xl bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 p-4 rounded-xl shadow-sm">
          {t('netIncome')}: <span className="text-green-700">{report.netIncome.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );

  const renderAgingReport = (report: AgingReport) => (
    <div data-testid="aging-report">
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-900">
          {report.reportType === 'AP' ? t('reports.aging.titleAp') : t('reports.aging.titleAr')}
        </h3>
        <p className="text-sm text-gray-500 mt-1">{t('asOfDate')} {report.asOfDate}</p>
      </div>

      {/* Summary Buckets */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {report.buckets.map((bucket, idx) => {
          const accents = [
            'border-l-emerald-500',
            'border-l-blue-500',
            'border-l-amber-500',
            'border-l-orange-500',
            'border-l-rose-500',
          ];
          return (
            <div
              key={bucket.range}
              className={`bg-white border border-gray-200 border-l-4 ${accents[idx]} rounded-[14px] p-4 text-center shadow-[0_6px_20px_rgba(6,78,59,0.06)]`}
            >
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{bucket.range}</div>
              <div className="text-2xl font-bold text-gray-900 mt-2">{bucket.amount.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-1">{t('reports.aging.invoicesCount', { count: bucket.count })}</div>
            </div>
          );
        })}
      </div>

      {/* Detail Grid */}
      <DataGrid dataSource={report.entries} showBorders columnAutoWidth keyExpr="entityId">
        <Column dataField="entityName" caption={report.reportType === 'AP' ? t('reports.aging.vendor') : t('reports.aging.customer')} />
        <Column dataField="current" caption={t('reports.aging.current')} format="#,##0.00" width={100} />
        <Column dataField="days1to30" caption={t('reports.aging.days1to30')} format="#,##0.00" width={100} />
        <Column dataField="days31to60" caption={t('reports.aging.days31to60')} format="#,##0.00" width={100} />
        <Column dataField="days61to90" caption={t('reports.aging.days61to90')} format="#,##0.00" width={100} />
        <Column dataField="over90" caption={t('reports.aging.over90')} format="#,##0.00" width={100} />
        <Column dataField="total" caption={t('reports.aging.total')} format="#,##0.00" width={120} />
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
        {t('reports.aging.grandTotal')}: <span className="text-blue-700">{report.totals.total.toLocaleString()}</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30" data-testid="reports-dashboard">
      <AccountingPageHeader
        title={t('page.title')}
        subtitle={t('reports.subtitle')}
        icon="bar-chart"
      />

      <div className="p-6 space-y-6">
        {/* Dedicated Report Pages - Featured Reports */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.overview.featuredTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/accounting/reports/trial-balance" className="group" data-testid="link-trial-balance">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
                <div className="flex items-center justify-between mb-3">
                  <FileText className="w-8 h-8 text-blue-600" />
                  <ChevronRight className="w-5 h-5 text-blue-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <h3 className="font-semibold text-gray-900">{t('reports.type.trialBalance')}</h3>
                <p className="text-sm text-gray-500 mt-1">Trial Balance</p>
                <p className="text-xs text-blue-600 mt-2">{t('reports.overview.trialBalanceHint')}</p>
              </div>
            </Link>

            <Link href="/accounting/reports/balance-sheet" className="group" data-testid="link-balance-sheet">
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-5 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
                <div className="flex items-center justify-between mb-3">
                  <TrendingUp className="w-8 h-8 text-emerald-600" />
                  <ChevronRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <h3 className="font-semibold text-gray-900">{t('reports.type.balanceSheet')}</h3>
                <p className="text-sm text-gray-500 mt-1">Balance Sheet</p>
                <p className="text-xs text-emerald-600 mt-2">{t('reports.overview.balanceSheetHint')}</p>
              </div>
            </Link>

            <Link href="/accounting/reports/income-statement" className="group" data-testid="link-income-statement">
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-5 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
                <div className="flex items-center justify-between mb-3">
                  <DollarSign className="w-8 h-8 text-amber-600" />
                  <ChevronRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <h3 className="font-semibold text-gray-900">{t('reports.type.incomeStatement')}</h3>
                <p className="text-sm text-gray-500 mt-1">Income Statement</p>
                <p className="text-xs text-amber-600 mt-2">{t('reports.overview.incomeStatementHint')}</p>
              </div>
            </Link>

            <Link href="/accounting/reports/cash-flow" className="group" data-testid="link-cash-flow">
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-5 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
                <div className="flex items-center justify-between mb-3">
                  <BarChart3 className="w-8 h-8 text-purple-600" />
                  <ChevronRight className="w-5 h-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <h3 className="font-semibold text-gray-900">{t('reports.type.cashFlow')}</h3>
                <p className="text-sm text-gray-500 mt-1">Cash Flow</p>
                <p className="text-xs text-purple-600 mt-2">{t('reports.overview.cashFlowHint')}</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Legacy Report Quick Access Cards */}
        <div className="border-t border-gray-200 pt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.overview.quickTitle')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <AccountingKPICard
              label={t('reports.type.trialBalance')}
              value={t('reports.overview.viewReport')}
              subtitle={t('reports.overview.trialBalanceSubtitle')}
              icon="file-text"
              variant="info"
              onClick={() => {
                setSelectedReport('trial-balance');
                handleGenerateReport();
              }}
            />
            <AccountingKPICard
              label={t('reports.type.balanceSheet')}
              value={t('reports.overview.viewReport')}
              subtitle={t('reports.overview.balanceSheetSubtitle')}
              icon="trending-up"
              variant="success"
              onClick={() => {
                setSelectedReport('balance-sheet');
                handleGenerateReport();
              }}
            />
            <AccountingKPICard
              label={t('reports.type.incomeStatement')}
              value={t('reports.overview.viewReport')}
              subtitle={t('reports.overview.incomeStatementSubtitle')}
              icon="trending-up"
              variant="warning"
              onClick={() => {
                setSelectedReport('income-statement');
                handleGenerateReport();
              }}
            />
            <AccountingKPICard
              label={t('reports.overview.agingLabel')}
              value={t('reports.overview.viewReport')}
              subtitle={t('reports.overview.agingSubtitle')}
              icon="clock"
              variant="default"
              onClick={() => {
                setSelectedReport('aging-ap');
                handleGenerateReport();
              }}
            />
          </div>
        </div>

        {/* Report Selection & Filter Panel */}
        <AccountingFilterPanel>
          {/* Report Type */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('reports.filters.reportType')}</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('reports.filters.periodStart')}</label>
                <DateBox
                  value={periodStart}
                  onValueChanged={(e) => setPeriodStart(e.value)}
                  displayFormat="yyyy-MM-dd"
                  data-testid="period-start-date"
                  stylingMode="outlined"
                />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('reports.filters.periodEnd')}</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('reports.filters.asOfDate')}</label>
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
              text={t('reports.actions.generate')}
              type="default"
              stylingMode="contained"
              onClick={handleGenerateReport}
              elementAttr={{ 'data-testid': 'generate-report-btn' }}
            />
            {reportData && (
              <Button
                text={t('reports.actions.exportJson')}
                type="normal"
                stylingMode="outlined"
                onClick={handleExport}
                elementAttr={{ 'data-testid': 'export-btn' }}
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

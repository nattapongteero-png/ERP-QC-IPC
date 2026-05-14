'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import DataGrid, { Column, Summary, TotalItem, ColumnChooser, Export, Grouping, GroupPanel } from 'devextreme-react/data-grid';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ReportLanguageProvider, useReportLanguage } from '@/contexts/report-language-context';
import {
  ReportHeader,
  ReportKPICards,
  ReportToolbar,
  ReportPeriodSelector,
  type ReportKPI,
} from '../_components';
import { exportToPDF, exportToExcel, exportToCSV, downloadCSV } from '@/lib/services/report-export.service';
import type { TrialBalanceReport } from '@/types/accounting';

async function fetchTrialBalance(asOfDate: string): Promise<TrialBalanceReport> {
  const res = await fetch(`/api/accounting/reports/trial-balance?asOfDate=${asOfDate}`);
  if (!res.ok) throw new Error('Failed to fetch trial balance');
  const data = await res.json();
  return data.data;
}

function TrialBalanceContent() {
  const t = useTranslations('accounting');
  const { language, t: reportT, formatCurrency } = useReportLanguage();
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split('T')[0]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['trial-balance', asOfDate],
    queryFn: () => fetchTrialBalance(asOfDate),
  });

  const kpis: ReportKPI[] = data ? [
    { labelKey: 'totalDebits', value: data.totals.closingDebit, format: 'currency', status: 'neutral' },
    { labelKey: 'totalCredits', value: data.totals.closingCredit, format: 'currency', status: 'neutral' },
    { labelKey: 'variance', value: Math.abs(data.totals.closingDebit - data.totals.closingCredit), format: 'currency', status: data.totals.closingDebit === data.totals.closingCredit ? 'good' : 'danger' },
  ] : [];

  const chartData = data ? [
    { name: 'Assets', debit: data.entries.filter(e => e.category === 'asset').reduce((s, e) => s + e.closingDebit, 0), credit: data.entries.filter(e => e.category === 'asset').reduce((s, e) => s + e.closingCredit, 0) },
    { name: 'Liabilities', debit: data.entries.filter(e => e.category === 'liability').reduce((s, e) => s + e.closingDebit, 0), credit: data.entries.filter(e => e.category === 'liability').reduce((s, e) => s + e.closingCredit, 0) },
    { name: 'Equity', debit: data.entries.filter(e => e.category === 'equity').reduce((s, e) => s + e.closingDebit, 0), credit: data.entries.filter(e => e.category === 'equity').reduce((s, e) => s + e.closingCredit, 0) },
    { name: 'Revenue', debit: data.entries.filter(e => e.category === 'revenue').reduce((s, e) => s + e.closingDebit, 0), credit: data.entries.filter(e => e.category === 'revenue').reduce((s, e) => s + e.closingCredit, 0) },
    { name: 'Expenses', debit: data.entries.filter(e => e.category === 'expense').reduce((s, e) => s + e.closingDebit, 0), credit: data.entries.filter(e => e.category === 'expense').reduce((s, e) => s + e.closingCredit, 0) },
  ] : [];

  const columns = [
    { key: 'accountCode', label: t('accountCode') },
    { key: 'accountName', label: t('accountName') },
    { key: 'openingDebit', label: `${t('openingBalance')} ${t('debit')}`, format: 'currency' as const },
    { key: 'openingCredit', label: `${t('openingBalance')} ${t('credit')}`, format: 'currency' as const },
    { key: 'periodDebit', label: `${t('periodActivity')} ${t('debit')}`, format: 'currency' as const },
    { key: 'periodCredit', label: `${t('periodActivity')} ${t('credit')}`, format: 'currency' as const },
    { key: 'closingDebit', label: `${t('closingBalance')} ${t('debit')}`, format: 'currency' as const },
    { key: 'closingCredit', label: `${t('closingBalance')} ${t('credit')}`, format: 'currency' as const },
  ];

  const handleExportPDF = useCallback(() => {
    if (!data) return;
    const entries = data.entries as unknown as Record<string, unknown>[];
    exportToPDF(entries, columns, {
      filename: `trial-balance-${asOfDate}`,
      title: 'Trial Balance',
      titleTh: 'งบทดลอง',
      language,
      asOfDate,
    });
  }, [data, asOfDate, language, columns]);

  const handleExportExcel = useCallback(() => {
    if (!data) return;
    const entries = data.entries as unknown as Record<string, unknown>[];
    exportToExcel(entries, columns, {
      filename: `trial-balance-${asOfDate}`,
      title: 'Trial Balance',
      language,
      asOfDate,
    });
  }, [data, asOfDate, language, columns]);

  const handleExportCSV = useCallback(() => {
    if (!data) return;
    const entries = data.entries as unknown as Record<string, unknown>[];
    const csv = exportToCSV(entries, columns, { language, filename: '', title: '' });
    downloadCSV(csv, `trial-balance-${asOfDate}.csv`);
  }, [data, asOfDate, language, columns]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="p-6" data-testid="trial-balance-page" data-title={t('page.title')}>
      <ReportHeader
        titleKey="trialBalance"
        subtitle={`${t('asOfDate')}: ${asOfDate}`}
        onRefresh={() => refetch()}
        isLoading={isLoading}
      />

      <ReportPeriodSelector
        mode="asOfDate"
        asOfDate={asOfDate}
        onAsOfDateChange={setAsOfDate}
        showPresets
      />

      <ReportKPICards kpis={kpis} isLoading={isLoading} />

      <ReportToolbar
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
        onPrint={handlePrint}
        disabled={!data}
      />

      {/* Chart */}
      {data && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">{t('debit')} vs {t('credit')} by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `฿${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend />
                  <Bar dataKey="debit" name={t('debit')} fill="#3b82f6" />
                  <Bar dataKey="credit" name={t('credit')} fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Grid */}
      <Card>
        <CardContent className="p-0">
          <DataGrid
            dataSource={data?.entries || []}
            showBorders
            rowAlternationEnabled
            columnAutoWidth
            wordWrapEnabled
          >
            <GroupPanel visible />
            <Grouping autoExpandAll />
            <ColumnChooser enabled />
            <Export enabled />
            <Column dataField="accountCode" caption={t('accountCode')} width={100} />
            <Column dataField="accountName" caption={t('accountName')} />
            <Column dataField="category" caption="Category" groupIndex={0} />
            <Column dataField="openingDebit" caption={`${t('openingBalance')} ${t('debit')}`} dataType="number" format="#,##0.00" />
            <Column dataField="openingCredit" caption={`${t('openingBalance')} ${t('credit')}`} dataType="number" format="#,##0.00" />
            <Column dataField="periodDebit" caption={`${t('periodActivity')} ${t('debit')}`} dataType="number" format="#,##0.00" />
            <Column dataField="periodCredit" caption={`${t('periodActivity')} ${t('credit')}`} dataType="number" format="#,##0.00" />
            <Column dataField="closingDebit" caption={`${t('closingBalance')} ${t('debit')}`} dataType="number" format="#,##0.00" />
            <Column dataField="closingCredit" caption={`${t('closingBalance')} ${t('credit')}`} dataType="number" format="#,##0.00" />
            <Summary>
              <TotalItem column="openingDebit" summaryType="sum" valueFormat="#,##0.00" />
              <TotalItem column="openingCredit" summaryType="sum" valueFormat="#,##0.00" />
              <TotalItem column="periodDebit" summaryType="sum" valueFormat="#,##0.00" />
              <TotalItem column="periodCredit" summaryType="sum" valueFormat="#,##0.00" />
              <TotalItem column="closingDebit" summaryType="sum" valueFormat="#,##0.00" />
              <TotalItem column="closingCredit" summaryType="sum" valueFormat="#,##0.00" />
            </Summary>
          </DataGrid>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TrialBalancePage() {
  return (
    <ReportLanguageProvider>
      <TrialBalanceContent />
    </ReportLanguageProvider>
  );
}

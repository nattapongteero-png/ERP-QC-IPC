'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
import type { IncomeStatementReport, IncomeStatementSection } from '@/types/accounting';

async function fetchIncomeStatement(startDate: string, endDate: string): Promise<IncomeStatementReport> {
  const res = await fetch(`/api/accounting/reports/income-statement?periodStart=${startDate}&periodEnd=${endDate}`);
  if (!res.ok) throw new Error('Failed to fetch income statement');
  const data = await res.json();
  return data.data;
}

function SectionTable({ section, title, isSubtraction = false }: { section: IncomeStatementSection; title: string; isSubtraction?: boolean }) {
  const { formatCurrency } = useReportLanguage();

  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>
      <table className="w-full text-sm">
        <tbody>
          {section.accounts.map((account, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="py-1 px-2">{account.code}</td>
              <td className="py-1 px-2">{account.name}</td>
              <td className="py-1 px-2 text-right">
                {isSubtraction ? `(${formatCurrency(account.amount)})` : formatCurrency(account.amount)}
              </td>
            </tr>
          ))}
          <tr className="font-bold border-t border-gray-300">
            <td className="py-2 px-2" colSpan={2}>Total {title}</td>
            <td className="py-2 px-2 text-right">
              {isSubtraction ? `(${formatCurrency(section.subtotal)})` : formatCurrency(section.subtotal)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function IncomeStatementContent() {
  const { language, t, formatCurrency } = useReportLanguage();
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['income-statement', startDate, endDate],
    queryFn: () => fetchIncomeStatement(startDate, endDate),
  });

  // Calculate margins
  const grossMargin = data && data.revenue.subtotal > 0
    ? (data.grossProfit / data.revenue.subtotal) * 100
    : 0;
  const operatingMargin = data && data.revenue.subtotal > 0
    ? (data.operatingIncome / data.revenue.subtotal) * 100
    : 0;
  const netMargin = data && data.revenue.subtotal > 0
    ? (data.netIncome / data.revenue.subtotal) * 100
    : 0;

  const kpis: ReportKPI[] = data ? [
    { labelKey: 'revenue', value: data.revenue.subtotal, format: 'currency', status: 'neutral' },
    { labelKey: 'grossProfit', value: data.grossProfit, format: 'currency', status: data.grossProfit >= 0 ? 'good' : 'danger' },
    { labelKey: 'operatingIncome', value: data.operatingIncome, format: 'currency', status: data.operatingIncome >= 0 ? 'good' : 'danger' },
    { labelKey: 'netIncome', value: data.netIncome, format: 'currency', status: data.netIncome >= 0 ? 'good' : 'danger' },
    { labelKey: 'grossMargin', value: grossMargin, format: 'percent', status: grossMargin >= 30 ? 'good' : grossMargin >= 15 ? 'warning' : 'danger', suffix: '%' },
    { labelKey: 'operatingMargin', value: operatingMargin, format: 'percent', status: operatingMargin >= 15 ? 'good' : operatingMargin >= 5 ? 'warning' : 'danger', suffix: '%' },
    { labelKey: 'netMargin', value: netMargin, format: 'percent', status: netMargin >= 10 ? 'good' : netMargin >= 0 ? 'warning' : 'danger', suffix: '%' },
  ] : [];

  const chartData = data ? [
    { name: 'Revenue', value: data.revenue.subtotal },
    { name: 'COGS', value: data.costOfGoodsSold.subtotal },
    { name: 'Gross Profit', value: data.grossProfit },
    { name: 'Op. Expenses', value: data.operatingExpenses.subtotal },
    { name: 'Op. Income', value: data.operatingIncome },
    { name: 'Net Income', value: data.netIncome },
  ] : [];

  const columns = [
    { key: 'code', label: t('accountCode') },
    { key: 'name', label: t('accountName') },
    { key: 'amount', label: t('amount'), format: 'currency' as const },
  ];

  // Flatten all accounts for export
  const flattenedData = data ? [
    ...data.revenue.accounts.map(a => ({ ...a, section: 'Revenue' })),
    ...data.costOfGoodsSold.accounts.map(a => ({ ...a, section: 'Cost of Goods Sold' })),
    ...data.operatingExpenses.accounts.map(a => ({ ...a, section: 'Operating Expenses' })),
    ...data.otherIncomeExpenses.accounts.map(a => ({ ...a, section: 'Other Income/Expenses' })),
  ] : [];

  const handleExportPDF = useCallback(() => {
    if (!data) return;
    const entries = flattenedData as unknown as Record<string, unknown>[];
    exportToPDF(entries, columns, {
      filename: `income-statement-${startDate}-${endDate}`,
      title: 'Income Statement',
      titleTh: 'งบกำไรขาดทุน',
      language,
      periodStart: startDate,
      periodEnd: endDate,
    });
  }, [data, startDate, endDate, language, columns, flattenedData]);

  const handleExportExcel = useCallback(() => {
    if (!data) return;
    const entries = flattenedData as unknown as Record<string, unknown>[];
    exportToExcel(entries, columns, {
      filename: `income-statement-${startDate}-${endDate}`,
      title: 'Income Statement',
      language,
      periodStart: startDate,
      periodEnd: endDate,
    });
  }, [data, startDate, endDate, language, columns, flattenedData]);

  const handleExportCSV = useCallback(() => {
    if (!data) return;
    const entries = flattenedData as unknown as Record<string, unknown>[];
    const csv = exportToCSV(entries, columns, { language, filename: '', title: '' });
    downloadCSV(csv, `income-statement-${startDate}-${endDate}.csv`);
  }, [data, startDate, endDate, language, columns, flattenedData]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="p-6" data-testid="income-statement-page">
      <ReportHeader
        titleKey="incomeStatement"
        subtitle={`${t('period')}: ${startDate} - ${endDate}`}
        onRefresh={() => refetch()}
        isLoading={isLoading}
      />

      <ReportPeriodSelector
        mode="periodRange"
        periodStart={startDate}
        periodEnd={endDate}
        onPeriodStartChange={setStartDate}
        onPeriodEndChange={setEndDate}
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

      {/* Waterfall Chart */}
      {data && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Income Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `฿${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend />
                  <Area type="monotone" dataKey="value" name="Amount" stroke="#3b82f6" fill="#93c5fd" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Income Statement Sections */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue & COGS */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('revenue')} & {t('costOfGoodsSold')}</CardTitle>
            </CardHeader>
            <CardContent>
              <SectionTable section={data.revenue} title={t('revenue')} />
              <SectionTable section={data.costOfGoodsSold} title={t('costOfGoodsSold')} isSubtraction />
              <div className="border-t-2 border-blue-500 pt-2 font-bold flex justify-between">
                <span>{t('grossProfit')}</span>
                <span className={data.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {formatCurrency(data.grossProfit)}
                </span>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Gross Margin: {grossMargin.toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          {/* Operating Expenses & Net Income */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('operatingExpenses')} & {t('netIncome')}</CardTitle>
            </CardHeader>
            <CardContent>
              <SectionTable section={data.operatingExpenses} title={t('operatingExpenses')} isSubtraction />
              <div className="border-t border-gray-300 pt-2 font-semibold flex justify-between mb-4">
                <span>{t('operatingIncome')}</span>
                <span className={data.operatingIncome >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {formatCurrency(data.operatingIncome)}
                </span>
              </div>

              <SectionTable section={data.otherIncomeExpenses} title={t('otherIncomeExpenses')} />

              <div className="border-t border-gray-300 pt-2 flex justify-between mb-2">
                <span>{t('netIncomeBeforeTax')}</span>
                <span>{formatCurrency(data.netIncomeBeforeTax)}</span>
              </div>
              <div className="flex justify-between mb-2 text-gray-600">
                <span>{t('incomeTax')}</span>
                <span>({formatCurrency(data.incomeTax)})</span>
              </div>
              <div className="border-t-2 border-emerald-500 pt-2 font-bold flex justify-between text-lg">
                <span>{t('netIncome')}</span>
                <span className={data.netIncome >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {formatCurrency(data.netIncome)}
                </span>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Net Margin: {netMargin.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function IncomeStatementPage() {
  return (
    <ReportLanguageProvider>
      <IncomeStatementContent />
    </ReportLanguageProvider>
  );
}

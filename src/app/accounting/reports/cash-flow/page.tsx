'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
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
import type { CashFlowStatementReport, CashFlowSection } from '@/types/accounting';

async function fetchCashFlow(startDate: string, endDate: string): Promise<CashFlowStatementReport> {
  const res = await fetch(`/api/accounting/reports/cash-flow?periodStart=${startDate}&periodEnd=${endDate}`);
  if (!res.ok) throw new Error('Failed to fetch cash flow statement');
  const data = await res.json();
  return data.data;
}

function SectionTable({ section, title }: { section: CashFlowSection; title: string }) {
  const { formatCurrency } = useReportLanguage();

  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>
      <table className="w-full text-sm">
        <tbody>
          {section.items.map((item, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="py-1 px-2">{item.description}</td>
              <td className={`py-1 px-2 text-right ${item.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {item.amount >= 0 ? formatCurrency(item.amount) : `(${formatCurrency(Math.abs(item.amount))})`}
              </td>
            </tr>
          ))}
          <tr className="font-bold border-t border-gray-300">
            <td className="py-2 px-2">Subtotal</td>
            <td className={`py-2 px-2 text-right ${section.subtotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {section.subtotal >= 0 ? formatCurrency(section.subtotal) : `(${formatCurrency(Math.abs(section.subtotal))})`}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CashFlowContent() {
  const t = useTranslations('accounting');
  const { language, t: reportT, formatCurrency } = useReportLanguage();
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cash-flow', startDate, endDate],
    queryFn: () => fetchCashFlow(startDate, endDate),
  });

  const kpis: ReportKPI[] = data ? [
    { labelKey: 'operatingCashFlow', value: data.operatingActivities.netCashFromOperating, format: 'currency', status: data.operatingActivities.netCashFromOperating >= 0 ? 'good' : 'danger' },
    { labelKey: 'investingCashFlow', value: data.investingActivities.netCashFromInvesting, format: 'currency', status: 'neutral' },
    { labelKey: 'financingCashFlow', value: data.financingActivities.netCashFromFinancing, format: 'currency', status: 'neutral' },
    { labelKey: 'netChangeInCash', value: data.netChangeInCash, format: 'currency', status: data.netChangeInCash >= 0 ? 'good' : 'danger' },
    { labelKey: 'beginningCash', value: data.beginningCashBalance, format: 'currency', status: 'neutral' },
    { labelKey: 'endingCash', value: data.endingCashBalance, format: 'currency', status: data.endingCashBalance > 0 ? 'good' : 'danger' },
  ] : [];

  const chartData = data ? [
    { name: 'Operating', value: data.operatingActivities.netCashFromOperating },
    { name: 'Investing', value: data.investingActivities.netCashFromInvesting },
    { name: 'Financing', value: data.financingActivities.netCashFromFinancing },
    { name: 'Net Change', value: data.netChangeInCash },
  ] : [];

  const columns = [
    { key: 'description', label: t('description') },
    { key: 'amount', label: t('amount'), format: 'currency' as const },
  ];

  // Flatten all items for export
  const flattenedData = data ? [
    { description: 'Net Income', amount: data.operatingActivities.netIncome, section: 'Operating' },
    ...data.operatingActivities.adjustments.items.map(i => ({ ...i, section: 'Operating - Adjustments' })),
    ...data.operatingActivities.workingCapitalChanges.items.map(i => ({ ...i, section: 'Operating - Working Capital' })),
    { description: 'Net Cash from Operating', amount: data.operatingActivities.netCashFromOperating, section: 'Operating' },
    ...data.investingActivities.section.items.map(i => ({ ...i, section: 'Investing' })),
    { description: 'Net Cash from Investing', amount: data.investingActivities.netCashFromInvesting, section: 'Investing' },
    ...data.financingActivities.section.items.map(i => ({ ...i, section: 'Financing' })),
    { description: 'Net Cash from Financing', amount: data.financingActivities.netCashFromFinancing, section: 'Financing' },
    { description: 'Net Change in Cash', amount: data.netChangeInCash, section: 'Summary' },
    { description: 'Beginning Cash Balance', amount: data.beginningCashBalance, section: 'Summary' },
    { description: 'Ending Cash Balance', amount: data.endingCashBalance, section: 'Summary' },
  ] : [];

  const handleExportPDF = useCallback(() => {
    if (!data) return;
    const entries = flattenedData as unknown as Record<string, unknown>[];
    exportToPDF(entries, columns, {
      filename: `cash-flow-${startDate}-${endDate}`,
      title: 'Cash Flow Statement',
      titleTh: 'งบกระแสเงินสด',
      language,
      periodStart: startDate,
      periodEnd: endDate,
    });
  }, [data, startDate, endDate, language, columns, flattenedData]);

  const handleExportExcel = useCallback(() => {
    if (!data) return;
    const entries = flattenedData as unknown as Record<string, unknown>[];
    exportToExcel(entries, columns, {
      filename: `cash-flow-${startDate}-${endDate}`,
      title: 'Cash Flow Statement',
      language,
      periodStart: startDate,
      periodEnd: endDate,
    });
  }, [data, startDate, endDate, language, columns, flattenedData]);

  const handleExportCSV = useCallback(() => {
    if (!data) return;
    const entries = flattenedData as unknown as Record<string, unknown>[];
    const csv = exportToCSV(entries, columns, { language, filename: '', title: '' });
    downloadCSV(csv, `cash-flow-${startDate}-${endDate}.csv`);
  }, [data, startDate, endDate, language, columns, flattenedData]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="p-6" data-testid="cash-flow-page" data-title={t('page.title')}>
      <ReportHeader
        titleKey="cashFlowStatement"
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

      {/* Waterfall-style Bar Chart */}
      {data && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Cash Flow Summary</CardTitle>
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
                  <ReferenceLine y={0} stroke="#666" />
                  <Bar dataKey="value" name="Cash Flow">
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cash Flow Sections */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Operating Activities */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('operatingActivities')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex justify-between text-sm">
                <span>{t('netIncome')}</span>
                <span className="font-semibold">{formatCurrency(data.operatingActivities.netIncome)}</span>
              </div>
              <SectionTable section={data.operatingActivities.adjustments} title={t('adjustments')} />
              <SectionTable section={data.operatingActivities.workingCapitalChanges} title={t('workingCapitalChanges')} />
              <div className="border-t-2 border-blue-500 pt-2 font-bold flex justify-between">
                <span>{t('netCashFromOperating')}</span>
                <span className={data.operatingActivities.netCashFromOperating >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {formatCurrency(data.operatingActivities.netCashFromOperating)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Investing Activities */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('investingActivities')}</CardTitle>
            </CardHeader>
            <CardContent>
              <SectionTable section={data.investingActivities.section} title={t('investingItems')} />
              <div className="border-t-2 border-amber-500 pt-2 font-bold flex justify-between">
                <span>{t('netCashFromInvesting')}</span>
                <span className={data.investingActivities.netCashFromInvesting >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {formatCurrency(data.investingActivities.netCashFromInvesting)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Financing Activities */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('financingActivities')}</CardTitle>
            </CardHeader>
            <CardContent>
              <SectionTable section={data.financingActivities.section} title={t('financingItems')} />
              <div className="border-t-2 border-purple-500 pt-2 font-bold flex justify-between">
                <span>{t('netCashFromFinancing')}</span>
                <span className={data.financingActivities.netCashFromFinancing >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {formatCurrency(data.financingActivities.netCashFromFinancing)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cash Reconciliation */}
      {data && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">{t('cashReconciliation')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">{t('beginningCash')}</p>
                <p className="text-xl font-bold">{formatCurrency(data.beginningCashBalance)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">{t('netChangeInCash')}</p>
                <p className={`text-xl font-bold ${data.netChangeInCash >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {data.netChangeInCash >= 0 ? '+' : ''}{formatCurrency(data.netChangeInCash)}
                </p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-lg border-2 border-emerald-200">
                <p className="text-sm text-emerald-700">{t('endingCash')}</p>
                <p className="text-xl font-bold text-emerald-700">{formatCurrency(data.endingCashBalance)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg flex items-center justify-center">
                {data.beginningCashBalance + data.netChangeInCash === data.endingCashBalance ? (
                  <span className="text-emerald-600 font-semibold">✓ Reconciled</span>
                ) : (
                  <span className="text-red-600 font-semibold">✗ Discrepancy</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function CashFlowPage() {
  return (
    <ReportLanguageProvider>
      <CashFlowContent />
    </ReportLanguageProvider>
  );
}

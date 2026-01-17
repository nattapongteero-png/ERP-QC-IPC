'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
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
import type { BalanceSheetReport, BalanceSheetSection } from '@/types/accounting';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'];

async function fetchBalanceSheet(asOfDate: string): Promise<BalanceSheetReport> {
  const res = await fetch(`/api/accounting/reports/balance-sheet?asOfDate=${asOfDate}`);
  if (!res.ok) throw new Error('Failed to fetch balance sheet');
  const data = await res.json();
  return data.data;
}

function SectionTable({ section, title }: { section: BalanceSheetSection; title: string }) {
  const { formatCurrency } = useReportLanguage();

  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>
      <table className="w-full text-sm">
        <tbody>
          {section.accounts.map((account, idx) => (
            <tr key={idx} className={account.isSubtotal ? 'font-semibold bg-gray-50' : 'hover:bg-gray-50'}>
              <td className="py-1 px-2">{account.code}</td>
              <td className="py-1 px-2">{account.name}</td>
              <td className="py-1 px-2 text-right">{formatCurrency(account.amount)}</td>
            </tr>
          ))}
          <tr className="font-bold border-t border-gray-300">
            <td className="py-2 px-2" colSpan={2}>Subtotal {title}</td>
            <td className="py-2 px-2 text-right">{formatCurrency(section.subtotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function BalanceSheetContent() {
  const { language, t, formatCurrency } = useReportLanguage();
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split('T')[0]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['balance-sheet', asOfDate],
    queryFn: () => fetchBalanceSheet(asOfDate),
  });

  // Calculate financial ratios
  const currentRatio = data
    ? data.assets.currentAssets.subtotal / (data.liabilities.currentLiabilities.subtotal || 1)
    : 0;
  const quickRatio = data
    ? (data.assets.currentAssets.subtotal * 0.8) / (data.liabilities.currentLiabilities.subtotal || 1) // Approximate
    : 0;
  const debtToEquity = data
    ? data.liabilities.totalLiabilities / (data.equity.totalEquity || 1)
    : 0;

  const kpis: ReportKPI[] = data ? [
    { labelKey: 'totalAssets', value: data.assets.totalAssets, format: 'currency', status: 'neutral' },
    { labelKey: 'totalLiabilities', value: data.liabilities.totalLiabilities, format: 'currency', status: 'neutral' },
    { labelKey: 'totalEquity', value: data.equity.totalEquity, format: 'currency', status: 'neutral' },
    { labelKey: 'currentRatio', value: currentRatio, format: 'ratio', status: currentRatio >= 1.5 ? 'good' : currentRatio >= 1 ? 'warning' : 'danger', suffix: 'x' },
    { labelKey: 'quickRatio', value: quickRatio, format: 'ratio', status: quickRatio >= 1 ? 'good' : 'warning', suffix: 'x' },
    { labelKey: 'debtToEquity', value: debtToEquity, format: 'ratio', status: debtToEquity <= 1 ? 'good' : debtToEquity <= 2 ? 'warning' : 'danger', suffix: 'x' },
  ] : [];

  const pieData = data ? [
    { name: 'Current Assets', value: data.assets.currentAssets.subtotal },
    { name: 'Non-Current Assets', value: data.assets.nonCurrentAssets.subtotal },
  ].filter(d => d.value > 0) : [];

  const columns = [
    { key: 'code', label: t('accountCode') },
    { key: 'name', label: t('accountName') },
    { key: 'amount', label: t('amount'), format: 'currency' as const },
  ];

  // Flatten all accounts for export
  const flattenedData = data ? [
    ...data.assets.currentAssets.accounts,
    ...data.assets.nonCurrentAssets.accounts,
    ...data.liabilities.currentLiabilities.accounts,
    ...data.liabilities.nonCurrentLiabilities.accounts,
    ...data.equity.section.accounts,
  ] : [];

  const handleExportPDF = useCallback(() => {
    if (!data) return;
    const entries = flattenedData as unknown as Record<string, unknown>[];
    exportToPDF(entries, columns, {
      filename: `balance-sheet-${asOfDate}`,
      title: 'Balance Sheet',
      titleTh: 'งบแสดงฐานะการเงิน',
      language,
      asOfDate,
    });
  }, [data, asOfDate, language, columns, flattenedData]);

  const handleExportExcel = useCallback(() => {
    if (!data) return;
    const entries = flattenedData as unknown as Record<string, unknown>[];
    exportToExcel(entries, columns, {
      filename: `balance-sheet-${asOfDate}`,
      title: 'Balance Sheet',
      language,
      asOfDate,
    });
  }, [data, asOfDate, language, columns, flattenedData]);

  const handleExportCSV = useCallback(() => {
    if (!data) return;
    const entries = flattenedData as unknown as Record<string, unknown>[];
    const csv = exportToCSV(entries, columns, { language, filename: '', title: '' });
    downloadCSV(csv, `balance-sheet-${asOfDate}.csv`);
  }, [data, asOfDate, language, columns, flattenedData]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="p-6" data-testid="balance-sheet-page">
      <ReportHeader
        titleKey="balanceSheet"
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Pie Chart */}
        {data && pieData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Asset Composition</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Assets Section */}
        {data && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{t('assets')}</CardTitle>
            </CardHeader>
            <CardContent>
              <SectionTable section={data.assets.currentAssets} title={t('currentAssets')} />
              <SectionTable section={data.assets.nonCurrentAssets} title={t('nonCurrentAssets')} />
              <div className="border-t-2 border-blue-500 pt-2 font-bold flex justify-between">
                <span>{t('totalAssets')}</span>
                <span>{formatCurrency(data.assets.totalAssets)}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Liabilities & Equity */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('liabilities')}</CardTitle>
            </CardHeader>
            <CardContent>
              <SectionTable section={data.liabilities.currentLiabilities} title={t('currentLiabilities')} />
              <SectionTable section={data.liabilities.nonCurrentLiabilities} title={t('nonCurrentLiabilities')} />
              <div className="border-t-2 border-red-500 pt-2 font-bold flex justify-between">
                <span>{t('totalLiabilities')}</span>
                <span>{formatCurrency(data.liabilities.totalLiabilities)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('equity')}</CardTitle>
            </CardHeader>
            <CardContent>
              <SectionTable section={data.equity.section} title={t('equity')} />
              <div className="border-t-2 border-emerald-500 pt-2 font-bold flex justify-between">
                <span>{t('totalEquity')}</span>
                <span>{formatCurrency(data.equity.totalEquity)}</span>
              </div>
              <div className="mt-4 p-3 bg-gray-100 rounded-lg">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total Liabilities + Equity</span>
                  <span>{formatCurrency(data.totalLiabilitiesAndEquity)}</span>
                </div>
                <div className={`text-sm mt-1 ${data.isBalanced ? 'text-emerald-600' : 'text-red-600'}`}>
                  {data.isBalanced ? '✓ Balanced' : '✗ Out of Balance'}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function BalanceSheetPage() {
  return (
    <ReportLanguageProvider>
      <BalanceSheetContent />
    </ReportLanguageProvider>
  );
}

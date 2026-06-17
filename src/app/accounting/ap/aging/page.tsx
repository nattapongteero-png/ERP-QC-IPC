'use client';

/**
 * AP Aging Report Page
 * Feature: 010-accounting-module-integration
 * Detailed accounts payable aging analysis by vendor
 */

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { DateBox } from 'devextreme-react/date-box';
import { Button } from 'devextreme-react/button';
import DataGrid, { Column, Summary, TotalItem } from 'devextreme-react/data-grid';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingFilterPanel,
} from '@/components/accounting';
import type { AgingReport } from '@/types/accounting';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function fetchAPAgingReport(asOfDate: string): Promise<AgingReport> {
  const res = await fetch(`/api/accounting/reports/aging?type=AP&asOfDate=${asOfDate}`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch AP aging report');
  }
  const data = await res.json();
  return data.data;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompactCurrency(amount: number): string {
  if (Math.abs(amount) >= 1000000) {
    return `฿${(amount / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1000) {
    return `฿${(amount / 1000).toFixed(0)}K`;
  }
  return formatCurrency(amount);
}

export default function APAgingReportPage() {
  const t = useTranslations('accounting');
  const [asOfDate, setAsOfDate] = useState<Date>(new Date());
  const [generateReport, setGenerateReport] = useState(false);

  const {
    data: reportData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['ap-aging-report', formatDate(asOfDate)],
    queryFn: () => fetchAPAgingReport(formatDate(asOfDate)),
    enabled: generateReport,
  });

  const handleGenerateReport = useCallback(() => {
    setGenerateReport(true);
    refetch();
  }, [refetch]);

  // Prepare chart data
  const chartData = reportData
    ? [
        { name: 'ยังไม่ครบกำหนด', amount: reportData.totals.current },
        { name: '1-30 วัน', amount: reportData.totals.days1to30 },
        { name: '31-60 วัน', amount: reportData.totals.days31to60 },
        { name: '61-90 วัน', amount: reportData.totals.days61to90 },
        { name: 'เกิน 90 วัน', amount: reportData.totals.over90 },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30" data-testid="ap-aging-page">
      <AccountingPageHeader
        title={t('reports.agingReport')}
        subtitle={t('accountsPayable.description')}
        icon="clock"
        onBack={() => window.location.href = '/accounting/ap'}
        breadcrumbs={[
          { label: 'เจ้าหนี้การค้า', href: '/accounting/ap' },
          { label: t('reports.agingReport') },
        ]}
      />

      <div className="p-6 space-y-6">
        {/* Filter Panel */}
        <AccountingFilterPanel>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ณ วันที่</label>
            <DateBox
              value={asOfDate}
              onValueChanged={(e) => setAsOfDate(e.value)}
              displayFormat="yyyy-MM-dd"
              data-testid="as-of-date"
              stylingMode="outlined"
            />
          </div>

          <div className="flex gap-2 items-end">
            <Button
              text="สร้างรายงาน"
              type="default"
              stylingMode="contained"
              onClick={handleGenerateReport}
              data-testid="generate-report-btn"
            />
          </div>
        </AccountingFilterPanel>

        {/* KPI Summary Cards */}
        {reportData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <AccountingKPICard
              label="ยอดค้างชำระทั้งหมด"
              value={formatCurrency(reportData.totals.total)}
              subtitle="ผู้ขายทั้งหมด"
              icon="wallet"
              variant="danger"
            />
            <AccountingKPICard
              label="ยังไม่ครบกำหนด"
              value={formatCurrency(reportData.totals.current)}
              subtitle="ยังไม่เกินกำหนด"
              icon="check-circle"
              variant="success"
            />
            <AccountingKPICard
              label="1-30 วัน"
              value={formatCurrency(reportData.totals.days1to30)}
              subtitle="เกินกำหนด"
              icon="clock"
              variant="info"
            />
            <AccountingKPICard
              label="31-60 วัน"
              value={formatCurrency(reportData.totals.days31to60)}
              subtitle="เกินกำหนด"
              icon="clock"
              variant="warning"
            />
            <AccountingKPICard
              label="61-90 วัน"
              value={formatCurrency(reportData.totals.days61to90)}
              subtitle="เกินกำหนด"
              icon="clock"
              variant="warning"
            />
            <AccountingKPICard
              label="เกิน 90 วัน"
              value={formatCurrency(reportData.totals.over90)}
              subtitle="เกินกำหนด"
              icon="clock"
              variant="danger"
            />
          </div>
        )}

        {/* Aging Bar Chart */}
        {reportData && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">การกระจายตามอายุหนี้</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => formatCompactCurrency(value)}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(value as number)}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Legend />
                  <Bar dataKey="amount" name="ยอดเจ้าหนี้" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Detailed Aging Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {isLoading ? (
            <div className="text-center py-12" data-testid="loading-spinner">
              <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="mt-4 text-gray-600">กำลังโหลดรายงาน...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12" data-testid="error-message">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-red-600 font-medium">
                ข้อผิดพลาด: {error instanceof Error ? error.message : 'ไม่สามารถโหลดรายงานได้'}
              </p>
            </div>
          ) : !reportData ? (
            <div className="text-center py-16" data-testid="no-report-message">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-500 text-lg font-medium mb-2">ยังไม่ได้สร้างรายงาน</p>
              <p className="text-gray-400 text-sm">เลือกวันที่ ณ วันที่ แล้วคลิกสร้างรายงานเพื่อดูข้อมูล</p>
            </div>
          ) : (
            <div data-testid="aging-report-grid">
              <div className="mb-4 pb-2 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">อายุหนี้เจ้าหนี้ตามผู้ขาย</h3>
                <p className="text-sm text-gray-500 mt-1">ณ วันที่ {reportData.asOfDate}</p>
              </div>
              <DataGrid
                dataSource={reportData.entries}
                showBorders
                columnAutoWidth
                keyExpr="entityId"
                className="report-grid"
              >
                <Column dataField="entityName" caption="ชื่อผู้ขาย" />
                <Column dataField="current" caption="ยังไม่ครบกำหนด" format="#,##0.00" width={120} />
                <Column dataField="days1to30" caption="1-30 วัน" format="#,##0.00" width={120} />
                <Column dataField="days31to60" caption="31-60 วัน" format="#,##0.00" width={120} />
                <Column dataField="days61to90" caption="61-90 วัน" format="#,##0.00" width={120} />
                <Column dataField="over90" caption="เกิน 90 วัน" format="#,##0.00" width={120} />
                <Column dataField="total" caption="รวม" format="#,##0.00" width={140} />
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
                รวมทั้งสิ้น: <span className="text-orange-700">{formatCurrency(reportData.totals.total)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

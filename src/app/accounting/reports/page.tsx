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

const reportTypes = [
  { value: 'trial-balance', text: 'งบทดลอง' },
  { value: 'balance-sheet', text: 'งบแสดงฐานะการเงิน' },
  { value: 'income-statement', text: 'งบกำไรขาดทุน' },
  { value: 'cash-flow', text: 'งบกระแสเงินสด' },
  { value: 'aging-ap', text: 'รายงานอายุหนี้เจ้าหนี้' },
  { value: 'aging-ar', text: 'รายงานอายุหนี้ลูกหนี้' },
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
  const t = useTranslations('accounting');
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
    notify('ส่งออกรายงานสำเร็จ', 'success', 2000);
  }, [reportData, selectedReport, asOfDate]);

  const renderReportContent = () => {
    if (isLoading) {
      return (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-gray-600">กำลังโหลดรายงาน...</p>
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
            ข้อผิดพลาด: {error instanceof Error ? error.message : 'ไม่สามารถโหลดรายงานได้'}
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
          <p className="text-gray-500 text-lg font-medium mb-2">ยังไม่มีรายงาน</p>
          <p className="text-gray-400 text-sm">เลือกประเภทรายงานแล้วคลิกสร้างรายงานเพื่อดูข้อมูล</p>
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
        <h3 className="text-xl font-bold text-gray-900">งบทดลอง</h3>
        <p className="text-sm text-gray-500 mt-1">ณ วันที่ {report.asOfDate}</p>
      </div>
      <DataGrid
        dataSource={report.entries}
        showBorders
        columnAutoWidth
        keyExpr="accountCode"
        className="report-grid"
      >
        <Column dataField="accountCode" caption="รหัสบัญชี" width={120} />
        <Column dataField="accountName" caption="ชื่อบัญชี" />
        <Column dataField="accountType" caption="ประเภท" width={100} />
        <Column dataField="periodDebit" caption="เดบิต" format="#,##0.00" width={120} />
        <Column dataField="periodCredit" caption="เครดิต" format="#,##0.00" width={120} />
        <Column dataField="closingDebit" caption="เดบิตปลายงวด" format="#,##0.00" width={120} />
        <Column dataField="closingCredit" caption="เครดิตปลายงวด" format="#,##0.00" width={120} />
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
          <h3 className="text-xl font-bold text-gray-900">งบแสดงฐานะการเงิน</h3>
          <p className="text-sm text-gray-500 mt-1">ณ วันที่ {report.asOfDate}</p>
        </div>
        <div className={`px-4 py-2 rounded-lg font-semibold ${report.isBalanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {report.isBalanced ? '✓ สมดุล' : '✗ ไม่สมดุล'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Assets */}
        <div className="border border-gray-200 rounded-xl p-6 bg-gradient-to-br from-blue-50/50 to-white">
          <h4 className="font-bold text-lg mb-4 text-blue-900">สินทรัพย์</h4>
          <div className="space-y-4">
            <div>
              <h5 className="font-semibold">สินทรัพย์หมุนเวียน</h5>
              <DataGrid
                dataSource={report.assets.currentAssets.accounts}
                showBorders
                keyExpr="code"
              >
                <Column dataField="code" caption="รหัส" width={80} />
                <Column dataField="name" caption="บัญชี" />
                <Column dataField="amount" caption="จำนวนเงิน" format="#,##0.00" width={120} />
              </DataGrid>
              <div className="text-right font-semibold mt-2">
                รวมย่อย: {report.assets.currentAssets.subtotal.toLocaleString()}
              </div>
            </div>
            <div>
              <h5 className="font-semibold">สินทรัพย์ไม่หมุนเวียน</h5>
              <DataGrid
                dataSource={report.assets.nonCurrentAssets.accounts}
                showBorders
                keyExpr="code"
              >
                <Column dataField="code" caption="รหัส" width={80} />
                <Column dataField="name" caption="บัญชี" />
                <Column dataField="amount" caption="จำนวนเงิน" format="#,##0.00" width={120} />
              </DataGrid>
              <div className="text-right font-semibold mt-2">
                รวมย่อย: {report.assets.nonCurrentAssets.subtotal.toLocaleString()}
              </div>
            </div>
            <div className="text-right font-bold text-lg border-t pt-2">
              รวมสินทรัพย์: {report.assets.totalAssets.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Liabilities & Equity */}
        <div className="border border-gray-200 rounded-xl p-6 bg-gradient-to-br from-green-50/50 to-white">
          <h4 className="font-bold text-lg mb-4 text-green-900">หนี้สินและส่วนของเจ้าของ</h4>
          <div className="space-y-4">
            <div>
              <h5 className="font-semibold">หนี้สินหมุนเวียน</h5>
              <DataGrid
                dataSource={report.liabilities.currentLiabilities.accounts}
                showBorders
                keyExpr="code"
              >
                <Column dataField="code" caption="รหัส" width={80} />
                <Column dataField="name" caption="บัญชี" />
                <Column dataField="amount" caption="จำนวนเงิน" format="#,##0.00" width={120} />
              </DataGrid>
              <div className="text-right font-semibold mt-2">
                รวมย่อย: {report.liabilities.currentLiabilities.subtotal.toLocaleString()}
              </div>
            </div>
            <div>
              <h5 className="font-semibold">ส่วนของเจ้าของ</h5>
              <DataGrid
                dataSource={report.equity.section.accounts}
                showBorders
                keyExpr="code"
              >
                <Column dataField="code" caption="รหัส" width={80} />
                <Column dataField="name" caption="บัญชี" />
                <Column dataField="amount" caption="จำนวนเงิน" format="#,##0.00" width={120} />
              </DataGrid>
              <div className="text-right font-semibold mt-2">
                รวมย่อย: {report.equity.totalEquity.toLocaleString()}
              </div>
            </div>
            <div className="text-right font-bold text-lg border-t pt-2">
              รวม: {report.totalLiabilitiesAndEquity.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderIncomeStatement = (report: IncomeStatementReport) => (
    <div data-testid="income-statement-report">
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-900">งบกำไรขาดทุน</h3>
        <p className="text-sm text-gray-500 mt-1">{report.periodStart} ถึง {report.periodEnd}</p>
      </div>

      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Revenue */}
        <div>
          <h5 className="font-semibold border-b pb-2">รายได้</h5>
          <DataGrid dataSource={report.revenue.accounts} showBorders keyExpr="code">
            <Column dataField="code" caption="รหัส" width={80} />
            <Column dataField="name" caption="บัญชี" />
            <Column dataField="amount" caption="จำนวนเงิน" format="#,##0.00" width={120} />
          </DataGrid>
          <div className="text-right font-semibold">รวมรายได้: {report.revenue.subtotal.toLocaleString()}</div>
        </div>

        {/* COGS */}
        <div>
          <h5 className="font-semibold border-b pb-2">ต้นทุนขาย</h5>
          <DataGrid dataSource={report.costOfGoodsSold.accounts} showBorders keyExpr="code">
            <Column dataField="code" caption="รหัส" width={80} />
            <Column dataField="name" caption="บัญชี" />
            <Column dataField="amount" caption="จำนวนเงิน" format="#,##0.00" width={120} />
          </DataGrid>
          <div className="text-right font-semibold">รวมต้นทุนขาย: {report.costOfGoodsSold.subtotal.toLocaleString()}</div>
        </div>

        <div className="text-right font-bold text-lg bg-blue-50 border border-blue-200 p-3 rounded-lg">
          กำไรขั้นต้น: {report.grossProfit.toLocaleString()}
        </div>

        {/* Operating Expenses */}
        <div>
          <h5 className="font-semibold border-b pb-2">ค่าใช้จ่ายในการดำเนินงาน</h5>
          <DataGrid dataSource={report.operatingExpenses.accounts} showBorders keyExpr="code">
            <Column dataField="code" caption="รหัส" width={80} />
            <Column dataField="name" caption="บัญชี" />
            <Column dataField="amount" caption="จำนวนเงิน" format="#,##0.00" width={120} />
          </DataGrid>
          <div className="text-right font-semibold">
            รวมค่าใช้จ่ายในการดำเนินงาน: {report.operatingExpenses.subtotal.toLocaleString()}
          </div>
        </div>

        <div className="text-right font-bold text-lg bg-blue-50 border border-blue-200 p-3 rounded-lg">
          กำไรจากการดำเนินงาน: {report.operatingIncome.toLocaleString()}
        </div>

        <div className="text-right font-bold text-xl bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 p-4 rounded-xl shadow-sm">
          กำไรสุทธิ: <span className="text-green-700">{report.netIncome.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );

  const renderAgingReport = (report: AgingReport) => (
    <div data-testid="aging-report">
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-900">
          รายงานอายุหนี้{report.reportType === 'AP' ? 'เจ้าหนี้การค้า' : 'ลูกหนี้การค้า'}
        </h3>
        <p className="text-sm text-gray-500 mt-1">ณ วันที่ {report.asOfDate}</p>
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
              <div className="text-xs text-gray-500 mt-1">{bucket.count} ใบแจ้งหนี้</div>
            </div>
          );
        })}
      </div>

      {/* Detail Grid */}
      <DataGrid dataSource={report.entries} showBorders columnAutoWidth keyExpr="entityId">
        <Column dataField="entityName" caption={report.reportType === 'AP' ? 'ผู้ขาย' : 'ลูกค้า'} />
        <Column dataField="current" caption="ยังไม่ครบกำหนด" format="#,##0.00" width={100} />
        <Column dataField="days1to30" caption="1-30 วัน" format="#,##0.00" width={100} />
        <Column dataField="days31to60" caption="31-60 วัน" format="#,##0.00" width={100} />
        <Column dataField="days61to90" caption="61-90 วัน" format="#,##0.00" width={100} />
        <Column dataField="over90" caption="เกิน 90 วัน" format="#,##0.00" width={100} />
        <Column dataField="total" caption="รวม" format="#,##0.00" width={120} />
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
        ยอดรวมทั้งสิ้น: <span className="text-blue-700">{report.totals.total.toLocaleString()}</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30" data-testid="reports-dashboard">
      <AccountingPageHeader
        title={t('page.title')}
        subtitle="สร้างงบการเงินตามมาตรฐาน TFRS"
        icon="bar-chart"
      />

      <div className="p-6 space-y-6">
        {/* Dedicated Report Pages - Featured Reports */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">งบการเงิน (สองภาษา)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/accounting/reports/trial-balance" className="group" data-testid="link-trial-balance">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
                <div className="flex items-center justify-between mb-3">
                  <FileText className="w-8 h-8 text-blue-600" />
                  <ChevronRight className="w-5 h-5 text-blue-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <h3 className="font-semibold text-gray-900">งบทดลอง</h3>
                <p className="text-sm text-gray-500 mt-1">Trial Balance</p>
                <p className="text-xs text-blue-600 mt-2">กราฟ • ตัวชี้วัด • ส่งออก</p>
              </div>
            </Link>

            <Link href="/accounting/reports/balance-sheet" className="group" data-testid="link-balance-sheet">
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-5 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
                <div className="flex items-center justify-between mb-3">
                  <TrendingUp className="w-8 h-8 text-emerald-600" />
                  <ChevronRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <h3 className="font-semibold text-gray-900">งบแสดงฐานะการเงิน</h3>
                <p className="text-sm text-gray-500 mt-1">Balance Sheet</p>
                <p className="text-xs text-emerald-600 mt-2">อัตราส่วนทางการเงิน • กราฟวงกลม</p>
              </div>
            </Link>

            <Link href="/accounting/reports/income-statement" className="group" data-testid="link-income-statement">
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-5 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
                <div className="flex items-center justify-between mb-3">
                  <DollarSign className="w-8 h-8 text-amber-600" />
                  <ChevronRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <h3 className="font-semibold text-gray-900">งบกำไรขาดทุน</h3>
                <p className="text-sm text-gray-500 mt-1">Income Statement</p>
                <p className="text-xs text-amber-600 mt-2">อัตรากำไร • กราฟพื้นที่</p>
              </div>
            </Link>

            <Link href="/accounting/reports/cash-flow" className="group" data-testid="link-cash-flow">
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-5 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
                <div className="flex items-center justify-between mb-3">
                  <BarChart3 className="w-8 h-8 text-purple-600" />
                  <ChevronRight className="w-5 h-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <h3 className="font-semibold text-gray-900">งบกระแสเงินสด</h3>
                <p className="text-sm text-gray-500 mt-1">Cash Flow</p>
                <p className="text-xs text-purple-600 mt-2">กราฟน้ำตก • การกระทบยอด</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Legacy Report Quick Access Cards */}
        <div className="border-t border-gray-200 pt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">สร้างรายงานด่วน</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <AccountingKPICard
              label="งบทดลอง"
              value="ดูรายงาน"
              subtitle="สรุปยอดคงเหลือบัญชี"
              icon="file-text"
              variant="info"
              onClick={() => {
                setSelectedReport('trial-balance');
                handleGenerateReport();
              }}
            />
            <AccountingKPICard
              label="งบแสดงฐานะการเงิน"
              value="ดูรายงาน"
              subtitle="สินทรัพย์และหนี้สิน"
              icon="trending-up"
              variant="success"
              onClick={() => {
                setSelectedReport('balance-sheet');
                handleGenerateReport();
              }}
            />
            <AccountingKPICard
              label="งบกำไรขาดทุน"
              value="ดูรายงาน"
              subtitle="งบกำไรขาดทุน"
              icon="trending-up"
              variant="warning"
              onClick={() => {
                setSelectedReport('income-statement');
                handleGenerateReport();
              }}
            />
            <AccountingKPICard
              label="รายงานอายุหนี้"
              value="ดูรายงาน"
              subtitle="วิเคราะห์อายุหนี้เจ้าหนี้/ลูกหนี้"
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ประเภทรายงาน</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">วันเริ่มต้นงวด</label>
                <DateBox
                  value={periodStart}
                  onValueChanged={(e) => setPeriodStart(e.value)}
                  displayFormat="yyyy-MM-dd"
                  data-testid="period-start-date"
                  stylingMode="outlined"
                />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">วันสิ้นสุดงวด</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ณ วันที่</label>
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
              text="สร้างรายงาน"
              type="default"
              stylingMode="contained"
              onClick={handleGenerateReport}
              data-testid="generate-report-btn"
            />
            {reportData && (
              <Button
                text="ส่งออก JSON"
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

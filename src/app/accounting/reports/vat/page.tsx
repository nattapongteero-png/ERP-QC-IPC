'use client';

// VAT Report Page (Por Por 30)
// Feature: 010-accounting-module-integration
// User Story 6: Manage VAT and Withholding Tax

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { DateBox } from 'devextreme-react/date-box';
import { Button as DxButton } from 'devextreme-react/button';
import DataGrid, { Column, Summary, TotalItem } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingFilterPanel,
} from '@/components/accounting';
import { Receipt, TrendingUp, TrendingDown, Calculator, Download, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { VATReport } from '@/types/accounting';

function formatTaxPeriod(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
  }).format(value);
}

async function fetchVATReport(taxPeriod: string): Promise<VATReport> {
  const res = await fetch(`/api/accounting/reports/vat-report?taxPeriod=${taxPeriod}`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch VAT report');
  }
  const data = await res.json();
  return data.data;
}

export default function VATReportPage() {
  const t = useTranslations('accounting');
  const [taxPeriod, setTaxPeriod] = useState<Date>(new Date());
  const [reportGenerated, setReportGenerated] = useState(false);

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ['vat-report', formatTaxPeriod(taxPeriod)],
    queryFn: () => fetchVATReport(formatTaxPeriod(taxPeriod)),
    enabled: reportGenerated,
  });

  const handleGenerateReport = useCallback(() => {
    setReportGenerated(true);
    refetch();
  }, [refetch]);

  const handleExportJSON = useCallback(() => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vat-report-${formatTaxPeriod(taxPeriod)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('ส่งออกรายงานภาษีมูลค่าเพิ่มสำเร็จ', 'success', 3000);
  }, [report, taxPeriod]);

  return (
    <div className="flex flex-col gap-6 pb-8" data-testid="vat-report-page" data-title={t('page.title')}>
      {/* Professional Page Header */}
      <AccountingPageHeader
        title="รายงานภาษีมูลค่าเพิ่ม"
        subtitle="รายงานภาษีมูลค่าเพิ่ม (ภ.พ.30) - สรุปภาษีซื้อและภาษีขายสำหรับยื่นแบบ"
        icon="receipt"
      />

      {/* VAT Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <AccountingKPICard
          label="งวดภาษี"
          subtitle="งวดภาษี"
          value={formatTaxPeriod(taxPeriod)}
          icon="calendar"
          variant="info"
        />
        <AccountingKPICard
          label="ภาษีขาออก"
          subtitle="ภาษีขาย (Output VAT)"
          value={report ? formatCurrency(report.outputVAT.totalVATAmount) : '-'}
          icon="trending-up"
          variant="success"
          trend={report && report.outputVAT.totalVATAmount > 0 ? 'up' : 'neutral'}
        />
        <AccountingKPICard
          label="ภาษีขาเข้า"
          subtitle="ภาษีซื้อ (Input VAT)"
          value={report ? formatCurrency(report.inputVAT.totalVATAmount) : '-'}
          icon="arrow-down"
          variant="danger"
          trend={report && report.inputVAT.totalVATAmount > 0 ? 'down' : 'neutral'}
        />
        <AccountingKPICard
          label="ภาษีสุทธิ"
          subtitle={report && report.netVAT >= 0 ? 'ภาษีสุทธิที่ต้องชำระ' : 'ภาษีสุทธิที่ขอคืน'}
          value={report ? formatCurrency(Math.abs(report.netVAT)) : '-'}
          icon="calculator"
          variant={report && report.netVAT >= 0 ? 'warning' : 'success'}
          trend={report && report.netVAT >= 0 ? 'up' : report && report.netVAT < 0 ? 'down' : 'neutral'}
        />
      </div>

      {/* Report Controls with Glassmorphism */}
      <AccountingFilterPanel>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            เลือกงวดภาษี
          </label>
          <DateBox
            value={taxPeriod}
            onValueChanged={(e) => setTaxPeriod(e.value)}
            type="date"
            displayFormat="MMMM yyyy"
            calendarOptions={{ maxZoomLevel: 'year', minZoomLevel: 'decade' }}
            width={200}
          />
        </div>
        <div className="flex gap-2">
          <DxButton
            text="สร้างรายงาน"
            type="default"
            stylingMode="contained"
            onClick={handleGenerateReport}
            disabled={isLoading}
            icon="check"
          />
          {report && (
            <Button
              variant="outline"
              onClick={handleExportJSON}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              ส่งออก JSON
            </Button>
          )}
        </div>
      </AccountingFilterPanel>

      {/* Report Content */}
      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-green-500"></div>
            <p className="text-gray-600 font-medium">กำลังสร้างรายงานภาษีมูลค่าเพิ่ม...</p>
          </div>
        </div>
      )}

      {!reportGenerated && !isLoading && (
        <div className="bg-gradient-to-br from-white to-green-50/30 rounded-xl border border-green-100 shadow-sm p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="p-4 bg-green-100 rounded-full w-fit mx-auto mb-4">
              <Receipt className="h-12 w-12 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">เลือกงวดภาษีเพื่อสร้างรายงาน</h3>
            <p className="text-gray-500">
              เลือกงวดภาษีจากด้านบนแล้วคลิก &quot;สร้างรายงาน&quot; เพื่อดูรายละเอียดภาษีมูลค่าเพิ่มขาเข้าและขาออก
            </p>
          </div>
        </div>
      )}

      {report && (
        <div className="space-y-6" data-testid="vat-report-content">
          {/* Output VAT Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-green-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      ภาษีขาออก (ภาษีจากการขาย)
                    </h3>
                    <p className="text-sm text-gray-600">
                      ภาษีขาย - {formatTaxPeriod(taxPeriod)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">ยอดรวม</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(report.outputVAT.totalVATAmount)}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <DataGrid
                dataSource={report.outputVAT.entries}
                showBorders
                columnAutoWidth
                allowColumnResizing
                rowAlternationEnabled
                hoverStateEnabled
              >
                <Column dataField="taxInvoiceNumber" caption="เลขที่ใบกำกับภาษี" />
                <Column dataField="taxInvoiceDate" caption="วันที่" dataType="date" />
                <Column dataField="partyName" caption="ชื่อลูกค้า" />
                <Column dataField="partyTaxId" caption="เลขประจำตัวผู้เสียภาษี" />
                <Column dataField="branchCode" caption="สาขา" width={80} />
                <Column
                  dataField="taxableAmount"
                  caption="มูลค่าสินค้า/บริการ"
                  dataType="number"
                  format="#,##0.00"
                />
                <Column
                  dataField="vatAmount"
                  caption="ภาษีมูลค่าเพิ่ม 7%"
                  dataType="number"
                  format="#,##0.00"
                />
                <Column
                  dataField="totalAmount"
                  caption="จำนวนเงินรวม"
                  dataType="number"
                  format="#,##0.00"
                />
                <Summary>
                  <TotalItem column="taxableAmount" summaryType="sum" valueFormat="#,##0.00" />
                  <TotalItem column="vatAmount" summaryType="sum" valueFormat="#,##0.00" />
                  <TotalItem column="totalAmount" summaryType="sum" valueFormat="#,##0.00" />
                </Summary>
              </DataGrid>
            </div>
          </div>

          {/* Input VAT Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-red-50 to-rose-50 px-6 py-4 border-b border-red-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500 rounded-lg">
                    <TrendingDown className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      ภาษีขาเข้า (ภาษีจากการซื้อ)
                    </h3>
                    <p className="text-sm text-gray-600">
                      ภาษีซื้อ - {formatTaxPeriod(taxPeriod)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">ยอดรวม</p>
                  <p className="text-xl font-bold text-red-600">
                    {formatCurrency(report.inputVAT.totalVATAmount)}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <DataGrid
                dataSource={report.inputVAT.entries}
                showBorders
                columnAutoWidth
                allowColumnResizing
                rowAlternationEnabled
                hoverStateEnabled
              >
                <Column dataField="taxInvoiceNumber" caption="เลขที่ใบกำกับภาษี" />
                <Column dataField="taxInvoiceDate" caption="วันที่" dataType="date" />
                <Column dataField="partyName" caption="ชื่อผู้ขาย" />
                <Column dataField="partyTaxId" caption="เลขประจำตัวผู้เสียภาษี" />
                <Column dataField="branchCode" caption="สาขา" width={80} />
                <Column
                  dataField="taxableAmount"
                  caption="มูลค่าสินค้า/บริการ"
                  dataType="number"
                  format="#,##0.00"
                />
                <Column
                  dataField="vatAmount"
                  caption="ภาษีมูลค่าเพิ่ม 7%"
                  dataType="number"
                  format="#,##0.00"
                />
                <Column
                  dataField="totalAmount"
                  caption="จำนวนเงินรวม"
                  dataType="number"
                  format="#,##0.00"
                />
                <Summary>
                  <TotalItem column="taxableAmount" summaryType="sum" valueFormat="#,##0.00" />
                  <TotalItem column="vatAmount" summaryType="sum" valueFormat="#,##0.00" />
                  <TotalItem column="totalAmount" summaryType="sum" valueFormat="#,##0.00" />
                </Summary>
              </DataGrid>
            </div>
          </div>

          {/* Enhanced VAT Summary Panel */}
          <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-xl border border-blue-200 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                  <Calculator className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">สรุปภาษีมูลค่าเพิ่ม</h3>
                  <p className="text-sm text-blue-100">สรุปภาษีมูลค่าเพิ่ม - {formatTaxPeriod(taxPeriod)}</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    <span className="text-gray-700 font-medium">ภาษีขาย (Output VAT):</span>
                  </div>
                  <span className="text-xl font-bold text-green-600">
                    {formatCurrency(report.outputVAT.totalVATAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    </div>
                    <span className="text-gray-700 font-medium">หัก: ภาษีซื้อ (Input VAT):</span>
                  </div>
                  <span className="text-xl font-bold text-red-600">
                    ({formatCurrency(report.inputVAT.totalVATAmount)})
                  </span>
                </div>
                <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                <div className="flex items-center justify-between p-6 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border-2 border-orange-200">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-orange-500 rounded-xl shadow-lg">
                      <Calculator className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-medium">
                        ภาษีมูลค่าเพิ่มสุทธิ
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {report.netVAT >= 0 ? 'ต้องชำระ' : 'ขอคืน'}
                      </p>
                    </div>
                  </div>
                  <span className={`text-3xl font-bold ${report.netVAT >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {formatCurrency(Math.abs(report.netVAT))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

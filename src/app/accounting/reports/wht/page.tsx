'use client';

// WHT Certificates Report Page
// Feature: 010-accounting-module-integration
// User Story 6: Manage VAT and Withholding Tax

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DateBox } from 'devextreme-react/date-box';
import { Button as DxButton } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import DataGrid, { Column, Export, Summary, TotalItem } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingFilterPanel,
} from '@/components/accounting';
import { Download, Calendar, FileText, Receipt, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WHTCertificateDialog } from '@/components/accounting/wht-certificate-dialog';
import type { WHTCertificateSummary, WHTCertificateEntry, WHTCertificateType } from '@/types/accounting';

const certificateTypeOptions = [
  { value: 'pnd3', text: 'PND 3 (Individuals)' },
  { value: 'pnd53', text: 'PND 53 (Companies)' },
];

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

async function fetchWHTCertificates(
  taxPeriod: string,
  certificateType: WHTCertificateType
): Promise<WHTCertificateSummary> {
  const res = await fetch(
    `/api/accounting/reports/wht-certificates?taxPeriod=${taxPeriod}&certificateType=${certificateType}&format=summary`
  );
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch WHT certificates');
  }
  const data = await res.json();
  return data.data;
}

export default function WHTReportPage() {
  const [taxPeriod, setTaxPeriod] = useState<Date>(new Date());
  const [certificateType, setCertificateType] = useState<WHTCertificateType>('pnd53');
  const [reportGenerated, setReportGenerated] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<WHTCertificateEntry | null>(null);
  const [dialogVisible, setDialogVisible] = useState(false);

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ['wht-certificates', formatTaxPeriod(taxPeriod), certificateType],
    queryFn: () => fetchWHTCertificates(formatTaxPeriod(taxPeriod), certificateType),
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
    a.download = `wht-${certificateType}-${formatTaxPeriod(taxPeriod)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('WHT certificates exported successfully', 'success', 3000);
  }, [report, taxPeriod, certificateType]);

  const handleViewCertificate = useCallback((e: { data: WHTCertificateEntry }) => {
    setSelectedCertificate(e.data);
    setDialogVisible(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogVisible(false);
    setSelectedCertificate(null);
  }, []);

  return (
    <div className="flex flex-col gap-6 pb-8" data-testid="wht-report-page">
      {/* Professional Page Header */}
      <AccountingPageHeader
        title="หนังสือรับรองภาษีหัก ณ ที่จ่าย"
        subtitle="WHT Certificates Report - Withholding tax certificates for tax filing"
        icon="file-text"
      />

      {/* WHT Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <AccountingKPICard
          label="งวดภาษี"
          subtitle="Tax Period"
          value={formatTaxPeriod(taxPeriod)}
          icon="clock"
          variant="info"
        />
        <AccountingKPICard
          label="ประเภทแบบ"
          subtitle="Certificate Type"
          value={certificateType === 'pnd3' ? 'PND 3' : 'PND 53'}
          icon="file-text"
          variant="default"
        />
        <AccountingKPICard
          label="จำนวนหนังสือ"
          subtitle="Certificates Count"
          value={report ? report.certificateCount.toString() : '-'}
          icon="package"
          variant="success"
          trend={report && report.certificateCount > 0 ? 'up' : 'neutral'}
        />
        <AccountingKPICard
          label="ภาษีหัก ณ ที่จ่าย"
          subtitle="Total WHT Amount"
          value={report ? formatCurrency(report.totalWHTAmount) : '-'}
          icon="wallet"
          variant="warning"
          trend={report && report.totalWHTAmount > 0 ? 'up' : 'neutral'}
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
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            ประเภทแบบ
          </label>
          <SelectBox
            items={certificateTypeOptions}
            value={certificateType}
            onValueChanged={(e) => setCertificateType(e.value)}
            valueExpr="value"
            displayExpr="text"
            width={220}
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
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-500"></div>
            <p className="text-gray-600 font-medium">กำลังสร้างรายงานหนังสือรับรอง...</p>
          </div>
        </div>
      )}

      {!reportGenerated && !isLoading && (
        <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-xl border border-blue-100 shadow-sm p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="p-4 bg-blue-100 rounded-full w-fit mx-auto mb-4">
              <FileText className="h-12 w-12 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">เลือกงวดภาษีและประเภทแบบ</h3>
            <p className="text-gray-500">
              เลือกงวดภาษีและประเภทแบบ (PND 3 / PND 53) จากด้านบนแล้วคลิก &quot;สร้างรายงาน&quot; เพื่อดูรายการหนังสือรับรองภาษีหัก ณ ที่จ่าย
            </p>
          </div>
        </div>
      )}

      {report && (
        <div className="space-y-6" data-testid="wht-report-content">
          {/* Certificates Grid */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      หนังสือรับรองภาษีหัก ณ ที่จ่าย - {certificateType === 'pnd3' ? 'PND 3' : 'PND 53'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      WHT Certificates - {formatTaxPeriod(taxPeriod)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">จำนวนหนังสือ</p>
                  <p className="text-xl font-bold text-blue-600">
                    {report.certificateCount} ฉบับ
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <DataGrid
                dataSource={report.entries}
                showBorders
                columnAutoWidth
                allowColumnResizing
                rowAlternationEnabled
                onRowClick={handleViewCertificate}
                hoverStateEnabled
              >
                <Column dataField="certificateNumber" caption="เลขที่หนังสือรับรอง" width={150} />
                <Column dataField="paymentDate" caption="วันที่จ่าย" dataType="date" width={120} />
                <Column dataField="vendorName" caption="ชื่อผู้รับเงิน" />
                <Column dataField="vendorTaxId" caption="เลขประจำตัวผู้เสียภาษี" width={150} />
                <Column dataField="whtType" caption="ประเภทเงินได้" width={100} />
                <Column dataField="whtDescription" caption="รายละเอียด" />
                <Column
                  dataField="paymentAmount"
                  caption="จำนวนเงิน"
                  dataType="number"
                  format="#,##0.00"
                  width={120}
                />
                <Column
                  dataField="whtRate"
                  caption="อัตราภาษี (%)"
                  dataType="number"
                  format="#0.00"
                  width={100}
                />
                <Column
                  dataField="whtAmount"
                  caption="ภาษีหัก ณ ที่จ่าย"
                  dataType="number"
                  format="#,##0.00"
                  width={130}
                />
                <Column
                  dataField="netAmount"
                  caption="จำนวนเงินสุทธิ"
                  dataType="number"
                  format="#,##0.00"
                  width={130}
                />
                <Export enabled allowExportSelectedData />
                <Summary>
                  <TotalItem column="paymentAmount" summaryType="sum" valueFormat="#,##0.00" />
                  <TotalItem column="whtAmount" summaryType="sum" valueFormat="#,##0.00" />
                  <TotalItem column="netAmount" summaryType="sum" valueFormat="#,##0.00" />
                </Summary>
              </DataGrid>
            </div>
          </div>

          {/* Enhanced WHT Summary Panel */}
          <div className="bg-gradient-to-br from-white to-orange-50/30 rounded-xl border border-orange-200 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-amber-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">สรุปภาษีหัก ณ ที่จ่าย</h3>
                  <p className="text-sm text-orange-100">
                    WHT Summary - {certificateType === 'pnd3' ? 'PND 3 (บุคคลธรรมดา)' : 'PND 53 (นิติบุคคล)'} - {formatTaxPeriod(taxPeriod)}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <p className="text-sm text-blue-700 font-medium">จำนวนหนังสือรับรอง</p>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">{report.certificateCount}</p>
                  <p className="text-xs text-blue-600 mt-1">ฉบับ</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Receipt className="h-5 w-5 text-green-600" />
                    <p className="text-sm text-green-700 font-medium">จำนวนเงินจ่าย</p>
                  </div>
                  <p className="text-xl font-bold text-green-900">{formatCurrency(report.totalPaymentAmount)}</p>
                  <p className="text-xs text-green-600 mt-1">Payment Amount</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-orange-600" />
                    <p className="text-sm text-orange-700 font-medium">ภาษีหัก ณ ที่จ่าย</p>
                  </div>
                  <p className="text-xl font-bold text-orange-900">{formatCurrency(report.totalWHTAmount)}</p>
                  <p className="text-xs text-orange-600 mt-1">WHT Withheld</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Receipt className="h-5 w-5 text-purple-600" />
                    <p className="text-sm text-purple-700 font-medium">จำนวนเงินสุทธิ</p>
                  </div>
                  <p className="text-xl font-bold text-purple-900">{formatCurrency(report.totalNetAmount)}</p>
                  <p className="text-xs text-purple-600 mt-1">Net Amount Paid</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WHT Certificate Dialog */}
      <WHTCertificateDialog
        visible={dialogVisible}
        certificate={selectedCertificate}
        onClose={handleCloseDialog}
      />
    </div>
  );
}

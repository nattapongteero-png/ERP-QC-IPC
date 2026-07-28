'use client';

// WHT Certificates Report Page
// Feature: 010-accounting-module-integration
// User Story 6: Manage VAT and Withholding Tax

import { useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { DateBox } from 'devextreme-react/date-box';
import { Button as DxButton } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import DataGrid, { Column, Summary, TotalItem } from 'devextreme-react/data-grid';
import type { DataGridRef } from 'devextreme-react/data-grid';
import { exportGridToExcel } from '@/lib/utils/export-grid-excel';
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
  const t = useTranslations('accounting');
  const certificateTypeOptions = [
    { value: 'pnd3', text: t('reports.wht.certificateType.pnd3') },
    { value: 'pnd53', text: t('reports.wht.certificateType.pnd53') },
  ];
  const [taxPeriod, setTaxPeriod] = useState<Date>(new Date());
  const [certificateType, setCertificateType] = useState<WHTCertificateType>('pnd53');
  const [reportGenerated, setReportGenerated] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<WHTCertificateEntry | null>(null);
  const [dialogVisible, setDialogVisible] = useState(false);
  const gridRef = useRef<DataGridRef>(null);

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ['wht-certificates', formatTaxPeriod(taxPeriod), certificateType],
    queryFn: () => fetchWHTCertificates(formatTaxPeriod(taxPeriod), certificateType),
    enabled: reportGenerated,
  });

  const handleGenerateReport = useCallback(() => {
    setReportGenerated(true);
    refetch();
  }, [refetch]);

  /**
   * Export the WHT certificate list to Excel.
   *
   * This used to dump raw JSON.stringify(report) to a .json file. Nobody files
   * a Thai tax return with a JSON file — the Revenue Department and every
   * accountant work in Excel — so the button produced something no one could
   * use. Now it writes a real .xlsx via the shared grid exporter, the same one
   * the AR/AP invoice lists use.
   */
  const handleExportExcel = useCallback(() => {
    if (!report) return;
    exportGridToExcel(
      gridRef.current,
      `wht-${certificateType}-${formatTaxPeriod(taxPeriod)}`,
      t('reports.wht.title'),
    );
  }, [report, taxPeriod, certificateType, t]);

  const handleViewCertificate = useCallback((e: { data: WHTCertificateEntry }) => {
    setSelectedCertificate(e.data);
    setDialogVisible(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogVisible(false);
    setSelectedCertificate(null);
  }, []);

  return (
    <div className="flex flex-col gap-6 pb-8" data-testid="wht-report-page" data-title={t('page.title')}>
      {/* Professional Page Header */}
      <AccountingPageHeader
        title={t('reports.wht.title')}
        subtitle={t('reports.wht.subtitle')}
        icon="file-text"
      />

      {/* WHT Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <AccountingKPICard
          label={t('reports.wht.kpi.taxPeriod')}
          subtitle={t('reports.wht.kpi.taxPeriod')}
          value={formatTaxPeriod(taxPeriod)}
          icon="clock"
          variant="info"
        />
        <AccountingKPICard
          label={t('reports.wht.kpi.formType')}
          subtitle={t('reports.wht.kpi.formTypeSubtitle')}
          value={certificateType === 'pnd3' ? t('reports.wht.certificateType.pnd3Short') : t('reports.wht.certificateType.pnd53Short')}
          icon="file-text"
          variant="default"
        />
        <AccountingKPICard
          label={t('reports.wht.kpi.certificateCount')}
          subtitle={t('reports.wht.kpi.certificateCountSubtitle')}
          value={report ? report.certificateCount.toString() : '-'}
          icon="package"
          variant="success"
          trend={report && report.certificateCount > 0 ? 'up' : 'neutral'}
        />
        <AccountingKPICard
          label={t('reports.wht.kpi.whtAmount')}
          subtitle={t('reports.wht.kpi.whtAmountSubtitle')}
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
            {t('reports.wht.selectPeriodLabel')}
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
            {t('reports.wht.certificateTypeLabel')}
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
            text={t('reports.actions.generate')}
            type="default"
            stylingMode="contained"
            onClick={handleGenerateReport}
            disabled={isLoading}
            icon="check"
          />
          {report && (
            <Button
              variant="outline"
              onClick={handleExportExcel}
              className="gap-2"
              data-testid="wht-export-excel-btn"
            >
              <Download className="h-4 w-4" />
              ส่งออก Excel
            </Button>
          )}
        </div>
      </AccountingFilterPanel>

      {/* Report Content */}
      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-500"></div>
            <p className="text-gray-600 font-medium">{t('reports.wht.generating')}</p>
          </div>
        </div>
      )}

      {!reportGenerated && !isLoading && (
        <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-xl border border-blue-100 shadow-sm p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="p-4 bg-blue-100 rounded-full w-fit mx-auto mb-4">
              <FileText className="h-12 w-12 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('reports.wht.empty.title')}</h3>
            <p className="text-gray-500">
              {t('reports.wht.empty.description')}
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
                      {t('reports.wht.sectionTitle')} - {certificateType === 'pnd3' ? t('reports.wht.certificateType.pnd3Short') : t('reports.wht.certificateType.pnd53Short')}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {t('reports.wht.sectionSubtitle')} - {formatTaxPeriod(taxPeriod)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{t('reports.wht.certificatesCountLabel')}</p>
                  <p className="text-xl font-bold text-blue-600">
                    {t('reports.wht.certificatesUnit', { count: report.certificateCount })}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <DataGrid
                ref={gridRef}
                dataSource={report.entries}
                showBorders
                columnAutoWidth
                allowColumnResizing
                rowAlternationEnabled
                onRowClick={handleViewCertificate}
                hoverStateEnabled
              >
                <Column dataField="certificateNumber" caption={t('reports.wht.columns.certificateNumber')} width={150} />
                <Column dataField="paymentDate" caption={t('reports.wht.columns.paymentDate')} dataType="date" width={120} />
                <Column dataField="vendorName" caption={t('reports.wht.columns.vendorName')} />
                <Column dataField="vendorTaxId" caption={t('reports.wht.columns.vendorTaxId')} width={150} />
                <Column dataField="whtType" caption={t('reports.wht.columns.incomeType')} width={100} />
                <Column dataField="whtDescription" caption={t('reports.wht.columns.details')} />
                <Column
                  dataField="paymentAmount"
                  caption={t('reports.wht.columns.paymentAmount')}
                  dataType="number"
                  format="#,##0.00"
                  width={120}
                />
                <Column
                  dataField="whtRate"
                  caption={t('reports.wht.columns.whtRate')}
                  dataType="number"
                  format="#0.00"
                  width={100}
                />
                <Column
                  dataField="whtAmount"
                  caption={t('reports.wht.columns.whtAmount')}
                  dataType="number"
                  format="#,##0.00"
                  width={130}
                />
                <Column
                  dataField="netAmount"
                  caption={t('reports.wht.columns.netAmount')}
                  dataType="number"
                  format="#,##0.00"
                  width={130}
                />
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
                  <h3 className="text-xl font-bold text-white">{t('reports.wht.summaryTitle')}</h3>
                  <p className="text-sm text-orange-100">
                    {t('reports.wht.summaryTitle')} - {certificateType === 'pnd3' ? t('reports.wht.certificateType.pnd3') : t('reports.wht.certificateType.pnd53')} - {formatTaxPeriod(taxPeriod)}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <p className="text-sm text-blue-700 font-medium">{t('reports.wht.summaryCount')}</p>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">{report.certificateCount}</p>
                  <p className="text-xs text-blue-600 mt-1">{t('reports.wht.summaryCountSubtitle')}</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Receipt className="h-5 w-5 text-green-600" />
                    <p className="text-sm text-green-700 font-medium">{t('reports.wht.summaryPayment')}</p>
                  </div>
                  <p className="text-xl font-bold text-green-900">{formatCurrency(report.totalPaymentAmount)}</p>
                  <p className="text-xs text-green-600 mt-1">{t('reports.wht.summaryPaymentSubtitle')}</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-orange-600" />
                    <p className="text-sm text-orange-700 font-medium">{t('reports.wht.summaryWht')}</p>
                  </div>
                  <p className="text-xl font-bold text-orange-900">{formatCurrency(report.totalWHTAmount)}</p>
                  <p className="text-xs text-orange-600 mt-1">{t('reports.wht.summaryWhtSubtitle')}</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Receipt className="h-5 w-5 text-purple-600" />
                    <p className="text-sm text-purple-700 font-medium">{t('reports.wht.summaryNet')}</p>
                  </div>
                  <p className="text-xl font-bold text-purple-900">{formatCurrency(report.totalNetAmount)}</p>
                  <p className="text-xs text-purple-600 mt-1">{t('reports.wht.summaryNetSubtitle')}</p>
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

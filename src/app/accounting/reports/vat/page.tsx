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
    notify(t('reports.vat.toastExportSuccess'), 'success', 3000);
  }, [report, taxPeriod]);

  return (
    <div className="flex flex-col gap-6 pb-8" data-testid="vat-report-page" data-title={t('page.title')}>
      {/* Professional Page Header */}
      <AccountingPageHeader
        title={t('reports.vat.title')}
        subtitle={t('reports.vat.subtitle')}
        icon="receipt"
      />

      {/* VAT Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <AccountingKPICard
          label={t('reports.vat.kpi.taxPeriod')}
          subtitle={t('reports.vat.kpi.taxPeriod')}
          value={formatTaxPeriod(taxPeriod)}
          icon="calendar"
          variant="info"
        />
        <AccountingKPICard
          label={t('reports.vat.kpi.outputVat')}
          subtitle={t('reports.vat.kpi.outputVatSubtitle')}
          value={report ? formatCurrency(report.outputVAT.totalVATAmount) : '-'}
          icon="trending-up"
          variant="success"
          trend={report && report.outputVAT.totalVATAmount > 0 ? 'up' : 'neutral'}
        />
        <AccountingKPICard
          label={t('reports.vat.kpi.inputVat')}
          subtitle={t('reports.vat.kpi.inputVatSubtitle')}
          value={report ? formatCurrency(report.inputVAT.totalVATAmount) : '-'}
          icon="arrow-down"
          variant="danger"
          trend={report && report.inputVAT.totalVATAmount > 0 ? 'down' : 'neutral'}
        />
        <AccountingKPICard
          label={t('reports.vat.kpi.netVat')}
          subtitle={report && report.netVAT >= 0 ? t('reports.vat.kpi.netVatPayable') : t('reports.vat.kpi.netVatRefundable')}
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
            {t('reports.vat.selectPeriodLabel')}
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
              onClick={handleExportJSON}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {t('reports.actions.exportJson')}
            </Button>
          )}
        </div>
      </AccountingFilterPanel>

      {/* Report Content */}
      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-green-500"></div>
            <p className="text-gray-600 font-medium">{t('reports.vat.generating')}</p>
          </div>
        </div>
      )}

      {!reportGenerated && !isLoading && (
        <div className="bg-gradient-to-br from-white to-green-50/30 rounded-xl border border-green-100 shadow-sm p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="p-4 bg-green-100 rounded-full w-fit mx-auto mb-4">
              <Receipt className="h-12 w-12 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('reports.vat.empty.title')}</h3>
            <p className="text-gray-500">
              {t('reports.vat.empty.description')}
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
                      {t('reports.vat.outputSectionTitle')}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {t('reports.vat.outputSectionSubtitle')} - {formatTaxPeriod(taxPeriod)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{t('reports.vat.sectionTotal')}</p>
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
                <Column dataField="taxInvoiceNumber" caption={t('reports.vat.columns.taxInvoiceNumber')} />
                <Column dataField="taxInvoiceDate" caption={t('reports.vat.columns.date')} dataType="date" />
                <Column dataField="partyName" caption={t('reports.vat.columns.customerName')} />
                <Column dataField="partyTaxId" caption={t('reports.vat.columns.taxId')} />
                <Column dataField="branchCode" caption={t('reports.vat.columns.branch')} width={80} />
                <Column
                  dataField="taxableAmount"
                  caption={t('reports.vat.columns.taxableAmount')}
                  dataType="number"
                  format="#,##0.00"
                />
                <Column
                  dataField="vatAmount"
                  caption={t('reports.vat.columns.vatAmount')}
                  dataType="number"
                  format="#,##0.00"
                />
                <Column
                  dataField="totalAmount"
                  caption={t('reports.vat.columns.totalAmount')}
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
                      {t('reports.vat.inputSectionTitle')}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {t('reports.vat.inputSectionSubtitle')} - {formatTaxPeriod(taxPeriod)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{t('reports.vat.sectionTotal')}</p>
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
                <Column dataField="taxInvoiceNumber" caption={t('reports.vat.columns.taxInvoiceNumber')} />
                <Column dataField="taxInvoiceDate" caption={t('reports.vat.columns.date')} dataType="date" />
                <Column dataField="partyName" caption={t('reports.vat.columns.vendorName')} />
                <Column dataField="partyTaxId" caption={t('reports.vat.columns.taxId')} />
                <Column dataField="branchCode" caption={t('reports.vat.columns.branch')} width={80} />
                <Column
                  dataField="taxableAmount"
                  caption={t('reports.vat.columns.taxableAmount')}
                  dataType="number"
                  format="#,##0.00"
                />
                <Column
                  dataField="vatAmount"
                  caption={t('reports.vat.columns.vatAmount')}
                  dataType="number"
                  format="#,##0.00"
                />
                <Column
                  dataField="totalAmount"
                  caption={t('reports.vat.columns.totalAmount')}
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
                  <h3 className="text-xl font-bold text-white">{t('reports.vat.summaryTitle')}</h3>
                  <p className="text-sm text-blue-100">{t('reports.vat.summaryTitle')} - {formatTaxPeriod(taxPeriod)}</p>
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
                    <span className="text-gray-700 font-medium">{t('reports.vat.outputVatLine')}</span>
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
                    <span className="text-gray-700 font-medium">{t('reports.vat.inputVatLine')}</span>
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
                        {t('reports.vat.netVatLabel')}
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {report.netVAT >= 0 ? t('reports.vat.payable') : t('reports.vat.refundable')}
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

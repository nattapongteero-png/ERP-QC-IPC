'use client';

// WHT Certificates Report Page
// Feature: 010-accounting-module-integration
// User Story 6: Manage VAT and Withholding Tax

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DateBox } from 'devextreme-react/date-box';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import DataGrid, { Column, Export, Summary, TotalItem, Paging, FilterRow, SearchPanel } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { FileText, Users, Building2, Receipt } from 'lucide-react';
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
    <div className="flex flex-col gap-6">
      <ResponsivePageHeader
        title="WHT Certificates"
        subtitle={`${certificateType === 'pnd3' ? 'PND 3' : 'PND 53'} - Withholding tax certificates for tax filing`}
        icon={<FileText className="h-6 w-6 text-blue-600" />}
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Tax Period"
          value={formatTaxPeriod(taxPeriod)}
          icon={<Receipt className="h-5 w-5" />}
          trend={{ value: 0, direction: 'neutral' }}
        />
        <StatCard
          label="Certificate Type"
          value={certificateType === 'pnd3' ? 'PND 3' : 'PND 53'}
          icon={certificateType === 'pnd3' ? <Users className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
          trend={{ value: 0, direction: 'neutral' }}
        />
        <StatCard
          label="Certificates"
          value={report ? report.certificateCount.toString() : '-'}
          icon={<FileText className="h-5 w-5" />}
          trend={{ value: 0, direction: 'neutral' }}
        />
        <StatCard
          label="Total WHT"
          value={report ? formatCurrency(report.totalWHTAmount) : '-'}
          icon={<Receipt className="h-5 w-5" />}
          trend={{ value: 0, direction: 'neutral' }}
        />
      </div>

      {/* Report Controls */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Tax Period</label>
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
            <label className="text-sm font-medium text-gray-700">Certificate Type</label>
            <SelectBox
              items={certificateTypeOptions}
              value={certificateType}
              onValueChanged={(e) => setCertificateType(e.value)}
              valueExpr="value"
              displayExpr="text"
              width={200}
            />
          </div>
          <Button
            text="Generate Report"
            type="default"
            stylingMode="contained"
            onClick={handleGenerateReport}
            disabled={isLoading}
          />
          {report && (
            <Button
              text="Export JSON"
              type="normal"
              stylingMode="outlined"
              onClick={handleExportJSON}
            />
          )}
        </div>
      </div>

      {/* Report Content */}
      {isLoading && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">Loading WHT certificates...</p>
        </div>
      )}

      {!reportGenerated && !isLoading && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            Select a tax period and certificate type, then click &quot;Generate Report&quot; to view WHT certificates.
          </p>
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {/* Certificates Grid */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              WHT Certificates - {certificateType === 'pnd3' ? 'PND 3' : 'PND 53'} ({formatTaxPeriod(taxPeriod)})
            </h3>
            <DataGrid
              dataSource={report.entries}
              showBorders
              columnAutoWidth
              allowColumnResizing
              rowAlternationEnabled
              onRowClick={handleViewCertificate}
              hoverStateEnabled
            >
              <FilterRow visible />
              <SearchPanel visible width={250} />
              <Paging defaultPageSize={20} />
              <Column dataField="certificateNumber" caption="Certificate No." />
              <Column dataField="paymentDate" caption="Payment Date" dataType="date" />
              <Column dataField="vendorName" caption="Vendor Name" />
              <Column dataField="vendorTaxId" caption="Tax ID" />
              <Column dataField="whtType" caption="WHT Type" />
              <Column dataField="whtDescription" caption="Description" />
              <Column
                dataField="paymentAmount"
                caption="Payment Amount"
                dataType="number"
                format="#,##0.00"
              />
              <Column dataField="whtRate" caption="Rate (%)" dataType="number" format="#0.00" />
              <Column
                dataField="whtAmount"
                caption="WHT Amount"
                dataType="number"
                format="#,##0.00"
              />
              <Column
                dataField="netAmount"
                caption="Net Amount"
                dataType="number"
                format="#,##0.00"
              />
              <Export enabled allowExportSelectedData />
              <Summary>
                <TotalItem column="paymentAmount" summaryType="sum" valueFormat="#,##0.00" />
                <TotalItem column="whtAmount" summaryType="sum" valueFormat="#,##0.00" />
                <TotalItem column="netAmount" summaryType="sum" valueFormat="#,##0.00" />
              </Summary>
            </DataGrid>
          </div>

          {/* Summary Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">WHT Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Total Certificates</p>
                <p className="text-2xl font-bold text-gray-900">{report.certificateCount}</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Total Payment Amount</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(report.totalPaymentAmount)}</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-600">Total WHT Withheld</p>
                <p className="text-xl font-bold text-blue-700">{formatCurrency(report.totalWHTAmount)}</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-600">Total Net Paid</p>
                <p className="text-xl font-bold text-green-700">{formatCurrency(report.totalNetAmount)}</p>
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

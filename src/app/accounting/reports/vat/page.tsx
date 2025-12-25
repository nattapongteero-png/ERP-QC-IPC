'use client';

// VAT Report Page (Por Por 30)
// Feature: 010-accounting-module-integration
// User Story 6: Manage VAT and Withholding Tax

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DateBox } from 'devextreme-react/date-box';
import { Button } from 'devextreme-react/button';
import DataGrid, { Column, Export, Summary, TotalItem } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { Receipt, TrendingUp, TrendingDown, Calculator } from 'lucide-react';
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
    notify('VAT report exported successfully', 'success', 3000);
  }, [report, taxPeriod]);

  return (
    <div className="flex flex-col gap-6">
      <ResponsivePageHeader
        title="VAT Report"
        subtitle="Por Por 30 - Input and Output VAT summary for tax filing"
        icon={Receipt}
        iconColor="text-green-600"
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Tax Period"
          value={formatTaxPeriod(taxPeriod)}
          icon={Receipt}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
        />
        <StatCard
          label="Output VAT"
          value={report ? formatCurrency(report.outputVAT.totalVATAmount) : '-'}
          icon={TrendingUp}
          iconColor="text-green-500"
          accentColor="border-green-500"
        />
        <StatCard
          label="Input VAT"
          value={report ? formatCurrency(report.inputVAT.totalVATAmount) : '-'}
          icon={TrendingDown}
          iconColor="text-red-500"
          accentColor="border-red-500"
        />
        <StatCard
          label="Net VAT"
          value={report ? formatCurrency(report.netVAT) : '-'}
          icon={Calculator}
          iconColor={report && report.netVAT >= 0 ? 'text-orange-500' : 'text-purple-500'}
          accentColor={report && report.netVAT >= 0 ? 'border-orange-500' : 'border-purple-500'}
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
          <p className="text-gray-500">Loading VAT report...</p>
        </div>
      )}

      {!reportGenerated && !isLoading && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            Select a tax period and click &quot;Generate Report&quot; to view the VAT report.
          </p>
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {/* Output VAT Section */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Output VAT (Sales) - {formatTaxPeriod(taxPeriod)}
            </h3>
            <DataGrid
              dataSource={report.outputVAT.entries}
              showBorders
              columnAutoWidth
              allowColumnResizing
              rowAlternationEnabled
            >
              <Column dataField="taxInvoiceNumber" caption="Tax Invoice No." />
              <Column dataField="taxInvoiceDate" caption="Date" dataType="date" />
              <Column dataField="partyName" caption="Customer Name" />
              <Column dataField="partyTaxId" caption="Tax ID" />
              <Column dataField="branchCode" caption="Branch" />
              <Column
                dataField="taxableAmount"
                caption="Taxable Amount"
                dataType="number"
                format="#,##0.00"
              />
              <Column
                dataField="vatAmount"
                caption="VAT (7%)"
                dataType="number"
                format="#,##0.00"
              />
              <Column
                dataField="totalAmount"
                caption="Total"
                dataType="number"
                format="#,##0.00"
              />
              <Export enabled allowExportSelectedData />
              <Summary>
                <TotalItem column="taxableAmount" summaryType="sum" valueFormat="#,##0.00" />
                <TotalItem column="vatAmount" summaryType="sum" valueFormat="#,##0.00" />
                <TotalItem column="totalAmount" summaryType="sum" valueFormat="#,##0.00" />
              </Summary>
            </DataGrid>
            <div className="mt-4 text-right text-sm text-gray-600">
              Total Output VAT: <span className="font-semibold">{formatCurrency(report.outputVAT.totalVATAmount)}</span>
            </div>
          </div>

          {/* Input VAT Section */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Input VAT (Purchases) - {formatTaxPeriod(taxPeriod)}
            </h3>
            <DataGrid
              dataSource={report.inputVAT.entries}
              showBorders
              columnAutoWidth
              allowColumnResizing
              rowAlternationEnabled
            >
              <Column dataField="taxInvoiceNumber" caption="Tax Invoice No." />
              <Column dataField="taxInvoiceDate" caption="Date" dataType="date" />
              <Column dataField="partyName" caption="Vendor Name" />
              <Column dataField="partyTaxId" caption="Tax ID" />
              <Column dataField="branchCode" caption="Branch" />
              <Column
                dataField="taxableAmount"
                caption="Taxable Amount"
                dataType="number"
                format="#,##0.00"
              />
              <Column
                dataField="vatAmount"
                caption="VAT (7%)"
                dataType="number"
                format="#,##0.00"
              />
              <Column
                dataField="totalAmount"
                caption="Total"
                dataType="number"
                format="#,##0.00"
              />
              <Export enabled allowExportSelectedData />
              <Summary>
                <TotalItem column="taxableAmount" summaryType="sum" valueFormat="#,##0.00" />
                <TotalItem column="vatAmount" summaryType="sum" valueFormat="#,##0.00" />
                <TotalItem column="totalAmount" summaryType="sum" valueFormat="#,##0.00" />
              </Summary>
            </DataGrid>
            <div className="mt-4 text-right text-sm text-gray-600">
              Total Input VAT: <span className="font-semibold">{formatCurrency(report.inputVAT.totalVATAmount)}</span>
            </div>
          </div>

          {/* Net VAT Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">VAT Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Output VAT (Sales):</span>
                <span className="font-medium">{formatCurrency(report.outputVAT.totalVATAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Less: Input VAT (Purchases):</span>
                <span className="font-medium">({formatCurrency(report.inputVAT.totalVATAmount)})</span>
              </div>
              <hr className="my-2" />
              <div className="flex justify-between text-lg font-bold">
                <span>Net VAT {report.netVAT >= 0 ? 'Payable' : 'Refundable'}:</span>
                <span className={report.netVAT >= 0 ? 'text-red-600' : 'text-green-600'}>
                  {formatCurrency(Math.abs(report.netVAT))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

/**
 * Tax Invoice Register (ทะเบียนใบกำกับภาษี) — list items 30-31.
 *
 * The app already issues tax invoice numbers (T-YYYYMM-NNNN) and records every
 * one in vat_transactions, but until now there was no screen for them, so
 * testers reported the feature as missing. This lists both sides of VAT:
 * output (ภาษีขาย, from AR invoices) and input (ภาษีซื้อ, from AP invoices).
 *
 * Each row can be printed straight from this register: output rows reuse the AR
 * invoice form (ARInvoicePrintDocument, the legal ใบกำกับภาษี), input rows reuse
 * the AP invoice form (APInvoicePrintDocument). The register still links back to
 * the source AR/AP screen for editing.
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import DataGrid, {
  Column,
  Paging,
  Pager,
  SearchPanel,
  Summary,
  TotalItem,
  Toolbar,
  Item,
} from 'devextreme-react/data-grid';
import type { DataGridRef } from 'devextreme-react/data-grid';
import { exportGridToExcel } from '@/lib/utils/export-grid-excel';
import { SelectBox } from 'devextreme-react/select-box';
import { DateBox } from 'devextreme-react/date-box';
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingKPICardSkeleton,
  AccountingFilterPanel,
} from '@/components/accounting';
import { Button } from 'devextreme-react/button';
import notify from 'devextreme/ui/notify';
import { Card, CardContent } from '@/components/ui/card';
import { formatNumber } from '@/lib/utils/number-format';
import {
  ARInvoicePrintDocument,
  type ARInvoicePrintData,
} from '@/components/accounting/ARInvoicePrintDocument';
import {
  APInvoicePrintDocument,
  type APInvoicePrintData,
} from '@/components/accounting/APInvoicePrintDocument';

interface TaxInvoiceEntry {
  id: number;
  transactionType: 'input' | 'output';
  taxInvoiceNumber: string;
  taxInvoiceDate: string;
  taxPeriod: string;
  partyName: string;
  partyTaxId: string;
  branchCode: string;
  taxableAmount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  arInvoiceId: number | null;
  apInvoiceId: number | null;
}

const formatCurrency = (v: number) => `฿${formatNumber(v, 2)}`;

async function fetchTaxInvoices(params: {
  transactionType: string;
  dateFrom: string;
  dateTo: string;
}): Promise<TaxInvoiceEntry[]> {
  const qs = new URLSearchParams();
  if (params.transactionType) qs.set('transactionType', params.transactionType);
  if (params.dateFrom) qs.set('dateFrom', params.dateFrom);
  if (params.dateTo) qs.set('dateTo', params.dateTo);

  const res = await fetch(`/api/accounting/tax-invoices?${qs.toString()}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Failed to load tax invoices');
  return json.data || [];
}

export default function TaxInvoicesPage() {
  const t = useTranslations('accounting');
  const [transactionType, setTransactionType] = useState<string>('output');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  // Printing straight from the register: an output row prints via the AR invoice
  // form (ARInvoicePrintDocument), an input row via the AP invoice form. Only
  // one is set at a time.
  const [arPrintData, setArPrintData] = useState<ARInvoicePrintData | null>(null);
  const [apPrintData, setApPrintData] = useState<APInvoicePrintData | null>(null);
  const [printing, setPrinting] = useState(false);
  const gridRef = useRef<DataGridRef>(null);

  const handleExportExcel = useCallback(() => {
    exportGridToExcel(gridRef.current, 'tax-invoices', t('taxInvoices.title'));
  }, [t]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tax-invoices', transactionType, dateFrom, dateTo],
    queryFn: () => fetchTaxInvoices({ transactionType, dateFrom, dateTo }),
  });

  const rows = useMemo(() => data || [], [data]);

  const totals = useMemo(() => {
    const output = rows.filter((r) => r.transactionType === 'output');
    const input = rows.filter((r) => r.transactionType === 'input');
    const outputVat = output.reduce((s, r) => s + r.vatAmount, 0);
    const inputVat = input.reduce((s, r) => s + r.vatAmount, 0);
    return {
      count: rows.length,
      outputVat,
      inputVat,
      netVat: outputVat - inputVat,
    };
  }, [rows]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Print the legal document behind a register row. We fetch the source AR/AP
  // invoice for its line items, but take the counter-party name and tax id from
  // the register row itself (partyName/partyTaxId) — that is the party as it was
  // recorded on the tax invoice.
  const handlePrint = useCallback(async (row: TaxInvoiceEntry) => {
    try {
      if (row.transactionType === 'output' && row.arInvoiceId) {
        const res = await fetch(`/api/accounting/ar-invoices/${row.arInvoiceId}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        const d = json.data;
        setApPrintData(null);
        setArPrintData({
          invoiceNumber: d.invoiceNumber,
          taxInvoiceNumber: d.taxInvoiceNumber || row.taxInvoiceNumber,
          invoiceDate: d.invoiceDate,
          dueDate: d.dueDate,
          description: d.description,
          subtotal: Number(d.subtotal) || 0,
          vatAmount: Number(d.vatAmount) || 0,
          totalAmount: Number(d.totalAmount) || 0,
          paidAmount: Number(d.paidAmount) || 0,
          lines: (d.lines || []).map((l: any) => ({
            description: l.description || '',
            quantity: Number(l.quantity) || 0,
            unitPrice: Number(l.unitPrice) || 0,
            amount: Number(l.amount) || 0,
            vatAmount: l.vatAmount != null ? Number(l.vatAmount) : null,
          })),
          customer: { name: row.partyName, taxId: row.partyTaxId },
        });
      } else if (row.transactionType === 'input' && row.apInvoiceId) {
        const res = await fetch(`/api/accounting/ap-invoices/${row.apInvoiceId}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        const d = json.data;
        setArPrintData(null);
        setApPrintData({
          invoiceNumber: d.invoiceNumber,
          invoiceDate: d.invoiceDate,
          dueDate: d.dueDate,
          receivedDate: d.receivedDate,
          description: d.description,
          subtotal: Number(d.subtotal) || 0,
          vatAmount: Number(d.vatAmount) || 0,
          whtAmount: Number(d.whtAmount) || 0,
          totalAmount: Number(d.totalAmount) || 0,
          paidAmount: Number(d.paidAmount) || 0,
          lines: (d.lines || []).map((l: any) => ({
            description: l.description || '',
            quantity: Number(l.quantity) || 0,
            unitPrice: Number(l.unitPrice) || 0,
            amount: Number(l.amount) || 0,
          })),
          vendor: { name: row.partyName, taxId: row.partyTaxId },
        });
      } else {
        notify(t('taxInvoices.noSourceToPrint'), 'warning', 3000);
        return;
      }
      setPrinting(true);
      requestAnimationFrame(() => {
        window.print();
        setPrinting(false);
      });
    } catch (err: any) {
      notify(err?.message || t('taxInvoices.printError'), 'error', 4000);
    }
  }, [t]);

  // Link each row back to the document that produced it, so the printable legal
  // form is always one click away.
  const renderSource = useCallback((cellInfo: any) => {
    const row: TaxInvoiceEntry = cellInfo.data;
    const href = row.arInvoiceId
      ? '/accounting/ar/invoices'
      : row.apInvoiceId
        ? '/accounting/ap/invoices'
        : null;
    if (!href) return <span className="text-gray-400">-</span>;
    return (
      <a
        href={href}
        className="text-indigo-600 hover:underline"
        data-testid={`tax-invoice-source-${row.id}`}
      >
        {row.arInvoiceId ? t('taxInvoices.sourceAR') : t('taxInvoices.sourceAP')}
      </a>
    );
  }, [t]);

  return (
    <div className="space-y-6 p-1" data-testid="tax-invoices-page">
      <AccountingPageHeader
        title={t('taxInvoices.title')}
        subtitle={t('taxInvoices.description')}
        icon="receipt"
        onBack={() => (window.location.href = '/accounting')}
        breadcrumbs={[
          { label: t('page.title'), href: '/accounting' },
          { label: t('taxInvoices.title') },
        ]}
        onRefresh={handleRefresh}
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            <>
              <AccountingKPICardSkeleton />
              <AccountingKPICardSkeleton />
              <AccountingKPICardSkeleton />
              <AccountingKPICardSkeleton />
            </>
          ) : (
            <>
              <AccountingKPICard
                label={t('taxInvoices.kpi.count')}
                value={`${formatNumber(totals.count)} ${t('taxInvoices.kpi.documents')}`}
                icon="receipt"
                variant="default"
              />
              <AccountingKPICard
                label={t('taxInvoices.kpi.outputVat')}
                value={formatCurrency(totals.outputVat)}
                subtitle={t('taxInvoices.kpi.outputVatSubtitle')}
                icon="dollar-sign"
                variant="success"
              />
              <AccountingKPICard
                label={t('taxInvoices.kpi.inputVat')}
                value={formatCurrency(totals.inputVat)}
                subtitle={t('taxInvoices.kpi.inputVatSubtitle')}
                icon="credit-card"
                variant="default"
              />
              <AccountingKPICard
                label={t('taxInvoices.kpi.netVat')}
                value={formatCurrency(totals.netVat)}
                subtitle={t('taxInvoices.kpi.netVatSubtitle')}
                icon="bar-chart"
                variant={totals.netVat >= 0 ? 'warning' : 'success'}
              />
            </>
          )}
        </div>

        <AccountingFilterPanel>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                {t('taxInvoices.filters.type')}
              </label>
              <SelectBox
                items={[
                  { value: 'output', text: t('taxInvoices.types.output') },
                  { value: 'input', text: t('taxInvoices.types.input') },
                  { value: '', text: t('taxInvoices.types.all') },
                ]}
                valueExpr="value"
                displayExpr="text"
                value={transactionType}
                onValueChanged={(e) => setTransactionType(e.value ?? '')}
                data-testid="tax-invoice-type-filter"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                {t('taxInvoices.filters.dateFrom')}
              </label>
              <DateBox
                type="date"
                value={dateFrom || null}
                displayFormat="yyyy-MM-dd"
                onValueChanged={(e) =>
                  setDateFrom(e.value ? new Date(e.value).toISOString().slice(0, 10) : '')
                }
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                {t('taxInvoices.filters.dateTo')}
              </label>
              <DateBox
                type="date"
                value={dateTo || null}
                displayFormat="yyyy-MM-dd"
                onValueChanged={(e) =>
                  setDateTo(e.value ? new Date(e.value).toISOString().slice(0, 10) : '')
                }
              />
            </div>
          </div>
        </AccountingFilterPanel>

        <Card className="rounded-lg border overflow-hidden">
          <CardContent className="p-0">
            <DataGrid
              ref={gridRef}
              dataSource={rows}
              keyExpr="id"
              showBorders={false}
              rowAlternationEnabled
              // autoWidth stretches the table past its container (see the AR
              // invoice list); hide low-priority columns on narrow screens
              // instead of forcing a horizontal scrollbar.
              columnAutoWidth={false}
              columnHidingEnabled
              wordWrapEnabled={false}
              noDataText={t('taxInvoices.noData')}
              data-testid="tax-invoices-grid"
              data-build="ar-ap-export-20260727-v2"
            >
              <SearchPanel visible placeholder={t('taxInvoices.searchPlaceholder')} />
              <Paging defaultPageSize={20} />
              <Pager
                visible
                allowedPageSizes={[10, 20, 50, 100]}
                showPageSizeSelector
                showInfo
              />

              {/* A labelled "ส่งออก Excel" button that actually writes the file
                  (DevExtreme's built-in <Export> only shows a button; it
                  produced no file here). */}
              <Toolbar>
                <Item name="searchPanel" location="before" />
                <Item location="after" widget="dxButton" options={{
                  icon: 'xlsxfile',
                  text: t('taxInvoices.exportExcel'),
                  stylingMode: 'contained',
                  type: 'success',
                  onClick: handleExportExcel,
                  elementAttr: { 'data-testid': 'tax-invoice-export-excel-btn' },
                }} />
              </Toolbar>

              <Column
                caption="#"
                width={60}
                alignment="center"
                cellRender={(c: any) => c.rowIndex + 1}
              />
              <Column
                dataField="taxInvoiceNumber"
                caption={t('taxInvoices.columns.number')}
                minWidth={160}
              />
              <Column
                dataField="taxInvoiceDate"
                caption={t('taxInvoices.columns.date')}
                dataType="date"
                format="yyyy-MM-dd"
                width={120}
              />
              <Column
                dataField="transactionType"
                caption={t('taxInvoices.columns.type')}
                width={110}
                cellRender={(c: any) => (
                  <span
                    className={
                      c.data.transactionType === 'output'
                        ? 'px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700'
                        : 'px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700'
                    }
                  >
                    {c.data.transactionType === 'output'
                      ? t('taxInvoices.types.output')
                      : t('taxInvoices.types.input')}
                  </span>
                )}
              />
              <Column
                dataField="partyName"
                caption={t('taxInvoices.columns.party')}
                minWidth={180}
              />
              <Column
                dataField="partyTaxId"
                caption={t('taxInvoices.columns.partyTaxId')}
                width={150}
              />
              <Column
                dataField="branchCode"
                caption={t('taxInvoices.columns.branch')}
                width={90}
                alignment="center"
              />
              <Column
                dataField="taxableAmount"
                caption={t('taxInvoices.columns.taxableAmount')}
                width={140}
                alignment="right"
                cellRender={(c: any) => formatCurrency(c.data.taxableAmount)}
              />
              <Column
                dataField="vatAmount"
                caption={t('taxInvoices.columns.vatAmount')}
                width={130}
                alignment="right"
                cellRender={(c: any) => (
                  <span className="font-semibold">{formatCurrency(c.data.vatAmount)}</span>
                )}
              />
              <Column
                dataField="totalAmount"
                caption={t('taxInvoices.columns.totalAmount')}
                width={140}
                alignment="right"
                cellRender={(c: any) => formatCurrency(c.data.totalAmount)}
              />
              <Column
                caption={t('taxInvoices.columns.source')}
                width={120}
                alignment="center"
                cellRender={renderSource}
              />
              <Column
                caption={t('taxInvoices.columns.print')}
                width={90}
                alignment="center"
                allowFiltering={false}
                allowSorting={false}
                cellRender={(c: any) => (
                  <Button
                    icon="print"
                    stylingMode="text"
                    hint={t('taxInvoices.printHint')}
                    onClick={() => handlePrint(c.data as TaxInvoiceEntry)}
                    elementAttr={{ 'data-testid': `tax-invoice-print-${c.data.id}` }}
                  />
                )}
              />

              <Summary>
                <TotalItem
                  column="taxableAmount"
                  summaryType="sum"
                  customizeText={(d: any) => formatCurrency(Number(d.value) || 0)}
                />
                <TotalItem
                  column="vatAmount"
                  summaryType="sum"
                  customizeText={(d: any) => formatCurrency(Number(d.value) || 0)}
                />
                <TotalItem
                  column="totalAmount"
                  summaryType="sum"
                  customizeText={(d: any) => formatCurrency(Number(d.value) || 0)}
                />
              </Summary>
            </DataGrid>
          </CardContent>
        </Card>
      </div>

      {/* Hidden on screen; the global @media print rules reveal .print-only. */}
      {printing && arPrintData && <ARInvoicePrintDocument invoice={arPrintData} />}
      {printing && apPrintData && <APInvoicePrintDocument invoice={apPrintData} />}
    </div>
  );
}

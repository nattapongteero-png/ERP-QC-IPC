'use client';

/**
 * Tax Invoice Register (ทะเบียนใบกำกับภาษี) — list items 30-31.
 *
 * The app already issues tax invoice numbers (T-YYYYMM-NNNN) and records every
 * one in vat_transactions, but until now there was no screen for them, so
 * testers reported the feature as missing. This lists both sides of VAT:
 * output (ภาษีขาย, from AR invoices) and input (ภาษีซื้อ, from AP invoices).
 *
 * Printing a single output tax invoice happens on the AR invoice screen, which
 * owns the legal form (ARInvoicePrintDocument) — this page links through to it
 * rather than duplicating that document.
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import DataGrid, {
  Column,
  Paging,
  Pager,
  SearchPanel,
  Summary,
  TotalItem,
  Export,
} from 'devextreme-react/data-grid';
import { SelectBox } from 'devextreme-react/select-box';
import { DateBox } from 'devextreme-react/date-box';
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingKPICardSkeleton,
  AccountingFilterPanel,
} from '@/components/accounting';
import { Card, CardContent } from '@/components/ui/card';
import { formatNumber } from '@/lib/utils/number-format';

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
              dataSource={rows}
              keyExpr="id"
              showBorders={false}
              rowAlternationEnabled
              columnAutoWidth
              wordWrapEnabled
              noDataText={t('taxInvoices.noData')}
              data-testid="tax-invoices-grid"
            >
              <SearchPanel visible placeholder={t('taxInvoices.searchPlaceholder')} />
              <Paging defaultPageSize={20} />
              <Pager
                visible
                allowedPageSizes={[10, 20, 50, 100]}
                showPageSizeSelector
                showInfo
              />
              <Export enabled />

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
    </div>
  );
}

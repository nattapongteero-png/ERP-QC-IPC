'use client';

/**
 * Purchase Report — spend by status, vendor and month over a date range.
 * The shape and rendering live in OrderReportView, shared with the sales report.
 */

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { OrderReportView, type OrderReport } from '@/components/reports/OrderReportView';
import type { DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { Badge, getStatusVariant } from '@/components/ui/badge';
import { formatBaht } from '@/lib/utils/number-format';

interface PurchaseRow extends Record<string, unknown> {
  id: number;
  poNumber: string;
  orderDate: string | null;
  expectedDate: string | null;
  vendorName: string | null;
  vendorCode: string | null;
  status: string;
  totalAmount: number;
}

export default function PurchaseReportPage() {
  const t = useTranslations('purchasing');
  const tr = useTranslations('reports.orderReport');
  const [data, setData] = useState<OrderReport<PurchaseRow> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const p = new URLSearchParams();
      if (dateFrom) p.append('dateFrom', dateFrom);
      if (dateTo) p.append('dateTo', dateTo);
      const res = await fetch(`/api/purchasing/reports/purchase-summary?${p}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (e) {
      console.error('Failed to fetch purchase report:', e);
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const statusLabel = useCallback(
    (s: string) => {
      // Falls back to the raw code rather than rendering a missing-key error if
      // a new status appears in the data before a translation exists.
      const key = `orders.status.${s}`;
      const label = t.has(key as never) ? t(key as never) : s;
      return label;
    },
    [t],
  );

  const columns: DxDataGridColumn[] = [
    { dataField: 'poNumber', caption: tr('table.orderNumber'), width: 150 },
    { dataField: 'orderDate', caption: tr('table.orderDate'), width: 120 },
    { dataField: 'vendorName', caption: tr('table.vendor'), minWidth: 180 },
    { dataField: 'expectedDate', caption: tr('table.expectedDate'), width: 130, hideOnMobile: true },
    {
      dataField: 'status',
      caption: tr('table.status'),
      width: 140,
      cellRender: (c) => (
        <Badge variant={getStatusVariant(String(c.data.status))} className="whitespace-nowrap">
          {statusLabel(String(c.data.status))}
        </Badge>
      ),
    },
    {
      dataField: 'totalAmount',
      caption: tr('table.value'),
      width: 150,
      dataType: 'number',
      cellRender: (c) => (
        <span className="font-medium tabular-nums">{formatBaht(Number(c.data.totalAmount))}</span>
      ),
    },
  ];

  return (
    <OrderReportView<PurchaseRow>
      title={tr('purchase.title')}
      subtitle={tr('purchase.subtitle')}
      data={data}
      isLoading={isLoading}
      dateFrom={dateFrom}
      dateTo={dateTo}
      onDateFrom={setDateFrom}
      onDateTo={setDateTo}
      onRefresh={fetchReport}
      columns={columns}
      partyLabel={tr('section.byVendor')}
      statusLabel={statusLabel}
      exportName="purchase-report"
      exportRow={(r) => ({
        [tr('table.orderNumber')]: r.poNumber,
        [tr('table.orderDate')]: r.orderDate ?? '',
        [tr('table.vendor')]: r.vendorName ?? '',
        [tr('table.code')]: r.vendorCode ?? '',
        [tr('table.expectedDate')]: r.expectedDate ?? '',
        [tr('table.status')]: statusLabel(r.status),
        [tr('table.value')]: r.totalAmount,
      })}
    />
  );
}

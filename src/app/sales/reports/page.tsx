'use client';

/**
 * Sales Report — revenue by status, customer and month over a date range.
 * The shape and rendering live in OrderReportView, shared with the purchase report.
 */

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { OrderReportView, type OrderReport } from '@/components/reports/OrderReportView';
import type { DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { Badge, getStatusVariant } from '@/components/ui/badge';
import { formatBaht } from '@/lib/utils/number-format';

interface SalesRow extends Record<string, unknown> {
  id: number;
  soNumber: string;
  orderDate: string | null;
  requiredDate: string | null;
  shippedDate: string | null;
  customerName: string | null;
  status: string;
  totalAmount: number;
}

export default function SalesReportPage() {
  const t = useTranslations('sales');
  const tr = useTranslations('reports.orderReport');
  const [data, setData] = useState<OrderReport<SalesRow> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const p = new URLSearchParams();
      if (dateFrom) p.append('dateFrom', dateFrom);
      if (dateTo) p.append('dateTo', dateTo);
      const res = await fetch(`/api/sales/reports/sales-summary?${p}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (e) {
      console.error('Failed to fetch sales report:', e);
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const statusLabel = useCallback(
    (s: string) => {
      const key = `orders.status.${s}`;
      return t.has(key as never) ? t(key as never) : s;
    },
    [t],
  );

  const columns: DxDataGridColumn[] = [
    { dataField: 'soNumber', caption: tr('table.orderNumber'), width: 150 },
    { dataField: 'orderDate', caption: tr('table.orderDate'), width: 120 },
    { dataField: 'customerName', caption: tr('table.customer'), minWidth: 180 },
    { dataField: 'requiredDate', caption: tr('table.requiredDate'), width: 130, hideOnMobile: true },
    { dataField: 'shippedDate', caption: tr('table.shippedDate'), width: 130, hideOnMobile: true },
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
    <MainLayout>
      <OrderReportView<SalesRow>
      title={tr('sales.title')}
      subtitle={tr('sales.subtitle')}
      data={data}
      isLoading={isLoading}
      dateFrom={dateFrom}
      dateTo={dateTo}
      onDateFrom={setDateFrom}
      onDateTo={setDateTo}
      onRefresh={fetchReport}
      columns={columns}
      partyLabel={tr('section.byCustomer')}
      statusLabel={statusLabel}
      exportName="sales-report"
      exportRow={(r) => ({
        [tr('table.orderNumber')]: r.soNumber,
        [tr('table.orderDate')]: r.orderDate ?? '',
        [tr('table.customer')]: r.customerName ?? '',
        [tr('table.requiredDate')]: r.requiredDate ?? '',
        [tr('table.shippedDate')]: r.shippedDate ?? '',
        [tr('table.status')]: statusLabel(r.status),
        [tr('table.value')]: r.totalAmount,
      })}
      />
    </MainLayout>
  );
}

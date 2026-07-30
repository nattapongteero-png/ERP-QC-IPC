'use client';

/**
 * Quotations register (ทะเบียนใบเสนอราคา).
 *
 * The quotation is the first document in the sales flow — the offer a customer
 * decides on before it becomes a sales order. This screen lists them newest
 * first (transaction list convention) with a running # column, and surfaces how
 * many have already been converted into sales orders.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { formatNumber } from '@/lib/utils/number-format';
import { FileText, Plus, DollarSign, ArrowRightLeft } from 'lucide-react';
import type { Quotation, QuotationStatus } from '@/types/quotation';

// Compact dd/mm/yyyy so the date never gets clipped to "2026-07-22…" in a narrow
// column. Pure client-side: the API already sends ISO strings, so we slice the
// YYYY-MM-DD off the front (handles "…T00:00:00" too). Intentionally NOT using
// formatDateFromDb — that imports the db layer (better-sqlite3/mysql2) and would
// drag server-only modules into this 'use client' bundle and break the build.
function formatDateCompact(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const ymd = String(value).slice(0, 10); // YYYY-MM-DD
  const [y, m, d] = ymd.split('-');
  if (!y || !m || !d) return String(value);
  return `${d}/${m}/${y}`;
}
// Translation KEYS + badge tones per status. Keys, not Thai text: module
// scope cannot call useTranslations, and the page must follow the language.
const STATUS_META: Record<QuotationStatus, { labelKey: string; variant: BadgeProps['variant'] }> = {
  draft: { labelKey: 'quotations.status.draft', variant: 'default' },
  sent: { labelKey: 'quotations.status.sent', variant: 'info' },
  accepted: { labelKey: 'quotations.status.accepted', variant: 'success' },
  rejected: { labelKey: 'quotations.status.rejected', variant: 'danger' },
  expired: { labelKey: 'quotations.status.expired', variant: 'warning' },
  converted: { labelKey: 'quotations.status.converted', variant: 'primary' },
};

const STATUS_FILTER_KEYS = [
  { value: '', labelKey: 'quotations.status.all' },
  ...(Object.keys(STATUS_META) as QuotationStatus[]).map((s) => ({
    value: s,
    labelKey: STATUS_META[s].labelKey,
  })),
];

interface QuotationRow extends Quotation, Record<string, unknown> {}

export default function QuotationsPage() {
  const router = useRouter();
  const t = useTranslations('sales');
  const tCommon = useTranslations('common');
  // Resolve the status labels here — STATUS_FILTER_KEYS holds keys because it
  // lives at module scope where hooks are unavailable.
  const statusFilterOptions = useMemo(
    () => STATUS_FILTER_KEYS.map((o) => ({ value: o.value, label: t(o.labelKey) })),
    [t],
  );
  const [rows, setRows] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const p = new URLSearchParams();
      if (statusFilter) p.append('status', statusFilter);
      if (search.trim()) p.append('search', search.trim());
      const res = await fetch(`/api/sales/quotations?${p}`);
      const json = await res.json();
      if (json.success) setRows(json.data ?? []);
    } catch (e) {
      console.error('Failed to fetch quotations:', e);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Newest first (transaction-list convention): the API returns rows by id; we
  // sort by id descending so the latest quotation sits at #1, and stamp the
  // running number after sorting so # matches the displayed order.
  const orderedRows: QuotationRow[] = useMemo(() => {
    const sorted = [...rows].sort((a, b) => b.id - a.id);
    return sorted.map((r, i) => ({ ...r, rowNo: i + 1 })) as QuotationRow[];
  }, [rows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const totalValue = rows.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0);
    const converted = rows.filter((r) => r.status === 'converted').length;
    return { total, totalValue, converted };
  }, [rows]);

  const columns: DxDataGridColumn[] = [
    { dataField: 'rowNo', caption: '#', width: 56, alignment: 'center', allowSorting: false },
    { dataField: 'quotationNumber', caption: t(`quotations.columns.number`), width: 150 },
    {
      dataField: 'customerName',
      caption: t(`quotations.columns.customer`),
      minWidth: 180,
      // Let the full customer name wrap instead of clipping to "…"; keep the
      // full text on hover via title.
      cellRender: (c) => (
        <span className="break-words whitespace-normal" title={String(c.data.customerName ?? '')}>
          {c.data.customerName || '-'}
        </span>
      ),
    },
    {
      dataField: 'quotationDate',
      caption: t(`quotations.columns.date`),
      width: 110,
      cellRender: (c) => (
        <span className="whitespace-nowrap tabular-nums">{formatDateCompact(c.data.quotationDate as string)}</span>
      ),
    },
    {
      dataField: 'validUntil',
      caption: t(`quotations.columns.validUntil`),
      width: 110,
      cellRender: (c) => (
        <span className="whitespace-nowrap tabular-nums">{formatDateCompact(c.data.validUntil as string)}</span>
      ),
    },
    {
      dataField: 'totalAmount',
      caption: t(`quotations.columns.total`),
      width: 140,
      alignment: 'right',
      cellRender: (c) => (
        <span className="tabular-nums font-medium">
          {t(`quotations.amountBaht`, { amount: formatNumber(Number(c.data.totalAmount)) })}
        </span>
      ),
    },
    {
      dataField: 'status',
      caption: t(`quotations.columns.status`),
      width: 120,
      cellRender: (c) => {
        const meta = STATUS_META[c.data.status as QuotationStatus] ?? {
          labelKey: `quotations.status.${c.data.status}`,
          variant: 'default' as const,
        };
        return (
          <Badge variant={meta.variant} className="whitespace-nowrap">
            {t(meta.labelKey)}
          </Badge>
        );
      },
    },
    {
      dataField: 'actions',
      caption: t(`quotations.columns.actions`),
      width: 110,
      fixed: true,
      fixedPosition: 'right',
      cellRender: (c) => (
        <DxButton
          icon="find"
          text={t(`quotations.view`)}
          stylingMode="text"
          onClick={(e: { event?: { stopPropagation: () => void } }) => {
            e.event?.stopPropagation();
            router.push(`/sales/quotations/${c.data.id}`);
          }}
          elementAttr={{ 'data-testid': `btn-view-${c.data.id}` }}
        />
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
        <ResponsivePageHeader
          title={t(`quotations.title`)}
          subtitle={t(`quotations.subtitle`)}
          icon={FileText}
          iconBgColor="bg-amber-100"
          iconColor="text-amber-600"
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <DxButton icon="refresh" text={tCommon(`actions.refresh`)} stylingMode="outlined" onClick={fetchData} />
              <DxButton
                icon="plus"
                text={t(`quotations.create`)}
                type="success"
                onClick={() => router.push('/sales/quotations/new')}
                elementAttr={{ 'data-testid': 'btn-new-quotation' }}
              />
            </div>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <StatCard
            label={t(`quotations.stats.count`)}
            value={formatNumber(stats.total)}
            icon={FileText}
            tone="blue"
            isLoading={isLoading}
          />
          <StatCard
            label={t(`quotations.stats.value`)}
            value={formatNumber(stats.totalValue)}
            icon={DollarSign}
            tone="emerald"
            isLoading={isLoading}
          />
          <StatCard
            label={t(`quotations.stats.converted`)}
            value={formatNumber(stats.converted)}
            icon={ArrowRightLeft}
            tone="violet"
            isLoading={isLoading}
          />
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{t(`quotations.filters.search`)}</label>
              <DxTextBox
                value={search}
                onValueChange={setSearch}
                placeholder={t(`quotations.filters.searchPlaceholder`)}
                mode="search"
                labelMode="hidden"
                showClearButton
                width={240}
                elementAttr={{ 'data-testid': 'quotation-search-input' }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{t(`quotations.filters.status`)}</label>
              <DxSelectBox
                value={statusFilter}
                onValueChange={setStatusFilter}
                items={statusFilterOptions}
                labelMode="hidden"
                width={180}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <DxDataGrid
              dataSource={orderedRows}
              columns={columns}
              keyExpr="id"
              pageSize={20}
              sorting
              responsiveColumns
              columnHidingEnabled={false}
              onRowClick={(e: { data?: QuotationRow }) => {
                if (e.data?.id) router.push(`/sales/quotations/${e.data.id}`);
              }}
              noDataText={t(`quotations.noData`)}
              elementAttr={{ 'data-testid': 'quotations-grid' }}
            />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

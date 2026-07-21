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

// Thai labels + badge tones for every quotation status. Kept in one map so the
// grid cell and the filter dropdown never drift apart.
const STATUS_META: Record<QuotationStatus, { label: string; variant: BadgeProps['variant'] }> = {
  draft: { label: 'ร่าง', variant: 'default' },
  sent: { label: 'ส่งแล้ว', variant: 'info' },
  accepted: { label: 'ตอบรับ', variant: 'success' },
  rejected: { label: 'ปฏิเสธ', variant: 'danger' },
  expired: { label: 'หมดอายุ', variant: 'warning' },
  converted: { label: 'แปลงแล้ว', variant: 'primary' },
};

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'ทุกสถานะ' },
  ...(Object.keys(STATUS_META) as QuotationStatus[]).map((s) => ({
    value: s,
    label: STATUS_META[s].label,
  })),
];

interface QuotationRow extends Quotation, Record<string, unknown> {}

export default function QuotationsPage() {
  const router = useRouter();
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
    { dataField: 'rowNo', caption: '#', width: 60, alignment: 'center', allowSorting: false },
    { dataField: 'quotationNumber', caption: 'เลขที่', width: 160 },
    { dataField: 'customerName', caption: 'ลูกค้า', minWidth: 200 },
    { dataField: 'quotationDate', caption: 'วันที่', width: 120 },
    { dataField: 'validUntil', caption: 'ใช้ได้ถึง', width: 120 },
    {
      dataField: 'totalAmount',
      caption: 'ยอดรวม',
      width: 150,
      alignment: 'right',
      cellRender: (c) => (
        <span className="tabular-nums font-medium">
          {formatNumber(Number(c.data.totalAmount))} บาท
        </span>
      ),
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 120,
      cellRender: (c) => {
        const meta = STATUS_META[c.data.status as QuotationStatus] ?? {
          label: String(c.data.status),
          variant: 'default' as const,
        };
        return (
          <Badge variant={meta.variant} className="whitespace-nowrap">
            {meta.label}
          </Badge>
        );
      },
    },
    {
      dataField: 'actions',
      caption: '',
      width: 90,
      cellRender: (c) => (
        <DxButton
          icon="find"
          text="ดู"
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
          title="ใบเสนอราคา"
          subtitle="รายการใบเสนอราคาทั้งหมด พร้อมสถานะและการแปลงเป็นใบสั่งขาย"
          icon={FileText}
          iconBgColor="bg-amber-100"
          iconColor="text-amber-600"
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <DxButton icon="refresh" text="รีเฟรช" stylingMode="outlined" onClick={fetchData} />
              <DxButton
                icon="plus"
                text="สร้างใบเสนอราคา"
                type="success"
                onClick={() => router.push('/sales/quotations/new')}
                elementAttr={{ 'data-testid': 'btn-new-quotation' }}
              />
            </div>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <StatCard
            label="จำนวนทั้งหมด"
            value={formatNumber(stats.total)}
            icon={FileText}
            tone="blue"
            isLoading={isLoading}
          />
          <StatCard
            label="มูลค่ารวม (บาท)"
            value={formatNumber(stats.totalValue)}
            icon={DollarSign}
            tone="emerald"
            isLoading={isLoading}
          />
          <StatCard
            label="แปลงเป็นใบสั่งขายแล้ว"
            value={formatNumber(stats.converted)}
            icon={ArrowRightLeft}
            tone="violet"
            isLoading={isLoading}
          />
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">ค้นหา</label>
              <DxTextBox
                value={search}
                onValueChange={setSearch}
                placeholder="เลขที่ / ลูกค้า"
                mode="search"
                labelMode="hidden"
                showClearButton
                width={240}
                elementAttr={{ 'data-testid': 'quotation-search-input' }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">สถานะ</label>
              <DxSelectBox
                value={statusFilter}
                onValueChange={setStatusFilter}
                items={STATUS_FILTER_OPTIONS}
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
              onRowClick={(e: { data?: QuotationRow }) => {
                if (e.data?.id) router.push(`/sales/quotations/${e.data.id}`);
              }}
              noDataText="ยังไม่มีใบเสนอราคา"
              elementAttr={{ 'data-testid': 'quotations-grid' }}
            />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

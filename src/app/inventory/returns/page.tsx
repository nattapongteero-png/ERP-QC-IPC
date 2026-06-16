'use client';

/**
 * Material Returns Inbox (Phase 4)
 *
 * Warehouse-facing list of all material returns submitted by Production.
 * Default filter: status='submitted' so the staff land on the queue that
 * needs action. Click "View" to navigate to the detail/approval page.
 *
 * Layout follows /inventory/transactions: ResponsivePageHeader, KPI strip,
 * filter row, DataGrid. No mobile card list yet — Phase 4 is desktop-first
 * per the spec; the filter row stacks on mobile.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatNumber } from '@/lib/utils/number-format';
import {
  ArrowDownToLine,
  Inbox,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

interface ReturnRow {
  id: number;
  returnNumber: string;
  workOrderId: number | null;
  woNumber: string | null;
  receivingWarehouseId: number;
  warehouseName: string | null;
  status: string;
  returnDate: string;
  returnedBy: number;
  returnedByName: string | null;
  approvedBy: number | null;
  approvedAt: string | null;
  notes: string | null;
  lineCount: number;
  totalReturnQty: number;
}

interface WarehouseOption {
  id: number;
  code: string;
  name: string;
}

const STATUS_OPTIONS = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'submitted', label: 'รออนุมัติ (Submitted)' },
  { value: 'received', label: 'อนุมัติแล้ว (Received)' },
  { value: 'rejected', label: 'ปฏิเสธ (Rejected)' },
];

function formatDateTh(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateStr);
  }
}

function statusBadge(status: string) {
  switch (status) {
    case 'submitted':
      return { variant: 'warning' as const, label: 'Submitted', icon: <Clock className="h-3 w-3" /> };
    case 'received':
      return { variant: 'success' as const, label: 'Received', icon: <CheckCircle2 className="h-3 w-3" /> };
    case 'rejected':
      return { variant: 'danger' as const, label: 'Rejected', icon: <XCircle className="h-3 w-3" /> };
    default:
      return { variant: 'default' as const, label: status, icon: null };
  }
}

export default function MaterialReturnsInboxPage() {
  const router = useRouter();
  const toast = useToast();

  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);

  // Filters — default to "submitted" so the page lands on the action queue.
  const [statusFilter, setStatusFilter] = useState<string>('submitted');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '200');
      if (statusFilter) params.set('status', statusFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (warehouseFilter) params.set('warehouseId', warehouseFilter);
      const res = await fetch(`/api/inventory/returns?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRows(data.data?.items || []);
      } else {
        setRows([]);
        toast.error('โหลดข้อมูลไม่สำเร็จ', data.error || 'Unknown error');
      }
    } catch (e) {
      setRows([]);
      toast.error('โหลดข้อมูลไม่สำเร็จ', e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFrom, dateTo, warehouseFilter, toast]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  // Fetch warehouses once for the filter dropdown.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/warehouses?limit=100');
        const data = await res.json();
        if (data.success) {
          const items = data.data?.items || data.data || [];
          setWarehouses(items);
        }
      } catch {
        // Ignore — filter just stays empty.
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.returnNumber?.toLowerCase().includes(q) ||
        r.woNumber?.toLowerCase().includes(q) ||
        r.warehouseName?.toLowerCase().includes(q) ||
        r.returnedByName?.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const submitted = rows.filter((r) => r.status === 'submitted').length;
    const received = rows.filter((r) => r.status === 'received').length;
    const rejected = rows.filter((r) => r.status === 'rejected').length;
    const totalQty = rows.reduce((sum, r) => sum + Number(r.totalReturnQty || 0), 0);
    return { submitted, received, rejected, totalQty };
  }, [rows]);

  const columns: DxDataGridColumn[] = [
    {
      dataField: 'returnNumber',
      caption: 'RET #',
      width: 180,
      cellRender: (cell) => (
        <span className="font-mono font-semibold text-gray-900">{cell.data.returnNumber}</span>
      ),
    },
    {
      dataField: 'returnDate',
      caption: 'วันที่คืน',
      width: 160,
      cellRender: (cell) => <span className="text-sm">{formatDateTh(cell.data.returnDate)}</span>,
    },
    {
      dataField: 'woNumber',
      caption: 'WO #',
      width: 140,
      cellRender: (cell) =>
        cell.data.woNumber ? (
          <span className="font-mono text-sm text-emerald-600">{cell.data.woNumber}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      dataField: 'warehouseName',
      caption: 'คลังรับ',
      minWidth: 160,
      cellRender: (cell) => (
        <span className="text-sm">{cell.data.warehouseName || '—'}</span>
      ),
    },
    {
      dataField: 'lineCount',
      caption: 'รายการ',
      width: 80,
      alignment: 'center',
    },
    {
      dataField: 'totalReturnQty',
      caption: 'จำนวนรวม',
      width: 130,
      alignment: 'right',
      cellRender: (cell) => (
        <span className="font-medium">
          {formatNumber(cell.data.totalReturnQty || 0)}
        </span>
      ),
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 130,
      cellRender: (cell) => {
        const s = statusBadge(cell.data.status);
        return (
          <Badge variant={s.variant}>
            <span className="inline-flex items-center gap-1">
              {s.icon}
              {s.label}
            </span>
          </Badge>
        );
      },
    },
    {
      dataField: 'returnedByName',
      caption: 'ผู้คืน',
      minWidth: 140,
      hideOnMobile: true,
    },
    {
      dataField: '_actions',
      caption: 'การกระทำ',
      width: 110,
      alignment: 'center',
      allowFiltering: false,
      allowSorting: false,
      cellRender: (cell) => (
        <DxButton
          text="View"
          stylingMode="outlined"
          type="default"
          onClick={() => router.push(`/inventory/returns/${cell.data.id}`)}
        />
      ),
    },
  ];

  const warehouseSelectItems = [
    { value: '', label: 'ทุกคลัง' },
    ...warehouses.map((w) => ({ value: String(w.id), label: `${w.code} — ${w.name}` })),
  ];

  return (
    <MainLayout>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
        <ResponsivePageHeader
          title="Material Returns Inbox"
          subtitle="คืนวัตถุดิบจากการผลิต — รออนุมัติ/รับเข้า"
          icon={ArrowDownToLine}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
          breadcrumbs={[
            { label: 'Inventory', href: '/inventory' },
            { label: 'Returns' },
          ]}
          actions={
            <DxButton
              icon="refresh"
              text="Refresh"
              stylingMode="outlined"
              onClick={fetchReturns}
            />
          }
        />

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            label="รออนุมัติ"
            value={stats.submitted}
            icon={Clock}
            iconColor="text-amber-500"
            accentColor="border-amber-500"
          />
          <StatCard
            label="อนุมัติแล้ว"
            value={stats.received}
            icon={CheckCircle2}
            iconColor="text-emerald-500"
            accentColor="border-emerald-500"
          />
          <StatCard
            label="ปฏิเสธ"
            value={stats.rejected}
            icon={XCircle}
            iconColor="text-red-500"
            accentColor="border-red-500"
          />
          <StatCard
            label="รวมจำนวน"
            value={formatNumber(stats.totalQty, 2)}
            icon={Inbox}
            iconColor="text-emerald-500"
            accentColor="border-emerald-500"
          />
        </div>

        {/* Filter row — stacks on mobile */}
        <div className="bg-white border border-emerald-100 rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] p-3 md:p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <DxTextBox
                placeholder="ค้นหา (RET#, WO#, คลัง, ผู้คืน)"
                value={search}
                onValueChange={setSearch}
                showClearButton
                mode="search"
              />
            </div>
            <DxSelectBox
              value={statusFilter}
              items={STATUS_OPTIONS}
              displayExpr="label"
              valueExpr="value"
              onValueChange={(v) => setStatusFilter(String(v ?? ''))}
              labelMode="hidden"
            />
            <DxSelectBox
              value={warehouseFilter}
              items={warehouseSelectItems}
              displayExpr="label"
              valueExpr="value"
              onValueChange={(v) => setWarehouseFilter(String(v ?? ''))}
              labelMode="hidden"
              searchEnabled
            />
            <div className="grid grid-cols-2 gap-2">
              <DxDateBox
                value={dateFrom}
                onValueChange={(v) => setDateFrom(v || '')}
                placeholder="จากวันที่"
              />
              <DxDateBox
                value={dateTo}
                onValueChange={(v) => setDateTo(v || '')}
                placeholder="ถึงวันที่"
              />
            </div>
          </div>
        </div>

        {/* Data grid */}
        <div className="bg-white border border-emerald-100 rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-gray-500">กำลังโหลด...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="h-16 w-16 rounded-2xl bg-purple-100 flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-purple-500" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                ไม่พบรายการคืนวัตถุดิบ
              </h3>
              <p className="text-sm text-gray-500 max-w-sm">
                {statusFilter === 'submitted'
                  ? 'ไม่มีรายการที่รอการอนุมัติในขณะนี้'
                  : 'ลองเปลี่ยนเงื่อนไขการค้นหาดู'}
              </p>
            </div>
          ) : (
            <DxDataGrid
              dataSource={filtered}
              keyExpr="id"
              columns={columns}
              sorting
              pageSize={20}
              height="auto"
              noDataText="ไม่พบข้อมูล"
              onRowClick={(e) => {
                if (e?.data?.id) {
                  router.push(`/inventory/returns/${e.data.id}`);
                }
              }}
            />
          )}
        </div>
      </div>
    </MainLayout>
  );
}

'use client';

/**
 * COA List Page (Phase 4)
 *
 * Lists all Certificate of Analysis documents with filters and KPI cards.
 * COA is generated from a released QC sample — operators get there from
 * /quality/qc-entry/[id] when sample.status === 'released'.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { Badge } from '@/components/ui/badge';
import {
  Award,
  CheckCircle2,
  Clock,
  Ban,
  Layers,
  AlertTriangle,
} from 'lucide-react';

interface CoaListRow {
  id: number;
  coaNumber: string;
  sampleId: number;
  productId: number;
  productCode: string | null;
  productName: string | null;
  lotNumber: string;
  customerId: number | null;
  customerName: string | null;
  issueDate: string;
  status: string;
  conclusion: string;
  createdAt: string;
}

const STATUS_OPTIONS = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'draft', label: 'ฉบับร่าง (Draft)' },
  { value: 'review', label: 'รอทบทวน (Review)' },
  { value: 'approved', label: 'อนุมัติ (Approved)' },
  { value: 'issued', label: 'ออกแล้ว (Issued)' },
  { value: 'superseded', label: 'แทนที่แล้ว (Superseded)' },
  { value: 'revoked', label: 'เพิกถอน (Revoked)' },
];

function formatDateTh(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(dateStr);
  }
}

function statusBadge(status: string): {
  variant: 'default' | 'success' | 'warning' | 'danger' | 'info';
  label: string;
} {
  switch (status) {
    case 'draft':
      return { variant: 'default', label: 'Draft' };
    case 'review':
      return { variant: 'warning', label: 'Review' };
    case 'approved':
      return { variant: 'info', label: 'Approved' };
    case 'issued':
      return { variant: 'success', label: 'Issued' };
    case 'superseded':
      return { variant: 'warning', label: 'Superseded' };
    case 'revoked':
      return { variant: 'danger', label: 'Revoked' };
    default:
      return { variant: 'default', label: status };
  }
}

function conclusionBadge(c: string) {
  if (c === 'complies') return <Badge variant="success">✓ Complies</Badge>;
  if (c === 'does_not_comply') return <Badge variant="danger">✗ Fails</Badge>;
  return <Badge variant="warning">Partial</Badge>;
}

export default function CoaListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CoaListRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const fetchCoa = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '200');
      if (statusFilter) params.set('status', statusFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await fetch(`/api/quality/coa?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRows(data.data?.items || []);
      } else {
        setRows([]);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchCoa();
  }, [fetchCoa]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.coaNumber?.toLowerCase().includes(q) ||
        r.lotNumber?.toLowerCase().includes(q) ||
        r.productName?.toLowerCase().includes(q) ||
        r.productCode?.toLowerCase().includes(q) ||
        r.customerName?.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const issuedToday = rows.filter(
      (r) => r.status === 'issued' && String(r.issueDate).slice(0, 10) === todayStr,
    ).length;
    const pendingReview = rows.filter(
      (r) => r.status === 'draft' || r.status === 'review',
    ).length;
    const superseded = rows.filter((r) => r.status === 'superseded').length;
    const revoked = rows.filter((r) => r.status === 'revoked').length;
    return { issuedToday, pendingReview, superseded, revoked };
  }, [rows]);

  const columns: DxDataGridColumn[] = [
    {
      dataField: 'coaNumber',
      caption: 'COA #',
      width: 180,
      cellRender: (cell) => (
        <span className="font-mono font-semibold text-gray-900">{cell.data.coaNumber}</span>
      ),
    },
    {
      dataField: 'issueDate',
      caption: 'วันที่ออก',
      width: 130,
      cellRender: (cell) => (
        <span className="text-sm">{formatDateTh(cell.data.issueDate)}</span>
      ),
    },
    {
      dataField: 'productName',
      caption: 'สินค้า',
      minWidth: 220,
      cellRender: (cell) => (
        <div>
          <p className="font-mono text-xs text-gray-500">{cell.data.productCode || '—'}</p>
          <p className="font-medium text-gray-900 truncate">{cell.data.productName || '—'}</p>
        </div>
      ),
    },
    {
      dataField: 'lotNumber',
      caption: 'Lot #',
      width: 140,
      cellRender: (cell) =>
        cell.data.lotNumber ? (
          <span className="font-mono text-sm">{cell.data.lotNumber}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      dataField: 'customerName',
      caption: 'ลูกค้า',
      minWidth: 160,
      hideOnMobile: true,
      cellRender: (cell) => (
        <span className="text-sm">{cell.data.customerName || '—'}</span>
      ),
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 130,
      cellRender: (cell) => {
        const s = statusBadge(cell.data.status);
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
    {
      dataField: 'conclusion',
      caption: 'ผลรวม',
      width: 130,
      alignment: 'center',
      cellRender: (cell) => conclusionBadge(cell.data.conclusion),
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
          onClick={() => router.push(`/quality/coa/${cell.data.id}`)}
        />
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
        <ResponsivePageHeader
          title="Certificate of Analysis"
          subtitle="ใบรับรองคุณภาพ — รายการ COA ทั้งหมดจากตัวอย่างที่ปล่อยใช้งานแล้ว"
          icon={Award}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-600"
          breadcrumbs={[
            { label: 'Quality', href: '/quality' },
            { label: 'COA' },
          ]}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <DxButton
                icon="refresh"
                text="Refresh"
                stylingMode="outlined"
                onClick={fetchCoa}
              />
              <DxButton
                icon="plus"
                text="ออก COA จากตัวอย่าง"
                type="default"
                onClick={() => router.push('/quality/qc-entry?status=released')}
              />
            </div>
          }
        />

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            label="ออกวันนี้"
            value={stats.issuedToday}
            icon={CheckCircle2}
            iconColor="text-emerald-500"
            accentColor="border-emerald-500"
          />
          <StatCard
            label="รอทบทวน/ร่าง"
            value={stats.pendingReview}
            icon={Clock}
            iconColor="text-amber-500"
            accentColor="border-amber-500"
          />
          <StatCard
            label="ถูกแทนที่"
            value={stats.superseded}
            icon={Layers}
            iconColor="text-orange-500"
            accentColor="border-orange-500"
          />
          <StatCard
            label="ถูกเพิกถอน"
            value={stats.revoked}
            icon={Ban}
            iconColor="text-red-500"
            accentColor="border-red-500"
          />
        </div>

        {/* Filter row */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 md:p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <DxTextBox
                placeholder="ค้นหา (COA#, Lot#, สินค้า, ลูกค้า)"
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
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-gray-500">กำลังโหลด...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-emerald-500" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                ยังไม่มี COA
              </h3>
              <p className="text-sm text-gray-500 max-w-sm mb-4">
                COA สร้างจากตัวอย่าง QC ที่ปล่อยใช้งาน — เปิดตัวอย่างแล้วกด &quot;Generate COA&quot;
              </p>
              <DxButton
                icon="plus"
                text="ดูตัวอย่างที่ปล่อยแล้ว"
                type="default"
                onClick={() => router.push('/quality/qc-entry?status=released')}
              />
            </div>
          ) : (
            <DxDataGrid
              dataSource={filtered}
              keyExpr="id"
              columns={columns}
              sorting
              filterRow
              headerFilter
              pageSize={20}
              height="auto"
              noDataText="ไม่พบข้อมูล"
            />
          )}
        </div>
      </div>
    </>
  );
}

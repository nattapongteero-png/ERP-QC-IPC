'use client';

/**
 * QC Entry — Sample List
 *
 * Standalone QC (LIMS-style) sample registration + lifecycle inbox.
 * Mirrors the layout used by /inventory/returns: ResponsivePageHeader + KPI
 * strip + filter row + DxDataGrid. Defaults the status filter to "all" so the
 * lab analyst sees every active sample. Filter row stacks on mobile.
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
import { useToast } from '@/hooks/use-toast';
import {
  TestTube,
  Clock,
  FlaskConical,
  CheckCircle2,
  Send,
  AlertTriangle,
} from 'lucide-react';

interface QcSampleRow {
  id: number;
  sampleNumber: string;
  sourceType: string;
  productId: number;
  productCode: string | null;
  productName: string | null;
  lotNumber: string | null;
  customerId: number | null;
  customerName: string | null;
  receivedDate: string;
  receivedBy: number;
  receivedByName: string | null;
  status: string;
  testCounts: {
    total: number;
    pending: number;
    pass: number;
    fail: number;
  };
}

/** GRN line awaiting checklist sign (no qc_sample yet) — from pending-qa API. */
interface PendingTaskRow {
  grnId: number;
  grnNumber: string;
  lineId: number;
  itemCode: string;
  itemName: string;
  actualQuantity: number;
  expectedQuantity: number;
  unit: string;
  qcSampleId: number | null;
  qcSampleStatus: string | null;
  lineStatus: string;
  qcResult: 'pending' | 'passed' | 'failed';
  ageDays: number;
  vendorName: string | null;
}

const STATUS_OPTIONS = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'registered', label: 'ลงทะเบียน (Registered)' },
  { value: 'testing', label: 'กำลังทดสอบ (Testing)' },
  { value: 'reviewed', label: 'ทบทวนแล้ว (Reviewed)' },
  { value: 'approved', label: 'อนุมัติ (Approved)' },
  { value: 'released', label: 'ปล่อยใช้งาน (Released)' },
  { value: 'rejected', label: 'ปฏิเสธ (Rejected)' },
  { value: 'quarantine', label: 'กักกัน (Quarantine)' },
  { value: 'oos', label: 'OOS' },
];

const SOURCE_OPTIONS = [
  { value: '', label: 'ทุกแหล่งที่มา' },
  { value: 'raw_material_lot', label: 'วัตถุดิบเข้า' },
  { value: 'work_order_batch', label: 'ใบสั่งผลิต' },
  { value: 'customer_return', label: 'คืนจากลูกค้า' },
  { value: 'stability', label: 'Stability study' },
  { value: 'purchased_herb', label: 'ซื้อสมุนไพรจาก supplier' },
  { value: 'outgoing_shipment', label: 'ส่งออกให้ลูกค้า (COA)' },
  { value: 'other', label: 'อื่นๆ' },
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
    case 'registered':
      return { variant: 'info', label: 'ลงทะเบียน' };
    case 'testing':
      return { variant: 'warning', label: 'กำลังทดสอบ' };
    case 'reviewed':
      return { variant: 'info', label: 'ทบทวนแล้ว' };
    case 'approved':
      return { variant: 'success', label: 'อนุมัติ' };
    case 'released':
      return { variant: 'success', label: 'ปล่อยใช้งาน' };
    case 'rejected':
      return { variant: 'danger', label: 'ปฏิเสธ' };
    case 'quarantine':
      return { variant: 'warning', label: 'กักกัน' };
    case 'oos':
      return { variant: 'danger', label: 'OOS' };
    default:
      return { variant: 'default', label: status };
  }
}

export default function QcEntryListPage() {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<QcSampleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Pending registration worklist — GRN lines received but whose checklist is
  // not yet signed (lineStatus 'created' → no qc_sample exists yet). Signing
  // the checklist on the GRN auto-creates the sample, so we link there.
  const [pendingTasks, setPendingTasks] = useState<PendingTaskRow[]>([]);

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const fetchSamples = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '200');
      if (statusFilter) params.set('status', statusFilter);
      if (sourceFilter) params.set('sourceType', sourceFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await fetch(`/api/quality/qc-samples?${params.toString()}`);
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
  }, [statusFilter, sourceFilter, dateFrom, dateTo]);

  const fetchPendingTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/quality/incoming-inspection/pending-qa');
      if (!res.ok) {
        setPendingTasks([]);
        return;
      }
      const data = await res.json();
      const items = (data?.items || []) as PendingTaskRow[];
      // Only lines still awaiting checklist sign (no sample registered yet).
      setPendingTasks(items.filter((i) => i.lineStatus === 'created'));
    } catch {
      setPendingTasks([]);
    }
  }, []);

  useEffect(() => {
    fetchSamples();
  }, [fetchSamples]);

  useEffect(() => {
    fetchPendingTasks();
  }, [fetchPendingTasks]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.sampleNumber?.toLowerCase().includes(q) ||
        r.lotNumber?.toLowerCase().includes(q) ||
        r.productName?.toLowerCase().includes(q) ||
        r.productCode?.toLowerCase().includes(q) ||
        r.customerName?.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const registered = rows.filter((r) => r.status === 'registered').length;
    const testing = rows.filter((r) => r.status === 'testing').length;
    const reviewed = rows.filter((r) => r.status === 'reviewed').length;
    const releasedToday = rows.filter(
      (r) => r.status === 'released' && String(r.receivedDate).slice(0, 10) === todayStr,
    ).length;
    return { registered, testing, reviewed, releasedToday };
  }, [rows]);

  const columns: DxDataGridColumn[] = [
    {
      caption: 'ลำดับ',
      width: 60,
      alignment: 'center',
      allowFiltering: false,
      allowSorting: false,
      cellRender: (cell) => (
        <span className="text-sm text-gray-500">{(cell.rowIndex ?? 0) + 1}</span>
      ),
    },
    {
      dataField: 'sampleNumber',
      caption: 'เลขที่ตัวอย่าง',
      width: 170,
      cellRender: (cell) => (
        <span className="font-mono font-semibold text-gray-900">{cell.data.sampleNumber}</span>
      ),
    },
    {
      dataField: 'receivedDate',
      caption: 'วันที่รับ',
      width: 130,
      cellRender: (cell) => <span className="text-sm">{formatDateTh(cell.data.receivedDate)}</span>,
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
      caption: 'เลขที่ล็อต',
      width: 140,
      cellRender: (cell) =>
        cell.data.lotNumber ? (
          <span className="font-mono text-sm">{cell.data.lotNumber}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      dataField: 'sourceType',
      caption: 'แหล่งที่มา',
      width: 150,
      hideOnMobile: true,
      cellRender: (cell) => {
        const opt = SOURCE_OPTIONS.find((o) => o.value === cell.data.sourceType);
        return <span className="text-xs">{opt?.label || cell.data.sourceType}</span>;
      },
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
      dataField: 'testCounts',
      caption: 'การทดสอบ',
      width: 130,
      alignment: 'center',
      cellRender: (cell) => {
        const c = cell.data.testCounts || { total: 0, pending: 0, pass: 0, fail: 0 };
        const done = c.pass + c.fail;
        return (
          <div className="text-xs">
            <span className="font-semibold text-gray-800">
              {done}/{c.total}
            </span>
            {c.fail > 0 && (
              <span className="ml-2 text-red-600 font-medium">{c.fail} ไม่ผ่าน</span>
            )}
            {c.pending > 0 && (
              <span className="ml-2 text-amber-600">{c.pending} รอ</span>
            )}
          </div>
        );
      },
    },
    {
      dataField: 'receivedByName',
      caption: 'ผู้รับ',
      minWidth: 130,
      hideOnMobile: true,
    },
    {
      dataField: '_actions',
      caption: 'การกระทำ',
      width: 160,
      alignment: 'center',
      allowFiltering: false,
      allowSorting: false,
      cellRender: (cell) => {
        const sampleId = cell.data.id as number;
        const sampleNumber = cell.data.sampleNumber as string;
        // The service refuses to delete samples that have results recorded
        // (and post-release records are immutable). The button is always
        // visible so the user can SEE what's blocking — server returns the
        // reason in the toast.
        return (
          <div className="flex justify-center gap-1">
            <DxButton
              text="ดู"
              stylingMode="outlined"
              type="default"
              onClick={() => router.push(`/quality/qc-entry/${sampleId}`)}
              disabled={deletingId === sampleId}
            />
            <DxButton
              icon="trash"
              type="danger"
              stylingMode="text"
              hint="ลบรายการนี้"
              onClick={async (e) => {
                // Stop the row click handler from also navigating to detail.
                if (e?.event) e.event.stopPropagation();
                if (!confirm(`ลบ ${sampleNumber} ใช่หรือไม่?`)) return;
                setDeletingId(sampleId);
                try {
                  const res = await fetch(
                    `/api/quality/qc-samples/${sampleId}`,
                    { method: 'DELETE' },
                  );
                  const data = await res.json();
                  if (data.success) {
                    toast.success('ลบแล้ว', sampleNumber);
                    await fetchSamples();
                  } else {
                    toast.error('ลบไม่สำเร็จ', data.error || 'Unknown error');
                  }
                } catch (err) {
                  toast.error(
                    'ลบไม่สำเร็จ',
                    err instanceof Error ? err.message : 'Network error',
                  );
                } finally {
                  setDeletingId(null);
                }
              }}
              disabled={deletingId != null}
            />
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
        <ResponsivePageHeader
          title="QC Entry"
          subtitle="บันทึก QC — ลงทะเบียนตัวอย่างและบันทึกผลการทดสอบ"
          icon={TestTube}
          iconBgColor="bg-cyan-100"
          iconColor="text-cyan-600"
          breadcrumbs={[
            { label: 'คุณภาพ', href: '/quality' },
            { label: 'QC Entry' },
          ]}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <DxButton
                icon="refresh"
                text="รีเฟรช"
                stylingMode="outlined"
                onClick={() => {
                  void fetchSamples();
                  void fetchPendingTasks();
                }}
              />
              <DxButton
                icon="preferences"
                text="กำหนด Test Panels"
                stylingMode="outlined"
                onClick={() => router.push('/quality/test-panels')}
              />
              {/* Single registration entry point — the full form at /new covers
                  the sample-requisition fields (sample size, buffer, retain,
                  auto-derive from lot). PO/WO sources arrive via the
                  pending-registration panel above; the form handles the
                  manual sources (returns, stability, COA, etc.). */}
              <DxButton
                icon="plus"
                text="ลงทะเบียนตัวอย่างใหม่"
                type="default"
                onClick={() => router.push('/quality/qc-entry/new')}
                data-testid="qc-entry-register-new"
              />
            </div>
          }
        />

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            label="ลงทะเบียน (รอทดสอบ)"
            value={stats.registered}
            icon={Clock}
            iconColor="text-blue-500"
            accentColor="border-blue-500"
          />
          <StatCard
            label="กำลังทดสอบ"
            value={stats.testing}
            icon={FlaskConical}
            iconColor="text-amber-500"
            accentColor="border-amber-500"
          />
          <StatCard
            label="ทบทวนแล้ว"
            value={stats.reviewed}
            icon={CheckCircle2}
            iconColor="text-emerald-500"
            accentColor="border-emerald-500"
          />
          <StatCard
            label="ปล่อยใช้งานวันนี้"
            value={stats.releasedToday}
            icon={Send}
            iconColor="text-cyan-500"
            accentColor="border-cyan-500"
          />
        </div>

        {/* Pending registration — GRN lines received but not yet checklist-signed.
            Signing the checklist on the GRN auto-registers the QC sample. */}
        {pendingTasks.length > 0 && (
          <div
            className="bg-amber-50 border border-amber-200 rounded-xl shadow-sm p-3 md:p-4"
            data-testid="pending-registration-panel"
          >
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-amber-900">
                รอลงทะเบียน QC ({pendingTasks.length})
              </h2>
              <span className="text-xs text-amber-700">
                — รายการรับเข้าที่รอเซ็นใบตรวจรับ ระบบจะลงทะเบียนตัวอย่างให้อัตโนมัติเมื่อเซ็น checklist
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {pendingTasks.map((task) => (
                <button
                  key={task.lineId}
                  type="button"
                  onClick={() => router.push(`/inventory/goods-receipt/${task.grnId}`)}
                  className="text-left bg-white border border-amber-200 rounded-lg p-3 hover:border-amber-400 hover:shadow-sm transition"
                  data-testid={`pending-task-${task.lineId}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-gray-500">{task.grnNumber}</span>
                    {task.ageDays > 0 && (
                      <span className="text-[11px] text-amber-700">{task.ageDays} วัน</span>
                    )}
                  </div>
                  <p className="font-medium text-gray-900 truncate mt-0.5">
                    {task.itemName || task.itemCode}
                  </p>
                  <p className="text-xs text-gray-500">
                    {task.itemCode} · {Number(task.actualQuantity || task.expectedQuantity || 0).toLocaleString()} {task.unit}
                    {task.vendorName ? ` · ${task.vendorName}` : ''}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filter row */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 md:p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <DxTextBox
                placeholder="ค้นหา (Sample#, Lot#, สินค้า, ลูกค้า)"
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
              value={sourceFilter}
              items={SOURCE_OPTIONS}
              displayExpr="label"
              valueExpr="value"
              onValueChange={(v) => setSourceFilter(String(v ?? ''))}
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
              <div className="h-16 w-16 rounded-2xl bg-cyan-100 flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-cyan-500" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                ไม่พบตัวอย่าง QC
              </h3>
              <p className="text-sm text-gray-500 max-w-sm mb-4">
                ลองเปลี่ยนเงื่อนไขการค้นหา หรือลงทะเบียนตัวอย่างใหม่
              </p>
              <DxButton
                icon="plus"
                text="ลงทะเบียนตัวอย่างใหม่"
                type="default"
                onClick={() => router.push('/quality/qc-entry/new')}
              />
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
                  router.push(`/quality/qc-entry/${e.data.id}`);
                }
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}

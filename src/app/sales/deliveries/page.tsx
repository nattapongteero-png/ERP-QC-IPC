'use client';

/**
 * Delivery notes register (ทะเบียนใบส่งของ).
 *
 * The rows always existed — every fulfilment writes one — but there was no
 * screen, so nobody could answer "what shipped this week" or spot that stock
 * had gone out from an expired lot. That second one is a GMP failure, so it
 * gets a banner rather than a column someone has to notice.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { formatNumber } from '@/lib/utils/number-format';
import { Truck, FileText, ShoppingBag, AlertTriangle, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  DeliveryNotePrintDocument,
  type DeliveryNotePrintData,
} from '@/components/sales/DeliveryNotePrintDocument';

interface DeliveryRow extends Record<string, unknown> {
  id: number;
  deliveryNumber: string;
  deliveryDate: string | null;
  status: string;
  soId: number;
  soNumber: string | null;
  customerName: string | null;
  itemCode: string | null;
  itemName: string | null;
  lotNumber: string;
  expiryDate: string | null;
  quantity: number;
  unit: string;
}

interface Report {
  summary: {
    lines: number;
    documents: number;
    orders: number;
    expiredLines: number;
    expiringSoonLines: number;
  };
  rows: DeliveryRow[];
}

/** Days from today until `date`; null when there is no usable date. */
function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const due = new Date(date);
  if (isNaN(due.getTime())) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((startOfDay(due).getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
}

const STATUS_LABEL: Record<string, string> = {
  shipped: 'จัดส่งแล้ว',
  delivered: 'ส่งมอบแล้ว',
  returned: 'ตีกลับ',
};

export default function DeliveriesPage() {
  const router = useRouter();
  const [data, setData] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  /** The note currently staged for printing (hidden until window.print runs). */
  const [printNote, setPrintNote] = useState<DeliveryNotePrintData | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const p = new URLSearchParams();
      if (dateFrom) p.append('dateFrom', dateFrom);
      if (dateTo) p.append('dateTo', dateTo);
      const res = await fetch(`/api/sales/deliveries?${p}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (e) {
      console.error('Failed to fetch deliveries:', e);
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Fetch the whole note (all its lots) and print it.
   *
   * The grid row is one LINE; a note can cover several lots, so printing from
   * the row alone would hand the customer paperwork that omits half the goods.
   */
  const handlePrint = useCallback(async (deliveryNumber: string) => {
    try {
      const res = await fetch(`/api/sales/deliveries/${encodeURIComponent(deliveryNumber)}`);
      const json = await res.json();
      if (!json.success) return;

      setPrintNote(json.data);
      // Let React paint the hidden document before handing off to the browser.
      requestAnimationFrame(() => {
        window.print();
        setPrintNote(null);
      });
    } catch (e) {
      console.error('Failed to load delivery note for printing:', e);
    }
  }, []);

  const handleExport = () => {
    if (!data) return;
    const rows = data.rows.map((r, i) => ({
      '#': i + 1,
      'เลขที่ใบส่งของ': r.deliveryNumber,
      'วันที่ส่ง': r.deliveryDate ?? '',
      'เลขที่ใบขาย': r.soNumber ?? '',
      'ลูกค้า': r.customerName ?? '',
      'รหัสสินค้า': r.itemCode ?? '',
      'ชื่อสินค้า': r.itemName ?? '',
      'เลข Lot': r.lotNumber,
      'วันหมดอายุ': r.expiryDate ?? '',
      'จำนวน': r.quantity,
      'หน่วย': r.unit,
      'สถานะ': STATUS_LABEL[r.status] ?? r.status,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 5 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 28 },
      { wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 10 },
      { wch: 8 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'ทะเบียนใบส่งของ');
    XLSX.writeFile(wb, `delivery-notes-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const columns: DxDataGridColumn[] = [
    { dataField: 'deliveryNumber', caption: 'เลขที่ใบส่งของ', width: 150 },
    { dataField: 'deliveryDate', caption: 'วันที่ส่ง', width: 110 },
    { dataField: 'soNumber', caption: 'เลขที่ใบขาย', width: 150 },
    { dataField: 'customerName', caption: 'ลูกค้า', minWidth: 180 },
    {
      dataField: 'itemCode',
      caption: 'สินค้า',
      minWidth: 200,
      cellRender: (c) => (
        <div>
          <p className="font-medium">{String(c.data.itemCode ?? '')}</p>
          <p className="text-sm text-gray-500">{String(c.data.itemName ?? '')}</p>
        </div>
      ),
    },
    { dataField: 'lotNumber', caption: 'เลข Lot', width: 150 },
    {
      dataField: 'expiryDate',
      caption: 'วันหมดอายุ',
      // 130px had to hold "2026-04-04 (หมดอายุ)" on one line, so the date was
      // clipped to "Tue Apr 04 (..." — the very thing this column exists to
      // make unmissable. Wider, and the badge wraps under the date.
      width: 165,
      // An expired lot must be impossible to miss: colour the date itself
      // rather than hoping someone cross-checks it against today.
      cellRender: (c) => {
        const exp = c.data.expiryDate as string | null;
        if (!exp) return <span className="text-gray-400">-</span>;
        const days = daysUntil(exp);
        const tone =
          days === null ? '' :
          days < 0 ? 'bg-rose-50 text-rose-700 font-semibold' :
          days <= 30 ? 'bg-amber-50 text-amber-700 font-medium' : '';
        return (
          <span className={`px-2 py-0.5 rounded ${tone}`}>
            {exp}
            {days !== null && days < 0 && ' (หมดอายุ)'}
          </span>
        );
      },
    },
    {
      dataField: 'quantity',
      caption: 'จำนวน',
      width: 110,
      cellRender: (c) => (
        <span className="tabular-nums">
          {formatNumber(Number(c.data.quantity))} {String(c.data.unit ?? '')}
        </span>
      ),
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 120,
      cellRender: (c) => {
        const s = String(c.data.status);
        return (
          <Badge variant={s === 'returned' ? 'danger' : 'success'} className="whitespace-nowrap">
            {STATUS_LABEL[s] ?? s}
          </Badge>
        );
      },
    },
    {
      dataField: 'actions',
      caption: '',
      width: 100,
      cellRender: (c) => (
        <DxButton
          icon="print"
          text="พิมพ์"
          stylingMode="text"
          // stopPropagation: the row click opens the sales order, and printing
          // must not drag the user off the register.
          onClick={(e: { event?: { stopPropagation: () => void } }) => {
            e.event?.stopPropagation();
            handlePrint(String(c.data.deliveryNumber));
          }}
          elementAttr={{ 'data-testid': `btn-print-${c.data.deliveryNumber}` }}
        />
      ),
    },
  ];

  const s = data?.summary;

  return (
    <MainLayout>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
        <ResponsivePageHeader
          title="ทะเบียนใบส่งของ"
          subtitle="รายการจัดส่งทั้งหมด พร้อมเลข Lot และวันหมดอายุ"
          icon={Truck}
          iconBgColor="bg-cyan-100"
          iconColor="text-cyan-600"
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <DxButton icon="refresh" text="รีเฟรช" stylingMode="outlined" onClick={fetchData} />
              <DxButton
                icon="xlsxfile"
                text="ส่งออก Excel"
                stylingMode="outlined"
                onClick={handleExport}
                disabled={!data || data.rows.length === 0}
                elementAttr={{ 'data-testid': 'btn-export-deliveries' }}
              />
            </div>
          }
        />

        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">ตั้งแต่วันที่</label>
              <DxDateBox
                value={dateFrom || undefined}
                onValueChange={(v: unknown) => setDateFrom(v ? String(v).slice(0, 10) : '')}
                displayFormat="yyyy-MM-dd"
                width={170}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">ถึงวันที่</label>
              <DxDateBox
                value={dateTo || undefined}
                onValueChange={(v: unknown) => setDateTo(v ? String(v).slice(0, 10) : '')}
                displayFormat="yyyy-MM-dd"
                width={170}
              />
            </div>
            {(dateFrom || dateTo) && (
              <DxButton
                text="ล้างตัวกรอง"
                stylingMode="text"
                onClick={() => { setDateFrom(''); setDateTo(''); }}
              />
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            label="ใบส่งของ"
            value={formatNumber(s?.documents ?? 0)}
            icon={FileText}
            tone="blue"
            isLoading={isLoading}
          />
          <StatCard
            label="รายการจัดส่ง"
            value={formatNumber(s?.lines ?? 0)}
            icon={Truck}
            tone="emerald"
            isLoading={isLoading}
          />
          <StatCard
            label="ใบขายที่ส่งแล้ว"
            value={formatNumber(s?.orders ?? 0)}
            icon={ShoppingBag}
            tone="violet"
            isLoading={isLoading}
          />
          <StatCard
            label="ใกล้หมดอายุ (30 วัน)"
            value={formatNumber(s?.expiringSoonLines ?? 0)}
            icon={Clock}
            tone="amber"
            isLoading={isLoading}
          />
        </div>

        {/* Stock shipped from an expired lot is a GMP failure, not a number on
            a card — it gets a banner so it cannot be scrolled past. */}
        {s && s.expiredLines > 0 && (
          <div
            className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            data-testid="expired-lot-warning"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <b>พบการจัดส่งจากล็อตที่หมดอายุแล้ว {formatNumber(s.expiredLines)} รายการ</b>
              {' '}— ตรวจสอบทันที (ดูวันหมดอายุสีแดงในตาราง)
            </span>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <DxDataGrid
              dataSource={(data?.rows ?? []) as Record<string, unknown>[]}
              columns={columns}
              keyExpr="id"
              pageSize={20}
              sorting
              responsiveColumns
              onRowClick={(e: { data?: DeliveryRow }) => {
                // The delivery lives on its sales order — that is where the
                // full picture (and the fulfilment actions) are.
                if (e.data?.soId) router.push(`/sales/orders/${e.data.soId}`);
              }}
              noDataText="ไม่มีรายการจัดส่งในช่วงเวลาที่เลือก"
            />
          </CardContent>
        </Card>
      </div>

      {/* Hidden on screen; the global @media print rules reveal .print-only. */}
      {printNote && <DeliveryNotePrintDocument note={printNote} />}
    </MainLayout>
  );
}

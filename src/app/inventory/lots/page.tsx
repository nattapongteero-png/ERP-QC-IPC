'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { PageHeader } from '@/components/ui/page-header';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  CheckCircle, XCircle, Clock, AlertTriangle,
  Package, ArrowRight, BoxSelect, ChevronRight, Inbox,
  Boxes, TrendingUp, CalendarClock, Warehouse,
  DollarSign, RefreshCw, Plus, RefreshCcw,
  Download, Upload, X, ClipboardList,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ItemSearchDialog, type Item as SearchItem } from '@/components/ui/item-search-dialog';
import type { DataGridTypes } from 'devextreme-react/data-grid';
import { toast } from 'sonner';
import { calculateIssuance, type UnitConfig } from '@/lib/utils/unit-conversion';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/number-format';
import { useRealtimeTopic } from '@/hooks/use-realtime-topic';

/** Get today's date as YYYY-MM-DD using local timezone (avoids UTC shift from toISOString) */
function getLocalDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Lot {
  id: number;
  lotNumber: string;
  itemId: number;
  itemCode?: string;
  itemName?: string;
  itemType?: string;
  warehouseId: number;
  warehouseName?: string;
  quantity: number;
  reservedQuantity: number;
  unit: string;
  status: string;
  manufacturingDate: string | null;
  expiryDate: string | null;
  receivedDate: string | null;
  vendorLotNumber: string | null;
  vendorId: number | null;
  vendorName?: string;
  cost: number | null;
  // Returned by /api/inventory/lots and rendered by the grid, but previously
  // absent from this interface — the grid reaches them through DevExtreme's
  // untyped cellInfo.data, so nothing type-checked them.
  manufacturerName?: string | null;
  retestDate?: string | null;
}

/** Days a lot has sat since it was received. Null when there is no received date. */
function getAgingDays(receivedDate: string | null): number | null {
  if (!receivedDate) return null;
  const received = new Date(receivedDate);
  if (isNaN(received.getTime())) return null;
  return Math.floor((Date.now() - received.getTime()) / (1000 * 60 * 60 * 24));
}

// Item type labels
const ITEM_TYPE_LABELS: Record<string, string> = {
  raw_material: 'วัตถุดิบ',
  finished_good: 'สินค้าสำเร็จรูป',
  finished_goods: 'สินค้าสำเร็จรูป',
  packaging: 'บรรจุภัณฑ์',
  consumable: 'วัสดุสิ้นเปลือง',
};

type QuickFilter = '' | 'near_expiry' | 'expired' | 'raw_material' | 'finished_goods';

interface LotFormData {
  lotNumber: string;
  itemId: number;
  warehouseId: number;
  quantity: number;
  unit: string;
  manufacturingDate: string;
  expiryDate: string;
  receivedDate: string;
  vendorLotNumber: string;
  vendorId: number | null;
  cost: number;
  notes: string;
  // Phase 4: GMP Compliance fields (FR-055, FR-056)
  manufacturerName: string;
  manufacturerId: number | null;
  importerName: string;
  importerId: number | null;
  countryOfOrigin: string;
  retestDate: string;
  retestIntervalMonths: number | null;
}

interface WarehouseData {
  id: number;
  name: string;
  code?: string;
}

interface Vendor {
  id: number;
  name: string;
  code?: string;
}

interface TraceLot {
  lotNumber: string;
  itemCode: string;
  quantity: number;
  unit: string;
  status: string;
}

interface TraceData {
  backward?: TraceLot[];
  forward?: TraceLot[];
}

type StatusType = '' | 'quarantine' | 'released' | 'rejected' | 'blocked';

const STATUS_CONFIG: Record<StatusType, {
  translationKey: string;
  // Soft colors used for the status chip inside the grid rows.
  bgColor: string;
  textColor: string;
  // Solid colors used when the pill is the active filter — strong fill + white
  // text so the selected tab reads clearly (matches the warehouses page).
  activeBg: string;
  activeText: string;
  icon: React.ReactNode;
}> = {
  '': {
    translationKey: 'all',
    bgColor: 'bg-gray-900',
    textColor: 'text-white',
    activeBg: 'bg-gradient-to-br from-[#064E3B] to-emerald-600',
    activeText: 'text-white',
    icon: <Boxes className="h-4 w-4" />,
  },
  quarantine: {
    translationKey: 'quarantine',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    activeBg: 'bg-amber-500',
    activeText: 'text-white',
    icon: <Clock className="h-4 w-4" />,
  },
  released: {
    translationKey: 'released',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    activeBg: 'bg-emerald-600',
    activeText: 'text-white',
    icon: <CheckCircle className="h-4 w-4" />,
  },
  rejected: {
    translationKey: 'rejected',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    activeBg: 'bg-red-600',
    activeText: 'text-white',
    icon: <XCircle className="h-4 w-4" />,
  },
  blocked: {
    translationKey: 'blocked',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
    activeBg: 'bg-slate-600',
    activeText: 'text-white',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
};

const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (status) {
    case 'released': return 'success';
    case 'quarantine': return 'warning';
    case 'rejected': return 'danger';
    case 'blocked': return 'danger';
    default: return 'default';
  }
};

const getDaysUntilExpiry = (expiryDate: string | null) => {
  if (!expiryDate) return null;
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const getExpiryVariant = (days: number | null): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  if (days === null) return 'default';
  if (days < 0) return 'danger';
  if (days <= 7) return 'danger';
  if (days <= 30) return 'warning';
  if (days <= 60) return 'info';
  return 'success';
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH');
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// Statuses that can pre-select the tab via ?status= in the URL (e.g. the
// dashboard "Lots in Quarantine" card → /inventory/lots?status=quarantine).
const LOT_STATUS_VALUES: StatusType[] = ['', 'quarantine', 'released', 'rejected', 'blocked'];

export default function LotsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('inventory');
  const [lots, setLots] = useState<Lot[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Seed the free-text search from ?search= so deep-links (e.g. from the
  // expiry-alerts page clicking a lot number) land pre-filtered on that lot.
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  // Seed the status tab from the URL so the dashboard deep-link lands on the
  // matching filtered view instead of staying on "All".
  const initialStatus = (() => {
    const s = (searchParams.get('status') || '').toLowerCase() as StatusType;
    return LOT_STATUS_VALUES.includes(s) ? s : '';
  })();
  const [statusFilter, setStatusFilter] = useState<StatusType>(initialStatus);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('');
  const [warehouseFilter, setWarehouseFilter] = useState<number | ''>('');
  const [expiryFrom, setExpiryFrom] = useState('');
  const [expiryTo, setExpiryTo] = useState('');
  const [receivedFrom, setReceivedFrom] = useState('');
  const [receivedTo, setReceivedTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importingLots, setImportingLots] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);
  const lotFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(d => {
      if (d.success && d.data?.user?.role?.toLowerCase() === 'admin') setIsAdmin(true);
    }).catch(() => {});
  }, []);

  const LOT_COLUMNS = [
    { header: 'เลข Lot (Lot Number)*', field: 'lotNumber', required: true },
    { header: 'รหัสสินค้า (Item Code)*', field: 'itemCode', required: true },
    { header: 'คลังสินค้า (Warehouse)*', field: 'warehouseName', required: true },
    { header: 'จำนวน (Quantity)*', field: 'quantity', required: true },
    { header: 'หน่วย (Unit)*', field: 'unit', required: true },
    { header: 'ราคาต่อหน่วย (Cost)', field: 'cost', required: false },
    { header: 'วันหมดอายุ (Expiry Date)', field: 'expiryDate', required: false, note: 'YYYY-MM-DD' },
    { header: 'วันผลิต (Mfg Date)', field: 'manufacturingDate', required: false, note: 'YYYY-MM-DD' },
    { header: 'วันรับเข้า (Received Date)', field: 'receivedDate', required: false, note: 'YYYY-MM-DD, ค่าเริ่มต้น=วันนี้' },
    { header: 'เลข Lot ผู้ขาย', field: 'vendorLotNumber', required: false },
    { header: 'เลข PO', field: 'poNumber', required: false },
    { header: 'เลข COA', field: 'coaNumber', required: false },
    { header: 'เลข Batch', field: 'batchNumber', required: false },
  ];

  // Export the lots the operator currently sees (post-filter) to xlsx.
  //
  // Columns mirror the on-screen register. The three the grid derives or shows
  // but the export used to omit — total value (qty x unit cost), aging days,
  // manufacturer and retest date — are included, so the file matches what is on
  // the screen instead of being a narrower, different table.
  const handleDownloadLots = () => {
    const rows = filteredLots.map((l, index) => {
      const qty = Number(l.quantity) || 0;
      const unitCost = Number(l.cost) || 0;

      return {
        '#': index + 1,
        'เลข Lot': l.lotNumber,
        'เลข Lot ผู้ขาย': l.vendorLotNumber || '',
        'วันรับเข้า': l.receivedDate || '',
        'อายุ (วัน)': getAgingDays(l.receivedDate) ?? '',
        'รหัสสินค้า': l.itemCode || '',
        'ชื่อสินค้า': l.itemName || '',
        'ประเภท': l.itemType || '',
        'จำนวน': qty,
        'คงค้าง (Reserved)': l.reservedQuantity,
        'หน่วย': l.unit,
        // Same derivation as the grid's "มูลค่า" column.
        'มูลค่ารวม (฿)': qty * unitCost,
        'ราคาต่อหน่วย (฿)': l.cost ?? '',
        'คลังสินค้า': l.warehouseName || '',
        'วันผลิต': l.manufacturingDate || '',
        'วันหมดอายุ': l.expiryDate || '',
        'ผู้ผลิต': l.manufacturerName || '',
        'วันตรวจซ้ำ (Retest)': l.retestDate || '',
        'ผู้ขาย': l.vendorName || '',
        'สถานะ': l.status,
      };
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 5 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 9 },
      { wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 10 }, { wch: 12 },
      { wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 12 },
      { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'ทะเบียน Lot');
    const ts = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `lots-${ts}.xlsx`);
  };

  const handleDownloadLotTemplate = () => {
    const wb = XLSX.utils.book_new();
    const instr = [
      ['Template นำเข้า Inventory Lots — Herbal Medicine ERP'],
      [''], ['ฟิลด์ที่มี * = บังคับ'],
      ['รหัสสินค้า = Code จากหน้า Items, คลังสินค้า = ชื่อคลัง'],
      ['วันที่ใช้รูปแบบ YYYY-MM-DD (เช่น 2026-12-31)'],
      ['Lot ใหม่จะอยู่สถานะ Quarantine อัตโนมัติ'],
      [''],
      ['คอลัมน์', 'บังคับ', 'หมายเหตุ'],
      ...LOT_COLUMNS.map(c => [c.header, c.required ? 'ใช่' : 'ไม่', c.note || '']),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instr), 'คำแนะนำ');

    const examples = [
      { 'เลข Lot (Lot Number)*': 'LOT-2026-001', 'รหัสสินค้า (Item Code)*': 'RM-0001', 'คลังสินค้า (Warehouse)*': 'Main Warehouse', 'จำนวน (Quantity)*': 500, 'หน่วย (Unit)*': 'kg', 'ราคาต่อหน่วย (Cost)': 120, 'วันหมดอายุ (Expiry Date)': '2028-06-30', 'วันผลิต (Mfg Date)': '2026-04-01', 'วันรับเข้า (Received Date)': '2026-04-10', 'เลข Lot ผู้ขาย': 'V-LOT-A001', 'เลข PO': 'PO-2026-0050', 'เลข COA': 'COA-2026-001', 'เลข Batch': 'BATCH-001' },
      { 'เลข Lot (Lot Number)*': 'LOT-2026-002', 'รหัสสินค้า (Item Code)*': 'RP-0001', 'คลังสินค้า (Warehouse)*': 'Main Warehouse', 'จำนวน (Quantity)*': 10000, 'หน่วย (Unit)*': 'pcs', 'ราคาต่อหน่วย (Cost)': 2.5, 'วันหมดอายุ (Expiry Date)': '', 'วันผลิต (Mfg Date)': '2026-03-15', 'วันรับเข้า (Received Date)': '2026-04-10', 'เลข Lot ผู้ขาย': 'V-LOT-B002', 'เลข PO': 'PO-2026-0051', 'เลข COA': '', 'เลข Batch': '' },
    ];
    // Use warehouses already loaded on the page
    const warehouseNames = warehouses.map(w => w.name).filter(Boolean);

    const ws = XLSX.utils.json_to_sheet(examples);
    ws['!cols'] = LOT_COLUMNS.map(() => ({ wch: 22 }));

    // Add data validation dropdown for "คลังสินค้า" column (column C, index 2)
    if (warehouseNames.length > 0) {
      const whList = warehouseNames.join(',');
      // Apply to rows 2-100 (row 1 = header)
      for (let r = 1; r <= 100; r++) {
        const cellRef = XLSX.utils.encode_cell({ r, c: 2 }); // Column C
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
        if (!ws['!dataValidation']) ws['!dataValidation'] = [];
        (ws['!dataValidation'] as unknown[]).push({
          sqref: cellRef,
          type: 'list',
          formula1: `"${whList}"`,
        });
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Lots');

    // Lookup sheet — warehouses + units reference
    const lookupRows: string[][] = [
      ['ตัวเลือก (Lookup Values)'],
      [''],
      ['คลังสินค้า (Warehouse) — ใช้ชื่อคลังตรงๆ ในช่อง "คลังสินค้า"'],
      ['ชื่อคลัง'],
      ...warehouseNames.map(n => [n]),
    ];

    lookupRows.push([''], ['หน่วย (Unit)'], ['ค่า', 'คำอธิบาย']);
    [['kg','กิโลกรัม'],['g','กรัม'],['mg','มิลลิกรัม'],['l','ลิตร'],['ml','มิลลิลิตร'],
     ['pcs','ชิ้น'],['pack','แพ็ค'],['box','กล่อง'],['bottle','ขวด'],['bag','ถุง'],
     ['roll','ม้วน'],['sheet','แผ่น'],['set','ชุด'],['carton','ลัง'],['drum','ถัง'],
     ['can','กระป๋อง'],['tube','หลอด'],['cap','ฝา']].forEach(u => lookupRows.push(u));

    const wsLookup = XLSX.utils.aoa_to_sheet(lookupRows);
    wsLookup['!cols'] = [{ wch: 40 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsLookup, 'ตัวเลือก (Lookup)');

    XLSX.writeFile(wb, 'Lot_Import_Template.xlsx');
  };

  const handleImportLots = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportingLots(true);
    setImportLog(['กำลังอ่านไฟล์...']);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames.find(n => n !== 'คำแนะนำ' && n !== 'ตัวเลือก (Lookup)') || workbook.SheetNames[0];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets[sheetName]);

      if (jsonData.length === 0) {
        setImportLog(['❌ ไม่พบข้อมูลในไฟล์']);
        setImportingLots(false);
        return;
      }

      setImportLog([`พบ ${jsonData.length} แถว กำลังตรวจสอบ...`]);

      // Lookup items
      const itemsRes = await fetch('/api/items?limit=9999');
      const itemsData = await itemsRes.json();
      const allItems = (itemsData.data?.items || []) as { id: number; code: string }[];

      // Use warehouses from page state
      const allWarehouses = warehouses;

      const log: string[] = [];
      let success = 0;
      const errors: string[] = [];

      const formatDate = (v: string | number | undefined) => {
        if (!v) return undefined;
        const s = String(v).trim();
        if (!s) return undefined;
        if (typeof v === 'number') {
          const d = new Date((v - 25569) * 86400000);
          return d.toISOString().split('T')[0];
        }
        return s;
      };

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const lotNumber = String(row['เลข Lot (Lot Number)*'] ?? row['lotNumber'] ?? '').trim();
        const itemCode = String(row['รหัสสินค้า (Item Code)*'] ?? row['itemCode'] ?? '').trim();
        const whName = String(row['คลังสินค้า (Warehouse)*'] ?? row['warehouseName'] ?? '').trim();
        const qty = Number(row['จำนวน (Quantity)*'] ?? row['quantity'] ?? 0);
        const unit = String(row['หน่วย (Unit)*'] ?? row['unit'] ?? '').trim();

        if (!lotNumber || !itemCode || !whName || !qty || !unit) {
          errors.push(`แถว ${i + 2}: ข้อมูลบังคับไม่ครบ`); continue;
        }

        const item = allItems.find(it => it.code === itemCode);
        if (!item) { errors.push(`แถว ${i + 2}: ไม่พบสินค้า ${itemCode}`); continue; }

        const wh = allWarehouses.find(w => w.name.toLowerCase() === whName.toLowerCase());
        if (!wh) { errors.push(`แถว ${i + 2}: ไม่พบคลัง "${whName}"`); continue; }

        const payload: Record<string, unknown> = {
          lotNumber, itemId: item.id, warehouseId: wh.id, quantity: qty, unit,
          cost: Number(row['ราคาต่อหน่วย (Cost)'] ?? row['cost'] ?? 0) || undefined,
          expiryDate: formatDate(row['วันหมดอายุ (Expiry Date)'] ?? row['expiryDate']),
          manufacturingDate: formatDate(row['วันผลิต (Mfg Date)'] ?? row['manufacturingDate']),
          receivedDate: formatDate(row['วันรับเข้า (Received Date)'] ?? row['receivedDate']),
          vendorLotNumber: String(row['เลข Lot ผู้ขาย'] ?? row['vendorLotNumber'] ?? '').trim() || undefined,
          poNumber: String(row['เลข PO'] ?? row['poNumber'] ?? '').trim() || undefined,
          coaNumber: String(row['เลข COA'] ?? row['coaNumber'] ?? '').trim() || undefined,
          batchNumber: String(row['เลข Batch'] ?? row['batchNumber'] ?? '').trim() || undefined,
        };

        try {
          const res = await fetch('/api/inventory/lots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          const result = await res.json();
          if (result.success) success++;
          else errors.push(`${lotNumber}: ${result.error}`);
        } catch (err) { errors.push(`${lotNumber}: ${err instanceof Error ? err.message : 'Error'}`); }

        // Update progress
        setImportLog([`กำลังนำเข้า ${i + 1}/${jsonData.length}...`]);
      }

      log.push(`✅ นำเข้า ${success}/${jsonData.length} Lot สำเร็จ (สถานะ: Quarantine)`);
      if (errors.length > 0) log.push(...errors.slice(0, 5).map(e => `❌ ${e}`));
      if (errors.length > 5) log.push(`...และอีก ${errors.length - 5} รายการ`);
      setImportLog(log);
      setImportingLots(false);
      if (success > 0) fetchLots();
    } catch (err) {
      setImportLog([`❌ เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : 'อ่านไฟล์ไม่ได้'}`]);
      setImportingLots(false);
    }

    // Reset input
    event.target.value = '';
  };
  const [showQCModal, setShowQCModal] = useState(false);
  const [showTraceModal, setShowTraceModal] = useState(false);
  const [qcLot, setQcLot] = useState<Lot | null>(null);
  const [traceLot, setTraceLot] = useState<Lot | null>(null);
  const [traceData, setTraceData] = useState<TraceData | null>(null);
  // Vendor-lot config — pulled from /master-data/lot-patterns so the
  // placeholder hint + regex validation track whatever the tenant configured.
  const [vendorLotHint, setVendorLotHint] = useState<string>('');
  const [vendorLotRegex, setVendorLotRegex] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/inventory/lots/vendor-hint?locale=th');
        const json = await res.json();
        if (!cancelled && res.ok) {
          setVendorLotHint(json?.data?.hint ?? '');
          setVendorLotRegex(json?.data?.regex ?? null);
        }
      } catch { /* leave defaults */ }
    })();
    return () => { cancelled = true; };
  }, []);
  const [formData, setFormData] = useState<LotFormData>({
    lotNumber: '',
    itemId: 0,
    warehouseId: 0,
    quantity: 0,
    unit: 'kg',
    manufacturingDate: '',
    expiryDate: '',
    receivedDate: getLocalDateStr(),
    vendorLotNumber: '',
    vendorId: null,
    cost: 0,
    notes: '',
    // Phase 4: GMP Compliance fields
    manufacturerName: '',
    manufacturerId: null,
    importerName: '',
    importerId: null,
    countryOfOrigin: '',
    retestDate: '',
    retestIntervalMonths: null,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Item search dialog state
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SearchItem | null>(null);

  // Ref to track pending fetch after modal closes (prevents DOM error during popup animation)
  const pendingFetchRef = useRef(false);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.lotNumber.trim()) {
      errors.lotNumber = t('lots.validation.lotNumberRequired');
    }

    // Vendor lot regex check — only if both a regex is configured AND
    // the user actually supplied a value (vendor lot is optional).
    if (vendorLotRegex && formData.vendorLotNumber.trim()) {
      try {
        const re = new RegExp(vendorLotRegex);
        if (!re.test(formData.vendorLotNumber.trim())) {
          errors.vendorLotNumber = `รูปแบบเลข Lot ผู้ขายไม่ตรงข้อกำหนด (ต้องตรงกับ: ${vendorLotRegex})`;
        }
      } catch { /* malformed stored regex — skip */ }
    }

    if (!formData.itemId || formData.itemId === 0) {
      errors.itemId = t('lots.validation.selectItem');
    }

    if (!formData.warehouseId || formData.warehouseId === 0) {
      errors.warehouseId = t('lots.validation.selectWarehouse');
    }

    if (!formData.quantity || formData.quantity <= 0) {
      errors.quantity = t('lots.validation.quantityMin');
    }

    if (!formData.expiryDate) {
      errors.expiryDate = t('lots.validation.expiryDateRequired');
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiryDate = new Date(formData.expiryDate);
      if (expiryDate <= today) {
        errors.expiryDate = t('lots.validation.expiryDateFuture');
      }
    }

    if (formData.manufacturingDate && formData.expiryDate) {
      const mfgDate = new Date(formData.manufacturingDate);
      const expDate = new Date(formData.expiryDate);
      if (mfgDate >= expDate) {
        errors.manufacturingDate = t('lots.validation.mfgBeforeExpiry');
      }
    }

    if (!formData.cost || formData.cost <= 0) {
      errors.cost = t('lots.validation.costRequired');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const fetchLots = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');

      const res = await fetch(`/api/inventory/lots?${params}`);
      const data = await res.json();

      if (data.success) {
        const fetchedLots: Lot[] = data.data?.items || data.data || [];
        setLots(fetchedLots);
      } else {
        setLots([]);
      }
    } catch (error) {
      console.error('Failed to fetch lots:', error);
      setLots([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Client-side filtering — lots always holds ALL data, filteredLots is for display
  const filteredLots = useMemo(() => {
    let result = lots;

    // Status filter
    if (statusFilter) {
      result = result.filter((lot) => lot.status === statusFilter);
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter((lot) =>
        lot.lotNumber?.toLowerCase().includes(searchLower) ||
        lot.itemCode?.toLowerCase().includes(searchLower) ||
        lot.itemName?.toLowerCase().includes(searchLower)
      );
    }

    // Warehouse filter
    if (warehouseFilter) {
      result = result.filter((lot) => lot.warehouseId === warehouseFilter);
    }

    // Date range filters
    if (expiryFrom) {
      result = result.filter((lot) => lot.expiryDate && new Date(lot.expiryDate) >= new Date(expiryFrom));
    }
    if (expiryTo) {
      result = result.filter((lot) => lot.expiryDate && new Date(lot.expiryDate) <= new Date(expiryTo));
    }
    if (receivedFrom) {
      result = result.filter((lot) => lot.receivedDate && new Date(lot.receivedDate) >= new Date(receivedFrom));
    }
    if (receivedTo) {
      result = result.filter((lot) => lot.receivedDate && new Date(lot.receivedDate) <= new Date(receivedTo));
    }

    // Quick filters
    if (quickFilter === 'near_expiry') {
      result = result.filter((lot) => {
        const days = getDaysUntilExpiry(lot.expiryDate);
        return days !== null && days > 0 && days <= 30;
      });
    } else if (quickFilter === 'expired') {
      result = result.filter((lot) => {
        const days = getDaysUntilExpiry(lot.expiryDate);
        return days !== null && days < 0;
      });
    } else if (quickFilter === 'raw_material') {
      result = result.filter((lot) => lot.itemType === 'raw_material');
    } else if (quickFilter === 'finished_goods') {
      result = result.filter((lot) => lot.itemType === 'finished_good' || lot.itemType === 'finished_goods');
    }

    // Sort by latest received date first (lots without a date go to the end).
    result = [...result].sort((a, b) => {
      const aTime = a.receivedDate ? new Date(a.receivedDate).getTime() : Number.NEGATIVE_INFINITY;
      const bTime = b.receivedDate ? new Date(b.receivedDate).getTime() : Number.NEGATIVE_INFINITY;
      return bTime - aTime;
    });

    // Tag with display row number (mirrors /inventory/items).
    return result.map((lot, index) => ({ ...lot, _rowNumber: index + 1 }));
  }, [lots, statusFilter, search, warehouseFilter, expiryFrom, expiryTo, receivedFrom, receivedTo, quickFilter]);

  const fetchMasterData = async () => {
    // Fetch each master-data source independently. A 403 on one (e.g. the
    // vendor list for a role without purchasing:read) must NOT break the
    // entire Lots page — we just leave that dropdown empty. Previously
    // Promise.all made a single 403 surface as a page-wide "no permission"
    // error toast, masking the fact that the user had lot permissions.
    const fetchJson = async <T,>(
      url: string,
      label: string,
    ): Promise<T[]> => {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          if (res.status !== 403) {
            console.warn(`[Lots] ${label} fetch returned ${res.status}`);
          }
          return [];
        }
        const data = await res.json();
        return data.success ? (data.data?.items || data.data || []) : [];
      } catch (err) {
        console.warn(`[Lots] ${label} fetch failed:`, err);
        return [];
      }
    };

    const [warehousesData, vendorsData] = await Promise.all([
      fetchJson<unknown>('/api/warehouses?limit=100', 'warehouses'),
      fetchJson<unknown>('/api/vendors?limit=100', 'vendors'),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setWarehouses(warehousesData as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setVendors(vendorsData as any);
  };

  useEffect(() => {
    fetchLots();
    fetchMasterData();
  }, [fetchLots]);

  const handleSelectItem = (item: SearchItem) => {
    setSelectedItem(item);
    setFormData(prev => ({
      ...prev,
      itemId: item.id,
      unit: item.primaryUnit,
    }));
    if (formErrors.itemId) {
      setFormErrors(prev => ({ ...prev, itemId: '' }));
    }
  };

  const handleCreateLot = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const res = await fetch('/api/inventory/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        // Set flag to fetch lots after popup animation completes (prevents DOM removeChild error)
        pendingFetchRef.current = true;
        setShowModal(false);
        // Note: fetchLots() and resetForm() are called in onHidden callback after popup animation completes
      }
    } catch {
      // Network errors handled by global error handler
    }
  };

  const handleQCAction = async (action: 'release' | 'reject') => {
    if (!qcLot) return;

    try {
      const res = await fetch(`/api/inventory/lots/${qcLot.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: action === 'release' ? 'released' : 'rejected',
          notes: `QC ${action}d on ${new Date().toISOString()}`
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Close modal and refresh list
        setShowQCModal(false);
        setQcLot(null);
        // Refresh lots list after modal closes
        setTimeout(() => fetchLots(), 100);
      }
    } catch {
      // Network errors handled by global error handler
    }
  };

  const handleViewTrace = async (lot: Lot) => {
    setTraceLot(lot);
    try {
      const res = await fetch(`/api/inventory/traceability?lotId=${lot.id}`);
      const data = await res.json();
      if (data.success) {
        setTraceData(data.data);
        setShowTraceModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch traceability:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      lotNumber: '',
      itemId: 0,
      warehouseId: 0,
      quantity: 0,
      unit: 'kg',
      manufacturingDate: '',
      expiryDate: '',
      receivedDate: getLocalDateStr(),
      vendorLotNumber: '',
      vendorId: null,
      cost: 0,
      notes: '',
      // Phase 4: GMP Compliance fields
      manufacturerName: '',
      manufacturerId: null,
      importerName: '',
      importerId: null,
      countryOfOrigin: '',
      retestDate: '',
      retestIntervalMonths: null,
    });
    setFormErrors({});
    setSelectedItem(null);
  };

  const generateLotNumber = async () => {
    // Fetch from /api/inventory/lots/next-lot — uses the configured Lot
    // Pattern master (master-data/lot-patterns). If the API call fails,
    // fall back to the legacy LOT-YYYYMMDD-NNN local format so the
    // button still works offline.
    try {
      const res = await fetch('/api/inventory/lots/next-lot');
      const json = await res.json();
      if (res.ok && json?.data?.lotNumber) {
        setFormData(prev => ({ ...prev, lotNumber: json.data.lotNumber }));
        return;
      }
    } catch {
      // fall through to local fallback
    }
    const date = new Date();
    const prefix = 'LOT';
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setFormData(prev => ({ ...prev, lotNumber: `${prefix}-${dateStr}-${random}` }));
  };

  const handleRowClick = (e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/inventory/lots/${e.data.id}`);
    }
  };

  // Calculate comprehensive stats
  const stats = useMemo(() => {
    const quarantine = lots.filter(l => l.status === 'quarantine');
    const released = lots.filter(l => l.status === 'released');
    const rejected = lots.filter(l => l.status === 'rejected');
    const nearExpiry = lots.filter(l => {
      const days = getDaysUntilExpiry(l.expiryDate);
      return days !== null && days > 0 && days <= 30;
    });
    const expired = lots.filter(l => {
      const days = getDaysUntilExpiry(l.expiryDate);
      return days !== null && days < 0;
    });

    const totalQuantity = lots.reduce((sum, lot) => sum + (Number(lot.quantity) || 0), 0);
    const totalValue = lots.reduce((sum, lot) => sum + ((Number(lot.quantity) || 0) * (Number(lot.cost) || 0)), 0);
    const releasedValue = released.reduce((sum, lot) => sum + ((Number(lot.quantity) || 0) * (Number(lot.cost) || 0)), 0);

    // Calculate average days to expiry for released lots
    const releasedWithExpiry = released.filter(l => l.expiryDate);
    const avgDaysToExpiry = releasedWithExpiry.length > 0
      ? Math.round(releasedWithExpiry.reduce((sum, lot) => {
          const days = getDaysUntilExpiry(lot.expiryDate);
          return sum + (days || 0);
        }, 0) / releasedWithExpiry.length)
      : 0;

    return {
      quarantineCount: quarantine.length,
      releasedCount: released.length,
      rejectedCount: rejected.length,
      nearExpiryCount: nearExpiry.length,
      expiredCount: expired.length,
      totalLots: lots.length,
      totalQuantity,
      totalValue,
      releasedValue,
      avgDaysToExpiry,
    };
  }, [lots]);

  // Status counts for tabs
  const statusCounts = useMemo(() => ({
    '': lots.length,
    quarantine: stats.quarantineCount,
    released: stats.releasedCount,
    rejected: stats.rejectedCount,
    blocked: lots.filter(l => l.status === 'blocked').length,
  }), [lots, stats]);

  // Define columns for DevExtreme DataGrid
  const columns: DxDataGridColumn[] = [
    {
      dataField: '_rowNumber',
      caption: t('items.grid.columns.rowNum'),
      width: 60,
      alignment: 'center',
      allowFiltering: false,
      allowSorting: false,
      cellRender: (cellInfo) => (
        <span className="text-gray-500 text-sm font-medium">
          {cellInfo.data._rowNumber}
        </span>
      ),
    },
    {
      dataField: 'lotNumber',
      caption: t('lots.grid.columns.lotNumber'),
      minWidth: 180,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2 flex-nowrap">
          <span className={cn('p-1 rounded shrink-0', STATUS_CONFIG[cellInfo.data.status as StatusType]?.bgColor, STATUS_CONFIG[cellInfo.data.status as StatusType]?.textColor)}>
            {STATUS_CONFIG[cellInfo.data.status as StatusType]?.icon}
          </span>
          <span className="font-mono text-emerald-600 hover:text-emerald-800 whitespace-nowrap">{cellInfo.data.lotNumber}</span>
        </div>
      ),
    },
    {
      dataField: 'vendorLotNumber',
      caption: t('lots.grid.columns.vendorLotNumber'),
      minWidth: 140,
      hideOnMobile: true,
      hideOnTablet: true,
      cellRender: (cellInfo) => (
        <span className="text-gray-700">{cellInfo.data.vendorLotNumber || '-'}</span>
      ),
    },
    {
      dataField: 'receivedDate',
      caption: t('lots.grid.columns.receivedDate'),
      minWidth: 145,
      dataType: 'date',
      hideOnMobile: true,
      hideOnTablet: true,
      cellRender: (cellInfo) => {
        const rd = cellInfo.data.receivedDate;
        if (!rd) return <span className="text-gray-400">-</span>;
        const d = new Date(rd);
        if (isNaN(d.getTime())) return <span className="text-gray-400">-</span>;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return <span className="text-gray-700 text-xs">{dd}/{mm}/{yyyy} {hh}:{mi}</span>;
      },
    },
    {
      dataField: 'agingDays',
      caption: t('lots.grid.columns.aging'),
      minWidth: 90,
      dataType: 'number',
      hideOnMobile: true,
      hideOnTablet: true,
      cellRender: (cellInfo) => {
        // Same helper the xlsx export uses, so the screen and the file can't drift.
        const days = getAgingDays(cellInfo.data.receivedDate);
        if (days === null) return <span className="text-gray-400">-</span>;
        const color = days > 180 ? 'text-red-600 bg-red-50' : days > 90 ? 'text-amber-600 bg-amber-50' : 'text-gray-700 bg-gray-50';
        return <span className={`text-xs font-medium px-2 py-0.5 rounded ${color}`}>{days} {t('lots.days')}</span>;
      },
      calculateCellValue: (rowData: Record<string, unknown>) => {
        const rd = rowData.receivedDate as string | null;
        if (!rd) return null;
        const received = new Date(rd);
        if (isNaN(received.getTime())) return null;
        return Math.floor((Date.now() - received.getTime()) / (1000 * 60 * 60 * 24));
      },
    },
    {
      dataField: 'itemCode',
      caption: t('lots.grid.columns.item'),
      minWidth: 220,
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium text-gray-900">{cellInfo.data.itemCode}</p>
          <p className="text-xs text-gray-500">{cellInfo.data.itemName}</p>
        </div>
      ),
    },
    {
      dataField: 'quantity',
      caption: t('lots.grid.columns.quantity'),
      minWidth: 130,
      dataType: 'number',
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium text-gray-900">{formatNumber(cellInfo.data.quantity)} <span className="text-xs text-gray-500 font-normal">{cellInfo.data.unit}</span></p>
          {cellInfo.data.reservedQuantity > 0 && (
            <p className="text-xs text-orange-600 flex items-center gap-1">
              <Clock className="h-3 w-3" /> {t('lots.reserved')}: {formatNumber(cellInfo.data.reservedQuantity)}
            </p>
          )}
        </div>
      ),
    },
    {
      dataField: 'cost',
      caption: t('lots.grid.columns.value'),
      minWidth: 150,
      dataType: 'number',
      hideOnMobile: true,
      cellRender: (cellInfo) => {
        const totalCost = (Number(cellInfo.data.quantity) || 0) * (Number(cellInfo.data.cost) || 0);
        return (
          <div>
            <p className="font-medium text-gray-900">{formatCurrency(totalCost)}</p>
            {cellInfo.data.cost && Number(cellInfo.data.cost) > 0 && (
              <p className="text-xs text-gray-500">@{formatCurrency(Number(cellInfo.data.cost))}/{cellInfo.data.unit}</p>
            )}
          </div>
        );
      },
    },
    {
      dataField: 'warehouseName',
      caption: t('lots.grid.columns.warehouse'),
      minWidth: 200,
      hideOnMobile: true,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Warehouse className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span>{cellInfo.data.warehouseName || '-'}</span>
        </div>
      ),
    },
    {
      dataField: 'expiryDate',
      caption: t('lots.grid.columns.expiryDate'),
      minWidth: 140,
      dataType: 'date',
      hideOnMobile: true,
      cellRender: (cellInfo) => {
        const days = getDaysUntilExpiry(cellInfo.data.expiryDate);
        const variant = getExpiryVariant(days);
        return (
          <div>
            <p className="text-gray-700">{formatDate(cellInfo.data.expiryDate)}</p>
            {days !== null && (
              <Badge variant={variant} size="sm">
                {days < 0 ? (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {t('lots.expiredDays', { days: Math.abs(days) })}
                  </span>
                ) : (
                  <span>{t('lots.daysRemaining', { days })}</span>
                )}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      dataField: 'manufacturerName',
      caption: t('lots.grid.columns.manufacturer'),
      minWidth: 160,
      hideOnMobile: true,
      hideOnTablet: true,
      cellRender: (cellInfo) => (
        <div>
          <p className="text-gray-700 text-sm">{cellInfo.data.manufacturerName || '-'}</p>
          {cellInfo.data.countryOfOrigin && (
            <p className="text-xs text-gray-500">{cellInfo.data.countryOfOrigin}</p>
          )}
        </div>
      ),
    },
    {
      dataField: 'retestDate',
      caption: t('lots.grid.columns.retest'),
      minWidth: 130,
      hideOnMobile: true,
      hideOnTablet: true,
      cellRender: (cellInfo) => {
        if (!cellInfo.data.retestDate) return <span className="text-gray-400">-</span>;
        const retestDate = new Date(cellInfo.data.retestDate);
        const today = new Date();
        const daysUntilRetest = Math.floor((retestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const isOverdue = daysUntilRetest < 0;
        const isUpcoming = daysUntilRetest >= 0 && daysUntilRetest <= 30;
        return (
          <div>
            <p className="text-gray-700">{formatDate(cellInfo.data.retestDate)}</p>
            <Badge variant={isOverdue ? 'danger' : isUpcoming ? 'warning' : 'default'} size="sm">
              {isOverdue ? t('lots.overdueRetest', { days: Math.abs(daysUntilRetest) }) : t('lots.daysRemaining', { days: daysUntilRetest })}
            </Badge>
          </div>
        );
      },
    },
    {
      dataField: 'status',
      caption: t('lots.grid.columns.status'),
      minWidth: 120,
      cellRender: (cellInfo) => {
        const status = cellInfo.data.status;
        const variant = getStatusVariant(status);
        const config = STATUS_CONFIG[status as StatusType];
        return (
          <Badge variant={variant} className="inline-flex items-center gap-1">
            {config?.icon}
            {t(`lots.status.${config?.translationKey || status}`)}
          </Badge>
        );
      },
    },
    {
      caption: '',
      width: 100,
      allowSorting: false,
      allowFiltering: false,
      cellRender: (cellInfo) => (
        <div className="flex gap-1">
          {cellInfo.data.status === 'quarantine' && (
            <DxButton
              icon="todo"
              hint="QC Decision"
              type="default"
              stylingMode="text"
              onClick={(e) => {
                e?.event?.stopPropagation();
                setQcLot(cellInfo.data);
                setShowQCModal(true);
              }}
            />
          )}
          <DxButton
            icon="find"
            hint="ดู Traceability"
            type="default"
            stylingMode="text"
            onClick={(e) => {
              e?.event?.stopPropagation();
              handleViewTrace(cellInfo.data);
            }}
          />
        </div>
      ),
    },
  ];

  const warehouseOptions = [
    { value: '', label: t('lots.form.selectWarehouse') },
    ...warehouses.map(w => ({ value: w.id.toString(), label: w.name }))
  ];

  const vendorOptions = [
    { value: '', label: t('lots.form.selectVendor') },
    ...vendors.map(v => ({ value: v.id.toString(), label: v.name }))
  ];

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Page Header */}
        <PageHeader
          title={t('lots.pageTitle')}
          description={t('lots.description')}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  fetchLots().then(() => {
                    toast.success('รีเฟรชข้อมูลสำเร็จ');
                  }).catch(() => {
                    toast.error('เกิดข้อผิดพลาดในการรีเฟรชข้อมูล');
                  });
                }}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm text-emerald-800 bg-white border border-emerald-100 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50 min-h-[40px]"
                aria-label={t('common.refresh')}
              >
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                <span className="hidden sm:inline">
                  {isLoading ? 'กำลังโหลด...' : t('common.refresh')}
                </span>
              </button>
              <button
                onClick={() => router.push('/inventory/items')}
                className="hidden md:inline-flex items-center gap-2 px-3 py-2 text-sm text-emerald-800 bg-white border border-emerald-100 rounded-lg hover:bg-emerald-50 transition-colors min-h-[40px]"
              >
                <Package className="h-4 w-4" />
                {t('lots.viewItems')}
              </button>
              <button
                onClick={handleDownloadLots}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors min-h-[40px]"
              >
                <Download className="h-4 w-4" /> Download Excel
              </button>
              {isAdmin && (
                <>
                  <button
                    onClick={handleDownloadLotTemplate}
                    className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-h-[40px]"
                  >
                    <Download className="h-4 w-4" /> {t('common.downloadTemplate')}
                  </button>
                  <button
                    onClick={() => { setShowImportDialog(true); setImportLog([]); }}
                    className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors min-h-[40px]"
                  >
                    <Upload className="h-4 w-4" /> {t('common.importExcel')}
                  </button>
                </>
              )}
              <button
                onClick={() => { resetForm(); setShowModal(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors font-medium min-h-[40px] shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>{t('lots.addLot')}</span>
              </button>
            </div>
          }
        />

        {/* (Removed the "รายการ Lot" summary card — its lot count, value and
            quarantine/released/near-expiry/expired chips duplicated the status
            tabs + compact stats row in the grid header just below.) */}

        {/* DataGrid Card */}
        <div className="bg-white border border-emerald-100 rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] overflow-hidden">
          {/* Tabs + Stats Header */}
          <div className="px-4 py-3 border-b border-emerald-50 bg-gradient-to-b from-[#FBFEFC] to-[#F6FCF9]">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              {/* Status Tabs */}
              <div className="flex items-center gap-1 bg-[#F1FAF5] rounded-xl p-1 border border-emerald-100 overflow-x-auto">
                {(Object.keys(STATUS_CONFIG) as StatusType[]).map((status) => {
                  const config = STATUS_CONFIG[status];
                  const count = statusCounts[status];
                  return (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap',
                        statusFilter === status
                          ? `${config.activeBg} ${config.activeText} shadow-sm`
                          : 'text-[#4B7163] hover:text-[#064E3B] hover:bg-[#E6F6EE]'
                      )}
                    >
                      {config.icon}
                      {status === '' ? t('common.all') : t(`lots.status.${config.translationKey}`)}
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded-full font-semibold',
                        statusFilter === status ? 'bg-white/25 text-inherit' : 'bg-emerald-100 text-emerald-800'
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Compact Stats */}
              <div className="flex items-center gap-4 text-sm">
                {stats.nearExpiryCount > 0 && (
                  <div className="flex items-center gap-1.5 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">{stats.nearExpiryCount} {t('stats.nearExpiry')}</span>
                  </div>
                )}
                {stats.expiredCount > 0 && (
                  <div className="flex items-center gap-1.5 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span className="font-medium">{stats.expiredCount} {t('stats.expired')}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-gray-500">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span>{formatNumber(stats.totalQuantity)} {t('common.units')}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-500">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  <span>{formatCurrency(stats.totalValue)}</span>
                </div>
                <div className="text-gray-400">|</div>
                <span className="text-gray-500">{t('common.lotsShown', { count: filteredLots.length })}</span>
              </div>
            </div>
          </div>

          {/* ═══ Filter Bar — Informative Design ═══ */}
          {(() => {
            const activeFilterCount =
              (search ? 1 : 0) +
              (warehouseFilter ? 1 : 0) +
              (expiryFrom ? 1 : 0) +
              (expiryTo ? 1 : 0) +
              (quickFilter ? 1 : 0);
            const hasActiveFilters = activeFilterCount > 0;
            const clearAll = () => {
              setSearch('');
              setWarehouseFilter('');
              setExpiryFrom('');
              setExpiryTo('');
              setReceivedFrom('');
              setReceivedTo('');
              setQuickFilter('');
            };
            return (
              <div className="bg-gradient-to-b from-white to-[#F6FCF9] border-b border-emerald-50">
                {/* ── Row 1: Main filters with labels ── */}
                <div className="px-4 pt-3 pb-2">
                  <div className="flex flex-wrap items-end gap-x-4 gap-y-2 filter-compact">
                    {/* Search */}
                    <div className="flex flex-col gap-1 w-full sm:min-w-[200px] sm:flex-1 sm:max-w-[260px]">
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        <Package className="h-3 w-3" />
                        {t('lots.filters.searchLabel')}
                      </label>
                      <DxTextBox
                        placeholder={t('lots.searchPlaceholder')}
                        value={search}
                        onValueChange={setSearch}
                        showClearButton
                        mode="search"
                        onEnterKey={() => fetchLots()}
                        height={36}
                      />
                    </div>

                    {/* Warehouse */}
                    <div className="flex flex-col gap-1 w-full sm:w-[200px]">
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        <Warehouse className="h-3 w-3" />
                        {t('lots.filters.warehouse')}
                      </label>
                      <DxSelectBox
                        items={[{ value: '', label: t('lots.filters.allWarehouses') }, ...warehouses.map(w => ({ value: w.id, label: w.name }))]}
                        value={warehouseFilter}
                        onValueChange={(v) => setWarehouseFilter(v || '')}
                        height={36}
                      />
                    </div>

                    {/* Expiry date range */}
                    <div className="flex flex-col gap-1 w-full sm:w-auto">
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        <CalendarClock className="h-3 w-3" />
                        {t('lots.filters.expiryRange')}
                      </label>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 sm:w-[140px]">
                          <DxDateBox value={expiryFrom} onValueChange={(v) => setExpiryFrom(v || '')} placeholder={t("lots.filters.from")} height={36} />
                        </div>
                        <span className="text-gray-400 text-sm flex-shrink-0">→</span>
                        <div className="flex-1 sm:w-[140px]">
                          <DxDateBox value={expiryTo} onValueChange={(v) => setExpiryTo(v || '')} placeholder={t("lots.filters.to")} height={36} />
                        </div>
                      </div>
                    </div>

                    {/* Spacer pushes summary right */}
                    <div className="flex-1" />

                    {/* Active filter summary + Clear */}
                    {hasActiveFilters && (
                      <div className="flex items-center gap-2 pb-1">
                        <span className="text-xs text-gray-500">
                          <span className="font-semibold text-gray-700">{activeFilterCount}</span> {t('lots.filters.activeCount')}
                        </span>
                        <button
                          onClick={clearAll}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors"
                        >
                          <RefreshCcw className="h-3 w-3" />
                          {t('lots.filters.clearAll')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Row 2: Quick filters ── */}
                <div className="px-4 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">
                      {t('lots.filters.quickFilters')}
                    </span>
                    {([
                      { key: 'near_expiry' as QuickFilter, label: t('lots.filters.nearExpiry'), color: 'text-amber-700 bg-amber-50 border-amber-300 ring-amber-400/30', icon: <CalendarClock className="h-3.5 w-3.5" /> },
                      { key: 'expired' as QuickFilter, label: t('lots.filters.expired'), color: 'text-red-700 bg-red-50 border-red-300 ring-red-400/30', icon: <XCircle className="h-3.5 w-3.5" /> },
                      { key: 'raw_material' as QuickFilter, label: t('lots.filters.rawMaterial'), color: 'text-emerald-700 bg-emerald-50 border-emerald-300 ring-emerald-400/30', icon: <Package className="h-3.5 w-3.5" /> },
                      { key: 'finished_goods' as QuickFilter, label: t('lots.filters.finishedGoods'), color: 'text-purple-700 bg-purple-50 border-purple-300 ring-purple-400/30', icon: <Boxes className="h-3.5 w-3.5" /> },
                    ]).map((tag) => {
                      const isActive = quickFilter === tag.key;
                      return (
                        <button
                          key={tag.key}
                          onClick={() => setQuickFilter(isActive ? '' : tag.key)}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border transition-all',
                            isActive
                              ? `${tag.color} ring-2 shadow-sm`
                              : 'text-gray-600 bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          )}
                        >
                          {tag.icon}
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* DataGrid */}
          <div className="p-4">
            {filteredLots.length > 0 || isLoading ? (
              <DxDataGrid
                dataSource={filteredLots}
                keyExpr="id"
                columns={columns}
                loading={isLoading}
                sorting
                wordWrapEnabled
                columnAutoWidth
                allowColumnResizing
                paging
                pageSize={20}
                height="auto"
                responsiveColumns
                onRowClick={handleRowClick}
                noDataText={t('lots.noLots')}
              />
            ) : (
              <EmptyState
                icon={<Inbox className="h-12 w-12" />}
                title={t('lots.noLots')}
                description={t('lots.noLotsDescription')}
                action={{
                  label: t('lots.addLot'),
                  onClick: () => { resetForm(); setShowModal(true); },
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Create Lot Modal */}
      <DxPopup
        visible={showModal}
        onVisibleChange={(v) => { if (!v) setShowModal(false); }}
        onHidden={() => {
          // Fetch lots after popup animation completes if a lot was created
          // Use setTimeout to ensure DevExtreme has fully cleaned up the DOM before triggering React re-renders
          if (pendingFetchRef.current) {
            pendingFetchRef.current = false;
            setTimeout(() => fetchLots(), 0);
          }
        }}
        title={t('lots.form.title')}
        width={800}
        maxWidth="95vw"
        height="auto"
        maxHeight="90vh"
        fullScreenOnMobile
        fullScreenOnTablet
      >
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Package className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-medium text-emerald-800">{t('lots.form.receiveTitle')}</p>
              <p className="text-sm text-emerald-600">{t('lots.form.initialStatus')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('lots.form.lotNumber')} <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <DxTextBox
                  value={formData.lotNumber}
                  onValueChange={(v) => {
                    setFormData(prev => ({ ...prev, lotNumber: v }));
                    if (formErrors.lotNumber) setFormErrors(prev => ({ ...prev, lotNumber: '' }));
                  }}
                  placeholder="LOT-YYYYMMDD-XXX"
                />
                <DxButton text={t('lots.form.generate')} type="default" onClick={generateLotNumber} />
              </div>
              {formErrors.lotNumber && (
                <p className="text-sm text-red-500 mt-1">{formErrors.lotNumber}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('lots.form.vendorLotNumber')}
              </label>
              <DxTextBox
                value={formData.vendorLotNumber}
                onValueChange={(v) => {
                  setFormData(prev => ({ ...prev, vendorLotNumber: v }));
                  if (formErrors.vendorLotNumber) setFormErrors(prev => ({ ...prev, vendorLotNumber: '' }));
                }}
                placeholder={vendorLotHint || t('lots.form.vendorLotPlaceholder')}
              />
              {formErrors.vendorLotNumber && (
                <p className="text-sm text-red-500 mt-1">{formErrors.vendorLotNumber}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('lots.form.item')} <span className="text-red-500">*</span>
              </label>
              {selectedItem ? (
                <div className={`flex items-center justify-between p-3 rounded-lg border ${formErrors.itemId ? 'border-red-500 bg-red-50' : 'bg-green-50 border-green-200'}`}>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <Package className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-green-800 text-sm">{selectedItem.code}</p>
                      <p className="text-xs text-green-600">{selectedItem.nameTh}</p>
                    </div>
                  </div>
                  <DxButton text={t('lots.form.changeItem')} type="default" stylingMode="text" onClick={() => setItemDialogOpen(true)} />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setItemDialogOpen(true)}
                  className={`w-full flex items-center justify-between p-3 border-2 border-dashed rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors group ${formErrors.itemId ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                >
                  <div className="flex items-center gap-2 text-gray-500 group-hover:text-green-600">
                    <BoxSelect className="h-4 w-4" />
                    <span className="text-sm">{t('lots.form.selectItem')}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-green-500" />
                </button>
              )}
              {formErrors.itemId && (
                <p className="text-sm text-red-500 mt-1">{formErrors.itemId}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('lots.form.warehouse')} <span className="text-red-500">*</span>
              </label>
              <DxSelectBox
                items={warehouseOptions}
                value={formData.warehouseId.toString()}
                onValueChange={(v) => {
                  setFormData(prev => ({ ...prev, warehouseId: parseInt(v) || 0 }));
                  if (formErrors.warehouseId) setFormErrors(prev => ({ ...prev, warehouseId: '' }));
                }}
              />
              {formErrors.warehouseId && (
                <p className="text-sm text-red-500 mt-1">{formErrors.warehouseId}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('lots.form.quantity')} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                value={formData.quantity || ''}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }));
                  if (formErrors.quantity) setFormErrors(prev => ({ ...prev, quantity: '' }));
                }}
                min="0"
                step="0.001"
              />
              {formErrors.quantity && (
                <p className="text-sm text-red-500 mt-1">{formErrors.quantity}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('lots.form.unit')}
              </label>
              <DxTextBox value={formData.unit} disabled />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('lots.form.costPerUnit')} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                value={formData.cost || ''}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }));
                  if (formErrors.cost) setFormErrors(prev => ({ ...prev, cost: '' }));
                }}
                min="0"
                step="0.01"
                placeholder="0.00"
              />
              {formErrors.cost && (
                <p className="text-sm text-red-500 mt-1">{formErrors.cost}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('lots.form.manufacturingDate')}
              </label>
              <DxDateBox
                value={formData.manufacturingDate || ''}
                onValueChange={(v) => {
                  setFormData(prev => ({ ...prev, manufacturingDate: v }));
                  if (formErrors.manufacturingDate) setFormErrors(prev => ({ ...prev, manufacturingDate: '' }));
                }}
                max={formData.expiryDate || undefined}
              />
              {formErrors.manufacturingDate && (
                <p className="text-sm text-red-500 mt-1">{formErrors.manufacturingDate}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('lots.form.expiryDate')} <span className="text-red-500">*</span>
              </label>
              <DxDateBox
                value={formData.expiryDate || ''}
                onValueChange={(v) => {
                  setFormData(prev => ({ ...prev, expiryDate: v }));
                  if (formErrors.expiryDate) setFormErrors(prev => ({ ...prev, expiryDate: '' }));
                }}
                min={formData.manufacturingDate || undefined}
              />
              {formErrors.expiryDate && (
                <p className="text-sm text-red-500 mt-1">{formErrors.expiryDate}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('lots.form.receivedDate')}
              </label>
              <DxDateBox
                value={formData.receivedDate || ''}
                onValueChange={(v) => {
                  setFormData(prev => ({ ...prev, receivedDate: v }));
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('lots.form.vendor')}
            </label>
            <DxSelectBox
              items={vendorOptions}
              value={formData.vendorId?.toString() || ''}
              onValueChange={(v) => setFormData(prev => ({ ...prev, vendorId: v ? parseInt(v) : null }))}
            />
          </div>

          {/* Phase 4: GMP Compliance Fields (FR-055) */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-500" />
              {t('lots.form.gmpSection')}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('lots.form.manufacturerName')}
                </label>
                <DxTextBox
                  value={formData.manufacturerName}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, manufacturerName: v }))}
                  placeholder={t('lots.form.manufacturerPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('lots.form.importerName')}
                </label>
                <DxTextBox
                  value={formData.importerName}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, importerName: v }))}
                  placeholder={t('lots.form.importerPlaceholder')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('lots.form.countryOfOrigin')}
                </label>
                <DxTextBox
                  value={formData.countryOfOrigin}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, countryOfOrigin: v }))}
                  placeholder={t('lots.form.countryPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('lots.form.retestDate')}
                </label>
                <DxDateBox
                  value={formData.retestDate || ''}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, retestDate: v }))}
                  min={formData.receivedDate || undefined}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('lots.form.retestInterval')}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  value={formData.retestIntervalMonths || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    retestIntervalMonths: e.target.value ? parseInt(e.target.value) : null
                  }))}
                  min="1"
                  max="60"
                  placeholder="12"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('lots.form.notes')}
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder={t('lots.form.notesPlaceholder')}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t sticky bottom-0 bg-white -mx-4 sm:-mx-6 px-4 sm:px-6 pb-1">
            <DxButton
              text={t('lots.form.cancel')}
              type="default"
              stylingMode="outlined"
              onClick={() => setShowModal(false)}
              width="100%"
              height={40}
              className="sm:!w-auto"
            />
            <DxButton
              text={t('lots.form.submit')}
              icon="check"
              type="success"
              onClick={handleCreateLot}
              width="100%"
              height={40}
              className="sm:!w-auto"
            />
          </div>
        </div>
      </DxPopup>

      {/* QC Action Modal */}
      {showQCModal && qcLot && (
        <DxPopup
          visible={showQCModal}
          onVisibleChange={(v) => {
            if (!v) {
              setShowQCModal(false);
              setQcLot(null);
            }
          }}
          title={t('lots.qc.title')}
          width={500}
          maxWidth="95vw"
          height="auto"
          fullScreenOnMobile
        >
          <div className="p-4 sm:p-6">
            <div className="flex items-center gap-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200 mb-6">
              <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-yellow-800 truncate">{qcLot.lotNumber}</p>
                <p className="text-sm text-yellow-600">{t('lots.qc.awaitingDecision')}</p>
              </div>
            </div>

            <div className="space-y-3 mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <span className="text-gray-600">{t('lots.qc.item')}:</span>
                <span className="font-medium sm:text-right">{qcLot.itemCode} - {qcLot.itemName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('lots.qc.quantity')}:</span>
                <span className="font-medium">{formatNumber(qcLot.quantity)} {qcLot.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('lots.qc.expiryDate')}:</span>
                <span className="font-medium">{formatDate(qcLot.expiryDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('lots.qc.value')}:</span>
                <span className="font-medium text-emerald-600">{formatCurrency((Number(qcLot.quantity) || 0) * (Number(qcLot.cost) || 0))}</span>
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-lg mb-6 border border-amber-200">
              <p className="text-sm text-amber-800 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                {t('lots.qc.warning')}
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <DxButton text={t('lots.qc.cancel')} type="default" stylingMode="outlined" onClick={() => setShowQCModal(false)} width="100%" height={40} className="sm:!w-auto" />
              <DxButton text={t('lots.qc.reject')} icon="close" type="danger" onClick={() => handleQCAction('reject')} width="100%" height={40} className="sm:!w-auto" />
              <DxButton text={t('lots.qc.release')} icon="check" type="success" onClick={() => handleQCAction('release')} width="100%" height={40} className="sm:!w-auto" />
            </div>
          </div>
        </DxPopup>
      )}

      {/* Traceability Modal */}
      <DxPopup
        visible={showTraceModal}
        onVisibleChange={(v) => { if (!v) setShowTraceModal(false); }}
        onHidden={() => { setTimeout(() => { setTraceLot(null); setTraceData(null); }, 0); }}
        title={t('lots.trace.title')}
        width={700}
        maxWidth="95vw"
        height="auto"
        maxHeight="90vh"
        fullScreenOnMobile
      >
        {traceLot && traceData && (
          <div className="p-4 sm:p-6">
            {/* Current Lot Info */}
            <div className="mb-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Boxes className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-emerald-800 truncate">{traceLot.lotNumber}</h3>
                  <p className="text-sm text-emerald-600">{t('lots.trace.currentLot')}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">{t('lots.trace.item')}:</span>
                  <span className="font-medium">{traceLot.itemCode}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">{t('lots.trace.quantity')}:</span>
                  <span className="font-medium">{formatNumber(traceLot.quantity)} {traceLot.unit}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">{t('lots.trace.status')}:</span>
                  <Badge variant={getStatusVariant(traceLot.status)} size="sm">{t(`lots.status.${traceLot.status}`)}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">{t('lots.trace.expiryDate')}:</span>
                  <span className="font-medium">{formatDate(traceLot.expiryDate)}</span>
                </div>
              </div>
            </div>

            {/* Backward Trace (Source Lots) */}
            {traceData.backward && traceData.backward.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-emerald-800">
                  <ArrowRight className="h-4 w-4 rotate-180" />
                  {t('lots.trace.sourceLots')}
                </h3>
                <div className="space-y-2">
                  {traceData.backward.map((lot: TraceLot, idx: number) => (
                    <div key={idx} className="p-3 bg-emerald-50 rounded-lg text-sm border border-emerald-200">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-emerald-800">{lot.lotNumber}</span>
                        <Badge variant={getStatusVariant(lot.status)} size="sm">{t(`lots.status.${lot.status}`)}</Badge>
                      </div>
                      <div className="text-emerald-600 mt-1">
                        {lot.itemCode} - {formatNumber(lot.quantity)} {lot.unit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Forward Trace (Destination Lots) */}
            {traceData.forward && traceData.forward.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-purple-800">
                  <ArrowRight className="h-4 w-4" />
                  {t('lots.trace.destinationLots')}
                </h3>
                <div className="space-y-2">
                  {traceData.forward.map((lot: TraceLot, idx: number) => (
                    <div key={idx} className="p-3 bg-purple-50 rounded-lg text-sm border border-purple-200">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-purple-800">{lot.lotNumber}</span>
                        <Badge variant={getStatusVariant(lot.status)} size="sm">{t(`lots.status.${lot.status}`)}</Badge>
                      </div>
                      <div className="text-purple-600 mt-1">
                        {lot.itemCode} - {formatNumber(lot.quantity)} {lot.unit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(!traceData.backward || traceData.backward.length === 0) &&
             (!traceData.forward || traceData.forward.length === 0) && (
              <div className="text-center text-gray-500 py-8">
                <RefreshCcw className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>{t('lots.trace.noTraceData')}</p>
              </div>
            )}

            <div className="flex justify-end mt-6 pt-4 border-t">
              <DxButton text={t('lots.trace.close')} type="default" stylingMode="outlined" onClick={() => setShowTraceModal(false)} />
            </div>
          </div>
        )}
      </DxPopup>

      {/* Item Selection Dialog */}
      <ItemSearchDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        onSelect={handleSelectItem}
        title={t('lots.form.selectItem')}
        showPrice="cost"
        showStock={true}
      />

      {/* Lot Import Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">นำเข้า Inventory Lots</h2>
              <button onClick={() => setShowImportDialog(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <strong>หมายเหตุ:</strong> Lot ที่นำเข้าจะอยู่สถานะ <strong>Quarantine</strong> อัตโนมัติ และสร้าง Transaction (Receive) ให้ทุกรายการ
              </div>
              <div>
                <span className="block text-sm font-medium text-gray-700 mb-2">เลือกไฟล์ Excel</span>
                <label
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer ${importingLots ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <input type="file" accept=".xlsx,.xls" onChange={handleImportLots} className="sr-only" />
                  <Upload className="h-5 w-5" />{importingLots ? 'กำลังนำเข้า...' : 'คลิกเพื่อเลือกไฟล์ (.xlsx)'}
                </label>
                <p className="mt-2 text-xs text-gray-500">ฟิลด์บังคับ: เลข Lot, รหัสสินค้า, คลังสินค้า, จำนวน, หน่วย</p>
              </div>
              {importLog.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 border">
                  <label className="block text-sm font-medium text-gray-700 mb-2">ผลการนำเข้า:</label>
                  <div className="text-xs font-mono space-y-0.5 max-h-40 overflow-y-auto">
                    {importLog.map((line, i) => <div key={i} className={line.includes('❌') ? 'text-red-600' : 'text-gray-700'}>{line}</div>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}


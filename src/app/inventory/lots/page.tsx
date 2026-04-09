'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  Download, Upload, X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ItemSearchDialog, type Item as SearchItem } from '@/components/ui/item-search-dialog';
import type { DataGridTypes } from 'devextreme-react/data-grid';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';

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
  bgColor: string;
  textColor: string;
  icon: React.ReactNode;
}> = {
  '': {
    translationKey: 'all',
    bgColor: 'bg-gray-900',
    textColor: 'text-white',
    icon: <Boxes className="h-4 w-4" />,
  },
  quarantine: {
    translationKey: 'quarantine',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    icon: <Clock className="h-4 w-4" />,
  },
  released: {
    translationKey: 'released',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    icon: <CheckCircle className="h-4 w-4" />,
  },
  rejected: {
    translationKey: 'rejected',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    icon: <XCircle className="h-4 w-4" />,
  },
  blocked: {
    translationKey: 'blocked',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
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

export default function LotsPage() {
  const router = useRouter();
  const t = useTranslations('inventory');
  const [activeTab, setActiveTab] = useState('lots');
  const [lots, setLots] = useState<Lot[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusType>('');
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

  const handleDownloadLotTemplate = async () => {
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
    // Fetch warehouses for lookup + validation
    let warehouseNames: string[] = [];
    try {
      const whRes = await fetch('/api/warehouses');
      const whData = await whRes.json();
      warehouseNames = ((whData.data || []) as { name: string }[]).map(w => w.name);
    } catch { /* ignore */ }

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
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames.find(n => n !== 'คำแนะนำ') || workbook.SheetNames[0];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets[sheetName]);
        if (jsonData.length === 0) { toast.error('ไม่พบข้อมูลในไฟล์'); return; }

        // Lookup items and warehouses
        const itemsRes = await fetch('/api/items?limit=9999');
        const itemsData = await (itemsRes.json());
        const allItems = (itemsData.data?.items || []) as { id: number; code: string }[];

        const whRes = await fetch('/api/warehouses');
        const whData = await (whRes.json());
        const allWarehouses = (whData.data || []) as { id: number; name: string }[];

        setImportingLots(true);
        const log: string[] = [];
        let success = 0;
        const errors: string[] = [];

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          const lotNumber = String(row['เลข Lot (Lot Number)*'] ?? row['lotNumber'] ?? '').trim();
          const itemCode = String(row['รหัสสินค้า (Item Code)*'] ?? row['itemCode'] ?? '').trim();
          const whName = String(row['คลังสินค้า (Warehouse)*'] ?? row['warehouseName'] ?? '').trim();
          const qty = Number(row['จำนวน (Quantity)*'] ?? row['quantity'] ?? 0);
          const unit = String(row['หน่วย (Unit)*'] ?? row['unit'] ?? '').trim();

          if (!lotNumber || !itemCode || !whName || !qty || !unit) {
            errors.push(`แถว ${i+2}: ข้อมูลบังคับไม่ครบ`); continue;
          }

          const item = allItems.find(it => it.code === itemCode);
          if (!item) { errors.push(`แถว ${i+2}: ไม่พบสินค้า ${itemCode}`); continue; }

          const wh = allWarehouses.find(w => w.name.toLowerCase() === whName.toLowerCase());
          if (!wh) { errors.push(`แถว ${i+2}: ไม่พบคลัง "${whName}"`); continue; }

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
        }

        log.push(`✅ นำเข้า ${success}/${jsonData.length} Lot สำเร็จ (สถานะ: Quarantine)`);
        if (errors.length > 0) log.push(...errors.slice(0, 5).map(e => `❌ ${e}`));
        setImportLog(log);
        setImportingLots(false);
        if (success > 0) fetchLots();
      } catch { toast.error('อ่านไฟล์ไม่ได้'); setImportingLots(false); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };
  const [showQCModal, setShowQCModal] = useState(false);
  const [showTraceModal, setShowTraceModal] = useState(false);
  const [qcLot, setQcLot] = useState<Lot | null>(null);
  const [traceLot, setTraceLot] = useState<Lot | null>(null);
  const [traceData, setTraceData] = useState<TraceData | null>(null);
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
      errors.lotNumber = 'Lot number is required';
    }

    if (!formData.itemId || formData.itemId === 0) {
      errors.itemId = 'Please select an item';
    }

    if (!formData.warehouseId || formData.warehouseId === 0) {
      errors.warehouseId = 'Please select a warehouse';
    }

    if (!formData.quantity || formData.quantity <= 0) {
      errors.quantity = 'Quantity must be greater than 0';
    }

    if (!formData.expiryDate) {
      errors.expiryDate = 'Expiry date is required';
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiryDate = new Date(formData.expiryDate);
      if (expiryDate <= today) {
        errors.expiryDate = 'Expiry date must be in the future';
      }
    }

    if (formData.manufacturingDate && formData.expiryDate) {
      const mfgDate = new Date(formData.manufacturingDate);
      const expDate = new Date(formData.expiryDate);
      if (mfgDate >= expDate) {
        errors.manufacturingDate = 'Manufacturing date must be before expiry date';
      }
    }

    if (!formData.cost || formData.cost <= 0) {
      errors.cost = 'Cost per unit is required and must be greater than 0';
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

    return result;
  }, [lots, statusFilter, search, warehouseFilter, expiryFrom, expiryTo, receivedFrom, receivedTo, quickFilter]);

  const fetchMasterData = async () => {
    try {
      const [warehousesRes, vendorsRes] = await Promise.all([
        fetch('/api/warehouses?limit=100'),
        fetch('/api/vendors?limit=100'),
      ]);

      const [warehousesData, vendorsData] = await Promise.all([
        warehousesRes.json(),
        vendorsRes.json(),
      ]);

      if (warehousesData.success) setWarehouses(warehousesData.data?.items || []);
      if (vendorsData.success) setVendors(vendorsData.data?.items || []);
    } catch (error) {
      console.error('Failed to fetch master data:', error);
    }
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

  const generateLotNumber = () => {
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
      dataField: 'lotNumber',
      caption: t('lots.grid.columns.lotNumber'),
      minWidth: 180,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2">
          <span className={cn('p-1 rounded', STATUS_CONFIG[cellInfo.data.status as StatusType]?.bgColor, STATUS_CONFIG[cellInfo.data.status as StatusType]?.textColor)}>
            {STATUS_CONFIG[cellInfo.data.status as StatusType]?.icon}
          </span>
          <span className="font-mono text-emerald-600 hover:text-emerald-800">{cellInfo.data.lotNumber}</span>
        </div>
      ),
    },
    {
      dataField: 'vendorLotNumber',
      caption: t('lots.grid.columns.vendorLotNumber'),
      minWidth: 140,
      hideOnMobile: true,
      cellRender: (cellInfo) => (
        <span className="text-gray-700">{cellInfo.data.vendorLotNumber || '-'}</span>
      ),
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
          <p className="font-medium text-gray-900">{Number(cellInfo.data.quantity).toLocaleString()} <span className="text-xs text-gray-500 font-normal">{cellInfo.data.unit}</span></p>
          {cellInfo.data.reservedQuantity > 0 && (
            <p className="text-xs text-orange-600 flex items-center gap-1">
              <Clock className="h-3 w-3" /> {t('lots.reserved')}: {Number(cellInfo.data.reservedQuantity).toLocaleString()}
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  fetchLots().then(() => {
                    toast.success('รีเฟรชข้อมูลสำเร็จ');
                  }).catch(() => {
                    toast.error('เกิดข้อผิดพลาดในการรีเฟรชข้อมูล');
                  });
                }}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                {isLoading ? 'กำลังโหลด...' : t('common.refresh')}
              </button>
              <button
                onClick={() => router.push('/inventory/items')}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Package className="h-4 w-4" />
                {t('lots.viewItems')}
              </button>
              {isAdmin && (
                <>
                  <button onClick={handleDownloadLotTemplate} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <Download className="h-4 w-4" /> Template
                  </button>
                  <button onClick={() => { setShowImportDialog(true); setImportLog([]); }} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                    <Upload className="h-4 w-4" /> นำเข้า Excel
                  </button>
                </>
              )}
              <button
                onClick={() => { resetForm(); setShowModal(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                <Plus className="h-4 w-4" />
                {t('lots.addLot')}
              </button>
            </div>
          }
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="lots">รายการ Lot</TabsTrigger>
            <TabsTrigger value="requisitions">ใบเบิกวัตถุดิบ</TabsTrigger>
          </TabsList>
          <TabsContent value="lots">
        {/* DataGrid Card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* Tabs + Stats Header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              {/* Status Tabs */}
              <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200 overflow-x-auto">
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
                          ? status === '' ? 'bg-gray-900 text-white' : `${config.bgColor} ${config.textColor}`
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      )}
                    >
                      {config.icon}
                      {status === '' ? t('common.all') : t(`lots.status.${config.translationKey}`)}
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded-full',
                        statusFilter === status ? (status === '' ? 'bg-gray-700' : 'bg-white/50') : 'bg-gray-200'
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
                  <span>{stats.totalQuantity.toLocaleString()} {t('common.units')}</span>
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

          {/* Search & Filters — Single Line */}
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="w-48">
                <DxTextBox
                  placeholder={t('lots.searchPlaceholder')}
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  mode="search"
                  onEnterKey={() => fetchLots()}
                />
              </div>
              {/* Warehouse */}
              <div className="w-44">
                <DxSelectBox
                  items={[{ value: '', label: 'คลัง: ทั้งหมด' }, ...warehouses.map(w => ({ value: w.id, label: w.name }))]}
                  value={warehouseFilter}
                  onValueChange={(v) => setWarehouseFilter(v || '')}
                />
              </div>
              {/* Expiry date range */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400 whitespace-nowrap">หมดอายุ</span>
                <div className="w-32"><DxDateBox value={expiryFrom} onValueChange={(v) => setExpiryFrom(v || '')} placeholder="ตั้งแต่" /></div>
                <span className="text-gray-400">-</span>
                <div className="w-32"><DxDateBox value={expiryTo} onValueChange={(v) => setExpiryTo(v || '')} placeholder="ถึง" /></div>
              </div>
              <div className="hidden lg:block h-5 w-px bg-gray-300" />
              {/* Quick Filter Tags */}
              {([
                { key: 'near_expiry' as QuickFilter, label: '≤30 วัน', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: <CalendarClock className="h-3.5 w-3.5" /> },
                { key: 'expired' as QuickFilter, label: 'หมดอายุ', color: 'text-red-700 bg-red-50 border-red-200', icon: <XCircle className="h-3.5 w-3.5" /> },
                { key: 'raw_material' as QuickFilter, label: 'วัตถุดิบ', color: 'text-blue-700 bg-blue-50 border-blue-200', icon: <Package className="h-3.5 w-3.5" /> },
                { key: 'finished_goods' as QuickFilter, label: 'สำเร็จรูป', color: 'text-purple-700 bg-purple-50 border-purple-200', icon: <Boxes className="h-3.5 w-3.5" /> },
              ]).map((tag) => (
                <button
                  key={tag.key}
                  onClick={() => setQuickFilter(quickFilter === tag.key ? '' : tag.key)}
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
                    quickFilter === tag.key ? tag.color : 'text-gray-500 bg-white border-gray-200 hover:bg-gray-50'
                  )}
                >
                  {tag.icon}
                  {tag.label}
                </button>
              ))}
              {/* Clear all filters */}
              {(warehouseFilter || expiryFrom || expiryTo || quickFilter || search) && (
                <button
                  onClick={() => { setSearch(''); setWarehouseFilter(''); setExpiryFrom(''); setExpiryTo(''); setReceivedFrom(''); setReceivedTo(''); setQuickFilter(''); }}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                >
                  <RefreshCcw className="h-3 w-3" />
                  ล้าง
                </button>
              )}
            </div>
          </div>

          {/* DataGrid */}
          <div className="p-4">
            {filteredLots.length > 0 || isLoading ? (
              <DxDataGrid
                dataSource={filteredLots}
                keyExpr="id"
                columns={columns}
                loading={isLoading}
                sorting
                headerFilter
                export
                exportFileName="inventory-lots"
                columnChooser
                wordWrapEnabled
                columnAutoWidth
                allowColumnResizing
                paging
                pageSize={20}
                height={600}
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
          </TabsContent>
          <TabsContent value="requisitions">
            <RequisitionTab />
          </TabsContent>
        </Tabs>
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
        height="auto"
        maxHeight="90vh"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Package className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-medium text-emerald-800">{t('lots.form.receiveTitle')}</p>
              <p className="text-sm text-emerald-600">{t('lots.form.initialStatus')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                onValueChange={(v) => setFormData(prev => ({ ...prev, vendorLotNumber: v }))}
                placeholder={t('lots.form.vendorLotPlaceholder')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('lots.form.quantity')} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
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

          <div className="grid grid-cols-3 gap-4">
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
              <Package className="h-4 w-4 text-blue-500" />
              {t('lots.form.gmpSection')}
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
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

            <div className="grid grid-cols-3 gap-4 mb-4">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
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

          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton text={t('lots.form.cancel')} type="default" stylingMode="outlined" onClick={() => setShowModal(false)} />
            <DxButton text={t('lots.form.submit')} icon="check" type="success" onClick={handleCreateLot} />
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
          height="auto"
        >
          <div className="p-6">
            <div className="flex items-center gap-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200 mb-6">
              <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="font-bold text-yellow-800">{qcLot.lotNumber}</p>
                <p className="text-sm text-yellow-600">{t('lots.qc.awaitingDecision')}</p>
              </div>
            </div>

            <div className="space-y-3 mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between">
                <span className="text-gray-600">{t('lots.qc.item')}:</span>
                <span className="font-medium">{qcLot.itemCode} - {qcLot.itemName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('lots.qc.quantity')}:</span>
                <span className="font-medium">{Number(qcLot.quantity)?.toLocaleString()} {qcLot.unit}</span>
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

            <div className="flex justify-end gap-3">
              <DxButton text={t('lots.qc.cancel')} type="default" stylingMode="outlined" onClick={() => setShowQCModal(false)} />
              <DxButton text={t('lots.qc.reject')} icon="close" type="danger" onClick={() => handleQCAction('reject')} />
              <DxButton text={t('lots.qc.release')} icon="check" type="success" onClick={() => handleQCAction('release')} />
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
        height="auto"
        maxHeight="90vh"
      >
        {traceLot && traceData && (
          <div className="p-6">
            {/* Current Lot Info */}
            <div className="mb-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Boxes className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-800">{traceLot.lotNumber}</h3>
                  <p className="text-sm text-emerald-600">{t('lots.trace.currentLot')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">{t('lots.trace.item')}:</span>
                  <span className="font-medium">{traceLot.itemCode}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">{t('lots.trace.quantity')}:</span>
                  <span className="font-medium">{Number(traceLot.quantity)?.toLocaleString()} {traceLot.unit}</span>
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
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-blue-800">
                  <ArrowRight className="h-4 w-4 rotate-180" />
                  {t('lots.trace.sourceLots')}
                </h3>
                <div className="space-y-2">
                  {traceData.backward.map((lot: TraceLot, idx: number) => (
                    <div key={idx} className="p-3 bg-blue-50 rounded-lg text-sm border border-blue-200">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-blue-800">{lot.lotNumber}</span>
                        <Badge variant={getStatusVariant(lot.status)} size="sm">{t(`lots.status.${lot.status}`)}</Badge>
                      </div>
                      <div className="text-blue-600 mt-1">
                        {lot.itemCode} - {lot.quantity?.toLocaleString()} {lot.unit}
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
                        {lot.itemCode} - {lot.quantity?.toLocaleString()} {lot.unit}
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
          <input ref={lotFileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImportLots} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
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
                <label className="block text-sm font-medium text-gray-700 mb-2">เลือกไฟล์ Excel</label>
                <button
                  onClick={() => lotFileInputRef.current?.click()}
                  disabled={importingLots}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  <Upload className="h-5 w-5" />{importingLots ? 'กำลังนำเข้า...' : 'คลิกเพื่อเลือกไฟล์ (.xlsx)'}
                </button>
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

function RequisitionTab() {
  const [filter, setFilter] = useState('requested');
  const [expandedWo, setExpandedWo] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: requisitions = [], isLoading } = useQuery({
    queryKey: ['inventory-requisitions', filter],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/requisitions?status=${filter}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (workOrderId: number) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/requisition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-requisitions'] });
      toast.success('อนุมัติปล่อยวัตถุดิบเรียบร้อย');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'ไม่สามารถอนุมัติได้');
    },
  });

  return (
    <div className="space-y-4">
      {/* Filter buttons */}
      <div className="flex gap-2">
        {[
          { value: 'requested', label: 'รออนุมัติ' },
          { value: 'approved', label: 'อนุมัติแล้ว' },
          { value: 'all', label: 'ทั้งหมด' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              filter === f.value
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && requisitions.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>ไม่มีใบเบิกวัตถุดิบ</p>
        </div>
      )}

      {/* Requisition cards */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {requisitions.map((req: any) => (
        <div key={req.workOrderId} className="bg-white border rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-indigo-700">{req.woNumber}</span>
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    req.requisitionStatus === 'requested' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                  )}>
                    {req.requisitionStatus === 'requested' ? 'รออนุมัติ' : 'อนุมัติแล้ว'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  Batch: {req.batchNumber} | {req.productName}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  ขอเบิกโดย: {req.requestedBy || '-'} | {req.requestedAt ? new Date(req.requestedAt).toLocaleString('th-TH') : '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpandedWo(expandedWo === req.workOrderId ? null : req.workOrderId)}
                className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1"
              >
                {expandedWo === req.workOrderId ? 'ซ่อน' : 'ดูวัตถุดิบ'}
              </button>
              {req.requisitionStatus === 'requested' && (
                <button
                  onClick={() => approveMutation.mutate(req.workOrderId)}
                  disabled={approveMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {approveMutation.isPending ? 'กำลังอนุมัติ...' : 'อนุมัติปล่อยของ'}
                </button>
              )}
            </div>
          </div>

          {/* Expanded materials list */}
          {expandedWo === req.workOrderId && req.materials?.length > 0 && (
            <div className="border-t bg-gray-50 p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="pb-2">รหัสสินค้า</th>
                    <th className="pb-2">ชื่อวัตถุดิบ</th>
                    <th className="pb-2 text-right">จำนวนที่ต้องการ</th>
                    <th className="pb-2 text-right">คงเหลือในคลัง</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {req.materials.map((mat: any, idx: number) => {
                    let available = Number(mat.releasedAvailable ?? mat.onHand) || 0;
                    // Convert available stock (primaryUnit) to material unit if different
                    // e.g., inventory in kg, material needs g → multiply by conversionRate
                    if (mat.unit && mat.secondaryUnit && mat.conversionRate &&
                        mat.unit === mat.secondaryUnit && Number(mat.conversionRate) > 0) {
                      available = available * Number(mat.conversionRate);
                    }
                    const planned = Number(mat.plannedQuantity) || 0;
                    const isShort = available < planned;
                    const unit = mat.unit || mat.itemUnit || '';
                    return (
                      <tr key={idx} className="border-t border-gray-200">
                        <td className="py-1.5 font-mono text-xs">{mat.itemCode}</td>
                        <td className="py-1.5">{mat.itemName}</td>
                        <td className="py-1.5 text-right">{Number(mat.plannedQuantity).toLocaleString()} {unit}</td>
                        <td className={`py-1.5 text-right font-medium ${isShort ? 'text-red-600' : 'text-green-600'}`}>
                          {available.toLocaleString()} {unit}
                          {isShort && <span className="ml-1 text-xs text-red-500">(ไม่พอ)</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

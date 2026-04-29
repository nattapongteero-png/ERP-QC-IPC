'use client';

/**
 * Inventory Items Page
 *
 * Clean, professional data-focused page for managing inventory items.
 * Redesigned with DevExtreme UI components.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { PageHeader } from '@/components/ui/page-header';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  SearchPanel,
  HeaderFilter,
  ColumnChooser,
  Export,
  Grouping,
  GroupPanel,
  Summary,
  TotalItem,
  Toolbar,
  Item as ToolbarItem,
} from 'devextreme-react/data-grid';
import { Workbook } from 'exceljs';
import { saveAs } from 'file-saver';
import { exportDataGrid } from 'devextreme/excel_exporter';
import type { ExportingEvent } from 'devextreme/ui/data_grid';
import {
  Leaf,
  FlaskConical,
  Box,
  Pill,
  Package,
  RefreshCw,
  Plus,
  Eye,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Warehouse,
  Clock,
  Download,
  Upload,
  X,
  CheckSquare,
  Square,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ItemEditDialog, Item, ItemFormData } from '@/components/ui/item-edit-dialog';
import { DxConfirmDialog } from '@/components/ui/dx-popup';
import { cn } from '@/lib/utils/cn';

// ============================================
// Helper Functions
// ============================================

/**
 * Format number with comma separators and 2 decimal places
 * e.g., 11200 -> "11,200.00", 11163.0341 -> "11,163.03"
 * Uses manual formatting to avoid SSR/client hydration mismatch from toLocaleString
 */
function formatCompactNumber(value: number | string): string {
  const num = Number(value);
  if (isNaN(num)) return '0.00';
  const fixed = Math.abs(num).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (num < 0 ? '-' : '') + withCommas + '.' + decPart;
}

// ============================================
// Constants
// ============================================

type ItemType = 'raw_material' | 'packaging' | 'wip' | 'finished_goods' | 'consumable';

const ITEM_TYPE_CONFIG: Record<ItemType, {
  translationKey: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  solidBg: string;
  topBorder: string;
  ring: string;
  iconBg: string;
  iconText: string;
  icon: React.ReactNode;
}> = {
  raw_material: {
    translationKey: 'rawMaterial',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    solidBg: 'bg-blue-600',
    topBorder: 'border-t-blue-500',
    ring: 'ring-blue-200',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-700',
    icon: <Leaf className="h-4 w-4" />,
  },
  packaging: {
    translationKey: 'packaging',
    bgColor: 'bg-cyan-50',
    textColor: 'text-cyan-700',
    borderColor: 'border-cyan-200',
    solidBg: 'bg-cyan-600',
    topBorder: 'border-t-cyan-500',
    ring: 'ring-cyan-200',
    iconBg: 'bg-cyan-100',
    iconText: 'text-cyan-700',
    icon: <Box className="h-4 w-4" />,
  },
  wip: {
    translationKey: 'wip',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
    solidBg: 'bg-orange-600',
    topBorder: 'border-t-orange-500',
    ring: 'ring-orange-200',
    iconBg: 'bg-orange-100',
    iconText: 'text-orange-700',
    icon: <FlaskConical className="h-4 w-4" />,
  },
  finished_goods: {
    translationKey: 'finishedGoods',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    solidBg: 'bg-emerald-600',
    topBorder: 'border-t-emerald-500',
    ring: 'ring-emerald-200',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-700',
    icon: <Pill className="h-4 w-4" />,
  },
  consumable: {
    translationKey: 'consumable',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-200',
    solidBg: 'bg-slate-600',
    topBorder: 'border-t-slate-500',
    ring: 'ring-slate-200',
    iconBg: 'bg-slate-100',
    iconText: 'text-slate-700',
    icon: <Package className="h-4 w-4" />,
  },
};

// ============================================
// API Functions
// ============================================

async function fetchItems(): Promise<Item[]> {
  const response = await fetch('/api/items?limit=1000');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data?.items || [];
}

// ============================================
// Main Component
// ============================================

export default function ItemsPage() {
  const router = useRouter();
  const t = useTranslations('inventory');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'all' | ItemType>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; item: Item | null }>({ open: false, item: null });
  const [isAdmin, setIsAdmin] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(d => {
      if (d.success && d.data?.user?.role?.toLowerCase() === 'admin') setIsAdmin(true);
    }).catch(() => {});
  }, []);

  // ─── Item Import Config ─────────────────────────────────────
  const ITEM_TYPES_CONFIG = [
    { key: 'raw_material', label: 'วัตถุดิบ (Raw Material)', sheetName: 'Raw Material' },
    { key: 'packaging', label: 'บรรจุภัณฑ์ (Packaging)', sheetName: 'Packaging' },
    { key: 'finished_goods', label: 'สินค้าสำเร็จรูป (Finished Goods)', sheetName: 'Finished Goods' },
    { key: 'wip', label: 'งานระหว่างผลิต (WIP)', sheetName: 'WIP' },
    { key: 'consumable', label: 'วัสดุสิ้นเปลือง (Consumable)', sheetName: 'Consumable' },
  ];
  const ALL_TYPE_KEYS = ITEM_TYPES_CONFIG.map(t => t.key);

  const ITEM_COLUMNS = [
    { header: 'รหัส (Code)*', field: 'code', required: false },
    { header: 'ชื่อ TH (Name TH)*', field: 'nameTh', required: true },
    { header: 'ชื่อ EN (Name EN)', field: 'nameEn', required: false },
    { header: 'หมวดหมู่ (Category)', field: 'category', required: false },
    { header: 'หน่วยหลัก (Primary Unit)*', field: 'primaryUnit', required: true },
    { header: 'หน่วยรอง (Secondary Unit)', field: 'secondaryUnit', required: false },
    { header: 'อัตราแปลง (Conversion Rate)', field: 'conversionRate', required: false },
    { header: 'อายุการเก็บ (วัน)', field: 'shelfLifeDays', required: false },
    { header: 'เงื่อนไขจัดเก็บ', field: 'storageCondition', required: false },
    { header: 'สต็อกขั้นต่ำ', field: 'minStock', required: false },
    { header: 'สต็อกสูงสุด', field: 'maxStock', required: false },
    { header: 'จุดสั่งซื้อ', field: 'reorderPoint', required: false },
  ];

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    // Instruction
    const instr = [
      ['Template นำเข้ารายการสินค้า — Herbal Medicine ERP'],
      [''], ['แต่ละ Sheet = ประเภทสินค้า 1 ประเภท, กรอกข้อมูลใน Sheet ที่ต้องการ'],
      ['ฟิลด์ที่มี * = บังคับ, Code ถ้าไม่กรอกระบบสร้างให้อัตโนมัติ'],
      [''], ['Sheet', 'ประเภท', 'ฟิลด์บังคับ'],
      ...ITEM_TYPES_CONFIG.map(tc => [tc.sheetName, tc.key, 'ชื่อ TH, หน่วยหลัก']),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instr), 'คำแนะนำ');

    // Data sheets per type
    const EXAMPLE_DATA: Record<string, Record<string, string | number>[]> = {
      raw_material: [
        { 'รหัส (Code)*': 'RM-0001', 'ชื่อ TH (Name TH)*': 'การบูร', 'ชื่อ EN (Name EN)': 'Camphor', 'หมวดหมู่ (Category)': 'herb', 'หน่วยหลัก (Primary Unit)*': 'kg', 'หน่วยรอง (Secondary Unit)': 'g', 'อัตราแปลง (Conversion Rate)': 1000, 'อายุการเก็บ (วัน)': 730, 'เงื่อนไขจัดเก็บ': 'เก็บที่อุณหภูมิห้อง แห้ง', 'สต็อกขั้นต่ำ': 50, 'สต็อกสูงสุด': 500, 'จุดสั่งซื้อ': 100 },
        { 'รหัส (Code)*': 'RM-0002', 'ชื่อ TH (Name TH)*': 'พิมเสน', 'ชื่อ EN (Name EN)': 'Borneol', 'หมวดหมู่ (Category)': 'herb', 'หน่วยหลัก (Primary Unit)*': 'kg', 'หน่วยรอง (Secondary Unit)': 'g', 'อัตราแปลง (Conversion Rate)': 1000, 'อายุการเก็บ (วัน)': 365, 'เงื่อนไขจัดเก็บ': 'เก็บในภาชนะปิดสนิท', 'สต็อกขั้นต่ำ': 30, 'สต็อกสูงสุด': 300, 'จุดสั่งซื้อ': 60 },
      ],
      packaging: [
        { 'รหัส (Code)*': 'RP-0001', 'ชื่อ TH (Name TH)*': 'ขวดแก้วขนาด 10 มล', 'ชื่อ EN (Name EN)': 'Glass Bottle 10mL', 'หมวดหมู่ (Category)': 'bottle', 'หน่วยหลัก (Primary Unit)*': 'box', 'หน่วยรอง (Secondary Unit)': 'pcs', 'อัตราแปลง (Conversion Rate)': 100, 'อายุการเก็บ (วัน)': '', 'เงื่อนไขจัดเก็บ': 'เก็บในที่แห้ง', 'สต็อกขั้นต่ำ': 1000, 'สต็อกสูงสุด': 10000, 'จุดสั่งซื้อ': 2000 },
        { 'รหัส (Code)*': 'RP-0002', 'ชื่อ TH (Name TH)*': 'ฉลากยาสมุนไพร', 'ชื่อ EN (Name EN)': 'Herbal Product Label', 'หมวดหมู่ (Category)': 'label', 'หน่วยหลัก (Primary Unit)*': 'roll', 'หน่วยรอง (Secondary Unit)': 'pcs', 'อัตราแปลง (Conversion Rate)': 500, 'อายุการเก็บ (วัน)': '', 'เงื่อนไขจัดเก็บ': 'เก็บในที่แห้ง หลีกเลี่ยงแสงแดด', 'สต็อกขั้นต่ำ': 500, 'สต็อกสูงสุด': 5000, 'จุดสั่งซื้อ': 1000 },
      ],
      finished_goods: [
        { 'รหัส (Code)*': 'FG-0001', 'ชื่อ TH (Name TH)*': 'ยาหม่องสมุนไพร 10g', 'ชื่อ EN (Name EN)': 'Herbal Balm 10g', 'หมวดหมู่ (Category)': 'finished', 'หน่วยหลัก (Primary Unit)*': 'box', 'หน่วยรอง (Secondary Unit)': 'bottle', 'อัตราแปลง (Conversion Rate)': 12, 'อายุการเก็บ (วัน)': 1095, 'เงื่อนไขจัดเก็บ': 'เก็บที่อุณหภูมิไม่เกิน 30°C', 'สต็อกขั้นต่ำ': 100, 'สต็อกสูงสุด': 5000, 'จุดสั่งซื้อ': 500 },
        { 'รหัส (Code)*': 'FG-0002', 'ชื่อ TH (Name TH)*': 'แคปซูลฟ้าทะลายโจร 400mg', 'ชื่อ EN (Name EN)': 'Andrographis Capsule 400mg', 'หมวดหมู่ (Category)': 'finished', 'หน่วยหลัก (Primary Unit)*': 'box', 'หน่วยรอง (Secondary Unit)': 'bottle', 'อัตราแปลง (Conversion Rate)': 6, 'อายุการเก็บ (วัน)': 730, 'เงื่อนไขจัดเก็บ': 'เก็บในที่แห้ง พ้นแสงแดด', 'สต็อกขั้นต่ำ': 200, 'สต็อกสูงสุด': 10000, 'จุดสั่งซื้อ': 1000 },
      ],
      wip: [
        { 'รหัส (Code)*': 'WIP-0001', 'ชื่อ TH (Name TH)*': 'ผงสมุนไพรผสม สูตร A', 'ชื่อ EN (Name EN)': 'Herbal Powder Mix Formula A', 'หมวดหมู่ (Category)': 'semi_finished', 'หน่วยหลัก (Primary Unit)*': 'kg', 'หน่วยรอง (Secondary Unit)': 'g', 'อัตราแปลง (Conversion Rate)': 1000, 'อายุการเก็บ (วัน)': 180, 'เงื่อนไขจัดเก็บ': 'เก็บในถุงปิดสนิท อุณหภูมิห้อง', 'สต็อกขั้นต่ำ': 10, 'สต็อกสูงสุด': 100, 'จุดสั่งซื้อ': 20 },
      ],
      consumable: [
        { 'รหัส (Code)*': 'CS-0001', 'ชื่อ TH (Name TH)*': 'ถุงมือยาง ไซส์ M', 'ชื่อ EN (Name EN)': 'Latex Gloves Size M', 'หมวดหมู่ (Category)': 'consumable', 'หน่วยหลัก (Primary Unit)*': 'box', 'หน่วยรอง (Secondary Unit)': 'pcs', 'อัตราแปลง (Conversion Rate)': 100, 'อายุการเก็บ (วัน)': 1825, 'เงื่อนไขจัดเก็บ': 'เก็บในที่แห้ง', 'สต็อกขั้นต่ำ': 20, 'สต็อกสูงสุด': 200, 'จุดสั่งซื้อ': 50 },
      ],
    };

    for (const tc of ITEM_TYPES_CONFIG) {
      const rows = EXAMPLE_DATA[tc.key] || [];
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = ITEM_COLUMNS.map(() => ({ wch: 25 }));
      XLSX.utils.book_append_sheet(wb, ws, tc.sheetName);
    }

    // Lookup sheet
    const lookupRows: string[][] = [
      ['ตัวเลือก (Lookup Values)'], [''],
      ['Category (หมวดหมู่)', ''], ['ค่า', 'คำอธิบาย'],
      ['herb', 'สมุนไพร'], ['extract', 'สารสกัด'], ['excipient', 'สารเติมแต่ง'],
      ['packaging', 'บรรจุภัณฑ์'], ['capsule', 'แคปซูล'], ['bottle', 'ขวด'],
      ['label', 'ฉลาก'], ['box', 'กล่อง'], ['finished', 'ผลิตภัณฑ์สำเร็จรูป'],
      ['semi_finished', 'กึ่งสำเร็จรูป'], ['consumable', 'วัสดุสิ้นเปลือง'],
      ['chemical', 'เคมีภัณฑ์'], ['other', 'อื่นๆ'],
      [''],
      ['Primary/Secondary Unit (หน่วย)', ''], ['ค่า', 'คำอธิบาย'],
      ['kg', 'กิโลกรัม'], ['g', 'กรัม'], ['mg', 'มิลลิกรัม'],
      ['l', 'ลิตร'], ['ml', 'มิลลิลิตร'], ['pcs', 'ชิ้น'],
      ['pack', 'แพ็ค'], ['box', 'กล่อง'], ['bottle', 'ขวด'],
      ['bag', 'ถุง'], ['roll', 'ม้วน'], ['sheet', 'แผ่น'],
      ['set', 'ชุด'], ['carton', 'ลัง'], ['drum', 'ถัง'],
      ['can', 'กระป๋อง'], ['tube', 'หลอด'], ['cap', 'ฝา'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lookupRows), 'ตัวเลือก (Lookup)');
    XLSX.writeFile(wb, 'Item_Import_Templates.xlsx');
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || selectedTypes.length === 0) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const log: string[] = [];
        setImporting(true);

        for (const typeKey of selectedTypes) {
          const tc = ITEM_TYPES_CONFIG.find(t => t.key === typeKey);
          if (!tc) continue;
          const sheetName = workbook.SheetNames.find(n => n === tc.sheetName || n.toLowerCase() === tc.sheetName.toLowerCase());
          if (!sheetName) { log.push(`⚠️ ไม่พบ Sheet "${tc.sheetName}"`); continue; }
          const jsonData = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets[sheetName]);
          if (jsonData.length === 0) { log.push(`⚠️ ${tc.label}: ไม่มีข้อมูล`); continue; }

          let success = 0, created = 0, updated = 0;
          const errors: string[] = [];

          for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            const nameTh = String(row['ชื่อ TH (Name TH)*'] ?? row['nameTh'] ?? '').trim();
            const primaryUnit = String(row['หน่วยหลัก (Primary Unit)*'] ?? row['primaryUnit'] ?? '').trim();
            if (!nameTh || !primaryUnit) { errors.push(`แถว ${i+2}: ไม่มี ชื่อ TH หรือ หน่วยหลัก`); continue; }

            const payload: Record<string, unknown> = { type: tc.key, nameTh, primaryUnit, isActive: true };
            for (const col of ITEM_COLUMNS) {
              if (col.field === 'nameTh' || col.field === 'primaryUnit') continue;
              const val = String(row[col.header] ?? row[col.field] ?? '').trim();
              if (val) {
                const num = Number(val);
                payload[col.field] = !isNaN(num) && col.field.match(/Stock|Point|Rate|Days/) ? num : val;
              }
            }

            try {
              const res = await fetch('/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
              const result = await res.json();
              if (result.success) {
                success++;
                if (String(result.message).includes('updated')) updated++; else created++;
              } else {
                errors.push(`${payload.code || `แถว ${i+2}`}: ${result.error}`);
              }
            } catch (err) { errors.push(`แถว ${i+2}: ${err instanceof Error ? err.message : 'Error'}`); }
          }

          log.push(`✅ ${tc.label}: ${success}/${jsonData.length} สำเร็จ${created ? ` (สร้าง ${created})` : ''}${updated ? ` (อัปเดต ${updated})` : ''}`);
          if (errors.length > 0) log.push(...errors.slice(0, 3).map(e => `   ❌ ${e}`));
        }

        setImportLog(log);
        setImporting(false);
        refetch();
      } catch { setImporting(false); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  // Fetch data
  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ['items-list'],
    queryFn: fetchItems,
  });

  // Handle refresh - invalidate cache to force fresh fetch
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['items-list'] });
  }, [queryClient]);

  // Calculate type counts
  const typeCounts = useMemo(() => {
    const counts: Record<ItemType, number> = {
      raw_material: 0,
      packaging: 0,
      wip: 0,
      finished_goods: 0,
      consumable: 0,
    };
    items.forEach((item) => {
      const type = item.type as ItemType;
      if (counts[type] !== undefined) {
        counts[type]++;
      }
    });
    return counts;
  }, [items]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalValue = items.reduce((sum, item) => sum + (Number(item.onHandCost) || 0), 0);
    const totalQuantity = items.reduce((sum, item) => sum + (Number(item.onHand) || 0), 0);
    const totalQuarantine = items.reduce((sum, item) => sum + (Number(item.quarantineQty) || 0), 0);
    const itemsInQuarantine = items.filter((item) => (item.quarantineQty ?? 0) > 0).length;
    const lowStockItems = items.filter(
      (item) => item.minStock && item.onHand !== undefined && item.onHand < item.minStock
    ).length;
    const activeItems = items.filter((item) => item.isActive).length;
    const inactiveItems = items.filter((item) => !item.isActive).length;
    const vmiReadyItems = items.filter((item) => item.tppCode || item.ttmtCode).length;

    return {
      totalValue,
      totalQuantity,
      totalQuarantine,
      itemsInQuarantine,
      lowStockItems,
      activeItems,
      inactiveItems,
      vmiReadyItems,
    };
  }, [items]);

  // Filter items by tab and add row numbers
  const filteredItems = useMemo(() => {
    const filtered = activeTab === 'all' ? items : items.filter((item) => item.type === activeTab);
    // Add _rowNumber for stable display with virtual scrolling
    return filtered.map((item, index) => ({ ...item, _rowNumber: index + 1 }));
  }, [items, activeTab]);

  // Handlers
  const handleSave = async (formData: ItemFormData) => {
    const url = editingItem ? `/api/items/${editingItem.id}` : '/api/items';
    const method = editingItem ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const data = await res.json();
    if (data.success) {
      setDialogOpen(false);
      setEditingItem(null);
      refetch();
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.item) return;

    try {
      const res = await fetch(`/api/items/${deleteConfirm.item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        refetch();
      }
    } finally {
      setDeleteConfirm({ open: false, item: null });
    }
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  // "Download Excel" button — export ALL visible items (flat xlsx) without
  // going through the DataGrid toolbar. Keeps the current type/search filter
  // so the operator gets what they see.
  const handleDownloadData = () => {
    const rows = filteredItems.map((it) => ({
      'รหัส (Code)': it.code,
      'ชื่อ TH': it.nameTh,
      'ชื่อ EN': it.nameEn || '',
      'ประเภท': it.type,
      'หมวดหมู่': it.category || '',
      'หน่วยหลัก': it.primaryUnit,
      'หน่วยรอง': it.secondaryUnit || '',
      'อัตราแปลง': it.conversionFactor ?? '',
      'อายุการเก็บ (วัน)': it.shelfLifeDays ?? '',
      'เงื่อนไขจัดเก็บ': it.storageConditions || '',
      'สต็อกต่ำสุด': it.minStock ?? '',
      'สต็อกสูงสุด': it.maxStock ?? '',
      'จุดสั่งซื้อ': it.reorderPoint ?? '',
      'คงเหลือ (on_hand)': it.onHand ?? '',
      'สถานะ': it.isActive ? 'Active' : 'Inactive',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Array(15).fill({ wch: 18 });
    XLSX.utils.book_append_sheet(wb, ws, 'Items');
    const ts = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `items-${ts}.xlsx`);
  };

  // Excel export handler
  const onExporting = useCallback((e: ExportingEvent) => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Items');

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }) => {
        if (gridCell?.rowType === 'data') {
          if (gridCell.column?.dataField === 'type') {
            const type = gridCell.value as ItemType;
            const config = ITEM_TYPE_CONFIG[type];
            excelCell.value = config ? t(`items.types.${config.translationKey}`) : type;
          }
          if (gridCell.column?.dataField === 'isActive') {
            excelCell.value = gridCell.value ? t('items.status.active') : t('items.status.inactive');
          }
        }
      },
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), 'inventory-items.xlsx');
      });
    });
  }, [t]);

  // Custom cell renderers
  const renderCodeCell = useCallback((data: { data: Item }) => {
    const config = ITEM_TYPE_CONFIG[data.data.type as ItemType];
    return (
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-md border',
            config?.iconBg ?? 'bg-slate-50',
            config?.iconText ?? 'text-slate-700',
            config?.borderColor ?? 'border-slate-200'
          )}
        >
          {config?.icon}
        </span>
        <button
          onClick={() => router.push(`/inventory/items/${data.data.id}`)}
          className="font-mono text-sm font-semibold text-sky-700 hover:text-sky-800 hover:underline"
        >
          {data.data.code}
        </button>
      </div>
    );
  }, [router]);

  const renderNameCell = useCallback((data: { data: Item }) => {
    return (
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">{data.data.nameTh}</p>
        {data.data.nameEn && (
          <p className="text-xs text-gray-500 truncate">{data.data.nameEn}</p>
        )}
      </div>
    );
  }, []);

  const renderTypeCell = useCallback((data: { value: ItemType }) => {
    const config = ITEM_TYPE_CONFIG[data.value];
    if (!config) return data.value;
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-semibold border',
          config.bgColor,
          config.textColor,
          config.borderColor
        )}
      >
        {config.icon}
        {t(`items.types.${config.translationKey}`)}
      </span>
    );
  }, [t]);

  const renderStockCell = useCallback((data: { data: Item }) => {
    const onHand = data.data.onHand ?? 0;
    const minStock = data.data.minStock ?? 0;
    const isLow = minStock > 0 && onHand < minStock;
    const isZero = onHand === 0;

    return (
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'font-semibold text-sm tabular-nums',
            isLow ? 'text-rose-600' : isZero ? 'text-gray-400' : 'text-gray-900'
          )}
        >
          {formatCompactNumber(onHand)}
        </div>
        <span className="text-xs text-gray-500">{data.data.primaryUnit}</span>
        {isLow && (
          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-rose-600 text-white font-semibold rounded-full shadow-sm">
            <AlertTriangle className="h-2.5 w-2.5" />
            {t('items.grid.lowStock')}
          </span>
        )}
      </div>
    );
  }, [t]);

  const renderQuarantineCell = useCallback((data: { data: Item }) => {
    const quarantineQty = data.data.quarantineQty ?? 0;

    if (quarantineQty === 0) {
      return (
        <div className="text-gray-300 text-center">—</div>
      );
    }

    return (
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200"
        title={`${quarantineQty.toLocaleString()} ${data.data.primaryUnit}`}
      >
        <Clock className="h-3.5 w-3.5 text-amber-600" />
        <span className="font-semibold text-amber-700 text-xs tabular-nums">
          {formatCompactNumber(quarantineQty)}
        </span>
        <span className="text-[10px] text-amber-600/70">{data.data.primaryUnit}</span>
      </div>
    );
  }, []);

  const renderStatusCell = useCallback((data: { value: boolean }) => {
    return data.value ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-semibold border border-emerald-300 bg-emerald-50 text-emerald-800">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {t('items.status.active')}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-semibold border border-rose-300 bg-rose-50 text-rose-800">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        {t('items.status.inactive')}
      </span>
    );
  }, [t]);

  const renderVmiCell = useCallback((data: { data: Item }) => {
    const hasVmi = data.data.tppCode || data.data.ttmtCode;
    return hasVmi ? (
      <div
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
        title={`TPP: ${data.data.tppCode || '-'}, TTMT: ${data.data.ttmtCode || '-'}`}
      >
        <CheckCircle className="h-3.5 w-3.5" />
        <span className="text-[11px] font-semibold">{t('items.grid.vmiReady')}</span>
      </div>
    ) : (
      <div className="flex items-center gap-1 text-gray-300">
        <XCircle className="h-3.5 w-3.5" />
        <span className="text-xs">—</span>
      </div>
    );
  }, [t]);

  const renderActionsCell = useCallback((data: { data: Item }) => {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/inventory/items/${data.data.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title={t('items.buttons.viewDetails')}
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleEdit(data.data);
          }}
          className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
          title={t('items.buttons.edit')}
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDeleteConfirm({ open: true, item: data.data });
          }}
          className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          title={t('items.buttons.delete')}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }, [router, t]);

  const totalItems = items.length;

  return (
    <MainLayout>
      <div className="space-y-5">
        {/* Style E Hero — Pharma Pro */}
        <div className="bg-white rounded-md p-5 lg:p-6 border-2 border-sky-100">
          <div className="border-l-4 border-sky-600 bg-sky-50 rounded-r-md p-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-md bg-sky-600 flex items-center justify-center flex-shrink-0">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-sky-700 uppercase tracking-wider">
                  Pharmaceutical Inventory · Item Master · GMP-Audit-Ready
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5 truncate">
                  {t('items.pageTitle')}
                </h1>
                <p className="text-sm text-slate-600 mt-0.5 max-w-2xl">{t('items.description')}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-semibold border border-sky-300 bg-white text-sky-800">
                    <Package className="h-3 w-3 text-sky-700" />
                    <span className="text-slate-600">{t('common.itemsShown', { count: 0 }).replace(/\d+/, '').trim()}</span>
                    <span className="font-bold tabular-nums">{totalItems.toLocaleString()}</span>
                  </span>
                  {statistics.activeItems > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-semibold border border-emerald-300 bg-emerald-50 text-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="font-bold tabular-nums">{statistics.activeItems}</span>
                      <span>{t('stats.active')}</span>
                    </span>
                  )}
                  {statistics.lowStockItems > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-semibold border border-rose-300 bg-rose-50 text-rose-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span className="font-bold tabular-nums">{statistics.lowStockItems}</span>
                      <span>{t('stats.lowStock')}</span>
                    </span>
                  )}
                  {statistics.itemsInQuarantine > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-semibold border border-amber-300 bg-amber-50 text-amber-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="font-bold tabular-nums">{statistics.itemsInQuarantine}</span>
                      <span>{t('stats.inQuarantine')}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Style E action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-md border-2 transition',
                  isLoading
                    ? 'text-slate-400 bg-slate-50 border-slate-200 cursor-not-allowed'
                    : 'text-sky-700 bg-white border-sky-600 hover:bg-sky-50'
                )}
                title={t('common.refresh')}
              >
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                <span className="hidden sm:inline">{t('common.refresh')}</span>
              </button>
              <button
                onClick={() => router.push('/inventory/lots')}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-md border-2 border-sky-600 bg-white text-sky-700 hover:bg-sky-50 transition"
              >
                <Warehouse className="h-4 w-4" />
                <span className="hidden sm:inline">{t('items.viewLots')}</span>
              </button>
              <button
                onClick={handleDownloadData}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-md border-2 border-sky-600 bg-white text-sky-700 hover:bg-sky-50 transition"
                title="Download Excel"
              >
                <Download className="h-4 w-4" />
                <span className="hidden md:inline">Excel</span>
              </button>
              {isAdmin && (
                <>
                  <button
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-md border-2 border-sky-600 bg-white text-sky-700 hover:bg-sky-50 transition"
                    title={t('common.downloadTemplate')}
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden md:inline">{t('common.downloadTemplate')}</span>
                  </button>
                  <button
                    onClick={() => { setShowImportDialog(true); setImportLog([]); }}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-md border-2 border-sky-600 bg-white text-sky-700 hover:bg-sky-50 transition"
                  >
                    <Upload className="h-4 w-4" />
                    <span className="hidden md:inline">{t('common.importExcel')}</span>
                  </button>
                </>
              )}
              <button
                onClick={() => router.push('/inventory/items/new')}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md border-2 border-sky-600 bg-sky-600 text-white hover:bg-sky-700 hover:border-sky-700 transition"
              >
                <Plus className="h-4 w-4" />
                {t('items.addItem')}
              </button>
            </div>
          </div>
        </div>

        {/* Hidden PageHeader to keep import side-effect-free */}
        <span className="hidden">
          <PageHeader title={t('items.pageTitle')} description={t('items.description')} />
        </span>

        {/* Style E Stats strip — clinical accent borders */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {(Object.keys(ITEM_TYPE_CONFIG) as ItemType[]).map((type) => {
            const config = ITEM_TYPE_CONFIG[type];
            const count = typeCounts[type];
            const isActive = activeTab === type;
            return (
              <button
                key={type}
                onClick={() => setActiveTab(isActive ? 'all' : type)}
                className={cn(
                  'bg-white rounded-md border-2 p-4 text-left transition-colors hover:border-sky-400',
                  isActive ? 'border-sky-600 ring-2 ring-sky-200' : config.borderColor
                )}
              >
                <div className="flex items-start justify-between mb-3 pb-2 border-b border-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 truncate">
                    {t(`items.types.${config.translationKey}`)}
                  </p>
                  <span className={cn('w-4 h-4', config.iconText)}>
                    {config.icon}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] uppercase text-slate-500">Current</div>
                    <div className={cn('text-2xl font-bold tabular-nums', config.iconText)}>
                      {count.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-500">% Total</div>
                    <div className="text-sm font-semibold text-slate-700 tabular-nums">
                      {totalItems > 0 ? `${Math.round((count / totalItems) * 100)}%` : '0%'}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Style E DataGrid panel */}
        <div className="bg-white rounded-md border-2 border-slate-200 overflow-hidden">
          {/* Style E filter pill bar with sky panel header */}
          <div className="px-4 sm:px-5 py-4 bg-sky-50 border-b-2 border-sky-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              {/* Type filter pills (Style E) */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setActiveTab('all')}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md transition whitespace-nowrap border-2',
                    activeTab === 'all'
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-sky-400 hover:text-sky-700'
                  )}
                >
                  {t('common.all')}
                  <span
                    className={cn(
                      'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-[10px] font-bold rounded-sm tabular-nums',
                      activeTab === 'all' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-700'
                    )}
                  >
                    {totalItems}
                  </span>
                </button>
                {(Object.keys(ITEM_TYPE_CONFIG) as ItemType[]).map((type) => {
                  const config = ITEM_TYPE_CONFIG[type];
                  const isActive = activeTab === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setActiveTab(type)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md transition whitespace-nowrap border-2',
                        isActive
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-sky-400 hover:text-sky-700'
                      )}
                    >
                      {config.icon}
                      {t(`items.types.${config.translationKey}`)}
                      <span
                        className={cn(
                          'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-[10px] font-bold rounded-sm tabular-nums',
                          isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-700'
                        )}
                      >
                        {typeCounts[type]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Style E status badges with dot */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {statistics.lowStockItems > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-semibold border border-rose-300 bg-rose-50 text-rose-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span className="tabular-nums">{statistics.lowStockItems}</span> {t('stats.lowStock')}
                  </span>
                )}
                {statistics.itemsInQuarantine > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-semibold border border-amber-300 bg-amber-50 text-amber-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span className="tabular-nums">{statistics.itemsInQuarantine}</span> {t('stats.inQuarantine')}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-semibold border border-emerald-300 bg-emerald-50 text-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="tabular-nums">{statistics.activeItems}</span> {t('stats.active')}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-semibold border border-sky-300 bg-white text-sky-800">
                  <span className="tabular-nums">{t('common.itemsShown', { count: filteredItems.length })}</span>
                </span>
              </div>
            </div>
          </div>

          {/* DataGrid */}
          <DataGrid
            dataSource={filteredItems}
            keyExpr="id"
            showBorders={false}
            showRowLines={true}
            showColumnLines={false}
            rowAlternationEnabled={true}
            allowColumnReordering={true}
            allowColumnResizing={true}
            columnAutoWidth={true}
            wordWrapEnabled={true}
            onExporting={onExporting}
            onRowClick={(e) => {
              if (e.data?.id) {
                router.push(`/inventory/items/${e.data.id}`);
              }
            }}
            className="items-professional-grid"
          >
            <SearchPanel visible={true} placeholder={t('items.searchPlaceholder')} width={250} />
            <FilterRow visible={true} />
            <HeaderFilter visible={true} />
            <GroupPanel visible={true} />
            <Grouping autoExpandAll={false} />
            <ColumnChooser enabled={true} mode="select" />
            <Export enabled={true} />

            <Column
              dataField="_rowNumber"
              caption={t('items.grid.columns.rowNum')}
              width={60}
              alignment="center"
              allowFiltering={false}
              allowSorting={false}
              allowGrouping={false}
              cellRender={(cellInfo) => (
                <span className="text-gray-500 text-sm font-medium">
                  {cellInfo.data._rowNumber}
                </span>
              )}
            />
            <Column
              dataField="code"
              caption={t('items.grid.columns.code')}
              width={150}
              cellRender={renderCodeCell}
            />
            <Column
              dataField="nameTh"
              caption={t('items.grid.columns.name')}
              minWidth={200}
              cellRender={renderNameCell}
            />
            <Column
              dataField="type"
              caption={t('items.grid.columns.type')}
              width={150}
              cellRender={renderTypeCell}
            />
            <Column
              dataField="category"
              caption={t('items.grid.columns.category')}
              width={120}
            />
            <Column
              dataField="onHand"
              caption={t('items.grid.columns.onHandQty')}
              width={140}
              cellRender={renderStockCell}
            />
            <Column
              dataField="onHandCost"
              caption={t('items.grid.columns.totalValue')}
              width={130}
              dataType="number"
              cellRender={(data: { data: Item }) => {
                const val = Number(data.data.onHandCost) || 0;
                if (val === 0) return <span className="text-gray-400">-</span>;
                return (
                  <span className="font-medium text-gray-900" title={`฿${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
                    ฿{formatCompactNumber(val)}
                  </span>
                );
              }}
            />
            <Column
              caption={t('items.grid.columns.avgCost')}
              width={120}
              dataType="number"
              calculateCellValue={(rowData: Record<string, unknown>) => {
                const qty = Number(rowData.onHand) || 0;
                const cost = Number(rowData.onHandCost) || 0;
                if (qty <= 0 || cost <= 0) return null;
                return Math.round((cost / qty) * 100) / 100;
              }}
              cellRender={(data: { value: number | null; data: Item }) => {
                if (!data.value) return <span className="text-gray-400">-</span>;
                return (
                  <span className="text-gray-700 text-sm">
                    ฿{data.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/{data.data.primaryUnit}
                  </span>
                );
              }}
            />
            <Column
              dataField="quarantineQty"
              caption={t('items.grid.columns.quarantine')}
              width={120}
              cellRender={renderQuarantineCell}
            />
            <Column
              dataField="primaryUnit"
              caption={t('items.grid.columns.unit')}
              width={80}
            />
            <Column
              dataField="shelfLifeDays"
              caption={t('items.grid.columns.shelfLife')}
              width={100}
              cellRender={(data) => data.value ? t('items.grid.shelfLifeDays', { days: data.value }) : '-'}
            />
            <Column
              dataField="isActive"
              caption={t('items.grid.columns.status')}
              width={100}
              cellRender={renderStatusCell}
            />
            <Column
              caption={t('items.grid.columns.vmi')}
              width={90}
              cellRender={renderVmiCell}
              allowFiltering={false}
            />
            <Column
              caption={t('items.grid.columns.actions')}
              width={110}
              cellRender={renderActionsCell}
              allowFiltering={false}
              allowSorting={false}
            />

            <Summary>
              <TotalItem column="code" summaryType="count" displayFormat={`${t('common.total')}: {0}`} />
            </Summary>

            <Paging enabled={true} defaultPageSize={20} />
            <Pager
              visible={true}
              showPageSizeSelector={true}
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo={true}
              showNavigationButtons={true}
            />

            <Toolbar>
              <ToolbarItem name="groupPanel" />
              <ToolbarItem name="columnChooserButton" />
              <ToolbarItem name="exportButton" />
              <ToolbarItem name="searchPanel" />
            </Toolbar>
          </DataGrid>
        </div>
      </div>

      {/* Item Edit Dialog */}
      <ItemEditDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingItem(null);
        }}
        item={editingItem}
        onSave={handleSave}
      />

      {/* Delete Confirmation Dialog */}
      <DxConfirmDialog
        visible={deleteConfirm.open}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ open: false, item: null })}
        title={t('common.confirmDelete')}
        message={t('common.deleteMessage', { name: deleteConfirm.item?.nameTh || '' })}
        confirmText={t('common.delete')}
        confirmType="danger"
      />

      {/* Style E pharma-grade DataGrid styles — sky-tinted clinical look */}
      <style jsx global>{`
        .items-professional-grid {
          font-family: inherit;
        }
        .items-professional-grid .dx-datagrid-headers {
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        .items-professional-grid .dx-datagrid-headers .dx-header-row td {
          font-weight: 700;
          color: #475569;
          padding: 12px 10px;
          font-size: 10px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .items-professional-grid .dx-data-row td {
          padding: 10px;
          vertical-align: middle;
          border-color: #f1f5f9;
        }
        .items-professional-grid .dx-data-row:hover {
          background: rgba(240, 249, 255, 0.5) !important;
        }
        .items-professional-grid .dx-data-row {
          cursor: pointer;
          transition: background-color 0.15s ease;
        }
        .items-professional-grid .dx-row-alt > td {
          background-color: #fafbfc;
        }
        .items-professional-grid .dx-datagrid-search-panel {
          margin-left: 0;
          border-radius: 0.375rem;
        }
        .items-professional-grid .dx-toolbar {
          padding: 10px 16px;
          background: transparent;
        }
        .items-professional-grid .dx-datagrid-group-panel {
          padding: 8px 16px;
          background: #f8fafc;
        }
        .items-professional-grid .dx-pager {
          padding: 12px 16px;
          border-top: 1px solid #e2e8f0;
          background: #fafbfc;
        }
        .items-professional-grid .dx-datagrid-filter-row {
          background: #f8fafc;
        }
      `}</style>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImportFile} className="hidden" />

      {/* Import Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-md shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border-2 border-sky-100">
            <div className="relative px-5 py-4 border-b-2 border-sky-700 shrink-0 bg-sky-600 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-sky-500 border border-sky-400">
                    <Upload className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="text-base font-bold uppercase tracking-wide">นำเข้ารายการสินค้า</h2>
                </div>
                <button
                  onClick={() => setShowImportDialog(false)}
                  className="p-1.5 hover:bg-sky-500 rounded-md transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-sm font-semibold text-gray-800">1. เลือกประเภทสินค้าที่ต้องการนำเข้า</label>
                  <button
                    onClick={() => setSelectedTypes(prev => prev.length === ALL_TYPE_KEYS.length ? [] : [...ALL_TYPE_KEYS])}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    {selectedTypes.length === ALL_TYPE_KEYS.length ? <><CheckSquare className="h-3.5 w-3.5" /> ยกเลิกทั้งหมด</> : <><Square className="h-3.5 w-3.5" /> เลือกทั้งหมด</>}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {ITEM_TYPES_CONFIG.map(tc => {
                    const config = ITEM_TYPE_CONFIG[tc.key as ItemType];
                    const checked = selectedTypes.includes(tc.key);
                    return (
                      <label
                        key={tc.key}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all',
                          checked
                            ? `${config?.borderColor} ${config?.bgColor} shadow-sm`
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setSelectedTypes(prev => prev.includes(tc.key) ? prev.filter(k => k !== tc.key) : [...prev, tc.key])}
                          className="h-4 w-4 rounded text-blue-600"
                        />
                        <span
                          className={cn(
                            'inline-flex h-7 w-7 items-center justify-center rounded-lg',
                            config?.iconBg ?? 'bg-slate-100',
                            config?.iconText ?? 'text-slate-700'
                          )}
                        >
                          {config?.icon}
                        </span>
                        <span className="text-sm font-medium text-gray-900 flex-1">{tc.label}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{tc.sheetName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              {selectedTypes.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    2. เลือกไฟล์ Excel <span className="text-xs font-normal text-gray-500">({selectedTypes.length} ประเภท)</span>
                  </label>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all disabled:opacity-50"
                  >
                    {importing ? (
                      <>
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        กำลังนำเข้า...
                      </>
                    ) : (
                      <>
                        <Upload className="h-5 w-5" />
                        คลิกเพื่อเลือกไฟล์ (.xlsx)
                      </>
                    )}
                  </button>
                </div>
              )}
              {importLog.length > 0 && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <label className="block text-sm font-semibold text-gray-800 mb-2">ผลการนำเข้า:</label>
                  <div className="text-xs font-mono space-y-1 max-h-40 overflow-y-auto">
                    {importLog.map((line, i) => (
                      <div
                        key={i}
                        className={cn(
                          'px-2 py-1 rounded',
                          line.includes('❌') ? 'text-rose-700 bg-rose-50' :
                          line.includes('⚠️') ? 'text-amber-700 bg-amber-50' :
                          line.includes('✅') ? 'text-emerald-700 bg-emerald-50' :
                          'text-gray-700'
                        )}
                      >
                        {line}
                      </div>
                    ))}
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

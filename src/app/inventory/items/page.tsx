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
  gradient: string;
  ring: string;
  iconBg: string;
  icon: React.ReactNode;
}> = {
  raw_material: {
    translationKey: 'rawMaterial',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    gradient: 'from-blue-500 to-sky-500',
    ring: 'ring-blue-200',
    iconBg: 'bg-blue-100',
    icon: <Leaf className="h-4 w-4" />,
  },
  packaging: {
    translationKey: 'packaging',
    bgColor: 'bg-cyan-50',
    textColor: 'text-cyan-700',
    borderColor: 'border-cyan-200',
    gradient: 'from-cyan-500 to-teal-500',
    ring: 'ring-cyan-200',
    iconBg: 'bg-cyan-100',
    icon: <Box className="h-4 w-4" />,
  },
  wip: {
    translationKey: 'wip',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
    gradient: 'from-orange-500 to-amber-500',
    ring: 'ring-orange-200',
    iconBg: 'bg-orange-100',
    icon: <FlaskConical className="h-4 w-4" />,
  },
  finished_goods: {
    translationKey: 'finishedGoods',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    gradient: 'from-emerald-500 to-green-500',
    ring: 'ring-emerald-200',
    iconBg: 'bg-emerald-100',
    icon: <Pill className="h-4 w-4" />,
  },
  consumable: {
    translationKey: 'consumable',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-200',
    gradient: 'from-slate-500 to-gray-500',
    ring: 'ring-slate-200',
    iconBg: 'bg-slate-100',
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
            'inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm ring-1 ring-white/40',
            config?.gradient ?? 'from-slate-400 to-slate-500'
          )}
        >
          {config?.icon}
        </span>
        <button
          onClick={() => router.push(`/inventory/items/${data.data.id}`)}
          className="font-mono text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
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
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
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
          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-gradient-to-r from-rose-500 to-red-500 text-white font-semibold rounded-full shadow-sm">
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
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border border-emerald-200">
        <CheckCircle className="h-3 w-3" />
        {t('items.status.active')}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-rose-50 to-red-50 text-rose-700 border border-rose-200">
        <XCircle className="h-3 w-3" />
        {t('items.status.inactive')}
      </span>
    );
  }, [t]);

  const renderVmiCell = useCallback((data: { data: Item }) => {
    const hasVmi = data.data.tppCode || data.data.ttmtCode;
    return hasVmi ? (
      <div
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-cyan-50 to-emerald-50 text-emerald-700 border border-emerald-200"
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
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-cyan-600 to-teal-600 shadow-lg">
          {/* Decorative blobs */}
          <div className="absolute inset-0 opacity-20" aria-hidden="true">
            <div className="absolute -top-12 -right-12 h-56 w-56 rounded-full bg-white blur-3xl" />
            <div className="absolute -bottom-16 left-12 h-48 w-48 rounded-full bg-cyan-300 blur-3xl" />
          </div>
          <div className="relative px-5 sm:px-7 py-6 sm:py-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/30 shadow-md">
                  <Package className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-white drop-shadow-sm">
                    {t('items.pageTitle')}
                  </h1>
                  <p className="mt-1 text-sm text-cyan-50/90 max-w-xl">
                    {t('items.description')}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs font-medium ring-1 ring-white/20">
                      <Package className="h-3.5 w-3.5" />
                      {t('common.itemsShown', { count: totalItems })}
                    </span>
                    {statistics.activeItems > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-400/20 backdrop-blur-sm text-emerald-50 text-xs font-medium ring-1 ring-emerald-300/30">
                        <CheckCircle className="h-3.5 w-3.5" />
                        {statistics.activeItems} {t('stats.active')}
                      </span>
                    )}
                    {statistics.lowStockItems > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-400/20 backdrop-blur-sm text-rose-50 text-xs font-medium ring-1 ring-rose-300/30">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {statistics.lowStockItems} {t('stats.lowStock')}
                      </span>
                    )}
                    {statistics.itemsInQuarantine > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/20 backdrop-blur-sm text-amber-50 text-xs font-medium ring-1 ring-amber-300/30">
                        <Clock className="h-3.5 w-3.5" />
                        {statistics.itemsInQuarantine} {t('stats.inQuarantine')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg backdrop-blur-sm ring-1 ring-white/30 transition-all shadow-sm',
                    isLoading
                      ? 'text-white/60 bg-white/10 cursor-not-allowed'
                      : 'text-white bg-white/15 hover:bg-white/25'
                  )}
                  title={t('common.refresh')}
                >
                  <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                  <span className="hidden sm:inline">{t('common.refresh')}</span>
                </button>
                <button
                  onClick={() => router.push('/inventory/lots')}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-white/15 backdrop-blur-sm ring-1 ring-white/30 rounded-lg hover:bg-white/25 transition-all shadow-sm"
                >
                  <Warehouse className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('items.viewLots')}</span>
                </button>
                <button
                  onClick={handleDownloadData}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-white/15 backdrop-blur-sm ring-1 ring-white/30 rounded-lg hover:bg-white/25 transition-all shadow-sm"
                  title="Download Excel"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden md:inline">Excel</span>
                </button>
                {isAdmin && (
                  <>
                    <button
                      onClick={handleDownloadTemplate}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-white/15 backdrop-blur-sm ring-1 ring-white/30 rounded-lg hover:bg-white/25 transition-all shadow-sm"
                      title={t('common.downloadTemplate')}
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden md:inline">{t('common.downloadTemplate')}</span>
                    </button>
                    <button
                      onClick={() => { setShowImportDialog(true); setImportLog([]); }}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-white/15 backdrop-blur-sm ring-1 ring-white/30 rounded-lg hover:bg-white/25 transition-all shadow-sm"
                    >
                      <Upload className="h-4 w-4" />
                      <span className="hidden md:inline">{t('common.importExcel')}</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => router.push('/inventory/items/new')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-emerald-700 bg-white rounded-lg hover:bg-emerald-50 transition-all shadow-md hover:shadow-lg ring-1 ring-white/40"
                >
                  <Plus className="h-4 w-4" />
                  {t('items.addItem')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden PageHeader to keep import side-effect-free */}
        <span className="hidden">
          <PageHeader title={t('items.pageTitle')} description={t('items.description')} />
        </span>

        {/* Stats strip */}
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
                  'group relative overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                  isActive ? `${config.borderColor} ring-2 ${config.ring}` : 'border-gray-200'
                )}
              >
                <div className={cn('absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br opacity-10 transition-opacity group-hover:opacity-20', config.gradient)} />
                <div className="relative flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                      {t(`items.types.${config.translationKey}`)}
                    </p>
                    <p className="mt-1.5 text-2xl font-bold text-gray-900 tabular-nums">
                      {count.toLocaleString()}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {totalItems > 0 ? `${Math.round((count / totalItems) * 100)}%` : '0%'} {t('stats.total').toLowerCase()}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm',
                      config.gradient
                    )}
                  >
                    {config.icon}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Items DataGrid Card */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Filter pill bar */}
          <div className="px-4 sm:px-5 py-4 border-b border-gray-100 bg-gradient-to-b from-slate-50/80 to-white">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              {/* Type filter pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setActiveTab('all')}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full transition-all whitespace-nowrap border',
                    activeTab === 'all'
                      ? 'bg-gradient-to-r from-slate-800 to-gray-900 text-white border-transparent shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-900'
                  )}
                >
                  {t('common.all')}
                  <span
                    className={cn(
                      'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-[10px] font-semibold rounded-full',
                      activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
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
                        'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full transition-all whitespace-nowrap border',
                        isActive
                          ? `bg-gradient-to-r ${config.gradient} text-white border-transparent shadow-sm`
                          : `bg-white text-gray-600 border-gray-200 hover:${config.borderColor} hover:${config.textColor}`
                      )}
                    >
                      {config.icon}
                      {t(`items.types.${config.translationKey}`)}
                      <span
                        className={cn(
                          'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-[10px] font-semibold rounded-full',
                          isActive ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-600'
                        )}
                      >
                        {typeCounts[type]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Compact info chips */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {statistics.lowStockItems > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-medium">
                    <AlertTriangle className="h-3 w-3" />
                    {statistics.lowStockItems} {t('stats.lowStock')}
                  </span>
                )}
                {statistics.itemsInQuarantine > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-medium">
                    <Clock className="h-3 w-3" />
                    {statistics.itemsInQuarantine} {t('stats.inQuarantine')}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
                  <CheckCircle className="h-3 w-3" />
                  {statistics.activeItems} {t('stats.active')}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 font-medium">
                  {t('common.itemsShown', { count: filteredItems.length })}
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

      {/* Custom styles */}
      <style jsx global>{`
        .items-professional-grid {
          font-family: inherit;
        }
        .items-professional-grid .dx-datagrid-headers {
          background: linear-gradient(to bottom, #f8fafc, #eff6ff);
          border-bottom: 2px solid #dbeafe;
        }
        .items-professional-grid .dx-datagrid-headers .dx-header-row td {
          font-weight: 600;
          color: #1e3a8a;
          padding: 12px 10px;
          font-size: 12px;
          letter-spacing: 0.025em;
          text-transform: uppercase;
        }
        .items-professional-grid .dx-data-row td {
          padding: 12px 10px;
          vertical-align: middle;
          border-color: #f1f5f9;
        }
        .items-professional-grid .dx-data-row:hover {
          background: linear-gradient(to right, #eff6ff, #ecfeff) !important;
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
          border-radius: 0.5rem;
        }
        .items-professional-grid .dx-toolbar {
          padding: 10px 16px;
          background: transparent;
        }
        .items-professional-grid .dx-datagrid-group-panel {
          padding: 8px 16px;
          background: linear-gradient(to right, #f8fafc, #ffffff);
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="relative px-5 py-4 border-b border-gray-100 shrink-0 bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/30">
                    <Upload className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold">นำเข้ารายการสินค้า</h2>
                </div>
                <button
                  onClick={() => setShowImportDialog(false)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
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
                            'inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm',
                            config?.gradient ?? 'from-slate-400 to-slate-500'
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
                <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-4 border border-gray-200">
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

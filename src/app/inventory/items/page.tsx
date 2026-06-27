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
import { useTranslations, useLocale } from 'next-intl';
import { useItemCategories } from '@/hooks/use-lookup-data';
import { MainLayout } from '@/components/layout/main-layout';
import { PageHeader } from '@/components/ui/page-header';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  SearchPanel,
  HeaderFilter,
  Grouping,
  GroupPanel,
  Summary,
  TotalItem,
  Toolbar,
  Item as ToolbarItem,
} from 'devextreme-react/data-grid';
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
import { ITEM_COLUMNS, ITEM_TYPES_CONFIG, ALL_TYPE_KEYS, parseImportRow } from '@/lib/inventory/item-import';
import { DxConfirmDialog } from '@/components/ui/dx-popup';
import { useToast } from '@/hooks/use-toast';
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
  // Soft colors used for the type chip/tag inside the grid rows.
  bgColor: string;
  textColor: string;
  // Solid colors used when the pill is the active filter — strong fill + white
  // text so the selected tab reads clearly (matches the warehouses page).
  activeBg: string;
  activeText: string;
  icon: React.ReactNode;
}> = {
  raw_material: {
    translationKey: 'rawMaterial',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    activeBg: 'bg-emerald-600',
    activeText: 'text-white',
    icon: <Leaf className="h-4 w-4" />,
  },
  packaging: {
    translationKey: 'packaging',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    activeBg: 'bg-teal-600',
    activeText: 'text-white',
    icon: <Box className="h-4 w-4" />,
  },
  wip: {
    translationKey: 'wip',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    activeBg: 'bg-orange-500',
    activeText: 'text-white',
    icon: <FlaskConical className="h-4 w-4" />,
  },
  finished_goods: {
    translationKey: 'finishedGoods',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    activeBg: 'bg-purple-600',
    activeText: 'text-white',
    icon: <Pill className="h-4 w-4" />,
  },
  consumable: {
    translationKey: 'consumable',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
    activeBg: 'bg-slate-600',
    activeText: 'text-white',
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
  const locale = useLocale();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Category display: items store a category CODE (e.g. "herb"); show the
  // localized name from the item_categories lookup so the column reads
  // "สมุนไพร" / "Herb" by language instead of the raw code.
  const { data: itemCategories } = useItemCategories();
  const categoryMap = useMemo(() => {
    const m = new Map<string, { nameTh: string; nameEn: string | null }>();
    (itemCategories ?? []).forEach((c) => m.set(c.code, { nameTh: c.nameTh, nameEn: c.nameEn }));
    return m;
  }, [itemCategories]);
  const renderCategoryCell = useCallback(
    (data: { value: string | null }) => {
      const code = data.value;
      if (!code) return '—';
      const cat = categoryMap.get(code);
      if (!cat) return code; // unknown code → show raw as fallback
      return locale === 'en' ? cat.nameEn || cat.nameTh : cat.nameTh;
    },
    [categoryMap, locale],
  );
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

  // ─── Item Import Config (extracted to a pure, testable lib) ─────────
  // ITEM_TYPES_CONFIG, ITEM_COLUMNS, ALL_TYPE_KEYS, parseImportRow live in
  // @/lib/inventory/item-import so the parsing logic can be unit-tested.

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

    // Example rows keyed by FIELD (not Thai header). Each row carries every
    // create-API field so the template demonstrates all columns. Empty string
    // = optional/leave blank. Mapped to header-keyed rows below so all
    // ITEM_COLUMNS appear in every sheet (even where the example leaves blank).
    const EXAMPLE_BY_FIELD: Record<string, Record<string, string | number>[]> = {
      raw_material: [
        { code: 'RM-0001', nameTh: 'การบูร', nameEn: 'Camphor', category: 'herb', primaryUnit: 'kg', secondaryUnit: 'g', conversionRate: 1000, weightUnit: 'g', secondaryToWeightRate: 1, weightTrackingEnabled: 'true', shelfLifeDays: 730, storageCondition: 'เก็บที่อุณหภูมิห้อง แห้ง', minStock: 50, maxStock: 500, reorderPoint: 100, isLotControlled: 'true', isFEFO: 'true', strength: '', strengthValue: '', strengthUnit: '', unitWeightMg: '', isPrimaryPacking: 'false', confidentialityLevel: 'public', tppCode: '', tppName: '', ttmtCode: '', ttmtName: '', gRegNumber: '' },
        { code: 'RM-0002', nameTh: 'สารสกัดขมิ้นชัน', nameEn: 'Turmeric Extract', category: 'extract', primaryUnit: 'kg', secondaryUnit: 'g', conversionRate: 1000, weightUnit: 'g', secondaryToWeightRate: 1, weightTrackingEnabled: 'true', shelfLifeDays: 365, storageCondition: 'เก็บที่ 2-8°C', minStock: 10, maxStock: 100, reorderPoint: 20, isLotControlled: 'true', isFEFO: 'true', strength: '', strengthValue: '', strengthUnit: '', unitWeightMg: '', isPrimaryPacking: 'false', confidentialityLevel: 'confidential', tppCode: '', tppName: '', ttmtCode: 'TTMT-001', ttmtName: 'Curcuma longa', gRegNumber: '' },
      ],
      packaging: [
        { code: 'PK-0001', nameTh: 'ขวดแก้วสีชา 100 ml', nameEn: 'Amber Glass Bottle 100mL', category: 'bottle', primaryUnit: 'box', secondaryUnit: 'pcs', conversionRate: 100, weightUnit: '', secondaryToWeightRate: '', weightTrackingEnabled: 'false', shelfLifeDays: '', storageCondition: 'เก็บในที่แห้ง', minStock: 1000, maxStock: 10000, reorderPoint: 2000, isLotControlled: 'false', isFEFO: 'false', strength: '', strengthValue: '', strengthUnit: '', unitWeightMg: 140000, isPrimaryPacking: 'true', confidentialityLevel: 'public', tppCode: '', tppName: '', ttmtCode: '', ttmtName: '', gRegNumber: '' },
        { code: 'PK-0002', nameTh: 'ฉลากยาสมุนไพร', nameEn: 'Herbal Product Label', category: 'label', primaryUnit: 'roll', secondaryUnit: 'pcs', conversionRate: 500, weightUnit: '', secondaryToWeightRate: '', weightTrackingEnabled: 'false', shelfLifeDays: '', storageCondition: 'เก็บในที่แห้ง หลีกเลี่ยงแสงแดด', minStock: 500, maxStock: 5000, reorderPoint: 1000, isLotControlled: 'false', isFEFO: 'false', strength: '', strengthValue: '', strengthUnit: '', unitWeightMg: '', isPrimaryPacking: 'false', confidentialityLevel: 'public', tppCode: '', tppName: '', ttmtCode: '', ttmtName: '', gRegNumber: '' },
      ],
      finished_goods: [
        { code: 'FG-0001', nameTh: 'แคปซูลขมิ้นชัน 500 mg (60 แคปซูล)', nameEn: 'Turmeric Capsule 500mg', category: 'finished', primaryUnit: 'bottle', secondaryUnit: 'cap', conversionRate: 60, weightUnit: 'mg', secondaryToWeightRate: 500, weightTrackingEnabled: 'false', shelfLifeDays: 730, storageCondition: 'เก็บที่อุณหภูมิไม่เกิน 30°C', minStock: 100, maxStock: 5000, reorderPoint: 500, isLotControlled: 'true', isFEFO: 'true', strength: '500 mg', strengthValue: 500, strengthUnit: 'mg', unitWeightMg: 500, isPrimaryPacking: 'false', confidentialityLevel: 'public', tppCode: 'TPP-0001', tppName: 'แคปซูลขมิ้นชัน', ttmtCode: '', ttmtName: '', gRegNumber: 'G-12345' },
      ],
      wip: [
        { code: 'WIP-0001', nameTh: 'ผงผสมขมิ้นชัน (bulk)', nameEn: 'Turmeric Blend Bulk', category: 'semi_finished', primaryUnit: 'kg', secondaryUnit: 'g', conversionRate: 1000, weightUnit: 'g', secondaryToWeightRate: 1, weightTrackingEnabled: 'true', shelfLifeDays: 90, storageCondition: 'เก็บในถุงปิดสนิท อุณหภูมิห้อง', minStock: 10, maxStock: 100, reorderPoint: 20, isLotControlled: 'true', isFEFO: 'true', strength: '', strengthValue: '', strengthUnit: '', unitWeightMg: '', isPrimaryPacking: 'false', confidentialityLevel: 'internal', tppCode: '', tppName: '', ttmtCode: '', ttmtName: '', gRegNumber: '' },
      ],
      consumable: [
        { code: 'CS-0001', nameTh: 'ถุงมือไนไตรล์ ไซส์ M', nameEn: 'Nitrile Gloves Size M', category: 'consumable', primaryUnit: 'box', secondaryUnit: 'pcs', conversionRate: 100, weightUnit: '', secondaryToWeightRate: '', weightTrackingEnabled: 'false', shelfLifeDays: 1825, storageCondition: 'เก็บในที่แห้ง', minStock: 20, maxStock: 200, reorderPoint: 50, isLotControlled: 'false', isFEFO: 'false', strength: '', strengthValue: '', strengthUnit: '', unitWeightMg: '', isPrimaryPacking: 'false', confidentialityLevel: 'public', tppCode: '', tppName: '', ttmtCode: '', ttmtName: '', gRegNumber: '' },
      ],
    };

    // Map field-keyed example rows -> header-keyed rows, ensuring EVERY column
    // appears (blank where the example omitted it).
    const toHeaderRow = (r: Record<string, string | number>): Record<string, string | number> => {
      const out: Record<string, string | number> = {};
      for (const col of ITEM_COLUMNS) out[col.header] = r[col.field] ?? '';
      return out;
    };

    for (const tc of ITEM_TYPES_CONFIG) {
      const rows = (EXAMPLE_BY_FIELD[tc.key] || []).map(toHeaderRow);
      // header-only fallback so the sheet still shows all columns if no example
      const sheetData = rows.length ? rows : [toHeaderRow({})];
      const ws = XLSX.utils.json_to_sheet(sheetData, { header: ITEM_COLUMNS.map(c => c.header) });
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
      [''],
      ['ค่า Boolean (true/false)', ''], ['ค่า', 'คำอธิบาย'],
      ['true', 'ใช่ / เปิดใช้งาน (รับ: true, 1, yes, ใช่)'],
      ['false', 'ไม่ / ปิด (เว้นว่าง = false)'],
      ['', '(ใช้กับ: ติดตามน้ำหนัก, ควบคุมล็อต, FEFO, บรรจุภัณฑ์หลัก)'],
      [''],
      ['ระดับความลับ (Confidentiality Level)', ''], ['ค่า', 'คำอธิบาย'],
      ['public', 'ทั่วไป (ค่าเริ่มต้น)'], ['internal', 'ภายใน'], ['confidential', 'ลับ (สูตร/วัตถุดิบสำคัญ)'],
      [''],
      ['หมายเหตุ', 'ทุกคอลัมน์ของระบบถูกใส่ในแต่ละ Sheet แล้ว — กรอกเฉพาะที่ต้องการ ที่เหลือเว้นว่างได้'],
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
            const parsed = parseImportRow(row, tc.key);
            if (!parsed.ok || !parsed.payload) {
              errors.push(`แถว ${i + 2}: ${parsed.error}`);
              continue;
            }
            const payload = parsed.payload;

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
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        if (data.mode === 'disabled') {
          toast.success('ปิดการใช้งาน', 'รายการนี้ถูกใช้งานแล้ว — ปิดการใช้งานแทนการลบ');
        } else {
          toast.success('ลบสำเร็จ', 'ลบรายการสินค้าเรียบร้อย');
        }
        refetch();
      } else {
        toast.error('ลบไม่สำเร็จ', data?.error ?? `เกิดข้อผิดพลาด (${res.status})`);
      }
    } catch (err) {
      toast.error('ลบไม่สำเร็จ', err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่คาดคิด');
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
    // Export current items using the SAME column set as the import template, so
    // the file round-trips: edit the exported rows and re-import them directly.
    // Booleans render as 'true'/'false'; an extra 'ประเภท (Type)' col is added
    // up front so a single sheet captures all types (import reads per-sheet, so
    // this export sheet is for review/edit — split per type before re-import).
    const boolKeys = new Set(ITEM_COLUMNS.filter(c => c.kind === 'boolean').map(c => c.field));
    const rows = filteredItems.map((it) => {
      const rec = it as unknown as Record<string, unknown>;
      const out: Record<string, string | number> = { 'ประเภท (Type)': String(rec.type ?? '') };
      for (const col of ITEM_COLUMNS) {
        const v = rec[col.field];
        out[col.header] = boolKeys.has(col.field)
          ? (v ? 'true' : 'false')
          : (v === null || v === undefined ? '' : (v as string | number));
      }
      // useful read-only context columns
      out['คงเหลือ (on_hand)'] = (rec.onHand as number) ?? '';
      out['มูลค่า (on_hand_cost)'] = (rec.onHandCost as number) ?? '';
      out['สถานะ (Status)'] = rec.isActive ? 'Active' : 'Inactive';
      return out;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Array(ITEM_COLUMNS.length + 4).fill({ wch: 20 });
    XLSX.utils.book_append_sheet(wb, ws, 'Items');
    const ts = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `items-${ts}.xlsx`);
  };

  // Custom cell renderers
  const renderCodeCell = useCallback((data: { data: Item }) => {
    const config = ITEM_TYPE_CONFIG[data.data.type as ItemType];
    return (
      <div className="flex items-center gap-2 flex-nowrap">
        <span className={cn('p-1 rounded shrink-0', config?.bgColor, config?.textColor)}>
          {config?.icon}
        </span>
        <button
          onClick={() => router.push(`/inventory/items/${data.data.id}`)}
          className="font-mono text-amber-600 hover:text-amber-800 hover:underline whitespace-nowrap"
        >
          {data.data.code}
        </button>
      </div>
    );
  }, [router]);

  const renderNameCell = useCallback((data: { data: Item }) => {
    return (
      <div>
        <p className="font-medium text-gray-900">{data.data.nameTh}</p>
        {data.data.nameEn && (
          <p className="text-xs text-gray-500">{data.data.nameEn}</p>
        )}
      </div>
    );
  }, []);

  const renderTypeCell = useCallback((data: { value: ItemType }) => {
    const config = ITEM_TYPE_CONFIG[data.value];
    if (!config) return data.value;
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', config.bgColor, config.textColor)}>
        {config.icon}
        {t(`items.types.${config.translationKey}`)}
      </span>
    );
  }, [t]);

  const renderStockCell = useCallback((data: { data: Item }) => {
    const onHand = data.data.onHand ?? 0;
    const minStock = data.data.minStock ?? 0;
    const maxStock = data.data.maxStock ?? 0;
    const reorderPoint = data.data.reorderPoint ?? 0;

    // Same thresholds as the edit page's StockStatus card so the list and detail
    // agree: low → near-reorder → overstock → healthy (priority order).
    const isLow = minStock > 0 && onHand < minStock;
    const isNearReorder = reorderPoint > 0 && onHand <= reorderPoint && !isLow;
    const isOverstock = maxStock > 0 && onHand > maxStock;

    const badge = isLow
      ? { cls: 'bg-red-100 text-red-700', label: t('itemForm.stock.low') }
      : isNearReorder
        ? { cls: 'bg-amber-100 text-amber-700', label: t('itemForm.stock.nearReorder') }
        : isOverstock
          ? { cls: 'bg-sky-100 text-sky-700', label: t('itemForm.stock.overstock') }
          : null;

    return (
      <div>
        <div className={cn('font-medium', isLow ? 'text-red-600' : 'text-gray-900')}>
          {formatCompactNumber(onHand)} {data.data.primaryUnit}
          {badge && (
            <span className={cn('ml-1 text-xs px-1 py-0.5 rounded', badge.cls)}>{badge.label}</span>
          )}
        </div>
      </div>
    );
  }, [t]);

  const renderQuarantineCell = useCallback((data: { data: Item }) => {
    const quarantineQty = data.data.quarantineQty ?? 0;

    if (quarantineQty === 0) {
      return (
        <div className="text-gray-400 text-center">-</div>
      );
    }

    return (
      <div className="flex items-center gap-1.5" title={`${quarantineQty.toLocaleString()} ${data.data.primaryUnit}`}>
        <Clock className="h-4 w-4 text-amber-500" />
        <span className="font-medium text-amber-700">
          {formatCompactNumber(quarantineQty)}
        </span>
        <span className="text-xs text-gray-500">{data.data.primaryUnit}</span>
      </div>
    );
  }, []);

  const renderStatusCell = useCallback((data: { value: boolean }) => {
    return data.value ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
        <CheckCircle className="h-3 w-3" />
        {t('items.status.active')}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <XCircle className="h-3 w-3" />
        {t('items.status.inactive')}
      </span>
    );
  }, [t]);

  const renderVmiCell = useCallback((data: { data: Item }) => {
    const hasVmi = data.data.tppCode || data.data.ttmtCode;
    return hasVmi ? (
      <div className="flex items-center gap-1 text-emerald-600" title={`TPP: ${data.data.tppCode || '-'}, TTMT: ${data.data.ttmtCode || '-'}`}>
        <CheckCircle className="h-4 w-4" />
        <span className="text-xs font-medium">{t('items.grid.vmiReady')}</span>
      </div>
    ) : (
      <div className="flex items-center gap-1 text-gray-400">
        <XCircle className="h-4 w-4" />
        <span className="text-xs">-</span>
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
          className="p-1 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded"
          title={t('items.buttons.viewDetails')}
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleEdit(data.data);
          }}
          className="p-1 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded"
          title={t('items.buttons.edit')}
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDeleteConfirm({ open: true, item: data.data });
          }}
          className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
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
      <div className="space-y-4 organic-items">
        {/* Page Header */}
        <PageHeader
          title={t('items.pageTitle')}
          description={t('items.description')}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-xl transition-all shadow-sm",
                  isLoading
                    ? "text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed"
                    : "text-emerald-800 bg-white border-emerald-100 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow"
                )}
              >
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                {t('common.refresh')}
              </button>
              <button
                onClick={() => router.push('/inventory/lots')}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm text-emerald-800 bg-white border border-emerald-100 rounded-xl shadow-sm hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow transition-all"
              >
                <Warehouse className="h-4 w-4" />
                {t('items.viewLots')}
              </button>
              <button onClick={handleDownloadData} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow transition-all">
                <Download className="h-4 w-4" /> Download Excel
              </button>
              {isAdmin && (
                <>
                  <button onClick={handleDownloadTemplate} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl shadow-sm hover:-translate-y-0.5 hover:border-amber-300 hover:shadow transition-all">
                    <Download className="h-4 w-4" /> {t('common.downloadTemplate')}
                  </button>
                  <button onClick={() => { setShowImportDialog(true); setImportLog([]); }} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow transition-all">
                    <Upload className="h-4 w-4" /> {t('common.importExcel')}
                  </button>
                </>
              )}
              <button
                onClick={() => router.push('/inventory/items/new')}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-md shadow-emerald-500/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/40 transition-all font-medium"
              >
                <Plus className="h-4 w-4" />
                {t('items.addItem')}
              </button>
            </div>
          }
        />

        {/* Items DataGrid Card */}
        <div className="bg-white border border-emerald-100 rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] overflow-hidden">
          {/* Tabs + Stats Header */}
          <div className="px-4 py-3 border-b border-emerald-50 bg-gradient-to-b from-[#FBFEFC] to-[#F6FCF9]">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              {/* Type Tabs */}
              <div className="flex items-center gap-1 bg-[#F1FAF5] rounded-xl p-1 border border-emerald-100 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('all')}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap',
                    activeTab === 'all'
                      ? 'bg-gradient-to-br from-[#064E3B] to-emerald-600 text-white shadow-sm'
                      : 'text-[#4B7163] hover:text-[#064E3B] hover:bg-[#E6F6EE]'
                  )}
                >
                  {t('common.all')}
                  <span className={cn(
                    'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
                    activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                  )}>{totalItems}</span>
                </button>
                {(Object.keys(ITEM_TYPE_CONFIG) as ItemType[]).map((type) => {
                  const config = ITEM_TYPE_CONFIG[type];
                  return (
                    <button
                      key={type}
                      onClick={() => setActiveTab(type)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap',
                        activeTab === type
                          ? `${config.activeBg} ${config.activeText} shadow-sm`
                          : 'text-[#4B7163] hover:text-[#064E3B] hover:bg-[#E6F6EE]'
                      )}
                    >
                      {config.icon}
                      {t(`items.types.${config.translationKey}`)}
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded-full font-semibold',
                        activeTab === type ? 'bg-white/25 text-inherit' : 'bg-emerald-100 text-emerald-800'
                      )}>
                        {typeCounts[type]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Compact Stats */}
              <div className="flex items-center gap-4 text-sm">
                {statistics.lowStockItems > 0 && (
                  <div className="flex items-center gap-1.5 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">{statistics.lowStockItems} {t('stats.lowStock')}</span>
                  </div>
                )}
                {statistics.itemsInQuarantine > 0 && (
                  <div className="flex items-center gap-1.5 text-amber-600">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">{statistics.itemsInQuarantine} {t('stats.inQuarantine')}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-[#4B7163]">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span>{statistics.activeItems} {t('stats.active')}</span>
                </div>
                <div className="text-emerald-200">|</div>
                <span className="text-[#4B7163]">{t('common.itemsShown', { count: filteredItems.length })}</span>
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
            onRowClick={(e) => {
              if (e.data?.id) {
                router.push(`/inventory/items/${e.data.id}`);
              }
            }}
            className="items-professional-grid"
          >
            <SearchPanel visible={true} placeholder={t('items.searchPlaceholder')} width={250} />
            <FilterRow visible={false} />
            <HeaderFilter visible={false} />
            <GroupPanel visible={true} />
            <Grouping autoExpandAll={false} />

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
              width={185}
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
              cellRender={renderCategoryCell}
            />
            <Column
              dataField="onHand"
              caption={t('items.grid.columns.onHandQty')}
              width={170}
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
              width={120}
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

      {/* Custom styles — Organic Biophilic theme */}
      <style jsx global>{`
        .items-professional-grid {
          font-family: inherit;
        }
        .items-professional-grid .dx-datagrid-headers {
          background: linear-gradient(180deg, #F1FAF5, #E9F6F0);
          border-bottom: 2px solid #DCEFE6;
        }
        .items-professional-grid .dx-datagrid-headers .dx-header-row td {
          font-weight: 600;
          color: #065F46;
          padding: 12px 8px;
        }
        /* Keep header captions on a single line (no wrapping). wordWrapEnabled
           wraps both header + data; this forces the HEADER row to nowrap while
           data rows keep wrapping. Target both the td and the text wrapper. */
        .items-professional-grid .dx-datagrid-headers .dx-header-row > td,
        .items-professional-grid .dx-datagrid-headers .dx-header-row > td .dx-datagrid-text-content {
          white-space: nowrap !important;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .items-professional-grid .dx-data-row td {
          padding: 10px 8px;
          vertical-align: middle;
        }
        .items-professional-grid .dx-data-row:hover {
          background-color: #fffbeb !important;
        }
        .items-professional-grid .dx-data-row {
          cursor: pointer;
        }
        .items-professional-grid .dx-row-alt > td {
          background-color: #FAFDFB;
        }
        .items-professional-grid .dx-datagrid-search-panel {
          margin-left: 0;
        }
        .items-professional-grid .dx-toolbar {
          padding: 8px 16px;
          background: transparent;
        }
        .items-professional-grid .dx-datagrid-group-panel {
          padding: 8px 16px;
        }
        .items-professional-grid .dx-pager {
          padding: 12px 16px;
          border-top: 1px solid #EEF7F2;
          background: #FBFEFC;
        }
        /* Pager selected page → emerald gradient */
        .items-professional-grid .dx-pager .dx-page.dx-selection {
          background: linear-gradient(135deg, #10B981, #059669);
          color: #fff;
          border-radius: 9px;
        }
        /* Search box — organic styling.
           NOTE: the DevExtreme search panel renders as dx-editor-FILLED
           (a grey filled box), not dx-editor-outlined — target it directly
           and flatten the filled background to match the theme. */
        .items-professional-grid .dx-datagrid-search-panel.dx-texteditor.dx-editor-filled {
          background-color: #FBFEFC;
          border: 1px solid #D9EFE4;
          border-radius: 11px;
        }
        /* Remove the filled-variant underline. The animated focus underline is
           the ::before pseudo (2px solid green that slides in on focus) and the
           idle underline is ::after — hide BOTH so only our rounded border shows. */
        .items-professional-grid .dx-datagrid-search-panel.dx-editor-filled::before,
        .items-professional-grid .dx-datagrid-search-panel.dx-editor-filled::after {
          display: none !important;
        }
        .items-professional-grid .dx-datagrid-search-panel .dx-texteditor-input {
          color: #0F2E22;
        }
        .items-professional-grid .dx-datagrid-search-panel .dx-placeholder::before {
          color: #8AA79B;
        }
        .items-professional-grid .dx-datagrid-search-panel .dx-icon-search {
          color: #4B7163;
        }
        .items-professional-grid .dx-datagrid-search-panel.dx-editor-filled.dx-state-hover {
          background-color: #F4FBF7;
          border-color: #A7F3D0;
        }
        .items-professional-grid .dx-datagrid-search-panel.dx-editor-filled.dx-state-focused {
          background-color: #fff;
          border-color: #10B981;
          box-shadow: 0 0 0 3px rgba(16,185,129,.12);
        }
      `}</style>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImportFile} className="hidden" />

      {/* Import Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#064E3B]/30 backdrop-blur-sm">
          <div className="bg-white rounded-[18px] shadow-[0_14px_34px_rgba(6,78,59,0.14)] w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-50 shrink-0">
              <h2 className="text-lg font-semibold text-[#064E3B]">นำเข้ารายการสินค้า</h2>
              <button onClick={() => setShowImportDialog(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">1. เลือกประเภทสินค้าที่ต้องการนำเข้า</label>
                  <button onClick={() => setSelectedTypes(prev => prev.length === ALL_TYPE_KEYS.length ? [] : [...ALL_TYPE_KEYS])} className="text-xs font-medium text-emerald-600 hover:text-emerald-800 flex items-center gap-1">
                    {selectedTypes.length === ALL_TYPE_KEYS.length ? <><CheckSquare className="h-3.5 w-3.5" /> ยกเลิกทั้งหมด</> : <><Square className="h-3.5 w-3.5" /> เลือกทั้งหมด</>}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {ITEM_TYPES_CONFIG.map(tc => (
                    <label key={tc.key} className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${selectedTypes.includes(tc.key) ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={selectedTypes.includes(tc.key)} onChange={() => setSelectedTypes(prev => prev.includes(tc.key) ? prev.filter(k => k !== tc.key) : [...prev, tc.key])} className="h-4 w-4 rounded text-emerald-600" />
                      <span className="text-sm font-medium text-gray-900 flex-1">{tc.label}</span>
                      <span className="text-xs text-gray-400">Sheet: {tc.sheetName}</span>
                    </label>
                  ))}
                </div>
              </div>
              {selectedTypes.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">2. เลือกไฟล์ Excel ({selectedTypes.length} ประเภท)</label>
                  <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50">
                    <Upload className="h-5 w-5" />{importing ? 'กำลังนำเข้า...' : 'คลิกเพื่อเลือกไฟล์ (.xlsx)'}
                  </button>
                </div>
              )}
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

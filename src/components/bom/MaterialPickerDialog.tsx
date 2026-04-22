'use client';

/**
 * Multi-select material picker for BOM creation / editing.
 *
 * Modelled after ItemSearchDialog but purpose-built for picking many items
 * at once. Key differences from the previous inline picker in the BOM
 * /new page:
 *   - Type tabs that fetch per-tab from the server (no more 1000-row
 *     up-front load that blocks the dialog for seconds on large tenants).
 *   - Real server-side search with a 300ms debounce instead of pulling
 *     everything and filtering client-side.
 *   - Responsive popup (95vw on mobile, max 1400px on desktop) and a
 *     full-width search box so long names like "แคปซูล เบอร์ 0 สีเหลือง"
 *     aren't truncated.
 *   - Header stats, colored stock badges, and informative empty states.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DataGrid as DxDataGrid,
  Column as DxColumn,
  Selection as DxSelection,
  Scrolling as DxScrolling,
  Paging as DxPaging,
} from 'devextreme-react/data-grid';
import type { DataGridTypes } from 'devextreme-react/data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTabs } from '@/components/ui/dx-tabs';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import {
  Package,
  Leaf,
  Box,
  Wrench,
  Beaker,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Layers,
  BarChart3,
} from 'lucide-react';

export interface MaterialItem {
  id: number;
  code: string;
  nameTh: string;
  nameEn?: string | null;
  type?: string;
  primaryUnit: string;
  secondaryUnit?: string | null;
  onHand?: number | null;
  minStock?: number | null;
  reorderPoint?: number | null;
}

interface MaterialPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (items: MaterialItem[]) => void;
  /** Item ids that are already picked — hidden from the list. */
  excludeIds?: number[];
  title?: string;
}

// Ordered tabs. Each tab hits the API with ?type= so large tenants don't
// have to pull every non-finished-goods row just to show packaging.
const TYPE_TABS: Array<{ value: string; label: string; icon: typeof Package; color: string; bg: string }> = [
  { value: '',          label: 'ทั้งหมด',       icon: Package,  color: 'text-gray-700',    bg: 'bg-gray-100' },
  { value: 'raw_material', label: 'วัตถุดิบ',     icon: Leaf,     color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { value: 'packaging',    label: 'บรรจุภัณฑ์',   icon: Box,      color: 'text-blue-600',    bg: 'bg-blue-50' },
  { value: 'wip',          label: 'งานระหว่างทำ', icon: Wrench,   color: 'text-orange-600',  bg: 'bg-orange-50' },
  { value: 'extract',      label: 'สารสกัด',      icon: Beaker,   color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  { value: 'consumable',   label: 'วัสดุสิ้นเปลือง', icon: Package, color: 'text-gray-600',   bg: 'bg-gray-50' },
];

const TYPE_CONFIG: Record<string, { label: string; bg: string; color: string }> = Object.fromEntries(
  TYPE_TABS.filter((t) => t.value).map((t) => [t.value, { label: t.label, bg: t.bg, color: t.color }]),
);

function stockStatus(item: MaterialItem): { color: string; icon: typeof CheckCircle2 } {
  const onHand = Number(item.onHand) || 0;
  const reorder = Number(item.reorderPoint) || Number(item.minStock) || 0;
  if (onHand <= 0) return { color: 'text-red-600', icon: XCircle };
  if (onHand <= reorder) return { color: 'text-amber-600', icon: AlertTriangle };
  return { color: 'text-green-600', icon: CheckCircle2 };
}

export function MaterialPickerDialog({
  open,
  onOpenChange,
  onConfirm,
  excludeIds = [],
  title = 'เลือกวัตถุดิบ — Select Materials',
}: MaterialPickerDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);
  const [items, setItems] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // excludeIds comes from the parent's BOM line state and mutates as the
  // user adds rows — keep a ref so the search effect doesn't restart on
  // every mutation of the array identity.
  const excludeIdsRef = useRef(excludeIds);
  excludeIdsRef.current = excludeIds;

  const fetchItems = useCallback(async (query: string, type: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '500',
        activeOnly: 'true',
      });
      if (query.trim()) params.set('search', query.trim());
      if (type) params.set('type', type);

      const res = await fetch(`/api/items?${params}`);
      const data = await res.json();
      if (data.success) {
        const list: MaterialItem[] = data.data?.items || data.data || [];
        const exclude = new Set(excludeIdsRef.current);
        // Always hide finished_goods from the material picker — a BOM never
        // consumes a packaged finished product as a raw input.
        const filtered = list.filter(
          (it) => it.type !== 'finished_goods' && !exclude.has(it.id),
        );
        setItems(filtered);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce search changes so typing doesn't hammer the API; tab switches
  // fetch immediately since they change the result set wholesale.
  useEffect(() => {
    if (!open) return;
    const type = TYPE_TABS[selectedTab]?.value ?? '';
    const timer = setTimeout(() => {
      fetchItems(search, type);
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [open, search, selectedTab, fetchItems]);

  // Reset state whenever the dialog is closed; opening a fresh picker
  // should not surface the previous session's search term or selection.
  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedTab(0);
      setItems([]);
      setSelectedIds([]);
    }
  }, [open]);

  const stats = useMemo(() => {
    const total = items.length;
    const inStock = items.filter((i) => (Number(i.onHand) || 0) > 0).length;
    const out = items.filter((i) => (Number(i.onHand) || 0) <= 0).length;
    return { total, inStock, out };
  }, [items]);

  const onSelectionChanged = useCallback((e: DataGridTypes.SelectionChangedEvent) => {
    setSelectedIds(e.selectedRowKeys as number[]);
  }, []);

  const handleConfirm = useCallback(() => {
    if (selectedIds.length === 0) return;
    const picked = items.filter((it) => selectedIds.includes(it.id));
    onConfirm(picked);
  }, [selectedIds, items, onConfirm]);

  // Cell renderers — match the ItemSearchDialog visual language so both
  // pickers feel like part of the same system.
  interface CellInfo { data: MaterialItem }

  const renderCode = (c: CellInfo) => {
    const cfg = TYPE_CONFIG[c.data.type || ''] ?? { bg: 'bg-gray-100', color: 'text-gray-600', label: '-' };
    const Icon = TYPE_TABS.find((t) => t.value === c.data.type)?.icon ?? Package;
    return (
      <div className="flex items-center gap-2 min-w-0">
        <div className={`p-1.5 rounded-lg flex-shrink-0 ${cfg.bg}`}>
          <Icon className={`h-4 w-4 ${cfg.color}`} />
        </div>
        <span className="font-mono font-bold text-blue-600 truncate">{c.data.code}</span>
      </div>
    );
  };

  const renderName = (c: CellInfo) => (
    <div className="min-w-0">
      <p className="font-medium text-gray-900 truncate">{c.data.nameTh}</p>
      {c.data.nameEn && <p className="text-xs text-gray-500 truncate">{c.data.nameEn}</p>}
    </div>
  );

  const renderType = (c: CellInfo) => {
    const cfg = TYPE_CONFIG[c.data.type || ''] ?? { bg: 'bg-gray-100', color: 'text-gray-600', label: c.data.type || '-' };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
        {cfg.label}
      </span>
    );
  };

  const renderStock = (c: CellInfo) => {
    const status = stockStatus(c.data);
    const Icon = status.icon;
    const qty = Number(c.data.onHand) || 0;
    return (
      <div className={`flex items-center gap-1.5 justify-end ${status.color}`}>
        <Icon className="h-4 w-4" />
        <span className="font-medium">{qty.toLocaleString()}</span>
        <span className="text-gray-500 text-xs">{c.data.primaryUnit}</span>
      </div>
    );
  };

  return (
    <DxPopup
      visible={open}
      onHiding={() => onOpenChange(false)}
      title=""
      width="95%"
      maxWidth={1400}
      height="92%"
      maxHeight={900}
      showCloseButton
      showTitle={false}
    >
      <div className="flex flex-col h-full bg-gray-50">
        {/* Gradient header with title + live stats */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{title}</h2>
              <p className="text-emerald-50 text-sm">
                ค้นหาและเลือกได้หลายรายการพร้อมกัน แล้วกด “เพิ่มที่เลือก”
              </p>
            </div>
          </div>
          {stats.total > 0 && (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-center px-3 py-1 bg-white/10 rounded-lg">
                <p className="text-lg sm:text-2xl font-bold">{stats.total}</p>
                <p className="text-[10px] sm:text-xs text-emerald-50">พบ</p>
              </div>
              <div className="text-center px-3 py-1 bg-white/10 rounded-lg">
                <p className="text-lg sm:text-2xl font-bold text-green-200">{stats.inStock}</p>
                <p className="text-[10px] sm:text-xs text-emerald-50">มีสต็อก</p>
              </div>
              {stats.out > 0 && (
                <div className="text-center px-3 py-1 bg-white/10 rounded-lg">
                  <p className="text-lg sm:text-2xl font-bold text-red-200">{stats.out}</p>
                  <p className="text-[10px] sm:text-xs text-emerald-50">หมด</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky search + type tabs */}
        <div className="bg-white border-b px-4 sm:px-6 py-3 space-y-3">
          <div className="w-full">
            <DxTextBox
              placeholder="ค้นหาด้วยรหัส / ชื่อไทย / ชื่ออังกฤษ... (เช่น แคปซูล เบอร์ 0 สีเหลือง)"
              value={search}
              onValueChange={setSearch}
              mode="search"
              showClearButton
              height={44}
              elementAttr={{ 'data-testid': 'material-search-input' }}
            />
          </div>
          <DxTabs
            items={TYPE_TABS.map((t) => ({ text: t.label }))}
            selectedIndex={selectedTab}
            onItemClick={(e) => setSelectedTab(e.itemIndex ?? 0)}
          />
        </div>

        {/* Result grid (or skeleton / empty state) */}
        <div className="flex-1 px-4 sm:px-6 py-3 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <DxLoadIndicator />
              <p className="text-gray-500 mt-3">กำลังโหลดรายการ...</p>
            </div>
          ) : items.length > 0 ? (
            <DxDataGrid
              dataSource={items}
              keyExpr="id"
              showBorders
              showRowLines
              rowAlternationEnabled
              wordWrapEnabled
              columnAutoWidth
              height="100%"
              selectedRowKeys={selectedIds}
              onSelectionChanged={onSelectionChanged}
            >
              <DxSelection mode="multiple" showCheckBoxesMode="always" />
              <DxScrolling mode="virtual" />
              <DxPaging enabled={false} />
              <DxColumn dataField="code" caption="Code" width={180} cellRender={renderCode} allowSorting />
              <DxColumn dataField="nameTh" caption="ชื่อรายการ" minWidth={260} cellRender={renderName} allowSorting />
              <DxColumn dataField="type" caption="ประเภท" width={140} cellRender={renderType} allowSorting />
              <DxColumn
                dataField="onHand"
                caption="คงเหลือ"
                width={160}
                cellRender={renderStock}
                alignment="right"
                allowSorting
              />
              <DxColumn dataField="primaryUnit" caption="หน่วย" width={90} alignment="center" />
            </DxDataGrid>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <div className="p-6 bg-gray-100 rounded-full mb-4">
                <Search className="h-12 w-12 text-gray-400" />
              </div>
              <p className="text-xl font-medium text-gray-700 mb-1">ไม่พบรายการ</p>
              {search ? (
                <p className="text-gray-500 mb-4">ไม่มีรายการตรงกับ “{search}”</p>
              ) : (
                <p className="text-gray-500 mb-4">ไม่มีรายการในประเภทที่เลือก</p>
              )}
              <div className="bg-white rounded-xl p-4 border max-w-md text-left text-sm text-gray-600">
                <p className="font-medium text-gray-700 mb-2">คำแนะนำ:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>ลองค้นด้วยรหัสย่อ เช่น “RM-0005”</li>
                  <li>สลับ Tab ด้านบนเป็น “ทั้งหมด” เพื่อดูข้ามประเภท</li>
                  <li>ตรวจการสะกด ทั้งไทยและอังกฤษ</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer: stats + actions */}
        <div className="bg-white border-t px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            {items.length > 0 && (
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-gray-400" />
                <span>
                  แสดง <span className="font-semibold text-gray-800">{items.length}</span> รายการ
                </span>
              </div>
            )}
            {excludeIds.length > 0 && (
              <div className="flex items-center gap-2 text-gray-500">
                <Layers className="h-4 w-4" />
                <span>{excludeIds.length} รายการอยู่ใน BOM แล้ว</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 justify-end">
            {selectedIds.length > 0 && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                เลือกแล้ว {selectedIds.length} รายการ
              </span>
            )}
            <DxButton
              text="ยกเลิก"
              type="normal"
              stylingMode="outlined"
              onClick={() => onOpenChange(false)}
            />
            <DxButton
              text={
                selectedIds.length > 0
                  ? `+ เพิ่มที่เลือก (${selectedIds.length})`
                  : 'เลือกรายการก่อน'
              }
              type="success"
              icon="plus"
              onClick={handleConfirm}
              disabled={selectedIds.length === 0}
            />
          </div>
        </div>
      </div>
    </DxPopup>
  );
}

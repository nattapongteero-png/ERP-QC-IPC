'use client';
/**
 * Item Code Pattern master.
 *
 * One row per item type. Each row shows the live preview of what the
 * "สร้างรหัส" button on the item-edit form will produce. Editing a row
 * opens a popup with prefix/separator/padding/year controls + a 3-row
 * live preview so the designer can see the format before saving.
 */
import { useEffect, useMemo, useState } from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useToast } from '@/hooks/use-toast';
import { Hash, Sparkles, RotateCcw } from 'lucide-react';

type ItemTypeCode =
  | 'raw_material' | 'packaging' | 'wip' | 'finished_goods' | 'extract' | 'consumable';

interface PatternRow {
  id: number;
  itemType: ItemTypeCode;
  prefix: string;
  separator: string;
  padding: number;
  includeYear: boolean;
  yearFormat: 'YY' | 'YYYY' | 'BE-YY' | 'BE-YYYY';
  yearPosition: 'after_prefix' | 'before_seq';
  sequenceStart: number;
  isActive: boolean;
  notes: string | null;
  previewSample?: string;
}

const TYPE_LABELS: Record<ItemTypeCode, string> = {
  raw_material:   'วัตถุดิบ (Raw Material)',
  packaging:      'บรรจุภัณฑ์ (Packaging)',
  wip:            'งานระหว่างทำ (WIP)',
  finished_goods: 'สินค้าสำเร็จรูป (Finished Goods)',
  extract:        'สารสกัด (Extract)',
  consumable:     'วัสดุสิ้นเปลือง (Consumable)',
};

const SEPARATOR_OPTIONS = [
  { id: '-', name: 'ขีดกลาง  -' },
  { id: '_', name: 'ขีดล่าง  _' },
  { id: '/', name: 'ทับ  /' },
  { id: '.', name: 'จุด  .' },
  { id: '', name: '(ไม่ใส่)' },
];

const YEAR_FORMAT_OPTIONS = [
  { id: 'YY', name: 'YY  (เช่น 26)' },
  { id: 'YYYY', name: 'YYYY  (เช่น 2026)' },
  { id: 'BE-YY', name: 'พ.ศ. ย่อ  (เช่น 69)' },
  { id: 'BE-YYYY', name: 'พ.ศ. เต็ม  (เช่น 2569)' },
];

const YEAR_POS_OPTIONS = [
  { id: 'after_prefix', name: 'หลัง prefix  (เช่น RM-2026-0001)' },
  { id: 'before_seq', name: 'ก่อน sequence  (เช่น RM-2026-0001)' },
];

function previewLocal(p: {
  prefix: string;
  separator: string;
  padding: number;
  includeYear: boolean;
  yearFormat: string;
  yearPosition: string;
}, seq: number): string {
  const sep = p.separator ?? '-';
  const seqStr = String(seq).padStart(p.padding || 4, '0');
  if (!p.includeYear) return `${p.prefix}${sep}${seqStr}`;
  const now = new Date();
  const ad = now.getFullYear();
  const be = ad + 543;
  const yt =
    p.yearFormat === 'YY' ? String(ad).slice(-2) :
    p.yearFormat === 'YYYY' ? String(ad) :
    p.yearFormat === 'BE-YY' ? String(be).slice(-2) :
    p.yearFormat === 'BE-YYYY' ? String(be) :
    String(ad);
  return `${p.prefix}${sep}${yt}${sep}${seqStr}`;
}

type YearFormatCode = 'YY' | 'YYYY' | 'BE-YY' | 'BE-YYYY';
type YearPositionCode = 'after_prefix' | 'before_seq';

interface FormState {
  itemType: ItemTypeCode;
  prefix: string;
  separator: string;
  padding: number;
  includeYear: boolean;
  yearFormat: YearFormatCode;
  yearPosition: YearPositionCode;
  sequenceStart: number;
  isActive: boolean;
  notes: string;
}

const DEFAULT_FORM: FormState = {
  itemType: 'raw_material',
  prefix: 'RM',
  separator: '-',
  padding: 4,
  includeYear: false,
  yearFormat: 'YYYY',
  yearPosition: 'after_prefix',
  sequenceStart: 1,
  isActive: true,
  notes: '',
};

export default function ItemCodePatternsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<PatternRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState<PatternRow | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/master-data/item-code-patterns');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'load failed');
      setRows(Array.isArray(json?.data) ? json.data : []);
    } catch (e) {
      toast.error('โหลดข้อมูลไม่สำเร็จ', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openEdit = (row: PatternRow) => {
    setEditing(row);
    setForm({
      itemType: row.itemType,
      prefix: row.prefix,
      separator: row.separator ?? '-',
      padding: row.padding,
      includeYear: row.includeYear,
      yearFormat: row.yearFormat,
      yearPosition: row.yearPosition,
      sequenceStart: row.sequenceStart,
      isActive: row.isActive,
      notes: row.notes ?? '',
    });
    setShowEdit(true);
  };

  const submit = async () => {
    if (!form.prefix.trim()) {
      toast.error('กรุณากรอก prefix');
      return;
    }
    try {
      const res = await fetch('/api/master-data/item-code-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          prefix: form.prefix.trim(),
          notes: form.notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'save failed');
      toast.success('บันทึกรูปแบบรหัสเรียบร้อย');
      setShowEdit(false);
      setEditing(null);
      void load();
    } catch (e) {
      toast.error('บันทึกไม่สำเร็จ', (e as Error).message);
    }
  };

  const resetToDefault = (row: PatternRow) => {
    const defaults: Record<ItemTypeCode, string> = {
      raw_material: 'RM',
      packaging: 'PK',
      wip: 'WIP',
      finished_goods: 'FG',
      extract: 'EX',
      consumable: 'CN',
    };
    if (!confirm(`รีเซ็ตรหัส ${TYPE_LABELS[row.itemType]} กลับเป็นค่าเริ่มต้น (${defaults[row.itemType]}-0001)?`)) return;
    setEditing(row);
    setForm({
      itemType: row.itemType,
      prefix: defaults[row.itemType],
      separator: '-',
      padding: 4,
      includeYear: false,
      yearFormat: 'YYYY',
      yearPosition: 'after_prefix',
      sequenceStart: 1,
      isActive: true,
      notes: '',
    });
    setShowEdit(true);
  };

  const livePreview = useMemo(() => {
    const start = form.sequenceStart || 1;
    return [start, start + 1, start + 2].map((n) => previewLocal(form, n));
  }, [form]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((r) => r.isActive).length,
      withYear: rows.filter((r) => r.includeYear).length,
    }),
    [rows],
  );

  const columns: DxDataGridColumn[] = [
    {
      caption: 'ประเภทสินค้า',
      width: 240,
      cellRender: (c: any) => (
        <span className="font-medium" data-testid={`type-${c.data.itemType}`}>
          {TYPE_LABELS[c.data.itemType as ItemTypeCode]}
        </span>
      ),
    },
    { dataField: 'prefix', caption: 'Prefix', width: 100 },
    {
      dataField: 'separator',
      caption: 'คั่น',
      width: 70,
      cellRender: (c: any) => (
        <span className="font-mono text-sm">{c.value === '' ? '(ไม่ใส่)' : c.value}</span>
      ),
    },
    { dataField: 'padding', caption: 'หลัก', width: 70 },
    {
      caption: 'แทรกปี',
      width: 120,
      cellRender: (c: any) =>
        c.data.includeYear ? (
          <Badge className="bg-blue-100 text-blue-700">{c.data.yearFormat}</Badge>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        ),
    },
    { dataField: 'sequenceStart', caption: 'เริ่มที่', width: 80 },
    {
      caption: 'ตัวอย่างรหัส',
      cellRender: (c: any) => (
        <span
          className="font-mono text-base font-semibold text-emerald-700"
          data-testid={`preview-${c.data.itemType}`}
        >
          {c.data.previewSample || previewLocal(c.data, c.data.sequenceStart || 1)}
        </span>
      ),
    },
    {
      dataField: 'isActive',
      caption: 'Active',
      width: 80,
      cellRender: (c: any) =>
        c.value ? (
          <Badge className="bg-emerald-100 text-emerald-700">✓</Badge>
        ) : (
          <Badge className="bg-gray-200 text-gray-600">—</Badge>
        ),
    },
    {
      caption: '',
      width: 180,
      cellRender: (c: any) => (
        <div className="flex gap-3">
          <button
            className="text-xs text-blue-700 hover:underline"
            onClick={() => openEdit(c.data as PatternRow)}
            data-testid={`edit-${c.data.itemType}`}
          >
            แก้ไข
          </button>
          <button
            className="text-xs text-gray-500 hover:underline"
            onClick={() => resetToDefault(c.data as PatternRow)}
            data-testid={`reset-${c.data.itemType}`}
          >
            <RotateCcw className="inline w-3 h-3 mr-0.5" />รีเซ็ต
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 p-4">
        <ResponsivePageHeader
          title="รูปแบบรหัสสินค้า (Item Code Pattern)"
          subtitle="กำหนดรูปแบบรหัสที่ใช้สร้างอัตโนมัติเมื่อกดปุ่ม 'สร้างรหัส' ในหน้าเพิ่ม/แก้ไขสินค้า"
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="ทั้งหมด" value={stats.total} icon={Hash} />
          <StatCard label="ใช้งาน" value={stats.active} icon={Sparkles} iconColor="text-emerald-500" />
          <StatCard label="แทรกปี" value={stats.withYear} icon={Hash} iconColor="text-blue-500" />
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <strong>วิธีอ่าน:</strong> ตัวอย่างรหัสคือสิ่งที่ระบบจะสร้างเมื่อกดปุ่ม "สร้างรหัส" ในหน้าเพิ่มสินค้า
          ระบบจะหาเลข sequence ที่ว่างถัดไปอัตโนมัติเสมอ (เติมช่องว่างที่ลบไปแล้ว)
        </div>

        <div className="bg-white border rounded-lg">
          <DxDataGrid
            dataSource={rows}
            keyExpr="itemType"
            columns={columns}
            data-testid="patterns-grid"
          />
        </div>

        <DxPopup
          visible={showEdit}
          onHiding={() => setShowEdit(false)}
          title={`แก้ไขรูปแบบรหัส: ${TYPE_LABELS[form.itemType]}`}
          width={720}
          height="auto"
          showCloseButton
        >
          <div className="space-y-3 p-2">
            <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3">
              <div className="text-xs text-emerald-700 font-medium mb-1">ตัวอย่างรหัสที่จะสร้าง (3 รหัสแรก)</div>
              <div className="flex gap-3 flex-wrap">
                {livePreview.map((code, i) => (
                  <span
                    key={i}
                    className="font-mono text-lg font-bold text-emerald-800 bg-white border border-emerald-300 px-3 py-1 rounded"
                    data-testid={`live-preview-${i}`}
                  >
                    {code}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-600 block mb-1">Prefix *</label>
                <DxTextBox
                  placeholder="เช่น RM, FG, ม."
                  value={form.prefix}
                  onValueChanged={(e) => setForm({ ...form, prefix: (e.value || '').toUpperCase() })}
                  data-testid="prefix-input"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">ตัวคั่น</label>
                <DxSelectBox
                  dataSource={SEPARATOR_OPTIONS}
                  valueExpr="id"
                  displayExpr="name"
                  value={form.separator}
                  onValueChanged={(e) => setForm({ ...form, separator: e.value ?? '-' })}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">จำนวนหลัก sequence</label>
                <DxNumberBox
                  min={2}
                  max={10}
                  value={form.padding}
                  onValueChanged={(e) => setForm({ ...form, padding: Math.max(2, Math.min(10, Number(e.value || 4))) })}
                  data-testid="padding-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <DxCheckBox
                  text="แทรกปีในรหัส"
                  value={form.includeYear}
                  onValueChanged={(e) => setForm({ ...form, includeYear: !!e.value })}
                  data-testid="include-year"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">รูปแบบปี</label>
                <DxSelectBox
                  dataSource={YEAR_FORMAT_OPTIONS}
                  valueExpr="id"
                  displayExpr="name"
                  value={form.yearFormat}
                  disabled={!form.includeYear}
                  onValueChanged={(e) => setForm({ ...form, yearFormat: e.value })}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">ตำแหน่งปี</label>
                <DxSelectBox
                  dataSource={YEAR_POS_OPTIONS}
                  valueExpr="id"
                  displayExpr="name"
                  value={form.yearPosition}
                  disabled={!form.includeYear}
                  onValueChanged={(e) => setForm({ ...form, yearPosition: e.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600 block mb-1">Sequence เริ่มต้นที่</label>
                <DxNumberBox
                  min={1}
                  value={form.sequenceStart}
                  onValueChanged={(e) => setForm({ ...form, sequenceStart: Math.max(1, Number(e.value || 1)) })}
                />
              </div>
              <div className="flex items-end">
                <DxCheckBox
                  text="ใช้งาน"
                  value={form.isActive}
                  onValueChanged={(e) => setForm({ ...form, isActive: !!e.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-600 block mb-1">หมายเหตุ</label>
              <DxTextArea
                placeholder="(optional)"
                value={form.notes}
                onValueChanged={(e) => setForm({ ...form, notes: e.value || '' })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <DxButton text="ยกเลิก" onClick={() => setShowEdit(false)} />
              <DxButton
                text={editing ? 'บันทึก' : 'สร้าง'}
                type="default"
                onClick={submit}
                data-testid="submit"
              />
            </div>
          </div>
        </DxPopup>
    </div>
  );
}

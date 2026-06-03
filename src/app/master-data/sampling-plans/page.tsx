'use client';
/**
 * QC Sampling Plan master (Audit QC5)
 * Per-item / per-category AQL, sample size, frequency, retain qty.
 */
import { useEffect, useState, useMemo } from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useToast } from '@/hooks/use-toast';
import { Layers, CheckCircle2, ListChecks } from 'lucide-react';

interface PlanRow {
  id: number;
  code: string;
  name: string;
  itemId: number | null;
  itemCode: string | null;
  itemName: string | null;
  category: string | null;
  inspectionLevel: 'I' | 'II' | 'III';
  aql: number;
  sampleSize: number | null;
  acceptNumber: number | null;
  rejectNumber: number | null;
  frequency: string;
  standardRef: string | null;
  defaultSampleQty: number | null;
  defaultRetainQty: number | null;
  isActive: boolean;
  notes: string | null;
}

const FREQ_OPTIONS = [
  { id: 'every_lot', name: 'ทุกล็อต (every_lot)' },
  { id: 'random_30pct', name: 'สุ่ม 30% (random_30pct)' },
  { id: 'random_10pct', name: 'สุ่ม 10% (random_10pct)' },
  { id: 'reduced', name: 'ลดความถี่ (reduced)' },
  { id: 'tightened', name: 'เพิ่มความถี่ (tightened)' },
  { id: 'skip_lot', name: 'ข้ามบางล็อต (skip_lot)' },
];

const LEVEL_OPTIONS = [
  { id: 'I', name: 'Level I (reduced)' },
  { id: 'II', name: 'Level II (normal)' },
  { id: 'III', name: 'Level III (tightened)' },
];

export default function SamplingPlansPage() {
  const toast = useToast();
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [items, setItems] = useState<{ id: number; code: string; nameTh: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    itemId: null as number | null,
    category: '',
    inspectionLevel: 'II' as 'I' | 'II' | 'III',
    aql: 1.0,
    sampleSize: null as number | null,
    acceptNumber: null as number | null,
    rejectNumber: null as number | null,
    frequency: 'every_lot',
    standardRef: 'ISO 2859-1',
    defaultSampleQty: null as number | null,
    defaultRetainQty: null as number | null,
    notes: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [planRes, itemRes] = await Promise.all([
        fetch(`/api/master-data/sampling-plans${activeOnly ? '?activeOnly=true' : ''}`),
        fetch('/api/items?limit=500'),
      ]);
      const planJson = await planRes.json();
      const itemJson = await itemRes.json();
      setRows(planJson?.data || []);
      setItems(itemJson?.data?.items || itemJson?.data || []);
    } catch (e) {
      toast.error('โหลดข้อมูลไม่สำเร็จ', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOnly]);

  const resetForm = () => {
    setForm({
      code: '',
      name: '',
      itemId: null,
      category: '',
      inspectionLevel: 'II',
      aql: 1.0,
      sampleSize: null,
      acceptNumber: null,
      rejectNumber: null,
      frequency: 'every_lot',
      standardRef: 'ISO 2859-1',
      defaultSampleQty: null,
      defaultRetainQty: null,
      notes: '',
    });
  };

  const openAdd = () => {
    setEditing(null);
    resetForm();
    setShowAdd(true);
  };

  const openEdit = (row: PlanRow) => {
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name,
      itemId: row.itemId,
      category: row.category || '',
      inspectionLevel: row.inspectionLevel,
      aql: Number(row.aql),
      sampleSize: row.sampleSize,
      acceptNumber: row.acceptNumber,
      rejectNumber: row.rejectNumber,
      frequency: row.frequency,
      standardRef: row.standardRef || '',
      defaultSampleQty: row.defaultSampleQty,
      defaultRetainQty: row.defaultRetainQty,
      notes: row.notes || '',
    });
    setShowAdd(true);
  };

  const submit = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('กรุณากรอก code และชื่อ');
      return;
    }
    const url = editing
      ? `/api/master-data/sampling-plans/${editing.id}`
      : '/api/master-data/sampling-plans';
    const res = await fetch(url, {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        category: form.category.trim() || null,
        standardRef: form.standardRef.trim() || null,
        notes: form.notes.trim() || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error('บันทึกไม่สำเร็จ', json?.error);
      return;
    }
    toast.success(editing ? 'แก้ไขแล้ว' : 'สร้างแผนเรียบร้อย');
    setShowAdd(false);
    setEditing(null);
    resetForm();
    void load();
  };

  const deactivate = async (row: PlanRow) => {
    if (!confirm(`ปิดใช้งานแผน ${row.code}?`)) return;
    const res = await fetch(`/api/master-data/sampling-plans/${row.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json();
      toast.error('ปิดใช้งานไม่สำเร็จ', j?.error);
      return;
    }
    toast.success('ปิดใช้งานแล้ว');
    void load();
  };

  const stats = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((r) => r.isActive).length,
      itemScoped: rows.filter((r) => r.itemId).length,
    }),
    [rows],
  );

  const columns: DxDataGridColumn[] = [
    { dataField: 'code', caption: 'Code', width: 140 },
    { dataField: 'name', caption: 'ชื่อแผน' },
    {
      caption: 'Scope',
      width: 200,
      cellRender: (c: any) => {
        const d = c.data as PlanRow;
        if (d.itemCode) {
          return (
            <span className="text-xs">
              Item: <strong>{d.itemCode}</strong>{' '}
              <span className="text-gray-500">— {d.itemName || ''}</span>
            </span>
          );
        }
        if (d.category) return <span className="text-xs">Category: <strong>{d.category}</strong></span>;
        return <span className="text-xs text-gray-500">Global default</span>;
      },
    },
    { dataField: 'inspectionLevel', caption: 'Level', width: 70 },
    { dataField: 'aql', caption: 'AQL', width: 70 },
    { dataField: 'sampleSize', caption: 'n', width: 70 },
    {
      dataField: 'frequency',
      caption: 'Frequency',
      width: 130,
      cellRender: (c: any) => {
        const opt = FREQ_OPTIONS.find((o) => o.id === c.value);
        return <span className="text-xs">{opt?.name || c.value}</span>;
      },
    },
    { dataField: 'standardRef', caption: 'Standard', width: 110 },
    {
      dataField: 'isActive',
      caption: 'Active',
      width: 70,
      cellRender: (c: any) =>
        c.value ? <Badge className="bg-emerald-100 text-emerald-700">✓</Badge> : <Badge className="bg-gray-200 text-gray-600">—</Badge>,
    },
    {
      caption: '',
      width: 140,
      cellRender: (c: any) => (
        <div className="flex gap-1">
          <button
            className="text-xs text-blue-700 hover:underline"
            onClick={() => openEdit(c.data as PlanRow)}
            data-testid={`edit-${c.data.id}`}
          >
            แก้ไข
          </button>
          {c.data.isActive && (
            <button
              className="text-xs text-red-600 hover:underline"
              onClick={() => deactivate(c.data as PlanRow)}
            >
              ปิดใช้
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 p-4">
        <ResponsivePageHeader
          title="QC Sampling Plan Master"
          subtitle="กำหนดแผน sampling ตาม item/category — AQL, sample size, frequency"
          actions={
            <DxButton
              text="+ แผนใหม่"
              type="default"
              onClick={openAdd}
              data-testid="sampling-plan-add"
            />
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="แผนทั้งหมด" value={stats.total} icon={Layers} />
          <StatCard label="Active" value={stats.active} icon={CheckCircle2} iconColor="text-emerald-500" />
          <StatCard label="ผูกกับ Item เฉพาะ" value={stats.itemScoped} icon={ListChecks} />
        </div>

        <div className="flex items-center gap-3 bg-white border rounded-lg p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              data-testid="active-only-filter"
            />
            แสดงเฉพาะ Active
          </label>
        </div>

        <div className="bg-white border rounded-lg">
          <DxDataGrid
            dataSource={rows}
            keyExpr="id"
            columns={columns}
            data-testid="sampling-plans-grid"
          />
        </div>

        <DxPopup
          visible={showAdd}
          onHiding={() => setShowAdd(false)}
          title={editing ? `แก้ไข: ${editing.code}` : 'แผน Sampling ใหม่'}
          width={720}
          height="auto"
          showCloseButton
        >
          <div className="space-y-3 p-2">
            <div className="grid grid-cols-2 gap-3">
              <DxTextBox
                placeholder="Code * (เช่น rm-herb-default)"
                value={form.code}
                onValueChanged={(e) => setForm({ ...form, code: (e.value || '').toLowerCase() })}
                disabled={!!editing}
                data-testid="plan-code"
              />
              <DxTextBox
                placeholder="ชื่อแผน *"
                value={form.name}
                onValueChanged={(e) => setForm({ ...form, name: e.value || '' })}
                data-testid="plan-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DxSelectBox
                placeholder="ผูกกับ Item (optional)"
                dataSource={[
                  { id: null as number | null, name: '— ไม่ผูก —' },
                  ...items.map((i) => ({ id: i.id, name: `${i.code} — ${i.nameTh}` })),
                ]}
                valueExpr="id"
                displayExpr="name"
                value={form.itemId}
                onValueChanged={(e) => setForm({ ...form, itemId: e.value })}
                searchEnabled
              />
              <DxTextBox
                placeholder="หรือผูกกับ Category"
                value={form.category}
                onValueChanged={(e) => setForm({ ...form, category: e.value || '' })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <DxSelectBox
                placeholder="Inspection Level"
                dataSource={LEVEL_OPTIONS}
                valueExpr="id"
                displayExpr="name"
                value={form.inspectionLevel}
                onValueChanged={(e) => setForm({ ...form, inspectionLevel: e.value })}
              />
              <DxNumberBox
                placeholder="AQL"
                value={form.aql}
                format="#,##0.00"
                onValueChanged={(e) => setForm({ ...form, aql: Number(e.value || 1.0) })}
              />
              <DxSelectBox
                placeholder="Frequency"
                dataSource={FREQ_OPTIONS}
                valueExpr="id"
                displayExpr="name"
                value={form.frequency}
                onValueChanged={(e) => setForm({ ...form, frequency: e.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <DxNumberBox
                placeholder="Sample Size (n)"
                value={form.sampleSize ?? undefined}
                onValueChanged={(e) => setForm({ ...form, sampleSize: e.value ?? null })}
              />
              <DxNumberBox
                placeholder="Accept"
                value={form.acceptNumber ?? undefined}
                onValueChanged={(e) => setForm({ ...form, acceptNumber: e.value ?? null })}
              />
              <DxNumberBox
                placeholder="Reject"
                value={form.rejectNumber ?? undefined}
                onValueChanged={(e) => setForm({ ...form, rejectNumber: e.value ?? null })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <DxTextBox
                placeholder="Standard Ref"
                value={form.standardRef}
                onValueChanged={(e) => setForm({ ...form, standardRef: e.value || '' })}
              />
              <DxNumberBox
                placeholder="Sample qty (default)"
                value={form.defaultSampleQty ?? undefined}
                onValueChanged={(e) => setForm({ ...form, defaultSampleQty: e.value ?? null })}
              />
              <DxNumberBox
                placeholder="Retain qty (default)"
                value={form.defaultRetainQty ?? undefined}
                onValueChanged={(e) => setForm({ ...form, defaultRetainQty: e.value ?? null })}
              />
            </div>
            <DxTextArea
              placeholder="หมายเหตุ"
              value={form.notes}
              onValueChanged={(e) => setForm({ ...form, notes: e.value || '' })}
              height={60}
            />
            <div className="flex justify-end gap-2 pt-2 border-t">
              <DxButton text="ยกเลิก" onClick={() => setShowAdd(false)} />
              <DxButton
                text="บันทึก"
                type="success"
                onClick={submit}
                data-testid="plan-submit"
              />
            </div>
          </div>
        </DxPopup>

        {loading && <div className="text-center text-gray-500 py-4">กำลังโหลด...</div>}
    </div>
  );
}

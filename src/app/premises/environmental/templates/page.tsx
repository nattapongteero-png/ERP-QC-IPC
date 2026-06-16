'use client';

/**
 * Inspection Templates — list + edit + delete page.
 *
 * The inspections page (/environmental/inspections) only exposes a
 * "+ Template" creation popup; templates created there had no list view
 * and no way to edit. This page closes that gap: shows every template
 * (active + inactive), lets QA edit name / target / items in-place, and
 * supports soft-delete (sets isActive=false via the existing DELETE
 * endpoint).
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid, Column, Paging, Pager } from 'devextreme-react/data-grid';
import { Popup } from 'devextreme-react/popup';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, Pencil, Trash2, Plus } from 'lucide-react';
import { Breadcrumbs } from '@/components/shared';
import {
  INSPECTION_TARGET_TYPES,
  type InspectionTargetType,
  type InspectionTemplate,
  type InspectionTemplateItem,
} from '@/types/environmental-monitoring';

interface ItemForm {
  label: string;
  parameter: string;
  unit: string;
  specMin: number | '';
  specMax: number | '';
  isMandatory: boolean;
  sortOrder: number;
}

interface TmplForm {
  name: string;
  description: string;
  targetType: InspectionTargetType;
  items: ItemForm[];
}

const blankItem = (sortOrder: number): ItemForm => ({
  label: '',
  parameter: '',
  unit: '',
  specMin: '',
  specMax: '',
  isMandatory: true,
  sortOrder,
});

const blankForm: TmplForm = {
  name: '',
  description: '',
  targetType: 'room',
  items: [blankItem(1)],
};

const targetLabel = (t: InspectionTargetType) =>
  ({ room: 'ห้องผลิต', storage_area: 'พื้นที่จัดเก็บ', quarantine: 'พื้นที่กักกัน', water_point: 'จุดน้ำ' })[t] ?? t;

export default function TemplatesPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const [editing, setEditing] = useState<InspectionTemplate | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [form, setForm] = useState<TmplForm>(blankForm);

  const { data: templates = [], isLoading, refetch } = useQuery<InspectionTemplate[]>({
    queryKey: ['env-templates-all'],
    queryFn: async () => {
      const res = await fetch('/api/environmental/templates');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description ?? '',
        targetType: editing.targetType,
        items: editing.items.map((it, idx) => ({
          label: it.label,
          parameter: it.parameter,
          unit: it.unit ?? '',
          specMin: it.specMin ?? '',
          specMax: it.specMax ?? '',
          isMandatory: it.isMandatory,
          sortOrder: it.sortOrder || idx + 1,
        })),
      });
      setPopupOpen(true);
    }
  }, [editing]);

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm);
    setPopupOpen(true);
  };

  const closePopup = () => {
    setPopupOpen(false);
    setEditing(null);
    setForm(blankForm);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        targetType: form.targetType,
        items: form.items
          .filter((it) => it.label.trim().length > 0)
          .map((it, idx) => ({
            label: it.label.trim(),
            parameter: it.parameter.trim() || it.label.trim().toLowerCase().replace(/\s+/g, '_'),
            unit: it.unit.trim() || null,
            specMin: it.specMin === '' ? null : Number(it.specMin),
            specMax: it.specMax === '' ? null : Number(it.specMax),
            isMandatory: it.isMandatory,
            sortOrder: idx + 1,
          })),
      };
      const url = editing
        ? `/api/environmental/templates/${editing.id}`
        : `/api/environmental/templates`;
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Save failed');
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['env-templates-all'] });
      qc.invalidateQueries({ queryKey: ['env-templates'] });
      toast.success(editing ? 'อัปเดต Template แล้ว' : 'สร้าง Template แล้ว');
      closePopup();
    },
    onError: (e: Error) => toast.error('ล้มเหลว', e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/environmental/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? 'Delete failed');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['env-templates-all'] });
      qc.invalidateQueries({ queryKey: ['env-templates'] });
      toast.success('ปิดการใช้งาน Template แล้ว');
    },
    onError: (e: Error) => toast.error('ลบไม่ได้', e.message),
  });

  const handleDelete = (row: InspectionTemplate) => {
    if (!confirm(`ปิดการใช้งาน Template "${row.name}" ใช่หรือไม่?\n(ข้อมูลย้อนหลังไม่ถูกลบ — แค่ซ่อนจากตัวเลือกใหม่)`)) return;
    deleteMut.mutate(row.id);
  };

  const stats = useMemo(() => {
    const active = templates.filter((t) => t.isActive).length;
    return { total: templates.length, active, inactive: templates.length - active };
  }, [templates]);

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs
        items={[
          { label: 'อาคารและสถานที่', href: '/premises' },
          { label: 'ตรวจสภาพแวดล้อม', href: '/premises/environmental/inspections' },
          { label: 'แบบฟอร์มตรวจ (Templates)' },
        ]}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6" /> แบบฟอร์มตรวจ (Templates)
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            สร้าง/แก้ไขแบบฟอร์มตรวจสภาพแวดล้อม — รายการรอบ ๆ ใน Template จะแสดงเป็น checklist เมื่อกดปุ่ม "ตรวจสอบ" ที่หน้า inspections
          </p>
        </div>
        <Button icon="refresh" text="รีเฟรช" onClick={() => refetch()} />
      </div>

      <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-sm text-sky-900">
        <span className="font-medium">แบบฟอร์มตรวจ (Template) คืออะไร?</span> คือ "รายการสิ่งที่ต้องวัด" เช่น
        อุณหภูมิ ความชื้น ความสะอาด พร้อมเกณฑ์ (min–max) — ยังไม่ผูกกับห้อง/พื้นที่จริง
        การจะเอาไปใช้ตรวจสถานที่จริง ให้ไปผูกที่หน้า{' '}
        <Link href="/premises/environmental/schedules" className="underline font-medium">ตารางตรวจ (Schedules)</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div className="text-xs uppercase text-gray-500">ทั้งหมด</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-emerald-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div className="text-xs uppercase text-gray-500">ใช้งานอยู่</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{stats.active}</div>
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-gray-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div className="text-xs uppercase text-gray-500">ปิดการใช้งาน</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{stats.inactive}</div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="default" stylingMode="contained" onClick={openCreate}>
          <span className="inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> สร้าง Template ใหม่
          </span>
        </Button>
      </div>

      <DataGrid
        dataSource={templates}
        keyExpr="id"
        showBorders
        showRowLines
        rowAlternationEnabled
        columnAutoWidth
        noDataText={isLoading ? 'กำลังโหลด…' : 'ยังไม่มี Template'}
      >
        <Paging pageSize={20} />
        <Pager visible showPageSizeSelector allowedPageSizes={[20, 50, 100]} />
        <Column dataField="id" caption="#" width={60} />
        <Column dataField="name" caption="ชื่อ Template" />
        <Column
          caption="ใช้กับสถานที่ประเภท"
          dataField="targetType"
          width={160}
          cellRender={(c) => <Badge className="bg-indigo-100 text-indigo-900">{targetLabel(c.value)}</Badge>}
        />
        <Column
          caption="จำนวน Items"
          width={120}
          cellRender={(c) => (c.data as InspectionTemplate).items.length}
        />
        <Column dataField="description" caption="คำอธิบาย" />
        <Column
          dataField="isActive"
          caption="สถานะ"
          width={110}
          cellRender={(c) =>
            c.value ? (
              <Badge className="bg-emerald-100 text-emerald-900">ใช้งานอยู่</Badge>
            ) : (
              <Badge className="bg-gray-200 text-gray-700">ปิดใช้งาน</Badge>
            )
          }
        />
        <Column
          caption="การกระทำ"
          width={170}
          cellRender={(c) => {
            const row = c.data as InspectionTemplate;
            return (
              <div className="flex gap-1">
                <Button stylingMode="outlined" onClick={() => setEditing(row)}>
                  <span className="inline-flex items-center gap-1 text-xs">
                    <Pencil className="w-3 h-3" /> แก้ไข
                  </span>
                </Button>
                {row.isActive && (
                  <Button stylingMode="text" type="danger" onClick={() => handleDelete(row)}>
                    <span className="inline-flex items-center gap-1 text-xs">
                      <Trash2 className="w-3 h-3" /> ปิด
                    </span>
                  </Button>
                )}
              </div>
            );
          }}
        />
      </DataGrid>

      <Popup
        visible={popupOpen}
        onHiding={closePopup}
        showCloseButton
        title={editing ? `แก้ไข Template — ${editing.name}` : '+ Inspection Template'}
        width={760}
        height="auto"
      >
        <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium mb-1">ชื่อ Template *</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="เช่น Daily Room Inspection"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">คำอธิบาย</label>
            <textarea
              className="w-full border rounded px-3 py-2"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="เช่น แบบฟอร์มตรวจประจำวันสำหรับห้องผลิต"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ใช้แบบฟอร์มนี้กับสถานที่ประเภท *</label>
            <p className="text-xs text-gray-500 mb-1">
              เลือก "ชนิด" ของสถานที่ที่จะนำแบบฟอร์มนี้ไปใช้ตรวจ — ห้องผลิต / พื้นที่จัดเก็บ / พื้นที่กักกัน / จุดน้ำ
            </p>
            <SelectBox
              dataSource={INSPECTION_TARGET_TYPES.map((v) => ({ value: v, label: targetLabel(v) }))}
              valueExpr="value"
              displayExpr="label"
              value={form.targetType}
              disabled={!!editing}
              onValueChanged={(e) => setForm({ ...form, targetType: e.value as InspectionTargetType })}
            />
            {editing && (
              <p className="text-xs text-gray-500 mt-1">
                * เปลี่ยนประเภทเป้าหมายไม่ได้หลังสร้าง Template (จะส่งผลกระทบกับ schedules + records ย้อนหลัง)
              </p>
            )}
          </div>
          <div className="border-t pt-3">
            <div className="font-medium text-sm mb-2">รายการตรวจ (Items)</div>
            {form.items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-center">
                <input
                  className="col-span-3 border rounded px-2 py-1 text-sm"
                  placeholder="ป้ายชื่อ"
                  value={it.label}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      items: prev.items.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)),
                    }))
                  }
                />
                <input
                  className="col-span-2 border rounded px-2 py-1 text-sm"
                  placeholder="parameter"
                  value={it.parameter}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      items: prev.items.map((x, i) => (i === idx ? { ...x, parameter: e.target.value } : x)),
                    }))
                  }
                />
                <input
                  className="col-span-1 border rounded px-2 py-1 text-sm"
                  placeholder="หน่วย"
                  value={it.unit}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      items: prev.items.map((x, i) => (i === idx ? { ...x, unit: e.target.value } : x)),
                    }))
                  }
                />
                <input
                  type="number"
                  step="0.01"
                  className="col-span-2 border rounded px-2 py-1 text-sm"
                  placeholder="min"
                  value={it.specMin}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      items: prev.items.map((x, i) =>
                        i === idx ? { ...x, specMin: e.target.value === '' ? '' : Number(e.target.value) } : x,
                      ),
                    }))
                  }
                />
                <input
                  type="number"
                  step="0.01"
                  className="col-span-2 border rounded px-2 py-1 text-sm"
                  placeholder="max"
                  value={it.specMax}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      items: prev.items.map((x, i) =>
                        i === idx ? { ...x, specMax: e.target.value === '' ? '' : Number(e.target.value) } : x,
                      ),
                    }))
                  }
                />
                <label className="col-span-1 inline-flex items-center text-xs gap-1">
                  <input
                    type="checkbox"
                    checked={it.isMandatory}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        items: prev.items.map((x, i) => (i === idx ? { ...x, isMandatory: e.target.checked } : x)),
                      }))
                    }
                  />
                  จำเป็น
                </label>
                <Button
                  icon="trash"
                  stylingMode="text"
                  onClick={() => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))}
                />
              </div>
            ))}
            <Button
              text="+ เพิ่ม Item"
              stylingMode="text"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  items: [...prev.items, blankItem(prev.items.length + 1)],
                }))
              }
            />
          </div>
          {saveMut.error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded p-3 text-sm">
              {String((saveMut.error as Error).message)}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button text="ยกเลิก" stylingMode="text" onClick={closePopup} />
            <Button
              type="default"
              stylingMode="contained"
              text={editing ? 'บันทึกการแก้ไข' : 'สร้าง'}
              disabled={
                !form.name.trim() ||
                form.items.every((it) => it.label.trim().length === 0) ||
                saveMut.isPending
              }
              onClick={() => saveMut.mutate()}
            />
          </div>
        </div>
      </Popup>
    </div>
  );
}

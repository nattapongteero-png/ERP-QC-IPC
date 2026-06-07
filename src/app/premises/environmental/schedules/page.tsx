'use client';

/**
 * Inspection Schedules — list + edit + delete page.
 *
 * Parallel to /environmental/templates: gives QA a place to list every
 * Schedule, edit cadence/alert/name, and soft-delete one without going
 * back through the create popup. Target type + target id are LOCKED on
 * edit because schedules point at a specific room/area; changing them
 * would orphan past records.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid, Column, FilterRow, HeaderFilter, Paging, Pager } from 'devextreme-react/data-grid';
import { Popup } from 'devextreme-react/popup';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import { NumberBox } from 'devextreme-react/number-box';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CalendarClock, Pencil, Trash2, Plus } from 'lucide-react';
import { Breadcrumbs } from '@/components/shared';
import {
  INSPECTION_TARGET_TYPES,
  INSPECTION_FREQUENCIES,
  type InspectionTargetType,
  type InspectionFrequency,
  type InspectionTemplate,
} from '@/types/environmental-monitoring';

interface ScheduleRow {
  id: number;
  targetType: InspectionTargetType;
  targetId: number;
  targetName: string;
  templateId: number;
  templateName: string;
  frequency: InspectionFrequency;
  alertDaysBefore: number;
  isActive: boolean;
  nextDue: string;
  lastDone: string | null;
}

interface TargetOption {
  id: number;
  name: string;
}

const targetLabel = (t: InspectionTargetType) =>
  ({ room: 'ห้องผลิต', storage_area: 'พื้นที่จัดเก็บ', quarantine: 'พื้นที่กักกัน', water_point: 'จุดน้ำ' })[t] ?? t;

const freqLabel = (f: InspectionFrequency) =>
  ({ daily: 'ประจำวัน', weekly: 'ประจำสัปดาห์', monthly: 'ประจำเดือน', quarterly: 'ทุกไตรมาส', yearly: 'ประจำปี' })[f] ?? f;

interface FormState {
  targetType: InspectionTargetType;
  targetId: number | null;
  targetName: string;
  templateId: number | null;
  frequency: InspectionFrequency;
  alertDaysBefore: number;
}

const blankForm: FormState = {
  targetType: 'room',
  targetId: null,
  targetName: '',
  templateId: null,
  frequency: 'daily',
  alertDaysBefore: 1,
};

export default function SchedulesPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const [editing, setEditing] = useState<ScheduleRow | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm);

  const { data: schedData, isLoading, refetch } = useQuery<{ items: ScheduleRow[] }>({
    queryKey: ['env-schedules-all'],
    queryFn: async () => {
      const res = await fetch('/api/environmental/schedules');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });
  const schedules = schedData?.items ?? [];

  const { data: templates = [] } = useQuery<InspectionTemplate[]>({
    queryKey: ['env-templates'],
    queryFn: async () => {
      const res = await fetch('/api/environmental/templates');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const { data: targetData = { items: [] } } = useQuery<{ items: TargetOption[] }>({
    queryKey: ['env-targets', form.targetType],
    queryFn: async () => {
      const res = await fetch(`/api/environmental/targets?type=${form.targetType}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: popupOpen,
  });

  useEffect(() => {
    if (editing) {
      setForm({
        targetType: editing.targetType,
        targetId: editing.targetId,
        targetName: editing.targetName,
        templateId: editing.templateId,
        frequency: editing.frequency,
        alertDaysBefore: editing.alertDaysBefore,
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

  const templatesForType = templates.filter((t) => t.targetType === form.targetType && t.isActive);

  const saveMut = useMutation({
    mutationFn: async () => {
      const url = editing
        ? `/api/environmental/schedules/${editing.id}`
        : `/api/environmental/schedules`;
      const method = editing ? 'PUT' : 'POST';
      const payload = editing
        ? {
            targetName: form.targetName,
            frequency: form.frequency,
            alertDaysBefore: form.alertDaysBefore,
          }
        : {
            targetType: form.targetType,
            targetId: form.targetId,
            targetName: form.targetName,
            templateId: form.templateId,
            frequency: form.frequency,
            alertDaysBefore: form.alertDaysBefore,
          };
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
      qc.invalidateQueries({ queryKey: ['env-schedules-all'] });
      qc.invalidateQueries({ queryKey: ['env-schedules'] });
      toast.success(editing ? 'อัปเดต Schedule แล้ว' : 'สร้าง Schedule แล้ว');
      closePopup();
    },
    onError: (e: Error) => toast.error('ล้มเหลว', e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/environmental/schedules/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? 'Delete failed');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['env-schedules-all'] });
      qc.invalidateQueries({ queryKey: ['env-schedules'] });
      toast.success('ปิดการใช้งาน Schedule แล้ว');
    },
    onError: (e: Error) => toast.error('ลบไม่ได้', e.message),
  });

  const handleDelete = (row: ScheduleRow) => {
    if (!confirm(`ปิดการใช้งาน Schedule สำหรับ "${row.targetName}" ใช่หรือไม่?\n(บันทึกย้อนหลังไม่หาย — แค่ไม่ต้องตรวจรอบถัดไป)`)) return;
    deleteMut.mutate(row.id);
  };

  const stats = useMemo(() => {
    const active = schedules.filter((s) => s.isActive).length;
    return { total: schedules.length, active, inactive: schedules.length - active };
  }, [schedules]);

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs
        items={[
          { label: 'อาคารและสถานที่', href: '/premises' },
          { label: 'ตรวจสภาพแวดล้อม', href: '/premises/environmental/inspections' },
          { label: 'ตารางตรวจ (Schedules)' },
        ]}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarClock className="w-6 h-6" /> ตารางตรวจ (Schedules)
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            กำหนดว่า "ห้อง / พื้นที่ / จุดน้ำ" ไหน ใช้แบบฟอร์มไหน ตรวจถี่แค่ไหน — ปุ่ม "ตรวจสอบ" ที่หน้าหลักสร้างจากตารางนี้
          </p>
        </div>
        <Button icon="refresh" text="รีเฟรช" onClick={() => refetch()} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-gray-50 border rounded-lg p-4">
          <div className="text-xs uppercase opacity-70">ทั้งหมด</div>
          <div className="text-3xl font-bold mt-1">{stats.total}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="text-xs uppercase opacity-70 text-emerald-900">ใช้งานอยู่</div>
          <div className="text-3xl font-bold text-emerald-900 mt-1">{stats.active}</div>
        </div>
        <div className="bg-gray-100 border rounded-lg p-4">
          <div className="text-xs uppercase opacity-70">ปิดการใช้งาน</div>
          <div className="text-3xl font-bold text-gray-600 mt-1">{stats.inactive}</div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="default" stylingMode="contained" onClick={openCreate}>
          <span className="inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> สร้าง Schedule ใหม่
          </span>
        </Button>
      </div>

      <DataGrid
        dataSource={schedules}
        keyExpr="id"
        showBorders
        showRowLines
        rowAlternationEnabled
        columnAutoWidth
        noDataText={isLoading ? 'กำลังโหลด…' : 'ยังไม่มี Schedule'}
      >
        <FilterRow visible />
        <HeaderFilter visible />
        <Paging pageSize={20} />
        <Pager visible showPageSizeSelector allowedPageSizes={[20, 50, 100]} />
        <Column dataField="id" caption="#" width={60} />
        <Column
          caption="ประเภทพื้นที่"
          dataField="targetType"
          width={130}
          cellRender={(c) => <Badge className="bg-indigo-100 text-indigo-900">{targetLabel(c.value)}</Badge>}
        />
        <Column dataField="targetName" caption="Target" />
        <Column dataField="templateName" caption="แบบฟอร์ม" />
        <Column
          dataField="frequency"
          caption="ความถี่"
          width={130}
          cellRender={(c) => freqLabel(c.value)}
        />
        <Column dataField="alertDaysBefore" caption="แจ้งล่วงหน้า (วัน)" width={150} />
        <Column dataField="nextDue" caption="ครบกำหนดถัดไป" dataType="datetime" width={170} />
        <Column dataField="lastDone" caption="ตรวจล่าสุด" dataType="datetime" width={170} />
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
            const row = c.data as ScheduleRow;
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
        title={editing ? `แก้ไข Schedule — ${editing.targetName}` : '+ Inspection Schedule'}
        width={620}
        height="auto"
      >
        <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium mb-1">ประเภทพื้นที่ *</label>
            <SelectBox
              dataSource={INSPECTION_TARGET_TYPES.map((v) => ({ value: v, label: targetLabel(v) }))}
              valueExpr="value"
              displayExpr="label"
              value={form.targetType}
              disabled={!!editing}
              onValueChanged={(e) =>
                setForm({ ...form, targetType: e.value as InspectionTargetType, targetId: null, targetName: '', templateId: null })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">เป้าหมายที่จะตรวจ *</label>
            <SelectBox
              dataSource={targetData.items}
              valueExpr="id"
              displayExpr="name"
              value={form.targetId}
              disabled={!!editing}
              placeholder={`เลือก${targetLabel(form.targetType)}…`}
              onValueChanged={(e) => {
                const picked = targetData.items.find((it) => it.id === e.value);
                setForm({ ...form, targetId: e.value ?? null, targetName: picked?.name ?? '' });
              }}
            />
            {!editing && targetData.items.length === 0 && (
              <p className="text-xs text-amber-700 mt-1">
                ⚠️ ยังไม่มี {targetLabel(form.targetType)} ในระบบ — สร้างที่ Master Data ก่อน
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">ชื่อแสดงบน Schedule</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={form.targetName}
              onChange={(e) => setForm({ ...form, targetName: e.target.value })}
              placeholder="auto จาก dropdown — แก้ได้"
            />
            <p className="text-xs text-gray-500 mt-1">
              ชื่อที่จะปรากฏใน dashboard / notification — ปกติเอาจาก dropdown ด้านบนได้เลย
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">แบบฟอร์ม Template *</label>
            <SelectBox
              dataSource={templatesForType.map((t) => ({ value: t.id, label: t.name }))}
              valueExpr="value"
              displayExpr="label"
              value={form.templateId}
              disabled={!!editing}
              placeholder="เลือกแบบฟอร์ม…"
              onValueChanged={(e) => setForm({ ...form, templateId: e.value ?? null })}
            />
            {!editing && templatesForType.length === 0 && (
              <p className="text-xs text-amber-700 mt-1">
                ⚠️ ยังไม่มี Template สำหรับ {targetLabel(form.targetType)} — สร้างก่อนที่หน้า{' '}
                <Link href="/premises/environmental/templates" className="underline">แบบฟอร์มตรวจ</Link>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">ความถี่ *</label>
            <SelectBox
              dataSource={INSPECTION_FREQUENCIES.map((f) => ({ value: f, label: freqLabel(f) }))}
              valueExpr="value"
              displayExpr="label"
              value={form.frequency}
              onValueChanged={(e) => setForm({ ...form, frequency: e.value as InspectionFrequency })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">แจ้งล่วงหน้า (วัน)</label>
            <NumberBox
              value={form.alertDaysBefore}
              min={0}
              max={365}
              onValueChanged={(e) => setForm({ ...form, alertDaysBefore: e.value ?? 1 })}
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
                saveMut.isPending ||
                (!editing && (form.targetId === null || form.templateId === null || form.targetName.trim() === ''))
              }
              onClick={() => saveMut.mutate()}
            />
          </div>
        </div>
      </Popup>
    </div>
  );
}

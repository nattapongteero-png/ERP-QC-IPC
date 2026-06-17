'use client';

/**
 * Water Quality — Configuration Registry (ทะเบียนการตั้งค่า)
 *
 * Manage the master data the daily recording depends on:
 *   - ระบบน้ำ (Water Systems)
 *   - จุดสุ่มตัวอย่าง (Sample Points)
 *   - เกณฑ์ (Specs)
 * Each section supports add / edit / delete (delete is soft via isActive=false).
 */
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid, Column, Paging } from 'devextreme-react/data-grid';
import { Popup } from 'devextreme-react/popup';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import { TextArea } from 'devextreme-react/text-area';
import { Badge } from '@/components/ui/badge';
import { Breadcrumbs, ConfirmationDialog } from '@/components/shared';
import { useToast } from '@/hooks/use-toast';
import { Droplets, MapPin, FlaskConical, Pencil, Trash2, Plus, ClipboardList } from 'lucide-react';
import {
  WATER_SYSTEM_TYPES,
  type WaterSamplePoint,
  type WaterSystem,
  type WaterQualitySpec,
  type WaterSystemType,
} from '@/types/environmental-monitoring';

type DeleteTarget = { kind: 'system' | 'point' | 'spec'; id: number; label: string } | null;

export default function WaterQualitySettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const { data: systems = [], refetch: refetchSys } = useQuery<WaterSystem[]>({
    queryKey: ['water-systems'],
    queryFn: async () => {
      const res = await fetch('/api/environmental/water-systems');
      return res.ok ? res.json() : [];
    },
  });
  const { data: points = [], refetch: refetchPt } = useQuery<WaterSamplePoint[]>({
    queryKey: ['sample-points'],
    queryFn: async () => {
      const res = await fetch('/api/environmental/sample-points');
      return res.ok ? res.json() : [];
    },
  });
  const { data: specs = [], refetch: refetchSpec } = useQuery<WaterQualitySpec[]>({
    queryKey: ['water-specs-all'],
    queryFn: async () => {
      const res = await fetch('/api/environmental/water-specs');
      return res.ok ? res.json() : [];
    },
  });

  const systemName = (id: number) => systems.find((s) => s.id === id)?.name ?? String(id);

  // ---- System popup ----
  const [sysOpen, setSysOpen] = useState(false);
  const [sysEdit, setSysEdit] = useState<WaterSystem | null>(null);
  const [sysForm, setSysForm] = useState({ code: '', name: '', systemType: 'purified' as WaterSystemType, description: '' });
  const openSysCreate = () => {
    setSysEdit(null);
    setSysForm({ code: '', name: '', systemType: 'purified', description: '' });
    setSysOpen(true);
  };
  const openSysEdit = (s: WaterSystem) => {
    setSysEdit(s);
    setSysForm({ code: s.code, name: s.name, systemType: s.systemType, description: s.description ?? '' });
    setSysOpen(true);
  };
  const sysMut = useMutation({
    mutationFn: async () => {
      const url = sysEdit ? `/api/environmental/water-systems/${sysEdit.id}` : '/api/environmental/water-systems';
      const res = await fetch(url, {
        method: sysEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sysForm),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b?.error ?? 'Failed');
      return b;
    },
    onSuccess: () => {
      toast.success(sysEdit ? 'แก้ไขระบบน้ำแล้ว' : 'เพิ่มระบบน้ำแล้ว');
      qc.invalidateQueries({ queryKey: ['water-systems'] });
      setSysOpen(false);
    },
    onError: (e: Error) => toast.error('ล้มเหลว', e.message),
  });

  // ---- Sample point popup ----
  const [ptOpen, setPtOpen] = useState(false);
  const [ptEdit, setPtEdit] = useState<WaterSamplePoint | null>(null);
  const [ptForm, setPtForm] = useState({ waterSystemId: 0, code: '', name: '', location: '' });
  const openPtCreate = () => {
    setPtEdit(null);
    setPtForm({ waterSystemId: 0, code: '', name: '', location: '' });
    setPtOpen(true);
  };
  const openPtEdit = (p: WaterSamplePoint) => {
    setPtEdit(p);
    setPtForm({ waterSystemId: p.waterSystemId, code: p.code, name: p.name, location: p.location ?? '' });
    setPtOpen(true);
  };
  const ptMut = useMutation({
    mutationFn: async () => {
      const url = ptEdit ? `/api/environmental/sample-points/${ptEdit.id}` : '/api/environmental/sample-points';
      const res = await fetch(url, {
        method: ptEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ptForm),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b?.error ?? 'Failed');
      return b;
    },
    onSuccess: () => {
      toast.success(ptEdit ? 'แก้ไขจุดสุ่มแล้ว' : 'เพิ่มจุดสุ่มแล้ว');
      qc.invalidateQueries({ queryKey: ['sample-points'] });
      setPtOpen(false);
    },
    onError: (e: Error) => toast.error('ล้มเหลว', e.message),
  });

  // ---- Spec popup ----
  const [specOpen, setSpecOpen] = useState(false);
  const [specEdit, setSpecEdit] = useState<WaterQualitySpec | null>(null);
  const [specForm, setSpecForm] = useState({
    waterSystemId: 0,
    samplePointId: null as number | null,
    parameter: '',
    unit: '',
    specMin: '' as number | '',
    specMax: '' as number | '',
  });
  const openSpecCreate = () => {
    setSpecEdit(null);
    setSpecForm({ waterSystemId: 0, samplePointId: null, parameter: '', unit: '', specMin: '', specMax: '' });
    setSpecOpen(true);
  };
  const openSpecEdit = (s: WaterQualitySpec) => {
    setSpecEdit(s);
    setSpecForm({
      waterSystemId: s.waterSystemId,
      samplePointId: s.samplePointId,
      parameter: s.parameter,
      unit: s.unit,
      specMin: s.specMin ?? '',
      specMax: s.specMax ?? '',
    });
    setSpecOpen(true);
  };
  const specMut = useMutation({
    mutationFn: async () => {
      const url = specEdit ? `/api/environmental/water-specs/${specEdit.id}` : '/api/environmental/water-specs';
      const res = await fetch(url, {
        method: specEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waterSystemId: specForm.waterSystemId,
          samplePointId: specForm.samplePointId,
          parameter: specForm.parameter,
          unit: specForm.unit,
          specMin: specForm.specMin === '' ? null : Number(specForm.specMin),
          specMax: specForm.specMax === '' ? null : Number(specForm.specMax),
        }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b?.error ?? 'Failed');
      return b;
    },
    onSuccess: () => {
      toast.success(specEdit ? 'แก้ไขเกณฑ์แล้ว' : 'เพิ่มเกณฑ์แล้ว');
      qc.invalidateQueries({ queryKey: ['water-specs-all'] });
      qc.invalidateQueries({ queryKey: ['water-specs'] });
      setSpecOpen(false);
    },
    onError: (e: Error) => toast.error('ล้มเหลว', e.message),
  });

  // ---- Delete ----
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const deleteMut = useMutation({
    mutationFn: async (target: NonNullable<DeleteTarget>) => {
      const path =
        target.kind === 'system'
          ? 'water-systems'
          : target.kind === 'point'
            ? 'sample-points'
            : 'water-specs';
      const res = await fetch(`/api/environmental/${path}/${target.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error ?? 'Delete failed');
      }
    },
    onSuccess: () => {
      toast.success('ปิดการใช้งานแล้ว');
      refetchSys();
      refetchPt();
      refetchSpec();
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error('ลบไม่สำเร็จ', e.message),
  });

  const rowActions = (onEdit: () => void, onDelete: () => void) => (
    <div className="flex gap-1">
      <Button stylingMode="outlined" onClick={onEdit}>
        <span className="inline-flex items-center gap-1 text-xs"><Pencil className="w-3 h-3" /> แก้ไข</span>
      </Button>
      <Button stylingMode="text" type="danger" onClick={onDelete}>
        <span className="inline-flex items-center gap-1 text-xs"><Trash2 className="w-3 h-3" /> ลบ</span>
      </Button>
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      <Breadcrumbs
        items={[
          { label: 'อาคารและสถานที่', href: '/premises' },
          { label: 'ระบบน้ำ (Water Quality)', href: '/premises/environmental/water-quality' },
          { label: 'ทะเบียนการตั้งค่า' },
        ]}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical className="w-6 h-6" /> ทะเบียนการตั้งค่าระบบน้ำ
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            ตั้งค่าข้อมูลหลักที่ใช้ตอนบันทึกผลตรวจ — ระบบน้ำ → จุดสุ่มตัวอย่าง → เกณฑ์ (Spec)
          </p>
        </div>
        <Link
          href="/premises/environmental/water-quality"
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50 text-gray-700"
        >
          <ClipboardList className="w-4 h-4" /> ไปหน้าบันทึกผลตรวจ
        </Link>
      </div>

      <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-sm text-sky-900">
        ตั้งค่าตามลำดับ: 1) สร้าง <span className="font-medium">ระบบน้ำ</span> →
        2) เพิ่ม <span className="font-medium">จุดสุ่มตัวอย่าง</span> ของระบบนั้น →
        3) กำหนด <span className="font-medium">เกณฑ์ (Spec)</span> ของแต่ละค่า เช่น pH, conductivity
        จากนั้นจึงไปบันทึกผลตรวจได้
      </div>

      {/* ===== Systems ===== */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2"><Droplets className="w-5 h-5" /> ระบบน้ำ (Water Systems)</h2>
          <Button type="default" stylingMode="contained" onClick={openSysCreate}>
            <span className="inline-flex items-center gap-1"><Plus className="w-4 h-4" /> เพิ่มระบบน้ำ</span>
          </Button>
        </div>
        <DataGrid dataSource={systems} keyExpr="id" showBorders showRowLines columnAutoWidth data-testid="wq-systems-grid">
          <Paging pageSize={10} />
          <Column dataField="code" caption="รหัส" width={110} />
          <Column dataField="name" caption="ชื่อ" />
          <Column dataField="systemType" caption="ประเภท" width={120} />
          <Column dataField="description" caption="คำอธิบาย" />
          <Column
            dataField="isActive"
            caption="สถานะ"
            width={100}
            cellRender={(c) => (c.value ? <Badge className="bg-emerald-100 text-emerald-900">ใช้งาน</Badge> : <Badge className="bg-gray-200 text-gray-700">ปิด</Badge>)}
          />
          <Column
            caption="การกระทำ"
            width={170}
            cellRender={(c) => {
              const row = c.data as WaterSystem;
              return rowActions(() => openSysEdit(row), () => setDeleteTarget({ kind: 'system', id: row.id, label: `${row.code} — ${row.name}` }));
            }}
          />
        </DataGrid>
      </section>

      {/* ===== Sample points ===== */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2"><MapPin className="w-5 h-5" /> จุดสุ่มตัวอย่าง (Sample Points)</h2>
          <Button type="default" stylingMode="contained" onClick={openPtCreate} disabled={systems.length === 0}>
            <span className="inline-flex items-center gap-1"><Plus className="w-4 h-4" /> เพิ่มจุดสุ่ม</span>
          </Button>
        </div>
        <DataGrid dataSource={points} keyExpr="id" showBorders showRowLines columnAutoWidth data-testid="wq-points-grid">
          <Paging pageSize={10} />
          <Column dataField="code" caption="รหัส" width={120} />
          <Column dataField="name" caption="ชื่อ" />
          <Column dataField="location" caption="ตำแหน่ง" />
          <Column dataField="waterSystemId" caption="ระบบน้ำ" calculateCellValue={(r: WaterSamplePoint) => systemName(r.waterSystemId)} />
          <Column
            dataField="isActive"
            caption="สถานะ"
            width={100}
            cellRender={(c) => (c.value ? <Badge className="bg-emerald-100 text-emerald-900">ใช้งาน</Badge> : <Badge className="bg-gray-200 text-gray-700">ปิด</Badge>)}
          />
          <Column
            caption="การกระทำ"
            width={170}
            cellRender={(c) => {
              const row = c.data as WaterSamplePoint;
              return rowActions(() => openPtEdit(row), () => setDeleteTarget({ kind: 'point', id: row.id, label: `${row.code} — ${row.name}` }));
            }}
          />
        </DataGrid>
      </section>

      {/* ===== Specs ===== */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2"><FlaskConical className="w-5 h-5" /> เกณฑ์ (Specs)</h2>
          <Button type="default" stylingMode="contained" onClick={openSpecCreate} disabled={systems.length === 0}>
            <span className="inline-flex items-center gap-1"><Plus className="w-4 h-4" /> เพิ่มเกณฑ์</span>
          </Button>
        </div>
        <DataGrid dataSource={specs} keyExpr="id" showBorders showRowLines columnAutoWidth data-testid="wq-specs-grid">
          <Paging pageSize={10} />
          <Column dataField="waterSystemId" caption="ระบบน้ำ" calculateCellValue={(r: WaterQualitySpec) => systemName(r.waterSystemId)} />
          <Column dataField="parameter" caption="พารามิเตอร์" />
          <Column dataField="unit" caption="หน่วย" width={100} />
          <Column dataField="specMin" caption="ต่ำสุด" width={100} />
          <Column dataField="specMax" caption="สูงสุด" width={100} />
          <Column
            caption="การกระทำ"
            width={170}
            cellRender={(c) => {
              const row = c.data as WaterQualitySpec;
              return rowActions(() => openSpecEdit(row), () => setDeleteTarget({ kind: 'spec', id: row.id, label: `${row.parameter} (${systemName(row.waterSystemId)})` }));
            }}
          />
        </DataGrid>
      </section>

      {/* ===== System popup ===== */}
      <Popup visible={sysOpen} onHiding={() => setSysOpen(false)} showCloseButton title={sysEdit ? 'แก้ไขระบบน้ำ' : 'เพิ่มระบบน้ำ'} width={480} height="auto">
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">รหัส (Code) *</label>
            <input className="w-full border rounded px-3 py-2" value={sysForm.code} disabled={!!sysEdit}
              onChange={(e) => setSysForm({ ...sysForm, code: e.target.value })} placeholder="PW-01" />
            {sysEdit && <p className="text-xs text-gray-500 mt-1">แก้ไขรหัสไม่ได้หลังสร้าง</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ชื่อ *</label>
            <input className="w-full border rounded px-3 py-2" value={sysForm.name}
              onChange={(e) => setSysForm({ ...sysForm, name: e.target.value })} placeholder="เช่น น้ำบริสุทธิ์ 1" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ประเภท *</label>
            <SelectBox dataSource={WATER_SYSTEM_TYPES} value={sysForm.systemType}
              onValueChanged={(e) => setSysForm({ ...sysForm, systemType: e.value as WaterSystemType })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">คำอธิบาย</label>
            <TextArea value={sysForm.description} height={60} onValueChanged={(e) => setSysForm({ ...sysForm, description: String(e.value ?? '') })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button text="ยกเลิก" stylingMode="text" onClick={() => setSysOpen(false)} />
            <Button type="default" stylingMode="contained" text={sysEdit ? 'บันทึกการแก้ไข' : 'บันทึก'}
              disabled={!sysForm.code || !sysForm.name || sysMut.isPending} onClick={() => sysMut.mutate()} />
          </div>
        </div>
      </Popup>

      {/* ===== Sample point popup ===== */}
      <Popup visible={ptOpen} onHiding={() => setPtOpen(false)} showCloseButton title={ptEdit ? 'แก้ไขจุดสุ่มตัวอย่าง' : 'เพิ่มจุดสุ่มตัวอย่าง'} width={480} height="auto">
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">ระบบน้ำ *</label>
            <SelectBox dataSource={systems} displayExpr={(s: WaterSystem) => (s ? `${s.code} — ${s.name}` : '')} valueExpr="id"
              value={ptForm.waterSystemId || null} disabled={!!ptEdit}
              onValueChanged={(e) => setPtForm({ ...ptForm, waterSystemId: Number(e.value ?? 0) })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">รหัส (Code) *</label>
            <input className="w-full border rounded px-3 py-2" value={ptForm.code}
              onChange={(e) => setPtForm({ ...ptForm, code: e.target.value })} placeholder="PW-01-SP01" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ชื่อ *</label>
            <input className="w-full border rounded px-3 py-2" value={ptForm.name}
              onChange={(e) => setPtForm({ ...ptForm, name: e.target.value })} placeholder="เช่น ทางออกถังเก็บ" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ตำแหน่ง</label>
            <input className="w-full border rounded px-3 py-2" value={ptForm.location}
              onChange={(e) => setPtForm({ ...ptForm, location: e.target.value })} placeholder="อาคาร A ชั้น 2" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button text="ยกเลิก" stylingMode="text" onClick={() => setPtOpen(false)} />
            <Button type="default" stylingMode="contained" text={ptEdit ? 'บันทึกการแก้ไข' : 'บันทึก'}
              disabled={!ptForm.waterSystemId || !ptForm.code || !ptForm.name || ptMut.isPending} onClick={() => ptMut.mutate()} />
          </div>
        </div>
      </Popup>

      {/* ===== Spec popup ===== */}
      <Popup visible={specOpen} onHiding={() => setSpecOpen(false)} showCloseButton title={specEdit ? 'แก้ไขเกณฑ์' : 'เพิ่มเกณฑ์'} width={520} height="auto">
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">ระบบน้ำ *</label>
            <SelectBox dataSource={systems} displayExpr={(s: WaterSystem) => (s ? `${s.code} — ${s.name}` : '')} valueExpr="id"
              value={specForm.waterSystemId || null} disabled={!!specEdit}
              onValueChanged={(e) => setSpecForm({ ...specForm, waterSystemId: Number(e.value ?? 0) })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">จุดสุ่ม (ไม่บังคับ — เว้นว่าง = ทั้งระบบ)</label>
            <SelectBox
              dataSource={[{ id: 0, name: '— ทั้งระบบ —' }, ...points.filter((p) => !specForm.waterSystemId || p.waterSystemId === specForm.waterSystemId)]}
              displayExpr={(p: { id: number; name: string }) => (p ? p.name : '')}
              valueExpr="id"
              value={specForm.samplePointId ?? 0}
              onValueChanged={(e) => setSpecForm({ ...specForm, samplePointId: Number(e.value) === 0 ? null : Number(e.value) })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">พารามิเตอร์ *</label>
              <input className="w-full border rounded px-3 py-2" value={specForm.parameter}
                onChange={(e) => setSpecForm({ ...specForm, parameter: e.target.value })} placeholder="ph / conductivity / toc" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">หน่วย</label>
              <input className="w-full border rounded px-3 py-2" value={specForm.unit}
                onChange={(e) => setSpecForm({ ...specForm, unit: e.target.value })} placeholder="uS/cm / ppm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ค่าต่ำสุด</label>
              <input type="number" step="0.001" className="w-full border rounded px-3 py-2" value={specForm.specMin}
                onChange={(e) => setSpecForm({ ...specForm, specMin: e.target.value === '' ? '' : Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ค่าสูงสุด</label>
              <input type="number" step="0.001" className="w-full border rounded px-3 py-2" value={specForm.specMax}
                onChange={(e) => setSpecForm({ ...specForm, specMax: e.target.value === '' ? '' : Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button text="ยกเลิก" stylingMode="text" onClick={() => setSpecOpen(false)} />
            <Button type="default" stylingMode="contained" text={specEdit ? 'บันทึกการแก้ไข' : 'บันทึก'}
              disabled={!specForm.waterSystemId || !specForm.parameter || specMut.isPending} onClick={() => specMut.mutate()} />
          </div>
        </div>
      </Popup>

      <ConfirmationDialog
        visible={!!deleteTarget}
        title="ปิดการใช้งาน"
        message={deleteTarget ? `ปิดการใช้งาน "${deleteTarget.label}" ใช่หรือไม่? (ข้อมูลย้อนหลังไม่หาย — แค่ซ่อนจากตัวเลือกใหม่)` : ''}
        confirmText="ปิดการใช้งาน"
        cancelText="ยกเลิก"
        confirmType="danger"
        isLoading={deleteMut.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMut.mutate(deleteTarget);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

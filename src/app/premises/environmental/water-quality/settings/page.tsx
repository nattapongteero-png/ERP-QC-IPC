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
import { useTranslations } from 'next-intl';
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

// Standard water-quality parameters operators pick from a dropdown instead of
// typing a free-text key (which led to inconsistent values like "ph" vs "pH"
// vs "p h"). Choosing one auto-fills a sensible default unit (still editable).
const WATER_PARAM_PRESETS: Array<{ value: string; label: string; unit: string }> = [
  { value: 'pH', label: 'pH', unit: '' },
  { value: 'conductivity', label: 'Conductivity (ค่าการนำไฟฟ้า)', unit: 'µS/cm' },
  { value: 'TOC', label: 'TOC (สารอินทรีย์รวม)', unit: 'ppb' },
  { value: 'microbial', label: 'Microbial (จุลินทรีย์)', unit: 'CFU/100ml' },
  { value: 'endotoxin', label: 'Endotoxin', unit: 'EU/ml' },
  { value: 'nitrate', label: 'Nitrate (ไนเตรต)', unit: 'ppm' },
  { value: 'heavy_metals', label: 'Heavy metals (โลหะหนัก)', unit: 'ppm' },
  { value: 'custom', label: 'กำหนดเอง...', unit: '' },
];

export default function WaterQualitySettingsPage() {
  const t = useTranslations('premises');
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
      toast.success(sysEdit ? t('waterQuality.settings.toast.systemEditSuccess') : t('waterQuality.settings.toast.systemCreateSuccess'));
      qc.invalidateQueries({ queryKey: ['water-systems'] });
      setSysOpen(false);
    },
    onError: (e: Error) => toast.error(t('waterQuality.settings.toast.failed'), e.message),
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
      toast.success(ptEdit ? t('waterQuality.settings.toast.pointEditSuccess') : t('waterQuality.settings.toast.pointCreateSuccess'));
      qc.invalidateQueries({ queryKey: ['sample-points'] });
      setPtOpen(false);
    },
    onError: (e: Error) => toast.error(t('waterQuality.settings.toast.failed'), e.message),
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
  // Whether the parameter field is in "custom" (free-text) mode.
  const [paramCustom, setParamCustom] = useState(false);
  // Value shown in the parameter <select>: the preset value, "custom" if in
  // custom mode or the saved param isn't a known preset, else empty.
  const paramSelectValue = WATER_PARAM_PRESETS.some((p) => p.value === specForm.parameter)
    ? specForm.parameter
    : (paramCustom || specForm.parameter ? 'custom' : '');
  const openSpecCreate = () => {
    setSpecEdit(null);
    setParamCustom(false);
    setSpecForm({ waterSystemId: 0, samplePointId: null, parameter: '', unit: '', specMin: '', specMax: '' });
    setSpecOpen(true);
  };
  const openSpecEdit = (s: WaterQualitySpec) => {
    setSpecEdit(s);
    // If the saved parameter isn't a known preset, open in custom mode.
    setParamCustom(!WATER_PARAM_PRESETS.some((p) => p.value === s.parameter));
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
      toast.success(specEdit ? t('waterQuality.settings.toast.specEditSuccess') : t('waterQuality.settings.toast.specCreateSuccess'));
      qc.invalidateQueries({ queryKey: ['water-specs-all'] });
      qc.invalidateQueries({ queryKey: ['water-specs'] });
      setSpecOpen(false);
    },
    onError: (e: Error) => toast.error(t('waterQuality.settings.toast.failed'), e.message),
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
      toast.success(t('waterQuality.settings.toast.deactivateSuccess'));
      refetchSys();
      refetchPt();
      refetchSpec();
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(t('waterQuality.settings.toast.deleteError'), e.message),
  });

  const rowActions = (onEdit: () => void, onDelete: () => void) => (
    <div className="flex gap-1">
      <Button stylingMode="outlined" onClick={onEdit}>
        <span className="inline-flex items-center gap-1 text-xs"><Pencil className="w-3 h-3" /> {t('waterQuality.common.actions.edit')}</span>
      </Button>
      <Button stylingMode="text" type="danger" onClick={onDelete}>
        <span className="inline-flex items-center gap-1 text-xs"><Trash2 className="w-3 h-3" /> {t('waterQuality.common.actions.delete')}</span>
      </Button>
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      <Breadcrumbs
        items={[
          { label: t('waterQuality.common.breadcrumb.premises'), href: '/premises' },
          { label: t('waterQuality.common.breadcrumb.waterQuality'), href: '/premises/environmental/water-quality' },
          { label: t('waterQuality.settings.breadcrumb') },
        ]}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical className="w-6 h-6" /> {t('waterQuality.settings.title')}
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            {t('waterQuality.settings.subtitle')}
          </p>
        </div>
        <Link
          href="/premises/environmental/water-quality"
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50 text-gray-700"
        >
          <ClipboardList className="w-4 h-4" /> {t('waterQuality.settings.recordsLink')}
        </Link>
      </div>

      <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-sm text-sky-900">
        {t('waterQuality.settings.stepNotice.before')} <span className="font-medium">{t('waterQuality.settings.stepNotice.system')}</span>{' '}
        {t('waterQuality.settings.stepNotice.mid1')} <span className="font-medium">{t('waterQuality.settings.stepNotice.point')}</span>{' '}
        {t('waterQuality.settings.stepNotice.mid2')} <span className="font-medium">{t('waterQuality.settings.stepNotice.spec')}</span>{' '}
        {t('waterQuality.settings.stepNotice.after')}
      </div>

      {/* ===== Systems ===== */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2"><Droplets className="w-5 h-5" /> {t('waterQuality.settings.systems.heading')}</h2>
          <Button type="default" stylingMode="contained" onClick={openSysCreate}>
            <span className="inline-flex items-center gap-1"><Plus className="w-4 h-4" /> {t('waterQuality.settings.systems.addButton')}</span>
          </Button>
        </div>
        <DataGrid dataSource={systems} keyExpr="id" showBorders showRowLines columnAutoWidth data-testid="wq-systems-grid">
          <Paging pageSize={10} />
          <Column dataField="code" caption={t('waterQuality.settings.systems.code')} width={110} />
          <Column dataField="name" caption={t('waterQuality.settings.systems.name')} />
          <Column dataField="systemType" caption={t('waterQuality.settings.systems.type')} width={120} />
          <Column dataField="description" caption={t('waterQuality.settings.systems.description')} />
          <Column
            dataField="isActive"
            caption={t('waterQuality.settings.systems.status')}
            width={100}
            cellRender={(c) => (c.value ? <Badge className="bg-emerald-100 text-emerald-900">{t('waterQuality.common.status.active')}</Badge> : <Badge className="bg-gray-200 text-gray-700">{t('waterQuality.common.status.inactive')}</Badge>)}
          />
          <Column
            caption={t('waterQuality.settings.systems.actions')}
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
          <h2 className="font-semibold flex items-center gap-2"><MapPin className="w-5 h-5" /> {t('waterQuality.settings.points.heading')}</h2>
          <Button type="default" stylingMode="contained" onClick={openPtCreate} disabled={systems.length === 0}>
            <span className="inline-flex items-center gap-1"><Plus className="w-4 h-4" /> {t('waterQuality.settings.points.addButton')}</span>
          </Button>
        </div>
        <DataGrid dataSource={points} keyExpr="id" showBorders showRowLines columnAutoWidth data-testid="wq-points-grid">
          <Paging pageSize={10} />
          <Column dataField="code" caption={t('waterQuality.settings.points.code')} width={120} />
          <Column dataField="name" caption={t('waterQuality.settings.points.name')} />
          <Column dataField="location" caption={t('waterQuality.settings.points.location')} />
          <Column dataField="waterSystemId" caption={t('waterQuality.settings.points.system')} calculateCellValue={(r: WaterSamplePoint) => systemName(r.waterSystemId)} />
          <Column
            dataField="isActive"
            caption={t('waterQuality.settings.points.status')}
            width={100}
            cellRender={(c) => (c.value ? <Badge className="bg-emerald-100 text-emerald-900">{t('waterQuality.common.status.active')}</Badge> : <Badge className="bg-gray-200 text-gray-700">{t('waterQuality.common.status.inactive')}</Badge>)}
          />
          <Column
            caption={t('waterQuality.settings.points.actions')}
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
          <h2 className="font-semibold flex items-center gap-2"><FlaskConical className="w-5 h-5" /> {t('waterQuality.settings.specs.heading')}</h2>
          <Button type="default" stylingMode="contained" onClick={openSpecCreate} disabled={systems.length === 0}>
            <span className="inline-flex items-center gap-1"><Plus className="w-4 h-4" /> {t('waterQuality.settings.specs.addButton')}</span>
          </Button>
        </div>
        <DataGrid dataSource={specs} keyExpr="id" showBorders showRowLines columnAutoWidth data-testid="wq-specs-grid">
          <Paging pageSize={10} />
          <Column dataField="waterSystemId" caption={t('waterQuality.settings.specs.system')} calculateCellValue={(r: WaterQualitySpec) => systemName(r.waterSystemId)} />
          <Column dataField="parameter" caption={t('waterQuality.settings.specs.parameter')} />
          <Column dataField="unit" caption={t('waterQuality.settings.specs.unit')} width={100} />
          <Column dataField="specMin" caption={t('waterQuality.settings.specs.min')} width={100} />
          <Column dataField="specMax" caption={t('waterQuality.settings.specs.max')} width={100} />
          <Column
            caption={t('waterQuality.settings.specs.actions')}
            width={170}
            cellRender={(c) => {
              const row = c.data as WaterQualitySpec;
              return rowActions(() => openSpecEdit(row), () => setDeleteTarget({ kind: 'spec', id: row.id, label: `${row.parameter} (${systemName(row.waterSystemId)})` }));
            }}
          />
        </DataGrid>
      </section>

      {/* ===== System popup ===== */}
      <Popup visible={sysOpen} onHiding={() => setSysOpen(false)} showCloseButton title={sysEdit ? t('waterQuality.settings.systemPopup.titleEdit') : t('waterQuality.settings.systemPopup.titleCreate')} width={480} height="auto">
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t('waterQuality.settings.systemPopup.codeLabel')}</label>
            <input className="w-full border rounded px-3 py-2" value={sysForm.code} disabled={!!sysEdit}
              onChange={(e) => setSysForm({ ...sysForm, code: e.target.value })} placeholder="PW-01" />
            {sysEdit && <p className="text-xs text-gray-500 mt-1">{t('waterQuality.settings.systemPopup.codeLocked')}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('waterQuality.settings.systemPopup.nameLabel')}</label>
            <input className="w-full border rounded px-3 py-2" value={sysForm.name}
              onChange={(e) => setSysForm({ ...sysForm, name: e.target.value })} placeholder={t('waterQuality.settings.systemPopup.namePlaceholder')} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('waterQuality.settings.systemPopup.typeLabel')}</label>
            <SelectBox dataSource={WATER_SYSTEM_TYPES} value={sysForm.systemType}
              onValueChanged={(e) => setSysForm({ ...sysForm, systemType: e.value as WaterSystemType })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('waterQuality.settings.systemPopup.descriptionLabel')}</label>
            <TextArea value={sysForm.description} height={60} onValueChanged={(e) => setSysForm({ ...sysForm, description: String(e.value ?? '') })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button text={t('waterQuality.common.actions.cancel')} stylingMode="text" onClick={() => setSysOpen(false)} />
            <Button type="default" stylingMode="contained" text={sysEdit ? t('waterQuality.common.actions.saveEdit') : t('waterQuality.common.actions.save')}
              disabled={!sysForm.code || !sysForm.name || sysMut.isPending} onClick={() => sysMut.mutate()} />
          </div>
        </div>
      </Popup>

      {/* ===== Sample point popup ===== */}
      <Popup visible={ptOpen} onHiding={() => setPtOpen(false)} showCloseButton title={ptEdit ? t('waterQuality.settings.pointPopup.titleEdit') : t('waterQuality.settings.pointPopup.titleCreate')} width={480} height="auto">
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t('waterQuality.settings.pointPopup.systemLabel')}</label>
            <SelectBox dataSource={systems} displayExpr={(s: WaterSystem) => (s ? `${s.code} — ${s.name}` : '')} valueExpr="id"
              value={ptForm.waterSystemId || null} disabled={!!ptEdit}
              onValueChanged={(e) => setPtForm({ ...ptForm, waterSystemId: Number(e.value ?? 0) })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('waterQuality.settings.pointPopup.codeLabel')}</label>
            <input className="w-full border rounded px-3 py-2" value={ptForm.code}
              onChange={(e) => setPtForm({ ...ptForm, code: e.target.value })} placeholder="PW-01-SP01" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('waterQuality.settings.pointPopup.nameLabel')}</label>
            <input className="w-full border rounded px-3 py-2" value={ptForm.name}
              onChange={(e) => setPtForm({ ...ptForm, name: e.target.value })} placeholder={t('waterQuality.settings.pointPopup.namePlaceholder')} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('waterQuality.settings.pointPopup.locationLabel')}</label>
            <input className="w-full border rounded px-3 py-2" value={ptForm.location}
              onChange={(e) => setPtForm({ ...ptForm, location: e.target.value })} placeholder={t('waterQuality.settings.pointPopup.locationPlaceholder')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button text={t('waterQuality.common.actions.cancel')} stylingMode="text" onClick={() => setPtOpen(false)} />
            <Button type="default" stylingMode="contained" text={ptEdit ? t('waterQuality.common.actions.saveEdit') : t('waterQuality.common.actions.save')}
              disabled={!ptForm.waterSystemId || !ptForm.code || !ptForm.name || ptMut.isPending} onClick={() => ptMut.mutate()} />
          </div>
        </div>
      </Popup>

      {/* ===== Spec popup ===== */}
      <Popup visible={specOpen} onHiding={() => setSpecOpen(false)} showCloseButton title={specEdit ? t('waterQuality.settings.specPopup.titleEdit') : t('waterQuality.settings.specPopup.titleCreate')} width={520} height="auto">
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t('waterQuality.settings.specPopup.systemLabel')}</label>
            <SelectBox dataSource={systems} displayExpr={(s: WaterSystem) => (s ? `${s.code} — ${s.name}` : '')} valueExpr="id"
              value={specForm.waterSystemId || null} disabled={!!specEdit}
              onValueChanged={(e) => setSpecForm({ ...specForm, waterSystemId: Number(e.value ?? 0) })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('waterQuality.settings.specPopup.pointLabel')}</label>
            <SelectBox
              dataSource={[{ id: 0, name: t('waterQuality.settings.specPopup.pointAll') }, ...points.filter((p) => !specForm.waterSystemId || p.waterSystemId === specForm.waterSystemId)]}
              displayExpr={(p: { id: number; name: string }) => (p ? p.name : '')}
              valueExpr="id"
              value={specForm.samplePointId ?? 0}
              onValueChanged={(e) => setSpecForm({ ...specForm, samplePointId: Number(e.value) === 0 ? null : Number(e.value) })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t('waterQuality.settings.specPopup.parameterLabel')}</label>
              {/* Dropdown of standard parameters (auto-fills unit). "custom" keeps
                  free entry for anything not listed. */}
              <select
                className="w-full border rounded px-3 py-2 bg-white"
                value={paramSelectValue}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setParamCustom(true);
                    setSpecForm({ ...specForm, parameter: '' });
                    return;
                  }
                  setParamCustom(false);
                  const preset = WATER_PARAM_PRESETS.find((p) => p.value === e.target.value);
                  setSpecForm({
                    ...specForm,
                    parameter: e.target.value,
                    unit: specForm.unit || preset?.unit || specForm.unit,
                  });
                }}
              >
                <option value="" disabled>{t('waterQuality.settings.specPopup.parameterSelectPlaceholder')}</option>
                {WATER_PARAM_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              {/* Free-text box appears only when "custom" is selected. */}
              {paramSelectValue === 'custom' && (
                <input
                  className="w-full border rounded px-3 py-2 mt-2"
                  value={specForm.parameter}
                  onChange={(e) => setSpecForm({ ...specForm, parameter: e.target.value })}
                  placeholder={t('waterQuality.settings.specPopup.parameterNamePlaceholder')}
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('waterQuality.settings.specPopup.unitLabel')}</label>
              <input className="w-full border rounded px-3 py-2" value={specForm.unit}
                onChange={(e) => setSpecForm({ ...specForm, unit: e.target.value })} placeholder="uS/cm / ppm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('waterQuality.settings.specPopup.minLabel')}</label>
              <input type="number" step="0.001" className="w-full border rounded px-3 py-2" value={specForm.specMin}
                onChange={(e) => setSpecForm({ ...specForm, specMin: e.target.value === '' ? '' : Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('waterQuality.settings.specPopup.maxLabel')}</label>
              <input type="number" step="0.001" className="w-full border rounded px-3 py-2" value={specForm.specMax}
                onChange={(e) => setSpecForm({ ...specForm, specMax: e.target.value === '' ? '' : Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button text={t('waterQuality.common.actions.cancel')} stylingMode="text" onClick={() => setSpecOpen(false)} />
            <Button type="default" stylingMode="contained" text={specEdit ? t('waterQuality.common.actions.saveEdit') : t('waterQuality.common.actions.save')}
              disabled={!specForm.waterSystemId || !specForm.parameter || specMut.isPending} onClick={() => specMut.mutate()} />
          </div>
        </div>
      </Popup>

      <ConfirmationDialog
        visible={!!deleteTarget}
        title={t('waterQuality.settings.delete.title')}
        message={deleteTarget ? t('waterQuality.settings.delete.message', { label: deleteTarget.label }) : ''}
        confirmText={t('waterQuality.settings.delete.confirm')}
        cancelText={t('waterQuality.common.actions.cancel')}
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

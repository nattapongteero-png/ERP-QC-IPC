'use client';

/**
 * Water Quality Dashboard
 * Feature: 023
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { DataGrid, Column, FilterRow, Paging } from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { Popup } from 'devextreme-react/popup';
import { SelectBox } from 'devextreme-react/select-box';
import { NumberBox } from 'devextreme-react/number-box';
import { TextArea } from 'devextreme-react/text-area';
import { Droplets, Plus, AlertTriangle, FlaskConical, MapPin } from 'lucide-react';
import { BackButton } from '@/components/shared/BackButton';
import {
  WATER_SYSTEM_TYPES,
  type WaterSamplePoint,
  type WaterSystem,
  type WaterQualitySpec,
  type WaterSystemType,
} from '@/types/environmental-monitoring';

export default function WaterQualityPage() {
  const t = useTranslations('environmentalMonitoring');
  const qc = useQueryClient();
  const [testOpen, setTestOpen] = useState(false);
  const [samplePointId, setSamplePointId] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState('');
  const [password, setPassword] = useState('');

  // Add System popup
  const [sysOpen, setSysOpen] = useState(false);
  const [sysForm, setSysForm] = useState({ code: '', name: '', systemType: 'purified' as WaterSystemType, description: '' });
  // Add Sample Point popup
  const [ptOpen, setPtOpen] = useState(false);
  const [ptForm, setPtForm] = useState({ waterSystemId: 0, code: '', name: '', location: '' });
  // Add Spec popup
  const [specOpen, setSpecOpen] = useState(false);
  const [specForm, setSpecForm] = useState({
    waterSystemId: 0,
    samplePointId: null as number | null,
    parameter: '',
    unit: '',
    specMin: '' as number | '',
    specMax: '' as number | '',
  });

  const { data: systems } = useQuery<WaterSystem[]>({
    queryKey: ['water-systems'],
    queryFn: async () => {
      const res = await fetch('/api/environmental/water-systems');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: points } = useQuery<WaterSamplePoint[]>({
    queryKey: ['sample-points'],
    queryFn: async () => {
      const res = await fetch('/api/environmental/sample-points');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const selectedPoint = points?.find((p) => p.id === samplePointId);

  const { data: specs } = useQuery<WaterQualitySpec[]>({
    queryKey: ['water-specs', selectedPoint?.waterSystemId],
    queryFn: async () => {
      if (!selectedPoint) return [];
      const res = await fetch(
        `/api/environmental/water-specs?waterSystemId=${selectedPoint.waterSystemId}`,
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedPoint,
  });

  const createSysMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/environmental/water-systems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sysForm),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Failed');
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['water-systems'] });
      setSysOpen(false);
      setSysForm({ code: '', name: '', systemType: 'purified', description: '' });
    },
  });

  const createPtMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/environmental/sample-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ptForm),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Failed');
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sample-points'] });
      setPtOpen(false);
      setPtForm({ waterSystemId: 0, code: '', name: '', location: '' });
    },
  });

  const createSpecMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/environmental/water-specs', {
        method: 'POST',
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
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Failed');
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['water-specs'] });
      setSpecOpen(false);
      setSpecForm({ waterSystemId: 0, samplePointId: null, parameter: '', unit: '', specMin: '', specMax: '' });
    },
  });

  const recordMut = useMutation({
    mutationFn: async () => {
      if (!selectedPoint) throw new Error('No sample point');
      const results_payload = (specs ?? []).map((s) => ({
        specId: s.id,
        parameter: s.parameter,
        numericValue: results[s.id] ?? null,
        unit: s.unit,
      }));
      const res = await fetch('/api/environmental/water-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          samplePointId: selectedPoint.id,
          waterSystemId: selectedPoint.waterSystemId,
          results: results_payload,
          notes: notes || null,
          signature: { password: password || 'verify' },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Failed');
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['water-systems'] });
      setTestOpen(false);
      setSamplePointId(null);
      setResults({});
      setNotes('');
      setPassword('');
    },
  });

  return (
    <div className="p-6 space-y-4">
      <BackButton href="/quality" label="Quality" />
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Droplets className="w-6 h-6" />
          {t('page.waterQuality')}
        </h1>
        <div className="flex gap-2 flex-wrap">
          <Button
            stylingMode="outlined"
            onClick={() => setSysOpen(true)}
            render={() => (
              <span className="inline-flex items-center gap-1">
                <Droplets className="w-4 h-4" />
                + System
              </span>
            )}
          />
          <Button
            stylingMode="outlined"
            onClick={() => setPtOpen(true)}
            render={() => (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                + Sample Point
              </span>
            )}
          />
          <Button
            stylingMode="outlined"
            onClick={() => setSpecOpen(true)}
            render={() => (
              <span className="inline-flex items-center gap-1">
                <FlaskConical className="w-4 h-4" />
                + Spec
              </span>
            )}
          />
          <Button
            type="default"
            stylingMode="contained"
            onClick={() => setTestOpen(true)}
            render={() => (
              <span className="inline-flex items-center gap-1">
                <Plus className="w-4 h-4" />
                บันทึกผลตรวจน้ำ
              </span>
            )}
          />
        </div>
      </header>

      <div>
        <h2 className="font-semibold mb-2">ระบบน้ำ</h2>
        <DataGrid
          dataSource={systems ?? []}
          keyExpr="id"
          showBorders
          showRowLines
          columnAutoWidth
        >
          <FilterRow visible />
          <Paging pageSize={10} />
          <Column dataField="code" caption="Code" width={100} />
          <Column dataField="name" caption="Name" />
          <Column dataField="systemType" caption="Type" width={120} />
          <Column dataField="description" caption="Description" />
          <Column dataField="isActive" caption="Active" dataType="boolean" width={80} />
        </DataGrid>
      </div>

      <div>
        <h2 className="font-semibold mb-2 mt-4">จุดสุ่มตัวอย่าง</h2>
        <DataGrid
          dataSource={points ?? []}
          keyExpr="id"
          showBorders
          showRowLines
          columnAutoWidth
        >
          <FilterRow visible />
          <Paging pageSize={10} />
          <Column dataField="code" caption="Code" width={100} />
          <Column dataField="name" caption="Name" />
          <Column dataField="location" caption="Location" />
          <Column
            dataField="waterSystemId"
            caption="System"
            calculateCellValue={(row: WaterSamplePoint) =>
              systems?.find((s) => s.id === row.waterSystemId)?.name ?? row.waterSystemId
            }
          />
          <Column dataField="isActive" caption="Active" dataType="boolean" width={80} />
        </DataGrid>
      </div>

      <Popup
        visible={testOpen}
        onHiding={() => setTestOpen(false)}
        showCloseButton
        title="บันทึกผลตรวจน้ำ"
        width={580}
        height="auto"
      >
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.samplePoint')} *</label>
            <SelectBox
              dataSource={points ?? []}
              displayExpr={(p: WaterSamplePoint) =>
                p ? `${p.code} — ${p.name} (${systems?.find((s) => s.id === p.waterSystemId)?.code ?? ''})` : ''
              }
              valueExpr="id"
              value={samplePointId}
              onValueChanged={(e) => setSamplePointId(e.value as number | null)}
            />
          </div>
          {selectedPoint && (specs ?? []).map((s) => (
            <div key={s.id} className="border rounded p-3 space-y-1">
              <div className="font-medium">
                {s.parameter} ({s.unit})
                {s.specMin != null || s.specMax != null ? (
                  <span className="text-xs text-gray-500 ml-2">
                    spec {s.specMin ?? '-'} – {s.specMax ?? '-'}
                  </span>
                ) : null}
              </div>
              <NumberBox
                value={results[s.id] ?? null}
                onValueChanged={(e) =>
                  setResults((prev) => ({ ...prev, [s.id]: Number(e.value ?? 0) }))
                }
                step={0.001}
                format="#0.000"
                placeholder={t('form.value')}
              />
            </div>
          ))}
          {selectedPoint && (specs ?? []).length === 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded p-3 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                ระบบน้ำของจุดเก็บนี้ยังไม่มีการตั้งเกณฑ์ (Spec) จึงไม่มีรายการให้บันทึก —
                กรุณากดปุ่ม “+ Spec” เพื่อเพิ่มเกณฑ์ของระบบน้ำนี้ก่อน แล้วจึงบันทึกผลตรวจได้
              </span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.notes')}</label>
            <TextArea
              value={notes}
              height={60}
              onValueChanged={(e) => setNotes(String(e.value ?? ''))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {recordMut.error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded p-3 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {String((recordMut.error as Error).message)}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button text={t('actions.cancel')} stylingMode="text" onClick={() => setTestOpen(false)} />
            <Button
              type="success"
              stylingMode="contained"
              text={t('actions.save')}
              disabled={
                !samplePointId ||
                (!!selectedPoint && (specs ?? []).length === 0) ||
                recordMut.isPending
              }
              onClick={() => recordMut.mutate()}
            />
          </div>
        </div>
      </Popup>

      {/* Add Water System */}
      <Popup
        visible={sysOpen}
        onHiding={() => setSysOpen(false)}
        showCloseButton
        title="+ Water System"
        width={480}
        height="auto"
      >
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Code *</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={sysForm.code}
              onChange={(e) => setSysForm({ ...sysForm, code: e.target.value })}
              placeholder="PW-01"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={sysForm.name}
              onChange={(e) => setSysForm({ ...sysForm, name: e.target.value })}
              placeholder="Purified Water 1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type *</label>
            <SelectBox
              dataSource={WATER_SYSTEM_TYPES}
              value={sysForm.systemType}
              onValueChanged={(e) => setSysForm({ ...sysForm, systemType: e.value as WaterSystemType })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <TextArea
              value={sysForm.description}
              height={60}
              onValueChanged={(e) => setSysForm({ ...sysForm, description: String(e.value ?? '') })}
            />
          </div>
          {createSysMut.error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded p-3 text-sm">
              {String((createSysMut.error as Error).message)}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button text="Cancel" stylingMode="text" onClick={() => setSysOpen(false)} />
            <Button
              type="default"
              stylingMode="contained"
              text="บันทึก"
              disabled={!sysForm.code || !sysForm.name || createSysMut.isPending}
              onClick={() => createSysMut.mutate()}
            />
          </div>
        </div>
      </Popup>

      {/* Add Sample Point */}
      <Popup
        visible={ptOpen}
        onHiding={() => setPtOpen(false)}
        showCloseButton
        title="+ Sample Point"
        width={480}
        height="auto"
      >
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Water System *</label>
            <SelectBox
              dataSource={systems ?? []}
              displayExpr={(s: WaterSystem) => (s ? `${s.code} — ${s.name}` : '')}
              valueExpr="id"
              value={ptForm.waterSystemId || null}
              onValueChanged={(e) => setPtForm({ ...ptForm, waterSystemId: Number(e.value ?? 0) })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Code *</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={ptForm.code}
              onChange={(e) => setPtForm({ ...ptForm, code: e.target.value })}
              placeholder="PW-01-SP01"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={ptForm.name}
              onChange={(e) => setPtForm({ ...ptForm, name: e.target.value })}
              placeholder="Tank outlet"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Location</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={ptForm.location}
              onChange={(e) => setPtForm({ ...ptForm, location: e.target.value })}
              placeholder="Building A, 2nd floor"
            />
          </div>
          {createPtMut.error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded p-3 text-sm">
              {String((createPtMut.error as Error).message)}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button text="Cancel" stylingMode="text" onClick={() => setPtOpen(false)} />
            <Button
              type="default"
              stylingMode="contained"
              text="บันทึก"
              disabled={!ptForm.waterSystemId || !ptForm.code || !ptForm.name || createPtMut.isPending}
              onClick={() => createPtMut.mutate()}
            />
          </div>
        </div>
      </Popup>

      {/* Add Spec */}
      <Popup
        visible={specOpen}
        onHiding={() => setSpecOpen(false)}
        showCloseButton
        title="+ Water Quality Spec"
        width={520}
        height="auto"
      >
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Water System *</label>
            <SelectBox
              dataSource={systems ?? []}
              displayExpr={(s: WaterSystem) => (s ? `${s.code} — ${s.name}` : '')}
              valueExpr="id"
              value={specForm.waterSystemId || null}
              onValueChanged={(e) => setSpecForm({ ...specForm, waterSystemId: Number(e.value ?? 0) })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sample Point (optional)</label>
            <SelectBox
              dataSource={[{ id: 0, name: '— ทั้งระบบ —' }, ...(points ?? [])]}
              displayExpr={(p: { id: number; name: string }) => (p ? p.name : '')}
              valueExpr="id"
              value={specForm.samplePointId ?? 0}
              onValueChanged={(e) =>
                setSpecForm({ ...specForm, samplePointId: Number(e.value) === 0 ? null : Number(e.value) })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Parameter *</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                value={specForm.parameter}
                onChange={(e) => setSpecForm({ ...specForm, parameter: e.target.value })}
                placeholder="ph / conductivity / toc"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unit</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                value={specForm.unit}
                onChange={(e) => setSpecForm({ ...specForm, unit: e.target.value })}
                placeholder="uS/cm / ppm / blank"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Spec Min</label>
              <input
                type="number"
                step="0.001"
                className="w-full border rounded px-3 py-2"
                value={specForm.specMin}
                onChange={(e) =>
                  setSpecForm({ ...specForm, specMin: e.target.value === '' ? '' : Number(e.target.value) })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Spec Max</label>
              <input
                type="number"
                step="0.001"
                className="w-full border rounded px-3 py-2"
                value={specForm.specMax}
                onChange={(e) =>
                  setSpecForm({ ...specForm, specMax: e.target.value === '' ? '' : Number(e.target.value) })
                }
              />
            </div>
          </div>
          {createSpecMut.error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded p-3 text-sm">
              {String((createSpecMut.error as Error).message)}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button text="Cancel" stylingMode="text" onClick={() => setSpecOpen(false)} />
            <Button
              type="default"
              stylingMode="contained"
              text="บันทึก"
              disabled={!specForm.waterSystemId || !specForm.parameter || createSpecMut.isPending}
              onClick={() => createSpecMut.mutate()}
            />
          </div>
        </div>
      </Popup>
    </div>
  );
}

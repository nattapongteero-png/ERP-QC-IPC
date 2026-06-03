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
import { Droplets, Plus, AlertTriangle } from 'lucide-react';
import { BackButton } from '@/components/shared/BackButton';
import type {
  WaterSamplePoint,
  WaterSystem,
  WaterQualitySpec,
} from '@/types/environmental-monitoring';

export default function WaterQualityPage() {
  const t = useTranslations('environmentalMonitoring');
  const qc = useQueryClient();
  const [testOpen, setTestOpen] = useState(false);
  const [samplePointId, setSamplePointId] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState('');
  const [password, setPassword] = useState('');

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
              disabled={!samplePointId || recordMut.isPending}
              onClick={() => recordMut.mutate()}
            />
          </div>
        </div>
      </Popup>
    </div>
  );
}

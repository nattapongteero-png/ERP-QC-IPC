'use client';

/**
 * Environmental Inspections Dashboard
 * Feature: 023
 */
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { DataGrid, Column, FilterRow, Paging } from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { Popup } from 'devextreme-react/popup';
import { NumberBox } from 'devextreme-react/number-box';
import { TextArea } from 'devextreme-react/text-area';
import { SelectBox } from 'devextreme-react/select-box';
import { Thermometer, AlertTriangle, CheckCircle2, Plus, ListPlus, CalendarPlus } from 'lucide-react';
import {
  INSPECTION_TARGET_TYPES,
  INSPECTION_FREQUENCIES,
  type InspectionTargetType,
  type InspectionFrequency,
} from '@/types/environmental-monitoring';
import { Breadcrumbs } from '@/components/shared';
import type {
  InspectionTemplate,
  InspectionTemplateItem,
} from '@/types/environmental-monitoring';

interface ScheduleRow {
  id: number;
  targetType: string;
  targetId: number;
  targetName: string;
  templateId: number;
  templateName: string | null;
  frequency: string;
  nextDue: string;
  lastDone: string | null;
}

export default function InspectionsPage() {
  const t = useTranslations('environmentalMonitoring');
  const qc = useQueryClient();
  const [active, setActive] = useState<ScheduleRow | null>(null);
  const [answers, setAnswers] = useState<Record<number, { value: number | ''; remarks?: string }>>({});
  const [notes, setNotes] = useState('');
  const [password, setPassword] = useState('');

  const { data: schedData, refetch } = useQuery<{ items: ScheduleRow[] }>({
    queryKey: ['env-schedules'],
    queryFn: async () => {
      const res = await fetch('/api/environmental/schedules');
      if (!res.ok) return { items: [] };
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const { data: templates } = useQuery<InspectionTemplate[]>({
    queryKey: ['env-templates'],
    queryFn: async () => {
      const res = await fetch('/api/environmental/templates');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const scanMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/environmental/inspections/scan', { method: 'POST' });
      if (!res.ok) throw new Error('Scan failed');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications-unread-count'] }),
  });

  const inspectMut = useMutation({
    mutationFn: async () => {
      if (!active) throw new Error('No schedule');
      const tpl = templates?.find((tt) => tt.id === active.templateId);
      const items = (tpl?.items ?? []).map((it) => ({
        templateItemId: it.id,
        parameter: it.parameter,
        numericValue: answers[it.id]?.value === '' ? null : Number(answers[it.id]?.value ?? 0),
        textValue: null,
        remarks: answers[it.id]?.remarks ?? null,
      }));
      const res = await fetch('/api/environmental/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: active.id,
          templateId: active.templateId,
          targetType: active.targetType,
          targetId: active.targetId,
          results: items,
          notes: notes || null,
          signature: { password: password || 'verify' },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Failed');
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['env-schedules'] });
      setActive(null);
      setAnswers({});
      setNotes('');
      setPassword('');
    },
  });

  const schedules = schedData?.items ?? [];
  const now = new Date();
  const overdue = schedules.filter((s) => new Date(s.nextDue) < now).length;
  const today = schedules.filter((s) => new Date(s.nextDue).toDateString() === now.toDateString()).length;

  const activeTemplate = active ? templates?.find((tt) => tt.id === active.templateId) : null;

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs
        items={[
          { label: 'อาคารและสถานที่', href: '/premises' },
          { label: 'ตรวจสภาพแวดล้อม' },
        ]}
      />
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Thermometer className="w-6 h-6" />
          {t('page.inspections')}
        </h1>
        <div className="flex gap-2 flex-wrap">
          <Button text={t('actions.refresh')} onClick={() => refetch()} />
          <Link
            href="/premises/environmental/templates"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50 text-gray-700"
          >
            <ListPlus className="w-4 h-4" /> จัดการ Templates
          </Link>
          <Link
            href="/premises/environmental/schedules"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50 text-gray-700"
          >
            <CalendarPlus className="w-4 h-4" /> จัดการ Schedules
          </Link>
          <Button
            type="default"
            stylingMode="contained"
            text={t('actions.scan')}
            onClick={() => scanMut.mutate()}
            disabled={scanMut.isPending}
          />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase opacity-70 text-rose-900">{t('tiles.overdue')}</div>
            <div className="text-3xl font-bold text-rose-900 mt-1">{overdue}</div>
          </div>
          <AlertTriangle className="w-5 h-5 opacity-60 text-rose-900" />
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="text-xs uppercase opacity-70 text-amber-900">{t('tiles.dueToday')}</div>
          <div className="text-3xl font-bold text-amber-900 mt-1">{today}</div>
        </div>
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
          <div className="text-xs uppercase opacity-70 text-sky-900">{t('tiles.dueIn7d')}</div>
          <div className="text-3xl font-bold text-sky-900 mt-1">{schedules.length}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase opacity-70 text-emerald-900">{t('tiles.completedToday')}</div>
            <div className="text-3xl font-bold text-emerald-900 mt-1">
              {schedules.filter((s) => s.lastDone?.slice(0, 10) === now.toISOString().slice(0, 10)).length}
            </div>
          </div>
          <CheckCircle2 className="w-5 h-5 opacity-60 text-emerald-900" />
        </div>
      </div>

      <DataGrid
        dataSource={schedules}
        keyExpr="id"
        showBorders
        showRowLines
        rowAlternationEnabled
        columnAutoWidth
      >
        <FilterRow visible />
        <Paging pageSize={20} />
        <Column
          dataField="targetType"
          caption={t('form.targetType')}
          width={150}
          cellRender={(c) => t(`targetType.${c.value}` as any)}
        />
        <Column dataField="targetName" caption="Target" />
        <Column dataField="templateName" caption="Template" />
        <Column
          dataField="frequency"
          caption="Frequency"
          width={120}
          cellRender={(c) => t(`frequency.${c.value}` as any)}
        />
        <Column dataField="nextDue" caption="Next Due" dataType="datetime" />
        <Column dataField="lastDone" caption="Last Done" dataType="datetime" />
        <Column
          caption="Actions"
          width={140}
          cellRender={(c) => (
            <Button
              text={t('actions.inspect')}
              type="default"
              stylingMode="outlined"
              onClick={() => {
                const row = c.data as ScheduleRow;
                setActive(row);
                const tpl = templates?.find((tt) => tt.id === row.templateId);
                const init: Record<number, { value: number | '' }> = {};
                (tpl?.items ?? []).forEach((it) => {
                  init[it.id] = { value: '' };
                });
                setAnswers(init);
              }}
            />
          )}
        />
      </DataGrid>

      <Popup
        visible={!!active}
        onHiding={() => setActive(null)}
        showCloseButton
        title={active ? `${t('actions.inspect')}: ${active.targetName}` : ''}
        width={580}
        height="auto"
      >
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {(activeTemplate?.items ?? []).map((item: InspectionTemplateItem) => (
            <div key={item.id} className="border rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs text-gray-500">
                    {item.parameter} {item.unit ? `(${item.unit})` : ''}
                    {item.specMin != null || item.specMax != null
                      ? ` · spec ${item.specMin ?? '-'} – ${item.specMax ?? '-'}`
                      : ''}
                  </div>
                </div>
              </div>
              <NumberBox
                value={(answers[item.id]?.value as number) ?? null}
                onValueChanged={(e) =>
                  setAnswers((prev) => ({
                    ...prev,
                    [item.id]: { value: Number(e.value ?? 0), remarks: prev[item.id]?.remarks },
                  }))
                }
                step={0.01}
                format="#0.00"
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

          {inspectMut.error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded p-3 text-sm">
              {String((inspectMut.error as Error).message)}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button text={t('actions.cancel')} stylingMode="text" onClick={() => setActive(null)} />
            <Button
              type="success"
              stylingMode="contained"
              text={t('actions.save')}
              disabled={inspectMut.isPending}
              onClick={() => inspectMut.mutate()}
            />
          </div>
        </div>
      </Popup>

    </div>
  );
}

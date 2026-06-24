'use client';

/**
 * Environmental Inspections Dashboard
 * Feature: 023
 */
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { DataGrid, Column, Paging } from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { Popup } from 'devextreme-react/popup';
import { NumberBox } from 'devextreme-react/number-box';
import { TextArea } from 'devextreme-react/text-area';
import { SelectBox } from 'devextreme-react/select-box';
import { Thermometer, AlertTriangle, CheckCircle2, Plus, ListPlus, CalendarPlus, History, RefreshCw, Bell } from 'lucide-react';
import {
  INSPECTION_TARGET_TYPES,
  INSPECTION_FREQUENCIES,
  evaluateResult,
  type InspectionTargetType,
  type InspectionFrequency,
} from '@/types/environmental-monitoring';
import { Breadcrumbs } from '@/components/shared';
import { useToast } from '@/hooks/use-toast';
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
  const tp = useTranslations('premises');
  const qc = useQueryClient();
  const toast = useToast();
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
        // parameter is required (min 1 char) by the API. Older template items may
        // have an empty parameter — fall back to a key derived from the label so
        // the request validates instead of failing with "Invalid body".
        parameter:
          (it.parameter && it.parameter.trim()) ||
          (it.label || '').trim().toLowerCase().replace(/\s+/g, '_') ||
          `item_${it.id}`,
        numericValue: answers[it.id]?.value === '' || answers[it.id]?.value == null
          ? null
          : Number(answers[it.id]?.value),
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
      if (!res.ok) {
        // Surface the specific validation problem (which field/why) instead of
        // a bare "Invalid body", so the operator/dev can see the real cause.
        const detail = Array.isArray(body?.issues)
          ? body.issues
              .map((i: { path?: (string | number)[]; message?: string }) =>
                `${(i.path ?? []).join('.')}: ${i.message}`,
              )
              .join('; ')
          : '';
        throw new Error(detail ? `${body?.error ?? 'Failed'} — ${detail}` : (body?.error ?? 'Failed'));
      }
      return body;
    },
    onSuccess: (body: { overallResult?: string; outOfSpecCount?: number } = {}) => {
      qc.invalidateQueries({ queryKey: ['env-schedules'] });
      // Surface the evaluated overall result so the operator sees ผ่าน/ไม่ผ่าน
      // immediately after recording (spec: record WITH pass/fail evaluation).
      if (body.overallResult === 'out_of_spec') {
        toast.error(
          tp('environmental.inspections.recordFailTitle'),
          tp('environmental.inspections.recordFailBody', { count: body.outOfSpecCount ?? '' }),
        );
      } else {
        toast.success(tp('environmental.inspections.recordOkTitle'), tp('environmental.inspections.recordOkBody'));
      }
      setActive(null);
      setAnswers({});
      setNotes('');
      setPassword('');
    },
    onError: (e: Error) => toast.error(tp('environmental.inspections.saveFailedToast'), e.message),
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
          { label: tp('environmental.common.breadcrumb.premises'), href: '/premises' },
          { label: tp('environmental.common.breadcrumb.environmental') },
        ]}
      />
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Thermometer className="w-6 h-6" />
          {t('page.inspections')}
        </h1>
        {/* Header actions — all rendered as uniform pill buttons (same height,
            padding, border, icon size) so they line up evenly. */}
        <div className="flex gap-2 flex-wrap items-center">
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> {t('actions.refresh')}
          </button>
          <Link
            href="/premises/environmental/inspections/history"
            className="inline-flex items-center gap-1.5 h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors"
          >
            <History className="w-4 h-4" /> {tp('environmental.inspections.historyLink')}
          </Link>
          <Link
            href="/premises/environmental/templates"
            className="inline-flex items-center gap-1.5 h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors"
          >
            <ListPlus className="w-4 h-4" /> {tp('environmental.inspections.manageTemplates')}
          </Link>
          <Link
            href="/premises/environmental/schedules"
            className="inline-flex items-center gap-1.5 h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors"
          >
            <CalendarPlus className="w-4 h-4" /> {tp('environmental.inspections.manageSchedules')}
          </Link>
          <button
            type="button"
            onClick={() => scanMut.mutate()}
            disabled={scanMut.isPending}
            title={tp('environmental.inspections.scanHint')}
            className="inline-flex items-center gap-1.5 h-9 px-3 text-sm border border-emerald-200 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors disabled:opacity-50"
          >
            <Bell className="w-4 h-4" /> {tp('environmental.inspections.scanButton')}
          </button>
        </div>
      </header>

      <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 text-sm text-sky-900 space-y-3">
        <div className="font-semibold flex items-center gap-1.5">
          <Thermometer className="w-4 h-4" /> {tp('environmental.inspections.infoTitle')}
        </div>
        {/* Clear 1-2-3 prerequisite + recording steps so first-time users know
            what to set up before a row appears to inspect. */}
        <ol className="space-y-1.5">
          <li className="flex gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sky-200 text-sky-900 text-xs font-bold flex items-center justify-center">1</span>
            <span>
              {tp('environmental.inspections.step1')}{' '}
              <Link href="/premises/environmental/templates" className="underline font-medium">{tp('environmental.inspections.manageTemplates')}</Link>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sky-200 text-sky-900 text-xs font-bold flex items-center justify-center">2</span>
            <span>
              {tp('environmental.inspections.step2')}{' '}
              <Link href="/premises/environmental/schedules" className="underline font-medium">{tp('environmental.inspections.manageSchedules')}</Link>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-center">3</span>
            <span>
              {tp('environmental.inspections.step3Part1')}{' '}
              <span className="font-medium">"{t('actions.inspect')}"</span> {tp('environmental.inspections.step3Part2')}
            </span>
          </li>
        </ol>
        <div className="text-xs text-sky-800 border-t border-sky-200 pt-2">
          {tp('environmental.inspections.infoHintPart1')}{' '}
          <Link href="/premises/environmental/inspections/history" className="underline font-medium">{tp('environmental.inspections.historyLink')}</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 border-l-4 border-l-rose-500 rounded-[14px] p-4 flex items-center justify-between shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div>
            <div className="text-xs uppercase text-gray-500">{t('tiles.overdue')}</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{overdue}</div>
          </div>
          <AlertTriangle className="w-5 h-5 text-rose-500" />
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-amber-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div className="text-xs uppercase text-gray-500">{t('tiles.dueToday')}</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{today}</div>
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div className="text-xs uppercase text-gray-500">{t('tiles.dueIn7d')}</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{schedules.length}</div>
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-emerald-500 rounded-[14px] p-4 flex items-center justify-between shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div>
            <div className="text-xs uppercase text-gray-500">{t('tiles.completedToday')}</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">
              {schedules.filter((s) => s.lastDone?.slice(0, 10) === now.toISOString().slice(0, 10)).length}
            </div>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
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
        <Paging pageSize={20} />
        <Column
          dataField="targetType"
          caption={t('form.targetType')}
          width={150}
          cellRender={(c) => t(`targetType.${c.value}` as any)}
        />
        <Column dataField="targetName" caption={tp('environmental.common.targetWithLocationColumn')} />
        <Column dataField="templateName" caption={tp('environmental.common.templateColumn')} />
        <Column
          dataField="frequency"
          caption={tp('environmental.common.frequencyColumn')}
          width={120}
          cellRender={(c) => t(`frequency.${c.value}` as any)}
        />
        <Column dataField="nextDue" caption={tp('environmental.common.nextDueColumn')} dataType="datetime" />
        <Column dataField="lastDone" caption={tp('environmental.common.lastDoneColumn')} dataType="datetime" />
        <Column
          caption={tp('environmental.common.actionsColumn')}
          width={230}
          cellRender={(c) => {
            const row = c.data as ScheduleRow;
            return (
              // Only the "Inspect" action — viewing/editing past records lives on
              // the "ประวัติผลตรวจ" page (header button), so a per-row history link
              // here would be redundant.
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActive(row);
                    const tpl = templates?.find((tt) => tt.id === row.templateId);
                    const init: Record<number, { value: number | '' }> = {};
                    (tpl?.items ?? []).forEach((it) => {
                      init[it.id] = { value: '' };
                    });
                    setAnswers(init);
                  }}
                  className="inline-flex items-center gap-1 h-8 px-3 text-xs font-medium border border-emerald-300 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors whitespace-nowrap"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t('actions.inspect')}
                </button>
              </div>
            );
          }}
        />
      </DataGrid>

      <Popup
        visible={!!active}
        onHiding={() => setActive(null)}
        showCloseButton
        title={active ? tp('environmental.inspections.inspectTitle', { action: t('actions.inspect'), name: active.targetName }) : ''}
        width={580}
        height="auto"
      >
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {(activeTemplate?.items ?? []).map((item: InspectionTemplateItem) => {
            // Live pass/fail as the operator types — compare the entered value
            // against the item's spec (same rule the server uses to record).
            const raw = answers[item.id]?.value;
            const entered = raw === '' || raw == null ? null : Number(raw);
            const status =
              entered == null ? null : evaluateResult(entered, item.specMin, item.specMax);
            return (
              <div key={item.id} className="border rounded p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{item.label}</div>
                    <div className="text-xs text-gray-500">
                      {item.parameter} {item.unit ? `(${item.unit})` : ''}
                      {item.specMin != null || item.specMax != null
                        ? ` · spec ${item.specMin ?? '-'} – ${item.specMax ?? '-'}`
                        : ''}
                    </div>
                  </div>
                  {status && (
                    <span
                      className={
                        'inline-flex px-2 py-1 rounded text-xs font-medium whitespace-nowrap ' +
                        (status === 'out_of_spec'
                          ? 'bg-rose-100 text-rose-800'
                          : status === 'in_spec'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-100 text-gray-600')
                      }
                      data-testid={`item-result-${item.id}`}
                    >
                      {status === 'out_of_spec'
                        ? tp('environmental.inspections.itemFail')
                        : status === 'in_spec'
                        ? tp('environmental.inspections.itemPass')
                        : tp('environmental.inspections.itemNoSpec')}
                    </span>
                  )}
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
                  // Stop browser email/username autofill (the nearby password
                  // field makes Chrome/Firefox offer credential autofill here).
                  inputAttr={{
                    autoComplete: 'off',
                    name: `insp-value-${item.id}`,
                    'data-lpignore': 'true',
                    'data-form-type': 'other',
                  }}
                />
              </div>
            );
          })}
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.notes')}</label>
            <TextArea
              value={notes}
              height={60}
              onValueChanged={(e) => setNotes(String(e.value ?? ''))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{tp('environmental.inspections.passwordLabel')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              autoComplete="new-password"
              data-lpignore="true"
              data-form-type="other"
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

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
import { Thermometer, AlertTriangle, CheckCircle2, Plus, ListPlus, CalendarPlus, History } from 'lucide-react';
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
            href="/premises/environmental/inspections/history"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50 text-gray-700"
          >
            <History className="w-4 h-4" /> ประวัติผลตรวจ
          </Link>
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
            stylingMode="outlined"
            text="แจ้งเตือนรายการที่ถึงกำหนด"
            hint="สร้างการแจ้งเตือน (กระดิ่ง) สำหรับรายการที่ถึง/เกินกำหนดเดี๋ยวนี้ — ไม่ใช่การบันทึกผลตรวจ ปกติระบบจะแจ้งเตือนให้อัตโนมัติอยู่แล้ว"
            onClick={() => scanMut.mutate()}
            disabled={scanMut.isPending}
          />
        </div>
      </header>

      <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-sm text-sky-900 space-y-1">
        <div>
          <span className="font-medium">หน้านี้ใช้ทำอะไร?</span> แสดง "ตารางตรวจที่ถึงกำหนด" โดยอัตโนมัติ —
          เมื่อถึงเวลา รายการจะขึ้นเอง (ไม่ต้องกดปุ่มใด ๆ) จากนั้นกดปุ่ม{' '}
          <span className="font-medium">"{t('actions.inspect')}"</span> ในแต่ละแถวเพื่อ <span className="font-medium">บันทึกผลตรวจ</span>
        </div>
        <div className="text-xs text-sky-800">
          • ปุ่ม "แจ้งเตือนรายการที่ถึงกำหนด" = แค่ส่งการแจ้งเตือน (กระดิ่ง) ไม่ใช่การบันทึก ·
          แก้ไข/ลบผลที่บันทึกไปแล้วได้ที่{' '}
          <Link href="/premises/environmental/inspections/history" className="underline font-medium">ประวัติผลตรวจ</Link> ·
          ตั้งค่าตารางผิด แก้/ปิดได้ที่{' '}
          <Link href="/premises/environmental/schedules" className="underline font-medium">จัดการ Schedules</Link>
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
        <FilterRow visible />
        <Paging pageSize={20} />
        <Column
          dataField="targetType"
          caption={t('form.targetType')}
          width={150}
          cellRender={(c) => t(`targetType.${c.value}` as any)}
        />
        <Column dataField="targetName" caption="เป้าหมาย (สถานที่)" />
        <Column dataField="templateName" caption="แบบฟอร์ม" />
        <Column
          dataField="frequency"
          caption="ความถี่"
          width={120}
          cellRender={(c) => t(`frequency.${c.value}` as any)}
        />
        <Column dataField="nextDue" caption="ครบกำหนดถัดไป" dataType="datetime" />
        <Column dataField="lastDone" caption="ตรวจล่าสุด" dataType="datetime" />
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

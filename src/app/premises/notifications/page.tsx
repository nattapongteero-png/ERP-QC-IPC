'use client';

/**
 * Maintenance Alerts — unified inbox + calendar
 * Feature: 022-equipment-notifications
 *
 * One page, two views (รายการ / ปฏิทิน) over the same equipment_notifications
 * data. Notifications are auto-generated (no manual scan button) from:
 *   - maintenance / calibration schedules that are due or overdue
 *   - out-of-spec events (environmental inspections, water quality)
 * The operator acknowledges (รับทราบ/ดำเนินการ) or snoozes (เลื่อน) each item.
 */
import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { DataGrid, Column, Paging } from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { Popup } from 'devextreme-react/popup';
import { TextArea } from 'devextreme-react/text-area';
import { NumberBox } from 'devextreme-react/number-box';
import { Bell, AlertTriangle, CheckCircle2, Clock, AlertCircle, List, CalendarDays } from 'lucide-react';
import { Breadcrumbs } from '@/components/shared';
import type {
  EquipmentNotification,
  NotificationSeverity,
} from '@/types/equipment-notifications';

interface InboxResponse {
  items: EquipmentNotification[];
  total: number;
  unreadCount: number;
}

interface CalendarItem {
  id: number;
  date: string;
  title: string;
  severity: NotificationSeverity;
  entityType: string;
  entityId: number;
}

function monthOffset(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function MaintenanceAlertsPage() {
  const t = useTranslations('equipmentNotifications');
  const qc = useQueryClient();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [ackOpen, setAckOpen] = useState<{ id: number } | null>(null);
  const [snoozeOpen, setSnoozeOpen] = useState<{ id: number } | null>(null);
  const [note, setNote] = useState('');
  const [snoozeDays, setSnoozeDays] = useState<number>(3);

  // Calendar month state (only used in calendar view)
  const now0 = new Date();
  const [month, setMonth] = useState<string>(
    `${now0.getFullYear()}-${String(now0.getMonth() + 1).padStart(2, '0')}`,
  );

  const { data, refetch } = useQuery<InboxResponse>({
    queryKey: ['notifications-list'],
    queryFn: async () => {
      const res = await fetch('/api/notifications?pageSize=200');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const { data: calData } = useQuery<{ items: CalendarItem[] }>({
    queryKey: ['notifications-calendar', month],
    queryFn: async () => {
      const res = await fetch(`/api/notifications/calendar?month=${month}`);
      if (!res.ok) return { items: [] };
      return res.json();
    },
    enabled: view === 'calendar',
  });

  // Auto-scan once on mount so the inbox is fresh without a manual "scan"
  // button. scanMaintenanceSchedules is idempotent (dedupe key), so this is
  // safe to call on every visit.
  const scannedRef = useRef(false);
  useEffect(() => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    fetch('/api/notifications/scan', { method: 'POST' })
      .then(() => {
        qc.invalidateQueries({ queryKey: ['notifications-list'] });
        qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      })
      .catch(() => {});
  }, [qc]);

  const ackMut = useMutation({
    mutationFn: async () => {
      if (!ackOpen) throw new Error('No notification');
      const res = await fetch(`/api/notifications/${ackOpen.id}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note || null }),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-list'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      setAckOpen(null);
      setNote('');
    },
  });

  const snoozeMut = useMutation({
    mutationFn: async () => {
      if (!snoozeOpen) throw new Error('No notification');
      const res = await fetch(`/api/notifications/${snoozeOpen.id}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snoozeDays, note: note || null }),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-list'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      setSnoozeOpen(null);
      setSnoozeDays(3);
      setNote('');
    },
  });

  const items = data?.items ?? [];
  const open = items.filter((i) => i.status === 'open');
  const overdue = items.filter((i) => i.severity === 'overdue' && i.status === 'open').length;
  const in7d = items.filter((i) => i.severity === 'due_in_7d' && i.status === 'open').length;
  const in30d = items.filter((i) => i.severity === 'due_in_30d' && i.status === 'open').length;

  // Calendar grid
  const calItems = calData?.items ?? [];
  const [calYear, calMonthNum] = month.split('-').map(Number);
  const firstDay = new Date(calYear, calMonthNum - 1, 1);
  const lastDay = new Date(calYear, calMonthNum, 0);
  const startOffset = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const cells: Array<{ day: number | null; items: CalendarItem[] }> = [];
  for (let i = 0; i < startOffset; i++) cells.push({ day: null, items: [] });
  for (let d = 1; d <= totalDays; d++) {
    const iso = `${month}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, items: calItems.filter((it) => it.date.startsWith(iso)) });
  }

  const tabBtn = (key: 'list' | 'calendar', label: string, Icon: typeof List) => (
    <button
      onClick={() => setView(key)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border transition-colors ${
        view === key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 hover:bg-gray-50'
      }`}
      data-testid={`view-${key}`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs
        items={[
          { label: 'อาคารและสถานที่', href: '/premises' },
          { label: 'แจ้งเตือนบำรุงรักษา' },
        ]}
      />
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6" />
            แจ้งเตือนบำรุงรักษา
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {tabBtn('list', 'รายการ', List)}
          {tabBtn('calendar', 'ปฏิทิน', CalendarDays)}
          <Button text={t('actions.refresh')} onClick={() => refetch()} />
        </div>
      </header>

      <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-sm text-sky-900 space-y-1">
        <div>
          <span className="font-medium">ข้อมูลมาจากไหน?</span> ระบบสร้างให้
          <span className="font-medium"> อัตโนมัติ</span> จาก (1) กำหนดการบำรุงรักษา/สอบเทียบเครื่องมือที่ถึง/เกินกำหนด
          และ (2) ผลตรวจที่เกินเกณฑ์ (สิ่งแวดล้อม/น้ำ) — ไม่ต้องกดปุ่มสแกนเอง
        </div>
        <div className="text-xs text-sky-800">
          กด <span className="font-medium">"รับทราบ/ดำเนินการ"</span> เพื่อปิดงานเตือน (บันทึกผู้รับทราบ+เวลา) หรือ{' '}
          <span className="font-medium">"เลื่อน"</span> เพื่อเลื่อนการเตือนออกไป · รายการที่เกินเกณฑ์จะมีใบ Deviation ผูกให้อัตโนมัติ
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
        <div className="bg-white border border-gray-200 border-l-4 border-l-amber-500 rounded-[14px] p-4 flex items-center justify-between shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div>
            <div className="text-xs uppercase text-gray-500">{t('tiles.dueIn7d')}</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{in7d}</div>
          </div>
          <Clock className="w-5 h-5 text-amber-500" />
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded-[14px] p-4 flex items-center justify-between shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div>
            <div className="text-xs uppercase text-gray-500">{t('tiles.dueIn30d')}</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{in30d}</div>
          </div>
          <AlertCircle className="w-5 h-5 text-blue-500" />
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-gray-500 rounded-[14px] p-4 flex items-center justify-between shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div>
            <div className="text-xs uppercase text-gray-500">{t('tiles.open')}</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{open.length}</div>
          </div>
          <Bell className="w-5 h-5 text-gray-500" />
        </div>
      </div>

      {view === 'list' ? (
        <DataGrid
          dataSource={items}
          keyExpr="id"
          showBorders
          showRowLines
          rowAlternationEnabled
          columnAutoWidth
          data-testid="notifications-grid"
        >
          <Paging pageSize={20} />
          <Column
            dataField="severity"
            caption="ระดับ"
            width={140}
            cellRender={(c) => {
              const v = String(c.value) as NotificationSeverity;
              const color =
                v === 'overdue'
                  ? 'bg-rose-100 text-rose-900'
                  : v === 'due_today'
                    ? 'bg-rose-100 text-rose-900'
                    : v === 'due_in_7d'
                      ? 'bg-amber-100 text-amber-900'
                      : v === 'due_in_30d'
                        ? 'bg-sky-100 text-sky-900'
                        : 'bg-slate-100 text-slate-900';
              return (
                <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${color}`}>
                  {t(`severity.${v}` as any)}
                </span>
              );
            }}
          />
          <Column dataField="type" caption="ประเภท" width={150} cellRender={(c) => t(`type.${c.value}` as any)} />
          <Column dataField="title" caption="หัวข้อ" />
          <Column dataField="dueAt" caption="ครบกำหนด" width={160} dataType="datetime" />
          <Column dataField="status" caption="สถานะ" width={130} cellRender={(c) => t(`status.${c.value}` as any)} />
          <Column
            caption="การกระทำ"
            width={220}
            cellRender={(c) => {
              const n = c.data as EquipmentNotification;
              if (n.status !== 'open') return <span className="text-gray-400">—</span>;
              return (
                <div className="flex gap-1">
                  <Button text={t('actions.acknowledge')} type="success" stylingMode="outlined" onClick={() => setAckOpen({ id: n.id })} />
                  <Button text={t('actions.snooze')} type="default" stylingMode="outlined" onClick={() => setSnoozeOpen({ id: n.id })} />
                </div>
              );
            }}
          />
        </DataGrid>
      ) : (
        <div className="bg-white border rounded-lg p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-xs text-gray-500">
              ปฏิทินแสดงงานบำรุงรักษา/แจ้งเตือนที่ <span className="font-medium">ครบกำหนด</span> ในแต่ละวันของเดือน — ใช้วางแผนล่วงหน้า
            </div>
            <div className="flex items-center gap-2">
              <Button icon="chevronleft" hint="เดือนก่อนหน้า" onClick={() => setMonth(monthOffset(month, -1))} data-testid="cal-prev" />
              <span className="font-medium text-lg w-28 text-center">{month}</span>
              <Button icon="chevronright" hint="เดือนถัดไป" onClick={() => setMonth(monthOffset(month, +1))} data-testid="cal-next" />
              <Button
                text="วันนี้"
                onClick={() => {
                  const d = new Date();
                  setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-xs font-medium text-gray-500 mb-1">
            {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d) => (
              <div key={d} className="text-center py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, i) => (
              <div key={i} className={`border rounded p-1 min-h-[80px] ${cell.day == null ? 'bg-gray-50' : 'bg-white'}`}>
                {cell.day != null && (
                  <>
                    <div className="text-xs font-medium text-gray-500">{cell.day}</div>
                    <div className="space-y-1 mt-1">
                      {cell.items.map((it) => {
                        const color =
                          it.severity === 'overdue' || it.severity === 'due_today'
                            ? 'bg-rose-200 text-rose-900'
                            : it.severity === 'due_in_7d'
                              ? 'bg-amber-200 text-amber-900'
                              : 'bg-sky-200 text-sky-900';
                        return (
                          <div key={it.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${color}`} title={it.title}>
                            {it.title}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ack Popup */}
      <Popup visible={!!ackOpen} onHiding={() => setAckOpen(null)} showCloseButton title={t('actions.acknowledge')} width={460} height="auto">
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded p-3 text-emerald-900 text-sm">
            <CheckCircle2 className="w-4 h-4" /> รับทราบและจะดำเนินการ
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.note.label')}</label>
            <TextArea value={note} height={80} onValueChanged={(e) => setNote(String(e.value ?? ''))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button text="ยกเลิก" stylingMode="text" onClick={() => setAckOpen(null)} />
            <Button type="success" stylingMode="contained" text={t('actions.acknowledge')} disabled={ackMut.isPending} onClick={() => ackMut.mutate()} />
          </div>
        </div>
      </Popup>

      {/* Snooze Popup */}
      <Popup visible={!!snoozeOpen} onHiding={() => setSnoozeOpen(null)} showCloseButton title={t('actions.snooze')} width={460} height="auto">
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.snoozeDays.label')}</label>
            <NumberBox value={snoozeDays} min={1} max={60} step={1} showSpinButtons onValueChanged={(e) => setSnoozeDays(Number(e.value ?? 0))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.note.label')}</label>
            <TextArea value={note} height={60} onValueChanged={(e) => setNote(String(e.value ?? ''))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button text="ยกเลิก" stylingMode="text" onClick={() => setSnoozeOpen(null)} />
            <Button type="default" stylingMode="contained" text={t('actions.snooze')} disabled={snoozeMut.isPending} onClick={() => snoozeMut.mutate()} />
          </div>
        </div>
      </Popup>
    </div>
  );
}

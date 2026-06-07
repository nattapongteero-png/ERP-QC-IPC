'use client';

/**
 * Notifications Inbox — main page
 * Feature: 022-equipment-notifications
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  DataGrid,
  Column,
  FilterRow,
  Paging,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { Popup } from 'devextreme-react/popup';
import { TextArea } from 'devextreme-react/text-area';
import { NumberBox } from 'devextreme-react/number-box';
import { Bell, AlertTriangle, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
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

export default function NotificationsInboxPage() {
  const t = useTranslations('equipmentNotifications');
  const qc = useQueryClient();
  const [ackOpen, setAckOpen] = useState<{ id: number } | null>(null);
  const [snoozeOpen, setSnoozeOpen] = useState<{ id: number } | null>(null);
  const [note, setNote] = useState('');
  const [snoozeDays, setSnoozeDays] = useState<number>(3);

  const { data, refetch } = useQuery<InboxResponse>({
    queryKey: ['notifications-list'],
    queryFn: async () => {
      const res = await fetch('/api/notifications?pageSize=200');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const scanMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications/scan', { method: 'POST' });
      if (!res.ok) throw new Error('Scan failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-list'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

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
            {t('page.inbox')}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button text={t('actions.refresh')} onClick={() => refetch()} />
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
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase opacity-70 text-amber-900">{t('tiles.dueIn7d')}</div>
            <div className="text-3xl font-bold text-amber-900 mt-1">{in7d}</div>
          </div>
          <Clock className="w-5 h-5 opacity-60 text-amber-900" />
        </div>
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase opacity-70 text-sky-900">{t('tiles.dueIn30d')}</div>
            <div className="text-3xl font-bold text-sky-900 mt-1">{in30d}</div>
          </div>
          <AlertCircle className="w-5 h-5 opacity-60 text-sky-900" />
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase opacity-70 text-slate-900">{t('tiles.open')}</div>
            <div className="text-3xl font-bold text-slate-900 mt-1">{open.length}</div>
          </div>
          <Bell className="w-5 h-5 opacity-60 text-slate-900" />
        </div>
      </div>

      <DataGrid
        dataSource={items}
        keyExpr="id"
        showBorders
        showRowLines
        rowAlternationEnabled
        columnAutoWidth
      >
        <FilterRow visible />
        <Paging pageSize={20} />
        <Column
          dataField="severity"
          caption="Severity"
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
        <Column
          dataField="type"
          caption="Type"
          width={150}
          cellRender={(c) => t(`type.${c.value}` as any)}
        />
        <Column dataField="title" caption="Title" />
        <Column dataField="dueAt" caption="Due At" width={160} dataType="datetime" />
        <Column
          dataField="status"
          caption="Status"
          width={130}
          cellRender={(c) => t(`status.${c.value}` as any)}
        />
        <Column
          caption="Actions"
          width={220}
          cellRender={(c) => {
            const n = c.data as EquipmentNotification;
            if (n.status !== 'open') return <span className="text-gray-400">—</span>;
            return (
              <div className="flex gap-1">
                <Button
                  text={t('actions.acknowledge')}
                  type="success"
                  stylingMode="outlined"
                  onClick={() => setAckOpen({ id: n.id })}
                />
                <Button
                  text={t('actions.snooze')}
                  type="default"
                  stylingMode="outlined"
                  onClick={() => setSnoozeOpen({ id: n.id })}
                />
              </div>
            );
          }}
        />
      </DataGrid>

      {/* Ack Popup */}
      <Popup
        visible={!!ackOpen}
        onHiding={() => setAckOpen(null)}
        showCloseButton
        title={t('actions.acknowledge')}
        width={460}
        height="auto"
      >
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded p-3 text-emerald-900 text-sm">
            <CheckCircle2 className="w-4 h-4" /> รับทราบและจะดำเนินการ
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.note.label')}</label>
            <TextArea
              value={note}
              height={80}
              onValueChanged={(e) => setNote(String(e.value ?? ''))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button text="Cancel" stylingMode="text" onClick={() => setAckOpen(null)} />
            <Button
              type="success"
              stylingMode="contained"
              text={t('actions.acknowledge')}
              disabled={ackMut.isPending}
              onClick={() => ackMut.mutate()}
            />
          </div>
        </div>
      </Popup>

      {/* Snooze Popup */}
      <Popup
        visible={!!snoozeOpen}
        onHiding={() => setSnoozeOpen(null)}
        showCloseButton
        title={t('actions.snooze')}
        width={460}
        height="auto"
      >
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.snoozeDays.label')}</label>
            <NumberBox
              value={snoozeDays}
              min={1}
              max={60}
              step={1}
              showSpinButtons
              onValueChanged={(e) => setSnoozeDays(Number(e.value ?? 0))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.note.label')}</label>
            <TextArea
              value={note}
              height={60}
              onValueChanged={(e) => setNote(String(e.value ?? ''))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button text="Cancel" stylingMode="text" onClick={() => setSnoozeOpen(null)} />
            <Button
              type="default"
              stylingMode="contained"
              text={t('actions.snooze')}
              disabled={snoozeMut.isPending}
              onClick={() => snoozeMut.mutate()}
            />
          </div>
        </div>
      </Popup>
    </div>
  );
}

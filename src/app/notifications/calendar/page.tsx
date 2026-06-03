'use client';

/**
 * Maintenance Calendar — monthly view of due items
 * Feature: 022-equipment-notifications
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Button } from 'devextreme-react/button';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type { NotificationSeverity } from '@/types/equipment-notifications';

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

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function MaintenanceCalendarPage() {
  const t = useTranslations('equipmentNotifications');
  const [month, setMonth] = useState<string>(currentMonth());

  const { data } = useQuery<{ items: CalendarItem[] }>({
    queryKey: ['notifications-calendar', month],
    queryFn: async () => {
      const res = await fetch(`/api/notifications/calendar?month=${month}`);
      if (!res.ok) return { items: [] };
      return res.json();
    },
  });

  const items = data?.items ?? [];

  const [year, mNum] = month.split('-').map(Number);
  const firstDay = new Date(year, mNum - 1, 1);
  const lastDay = new Date(year, mNum, 0);
  const startOffset = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const cells: Array<{ day: number | null; items: CalendarItem[] }> = [];
  for (let i = 0; i < startOffset; i++) cells.push({ day: null, items: [] });
  for (let d = 1; d <= totalDays; d++) {
    const iso = `${month}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, items: items.filter((it) => it.date.startsWith(iso)) });
  }

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="w-6 h-6" />
          {t('page.calendar')}
        </h1>
        <div className="flex items-center gap-2">
          <Button icon="back" onClick={() => setMonth(monthOffset(month, -1))} />
          <span className="font-medium text-lg w-28 text-center">{month}</span>
          <Button icon="forward" onClick={() => setMonth(monthOffset(month, +1))} />
          <Button text="Today" onClick={() => setMonth(currentMonth())} />
        </div>
      </header>

      <div className="bg-white border rounded-lg p-3">
        <div className="grid grid-cols-7 gap-1 text-xs font-medium text-gray-500 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => (
            <div
              key={i}
              className={`border rounded p-1 min-h-[80px] ${cell.day == null ? 'bg-gray-50' : 'bg-white'}`}
            >
              {cell.day != null && (
                <>
                  <div className="text-xs font-medium text-gray-500">{cell.day}</div>
                  <div className="space-y-1 mt-1">
                    {cell.items.map((it) => {
                      const color =
                        it.severity === 'overdue'
                          ? 'bg-rose-200 text-rose-900'
                          : it.severity === 'due_today'
                            ? 'bg-rose-200 text-rose-900'
                            : it.severity === 'due_in_7d'
                              ? 'bg-amber-200 text-amber-900'
                              : 'bg-sky-200 text-sky-900';
                      return (
                        <div
                          key={it.id}
                          className={`text-[10px] px-1 py-0.5 rounded truncate ${color}`}
                          title={it.title}
                        >
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
    </div>
  );
}

'use client';

/**
 * Notification Bell — top nav dropdown
 * Feature: 022-equipment-notifications
 */
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import type { EquipmentNotification } from '@/types/equipment-notifications';
import { friendlyNotificationTitle } from '@/lib/utils/notification-title';

// QC audit notifications live on their own surfaces; the bell mirrors the
// maintenance inbox, so hide them here too.
const QC_TYPES = new Set(['lot_received', 'wo_completed', 'deviation_opened']);

export function NotificationBell() {
  const [open, setOpen] = useState(false);

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/unread-count');
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const { data: list } = useQuery<{ items: EquipmentNotification[] }>({
    queryKey: ['notifications-bell'],
    queryFn: async () => {
      const res = await fetch('/api/notifications?status=open&pageSize=10');
      if (!res.ok) return { items: [] };
      return res.json();
    },
    enabled: open,
    refetchInterval: 30_000,
  });

  const count = countData?.count ?? 0;

  return (
    <div className="relative">
      <button
        type="button"
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-700" />
        {count > 0 && (
          <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 min-w-[18px] h-[18px] text-[10px] font-bold leading-none text-white bg-rose-600 rounded-full">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Tap-away backdrop (esp. useful on tablet/touch). */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Width caps to the viewport on narrow screens so the panel never
              overflows the tablet edge; right-aligned but clamped. */}
          <div className="absolute right-0 mt-2 w-[min(92vw,24rem)] max-w-[92vw] bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="font-medium">การแจ้งเตือน ({count})</h3>
            <Link
              href="/premises/notifications"
              className="text-xs text-blue-600 hover:underline"
              onClick={() => setOpen(false)}
            >
              ดูทั้งหมด
            </Link>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {(() => {
              const items = (list?.items ?? []).filter((it) => !QC_TYPES.has(it.type));
              if (items.length === 0) {
                return <li className="p-4 text-center text-sm text-gray-500">ไม่มีการแจ้งเตือน</li>;
              }
              return items.map((it) => {
              const color =
                it.severity === 'overdue'
                  ? 'border-l-rose-500'
                  : it.severity === 'due_today'
                    ? 'border-l-rose-500'
                    : it.severity === 'due_in_7d'
                      ? 'border-l-amber-500'
                      : 'border-l-sky-500';
              return (
                <li
                  key={it.id}
                  className={`px-3 py-2 border-b border-l-4 ${color} hover:bg-gray-50`}
                >
                  <Link
                    href="/premises/notifications"
                    onClick={() => setOpen(false)}
                    className="block"
                  >
                    <div className="text-sm font-medium text-gray-900 break-words">{friendlyNotificationTitle(it.title)}</div>
                    {it.body && (
                      <div className="text-xs text-gray-600 break-words">{it.body}</div>
                    )}
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {it.dueAt ? new Date(it.dueAt).toLocaleString('th-TH') : '—'}
                    </div>
                  </Link>
                </li>
              );
              });
            })()}
          </ul>
        </div>
        </>
      )}
    </div>
  );
}

/**
 * Purchase Requisition Approval Timeline
 * Shows who performed each step of the PR lifecycle (created → submitted →
 * approved/rejected) with names, dates and comments. Data comes from
 * GET /api/purchasing/requisitions/[id]/history.
 */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import { FileText, Send, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { PRTimelineEntry } from '@/types/purchase-requisition';

interface PRApprovalTimelineProps {
  prId: number;
  // Bumping this forces a refetch (e.g. after an approve/reject action).
  refreshKey?: number;
}

const TYPE_STYLES: Record<
  PRTimelineEntry['type'],
  { icon: React.ComponentType<{ className?: string }>; dot: string; iconColor: string }
> = {
  created: { icon: FileText, dot: 'bg-blue-100', iconColor: 'text-blue-600' },
  submitted: { icon: Send, dot: 'bg-indigo-100', iconColor: 'text-indigo-600' },
  approved: { icon: CheckCircle, dot: 'bg-green-100', iconColor: 'text-green-600' },
  rejected: { icon: XCircle, dot: 'bg-red-100', iconColor: 'text-red-600' },
  pending: { icon: Clock, dot: 'bg-amber-100', iconColor: 'text-amber-600' },
};

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PRApprovalTimeline({ prId, refreshKey = 0 }: PRApprovalTimelineProps) {
  const t = useTranslations('purchasing');
  const [entries, setEntries] = useState<PRTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/purchasing/requisitions/${prId}/history`);
        const result = await res.json();
        if (cancelled) return;
        if (result.success) {
          setEntries(result.data || []);
        } else {
          setError(result.error || t('requisitions.detail.timeline.loadError'));
        }
      } catch {
        if (!cancelled) setError(t('requisitions.detail.timeline.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [prId, refreshKey, t]);

  return (
    <div className="bg-white rounded-lg shadow p-4" data-testid="pr-approval-timeline">
      <h3 className="text-lg font-medium text-gray-800 mb-4">
        {t('requisitions.detail.timeline.title')}
      </h3>

      {loading ? (
        <div className="flex justify-center py-6">
          <LoadIndicator />
        </div>
      ) : error ? (
        <div className="text-sm text-red-600" data-testid="pr-timeline-error">{error}</div>
      ) : entries.length === 0 ? (
        <div className="text-sm text-gray-500" data-testid="pr-timeline-empty">
          {t('requisitions.detail.timeline.empty')}
        </div>
      ) : (
        <ol className="relative border-l border-gray-200 ml-3 space-y-6">
          {entries.map((entry, idx) => {
            const style = TYPE_STYLES[entry.type] ?? TYPE_STYLES.pending;
            const Icon = style.icon;
            const actor = entry.actorName?.trim() || t('requisitions.detail.timeline.noActor');
            return (
              <li key={idx} className="ml-6" data-testid={`pr-timeline-entry-${entry.type}`}>
                <span
                  className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-white ${style.dot}`}
                >
                  <Icon className={`h-3.5 w-3.5 ${style.iconColor}`} />
                </span>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium text-gray-900">
                    {t(`requisitions.detail.timeline.action.${entry.type}`)}
                    {entry.type === 'pending' ? ' ' : ' — '}
                    <span className="font-semibold" data-testid="pr-timeline-actor">{actor}</span>
                  </p>
                  {entry.delegatedFromName && (
                    <p className="text-xs text-gray-500">
                      {t('requisitions.detail.timeline.delegatedFrom', { name: entry.delegatedFromName })}
                    </p>
                  )}
                  {entry.actionDate && (
                    <p className="text-xs text-gray-400">{formatDateTime(entry.actionDate)}</p>
                  )}
                  {entry.comments && (
                    <p className="text-sm text-gray-600 mt-1 bg-gray-50 rounded px-2 py-1 whitespace-pre-wrap">
                      {entry.comments}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

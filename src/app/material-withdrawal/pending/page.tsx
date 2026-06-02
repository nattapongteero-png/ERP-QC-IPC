'use client';

/**
 * Material Withdrawal — Supervisor Pending Queue
 *
 * Lists requests pending approval. Click a card to open the detail dialog
 * with Approve / Reject buttons.
 *
 * Feature: 018-material-withdrawal-approval — User Story 2
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'devextreme-react/button';
import { Inbox, Clock, RefreshCw } from 'lucide-react';
import { MaterialWithdrawalDetailDialog } from '@/components/production/material-withdrawal-detail-dialog';
import { MaterialWithdrawalApprovalActions } from '@/components/production/material-withdrawal-approval-actions';
import type { MaterialWithdrawalRequestSummary } from '@/types/material-withdrawal';

export default function MaterialWithdrawalPendingPage() {
  const t = useTranslations('material-withdrawal');
  const [openId, setOpenId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useQuery<MaterialWithdrawalRequestSummary[]>({
    queryKey: ['material-withdrawal', 'pending'],
    queryFn: async () => {
      const res = await fetch('/api/material-withdrawal/pending');
      if (!res.ok) throw new Error('Failed to load pending queue');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const items = data ?? [];

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Inbox className="w-6 h-6" />
            {t('breadcrumbs.pending')}
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            {t('page.description')}
          </p>
        </div>
        <Button
          icon="refresh"
          text={t('buttons.refresh')}
          onClick={() => refetch()}
          render={() => (
            <span className="inline-flex items-center gap-1">
              <RefreshCw className="w-4 h-4" />
              {t('buttons.refresh')}
            </span>
          )}
        />
      </header>

      {/* Count summary */}
      <div className="rounded-md border bg-amber-50 px-4 py-3 text-amber-900 flex items-center gap-2">
        <Clock className="w-5 h-5" />
        <span className="font-medium">
          {items.length} {t('common.requests')}
        </span>
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="text-center py-10 text-gray-500">Loading...</div>
      ) : items.length === 0 ? (
        <div className="rounded-md border bg-white p-8 text-center text-gray-500">
          {/* Empty state */}
          ไม่มีคำขอรออนุมัติ
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((req) => (
            <PendingCard key={req.id} request={req} onOpen={() => setOpenId(req.id)} />
          ))}
        </div>
      )}

      <MaterialWithdrawalDetailDialog
        visible={openId !== null}
        requestId={openId}
        onClose={() => setOpenId(null)}
        actions={(detail) =>
          detail.status === 'pending' ? (
            <MaterialWithdrawalApprovalActions
              request={detail}
              onApproved={() => {
                setOpenId(null);
                refetch();
              }}
              onRejected={() => {
                setOpenId(null);
                refetch();
              }}
            />
          ) : null
        }
      />
    </div>
  );
}

function PendingCard({
  request,
  onOpen,
}: {
  request: MaterialWithdrawalRequestSummary;
  onOpen: () => void;
}) {
  const t = useTranslations('material-withdrawal');
  const ageMinutes = Math.floor(
    (Date.now() - new Date(request.requestedAt).getTime()) / 60000,
  );
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-md border bg-white p-4 hover:bg-gray-50 hover:border-blue-300 transition"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg">#{request.id}</span>
            <span className="text-sm text-gray-500">
              WO #{request.workOrderId}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
              <Clock className="w-3 h-3" />
              {t('status.pending')}
            </span>
          </div>
          <div className="text-sm text-gray-700 mt-1">
            {t(`form.reason.options.${request.reasonType}`)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {request.requestedBy.name} · {request.itemCount} {t('common.request')} ·{' '}
            {ageMinutes < 60
              ? `${ageMinutes} min ago`
              : `${Math.floor(ageMinutes / 60)} h ${ageMinutes % 60} min ago`}
          </div>
        </div>
        <div className="text-sm text-gray-400">→</div>
      </div>
    </button>
  );
}

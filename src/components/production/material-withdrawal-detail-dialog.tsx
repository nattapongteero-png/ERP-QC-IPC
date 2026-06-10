'use client';

/**
 * MaterialWithdrawalDetailDialog
 *
 * Read-only detail view of a withdrawal request. Reused by:
 *   - operator (own requests history)
 *   - supervisor (queue → drill-in before deciding)
 *   - QC (deviation → drill-back)
 */

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Popup } from 'devextreme-react/popup';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import { CheckCircle, Clock, XCircle, Ban, FileText } from 'lucide-react';
import type { MaterialWithdrawalRequestDetail, WithdrawalStatus } from '@/types/material-withdrawal';

export interface MaterialWithdrawalDetailDialogProps {
  visible: boolean;
  requestId: number | null;
  onClose: () => void;
  /** Optional action row (Approve / Reject / Cancel buttons). */
  actions?: (detail: MaterialWithdrawalRequestDetail) => React.ReactNode;
}

const STATUS_BADGE: Record<WithdrawalStatus, { className: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { className: 'bg-amber-100 text-amber-800', icon: Clock },
  approved: { className: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
  rejected: { className: 'bg-red-100 text-red-800', icon: XCircle },
  cancelled: { className: 'bg-gray-200 text-gray-800', icon: Ban },
};

export function MaterialWithdrawalDetailDialog({
  visible,
  requestId,
  onClose,
  actions,
}: MaterialWithdrawalDetailDialogProps) {
  const t = useTranslations('material-withdrawal');
  const tCommon = useTranslations('common');

  const { data, isLoading } = useQuery<MaterialWithdrawalRequestDetail>({
    queryKey: ['material-withdrawal', 'detail', requestId],
    queryFn: async () => {
      const res = await fetch(`/api/material-withdrawal/requests/${requestId}`);
      if (!res.ok) throw new Error('Failed to load request');
      return res.json();
    },
    enabled: visible && requestId !== null && requestId > 0,
    staleTime: 5000,
  });

  return (
    <Popup
      visible={visible}
      onHiding={onClose}
      showCloseButton
      title={`${t('common.request')} #${requestId ?? ''}`}
      width={720}
      height="auto"
      maxHeight="90vh"
    >
      <div className="p-4 space-y-4">
        {isLoading || !data ? (
          <div className="flex items-center justify-center py-12">
            <LoadIndicator />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              {(() => {
                const cfg = STATUS_BADGE[data.status];
                const Icon = cfg.icon;
                return (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${cfg.className}`}
                  >
                    <Icon className="w-4 h-4" />
                    {t(`status.${data.status}`)}
                  </span>
                );
              })()}
              <span className="text-sm text-gray-500">
                WO #{data.workOrderId}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-gray-500">{t('form.reason.label')}</dt>
              <dd className="font-medium">
                {t(`form.reason.options.${data.reasonType}`)}
                {data.machinePhase && (
                  <span className="text-gray-500 ml-1">
                    ({data.machinePhase})
                  </span>
                )}
              </dd>

              <dt className="text-gray-500">{t('table.columns.requestedBy')}</dt>
              <dd className="font-medium">{data.requestedBy.name}</dd>

              <dt className="text-gray-500">{t('table.columns.requestedAt')}</dt>
              <dd>{new Date(data.requestedAt).toLocaleString('th-TH')}</dd>

              {data.reasonDetail && (
                <>
                  <dt className="text-gray-500">{t('form.reasonDetail.label')}</dt>
                  <dd className="col-span-1">{data.reasonDetail}</dd>
                </>
              )}
            </dl>

            <section>
              <h3 className="font-semibold mb-2 flex items-center gap-1">
                <FileText className="w-4 h-4" />
                {t('common.requests')}
              </h3>
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-2 py-1">{t('table.columns.material')}</th>
                    <th className="px-2 py-1 text-right">{t('table.columns.quantityRequested')}</th>
                    <th className="px-2 py-1 text-right">คงเหลือในคลัง</th>
                    <th className="px-2 py-1 text-right">{t('table.columns.quantityApproved')}</th>
                    <th className="px-2 py-1">{t('form.unit.label')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it) => {
                    // Surface the stock shortfall before the approver clicks
                    // Approve (the server otherwise rejects with "only X
                    // available"). availableQty may be undefined on older data.
                    const available = it.availableQty;
                    const short =
                      available !== undefined && it.quantityRequested > available;
                    return (
                      <tr key={it.id} className="border-t">
                        <td className="px-2 py-1">
                          {it.materialName ? (
                            <div className="flex flex-col">
                              <span className="font-medium">{it.materialName}</span>
                              {it.materialCode && (
                                <span className="text-xs text-gray-500">{it.materialCode}</span>
                              )}
                            </div>
                          ) : (
                            `#${it.materialId}`
                          )}
                        </td>
                        <td className="px-2 py-1 text-right">{it.quantityRequested}</td>
                        <td
                          className={`px-2 py-1 text-right ${short ? 'text-rose-600 font-medium' : 'text-gray-700'}`}
                        >
                          {available === undefined ? '—' : available}
                          {short && (
                            <span className="block text-xs text-rose-600">ไม่พอ</span>
                          )}
                        </td>
                        <td className="px-2 py-1 text-right">{it.quantityApproved ?? '—'}</td>
                        <td className="px-2 py-1">{it.unit}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            {data.attachments.length > 0 && (
              <section>
                <h3 className="font-semibold mb-2">{t('form.attachments.label')}</h3>
                <ul className="space-y-1 text-sm">
                  {data.attachments.map((a) => (
                    <li key={a.id}>
                      <a
                        href={a.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {a.fileName}
                      </a>
                      <span className="text-gray-500 ml-2">
                        ({(a.sizeBytes / 1024).toFixed(1)} KB)
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.approval && (
              <section className="rounded-md border bg-gray-50 p-3 text-sm space-y-1">
                <div className="font-semibold">
                  {data.approval.action === 'approve'
                    ? t('toast.approved.success')
                    : t('toast.rejected.success')}
                </div>
                <div className="text-gray-700">
                  {new Date(data.approval.actionAt).toLocaleString('th-TH')}
                  {data.approval.approverName && ` — ${data.approval.approverName}`}
                </div>
                {data.approval.reason && (
                  <div className="text-gray-700">
                    <em>{data.approval.reason}</em>
                  </div>
                )}
              </section>
            )}

            <div className="flex justify-end gap-2 pt-2">
              {actions?.(data)}
              <Button text={tCommon('actions.close')} stylingMode="text" onClick={onClose} />
            </div>
          </>
        )}
      </div>
    </Popup>
  );
}

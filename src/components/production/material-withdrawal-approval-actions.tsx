'use client';

/**
 * MaterialWithdrawalApprovalActions
 *
 * Approve / Reject buttons + E-signature flow for a pending withdrawal request.
 * Reuses ElectronicSignatureDialog from src/components/shared.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from 'devextreme-react/button';
import { TextArea } from 'devextreme-react/text-area';
import { Popup } from 'devextreme-react/popup';
import { ElectronicSignatureDialog } from '@/components/shared/ElectronicSignatureDialog';
import type { MaterialWithdrawalRequestDetail } from '@/types/material-withdrawal';

export interface MaterialWithdrawalApprovalActionsProps {
  request: MaterialWithdrawalRequestDetail;
  onApproved?: () => void;
  onRejected?: () => void;
  onError?: (message: string) => void;
}

export function MaterialWithdrawalApprovalActions({
  request,
  onApproved,
  onRejected,
  onError,
}: MaterialWithdrawalApprovalActionsProps) {
  const t = useTranslations('material-withdrawal');
  const qc = useQueryClient();

  const [showApproveSig, setShowApproveSig] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectSig, setShowRejectSig] = useState(false);

  const approveMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await fetch(
        `/api/material-withdrawal/requests/${request.id}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        },
      );
      const body = await res.json();
      if (!res.ok) {
        const code = body?.code ?? 'UNKNOWN';
        const msg = (() => {
          switch (code) {
            case 'DUAL_CONTROL_VIOLATION':
              return t('errors.dualControl');
            case 'INVALID_PASSWORD':
              return t('errors.invalidPassword');
            case 'INSUFFICIENT_STOCK':
              return t('errors.insufficientStock');
            case 'REQUEST_NOT_PENDING':
              return t('errors.requestNotPending');
            default:
              return body?.error ?? t('toast.error.generic');
          }
        })();
        throw new Error(msg);
      }
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['material-withdrawal'] });
      qc.invalidateQueries({ queryKey: ['blocked-phases'] });
      setShowApproveSig(false);
      onApproved?.();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ reason, password }: { reason: string; password: string }) => {
      const res = await fetch(
        `/api/material-withdrawal/requests/${request.id}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason, password }),
        },
      );
      const body = await res.json();
      if (!res.ok) {
        const code = body?.code ?? 'UNKNOWN';
        const msg = (() => {
          switch (code) {
            case 'DUAL_CONTROL_VIOLATION':
              return t('errors.dualControl');
            case 'INVALID_PASSWORD':
              return t('errors.invalidPassword');
            case 'REQUEST_NOT_PENDING':
              return t('errors.requestNotPending');
            default:
              return body?.error ?? t('toast.error.generic');
          }
        })();
        throw new Error(msg);
      }
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['material-withdrawal'] });
      qc.invalidateQueries({ queryKey: ['blocked-phases'] });
      setShowRejectSig(false);
      setShowRejectModal(false);
      setRejectReason('');
      onRejected?.();
    },
  });

  if (request.status !== 'pending') return null;

  return (
    <>
      <Button
        text={t('buttons.reject')}
        type="danger"
        stylingMode="outlined"
        onClick={() => setShowRejectModal(true)}
      />
      <Button
        text={t('buttons.approve')}
        type="success"
        stylingMode="contained"
        onClick={() => setShowApproveSig(true)}
      />

      {/* Approve E-sig */}
      <ElectronicSignatureDialog
        visible={showApproveSig}
        title={t('approval.approveTitle')}
        action="approve"
        meaning="I approve this additional material withdrawal request."
        onSign={async (password) => {
          try {
            await approveMutation.mutateAsync(password);
            return { success: true };
          } catch (e) {
            const msg = e instanceof Error ? e.message : t('toast.error.generic');
            onError?.(msg);
            return { success: false, error: msg };
          }
        }}
        onCancel={() => setShowApproveSig(false)}
        isLoading={approveMutation.isPending}
      />

      {/* Reject reason popup */}
      <Popup
        visible={showRejectModal}
        onHiding={() => setShowRejectModal(false)}
        showCloseButton
        title={t('approval.rejectTitle')}
        width={480}
        height="auto"
      >
        <div className="p-4 space-y-3">
          <label className="block text-sm font-medium">
            {t('approval.rejectReason.label')}
          </label>
          <TextArea
            value={rejectReason}
            height={120}
            placeholder={t('approval.rejectReason.placeholder')}
            onValueChanged={(e) => setRejectReason(String(e.value ?? ''))}
          />
          <div className="flex justify-end gap-2">
            <Button
              text={t('buttons.cancel')}
              stylingMode="text"
              onClick={() => setShowRejectModal(false)}
            />
            <Button
              text={t('buttons.reject')}
              type="danger"
              stylingMode="contained"
              disabled={rejectReason.trim().length < 10}
              onClick={() => setShowRejectSig(true)}
            />
          </div>
        </div>
      </Popup>

      {/* Reject E-sig */}
      <ElectronicSignatureDialog
        visible={showRejectSig}
        title={t('approval.rejectTitle')}
        action="reject"
        meaning="I reject this material withdrawal request."
        onSign={async (password) => {
          try {
            await rejectMutation.mutateAsync({ reason: rejectReason.trim(), password });
            return { success: true };
          } catch (e) {
            const msg = e instanceof Error ? e.message : t('toast.error.generic');
            onError?.(msg);
            return { success: false, error: msg };
          }
        }}
        onCancel={() => setShowRejectSig(false)}
        isLoading={rejectMutation.isPending}
      />
    </>
  );
}

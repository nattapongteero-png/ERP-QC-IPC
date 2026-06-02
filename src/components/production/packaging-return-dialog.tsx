'use client';

/**
 * Operator form to create a Packaging Return for an existing Issuance.
 * Feature 019, US2
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Popup } from 'devextreme-react/popup';
import { Button } from 'devextreme-react/button';
import { NumberBox } from 'devextreme-react/number-box';
import { TextBox } from 'devextreme-react/text-box';
import { TextArea } from 'devextreme-react/text-area';
import { SelectBox } from 'devextreme-react/select-box';
import { AlertTriangle, Undo2 } from 'lucide-react';
import type {
  CreateReturnInput,
  ReturnDetail,
  ProposedReturnStatus,
  VarianceReason,
  IssuanceDetail,
} from '@/types/packaging';
import { VARIANCE_REASONS, PROPOSED_RETURN_STATUSES } from '@/types/packaging';

export interface PackagingReturnDialogProps {
  visible: boolean;
  onClose: () => void;
  workOrderId: number;
  issuance: IssuanceDetail | null;
  onSubmitted?: (detail: ReturnDetail) => void;
}

interface FormState {
  usedQty: number;
  returnQty: number;
  varianceReason: VarianceReason;
  varianceExplanation: string;
  returnContainerLabel: string;
  proposedStatus: ProposedReturnStatus;
}

const initial: FormState = {
  usedQty: 0,
  returnQty: 0,
  varianceReason: 'sampling',
  varianceExplanation: '',
  returnContainerLabel: '',
  proposedStatus: 'reusable',
};

export function PackagingReturnDialog({
  visible,
  onClose,
  workOrderId,
  issuance,
  onSubmitted,
}: PackagingReturnDialogProps) {
  const t = useTranslations('packaging');
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setForm(initial);
      setError(null);
    }
  }, [visible]);

  const issuedQty = issuance?.quantity ?? 0;
  const variance = useMemo(
    () => Math.max(0, issuedQty - form.usedQty - form.returnQty),
    [issuedQty, form.usedQty, form.returnQty],
  );

  const submitMut = useMutation({
    mutationFn: async (payload: CreateReturnInput) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/packaging-returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        const code = body?.code ?? 'UNKNOWN';
        const msg = (() => {
          switch (code) {
            case 'USED_EXCEEDS_ISSUED':
              return t('errors.usedExceedsIssued', {
                used: body?.details?.used ?? form.usedQty,
                issued: body?.details?.issued ?? issuedQty,
              });
            case 'LOT_REJECTED_MUST_REJECT':
              return t('errors.lotRejectedMustReject');
            case 'VARIANCE_EXPLANATION_REQUIRED':
              return t('errors.varianceExplanationRequired');
            default:
              return body?.error ?? t('toast.error.generic');
          }
        })();
        throw new Error(msg);
      }
      return body as ReturnDetail;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['packaging-returns', workOrderId] });
      onSubmitted?.(data);
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = () => {
    setError(null);
    if (!issuance) return;
    if (!form.returnContainerLabel.trim()) {
      setError(t('errors.containerLabelRequired'));
      return;
    }
    submitMut.mutate({
      woPackagingMaterialId: issuance.id,
      usedQty: form.usedQty,
      returnQty: form.returnQty,
      varianceReason: form.varianceReason,
      varianceExplanation: form.varianceExplanation.trim() || undefined,
      returnContainerLabel: form.returnContainerLabel.trim(),
      proposedStatus: form.proposedStatus,
    });
  };

  return (
    <Popup
      visible={visible}
      onHiding={onClose}
      showCloseButton
      title={`${t('form.return.title')}${issuance ? ` — ${issuance.itemName ?? `#${issuance.itemId}`}` : ''}`}
      width={640}
      height="auto"
      maxHeight="90vh"
    >
      <div className="p-4 space-y-3">
        {issuance && (
          <div className="rounded-md bg-blue-50 text-blue-900 px-3 py-2 text-sm">
            <strong>Issued: {issuance.quantity} {issuance.unit}</strong>
            {issuance.containerLabel && (
              <> · Container: <code>{issuance.containerLabel}</code></>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.usedQty.label')} *</label>
            <NumberBox
              value={form.usedQty}
              min={0}
              max={issuedQty}
              step={1}
              showSpinButtons
              onValueChanged={(e) => setForm({ ...form, usedQty: Number(e.value ?? 0) })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.returnQty.label')} *</label>
            <NumberBox
              value={form.returnQty}
              min={0}
              max={Math.max(0, issuedQty - form.usedQty)}
              step={1}
              showSpinButtons
              onValueChanged={(e) => setForm({ ...form, returnQty: Number(e.value ?? 0) })}
            />
          </div>
        </div>

        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t('form.variance.label')}: <strong>{variance}</strong> {issuance?.unit ?? ''}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            {t('form.varianceReason.label')} *
          </label>
          <SelectBox
            dataSource={VARIANCE_REASONS.map((r) => ({
              value: r,
              label: t(`form.varianceReason.options.${r}`),
            }))}
            displayExpr="label"
            valueExpr="value"
            value={form.varianceReason}
            onValueChanged={(e) => setForm({ ...form, varianceReason: e.value as VarianceReason })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            {t('form.varianceExplanation.label')}
          </label>
          <TextArea
            value={form.varianceExplanation}
            height={60}
            placeholder={t('form.varianceExplanation.placeholder')}
            onValueChanged={(e) =>
              setForm({ ...form, varianceExplanation: String(e.value ?? '') })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            {t('form.returnContainerLabel.label')} *
          </label>
          <TextBox
            value={form.returnContainerLabel}
            onValueChanged={(e) =>
              setForm({ ...form, returnContainerLabel: String(e.value ?? '') })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            {t('form.proposedStatus.label')} *
          </label>
          <SelectBox
            dataSource={PROPOSED_RETURN_STATUSES.map((s) => ({
              value: s,
              label: t(`form.proposedStatus.options.${s}`),
            }))}
            displayExpr="label"
            valueExpr="value"
            value={form.proposedStatus}
            onValueChanged={(e) =>
              setForm({ ...form, proposedStatus: e.value as ProposedReturnStatus })
            }
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button text={t('buttons.cancel')} onClick={onClose} stylingMode="text" />
          <Button
            type="default"
            stylingMode="contained"
            onClick={handleSubmit}
            disabled={submitMut.isPending}
            render={() => (
              <span className="inline-flex items-center gap-1">
                <Undo2 className="w-4 h-4" />
                {t('buttons.return')}
              </span>
            )}
          />
        </div>
      </div>
    </Popup>
  );
}

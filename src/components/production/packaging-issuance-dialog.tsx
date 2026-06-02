'use client';

/**
 * Operator form to create a new Packaging Issuance.
 * Feature 019, US1
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Popup } from 'devextreme-react/popup';
import { Button } from 'devextreme-react/button';
import { NumberBox } from 'devextreme-react/number-box';
import { TextBox } from 'devextreme-react/text-box';
import { SelectBox } from 'devextreme-react/select-box';
import { AlertTriangle, Send } from 'lucide-react';
import type { CreateIssuanceInput, IssuanceDetail } from '@/types/packaging';

interface BomPackagingOption {
  itemId: number;
  itemName: string;
  unit: string;
}

interface LotOption {
  id: number;
  lotNumber: string;
  quantity: number;
}

interface RoomOption {
  id: number;
  name: string;
}

export interface PackagingIssuanceDialogProps {
  visible: boolean;
  onClose: () => void;
  workOrderId: number;
  bomOptions: BomPackagingOption[];
  lots: LotOption[];
  rooms: RoomOption[];
  onSubmitted?: (detail: IssuanceDetail) => void;
}

interface FormState {
  itemId: number | null;
  sourceLotId: number | null;
  quantity: number;
  containerLabel: string;
  roomId: number | null;
}

const initial: FormState = {
  itemId: null,
  sourceLotId: null,
  quantity: 0,
  containerLabel: '',
  roomId: null,
};

export function PackagingIssuanceDialog({
  visible,
  onClose,
  workOrderId,
  bomOptions,
  lots,
  rooms,
  onSubmitted,
}: PackagingIssuanceDialogProps) {
  const t = useTranslations('packaging');
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(initial);
  const [error, setError] = useState<string | null>(null);

  const submitMut = useMutation({
    mutationFn: async (payload: CreateIssuanceInput) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/packaging-issuances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        const code = body?.code ?? 'UNKNOWN';
        const msg = (() => {
          switch (code) {
            case 'INSUFFICIENT_STOCK':
              return t('errors.insufficientStock', {
                available: body?.details?.available ?? '',
                requested: body?.details?.requested ?? '',
              });
            case 'MATERIAL_NOT_IN_BOM':
              return t('errors.materialNotInBom');
            case 'NOT_PACKAGING_TYPE':
              return t('errors.notPackagingType');
            case 'CONTAINER_LABEL_REQUIRED':
              return t('errors.containerLabelRequired');
            default:
              return body?.error ?? t('toast.error.generic');
          }
        })();
        throw new Error(msg);
      }
      return body as { issuance: IssuanceDetail; containerLabelWarning: boolean };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['packaging-issuances', workOrderId] });
      onSubmitted?.(data.issuance);
      setForm(initial);
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = () => {
    setError(null);
    if (!form.itemId || !form.sourceLotId || !form.roomId || form.quantity <= 0) {
      setError('กรอกข้อมูลให้ครบ');
      return;
    }
    if (!form.containerLabel.trim()) {
      setError(t('errors.containerLabelRequired'));
      return;
    }
    submitMut.mutate({
      itemId: form.itemId,
      sourceLotId: form.sourceLotId,
      quantity: form.quantity,
      containerLabel: form.containerLabel.trim(),
      roomId: form.roomId,
    });
  };

  return (
    <Popup
      visible={visible}
      onHiding={onClose}
      showCloseButton
      title={t('form.issuance.title')}
      width={560}
      height="auto"
      maxHeight="90vh"
    >
      <div className="p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">
            {t('form.material.label')} *
          </label>
          <SelectBox
            dataSource={bomOptions}
            displayExpr={(o: BomPackagingOption | null) => (o ? `${o.itemName} (${o.unit})` : '')}
            valueExpr="itemId"
            value={form.itemId}
            placeholder={t('form.material.placeholder')}
            onValueChanged={(e) => setForm({ ...form, itemId: e.value })}
            searchEnabled
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('form.sourceLot.label')} *</label>
          <SelectBox
            dataSource={lots}
            displayExpr={(l: LotOption | null) => (l ? `${l.lotNumber} (คงเหลือ ${l.quantity})` : '')}
            valueExpr="id"
            value={form.sourceLotId}
            placeholder={t('form.sourceLot.placeholder')}
            onValueChanged={(e) => setForm({ ...form, sourceLotId: e.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('form.quantity.label')} *</label>
          <NumberBox
            value={form.quantity}
            min={1}
            step={1}
            showSpinButtons
            onValueChanged={(e) => setForm({ ...form, quantity: Number(e.value ?? 0) })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            {t('form.containerLabel.label')} *
          </label>
          <TextBox
            value={form.containerLabel}
            placeholder={t('form.containerLabel.placeholder')}
            onValueChanged={(e) => setForm({ ...form, containerLabel: String(e.value ?? '') })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('form.room.label')} *</label>
          <SelectBox
            dataSource={rooms}
            displayExpr="name"
            valueExpr="id"
            value={form.roomId}
            onValueChanged={(e) => setForm({ ...form, roomId: e.value })}
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
                <Send className="w-4 h-4" />
                {t('buttons.issue')}
              </span>
            )}
          />
        </div>
      </div>
    </Popup>
  );
}

'use client';

/**
 * MaterialWithdrawalRequestDialog
 *
 * Operator-facing dialog for requesting additional raw material withdrawal
 * (machine setup loss, trial run, parameter adjustment, etc.). Sits inside
 * the Work Order detail page.
 *
 * Feature: 018-material-withdrawal-approval — User Story 1
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Popup } from 'devextreme-react/popup';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import { NumberBox } from 'devextreme-react/number-box';
import { TextBox } from 'devextreme-react/text-box';
import { TextArea } from 'devextreme-react/text-area';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import { AlertTriangle, Send } from 'lucide-react';
import type {
  CreateMaterialWithdrawalRequestInput,
  MaterialWithdrawalRequestDetail,
  WithdrawalReasonType,
} from '@/types/material-withdrawal';
import { WITHDRAWAL_REASON_TYPES } from '@/types/material-withdrawal';

export interface BomMaterialOption {
  itemId: number;
  itemName: string;
  unit: string;
  plannedQuantity: number;
  alreadyExtra: number;
}

export interface RoomOption {
  id: number;
  name: string;
}

export interface MaterialWithdrawalRequestDialogProps {
  visible: boolean;
  onClose: () => void;
  workOrderId: number;
  workOrderNumber?: string;
  factoryCode?: string | null;
  bomMaterials: BomMaterialOption[];
  rooms: RoomOption[];
  onSubmitted?: (request: MaterialWithdrawalRequestDetail) => void;
  onError?: (message: string) => void;
}

const REASON_KEYS: WithdrawalReasonType[] = [...WITHDRAWAL_REASON_TYPES];

interface FormState {
  materialId: number | null;
  quantity: number;
  unit: string;
  reasonType: WithdrawalReasonType;
  reasonDetail: string;
  machinePhase: string;
  roomId: number | null;
}

const initialState: FormState = {
  materialId: null,
  quantity: 0,
  unit: '',
  reasonType: 'machine_setup_loss',
  reasonDetail: '',
  machinePhase: '',
  roomId: null,
};

export function MaterialWithdrawalRequestDialog({
  visible,
  onClose,
  workOrderId,
  workOrderNumber,
  factoryCode,
  bomMaterials,
  rooms,
  onSubmitted,
  onError,
}: MaterialWithdrawalRequestDialogProps) {
  const t = useTranslations('material-withdrawal');
  const tCommon = useTranslations('common');
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(initialState);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setForm({ ...initialState, roomId: rooms[0]?.id ?? null });
      setValidationError(null);
    }
  }, [visible, rooms]);

  const selectedMaterial = useMemo(
    () => bomMaterials.find((m) => m.itemId === form.materialId) ?? null,
    [bomMaterials, form.materialId],
  );

  const submitMutation = useMutation({
    mutationFn: async (payload: CreateMaterialWithdrawalRequestInput) => {
      const response = await fetch('/api/material-withdrawal/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        const code = body?.code ?? 'UNKNOWN';
        const message = (() => {
          switch (code) {
            case 'EXCEEDS_HARD_CAP':
              return t('errors.exceedHardCap', {
                percent: body?.details?.hardCapPercent ?? '',
              });
            case 'MATERIAL_NOT_IN_BOM':
              return t('errors.materialNotInBom');
            case 'DUPLICATE_SUBMISSION':
              return t('errors.duplicate');
            case 'PHASE_REQUIRED':
              return t('errors.phaseRequired');
            case 'REASON_DETAIL_REQUIRED':
              return t('errors.reasonDetailRequired');
            default:
              return body?.error ?? t('toast.error.generic');
          }
        })();
        throw new Error(message);
      }
      return body as MaterialWithdrawalRequestDetail;
    },
    onSuccess: (detail) => {
      qc.invalidateQueries({ queryKey: ['material-withdrawal'] });
      qc.invalidateQueries({ queryKey: ['blocked-phases', workOrderId] });
      onSubmitted?.(detail);
      onClose();
    },
    onError: (error: Error) => {
      onError?.(error.message);
    },
  });

  const handleSubmit = useCallback(() => {
    setValidationError(null);
    if (!form.materialId) {
      setValidationError(t('form.material.label') + ' ?');
      return;
    }
    if (!form.unit) {
      setValidationError(t('form.unit.label') + ' ?');
      return;
    }
    if (form.quantity <= 0) {
      setValidationError(t('form.quantity.label'));
      return;
    }
    if (!form.roomId) {
      setValidationError(t('form.room.label') + ' ?');
      return;
    }
    if (form.reasonType === 'machine_setup_loss' && !form.machinePhase.trim()) {
      setValidationError(t('errors.phaseRequired'));
      return;
    }
    if (form.reasonType === 'other' && form.reasonDetail.trim().length < 3) {
      setValidationError(t('errors.reasonDetailRequired'));
      return;
    }
    submitMutation.mutate({
      workOrderId,
      factoryCode: factoryCode ?? null,
      items: [
        {
          materialId: form.materialId,
          quantityRequested: form.quantity,
          unit: form.unit,
        },
      ],
      reasonType: form.reasonType,
      reasonDetail: form.reasonDetail.trim() || undefined,
      machinePhase: form.machinePhase.trim() || undefined,
      roomId: form.roomId,
    });
  }, [form, factoryCode, submitMutation, t, workOrderId]);

  return (
    <Popup
      visible={visible}
      onHiding={onClose}
      title={`${t('form.title')}${workOrderNumber ? ` — ${workOrderNumber}` : ''}`}
      showCloseButton
      width={620}
      height="auto"
      maxHeight="90vh"
      dragEnabled
    >
      <div className="p-4 space-y-4">
        {/* Material */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {t('form.material.label')} <span className="text-red-500">*</span>
          </label>
          <SelectBox
            dataSource={bomMaterials}
            displayExpr={(item: BomMaterialOption | null) =>
              item ? `${item.itemName} (planned: ${item.plannedQuantity} ${item.unit})` : ''
            }
            valueExpr="itemId"
            value={form.materialId}
            placeholder={t('form.material.placeholder')}
            searchEnabled
            onValueChanged={(e) => {
              const m = bomMaterials.find((x) => x.itemId === e.value) ?? null;
              setForm((prev) => ({
                ...prev,
                materialId: e.value,
                unit: m?.unit ?? prev.unit,
              }));
            }}
          />
        </div>

        {/* Quantity + Unit */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('form.quantity.label')} <span className="text-red-500">*</span>
            </label>
            <NumberBox
              value={form.quantity}
              min={0}
              step={0.1}
              showSpinButtons
              onValueChanged={(e) =>
                setForm((prev) => ({ ...prev, quantity: Number(e.value ?? 0) }))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('form.unit.label')}
            </label>
            <TextBox
              value={form.unit}
              onValueChanged={(e) =>
                setForm((prev) => ({ ...prev, unit: String(e.value ?? '') }))
              }
            />
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {t('form.reason.label')} <span className="text-red-500">*</span>
          </label>
          <SelectBox
            dataSource={REASON_KEYS.map((k) => ({
              value: k,
              label: t(`form.reason.options.${k}`),
            }))}
            displayExpr="label"
            valueExpr="value"
            value={form.reasonType}
            onValueChanged={(e) =>
              setForm((prev) => ({ ...prev, reasonType: e.value as WithdrawalReasonType }))
            }
          />
        </div>

        {/* Conditional: Machine Phase (for setup loss) */}
        {form.reasonType === 'machine_setup_loss' && (
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('form.machinePhase.label')} <span className="text-red-500">*</span>
            </label>
            <TextBox
              value={form.machinePhase}
              placeholder={t('form.machinePhase.placeholder')}
              onValueChanged={(e) =>
                setForm((prev) => ({ ...prev, machinePhase: String(e.value ?? '') }))
              }
            />
          </div>
        )}

        {/* Conditional: Reason detail (for "other") */}
        {form.reasonType === 'other' && (
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('form.reasonDetail.label')} <span className="text-red-500">*</span>
            </label>
            <TextArea
              value={form.reasonDetail}
              height={80}
              placeholder={t('form.reasonDetail.placeholder')}
              onValueChanged={(e) =>
                setForm((prev) => ({ ...prev, reasonDetail: String(e.value ?? '') }))
              }
            />
          </div>
        )}

        {/* Free-text detail when reason is not "other" (optional) */}
        {form.reasonType !== 'other' && (
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-600">
              {t('form.reasonDetail.label')}
            </label>
            <TextArea
              value={form.reasonDetail}
              height={60}
              placeholder={t('form.reasonDetail.placeholder')}
              onValueChanged={(e) =>
                setForm((prev) => ({ ...prev, reasonDetail: String(e.value ?? '') }))
              }
            />
          </div>
        )}

        {/* Room */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {t('form.room.label')} <span className="text-red-500">*</span>
          </label>
          <SelectBox
            dataSource={rooms}
            displayExpr="name"
            valueExpr="id"
            value={form.roomId}
            onValueChanged={(e) => setForm((prev) => ({ ...prev, roomId: e.value }))}
          />
        </div>

        {/* Cap projection hint */}
        {selectedMaterial && form.quantity > 0 && selectedMaterial.plannedQuantity > 0 && (
          (() => {
            const projected =
              ((selectedMaterial.alreadyExtra + form.quantity) /
                selectedMaterial.plannedQuantity) *
              100;
            const isHigh = projected > 10;
            return (
              <div
                className={`flex items-start gap-2 rounded-md p-3 text-sm ${
                  isHigh ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'
                }`}
              >
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  ปริมาณรวมที่ขอเบิกเพิ่ม ~{' '}
                  <strong>{projected.toFixed(1)}%</strong> ของ BOM
                  {isHigh && ' (เกิน soft cap — ระบบจะแจ้งเตือนผู้อนุมัติเป็นพิเศษ)'}
                </div>
              </div>
            );
          })()
        )}

        {validationError && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {validationError}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            text={tCommon('actions.cancel')}
            onClick={onClose}
            disabled={submitMutation.isPending}
            stylingMode="text"
          />
          <Button
            type="default"
            stylingMode="contained"
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            render={() => (
              <span className="inline-flex items-center gap-1">
                {submitMutation.isPending ? (
                  <LoadIndicator height={16} width={16} />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {t('form.submit')}
              </span>
            )}
          />
        </div>
      </div>
    </Popup>
  );
}

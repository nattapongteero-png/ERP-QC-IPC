'use client';

/**
 * Supplementary Requisition Request Dialog
 *
 * Operator-facing dialog for requesting additional materials mid-production.
 * Auto-creates a linked Deviation record on submit (PIC/S GMP 6.32).
 */

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatNumber } from '@/lib/utils/number-format';
import { REASON_CATEGORIES, type ReasonCategory } from '@/types/supplementary-requisition';

// Maps DB enum → i18n key under 'production.supplementaryRequisition.reason'
const REASON_KEY: Record<ReasonCategory, string> = {
  damage: 'damage',
  spillage: 'spillage',
  contamination: 'contamination',
  weighing_loss: 'weighingLoss',
  machine_setup_loss: 'machineSetupLoss',
  equipment_failure: 'equipmentFailure',
  operator_error: 'operatorError',
  other: 'other',
};

export interface SupplementaryMaterialOption {
  itemId: number;
  itemCode: string;
  itemName: string;
  unit: string;
  // Used to compute threshold preview
  plannedQty: number;
  // From workOrderMaterials.id — preserved so the server can link the
  // supplementary line back to the BOM-derived requirement row.
  originalMaterialId?: number;
}

interface LineDraft {
  itemId: number | null;
  requestedQuantity: number;
  // captured at row time so we can persist it
  unit: string;
  originalMaterialId?: number;
}

interface Props {
  visible: boolean;
  onHide: () => void;
  workOrderId: number;
  availableMaterials: SupplementaryMaterialOption[];
  onSubmitted: () => void;
}

export function SupplementaryRequisitionDialog({
  visible,
  onHide,
  workOrderId,
  availableMaterials,
  onSubmitted,
}: Props) {
  const toast = useToast();
  const t = useTranslations('production.supplementaryRequisition');
  const [reasonCategory, setReasonCategory] = useState<ReasonCategory>('damage');
  const [reasonDetail, setReasonDetail] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([
    { itemId: null, requestedQuantity: 0, unit: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const materialById = useMemo(() => {
    const m = new Map<number, SupplementaryMaterialOption>();
    for (const x of availableMaterials) m.set(x.itemId, x);
    return m;
  }, [availableMaterials]);

  const addLine = () => setLines((prev) => [...prev, { itemId: null, requestedQuantity: 0, unit: '' }]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const updateItem = (i: number, itemId: number) => {
    const mat = materialById.get(itemId);
    setLines((prev) =>
      prev.map((l, idx) =>
        idx === i
          ? { ...l, itemId, unit: mat?.unit || '', originalMaterialId: mat?.originalMaterialId }
          : l
      )
    );
  };
  const updateQty = (i: number, qty: number) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, requestedQuantity: qty } : l)));

  // Threshold preview — informs user what severity their request triggers
  const thresholdPreview = useMemo(() => {
    let maxRatio = 0;
    for (const line of lines) {
      if (!line.itemId || !line.requestedQuantity) continue;
      const baseline = materialById.get(line.itemId)?.plannedQty || 0;
      if (baseline <= 0) continue;
      const ratio = (line.requestedQuantity / baseline) * 100;
      if (ratio > maxRatio) maxRatio = ratio;
    }
    if (maxRatio === 0) return { level: 'none' as const, ratio: 0 };
    if (maxRatio > 5) return { level: 'high' as const, ratio: maxRatio };
    if (maxRatio >= 2) return { level: 'medium' as const, ratio: maxRatio };
    return { level: 'low' as const, ratio: maxRatio };
  }, [lines, materialById]);

  const canSubmit =
    !submitting &&
    reasonDetail.trim().length >= 10 &&
    lines.length > 0 &&
    lines.every((l) => l.itemId && l.requestedQuantity > 0 && l.unit);

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error(t('toast.formIncomplete'), t('toast.formIncompleteDetail'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/production/supplementary-requisitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workOrderId,
          reasonCategory,
          reasonDetail: reasonDetail.trim(),
          lines: lines.map((l) => ({
            itemId: l.itemId,
            requestedQuantity: l.requestedQuantity,
            unit: l.unit,
            originalMaterialId: l.originalMaterialId ?? null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || t('toast.submitError'));
      toast.success(
        t('toast.submitSuccess'),
        t('toast.submitSuccessDetail', { requestNo: data.data.requestNo, deviationId: data.data.deviationId }),
      );
      // Reset
      setReasonCategory('damage');
      setReasonDetail('');
      setLines([{ itemId: null, requestedQuantity: 0, unit: '' }]);
      onSubmitted();
      onHide();
    } catch (e) {
      toast.error(t('toast.submitError'), e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DxPopup
      visible={visible}
      onHiding={onHide}
      title={`${t('actions.request')} (Supplementary Requisition)`}
      width={800}
      height="auto"
      showCloseButton
    >
      <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto" data-testid="supplementary-req-dialog">
        {/* GMP notice */}
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm flex gap-2">
          <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800">{t('gmpNotice.deviationTitle')}</p>
            <p className="text-blue-700 text-xs mt-1">{t('gmpNotice.deviationBody')}</p>
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium mb-1">{t('reason.label')} <span className="text-red-500">*</span></label>
          <select
            className="w-full border rounded px-3 py-2"
            value={reasonCategory}
            onChange={(e) => setReasonCategory(e.target.value as ReasonCategory)}
            data-testid="reason-category"
          >
            {REASON_CATEGORIES.map((r) => (
              <option key={r} value={r}>{t(`reason.${REASON_KEY[r]}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            {t('reason.detailLabel')} <span className="text-red-500">*</span>
            <span className="text-xs text-gray-500 ml-2">{t('reason.detailHint')}</span>
          </label>
          <DxTextArea
            value={reasonDetail}
            onValueChanged={(e) => setReasonDetail(e.value || '')}
            height={80}
            placeholder={t('reason.detailPlaceholder')}
          />
        </div>

        {/* Lines */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">{t('form.materialListLabel')}</label>
            <DxButton text={t('actions.addLine')} icon="add" onClick={addLine} stylingMode="outlined" />
          </div>
          <div className="border rounded overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">{t('table.material')}</th>
                  <th className="px-3 py-2 text-right w-32">{t('table.qty')}</th>
                  <th className="px-3 py-2 text-left w-20">{t('table.unit')}</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">
                      <select
                        className="w-full border rounded px-2 py-1"
                        value={line.itemId ?? ''}
                        onChange={(e) => updateItem(i, parseInt(e.target.value, 10))}
                        data-testid={`line-item-${i}`}
                      >
                        <option value="">{t('form.selectMaterial')}</option>
                        {availableMaterials.map((m) => (
                          <option key={m.itemId} value={m.itemId}>
                            {m.itemCode} — {m.itemName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <DxNumberBox
                        value={line.requestedQuantity}
                        min={0}
                        step={0.01}
                        onValueChanged={(e) => updateQty(i, Number(e.value) || 0)}
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-600">{line.unit || '—'}</td>
                    <td className="px-3 py-2">
                      {lines.length > 1 && (
                        <button
                          className="text-red-500 hover:text-red-700"
                          onClick={() => removeLine(i)}
                          title={t('actions.removeLine')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Threshold preview */}
        {thresholdPreview.level !== 'none' && (
          <div
            className={
              thresholdPreview.level === 'high'
                ? 'bg-red-50 border border-red-200 text-red-800 rounded p-3 text-sm'
                : thresholdPreview.level === 'medium'
                ? 'bg-amber-50 border border-amber-200 text-amber-800 rounded p-3 text-sm'
                : 'bg-green-50 border border-green-200 text-green-800 rounded p-3 text-sm'
            }
          >
            {t('threshold.label')}: <strong>{t(`threshold.${thresholdPreview.level}`)}</strong> ({formatNumber(thresholdPreview.ratio, 1)}%)
            {thresholdPreview.level === 'high' && (
              <div className="text-xs mt-1">⚠️ {t('threshold.highWarning')}</div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <DxButton text={t('actions.cancel')} stylingMode="outlined" onClick={onHide} disabled={submitting} />
          <DxButton
            text={submitting ? t('actions.submitting') : t('actions.submit')}
            type="default"
            stylingMode="contained"
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid="submit-supplementary"
          />
        </div>
      </div>
    </DxPopup>
  );
}

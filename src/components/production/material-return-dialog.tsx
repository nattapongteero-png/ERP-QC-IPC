'use client';

/**
 * MaterialReturnDialog
 *
 * Operator-facing dialog for "Return Excess" raw material per design §6.1.
 * Renders inside the Material Weighing page when the operator clicks
 * "คืนของเหลือ" on a row that has weighedAt set.
 *
 * Submits to POST /api/inventory/returns. Server validates again, but we
 * perform client-side checks (usedQty <= issuedQty, returnQty <= issuedQty - usedQty)
 * so the operator gets immediate feedback.
 */

import { useEffect, useMemo, useState } from 'react';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxButton } from '@/components/ui/dx-button';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxSelectBox } from '@/components/ui/dx-select-box';

export type VarianceReason =
  | 'process_loss'
  | 'sampling'
  | 'spillage'
  | 'cleaning'
  | 'measurement_error'
  | 'unaccounted'
  | 'other';

export type ContainerType = 'bag' | 'drum' | 'bottle' | 'other';

export interface MaterialReturnSourceMaterial {
  /** WO material row id (used for cache invalidation hints) */
  workOrderMaterialId: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  unit: string;
  plannedQty: number;
  weighedQty: number;
  /** Source lot id — required to attribute the return correctly. */
  lotId: number | null;
  lotNumber: string | null;
  /** Source lot's warehouse — used as default receiving warehouse. */
  lotWarehouseId?: number | null;
}

export interface MaterialReturnDialogProps {
  visible: boolean;
  onClose: () => void;
  /** Material context (item + source lot). Required when visible=true. */
  material: MaterialReturnSourceMaterial | null;
  /** Work order id — sent in the submit payload. */
  workOrderId: number;
  /** Default receiving warehouse — falls back to material.lotWarehouseId, then 1. */
  defaultReceivingWarehouseId?: number | null;
  /** Called after a successful submit so the parent can invalidate queries. */
  onSubmitted?: (returnNumber: string) => void;
  /** Called on submit error so the parent can toast. */
  onError?: (message: string) => void;
}

interface FormState {
  issuedQty: number;
  usedQty: number;
  returnQty: number;
  containerLabel: string;
  containerType: ContainerType;
  varianceReason: VarianceReason;
  varianceExplanation: string;
  notes: string;
}

const VARIANCE_REASONS: Array<{ value: VarianceReason; label: string }> = [
  { value: 'process_loss', label: 'Process loss (ของเหลือจากกระบวนการผลิต)' },
  { value: 'sampling', label: 'Sampling (เก็บตัวอย่าง QC)' },
  { value: 'spillage', label: 'Spillage (ตก/หกระหว่างผลิต)' },
  { value: 'cleaning', label: 'Cleaning (ทำความสะอาดเครื่อง)' },
  { value: 'measurement_error', label: 'Measurement error (ความคลาดเคลื่อนการชั่ง)' },
  { value: 'unaccounted', label: 'Unaccounted (ไม่ทราบสาเหตุ)' },
  { value: 'other', label: 'Other (ระบุ)' },
];

const CONTAINER_TYPES: Array<{ value: ContainerType; label: string }> = [
  { value: 'bag', label: 'Bag (ถุง)' },
  { value: 'drum', label: 'Drum (ถัง)' },
  { value: 'bottle', label: 'Bottle (ขวด)' },
  { value: 'other', label: 'Other (อื่นๆ)' },
];

function buildDefaultLabel(): string {
  // Pattern: RTN-{YYYY}-{6-digit-of-now}-A. The 6-digit slice of now()
  // gives a non-conflicting suggestion the operator can edit. Final
  // uniqueness is enforced by the server's lot-number generator on
  // approval — this label is the *physical container* label.
  const year = new Date().getFullYear();
  const tail = String(Date.now()).slice(-6);
  return `RTN-${year}-${tail}-A`;
}

export function MaterialReturnDialog({
  visible,
  onClose,
  material,
  workOrderId,
  defaultReceivingWarehouseId,
  onSubmitted,
  onError,
}: MaterialReturnDialogProps) {
  const initialIssued = material?.weighedQty ?? material?.plannedQty ?? 0;

  // Resolved receiving warehouse — falls back to fetching the source lot's
  // warehouse when neither defaultReceivingWarehouseId nor material.lotWarehouseId
  // is available (lots/available endpoint doesn't return warehouseId).
  const [resolvedWarehouseId, setResolvedWarehouseId] = useState<number | null>(null);

  const [form, setForm] = useState<FormState>({
    issuedQty: initialIssued,
    usedQty: initialIssued,
    returnQty: 0,
    containerLabel: buildDefaultLabel(),
    containerType: 'bag',
    varianceReason: 'process_loss',
    varianceExplanation: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve the receiving warehouse on open. Order of preference:
  //   1. defaultReceivingWarehouseId (passed from parent)
  //   2. material.lotWarehouseId (if parent already knows it)
  //   3. Fetch /api/inventory/lots/{lotId} to discover its warehouseId.
  useEffect(() => {
    if (!visible || !material) return;
    const explicit = defaultReceivingWarehouseId ?? material.lotWarehouseId ?? null;
    if (explicit) {
      setResolvedWarehouseId(explicit);
      return;
    }
    if (!material.lotId) {
      setResolvedWarehouseId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/inventory/lots/${material.lotId}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.data?.warehouseId) {
          setResolvedWarehouseId(Number(data.data.warehouseId));
        }
      } catch {
        // Leave null — submit will surface a clear error.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, material, defaultReceivingWarehouseId]);

  // Reset form whenever the dialog opens for a new material — guarantees
  // we don't carry over stale state from a previous return.
  useEffect(() => {
    if (!visible || !material) return;
    const issued = material.weighedQty ?? material.plannedQty ?? 0;
    const planned = material.plannedQty ?? 0;
    // Default "used" = planned (operator-perceived consumption); "return"
    // = whatever they over-issued (issued - planned, clamped >= 0). That
    // gives the operator a sensible starting point they only need to confirm.
    const defaultUsed = Math.min(planned, issued);
    const defaultReturn = Math.max(0, issued - defaultUsed);
    setForm({
      issuedQty: issued,
      usedQty: defaultUsed,
      returnQty: defaultReturn,
      containerLabel: buildDefaultLabel(),
      containerType: 'bag',
      varianceReason: 'process_loss',
      varianceExplanation: '',
      notes: '',
    });
    setError(null);
  }, [visible, material]);

  const variance = useMemo(() => {
    const v = form.issuedQty - form.usedQty - form.returnQty;
    const pct = form.issuedQty > 0 ? Math.abs(v / form.issuedQty) * 100 : 0;
    return { qty: v, pct };
  }, [form.issuedQty, form.usedQty, form.returnQty]);

  // Soft tolerance hint for badge color — the server is the source of truth
  // for outside-tolerance flag. 3% default per design §3.3.
  const VARIANCE_HINT_THRESHOLD = 3;

  const validate = (): string | null => {
    if (!material) return 'No material selected';
    if (!material.lotId) return 'Material has no source lot — cannot return';
    if (form.issuedQty <= 0) return 'Issued qty must be > 0';
    if (form.usedQty < 0) return 'Used qty cannot be negative';
    if (form.returnQty < 0) return 'Return qty cannot be negative';
    if (form.usedQty > form.issuedQty + 1e-6) {
      return 'Used qty cannot exceed Issued qty';
    }
    if (form.returnQty > form.issuedQty - form.usedQty + 1e-6) {
      return 'Return qty cannot exceed (Issued - Used)';
    }
    if (form.usedQty + form.returnQty <= 0) {
      return 'At least one of Used or Return must be > 0';
    }
    if (!form.containerLabel.trim()) return 'Container label is required';
    if ((form.varianceReason === 'other' || form.varianceReason === 'unaccounted')
        && !form.varianceExplanation.trim()) {
      return 'Variance explanation is required for "Other" / "Unaccounted"';
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    if (!material || !material.lotId) return;

    setSubmitting(true);
    setError(null);

    const receivingWarehouseId =
      defaultReceivingWarehouseId ??
      material.lotWarehouseId ??
      resolvedWarehouseId ??
      null;
    if (!receivingWarehouseId) {
      setError('Cannot resolve receiving warehouse for this lot');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/inventory/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workOrderId,
          receivingWarehouseId,
          notes: form.notes || null,
          lines: [
            {
              sourceLotId: material.lotId,
              itemId: material.itemId,
              issuedQty: form.issuedQty,
              issuedUnit: material.unit,
              usedQty: form.usedQty,
              usedUnit: material.unit,
              returnQty: form.returnQty,
              returnUnit: material.unit,
              varianceReason: form.varianceReason,
              varianceExplanation: form.varianceExplanation || null,
              containerLabel: form.containerLabel.trim(),
              containerType: form.containerType,
              notes: form.notes || null,
            },
          ],
        }),
      });
      const json = await res.json();
      if (!json.success) {
        const msg = json.error || 'Failed to submit return';
        setError(msg);
        if (onError) onError(msg);
        return;
      }
      const returnNumber = json.data?.returnNumber ?? '';
      if (onSubmitted) onSubmitted(returnNumber);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error';
      setError(msg);
      if (onError) onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const explanationRequired =
    form.varianceReason === 'other' || form.varianceReason === 'unaccounted';

  return (
    <DxPopup
      visible={visible}
      onHiding={onClose}
      title={material ? `คืนของเหลือ — ${material.itemName}` : 'คืนของเหลือ'}
      width={560}
      height="auto"
      maxWidth="95vw"
      showCloseButton
      dragEnabled={false}
    >
      <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
        {/* Item info header */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex justify-between items-start gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="font-mono text-xs text-amber-700">{material?.itemCode}</p>
              <p className="font-medium text-amber-900 truncate">{material?.itemName}</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Source Lot: <span className="font-mono">{material?.lotNumber || '—'}</span>
              </p>
            </div>
            <div className="text-right text-xs text-amber-700">
              <p>Planned: <strong>{material?.plannedQty} {material?.unit}</strong></p>
              <p>Weighed: <strong>{material?.weighedQty} {material?.unit}</strong></p>
            </div>
          </div>
        </div>

        {/* Quantities row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Issued ({material?.unit})
            </label>
            <DxNumberBox
              value={form.issuedQty}
              onValueChanged={(e) => setForm((f) => ({ ...f, issuedQty: Number(e.value) || 0 }))}
              format="#0.000"
              min={0}
              showSpinButtons
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Used ({material?.unit}) *
            </label>
            <DxNumberBox
              value={form.usedQty}
              onValueChanged={(e) => setForm((f) => ({ ...f, usedQty: Number(e.value) || 0 }))}
              format="#0.000"
              min={0}
              max={form.issuedQty}
              showSpinButtons
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Return ({material?.unit}) *
            </label>
            <DxNumberBox
              value={form.returnQty}
              onValueChanged={(e) => setForm((f) => ({ ...f, returnQty: Number(e.value) || 0 }))}
              format="#0.000"
              min={0}
              max={Math.max(0, form.issuedQty - form.usedQty)}
              showSpinButtons
            />
          </div>
        </div>

        {/* Variance preview — color matches design §6.1 (green within, amber outside) */}
        <div
          className={
            'rounded-lg p-3 border ' +
            (variance.pct > VARIANCE_HINT_THRESHOLD
              ? 'bg-amber-50 border-amber-200'
              : 'bg-green-50 border-green-200')
          }
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700">Variance</span>
            <span className="font-medium">
              {variance.qty.toFixed(4)} {material?.unit} ({variance.pct.toFixed(2)}%)
            </span>
          </div>
          {variance.pct > VARIANCE_HINT_THRESHOLD && (
            <p className="text-xs text-amber-700 mt-1">
              Variance อาจเกิน tolerance — QA จะตรวจสอบและอาจเปิด deviation
            </p>
          )}
        </div>

        {/* Container */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Container Label *
            </label>
            <DxTextBox
              value={form.containerLabel}
              onValueChanged={(e) => setForm((f) => ({ ...f, containerLabel: String(e.value || '') }))}
              placeholder="RTN-2026-XXXXXX-A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Container Type
            </label>
            <DxSelectBox<ContainerType>
              value={form.containerType}
              items={CONTAINER_TYPES}
              displayExpr="label"
              valueExpr="value"
              onValueChange={(v) => setForm((f) => ({ ...f, containerType: (v as ContainerType) || 'bag' }))}
              labelMode="hidden"
            />
          </div>
        </div>

        {/* Variance reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Variance Reason *
          </label>
          <DxSelectBox<VarianceReason>
            value={form.varianceReason}
            items={VARIANCE_REASONS}
            displayExpr="label"
            valueExpr="value"
            onValueChange={(v) =>
              setForm((f) => ({ ...f, varianceReason: (v as VarianceReason) || 'process_loss' }))
            }
            labelMode="hidden"
          />
        </div>

        {/* Variance explanation — required for "other" / "unaccounted" */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Variance Explanation {explanationRequired && <span className="text-red-500">*</span>}
          </label>
          <DxTextArea
            value={form.varianceExplanation}
            onValueChanged={(e) => setForm((f) => ({ ...f, varianceExplanation: String(e.value || '') }))}
            placeholder={
              explanationRequired
                ? 'จำเป็นต้องระบุเหตุผลสำหรับ Other/Unaccounted'
                : 'อธิบายเพิ่มเติม (ถ้ามี)'
            }
            height={60}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <DxTextArea
            value={form.notes}
            onValueChanged={(e) => setForm((f) => ({ ...f, notes: String(e.value || '') }))}
            placeholder="หมายเหตุเพิ่มเติม"
            height={50}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-3 border-t">
          <DxButton
            text="ยกเลิก"
            stylingMode="outlined"
            onClick={onClose}
            disabled={submitting}
          />
          <DxButton
            text={submitting ? 'กำลังส่ง...' : 'ส่งคืนวัตถุดิบ'}
            type="success"
            onClick={handleSubmit}
            disabled={submitting}
          />
        </div>
      </div>
    </DxPopup>
  );
}

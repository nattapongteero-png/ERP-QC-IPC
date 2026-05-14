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
import { useTranslations } from 'next-intl';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxButton } from '@/components/ui/dx-button';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { calculateReturn, type UnitConfig } from '@/lib/utils/unit-conversion';

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
  // ──────────────────────────────────────────────────────────────────────
  // 3-level unit conversion fields (Step 1/2/3). When `weightTrackingEnabled`
  // is true, the dialog enables the WU input toggle and auto-computes
  // used/return quantities via calculateReturn.
  // ──────────────────────────────────────────────────────────────────────
  primaryUnit?: string | null;
  secondaryUnit?: string | null;
  weightUnit?: string | null;
  conversionRate?: number | null;        // Ratio1: 1 PU = N SU
  secondaryToWeightRate?: number | null; // Ratio2: 1 SU = N WU
  weightTrackingEnabled?: boolean;
  /** SU actually issued from warehouse at Step 2 approve (overrides weighedQty when set) */
  issuedQtySU?: number | null;
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
  /** When set, dialog loads the existing return for editing (PATCH instead of POST). */
  existingReturnId?: number | null;
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

// Other lines within the same return that we did not edit — sent back
// untouched in the PATCH payload so the server can rebuild the line set.
interface PassThroughLine {
  sourceLotId: number;
  itemId: number;
  issuedQty: number;
  issuedUnit: string;
  usedQty: number;
  usedUnit: string;
  returnQty: number;
  returnUnit: string;
  varianceReason: string;
  varianceExplanation: string | null;
  containerLabel: string;
  containerType: string | null;
  notes: string | null;
}

export function MaterialReturnDialog({
  visible,
  onClose,
  material,
  workOrderId,
  defaultReceivingWarehouseId,
  existingReturnId,
  onSubmitted,
  onError,
}: MaterialReturnDialogProps) {
  const t = useTranslations('production');
  const td = (k: string) => t(`execution.materialReturnDialog.${k}`);
  const initialIssued = material?.weighedQty ?? material?.plannedQty ?? 0;
  const isEdit = !!existingReturnId;
  // Holds non-edited lines from the existing return (other materials in the
  // same return). On submit we merge them back so PATCH receives the full set.
  const [passThroughLines, setPassThroughLines] = useState<PassThroughLine[]>([]);

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

  // ──────────────────────────────────────────────────────────────────────
  // 3-level weight tracking — only enabled when item.weightTrackingEnabled
  // and required ratios are present. The dialog then offers a WU input that
  // auto-derives usedQty (in SU = BOM unit) via calculateReturn.
  // ──────────────────────────────────────────────────────────────────────
  const tracked = !!(
    material?.weightTrackingEnabled &&
    material?.conversionRate && Number(material.conversionRate) > 0 &&
    material?.secondaryToWeightRate && Number(material.secondaryToWeightRate) > 0 &&
    material?.primaryUnit &&
    material?.secondaryUnit &&
    material?.weightUnit
  );

  type InputMode = 'weight' | 'su';
  const [inputMode, setInputMode] = useState<InputMode>('weight');
  const [weightUsed, setWeightUsed] = useState<number>(0);

  // Reset form whenever the dialog opens for a new material — guarantees
  // we don't carry over stale state from a previous return. In edit mode
  // we additionally fetch the existing return and overwrite defaults with
  // the persisted line values.
  useEffect(() => {
    if (!visible || !material) return;
    const planned = material.plannedQty ?? 0;
    const weighed = material.weighedQty ?? 0;
    const issuedFromStep2 = material.issuedQtySU != null ? Number(material.issuedQtySU) : 0;
    const issued = issuedFromStep2 > 0
      ? issuedFromStep2
      : Math.max(weighed, planned);
    const defaultUsed = Math.min(weighed, issued);
    const defaultReturn = Math.max(0, issued - defaultUsed);

    // Initial seed (will be overwritten in edit mode after fetch resolves).
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
    setInputMode('weight');
    if (tracked && material?.secondaryToWeightRate) {
      setWeightUsed(defaultUsed * Number(material.secondaryToWeightRate));
    } else {
      setWeightUsed(0);
    }
    setPassThroughLines([]);
    setError(null);

    // Edit mode: fetch the existing return and find the line for this material.
    if (existingReturnId && material.lotId != null) {
      let cancelled = false;
      (async () => {
        try {
          const res = await fetch(`/api/inventory/returns/${existingReturnId}`);
          const data = await res.json();
          if (cancelled || !data?.success || !data.data?.lines) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lines = data.data.lines as any[];
          const targetLotId = Number(material.lotId);
          const targetItemId = Number(material.itemId);
          const editLine = lines.find(
            (l) => Number(l.sourceLot?.id ?? l.sourceLotId) === targetLotId
              && Number(l.itemId) === targetItemId,
          );
          const others: PassThroughLine[] = lines
            .filter((l) => l !== editLine)
            .map((l) => ({
              sourceLotId: Number(l.sourceLot?.id ?? l.sourceLotId),
              itemId: Number(l.itemId),
              issuedQty: Number(l.issuedQty),
              issuedUnit: String(l.issuedUnit),
              usedQty: Number(l.usedQty),
              usedUnit: String(l.usedUnit),
              returnQty: Number(l.returnQty),
              returnUnit: String(l.returnUnit),
              varianceReason: String(l.varianceReason),
              varianceExplanation: l.varianceExplanation ?? null,
              containerLabel: String(l.returnContainerLabel ?? l.containerLabel ?? ''),
              containerType: l.returnContainerType ?? l.containerType ?? null,
              notes: l.notes ?? null,
            }));
          setPassThroughLines(others);
          if (editLine) {
            setForm((prev) => ({
              ...prev,
              issuedQty: Number(editLine.issuedQty),
              usedQty: Number(editLine.usedQty),
              returnQty: Number(editLine.returnQty),
              containerLabel: String(editLine.returnContainerLabel ?? prev.containerLabel),
              containerType: (editLine.returnContainerType as ContainerType) ?? prev.containerType,
              varianceReason: (editLine.varianceReason as VarianceReason) ?? prev.varianceReason,
              varianceExplanation: editLine.varianceExplanation ?? '',
              notes: editLine.notes ?? '',
            }));
            if (tracked && material?.secondaryToWeightRate) {
              setWeightUsed(Number(editLine.usedQty) * Number(material.secondaryToWeightRate));
            }
          }
        } catch {
          // Leave defaults — operator can still edit and resubmit.
        }
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [visible, material, tracked, existingReturnId]);

  const variance = useMemo(() => {
    const v = form.issuedQty - form.usedQty - form.returnQty;
    const pct = form.issuedQty > 0 ? Math.abs(v / form.issuedQty) * 100 : 0;
    return { qty: v, pct };
  }, [form.issuedQty, form.usedQty, form.returnQty]);

  // Derived return preview for weight-tracked items — shows the equivalent
  // PU value (e.g. 0.25 box) that will become the new RTN lot quantity.
  const returnPreview = useMemo(() => {
    if (!tracked || !material) return null;
    const r1 = Number(material.conversionRate);
    const r2 = Number(material.secondaryToWeightRate);
    if (!(r1 > 0) || !(r2 > 0)) return null;
    try {
      const config: UnitConfig = {
        primaryUnit: material.primaryUnit ?? '',
        secondaryUnit: material.secondaryUnit ?? '',
        weightUnit: material.weightUnit ?? '',
        conversionRate: r1,
        secondaryToWeightRate: r2,
        weightTrackingEnabled: true,
      };
      const usedWU = inputMode === 'weight' ? weightUsed : form.usedQty * r2;
      if (usedWU < 0 || form.issuedQty <= 0) return null;
      const r = calculateReturn(usedWU, form.issuedQty, config);
      return {
        usedWU,
        usedSU: r.actualUsedSU,
        returnedSU: r.returnedSU,
        returnedPU: r.returnedPU,
        pu: material.primaryUnit ?? '',
        su: material.secondaryUnit ?? '',
        wu: material.weightUnit ?? '',
      };
    } catch {
      return null;
    }
  }, [tracked, material, inputMode, weightUsed, form.usedQty, form.issuedQty]);

  // Sync side-effect: when operator types weight (or toggles to weight mode),
  // derive usedQty/returnQty in SU. Form fields stay the source of truth for submit.
  useEffect(() => {
    if (!tracked || !material) return;
    const r2 = Number(material.secondaryToWeightRate);
    if (!(r2 > 0)) return;
    if (inputMode !== 'weight') return;
    const usedSU = weightUsed / r2;
    const returnSU = Math.max(0, form.issuedQty - usedSU);
    setForm((f) =>
      f.usedQty === usedSU && f.returnQty === returnSU
        ? f
        : { ...f, usedQty: usedSU, returnQty: returnSU }
    );
  }, [tracked, material, inputMode, weightUsed, form.issuedQty]);

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

    // The current material's edited line — same shape used for both create & edit.
    const currentLine = {
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
    };

    try {
      const url = isEdit
        ? `/api/inventory/returns/${existingReturnId}`
        : '/api/inventory/returns';
      const method = isEdit ? 'PATCH' : 'POST';
      const body = isEdit
        ? {
            receivingWarehouseId,
            notes: form.notes || null,
            lines: [...passThroughLines, currentLine],
          }
        : {
            workOrderId,
            receivingWarehouseId,
            notes: form.notes || null,
            lines: [currentLine],
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
      title={
        material
          ? `${isEdit ? td('editTitle') : td('title')} — ${material.itemName}`
          : isEdit
            ? td('editTitle')
            : td('title')
      }
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
                {td('sourceLot')}: <span className="font-mono">{material?.lotNumber || '—'}</span>
              </p>
            </div>
            <div className="text-right text-xs text-amber-700">
              <p>{td('planned')}: <strong>{material?.plannedQty} {material?.unit}</strong></p>
              <p>{td('weighed')}: <strong>{material?.weighedQty} {material?.unit}</strong></p>
            </div>
          </div>
        </div>

        {/* Weight-tracked items: input by weight (WU), auto-derive used/return in SU */}
        {tracked && material && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-emerald-700">
                <strong>{td('threeLevelLabel')}:</strong> 1 {material.primaryUnit} = {Number(material.conversionRate).toLocaleString()} {material.secondaryUnit} ; 1 {material.secondaryUnit} = {Number(material.secondaryToWeightRate)} {material.weightUnit}
              </div>
              <div className="inline-flex rounded-md overflow-hidden border border-emerald-300 text-xs">
                <button
                  type="button"
                  className={
                    'px-3 py-1 ' +
                    (inputMode === 'weight'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-emerald-700')
                  }
                  onClick={() => setInputMode('weight')}
                >
                  {td('modeWeight')} ({material.weightUnit})
                </button>
                <button
                  type="button"
                  className={
                    'px-3 py-1 ' +
                    (inputMode === 'su'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-emerald-700')
                  }
                  onClick={() => setInputMode('su')}
                >
                  {td('modeSU')} ({material.secondaryUnit})
                </button>
              </div>
            </div>

            {inputMode === 'weight' && (
              <div>
                <label className="block text-xs font-medium text-emerald-800 mb-1">
                  {td('weightInputLabel')} ({material.weightUnit})
                </label>
                <DxNumberBox
                  value={weightUsed}
                  onValueChanged={(e) => setWeightUsed(Number(e.value) || 0)}
                  format="#0.######"
                  min={0}
                  max={form.issuedQty * (Number(material.secondaryToWeightRate) || 0)}
                  showSpinButtons
                />
              </div>
            )}

            {returnPreview && (
              <div className="text-sm bg-white border border-emerald-200 rounded-lg p-3 space-y-1">
                <div className="text-emerald-900">
                  <strong>{td('actualUsed')}:</strong>{' '}
                  {returnPreview.usedWU.toLocaleString(undefined, { maximumFractionDigits: 4 })} {returnPreview.wu}{' '}
                  <span className="text-xs text-gray-500">
                    (= {returnPreview.usedSU.toLocaleString(undefined, { maximumFractionDigits: 3 })} {returnPreview.su})
                  </span>
                </div>
                <div className="text-emerald-900">
                  <strong>{td('returnToWarehouse')}:</strong>{' '}
                  <span className="font-semibold">
                    {returnPreview.returnedPU.toLocaleString(undefined, { maximumFractionDigits: 4 })} {returnPreview.pu}
                  </span>{' '}
                  <span className="text-xs text-gray-500">
                    (= {returnPreview.returnedSU.toLocaleString(undefined, { maximumFractionDigits: 3 })} {returnPreview.su})
                  </span>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                    {td('zeroCost')}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quantities row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {td('issued')} ({material?.unit})
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
              {td('used')} ({material?.unit}) *
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
              {td('returnQty')} ({material?.unit}) *
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
            <span className="text-gray-700">{td('variance')}</span>
            <span className="font-medium">
              {variance.qty.toFixed(4)} {material?.unit} ({variance.pct.toFixed(2)}%)
            </span>
          </div>
          {variance.pct > VARIANCE_HINT_THRESHOLD && (
            <p className="text-xs text-amber-700 mt-1">
              {td('varianceWarning')}
            </p>
          )}
        </div>

        {/* Container */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {td('containerLabel')} *
            </label>
            <DxTextBox
              value={form.containerLabel}
              onValueChanged={(e) => setForm((f) => ({ ...f, containerLabel: String(e.value || '') }))}
              placeholder="RTN-2026-XXXXXX-A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {td('containerType')}
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
            {td('varianceReason')} *
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
            {td('varianceExplanation')} {explanationRequired && <span className="text-red-500">*</span>}
          </label>
          <DxTextArea
            value={form.varianceExplanation}
            onValueChanged={(e) => setForm((f) => ({ ...f, varianceExplanation: String(e.value || '') }))}
            placeholder={
              explanationRequired
                ? td('explanationRequired')
                : td('explanationOptional')
            }
            height={60}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{td('notes')}</label>
          <DxTextArea
            value={form.notes}
            onValueChanged={(e) => setForm((f) => ({ ...f, notes: String(e.value || '') }))}
            placeholder={td('notesPlaceholder')}
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
            text={td('cancel')}
            stylingMode="outlined"
            onClick={onClose}
            disabled={submitting}
          />
          <DxButton
            text={
              submitting
                ? td('submitting')
                : isEdit
                  ? td('editSubmit')
                  : td('submit')
            }
            type="success"
            onClick={handleSubmit}
            disabled={submitting}
          />
        </div>
      </div>
    </DxPopup>
  );
}

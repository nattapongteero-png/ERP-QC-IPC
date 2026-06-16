'use client';

/**
 * Production Output / Yield Recording Page
 * Records actual production quantity, reject quantity, and creates finished goods lot
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRealtimeTopic } from '@/hooks/use-realtime-topic';
import { ResponsivePageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { useToast } from '@/hooks/use-toast';
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Edit3,
} from 'lucide-react';
import { formatNumber } from '@/lib/utils/number-format';

interface WorkOrderInfo {
  id: number;
  woNumber: string;
  batchNumber: string;
  productName: string;
  productNameEn?: string;
  plannedQuantity: number;
  actualQuantity: number | null;
  rejectQuantity: number | null;
  yieldPercentage: number | null;
  unit: string;
  status: string;
  bomYieldTarget?: number | null;
  bomLossAllowance?: number | null;
  bomFillWeightMg?: number | null;
  emptyCapsuleWeightMg?: number | null;
  emptyCapsuleItemName?: string | null;
  productSecondaryUnit?: string | null;
  productConversionRate?: number | null;
  bulkOutputQty?: number | null;
  bulkOutputRecordedAt?: string | null;
  bulkOutputRecordedBy?: number | null;
  finishedOutputQty?: number | null;
  finishedOutputRecordedAt?: string | null;
  finishedOutputRecordedBy?: number | null;
}

type BulkInputMode = 'weight' | 'count_cap' | 'count_box';

interface Warehouse {
  id: number;
  code: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

interface YieldResult {
  theoretical: number;
  actualGood: number;
  actualReject: number;
  yieldPercent: number;
  rejectPercent: number;
  lossPercent: number;
  status: 'normal' | 'low_yield' | 'high_yield';
}

interface OutputResponse {
  lotId: number;
  yield: YieldResult;
  message: string;
}

export default function ProductionOutputPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const t = useTranslations('production');
  const tw = (key: string) => t(`execution.productionOutputPage.${key}`);

  const workOrderId = Number(params.id);
  const stage = (searchParams.get('stage') === 'bulk' ? 'bulk' : 'finished') as 'bulk' | 'finished';
  const isBulkStage = stage === 'bulk';

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    actualQuantity: 0,
    rejectQuantity: 0,
    warehouseId: null as number | null,
    notes: '',
    // Audit #24-#28 — MFD/EXP captured at production output.
    // Empty string means "let backend derive from WO actualStartDate".
    manufacturingDate: '' as string,
    expiryDate: '' as string,
  });
  // Bulk stage can accept input as weight (g), capsule count, or box count.
  // formData.actualQuantity stays in primary unit (box) for storage; inputValue
  // + inputMode are UI-only and recompute actualQuantity on change.
  const [inputMode, setInputMode] = useState<BulkInputMode>('weight');
  const [inputValue, setInputValue] = useState<number>(0);

  // Fetch Work Order info
  const { data: workOrder, isLoading: woLoading } = useQuery<WorkOrderInfo>({
    queryKey: ['work-order', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/detail`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data?.workOrder;
    },
  });

  // Fetch warehouses (finished_goods type preferred)
  const { data: warehouses } = useQuery<Warehouse[]>({
    queryKey: ['warehouses-for-output'],
    queryFn: async () => {
      const res = await fetch('/api/warehouses?limit=100');
      const data = await res.json();
      if (!data.success) return [];
      return data.data?.items || [];
    },
  });

  // Fetch existing yield if already recorded
  const { data: yieldData } = useQuery<YieldResult | null>({
    queryKey: ['wo-yield', workOrderId],
    queryFn: async () => {
      if (!workOrder?.actualQuantity) return null;
      const res = await fetch(`/api/production/yield?workOrderId=${workOrderId}`);
      const data = await res.json();
      if (!data.success) return null;
      return data.data;
    },
    enabled: !!workOrder?.actualQuantity,
  });

  // Realtime sync — when another user records bulk/finished output on this
  // WO (or flips status afterwards), refresh the WO header and yield row.
  useRealtimeTopic('work-order-changed', (data) => {
    if (data.workOrderId !== workOrderId) return;
    queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
    queryClient.invalidateQueries({ queryKey: ['wo-yield', workOrderId] });
  });

  // Record output mutation
  const recordMutation = useMutation<OutputResponse, Error>({
    mutationFn: async () => {
      const res = await fetch('/api/production/yield', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workOrderId,
          stage,
          actualQuantity: formData.actualQuantity,
          rejectQuantity: formData.rejectQuantity,
          warehouseId: isBulkStage ? null : formData.warehouseId,
          // Only send MFD/EXP at the finished stage — bulk output does not
          // create a saleable lot.
          manufacturingDate: !isBulkStage && formData.manufacturingDate ? formData.manufacturingDate : null,
          expiryDate: !isBulkStage && formData.expiryDate ? formData.expiryDate : null,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to record output');
      return data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['wo-yield', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['wo-execution-summary', workOrderId] });
      setIsEditing(false);

      if (data.yield?.status === 'low_yield') {
        toast.warning(tw('toast.success'), tw('toast.lowYieldWarning'));
      } else {
        toast.success(tw('toast.success'), tw('toast.successDetail'));
      }
    },
    onError: (error: Error) => {
      toast.error(tw('toast.error'), error.message);
    },
  });

  // Auto-calculate reject quantity when actual quantity changes (finished stage only)
  useEffect(() => {
    if (!workOrder || isBulkStage) return;
    const planned = Number(workOrder.plannedQuantity) || 0;
    if (planned > 0 && formData.actualQuantity > 0) {
      const reject = Math.max(0, Math.round((planned - formData.actualQuantity) * 10000) / 10000);
      setFormData(prev => ({ ...prev, rejectQuantity: reject }));
    }
  }, [formData.actualQuantity, workOrder, isBulkStage]);

  // ─── Unit conversion helpers (bulk stage) ──────────────────────
  // Box (primary) → Capsule (secondary) via item.conversionRate
  // Capsule → mg via BOM.fillWeightMg (nullable — not every product has it)
  const conversionRate = Number(workOrder?.productConversionRate) || 0;
  const fillWeightMg = Number(workOrder?.bomFillWeightMg) || 0;
  // Net weight of one empty capsule shell (from the BOM packaging line's item
  // master). The filled-capsule weight = powder (fillWeightMg) + this shell.
  const emptyCapWeightMg = Number(workOrder?.emptyCapsuleWeightMg) || 0;
  const filledUnitMg = fillWeightMg + emptyCapWeightMg;
  const secondaryUnit = workOrder?.productSecondaryUnit || '';
  const canConvertToCapsule = conversionRate > 0 && !!secondaryUnit;
  const canConvertToWeight = canConvertToCapsule && fillWeightMg > 0;
  const hasEmptyCapWeight = emptyCapWeightMg > 0;

  // Given a box count, derive capsule count and gram weight.
  const boxToCap = (box: number) => (canConvertToCapsule ? box * conversionRate : 0);
  // Powder-only weight (drives yield against the bulk formula).
  const boxToGram = (box: number) => (canConvertToWeight ? (box * conversionRate * fillWeightMg) / 1000 : 0);
  // Powder + empty capsule = final filled weight that comes off the line.
  const boxToFilledGram = (box: number) =>
    canConvertToWeight ? (box * conversionRate * filledUnitMg) / 1000 : 0;

  // Given a user-entered value in the selected mode, compute the box count.
  const toBoxCount = (value: number, mode: BulkInputMode): number => {
    if (!value) return 0;
    if (mode === 'count_box') return value;
    if (mode === 'count_cap') return canConvertToCapsule ? value / conversionRate : 0;
    // weight mode: value is grams → mg → capsules → boxes
    if (!canConvertToWeight) return 0;
    const totalMg = value * 1000;
    const caps = totalMg / fillWeightMg;
    return caps / conversionRate;
  };

  // When input mode or value changes in bulk stage, sync formData.actualQuantity.
  useEffect(() => {
    if (!isBulkStage) return;
    const box = toBoxCount(inputValue, inputMode);
    // Round to 4 decimals for sanity; avoids 1e-15 noise.
    const rounded = Math.round(box * 10000) / 10000;
    setFormData(prev => (prev.actualQuantity === rounded ? prev : { ...prev, actualQuantity: rounded }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, inputMode, isBulkStage, conversionRate, fillWeightMg]);

  const hasRecorded = isBulkStage
    ? workOrder?.bulkOutputQty !== null && workOrder?.bulkOutputQty !== undefined
    : workOrder?.finishedOutputQty !== null && workOrder?.finishedOutputQty !== undefined
      || (workOrder?.actualQuantity !== null && workOrder?.actualQuantity !== undefined);
  const isInProgress = workOrder?.status === 'in_progress';
  const showForm = isInProgress && (!hasRecorded || isEditing);

  // Pre-fill form when editing existing
  const handleEdit = () => {
    if (workOrder) {
      const preActual = isBulkStage
        ? Number(workOrder.bulkOutputQty) || 0
        : Number(workOrder.finishedOutputQty ?? workOrder.actualQuantity) || 0;
      setFormData((prev) => ({
        actualQuantity: preActual,
        rejectQuantity: isBulkStage ? 0 : Number(workOrder.rejectQuantity) || 0,
        warehouseId: prev.warehouseId,
        notes: '',
        manufacturingDate: prev.manufacturingDate,
        expiryDate: prev.expiryDate,
      }));
      // Seed bulk-stage hybrid input to the currently-selected mode, so the
      // user can tweak the value they previously entered without retyping.
      if (isBulkStage) {
        if (inputMode === 'count_box') setInputValue(preActual);
        else if (inputMode === 'count_cap') setInputValue(boxToCap(preActual));
        else if (inputMode === 'weight') setInputValue(boxToGram(preActual));
      }
    }
    setIsEditing(true);
  };

  const handleSubmit = () => {
    if (!formData.actualQuantity || formData.actualQuantity <= 0) {
      toast.error(tw('toast.error'), 'Actual quantity must be greater than 0');
      return;
    }
    if (!isBulkStage && !formData.warehouseId) {
      toast.error(tw('toast.error'), 'Please select a destination warehouse');
      return;
    }
    recordMutation.mutate();
  };

  const getYieldStatusStyle = (status: string) => {
    switch (status) {
      case 'normal':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'low_yield':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high_yield':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getYieldStatusLabel = (status: string) => {
    switch (status) {
      case 'normal': return tw('yield.statusNormal');
      case 'low_yield': return tw('yield.statusLowYield');
      case 'high_yield': return tw('yield.statusHighYield');
      default: return status;
    }
  };

  const getYieldStatusIcon = (status: string) => {
    switch (status) {
      case 'normal': return <CheckCircle2 className="h-4 w-4" />;
      case 'low_yield': return <TrendingDown className="h-4 w-4" />;
      case 'high_yield': return <TrendingUp className="h-4 w-4" />;
      default: return null;
    }
  };

  if (woLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <DxLoadIndicator />
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Work Order not found</p>
        <DxButton
          text="Back"
          type="normal"
          stylingMode="outlined"
          className="mt-4"
          onClick={() => router.push('/production/work-orders')}
        />
      </div>
    );
  }

  // Calculate live preview while filling form
  const liveYieldPercent = workOrder.plannedQuantity > 0
    ? Math.round((formData.actualQuantity / workOrder.plannedQuantity) * 100 * 100) / 100
    : 0;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      {/* Header */}
      <ResponsivePageHeader
        title={`${tw('title')}${isBulkStage ? ' — Bulk Product Yield' : ' — Finished Output'}`}
        subtitle={`Batch: ${workOrder.batchNumber} | ${workOrder.productName} | ${isBulkStage ? 'บันทึกบัลก์หลังผลิต (ก่อนแพ็ค)' : 'บันทึก FG หลัง Inspection (เข้าคลัง)'}`}
        icon={Package}
        iconBgColor="bg-green-100"
        iconColor="text-green-600"
        breadcrumbs={[
          { label: 'Production', href: '/production' },
          { label: 'Work Orders', href: '/production/work-orders' },
          { label: workOrder.woNumber, href: `/production/work-orders/${workOrderId}` },
          { label: 'Execution', href: `/production/work-orders/${workOrderId}?tab=execution` },
          { label: tw('title') },
        ]}
        actions={
          <DxButton
            text={tw('actions.backToExecution')}
            icon="back"
            stylingMode="outlined"
            onClick={() => router.push(`/production/work-orders/${workOrderId}?tab=execution`)}
          />
        }
      />

      {/* Work Order Info Card */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">{tw('info.product')}</p>
              <p className="font-medium">{workOrder.productName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{tw('info.batchNumber')}</p>
              <p className="font-medium">{workOrder.batchNumber}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{tw('info.plannedQty')}</p>
              <p className="font-medium text-lg">{formatNumber(workOrder.plannedQuantity)} {workOrder.unit}</p>
              {/* Bulk stage: show the same planned value in the sub-units the
                  operator will actually work with on the line (capsules, grams). */}
              {isBulkStage && canConvertToCapsule && (
                <p className="text-xs text-gray-500 mt-0.5">
                  = {formatNumber(boxToCap(Number(workOrder.plannedQuantity)))} {secondaryUnit}
                  {canConvertToWeight && (
                    <> · {formatNumber(boxToGram(Number(workOrder.plannedQuantity)), 2)} g</>
                  )}
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">{tw('info.unit')}</p>
              <p className="font-medium">{workOrder.unit}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status: Not in progress */}
      {!isInProgress && !hasRecorded && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <p className="text-amber-800 font-medium">{tw('status.woNotInProgress')}</p>
          </CardContent>
        </Card>
      )}

      {/* Already recorded - Show results */}
      {hasRecorded && !isEditing && (
        <>
          {/* Recorded Output Summary */}
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-800">{tw('output.title')}</h3>
                </div>
                {isInProgress && (
                  <DxButton
                    text={tw('form.edit')}
                    icon="edit"
                    stylingMode="outlined"
                    type="normal"
                    onClick={handleEdit}
                  />
                )}
              </div>
              <div className={`grid grid-cols-2 ${isBulkStage ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4`}>
                <div>
                  <p className="text-sm text-gray-600">{isBulkStage ? 'Bulk Output Qty' : tw('form.actualQuantity')}</p>
                  <p className="text-2xl font-bold text-green-700">
                    {formatNumber(isBulkStage
                      ? workOrder.bulkOutputQty ?? 0
                      : workOrder.finishedOutputQty ?? workOrder.actualQuantity ?? 0
                    )} {workOrder.unit}
                  </p>
                  {isBulkStage && canConvertToCapsule && (workOrder.bulkOutputQty ?? 0) > 0 && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      = {formatNumber(boxToCap(Number(workOrder.bulkOutputQty)))} {secondaryUnit}
                      {canConvertToWeight && (
                        <> · {formatNumber(boxToGram(Number(workOrder.bulkOutputQty)), 2)} g</>
                      )}
                    </p>
                  )}
                </div>
                {!isBulkStage && (
                  <div>
                    <p className="text-sm text-gray-600">{tw('form.rejectQuantity')}</p>
                    <p className="text-xl font-semibold text-red-600">
                      {formatNumber(workOrder.rejectQuantity || 0)} {workOrder.unit}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">{isBulkStage ? 'Recorded At' : tw('yield.yieldPercent')}</p>
                  <p className="text-xl font-bold text-emerald-700">
                    {isBulkStage
                      ? (workOrder.bulkOutputRecordedAt
                          ? new Date(workOrder.bulkOutputRecordedAt).toLocaleString('th-TH')
                          : '-')
                      : (workOrder.yieldPercentage ? `${Number(workOrder.yieldPercentage).toFixed(2)}%` : '-')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Yield Calculation Detail — finished stage only */}
          {!isBulkStage && yieldData && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-semibold">{tw('yield.title')}</h3>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getYieldStatusStyle(yieldData.status)}`}>
                    {getYieldStatusIcon(yieldData.status)}
                    {getYieldStatusLabel(yieldData.status)}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">{tw('yield.theoretical')}</p>
                    <p className="text-lg font-semibold">{formatNumber(yieldData.theoretical)}</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-500">{tw('yield.actualGood')}</p>
                    <p className="text-lg font-semibold text-green-700">{formatNumber(yieldData.actualGood)}</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <p className="text-sm text-gray-500">{tw('yield.actualReject')}</p>
                    <p className="text-lg font-semibold text-red-600">{formatNumber(yieldData.actualReject)}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg">
                    <p className="text-sm text-gray-500">{tw('yield.yieldPercent')}</p>
                    <p className="text-lg font-bold text-emerald-700">{yieldData.yieldPercent.toFixed(2)}%</p>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <p className="text-sm text-gray-500">{tw('yield.rejectPercent')}</p>
                    <p className="text-lg font-semibold text-orange-600">{yieldData.rejectPercent.toFixed(2)}%</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">{tw('yield.lossPercent')}</p>
                    <p className="text-lg font-semibold text-gray-700">{yieldData.lossPercent.toFixed(2)}%</p>
                  </div>
                </div>

                {/* Yield Progress Bar */}
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-gray-500">{tw('yield.yieldPercent')}</span>
                    <span className="text-sm font-medium">{yieldData.yieldPercent.toFixed(2)}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        yieldData.status === 'normal' ? 'bg-green-500' :
                        yieldData.status === 'low_yield' ? 'bg-red-500' :
                        'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(yieldData.yieldPercent, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Input Form */}
      {showForm && (
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              {isEditing ? <Edit3 className="h-5 w-5" /> : <Package className="h-5 w-5" />}
              {isEditing ? tw('form.edit') : tw('title')}
            </h3>

            <div className="space-y-4">
              {/* BOM Target — show plan + thresholds in every unit the operator
                  will see on the line so no mental conversion is needed. */}
              {(workOrder.bomYieldTarget || workOrder.bomLossAllowance || isBulkStage) && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-900">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
                    <span className="font-semibold">🎯 BOM Target</span>
                    {workOrder.bomYieldTarget != null && (
                      <span>Yield ≥ <strong>{Number(workOrder.bomYieldTarget).toFixed(2)}%</strong></span>
                    )}
                    {workOrder.bomLossAllowance != null && (
                      <span>Loss ≤ <strong>{Number(workOrder.bomLossAllowance).toFixed(2)}%</strong></span>
                    )}
                  </div>
                  <div className="border-t border-emerald-200 pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-emerald-700 uppercase tracking-wide text-[11px]">จำนวนแผน</div>
                      <div className="font-semibold text-base">{formatNumber(workOrder.plannedQuantity)} {workOrder.unit}</div>
                      {isBulkStage && canConvertToCapsule && (
                        <div className="text-emerald-700">
                          = {formatNumber(boxToCap(Number(workOrder.plannedQuantity)))} {secondaryUnit}
                          {canConvertToWeight && (
                            <> · {formatNumber(boxToGram(Number(workOrder.plannedQuantity)), 2)} g</>
                          )}
                        </div>
                      )}
                    </div>
                    {workOrder.bomYieldTarget != null && (
                      <div>
                        <div className="text-emerald-700 uppercase tracking-wide text-[11px]">ต่ำสุดที่ผ่าน (Yield)</div>
                        <div className="font-semibold text-base">
                          {formatNumber(Number(workOrder.plannedQuantity) * Number(workOrder.bomYieldTarget) / 100, 2)} {workOrder.unit}
                        </div>
                        {isBulkStage && canConvertToCapsule && (
                          <div className="text-emerald-700">
                            = {formatNumber(boxToCap(Number(workOrder.plannedQuantity) * Number(workOrder.bomYieldTarget) / 100), 0)} {secondaryUnit}
                            {canConvertToWeight && (
                              <> · {formatNumber(boxToGram(Number(workOrder.plannedQuantity) * Number(workOrder.bomYieldTarget) / 100), 2)} g</>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {workOrder.bomLossAllowance != null && (
                      <div>
                        <div className="text-emerald-700 uppercase tracking-wide text-[11px]">สูญเสียสูงสุด</div>
                        <div className="font-semibold text-base">
                          {formatNumber(Number(workOrder.plannedQuantity) * Number(workOrder.bomLossAllowance) / 100, 2)} {workOrder.unit}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actual Quantity — bulk stage uses hybrid input (weight/capsule/box),
                  finished stage keeps the simple box-count input it always had. */}
              {isBulkStage ? (
                <div className="space-y-4">
                  {/* Config status banners — tell the operator what to fix before
                      certain input modes become available. */}
                  {!canConvertToCapsule && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                      <div className="font-medium mb-1">⚠️ ตั้งค่าเพิ่มเติม</div>
                      Item ของ BOM นี้ยังไม่ได้ตั้ง Secondary Unit + Conversion Rate — ใช้โหมดนับ/ชั่งไม่ได้ กรอกเฉพาะหน่วย {workOrder.unit} เท่านั้น
                    </div>
                  )}
                  {canConvertToCapsule && !canConvertToWeight && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                      <div className="font-medium mb-1">⚠️ ตั้งค่าเพิ่มเติม</div>
                      BOM ยังไม่ได้ตั้ง <strong>น้ำหนักต่อหน่วยย่อย (mg/{secondaryUnit})</strong> — โหมด &quot;ชั่งน้ำหนัก&quot; ถูกปิดไว้ แก้ได้ที่หน้า BOM Edit
                    </div>
                  )}

                  {/* STEP 1 — Pick the measurement method. Large touch-friendly buttons
                      with clear icons + full labels so line workers can pick quickly. */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold">1</span>
                      <h4 className="font-semibold text-gray-800">เลือกวิธีวัดผลผลิต</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => { setInputMode('weight'); setInputValue(boxToGram(formData.actualQuantity)); }}
                        disabled={!canConvertToWeight}
                        className={`p-3 border-2 rounded-lg text-left transition-all ${
                          inputMode === 'weight'
                            ? 'border-emerald-500 bg-emerald-50 shadow'
                            : 'border-emerald-100 bg-white hover:border-emerald-300'
                        } ${!canConvertToWeight ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className="text-2xl">⚖</div>
                        <div className="font-semibold text-sm">ชั่งน้ำหนัก</div>
                        <div className="text-xs text-gray-600">กรอกน้ำหนัก Bulk (g)</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setInputMode('count_cap'); setInputValue(boxToCap(formData.actualQuantity)); }}
                        disabled={!canConvertToCapsule}
                        className={`p-3 border-2 rounded-lg text-left transition-all ${
                          inputMode === 'count_cap'
                            ? 'border-emerald-500 bg-emerald-50 shadow'
                            : 'border-emerald-100 bg-white hover:border-emerald-300'
                        } ${!canConvertToCapsule ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className="text-2xl">🔢</div>
                        <div className="font-semibold text-sm">นับ {secondaryUnit || 'หน่วยย่อย'}</div>
                        <div className="text-xs text-gray-600">กรอกจำนวน {secondaryUnit || 'หน่วยย่อย'}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setInputMode('count_box'); setInputValue(formData.actualQuantity); }}
                        className={`p-3 border-2 rounded-lg text-left transition-all cursor-pointer ${
                          inputMode === 'count_box'
                            ? 'border-emerald-500 bg-emerald-50 shadow'
                            : 'border-emerald-100 bg-white hover:border-emerald-300'
                        }`}
                      >
                        <div className="text-2xl">📦</div>
                        <div className="font-semibold text-sm">นับ {workOrder.unit}</div>
                        <div className="text-xs text-gray-600">กรอกจำนวน {workOrder.unit}</div>
                      </button>
                    </div>
                  </div>

                  {/* STEP 2 — The input matching the chosen mode. Prominent sizing +
                      contextual placeholder + dynamic label. */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold">2</span>
                      <h4 className="font-semibold text-gray-800">
                        {inputMode === 'weight' && 'กรอกน้ำหนัก Bulk ที่ชั่งได้'}
                        {inputMode === 'count_cap' && `กรอกจำนวน ${secondaryUnit} ที่นับได้`}
                        {inputMode === 'count_box' && `กรอกจำนวน ${workOrder.unit} ที่ได้`}
                      </h4>
                    </div>
                    <div className="relative">
                      <DxNumberBox
                        value={inputValue}
                        onValueChanged={(e: { value?: number }) => setInputValue(e.value || 0)}
                        format="#,##0.####"
                        min={0}
                        showSpinButtons
                        width="100%"
                        placeholder={
                          inputMode === 'weight' ? 'เช่น 58,800' :
                          inputMode === 'count_cap' ? 'เช่น 98,000' :
                          'เช่น 980'
                        }
                      />
                      <div className="absolute right-14 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500 pointer-events-none">
                        {inputMode === 'weight' ? 'g' : inputMode === 'count_cap' ? secondaryUnit : workOrder.unit}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {inputMode === 'weight' && `ระบบจะคำนวณ จำนวน ${secondaryUnit} และ ${workOrder.unit} ให้อัตโนมัติ`}
                      {inputMode === 'count_cap' && `ระบบจะคำนวณ น้ำหนัก (g) และ ${workOrder.unit} ให้อัตโนมัติ`}
                      {inputMode === 'count_box' && canConvertToCapsule && `ระบบจะคำนวณ จำนวน ${secondaryUnit}${canConvertToWeight ? ' และน้ำหนัก (g)' : ''} ให้อัตโนมัติ`}
                    </p>
                  </div>

                  {/* STEP 3 — Live calculation breakdown (3 derived values) + yield gauge.
                      Shows only when there's an actual value to convert. */}
                  {inputValue > 0 && formData.actualQuantity > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold">3</span>
                        <h4 className="font-semibold text-gray-800">ระบบคำนวณได้</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                        <div className={`p-3 rounded-lg border ${inputMode === 'count_box' ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="text-xs text-gray-600 flex items-center gap-1">📦 หน่วยหลัก</div>
                          <div className="text-xl font-bold text-gray-900">
                            {formatNumber(formData.actualQuantity)}
                          </div>
                          <div className="text-xs text-gray-500">{workOrder.unit}</div>
                        </div>
                        {canConvertToCapsule && (
                          <div className={`p-3 rounded-lg border ${inputMode === 'count_cap' ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="text-xs text-gray-600 flex items-center gap-1">🔢 หน่วยย่อย</div>
                            <div className="text-xl font-bold text-gray-900">
                              {formatNumber(boxToCap(formData.actualQuantity), 2)}
                            </div>
                            <div className="text-xs text-gray-500">{secondaryUnit}</div>
                          </div>
                        )}
                        {canConvertToWeight && (
                          <div className={`p-3 rounded-lg border ${inputMode === 'weight' ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="text-xs text-gray-600 flex items-center gap-1">⚖ น้ำหนัก</div>
                            <div className="text-xl font-bold text-gray-900">
                              {formatNumber(boxToGram(formData.actualQuantity), 2)}
                            </div>
                            <div className="text-xs text-gray-500">g</div>
                          </div>
                        )}
                      </div>

                      {/* Filled-weight breakdown — น้ำหนักผงยา + แคปซูลเปล่า.
                          Powder per unit = fillWeightMg; empty capsule per unit =
                          emptyCapWeightMg (from the BOM packaging line). When the
                          capsule weight is known the total is a real number; when
                          it isn't, we show only the powder and prompt to set it. */}
                      {canConvertToWeight && (() => {
                        const caps = boxToCap(formData.actualQuantity);
                        const powderG = boxToGram(formData.actualQuantity);
                        const capsG = (caps * emptyCapWeightMg) / 1000;
                        const filledG = boxToFilledGram(formData.actualQuantity);
                        return (
                          <div className="mb-3 p-3 rounded-lg border border-purple-200 bg-purple-50 text-sm">
                            <div className="font-semibold text-purple-900 mb-1">
                              องค์ประกอบน้ำหนัก ({formatNumber(caps, 0)} {secondaryUnit})
                            </div>
                            <div className="space-y-1 text-purple-800">
                              <div className="flex justify-between">
                                <span>ผงยา ({formatNumber(fillWeightMg)} mg/{secondaryUnit})</span>
                                <strong>{formatNumber(powderG, 2)} g</strong>
                              </div>
                              {hasEmptyCapWeight ? (
                                <>
                                  <div className="flex justify-between">
                                    <span>
                                      แคปซูลเปล่า ({formatNumber(emptyCapWeightMg)} mg/{secondaryUnit})
                                      {workOrder.emptyCapsuleItemName ? ` · ${workOrder.emptyCapsuleItemName}` : ''}
                                    </span>
                                    <strong>+ {formatNumber(capsG, 2)} g</strong>
                                  </div>
                                  <div className="flex justify-between pt-1 border-t border-purple-200 text-purple-900">
                                    <span className="font-semibold">น้ำหนักรวมสุดท้าย (ผงยา + แคปซูล)</span>
                                    <strong>{formatNumber(filledG, 2)} g</strong>
                                  </div>
                                </>
                              ) : (
                                <div className="pt-1 border-t border-purple-200 text-xs text-amber-700">
                                  ⚠ ยังไม่ได้ตั้งค่า &ldquo;น้ำหนักต่อหน่วย&rdquo; ของแคปซูลเปล่าใน BOM นี้ — จึงรวมได้เฉพาะน้ำหนักผงยา
                                  กรุณาตั้งน้ำหนักแคปซูลเปล่า (mg/เม็ด) ที่หน้าสินค้าของแคปซูลเปล่า เพื่อให้คำนวณน้ำหนักรวมได้
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Yield gauge */}
                      <div className={`p-3 rounded-lg border ${
                        liveYieldPercent >= 90 ? 'bg-green-50 border-green-200' :
                        liveYieldPercent >= 80 ? 'bg-amber-50 border-amber-200' :
                        'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-sm font-semibold text-gray-800">Yield</span>
                          <span className={`text-2xl font-bold ${
                            liveYieldPercent >= 90 ? 'text-green-700' :
                            liveYieldPercent >= 80 ? 'text-amber-700' :
                            'text-red-700'
                          }`}>{liveYieldPercent.toFixed(2)}%</span>
                        </div>
                        <div className="w-full h-2 bg-white/70 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              liveYieldPercent >= 90 ? 'bg-green-500' :
                              liveYieldPercent >= 80 ? 'bg-amber-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(liveYieldPercent, 100)}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          เทียบแผน {formatNumber(workOrder.plannedQuantity)} {workOrder.unit}
                          {workOrder.bomYieldTarget != null && (
                            <> · เป้า ≥ {Number(workOrder.bomYieldTarget).toFixed(2)}%</>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {tw('form.actualQuantity')} ({workOrder.unit})
                  </label>
                  <DxNumberBox
                    value={formData.actualQuantity}
                    onValueChanged={(e: { value?: number }) =>
                      setFormData(prev => ({ ...prev, actualQuantity: e.value || 0 }))
                    }
                    format="#,##0.####"
                    min={0}
                    showSpinButtons
                    width="100%"
                  />
                  {/* Live yield preview */}
                  {formData.actualQuantity > 0 && (
                    <p className={`text-sm mt-1 ${
                      liveYieldPercent >= 90 ? 'text-green-600' :
                      liveYieldPercent >= 80 ? 'text-amber-600' :
                      'text-red-600'
                    }`}>
                      Yield: {liveYieldPercent.toFixed(2)}% ({formatNumber(formData.actualQuantity)} / {formatNumber(workOrder.plannedQuantity)})
                    </p>
                  )}
                  {workOrder.bomYieldTarget && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      คำนวณจาก BOM Yield Target {Number(workOrder.bomYieldTarget).toFixed(2)}% = {formatNumber(Number(workOrder.plannedQuantity) * Number(workOrder.bomYieldTarget) / 100)} {workOrder.unit}
                    </p>
                  )}
                </div>
              )}

              {/* Finished Goods Loss (auto-calculated) — only for finished stage */}
              {!isBulkStage && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {tw('form.rejectQuantity')} ({workOrder.unit})
                    <span className="text-xs text-gray-400 ml-2">คำนวณอัตโนมัติ = แผน - ได้จริง</span>
                  </label>
                  <DxNumberBox
                    value={formData.rejectQuantity}
                    format="#,##0.####"
                    min={0}
                    readOnly
                    width="100%"
                  />
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatNumber(workOrder.plannedQuantity)} - {formatNumber(formData.actualQuantity)} = {formatNumber(formData.rejectQuantity)} {workOrder.unit}
                  </p>
                </div>
              )}

              {/* Warehouse Selection — only for finished stage */}
              {!isBulkStage && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {tw('form.warehouse')} *
                  </label>
                  <DxSelectBox
                    dataSource={warehouses || []}
                    displayExpr="name"
                    valueExpr="id"
                    value={formData.warehouseId}
                    onValueChanged={(e: { value?: number }) =>
                      setFormData(prev => ({ ...prev, warehouseId: e.value ?? null }))
                    }
                    placeholder={tw('form.warehousePlaceholder')}
                    searchEnabled
                    showClearButton
                    width="100%"
                  />
                </div>
              )}

              {/* MFD + EXP — only for finished stage (audit #24-#28).
                  Empty = backend derives from WO actualStartDate + product shelf life. */}
              {!isBulkStage && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      วันผลิต (MFD)
                    </label>
                    <input
                      type="date"
                      className="w-full border rounded-md px-3 py-2"
                      value={formData.manufacturingDate}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, manufacturingDate: e.target.value }))
                      }
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      ค่าเริ่มต้นจะใช้วันที่เริ่มผลิตจริงของ WO (Actual Start)
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      วันหมดอายุ (EXP)
                    </label>
                    <input
                      type="date"
                      className="w-full border rounded-md px-3 py-2"
                      value={formData.expiryDate}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, expiryDate: e.target.value }))
                      }
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      ค่าเริ่มต้นคำนวณจาก MFD + Shelf life ของสินค้า
                    </p>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {tw('form.notes')}
                </label>
                <DxTextArea
                  value={formData.notes}
                  onValueChanged={(e: { value?: string }) =>
                    setFormData(prev => ({ ...prev, notes: e.value || '' }))
                  }
                  height={80}
                />
              </div>

              {/* Action Buttons — stack on mobile, inline on tablet+ */}
              <div className="flex flex-col-reverse sm:flex-row gap-2 pt-4 border-t border-emerald-50">
                {isEditing && (
                  <DxButton
                    text={tw('form.cancel')}
                    type="normal"
                    stylingMode="outlined"
                    onClick={() => setIsEditing(false)}
                    width="100%"
                  />
                )}
                <DxButton
                  text={recordMutation.isPending ? 'กำลังบันทึก…' : tw('form.submit')}
                  type="success"
                  stylingMode="contained"
                  icon="check"
                  onClick={handleSubmit}
                  disabled={recordMutation.isPending || !formData.actualQuantity || (!isBulkStage && !formData.warehouseId)}
                  width="100%"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

'use client';

/**
 * Production Output / Yield Recording Page
 * Records actual production quantity, reject quantity, and creates finished goods lot
 */

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
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
}

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
  const toast = useToast();
  const queryClient = useQueryClient();
  const t = useTranslations('production');
  const tw = (key: string) => t(`execution.productionOutputPage.${key}`);

  const workOrderId = Number(params.id);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    actualQuantity: 0,
    rejectQuantity: 0,
    warehouseId: null as number | null,
    notes: '',
  });

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

  // Record output mutation
  const recordMutation = useMutation<OutputResponse, Error>({
    mutationFn: async () => {
      const res = await fetch('/api/production/yield', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workOrderId,
          actualQuantity: formData.actualQuantity,
          rejectQuantity: formData.rejectQuantity,
          warehouseId: formData.warehouseId,
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

  const hasRecorded = workOrder?.actualQuantity !== null && workOrder?.actualQuantity !== undefined;
  const isInProgress = workOrder?.status === 'in_progress';
  const showForm = isInProgress && (!hasRecorded || isEditing);

  // Pre-fill form when editing existing
  const handleEdit = () => {
    if (workOrder) {
      setFormData({
        actualQuantity: Number(workOrder.actualQuantity) || 0,
        rejectQuantity: Number(workOrder.rejectQuantity) || 0,
        warehouseId: formData.warehouseId,
        notes: '',
      });
    }
    setIsEditing(true);
  };

  const handleSubmit = () => {
    if (!formData.actualQuantity || formData.actualQuantity <= 0) {
      toast.error(tw('toast.error'), 'Actual quantity must be greater than 0');
      return;
    }
    if (!formData.warehouseId) {
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
        title={tw('title')}
        subtitle={`Batch: ${workOrder.batchNumber} | ${workOrder.productName}`}
        icon={Package}
        iconBgColor="bg-green-100"
        iconColor="text-green-600"
        breadcrumbs={[
          { label: 'Production', href: '/production' },
          { label: 'Work Orders', href: '/production/work-orders' },
          { label: workOrder.woNumber, href: `/production/work-orders/${workOrderId}` },
          { label: 'Execution', href: `/production/work-orders/${workOrderId}/execution` },
          { label: tw('title') },
        ]}
        actions={
          <DxButton
            text={tw('actions.backToExecution')}
            icon="back"
            stylingMode="outlined"
            onClick={() => router.push(`/production/work-orders/${workOrderId}/execution`)}
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
              <p className="font-medium text-lg">{Number(workOrder.plannedQuantity).toLocaleString()} {workOrder.unit}</p>
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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">{tw('form.actualQuantity')}</p>
                  <p className="text-2xl font-bold text-green-700">
                    {Number(workOrder.actualQuantity).toLocaleString()} {workOrder.unit}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{tw('form.rejectQuantity')}</p>
                  <p className="text-xl font-semibold text-red-600">
                    {Number(workOrder.rejectQuantity || 0).toLocaleString()} {workOrder.unit}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{tw('yield.yieldPercent')}</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {workOrder.yieldPercentage ? `${Number(workOrder.yieldPercentage).toFixed(2)}%` : '-'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Yield Calculation Detail */}
          {yieldData && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold">{tw('yield.title')}</h3>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getYieldStatusStyle(yieldData.status)}`}>
                    {getYieldStatusIcon(yieldData.status)}
                    {getYieldStatusLabel(yieldData.status)}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">{tw('yield.theoretical')}</p>
                    <p className="text-lg font-semibold">{yieldData.theoretical.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-500">{tw('yield.actualGood')}</p>
                    <p className="text-lg font-semibold text-green-700">{yieldData.actualGood.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <p className="text-sm text-gray-500">{tw('yield.actualReject')}</p>
                    <p className="text-lg font-semibold text-red-600">{yieldData.actualReject.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-500">{tw('yield.yieldPercent')}</p>
                    <p className="text-lg font-bold text-blue-700">{yieldData.yieldPercent.toFixed(2)}%</p>
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
              {/* Actual Quantity */}
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
                    Yield: {liveYieldPercent.toFixed(2)}% ({formData.actualQuantity.toLocaleString()} / {Number(workOrder.plannedQuantity).toLocaleString()})
                  </p>
                )}
              </div>

              {/* Reject Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {tw('form.rejectQuantity')} ({workOrder.unit})
                </label>
                <DxNumberBox
                  value={formData.rejectQuantity}
                  onValueChanged={(e: { value?: number }) =>
                    setFormData(prev => ({ ...prev, rejectQuantity: e.value || 0 }))
                  }
                  format="#,##0.####"
                  min={0}
                  showSpinButtons
                  width="100%"
                />
              </div>

              {/* Warehouse Selection */}
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

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <DxButton
                  text={tw('form.submit')}
                  type="success"
                  stylingMode="contained"
                  icon="check"
                  onClick={handleSubmit}
                  disabled={recordMutation.isPending || !formData.actualQuantity || !formData.warehouseId}
                />
                {isEditing && (
                  <DxButton
                    text={tw('form.cancel')}
                    type="normal"
                    stylingMode="outlined"
                    onClick={() => setIsEditing(false)}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

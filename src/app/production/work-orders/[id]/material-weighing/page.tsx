'use client';

/**
 * Work Order Material Weighing Page
 * Weigh and verify raw materials according to BOM
 * Form Section: 5 (Material Weighing)
 */

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { useToast } from '@/hooks/use-toast';
import {
  Scale,
  CheckCircle2,
  Clock,
  UserCheck,
  AlertCircle,
  Droplets,
  Beaker,
} from 'lucide-react';

interface MaterialLine {
  id: number;
  bomLineId: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  itemNameTh?: string;
  itemNameEn?: string;
  unit: string;
  plannedQty: number;
  actualQty?: number;
  weighedQty?: number;
  weighedBy?: number;
  weighedByName?: string;
  weighedAt?: string;
  verifiedBy?: number;
  verifiedByName?: string;
  verifiedAt?: string;
  lotId?: number;
  lotNumber?: string;
  status?: string;
  // Water-specific fields
  isWater?: boolean;
  waterDate?: string;
  waterConductivity?: number;
  waterTemperature?: number;
}

interface AvailableLot {
  id: number;
  lotNumber: string;
  availableQty: number;
  unit: string;
  expiryDate: string | null;
  vendorLotNumber: string | null;
  manufacturerName: string | null;
  [key: string]: unknown;
}

interface WorkOrderBasic {
  id: number;
  woNumber: string;
  batchNumber: string;
  productName: string;
  status: string;
}

export default function MaterialWeighingPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useTranslations('production');
  const tw = (key: string) => t(`execution.materialWeighingPage.${key}`);

  const workOrderId = Number(params.id);

  const [selectedMaterial, setSelectedMaterial] = useState<MaterialLine | null>(null);
  const [showWeighDialog, setShowWeighDialog] = useState(false);
  const [formData, setFormData] = useState({
    weighedQty: 0,
    lotId: undefined as number | undefined,
    notes: '',
    // Water fields
    waterDate: '',
    waterConductivity: 0,
    waterTemperature: 0,
  });

  // Fetch Work Order basic info
  const { data: workOrder, isLoading: woLoading } = useQuery<WorkOrderBasic>({
    queryKey: ['work-order', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/detail`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data?.workOrder;
    },
  });

  // Fetch materials
  const { data: materials, isLoading: materialsLoading } = useQuery<MaterialLine[]>({
    queryKey: ['wo-materials', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/material-weighing`);
      const data = await res.json();
      if (!data.success) return [];
      return data.data;
    },
  });

  // Fetch available lots for selected material
  const { data: availableLots, isLoading: lotsLoading } = useQuery<AvailableLot[]>({
    queryKey: ['available-lots', selectedMaterial?.itemId],
    queryFn: async () => {
      if (!selectedMaterial?.itemId) return [];
      const res = await fetch(`/api/inventory/lots/available?itemId=${selectedMaterial.itemId}`);
      const data = await res.json();
      if (!data.success) return [];
      return data.data;
    },
    enabled: !!selectedMaterial?.itemId,
  });

  // Record weight mutation
  const recordWeightMutation = useMutation({
    mutationFn: async ({ materialId, data }: { materialId: number; data: typeof formData }) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/material-weighing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId, ...data }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-materials', workOrderId] });
      toast.success(tw('toast.weightRecorded'), tw('toast.weightRecorded'));
      setShowWeighDialog(false);
      setSelectedMaterial(null);
      setFormData({
        weighedQty: 0,
        lotId: undefined,
        notes: '',
        waterDate: '',
        waterConductivity: 0,
        waterTemperature: 0,
      });
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  // Verify weight mutation
  const verifyWeightMutation = useMutation({
    mutationFn: async (materialId: number) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/material-weighing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-materials', workOrderId] });
      toast.success(tw('toast.weightVerified'), tw('toast.weightVerified'));
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const handleOpenWeighDialog = (material: MaterialLine) => {
    setSelectedMaterial(material);
    setFormData({
      weighedQty: material.plannedQty,
      lotId: material.lotId || undefined,
      notes: '',
      waterDate: material.waterDate || new Date().toISOString().split('T')[0],
      waterConductivity: material.waterConductivity || 0,
      waterTemperature: material.waterTemperature || 25,
    });
    setShowWeighDialog(true);
  };

  const handleSubmitWeight = () => {
    if (!selectedMaterial) return;
    recordWeightMutation.mutate({
      materialId: selectedMaterial.id,
      data: formData,
    });
  };

  const getStatusInfo = (material: MaterialLine) => {
    if (material.verifiedAt) {
      return { status: 'verified', label: tw('progress.verified'), color: 'bg-blue-100 text-blue-700' };
    }
    if (material.weighedAt) {
      return { status: 'weighed', label: tw('progress.weighed'), color: 'bg-green-100 text-green-700' };
    }
    return { status: 'pending', label: 'Pending', color: 'bg-gray-100 text-gray-600' };
  };

  const getDisplayName = (material: MaterialLine) => {
    if (material.itemNameTh && material.itemNameEn) {
      return `${material.itemNameTh} / ${material.itemNameEn}`;
    }
    return material.itemNameTh || material.itemNameEn || material.itemName;
  };

  const formatLotDisplay = (item: AvailableLot) => {
    if (!item) return '';
    const expiry = item.expiryDate
      ? `${tw('form.lot.expiry')}: ${item.expiryDate}`
      : `${tw('form.lot.expiry')}: ${tw('form.lot.noExpiry')}`;
    const vendor = item.vendorLotNumber || item.manufacturerName;
    const vendorPart = vendor ? ` [${vendor}]` : '';
    return `${item.lotNumber} (${item.availableQty?.toFixed(2)} ${item.unit}) - ${expiry}${vendorPart}`;
  };

  const calculateProgress = () => {
    if (!materials || materials.length === 0) return { total: 0, weighed: 0, verified: 0 };
    const total = materials.length;
    const weighed = materials.filter(m => m.weighedAt).length;
    const verified = materials.filter(m => m.verifiedAt).length;
    return { total, weighed, verified };
  };

  const progress = calculateProgress();

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
          text="Back to Work Orders"
          type="normal"
          stylingMode="outlined"
          className="mt-4"
          onClick={() => router.push('/production/work-orders')}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      {/* Header */}
      <ResponsivePageHeader
        title={tw('title')}
        subtitle={`${workOrder.woNumber} | Batch: ${workOrder.batchNumber}`}
        icon={Scale}
        iconBgColor="bg-amber-100"
        iconColor="text-amber-600"
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

      {/* Progress Card */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-amber-800">
                <span className="text-2xl font-bold">{progress.weighed}</span>
                <span className="text-sm">/{progress.total} {tw('progress.weighed')}</span>
              </div>
              <div className="text-blue-800">
                <span className="text-2xl font-bold">{progress.verified}</span>
                <span className="text-sm">/{progress.total} {tw('progress.verified')}</span>
              </div>
            </div>
            <div className="flex-1 max-w-xs mx-4">
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.verified / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
            {progress.verified === progress.total && progress.total > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                {tw('progress.allVerified')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Materials List */}
      <Card>
        <CardContent className="p-4">
          {materialsLoading ? (
            <div className="flex items-center justify-center h-40">
              <DxLoadIndicator />
            </div>
          ) : !materials || materials.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
              <p className="text-gray-500">{tw('noMaterials')}</p>
              <p className="text-sm text-gray-400 mt-2">{tw('noMaterialsHint')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {materials.map((material) => {
                const statusInfo = getStatusInfo(material);
                const variance = material.weighedQty
                  ? ((material.weighedQty - material.plannedQty) / material.plannedQty * 100).toFixed(1)
                  : null;

                return (
                  <div
                    key={material.id}
                    className="flex items-center justify-between p-4 bg-white border rounded-lg hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${material.isWater ? 'bg-blue-100' : 'bg-amber-100'}`}>
                        {material.isWater ? (
                          <Droplets className="h-5 w-5 text-blue-600" />
                        ) : (
                          <Beaker className="h-5 w-5 text-amber-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-gray-500">{material.itemCode}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                          {material.isWater && (
                            <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">Water</span>
                          )}
                        </div>
                        <p className="font-medium text-gray-900">{getDisplayName(material)}</p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                          <span>
                            {tw('material.planned')}: <strong>{material.plannedQty} {material.unit}</strong>
                          </span>
                          {material.weighedQty && (
                            <>
                              <span>
                                {tw('material.actual')}: <strong>{material.weighedQty} {material.unit}</strong>
                              </span>
                              <span className={variance && parseFloat(variance) !== 0 ? 'text-amber-600' : 'text-green-600'}>
                                {tw('material.variance')}: {variance}%
                              </span>
                            </>
                          )}
                        </div>
                        {material.lotNumber && (
                          <p className="text-xs text-gray-500 mt-1">{tw('material.lot')}: {material.lotNumber}</p>
                        )}
                        {material.weighedByName && (
                          <div className="mt-1 text-xs text-gray-500 flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(material.weighedAt!).toLocaleString()}
                            </span>
                            <span>by {material.weighedByName}</span>
                            {material.verifiedByName && (
                              <span className="flex items-center gap-1 text-blue-600">
                                <UserCheck className="h-3 w-3" />
                                Verified by {material.verifiedByName}
                              </span>
                            )}
                          </div>
                        )}
                        {/* Water quality info */}
                        {material.isWater && material.waterConductivity && (
                          <div className="mt-1 text-xs text-blue-600">
                            Conductivity: {material.waterConductivity} µS·cm⁻¹ |
                            Temperature: {material.waterTemperature}°C |
                            Date: {material.waterDate}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {!material.weighedAt ? (
                        <DxButton
                          text={tw('actions.weigh')}
                          type="success"
                          onClick={() => handleOpenWeighDialog(material)}
                        />
                      ) : !material.verifiedAt ? (
                        material.status === 'issued' ? (
                          <DxButton
                            text={tw('actions.verify')}
                            type="default"
                            onClick={() => verifyWeightMutation.mutate(material.id)}
                            disabled={verifyWeightMutation.isPending}
                          />
                        ) : (
                          <span className="text-xs text-red-500 text-right max-w-[140px]">
                            ไม่สามารถ Verify ได้ — ยอดคงเหลือในคลังเป็น 0
                          </span>
                        )
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weigh Dialog */}
      <DxPopup
        visible={showWeighDialog}
        onHiding={() => {
          setShowWeighDialog(false);
          setSelectedMaterial(null);
        }}
        title={`${tw('actions.weigh')}: ${selectedMaterial ? getDisplayName(selectedMaterial) : ''}`}
        width={500}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-4">
          <div className="bg-amber-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-mono text-sm text-amber-700">{selectedMaterial?.itemCode}</p>
                <p className="font-medium text-amber-900">{selectedMaterial ? getDisplayName(selectedMaterial) : ''}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-amber-700">{tw('material.planned')}</p>
                <p className="text-xl font-bold text-amber-900">
                  {selectedMaterial?.plannedQty} {selectedMaterial?.unit}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tw('form.actualWeight')} *</label>
              <DxNumberBox
                value={formData.weighedQty}
                onValueChanged={(e) => setFormData({ ...formData, weighedQty: e.value })}
                format="#0.000"
                min={0}
                showSpinButtons
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tw('form.lot.label')}
              </label>
              <DxSelectBox
                value={formData.lotId}
                onValueChange={(value) => setFormData({ ...formData, lotId: value || undefined })}
                dataSource={availableLots || []}
                valueExpr="id"
                displayExpr={(item: Record<string, unknown>) => formatLotDisplay(item as unknown as AvailableLot)}
                placeholder={lotsLoading ? 'Loading lots...' : tw('form.lot.placeholder')}
                disabled={lotsLoading}
                searchEnabled
                searchExpr="lotNumber"
                showClearButton
                noDataText={tw('form.lot.noData')}
              />
            </div>
          </div>

          {/* Variance indicator */}
          {selectedMaterial && formData.weighedQty > 0 && (
            <div className={`rounded-lg p-3 ${
              Math.abs((formData.weighedQty - selectedMaterial.plannedQty) / selectedMaterial.plannedQty * 100) > 5
                ? 'bg-amber-50 border border-amber-200'
                : 'bg-green-50 border border-green-200'
            }`}>
              <p className="text-sm">
                {tw('material.variance')}:{' '}
                <strong>
                  {((formData.weighedQty - selectedMaterial.plannedQty) / selectedMaterial.plannedQty * 100).toFixed(2)}%
                </strong>
                {Math.abs((formData.weighedQty - selectedMaterial.plannedQty) / selectedMaterial.plannedQty * 100) > 5 && (
                  <span className="text-amber-600 ml-2">({tw('form.varianceWarning')})</span>
                )}
              </p>
            </div>
          )}

          {/* Water-specific fields */}
          {selectedMaterial?.isWater && (
            <div className="bg-blue-50 rounded-lg p-4 space-y-3">
              <h5 className="font-medium text-blue-800 flex items-center gap-2">
                <Droplets className="h-4 w-4" />
                Water Quality Parameters
              </h5>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-blue-700 mb-1">Date</label>
                  <DxTextBox
                    value={formData.waterDate}
                    onValueChanged={(e) => setFormData({ ...formData, waterDate: e.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-blue-700 mb-1">Conductivity (µS·cm⁻¹)</label>
                  <DxNumberBox
                    value={formData.waterConductivity}
                    onValueChanged={(e) => setFormData({ ...formData, waterConductivity: e.value })}
                    format="#0.0"
                    showSpinButtons
                  />
                </div>
                <div>
                  <label className="block text-xs text-blue-700 mb-1">Temperature (°C)</label>
                  <DxNumberBox
                    value={formData.waterTemperature}
                    onValueChanged={(e) => setFormData({ ...formData, waterTemperature: e.value })}
                    format="#0.0"
                    showSpinButtons
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tw('form.notes')}</label>
            <DxTextArea
              value={formData.notes}
              onValueChanged={(e) => setFormData({ ...formData, notes: e.value })}
              placeholder="Any observations..."
              height={60}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton text={tw('form.cancel')} stylingMode="outlined" onClick={() => setShowWeighDialog(false)} />
            <DxButton
              text={tw('form.recordWeight')}
              type="success"
              onClick={handleSubmitWeight}
              disabled={recordWeightMutation.isPending || formData.weighedQty <= 0}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}

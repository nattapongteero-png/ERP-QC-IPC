'use client';

/**
 * Work Order Material Weighing Page
 * Weigh and verify raw materials according to BOM
 * Form Section: 5 (Material Weighing)
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toLocalDateStr } from '@/lib/utils/date-format';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRealtimeTopic } from '@/hooks/use-realtime-topic';
import { ResponsivePageHeader, AwaitingOtherVerifierBadge } from '@/components/shared';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Card, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxNumberBox } from '@/components/ui/dx-number-box';

import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { useToast } from '@/hooks/use-toast';
import {
  MaterialReturnDialog,
  type MaterialReturnSourceMaterial,
} from '@/components/production/material-return-dialog';
import {
  Scale,
  CheckCircle2,
  Clock,
  UserCheck,
  AlertCircle,
  AlertTriangle,
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
  itemAvailableQty?: number;
  primaryUnit?: string;
  secondaryUnit?: string;
  conversionRate?: number;
  // 3-level unit conversion (Step 1) + issuance tracking (Step 2)
  weightUnit?: string | null;
  secondaryToWeightRate?: number | null;
  weightTrackingEnabled?: boolean | number | null;
  issuedQtySU?: number | null;
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
  // GMP dual-control: a material's weigher can't verify their own work
  const { data: currentUser } = useCurrentUser();
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useTranslations('production');
  const tw = (key: string) => t(`execution.materialWeighingPage.${key}`);

  const workOrderId = Number(params.id);

  const [selectedMaterial, setSelectedMaterial] = useState<MaterialLine | null>(null);
  const [showWeighDialog, setShowWeighDialog] = useState(false);
  // Material-return state — separate from the weigh dialog so they can't
  // interfere with each other.
  const [returnMaterial, setReturnMaterial] = useState<MaterialReturnSourceMaterial | null>(null);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  // When set, the dialog opens in edit mode (PATCH instead of POST).
  const [editingReturnId, setEditingReturnId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    weighedQty: 0,
    // Single-select: the DB stores exactly one primary lot id on
    // work_order_materials.lotId. Using a scalar here (instead of an
    // array) keeps the UI state, save payload, and persisted DB value in
    // lockstep so the checkbox always reflects what is actually saved.
    selectedLotId: undefined as number | undefined,
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
  const { data: materialsResult, isLoading: materialsLoading } = useQuery<{
    materials: MaterialLine[];
    requisitionStatus: string;
  }>({
    queryKey: ['wo-materials', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/material-weighing`);
      const data = await res.json();
      if (!data.success) return { materials: [], requisitionStatus: 'none' };
      // Handle both old format (array) and new format ({ materials, requisitionStatus })
      const rawData = data.data;
      if (Array.isArray(rawData)) {
        return { materials: rawData, requisitionStatus: 'none' };
      }
      return {
        materials: rawData?.materials || [],
        requisitionStatus: rawData?.requisitionStatus || 'none',
      };
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const materials = materialsResult?.materials || [];
  const requisitionStatus = materialsResult?.requisitionStatus || 'none';

  // Fetch material returns for this WO so we can show inline status badges
  // ("✓ คืนแล้ว N kg · pending QA") on each material row that has a return.
  // Refreshed on every successful submit via query invalidation.
  interface MaterialReturnRow {
    id: number;
    returnNumber: string;
    status: string;
  }
  interface MaterialReturnLineSlim {
    sourceLotId: number;
    itemId: number;
    returnQty: number;
    returnUnit: string;
    status: string;
    returnNumber: string;
    returnId: number;
  }
  const { data: returnsForWo } = useQuery<MaterialReturnLineSlim[]>({
    queryKey: ['material-returns', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/returns?workOrderId=${workOrderId}&limit=200`);
      const data = await res.json();
      if (!data.success) return [];
      const rows: MaterialReturnRow[] = data.data?.items || [];
      // Fetch each return's detail to get line-level info (sourceLotId + qty).
      // N+1 is acceptable here — typical WO has < 5 returns.
      const all: MaterialReturnLineSlim[] = [];
      for (const r of rows) {
        try {
          const detRes = await fetch(`/api/inventory/returns/${r.id}`);
          const detJson = await detRes.json();
          if (!detJson.success) continue;
          const detail = detJson.data;
          for (const line of (detail?.lines ?? []) as Array<{
            sourceLot?: { id: number } | null;
            itemId: number;
            returnQty: number;
            returnUnit: string;
          }>) {
            const lotId = line.sourceLot?.id;
            if (!lotId) continue;
            all.push({
              sourceLotId: lotId,
              itemId: Number(line.itemId),
              returnQty: Number(line.returnQty),
              returnUnit: String(line.returnUnit),
              status: String(detail.status),
              returnNumber: String(detail.returnNumber),
              returnId: Number(detail.id ?? r.id),
            });
          }
        } catch {
          // Ignore individual fetch failures — partial data is better than nothing.
        }
      }
      return all;
    },
    enabled: !!workOrderId,
    staleTime: 30_000,
  });

  // Helper: aggregate returns per (lotId + itemId). The "actionable" return id
  // is whichever line is in 'submitted' status (one in flight at a time per
  // material in the typical flow). Track 'received' separately so the UI can
  // show the badge + suppress the button.
  const returnsByLotItem = (() => {
    const map = new Map<string, {
      totalQty: number;
      unit: string;
      statuses: string[];
      submittedReturnId: number | null;
      receivedReturnId: number | null;
    }>();
    for (const ret of returnsForWo ?? []) {
      const key = `${ret.sourceLotId}:${ret.itemId}`;
      const slot = map.get(key) ?? {
        totalQty: 0,
        unit: ret.returnUnit,
        statuses: [],
        submittedReturnId: null as number | null,
        receivedReturnId: null as number | null,
      };
      slot.totalQty += ret.returnQty;
      slot.statuses.push(ret.status);
      if (ret.status === 'submitted' && slot.submittedReturnId == null) {
        slot.submittedReturnId = ret.returnId;
      }
      if (ret.status === 'received' && slot.receivedReturnId == null) {
        slot.receivedReturnId = ret.returnId;
      }
      map.set(key, slot);
    }
    return map;
  })();
  const getReturnSummary = (m: MaterialLine) => {
    if (!m.lotId) return null;
    return returnsByLotItem.get(`${m.lotId}:${m.itemId}`) ?? null;
  };

  // Auto-update when warehouse approves/rejects this WO's requisition
  // from another browser (e.g. /inventory/lots) — flips status without refresh.
  useRealtimeTopic('requisition-changed', (data) => {
    const eventWorkOrderId = data.workOrderId as number | undefined;
    if (eventWorkOrderId !== workOrderId) return;
    queryClient.invalidateQueries({ queryKey: ['wo-materials', workOrderId] });
    queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
  });

  // Auto-refresh when another user weighs/verifies a material on this WO
  useRealtimeTopic('work-order-changed', (data) => {
    if (data.workOrderId !== workOrderId) return;
    if (data.section !== 'material-weighing' && data.section !== 'status') return;
    queryClient.invalidateQueries({ queryKey: ['wo-materials', workOrderId] });
    queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
  });

  // Prefetch available lots for all materials so they're cached before Edit click
  useEffect(() => {
    const itemIds = [...new Set(materials.map(m => m.itemId))];
    itemIds.forEach(itemId => {
      if (!itemId) return;
      queryClient.prefetchQuery({
        queryKey: ['available-lots', itemId],
        queryFn: async () => {
          const res = await fetch(`/api/inventory/lots/available?itemId=${itemId}`);
          const data = await res.json();
          return data.success ? data.data : [];
        },
        staleTime: 30000,
      });
    });
  }, [materials.length, queryClient]);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async ({ materialId, data }: { materialId: number; data: Record<string, any> }) => {
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
        selectedLotId: undefined,
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
      if (!result.success) {
        // Tag dual-control violations so the toast can show the right
        // icon/title. The backend returns 422 for dual-control errors.
        const err = new Error(result.error || 'Verify failed') as Error & { statusCode?: number; isDualControl?: boolean };
        err.statusCode = res.status;
        err.isDualControl =
          res.status === 422 ||
          (typeof result.error === 'string' && (
            result.error.includes('ตรวจสอบรายการของตนเอง') ||
            result.error.includes('ผู้ปฏิบัติและผู้ตรวจสอบ')
          ));
        throw err;
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-materials', workOrderId] });
      toast.success(tw('toast.weightVerified'), tw('toast.weightVerified'));
    },
    onError: (error: Error & { isDualControl?: boolean }) => {
      // Dual-control violation: show a clear, actionable message with
      // its own title so the operator understands what to do.
      if (error.isDualControl) {
        toast.error(
          'ไม่สามารถตรวจสอบได้ (Dual Control)',
          error.message || 'ผู้สร้างรายการและผู้ตรวจสอบต้องเป็นคนละคน กรุณาให้เจ้าหน้าที่ท่านอื่นมาตรวจสอบแทน',
        );
        return;
      }
      toast.error('ไม่สามารถบันทึกได้', error.message);
    },
  });

  // Auto-pick the primary lot via FEFO (earliest expiry that has stock).
  //
  // Important: the backend's work_order_materials table only stores ONE
  // lot id per material row (lotId FK). The verify step uses FEFO at that
  // point to pull from additional lots if the primary lot's stock is not
  // enough. So from the user's perspective, this screen only needs to
  // capture the **primary lot preference** — the allocation engine handles
  // the rest on verify.
  const autoPickPrimaryLot = (
    lots: AvailableLot[],
    weighedQty: number,
    material: MaterialLine | null,
  ): number | undefined => {
    if (!lots || lots.length === 0 || weighedQty <= 0) return undefined;
    void material; // reserved for future per-material FEFO rules
    // FEFO already sorted by backend — pick the first lot that has any stock.
    const first = lots.find((l) => (l.availableQty ?? 0) > 0);
    return first?.id;
  };

  const handleOpenWeighDialog = (material: MaterialLine) => {
    setSelectedMaterial(material);
    // Load the persisted primary lot (or undefined if never saved). This
    // is the single source of truth for the checkbox state — no derived
    // array wrapping, so reopening this dialog always shows exactly what
    // the DB has.
    // When re-editing a previously weighed material, prefer the saved
    // weighedQty so the operator sees what was last recorded (not the
    // BOM planned figure).
    const initialWeighedQty =
      material.weighedQty != null && Number(material.weighedQty) > 0
        ? Number(material.weighedQty)
        : material.plannedQty;
    setFormData({
      weighedQty: initialWeighedQty,
      selectedLotId: material.lotId ?? undefined,
      notes: '',
      waterDate: material.waterDate || toLocalDateStr(new Date()),
      waterConductivity: material.waterConductivity || 0,
      waterTemperature: material.waterTemperature || 25,
    });
    setShowWeighDialog(true);
  };

  const handleSubmitWeight = () => {
    if (!selectedMaterial) return;

    // Auto-pick primary lot via FEFO if user hasn't chosen one. The verify
    // step uses multi-lot FEFO allocation if this primary lot's stock is
    // short, so we only need to persist the user's preferred primary lot.
    let lotId = formData.selectedLotId;
    if (lotId === undefined && availableLots && availableLots.length > 0) {
      lotId = autoPickPrimaryLot(availableLots, formData.weighedQty, selectedMaterial);
    }

    recordWeightMutation.mutate({
      materialId: selectedMaterial.id,
      data: {
        weighedQty: formData.weighedQty,
        lotId,
        notes: formData.notes,
        waterDate: formData.waterDate,
        waterConductivity: formData.waterConductivity,
        waterTemperature: formData.waterTemperature,
      },
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

      {/* Requisition Gate Warning */}
      {requisitionStatus !== 'approved' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800">ยังไม่สามารถชั่งวัตถุดิบได้</p>
            <p className="text-sm text-amber-700">
              {requisitionStatus === 'none'
                ? 'กรุณาส่งใบเบิกวัตถุดิบก่อนที่หน้า Execution Dashboard'
                : 'รอคลังอนุมัติใบเบิกวัตถุดิบ'}
            </p>
          </div>
        </div>
      )}

      {/* Progress Card — stacks on mobile so the progress bar gets full
          width instead of being squeezed between the two stats blocks. */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="text-amber-800">
                <span className="text-2xl font-bold">{progress.weighed}</span>
                <span className="text-sm">/{progress.total} {tw('progress.weighed')}</span>
              </div>
              <div className="text-blue-800">
                <span className="text-2xl font-bold">{progress.verified}</span>
                <span className="text-sm">/{progress.total} {tw('progress.verified')}</span>
              </div>
            </div>
            <div className="flex-1 sm:max-w-xs sm:mx-2">
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.verified / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
            {progress.verified === progress.total && progress.total > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 font-medium self-start sm:self-auto">
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
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-white border rounded-lg hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start gap-4 min-w-0 flex-1">
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
                              {new Date(material.weighedAt!).toLocaleString('th-TH')}
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
                        {/* Inline material-return status — visible whenever a
                            return line exists for this source lot. Shows
                            total returned qty and the most-recent status. */}
                        {(() => {
                          const ret = getReturnSummary(material);
                          if (!ret) return null;
                          const isPending = ret.statuses.some((s) => s === 'submitted');
                          const isReceived = ret.statuses.every((s) => s === 'received');
                          const isRejected = ret.statuses.every((s) => s === 'rejected');
                          const statusText = isReceived
                            ? 'approved'
                            : isPending
                              ? 'pending QA'
                              : isRejected
                                ? 'rejected'
                                : ret.statuses.join(', ');
                          const colorClasses = isReceived
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : isRejected
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200';
                          return (
                            <div
                              className={`mt-2 inline-flex items-center gap-2 px-2 py-1 text-xs border rounded ${colorClasses}`}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              <span>
                                คืนแล้ว {ret.totalQty.toFixed(3)} {ret.unit} · {statusText}
                              </span>
                            </div>
                          );
                        })()}
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
                    <div className="flex flex-col sm:items-end items-stretch gap-1 sm:flex-shrink-0">
                      {/* "คืนของเหลือ" button — visible whenever the row has
                          been weighed AND a source lot is recorded. The dialog
                          lets the operator declare issued/used/return separately
                          (issued may exceed weighed if the operator pulled a
                          larger bag than was put into the batch). Server
                          enforces per-line caps via materialReturnLineInputSchema. */}
                      {material.weighedAt && material.lotId && (material.weighedQty ?? 0) > 0 && (() => {
                        const issued = material.weighedQty ?? 0;
                        const planned = material.plannedQty ?? 0;
                        const summary = getReturnSummary(material);
                        const isReceived = summary?.receivedReturnId != null;
                        const submittedId = summary?.submittedReturnId ?? null;

                        // Already received → just show the badge, no button.
                        if (isReceived) {
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" />
                              {t('execution.materialReturnDialog.badgeReceived')}
                            </span>
                          );
                        }

                        const openDialog = (mode: 'create' | 'edit') => {
                          setReturnMaterial({
                            workOrderMaterialId: material.id,
                            itemId: material.itemId,
                            itemCode: material.itemCode,
                            itemName: getDisplayName(material),
                            unit: material.unit,
                            plannedQty: planned,
                            weighedQty: issued,
                            lotId: material.lotId ?? null,
                            lotNumber: material.lotNumber ?? null,
                            // 3-level unit conversion fields (Step 3)
                            primaryUnit: material.primaryUnit,
                            secondaryUnit: material.secondaryUnit,
                            weightUnit: material.weightUnit,
                            conversionRate: material.conversionRate,
                            secondaryToWeightRate: material.secondaryToWeightRate != null ? Number(material.secondaryToWeightRate) : null,
                            weightTrackingEnabled: Boolean(material.weightTrackingEnabled),
                            issuedQtySU: material.issuedQtySU != null ? Number(material.issuedQtySU) : null,
                          });
                          setEditingReturnId(mode === 'edit' ? submittedId : null);
                          setShowReturnDialog(true);
                        };

                        return submittedId != null ? (
                          <div className="flex flex-col gap-1 items-stretch">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                              <Clock className="h-3 w-3" />
                              {t('execution.materialReturnDialog.badgePending')}
                            </span>
                            <DxButton
                              text={t('execution.materialReturnDialog.buttonEdit')}
                              icon="edit"
                              type="normal"
                              stylingMode="outlined"
                              onClick={() => openDialog('edit')}
                            />
                          </div>
                        ) : (
                          <DxButton
                            text={t('execution.materialReturnDialog.buttonSubmit')}
                            icon="undo"
                            type="normal"
                            stylingMode="outlined"
                            onClick={() => openDialog('create')}
                          />
                        );
                      })()}
                      {!material.weighedAt ? (
                        <DxButton
                          text={tw('actions.weigh')}
                          type="success"
                          onClick={() => handleOpenWeighDialog(material)}
                          disabled={requisitionStatus !== 'approved'}
                        />
                      ) : !material.verifiedAt ? (
                        <>
                          <div className="flex gap-2">
                            <DxButton
                              text="Edit"
                              type="normal"
                              stylingMode="outlined"
                              onClick={() => handleOpenWeighDialog(material)}
                              disabled={requisitionStatus !== 'approved'}
                            />
                            {(material.itemAvailableQty ?? 0) > 0 ? (
                              currentUser?.id === material.weighedBy ? (
                                <AwaitingOtherVerifierBadge />
                              ) : (
                                <DxButton
                                  text={tw('actions.verify')}
                                  type="default"
                                  onClick={() => verifyWeightMutation.mutate(material.id)}
                                  disabled={verifyWeightMutation.isPending || requisitionStatus !== 'approved'}
                                />
                              )
                            ) : (
                              <span className="text-xs text-red-500 self-center max-w-[140px] text-right">
                                ยอดคงเหลือในคลังเป็น 0
                              </span>
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weigh Dialog — key forces remount so checkbox state always syncs from formData */}
      <DxPopup
        key={selectedMaterial?.id ?? 'none'}
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

          {/* Lot selection (single-select).
              The DB stores ONE primary lot per material row. This UI uses a
              checkbox appearance (familiar to users) but enforces single-
              selection — clicking a lot replaces the previous one. Clicking
              the already-selected lot clears it. This guarantees what the
              user sees in the form always matches workOrderMaterials.lotId. */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                {tw('form.lot.label')} <span className="text-xs text-gray-400 font-normal">(FEFO — ใกล้หมดอายุก่อน · เลือก 1 lot)</span>
              </label>
              {availableLots && availableLots.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const primary = autoPickPrimaryLot(availableLots, formData.weighedQty, selectedMaterial);
                    setFormData({ ...formData, selectedLotId: primary });
                  }}
                  className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                >
                  เลือกอัตโนมัติ (FEFO)
                </button>
              )}
            </div>
            {lotsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                <DxLoadIndicator height={16} width={16} /> Loading lots...
              </div>
            ) : !availableLots || availableLots.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">{tw('form.lot.noData')}</p>
            ) : (
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {availableLots.map((lot) => {
                  const isChecked = formData.selectedLotId === lot.id;
                  const expiry = lot.expiryDate
                    ? new Date(lot.expiryDate).toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric' })
                    : 'ไม่ระบุ';
                  return (
                    <label
                      key={lot.id}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${isChecked ? 'bg-emerald-50' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          // Single-select: toggling a different lot replaces
                          // the previous one. Toggling the same lot clears.
                          setFormData({
                            ...formData,
                            selectedLotId: isChecked ? undefined : lot.id,
                          });
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">{lot.lotNumber}</span>
                          <span className="text-xs text-gray-500">
                            {lot.availableQty?.toFixed(2)} {lot.unit}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">
                          หมดอายุ: {expiry}
                          {lot.vendorLotNumber && ` | Vendor: ${lot.vendorLotNumber}`}
                          {lot.manufacturerName && ` | ${lot.manufacturerName}`}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            {/* Selection summary */}
            {formData.selectedLotId !== undefined && availableLots && (() => {
              const selected = availableLots.find((l) => l.id === formData.selectedLotId);
              if (!selected) return null;
              return (
                <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded px-3 py-1.5">
                  เลือก 1 lot ({selected.lotNumber})
                  {' — '}
                  คงเหลือ {selected.availableQty?.toFixed(2)} {selected.unit}
                </div>
              );
            })()}
            {formData.selectedLotId === undefined && formData.weighedQty > 0 && (
              <p className="mt-1 text-xs text-amber-600">
                ไม่ได้เลือก lot — ระบบจะเลือกอัตโนมัติ (FEFO) เมื่อกดบันทึก
              </p>
            )}
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

      {/* Material Return Dialog (Phase 3) — operator submits excess back to
          warehouse. Refreshes both the material list and the per-WO returns
          query so the inline status badge updates immediately. */}
      <MaterialReturnDialog
        visible={showReturnDialog}
        material={returnMaterial}
        workOrderId={workOrderId}
        existingReturnId={editingReturnId}
        onClose={() => {
          setShowReturnDialog(false);
          setReturnMaterial(null);
          setEditingReturnId(null);
        }}
        onSubmitted={(returnNumber) => {
          toast.success(
            editingReturnId ? 'แก้ไขใบคืนของแล้ว' : 'ส่งคืนวัตถุดิบสำเร็จ',
            returnNumber ? `เลขที่ ${returnNumber} รอ QA ตรวจสอบ` : 'รอ QA ตรวจสอบ',
          );
          queryClient.invalidateQueries({ queryKey: ['wo-materials', workOrderId] });
          queryClient.invalidateQueries({ queryKey: ['material-returns', workOrderId] });
          setShowReturnDialog(false);
          setReturnMaterial(null);
          setEditingReturnId(null);
        }}
        onError={(msg) => {
          toast.error('ส่งคืนวัตถุดิบไม่สำเร็จ', msg);
        }}
      />
    </div>
  );
}

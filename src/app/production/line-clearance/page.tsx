'use client';

import { useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { PageHeader } from '@/components/ui/page-header';
import { LineClearanceForm } from '@/components/production/line-clearance-form';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { ClipboardCheck, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WorkOrder {
  id: number;
  woNumber: string;
  productName: string;
  status: string;
  lineClearanceRequired: boolean;
  lineClearanceStatus: string | null;
}

interface LineClearanceData {
  workOrderId: number;
  required: boolean;
  status: 'not_started' | 'pending' | 'performed' | 'verified' | 'rejected';
  canStartProduction: boolean;
  message: string;
  checklist?: {
    id: number;
    previousProductCleared: boolean;
    areaClean: boolean;
    equipmentClean: boolean;
    noContaminationRisk: boolean;
    labelsRemoved: boolean;
    docsReady: boolean;
    notes: string | null;
    status: string;
  };
  details?: {
    checklist: object;
    performerName?: string;
    verifierName?: string;
    signatures: Array<object>;
  };
}

function LineClearanceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const workOrderIdParam = searchParams.get('workOrderId');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<number | null>(
    workOrderIdParam ? parseInt(workOrderIdParam) : null
  );

  // Fetch work orders that need line clearance
  const { data: workOrders, isLoading: isLoadingWorkOrders } = useQuery({
    queryKey: ['work-orders-for-line-clearance'],
    queryFn: async () => {
      const response = await fetch('/api/production/work-orders?status=released&limit=100');
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data.items as WorkOrder[];
    },
  });

  // Fetch line clearance data for selected work order
  const { data: lineClearanceData, isLoading: isLoadingClearance, refetch: refetchClearance } = useQuery({
    queryKey: ['line-clearance', selectedWorkOrderId],
    queryFn: async () => {
      if (!selectedWorkOrderId) return null;
      const response = await fetch(`/api/production/work-orders/${selectedWorkOrderId}/line-clearance`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data as LineClearanceData;
    },
    enabled: !!selectedWorkOrderId,
  });

  // Perform line clearance mutation
  const performMutation = useMutation({
    mutationFn: async ({
      checklistData,
      password,
    }: {
      checklistData: {
        previousProductCleared: boolean;
        areaClean: boolean;
        equipmentClean: boolean;
        noContaminationRisk: boolean;
        labelsRemoved: boolean;
        docsReady: boolean;
        notes?: string;
      };
      password: string;
    }) => {
      const response = await fetch(`/api/production/work-orders/${selectedWorkOrderId}/line-clearance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...checklistData, password }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success('Line clearance performed successfully');
      queryClient.invalidateQueries({ queryKey: ['line-clearance', selectedWorkOrderId] });
      queryClient.invalidateQueries({ queryKey: ['work-orders-for-line-clearance'] });
      refetchClearance();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Verify line clearance mutation
  const verifyMutation = useMutation({
    mutationFn: async ({
      approved,
      password,
      notes,
    }: {
      approved: boolean;
      password: string;
      notes?: string;
    }) => {
      const response = await fetch(`/api/production/work-orders/${selectedWorkOrderId}/line-clearance/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, password, notes }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.approved
          ? 'Line clearance verified successfully'
          : 'Line clearance rejected'
      );
      queryClient.invalidateQueries({ queryKey: ['line-clearance', selectedWorkOrderId] });
      queryClient.invalidateQueries({ queryKey: ['work-orders-for-line-clearance'] });
      refetchClearance();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handlePerform = useCallback(
    async (
      checklistData: {
        previousProductCleared: boolean;
        areaClean: boolean;
        equipmentClean: boolean;
        noContaminationRisk: boolean;
        labelsRemoved: boolean;
        docsReady: boolean;
        notes?: string;
      },
      password: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        await performMutation.mutateAsync({ checklistData, password });
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
    [performMutation]
  );

  const handleVerify = useCallback(
    async (
      approved: boolean,
      password: string,
      notes?: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        await verifyMutation.mutateAsync({ approved, password, notes });
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
    [verifyMutation]
  );

  // Get selected work order details
  const selectedWorkOrder = workOrders?.find((wo) => wo.id === selectedWorkOrderId);

  // Work order selector items
  const workOrderItems =
    workOrders?.map((wo) => ({
      value: wo.id,
      label: `${wo.woNumber} - ${wo.productName}`,
    })) ?? [];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Line Clearance"
          description="Complete line clearance verification before production start (FR-062)"
          actions={
            <DxButton
              text="Back to Work Orders"
              icon="arrowleft"
              onClick={() => router.push('/production/work-orders')}
              type="normal"
              stylingMode="outlined"
            />
          }
        />

        {/* Work Order Selector */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Select Work Order</h3>
          <div className="max-w-lg">
            <DxSelectBox
              items={workOrderItems}
              value={selectedWorkOrderId}
              onValueChange={(value) => {
                setSelectedWorkOrderId(value);
                if (value) {
                  router.push(`/production/line-clearance?workOrderId=${value}`);
                }
              }}
              placeholder="Select a work order..."
              searchEnabled
              showClearButton
              disabled={isLoadingWorkOrders}
            />
          </div>
          {isLoadingWorkOrders && (
            <div className="flex items-center gap-2 text-gray-500 mt-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading work orders...</span>
            </div>
          )}
          {workOrders?.length === 0 && !isLoadingWorkOrders && (
            <div className="flex items-center gap-2 text-amber-600 mt-2">
              <AlertCircle className="h-4 w-4" />
              <span>No released work orders found. Work orders must be in &quot;Released&quot; status for line clearance.</span>
            </div>
          )}
        </div>

        {/* Line Clearance Form */}
        {selectedWorkOrderId && (
          <>
            {isLoadingClearance ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12">
                <div className="flex flex-col items-center justify-center text-gray-500">
                  <Loader2 className="h-8 w-8 animate-spin mb-4" />
                  <p>Loading line clearance data...</p>
                </div>
              </div>
            ) : lineClearanceData ? (
              <LineClearanceForm
                workOrderId={selectedWorkOrderId}
                workOrderNumber={selectedWorkOrder?.woNumber ?? `WO-${selectedWorkOrderId}`}
                productName={selectedWorkOrder?.productName}
                initialData={
                  lineClearanceData.checklist
                    ? {
                        previousProductCleared: lineClearanceData.checklist.previousProductCleared,
                        areaClean: lineClearanceData.checklist.areaClean,
                        equipmentClean: lineClearanceData.checklist.equipmentClean,
                        noContaminationRisk: lineClearanceData.checklist.noContaminationRisk,
                        labelsRemoved: lineClearanceData.checklist.labelsRemoved,
                        docsReady: lineClearanceData.checklist.docsReady,
                        notes: lineClearanceData.checklist.notes ?? undefined,
                      }
                    : undefined
                }
                status={lineClearanceData.status}
                performerName={lineClearanceData.details?.performerName}
                performedAt={undefined}
                verifierName={lineClearanceData.details?.verifierName}
                verifiedAt={undefined}
                onPerform={handlePerform}
                onVerify={handleVerify}
                isPerformer={lineClearanceData.status === 'not_started' || lineClearanceData.status === 'rejected'}
                isVerifier={lineClearanceData.status === 'performed'}
                readOnly={lineClearanceData.status === 'verified'}
              />
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12">
                <div className="flex flex-col items-center justify-center text-gray-500">
                  <AlertCircle className="h-8 w-8 mb-4" />
                  <p>Failed to load line clearance data</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!selectedWorkOrderId && !isLoadingWorkOrders && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12">
            <div className="flex flex-col items-center justify-center text-gray-500">
              <ClipboardCheck className="h-16 w-16 mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">Select a Work Order</h3>
              <p className="text-sm text-gray-500 text-center max-w-md">
                Choose a released work order from the dropdown above to perform or verify line clearance.
                Line clearance must be completed before production can start.
              </p>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

export default function LineClearancePage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </MainLayout>
    }>
      <LineClearanceContent />
    </Suspense>
  );
}

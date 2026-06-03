'use client';

import React, { useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/page-header';
import { LabelVerificationForm, type LabelType } from '@/components/production/label-verification-form';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { Tag, ArrowLeft, AlertCircle, Loader2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WorkOrder {
  id: number;
  workOrderNumber: string;
  itemName: string;
  status: string;
}

interface LabelVerificationData {
  label: {
    id: number;
    workOrderId: number;
    batchRecordId: number | null;
    labelType: LabelType;
    imageAttachmentId: number | null;
    productName: string | null;
    batchNumber: string | null;
    expiryDate: string | null;
    isCorrect: boolean | null;
    status: 'pending' | 'verified' | 'witnessed' | 'rejected';
    rejectionReason: string | null;
  };
  operatorName?: string;
  witnessName?: string;
  signatures: Array<{
    id: number;
    action: string;
    fullName: string;
    signedAt: string;
    meaning: string;
  }>;
}

function LabelVerificationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useTranslations('production');

  const workOrderIdParam = searchParams.get('workOrderId');
  const labelIdParam = searchParams.get('labelId');

  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<number | null>(
    workOrderIdParam ? parseInt(workOrderIdParam) : null
  );
  const [selectedLabelId, setSelectedLabelId] = useState<number | null>(
    labelIdParam ? parseInt(labelIdParam) : null
  );
  const [selectedLabelType, setSelectedLabelType] = useState<LabelType>('product_label');

  // Fetch work orders
  const { data: workOrders, isLoading: isLoadingWorkOrders } = useQuery({
    queryKey: ['work-orders-for-labels'],
    queryFn: async () => {
      const response = await fetch('/api/production/work-orders?status=in_progress,released&limit=100');
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data.items as WorkOrder[];
    },
  });

  // Fetch labels for selected work order
  const { data: labels, isLoading: isLoadingLabels, refetch: refetchLabels } = useQuery({
    queryKey: ['labels-for-work-order', selectedWorkOrderId],
    queryFn: async () => {
      if (!selectedWorkOrderId) return [];
      // Use batch record ID 0 to get all labels for the work order
      const response = await fetch(`/api/production/batch-records/0/labels?workOrderId=${selectedWorkOrderId}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data?.labels as LabelVerificationData[] || [];
    },
    enabled: !!selectedWorkOrderId,
  });

  // Fetch selected label details
  const { data: labelData, isLoading: isLoadingLabel, refetch: refetchLabel } = useQuery({
    queryKey: ['label-details', selectedLabelId],
    queryFn: async () => {
      if (!selectedLabelId) return null;
      const response = await fetch(`/api/production/labels/${selectedLabelId}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data as LabelVerificationData;
    },
    enabled: !!selectedLabelId,
  });

  // Create label mutation
  const createMutation = useMutation({
    mutationFn: async (labelType: LabelType) => {
      const response = await fetch(`/api/production/batch-records/0/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workOrderId: selectedWorkOrderId,
          labelType,
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      toast.success('Label record created');
      setSelectedLabelId(data.label.id);
      queryClient.invalidateQueries({ queryKey: ['labels-for-work-order', selectedWorkOrderId] });
      refetchLabels();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Verify label mutation
  const verifyMutation = useMutation({
    mutationFn: async ({
      isCorrect,
      rejectionReason,
      password,
    }: {
      isCorrect: boolean;
      rejectionReason?: string;
      password: string;
    }) => {
      const response = await fetch(`/api/production/labels/${selectedLabelId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCorrect, rejectionReason, password }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.isCorrect
          ? 'Label verified successfully. Awaiting witness.'
          : 'Label rejected'
      );
      queryClient.invalidateQueries({ queryKey: ['label-details', selectedLabelId] });
      queryClient.invalidateQueries({ queryKey: ['labels-for-work-order', selectedWorkOrderId] });
      refetchLabel();
      refetchLabels();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Witness label mutation
  const witnessMutation = useMutation({
    mutationFn: async (password: string) => {
      const response = await fetch(`/api/production/labels/${selectedLabelId}/witness`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success('Label verification witnessed successfully. Dual sign-off complete.');
      queryClient.invalidateQueries({ queryKey: ['label-details', selectedLabelId] });
      queryClient.invalidateQueries({ queryKey: ['labels-for-work-order', selectedWorkOrderId] });
      refetchLabel();
      refetchLabels();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleVerify = useCallback(
    async (
      isCorrect: boolean,
      rejectionReason: string | undefined,
      password: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        await verifyMutation.mutateAsync({ isCorrect, rejectionReason, password });
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
    [verifyMutation]
  );

  const handleWitness = useCallback(
    async (password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        await witnessMutation.mutateAsync(password);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
    [witnessMutation]
  );

  const handleCreate = useCallback(
    async (labelType: LabelType): Promise<{ success: boolean; labelId?: number; error?: string }> => {
      try {
        const data = await createMutation.mutateAsync(labelType);
        return { success: true, labelId: data.label.id };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
    [createMutation]
  );

  const selectedWorkOrder = workOrders?.find((wo) => wo.id === selectedWorkOrderId);

  const workOrderItems =
    workOrders?.map((wo) => ({
      value: wo.id,
      label: `${wo.workOrderNumber} - ${wo.itemName}`,
    })) ?? [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-500" />;
      case 'verified':
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
      case 'witnessed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
      <div className="space-y-6">
        <PageHeader
          title={t('labelVerification.title')}
          description={t('labelVerification.description')}
          actions={
            <DxButton
              text="Back to Work Orders"
              icon="arrowleft"
              onClick={() => router.push(selectedWorkOrderId ? `/production/work-orders/${selectedWorkOrderId}` : '/production/work-orders')}
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
                setSelectedLabelId(null);
                if (value) {
                  router.push(`/production/label-verification?workOrderId=${value}`);
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
        </div>

        {/* Labels List */}
        {selectedWorkOrderId && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Labels</h3>
              {!selectedLabelId && (
                <DxButton
                  text="Add New Label"
                  icon="plus"
                  type="default"
                  stylingMode="contained"
                  onClick={() => {
                    // Show the form for creating a new label
                  }}
                />
              )}
            </div>

            {isLoadingLabels ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading labels...</span>
              </div>
            ) : labels && labels.length > 0 ? (
              <div className="space-y-2">
                {labels.map((item) => (
                  <div
                    key={item.label.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedLabelId === item.label.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedLabelId(item.label.id);
                      router.push(
                        `/production/label-verification?workOrderId=${selectedWorkOrderId}&labelId=${item.label.id}`
                      );
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(item.label.status)}
                        <div>
                          <span className="font-medium text-gray-900">
                            {item.label.labelType.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                          {item.label.batchNumber && (
                            <span className="ml-2 text-sm text-gray-500">
                              Batch: {item.label.batchNumber}
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          item.label.status === 'witnessed'
                            ? 'bg-green-100 text-green-700'
                            : item.label.status === 'verified'
                            ? 'bg-blue-100 text-blue-700'
                            : item.label.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {item.label.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No labels found. Create a new label to get started.</p>
            )}
          </div>
        )}

        {/* Label Verification Form */}
        {selectedWorkOrderId && (
          <>
            {isLoadingLabel && selectedLabelId ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12">
                <div className="flex flex-col items-center justify-center text-gray-500">
                  <Loader2 className="h-8 w-8 animate-spin mb-4" />
                  <p>Loading label data...</p>
                </div>
              </div>
            ) : (
              <LabelVerificationForm
                workOrderId={selectedWorkOrderId}
                workOrderNumber={selectedWorkOrder?.workOrderNumber ?? `WO-${selectedWorkOrderId}`}
                productName={selectedWorkOrder?.itemName}
                labelId={selectedLabelId ?? undefined}
                labelType={selectedLabelType}
                onLabelTypeChange={setSelectedLabelType}
                initialData={labelData?.label}
                status={labelData?.label?.status ?? 'pending'}
                operatorName={labelData?.operatorName}
                witnessName={labelData?.witnessName}
                onVerify={handleVerify}
                onWitness={handleWitness}
                onCreate={handleCreate}
                isOperator={labelData?.label?.status === 'pending'}
                isWitness={labelData?.label?.status === 'verified'}
                readOnly={labelData?.label?.status === 'witnessed' || labelData?.label?.status === 'rejected'}
              />
            )}
          </>
        )}

        {/* Empty State */}
        {!selectedWorkOrderId && !isLoadingWorkOrders && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12">
            <div className="flex flex-col items-center justify-center text-gray-500">
              <Tag className="h-16 w-16 mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">Select a Work Order</h3>
              <p className="text-sm text-gray-500 text-center max-w-md">
                Choose a work order from the dropdown above to manage label verifications.
                Label verification requires dual sign-off (operator + witness).
              </p>
            </div>
          </div>
        )}
      </div>
  );
}

export default function LabelVerificationPage() {
  return (
    <Suspense
      fallback={
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
      }
    >
      <LabelVerificationContent />
    </Suspense>
  );
}

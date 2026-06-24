'use client';

import { useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/page-header';
import { GowningForm, type GowningChecklistData } from '@/components/production/gowning-form';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { Shirt, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useErrorTranslator } from '@/lib/i18n/use-error-translator';

interface WorkOrder {
  id: number;
  woNumber: string;
  productName: string;
  status: string;
}

interface GowningRecord {
  id: number;
  gownClean: boolean;
  glovesOn: boolean;
  maskOn: boolean;
  hairnetOn: boolean;
  shoeCoverOn: boolean;
  handsSanitized: boolean;
  notes: string | null;
  status: 'pending' | 'performed' | 'verified' | 'rejected';
  performerName: string | null;
  performedAt: string | null;
  verifierName: string | null;
  verifiedAt: string | null;
}

function GowningContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const translateError = useErrorTranslator();
  const t = useTranslations('production');

  const workOrderIdParam = searchParams.get('workOrderId');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<number | null>(
    workOrderIdParam ? parseInt(workOrderIdParam) : null
  );

  const { data: workOrders, isLoading: isLoadingWorkOrders } = useQuery({
    queryKey: ['work-orders-for-gowning'],
    queryFn: async () => {
      const response = await fetch('/api/production/work-orders?status=released&limit=100');
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data.items as WorkOrder[];
    },
  });

  const { data: gowningData, isLoading: isLoadingGowning, refetch } = useQuery({
    queryKey: ['gowning', selectedWorkOrderId],
    queryFn: async () => {
      if (!selectedWorkOrderId) return null;
      const response = await fetch(`/api/production/work-orders/${selectedWorkOrderId}/gowning`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return (result.data?.record ?? null) as GowningRecord | null;
    },
    enabled: !!selectedWorkOrderId,
  });

  const performMutation = useMutation({
    mutationFn: async ({ data, password }: { data: GowningChecklistData; password: string }) => {
      const response = await fetch(`/api/production/work-orders/${selectedWorkOrderId}/gowning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, password }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success(t('gowning.toast.performed'));
      queryClient.invalidateQueries({ queryKey: ['gowning', selectedWorkOrderId] });
      refetch();
    },
    onError: (error: Error) => toast.error(translateError(error.message)),
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ approved, password, notes }: { approved: boolean; password: string; notes?: string }) => {
      const response = await fetch(`/api/production/work-orders/${selectedWorkOrderId}/gowning/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, password, notes }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.approved ? t('gowning.toast.verified') : t('gowning.toast.rejected'));
      queryClient.invalidateQueries({ queryKey: ['gowning', selectedWorkOrderId] });
      refetch();
    },
    onError: (error: Error) => toast.error(translateError(error.message)),
  });

  const handlePerform = useCallback(
    async (data: GowningChecklistData, password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        await performMutation.mutateAsync({ data, password });
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
    [performMutation]
  );

  const handleVerify = useCallback(
    async (approved: boolean, password: string, notes?: string): Promise<{ success: boolean; error?: string }> => {
      try {
        await verifyMutation.mutateAsync({ approved, password, notes });
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
    [verifyMutation]
  );

  const selectedWorkOrder = workOrders?.find((wo) => wo.id === selectedWorkOrderId);
  const workOrderItems = workOrders?.map((wo) => ({ value: wo.id, label: `${wo.woNumber} - ${wo.productName}` })) ?? [];

  const status: GowningRecord['status'] | 'not_started' = gowningData?.status ?? 'not_started';

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('gowning.title')}
        description={t('gowning.description')}
        actions={
          <DxButton
            text={t('gowning.backToWorkOrder')}
            icon="arrowleft"
            onClick={() => router.push(selectedWorkOrderId ? `/production/work-orders/${selectedWorkOrderId}?tab=execution` : '/production/work-orders')}
            type="normal"
            stylingMode="outlined"
          />
        }
      />

      {!workOrderIdParam && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('gowning.selectWorkOrder')}</h3>
          <div className="max-w-lg">
            <DxSelectBox
              items={workOrderItems}
              value={selectedWorkOrderId}
              onValueChange={(value) => {
                setSelectedWorkOrderId(value);
                if (value) router.push(`/production/gowning?workOrderId=${value}`);
              }}
              placeholder={t('gowning.selectWorkOrderPlaceholder')}
              searchEnabled
              showClearButton
              disabled={isLoadingWorkOrders}
            />
          </div>
        </div>
      )}

      {selectedWorkOrderId && (
        <>
          {isLoadingGowning ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12">
              <div className="flex flex-col items-center justify-center text-gray-500">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p>{t('gowning.loading')}</p>
              </div>
            </div>
          ) : (
            <GowningForm
              workOrderNumber={selectedWorkOrder?.woNumber ?? `WO-${selectedWorkOrderId}`}
              productName={selectedWorkOrder?.productName}
              initialData={
                gowningData
                  ? {
                      gownClean: gowningData.gownClean,
                      glovesOn: gowningData.glovesOn,
                      maskOn: gowningData.maskOn,
                      hairnetOn: gowningData.hairnetOn,
                      shoeCoverOn: gowningData.shoeCoverOn,
                      handsSanitized: gowningData.handsSanitized,
                      notes: gowningData.notes ?? undefined,
                    }
                  : undefined
              }
              status={status}
              performerName={gowningData?.performerName ?? undefined}
              performedAt={gowningData?.performedAt ?? undefined}
              verifierName={gowningData?.verifierName ?? undefined}
              verifiedAt={gowningData?.verifiedAt ?? undefined}
              onPerform={handlePerform}
              onVerify={handleVerify}
              isPerformer={status === 'not_started' || status === 'pending' || status === 'rejected'}
              isVerifier={status === 'performed'}
              readOnly={status === 'verified'}
            />
          )}
        </>
      )}

      {!selectedWorkOrderId && !isLoadingWorkOrders && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12">
          <div className="flex flex-col items-center justify-center text-gray-500">
            <Shirt className="h-16 w-16 mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">{t('gowning.selectWorkOrder')}</h3>
            <p className="text-sm text-gray-500 text-center max-w-md">{t('gowning.emptyHint')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GowningPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    }>
      <GowningContent />
    </Suspense>
  );
}

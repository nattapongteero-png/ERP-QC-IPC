'use client';

/**
 * Work Order Execution Dashboard (Standalone Page)
 * Reuses ExecutionDashboard component with header + WO status bar
 */

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRealtimeTopic } from '@/hooks/use-realtime-topic';
import { ResponsivePageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { ExecutionDashboard } from '@/components/production/ExecutionDashboard';
import { ClipboardCheck } from 'lucide-react';

interface WorkOrderBasic {
  id: number;
  woNumber: string;
  batchNumber: string;
  productName: string;
  status: string;
  plannedQuantity: number;
  actualQuantity: number;
}

export default function WorkOrderExecutionPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('production');

  const pageTitle = t('execution.title');
  const workOrderId = Number(params.id);

  const queryClient = useQueryClient();
  const { data: workOrder, isLoading: woLoading } = useQuery<WorkOrderBasic>({
    queryKey: ['work-order', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/detail`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data?.workOrder;
    },
  });

  // The wrapped ExecutionDashboard already syncs its own queries; here we
  // refresh the header (status badge + planned/actual qty) so it doesn't
  // sit stale after another user flips the WO status or records output.
  useRealtimeTopic('work-order-changed', (data) => {
    if (data.workOrderId !== workOrderId) return;
    queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
  });

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
      <ResponsivePageHeader
        title={`${pageTitle}: ${workOrder.woNumber}`}
        subtitle={`Batch: ${workOrder.batchNumber} | ${workOrder.productName}`}
        icon={ClipboardCheck}
        iconBgColor="bg-teal-100"
        iconColor="text-teal-600"
        breadcrumbs={[
          { label: 'Production', href: '/production' },
          { label: 'Work Orders', href: '/production/work-orders' },
          { label: workOrder.woNumber, href: `/production/work-orders/${workOrderId}` },
          { label: 'Execution' },
        ]}
        actions={
          <DxButton
            text="Back to Work Order"
            icon="back"
            stylingMode="outlined"
            onClick={() => router.push(`/production/work-orders/${workOrderId}`)}
          />
        }
      />

      {/* Work Order Status */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                workOrder.status === 'in_progress' ? 'bg-emerald-100 text-emerald-800' :
                workOrder.status === 'completed' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-600'
              }`}>
                {workOrder.status.replace('_', ' ').toUpperCase()}
              </span>
              <span className="text-gray-600">
                Planned: <strong>{workOrder.plannedQuantity}</strong> |
                Actual: <strong>{workOrder.actualQuantity || 0}</strong>
              </span>
            </div>
            <div className="text-sm text-[#4B7163]">
              Progress based on BOM configuration
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shared Execution Dashboard */}
      <ExecutionDashboard workOrderId={workOrderId} />
    </div>
  );
}

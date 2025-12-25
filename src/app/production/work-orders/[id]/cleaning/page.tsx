'use client';

/**
 * Work Order Cleaning Checklist Page
 * Manages room and equipment cleaning verification
 * Form Sections: 4, 8, 9
 */

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxDataGrid, DxColumn, DxPaging } from '@/components/ui/dx-data-grid';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxSwitch } from '@/components/ui/dx-switch';
import { DxTabs } from '@/components/ui/dx-tabs';
import type { DxTabItem } from '@/components/ui/dx-tabs';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { useToast } from '@/hooks/use-toast';
import { SwitchTypes } from 'devextreme-react/switch';
import {
  Sparkles,
  Building2,
  Wrench,
  CheckCircle2,
  Clock,
  UserCheck,
  AlertCircle,
} from 'lucide-react';

interface CleaningLog {
  id: number;
  workOrderId: number;
  phase: string;
  itemType: 'room' | 'equipment';
  roomId?: number;
  equipmentId?: number;
  roomCode?: string;
  roomName?: string;
  equipmentCode?: string;
  equipmentName?: string;
  isClean: boolean;
  operatorId: number;
  operatorName?: string;
  performedAt: string;
  verifierId?: number;
  verifierName?: string;
  verifiedAt?: string;
  notes?: string;
}

interface CleaningRequirement {
  type: 'room' | 'equipment';
  id: number;
  code: string;
  name: string;
  isRequired: boolean;
  cleaningLog?: CleaningLog;
}

interface WorkOrderBasic {
  id: number;
  woNumber: string;
  batchNumber: string;
  productName: string;
  status: string;
}

const tabItems: DxTabItem[] = [
  { id: 0, text: 'Pre-Production', icon: 'clock' },
  { id: 1, text: 'Post-Production', icon: 'check' },
  { id: 2, text: 'Pre-Packaging', icon: 'box' },
];

const phaseMap = ['pre_production', 'post_production', 'pre_packaging'] as const;

export default function CleaningPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const workOrderId = Number(params.id);

  const phaseParam = searchParams.get('phase');
  const initialTab = phaseParam === 'post_production' ? 1 : phaseParam === 'pre_packaging' ? 2 : 0;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [showCleanDialog, setShowCleanDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CleaningRequirement | null>(null);
  const [formData, setFormData] = useState({
    isClean: true,
    notes: '',
  });

  const currentPhase = phaseMap[activeTab];

  // Fetch Work Order basic info
  const { data: workOrder, isLoading: woLoading } = useQuery<WorkOrderBasic>({
    queryKey: ['work-order', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data?.workOrder;
    },
  });

  // Fetch cleaning requirements with logs
  const { data: requirements, isLoading: reqLoading } = useQuery<CleaningRequirement[]>({
    queryKey: ['wo-cleaning-requirements', workOrderId, currentPhase],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/cleaning-logs?phase=${currentPhase}`);
      const data = await res.json();
      if (!data.success) return [];
      return data.data;
    },
  });

  // Create cleaning log mutation
  const createLogMutation = useMutation({
    mutationFn: async (data: {
      itemType: 'room' | 'equipment';
      roomId?: number;
      equipmentId?: number;
      isClean: boolean;
      notes?: string;
    }) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/cleaning-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: currentPhase,
          ...data,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-cleaning-requirements', workOrderId, currentPhase] });
      toast.success('Cleaning Recorded', 'Cleaning status has been recorded.');
      setShowCleanDialog(false);
      setSelectedItem(null);
      setFormData({ isClean: true, notes: '' });
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  // Verify cleaning log mutation
  const verifyLogMutation = useMutation({
    mutationFn: async (logId: number) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/cleaning-logs/${logId}/verify`, {
        method: 'PATCH',
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-cleaning-requirements', workOrderId, currentPhase] });
      toast.success('Cleaning Verified', 'Cleaning has been verified.');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const handleOpenCleanDialog = (item: CleaningRequirement) => {
    setSelectedItem(item);
    setFormData({ isClean: true, notes: '' });
    setShowCleanDialog(true);
  };

  const handleSubmitCleaning = () => {
    if (!selectedItem) return;
    createLogMutation.mutate({
      itemType: selectedItem.type,
      roomId: selectedItem.type === 'room' ? selectedItem.id : undefined,
      equipmentId: selectedItem.type === 'equipment' ? selectedItem.id : undefined,
      isClean: formData.isClean,
      notes: formData.notes || undefined,
    });
  };

  const getStatusInfo = (item: CleaningRequirement) => {
    if (!item.cleaningLog) {
      return { status: 'pending', label: 'Not Started', color: 'bg-gray-100 text-gray-600' };
    }
    if (item.cleaningLog.verifiedAt) {
      return { status: 'verified', label: 'Verified', color: 'bg-blue-100 text-blue-700' };
    }
    if (item.cleaningLog.isClean) {
      return { status: 'completed', label: 'Cleaned', color: 'bg-green-100 text-green-700' };
    }
    return { status: 'failed', label: 'Not Clean', color: 'bg-red-100 text-red-700' };
  };

  const calculateProgress = () => {
    if (!requirements || requirements.length === 0) return { total: 0, completed: 0, verified: 0 };
    const total = requirements.length;
    const completed = requirements.filter(r => r.cleaningLog?.isClean).length;
    const verified = requirements.filter(r => r.cleaningLog?.verifiedAt).length;
    return { total, completed, verified };
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
        title="Cleaning Checklist"
        subtitle={`${workOrder.woNumber} | Batch: ${workOrder.batchNumber}`}
        icon={Sparkles}
        iconBgColor="bg-amber-100"
        iconColor="text-amber-600"
        breadcrumbs={[
          { label: 'Production', href: '/production' },
          { label: 'Work Orders', href: '/production/work-orders' },
          { label: workOrder.woNumber, href: `/production/work-orders/${workOrderId}` },
          { label: 'Execution', href: `/production/work-orders/${workOrderId}/execution` },
          { label: 'Cleaning' },
        ]}
        actions={
          <DxButton
            text="Back to Execution"
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
                <span className="text-2xl font-bold">{progress.completed}</span>
                <span className="text-sm">/{progress.total} Cleaned</span>
              </div>
              <div className="text-blue-800">
                <span className="text-2xl font-bold">{progress.verified}</span>
                <span className="text-sm">/{progress.total} Verified</span>
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
                All Verified
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Phase Tabs */}
      <Card>
        <CardContent className="p-0">
          <DxTabs
            items={tabItems}
            selectedIndex={activeTab}
            onSelectedIndexChange={(idx) => setActiveTab(idx)}
          />

          <div className="p-4">
            {reqLoading ? (
              <div className="flex items-center justify-center h-40">
                <DxLoadIndicator />
              </div>
            ) : !requirements || requirements.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  No rooms or equipment configured for this phase in the BOM.
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Configure the BOM to add cleaning requirements.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {requirements.map((item) => {
                  const statusInfo = getStatusInfo(item);
                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="flex items-center justify-between p-4 bg-white border rounded-lg hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${item.type === 'room' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                          {item.type === 'room' ? (
                            <Building2 className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Wrench className="h-5 w-5 text-purple-600" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-gray-500">{item.code}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                            {item.isRequired && (
                              <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">Required</span>
                            )}
                          </div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          {item.cleaningLog && (
                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(item.cleaningLog.performedAt).toLocaleString()}
                              </span>
                              <span>by {item.cleaningLog.operatorName}</span>
                              {item.cleaningLog.verifierName && (
                                <span className="flex items-center gap-1 text-blue-600">
                                  <UserCheck className="h-3 w-3" />
                                  Verified by {item.cleaningLog.verifierName}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!item.cleaningLog ? (
                          <DxButton
                            text="Mark Clean"
                            type="success"
                            onClick={() => handleOpenCleanDialog(item)}
                          />
                        ) : !item.cleaningLog.verifiedAt && item.cleaningLog.isClean ? (
                          <DxButton
                            text="Verify"
                            type="default"
                            onClick={() => verifyLogMutation.mutate(item.cleaningLog!.id)}
                            disabled={verifyLogMutation.isPending}
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Clean Dialog */}
      <DxPopup
        visible={showCleanDialog}
        onHiding={() => {
          setShowCleanDialog(false);
          setSelectedItem(null);
        }}
        title={`Record Cleaning: ${selectedItem?.name || ''}`}
        width={450}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <strong>Item:</strong> {selectedItem?.code} - {selectedItem?.name}
            <br />
            <strong>Type:</strong> {selectedItem?.type === 'room' ? 'Room' : 'Equipment'}
          </div>

          <div className="flex items-center gap-4">
            <DxSwitch
              value={formData.isClean}
              onValueChanged={(e: SwitchTypes.ValueChangedEvent) => setFormData({ ...formData, isClean: e.value ?? true })}
            />
            <span className="text-gray-700">
              {formData.isClean ? (
                <span className="text-green-700 font-medium">Clean / Ready for use</span>
              ) : (
                <span className="text-red-700 font-medium">Not Clean / Requires attention</span>
              )}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <DxTextArea
              value={formData.notes}
              onValueChanged={(e) => setFormData({ ...formData, notes: e.value })}
              placeholder="Any observations..."
              height={80}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton text="Cancel" stylingMode="outlined" onClick={() => setShowCleanDialog(false)} />
            <DxButton
              text="Save"
              type="success"
              onClick={handleSubmitCleaning}
              disabled={createLogMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}

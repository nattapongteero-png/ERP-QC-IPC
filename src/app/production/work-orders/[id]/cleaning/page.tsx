'use client';

/**
 * Work Order Cleaning Checklist Page
 * Manages room and equipment cleaning verification
 * Form Sections: 4, 8, 9
 */

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { ResponsivePageHeader, AwaitingOtherVerifierBadge } from '@/components/shared';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Card, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxSwitch } from '@/components/ui/dx-switch';
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
  verifyResult?: string; // 'pass' | 'fail'
  notes?: string;
}

// Production roles that can Mark Clean (compared case-insensitively)
const PRODUCTION_ROLES = ['prod_manager', 'prod_operator', 'admin'];

interface CleaningRequirement {
  type: 'room' | 'equipment';
  id: number;
  code: string;
  name: string;
  nameTh?: string;
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

// All phases that can host cleaning (must mirror cleaning-logs VALID_PHASES).
// We render only the phases that the BOM actually uses — see visiblePhases
// below — so the tab bar never shows empty sections.
type CleaningPhase = 'pre_production' | 'production' | 'post_production' | 'pre_packaging' | 'packaging';

const PHASE_META: Record<CleaningPhase, { label: string; icon: string; short: string }> = {
  pre_production: { label: 'Pre-Production', short: 'Pre-Prod', icon: 'clock' },
  production: { label: 'Production', short: 'Prod', icon: 'product' },
  post_production: { label: 'Post-Production', short: 'Post-Prod', icon: 'check' },
  pre_packaging: { label: 'Pre-Packaging', short: 'Pre-Pkg', icon: 'box' },
  packaging: { label: 'Packaging', short: 'Pkg', icon: 'box' },
};

const PHASE_ORDER: CleaningPhase[] = [
  'pre_production',
  'production',
  'post_production',
  'pre_packaging',
  'packaging',
];

export default function CleaningPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useTranslations('production');
  const locale = useLocale();
  const workOrderId = Number(params.id);

  // GMP dual-control: a log's operator can't verify their own work
  const { data: currentUser } = useCurrentUser();

  const phaseParam = searchParams.get('phase') as CleaningPhase | null;

  const [currentPhase, setCurrentPhase] = useState<CleaningPhase>(
    phaseParam && PHASE_ORDER.includes(phaseParam) ? phaseParam : 'pre_production',
  );
  const [showCleanDialog, setShowCleanDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CleaningRequirement | null>(null);
  const [formData, setFormData] = useState({
    isClean: true,
    notes: '',
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

  // Fetch cleaning requirements with logs for the CURRENT phase
  const { data: requirements, isLoading: reqLoading } = useQuery<CleaningRequirement[]>({
    queryKey: ['wo-cleaning-requirements', workOrderId, currentPhase],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/cleaning-logs?phase=${currentPhase}`);
      const data = await res.json();
      if (!data.success) return [];
      return data.data;
    },
  });

  // Fetch per-phase counts so we can (a) hide tabs that have no rooms/equipment
  // and (b) render a per-phase progress indicator in the tab bar.
  const { data: phaseStats } = useQuery<Record<CleaningPhase, { total: number; completed: number; verified: number }>>({
    queryKey: ['wo-cleaning-phase-stats', workOrderId],
    queryFn: async () => {
      const results = await Promise.all(
        PHASE_ORDER.map(async (phase) => {
          const res = await fetch(`/api/production/work-orders/${workOrderId}/cleaning-logs?phase=${phase}`);
          const data = await res.json();
          const reqs: CleaningRequirement[] = data.success ? data.data : [];
          return [phase, {
            total: reqs.length,
            completed: reqs.filter((r) => r.cleaningLog?.isClean).length,
            verified: reqs.filter((r) => r.cleaningLog?.verifiedAt).length,
          }] as const;
        }),
      );
      return Object.fromEntries(results) as Record<CleaningPhase, { total: number; completed: number; verified: number }>;
    },
  });

  const visiblePhases = PHASE_ORDER.filter((p) => (phaseStats?.[p]?.total ?? 0) > 0);
  // Fall back to pre-production while phaseStats is loading so the tab bar
  // isn't briefly empty.
  const tabPhases: CleaningPhase[] = visiblePhases.length > 0 ? visiblePhases : ['pre_production'];

  // If the current phase isn't in the visible list (e.g. BOM was just edited
  // to remove it), snap the UI to the first visible one instead of rendering
  // an empty card.
  if (!tabPhases.includes(currentPhase) && tabPhases.length > 0) {
    setCurrentPhase(tabPhases[0]);
  }

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

  // Verify cleaning log mutation (supports pass/fail)
  const verifyLogMutation = useMutation({
    mutationFn: async ({ logId, verifyResult }: { logId: number; verifyResult: 'pass' | 'fail' }) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/cleaning-logs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId, verifyResult }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['wo-cleaning-requirements', workOrderId, currentPhase] });
      if (variables.verifyResult === 'pass') {
        toast.success('Verified — Pass', 'ผ่านการตรวจสอบความสะอาด');
      } else {
        toast.warning('Verified — Fail', 'ไม่ผ่าน — Production ต้องทำความสะอาดใหม่');
      }
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const isProductionRole = PRODUCTION_ROLES.includes((currentUser?.role || '').toLowerCase());

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
    if (item.cleaningLog.verifyResult === 'fail') {
      return { status: 'verify_failed', label: 'Verify Failed — ต้องทำความสะอาดใหม่', color: 'bg-red-100 text-red-700' };
    }
    if (item.cleaningLog.verifiedAt && item.cleaningLog.verifyResult === 'pass') {
      return { status: 'verified', label: 'Verified ✓', color: 'bg-blue-100 text-blue-700' };
    }
    if (item.cleaningLog.verifiedAt) {
      return { status: 'verified', label: 'Verified ✓', color: 'bg-blue-100 text-blue-700' };
    }
    if (item.cleaningLog.isClean) {
      return { status: 'completed', label: 'Cleaned — รอตรวจสอบ', color: 'bg-green-100 text-green-700' };
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

      {/* Phase Selector — buttons styled as cards, one per BOM-used phase.
          Each shows label + progress so the operator picks the phase they
          need without drilling in first. Responsive grid collapses on
          mobile. */}
      <div className={`grid gap-2 grid-cols-2 sm:grid-cols-${Math.min(tabPhases.length, 5)}`}>
        {tabPhases.map((phase) => {
          const stat = phaseStats?.[phase] ?? { total: 0, completed: 0, verified: 0 };
          const isActive = currentPhase === phase;
          const pct = stat.total > 0 ? (stat.verified / stat.total) * 100 : 0;
          const allDone = stat.total > 0 && stat.verified === stat.total;
          return (
            <button
              key={phase}
              type="button"
              onClick={() => setCurrentPhase(phase)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                isActive
                  ? 'border-amber-500 bg-amber-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-amber-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-semibold ${isActive ? 'text-amber-800' : 'text-gray-700'}`}>
                  {PHASE_META[phase].label}
                </span>
                {allDone && <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />}
              </div>
              <div className="text-xs text-gray-600 mb-1.5">
                {stat.verified}/{stat.total} Verified
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    allDone ? 'bg-green-500' : stat.completed > 0 ? 'bg-amber-500' : 'bg-gray-300'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Current Phase Card — shows the rooms/equipment for the selected phase
          and its own progress header. Single card = matches the request to
          "show only the current phase". */}
      <Card className="border-amber-200">
        <CardContent className="p-0">
          <div className="p-4 border-b border-amber-100 bg-amber-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-sm text-amber-700 uppercase tracking-wide font-medium">Phase</div>
              <div className="text-xl font-bold text-amber-900 flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                {PHASE_META[currentPhase].label}
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="text-amber-800">
                <span className="text-xl font-bold">{progress.completed}</span>
                <span className="text-xs">/{progress.total} Cleaned</span>
              </div>
              <div className="text-blue-800">
                <span className="text-xl font-bold">{progress.verified}</span>
                <span className="text-xs">/{progress.total} Verified</span>
              </div>
              {progress.verified === progress.total && progress.total > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium text-xs">
                  <CheckCircle2 className="h-3 w-3" />
                  Complete
                </span>
              )}
            </div>
          </div>

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
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-white border rounded-lg hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${item.type === 'room' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                          {item.type === 'room' ? (
                            <Building2 className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Wrench className="h-5 w-5 text-purple-600" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            <span className="font-mono text-xs sm:text-sm text-gray-500">{item.code}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                            {item.isRequired && (
                              <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">Required</span>
                            )}
                            <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                              {item.type === 'room' ? t('execution.room') : t('execution.equipment')}
                            </span>
                          </div>
                          <p className="font-medium text-gray-900">
                            {locale === 'th' && item.nameTh ? item.nameTh : item.name}
                          </p>
                          {locale === 'th' && item.name && (
                            <p className="text-xs text-gray-400">{item.name}</p>
                          )}
                          {locale !== 'th' && item.nameTh && (
                            <p className="text-xs text-gray-400">{item.nameTh}</p>
                          )}
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
                      <div className="flex gap-2 flex-shrink-0 sm:ml-auto">
                        {(() => {
                          const log = item.cleaningLog;
                          const isFailed = log?.verifyResult === 'fail';

                          // State 1: No log yet — only Production can Mark Clean
                          if (!log) {
                            if (!isProductionRole) return null;
                            return (
                              <DxButton
                                text="Mark Clean"
                                type="success"
                                onClick={() => handleOpenCleanDialog(item)}
                              />
                            );
                          }

                          // State 2: Verify failed — Production can re-mark clean
                          if (isFailed) {
                            if (!isProductionRole) {
                              return <span className="text-xs text-red-600 font-medium">รอ Production ทำความสะอาดใหม่</span>;
                            }
                            return (
                              <DxButton
                                text="Mark Clean ใหม่"
                                type="success"
                                onClick={() => handleOpenCleanDialog(item)}
                              />
                            );
                          }

                          // State 3: Cleaned but not verified — non-Production can verify (pass/fail)
                          if (!log.verifiedAt && log.isClean) {
                            if (currentUser?.id === log.operatorId) {
                              return <AwaitingOtherVerifierBadge />;
                            }
                            if (isProductionRole) {
                              return <span className="text-xs text-amber-600">รอผู้ตรวจสอบ Verify</span>;
                            }
                            return (
                              <div className="flex gap-1.5">
                                <DxButton
                                  text="✓ Pass"
                                  type="success"
                                  stylingMode="outlined"
                                  onClick={() => verifyLogMutation.mutate({ logId: log.id, verifyResult: 'pass' })}
                                  disabled={verifyLogMutation.isPending}
                                />
                                <DxButton
                                  text="✗ Fail"
                                  type="danger"
                                  stylingMode="outlined"
                                  onClick={() => verifyLogMutation.mutate({ logId: log.id, verifyResult: 'fail' })}
                                  disabled={verifyLogMutation.isPending}
                                />
                              </div>
                            );
                          }

                          // State 4: Verified pass — done
                          return null;
                        })()}
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

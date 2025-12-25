'use client';

/**
 * Work Order SOP Execution Page
 * Execute production steps with parameter recording
 * Form Section: 6 (Production Process)
 */

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { useToast } from '@/hooks/use-toast';
import {
  ClipboardList,
  Play,
  CheckCircle2,
  Clock,
  UserCheck,
  AlertCircle,
  Thermometer,
  Timer,
  Gauge,
} from 'lucide-react';

interface SOPStep {
  id: number;
  bomStepId: number;
  sequence: number;
  stepName: string;
  stepNameTh?: string;
  instructions?: string;
  instructionsTh?: string;
  expectedParameters?: Record<string, number>;
  actualParameters?: Record<string, number>;
  requiresVerification: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'verified' | 'deviation';
  operatorId?: number;
  operatorName?: string;
  startedAt?: string;
  completedAt?: string;
  verifierId?: number;
  verifierName?: string;
  verifiedAt?: string;
  notes?: string;
}

interface WorkOrderBasic {
  id: number;
  woNumber: string;
  batchNumber: string;
  productName: string;
  status: string;
}

export default function SOPExecutionPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const workOrderId = Number(params.id);

  const [selectedStep, setSelectedStep] = useState<SOPStep | null>(null);
  const [showExecuteDialog, setShowExecuteDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [actualParams, setActualParams] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');

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

  // Fetch SOP steps
  const { data: steps, isLoading: stepsLoading } = useQuery<SOPStep[]>({
    queryKey: ['wo-sop-execution', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/sop-execution`);
      const data = await res.json();
      if (!data.success) return [];
      return data.data;
    },
  });

  // Start step mutation
  const startStepMutation = useMutation({
    mutationFn: async (stepId: number) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/sop-execution/${stepId}/start`, {
        method: 'POST',
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-sop-execution', workOrderId] });
      toast.success('Step Started', 'Production step has been started.');
      setShowExecuteDialog(false);
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  // Complete step mutation
  const completeStepMutation = useMutation({
    mutationFn: async ({ stepId, data }: { stepId: number; data: { actualParameters: Record<string, number>; notes?: string } }) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/sop-execution/${stepId}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-sop-execution', workOrderId] });
      toast.success('Step Completed', 'Production step has been completed.');
      setShowCompleteDialog(false);
      setSelectedStep(null);
      setActualParams({});
      setNotes('');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  // Verify step mutation
  const verifyStepMutation = useMutation({
    mutationFn: async (stepId: number) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/sop-execution/${stepId}/verify`, {
        method: 'PATCH',
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-sop-execution', workOrderId] });
      toast.success('Step Verified', 'Production step has been verified.');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const handleStartStep = (step: SOPStep) => {
    setSelectedStep(step);
    setShowExecuteDialog(true);
  };

  const handleOpenComplete = (step: SOPStep) => {
    setSelectedStep(step);
    // Initialize actual params from expected params
    if (step.expectedParameters) {
      setActualParams({ ...step.expectedParameters });
    }
    setShowCompleteDialog(true);
  };

  const handleCompleteStep = () => {
    if (!selectedStep) return;
    completeStepMutation.mutate({
      stepId: selectedStep.id,
      data: {
        actualParameters: actualParams,
        notes: notes || undefined,
      },
    });
  };

  const getStatusInfo = (status: SOPStep['status']) => {
    const statusMap = {
      pending: { label: 'Pending', color: 'bg-gray-100 text-gray-600', icon: Clock },
      in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700', icon: Play },
      completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
      verified: { label: 'Verified', color: 'bg-blue-100 text-blue-700', icon: UserCheck },
      deviation: { label: 'Deviation', color: 'bg-red-100 text-red-700', icon: AlertCircle },
    };
    return statusMap[status];
  };

  const calculateProgress = () => {
    if (!steps || steps.length === 0) return { total: 0, completed: 0, verified: 0 };
    const total = steps.length;
    const completed = steps.filter(s => ['completed', 'verified'].includes(s.status)).length;
    const verified = steps.filter(s => s.status === 'verified').length;
    return { total, completed, verified };
  };

  const progress = calculateProgress();

  const getParamIcon = (key: string) => {
    if (key.toLowerCase().includes('temp')) return <Thermometer className="h-4 w-4" />;
    if (key.toLowerCase().includes('time') || key.toLowerCase().includes('duration')) return <Timer className="h-4 w-4" />;
    return <Gauge className="h-4 w-4" />;
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
        title="SOP Execution"
        subtitle={`${workOrder.woNumber} | Batch: ${workOrder.batchNumber}`}
        icon={ClipboardList}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: 'Production', href: '/production' },
          { label: 'Work Orders', href: '/production/work-orders' },
          { label: workOrder.woNumber, href: `/production/work-orders/${workOrderId}` },
          { label: 'Execution', href: `/production/work-orders/${workOrderId}/execution` },
          { label: 'SOP Execution' },
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
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-blue-800">
                <span className="text-2xl font-bold">{progress.completed}</span>
                <span className="text-sm">/{progress.total} Completed</span>
              </div>
              <div className="text-blue-800">
                <span className="text-2xl font-bold">{progress.verified}</span>
                <span className="text-sm">/{progress.total} Verified</span>
              </div>
            </div>
            <div className="flex-1 max-w-xs mx-4">
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
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

      {/* Steps List */}
      <Card>
        <CardContent className="p-4">
          {stepsLoading ? (
            <div className="flex items-center justify-center h-40">
              <DxLoadIndicator />
            </div>
          ) : !steps || steps.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
              <p className="text-gray-500">No SOP steps configured for this work order&apos;s BOM.</p>
              <p className="text-sm text-gray-400 mt-2">Configure the BOM to add production steps.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {steps.map((step, index) => {
                const statusInfo = getStatusInfo(step.status);
                const StatusIcon = statusInfo.icon;
                const canStart = step.status === 'pending' && (index === 0 || steps[index - 1].status !== 'pending');
                const canComplete = step.status === 'in_progress';
                const canVerify = step.status === 'completed' && step.requiresVerification;

                return (
                  <div
                    key={step.id}
                    className={`p-4 border rounded-lg ${
                      step.status === 'in_progress' ? 'border-blue-300 bg-blue-50' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${statusInfo.color}`}>
                          <StatusIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-medium text-gray-900">
                              Step {step.sequence}: {step.stepName}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                            {step.requiresVerification && (
                              <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">
                                Requires Verification
                              </span>
                            )}
                          </div>
                          {step.stepNameTh && (
                            <p className="text-gray-600">{step.stepNameTh}</p>
                          )}
                          {step.instructions && (
                            <p className="text-sm text-gray-500 mt-2">{step.instructions}</p>
                          )}

                          {/* Expected Parameters */}
                          {step.expectedParameters && Object.keys(step.expectedParameters).length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {Object.entries(step.expectedParameters).map(([key, value]) => (
                                <span key={key} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm">
                                  {getParamIcon(key)}
                                  <span className="text-gray-600">{key}:</span>
                                  <span className="font-medium">{value}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Actual Parameters (if completed) */}
                          {step.actualParameters && Object.keys(step.actualParameters).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {Object.entries(step.actualParameters).map(([key, value]) => (
                                <span key={key} className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 rounded text-sm">
                                  {getParamIcon(key)}
                                  <span className="text-green-600">{key}:</span>
                                  <span className="font-medium text-green-800">{value}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Execution info */}
                          {step.operatorName && (
                            <div className="mt-2 text-xs text-gray-500 flex items-center gap-3">
                              {step.startedAt && (
                                <span>Started: {new Date(step.startedAt).toLocaleString()} by {step.operatorName}</span>
                              )}
                              {step.completedAt && (
                                <span>Completed: {new Date(step.completedAt).toLocaleString()}</span>
                              )}
                              {step.verifierName && (
                                <span className="text-blue-600">Verified by {step.verifierName}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {canStart && (
                          <DxButton
                            text="Start"
                            icon="play"
                            type="default"
                            onClick={() => handleStartStep(step)}
                          />
                        )}
                        {canComplete && (
                          <DxButton
                            text="Complete"
                            icon="check"
                            type="success"
                            onClick={() => handleOpenComplete(step)}
                          />
                        )}
                        {canVerify && (
                          <DxButton
                            text="Verify"
                            icon="user"
                            type="default"
                            onClick={() => verifyStepMutation.mutate(step.id)}
                            disabled={verifyStepMutation.isPending}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Start Step Dialog */}
      <DxPopup
        visible={showExecuteDialog}
        onHiding={() => setShowExecuteDialog(false)}
        title="Start Production Step"
        width={450}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">
              Step {selectedStep?.sequence}: {selectedStep?.stepName}
            </h4>
            {selectedStep?.instructions && (
              <p className="text-sm text-blue-700">{selectedStep.instructions}</p>
            )}
          </div>

          {selectedStep?.expectedParameters && Object.keys(selectedStep.expectedParameters).length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Expected Parameters:</h5>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(selectedStep.expectedParameters).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-gray-600">{key}:</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-sm text-gray-600">
            Starting this step will record the current time and operator. You can then record actual parameters when completing the step.
          </p>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton text="Cancel" stylingMode="outlined" onClick={() => setShowExecuteDialog(false)} />
            <DxButton
              text="Start Step"
              type="success"
              onClick={() => selectedStep && startStepMutation.mutate(selectedStep.id)}
              disabled={startStepMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>

      {/* Complete Step Dialog */}
      <DxPopup
        visible={showCompleteDialog}
        onHiding={() => {
          setShowCompleteDialog(false);
          setSelectedStep(null);
          setActualParams({});
          setNotes('');
        }}
        title="Complete Production Step"
        width={500}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-4">
          <div className="bg-green-50 rounded-lg p-4">
            <h4 className="font-medium text-green-800 mb-2">
              Step {selectedStep?.sequence}: {selectedStep?.stepName}
            </h4>
            {selectedStep?.instructions && (
              <p className="text-sm text-green-700">{selectedStep.instructions}</p>
            )}
          </div>

          {/* Actual Parameters Input */}
          {selectedStep?.expectedParameters && Object.keys(selectedStep.expectedParameters).length > 0 && (
            <div className="space-y-3">
              <h5 className="text-sm font-medium text-gray-700">Record Actual Parameters:</h5>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(selectedStep.expectedParameters).map(([key, expectedValue]) => (
                  <div key={key}>
                    <label className="block text-sm text-gray-600 mb-1">
                      {key} <span className="text-gray-400">(expected: {expectedValue})</span>
                    </label>
                    <DxNumberBox
                      value={actualParams[key] ?? expectedValue}
                      onValueChanged={(e) => setActualParams({ ...actualParams, [key]: e.value })}
                      format="#0.0"
                      showSpinButtons
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <DxTextArea
              value={notes}
              onValueChanged={(e) => setNotes(e.value)}
              placeholder="Any observations or remarks..."
              height={80}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton text="Cancel" stylingMode="outlined" onClick={() => setShowCompleteDialog(false)} />
            <DxButton
              text="Complete Step"
              type="success"
              onClick={handleCompleteStep}
              disabled={completeStepMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}

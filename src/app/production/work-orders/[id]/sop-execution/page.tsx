'use client';

/**
 * Work Order SOP Execution Page
 * Execute production steps with parameter recording
 * Form Section: 6 (Production Process)
 */

import { useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { useRealtimeTopic } from '@/hooks/use-realtime-topic';
import { ResponsivePageHeader, AwaitingOtherVerifierBadge } from '@/components/shared';
import { useCurrentUser } from '@/hooks/use-current-user';
import type { BOMConfigResponse } from '@/types/bom-config';
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
  Wrench,
  ListChecks,
  FlaskConical,
} from 'lucide-react';

interface TemplateSubStep {
  id: number;
  sequence: number;
  stepName: string;
  stepNameTh?: string;
  instructions?: string;
  instructionsTh?: string;
  defaultParameters?: string;
}

interface LinkedIPCCriterion {
  id: number;
  procedureStepId: number;
  criteriaId: number;
  sequence: number;
  sampleSize: number;
  isCritical: boolean;
  notes?: string | null;
  criteriaCode: string;
  criteriaName: string;
  criteriaNameTh?: string | null;
  specification?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  specTarget?: number | null;
  specTolerancePercent?: number | null;
  unit?: string | null;
  criteriaType: string;
  testMethod?: string | null;
  isCriteriaCritical: boolean;
  // Phase 5 — set when this criterion has already been recorded for the
  // current WO SOP step (via record_ipc or earlier complete). Lets the UI
  // skip "fill again" prompts and show a status badge instead.
  recordedTestId?: number | null;
  recordedStatus?: 'pass' | 'fail' | 'pending' | null;
  // Phase 6a — sample-level history attached server-side so the UI can
  // expand the badge into a read-only details panel without refetching.
  recordedSamples?: Array<{
    sampleNumber: number;
    testRound: number;
    numericValue: number | null;
    textValue: string | null;
    result: string | null;
  }>;
  recordedTestedBy?: number | null;
  recordedTestedByName?: string | null;
  recordedTestDate?: string | null;
  // Phase 6b — JSON snapshot of multi-stage acceptance plan. Drives the
  // "บันทึกรอบใหม่" button: present + last round failed + onFail=next_stage.
  recordedAcceptanceStages?: string | null;
}

interface AcceptanceStage {
  sampleSize: number;
  tolerancePercent: number;
  onFail: 'next_stage' | 'reject_batch' | 'deviation';
}

const parseStages = (raw: string | null | undefined): AcceptanceStage[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => s && typeof s.sampleSize === 'number' && typeof s.tolerancePercent === 'number');
  } catch {
    return [];
  }
};

interface SOPStep {
  id: number;
  bomStepId: number;
  sequence: number;
  stepName: string;
  stepNameTh?: string;
  instructions?: string;
  instructionsTh?: string;
  expectedParameters?: Record<string, number> | string;
  actualParameters?: Record<string, number> | string;
  equipmentIds?: number[] | string;
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
  templateSteps?: TemplateSubStep[];
  // IPC criteria linked to this step's parent SOP template (via
  // sop_template_ipc_criteria). Phase 1 sets up the link; Phase 2 surfaces
  // them here so operators see what tests are expected for the step.
  linkedIPC?: LinkedIPCCriterion[];
  // Phase from BOM step — drives per-phase filter when ?phase= is set.
  phase?: 'pre_production' | 'production' | 'post_production' | 'packaging';
}

// Filterable execution phases. pre_packaging removed (collapsed into packaging).
type SOPPhase = 'pre_production' | 'production' | 'post_production' | 'packaging';
const SOP_PHASE_LABELS: Record<SOPPhase, string> = {
  pre_production: 'Pre-Production',
  production: 'Production',
  post_production: 'Post-Production',
  packaging: 'Packaging',
};

/** Safely parse JSON that might be a string or already parsed */
function parseJson<T>(value: T | string | null | undefined): T | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  return value as T;
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
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useTranslations('production');
  const locale = useLocale();

  const workOrderId = Number(params.id);

  // Phase filter from ?phase=. When set, only steps from that phase render —
  // matches the per-phase SOP cards on Execution Dashboard.
  const phaseParam = searchParams.get('phase');
  const phaseFilter: SOPPhase | null =
    phaseParam && ['pre_production', 'production', 'post_production', 'packaging'].includes(phaseParam)
      ? (phaseParam as SOPPhase)
      : null;

  const [selectedStep, setSelectedStep] = useState<SOPStep | null>(null);
  const [showExecuteDialog, setShowExecuteDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [actualParams, setActualParams] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');

  // IPC inline recording state — keyed by criteriaId. Each linked IPC has its
  // own buffer of sample values. Reset every time the dialog opens for a new
  // step (handled in the open handler below).
  const [ipcNumeric, setIpcNumeric] = useState<Record<number, (number | null)[]>>({});
  const [ipcSampleResults, setIpcSampleResults] = useState<Record<number, ('pass' | 'fail' | null)[]>>({});
  const [ipcText, setIpcText] = useState<Record<number, string>>({});

  // Standalone IPC recording dialog (Phase 4) — independent of the Complete
  // Step flow. Operator opens this any time during in_progress, fills in
  // sample values, saves. Backend upsert handles re-saves.
  const [showIPCDialog, setShowIPCDialog] = useState(false);

  // Phase 6a — Set of recordedTestId currently expanded into the details
  // panel. Toggling clicks on the "บันทึกแล้ว" badge.
  const [expandedRecordedIPC, setExpandedRecordedIPC] = useState<Set<number>>(new Set());
  const toggleExpandedRecorded = (testId: number) => {
    setExpandedRecordedIPC((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) next.delete(testId);
      else next.add(testId);
      return next;
    });
  };

  // Phase 6b — Retest dialog state. Operator opens it for a single
  // criterion that's failed and whose stage plan permits a next round.
  const [retestTarget, setRetestTarget] = useState<{
    step: SOPStep;
    ipc: LinkedIPCCriterion;
    stage: AcceptanceStage;
    nextRound: number;
  } | null>(null);
  const [retestNumeric, setRetestNumeric] = useState<(number | null)[]>([]);
  const [retestSampleResults, setRetestSampleResults] = useState<('pass' | 'fail' | null)[]>([]);
  const [retestText, setRetestText] = useState('');

  // Used to gate the Verify button under GMP dual-control:
  // a step's operator cannot also be its verifier.
  const { data: currentUser } = useCurrentUser();

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

  // Fetch SOP steps
  const { data: steps, isLoading: stepsLoading } = useQuery<SOPStep[]>({
    queryKey: ['wo-sop-execution', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/sop-execution`);
      const data = await res.json();
      if (!data.success) return [];
      return data.data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Filtered view — when ?phase= is set, only show that phase's steps.
  const displaySteps = useMemo<SOPStep[] | undefined>(() => {
    if (!steps) return steps;
    if (!phaseFilter) return steps;
    return steps.filter((s) => (s.phase || 'production') === phaseFilter);
  }, [steps, phaseFilter]);

  // Auto-refresh when another user modifies SOP steps on this WO
  useRealtimeTopic('work-order-changed', (data) => {
    if (data.workOrderId !== workOrderId) return;
    if (data.section !== 'sop-execution' && data.section !== 'status') return;
    queryClient.invalidateQueries({ queryKey: ['wo-sop-execution', workOrderId] });
    queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
  });

  // Fetch BOM config for equipment name resolution
  const { data: bomConfig } = useQuery<BOMConfigResponse>({
    queryKey: ['wo-bom-config', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/bom-config`);
      if (!res.ok) throw new Error('Failed to fetch BOM config');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed');
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Build equipment lookup: master equipmentId → { code, name, nameTh }
  const equipmentLookup = new Map<number, { code: string; name: string; nameTh: string }>();
  if (bomConfig?.equipment) {
    for (const eq of bomConfig.equipment) {
      equipmentLookup.set(eq.equipmentId, {
        code: eq.equipmentCode,
        name: eq.equipmentName,
        nameTh: eq.equipmentNameTh,
      });
    }
  }

  // Check if BOM has SOP steps but execution not yet initialized
  const bomHasSOPSteps = (bomConfig?.sopSteps?.length ?? 0) > 0;
  const executionNotInitialized = (!steps || steps.length === 0) && bomHasSOPSteps;

  // Initialize SOP execution from BOM
  const initializeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/sop-execution`, {
        method: 'POST',
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-sop-execution', workOrderId] });
      toast.success(t('bomConfiguration.sopSteps'), 'SOP execution initialized from BOM.');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  // Start step mutation
  const startStepMutation = useMutation({
    mutationFn: async (stepId: number) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/sop-execution`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId: stepId, action: 'start' }),
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

  // Complete step mutation — accepts optional ipcResults[] for inline IPC
  // recording. Backend records IPC samples (creating quality_test rows)
  // before flipping the step to completed; if IPC recording fails the
  // step stays in_progress so the operator can retry.
  type CompleteStepPayload = {
    actualParameters: Record<string, number>;
    notes?: string;
    ipcResults?: Array<{
      criteriaId: number;
      ipcPhase: string;
      numericValues?: (number | null)[];
      sampleResults?: ('pass' | 'fail' | null)[];
      textValue?: string;
    }>;
  };
  const completeStepMutation = useMutation({
    mutationFn: async ({ stepId, data }: { stepId: number; data: CompleteStepPayload }) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/sop-execution`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionId: stepId,
          action: 'complete',
          actualParameters: data.actualParameters,
          notes: data.notes,
          ipcResults: data.ipcResults,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wo-sop-execution', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['wo-ipc-tests', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['wo-execution-summary', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['wo-deviations', workOrderId] });
      toast.success('Step Completed', 'Production step has been completed.');
      // Phase 7b — surface auto-created deviations from failing IPC.
      const devs = (data as { deviations?: Array<{ deviationNumber: string; deviationId: number }> })?.deviations || [];
      if (devs.length > 0) {
        const numbers = devs.map((d) => d.deviationNumber).join(', ');
        toast.warning('พบ IPC ไม่ผ่าน — สร้าง Deviation แล้ว', `${numbers} · ไปกรอกรายละเอียดที่หน้า Deviations`);
      }
      setShowCompleteDialog(false);
      setSelectedStep(null);
      setActualParams({});
      setNotes('');
      setIpcNumeric({});
      setIpcSampleResults({});
      setIpcText({});
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  // Phase 6b — Retest mutation. Appends a new round to an existing
  // recorded IPC. Status of the underlying quality_test is updated to
  // reflect the latest round; previous rounds remain visible in the
  // timeline view.
  const addIPCRoundMutation = useMutation({
    mutationFn: async (payload: {
      stepId: number;
      criteriaId: number;
      ipcPhase: string;
      criteriaType: string;
      numericValues?: (number | null)[];
      sampleResults?: ('pass' | 'fail' | null)[];
      textValue?: string;
    }) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/sop-execution`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionId: payload.stepId,
          action: 'add_ipc_round',
          criteriaId: payload.criteriaId,
          ipcPhase: payload.ipcPhase,
          numericValues: payload.numericValues,
          sampleResults: payload.sampleResults,
          textValue: payload.textValue,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wo-sop-execution', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['wo-ipc-tests', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['wo-execution-summary', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['wo-deviations', workOrderId] });
      const round = (data as { round?: number })?.round ?? '?';
      const status = (data as { testStatus?: string })?.testStatus ?? '';
      toast.success(`บันทึกรอบ ${round}`, status === 'pass' ? 'ผ่านเกณฑ์ ✅' : status === 'fail' ? 'ยังไม่ผ่าน ⚠️' : 'รอผลการตรวจ');
      const dev = (data as { deviation?: { deviationNumber: string } | null })?.deviation;
      if (dev) {
        toast.warning('พบ IPC ไม่ผ่าน — สร้าง Deviation แล้ว', dev.deviationNumber);
      }
      closeRetest();
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const handleSubmitRetest = () => {
    if (!retestTarget) return;
    if (!retestInputsComplete()) {
      toast.error('IPC Required', 'กรุณากรอก samples ของรอบนี้ให้ครบ');
      return;
    }
    const { step, ipc } = retestTarget;
    addIPCRoundMutation.mutate({
      stepId: step.id,
      criteriaId: ipc.criteriaId,
      ipcPhase: step.phase || 'production',
      criteriaType: ipc.criteriaType,
      numericValues: ipc.criteriaType === 'numeric' ? retestNumeric : undefined,
      sampleResults: (ipc.criteriaType !== 'numeric' && ipc.criteriaType !== 'text') ? retestSampleResults : undefined,
      textValue: ipc.criteriaType === 'text' ? retestText : undefined,
    });
  };

  // Standalone IPC recording — Phase 4. Saves IPC results without
  // changing the SOP step status. Backend upsert means re-saving the
  // same step replaces (not duplicates) the prior values.
  const recordIPCOnlyMutation = useMutation({
    mutationFn: async ({ stepId, ipcResults }: {
      stepId: number;
      ipcResults: Array<{
        criteriaId: number;
        ipcPhase: string;
        numericValues?: (number | null)[];
        sampleResults?: ('pass' | 'fail' | null)[];
        textValue?: string;
      }>;
    }) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/sop-execution`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId: stepId, action: 'record_ipc', ipcResults }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wo-ipc-tests', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['wo-execution-summary', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['wo-sop-execution', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['wo-deviations', workOrderId] });
      toast.success('IPC Saved', 'บันทึกผล IPC แล้ว — สามารถบันทึก SOP Step ภายหลังได้');
      const devs = (data as { deviations?: Array<{ deviationNumber: string }> })?.deviations || [];
      if (devs.length > 0) {
        toast.warning('พบ IPC ไม่ผ่าน — สร้าง Deviation แล้ว', devs.map((d) => d.deviationNumber).join(', '));
      }
      setShowIPCDialog(false);
      setSelectedStep(null);
      setIpcNumeric({});
      setIpcSampleResults({});
      setIpcText({});
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  // Verify step mutation
  const verifyStepMutation = useMutation({
    mutationFn: async (stepId: number) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/sop-execution`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId: stepId }),
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

  // Sub-step confirmation mutation
  const confirmSubStepsMutation = useMutation({
    mutationFn: async ({ executionId, confirmedIds }: { executionId: number; confirmedIds: number[] }) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/sop-execution`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId, action: 'confirm_substeps', confirmedSubStepIds: confirmedIds }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-sop-execution', workOrderId] });
    },
  });

  /** Get confirmed sub-step IDs from actualParameters */
  const getConfirmedSubSteps = (step: SOPStep): number[] => {
    // If step is completed or verified, all sub-steps are confirmed
    if ((step.status === 'completed' || step.status === 'verified') && step.templateSteps?.length) {
      return step.templateSteps.map((s) => s.id);
    }
    const params = parseJson<Record<string, unknown>>(step.actualParameters);
    return (params?._confirmedSubSteps as number[]) || [];
  };

  const toggleSubStep = (step: SOPStep, subStepId: number) => {
    const current = getConfirmedSubSteps(step);
    const next = current.includes(subStepId)
      ? current.filter((id) => id !== subStepId)
      : [...current, subStepId];
    confirmSubStepsMutation.mutate({ executionId: step.id, confirmedIds: next });
  };

  const confirmAllSubSteps = (step: SOPStep) => {
    const allIds = (step.templateSteps || []).map((s) => s.id);
    confirmSubStepsMutation.mutate({ executionId: step.id, confirmedIds: allIds });
  };

  const handleStartStep = (step: SOPStep) => {
    setSelectedStep(step);
    setShowExecuteDialog(true);
  };

  const handleOpenComplete = (step: SOPStep) => {
    setSelectedStep(step);
    // Initialize actual params from expected params
    const expected = parseJson<Record<string, number>>(step.expectedParameters);
    if (expected) {
      setActualParams({ ...expected });
    }
    seedIPCBuffers(step);
    setShowCompleteDialog(true);
  };

  /** Decide whether the given recorded IPC can be retested. Returns the
   *  next stage if so, otherwise null. */
  const getNextRetestStage = (ipc: LinkedIPCCriterion): { nextRound: number; stage: AcceptanceStage } | null => {
    if (!ipc.recordedTestId || !ipc.recordedSamples?.length) return null;
    const stages = parseStages(ipc.recordedAcceptanceStages);
    if (stages.length === 0) return null;

    // Find latest round number from samples.
    let lastRound = 1;
    for (const s of ipc.recordedSamples) {
      if (s.testRound > lastRound) lastRound = s.testRound;
    }
    const lastStage = stages[lastRound - 1];
    const nextStage = stages[lastRound];
    if (!lastStage || !nextStage) return null;

    // Last round must have failed at the stage's tolerance.
    const lastSamples = ipc.recordedSamples.filter((s) => s.testRound === lastRound);
    const failPct = lastSamples.length === 0
      ? 0
      : (lastSamples.filter((s) => s.result === 'fail').length / lastSamples.length) * 100;
    if (failPct <= lastStage.tolerancePercent) return null;
    if (lastStage.onFail !== 'next_stage') return null;

    return { nextRound: lastRound + 1, stage: nextStage };
  };

  const handleOpenRetest = (step: SOPStep, ipc: LinkedIPCCriterion) => {
    const next = getNextRetestStage(ipc);
    if (!next) return;
    setRetestTarget({ step, ipc, stage: next.stage, nextRound: next.nextRound });
    if (ipc.criteriaType === 'numeric') {
      setRetestNumeric(Array.from({ length: next.stage.sampleSize }, () => null));
      setRetestSampleResults([]);
      setRetestText('');
    } else if (ipc.criteriaType === 'text') {
      setRetestNumeric([]);
      setRetestSampleResults([]);
      setRetestText('');
    } else {
      setRetestNumeric([]);
      setRetestSampleResults(Array.from({ length: next.stage.sampleSize }, () => null));
      setRetestText('');
    }
  };

  const closeRetest = () => {
    setRetestTarget(null);
    setRetestNumeric([]);
    setRetestSampleResults([]);
    setRetestText('');
  };

  const retestInputsComplete = (): boolean => {
    if (!retestTarget) return false;
    const { ipc } = retestTarget;
    if (ipc.criteriaType === 'numeric') {
      return retestNumeric.length > 0 && retestNumeric.every((v) => v != null && !Number.isNaN(v));
    }
    if (ipc.criteriaType === 'text') {
      return retestText.trim().length > 0;
    }
    return retestSampleResults.length > 0 && retestSampleResults.every((r) => r != null);
  };

  /** Render the read-only details panel for a recorded IPC criterion.
   *  Phase 6c — samples are grouped by testRound; each round shows its own
   *  pass/fail summary using the corresponding stage's tolerance. The next
   *  retest stage (if any) becomes a "บันทึกรอบใหม่" button at the bottom. */
  const renderRecordedDetails = (step: SOPStep, ipc: LinkedIPCCriterion) => {
    if (!ipc.recordedTestId || !ipc.recordedSamples) return null;
    const samples = ipc.recordedSamples;
    const testedDate = ipc.recordedTestDate ? new Date(ipc.recordedTestDate) : null;
    const stages = parseStages(ipc.recordedAcceptanceStages);

    // Group samples by testRound, ordered ascending.
    const byRound = new Map<number, typeof samples>();
    for (const s of samples) {
      if (!byRound.has(s.testRound)) byRound.set(s.testRound, []);
      byRound.get(s.testRound)!.push(s);
    }
    const rounds = Array.from(byRound.keys()).sort((a, b) => a - b);
    const retestNext = getNextRetestStage(ipc);

    return (
      <div className="mt-2 p-2 rounded-lg bg-white border border-gray-200 text-xs space-y-2">
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span>
            {ipc.recordedTestedByName && <>โดย <span className="font-medium text-gray-700">{ipc.recordedTestedByName}</span> · </>}
            {testedDate && <>เมื่อ {testedDate.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</>}
          </span>
          <span className={`font-semibold ${
            ipc.recordedStatus === 'pass' ? 'text-emerald-700'
              : ipc.recordedStatus === 'fail' ? 'text-rose-700'
              : 'text-amber-700'
          }`}>
            สถานะล่าสุด: {ipc.recordedStatus === 'pass' ? 'ผ่าน' : ipc.recordedStatus === 'fail' ? 'ไม่ผ่าน' : 'รอผล'}
          </span>
        </div>

        {/* Round-by-round timeline */}
        {rounds.map((roundNum) => {
          const rs = byRound.get(roundNum)!;
          const passCount = rs.filter((s) => s.result === 'pass').length;
          const failCount = rs.filter((s) => s.result === 'fail').length;
          const stage = stages[roundNum - 1];
          const tolPct = stage?.tolerancePercent ?? 0;
          const failPct = rs.length === 0 ? 0 : (failCount / rs.length) * 100;
          const roundPass = failPct <= tolPct;
          return (
            <div key={roundNum} className="rounded border border-gray-200 overflow-hidden">
              <div className={`flex items-center justify-between px-2 py-1 text-[11px] ${
                roundPass ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
              }`}>
                <span className="font-semibold">
                  รอบ {roundNum}{stage ? ` · Stage sample ${stage.sampleSize} · tolerance ${stage.tolerancePercent}%` : ''}
                </span>
                <span>
                  {passCount}/{rs.length} ผ่าน · {roundPass ? '✓' : '✗'}
                </span>
              </div>
              <div className="p-1.5">
                {ipc.criteriaType === 'numeric' && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1">
                    {rs.map((s, idx) => (
                      <div
                        key={idx}
                        className={`px-1.5 py-1 rounded text-center text-[11px] border ${
                          s.result === 'pass'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : s.result === 'fail'
                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                            : 'bg-gray-50 border-gray-200 text-gray-600'
                        }`}
                      >
                        <div className="text-[9px] text-gray-400">#{s.sampleNumber}</div>
                        <div className="font-mono font-semibold">{s.numericValue ?? '-'}</div>
                      </div>
                    ))}
                  </div>
                )}
                {ipc.criteriaType !== 'numeric' && ipc.criteriaType !== 'text' && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1">
                    {rs.map((s, idx) => (
                      <div
                        key={idx}
                        className={`px-1.5 py-1 rounded text-center text-[11px] border ${
                          s.result === 'pass'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : s.result === 'fail'
                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                            : 'bg-gray-50 border-gray-200 text-gray-600'
                        }`}
                      >
                        <div className="text-[9px] text-gray-400">#{s.sampleNumber}</div>
                        <div className="font-semibold">
                          {s.result === 'pass' ? 'ผ่าน' : s.result === 'fail' ? 'ไม่ผ่าน' : '–'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {ipc.criteriaType === 'text' && rs[0]?.textValue && (
                  <div className="px-2 py-1.5 rounded bg-gray-50 border border-gray-200 text-gray-700 whitespace-pre-wrap">
                    {rs[0].textValue}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Phase 6b — retest button when stage plan permits next round */}
        {retestNext && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenRetest(step, ipc);
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300 transition-colors"
          >
            ▶ บันทึกรอบ {retestNext.nextRound} (Stage sample {retestNext.stage.sampleSize} · tolerance {retestNext.stage.tolerancePercent}%)
          </button>
        )}
      </div>
    );
  };

  /** Seed empty IPC buffers for the current step. Used by both the
   *  Complete Step dialog (Phase 3) and the standalone IPC dialog (Phase 4). */
  const seedIPCBuffers = (step: SOPStep) => {
    const numericInit: Record<number, (number | null)[]> = {};
    const sampleInit: Record<number, ('pass' | 'fail' | null)[]> = {};
    const textInit: Record<number, string> = {};
    for (const ipc of step.linkedIPC || []) {
      const size = ipc.sampleSize || 1;
      if (ipc.criteriaType === 'numeric') {
        numericInit[ipc.criteriaId] = Array.from({ length: size }, () => null);
      } else if (ipc.criteriaType === 'text') {
        textInit[ipc.criteriaId] = '';
      } else {
        sampleInit[ipc.criteriaId] = Array.from({ length: size }, () => null);
      }
    }
    setIpcNumeric(numericInit);
    setIpcSampleResults(sampleInit);
    setIpcText(textInit);
  };

  const handleOpenIPCDialog = (step: SOPStep) => {
    setSelectedStep(step);
    seedIPCBuffers(step);
    setShowIPCDialog(true);
  };

  /** Pack the operator's IPC inputs — already-recorded criteria are skipped
   *  so re-completing a step doesn't re-prompt for tests already saved. */
  const packIPCResults = (step: SOPStep) =>
    (step.linkedIPC || [])
      .filter((ipc) => !ipc.recordedTestId)
      .map((ipc) => {
        const base = {
          criteriaId: ipc.criteriaId,
          ipcPhase: step.phase || 'production',
        };
        if (ipc.criteriaType === 'numeric') {
          return { ...base, numericValues: ipcNumeric[ipc.criteriaId] || [] };
        }
        if (ipc.criteriaType === 'text') {
          return { ...base, textValue: ipcText[ipc.criteriaId] || '' };
        }
        return { ...base, sampleResults: ipcSampleResults[ipc.criteriaId] || [] };
      });

  /** Validate every UNRECORDED linked IPC has its inputs filled. Already-
   *  recorded criteria are not re-prompted, so they don't need validation. */
  const ipcInputsComplete = (step: SOPStep | null): boolean => {
    if (!step?.linkedIPC?.length) return true;
    for (const ipc of step.linkedIPC) {
      if (ipc.recordedTestId) continue; // already saved — skip
      if (ipc.criteriaType === 'numeric') {
        const values = ipcNumeric[ipc.criteriaId] || [];
        if (values.length === 0 || values.some((v) => v == null || Number.isNaN(v))) return false;
      } else if (ipc.criteriaType === 'text') {
        const t = ipcText[ipc.criteriaId];
        if (!t || !t.trim()) return false;
      } else {
        const results = ipcSampleResults[ipc.criteriaId] || [];
        if (results.length === 0 || results.some((r) => r == null)) return false;
      }
    }
    return true;
  };

  const handleCompleteStep = () => {
    if (!selectedStep) return;

    if (!ipcInputsComplete(selectedStep)) {
      toast.error('IPC Required', 'กรุณากรอก IPC ทุก sample ให้ครบก่อน');
      return;
    }

    const ipcResults = packIPCResults(selectedStep);
    completeStepMutation.mutate({
      stepId: selectedStep.id,
      data: {
        actualParameters: actualParams,
        notes: notes || undefined,
        ipcResults: ipcResults.length > 0 ? ipcResults : undefined,
      },
    });
  };

  const handleSaveIPCOnly = () => {
    if (!selectedStep) return;
    if (!ipcInputsComplete(selectedStep)) {
      toast.error('IPC Required', 'กรุณากรอก IPC ทุก sample ให้ครบก่อน');
      return;
    }
    const ipcResults = packIPCResults(selectedStep);
    if (ipcResults.length === 0) {
      toast.error('No IPC', 'ไม่มี IPC ให้บันทึก');
      return;
    }
    recordIPCOnlyMutation.mutate({ stepId: selectedStep.id, ipcResults });
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
        title={phaseFilter ? `SOP Execution — ${SOP_PHASE_LABELS[phaseFilter]}` : 'SOP Execution'}
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
          ) : !displaySteps || displaySteps.length === 0 ? (
            executionNotInitialized ? (
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                <p className="text-gray-700 font-medium">
                  BOM มีขั้นตอน SOP {bomConfig!.sopSteps.length} ขั้นตอน
                </p>
                <p className="text-sm text-gray-500 mt-1 mb-4">
                  กดปุ่มด้านล่างเพื่อสร้างรายการ SOP Execution จาก BOM
                </p>
                <DxButton
                  text="Initialize SOP Execution"
                  icon="refresh"
                  type="success"
                  onClick={() => initializeMutation.mutate()}
                  disabled={initializeMutation.isPending}
                />
              </div>
            ) : (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                <p className="text-gray-500">No SOP steps configured for this work order&apos;s BOM.</p>
                <p className="text-sm text-gray-400 mt-2">Configure the BOM to add production steps.</p>
              </div>
            )
          ) : (
            <div className="space-y-4">
              {displaySteps.map((step, displayIndex) => {
                // Sequential execution: when the view is filtered to one phase,
                // gate on the previous step WITHIN that phase (so a stalled
                // production step doesn't block a pre-production retest).
                // When unfiltered, use the global ordering as before.
                const referenceList = phaseFilter ? displaySteps : (steps ?? []);
                const refIndex = phaseFilter
                  ? displayIndex
                  : (steps ?? []).findIndex((s) => s.id === step.id);
                const statusInfo = getStatusInfo(step.status);
                const StatusIcon = statusInfo.icon;
                const prevStep = refIndex > 0 ? referenceList[refIndex - 1] : null;
                const prevStepDone = !prevStep ||
                  (prevStep.requiresVerification
                    ? prevStep.status === 'verified'
                    : (prevStep.status === 'completed' || prevStep.status === 'verified'));
                const canStart = step.status === 'pending' && prevStepDone;
                const canComplete = step.status === 'in_progress';
                // GMP dual-control: cannot verify your own work.
                // Separate "eligible" from "allowed" so we can render a helpful
                // badge when the current user is the operator.
                const verifyEligible = step.status === 'completed' && step.requiresVerification;
                const isOwnOperator =
                  !!currentUser && !!step.operatorId && currentUser.id === step.operatorId;
                const canVerify = verifyEligible && !isOwnOperator;
                const showAwaitingOtherVerifier = verifyEligible && isOwnOperator;
                // Show message when step is blocked waiting for previous verification
                const isBlockedByVerification = step.status === 'pending' && prevStep &&
                  prevStep.requiresVerification && prevStep.status === 'completed';
                const expectedParams = parseJson<Record<string, number>>(step.expectedParameters);
                const actualParams_ = parseJson<Record<string, number>>(step.actualParameters);
                const stepEquipmentIds = parseJson<number[]>(step.equipmentIds);
                const stepInstructions = locale === 'th' && step.instructionsTh ? step.instructionsTh : step.instructions;

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
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-lg font-medium text-gray-900">
                              {/* Renumber from 1 within the filtered view —
                                  e.g. global seq 2 + 5 in pre_production
                                  shows as "step 1" + "step 2". The original
                                  global sequence is kept as a small badge so
                                  audit trails still align. */}
                              {t('bomConfiguration.step', { sequence: phaseFilter ? displayIndex + 1 : step.sequence })}: {locale === 'th' && step.stepNameTh ? step.stepNameTh : step.stepName}
                            </span>
                            {phaseFilter && step.sequence !== displayIndex + 1 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-gray-500 bg-gray-100" title="Original sequence in BOM">
                                #{step.sequence}
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                            {step.requiresVerification && (
                              <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">
                                Requires Verification
                              </span>
                            )}
                          </div>
                          {/* Show secondary language name */}
                          {locale === 'th' && step.stepName && step.stepNameTh && (
                            <p className="text-gray-500 text-sm">{step.stepName}</p>
                          )}
                          {locale !== 'th' && step.stepNameTh && (
                            <p className="text-gray-500 text-sm">{step.stepNameTh}</p>
                          )}

                          {/* BOM Instructions */}
                          {stepInstructions && (
                            <div className="mt-2 bg-blue-50 border border-blue-200 rounded-md p-3">
                              <p className="text-sm font-medium text-blue-700 mb-1">{t('bomConfiguration.instructions')}</p>
                              <p className="text-sm text-blue-800">{stepInstructions}</p>
                              {/* Show secondary language instructions */}
                              {locale === 'th' && step.instructions && step.instructionsTh && (
                                <p className="text-xs text-blue-600 mt-1">{step.instructions}</p>
                              )}
                              {locale !== 'th' && step.instructionsTh && (
                                <p className="text-xs text-blue-600 mt-1">{step.instructionsTh}</p>
                              )}
                            </div>
                          )}

                          {/* Template Sub-Steps (Procedure Details) with Confirmation.
                              Editable only while the SOP step is in_progress
                              (operator has clicked Start) — pending steps lack
                              an operatorId/startedAt audit trail, and verified
                              steps are immutable. */}
                          {step.templateSteps && step.templateSteps.length > 0 && (() => {
                            const confirmed = getConfirmedSubSteps(step);
                            const allConfirmed = step.templateSteps!.every((s) => confirmed.includes(s.id));
                            const confirmedCount = step.templateSteps!.filter((s) => confirmed.includes(s.id)).length;
                            const subStepsEditable = step.status === 'in_progress';
                            return (
                              <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-sm font-semibold text-emerald-800 flex items-center gap-1.5">
                                    <ListChecks className="h-4 w-4" />
                                    ขั้นตอนย่อย ({confirmedCount}/{step.templateSteps!.length})
                                  </p>
                                  {subStepsEditable && !allConfirmed && (
                                    <button
                                      onClick={() => confirmAllSubSteps(step)}
                                      disabled={confirmSubStepsMutation.isPending}
                                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors disabled:opacity-50"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      ยืนยันทั้งหมด
                                    </button>
                                  )}
                                  {allConfirmed && (
                                    <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-200 rounded-md">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      ยืนยันครบแล้ว
                                    </span>
                                  )}
                                  {!subStepsEditable && step.status === 'pending' && (
                                    <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                      กด Start ก่อนถึงติ๊กได้
                                    </span>
                                  )}
                                </div>
                                {/* Progress bar */}
                                <div className="w-full h-1.5 bg-emerald-200 rounded-full mb-3">
                                  <div
                                    className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                                    style={{ width: `${step.templateSteps!.length > 0 ? (confirmedCount / step.templateSteps!.length) * 100 : 0}%` }}
                                  />
                                </div>
                                <ol className="space-y-1.5">
                                  {step.templateSteps!.map((sub, subIdx) => {
                                    const isConfirmed = confirmed.includes(sub.id);
                                    const subNameTh = sub.stepNameTh || sub.stepName;
                                    const subInstrTh = sub.instructionsTh || sub.instructions;
                                    return (
                                      <li
                                        key={sub.id}
                                        className={`flex items-start gap-2 p-2 rounded-lg transition-colors ${
                                          isConfirmed ? 'bg-emerald-100/80' : 'hover:bg-white/60'
                                        } ${subStepsEditable ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
                                        onClick={() => subStepsEditable && toggleSubStep(step, sub.id)}
                                      >
                                        <div className={`flex-none w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition-colors ${isConfirmed ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300 bg-white'}`}>
                                          {isConfirmed && (
                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                          )}
                                        </div>
                                        <span className={`flex-none text-xs font-bold w-5 text-center mt-0.5 ${isConfirmed ? 'text-emerald-700' : 'text-gray-500'}`}>
                                          {subIdx + 1}.
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <p className={`text-sm font-medium ${isConfirmed ? 'text-emerald-800 line-through decoration-emerald-400' : 'text-gray-900'}`}>{subNameTh}</p>
                                          {subInstrTh && (
                                            <p className={`text-xs mt-1 whitespace-pre-line ${isConfirmed ? 'text-emerald-600' : 'text-gray-600'}`}>{subInstrTh}</p>
                                          )}
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ol>
                              </div>
                            );
                          })()}

                          {/* BOM Equipment Requirements */}
                          {stepEquipmentIds && stepEquipmentIds.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                                <Wrench className="h-4 w-4" />
                                {t('bomConfiguration.equipment')}:
                              </span>
                              {stepEquipmentIds.map((eqId) => {
                                const equip = equipmentLookup.get(eqId);
                                return equip ? (
                                  <span key={eqId} className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 border border-indigo-200 rounded text-sm text-indigo-800">
                                    <strong>{equip.code}</strong>
                                    <span className="text-indigo-600">({locale === 'th' && equip.nameTh ? equip.nameTh : equip.name})</span>
                                  </span>
                                ) : (
                                  <span key={eqId} className="inline-flex items-center px-2 py-1 bg-gray-100 rounded text-sm text-gray-500">
                                    Equipment #{eqId}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Expected Parameters (from BOM) */}
                          {expectedParams && Object.keys(expectedParams).length > 0 && (
                            <div className="mt-3">
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('bomConfiguration.parameters')}</span>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {Object.entries(expectedParams).map(([key, value]) => (
                                  <span key={key} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm">
                                    {getParamIcon(key)}
                                    <span className="text-gray-600">{key}:</span>
                                    <span className="font-medium">{value}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Linked IPC criteria — informational only.
                              The actual recording happens inside the Complete
                              Step dialog (Phase 3) so the operator stays on
                              this page through the whole flow. We previously
                              had per-row "บันทึกผล →" buttons jumping to
                              /ipc, but that page doesn't pre-create rows for
                              SOP-linked criteria so the operator landed on an
                              empty list and got stuck. */}
                          {step.linkedIPC && step.linkedIPC.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-dashed border-emerald-200">
                              <div className="flex items-center justify-between mb-2">
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 uppercase tracking-wide">
                                  <FlaskConical className="h-3.5 w-3.5" />
                                  IPC ที่ต้องตรวจ
                                </span>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[11px] font-semibold">
                                  {step.linkedIPC.length}
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                {step.linkedIPC.map((ipc) => {
                                  const spec = ipc.specification
                                    || (ipc.specTarget != null ? `target ${ipc.specTarget}${ipc.unit ? ' ' + ipc.unit : ''}` : null)
                                    || ((ipc.minValue != null || ipc.maxValue != null)
                                        ? `${ipc.minValue ?? '-'} – ${ipc.maxValue ?? '-'}${ipc.unit ? ' ' + ipc.unit : ''}`
                                        : null);
                                  return (
                                    <div
                                      key={ipc.id}
                                      className="p-2 rounded-lg border bg-white flex items-start gap-2"
                                    >
                                      <FlaskConical className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                            {ipc.criteriaCode}
                                          </span>
                                          <span className="text-sm font-medium text-gray-900 truncate">
                                            {ipc.criteriaNameTh || ipc.criteriaName}
                                          </span>
                                          {ipc.isCritical && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
                                              <AlertCircle className="h-2.5 w-2.5" />
                                              Critical
                                            </span>
                                          )}
                                          {/* Status badge — clickable to expand
                                              read-only sample details (Phase 6a). */}
                                          {ipc.recordedTestId && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleExpandedRecorded(ipc.recordedTestId!);
                                              }}
                                              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors ${
                                                ipc.recordedStatus === 'pass'
                                                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                  : ipc.recordedStatus === 'fail'
                                                  ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                                                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                              }`}
                                              title="คลิกเพื่อดูรายละเอียด samples"
                                            >
                                              <CheckCircle2 className="h-2.5 w-2.5" />
                                              {ipc.recordedStatus === 'pass'
                                                ? 'บันทึกแล้ว — ผ่าน'
                                                : ipc.recordedStatus === 'fail'
                                                ? 'บันทึกแล้ว — ไม่ผ่าน'
                                                : 'บันทึกแล้ว'}
                                              {expandedRecordedIPC.has(ipc.recordedTestId!) ? ' ▴' : ' ▾'}
                                            </button>
                                          )}
                                        </div>
                                        {spec && (
                                          <div className="text-xs text-gray-500 mt-0.5 truncate">
                                            <span className="text-gray-400">Spec:</span> {spec} · <span className="text-gray-400">Sample size:</span> {ipc.sampleSize}
                                          </div>
                                        )}
                                        {ipc.recordedTestId && expandedRecordedIPC.has(ipc.recordedTestId) && renderRecordedDetails(step, ipc)}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <p className="text-[11px] text-gray-500 mt-2 italic">
                                บันทึกผล IPC ทั้งหมดในหน้า &quot;บันทึก SOP Step&quot; ของ step นี้
                              </p>
                            </div>
                          )}

                          {/* Actual Parameters (if completed) — strip
                              private/internal keys like _confirmedSubSteps
                              that piggyback on actualParameters JSON purely
                              for persistence (operator-confirmed sub-step
                              IDs). Those aren't production parameters. */}
                          {(() => {
                            if (!actualParams_) return null;
                            const visible = Object.entries(actualParams_)
                              .filter(([key]) => !key.startsWith('_'));
                            if (visible.length === 0) return null;
                            return (
                              <div className="mt-2">
                                <span className="text-xs font-medium text-green-600 uppercase tracking-wide">Actual</span>
                                <div className="mt-1 flex flex-wrap gap-2">
                                  {visible.map(([key, value]) => {
                                    const expectedVal = expectedParams?.[key];
                                    const isDeviation = expectedVal != null && value !== expectedVal;
                                    return (
                                      <span key={key} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm ${
                                        isDeviation ? 'bg-amber-100 border border-amber-300' : 'bg-green-100'
                                      }`}>
                                        {getParamIcon(key)}
                                        <span className={isDeviation ? 'text-amber-700' : 'text-green-600'}>{key}:</span>
                                        <span className={`font-medium ${isDeviation ? 'text-amber-800' : 'text-green-800'}`}>{value}</span>
                                        {isDeviation && expectedVal != null && (
                                          <span className="text-xs text-amber-600">(exp: {expectedVal})</span>
                                        )}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Execution info */}
                          {(step.startedAt || step.completedAt || step.verifiedAt) && (
                            <div className="mt-2 text-xs text-gray-500 flex flex-wrap items-center gap-3">
                              {step.startedAt && (
                                <span>เริ่ม: {new Date(step.startedAt).toLocaleString('th-TH')}{step.operatorName ? ` โดย ${step.operatorName}` : ''}</span>
                              )}
                              {step.completedAt && (
                                <span>เสร็จ: {new Date(step.completedAt).toLocaleString('th-TH')}{step.operatorName ? ` โดย ${step.operatorName}` : ''}</span>
                              )}
                              {step.verifiedAt && (
                                <span className="text-blue-600">ตรวจสอบ: {new Date(step.verifiedAt).toLocaleString('th-TH')}{step.verifierName ? ` โดย ${step.verifierName}` : ''}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 flex-shrink-0 items-center">
                        {isBlockedByVerification && (
                          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                            รอตรวจสอบ Step {prevStep!.sequence} ก่อน
                          </span>
                        )}
                        {canStart && (
                          <DxButton
                            text="Start"
                            icon="play"
                            type="default"
                            onClick={() => handleStartStep(step)}
                            disabled={startStepMutation.isPending}
                          />
                        )}
                        {canComplete && step.linkedIPC && step.linkedIPC.length > 0 && (
                          <DxButton
                            text="บันทึก IPC"
                            icon="testrun"
                            type="default"
                            stylingMode="outlined"
                            onClick={() => handleOpenIPCDialog(step)}
                            disabled={recordIPCOnlyMutation.isPending}
                          />
                        )}
                        {canComplete && (
                          <DxButton
                            text="Complete"
                            icon="check"
                            type="success"
                            onClick={() => handleOpenComplete(step)}
                            disabled={completeStepMutation.isPending}
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
                        {showAwaitingOtherVerifier && <AwaitingOtherVerifierBadge />}
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
              {t('bomConfiguration.step', { sequence: selectedStep?.sequence ?? 0 })}: {locale === 'th' && selectedStep?.stepNameTh ? selectedStep.stepNameTh : selectedStep?.stepName}
            </h4>
            {(() => {
              const instr = locale === 'th' && selectedStep?.instructionsTh ? selectedStep.instructionsTh : selectedStep?.instructions;
              return instr ? <p className="text-sm text-blue-700">{instr}</p> : null;
            })()}
          </div>

          {(() => {
            const expected = parseJson<Record<string, number>>(selectedStep?.expectedParameters);
            if (!expected || Object.keys(expected).length === 0) return null;
            return (
              <div className="bg-gray-50 rounded-lg p-4">
                <h5 className="text-sm font-medium text-gray-700 mb-2">{t('bomConfiguration.parameters')}:</h5>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(expected).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-gray-600">{key}:</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Show equipment needed */}
          {(() => {
            const eqIds = parseJson<number[]>(selectedStep?.equipmentIds);
            if (!eqIds || eqIds.length === 0) return null;
            return (
              <div className="bg-indigo-50 rounded-lg p-4">
                <h5 className="text-sm font-medium text-indigo-700 mb-2">{t('bomConfiguration.equipment')}:</h5>
                <div className="flex flex-wrap gap-2">
                  {eqIds.map((eqId) => {
                    const equip = equipmentLookup.get(eqId);
                    return equip ? (
                      <span key={eqId} className="text-sm text-indigo-800">
                        <strong>{equip.code}</strong> ({locale === 'th' && equip.nameTh ? equip.nameTh : equip.name})
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            );
          })()}

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

      {/* Complete Step Dialog — body is scrollable, footer is sticky so the
          submit button is reachable even when many IPC inputs stretch the
          form below the fold. */}
      <DxPopup
        visible={showCompleteDialog}
        onHiding={() => {
          setShowCompleteDialog(false);
          setSelectedStep(null);
          setActualParams({});
          setNotes('');
          setIpcNumeric({});
          setIpcSampleResults({});
          setIpcText({});
        }}
        title="บันทึก SOP Step"
        width={560}
        height="90vh"
        showCloseButton
        dragEnabled={false}
      >
        <div className="flex flex-col h-full">
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="bg-green-50 rounded-lg p-4">
            <h4 className="font-medium text-green-800 mb-2">
              {t('bomConfiguration.step', { sequence: selectedStep?.sequence ?? 0 })}: {locale === 'th' && selectedStep?.stepNameTh ? selectedStep.stepNameTh : selectedStep?.stepName}
            </h4>
            {(() => {
              const instr = locale === 'th' && selectedStep?.instructionsTh ? selectedStep.instructionsTh : selectedStep?.instructions;
              return instr ? <p className="text-sm text-green-700">{instr}</p> : null;
            })()}
          </div>

          {/* Actual Parameters Input */}
          {(() => {
            const expected = parseJson<Record<string, number>>(selectedStep?.expectedParameters);
            if (!expected || Object.keys(expected).length === 0) return null;
            return (
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-gray-700">Record Actual Parameters:</h5>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(expected).map(([key, expectedValue]) => (
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
            );
          })()}

          {/* Inline IPC recording — shared between Complete dialog (Phase 3)
              and the standalone IPC dialog (Phase 4) via the same input state. */}
          {selectedStep?.linkedIPC && selectedStep.linkedIPC.length > 0 && (
            <div className="space-y-3">
              <h5 className="text-sm font-medium text-emerald-800 flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4" />
                IPC Test ({selectedStep.linkedIPC.length})
              </h5>
              {selectedStep.linkedIPC.map((ipc) => {
                const size = ipc.sampleSize || 1;
                const spec = ipc.specification
                  || (ipc.specTarget != null ? `target ${ipc.specTarget}${ipc.unit ? ' ' + ipc.unit : ''}` : null)
                  || ((ipc.minValue != null || ipc.maxValue != null)
                      ? `${ipc.minValue ?? '-'} – ${ipc.maxValue ?? '-'}${ipc.unit ? ' ' + ipc.unit : ''}`
                      : null);
                return (
                  <div
                    key={ipc.id}
                    className={`p-3 rounded-lg border ${
                      ipc.isCritical ? 'border-rose-200 bg-rose-50/30' : 'border-emerald-200 bg-emerald-50/30'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        {ipc.criteriaCode}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {ipc.criteriaNameTh || ipc.criteriaName}
                      </span>
                      {ipc.isCritical && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
                          <AlertCircle className="h-2.5 w-2.5" />
                          Critical
                        </span>
                      )}
                      {/* Phase 5/6a — clickable badge expands sample details. */}
                      {ipc.recordedTestId && (
                        <button
                          type="button"
                          onClick={() => toggleExpandedRecorded(ipc.recordedTestId!)}
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors ${
                            ipc.recordedStatus === 'pass'
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : ipc.recordedStatus === 'fail'
                              ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                              : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          }`}
                          title="คลิกเพื่อดูรายละเอียด samples"
                        >
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          {ipc.recordedStatus === 'pass'
                            ? 'บันทึกแล้ว — ผ่าน'
                            : ipc.recordedStatus === 'fail'
                            ? 'บันทึกแล้ว — ไม่ผ่าน'
                            : 'บันทึกแล้ว'}
                          {expandedRecordedIPC.has(ipc.recordedTestId!) ? ' ▴' : ' ▾'}
                        </button>
                      )}
                    </div>
                    {spec && (
                      <div className="text-xs text-gray-500 mb-2">
                        <span className="text-gray-400">Spec:</span> {spec} · <span className="text-gray-400">Sample size:</span> {size}
                      </div>
                    )}

                    {/* Already saved — show passive notice + optional details. */}
                    {ipc.recordedTestId ? (
                      <>
                        <div className="text-xs text-gray-500 italic px-2 py-1.5 rounded bg-white/60 border border-dashed border-emerald-200">
                          IPC นี้บันทึกไว้แล้ว — กดปุ่ม &quot;บันทึก IPC&quot; ภายนอกถ้าต้องการแก้ค่า
                        </div>
                        {expandedRecordedIPC.has(ipc.recordedTestId) && selectedStep && renderRecordedDetails(selectedStep, ipc)}
                      </>
                    ) : (
                      <>
                        {/* Numeric — N number boxes */}
                        {ipc.criteriaType === 'numeric' && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {(ipcNumeric[ipc.criteriaId] || []).map((v, idx) => {
                              const min = ipc.minValue != null ? Number(ipc.minValue) : null;
                              const max = ipc.maxValue != null ? Number(ipc.maxValue) : null;
                              const inSpec = v == null
                                ? null
                                : (min == null || v >= min) && (max == null || v <= max);
                              return (
                                <div key={idx}>
                                  <label className="block text-[11px] text-gray-500 mb-0.5">#{idx + 1}</label>
                                  <DxNumberBox
                                    value={v ?? undefined}
                                    onValueChanged={(e) => {
                                      const next = [...(ipcNumeric[ipc.criteriaId] || [])];
                                      next[idx] = e.value == null ? null : Number(e.value);
                                      setIpcNumeric({ ...ipcNumeric, [ipc.criteriaId]: next });
                                    }}
                                    format="#0.00"
                                    showSpinButtons={false}
                                  />
                                  {v != null && (
                                    <div className={`mt-0.5 text-[10px] font-semibold ${inSpec ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {inSpec ? '✓ ในเกณฑ์' : '✗ นอกเกณฑ์'}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Pass/Fail / Visual / Checkbox — N toggle pairs */}
                        {ipc.criteriaType !== 'numeric' && ipc.criteriaType !== 'text' && (
                          <div className="space-y-1.5">
                            {(ipcSampleResults[ipc.criteriaId] || []).map((r, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="text-xs text-gray-600 w-8">#{idx + 1}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [...(ipcSampleResults[ipc.criteriaId] || [])];
                                    next[idx] = 'pass';
                                    setIpcSampleResults({ ...ipcSampleResults, [ipc.criteriaId]: next });
                                  }}
                                  className={`flex-1 px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                                    r === 'pass'
                                      ? 'bg-emerald-600 text-white border-emerald-700'
                                      : 'bg-white text-gray-600 border-gray-200 hover:bg-emerald-50'
                                  }`}
                                >
                                  ผ่าน
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [...(ipcSampleResults[ipc.criteriaId] || [])];
                                    next[idx] = 'fail';
                                    setIpcSampleResults({ ...ipcSampleResults, [ipc.criteriaId]: next });
                                  }}
                                  className={`flex-1 px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                                    r === 'fail'
                                      ? 'bg-rose-600 text-white border-rose-700'
                                      : 'bg-white text-gray-600 border-gray-200 hover:bg-rose-50'
                                  }`}
                                >
                                  ไม่ผ่าน
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Text — single textarea */}
                        {ipc.criteriaType === 'text' && (
                          <DxTextArea
                            value={ipcText[ipc.criteriaId] || ''}
                            onValueChanged={(e) => setIpcText({ ...ipcText, [ipc.criteriaId]: e.value || '' })}
                            placeholder="กรอกผลการตรวจ"
                            height={60}
                          />
                        )}
                      </>
                    )}
                  </div>
                );
              })}
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

        </div>
        {/* Sticky footer — never scrolls, so the submit button is always
            in reach even with long lists of IPC tests above. */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t bg-white shrink-0">
          <DxButton text="ยกเลิก" stylingMode="outlined" onClick={() => setShowCompleteDialog(false)} />
          <DxButton
            text={completeStepMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก SOP Step'}
            icon="save"
            type="success"
            onClick={handleCompleteStep}
            disabled={completeStepMutation.isPending}
          />
        </div>
        </div>
      </DxPopup>

      {/* Standalone IPC Dialog — Phase 4. Shows ONLY the IPC inputs so the
          operator can save IPC results during in_progress without completing
          the SOP step. Reuses the same state buffers as the Complete dialog
          (only one of the two is open at a time). */}
      <DxPopup
        visible={showIPCDialog}
        onHiding={() => {
          setShowIPCDialog(false);
          setSelectedStep(null);
          setIpcNumeric({});
          setIpcSampleResults({});
          setIpcText({});
        }}
        title="บันทึก IPC"
        width={560}
        height="90vh"
        showCloseButton
        dragEnabled={false}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            <div className="bg-emerald-50 rounded-lg p-3">
              <h4 className="font-medium text-emerald-800 text-sm">
                {t('bomConfiguration.step', { sequence: selectedStep?.sequence ?? 0 })}: {locale === 'th' && selectedStep?.stepNameTh ? selectedStep.stepNameTh : selectedStep?.stepName}
              </h4>
              <p className="text-xs text-emerald-700 mt-1">
                บันทึก IPC ก่อน Complete Step ได้ — ค่าที่บันทึกจะ replace ค่าก่อนหน้าเสมอ
              </p>
            </div>

            {selectedStep?.linkedIPC && selectedStep.linkedIPC.length > 0 ? (
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-emerald-800 flex items-center gap-1.5">
                  <FlaskConical className="h-4 w-4" />
                  IPC Test ({selectedStep.linkedIPC.length})
                </h5>
                {selectedStep.linkedIPC.map((ipc) => {
                  const size = ipc.sampleSize || 1;
                  const spec = ipc.specification
                    || (ipc.specTarget != null ? `target ${ipc.specTarget}${ipc.unit ? ' ' + ipc.unit : ''}` : null)
                    || ((ipc.minValue != null || ipc.maxValue != null)
                        ? `${ipc.minValue ?? '-'} – ${ipc.maxValue ?? '-'}${ipc.unit ? ' ' + ipc.unit : ''}`
                        : null);
                  return (
                    <div
                      key={ipc.id}
                      className={`p-3 rounded-lg border ${
                        ipc.isCritical ? 'border-rose-200 bg-rose-50/30' : 'border-emerald-200 bg-emerald-50/30'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          {ipc.criteriaCode}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {ipc.criteriaNameTh || ipc.criteriaName}
                        </span>
                        {ipc.isCritical && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
                            <AlertCircle className="h-2.5 w-2.5" />
                            Critical
                          </span>
                        )}
                        {/* Already-recorded indicator. Click to expand samples;
                            inputs stay editable so the operator can re-save. */}
                        {ipc.recordedTestId && (
                          <button
                            type="button"
                            onClick={() => toggleExpandedRecorded(ipc.recordedTestId!)}
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors ${
                              ipc.recordedStatus === 'pass'
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                : ipc.recordedStatus === 'fail'
                                ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            }`}
                            title="คลิกเพื่อดูรายละเอียด samples"
                          >
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            {ipc.recordedStatus === 'pass'
                              ? 'บันทึกแล้ว — ผ่าน · กรอกใหม่จะ replace'
                              : ipc.recordedStatus === 'fail'
                              ? 'บันทึกแล้ว — ไม่ผ่าน · กรอกใหม่จะ replace'
                              : 'บันทึกแล้ว · กรอกใหม่จะ replace'}
                            {expandedRecordedIPC.has(ipc.recordedTestId!) ? ' ▴' : ' ▾'}
                          </button>
                        )}
                      </div>
                      {spec && (
                        <div className="text-xs text-gray-500 mb-2">
                          <span className="text-gray-400">Spec:</span> {spec} · <span className="text-gray-400">Sample size:</span> {size}
                        </div>
                      )}
                      {ipc.recordedTestId && expandedRecordedIPC.has(ipc.recordedTestId) && selectedStep && renderRecordedDetails(selectedStep, ipc)}

                      {ipc.criteriaType === 'numeric' && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {(ipcNumeric[ipc.criteriaId] || []).map((v, idx) => {
                            const min = ipc.minValue != null ? Number(ipc.minValue) : null;
                            const max = ipc.maxValue != null ? Number(ipc.maxValue) : null;
                            const inSpec = v == null
                              ? null
                              : (min == null || v >= min) && (max == null || v <= max);
                            return (
                              <div key={idx}>
                                <label className="block text-[11px] text-gray-500 mb-0.5">#{idx + 1}</label>
                                <DxNumberBox
                                  value={v ?? undefined}
                                  onValueChanged={(e) => {
                                    const next = [...(ipcNumeric[ipc.criteriaId] || [])];
                                    next[idx] = e.value == null ? null : Number(e.value);
                                    setIpcNumeric({ ...ipcNumeric, [ipc.criteriaId]: next });
                                  }}
                                  format="#0.00"
                                  showSpinButtons={false}
                                />
                                {v != null && (
                                  <div className={`mt-0.5 text-[10px] font-semibold ${inSpec ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {inSpec ? '✓ ในเกณฑ์' : '✗ นอกเกณฑ์'}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {ipc.criteriaType !== 'numeric' && ipc.criteriaType !== 'text' && (
                        <div className="space-y-1.5">
                          {(ipcSampleResults[ipc.criteriaId] || []).map((r, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 w-8">#{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...(ipcSampleResults[ipc.criteriaId] || [])];
                                  next[idx] = 'pass';
                                  setIpcSampleResults({ ...ipcSampleResults, [ipc.criteriaId]: next });
                                }}
                                className={`flex-1 px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                                  r === 'pass'
                                    ? 'bg-emerald-600 text-white border-emerald-700'
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-emerald-50'
                                }`}
                              >
                                ผ่าน
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...(ipcSampleResults[ipc.criteriaId] || [])];
                                  next[idx] = 'fail';
                                  setIpcSampleResults({ ...ipcSampleResults, [ipc.criteriaId]: next });
                                }}
                                className={`flex-1 px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                                  r === 'fail'
                                    ? 'bg-rose-600 text-white border-rose-700'
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-rose-50'
                                }`}
                              >
                                ไม่ผ่าน
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {ipc.criteriaType === 'text' && (
                        <DxTextArea
                          value={ipcText[ipc.criteriaId] || ''}
                          onValueChanged={(e) => setIpcText({ ...ipcText, [ipc.criteriaId]: e.value || '' })}
                          placeholder="กรอกผลการตรวจ"
                          height={60}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">ไม่มี IPC ผูกไว้กับ step นี้</p>
            )}
          </div>
          <div className="flex justify-end gap-2 px-4 py-3 border-t bg-white shrink-0">
            <DxButton text="ยกเลิก" stylingMode="outlined" onClick={() => setShowIPCDialog(false)} />
            <DxButton
              text={recordIPCOnlyMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก IPC'}
              icon="save"
              type="success"
              onClick={handleSaveIPCOnly}
              disabled={recordIPCOnlyMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>

      {/* Retest Dialog — Phase 6b. Captures samples for the next round
          based on the snapshot stage plan. Backend appends with the
          incremented testRound. */}
      <DxPopup
        visible={!!retestTarget}
        onHiding={closeRetest}
        title={retestTarget ? `บันทึกรอบ ${retestTarget.nextRound}` : 'บันทึกรอบใหม่'}
        width={520}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        {retestTarget && (
          <div className="flex flex-col h-full">
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div className="bg-amber-50 rounded-lg p-3 text-sm">
                <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                  <FlaskConical className="h-4 w-4" />
                  {retestTarget.ipc.criteriaCode} · {retestTarget.ipc.criteriaNameTh || retestTarget.ipc.criteriaName}
                </div>
                <div className="text-xs text-amber-800 mt-1">
                  Stage {retestTarget.nextRound} · sample size <strong>{retestTarget.stage.sampleSize}</strong> · tolerance <strong>{retestTarget.stage.tolerancePercent}%</strong> · onFail: <strong>{retestTarget.stage.onFail}</strong>
                </div>
              </div>

              {retestTarget.ipc.criteriaType === 'numeric' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {retestNumeric.map((v, idx) => {
                    const min = retestTarget.ipc.minValue != null ? Number(retestTarget.ipc.minValue) : null;
                    const max = retestTarget.ipc.maxValue != null ? Number(retestTarget.ipc.maxValue) : null;
                    const inSpec = v == null
                      ? null
                      : (min == null || v >= min) && (max == null || v <= max);
                    return (
                      <div key={idx}>
                        <label className="block text-[11px] text-gray-500 mb-0.5">#{idx + 1}</label>
                        <DxNumberBox
                          value={v ?? undefined}
                          onValueChanged={(e) => {
                            const next = [...retestNumeric];
                            next[idx] = e.value == null ? null : Number(e.value);
                            setRetestNumeric(next);
                          }}
                          format="#0.00"
                          showSpinButtons={false}
                        />
                        {v != null && (
                          <div className={`mt-0.5 text-[10px] font-semibold ${inSpec ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {inSpec ? '✓ ในเกณฑ์' : '✗ นอกเกณฑ์'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {retestTarget.ipc.criteriaType !== 'numeric' && retestTarget.ipc.criteriaType !== 'text' && (
                <div className="space-y-1.5">
                  {retestSampleResults.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 w-8">#{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...retestSampleResults];
                          next[idx] = 'pass';
                          setRetestSampleResults(next);
                        }}
                        className={`flex-1 px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                          r === 'pass'
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-emerald-50'
                        }`}
                      >
                        ผ่าน
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...retestSampleResults];
                          next[idx] = 'fail';
                          setRetestSampleResults(next);
                        }}
                        className={`flex-1 px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                          r === 'fail'
                            ? 'bg-rose-600 text-white border-rose-700'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-rose-50'
                        }`}
                      >
                        ไม่ผ่าน
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {retestTarget.ipc.criteriaType === 'text' && (
                <DxTextArea
                  value={retestText}
                  onValueChanged={(e) => setRetestText(e.value || '')}
                  placeholder="กรอกผลการตรวจ"
                  height={80}
                />
              )}
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t bg-white shrink-0">
              <DxButton text="ยกเลิก" stylingMode="outlined" onClick={closeRetest} />
              <DxButton
                text={addIPCRoundMutation.isPending ? 'กำลังบันทึก...' : `บันทึกรอบ ${retestTarget.nextRound}`}
                icon="save"
                type="success"
                onClick={handleSubmitRetest}
                disabled={addIPCRoundMutation.isPending}
              />
            </div>
          </div>
        )}
      </DxPopup>
    </div>
  );
}

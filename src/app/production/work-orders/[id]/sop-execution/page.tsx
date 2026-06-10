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
import { NewTypeRecorderPanel, isNewType } from '@/components/ipc-recording/NewTypeRecorderPanel';
import { formatSpecSummary } from '@/lib/master-data/ipc-spec-payload';
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
  FileText,
} from 'lucide-react';
import { GmpDocumentPreviewDialog } from '@/components/documents';

interface TemplateSubStep {
  id: number;
  sequence: number;
  stepName: string;
  stepNameTh?: string;
  instructions?: string;
  instructionsTh?: string;
  defaultParameters?: string;
  gmpDocumentId?: number | null;
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
  // Retest budget (FDA OOS 2006). Master ipc_criteria.maxRetestRounds.
  // Critical criteria → 0 (deviation immediately on round 1 fail).
  maxRetestRounds?: number | null;
  // Latest round + reason captured on the recorded quality_test.
  recordedRetestRound?: number | null;
  recordedRetestReason?: string | null;
  // Per-IPC GMP document link (ipc_criteria.gmpDocumentId). Shown on the IPC
  // card — distinct from the template-level and sub-step document links.
  gmpDocumentId?: number | null;
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
  // Template-level GMP document (sop_step_templates.gmpDocumentId). Shown at
  // the step header — distinct from per-sub-step and per-IPC document links.
  templateGmpDocumentId?: number | null;
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

// Renders an IPC criterion's spec envelope as human-readable lines.
// Replaces the legacy "Spec: <raw JSON>" inline rendering that operators
// could not read. Used by all 4 IPC display sites in this page.
function IPCSpecLines({ ipc, size = 'xs' }: { ipc: LinkedIPCCriterion; size?: 'xs' | '10' }) {
  const lines = formatSpecSummary({
    criteriaType: ipc.criteriaType || 'numeric',
    specification: ipc.specification,
    sampleSize: ipc.sampleSize,
    minValue: ipc.minValue,
    maxValue: ipc.maxValue,
    unit: ipc.unit,
  });
  if (lines.length === 0) return null;
  const textClass = size === '10' ? 'text-[10px]' : 'text-xs';
  return (
    <div className="mt-1 space-y-0.5">
      {lines.map((ln, i) => (
        <div
          key={i}
          className={`${textClass} flex items-start gap-1.5 ${
            ln.tone === 'pass' ? 'text-emerald-700'
            : ln.tone === 'fail' ? 'text-rose-700'
            : ln.tone === 'meta' ? 'text-gray-500'
            : 'text-gray-700'
          }`}
        >
          <span className="flex-none w-3.5 text-center select-none">{ln.icon}</span>
          <span className="break-words">{ln.text}</span>
        </div>
      ))}
    </div>
  );
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

  const [previewDocId, setPreviewDocId] = useState<number | null>(null);
  const { data: docLabelMap } = useQuery<Record<number, string>>({
    queryKey: ['gmp-doc-label-map'],
    queryFn: async () => {
      const res = await fetch('/api/documents?limit=1000');
      if (!res.ok) return {};
      const body = await res.json();
      const docs = body?.data?.documents ?? body?.documents ?? [];
      const map: Record<number, string> = {};
      for (const d of docs) map[Number(d.id)] = `${d.documentNumber} — ${d.title}`;
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });
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
  // Phase 8d — when set, the IPC dialog filters to IPCs linked to this
  // sub-step only; null = step-level (all IPCs of the step).
  const [selectedSubStepId, setSelectedSubStepId] = useState<number | null>(null);

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

  // Phase 6b + Retest Gate — Retest dialog state. Operator opens it for a
  // single criterion that's failed. Two paths:
  //  - Multi-stage: stage plan defines next round's sample size + tolerance
  //  - Single-stage: criteria.maxRetestRounds defines retest budget; round
  //    2+ requires retestReason (justified/unjustified).
  const [retestTarget, setRetestTarget] = useState<{
    step: SOPStep;
    ipc: LinkedIPCCriterion;
    stage: AcceptanceStage;
    nextRound: number;
    isMultiStage: boolean;
  } | null>(null);
  const [retestNumeric, setRetestNumeric] = useState<(number | null)[]>([]);
  const [retestSampleResults, setRetestSampleResults] = useState<('pass' | 'fail' | null)[]>([]);
  const [retestText, setRetestText] = useState('');
  const [retestReason, setRetestReason] = useState<'justified' | 'unjustified' | null>(null);
  // Phase 8b — inline Deviation reason captured at trigger time. Per-criteria
  // for the standalone IPC dialog (multiple IPCs at once) and a single value
  // for the retest dialog (one criterion at a time).
  const [ipcDeviationReason, setIpcDeviationReason] = useState<Record<number, string>>({});
  const [retestDeviationReason, setRetestDeviationReason] = useState('');

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
      retestReason?: 'justified' | 'unjustified' | null;
      deviationReason?: string | null;
      deviationSeverity?: 'minor' | 'major' | 'critical' | null;
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
          retestReason: payload.retestReason,
          deviationReason: payload.deviationReason,
          deviationSeverity: payload.deviationSeverity,
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
    // Single-stage retests REQUIRE retestReason on round 2+ per FDA OOS 2006.
    // Multi-stage skips this — the stage plan governs progression.
    if (!retestTarget.isMultiStage && retestReason == null) {
      toast.error('เหตุผลการ Retest', 'กรุณาเลือกเหตุผลการทดสอบซ้ำ');
      return;
    }
    // Phase 8b — when this round will trigger a Deviation, require the
    // operator to type the rationale inline.
    const willTrigger = willTriggerDeviationRetest();
    if (willTrigger && !retestDeviationReason.trim()) {
      toast.error('Deviation Reason Required', 'กรุณาระบุเหตุผลของ Deviation');
      return;
    }
    const { step, ipc } = retestTarget;
    // Severity defaults: 'major' for unjustified retest, 'critical' for
    // critical criteria, otherwise 'minor'.
    const severity: 'minor' | 'major' | 'critical' = ipc.isCriteriaCritical
      ? 'critical'
      : retestReason === 'unjustified'
        ? 'major'
        : 'minor';
    addIPCRoundMutation.mutate({
      stepId: step.id,
      criteriaId: ipc.criteriaId,
      ipcPhase: step.phase || 'production',
      criteriaType: ipc.criteriaType,
      numericValues: ipc.criteriaType === 'numeric' ? retestNumeric : undefined,
      sampleResults: (ipc.criteriaType !== 'numeric' && ipc.criteriaType !== 'text') ? retestSampleResults : undefined,
      textValue: ipc.criteriaType === 'text' ? retestText : undefined,
      retestReason: retestTarget.isMultiStage ? null : retestReason,
      deviationReason: willTrigger ? retestDeviationReason.trim() : null,
      deviationSeverity: willTrigger ? severity : null,
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
   *  next stage if so, otherwise null. Supports both multi-stage (USP <711>)
   *  and single-stage (FDA OOS 2006 retest budget) paths. */
  const getNextRetestStage = (ipc: LinkedIPCCriterion): { nextRound: number; stage: AcceptanceStage; isMultiStage: boolean } | null => {
    if (!ipc.recordedTestId || !ipc.recordedSamples?.length) return null;

    // Last round number from samples.
    let lastRound = 1;
    for (const s of ipc.recordedSamples) {
      if (s.testRound > lastRound) lastRound = s.testRound;
    }
    const lastSamples = ipc.recordedSamples.filter((s) => s.testRound === lastRound);
    const lastFailCount = lastSamples.filter((s) => s.result === 'fail').length;

    const stages = parseStages(ipc.recordedAcceptanceStages);

    // ---- Multi-stage path ----
    if (stages.length > 0) {
      const lastStage = stages[lastRound - 1];
      const nextStage = stages[lastRound];
      if (!lastStage || !nextStage) return null;
      const failPct = lastSamples.length === 0
        ? 0
        : (lastFailCount / lastSamples.length) * 100;
      if (failPct <= lastStage.tolerancePercent) return null;
      if (lastStage.onFail !== 'next_stage') return null;
      return { nextRound: lastRound + 1, stage: nextStage, isMultiStage: true };
    }

    // ---- Single-stage path (FDA OOS 2006) ----
    // Allow retest only if last round had at least one fail and budget remains.
    if (lastFailCount === 0) return null;
    // Critical criteria force max=0 regardless of stored value (FDA OOS 2006).
    // Some legacy rows have Critical=1 with stored max_retest_rounds=1; we
    // resolve that here so the UI matches server-side resolveMaxRetestRounds.
    const maxRetestRounds = ipc.isCriteriaCritical
      ? 0
      : (ipc.maxRetestRounds == null ? 1 : Number(ipc.maxRetestRounds));
    const maxRoundsTotal = 1 + (Number.isFinite(maxRetestRounds) ? maxRetestRounds : 1);
    if (lastRound >= maxRoundsTotal) return null;

    const sampleSize = Number(ipc.sampleSize) || lastSamples.length || 1;
    const tolerancePercent = 0; // Single-stage uses criteria default; we don't have it here. Server validates.
    return {
      nextRound: lastRound + 1,
      stage: { sampleSize, tolerancePercent, onFail: 'next_stage' },
      isMultiStage: false,
    };
  };

  const handleOpenRetest = (step: SOPStep, ipc: LinkedIPCCriterion) => {
    const next = getNextRetestStage(ipc);
    if (!next) return;
    setRetestTarget({ step, ipc, stage: next.stage, nextRound: next.nextRound, isMultiStage: next.isMultiStage });
    setRetestReason(null);
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
    setRetestReason(null);
    setRetestDeviationReason('');
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
    // Compute total round budget for display: 1 + maxRetestRounds.
    // Critical criteria force max=0 regardless of stored value (FDA OOS 2006).
    // Some legacy rows have Critical=1 with stored max_retest_rounds=1; we
    // resolve that here so the UI matches server-side resolveMaxRetestRounds.
    const maxRetestRounds = ipc.isCriteriaCritical
      ? 0
      : (ipc.maxRetestRounds == null ? 1 : Number(ipc.maxRetestRounds));
    const maxRoundsTotal = 1 + (Number.isFinite(maxRetestRounds) ? maxRetestRounds : 1);
    const isMultiStage = stages.length > 0;

    return (
      <div className="mt-2 p-2 rounded-lg bg-white border border-gray-200 text-xs space-y-2">
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span>
            {ipc.recordedTestedByName && <>โดย <span className="font-medium text-gray-700">{ipc.recordedTestedByName}</span> · </>}
            {testedDate && <>เมื่อ {testedDate.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</>}
          </span>
          <div className="flex items-center gap-2">
            {/* Round budget badge — single-stage shows progress (e.g., 2/3) */}
            {!isMultiStage && rounds.length > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium text-[10px]">
                รอบที่ {Math.max(...rounds)}/{maxRoundsTotal}
              </span>
            )}
            <span className={`font-semibold ${
              ipc.recordedStatus === 'pass' ? 'text-emerald-700'
                : ipc.recordedStatus === 'fail' ? 'text-rose-700'
                : 'text-amber-700'
            }`}>
              สถานะล่าสุด: {ipc.recordedStatus === 'pass' ? 'ผ่าน' : ipc.recordedStatus === 'fail' ? 'ไม่ผ่าน' : 'รอผล'}
            </span>
          </div>
        </div>
        {/* Latest retest reason banner */}
        {!isMultiStage && ipc.recordedRetestReason && (
          <div className={`px-2 py-1 rounded text-[11px] ${
            ipc.recordedRetestReason === 'unjustified'
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            เหตุผล Retest ล่าสุด: <strong>{ipc.recordedRetestReason === 'justified' ? 'Justified — พบสาเหตุ' : 'Unjustified — ไม่พบสาเหตุ (Deviation)'}</strong>
          </div>
        )}

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

  /** Filter step.linkedIPC down to a single sub-step's IPCs when
   *  selectedSubStepId is set; otherwise return all of the step's IPCs. */
  const linkedIPCsForDialog = (step: SOPStep | null): LinkedIPCCriterion[] => {
    if (!step?.linkedIPC) return [];
    if (selectedSubStepId == null) return step.linkedIPC;
    return step.linkedIPC.filter((ipc) => ipc.procedureStepId === selectedSubStepId);
  };

  /** Seed empty IPC buffers for the current step / sub-step. Used by both
   *  the Complete Step dialog (Phase 3) and the standalone IPC dialog (Phase 4).
   *  Optional `subStepId` restricts seeding to one sub-step's IPCs. */
  const seedIPCBuffers = (step: SOPStep, subStepId: number | null = null) => {
    const numericInit: Record<number, (number | null)[]> = {};
    const sampleInit: Record<number, ('pass' | 'fail' | null)[]> = {};
    const textInit: Record<number, string> = {};
    const ipcs = subStepId == null
      ? (step.linkedIPC || [])
      : (step.linkedIPC || []).filter((ipc) => ipc.procedureStepId === subStepId);
    for (const ipc of ipcs) {
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
    setIpcDeviationReason({});
  };

  /** Open IPC dialog for a step. If `subStepId` is provided, the dialog
   *  shows only IPCs linked to that sub-step (Phase 8d). */
  const handleOpenIPCDialog = (step: SOPStep, subStepId: number | null = null) => {
    setSelectedStep(step);
    setSelectedSubStepId(subStepId);
    seedIPCBuffers(step, subStepId);
    setShowIPCDialog(true);
  };

  /** Live-compute whether a single IPC (round 1, standalone) will trigger a
   *  Deviation when saved with the current inputs. Used to show the inline
   *  Deviation reason textarea before submit. */
  const willTriggerDeviationRound1 = (ipc: LinkedIPCCriterion): boolean => {
    // Critical criteria force max=0 regardless of stored value (FDA OOS 2006).
    // Some legacy rows have Critical=1 with stored max_retest_rounds=1; we
    // resolve that here so the UI matches server-side resolveMaxRetestRounds.
    const maxRetestRounds = ipc.isCriteriaCritical
      ? 0
      : (ipc.maxRetestRounds == null ? 1 : Number(ipc.maxRetestRounds));
    // Only fires immediately on round 1 when budget = 0 (Critical).
    if (maxRetestRounds !== 0 && !ipc.isCriteriaCritical) return false;

    // Compute fail status from current inputs vs spec.
    if (ipc.criteriaType === 'numeric') {
      const values = ipcNumeric[ipc.criteriaId] || [];
      const min = ipc.minValue != null ? Number(ipc.minValue) : null;
      const max = ipc.maxValue != null ? Number(ipc.maxValue) : null;
      return values.some((v) => {
        if (v == null || Number.isNaN(v)) return false;
        const minOk = min == null || v >= min;
        const maxOk = max == null || v <= max;
        return !(minOk && maxOk);
      });
    }
    if (ipc.criteriaType === 'text') {
      return false; // text criteria can't auto-fail without explicit pass/fail
    }
    const results = ipcSampleResults[ipc.criteriaId] || [];
    return results.some((r) => r === 'fail');
  };

  /** Live-compute whether the current retest inputs will trigger a Deviation. */
  const willTriggerDeviationRetest = (): boolean => {
    if (!retestTarget) return false;
    if (retestTarget.isMultiStage) {
      // Multi-stage: deviation only when this round fails (server-side
      // decides based on stage tolerance). Pre-check: any sample fail?
      if (retestTarget.ipc.criteriaType === 'numeric') {
        const min = retestTarget.ipc.minValue != null ? Number(retestTarget.ipc.minValue) : null;
        const max = retestTarget.ipc.maxValue != null ? Number(retestTarget.ipc.maxValue) : null;
        return retestNumeric.some((v) => {
          if (v == null || Number.isNaN(v)) return false;
          const minOk = min == null || v >= min;
          const maxOk = max == null || v <= max;
          return !(minOk && maxOk);
        });
      }
      return retestSampleResults.some((r) => r === 'fail');
    }

    // Single-stage path — Unjustified always triggers.
    if (retestReason === 'unjustified') return true;

    // Final round fail also triggers. Critical = force 0 (FDA OOS 2006).
    const maxRetestRounds = retestTarget.ipc.isCriteriaCritical
      ? 0
      : (retestTarget.ipc.maxRetestRounds == null ? 1 : Number(retestTarget.ipc.maxRetestRounds));
    const maxRoundsTotal = 1 + maxRetestRounds;
    const isFinalRound = retestTarget.nextRound >= maxRoundsTotal;
    if (!isFinalRound) return false;

    // Check fail status from inputs.
    if (retestTarget.ipc.criteriaType === 'numeric') {
      const min = retestTarget.ipc.minValue != null ? Number(retestTarget.ipc.minValue) : null;
      const max = retestTarget.ipc.maxValue != null ? Number(retestTarget.ipc.maxValue) : null;
      return retestNumeric.some((v) => {
        if (v == null || Number.isNaN(v)) return false;
        const minOk = min == null || v >= min;
        const maxOk = max == null || v <= max;
        return !(minOk && maxOk);
      });
    }
    return retestSampleResults.some((r) => r === 'fail');
  };

  /** Pack the operator's IPC inputs — already-recorded criteria are skipped
   *  so re-completing a step doesn't re-prompt for tests already saved.
   *  Phase 8b — also forwards the inline Deviation reason when the round-1
   *  trigger condition was visible to the operator.
   *  Phase 8d — when selectedSubStepId is set, only IPCs of that sub-step. */
  const packIPCResults = (step: SOPStep) =>
    linkedIPCsForDialog(step)
      .filter((ipc) => !ipc.recordedTestId)
      .map((ipc) => {
        const base: {
          criteriaId: number;
          ipcPhase: string;
          deviationReason?: string;
          deviationSeverity?: 'minor' | 'major' | 'critical';
          numericValues?: (number | null)[];
          sampleResults?: ('pass' | 'fail' | null)[];
          textValue?: string;
        } = {
          criteriaId: ipc.criteriaId,
          ipcPhase: step.phase || 'production',
        };
        const reason = (ipcDeviationReason[ipc.criteriaId] || '').trim();
        if (reason && willTriggerDeviationRound1(ipc)) {
          base.deviationReason = reason;
          base.deviationSeverity = ipc.isCriteriaCritical ? 'critical' : 'major';
        }
        if (ipc.criteriaType === 'numeric') {
          return { ...base, numericValues: ipcNumeric[ipc.criteriaId] || [] };
        }
        if (ipc.criteriaType === 'text') {
          return { ...base, textValue: ipcText[ipc.criteriaId] || '' };
        }
        return { ...base, sampleResults: ipcSampleResults[ipc.criteriaId] || [] };
      });

  /** Validate every UNRECORDED linked IPC has its inputs filled. Already-
   *  recorded criteria are not re-prompted, so they don't need validation.
   *  Phase 8d — when selectedSubStepId is set, only validate IPCs of that
   *  sub-step (the dialog only shows those). */
  const ipcInputsComplete = (step: SOPStep | null): boolean => {
    if (!step?.linkedIPC?.length) return true;
    const ipcs = linkedIPCsForDialog(step);
    if (!ipcs.length) return true;
    for (const ipc of ipcs) {
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
    // Phase 8b — when any IPC will trigger Deviation, require the operator
    // to type a reason inline so the deviation record carries the rationale.
    // Phase 8d — only consider IPCs visible in the current dialog scope.
    const triggering = linkedIPCsForDialog(selectedStep).filter(
      (ipc) => !ipc.recordedTestId && willTriggerDeviationRound1(ipc),
    );
    for (const ipc of triggering) {
      const reason = (ipcDeviationReason[ipc.criteriaId] || '').trim();
      if (!reason) {
        toast.error(
          'Deviation Reason Required',
          `กรุณาระบุเหตุผลของ Deviation สำหรับ ${ipc.criteriaCode} (${ipc.criteriaNameTh || ipc.criteriaName})`,
        );
        return;
      }
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

  // Step number to show inside dialogs — matches the renumbered position
  // in the on-screen list when a phase filter is active.
  const displaySequenceFor = (step: SOPStep | null): number => {
    if (!step) return 0;
    if (!phaseFilter) return step.sequence;
    const idx = (displaySteps ?? []).findIndex((s) => s.id === step.id);
    return idx >= 0 ? idx + 1 : step.sequence;
  };

  // Progress card counts steps in the currently-visible scope so the
  // numbers match what the operator sees on screen. Filtering to one
  // phase shouldn't surface steps from other phases in the totals.
  const calculateProgress = () => {
    const list = displaySteps ?? steps ?? [];
    if (list.length === 0) return { total: 0, completed: 0, verified: 0 };
    const total = list.length;
    const completed = list.filter(s => ['completed', 'verified'].includes(s.status)).length;
    const verified = list.filter(s => s.status === 'verified').length;
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
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <DxLoadIndicator />
        <p className="text-sm text-slate-500">กำลังโหลดข้อมูล Work Order...</p>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="text-center py-16">
        <div className="mx-auto mb-4 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-100 to-red-100 shadow-inner">
          <AlertCircle className="h-10 w-10 text-rose-600" />
        </div>
        <p className="text-slate-700 font-semibold text-lg">Work Order not found</p>
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

  // Phase color theme map — gradient classes per execution phase.
  // Used for header banner, step accents, and dialog headers to give each
  // phase a visually distinct identity.
  const phaseTheme = (phase?: SOPPhase | null) => {
    switch (phase) {
      case 'pre_production':
        return {
          gradient: 'from-sky-500 to-cyan-500',
          softBg: 'from-sky-50 to-cyan-50',
          border: 'border-sky-300',
          accent: 'bg-sky-500',
          text: 'text-sky-700',
          ring: 'ring-sky-200',
        };
      case 'production':
        return {
          gradient: 'from-emerald-500 to-teal-500',
          softBg: 'from-emerald-50 to-teal-50',
          border: 'border-emerald-300',
          accent: 'bg-emerald-500',
          text: 'text-emerald-700',
          ring: 'ring-emerald-200',
        };
      case 'post_production':
        return {
          gradient: 'from-amber-500 to-orange-500',
          softBg: 'from-amber-50 to-orange-50',
          border: 'border-amber-300',
          accent: 'bg-amber-500',
          text: 'text-amber-700',
          ring: 'ring-amber-200',
        };
      case 'packaging':
        return {
          gradient: 'from-violet-500 to-fuchsia-500',
          softBg: 'from-violet-50 to-fuchsia-50',
          border: 'border-violet-300',
          accent: 'bg-violet-500',
          text: 'text-violet-700',
          ring: 'ring-violet-200',
        };
      default:
        return {
          gradient: 'from-slate-600 to-slate-700',
          softBg: 'from-slate-50 to-gray-50',
          border: 'border-slate-300',
          accent: 'bg-slate-500',
          text: 'text-slate-700',
          ring: 'ring-slate-200',
        };
    }
  };
  const activeTheme = phaseTheme(phaseFilter);
  const progressPct = progress.total > 0 ? (progress.verified / progress.total) * 100 : 0;
  const completedPct = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border bg-gradient-to-br from-slate-50 via-white to-slate-50 min-h-screen">
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
          { label: 'Execution', href: `/production/work-orders/${workOrderId}?tab=execution` },
          { label: 'SOP Execution' },
        ]}
        actions={
          <DxButton
            text="Back to Execution"
            icon="back"
            stylingMode="outlined"
            onClick={() => router.push(`/production/work-orders/${workOrderId}?tab=execution`)}
          />
        }
      />

      {/* WO Banner — gradient hero card showing WO context with progress stats */}
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${activeTheme.gradient} shadow-lg shadow-slate-300/40`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.25),_transparent_60%)]" />
        <div className="absolute -right-12 -bottom-12 opacity-10">
          <ClipboardList className="h-48 w-48 text-white" />
        </div>
        <div className="relative p-5 md:p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/80">
                <span className="inline-flex h-2 w-2 rounded-full bg-white animate-pulse" />
                {phaseFilter ? SOP_PHASE_LABELS[phaseFilter] : 'All Phases'}
                <span className="opacity-50">·</span>
                <span>{workOrder.status}</span>
              </div>
              <h2 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight">
                {workOrder.woNumber}
              </h2>
              <p className="text-white/85 text-sm mt-0.5">
                {workOrder.productName} <span className="text-white/60">·</span> Batch{' '}
                <span className="font-mono font-semibold">{workOrder.batchNumber}</span>
              </p>
            </div>
            <div className="flex items-center gap-3 md:gap-5">
              <div className="text-right">
                <div className="text-3xl md:text-4xl font-bold leading-none tabular-nums">
                  {progress.completed}
                  <span className="text-lg text-white/70 font-normal">/{progress.total}</span>
                </div>
                <div className="text-[11px] uppercase tracking-wider text-white/75 mt-1">Completed</div>
              </div>
              <div className="h-12 w-px bg-white/30" />
              <div className="text-right">
                <div className="text-3xl md:text-4xl font-bold leading-none tabular-nums">
                  {progress.verified}
                  <span className="text-lg text-white/70 font-normal">/{progress.total}</span>
                </div>
                <div className="text-[11px] uppercase tracking-wider text-white/75 mt-1">Verified</div>
              </div>
              {progress.verified === progress.total && progress.total > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-semibold border border-white/30 shadow-sm">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  All Verified
                </span>
              )}
            </div>
          </div>
          {/* Dual progress bar — completed (lighter) on top of verified (darker) */}
          <div className="mt-5 space-y-1.5">
            <div className="relative h-2.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
              <div
                className="absolute inset-y-0 left-0 bg-white/40 transition-all duration-500 ease-out"
                style={{ width: `${completedPct}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)] transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-white/70 font-medium">
              <span>{Math.round(progressPct)}% verified</span>
              <span>{Math.round(completedPct)}% completed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Steps List */}
      <Card className="rounded-2xl border-slate-200/70 shadow-sm shadow-slate-200/40 backdrop-blur-sm bg-white/80">
        <CardContent className="p-4 md:p-5">
          {stepsLoading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <DxLoadIndicator />
              <p className="text-sm text-slate-500">กำลังโหลดขั้นตอนการผลิต...</p>
            </div>
          ) : !displaySteps || displaySteps.length === 0 ? (
            executionNotInitialized ? (
              <div className="text-center py-16">
                <div className="mx-auto mb-4 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-cyan-100 shadow-inner">
                  <ClipboardList className="h-10 w-10 text-sky-600" />
                </div>
                <p className="text-slate-800 font-semibold text-lg">
                  BOM มีขั้นตอน SOP {bomConfig!.sopSteps.length} ขั้นตอน
                </p>
                <p className="text-sm text-slate-500 mt-1.5 mb-5 max-w-md mx-auto">
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
              <div className="text-center py-16">
                <div className="mx-auto mb-4 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 shadow-inner">
                  <AlertCircle className="h-10 w-10 text-amber-600" />
                </div>
                <p className="text-slate-700 font-semibold">No SOP steps configured for this work order&apos;s BOM.</p>
                <p className="text-sm text-slate-500 mt-2">Configure the BOM to add production steps.</p>
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

                const stepTheme = phaseTheme(step.phase as SOPPhase);
                // Modern status pill with gradient + animated dot for in_progress
                const statusPillClasses =
                  step.status === 'in_progress'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm shadow-amber-200'
                    : step.status === 'completed'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm shadow-emerald-200'
                      : step.status === 'verified'
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm shadow-blue-200'
                        : step.status === 'deviation'
                          ? 'bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-sm shadow-rose-200'
                          : 'bg-slate-200 text-slate-700';
                return (
                  <div
                    key={step.id}
                    className={`group relative overflow-hidden rounded-2xl border bg-white/95 backdrop-blur-sm shadow-sm shadow-slate-200/60 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 ${
                      step.status === 'in_progress'
                        ? 'border-amber-300 ring-2 ring-amber-100 bg-gradient-to-br from-amber-50/40 to-white'
                        : step.status === 'verified'
                          ? 'border-blue-200/70'
                          : step.status === 'deviation'
                            ? 'border-rose-200 ring-1 ring-rose-100'
                            : 'border-slate-200/70'
                    }`}
                  >
                    {/* Phase color accent stripe — left edge */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${stepTheme.gradient}`} />
                    <div className="p-4 md:p-5 pl-5 md:pl-6">
                    {/* Mobile: stack title block above action buttons so the
                        title isn't squeezed into a thin column when
                        Start/Complete/Verify chips are also rendered. */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex items-start gap-3 md:gap-4 min-w-0 flex-1">
                        <div className={`relative flex-none w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${stepTheme.gradient} text-white shadow-md shadow-slate-200/60`}>
                          <StatusIcon className="h-5 w-5" />
                          {step.status === 'in_progress' && (
                            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-amber-400 ring-2 ring-white animate-pulse" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base md:text-lg font-semibold text-slate-900 tracking-tight break-words">
                              {/* Renumber from 1 within the filtered view —
                                  e.g. global seq 2 + 5 in pre_production
                                  shows as "step 1" + "step 2". The original
                                  global sequence is kept as a small badge so
                                  audit trails still align. */}
                              {t('bomConfiguration.step', { sequence: phaseFilter ? displayIndex + 1 : step.sequence })}: {locale === 'th' && step.stepNameTh ? step.stepNameTh : step.stepName}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${statusPillClasses}`}>
                              {step.status === 'in_progress' && (
                                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                              )}
                              {statusInfo.label}
                            </span>
                            {step.requiresVerification && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                                <UserCheck className="h-2.5 w-2.5" />
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

                          {/* Template-level GMP document — links the whole SOP
                              Template (distinct from per-sub-step and per-IPC). */}
                          {step.templateGmpDocumentId != null && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setPreviewDocId(step.templateGmpDocumentId!); }}
                              className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                              title="ดูเอกสาร GMP ของ SOP Template"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              {docLabelMap?.[step.templateGmpDocumentId] ?? 'เอกสาร SOP Template'}
                            </button>
                          )}

                          {/* BOM Instructions */}
                          {stepInstructions && (
                            <div className="mt-3 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/70 rounded-xl p-3.5 shadow-sm">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 mb-1.5 flex items-center gap-1.5">
                                <ListChecks className="h-3.5 w-3.5" />
                                {t('bomConfiguration.instructions')}
                              </p>
                              <p className="text-sm text-blue-900 leading-relaxed">{stepInstructions}</p>
                              {/* Show secondary language instructions */}
                              {locale === 'th' && step.instructions && step.instructionsTh && (
                                <p className="text-xs text-blue-600/80 mt-1.5 italic">{step.instructions}</p>
                              )}
                              {locale !== 'th' && step.instructionsTh && (
                                <p className="text-xs text-blue-600/80 mt-1.5 italic">{step.instructionsTh}</p>
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
                              <div className="mt-3 bg-gradient-to-br from-emerald-50 via-teal-50/60 to-emerald-50 border border-emerald-200/80 rounded-xl p-3.5 shadow-sm">
                                <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
                                  <p className="text-sm font-bold text-emerald-900 flex items-center gap-1.5">
                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
                                      <ListChecks className="h-4 w-4" />
                                    </span>
                                    ขั้นตอนย่อย
                                    <span className="ml-1 px-2 py-0.5 rounded-full bg-white/70 text-emerald-700 text-[11px] font-mono font-semibold border border-emerald-200">
                                      {confirmedCount}/{step.templateSteps!.length}
                                    </span>
                                  </p>
                                  {subStepsEditable && !allConfirmed && (
                                    <button
                                      onClick={() => confirmAllSubSteps(step)}
                                      disabled={confirmSubStepsMutation.isPending}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      ยืนยันทั้งหมด
                                    </button>
                                  )}
                                  {allConfirmed && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-100 border border-emerald-300 rounded-lg">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      ยืนยันครบแล้ว
                                    </span>
                                  )}
                                  {!subStepsEditable && step.status === 'pending' && (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg font-medium">
                                      <AlertCircle className="h-3 w-3" />
                                      กด Start ก่อนถึงติ๊กได้
                                    </span>
                                  )}
                                </div>
                                {/* Progress bar */}
                                <div className="w-full h-2 bg-emerald-100 rounded-full mb-3 overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                    style={{ width: `${step.templateSteps!.length > 0 ? (confirmedCount / step.templateSteps!.length) * 100 : 0}%` }}
                                  />
                                </div>
                                <ol className="space-y-1.5">
                                  {step.templateSteps!.map((sub, subIdx) => {
                                    const isConfirmed = confirmed.includes(sub.id);
                                    const subNameTh = sub.stepNameTh || sub.stepName;
                                    const subInstrTh = sub.instructionsTh || sub.instructions;
                                    // Phase 8c — surface IPC criteria linked to THIS sub-step
                                    // inline so operator sees the test alongside the procedure.
                                    const subIPCs = (step.linkedIPC || []).filter(
                                      (ipc) => ipc.procedureStepId === sub.id,
                                    );
                                    return (
                                      <li
                                        key={sub.id}
                                        className={`p-2.5 rounded-xl transition-all border ${
                                          isConfirmed
                                            ? 'bg-emerald-100/60 border-emerald-200'
                                            : 'bg-white/70 border-emerald-100 hover:bg-white hover:border-emerald-300 hover:shadow-sm'
                                        }`}
                                      >
                                        <div className="flex items-start gap-2.5">
                                          <div
                                            className={`flex-none w-6 h-6 mt-0.5 rounded-md border-2 flex items-center justify-center transition-all ${isConfirmed ? 'bg-gradient-to-br from-emerald-500 to-teal-500 border-emerald-600 shadow-sm' : 'border-slate-300 bg-white hover:border-emerald-400'} ${subStepsEditable ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
                                            onClick={() => subStepsEditable && toggleSubStep(step, sub.id)}
                                          >
                                            {isConfirmed && (
                                              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                              </svg>
                                            )}
                                          </div>
                                          <span className={`flex-none text-xs font-bold w-6 text-center mt-1 tabular-nums ${isConfirmed ? 'text-emerald-700' : 'text-slate-400'}`}>
                                            {subIdx + 1}.
                                          </span>
                                          <div
                                            className={`flex-1 min-w-0 ${subStepsEditable ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
                                            onClick={() => subStepsEditable && toggleSubStep(step, sub.id)}
                                          >
                                            <p className={`text-sm font-semibold ${isConfirmed ? 'text-emerald-800 line-through decoration-emerald-400 decoration-2' : 'text-slate-900'}`}>{subNameTh}</p>
                                            {subInstrTh && (
                                              <p className={`text-xs mt-1 whitespace-pre-line leading-relaxed ${isConfirmed ? 'text-emerald-600/80' : 'text-slate-600'}`}>{subInstrTh}</p>
                                            )}
                                            {sub.gmpDocumentId != null && (
                                              <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setPreviewDocId(sub.gmpDocumentId!); }}
                                                className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                                                title="ดูเอกสาร GMP"
                                              >
                                                <FileText className="h-3.5 w-3.5" />
                                                {docLabelMap?.[sub.gmpDocumentId] ?? 'ดูเอกสาร GMP'}
                                              </button>
                                            )}
                                          </div>
                                          {/* Phase 8e — Prominent "บันทึก IPC" button at sub-step
                                              header. Highlighted when there are unrecorded IPCs and
                                              the parent step is in_progress. Stops propagation so
                                              clicking the button doesn't toggle the sub-step. */}
                                          {(() => {
                                            const unrecorded = subIPCs.filter((i) => !i.recordedTestId);
                                            const canRecord = step.status === 'in_progress' && unrecorded.length > 0;
                                            if (!canRecord) return null;
                                            return (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleOpenIPCDialog(step, sub.id);
                                                }}
                                                className="flex-none inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 shadow-sm hover:shadow transition-all"
                                                title={`บันทึก IPC ${unrecorded.length} รายการของขั้นตอนนี้`}
                                              >
                                                <FlaskConical className="h-3.5 w-3.5" />
                                                บันทึก IPC
                                                <span className="ml-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-white/30 text-[10px] font-bold">
                                                  {unrecorded.length}
                                                </span>
                                              </button>
                                            );
                                          })()}
                                        </div>
                                        {/* IPC criteria linked to this sub-step — visible inline so
                                            operator sees the test alongside the procedure (Phase 8c).
                                            Click recorded badge to expand sample details + retest options. */}
                                        {subIPCs.length > 0 && (
                                          <div className="mt-2 ml-12 space-y-1.5">
                                            {subIPCs.map((ipc) => {
                                              const isExpanded = ipc.recordedTestId && expandedRecordedIPC.has(ipc.recordedTestId);
                                              return (
                                                <div
                                                  key={ipc.id}
                                                  className="px-2 py-1.5 rounded bg-white border border-emerald-200/60"
                                                >
                                                  <div className="flex items-start gap-1.5 text-xs">
                                                    <FlaskConical className="h-3 w-3 text-emerald-600 mt-0.5 flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                      <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-mono font-semibold text-emerald-700 bg-emerald-50 px-1 rounded text-[10px]">
                                                          {ipc.criteriaCode}
                                                        </span>
                                                        <span className="text-gray-900 break-words min-w-0">
                                                          {ipc.criteriaNameTh || ipc.criteriaName}
                                                        </span>
                                                        {ipc.isCritical && (
                                                          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold bg-rose-100 text-rose-700 px-1 rounded">
                                                            <AlertCircle className="h-2 w-2" />
                                                            Critical
                                                          </span>
                                                        )}
                                                        {ipc.recordedTestId ? (
                                                          <button
                                                            type="button"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              toggleExpandedRecorded(ipc.recordedTestId!);
                                                            }}
                                                            className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors ${
                                                              ipc.recordedStatus === 'pass'
                                                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                                : ipc.recordedStatus === 'fail'
                                                                  ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                                                                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                                            }`}
                                                            title="คลิกเพื่อดูรายละเอียดและบันทึกรอบใหม่"
                                                          >
                                                            <CheckCircle2 className="h-2.5 w-2.5" />
                                                            {ipc.recordedStatus === 'pass'
                                                              ? 'ผ่าน'
                                                              : ipc.recordedStatus === 'fail'
                                                                ? 'ไม่ผ่าน'
                                                                : 'รอผล'}
                                                            {isExpanded ? ' ▴' : ' ▾'}
                                                          </button>
                                                        ) : (
                                                          <span className="inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                                            ยังไม่บันทึก
                                                          </span>
                                                        )}
                                                      </div>
                                                      <IPCSpecLines ipc={ipc} size="10" />
                                                      {/* Per-IPC GMP document — distinct from the
                                                          template-level and sub-step document links. */}
                                                      {ipc.gmpDocumentId != null && (
                                                        <button
                                                          type="button"
                                                          onClick={(e) => { e.stopPropagation(); setPreviewDocId(ipc.gmpDocumentId!); }}
                                                          className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                                                          title="ดูเอกสาร GMP ของ IPC"
                                                        >
                                                          <FileText className="h-3 w-3" />
                                                          {docLabelMap?.[ipc.gmpDocumentId] ?? 'เอกสาร IPC'}
                                                        </button>
                                                      )}
                                                    </div>
                                                  </div>
                                                  {/* Expanded round-by-round details + retest button */}
                                                  {isExpanded && renderRecordedDetails(step, ipc)}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
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

                          {/* Linked IPC criteria — orphans only (Phase 8c).
                              IPCs whose procedureStepId matches a sub-step are
                              now rendered inline under that sub-step. We keep
                              this section as a fallback for IPCs that don't
                              match any current sub-step (rare — usually means
                              the SOP template was edited after this WO was
                              initialized). */}
                          {(() => {
                            const subStepIds = new Set((step.templateSteps || []).map((s) => s.id));
                            const orphanIPCs = (step.linkedIPC || []).filter(
                              (ipc) => !subStepIds.has(ipc.procedureStepId),
                            );
                            if (orphanIPCs.length === 0) return null;
                            return (
                            <div className="mt-3 pt-3 border-t border-dashed border-emerald-200">
                              <div className="flex items-center justify-between mb-2">
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 uppercase tracking-wide">
                                  <FlaskConical className="h-3.5 w-3.5" />
                                  IPC อื่นๆ (ไม่ผูกกับ sub-step ปัจจุบัน)
                                </span>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[11px] font-semibold">
                                  {orphanIPCs.length}
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                {orphanIPCs.map((ipc) => {
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
                                        <IPCSpecLines ipc={ipc} />
                                        {/* Per-IPC GMP document link. */}
                                        {ipc.gmpDocumentId != null && (
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setPreviewDocId(ipc.gmpDocumentId!); }}
                                            className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                                            title="ดูเอกสาร GMP ของ IPC"
                                          >
                                            <FileText className="h-3 w-3" />
                                            {docLabelMap?.[ipc.gmpDocumentId] ?? 'เอกสาร IPC'}
                                          </button>
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
                            );
                          })()}

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

                      <div className="flex flex-wrap gap-2 items-center justify-start sm:justify-end sm:flex-shrink-0">
                        {isBlockedByVerification && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 font-medium">
                            <Clock className="h-3 w-3" />
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
                        {/* Phase 8d — step-level "บันทึก IPC" only for orphan IPCs.
                            IPCs linked to current sub-steps now have per-sub-step
                            buttons inside the sub-step list. */}
                        {(() => {
                          if (!canComplete) return null;
                          const subStepIds = new Set((step.templateSteps || []).map((s) => s.id));
                          const orphanUnrecorded = (step.linkedIPC || []).filter(
                            (ipc) => !subStepIds.has(ipc.procedureStepId) && !ipc.recordedTestId,
                          );
                          if (orphanUnrecorded.length === 0) return null;
                          return (
                            <DxButton
                              text={`บันทึก IPC อื่น (${orphanUnrecorded.length})`}
                              icon="testrun"
                              type="default"
                              stylingMode="outlined"
                              onClick={() => handleOpenIPCDialog(step)}
                              disabled={recordIPCOnlyMutation.isPending}
                            />
                          );
                        })()}
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
        width={480}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-5 space-y-4">
          <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${phaseTheme(selectedStep?.phase as SOPPhase).gradient} p-4 text-white shadow-md`}>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.2),_transparent_60%)]" />
            <div className="relative">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-white/80 mb-1 inline-flex items-center gap-1.5">
                <Play className="h-3 w-3" />
                Start step
              </div>
              <h4 className="font-bold text-lg leading-snug">
                {t('bomConfiguration.step', { sequence: displaySequenceFor(selectedStep) })}: {locale === 'th' && selectedStep?.stepNameTh ? selectedStep.stepNameTh : selectedStep?.stepName}
              </h4>
              {(() => {
                const instr = locale === 'th' && selectedStep?.instructionsTh ? selectedStep.instructionsTh : selectedStep?.instructions;
                return instr ? <p className="text-sm text-white/90 mt-1.5 leading-relaxed">{instr}</p> : null;
              })()}
            </div>
          </div>

          {(() => {
            const expected = parseJson<Record<string, number>>(selectedStep?.expectedParameters);
            if (!expected || Object.keys(expected).length === 0) return null;
            return (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5" />
                  {t('bomConfiguration.parameters')}
                </h5>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(expected).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm bg-white px-2.5 py-1.5 rounded-lg border border-slate-100">
                      <span className="text-slate-600">{key}</span>
                      <span className="font-semibold text-slate-900 tabular-nums">{value}</span>
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
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 mb-2 flex items-center gap-1.5">
                  <Wrench className="h-3.5 w-3.5" />
                  {t('bomConfiguration.equipment')}
                </h5>
                <div className="flex flex-wrap gap-2">
                  {eqIds.map((eqId) => {
                    const equip = equipmentLookup.get(eqId);
                    return equip ? (
                      <span key={eqId} className="inline-flex items-center gap-1 px-2 py-1 bg-white text-sm text-indigo-800 rounded-lg border border-indigo-200 shadow-sm">
                        <strong>{equip.code}</strong>
                        <span className="text-indigo-600">({locale === 'th' && equip.nameTh ? equip.nameTh : equip.name})</span>
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            );
          })()}

          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-3">
            <Clock className="inline h-3.5 w-3.5 text-slate-500 mr-1 -mt-0.5" />
            Starting this step will record the current time and operator. You can then record actual parameters when completing the step.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
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
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${phaseTheme(selectedStep?.phase as SOPPhase).gradient} p-4 text-white shadow-md`}>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.2),_transparent_60%)]" />
            <div className="relative">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-white/80 mb-1 inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3" />
                Complete step
              </div>
              <h4 className="font-bold text-lg leading-snug">
                {t('bomConfiguration.step', { sequence: displaySequenceFor(selectedStep) })}: {locale === 'th' && selectedStep?.stepNameTh ? selectedStep.stepNameTh : selectedStep?.stepName}
              </h4>
              {(() => {
                const instr = locale === 'th' && selectedStep?.instructionsTh ? selectedStep.instructionsTh : selectedStep?.instructions;
                return instr ? <p className="text-sm text-white/90 mt-1.5 leading-relaxed">{instr}</p> : null;
              })()}
            </div>
          </div>

          {/* Actual Parameters Input */}
          {(() => {
            const expected = parseJson<Record<string, number>>(selectedStep?.expectedParameters);
            if (!expected || Object.keys(expected).length === 0) return null;
            return (
              <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5" />
                  Record Actual Parameters
                </h5>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(expected).map(([key, expectedValue]) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        {key} <span className="text-slate-400 font-normal">(expected: {expectedValue})</span>
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
                // New-type criteria route to the dedicated recorder panel
                // (writes to ipc_recording_rounds, keyed by WO batchNumber).
                if (isNewType(ipc.criteriaType) && workOrder?.batchNumber) {
                  return (
                    <NewTypeRecorderPanel
                      key={ipc.id}
                      criteria={{
                        id: ipc.criteriaId,
                        code: ipc.criteriaCode,
                        name: ipc.criteriaName ?? '',
                        nameTh: ipc.criteriaNameTh ?? null,
                        unit: ipc.unit ?? null,
                        criteriaType: ipc.criteriaType || 'numeric',
                        specification: ipc.specification ?? null,
                      }}
                      batchNumber={workOrder.batchNumber}
                      compact
                    />
                  );
                }
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
                    <div className="mb-2"><IPCSpecLines ipc={ipc} /></div>

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

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-2">Notes</label>
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
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-gradient-to-r from-slate-50 to-white shrink-0">
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
          setSelectedSubStepId(null);
          setIpcNumeric({});
          setIpcSampleResults({});
          setIpcText({});
          setIpcDeviationReason({});
        }}
        title="บันทึก IPC"
        width={560}
        height="90vh"
        showCloseButton
        dragEnabled={false}
      >
        <div className="flex flex-col h-full">
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 p-4 text-white shadow-md">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.2),_transparent_60%)]" />
              <div className="relative">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-white/80 mb-1 inline-flex items-center gap-1.5">
                  <FlaskConical className="h-3 w-3" />
                  IPC Recording
                </div>
                <h4 className="font-bold text-base leading-snug">
                  {t('bomConfiguration.step', { sequence: displaySequenceFor(selectedStep) })}: {locale === 'th' && selectedStep?.stepNameTh ? selectedStep.stepNameTh : selectedStep?.stepName}
                </h4>
                <p className="text-xs text-white/85 mt-1.5">
                  บันทึก IPC ก่อน Complete Step ได้ — ค่าที่บันทึกจะ replace ค่าก่อนหน้าเสมอ
                </p>
              </div>
            </div>

            {(() => {
              const dialogIPCs = linkedIPCsForDialog(selectedStep);
              if (!dialogIPCs.length) return (
                <p className="text-sm text-gray-500 text-center py-8">ไม่มี IPC ผูกไว้กับ step นี้</p>
              );
              const subStepLabel = selectedSubStepId != null
                ? selectedStep?.templateSteps?.find((s) => s.id === selectedSubStepId)?.stepNameTh
                  ?? selectedStep?.templateSteps?.find((s) => s.id === selectedSubStepId)?.stepName
                  ?? null
                : null;
              return (
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-emerald-800 flex items-center gap-1.5">
                  <FlaskConical className="h-4 w-4" />
                  IPC Test ({dialogIPCs.length})
                  {subStepLabel && (
                    <span className="text-xs font-normal text-emerald-600">— {subStepLabel}</span>
                  )}
                </h5>
                {dialogIPCs.map((ipc) => {
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
                      <div className="mb-2"><IPCSpecLines ipc={ipc} /></div>
                      {/* Per-IPC GMP document — visible while recording values. */}
                      {ipc.gmpDocumentId != null && (
                        <button
                          type="button"
                          onClick={() => setPreviewDocId(ipc.gmpDocumentId!)}
                          className="mb-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                          title="ดูเอกสาร GMP ของ IPC"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {docLabelMap?.[ipc.gmpDocumentId] ?? 'เอกสาร IPC'}
                        </button>
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

                      {/* Phase 8b — Inline Deviation reason. Shown when this
                          IPC's current inputs will trigger a Deviation immediately
                          on save (Critical OR maxRetestRounds=0 + any fail). */}
                      {willTriggerDeviationRound1(ipc) && (
                        <div className="mt-3 p-2.5 rounded border border-rose-300 bg-rose-50/60">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-800 mb-1.5">
                            <AlertCircle className="h-3.5 w-3.5" />
                            จะสร้าง Deviation ทันทีหลังบันทึก
                          </div>
                          <label className="block text-xs font-medium text-rose-900 mb-1">
                            เหตุผลของ Deviation <span className="text-red-500">*</span>
                          </label>
                          <DxTextArea
                            value={ipcDeviationReason[ipc.criteriaId] || ''}
                            onValueChanged={(e) =>
                              setIpcDeviationReason({
                                ...ipcDeviationReason,
                                [ipc.criteriaId]: e.value || '',
                              })
                            }
                            placeholder="อธิบายสิ่งที่สังเกตเห็น หรือสาเหตุที่คาดว่าทำให้ fail..."
                            height={70}
                          />
                          <p className="text-[10px] text-rose-700 mt-1">
                            เหตุผลนี้จะถูกใช้เป็น description ของ Deviation ที่ระบบสร้างให้อัตโนมัติ
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              );
            })()}
          </div>
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-gradient-to-r from-slate-50 to-white shrink-0">
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
        width={560}
        height="90vh"
        showCloseButton
        dragEnabled={false}
        deferRendering={false}
      >
        <div className="flex flex-col h-full">
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {retestTarget ? (<>
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 p-4 text-white shadow-md">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.2),_transparent_60%)]" />
                <div className="relative">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-white/85 mb-1 inline-flex items-center gap-1.5">
                    <FlaskConical className="h-3 w-3" />
                    Retest · Round {retestTarget.nextRound}
                  </div>
                  <div className="font-bold text-base leading-snug flex items-center gap-1.5">
                    {retestTarget.ipc.criteriaCode} · {retestTarget.ipc.criteriaNameTh || retestTarget.ipc.criteriaName}
                  </div>
                  <div className="text-xs text-white/90 mt-1.5">
                    {retestTarget.isMultiStage ? (
                      <>Stage {retestTarget.nextRound} · sample size <strong>{retestTarget.stage.sampleSize}</strong> · tolerance <strong>{retestTarget.stage.tolerancePercent}%</strong> · onFail: <strong>{retestTarget.stage.onFail}</strong></>
                    ) : (
                      <>รอบที่ <strong>{retestTarget.nextRound}</strong> · sample size <strong>{retestTarget.stage.sampleSize}</strong> · ใช้เกณฑ์เดิมจาก master criteria</>
                    )}
                  </div>
                </div>
              </div>

              {/* Retest reason — required on round 2+ for single-stage criteria
                  per FDA OOS 2006. Multi-stage skips this since the stage plan
                  governs progression. */}
              {!retestTarget.isMultiStage && (
                <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/40">
                  <label className="block text-sm font-semibold text-amber-900 mb-2">
                    เหตุผลการทดสอบซ้ำ <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <label className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
                      retestReason === 'justified' ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                      <input
                        type="radio"
                        name="retestReason"
                        checked={retestReason === 'justified'}
                        onChange={() => setRetestReason('justified')}
                        className="mt-1"
                      />
                      <div className="flex-1 text-xs">
                        <div className="font-semibold text-emerald-800">Justified — พบสาเหตุชัดเจน</div>
                        <div className="text-gray-600 mt-0.5">เก็บตัวอย่างผิด / เครื่องมือผิดปกติ / ขั้นตอนคลาดเคลื่อน — รอบนี้นับเป็น retest ปกติ</div>
                      </div>
                    </label>
                    <label className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
                      retestReason === 'unjustified' ? 'border-rose-400 bg-rose-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                      <input
                        type="radio"
                        name="retestReason"
                        checked={retestReason === 'unjustified'}
                        onChange={() => setRetestReason('unjustified')}
                        className="mt-1"
                      />
                      <div className="flex-1 text-xs">
                        <div className="font-semibold text-rose-800">Unjustified — ไม่พบสาเหตุชัดเจน</div>
                        <div className="text-gray-600 mt-0.5">⚠️ ระบบจะสร้าง <strong>Deviation</strong> ทันที (FDA OOS 2006)</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

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

              {/* Debug fallback: if none of the input blocks render (because
                  criteriaType is unknown OR sample buffers are empty),
                  show a diagnostic message so the operator isn't stuck
                  with a blank dialog. */}
              {(() => {
                const ct = retestTarget.ipc.criteriaType;
                const numericRendered = ct === 'numeric' && retestNumeric.length > 0;
                const textRendered = ct === 'text';
                const passFailRendered = ct !== 'numeric' && ct !== 'text' && retestSampleResults.length > 0;
                if (numericRendered || textRendered || passFailRendered) return null;
                return (
                  <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-900">
                    <div className="font-semibold mb-1">⚠️ ไม่สามารถสร้างฟอร์มกรอกข้อมูลได้</div>
                    <div className="text-xs space-y-0.5">
                      <div>criteriaType: <code>{String(ct)}</code></div>
                      <div>sampleSize: <code>{retestTarget.stage.sampleSize}</code></div>
                      <div>retestNumeric.length: <code>{retestNumeric.length}</code></div>
                      <div>retestSampleResults.length: <code>{retestSampleResults.length}</code></div>
                    </div>
                    <div className="mt-2 text-xs">กรุณาส่งข้อมูลนี้ให้ผู้พัฒนาตรวจสอบ</div>
                  </div>
                );
              })()}

              {/* Phase 8b — Inline Deviation reason on retest. Visible whenever
                  current inputs / settings will trigger a Deviation:
                  Unjustified retest, Critical fail, or final-round fail. */}
              {willTriggerDeviationRetest() && (
                <div className="p-2.5 rounded border border-rose-300 bg-rose-50/60">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-800 mb-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    จะสร้าง Deviation ทันทีหลังบันทึก
                    {retestReason === 'unjustified' && <span className="text-[10px] font-normal">— Unjustified retest (FDA OOS 2006)</span>}
                  </div>
                  <label className="block text-xs font-medium text-rose-900 mb-1">
                    เหตุผลของ Deviation <span className="text-red-500">*</span>
                  </label>
                  <DxTextArea
                    value={retestDeviationReason}
                    onValueChanged={(e) => setRetestDeviationReason(e.value || '')}
                    placeholder="อธิบายสิ่งที่สังเกตเห็น หรือสาเหตุที่คาดว่าทำให้ fail..."
                    height={70}
                  />
                  <p className="text-[10px] text-rose-700 mt-1">
                    เหตุผลนี้จะถูกใช้เป็น description ของ Deviation ที่ระบบสร้างให้อัตโนมัติ
                  </p>
                </div>
              )}
            </>) : (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
                <DxLoadIndicator />
                <p className="text-sm">กำลังโหลด...</p>
              </div>
            )}
          </div>
          {retestTarget && (
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-gradient-to-r from-amber-50 to-white shrink-0">
              <DxButton text="ยกเลิก" stylingMode="outlined" onClick={closeRetest} />
              <DxButton
                text={addIPCRoundMutation.isPending ? 'กำลังบันทึก...' : `บันทึกรอบ ${retestTarget.nextRound}`}
                icon="save"
                type="success"
                onClick={handleSubmitRetest}
                disabled={addIPCRoundMutation.isPending}
              />
            </div>
          )}
        </div>
      </DxPopup>

      {/* GMP document preview */}
      <GmpDocumentPreviewDialog
        documentId={previewDocId}
        visible={previewDocId != null}
        onClose={() => setPreviewDocId(null)}
      />
    </div>
  );
}

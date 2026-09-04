'use client';

/**
 * Work Order In-Process Control (IPC) Page
 * Checklist + inline recording of IPC tests during production
 * Tests are defined in BOM config and initialized per work order
 */

import { useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader } from '@/components/shared';
import { SOFT_PRIMARY_BTN } from '@/components/shared/soft-form';
import { OrganicGridTheme } from '@/components/ui/organic-grid-theme';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Card, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
// DxPopup removed — inline recording used instead
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { useToast } from '@/hooks/use-toast';
import {
  FlaskConical,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Layers,
  Building2,
  ClipboardList,
  Lock,
  FileText,
} from 'lucide-react';
import { GmpDocumentPreviewDialog } from '@/components/documents';
import { parseAcceptanceStages, calcStageAcceptance, type AcceptanceStage } from '@/lib/master-data/ipc-stages';
import { formatSpecSummary, parseSpecPayload, parseSharedExtras, type SpecPayload } from '@/lib/master-data/ipc-spec-payload';
import { sqrtPlusOneSampleSize, usesSqrtSampling } from '@/lib/master-data/ipc-sqrt-sampling';
import { effectiveSqrtResultFields } from '@/lib/master-data/ipc-spec-payload';
import {
  IPCRecordDialog,
  type RecordableCriterion,
} from '@/components/ipc-recording/IPCRecordDialog';
import { IPCRoundHistory } from '@/components/ipc-recording/IPCRoundHistory';
import { NewTypeRecorderPanel, isNewType } from '@/components/ipc-recording/NewTypeRecorderPanel';
import { useRealtimeTopic } from '@/hooks/use-realtime-topic';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/number-format';

/**
 * Pass/Fail and Visual criteria are stored as per-sample 'pass'/'fail' just like
 * the legacy 'checkbox' type. We treat them together so the operator UI uses the
 * same per-sample buttons. Numeric uses range checks; Text uses free-text input.
 */
function isChecklistMode(t: string | null | undefined): boolean {
  return t === 'checkbox' || t === 'pass_fail' || t === 'visual';
}

function isTextMode(t: string | null | undefined): boolean {
  return t === 'text';
}

/** Extract the structured spec payload (pass/fail definitions, visual checklist,
 *  text format) from quality_tests.spec_specification when it's stored as JSON.
 *  Falls back to a legacy plain-text mapping for older rows. */
function getSpecPayload(test: IPCTest): SpecPayload | null {
  return parseSpecPayload(test.criteriaType ?? 'numeric', test.specSpecification);
}

/** Resolve the stage that applies to a given round (1-indexed). Returns null
 *  for single-stage tests or rounds beyond the configured plan. */
function getStageForRound(test: IPCTest, round: number): AcceptanceStage | null {
  const stages = parseAcceptanceStages(test.acceptanceStages);
  if (stages.length === 0) return null;
  return stages[round - 1] ?? null;
}

/** Effective sample size: stage's sampleSize when multi-stage, else test's. */
function getEffectiveSampleSize(test: IPCTest, round: number): number {
  const stage = getStageForRound(test, round);
  return stage ? stage.sampleSize : (test.sampleSize || 1);
}

function StageInfoBanner({ test, round }: { test: IPCTest; round: number }) {
  const stages = parseAcceptanceStages(test.acceptanceStages);
  if (stages.length === 0) return null;
  const stage = stages[round - 1];
  if (!stage) return null;
  const math = calcStageAcceptance(stage);
  const isLast = round === stages.length;
  const onFailLabel = stage.onFail === 'next_stage'
    ? `→ ทดสอบ Stage ${round + 1} ถ้าไม่ผ่าน`
    : stage.onFail === 'reject_batch'
    ? '✕ ปฏิเสธรุ่นผลิตถ้าไม่ผ่าน'
    : '⚠ บันทึก Deviation ถ้าไม่ผ่าน';
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs">
      <div className="flex items-center gap-2 mb-1.5">
        <Layers className="h-3.5 w-3.5 text-emerald-700" />
        <span className="font-semibold text-emerald-800">
          Stage {round} of {stages.length} {isLast && '(ขั้นสุดท้าย)'}
        </span>
        <span className="ml-auto text-emerald-700">
          ทดสอบ {math.sampleSize} · เสียได้ {math.allowedFail} · ผ่าน {math.mustPass}
        </span>
      </div>
      <div className="text-emerald-700">{onFailLabel}</div>
    </div>
  );
}

interface IPCTest {
  id: number;
  lotId: number;
  specId: number | null;
  /** Soft FK to ipc_criteria.id. Present for new tests; null for legacy snapshots. */
  ipcCriteriaId: number | null;
  testType: string;
  sampleNumber: string | null;
  sampleSize: number | null;
  testDate: string | null;
  result: string | null;
  numericResult: number | null;
  status: string;
  testedBy: number | null;
  approvedBy: number | null;
  approvedAt: string | null;
  notes: string | null;
  specMinValue: number | null;
  specMaxValue: number | null;
  specSpecification: string | null;
  specUnit: string | null;
  disposition: string | null;
  criteriaType: string | null;
  tolerancePercent: number | null;
  /** Phase 3: snapshot of multi-stage acceptance plan (JSON). Null = single-stage. */
  acceptanceStages: string | null;
  /** Snapshot of phase from BOM IPC config — drives per-phase filter. */
  ipcPhase: string | null;
  testName: string | null;
  testMethod: string | null;
  testedByName: string | null;
  approvedByName: string | null;
  samples: IPCSample[];
  rounds: IPCRound[];
  totalRounds: number;
  // Two-way sync (Bug 2): populated when same criterion was already recorded
  // via SOP execution. UI shows a "recorded via SOP" panel and skips the form.
  sopRecordedTestId?: number | null;
  sopRecordedAt?: string | null;
  sopRecordedBy?: number | null;
  sopRecordedByName?: string | null;
  sopRecordedResult?: string | null;
  sopRecordedStatus?: string | null;
  sopStepNumber?: string | null;
}

/** The slice of a SOP execution's linked IPC that carries the recorded round. */
interface SOPRecordedIPC {
  recordedTestId?: number | null;
  recordedStatus?: string | null;
  recordedSamples?: IPCSample[];
  recordedTestedByName?: string | null;
  recordedTestDate?: string | null;
  recordedAcceptanceStages?: string | null;
}

// Filterable execution phases (pre_packaging collapsed into packaging).
type IPCPhase = 'pre_production' | 'production' | 'post_production' | 'packaging';
/** The order production runs them in. */
const PHASE_ORDER = ['pre_production', 'production', 'post_production', 'pre_packaging', 'packaging'];

const IPC_PHASE_LABELS: Record<string, string> = {
  pre_packaging: 'ก่อนบรรจุ',
  pre_production: 'ก่อนการผลิต',
  production: 'ระหว่างการผลิต',
  post_production: 'หลังการผลิต',
  packaging: 'การบรรจุ',
};

interface IPCSample {
  id: number;
  qualityTestId: number;
  sampleNumber: number;
  testRound: number;
  numericValue: number | null;
  textValue: string | null;
  result: string | null;
}

interface IPCRound {
  round: number;
  samples: IPCSample[];
  result: string;
  avg: number | null;
  isApproved: boolean;
  approvedBy: number | null;
  approvedAt: string | null;
}

interface BOMIPCConfig {
  id: number;
  bomId: number;
  specId: number;
  sequence: number;
  sampleSize: number;
  isCritical: boolean;
  testName: string;
  testMethod: string | null;
  specification: string | null;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
}

interface WorkOrderBasic {
  id: number;
  woNumber: string;
  batchNumber: string;
  productName: string;
  status: string;
  /**
   * The batch yield, which √n + 1 needs as its n.
   *
   * Both already arrive from /detail — the execution header reads them — and
   * are only named here so this screen can use them too.
   */
  plannedQuantity?: number | null;
  actualQuantity?: number | null;
}

/** The latest recorded reading, in the corner the QC entry cards keep it. */
function latestReadingOf(
  samples: { testRound: number; numericValue: number | null; result: string | null }[],
  unit?: string | null,
): { value: string; sub: string } | null {
  if (!samples.length) return null;
  const lastRound = Math.max(...samples.map((x) => x.testRound));
  const inRound = samples.filter((x) => x.testRound === lastRound);
  const nums = inRound
    .map((x) => (x.numericValue == null ? null : Number(x.numericValue)))
    .filter((v): v is number => v != null && Number.isFinite(v));
  const value = nums.length
    ? `${(nums.reduce((a, b) => a + b, 0) / nums.length).toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}`
    : `ผ่าน ${inRound.filter((x) => x.result === 'pass').length}/${inRound.length}`;
  return { value, sub: `รอบที่ ${lastRound}${inRound.length > 1 ? ` · เฉลี่ยจาก ${inRound.length}` : ''}` };
}

// The criterion's spec envelope, rendered exactly as the SOP execution screen
// renders it — same helper, so the two screens cannot drift apart.
function IPCSpecLines({ test }: { test: IPCTest }) {
  const lines = formatSpecSummary({
    criteriaType: test.criteriaType || 'numeric',
    specification: test.specSpecification,
    sampleSize: test.sampleSize,
    minValue: test.specMinValue,
    maxValue: test.specMaxValue,
    unit: test.specUnit,
  });
  if (lines.length === 0) return null;
  return (
    <div className="mt-1 space-y-0.5">
      {lines.map((ln, i) => (
        <div
          key={i}
          className={`flex items-start gap-1.5 text-xs ${
            ln.tone === 'pass' ? 'text-emerald-700'
              : ln.tone === 'fail' ? 'text-rose-700'
                : ln.tone === 'meta' ? 'text-gray-500'
                  : 'text-gray-700'
          }`}
        >
          <span className="w-3.5 flex-none select-none text-center">{ln.icon}</span>
          <span className="break-words">{ln.text}</span>
        </div>
      ))}
    </div>
  );
}

// Recorded state as a soft pill — the same vocabulary the SOP cards use.
function IPCStatusPill({ test }: { test: IPCTest }) {
  const recorded = test.status !== 'pending' && (test.samples?.length ?? 0) > 0;
  if (!recorded) {
    return (
      <span className="inline-flex items-center rounded-md bg-[#f1f3f5] px-1.5 py-0.5 text-[10px] font-semibold text-[#6b7280]">
        ยังไม่บันทึก
      </span>
    );
  }
  const tone =
    test.status === 'pass'
      ? 'bg-[#e8f6ee] text-[#1a8a4a]'
      : test.status === 'fail'
        ? 'bg-[#fbeceb] text-[#c0362c]'
        : 'bg-[#fdf0e6] text-[#b45309]';
  const label =
    test.status === 'pass'
      ? 'บันทึกแล้ว — ผ่าน'
      : test.status === 'fail'
        ? 'บันทึกแล้ว — ไม่ผ่าน'
        : 'บันทึกแล้ว';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${tone}`}>
      <CheckCircle2 className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

const SOFT_META_PILL =
  'inline-flex items-center gap-1 rounded-md bg-[#f1f3f5] px-1.5 py-0.5 text-[10px] font-semibold text-[#6b7280]';

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
    pending: { bg: 'bg-gray-100', text: 'text-gray-700', icon: <Clock className="h-3.5 w-3.5" />, label: 'Pending' },
    pass: { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Pass' },
    fail: { bg: 'bg-red-100', text: 'text-red-700', icon: <XCircle className="h-3.5 w-3.5" />, label: 'Fail' },
    retest: { bg: 'bg-amber-100', text: 'text-amber-700', icon: <AlertTriangle className="h-3.5 w-3.5" />, label: 'Retest' },
    deviation: { bg: 'bg-orange-100', text: 'text-orange-700', icon: <AlertTriangle className="h-3.5 w-3.5" />, label: 'Deviation' },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.icon} {c.label}
    </span>
  );
}

export default function IPCPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useTranslations('production');
  const tc = useTranslations('common');

  const workOrderId = Number(params.id);

  // Phase filter from ?phase= — matches per-phase IPC cards on Execution Dashboard.
  const phaseParam = searchParams.get('phase');
  const phaseFilter: IPCPhase | null =
    phaseParam && ['pre_production', 'production', 'post_production', 'packaging'].includes(phaseParam)
      ? (phaseParam as IPCPhase)
      : null;

  // GMP dual-control: the test's performer can't approve their own work
  const { data: currentUser } = useCurrentUser();

  // Inline record state
  const [selectedTest, setSelectedTest] = useState<IPCTest | null>(null);
  const [numericResult, setNumericResult] = useState<number | undefined>(undefined);
  const [sampleValues, setSampleValues] = useState<(number | undefined)[]>([]);
  const [recordNotes, setRecordNotes] = useState('');
  const [recordRound, setRecordRound] = useState<number>(1);
  const [checkboxResults, setCheckboxResults] = useState<('pass' | 'fail' | null)[]>([]);
  const [expandedTests, setExpandedTests] = useState<Set<number>>(new Set());

  // Recording happens in the same dialog the SOP execution screen opens, over
  // the same card the criteria author previewed. One recording surface for the
  // whole system — press a criterion here or there and you meet the same thing.
  const [recordDialog, setRecordDialog] = useState<RecordableCriterion | null>(null);

  /** Recorded rounds show on the card, open by default; this holds the folded ones. */
  const [collapsedTests, setCollapsedTests] = useState<Set<number>>(new Set());
  const toggleTestCollapsed = (id: number) =>
    setCollapsedTests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // A criterion recorded from a SOP step keeps its samples on that step's own
  // quality_tests row, so this page's row carries only the cross-reference.
  // Read the SOP execution board (a plain GET, nothing written) and index the
  // recorded rounds by test id, so the details can open here instead of
  // sending the operator to another screen to read their own result.
  const { data: sopBoard } = useQuery<{
    /** Recorded rounds, keyed by the quality_tests row they live on. */
    recorded: Record<number, SOPRecordedIPC>;
    /** Position of each criterion in the SOP, keyed by criteriaId. */
    order: Record<number, number>;
    /** The step each criterion is checked at, keyed by criteriaId. */
    step: Record<number, { sequence: number; name: string; phase: string | null }>;
  }>({
    queryKey: ['wo-ipc-sop-board', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/sop-execution`);
      const json = await res.json();
      const steps = json?.data?.executions ?? json?.data?.items ?? json?.data ?? [];
      const recorded: Record<number, SOPRecordedIPC> = {};
      const order: Record<number, number> = {};
      const step: Record<number, { sequence: number; name: string; phase: string | null }> = {};
      let seen = 0;
      // Walk the board in the order the operator works it: step by step, and
      // within a step the order the criteria are listed.
      const inStepOrder = (Array.isArray(steps) ? [...steps] : []).sort(
        (a, b) => Number(a.sequence ?? a.stepSequence ?? 0) - Number(b.sequence ?? b.stepSequence ?? 0),
      );
      for (const step0 of inStepOrder) {
        for (const ipc of step0.linkedIPC ?? []) {
          if (ipc.criteriaId != null && order[Number(ipc.criteriaId)] == null) {
            order[Number(ipc.criteriaId)] = (seen += 1);
            step[Number(ipc.criteriaId)] = {
              sequence: Number(step0.sequence ?? step0.stepSequence ?? 0),
              name: String(step0.stepNameTh || step0.stepName || ''),
              phase: step0.phase ?? null,
            };
          }
          if (ipc.recordedTestId == null) continue;
          recorded[Number(ipc.recordedTestId)] = ipc as SOPRecordedIPC;
        }
      }
      return { recorded, order, step };
    },
    staleTime: 0,
  });
  const sopRecordedMap = sopBoard?.recorded;

  /**
   * √n + 1 worked out against this work order's own yield.
   *
   * MOCKUP: nothing is written anywhere. The figure is derived on screen each
   * time from the work order's quantity, and a criterion using this method
   * still carries whatever sample size it was saved with — that stored number
   * is what the plan would need to stop carrying, and changing what gets saved
   * is not a screen change.
   */
  /** The size a test should record against, once the method is taken into account. */
  const effectiveSampleSize = (test: IPCTest): number => {
    if (usesSqrtSampling(samplingMethodOf(test)) && sqrtPlan) return sqrtPlan.sampleSize;
    return Number(test.sampleSize) || 1;
  };

  const toRecordable = (test: IPCTest): RecordableCriterion => {
    const sampleSize = effectiveSampleSize(test);
    const tolPct = Number(test.tolerancePercent) || 0;
    const min = test.specMinValue == null ? null : Number(test.specMinValue);
    const max = test.specMaxValue == null ? null : Number(test.specMaxValue);
    const stages = parseAcceptanceStages(test.acceptanceStages);
    const criteriaId = test.ipcCriteriaId ?? test.id;
    const criteriaType = (test.criteriaType || 'numeric') as RecordableCriterion['criteriaType'];
    const allowedFail = Math.floor((sampleSize * tolPct) / 100);
    const viaSOP = test.sopRecordedTestId != null
      ? sopRecordedMap?.[Number(test.sopRecordedTestId)] ?? null
      : null;
    return {
      criteriaId,
      criteriaType,
      stage: 'ipc',
      formData: {
        code: criteriaCodeMap?.[criteriaId] ?? `IPC-${criteriaId}`,
        name: test.testName ?? '',
        unit: test.specUnit ?? null,
        sampleSize,
        specTarget: min != null && max != null ? (min + max) / 2 : null,
        specTolerancePercent: 0,
        tolerancePercent: tolPct,
        isCritical: false,
        isActive: true,
      },
      specPayload: parseSpecPayload(criteriaType, test.specSpecification ?? null),
      // The event triggers travel in the same JSON envelope as the spec, so
      // they come from the criterion the operator is recording rather than
      // from a list this screen keeps of its own.
      events: parseSharedExtras(test.specSpecification ?? null).triggers.event.options,
      // Under √n + 1 the operator records the readings the criterion named,
      // not one box per unit drawn — the same boxes the criteria screen shows.
      resultFields: usesSqrtSampling(samplingMethodOf(test))
        ? {
            labels: effectiveSqrtResultFields(
              parseSharedExtras(test.specSpecification ?? null).sqrtResultFields,
            ),
            caption: sqrtPlan
              ? `สุ่มตัวอย่างตามยอดผลิต ${sqrtPlan.lotSize.toLocaleString('en-US')} ชิ้น → ${sqrtPlan.sampleSize} ตัวอย่าง แล้วแบ่งมาทดสอบ`
              : 'สุ่มตัวอย่างตามยอดผลิตของรุ่นนี้ แล้วแบ่งมาทดสอบ',
          }
        : undefined,
      calculatedMinMax:
        min != null && max != null && Number.isFinite(min) && Number.isFinite(max)
          ? { min, max }
          : null,
      acceptanceMath: { sampleSize, allowedFail, mustPass: sampleSize - allowedFail },
      multiStageEnabled: stages.length > 0,
      stages,
      recorded: {
        criteriaId,
        criteriaType,
        unit: test.specUnit ?? null,
        sampleSize,
        tolerancePercent: tolPct,
        isCriteriaCritical: false,
        recordedTestId: viaSOP?.recordedTestId ?? test.id,
        recordedStatus:
          (viaSOP?.recordedStatus as 'pass' | 'fail' | 'pending' | null)
          ?? (test.sopRecordedStatus as 'pass' | 'fail' | 'pending' | null)
          ?? (test.status as 'pass' | 'fail' | 'pending' | null)
          ?? null,
        recordedSamples: (viaSOP?.recordedSamples ?? test.samples ?? []).map((sm) => ({
          sampleNumber: sm.sampleNumber,
          testRound: sm.testRound,
          numericValue: sm.numericValue,
          textValue: sm.textValue,
          result: sm.result,
        })),
        recordedTestedByName: viaSOP?.recordedTestedByName ?? test.testedByName ?? test.sopRecordedByName ?? null,
        recordedTestDate: viaSOP?.recordedTestDate ?? test.testDate ?? test.sopRecordedAt ?? null,
        recordedAcceptanceStages: viaSOP?.recordedAcceptanceStages ?? test.acceptanceStages ?? null,
        maxRetestRounds: null,
        recordedRetestReason: null,
      },
    };
  };

  // Fetch work order basic info
  const { data: workOrder } = useQuery<WorkOrderBasic>({
    queryKey: ['work-order', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/detail`);
      const data = await res.json();
      return data.data?.workOrder;
    },
  });

  const sqrtPlan = useMemo(
    () => sqrtPlusOneSampleSize(workOrder?.plannedQuantity, workOrder?.actualQuantity),
    [workOrder?.plannedQuantity, workOrder?.actualQuantity],
  );

  // Fetch BOM IPC config
  const { data: bomConfig } = useQuery<BOMIPCConfig[]>({
    queryKey: ['wo-ipc-bom-config', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/ipc?action=bom-config`);
      const data = await res.json();
      return data.data || [];
    },
  });

  // Fetch IPC tests
  const { data: ipcTests, isLoading } = useQuery<IPCTest[]>({
    queryKey: ['wo-ipc-tests', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/ipc`);
      const data = await res.json();
      return data.data || [];
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Linked GMP documents: criteriaId -> { gmpDocumentId, label }.
  // ipc_criteria now carries gmpDocumentId; join with the documents list so
  // the recording card can show the doc name + a preview button.
  const [previewDocId, setPreviewDocId] = useState<number | null>(null);
  const { data: criteriaCodeMap } = useQuery<Record<number, string>>({
    queryKey: ['ipc-criteria-codes'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/ipc-criteria');
      const json = await res.json();
      const map: Record<number, string> = {};
      for (const c of json?.data ?? []) if (c.code) map[Number(c.id)] = String(c.code);
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  /**
   * Sampling method, by criterion.
   *
   * The `testMethod` on an IPC test row comes from the quality *spec* it was
   * created against, which is a different field with a different meaning — the
   * analytical method, not how samples are drawn. The sampling plan is set on
   * the criterion, so that is where it is read from.
   */
  const criteriaMethodMap = useQuery<Record<number, string | null>>({
    queryKey: ['ipc-criteria-methods'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/ipc-criteria');
      const json = await res.json();
      const map: Record<number, string | null> = {};
      for (const c of json?.data ?? []) map[Number(c.id)] = c.testMethod ?? null;
      return map;
    },
    staleTime: 5 * 60 * 1000,
  }).data;

  /** The sampling plan this test was written under, if the criterion is known. */
  const samplingMethodOf = (test: IPCTest): string | null =>
    test.ipcCriteriaId != null ? (criteriaMethodMap?.[test.ipcCriteriaId] ?? null) : null;

  const { data: criteriaDocMap } = useQuery<Record<number, { docId: number; label: string }>>({
    queryKey: ['ipc-criteria-docmap'],
    queryFn: async () => {
      const [critRes, docRes] = await Promise.all([
        fetch('/api/master-data/ipc-criteria'),
        fetch('/api/documents?limit=1000'),
      ]);
      const critJson = await critRes.json();
      const docJson = await docRes.json();
      const crits = critJson?.data ?? [];
      const docs = docJson?.data?.documents ?? docJson?.documents ?? [];
      const docMeta: Record<number, string> = {};
      for (const d of docs) docMeta[Number(d.id)] = `${d.documentNumber} — ${d.title}`;
      const map: Record<number, { docId: number; label: string }> = {};
      for (const c of crits) {
        if (c.gmpDocumentId != null) {
          map[Number(c.id)] = {
            docId: Number(c.gmpDocumentId),
            label: docMeta[Number(c.gmpDocumentId)] ?? `เอกสาร #${c.gmpDocumentId}`,
          };
        }
      }
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Auto-refresh when another user records / approves IPC results on this WO
  useRealtimeTopic('work-order-changed', (data) => {
    if (data.workOrderId !== workOrderId) return;
    if (data.section !== 'ipc' && data.section !== 'requisition' && data.section !== 'status') return;
    queryClient.invalidateQueries({ queryKey: ['wo-ipc-tests', workOrderId] });
    queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
  });

  // Initialize IPC tests from BOM
  const initMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/ipc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize' }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['wo-ipc-tests', workOrderId] });
      toast.success(result.message || 'IPC tests initialized', 'IPC');
    },
    onError: (err: Error) => {
      toast.error(err.message, 'IPC');
    },
  });

  // Record test result
  const recordMutation = useMutation({
    mutationFn: async (data: {
      qualityTestId: number;
      numericResult?: number;
      notes?: string;
      testRound?: number;
      samples?: Array<{ sampleNumber: number; numericValue?: number; textValue?: string; result?: string }>;
    }) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/ipc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record', ...data }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-ipc-tests', workOrderId] });
      toast.success('IPC test result recorded', 'IPC');
      resetForm();
    },
    onError: (err: Error) => {
      toast.error(err.message, 'IPC');
    },
  });

  // Approve test (per-round or entire test)
  const approveMutation = useMutation({
    mutationFn: async (data: { qualityTestId: number; disposition?: string; testRound?: number }) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/ipc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', ...data }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-ipc-tests', workOrderId] });
      toast.success('IPC test approved', 'IPC');
    },
    onError: (err: Error) => {
      toast.error(err.message, 'IPC');
    },
  });

  function resetForm() {
    setNumericResult(undefined);
    setSampleValues([]);
    setRecordNotes('');
    setRecordRound(1);
    setSelectedTest(null);
  }

  function openInlineRecord(test: IPCTest, round?: number) {
    setSelectedTest(test);
    setRecordNotes('');

    const nextRound = round || (test.totalRounds || 0) + 1;
    setRecordRound(nextRound);

    // Phase 3: use stage-specific sample size when multi-stage; fall back to test-level.
    // Phase 4: visual mode overrides sample size with checklist length so each
    // checklist item becomes its own sample.
    let sampleSize = getEffectiveSampleSize(test, nextRound);
    const criteriaType = test.criteriaType || 'numeric';
    if (criteriaType === 'visual') {
      const payload = getSpecPayload(test);
      if (payload?.type === 'visual' && payload.checklist.length > 0) {
        sampleSize = payload.checklist.length;
      }
    }

    const roundSamples = test.rounds?.find((r) => r.round === nextRound)?.samples || [];

    if (isChecklistMode(criteriaType)) {
      const results = Array.from({ length: sampleSize }, (_, i) => {
        const sample = roundSamples.find((s) => s.sampleNumber === i + 1);
        return (sample?.result as 'pass' | 'fail' | null) ?? null;
      });
      setCheckboxResults(results);
      setSampleValues([]);
      setNumericResult(undefined);
    } else if (isTextMode(criteriaType)) {
      // Text mode: use sampleValues array but with single text input — store
      // text in a parallel state isn't needed; we'll bind to recordNotes which
      // doubles as the single text answer. Reset the numeric/checkbox state.
      const existingText = roundSamples[0]?.textValue ?? '';
      setRecordNotes(existingText);
      setSampleValues([]);
      setCheckboxResults([]);
      setNumericResult(undefined);
    } else if (sampleSize > 1) {
      const values = Array.from({ length: sampleSize }, (_, i) => {
        const sample = roundSamples.find((s) => s.sampleNumber === i + 1);
        return sample?.numericValue != null ? Number(sample.numericValue) : undefined;
      });
      setSampleValues(values);
      setCheckboxResults([]);
      setNumericResult(undefined);
    } else {
      const existingVal = roundSamples.length > 0 && roundSamples[0].numericValue != null
        ? Number(roundSamples[0].numericValue) : undefined;
      setNumericResult(existingVal);
      setSampleValues([]);
      setCheckboxResults([]);
    }
  }

  function handleSaveRecord() {
    if (!selectedTest) return;

    // Phase 3: stage-specific sample size when multi-stage
    const sampleSize = getEffectiveSampleSize(selectedTest, recordRound);
    const criteriaType = selectedTest.criteriaType || 'numeric';

    if (isChecklistMode(criteriaType)) {
      const samples = checkboxResults.map((r, i) => ({
        sampleNumber: i + 1,
        result: r || 'pass',
      }));
      recordMutation.mutate({
        qualityTestId: selectedTest.id,
        notes: recordNotes || undefined,
        testRound: recordRound,
        samples,
      });
    } else if (isTextMode(criteriaType)) {
      // Text mode: store the operator's free-text answer as a single sample
      const text = (recordNotes || '').trim();
      if (!text) {
        toast.error('Validation', 'กรุณากรอกข้อความที่ตรวจสอบ');
        return;
      }
      recordMutation.mutate({
        qualityTestId: selectedTest.id,
        notes: text,
        testRound: recordRound,
        samples: [{ sampleNumber: 1, textValue: text, result: 'pass' }],
      });
    } else if (sampleSize > 1) {
      const samples = sampleValues.map((v, i) => ({
        sampleNumber: i + 1,
        numericValue: v,
      }));
      recordMutation.mutate({
        qualityTestId: selectedTest.id,
        notes: recordNotes || undefined,
        testRound: recordRound,
        samples,
      });
    } else {
      recordMutation.mutate({
        qualityTestId: selectedTest.id,
        numericResult,
        notes: recordNotes || undefined,
        testRound: recordRound,
      });
    }
  }

  function toggleExpanded(testId: number) {
    setExpandedTests((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) next.delete(testId);
      else next.add(testId);
      return next;
    });
  }

  // Phase-filtered view — matches per-phase IPC cards on the dashboard.
  const displayTests = useMemo<IPCTest[] | undefined>(() => {
    if (!ipcTests) return ipcTests;
    const rows = phaseFilter
      ? ipcTests.filter((t) => (t.ipcPhase || 'production') === phaseFilter)
      : [...ipcTests];
    /**
     * In the order the SOP runs them.
     *
     * The list arrived in whatever order the rows were created, so a criterion
     * checked at step 5 could sit above one checked at step 1 — and the
     * operator working down the SOP had to hunt for each next test. The SOP
     * board is the authority on that order, so the position is read from it.
     *
     * A criterion the SOP does not mention keeps its own sequence, after the
     * ones that are on the board rather than silently interleaved with them.
     */
    const order = sopBoard?.order ?? {};
    return [...rows].sort((a, b) => {
      const pa = a.ipcCriteriaId != null ? order[a.ipcCriteriaId] : undefined;
      const pb = b.ipcCriteriaId != null ? order[b.ipcCriteriaId] : undefined;
      if (pa != null && pb != null && pa !== pb) return pa - pb;
      if (pa != null && pb == null) return -1;
      if (pa == null && pb != null) return 1;
      return a.id - b.id;
    });
  }, [ipcTests, phaseFilter, sopBoard]);

  /**
   * The rooms the recipe assigns to each phase.
   *
   * A phase is where the work physically happens — weighing room, filling
   * room, packing room — so naming the room is what tells an operator standing
   * on the floor whether a criterion is theirs to check right now.
   */
  const { data: bomRooms } = useQuery<
    { phase: string; roomCode: string; roomName: string; roomNameTh: string; sequence: number }[]
  >({
    queryKey: ['wo-bom-rooms', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/bom-config`);
      const json = await res.json();
      return json?.data?.rooms ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  /**
   * The same list, cut into the SOP steps it is checked at.
   *
   * Sorting alone put the criteria in the right order but still ran them as
   * one column, which said nothing about where one step's checks end and the
   * next begin. Criteria the SOP does not mention gather at the end under
   * their own heading rather than being folded into the last real step.
   */
  const groupedTests = useMemo(() => {
    const rows = displayTests ?? [];
    const groups: {
      key: string;
      label: string;
      rooms: string[];
      tests: IPCTest[];
      locked: boolean;
      blockedBy: string;
    }[] = [];
    for (const phase of PHASE_ORDER) {
      const tests = rows.filter((t) => (t.ipcPhase || 'production') === phase);
      if (tests.length === 0) continue;
      groups.push({
        key: phase,
        label: IPC_PHASE_LABELS[phase as IPCPhase] ?? phase,
        rooms: (bomRooms ?? [])
          .filter((r) => r.phase === phase)
          .sort((a, b) => a.sequence - b.sequence)
          .map((r) => `${r.roomCode} — ${r.roomNameTh || r.roomName}`),
        tests,
        /**
         * Production runs the phases in order and the checks go with it: a
         * capsule cannot be weighed in the filling room before the raw
         * material was cleared in the weighing room. So a phase stays shut
         * until every check in the phase before it has been recorded, and the
         * screen says which one is holding it rather than just refusing.
         */
        locked: false,
        blockedBy: '',
      });
    }
    // Anything on a phase the recipe does not use keeps its own heading rather
    // than being folded into one that happens to sort next to it.
    const known = new Set(PHASE_ORDER);
    for (const test of rows) {
      const phase = test.ipcPhase || 'production';
      if (known.has(phase)) continue;
      let group = groups.find((g) => g.key === phase);
      if (!group) {
        group = { key: phase, label: phase, rooms: [], tests: [], locked: false, blockedBy: '' };
        groups.push(group);
      }
      group.tests.push(test);
    }
    // Walk them in order, shutting everything after the first unfinished one.
    let blocker = '';
    for (const group of groups) {
      if (blocker) {
        group.locked = true;
        group.blockedBy = blocker;
        continue;
      }
      const done = group.tests.every(
        (t) => t.status === 'pass' || t.status === 'fail' || !!t.sopRecordedAt,
      );
      if (!done) blocker = group.label;
    }
    return groups;
  }, [displayTests, bomRooms]);

  // Progress calculations — operate on displayed (filtered) list when a phase is selected.
  const totalTests = displayTests?.length || 0;
  // SOP-recorded tests (sopRecordedAt set) are completed even if the IPC-N
  // record's own status is still 'pending' — they were saved via SOP execution.
  const completedTests = displayTests?.filter((t) => t.status === 'pass' || t.status === 'fail' || !!t.sopRecordedAt).length || 0;
  const approvedTests = displayTests?.filter((t) => t.approvedBy != null).length || 0;
  const progressPercent = totalTests > 0 ? Math.round((completedTests / totalTests) * 100) : 0;
  const hasTests = totalTests > 0;
  const hasBOMConfig = (bomConfig?.length || 0) > 0;

  return (
    <div className="organic-grid flex flex-col gap-4 p-4">
      <OrganicGridTheme />
      {/* Header */}
      <ResponsivePageHeader
        title={phaseFilter
          ? `${t('execution.ipc')} — ${IPC_PHASE_LABELS[phaseFilter]}`
          : t('execution.ipc')}
        subtitle={workOrder ? `${workOrder.woNumber} - ${workOrder.batchNumber}` : ''}
        icon={FlaskConical}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        onBack={() => router.push(`/production/work-orders/${workOrderId}?tab=execution`)}
      />

      {/* Progress — same banner shape as the SOP execution screen */}
      <div className="rounded-[20px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-black">{t('execution.ipcProgress')}</p>
            <p className="mt-0.5 text-[11px] text-[#bfbfbf]">
              {completedTests}/{totalTests} {t('execution.testsCompleted')}
            </p>
          </div>
          <div className="flex items-center gap-6">
            {approvedTests > 0 && (
              <div className="text-right">
                <p className="text-xl font-semibold text-[#1a8a4a]">{approvedTests}</p>
                <p className="text-[11px] text-[#bfbfbf]">{t('execution.approved')}</p>
              </div>
            )}
            {!hasTests && hasBOMConfig && (
              <button
                type="button"
                onClick={() => initMutation.mutate()}
                disabled={initMutation.isPending}
                className={SOFT_PRIMARY_BTN}
              >
                {t('execution.initializeIPCTests')}
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#eef0f2]">
          <div
            className="h-2 rounded-full bg-[#5682e9] transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <DxLoadIndicator />
        </div>
      )}

      {/* No BOM config warning */}
      {!isLoading && !hasBOMConfig && !hasTests && (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
            <p className="font-medium">{t('execution.noIPCConfig')}</p>
            <p className="text-sm mt-1">{t('execution.noIPCConfigHint')}</p>
          </CardContent>
        </Card>
      )}

      {/* No tests yet but BOM config exists */}
      {!isLoading && hasBOMConfig && !hasTests && (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <FlaskConical className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
            <p className="font-medium">{t('execution.ipcReadyToInit')}</p>
            <p className="text-sm mt-1">
              {bomConfig!.length} {t('execution.testsFromBOM')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* IPC criteria — one soft card each. Pressing a card opens the same
          recording dialog the SOP execution screen opens, so an operator meets
          one recording surface no matter which screen they came from. */}
      {hasTests && (
        <div className="flex flex-col gap-6">
          {groupedTests.map((group) => (
          <div key={group.key} className="flex flex-col gap-3">
            {/* The phase these criteria belong to, named by the room the
                recipe assigns to it. Grouping by SOP step read plausibly but
                was the wrong cut: the recipe configures IPC per phase, and a
                phase is a room someone is standing in — which is what decides
                whether a check is theirs to make right now. */}
            <div className="flex flex-wrap items-baseline gap-2 px-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8effc] px-2.5 py-1 text-[11px] font-semibold text-[#3559b0]">
                {group.label}
              </span>
              {group.rooms.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-800">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  {group.rooms.join(' · ')}
                </span>
              )}
              <span className="text-[11px] text-[#bfbfbf]">{group.tests.length} หัวข้อ</span>
              {group.locked && (
                <span
                  data-testid={`phase-locked-${group.key}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#fdf0e6] px-2.5 py-1 text-[11px] font-medium text-[#b45309]"
                >
                  <Lock className="h-3 w-3" />
                  รอ{group.blockedBy}ให้ครบก่อน
                </span>
              )}
            </div>
          <div className={cn('flex flex-col gap-3', group.locked && 'pointer-events-none opacity-45')}>
          {group.tests.map((test) => {
            const isApproved = test.approvedBy != null;
            // Two-way sync: the same criterion may have been recorded from a
            // SOP step, in which case the round lives on that step's row. The
            // details open here either way — the operator should not have to
            // leave the screen to read a result they are looking straight at.
            const recordedViaSOP = !!test.sopRecordedAt;
            const sopRound = recordedViaSOP && test.sopRecordedTestId != null
              ? sopRecordedMap?.[Number(test.sopRecordedTestId)]
              : null;
            const hasRecorded =
              (test.samples?.length ?? 0) > 0 || (sopRound?.recordedSamples?.length ?? 0) > 0;
            const stages = parseAcceptanceStages(test.acceptanceStages);
            const doc = test.ipcCriteriaId != null ? criteriaDocMap?.[test.ipcCriteriaId] : null;
            const openDialog = () => setRecordDialog(toRecordable(test));

            return (
              <div
                key={test.id}
                role="button"
                tabIndex={0}
                data-testid={`ipc-card-${test.id}`}
                onClick={() => (hasRecorded ? toggleTestCollapsed(test.id) : openDialog())}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  if (hasRecorded) toggleTestCollapsed(test.id);
                  else openDialog();
                }}
                className="cursor-pointer rounded-[20px] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-shadow duration-200 hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-[#f1f3f5] text-slate-500">
                    <FlaskConical className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {test.ipcCriteriaId != null && (
                        <span className="rounded-md bg-[#e8effc] px-2 py-0.5 font-mono text-[11px] font-bold text-[#3559b0]">
                          {criteriaCodeMap?.[test.ipcCriteriaId] ?? `IPC-${test.ipcCriteriaId}`}
                        </span>
                      )}
                      <span className="min-w-0 break-words text-sm font-medium text-gray-900">
                        {test.testName || `Test #${test.id}`}
                      </span>
                      {recordedViaSOP ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#e8f6ee] px-1.5 py-0.5 text-[10px] font-semibold text-[#1a8a4a]">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          บันทึกผ่าน SOP ขั้นตอนที่ {test.sopStepNumber || '?'}
                        </span>
                      ) : (
                        <IPCStatusPill test={test} />
                      )}
                      {test.totalRounds > 0 && (
                        <span className={SOFT_META_PILL}>รอบที่ {test.totalRounds}</span>
                      )}
                      {stages.length > 0 && (
                        <span className={SOFT_META_PILL}>
                          <Layers className="h-2.5 w-2.5" />
                          หลายขั้น ({stages.length})
                        </span>
                      )}
                      {isApproved && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#e8f6ee] px-1.5 py-0.5 text-[10px] font-semibold text-[#1a8a4a]">
                          <ShieldCheck className="h-2.5 w-2.5" />
                          {t('execution.approved')}
                        </span>
                      )}
                    </div>

                    <IPCSpecLines test={test} />

                    {/* √n + 1 — the one sampling method whose sample size is
                        not a property of the criterion at all.
                        MOCKUP: worked out on screen from this work order's
                        yield; nothing is saved, and the criterion still holds
                        whatever size it was written with. */}
                    {usesSqrtSampling(samplingMethodOf(test)) && (
                      <div
                        data-testid={`sqrt-plan-${test.id}`}
                        className="mt-2 rounded-[12px] border border-[#cfe0f7] bg-[#f4f8fe] px-3 py-2.5"
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="rounded-md bg-[#e8effc] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#3559b0]">
                            √n + 1
                          </span>
                          <span className="rounded-md bg-[#fff4e6] px-1.5 py-0.5 text-[10px] font-bold text-[#c2410c]">
                            MOCKUP
                          </span>
                          <span className="text-[11px] text-[#6b7684]">
                            จำนวนตัวอย่างคิดจากยอดผลิตของใบสั่งผลิตนี้
                          </span>
                        </div>
                        {sqrtPlan ? (
                          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className="text-[11px] text-[#6b7684]">
                              n = {sqrtPlan.lotSize.toLocaleString('en-US')}
                              <span className="ml-1 text-[10px] text-[#9aa3ad]">
                                ({sqrtPlan.source === 'actual' ? 'ยอดผลิตจริง' : 'ยอดผลิตตามแผน'})
                              </span>
                            </span>
                            <span className="text-[#d5d8dc]">·</span>
                            <span className="font-mono text-[11px] text-[#6b7684]">
                              {sqrtPlan.workings}
                            </span>
                            <span className="text-[#d5d8dc]">·</span>
                            <span className="text-[13px] font-bold text-[#3559b0]">
                              {sqrtPlan.sampleSize}
                              <span className="ml-1 text-[10px] font-normal text-[#9aa3ad]">
                                ตัวอย่าง
                              </span>
                            </span>
                          </div>
                        ) : (
                          /* No yield means no n. Saying so beats printing a
                             sample size the formula could not have produced. */
                          <p className="mt-1.5 text-[11px] font-medium text-[#c2410c]">
                            ใบสั่งผลิตนี้ยังไม่มียอดผลิต — คำนวณจำนวนตัวอย่างไม่ได้
                          </p>
                        )}
                        {sqrtPlan && Number(test.sampleSize) > 0
                          && Number(test.sampleSize) !== sqrtPlan.sampleSize && (
                          /* The stored number is left visible rather than
                             quietly overwritten: it is what is on file, and a
                             reviewer comparing the record to the screen has to
                             be able to see why the two differ. */
                          <p className="mt-1 text-[10px] text-[#9aa3ad]">
                            ค่าที่บันทึกไว้ในเกณฑ์คือ {test.sampleSize} ตัวอย่าง —
                            หน้าจอนี้ใช้ค่าที่คำนวณได้แทน
                          </p>
                        )}
                      </div>
                    )}

                    {(test.testedByName || test.approvedByName || test.sopRecordedByName) && (
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-[#bfbfbf]">
                        {(test.testedByName || test.sopRecordedByName) && (
                          <span>
                            ผู้บันทึก:{' '}
                            <strong className="font-medium text-slate-600">
                              {test.testedByName || test.sopRecordedByName}
                            </strong>
                          </span>
                        )}
                        {(test.testDate || test.sopRecordedAt) && (
                          <span>{new Date((test.testDate || test.sopRecordedAt)!).toLocaleString('th-TH')}</span>
                        )}
                        {test.approvedByName && (
                          <span>
                            ผู้อนุมัติ:{' '}
                            <strong className="font-medium text-slate-600">{test.approvedByName}</strong>
                          </span>
                        )}
                      </div>
                    )}

                    {doc && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPreviewDocId(doc.docId); }}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#e1e4e8] bg-white px-3 py-1 text-[11px] font-medium text-slate-700 transition hover:border-[#9db9e8] hover:text-[#2f6fd0]"
                        title="ดูเอกสาร GMP"
                      >
                        <FileText className="h-3 w-3" />
                        {doc.label}
                      </button>
                    )}

                    {!hasRecorded && (
                      <div className="mt-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2f6fd0] px-3.5 py-1.5 text-[12px] font-medium text-white transition">
                          <FlaskConical className="h-3.5 w-3.5" />
                          บันทึกผล
                        </span>
                      </div>
                    )}
                    {/* The recorded rounds live on the card, open by default —
                        a result that exists should be readable without a
                        click. The card folds them away and back. */}
                  </div>

                  {/* The reading and the fold control, in the corner the QC
                      entry cards keep them. */}
                  {hasRecorded ? (() => {
                    const samples = toRecordable(test).recorded?.recordedSamples ?? [];
                    const read = latestReadingOf(samples, test.specUnit);
                    return (
                      <div className="flex flex-none items-start gap-2">
                        {read && (
                          <div className="text-right">
                            <div className="text-sm font-semibold text-black">{read.value}</div>
                            <div className="text-[11px] text-[#bfbfbf]">{read.sub}</div>
                          </div>
                        )}
                        <span
                          className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-slate-400"
                          aria-hidden
                        >
                          {collapsedTests.has(test.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronUp className="h-4 w-4" />
                          )}
                        </span>
                      </div>
                    );
                  })() : null}
                </div>

                {/* The recorded rounds, across the whole card — boxing them
                    into the text column wasted the width the readings need. */}
                {hasRecorded && !collapsedTests.has(test.id) && (
                  <div
                    className="mt-3 border-t border-[#eef0f2] pt-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IPCRoundHistory
                      ipc={toRecordable(test).recorded!}
                      onStartRetest={() => setRecordDialog(toRecordable(test))}
                    />
                  </div>
                )}
              </div>
            );
          })}
          </div>
          </div>
          ))}
        </div>
      )}

      {/* The one recording surface, shared with the SOP execution screen. */}
      <IPCRecordDialog
        open={recordDialog != null}
        criterion={recordDialog}
        context={{
          workOrderNumber: workOrder?.woNumber ?? '',
          batchNumber: workOrder?.batchNumber ?? '',
        }}
        onClose={() => setRecordDialog(null)}
        onSubmit={() => setRecordDialog(null)}
      />

      {/* GMP document preview */}
      <GmpDocumentPreviewDialog
        documentId={previewDocId}
        visible={previewDocId != null}
        onClose={() => setPreviewDocId(null)}
      />
    </div>
  );
}

/**
 * Render the test's specification box in a way that matches the criteria type.
 * Numeric: range + spec text. Pass/Fail: PASS/FAIL definitions side-by-side.
 * Visual: description + checklist preview. Text: expected format + example.
 */
function SpecInfoCard({ test }: { test: IPCTest }) {
  const payload = getSpecPayload(test);
  const ct = test.criteriaType ?? 'numeric';

  // Checkbox: no numeric range — only show spec text (if not a raw JSON envelope)
  if (ct === 'checkbox') {
    const specText =
      test.specSpecification && !test.specSpecification.trim().startsWith('{')
        ? test.specSpecification
        : null;
    if (!specText) return null;
    return (
      <div className="text-xs text-emerald-700 bg-emerald-50 rounded p-2">
        <span>{specText}</span>
      </div>
    );
  }

  // Numeric: keep the original range/spec line
  if (ct === 'numeric') {
    if (test.specMinValue == null && !test.specSpecification) return null;
    const specText =
      test.specSpecification && !test.specSpecification.trim().startsWith('{')
        ? test.specSpecification
        : null;
    return (
      <div className="text-xs text-emerald-700 bg-emerald-50 rounded p-2">
        {test.specMinValue != null && test.specMaxValue != null && (
          <span>
            Range: {formatNumber(test.specMinValue)} - {formatNumber(test.specMaxValue)}
            {test.specUnit ? ` ${test.specUnit}` : ''}
          </span>
        )}
        {specText && <span> | {specText}</span>}
      </div>
    );
  }

  if (ct === 'pass_fail' && payload?.type === 'pass_fail') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs">
          <div className="font-semibold text-emerald-700 mb-0.5">✓ เกณฑ์ &quot;ผ่าน&quot;</div>
          <div className="text-emerald-900/80">
            {payload.passDefinition || <span className="italic text-emerald-600/50">— ไม่ระบุ —</span>}
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs">
          <div className="font-semibold text-red-700 mb-0.5">✕ เกณฑ์ &quot;ไม่ผ่าน&quot;</div>
          <div className="text-red-900/80">
            {payload.failDefinition || <span className="italic text-red-600/50">— ไม่ระบุ —</span>}
          </div>
        </div>
      </div>
    );
  }

  if (ct === 'visual' && payload?.type === 'visual') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
        <div className="font-semibold text-amber-800 mb-1">👁 ลักษณะที่ยอมรับ</div>
        <div className="text-amber-900/80 mb-2">
          {payload.description || <span className="italic text-amber-600/60">— ไม่ระบุ —</span>}
        </div>
        {payload.referenceImage && (
          <div className="mb-2 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={payload.referenceImage}
              alt="รูปอ้างอิง"
              className="h-12 w-12 shrink-0 rounded-[6px] border border-amber-200 object-cover"
            />
            <a
              href={payload.referenceImage}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-amber-700 underline"
            >
              เปิดดูรูปอ้างอิงเต็มรูป
            </a>
          </div>
        )}
        <div className="text-[11px] text-amber-700">
          รายการที่ต้องตรวจ: {payload.checklist.filter(Boolean).length} จุดตรวจ
        </div>
      </div>
    );
  }

  if (ct === 'text' && payload?.type === 'text') {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
        <div className="text-slate-500 mb-0.5">รูปแบบที่คาดหวัง:</div>
        <div className="font-mono text-slate-700 mb-1">
          {payload.format || <span className="italic text-slate-400">— ไม่ระบุ —</span>}
        </div>
        {payload.example && (
          <div className="text-slate-500">
            ตัวอย่าง: <span className="font-mono text-slate-700">{payload.example}</span>
          </div>
        )}
        {payload.required && (
          <div className="text-[11px] text-slate-500 mt-1">* บังคับให้กรอก</div>
        )}
      </div>
    );
  }

  return null;
}

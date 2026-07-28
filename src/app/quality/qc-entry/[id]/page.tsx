'use client';

/**
 * QC Entry — Sample Detail + Test Results Entry
 *
 * Lab analyst lands here to:
 *   1. Inspect sample header (product, lot, source)
 *   2. Apply additional test panel (if registered with skip-panel)
 *   3. Add/edit per-test numericResult / textResult / notes
 *   4. Transition status: registered → testing → reviewed
 *   5. Print summary
 *
 * Inline test result editing uses an "edit row" mode — DxNumberBox/DxTextBox
 * for the focused row, plain rendered values otherwise. This avoids the
 * complexity of DxDataGrid's batch edit while still keeping cell-level
 * granularity. Status pass/fail is auto-recomputed server-side after save.
 *
 * Phase 3 sign-off (analyst → reviewer → approver) is OUT OF SCOPE here:
 * those buttons surface a "Phase 3 — sign-off TBD" toast.
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader, StatusStepper } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTagBox } from '@/components/ui/dx-tag-box';
import { DxSwitch } from '@/components/ui/dx-switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  TestTube,
  AlertTriangle,
  ShieldCheck,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Paperclip,
  Check,
  X,
} from 'lucide-react';
import { parseSpecPayload } from '@/lib/master-data/ipc-spec-payload';
import { EntityAuditTrail } from '@/components/quality/EntityAuditTrail';
import { AttachmentPanel } from '@/components/shared/AttachmentPanel';
import { QCTestPrintDocument } from '@/components/quality/QCTestPrintDocument';

/** Live pass/fail evaluator — mirrors server-side logic for instant UX feedback. */
function evaluateNumeric(
  value: number | null,
  specMin: number | null,
  specMax: number | null,
): 'pass' | 'fail' | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (specMin == null && specMax == null) return null;
  if (specMin != null && value < specMin) return 'fail';
  if (specMax != null && value > specMax) return 'fail';
  return 'pass';
}

interface QcSampleTestSampleRow {
  sampleNumber: number;
  numericValue: number | null;
  textValue: string | null;
  result: 'pass' | 'fail' | null;
}

interface QcSampleTestRoundRow {
  roundNumber: number;
  samples: QcSampleTestSampleRow[];
  avg: number | null;
  result: 'pass' | 'fail' | 'pending';
}

interface QcSampleTestRow {
  id: number;
  sampleId: number;
  criteriaId: number;
  criteriaCode: string | null;
  criteriaName: string | null;
  criteriaNameTh: string | null;
  criteriaType: string | null;
  criteriaSampleSize: number | null;
  criteriaTolerancePercent: number | null;
  criteriaMaxRetestRounds: number | null;
  criteriaAcceptanceStages: string | null;
  criteriaSpecSpecification: string | null;
  rounds: QcSampleTestRoundRow[];
  totalRounds: number;
  sequence: number;
  specMin: number | null;
  specMax: number | null;
  specTarget: number | null;
  specText: string | null;
  unit: string | null;
  testMethod: string | null;
  numericResult: number | null;
  textResult: string | null;
  resultStatus: string;
  testedBy: number | null;
  testedByName: string | null;
  testedAt: string | null;
  reviewedBy: number | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  notes: string | null;
  attachmentPath: string | null;
}

interface QcSampleDetail {
  id: number;
  sampleNumber: string;
  sourceType: string;
  sourceRefId: number | null;
  sourceRefText: string | null;
  productId: number;
  productCode: string | null;
  productName: string | null;
  productNameEn: string | null;
  lotNumber: string | null;
  manufactureDate: string | null;
  expiryDate: string | null;
  retestDate: string | null;
  quantityReceived: number | null;
  unit: string | null;
  storageConditions: string | null;
  customerId: number | null;
  customerName: string | null;
  salesOrderRef: string | null;
  receivedDate: string;
  receivedBy: number;
  receivedByName: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  tests: QcSampleTestRow[];
  signatures: Array<{
    id: number;
    role: string;
    userId: number;
    userName: string | null;
    signedAt: string;
    signatureMeaning: string | null;
    notes?: string | null;
  }>;
  oosInvestigations: Array<{
    id: number;
    sampleTestId: number;
    initiatedBy: number;
    initiatedByName: string | null;
    initiatedAt: string;
    classification: string | null;
    retestAuthorized: boolean;
    closedAt: string | null;
    conclusion: string | null;
  }>;
  linkedCoa: { id: number; coaNumber: string; status: string } | null;
}

interface OosInvestigation {
  id: number;
  sampleTestId: number;
  sampleId: number;
  sampleNumber: string | null;
  initiatedBy: number;
  initiatedByName: string | null;
  initiatedAt: string;
  phase1LabErrorCheck: string | null;
  phase2RootCause: string | null;
  classification: string | null;
  retestAuthorized: boolean;
  closedBy: number | null;
  closedByName: string | null;
  closedAt: string | null;
  conclusion: string | null;
  capaId: number | null;
  linkedDeviation: { id: number; deviationNumber: string } | null;
}

type SignatureRole = 'analyst' | 'reviewer' | 'approver' | 'qa_release';

interface IpcCriterion {
  id: number;
  code: string;
  name: string;
  nameTh?: string | null;
  testMethod?: string | null;
  specification?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  unit?: string | null;
}

interface TestPanel {
  id: number;
  productId: number | null;
  productCategory: string | null;
  criteriaId: number;
  criteriaName: string | null;
}

function formatDateTh(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateStr);
  }
}

function formatDateOnlyTh(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(dateStr);
  }
}

function statusBadge(status: string): {
  variant: 'default' | 'success' | 'warning' | 'danger' | 'info';
  label: string;
} {
  switch (status) {
    case 'registered':
      return { variant: 'info', label: 'Registered' };
    case 'testing':
      return { variant: 'warning', label: 'Testing' };
    case 'reviewed':
      return { variant: 'info', label: 'Reviewed' };
    case 'approved':
      return { variant: 'success', label: 'Approved' };
    case 'released':
      return { variant: 'success', label: 'Released' };
    case 'rejected':
      return { variant: 'danger', label: 'Rejected' };
    case 'quarantine':
      return { variant: 'warning', label: 'Quarantine' };
    case 'oos':
      return { variant: 'danger', label: 'OOS' };
    default:
      return { variant: 'default', label: status };
  }
}

function resultBadge(status: string) {
  switch (status) {
    case 'pass':
      return <Badge variant="success">PASS</Badge>;
    case 'fail':
      return <Badge variant="danger">FAIL</Badge>;
    case 'retest':
      return <Badge variant="warning">RETEST</Badge>;
    case 'na':
      return <Badge variant="default">N/A</Badge>;
    default:
      return <Badge variant="warning">PENDING</Badge>;
  }
}

/**
 * specText snapshots ipc_criteria.specification — for non-numeric criteria
 * (visual checklist, pass/fail, text, multi_point, …) it's a JSON envelope,
 * not a human-readable string. Decode it to a short readable summary instead
 * of dumping the raw JSON. Falls back to the raw string for legacy/plain rows.
 */
type TFunc = ReturnType<typeof useTranslations>;

function readableSpecText(test: QcSampleTestRow, t: TFunc): string | null {
  const raw = test.specText;
  if (!raw) return null;
  const trimmed = raw.trim();
  // Only attempt to decode when it looks like our JSON envelope.
  if (!trimmed.startsWith('{')) return raw;
  const payload = parseSpecPayload(test.criteriaType ?? 'numeric', trimmed);
  if (!payload) return raw;
  switch (payload.type) {
    case 'visual': {
      const parts = [payload.description?.trim()].filter(Boolean) as string[];
      if (payload.checklist?.length) {
        parts.push(payload.checklist.map((c) => `• ${c}`).join('  '));
      }
      return parts.join('  —  ') || raw;
    }
    case 'pass_fail':
      return t('qcEntry.detail.spec.passFail', {
        pass: payload.passDefinition || '—',
        fail: payload.failDefinition || '—',
      });
    case 'text':
      return payload.format || payload.example || raw;
    case 'multi_point':
      return t('qcEntry.detail.spec.multiPoint', {
        pointCount: payload.pointCount,
        target: payload.perPointTarget,
        tolerance: payload.perPointTolerance,
      });
    case 'tare':
      return `${payload.referenceLabel || 'Tare'} (${payload.referenceUnit || ''})`;
    case 'calibration':
      return t('qcEntry.detail.spec.calibration', {
        instrument: payload.instrumentName || '',
        standardValue: payload.standardValue,
        standardUnit: payload.standardUnit,
      });
    case 'calculated':
      return payload.formula || raw;
    case 'custom_multi_field':
      return payload.fields?.map((f) => f.label).filter(Boolean).join(', ') || raw;
    default:
      return raw;
  }
}

function formatSpec(test: QcSampleTestRow, t: TFunc): string {
  const readable = readableSpecText(test, t);
  if (readable) return readable;
  if (test.specMin != null && test.specMax != null) {
    return `${test.specMin} – ${test.specMax}${test.unit ? ' ' + test.unit : ''}`;
  }
  if (test.specMin != null) {
    return `≥ ${test.specMin}${test.unit ? ' ' + test.unit : ''}`;
  }
  if (test.specMax != null) {
    return `≤ ${test.specMax}${test.unit ? ' ' + test.unit : ''}`;
  }
  if (test.specTarget != null) {
    return `${test.specTarget}${test.unit ? ' ' + test.unit : ''}`;
  }
  return '—';
}

interface EditState {
  testId: number;
  /** Single-sample numeric value — used when criteria.sampleSize === 1. */
  numericResult: number | null;
  /** Per-sample numeric readings — used when criteria.sampleSize > 1. */
  sampleValues: Array<number | null>;
  /** Per-sample pass/fail verdicts — used when criteriaType === 'pass_fail'
   *  with sampleSize > 1 (parallel to sampleValues). */
  sampleResults: Array<'pass' | 'fail' | null>;
  textResult: string;
  notes: string;
  /** Recording target round (1 = first attempt, 2+ = retest). */
  testRound: number;
}

export default function QcSampleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations('quality');

  const sampleId = Number(params.id);
  const [detail, setDetail] = useState<QcSampleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const [editing, setEditing] = useState<EditState | null>(null);
  const [expandedTests, setExpandedTests] = useState<Set<number>>(new Set());

  const toggleExpanded = (id: number) => {
    setExpandedTests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [showApplyPanel, setShowApplyPanel] = useState(false);
  const [showAddTest, setShowAddTest] = useState(false);

  const [panels, setPanels] = useState<TestPanel[]>([]);
  const [selectedPanelIds, setSelectedPanelIds] = useState<number[]>([]);

  const [criteria, setCriteria] = useState<IpcCriterion[]>([]);
  const [newCriteriaId, setNewCriteriaId] = useState<number | null>(null);
  const [newSequence, setNewSequence] = useState<number>(1);

  // ── Phase 3 — Sign-off state ─────────────────────────────────────────
  const [signRole, setSignRole] = useState<SignatureRole | null>(null);
  const [signNotes, setSignNotes] = useState<string>('');
  const [signPassword, setSignPassword] = useState<string>('');

  // ── Phase 3 — OOS state ──────────────────────────────────────────────
  const [oosList, setOosList] = useState<OosInvestigation[]>([]);
  const [showOpenOos, setShowOpenOos] = useState(false);
  const [oosTestId, setOosTestId] = useState<number | null>(null);
  const [oosPhase1, setOosPhase1] = useState<string>('');
  const [oosPhase2, setOosPhase2] = useState<string>('');
  const [oosClassification, setOosClassification] = useState<string | null>(null);
  const [oosRetest, setOosRetest] = useState<boolean>(false);
  const [oosConclusionInit, setOosConclusionInit] = useState<string>('');

  const [closingOosId, setClosingOosId] = useState<number | null>(null);
  const [oosCloseConclusion, setOosCloseConclusion] = useState<string>('');

  const fetchDetail = useCallback(async () => {
    if (!Number.isFinite(sampleId)) {
      setError('Invalid sample ID');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/quality/qc-samples/${sampleId}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to load sample');
        setDetail(null);
      } else {
        setDetail(data.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [sampleId]);

  // Fetch the full OOS list (with linked deviation info) — separate call
  // because the sample-detail endpoint returns a lite version.
  const fetchOosList = useCallback(async () => {
    if (!Number.isFinite(sampleId)) return;
    try {
      const res = await fetch(`/api/quality/qc-samples/${sampleId}/oos`);
      const data = await res.json();
      if (data.success) {
        setOosList(Array.isArray(data.data?.items) ? data.data.items : []);
      }
    } catch {
      // Non-fatal — UI shows "no OOS" if the endpoint hiccups.
    }
  }, [sampleId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    fetchOosList();
  }, [fetchOosList]);

  // Load panels when "Apply panel" dialog opens.
  useEffect(() => {
    if (!showApplyPanel || !detail) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/quality/test-panels?productId=${detail.productId}&isActive=true`,
        );
        const data = await res.json();
        if (data.success) {
          // De-duplicate by id (a panel "row" maps 1:1 to a single criteria;
          // operators usually want to apply the whole product set so we list
          // by criteria for now).
          setPanels(data.data?.items || []);
        }
      } catch {
        setPanels([]);
      }
    })();
  }, [showApplyPanel, detail]);

  // Load criteria for the "Add custom test" dialog.
  useEffect(() => {
    if (!showAddTest) return;
    (async () => {
      try {
        const res = await fetch('/api/master-data/ipc-criteria');
        const data = await res.json();
        if (data.success) {
          setCriteria(Array.isArray(data.data) ? data.data : []);
        }
      } catch {
        setCriteria([]);
      }
    })();
  }, [showAddTest]);

  /** Build initial editor state for a test, optionally targeting a specific
   *  retest round. When `targetRound` is omitted, defaults to:
   *    - existing round number if user is editing the latest round, OR
   *    - (totalRounds + 1) when starting a fresh retest. */
  const handleStartEdit = (test: QcSampleTestRow, targetRound?: number) => {
    const sampleSize = Math.max(1, Number(test.criteriaSampleSize) || 1);
    const isMultiSample = sampleSize > 1;
    // Resolve the round we're recording. If the test has rounds, the caller
    // can either edit an existing round or open a new one (totalRounds+1).
    const round = targetRound ?? (test.totalRounds === 0 ? 1 : test.totalRounds);
    const existingRound = test.rounds.find((r) => r.roundNumber === round);

    // Pre-fill sample values from the existing round so retests can edit
    // earlier readings; otherwise leave the grid empty.
    const sampleValues: Array<number | null> = Array.from({ length: sampleSize }, (_, i) => {
      const existing = existingRound?.samples.find((s) => s.sampleNumber === i + 1);
      return existing?.numericValue ?? null;
    });
    // Parallel pass/fail verdicts for pass_fail criteria (per-sample ✓/✗).
    const sampleResults: Array<'pass' | 'fail' | null> = Array.from({ length: sampleSize }, (_, i) => {
      const existing = existingRound?.samples.find((s) => s.sampleNumber === i + 1);
      return existing?.result ?? null;
    });

    setEditing({
      testId: test.id,
      numericResult: isMultiSample ? null : (existingRound?.samples[0]?.numericValue ?? test.numericResult),
      sampleValues,
      sampleResults,
      textResult: test.textResult ?? '',
      notes: test.notes ?? '',
      testRound: round,
    });
  };

  const handleCancelEdit = () => setEditing(null);

  const handleSaveEdit = async () => {
    if (!editing || !detail) return;
    const test = detail.tests.find((t) => t.id === editing.testId);
    if (!test) return;
    const sampleSize = Math.max(1, Number(test.criteriaSampleSize) || 1);
    const isMultiSample = sampleSize > 1;
    const isPassFail = test.criteriaType === 'pass_fail';

    // Build payload — server prefers samples[] when provided, else falls back
    // to single numericResult/textResult.
    const payload: Record<string, unknown> = {
      testId: test.id,
      criteriaId: test.criteriaId,
      sequence: test.sequence,
      specMin: test.specMin,
      specMax: test.specMax,
      specTarget: test.specTarget,
      specText: test.specText,
      unit: test.unit,
      testMethod: test.testMethod,
      notes: editing.notes || null,
      testRound: editing.testRound,
    };
    if (isMultiSample && isPassFail) {
      // pass_fail criteria record a per-sample verdict, not a number; the server
      // schema accepts samples[].result ('pass'|'fail') and the scoring service
      // (evaluateSampleResult/computeRoundResult) uses it directly.
      payload.samples = editing.sampleResults
        .map((r, idx) => ({ sampleNumber: idx + 1, result: r }))
        .filter((s) => s.result === 'pass' || s.result === 'fail');
    } else if (isMultiSample) {
      payload.samples = editing.sampleValues
        .map((v, idx) => ({
          sampleNumber: idx + 1,
          numericValue: v,
        }))
        .filter((s) => s.numericValue != null && Number.isFinite(s.numericValue));
    } else {
      payload.numericResult = editing.numericResult;
      payload.textResult = editing.textResult || null;
      // Mirror the single value into samples[1] so the round history captures it.
      if (editing.numericResult != null) {
        payload.samples = [{ sampleNumber: 1, numericValue: editing.numericResult }];
      } else if (editing.textResult) {
        payload.samples = [{ sampleNumber: 1, textValue: editing.textResult }];
      }
    }

    setWorking(true);
    try {
      const res = await fetch(`/api/quality/qc-samples/${detail.id}/tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(t('qcEntry.detail.toast.saveFailed'), data.error || 'Unknown error');
      } else {
        const savedStatus = data.data?.resultStatus as string | undefined;
        toast.success(
          t('qcEntry.detail.toast.saveSuccess'),
          t('qcEntry.detail.toast.saveSuccessDetail', {
            round: editing.testRound,
            result: savedStatus || 'pending',
          }),
        );
        const savedTestId = editing.testId;
        setEditing(null);
        await fetchDetail();

        // Audit Q1 / spec #025 — when the saved result is OOS or FAIL the
        // system auto-opens the Deviation form immediately, pre-filled from the
        // failing test so the operator only confirms + submits. Only fires when
        // there is no open OOS investigation on this test yet (so re-saving a
        // round that is already under investigation doesn't reopen the form).
        if (savedStatus === 'oos' || savedStatus === 'fail') {
          const alreadyOpen = oosList.some(
            (o) => o.sampleTestId === savedTestId && o.closedAt == null,
          );
          if (!alreadyOpen) {
            const savedTest = detail.tests.find((tt) => tt.id === savedTestId);
            const testName =
              savedTest?.criteriaNameTh || savedTest?.criteriaName || savedTest?.criteriaCode || t('qcEntry.detail.deviation.defaultTestName');
            const measured =
              editing.numericResult != null
                ? `${editing.numericResult}${savedTest?.unit ? ' ' + savedTest.unit : ''}`
                : editing.textResult || '-';
            const spec =
              savedTest?.specMin != null || savedTest?.specMax != null
                ? t('qcEntry.detail.deviation.spec', {
                    min: savedTest?.specMin ?? '-',
                    max: savedTest?.specMax ?? '-',
                    unit: savedTest?.unit ? ' ' + savedTest.unit : '',
                  })
                : savedTest?.specText || '';
            const productLabel = detail.productName ?? detail.productNameEn ?? '';
            const title = `QC ${savedStatus.toUpperCase()}: ${testName} — ${detail.sampleNumber}`;
            const description =
              t('qcEntry.detail.deviation.descLine1', {
                status: savedStatus.toUpperCase(),
                sampleNumber: detail.sampleNumber,
                product: productLabel ? ` (${productLabel})` : '',
              }) +
              '\n' +
              t('qcEntry.detail.deviation.descLine2', {
                testName,
                round: editing.testRound,
              }) +
              '\n' +
              t('qcEntry.detail.deviation.descLine3', {
                measured,
                spec: spec ? ` — ${spec}` : '',
              });
            toast.error(
              t('qcEntry.detail.deviation.openingToast', { status: savedStatus.toUpperCase() }),
            );
            const params = new URLSearchParams({
              title,
              description,
              sourceType: 'quality',
              sourceId: String(savedTestId),
              severity: 'major',
            });
            router.push(`/quality/deviations/new?${params.toString()}`);
          }
        }
      }
    } catch (e) {
      toast.error(t('qcEntry.detail.toast.saveFailed'), e instanceof Error ? e.message : 'Network error');
    } finally {
      setWorking(false);
    }
  };

  const handleDeleteTest = async (testId: number) => {
    if (!detail) return;
    if (!confirm(t('qcEntry.detail.confirmDeleteTest'))) return;
    setWorking(true);
    try {
      const res = await fetch(
        `/api/quality/qc-samples/${detail.id}/tests?testId=${testId}`,
        { method: 'DELETE' },
      );
      const data = await res.json();
      if (!data.success) {
        toast.error(t('qcEntry.detail.toast.deleteFailed'), data.error || 'Unknown error');
      } else {
        toast.success(t('qcEntry.detail.toast.deleteSuccess'));
        await fetchDetail();
      }
    } catch (e) {
      toast.error(t('qcEntry.detail.toast.deleteFailed'), e instanceof Error ? e.message : 'Network error');
    } finally {
      setWorking(false);
    }
  };

  const handleApplyPanel = async () => {
    if (!detail || selectedPanelIds.length === 0) return;
    setWorking(true);
    try {
      // Apply each panel sequentially. The API accepts one panelKey per call,
      // so multi-select fires N requests. We aggregate added/skipped counts
      // for a single summary toast, and continue past per-panel failures so a
      // bad panel doesn't block the rest.
      let totalAdded = 0;
      let totalSkipped = 0;
      const failures: string[] = [];

      for (const panelId of selectedPanelIds) {
        try {
          const res = await fetch(
            `/api/quality/qc-samples/${detail.id}/apply-panel`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ panelKey: panelId }),
            },
          );
          const data = await res.json();
          if (data.success) {
            totalAdded += data.data?.added ?? 0;
            totalSkipped += data.data?.skipped ?? 0;
          } else {
            failures.push(`panel #${panelId}: ${data.error || 'unknown error'}`);
          }
        } catch (err) {
          failures.push(
            `panel #${panelId}: ${err instanceof Error ? err.message : 'network error'}`,
          );
        }
      }

      if (failures.length === 0) {
        toast.success(
          t('qcEntry.detail.toast.applyPanelSuccess'),
          t('qcEntry.detail.toast.applyPanelSummary', { added: totalAdded, skipped: totalSkipped }),
        );
        setShowApplyPanel(false);
        setSelectedPanelIds([]);
        await fetchDetail();
      } else if (totalAdded > 0) {
        toast.warning(
          t('qcEntry.detail.toast.applyPanelPartial', { added: totalAdded, skipped: totalSkipped }),
          failures.join('\n'),
        );
        await fetchDetail();
      } else {
        toast.error('Apply panel failed', failures.join('\n'));
      }
    } finally {
      setWorking(false);
    }
  };

  const handleAddCustomTest = async () => {
    if (!detail || !newCriteriaId) return;
    setWorking(true);
    try {
      const res = await fetch(
        `/api/quality/qc-samples/${detail.id}/tests`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            criteriaId: newCriteriaId,
            sequence: newSequence,
          }),
        },
      );
      const data = await res.json();
      if (!data.success) {
        toast.error(t('qcEntry.detail.toast.addTestFailed'), data.error || 'Unknown error');
      } else {
        toast.success(t('qcEntry.detail.toast.addTestSuccess'));
        setShowAddTest(false);
        setNewCriteriaId(null);
        setNewSequence(1);
        await fetchDetail();
      }
    } catch (e) {
      toast.error(
        t('qcEntry.detail.toast.addTestFailed'),
        e instanceof Error ? e.message : 'Network error',
      );
    } finally {
      setWorking(false);
    }
  };

  const handleStatusAction = async (
    action: 'start_testing' | 'submit_for_review' | 'approve' | 'release' | 'reject',
  ) => {
    if (!detail) return;
    // Phase 3 — approve/release run as state transitions but the service
    // refuses them unless the matching reviewer/qa_release signature exists.
    // The buttons remain visible so operators can SEE what's blocking them
    // (the toast surfaces the service-level error message).
    if (action === 'reject') {
      const reason = prompt(t('qcEntry.detail.rejectReasonPrompt'));
      if (!reason) return;
      await postStatus(action, reason);
      return;
    }
    await postStatus(action);
  };

  // ── Sign-off handlers ────────────────────────────────────────────────

  const openSignDialog = (role: SignatureRole) => {
    setSignRole(role);
    setSignNotes('');
    setSignPassword('');
  };

  const closeSignDialog = () => {
    if (working) return;
    setSignRole(null);
    setSignNotes('');
    setSignPassword('');
  };

  const meaningForRole = (role: SignatureRole): string => {
    switch (role) {
      case 'analyst':
        return 'Tested';
      case 'reviewer':
        return 'Reviewed';
      case 'approver':
        return 'Approved';
      case 'qa_release':
        return 'Released';
    }
  };

  const handleSign = async () => {
    if (!detail || !signRole) return;
    // Part 11 requires the password as the second identification component;
    // catch it here so the user gets a clear message instead of a 401.
    if (!signPassword) {
      toast.error(
        'ต้องกรอกรหัสผ่าน',
        'กรุณากรอกรหัสผ่านเพื่อยืนยันการลงนามอิเล็กทรอนิกส์',
      );
      return;
    }
    setWorking(true);
    try {
      const res = await fetch(
        `/api/quality/qc-samples/${detail.id}/signatures`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: signRole,
            signatureMeaning: meaningForRole(signRole),
            notes: signNotes || null,
            // Always sent — the server now requires it (21 CFR Part 11
            // §11.200(a)(1)(ii)) and rejects a signature without it.
            passwordReentry: signPassword,
          }),
        },
      );
      const data = await res.json();
      if (!data.success) {
        toast.error(t('qcEntry.detail.toast.signFailed'), data.error || 'Unknown error');
      } else {
        const meta = data.data?.transitionedStatus
          ? t('qcEntry.detail.toast.signStatusMeta', {
              from: data.data.transitionedStatus.fromStatus,
              to: data.data.transitionedStatus.toStatus,
            })
          : t('qcEntry.detail.toast.signSavedMeta');
        toast.success(t('qcEntry.detail.toast.signSuccess'), meta);
        setSignRole(null);
        setSignNotes('');
        setSignPassword('');
        await fetchDetail();
      }
    } catch (e) {
      toast.error(t('qcEntry.detail.toast.signFailed'), e instanceof Error ? e.message : 'Network error');
    } finally {
      setWorking(false);
    }
  };

  // ── OOS handlers ─────────────────────────────────────────────────────

  const openOosDialog = (preselectTestId?: number) => {
    setOosTestId(preselectTestId ?? null);
    setOosPhase1('');
    setOosPhase2('');
    setOosClassification(null);
    setOosRetest(false);
    setOosConclusionInit('');
    setShowOpenOos(true);
  };

  const handleOpenOos = async () => {
    if (!detail || !oosTestId) return;
    setWorking(true);
    try {
      const res = await fetch(
        `/api/quality/qc-samples/${detail.id}/oos`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sampleTestId: oosTestId,
            phase1LabErrorCheck: oosPhase1 || null,
            phase2RootCause: oosPhase2 || null,
            classification: oosClassification || null,
            retestAuthorized: oosRetest,
            conclusion: oosConclusionInit || null,
          }),
        },
      );
      const data = await res.json();
      if (!data.success) {
        toast.error(t('qcEntry.detail.toast.openOosFailed'), data.error || 'Unknown error');
      } else {
        toast.success(
          t('qcEntry.detail.toast.openOosSuccess'),
          data.data?.deviationNumber
            ? `Auto-deviation: ${data.data.deviationNumber}`
            : `OOS #${data.data?.oosId} created`,
        );
        setShowOpenOos(false);
        await Promise.all([fetchDetail(), fetchOosList()]);
      }
    } catch (e) {
      toast.error(
        t('qcEntry.detail.toast.openOosFailed'),
        e instanceof Error ? e.message : 'Network error',
      );
    } finally {
      setWorking(false);
    }
  };

  const handleCloseOos = async () => {
    if (!closingOosId) return;
    if (oosCloseConclusion.trim().length < 10) {
      toast.error(t('qcEntry.detail.toast.closeOosFailed'), t('qcEntry.detail.toast.conclusionTooShort'));
      return;
    }
    setWorking(true);
    try {
      const res = await fetch(`/api/quality/oos/${closingOosId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          conclusion: oosCloseConclusion,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(t('qcEntry.detail.toast.closeOosFailed'), data.error || 'Unknown error');
      } else {
        toast.success(t('qcEntry.detail.toast.closeOosSuccess'));
        setClosingOosId(null);
        setOosCloseConclusion('');
        await Promise.all([fetchDetail(), fetchOosList()]);
      }
    } catch (e) {
      toast.error(
        t('qcEntry.detail.toast.closeOosFailed'),
        e instanceof Error ? e.message : 'Network error',
      );
    } finally {
      setWorking(false);
    }
  };

  const postStatus = async (action: string, reason?: string) => {
    if (!detail) return;
    setWorking(true);
    try {
      const res = await fetch(`/api/quality/qc-samples/${detail.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reason || null }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(t('qcEntry.detail.toast.statusChangeFailed'), data.error || 'Unknown error');
      } else {
        toast.success(
          t('qcEntry.detail.toast.statusChangeSuccess'),
          `${data.data?.fromStatus} → ${data.data?.toStatus}`,
        );
        await fetchDetail();
      }
    } catch (e) {
      toast.error(
        t('qcEntry.detail.toast.statusChangeFailed'),
        e instanceof Error ? e.message : 'Network error',
      );
    } finally {
      setWorking(false);
    }
  };

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <DxLoadIndicator />
        </div>
      </>
    );
  }

  if (error || !detail) {
    return (
      <>
        <div className="flex flex-col gap-5 p-4 md:p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-red-800">{t('qcEntry.detail.loadError')}</p>
              <p className="text-sm text-red-700">
                {error || 'QC sample not found'}
              </p>
            </div>
            <DxButton
              text={t('qcEntry.detail.actions.back')}
              icon="back"
              stylingMode="outlined"
              onClick={() => router.push('/quality/qc-entry')}
            />
          </div>
        </div>
      </>
    );
  }

  const sInfo = statusBadge(detail.status);
  const canEditTests =
    detail.status === 'registered' || detail.status === 'testing';
  const canApplyPanel =
    detail.status === 'registered' || detail.status === 'testing';

  // Available state-machine buttons given current status.
  const showStartTesting = detail.status === 'registered';
  const showSubmitReview = detail.status === 'testing';
  const showApprove = detail.status === 'reviewed';
  const showRelease = detail.status === 'approved';
  const showReject =
    detail.status !== 'rejected' && detail.status !== 'released';

  const sourceLabel = (() => {
    switch (detail.sourceType) {
      case 'raw_material_lot':
        return t('qcEntry.detail.source.rawMaterialLot');
      case 'work_order_batch':
        return t('qcEntry.detail.source.workOrderBatch');
      case 'customer_return':
        return t('qcEntry.detail.source.customerReturn');
      case 'stability':
        return 'Stability';
      case 'purchased_herb':
        return t('qcEntry.detail.source.purchasedHerb');
      case 'outgoing_shipment':
        return t('qcEntry.detail.source.outgoingShipment');
      default:
        return detail.sourceType;
    }
  })();

  // De-duplicate panels by id for the dialog dropdown — backend returns one row
  // per criteria but the operator picks the panel-row to apply.
  const panelOptions = panels.map((p) => ({
    id: p.id,
    label: `Panel #${p.id} — ${p.criteriaName ?? 'criteria#' + p.criteriaId}`,
  }));

  // Filter criteria the user might pick — exclude criteria already in tests.
  const existingCriteriaIds = new Set(detail.tests.map((t) => t.criteriaId));
  const availableCriteria = criteria.filter(
    (c) => !existingCriteriaIds.has(c.id),
  );

  return (
    <>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full print:p-0">
        <div className="print:hidden">
          <ResponsivePageHeader
            title={`Sample ${detail.sampleNumber}`}
            subtitle={
              detail.productCode
                ? `${detail.productCode} — ${detail.productName ?? ''}`
                : ''
            }
            icon={TestTube}
            iconBgColor="bg-cyan-100"
            iconColor="text-cyan-600"
            breadcrumbs={[
              { label: 'Quality', href: '/quality' },
              { label: 'QC Entry', href: '/quality/qc-entry' },
              { label: detail.sampleNumber },
            ]}
            actions={
              <div className="flex items-center gap-2 flex-wrap">
                <DxButton
                  text={t('qcEntry.detail.actions.back')}
                  icon="back"
                  stylingMode="outlined"
                  onClick={() => router.push('/quality/qc-entry')}
                />
                <DxButton
                  text={t('qcEntry.detail.actions.print')}
                  icon="print"
                  stylingMode="outlined"
                  onClick={handlePrint}
                />
              </div>
            }
          />
        </div>

        <div className="mb-6 print:hidden">
          <StatusStepper
            title={t('qcEntry.detail.stepper.title')}
            steps={[
              { key: 'registered', label: t('qcEntry.detail.stepper.registered') },
              { key: 'testing', label: t('qcEntry.detail.stepper.testing') },
              { key: 'reviewed', label: t('qcEntry.detail.stepper.reviewed') },
              { key: 'approved', label: t('qcEntry.detail.stepper.approved') },
            ]}
            current={String(detail.status).toLowerCase()}
          />
        </div>

        {/* Print-only formal QC Test Report (A4) — hidden on screen */}
        <QCTestPrintDocument detail={detail} />

        {/* Header card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6 print:hidden">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{t('qcEntry.detail.headerCard.status')}</p>
              <div className="mt-1">
                <Badge variant={sInfo.variant}>{sInfo.label}</Badge>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{t('qcEntry.detail.headerCard.receivedDate')}</p>
              <p className="mt-1 text-sm font-medium">
                {formatDateOnlyTh(detail.receivedDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{t('qcEntry.detail.headerCard.receivedBy')}</p>
              <p className="mt-1 text-sm font-medium">
                {detail.receivedByName || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Source</p>
              <p className="mt-1 text-sm font-medium">{sourceLabel}</p>
              {detail.sourceRefText && (
                <p className="text-xs text-gray-500">{detail.sourceRefText}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Lot #</p>
              <p className="mt-1 text-sm font-medium font-mono">
                {detail.lotNumber || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{t('qcEntry.detail.headerCard.quantity')}</p>
              <p className="mt-1 text-sm font-medium">
                {detail.quantityReceived != null
                  ? `${Number(detail.quantityReceived).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${detail.unit || ''}`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{t('qcEntry.detail.headerCard.manufactureDate')}</p>
              <p className="mt-1 text-sm">{formatDateOnlyTh(detail.manufactureDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{t('qcEntry.detail.headerCard.expiryDate')}</p>
              <p className="mt-1 text-sm">{formatDateOnlyTh(detail.expiryDate)}</p>
            </div>
            {detail.customerName && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">{t('qcEntry.detail.headerCard.customer')}</p>
                <p className="mt-1 text-sm font-medium">{detail.customerName}</p>
                {detail.salesOrderRef && (
                  <p className="text-xs text-gray-500 font-mono">
                    {detail.salesOrderRef}
                  </p>
                )}
              </div>
            )}
            {detail.storageConditions && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  {t('qcEntry.detail.headerCard.storage')}
                </p>
                <p className="mt-1 text-sm">{detail.storageConditions}</p>
              </div>
            )}
          </div>
          {detail.notes && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {t('qcEntry.detail.headerCard.notes')}
              </p>
              <p className="mt-1 text-sm whitespace-pre-line">{detail.notes}</p>
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 md:p-4 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            {canApplyPanel && (
              <DxButton
                text="Apply test panel"
                icon="textdocument"
                stylingMode="outlined"
                onClick={() => setShowApplyPanel(true)}
                disabled={working}
              />
            )}
            {canEditTests && (
              <DxButton
                text={t('qcEntry.detail.actions.addTest')}
                icon="plus"
                stylingMode="outlined"
                onClick={() => setShowAddTest(true)}
                disabled={working}
              />
            )}
            {showStartTesting && (
              <DxButton
                text={t('qcEntry.detail.actions.startTesting')}
                icon="runner"
                type="default"
                onClick={() => handleStatusAction('start_testing')}
                disabled={working}
              />
            )}
            {showSubmitReview && (
              <DxButton
                text={t('qcEntry.detail.actions.submitReview')}
                icon="check"
                type="success"
                onClick={() => handleStatusAction('submit_for_review')}
                disabled={working}
              />
            )}
            {showApprove && (
              <DxButton
                text={t('qcEntry.detail.actions.approve')}
                icon="check"
                type="success"
                onClick={() => handleStatusAction('approve')}
                disabled={working}
              />
            )}
            {showRelease && (
              <DxButton
                text={t('qcEntry.detail.actions.release')}
                icon="check"
                type="success"
                onClick={() => handleStatusAction('release')}
                disabled={working}
              />
            )}
            {showReject && (
              <DxButton
                text={t('qcEntry.detail.actions.reject')}
                icon="close"
                type="danger"
                stylingMode="outlined"
                onClick={() => handleStatusAction('reject')}
                disabled={working}
              />
            )}
            {/* Phase 4 — Generate / View COA buttons.
                The service allows multiple COAs per sample as long as no
                ACTIVE one exists, so we surface "ออก COA" again whenever
                the latest linkedCoa is revoked / superseded. */}
            {(() => {
              if (detail.status !== 'released') return null;
              const lastCoaStatus = detail.linkedCoa?.status ?? null;
              const hasActiveCoa =
                detail.linkedCoa != null &&
                lastCoaStatus !== 'revoked' &&
                lastCoaStatus !== 'superseded';
              const canGenerate = !hasActiveCoa;
              return (
                <>
                  {canGenerate && (
                    <DxButton
                      text={
                        detail.linkedCoa
                          ? t('qcEntry.detail.actions.generateNewCoa')
                          : t('qcEntry.detail.actions.generateCoa')
                      }
                      icon="doc"
                      type="success"
                      onClick={async () => {
                        setWorking(true);
                        try {
                          const res = await fetch('/api/quality/coa', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sampleId: detail.id }),
                          });
                          const data = await res.json();
                          if (!data.success) {
                            toast.error(data.error || t('qcEntry.detail.toast.coaFailed'));
                            return;
                          }
                          toast.success(data.message || t('qcEntry.detail.toast.coaSuccess'));
                          if (data.data?.coaId) {
                            router.push(`/quality/coa/${data.data.coaId}`);
                          } else {
                            await fetchDetail();
                          }
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : t('qcEntry.detail.toast.coaFailed'),
                          );
                        } finally {
                          setWorking(false);
                        }
                      }}
                      disabled={working}
                    />
                  )}
                  {detail.linkedCoa && (
                    <DxButton
                      text={`${t('qcEntry.detail.actions.viewCoa')}: ${detail.linkedCoa.coaNumber}${
                        lastCoaStatus === 'revoked'
                          ? ' (revoked)'
                          : lastCoaStatus === 'superseded'
                          ? ' (superseded)'
                          : ''
                      }`}
                      icon="doc"
                      stylingMode="outlined"
                      onClick={() =>
                        router.push(`/quality/coa/${detail.linkedCoa!.id}`)
                      }
                      disabled={working}
                    />
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Tests table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden print:hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              {t('qcEntry.detail.testResultsTitle', { count: detail.tests.length })}
            </h2>
            {detail.linkedCoa && (
              <a
                href={`/quality/coa/${detail.linkedCoa.id}`}
                className="text-xs text-emerald-600 hover:underline"
              >
                COA: {detail.linkedCoa.coaNumber}
              </a>
            )}
          </div>
          {detail.tests.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              <FlaskConical className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
              {t('qcEntry.detail.noTests')}
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {detail.tests.map((test) => {
                const isEditing = editing?.testId === test.id;
                const isReviewed = test.reviewedBy != null;
                const isExpanded = expandedTests.has(test.id);
                const hasResult =
                  test.numericResult != null ||
                  !!test.textResult ||
                  test.totalRounds > 0;
                const isPass = test.resultStatus === 'pass';
                const isFail = test.resultStatus === 'fail' || test.resultStatus === 'oos';
                const borderColor = isReviewed
                  ? 'border-l-emerald-500'
                  : isPass
                  ? 'border-l-green-400'
                  : isFail
                  ? 'border-l-red-400'
                  : 'border-l-gray-300';

                // Master-data driven recording config for this test.
                const sampleSize = Math.max(1, Number(test.criteriaSampleSize) || 1);
                const isMultiSample = sampleSize > 1;
                const isPassFail = test.criteriaType === 'pass_fail';
                const tolerancePct = Number(test.criteriaTolerancePercent) || 0;
                // maxRetestRounds = number of retests allowed (separate from
                // the initial Round 1). Total possible rounds = 1 + retests.
                const maxRetestRounds = Math.max(0, Number(test.criteriaMaxRetestRounds ?? 0));
                const canRetest =
                  test.totalRounds > 0 &&
                  test.totalRounds <= maxRetestRounds &&
                  !isReviewed;

                // Live preview for the form being edited.
                let livePreview: 'pass' | 'fail' | null = null;
                if (isEditing && editing) {
                  if (isMultiSample && isPassFail) {
                    const filled = editing.sampleResults.filter(
                      (r): r is 'pass' | 'fail' => r === 'pass' || r === 'fail',
                    );
                    if (filled.length === sampleSize) {
                      const failCount = filled.filter((r) => r === 'fail').length;
                      const failPct = (failCount / filled.length) * 100;
                      livePreview = failPct <= tolerancePct ? 'pass' : 'fail';
                    }
                  } else if (isMultiSample) {
                    const filled = editing.sampleValues.filter(
                      (v): v is number => v != null && Number.isFinite(v),
                    );
                    if (filled.length === sampleSize) {
                      const failCount = filled.filter((v) =>
                        evaluateNumeric(v, test.specMin, test.specMax) === 'fail',
                      ).length;
                      const failPct = (failCount / filled.length) * 100;
                      livePreview = failPct <= tolerancePct ? 'pass' : 'fail';
                    }
                  } else {
                    livePreview = evaluateNumeric(editing.numericResult, test.specMin, test.specMax);
                  }
                }

                return (
                  <Card key={test.id} className={`border-l-4 ${borderColor}`}>
                    <CardContent className="p-4">
                      {/* Test Header Row */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(test.id)}
                            className="cursor-pointer pt-1"
                            aria-label={isExpanded ? t('qcEntry.detail.test.collapse') : t('qcEntry.detail.test.expand')}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-gray-500 font-mono">#{test.sequence}</span>
                              <span className="font-medium text-gray-900">
                                {test.criteriaNameTh || test.criteriaName || `criteria#${test.criteriaId}`}
                              </span>
                              {resultBadge(test.resultStatus)}
                              {test.criteriaCode && (
                                <span className="text-xs text-gray-500 font-mono">
                                  ({test.criteriaCode})
                                </span>
                              )}
                              {isReviewed && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                  <ShieldCheck className="h-3 w-3" /> Reviewed
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {test.testMethod && <span>{test.testMethod} · </span>}
                              <span>Spec: {formatSpec(test, t)}</span>
                            </div>
                            {(test.testedByName || test.reviewedByName) && (
                              <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-3">
                                {test.testedByName && (
                                  <span>
                                    {t('qcEntry.detail.test.recordedBy')}:{' '}
                                    <strong className="text-gray-700">{test.testedByName}</strong>
                                    {test.testedAt && (
                                      <span className="text-gray-400 ml-1">
                                        ({formatDateTh(test.testedAt)})
                                      </span>
                                    )}
                                  </span>
                                )}
                                {test.reviewedByName && (
                                  <span>
                                    {t('qcEntry.detail.test.reviewedBy')}:{' '}
                                    <strong className="text-emerald-700">
                                      {test.reviewedByName}
                                    </strong>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Result quick-view */}
                        {hasResult && !isEditing && (
                          <div className="text-right mr-2">
                            <div className="text-sm font-medium">
                              {test.numericResult != null
                                ? `${Number(test.numericResult).toLocaleString(undefined, { maximumFractionDigits: 4 })}${test.unit ? ` ${test.unit}` : ''}`
                                : test.textResult || '—'}
                            </div>
                            {test.totalRounds > 0 && (
                              <div className="text-xs text-gray-500">
                                Round {test.totalRounds}{' '}
                                {isMultiSample && `(avg, n=${sampleSize})`}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        {!isEditing && !isReviewed && canEditTests && (
                          <div className="flex gap-2">
                            {!hasResult ? (
                              <>
                                <DxButton
                                  text={t('qcEntry.detail.test.recordResult')}
                                  type="default"
                                  stylingMode="contained"
                                  onClick={() => handleStartEdit(test)}
                                  disabled={working}
                                />
                                {/* Delete unrecorded test rows — useful when
                                    operator picked the wrong criteria via the
                                    "เพิ่มการทดสอบ" dialog. */}
                                <DxButton
                                  icon="trash"
                                  type="danger"
                                  stylingMode="text"
                                  hint={t('qcEntry.detail.test.deleteHint')}
                                  onClick={() => handleDeleteTest(test.id)}
                                  disabled={working}
                                />
                              </>
                            ) : (
                              <>
                                <DxButton
                                  text={t('qcEntry.detail.test.editRound', { round: test.totalRounds })}
                                  icon="edit"
                                  stylingMode="outlined"
                                  onClick={() => handleStartEdit(test, test.totalRounds || 1)}
                                  disabled={working}
                                />
                                {canRetest && (
                                  <DxButton
                                    text={`+ Round ${test.totalRounds + 1}`}
                                    type="normal"
                                    stylingMode="outlined"
                                    hint={t('qcEntry.detail.test.newRoundHint', { max: maxRetestRounds })}
                                    onClick={() => handleStartEdit(test, test.totalRounds + 1)}
                                    disabled={working}
                                  />
                                )}
                                {/* Quick access to attach a COA/report — the
                                    AttachmentPanel lives in the expanded detail,
                                    so this just expands the row and reveals it. */}
                                <DxButton
                                  hint={t('qcEntry.detail.test.attachHint')}
                                  stylingMode="text"
                                  onClick={() => {
                                    if (!expandedTests.has(test.id)) toggleExpanded(test.id);
                                  }}
                                  elementAttr={{ 'data-testid': `qc-test-attach-btn-${test.id}` }}
                                >
                                  <span className="inline-flex items-center gap-1 text-xs">
                                    <Paperclip className="w-3.5 h-3.5" /> {t('qcEntry.detail.test.attach')}
                                  </span>
                                </DxButton>
                                <DxButton
                                  icon="trash"
                                  type="danger"
                                  stylingMode="text"
                                  hint={t('qcEntry.detail.test.deleteHint')}
                                  onClick={() => handleDeleteTest(test.id)}
                                  disabled={working}
                                />
                              </>
                            )}
                          </div>
                        )}
                        {isReviewed && (
                          <span className="text-xs text-gray-400 italic">
                            reviewed — locked
                          </span>
                        )}
                      </div>

                      {/* Expanded notes / details + per-round history */}
                      {isExpanded && !isEditing && (
                        <div className="mt-3 pt-3 border-t text-xs text-gray-600 space-y-2">
                          {/* Round history */}
                          {test.rounds.length > 0 && (
                            <div className="space-y-2">
                              {test.rounds.map((round) => (
                                <div
                                  key={round.roundNumber}
                                  className="border rounded-lg p-2.5 bg-gray-50/50"
                                >
                                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                    <span className="text-sm font-semibold text-gray-800">
                                      Round {round.roundNumber}
                                    </span>
                                    {resultBadge(round.result)}
                                    {round.avg != null && (
                                      <span className="text-xs text-gray-500">
                                        Avg:{' '}
                                        <strong>{round.avg.toFixed(2)}</strong>
                                        {test.unit ? ` ${test.unit}` : ''}
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
                                    {round.samples.map((s) => (
                                      <div
                                        key={s.sampleNumber}
                                        className={`text-center p-1.5 rounded text-xs ${
                                          s.result === 'pass'
                                            ? 'bg-green-50 text-green-700'
                                            : s.result === 'fail'
                                            ? 'bg-red-50 text-red-700'
                                            : 'bg-white text-gray-600 border border-gray-200'
                                        }`}
                                      >
                                        <div className="font-medium">#{s.sampleNumber}</div>
                                        <div>
                                          {s.numericValue != null
                                            ? Number(s.numericValue).toFixed(2)
                                            : s.textValue || '—'}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {test.notes && (
                            <div>
                              <span className="font-medium">{t('qcEntry.detail.test.notesInline')}:</span> {test.notes}
                            </div>
                          )}
                          {!test.notes && !hasResult && (
                            <p className="text-gray-400">{t('qcEntry.detail.test.noResultYet')}</p>
                          )}
                          {/* Audit Q4 — attach analytical report / COA per QC test */}
                          <div className="pt-2">
                            <AttachmentPanel
                              moduleName="quality_test"
                              entityId={test.id}
                              defaultCategory="lab_result"
                              title={t('qcEntry.detail.test.labResultTitle')}
                              testIdBase={`qc-test-attach-${test.id}`}
                            />
                          </div>
                        </div>
                      )}

                      {/* Inline Record Form */}
                      {isEditing && editing && (
                        <div className="mt-3 pt-3 border-t border-emerald-200 bg-emerald-50/50 rounded-lg p-3 space-y-3">
                          {/* Round indicator */}
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                              Round {editing.testRound}
                            </span>
                            {editing.testRound > 1 && (
                              <span className="text-xs text-gray-500">
                                {t('qcEntry.detail.recordForm.roundOf', { round: editing.testRound, max: maxRetestRounds })}
                              </span>
                            )}
                          </div>

                          {/* Spec info card */}
                          <div className="bg-white border border-emerald-200 rounded-md p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <FlaskConical className="h-4 w-4 text-emerald-600" />
                              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
                                Specification
                              </span>
                            </div>
                            <div className="text-sm text-gray-800 font-medium">
                              {formatSpec(test, t)}
                            </div>
                            {test.testMethod && (
                              <div className="text-xs text-gray-500 mt-1">
                                Method: {test.testMethod}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 mt-1">
                              {t('qcEntry.detail.recordForm.sampleLabel')}: <strong>{sampleSize}</strong>
                              {tolerancePct > 0 && (
                                <> · Tolerance: <strong>±{tolerancePct}%</strong></>
                              )}
                            </div>
                          </div>

                          {/* Multi-sample PASS/FAIL grid (criteriaType === 'pass_fail').
                              Each sample gets ✓/✗ buttons instead of a number box,
                              matching the Pass/Fail criteria set in master data. */}
                          {isMultiSample && isPassFail && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('qcEntry.detail.recordForm.multiResultLabel', { count: sampleSize })}
                              </label>
                              {/* Bulk actions: pass all / fail all / clear */}
                              <div className="flex gap-2 mb-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditing({ ...editing, sampleResults: editing.sampleResults.map(() => 'pass') })
                                  }
                                  className="px-3 py-1 rounded-md text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                  ✓ {t('qcEntry.detail.recordForm.passAll')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditing({ ...editing, sampleResults: editing.sampleResults.map(() => 'fail') })
                                  }
                                  className="px-3 py-1 rounded-md text-xs font-medium bg-rose-600 text-white hover:bg-rose-700"
                                >
                                  ✗ {t('qcEntry.detail.recordForm.failAll')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditing({ ...editing, sampleResults: editing.sampleResults.map(() => null) })
                                  }
                                  className="px-3 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
                                >
                                  {t('qcEntry.detail.recordForm.clearAll')}
                                </button>
                              </div>
                              <div className="grid grid-cols-5 gap-2">
                                {editing.sampleResults.map((res, idx) => (
                                  <div key={idx}>
                                    <label className="block text-xs text-gray-500 mb-0.5">#{idx + 1}</label>
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = [...editing.sampleResults];
                                          next[idx] = res === 'pass' ? null : 'pass';
                                          setEditing({ ...editing, sampleResults: next });
                                        }}
                                        className={
                                          'flex-1 h-8 rounded-md border flex items-center justify-center transition-colors ' +
                                          (res === 'pass'
                                            ? 'bg-emerald-500 border-emerald-500 text-white'
                                            : 'bg-white border-gray-200 text-emerald-600 hover:bg-emerald-50')
                                        }
                                        aria-label={`#${idx + 1} pass`}
                                      >
                                        <Check className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = [...editing.sampleResults];
                                          next[idx] = res === 'fail' ? null : 'fail';
                                          setEditing({ ...editing, sampleResults: next });
                                        }}
                                        className={
                                          'flex-1 h-8 rounded-md border flex items-center justify-center transition-colors ' +
                                          (res === 'fail'
                                            ? 'bg-rose-500 border-rose-500 text-white'
                                            : 'bg-white border-gray-200 text-rose-600 hover:bg-rose-50')
                                        }
                                        aria-label={`#${idx + 1} fail`}
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Multi-sample numeric grid (sampleSize > 1, non pass/fail) */}
                          {isMultiSample && !isPassFail && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('qcEntry.detail.recordForm.multiResultLabel', { count: sampleSize })}{test.unit ? t('qcEntry.detail.recordForm.unitSuffix', { unit: test.unit }) : ''}
                              </label>
                              <div className="grid grid-cols-5 gap-2">
                                {editing.sampleValues.map((val, idx) => {
                                  // Sequential fill — ต้องกรอก #N ก่อน #N+1 จึงจะเปิดใช้
                                  const prevFilled =
                                    idx === 0 || editing.sampleValues[idx - 1] != null;
                                  return (
                                    <div key={idx} className={!prevFilled ? 'opacity-40' : ''}>
                                      <label className="block text-xs text-gray-500 mb-0.5">
                                        #{idx + 1}
                                      </label>
                                      <DxNumberBox
                                        value={val}
                                        onValueChange={(v) => {
                                          if (!editing) return;
                                          const next = [...editing.sampleValues];
                                          next[idx] = v ?? null;
                                          setEditing({ ...editing, sampleValues: next });
                                        }}
                                        placeholder="0.00"
                                        readOnly={!prevFilled}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Single-sample numeric input (sampleSize === 1) */}
                          {!isMultiSample && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('qcEntry.detail.recordForm.numericResultLabel')} {test.unit ? `(${test.unit})` : ''}
                              </label>
                              <DxNumberBox
                                value={editing.numericResult ?? null}
                                onValueChange={(v) =>
                                  setEditing(
                                    editing
                                      ? { ...editing, numericResult: v ?? null }
                                      : editing,
                                  )
                                }
                                placeholder="0.00"
                                showClearButton
                              />
                            </div>
                          )}

                          {/* Text fallback (only when no multi-sample) */}
                          {!isMultiSample && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('qcEntry.detail.recordForm.textResultLabel')}
                              </label>
                              <DxTextBox
                                value={editing.textResult}
                                onValueChange={(v) =>
                                  setEditing(
                                    editing ? { ...editing, textResult: v } : editing,
                                  )
                                }
                                placeholder={t('qcEntry.detail.recordForm.textResultPlaceholder')}
                              />
                            </div>
                          )}

                          {/* Live pass/fail summary bar */}
                          {(() => {
                            const filled = isMultiSample
                              ? editing.sampleValues.filter(
                                  (v): v is number => v != null && Number.isFinite(v),
                                ).length
                              : editing.numericResult != null
                              ? 1
                              : 0;
                            const total = isMultiSample ? sampleSize : 1;
                            if (filled === 0) return null;
                            const passCount = isMultiSample
                              ? editing.sampleValues.filter(
                                  (v) =>
                                    v != null && evaluateNumeric(v, test.specMin, test.specMax) === 'pass',
                                ).length
                              : livePreview === 'pass'
                              ? 1
                              : 0;
                            const failCount = filled - passCount;
                            const failPct = filled > 0 ? (failCount / filled) * 100 : 0;
                            const overallPass = filled === total && failPct <= tolerancePct;
                            const allFilled = filled === total;
                            return (
                              <div
                                className={`flex items-center justify-between p-2 rounded text-sm font-medium ${
                                  !allFilled
                                    ? 'bg-amber-50 text-amber-700'
                                    : overallPass
                                    ? 'bg-green-50 text-green-700'
                                    : 'bg-red-50 text-red-700'
                                }`}
                              >
                                <span>
                                  {t('qcEntry.detail.recordForm.passSummary', { passCount, filled })}
                                  {filled > 0 && ` (${(100 - failPct).toFixed(0)}%)`}
                                </span>
                                <span className="text-xs">
                                  {!allFilled
                                    ? t('qcEntry.detail.recordForm.fillProgress', { filled, total })
                                    : `Tolerance ±${tolerancePct}% — ${overallPass ? 'PASS' : 'FAIL'}`}
                                </span>
                              </div>
                            );
                          })()}

                          {/* Notes */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('qcEntry.detail.recordForm.notesLabel')}
                            </label>
                            <DxTextArea
                              value={editing.notes}
                              onValueChange={(v) =>
                                setEditing(editing ? { ...editing, notes: v } : editing)
                              }
                              placeholder={t('qcEntry.detail.recordForm.notesPlaceholder')}
                              height={60}
                            />
                          </div>

                          {/* Actions */}
                          <div className="flex items-center justify-end gap-2">
                            <DxButton
                              text={t('qcEntry.detail.actions.cancel')}
                              stylingMode="text"
                              onClick={handleCancelEdit}
                              disabled={working}
                            />
                            <DxButton
                              text={working ? t('qcEntry.detail.actions.saving') : t('qcEntry.detail.actions.save')}
                              type="success"
                              stylingMode="contained"
                              onClick={handleSaveEdit}
                              disabled={(() => {
                                if (working) return true;
                                // Multi-sample pass/fail: every sample needs a verdict
                                if (isMultiSample && isPassFail) {
                                  return editing.sampleResults.some((r) => r == null);
                                }
                                // Multi-sample numeric: every input must be filled
                                if (isMultiSample) {
                                  return editing.sampleValues.some((v) => v == null);
                                }
                                // Single: numeric or text must be present
                                return editing.numericResult == null && !editing.textResult.trim();
                              })()}
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Sign-off (21 CFR Part 11) — 4 tiers */}
        {(() => {
          const signatureByRole = new Map<string, typeof detail.signatures[number]>();
          for (const sig of detail.signatures) {
            signatureByRole.set(sig.role, sig);
          }
          const analystSig = signatureByRole.get('analyst');
          const reviewerSig = signatureByRole.get('reviewer');
          const approverSig = signatureByRole.get('approver');
          const releaseSig = signatureByRole.get('qa_release');

          // Has at least one test row been recorded?
          const hasTestedRow = detail.tests.some((t) => t.testedBy != null);

          // Per-role visibility hints (server is authoritative).
          const canSignAnalyst =
            !analystSig &&
            (detail.status === 'testing' || detail.status === 'registered');
          // Reviewer may sign while testing OR if the sample was already pushed
          // to 'reviewed'/'approved' without a reviewer signature (legacy/seed
          // data that skipped the step) — otherwise the row would be stuck with
          // no way to add the missing signature. Same idea for approver/release:
          // allow signing whenever the prior signature exists but this tier's is
          // missing, regardless of how far the status was advanced.
          const canSignReviewer =
            !reviewerSig &&
            hasTestedRow &&
            (detail.status === 'testing' ||
              detail.status === 'reviewed' ||
              detail.status === 'approved');
          const canSignApprover =
            !approverSig &&
            !!reviewerSig &&
            (detail.status === 'reviewed' || detail.status === 'approved');
          const canSignRelease =
            !releaseSig &&
            !!approverSig &&
            (detail.status === 'approved' || detail.status === 'released');

          const tiers: Array<{
            role: SignatureRole;
            label: string;
            sig: typeof detail.signatures[number] | undefined;
            canSign: boolean;
          }> = [
            { role: 'analyst', label: t('qcEntry.detail.signoff.tierAnalyst'), sig: analystSig, canSign: canSignAnalyst },
            { role: 'reviewer', label: t('qcEntry.detail.signoff.tierReviewer'), sig: reviewerSig, canSign: canSignReviewer },
            { role: 'approver', label: t('qcEntry.detail.signoff.tierApprover'), sig: approverSig, canSign: canSignApprover },
            { role: 'qa_release', label: t('qcEntry.detail.signoff.tierRelease'), sig: releaseSig, canSign: canSignRelease },
          ];

          return (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 print:hidden">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-semibold text-gray-700">
                  {t('qcEntry.detail.signoff.title')}
                </h2>
              </div>
              <div className="space-y-2">
                {tiers.map((tier) => (
                  <div
                    key={tier.role}
                    className={`flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-3 py-2 rounded-lg border ${
                      tier.sig
                        ? 'border-emerald-200 bg-emerald-50/60'
                        : 'border-gray-200 bg-gray-50/40'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                        {tier.label}
                      </p>
                      {tier.sig ? (
                        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                          <span className="text-sm font-medium">
                            {tier.sig.userName ?? `user#${tier.sig.userId}`}
                          </span>
                          <span className="text-xs text-emerald-700">
                            {formatDateTh(tier.sig.signedAt)} ✓
                          </span>
                          {tier.sig.signatureMeaning && (
                            <span className="text-xs text-gray-500 italic">
                              {tier.sig.signatureMeaning}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="mt-0.5 text-sm text-gray-400">{t('qcEntry.detail.signoff.notSigned')}</p>
                      )}
                    </div>
                    {!tier.sig && tier.canSign && (
                      <DxButton
                        text="Sign"
                        icon="edit"
                        type="default"
                        stylingMode="outlined"
                        onClick={() => openSignDialog(tier.role)}
                        disabled={working}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* OOS Investigations (FDA 21 CFR 211.192) */}
        {(detail.status === 'oos' ||
          oosList.length > 0 ||
          detail.tests.some((t) => t.resultStatus === 'fail')) && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <AlertOctagon className="h-4 w-4 text-rose-600" />
                <h2 className="text-sm font-semibold text-gray-700">
                  {t('qcEntry.detail.oos.title')}
                </h2>
              </div>
              <DxButton
                text={t('qcEntry.detail.oos.openButton')}
                icon="plus"
                type="danger"
                stylingMode="outlined"
                onClick={() => openOosDialog()}
                disabled={
                  working ||
                  !detail.tests.some((t) => t.resultStatus === 'fail')
                }
              />
            </div>
            {oosList.length === 0 ? (
              <p className="text-xs text-gray-500">
                {detail.tests.some((tt) => tt.resultStatus === 'fail')
                  ? t('qcEntry.detail.oos.hasFailHint')
                  : t('qcEntry.detail.oos.noFailHint')}
              </p>
            ) : (
              <div className="space-y-2">
                {oosList.map((oos) => {
                  const failedTest = detail.tests.find(
                    (tt) => tt.id === oos.sampleTestId,
                  );
                  return (
                    <div
                      key={oos.id}
                      className={`px-3 py-2 rounded-lg border ${
                        oos.closedAt
                          ? 'border-gray-200 bg-gray-50'
                          : 'border-rose-200 bg-rose-50/40'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                          <span className="text-sm font-medium">
                            OOS #{oos.id}
                          </span>
                          <span className="text-xs text-gray-600">
                            {t('qcEntry.detail.oos.testLabel')}:{' '}
                            {failedTest
                              ? failedTest.criteriaNameTh ||
                                failedTest.criteriaName ||
                                `criteria#${failedTest.criteriaId}`
                              : `test#${oos.sampleTestId}`}
                          </span>
                          {oos.classification && (
                            <Badge
                              variant={
                                oos.classification === 'manufacturing_error'
                                  ? 'danger'
                                  : oos.classification === 'lab_error'
                                  ? 'warning'
                                  : 'default'
                              }
                            >
                              {oos.classification}
                            </Badge>
                          )}
                          {oos.closedAt ? (
                            <Badge variant="success">CLOSED</Badge>
                          ) : (
                            <Badge variant="warning">OPEN</Badge>
                          )}
                          {oos.linkedDeviation && (
                            <a
                              href={`/quality/deviations/${oos.linkedDeviation.id}`}
                              className="text-xs text-rose-600 hover:underline font-mono"
                            >
                              {oos.linkedDeviation.deviationNumber}
                            </a>
                          )}
                        </div>
                        {!oos.closedAt && (
                          <DxButton
                            text={t('qcEntry.detail.oos.closeButton')}
                            icon="check"
                            stylingMode="outlined"
                            onClick={() => {
                              setClosingOosId(oos.id);
                              setOosCloseConclusion(oos.conclusion ?? '');
                            }}
                            disabled={working}
                          />
                        )}
                      </div>
                      {oos.phase1LabErrorCheck && (
                        <p className="mt-1 text-xs text-gray-700">
                          <span className="font-semibold">Phase 1 (lab):</span>{' '}
                          {oos.phase1LabErrorCheck}
                        </p>
                      )}
                      {oos.phase2RootCause && (
                        <p className="mt-1 text-xs text-gray-700">
                          <span className="font-semibold">Phase 2 (root cause):</span>{' '}
                          {oos.phase2RootCause}
                        </p>
                      )}
                      {oos.conclusion && (
                        <p className="mt-1 text-xs text-gray-700">
                          <span className="font-semibold">Conclusion:</span>{' '}
                          {oos.conclusion}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-gray-500">
                        {t('qcEntry.detail.oos.openedBy')} {oos.initiatedByName ?? `user#${oos.initiatedBy}`} ·{' '}
                        {formatDateTh(oos.initiatedAt)}
                        {oos.closedAt && (
                          <>
                            {' '}— {t('qcEntry.detail.oos.closedBy')} {oos.closedByName ?? `user#${oos.closedBy}`} ·{' '}
                            {formatDateTh(oos.closedAt)}
                          </>
                        )}
                        {oos.retestAuthorized && (
                          <span className="ml-2 text-emerald-700 font-medium">
                            · ✓ Retest authorized
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Audit trail (per-entity) — Phase 9 */}
        <div className="print:hidden">
          <EntityAuditTrail
            entityType="qc_sample"
            entityId={detail.id}
          />
        </div>
      </div>

      {/* Apply panel dialog */}
      <DxPopup
        visible={showApplyPanel}
        onHiding={() => {
          if (!working) {
            setShowApplyPanel(false);
            setSelectedPanelIds([]);
          }
        }}
        title="Apply test panel"
        width={560}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          {panels.length === 0 ? (
            <p className="text-sm text-gray-600">
              {t('qcEntry.detail.applyPanelDialog.noPanel')} <a className="text-cyan-600 hover:underline" href="/quality/test-panels">/quality/test-panels</a>
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-700">
                {t('qcEntry.detail.applyPanelDialog.selectPrompt')}
                <span className="text-xs text-gray-500"> {t('qcEntry.detail.applyPanelDialog.multiHint')}</span>:
              </p>
              <DxTagBox
                value={selectedPanelIds}
                dataSource={panelOptions as unknown as Record<string, unknown>[]}
                displayExpr="label"
                valueExpr="id"
                onValueChanged={(e) => {
                  const next = Array.isArray(e.value) ? (e.value as number[]) : [];
                  setSelectedPanelIds(next);
                }}
                placeholder={t('qcEntry.detail.applyPanelDialog.tagPlaceholder')}
                searchEnabled
                showSelectionControls
              />
              {selectedPanelIds.length > 0 && (
                <p className="text-xs text-cyan-700">
                  {t('qcEntry.detail.applyPanelDialog.selectedCount', { count: selectedPanelIds.length })}
                </p>
              )}
            </>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <DxButton
              text={t('qcEntry.detail.actions.cancel')}
              stylingMode="outlined"
              onClick={() => {
                setShowApplyPanel(false);
                setSelectedPanelIds([]);
              }}
              disabled={working}
            />
            <DxButton
              text={working ? t('qcEntry.detail.applyPanelDialog.applying') : 'Apply'}
              type="default"
              onClick={handleApplyPanel}
              disabled={working || selectedPanelIds.length === 0}
            />
          </div>
        </div>
      </DxPopup>

      {/* Add custom test dialog */}
      <DxPopup
        visible={showAddTest}
        onHiding={() => {
          if (!working) {
            setShowAddTest(false);
            setNewCriteriaId(null);
            setNewSequence(1);
          }
        }}
        title={t('qcEntry.detail.addTestDialog.title')}
        width={520}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <DxSelectBox
            label={t('qcEntry.detail.addTestDialog.criteriaLabel')}
            value={newCriteriaId}
            dataSource={availableCriteria.map((c) => ({
              id: c.id,
              label: `${c.code} — ${c.nameTh || c.name}`,
            }))}
            displayExpr="label"
            valueExpr="id"
            onValueChange={(v) => setNewCriteriaId(v == null ? null : Number(v))}
            searchEnabled
            required
          />
          <DxNumberBox
            label={t('qcEntry.detail.addTestDialog.sequenceLabel')}
            value={newSequence}
            onValueChange={(v) => setNewSequence(Number(v) || 1)}
            min={1}
            max={999}
            step={1}
            showSpinButtons
          />
          <div className="flex justify-end gap-2 pt-3 border-t">
            <DxButton
              text={t('qcEntry.detail.actions.cancel')}
              stylingMode="outlined"
              onClick={() => {
                setShowAddTest(false);
                setNewCriteriaId(null);
                setNewSequence(1);
              }}
              disabled={working}
            />
            <DxButton
              text={working ? t('qcEntry.detail.addTestDialog.adding') : t('qcEntry.detail.addTestDialog.add')}
              type="default"
              onClick={handleAddCustomTest}
              disabled={working || !newCriteriaId}
            />
          </div>
        </div>
      </DxPopup>

      {/* ─────────── Sign-off dialog (21 CFR Part 11) ─────────── */}
      <DxPopup
        visible={signRole !== null}
        onHiding={closeSignDialog}
        title={
          signRole
            ? t('qcEntry.detail.signDialog.title', { meaning: meaningForRole(signRole), role: signRole })
            : t('qcEntry.detail.signDialog.titleDefault')
        }
        width={520}
        height="auto"
        showCloseButton
        fullScreenOnMobile
      >
        <div className="p-4 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              {t('qcEntry.detail.signDialog.certifyPrefix')}{' '}
              <span className="font-semibold">
                {signRole ? meaningForRole(signRole) : ''}
              </span>{' '}
              {t('qcEntry.detail.signDialog.certifyMid')}{' '}
              <span className="font-mono">{detail?.sampleNumber}</span>
            </p>
            <p className="text-xs text-amber-700 mt-1">
              I certify that I am signing as the {signRole}{' '}
              of sample {detail?.sampleNumber}. This action is recorded with
              IP address and user-agent for the audit trail (21 CFR Part 11).
            </p>
          </div>

          <DxTextArea
            label={t('qcEntry.detail.signDialog.notesLabel')}
            labelMode="outside"
            value={signNotes}
            onValueChange={setSignNotes}
            placeholder={t('qcEntry.detail.signDialog.notesPlaceholder')}
            height={80}
            maxLength={2000}
            inputAttr={{ autoComplete: 'off', name: 'qc-sign-notes', 'data-lpignore': 'true', 'data-form-type': 'other' }}
          />

          <DxTextBox
            label={t('qcEntry.detail.signDialog.passwordLabel')}
            labelMode="outside"
            value={signPassword}
            onValueChange={setSignPassword}
            mode="password"
            placeholder={t('qcEntry.detail.signDialog.passwordPlaceholder')}
            inputAttr={{ autoComplete: 'new-password', name: 'qc-sign-password', 'data-lpignore': 'true', 'data-form-type': 'other' }}
          />
          <p className="text-[11px] text-gray-500 -mt-2">
            {t('qcEntry.detail.signDialog.passwordHint')}
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <DxButton
              text={t('qcEntry.detail.actions.cancel')}
              stylingMode="outlined"
              onClick={closeSignDialog}
              disabled={working}
            />
            <DxButton
              text={working ? t('qcEntry.detail.signDialog.signing') : 'Sign'}
              type="success"
              onClick={handleSign}
              disabled={working}
            />
          </div>
        </div>
      </DxPopup>

      {/* ─────────── Open OOS investigation dialog ─────────── */}
      <DxPopup
        visible={showOpenOos}
        onHiding={() => {
          if (!working) setShowOpenOos(false);
        }}
        title={t('qcEntry.detail.openOosDialog.title')}
        width={640}
        height="auto"
        showCloseButton
        fullScreenOnMobile
      >
        <div className="p-4 space-y-3">
          <DxSelectBox
            label={t('qcEntry.detail.openOosDialog.failedTestLabel')}
            labelMode="outside"
            value={oosTestId}
            dataSource={(detail?.tests ?? [])
              .filter((tt) => tt.resultStatus === 'fail')
              .map((tt) => ({
                id: tt.id,
                label: `#${tt.sequence} ${tt.criteriaNameTh || tt.criteriaName || `criteria#${tt.criteriaId}`} — result: ${
                  tt.numericResult != null
                    ? Number(tt.numericResult).toString()
                    : tt.textResult || ''
                }`,
              }))}
            displayExpr="label"
            valueExpr="id"
            onValueChange={(v) => setOosTestId(v == null ? null : Number(v))}
            placeholder={t('qcEntry.detail.openOosDialog.failedTestPlaceholder')}
            searchEnabled
          />
          <DxTextArea
            label="Phase 1 — Lab error hypothesis (analyst)"
            labelMode="outside"
            value={oosPhase1}
            onValueChange={setOosPhase1}
            placeholder={t('qcEntry.detail.openOosDialog.phase1Placeholder')}
            height={80}
            maxLength={4000}
          />
          <DxTextArea
            label="Phase 2 — Root cause (formal investigation)"
            labelMode="outside"
            value={oosPhase2}
            onValueChange={setOosPhase2}
            placeholder={t('qcEntry.detail.openOosDialog.phase2Placeholder')}
            height={80}
            maxLength={4000}
          />
          <DxSelectBox
            label="Classification"
            labelMode="outside"
            value={oosClassification}
            dataSource={[
              { id: 'lab_error', label: t('qcEntry.detail.openOosDialog.classLabError') },
              {
                id: 'manufacturing_error',
                label: t('qcEntry.detail.openOosDialog.classManufacturingError'),
              },
              { id: 'undetermined', label: t('qcEntry.detail.openOosDialog.classUndetermined') },
            ]}
            displayExpr="label"
            valueExpr="id"
            onValueChange={(v) =>
              setOosClassification(v == null ? null : String(v))
            }
            placeholder={t('qcEntry.detail.openOosDialog.classPlaceholder')}
          />
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">
              {t('qcEntry.detail.openOosDialog.retestAuthorized')}
            </span>
            <DxSwitch value={oosRetest} onValueChange={setOosRetest} />
          </div>
          <DxTextArea
            label={t('qcEntry.detail.openOosDialog.initialConclusionLabel')}
            labelMode="outside"
            value={oosConclusionInit}
            onValueChange={setOosConclusionInit}
            placeholder={t('qcEntry.detail.openOosDialog.initialConclusionPlaceholder')}
            height={70}
            maxLength={4000}
          />
          <div className="flex justify-end gap-2 pt-3 border-t">
            <DxButton
              text={t('qcEntry.detail.actions.cancel')}
              stylingMode="outlined"
              onClick={() => setShowOpenOos(false)}
              disabled={working}
            />
            <DxButton
              text={working ? t('qcEntry.detail.openOosDialog.opening') : t('qcEntry.detail.openOosDialog.openSubmit')}
              type="danger"
              onClick={handleOpenOos}
              disabled={working || !oosTestId}
            />
          </div>
        </div>
      </DxPopup>

      {/* ─────────── Close OOS dialog ─────────── */}
      <DxPopup
        visible={closingOosId !== null}
        onHiding={() => {
          if (!working) {
            setClosingOosId(null);
            setOosCloseConclusion('');
          }
        }}
        title={t('qcEntry.detail.closeOosDialog.title', { id: closingOosId ?? '' })}
        width={520}
        height="auto"
        showCloseButton
        fullScreenOnMobile
      >
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-700">
            {t('qcEntry.detail.closeOosDialog.instruction')}
          </p>
          <DxTextArea
            label={t('qcEntry.detail.closeOosDialog.conclusionLabel')}
            labelMode="outside"
            value={oosCloseConclusion}
            onValueChange={setOosCloseConclusion}
            placeholder={t('qcEntry.detail.closeOosDialog.conclusionPlaceholder')}
            height={120}
            maxLength={4000}
          />
          <div className="flex justify-end gap-2 pt-3 border-t">
            <DxButton
              text={t('qcEntry.detail.actions.cancel')}
              stylingMode="outlined"
              onClick={() => {
                setClosingOosId(null);
                setOosCloseConclusion('');
              }}
              disabled={working}
            />
            <DxButton
              text={working ? t('qcEntry.detail.closeOosDialog.closing') : t('qcEntry.detail.closeOosDialog.closeSubmit')}
              type="success"
              onClick={handleCloseOos}
              disabled={working || oosCloseConclusion.trim().length < 10}
            />
          </div>
        </div>
      </DxPopup>
    </>
  );
}

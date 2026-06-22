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
function readableSpecText(test: QcSampleTestRow): string | null {
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
      return `ผ่าน: ${payload.passDefinition || '—'} / ไม่ผ่าน: ${payload.failDefinition || '—'}`;
    case 'text':
      return payload.format || payload.example || raw;
    case 'multi_point':
      return `${payload.pointCount} จุด · เป้า ${payload.perPointTarget} ± ${payload.perPointTolerance}%`;
    case 'tare':
      return `${payload.referenceLabel || 'Tare'} (${payload.referenceUnit || ''})`;
    case 'calibration':
      return `สอบเทียบ ${payload.instrumentName || ''} กับ ${payload.standardValue} ${payload.standardUnit}`;
    case 'calculated':
      return payload.formula || raw;
    case 'custom_multi_field':
      return payload.fields?.map((f) => f.label).filter(Boolean).join(', ') || raw;
    default:
      return raw;
  }
}

function formatSpec(test: QcSampleTestRow): string {
  const readable = readableSpecText(test);
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
  /** Per-sample readings — used when criteria.sampleSize > 1. */
  sampleValues: Array<number | null>;
  textResult: string;
  notes: string;
  /** Recording target round (1 = first attempt, 2+ = retest). */
  testRound: number;
}

export default function QcSampleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();

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

    setEditing({
      testId: test.id,
      numericResult: isMultiSample ? null : (existingRound?.samples[0]?.numericValue ?? test.numericResult),
      sampleValues,
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
    if (isMultiSample) {
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
        toast.error('บันทึกไม่สำเร็จ', data.error || 'Unknown error');
      } else {
        const savedStatus = data.data?.resultStatus as string | undefined;
        toast.success(
          'บันทึกแล้ว',
          `Round ${editing.testRound} — Result: ${savedStatus || 'pending'}`,
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
            const savedTest = detail.tests.find((t) => t.id === savedTestId);
            const testName =
              savedTest?.criteriaNameTh || savedTest?.criteriaName || savedTest?.criteriaCode || 'การทดสอบ';
            const measured =
              editing.numericResult != null
                ? `${editing.numericResult}${savedTest?.unit ? ' ' + savedTest.unit : ''}`
                : editing.textResult || '-';
            const spec =
              savedTest?.specMin != null || savedTest?.specMax != null
                ? `เกณฑ์ ${savedTest?.specMin ?? '-'} – ${savedTest?.specMax ?? '-'}${savedTest?.unit ? ' ' + savedTest.unit : ''}`
                : savedTest?.specText || '';
            const productLabel = detail.productName ?? detail.productNameEn ?? '';
            const title = `QC ${savedStatus.toUpperCase()}: ${testName} — ${detail.sampleNumber}`;
            const description =
              `ผลตรวจ QC ${savedStatus.toUpperCase()} ของตัวอย่าง ${detail.sampleNumber}` +
              (productLabel ? ` (${productLabel})` : '') +
              `\nรายการทดสอบ: ${testName} (รอบที่ ${editing.testRound})` +
              `\nค่าที่วัดได้: ${measured}${spec ? ` — ${spec}` : ''}`;
            toast.error(
              `ผลทดสอบ ${savedStatus.toUpperCase()} — กำลังเปิดฟอร์ม Deviation`,
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
      toast.error('บันทึกไม่สำเร็จ', e instanceof Error ? e.message : 'Network error');
    } finally {
      setWorking(false);
    }
  };

  const handleDeleteTest = async (testId: number) => {
    if (!detail) return;
    if (!confirm('ลบการทดสอบนี้ใช่หรือไม่?')) return;
    setWorking(true);
    try {
      const res = await fetch(
        `/api/quality/qc-samples/${detail.id}/tests?testId=${testId}`,
        { method: 'DELETE' },
      );
      const data = await res.json();
      if (!data.success) {
        toast.error('ลบไม่สำเร็จ', data.error || 'Unknown error');
      } else {
        toast.success('ลบแล้ว');
        await fetchDetail();
      }
    } catch (e) {
      toast.error('ลบไม่สำเร็จ', e instanceof Error ? e.message : 'Network error');
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
          'Apply panel สำเร็จ',
          `เพิ่ม ${totalAdded} รายการ (ข้าม ${totalSkipped})`,
        );
        setShowApplyPanel(false);
        setSelectedPanelIds([]);
        await fetchDetail();
      } else if (totalAdded > 0) {
        toast.warning(
          `Apply สำเร็จบางส่วน — เพิ่ม ${totalAdded} ข้าม ${totalSkipped}`,
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
        toast.error('เพิ่มการทดสอบไม่สำเร็จ', data.error || 'Unknown error');
      } else {
        toast.success('เพิ่มการทดสอบแล้ว');
        setShowAddTest(false);
        setNewCriteriaId(null);
        setNewSequence(1);
        await fetchDetail();
      }
    } catch (e) {
      toast.error(
        'เพิ่มการทดสอบไม่สำเร็จ',
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
      const reason = prompt('ระบุเหตุผลในการปฏิเสธ:');
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
            // Server treats empty string as "no password supplied" — soft path.
            ...(signPassword ? { passwordReentry: signPassword } : {}),
          }),
        },
      );
      const data = await res.json();
      if (!data.success) {
        toast.error('ลงนามไม่สำเร็จ', data.error || 'Unknown error');
      } else {
        const meta = data.data?.transitionedStatus
          ? `สถานะ: ${data.data.transitionedStatus.fromStatus} → ${data.data.transitionedStatus.toStatus}`
          : 'บันทึกการลงนามแล้ว';
        toast.success('ลงนามสำเร็จ', meta);
        setSignRole(null);
        setSignNotes('');
        setSignPassword('');
        await fetchDetail();
      }
    } catch (e) {
      toast.error('ลงนามไม่สำเร็จ', e instanceof Error ? e.message : 'Network error');
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
        toast.error('เปิดสอบสวน OOS ไม่สำเร็จ', data.error || 'Unknown error');
      } else {
        toast.success(
          'เปิดสอบสวน OOS สำเร็จ',
          data.data?.deviationNumber
            ? `Auto-deviation: ${data.data.deviationNumber}`
            : `OOS #${data.data?.oosId} created`,
        );
        setShowOpenOos(false);
        await Promise.all([fetchDetail(), fetchOosList()]);
      }
    } catch (e) {
      toast.error(
        'เปิดสอบสวน OOS ไม่สำเร็จ',
        e instanceof Error ? e.message : 'Network error',
      );
    } finally {
      setWorking(false);
    }
  };

  const handleCloseOos = async () => {
    if (!closingOosId) return;
    if (oosCloseConclusion.trim().length < 10) {
      toast.error('ปิดสอบสวนไม่สำเร็จ', 'ข้อสรุปต้องยาวอย่างน้อย 10 ตัวอักษร');
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
        toast.error('ปิดสอบสวนไม่สำเร็จ', data.error || 'Unknown error');
      } else {
        toast.success('ปิดสอบสวนแล้ว');
        setClosingOosId(null);
        setOosCloseConclusion('');
        await Promise.all([fetchDetail(), fetchOosList()]);
      }
    } catch (e) {
      toast.error(
        'ปิดสอบสวนไม่สำเร็จ',
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
        toast.error('เปลี่ยนสถานะไม่สำเร็จ', data.error || 'Unknown error');
      } else {
        toast.success(
          'เปลี่ยนสถานะแล้ว',
          `${data.data?.fromStatus} → ${data.data?.toStatus}`,
        );
        await fetchDetail();
      }
    } catch (e) {
      toast.error(
        'เปลี่ยนสถานะไม่สำเร็จ',
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
              <p className="font-medium text-red-800">ไม่สามารถโหลดข้อมูลได้</p>
              <p className="text-sm text-red-700">
                {error || 'QC sample not found'}
              </p>
            </div>
            <DxButton
              text="กลับ"
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
        return 'วัตถุดิบเข้า';
      case 'work_order_batch':
        return 'ใบสั่งผลิต';
      case 'customer_return':
        return 'คืนจากลูกค้า';
      case 'stability':
        return 'Stability';
      case 'purchased_herb':
        return 'ซื้อสมุนไพร';
      case 'outgoing_shipment':
        return 'ส่งออกให้ลูกค้า';
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
                  text="กลับ"
                  icon="back"
                  stylingMode="outlined"
                  onClick={() => router.push('/quality/qc-entry')}
                />
                <DxButton
                  text="พิมพ์"
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
            title="สถานะการดำเนินงาน"
            steps={[
              { key: 'registered', label: 'ลงทะเบียน' },
              { key: 'testing', label: 'กำลังทดสอบ' },
              { key: 'reviewed', label: 'ตรวจทาน' },
              { key: 'approved', label: 'อนุมัติแล้ว' },
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
              <p className="text-xs text-gray-500 uppercase tracking-wide">สถานะ</p>
              <div className="mt-1">
                <Badge variant={sInfo.variant}>{sInfo.label}</Badge>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">วันที่รับ</p>
              <p className="mt-1 text-sm font-medium">
                {formatDateOnlyTh(detail.receivedDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">ผู้รับ</p>
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
              <p className="text-xs text-gray-500 uppercase tracking-wide">จำนวน</p>
              <p className="mt-1 text-sm font-medium">
                {detail.quantityReceived != null
                  ? `${Number(detail.quantityReceived).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${detail.unit || ''}`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">วันผลิต</p>
              <p className="mt-1 text-sm">{formatDateOnlyTh(detail.manufactureDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">วันหมดอายุ</p>
              <p className="mt-1 text-sm">{formatDateOnlyTh(detail.expiryDate)}</p>
            </div>
            {detail.customerName && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">ลูกค้า</p>
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
                  สภาพการเก็บ
                </p>
                <p className="mt-1 text-sm">{detail.storageConditions}</p>
              </div>
            )}
          </div>
          {detail.notes && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                หมายเหตุ
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
                text="เพิ่มการทดสอบ"
                icon="plus"
                stylingMode="outlined"
                onClick={() => setShowAddTest(true)}
                disabled={working}
              />
            )}
            {showStartTesting && (
              <DxButton
                text="เริ่มทดสอบ"
                icon="runner"
                type="default"
                onClick={() => handleStatusAction('start_testing')}
                disabled={working}
              />
            )}
            {showSubmitReview && (
              <DxButton
                text="ส่งทบทวน"
                icon="check"
                type="success"
                onClick={() => handleStatusAction('submit_for_review')}
                disabled={working}
              />
            )}
            {showApprove && (
              <DxButton
                text="อนุมัติ"
                icon="check"
                type="success"
                onClick={() => handleStatusAction('approve')}
                disabled={working}
              />
            )}
            {showRelease && (
              <DxButton
                text="ปล่อยใช้งาน"
                icon="check"
                type="success"
                onClick={() => handleStatusAction('release')}
                disabled={working}
              />
            )}
            {showReject && (
              <DxButton
                text="ปฏิเสธ"
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
                          ? 'ออก COA ใหม่ (Generate new COA)'
                          : 'ออก COA (Generate COA)'
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
                            toast.error(data.error || 'ออก COA ล้มเหลว');
                            return;
                          }
                          toast.success(data.message || 'ออก COA สำเร็จ');
                          if (data.data?.coaId) {
                            router.push(`/quality/coa/${data.data.coaId}`);
                          } else {
                            await fetchDetail();
                          }
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : 'ออก COA ล้มเหลว',
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
                      text={`ดู COA: ${detail.linkedCoa.coaNumber}${
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
              ผลการทดสอบ ({detail.tests.length})
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
              ยังไม่มีรายการทดสอบ — กด &quot;Apply test panel&quot; หรือ &quot;เพิ่มการทดสอบ&quot;
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {detail.tests.map((t) => {
                const isEditing = editing?.testId === t.id;
                const isReviewed = t.reviewedBy != null;
                const isExpanded = expandedTests.has(t.id);
                const hasResult =
                  t.numericResult != null ||
                  !!t.textResult ||
                  t.totalRounds > 0;
                const isPass = t.resultStatus === 'pass';
                const isFail = t.resultStatus === 'fail' || t.resultStatus === 'oos';
                const borderColor = isReviewed
                  ? 'border-l-emerald-500'
                  : isPass
                  ? 'border-l-green-400'
                  : isFail
                  ? 'border-l-red-400'
                  : 'border-l-gray-300';

                // Master-data driven recording config for this test.
                const sampleSize = Math.max(1, Number(t.criteriaSampleSize) || 1);
                const isMultiSample = sampleSize > 1;
                const tolerancePct = Number(t.criteriaTolerancePercent) || 0;
                // maxRetestRounds = number of retests allowed (separate from
                // the initial Round 1). Total possible rounds = 1 + retests.
                const maxRetestRounds = Math.max(0, Number(t.criteriaMaxRetestRounds ?? 0));
                const canRetest =
                  t.totalRounds > 0 &&
                  t.totalRounds <= maxRetestRounds &&
                  !isReviewed;

                // Live preview for the form being edited.
                let livePreview: 'pass' | 'fail' | null = null;
                if (isEditing && editing) {
                  if (isMultiSample) {
                    const filled = editing.sampleValues.filter(
                      (v): v is number => v != null && Number.isFinite(v),
                    );
                    if (filled.length === sampleSize) {
                      const failCount = filled.filter((v) =>
                        evaluateNumeric(v, t.specMin, t.specMax) === 'fail',
                      ).length;
                      const failPct = (failCount / filled.length) * 100;
                      livePreview = failPct <= tolerancePct ? 'pass' : 'fail';
                    }
                  } else {
                    livePreview = evaluateNumeric(editing.numericResult, t.specMin, t.specMax);
                  }
                }

                return (
                  <Card key={t.id} className={`border-l-4 ${borderColor}`}>
                    <CardContent className="p-4">
                      {/* Test Header Row */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(t.id)}
                            className="cursor-pointer pt-1"
                            aria-label={isExpanded ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-gray-500 font-mono">#{t.sequence}</span>
                              <span className="font-medium text-gray-900">
                                {t.criteriaNameTh || t.criteriaName || `criteria#${t.criteriaId}`}
                              </span>
                              {resultBadge(t.resultStatus)}
                              {t.criteriaCode && (
                                <span className="text-xs text-gray-500 font-mono">
                                  ({t.criteriaCode})
                                </span>
                              )}
                              {isReviewed && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                  <ShieldCheck className="h-3 w-3" /> Reviewed
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {t.testMethod && <span>{t.testMethod} · </span>}
                              <span>Spec: {formatSpec(t)}</span>
                            </div>
                            {(t.testedByName || t.reviewedByName) && (
                              <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-3">
                                {t.testedByName && (
                                  <span>
                                    ผู้บันทึก:{' '}
                                    <strong className="text-gray-700">{t.testedByName}</strong>
                                    {t.testedAt && (
                                      <span className="text-gray-400 ml-1">
                                        ({formatDateTh(t.testedAt)})
                                      </span>
                                    )}
                                  </span>
                                )}
                                {t.reviewedByName && (
                                  <span>
                                    ผู้ทบทวน:{' '}
                                    <strong className="text-emerald-700">
                                      {t.reviewedByName}
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
                              {t.numericResult != null
                                ? `${Number(t.numericResult).toLocaleString(undefined, { maximumFractionDigits: 4 })}${t.unit ? ` ${t.unit}` : ''}`
                                : t.textResult || '—'}
                            </div>
                            {t.totalRounds > 0 && (
                              <div className="text-xs text-gray-500">
                                Round {t.totalRounds}{' '}
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
                                  text="บันทึกผล"
                                  type="default"
                                  stylingMode="contained"
                                  onClick={() => handleStartEdit(t)}
                                  disabled={working}
                                />
                                {/* Delete unrecorded test rows — useful when
                                    operator picked the wrong criteria via the
                                    "เพิ่มการทดสอบ" dialog. */}
                                <DxButton
                                  icon="trash"
                                  type="danger"
                                  stylingMode="text"
                                  hint="ลบการทดสอบนี้"
                                  onClick={() => handleDeleteTest(t.id)}
                                  disabled={working}
                                />
                              </>
                            ) : (
                              <>
                                <DxButton
                                  text={`แก้ไข Round ${t.totalRounds}`}
                                  icon="edit"
                                  stylingMode="outlined"
                                  onClick={() => handleStartEdit(t, t.totalRounds || 1)}
                                  disabled={working}
                                />
                                {canRetest && (
                                  <DxButton
                                    text={`+ Round ${t.totalRounds + 1}`}
                                    type="normal"
                                    stylingMode="outlined"
                                    hint={`บันทึกรอบใหม่ (สูงสุด ${maxRetestRounds} รอบ)`}
                                    onClick={() => handleStartEdit(t, t.totalRounds + 1)}
                                    disabled={working}
                                  />
                                )}
                                <DxButton
                                  icon="trash"
                                  type="danger"
                                  stylingMode="text"
                                  hint="ลบการทดสอบนี้"
                                  onClick={() => handleDeleteTest(t.id)}
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
                          {t.rounds.length > 0 && (
                            <div className="space-y-2">
                              {t.rounds.map((round) => (
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
                                        {t.unit ? ` ${t.unit}` : ''}
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
                          {t.notes && (
                            <div>
                              <span className="font-medium">หมายเหตุ:</span> {t.notes}
                            </div>
                          )}
                          {!t.notes && !hasResult && (
                            <p className="text-gray-400">ยังไม่มีผลการทดสอบ</p>
                          )}
                          {/* Audit Q4 — attach analytical report / COA per QC test */}
                          <div className="pt-2">
                            <AttachmentPanel
                              moduleName="quality_test"
                              entityId={t.id}
                              defaultCategory="lab_result"
                              title="เอกสารผลวิเคราะห์ (COA / Report)"
                              testIdBase={`qc-test-attach-${t.id}`}
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
                                (ทดสอบรอบที่ {editing.testRound} จากสูงสุด {maxRetestRounds})
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
                              {formatSpec(t)}
                            </div>
                            {t.testMethod && (
                              <div className="text-xs text-gray-500 mt-1">
                                Method: {t.testMethod}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 mt-1">
                              ตัวอย่าง: <strong>{sampleSize}</strong>
                              {tolerancePct > 0 && (
                                <> · Tolerance: <strong>±{tolerancePct}%</strong></>
                              )}
                            </div>
                          </div>

                          {/* Multi-sample numeric grid (sampleSize > 1) */}
                          {isMultiSample && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                ผลการทดสอบ ({sampleSize} ตัวอย่าง){t.unit ? ` — หน่วย ${t.unit}` : ''}
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
                                ผลการทดสอบ (ตัวเลข) {t.unit ? `(${t.unit})` : ''}
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
                                หรือผลแบบข้อความ (ถ้าไม่ใช่ตัวเลข)
                              </label>
                              <DxTextBox
                                value={editing.textResult}
                                onValueChange={(v) =>
                                  setEditing(
                                    editing ? { ...editing, textResult: v } : editing,
                                  )
                                }
                                placeholder="เช่น Pass, ใส, สีเหลืองอ่อน"
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
                                    v != null && evaluateNumeric(v, t.specMin, t.specMax) === 'pass',
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
                                  ผ่าน {passCount}/{filled} ตัวอย่าง
                                  {filled > 0 && ` (${(100 - failPct).toFixed(0)}%)`}
                                </span>
                                <span className="text-xs">
                                  {!allFilled
                                    ? `กรอก ${filled}/${total}`
                                    : `Tolerance ±${tolerancePct}% — ${overallPass ? 'PASS' : 'FAIL'}`}
                                </span>
                              </div>
                            );
                          })()}

                          {/* Notes */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              หมายเหตุ
                            </label>
                            <DxTextArea
                              value={editing.notes}
                              onValueChange={(v) =>
                                setEditing(editing ? { ...editing, notes: v } : editing)
                              }
                              placeholder="ระบุข้อสังเกต / เงื่อนไขการทดสอบ"
                              height={60}
                            />
                          </div>

                          {/* Actions */}
                          <div className="flex items-center justify-end gap-2">
                            <DxButton
                              text="ยกเลิก"
                              stylingMode="text"
                              onClick={handleCancelEdit}
                              disabled={working}
                            />
                            <DxButton
                              text={working ? 'กำลังบันทึก...' : 'บันทึก'}
                              type="success"
                              stylingMode="contained"
                              onClick={handleSaveEdit}
                              disabled={(() => {
                                if (working) return true;
                                // Multi-sample: every input must be filled
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
            { role: 'analyst', label: 'Tested by / ผู้ทดสอบ', sig: analystSig, canSign: canSignAnalyst },
            { role: 'reviewer', label: 'Reviewed by / ผู้ทบทวน', sig: reviewerSig, canSign: canSignReviewer },
            { role: 'approver', label: 'Approved by / ผู้อนุมัติ', sig: approverSig, canSign: canSignApprover },
            { role: 'qa_release', label: 'Released by / QA ปล่อยใช้งาน', sig: releaseSig, canSign: canSignRelease },
          ];

          return (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 print:hidden">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-semibold text-gray-700">
                  การลงนาม / Sign-off (21 CFR Part 11)
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
                        <p className="mt-0.5 text-sm text-gray-400">— ยังไม่ลงนาม</p>
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
                  สอบสวน OOS / Out-of-Spec Investigation
                </h2>
              </div>
              <DxButton
                text="+ เปิดสอบสวน OOS"
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
                {detail.tests.some((t) => t.resultStatus === 'fail')
                  ? 'มีผลทดสอบที่ไม่ผ่านเกณฑ์ — กด "เปิดสอบสวน OOS" เพื่อเริ่ม phase 1/2'
                  : 'ยังไม่มีผลทดสอบที่ไม่ผ่าน — ไม่จำเป็นต้องเปิด OOS'}
              </p>
            ) : (
              <div className="space-y-2">
                {oosList.map((oos) => {
                  const failedTest = detail.tests.find(
                    (t) => t.id === oos.sampleTestId,
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
                            ทดสอบ:{' '}
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
                            text="ปิดสอบสวน"
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
                        เปิดโดย {oos.initiatedByName ?? `user#${oos.initiatedBy}`} ·{' '}
                        {formatDateTh(oos.initiatedAt)}
                        {oos.closedAt && (
                          <>
                            {' '}— ปิดโดย {oos.closedByName ?? `user#${oos.closedBy}`} ·{' '}
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
              ไม่มี test panel ที่กำหนดสำหรับสินค้านี้ — ไปสร้างที่ <a className="text-cyan-600 hover:underline" href="/quality/test-panels">/quality/test-panels</a>
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-700">
                เลือก panel-row ที่จะ apply เข้าสู่ตัวอย่างนี้
                <span className="text-xs text-gray-500"> (เลือกได้หลายรายการ)</span>:
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
                placeholder="เลือก panel"
                searchEnabled
                showSelectionControls
              />
              {selectedPanelIds.length > 0 && (
                <p className="text-xs text-cyan-700">
                  เลือกแล้ว <strong>{selectedPanelIds.length}</strong> panel — ระบบจะ apply
                  ทุก panel เข้าตัวอย่างนี้
                </p>
              )}
            </>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <DxButton
              text="ยกเลิก"
              stylingMode="outlined"
              onClick={() => {
                setShowApplyPanel(false);
                setSelectedPanelIds([]);
              }}
              disabled={working}
            />
            <DxButton
              text={working ? 'กำลัง apply...' : 'Apply'}
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
        title="เพิ่มการทดสอบ"
        width={520}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <DxSelectBox
            label="เกณฑ์ (IPC criteria)"
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
            label="ลำดับการแสดงผล"
            value={newSequence}
            onValueChange={(v) => setNewSequence(Number(v) || 1)}
            min={1}
            max={999}
            step={1}
            showSpinButtons
          />
          <div className="flex justify-end gap-2 pt-3 border-t">
            <DxButton
              text="ยกเลิก"
              stylingMode="outlined"
              onClick={() => {
                setShowAddTest(false);
                setNewCriteriaId(null);
                setNewSequence(1);
              }}
              disabled={working}
            />
            <DxButton
              text={working ? 'กำลังเพิ่ม...' : 'เพิ่ม'}
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
            ? `ลงนาม — ${meaningForRole(signRole)} (${signRole})`
            : 'ลงนาม'
        }
        width={520}
        height="auto"
        showCloseButton
        fullScreenOnMobile
      >
        <div className="p-4 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              ฉันยืนยันว่าฉันเป็นผู้ลงนามในฐานะ{' '}
              <span className="font-semibold">
                {signRole ? meaningForRole(signRole) : ''}
              </span>{' '}
              ของตัวอย่าง{' '}
              <span className="font-mono">{detail?.sampleNumber}</span>
            </p>
            <p className="text-xs text-amber-700 mt-1">
              I certify that I am signing as the {signRole}{' '}
              of sample {detail?.sampleNumber}. This action is recorded with
              IP address and user-agent for the audit trail (21 CFR Part 11).
            </p>
          </div>

          <DxTextArea
            label="หมายเหตุ / Notes (optional)"
            labelMode="outside"
            value={signNotes}
            onValueChange={setSignNotes}
            placeholder="เช่น: ตรวจซ้ำตัวอย่างหมายเลข ... และอ่านค่าตรงกัน"
            height={80}
            maxLength={2000}
          />

          <DxTextBox
            label="รหัสผ่าน / Password re-entry (optional)"
            labelMode="outside"
            value={signPassword}
            onValueChange={setSignPassword}
            mode="password"
            placeholder="ระบุรหัสผ่านเพื่อยืนยันตัวตน"
          />
          <p className="text-[11px] text-gray-500 -mt-2">
            ปล่อยว่างได้ในช่วงทดสอบระบบ — เมื่อ enforced บัญชีต้องมี bcrypt hash
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <DxButton
              text="ยกเลิก"
              stylingMode="outlined"
              onClick={closeSignDialog}
              disabled={working}
            />
            <DxButton
              text={working ? 'กำลังลงนาม...' : 'Sign'}
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
        title="เปิดสอบสวน OOS (FDA 21 CFR 211.192)"
        width={640}
        height="auto"
        showCloseButton
        fullScreenOnMobile
      >
        <div className="p-4 space-y-3">
          <DxSelectBox
            label="ทดสอบที่ไม่ผ่าน (failed test) *"
            labelMode="outside"
            value={oosTestId}
            dataSource={(detail?.tests ?? [])
              .filter((t) => t.resultStatus === 'fail')
              .map((t) => ({
                id: t.id,
                label: `#${t.sequence} ${t.criteriaNameTh || t.criteriaName || `criteria#${t.criteriaId}`} — result: ${
                  t.numericResult != null
                    ? Number(t.numericResult).toString()
                    : t.textResult || ''
                }`,
              }))}
            displayExpr="label"
            valueExpr="id"
            onValueChange={(v) => setOosTestId(v == null ? null : Number(v))}
            placeholder="เลือกทดสอบที่ไม่ผ่าน"
            searchEnabled
          />
          <DxTextArea
            label="Phase 1 — Lab error hypothesis (analyst)"
            labelMode="outside"
            value={oosPhase1}
            onValueChange={setOosPhase1}
            placeholder="เช่น: เครื่องมือวัดสอบเทียบหรือไม่? วิธีการเตรียมตัวอย่างถูกต้องหรือไม่?"
            height={80}
            maxLength={4000}
          />
          <DxTextArea
            label="Phase 2 — Root cause (formal investigation)"
            labelMode="outside"
            value={oosPhase2}
            onValueChange={setOosPhase2}
            placeholder="ผลการสืบสวนเชิงลึก เมื่อ Phase 1 ไม่พบสาเหตุจาก lab"
            height={80}
            maxLength={4000}
          />
          <DxSelectBox
            label="Classification"
            labelMode="outside"
            value={oosClassification}
            dataSource={[
              { id: 'lab_error', label: 'Lab Error — สาเหตุจากห้องปฏิบัติการ' },
              {
                id: 'manufacturing_error',
                label: 'Manufacturing Error — สาเหตุจากการผลิต (auto-creates Deviation)',
              },
              { id: 'undetermined', label: 'Undetermined — ระบุไม่ได้' },
            ]}
            displayExpr="label"
            valueExpr="id"
            onValueChange={(v) =>
              setOosClassification(v == null ? null : String(v))
            }
            placeholder="ยังไม่ระบุ — ระบุภายหลังก็ได้"
          />
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">
              อนุญาตให้ทดสอบซ้ำ (Retest authorized)
            </span>
            <DxSwitch value={oosRetest} onValueChange={setOosRetest} />
          </div>
          <DxTextArea
            label="ข้อสรุปเบื้องต้น / Initial conclusion (optional)"
            labelMode="outside"
            value={oosConclusionInit}
            onValueChange={setOosConclusionInit}
            placeholder="เพิ่มเติมภายหลังเมื่อปิดสอบสวนได้"
            height={70}
            maxLength={4000}
          />
          <div className="flex justify-end gap-2 pt-3 border-t">
            <DxButton
              text="ยกเลิก"
              stylingMode="outlined"
              onClick={() => setShowOpenOos(false)}
              disabled={working}
            />
            <DxButton
              text={working ? 'กำลังเปิด...' : 'เปิดสอบสวน'}
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
        title={`ปิดสอบสวน OOS #${closingOosId ?? ''}`}
        width={520}
        height="auto"
        showCloseButton
        fullScreenOnMobile
      >
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-700">
            ระบุข้อสรุปการสอบสวน — ต้องอย่างน้อย 10 ตัวอักษร (FDA 211.192)
          </p>
          <DxTextArea
            label="ข้อสรุป / Conclusion *"
            labelMode="outside"
            value={oosCloseConclusion}
            onValueChange={setOosCloseConclusion}
            placeholder="เช่น: หลังตรวจซ้ำพบว่าผลของวันแรกผิดพลาดจาก calibration ของเครื่องมือ ..."
            height={120}
            maxLength={4000}
          />
          <div className="flex justify-end gap-2 pt-3 border-t">
            <DxButton
              text="ยกเลิก"
              stylingMode="outlined"
              onClick={() => {
                setClosingOosId(null);
                setOosCloseConclusion('');
              }}
              disabled={working}
            />
            <DxButton
              text={working ? 'กำลังปิด...' : 'ปิดสอบสวน'}
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

'use client';

/**
 * Work Order In-Process Control (IPC) Page
 * Checklist + inline recording of IPC tests during production
 * Tests are defined in BOM config and initialized per work order
 */

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader, AwaitingOtherVerifierBadge } from '@/components/shared';
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
} from 'lucide-react';
import { parseAcceptanceStages, calcStageAcceptance, type AcceptanceStage } from '@/lib/master-data/ipc-stages';

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
    ? '✕ Reject Batch ถ้าไม่ผ่าน'
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
  testName: string | null;
  testMethod: string | null;
  testedByName: string | null;
  approvedByName: string | null;
  samples: IPCSample[];
  rounds: IPCRound[];
  totalRounds: number;
}

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
}

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
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useTranslations('production');
  const tc = useTranslations('common');

  const workOrderId = Number(params.id);

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

  // Fetch work order basic info
  const { data: workOrder } = useQuery<WorkOrderBasic>({
    queryKey: ['work-order', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/detail`);
      const data = await res.json();
      return data.data?.workOrder;
    },
  });

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
      samples?: Array<{ sampleNumber: number; numericValue?: number; result?: string }>;
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

    // Phase 3: use stage-specific sample size when multi-stage; fall back to test-level
    const sampleSize = getEffectiveSampleSize(test, nextRound);
    const criteriaType = test.criteriaType || 'numeric';

    const roundSamples = test.rounds?.find((r) => r.round === nextRound)?.samples || [];

    if (criteriaType === 'checkbox') {
      const results = Array.from({ length: sampleSize }, (_, i) => {
        const sample = roundSamples.find((s) => s.sampleNumber === i + 1);
        return (sample?.result as 'pass' | 'fail' | null) ?? null;
      });
      setCheckboxResults(results);
      setSampleValues([]);
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

    if (criteriaType === 'checkbox') {
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

  // Progress calculations
  const totalTests = ipcTests?.length || 0;
  const completedTests = ipcTests?.filter((t) => t.status === 'pass' || t.status === 'fail').length || 0;
  const approvedTests = ipcTests?.filter((t) => t.approvedBy != null).length || 0;
  const progressPercent = totalTests > 0 ? Math.round((completedTests / totalTests) * 100) : 0;
  const hasTests = totalTests > 0;
  const hasBOMConfig = (bomConfig?.length || 0) > 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <ResponsivePageHeader
        title={t('execution.ipc')}
        subtitle={workOrder ? `${workOrder.woNumber} - ${workOrder.batchNumber}` : ''}
        icon={FlaskConical}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        onBack={() => router.push(`/production/work-orders/${workOrderId}/execution`)}
      />

      {/* Progress Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium text-gray-700">
                {t('execution.ipcProgress')}
              </div>
              <span className="text-sm text-gray-500">
                {completedTests}/{totalTests} {t('execution.testsCompleted')}
              </span>
              {approvedTests > 0 && (
                <span className="text-sm text-emerald-600">
                  <ShieldCheck className="h-3.5 w-3.5 inline mr-1" />
                  {approvedTests} {t('execution.approved')}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {!hasTests && hasBOMConfig && (
                <DxButton
                  text={t('execution.initializeIPCTests')}
                  type="default"
                  stylingMode="contained"
                  onClick={() => initMutation.mutate()}
                  disabled={initMutation.isPending}
                />
              )}
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${
                progressPercent === 100 ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

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

      {/* IPC Test Checklist */}
      {hasTests && (
        <div className="space-y-3">
          {ipcTests!.map((test) => {
            const isExpanded = expandedTests.has(test.id);
            const hasSamples = (test.sampleSize || 1) > 1;
            const isRecorded = test.status !== 'pending';
            const isApproved = test.approvedBy != null;

            return (
              <Card key={test.id} className={`border-l-4 ${
                isApproved ? 'border-l-emerald-500' :
                test.status === 'pass' ? 'border-l-green-400' :
                test.status === 'fail' ? 'border-l-red-400' :
                'border-l-gray-300'
              }`}>
                <CardContent className="p-4">
                  {/* Test Header Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className="cursor-pointer"
                        onClick={() => toggleExpanded(test.id)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">
                            {test.testName || `Test #${test.id}`}
                          </span>
                          <StatusBadge status={test.status} />
                          {test.totalRounds > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              Round {test.totalRounds}
                            </span>
                          )}
                          {(() => {
                            const stages = parseAcceptanceStages(test.acceptanceStages);
                            return stages.length > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                <Layers className="h-3 w-3" /> Multi-Stage ({stages.length})
                              </span>
                            );
                          })()}
                          {isApproved && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                              <ShieldCheck className="h-3 w-3" /> {t('execution.approved')}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {test.testMethod && <span>{test.testMethod} · </span>}
                          {test.specMinValue != null && test.specMaxValue != null && (
                            <span>
                              {t('execution.range')}: {test.specMinValue} - {test.specMaxValue}
                              {test.specUnit ? ` ${test.specUnit}` : ''}
                            </span>
                          )}
                          {test.specSpecification && !test.specMinValue && (
                            <span>{t('execution.spec')}: {test.specSpecification}</span>
                          )}
                          {hasSamples && (
                            <span> · {test.sampleSize} {t('execution.samples')}</span>
                          )}
                        </div>
                        {/* Tester/Approver names on card header */}
                        {(test.testedByName || test.approvedByName) && (
                          <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-3">
                            {test.testedByName && (
                              <span>ผู้บันทึก: <strong className="text-gray-700">{test.testedByName}</strong></span>
                            )}
                            {test.approvedByName && (
                              <span>ผู้อนุมัติ: <strong className="text-emerald-700">{test.approvedByName}</strong></span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Result display */}
                    {isRecorded && (
                      <div className="text-right mr-4">
                        <div className="text-sm font-medium">
                          {test.numericResult != null
                            ? `${Number(test.numericResult).toFixed(2)}${test.specUnit ? ` ${test.specUnit}` : ''}`
                            : test.result || '-'}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {!isRecorded && (
                        <DxButton
                          text={t('execution.record')}
                          type="default"
                          stylingMode="contained"
                          onClick={() => openInlineRecord(test)}
                          disabled={workOrder?.status === 'completed'}
                        />
                      )}
                      {isRecorded && (
                        <DxButton
                          text={`+ Round ${(test.totalRounds || 0) + 1}`}
                          type="normal"
                          stylingMode="outlined"
                          onClick={() => openInlineRecord(test)}
                          disabled={workOrder?.status === 'completed' || isApproved}
                        />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details — grouped by round */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t">
                      {/* Round-by-round results */}
                      {test.rounds && test.rounds.length > 0 ? (
                        <div className="space-y-3">
                          {test.rounds.map((round) => (
                            <div key={round.round} className="border rounded-lg p-3 bg-gray-50/50">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-800">
                                    Round {round.round}
                                  </span>
                                  <StatusBadge status={round.result} />
                                  {round.isApproved && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                      <ShieldCheck className="h-3 w-3" /> Approved
                                    </span>
                                  )}
                                  {round.avg != null && (
                                    <span className="text-xs text-gray-500">
                                      Avg: <strong>{round.avg.toFixed(2)}</strong>{test.specUnit ? ` ${test.specUnit}` : ''}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {!round.isApproved && (
                                    <button
                                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                                      onClick={() => openInlineRecord(test, round.round)}
                                    >
                                      แก้ไข
                                    </button>
                                  )}
                                  {!round.isApproved && (
                                    currentUser?.id && test.testedBy === currentUser.id ? (
                                      <AwaitingOtherVerifierBadge label="รอ QA ตรวจสอบ" />
                                    ) : (
                                      <DxButton
                                        text="Approve"
                                        type="success"
                                        stylingMode="outlined"
                                        onClick={() => approveMutation.mutate({
                                          qualityTestId: test.id,
                                          testRound: round.round,
                                        })}
                                        disabled={approveMutation.isPending}
                                      />
                                    )
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
                                {round.samples.map((sample) => (
                                  <div
                                    key={sample.id}
                                    className={`text-center p-1.5 rounded text-xs ${
                                      sample.result === 'pass'
                                        ? 'bg-green-50 text-green-700'
                                        : sample.result === 'fail'
                                        ? 'bg-red-50 text-red-700'
                                        : 'bg-gray-50 text-gray-600'
                                    }`}
                                  >
                                    <div className="font-medium">#{sample.sampleNumber}</div>
                                    <div>
                                      {sample.numericValue != null
                                        ? Number(sample.numericValue).toFixed(2)
                                        : sample.result === 'pass' ? 'Pass'
                                        : sample.result === 'fail' ? 'Fail'
                                        : sample.textValue || '-'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">ยังไม่มีผลการทดสอบ</p>
                      )}

                      {/* Notes */}
                      {test.notes && (
                        <div className="text-xs text-gray-600 mt-2">
                          <span className="font-medium">{t('execution.notes')}:</span> {test.notes}
                        </div>
                      )}

                      {/* Tester and approver info */}
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-2">
                        {test.testedByName && (
                          <span>ผู้บันทึก: <strong className="text-gray-700">{test.testedByName}</strong></span>
                        )}
                        {test.testDate && (
                          <span>วันที่บันทึก: {new Date(test.testDate).toLocaleString('th-TH')}</span>
                        )}
                        {test.approvedByName && (
                          <span>ผู้อนุมัติ: <strong className="text-emerald-700">{test.approvedByName}</strong></span>
                        )}
                        {test.approvedAt && (
                          <span>วันที่อนุมัติ: {new Date(test.approvedAt).toLocaleString('th-TH')}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Inline Record Form */}
                  {selectedTest?.id === test.id && !isApproved && (
                    <div className="mt-3 pt-3 border-t border-emerald-200 bg-emerald-50/50 rounded-lg p-3 space-y-3">
                      {/* Round indicator */}
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                          Round {recordRound}
                        </span>
                        {recordRound > 1 && (
                          <span className="text-xs text-gray-500">
                            (ทดสอบรอบที่ {recordRound})
                          </span>
                        )}
                      </div>

                      {/* Phase 3: stage info for current round */}
                      <StageInfoBanner test={test} round={recordRound} />

                      {/* Spec info */}
                      {(test.specMinValue != null || test.specSpecification) && (
                        <div className="text-xs text-blue-700 bg-blue-50 rounded p-2">
                          {test.specMinValue != null && test.specMaxValue != null && (
                            <span>{t('execution.range')}: {test.specMinValue} - {test.specMaxValue}{test.specUnit ? ` ${test.specUnit}` : ''}</span>
                          )}
                          {test.specSpecification && <span> | {test.specSpecification}</span>}
                        </div>
                      )}

                      {/* Single value input */}
                      {test.criteriaType !== 'checkbox' && getEffectiveSampleSize(test, recordRound) <= 1 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('execution.measuredValue')} {test.specUnit ? `(${test.specUnit})` : ''}
                          </label>
                          <DxNumberBox
                            value={numericResult}
                            onValueChanged={(e) => setNumericResult(e.value)}
                            placeholder="0.00"
                          />
                        </div>
                      )}

                      {/* Multi-sample inputs */}
                      {test.criteriaType !== 'checkbox' && getEffectiveSampleSize(test, recordRound) > 1 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('execution.sampleValues')} ({getEffectiveSampleSize(test, recordRound)} {t('execution.samples')})
                          </label>
                          <div className="grid grid-cols-5 gap-2">
                            {sampleValues.map((val, idx) => {
                              const prevFilled = idx === 0 || sampleValues[idx - 1] != null;
                              return (
                                <div key={idx} className={!prevFilled ? 'opacity-40' : ''}>
                                  <label className="block text-xs text-gray-500 mb-0.5">#{idx + 1}</label>
                                  <DxNumberBox
                                    value={val}
                                    onValueChanged={(e) => {
                                      const next = [...sampleValues];
                                      next[idx] = e.value;
                                      setSampleValues(next);
                                    }}
                                    placeholder="0.00"
                                    disabled={!prevFilled}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Checkbox mode inputs */}
                      {(test.criteriaType === 'checkbox') && (
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                              ผลการตรวจ ({test.sampleSize} ตัวอย่าง)
                            </label>
                            <div className="flex gap-2" data-testid="ipc-bulk-actions">
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm"
                                onClick={() => {
                                  setCheckboxResults(Array(test.sampleSize || 1).fill('pass'));
                                }}
                                title="ทำเครื่องหมายผ่านทั้งหมด"
                                data-testid="ipc-pass-all"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                ผ่านทั้งหมด
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm"
                                onClick={() => {
                                  setCheckboxResults(Array(test.sampleSize || 1).fill('fail'));
                                }}
                                title="ทำเครื่องหมายไม่ผ่านทั้งหมด"
                                data-testid="ipc-fail-all"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                ไม่ผ่านทั้งหมด
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors border border-gray-300"
                                onClick={() => {
                                  setCheckboxResults(Array(test.sampleSize || 1).fill(null));
                                }}
                                title="ล้างค่าทั้งหมด"
                                data-testid="ipc-clear-all"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                ล้างค่า
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-5 gap-2">
                            {checkboxResults.map((val, idx) => {
                              // Bulk-fill removes sequential requirement; allow editing any sample once bulk action applied
                              const anyFilled = checkboxResults.some((r) => r != null);
                              const prevFilled = idx === 0 || checkboxResults[idx - 1] != null || anyFilled;
                              return (
                                <div key={idx} className={`text-center ${!prevFilled ? 'opacity-40 pointer-events-none' : ''}`}>
                                  <label className="block text-xs text-gray-500 mb-0.5">#{idx + 1}</label>
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      disabled={!prevFilled}
                                      className={`flex-1 px-1 py-1.5 rounded text-xs font-medium transition-colors ${
                                        val === 'pass'
                                          ? 'bg-green-500 text-white'
                                          : 'bg-gray-100 text-gray-500 hover:bg-green-100'
                                      } disabled:cursor-not-allowed`}
                                      onClick={() => {
                                        const next = [...checkboxResults];
                                        next[idx] = 'pass';
                                        setCheckboxResults(next);
                                      }}
                                    >
                                      Pass
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!prevFilled}
                                      className={`flex-1 px-1 py-1.5 rounded text-xs font-medium transition-colors ${
                                        val === 'fail'
                                          ? 'bg-red-500 text-white'
                                          : 'bg-gray-100 text-gray-500 hover:bg-red-100'
                                      } disabled:cursor-not-allowed`}
                                      onClick={() => {
                                        const next = [...checkboxResults];
                                        next[idx] = 'fail';
                                        setCheckboxResults(next);
                                      }}
                                    >
                                      Fail
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Summary bar — real-time pass/fail preview */}
                      {(() => {
                        const criteriaType = test.criteriaType || 'numeric';
                        const tolerancePct = Number(test.tolerancePercent) || 0;
                        let passCount = 0;
                        let totalCount = 0;

                        if (criteriaType === 'checkbox') {
                          const filled = checkboxResults.filter((r) => r != null);
                          totalCount = filled.length;
                          passCount = filled.filter((r) => r === 'pass').length;
                        } else if ((test.sampleSize || 1) > 1) {
                          const filled = sampleValues.filter((v) => v != null);
                          totalCount = filled.length;
                          passCount = filled.filter((v) =>
                            v != null && test.specMinValue != null && test.specMaxValue != null &&
                            v >= Number(test.specMinValue) && v <= Number(test.specMaxValue)
                          ).length;
                        }

                        if (totalCount === 0) return null;

                        const failCount = totalCount - passCount;
                        const failPct = (failCount / totalCount) * 100;
                        const overallPass = failPct <= tolerancePct;

                        return (
                          <div className={`flex items-center justify-between p-2 rounded text-sm font-medium ${
                            overallPass ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                          }`}>
                            <span>
                              ผ่าน {passCount}/{totalCount} ตัวอย่าง ({(100 - failPct).toFixed(0)}%)
                            </span>
                            <span className="text-xs">
                              Tolerance: ±{tolerancePct}% — {overallPass ? 'PASS' : 'FAIL'}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Notes */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('execution.notes')}</label>
                        <DxTextArea
                          value={recordNotes}
                          onValueChanged={(e) => setRecordNotes(e.value)}
                          placeholder={t('execution.notesPlaceholder')}
                          height={60}
                        />
                      </div>

                      {/* Actions */}
                      {(() => {
                        const criteriaType = test.criteriaType || 'numeric';
                        const ss = test.sampleSize || 1;
                        let allFilled = false;
                        if (criteriaType === 'checkbox') {
                          allFilled = checkboxResults.length === ss && checkboxResults.every(r => r != null);
                        } else if (ss > 1) {
                          allFilled = sampleValues.length === ss && sampleValues.every(v => v != null);
                        } else {
                          allFilled = numericResult != null;
                        }
                        const filledCount = criteriaType === 'checkbox'
                          ? checkboxResults.filter(r => r != null).length
                          : ss > 1 ? sampleValues.filter(v => v != null).length
                          : numericResult != null ? 1 : 0;
                        return (
                          <div className="flex items-center justify-between gap-2">
                            {!allFilled && ss > 1 && (
                              <span className="text-xs text-amber-600">
                                <AlertTriangle className="h-3 w-3 inline mr-1" />
                                กรอกผลแล้ว {filledCount}/{ss} ตัวอย่าง — ต้องกรอกครบทุกตัวอย่างจึงจะบันทึกได้
                              </span>
                            )}
                            {allFilled && <span />}
                            <div className="flex gap-2">
                              <DxButton text={tc('actions.cancel')} stylingMode="text" onClick={resetForm} />
                              <DxButton
                                text={recordMutation.isPending ? tc('actions.saving') : tc('actions.save')}
                                type="default"
                                stylingMode="text"
                                onClick={handleSaveRecord}
                                disabled={recordMutation.isPending || !allFilled}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Popup removed — inline recording is used instead */}
    </div>
  );
}

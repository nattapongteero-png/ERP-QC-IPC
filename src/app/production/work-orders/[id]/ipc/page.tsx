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
import { ResponsivePageHeader } from '@/components/shared';
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
} from 'lucide-react';

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
  testName: string | null;
  testMethod: string | null;
  testedByName: string | null;
  approvedByName: string | null;
  samples: IPCSample[];
}

interface IPCSample {
  id: number;
  qualityTestId: number;
  sampleNumber: number;
  numericValue: number | null;
  textValue: string | null;
  result: string | null;
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

  const workOrderId = Number(params.id);

  // Inline record state
  const [selectedTest, setSelectedTest] = useState<IPCTest | null>(null);
  const [numericResult, setNumericResult] = useState<number | undefined>(undefined);
  const [sampleValues, setSampleValues] = useState<(number | undefined)[]>([]);
  const [recordNotes, setRecordNotes] = useState('');
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
      samples?: Array<{ sampleNumber: number; numericValue?: number }>;
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

  // Approve test
  const approveMutation = useMutation({
    mutationFn: async (data: { qualityTestId: number; disposition?: string }) => {
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
    setSelectedTest(null);
  }

  function openInlineRecord(test: IPCTest) {
    setSelectedTest(test);
    setNumericResult(test.numericResult ?? undefined);
    setRecordNotes(test.notes || '');

    const sampleSize = test.sampleSize || 1;
    if (sampleSize > 1) {
      const existing = test.samples || [];
      const values = Array.from({ length: sampleSize }, (_, i) => {
        const sample = existing.find((s) => s.sampleNumber === i + 1);
        return sample?.numericValue ?? undefined;
      });
      setSampleValues(values);
    } else {
      setSampleValues([]);
    }
  }

  function handleSaveRecord() {
    if (!selectedTest) return;

    const sampleSize = selectedTest.sampleSize || 1;

    if (sampleSize > 1) {
      // Multi-sample: submit samples array
      const samples = sampleValues.map((v, i) => ({
        sampleNumber: i + 1,
        numericValue: v,
      }));
      recordMutation.mutate({
        qualityTestId: selectedTest.id,
        notes: recordNotes || undefined,
        samples,
      });
    } else {
      // Single value
      recordMutation.mutate({
        qualityTestId: selectedTest.id,
        numericResult,
        notes: recordNotes || undefined,
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
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {test.testName || `Test #${test.id}`}
                          </span>
                          <StatusBadge status={test.status} />
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
                      {!isApproved && (
                        <DxButton
                          text={isRecorded ? t('actions.edit') : t('execution.record')}
                          type={isRecorded ? 'normal' : 'default'}
                          stylingMode={isRecorded ? 'outlined' : 'contained'}
                          onClick={() => openInlineRecord(test)}
                          disabled={workOrder?.status === 'completed'}
                        />
                      )}
                      {isRecorded && !isApproved && (
                        <DxButton
                          text={t('execution.approve')}
                          type="success"
                          stylingMode="outlined"
                          onClick={() => approveMutation.mutate({ qualityTestId: test.id })}
                          disabled={approveMutation.isPending}
                        />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t">
                      {/* Sample results table */}
                      {hasSamples && test.samples.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs font-medium text-gray-600 mb-1">
                            {t('execution.sampleResults')}
                          </div>
                          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
                            {test.samples.map((sample) => (
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
                                <div>{sample.numericValue != null ? Number(sample.numericValue).toFixed(2) : sample.textValue || '-'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {test.notes && (
                        <div className="text-xs text-gray-600">
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
                      {(test.sampleSize || 1) <= 1 && (
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
                      {(test.sampleSize || 1) > 1 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('execution.sampleValues')} ({test.sampleSize} {t('execution.samples')})
                          </label>
                          <div className="grid grid-cols-5 gap-2">
                            {sampleValues.map((val, idx) => (
                              <div key={idx}>
                                <label className="block text-xs text-gray-500 mb-0.5">#{idx + 1}</label>
                                <DxNumberBox
                                  value={val}
                                  onValueChanged={(e) => {
                                    const next = [...sampleValues];
                                    next[idx] = e.value;
                                    setSampleValues(next);
                                  }}
                                  placeholder="0.00"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

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
                      <div className="flex justify-end gap-2">
                        <DxButton text={t('actions.cancel')} stylingMode="text" onClick={resetForm} />
                        <DxButton
                          text={recordMutation.isPending ? t('actions.saving') : t('actions.save')}
                          type="success"
                          onClick={handleSaveRecord}
                          disabled={recordMutation.isPending}
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

      {/* Popup removed — inline recording is used instead */}
    </div>
  );
}

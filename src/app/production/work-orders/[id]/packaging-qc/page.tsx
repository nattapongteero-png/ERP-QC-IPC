'use client';

/**
 * Work Order Packaging QC Page — Single-Mode Design
 *
 * URL ?tab=weight   → Weight Control only (indigo theme)
 * URL ?tab=integrity → Integrity Check only (purple theme)
 *
 * Each mode is its own focused page: hero banner, KPI stats row,
 * card-based record list, modern dialog. The two are no longer
 * cohabiting tabs — clicking from the dashboard lands directly
 * on the relevant mode and the unrelated controls aren't loaded.
 */

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRealtimeTopic } from '@/hooks/use-realtime-topic';
import BOMConfigReferencePanel from '@/components/production/BOMConfigReferencePanel';
import { Card, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSwitch } from '@/components/ui/dx-switch';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { useToast } from '@/hooks/use-toast';
import { SwitchTypes } from 'devextreme-react/switch';
import {
  Scale,
  Package,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  ArrowLeft,
  Plus,
  Clock,
  TrendingUp,
  AlertTriangle,
  Activity,
  Hash,
  User,
  Sparkles,
} from 'lucide-react';

interface WeightLog {
  id: number;
  workOrderId: number;
  checkTime: string;
  sampleWeights: number[];
  failedCount: number;
  isPass: boolean;
  operatorId: number;
  operatorName?: string;
  notes?: string;
  createdAt: string;
}

interface IntegrityLog {
  id: number;
  workOrderId: number;
  checkTime: string;
  tubeCapComplete: boolean;
  lotNumberCorrect: boolean;
  packingCorrect: boolean;
  operatorId: number;
  operatorName?: string;
  inspectorId: number;
  inspectorName?: string;
  notes?: string;
  createdAt: string;
}

interface QCCriteria {
  id: number;
  code: string;
  name: string;
  weightMin: number;
  weightMax: number;
  sampleSize: number;
  maxFailures: number;
  checkIntervalMinutes: number;
}

interface WorkOrderBasic {
  id: number;
  woNumber: string;
  batchNumber: string;
  productName: string;
  status: string;
}

function parseSampleWeights(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default function PackagingQCPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();

  const workOrderId = Number(params.id);
  const mode: 'weight' | 'integrity' =
    searchParams.get('tab') === 'integrity' ? 'integrity' : 'weight';

  const [showWeightDialog, setShowWeightDialog] = useState(false);
  const [showIntegrityDialog, setShowIntegrityDialog] = useState(false);
  const [sampleWeights, setSampleWeights] = useState<number[]>([]);
  const [editingWeightLog, setEditingWeightLog] = useState<WeightLog | null>(null);
  const [weightNotes, setWeightNotes] = useState('');
  const [deletingWeightLogId, setDeletingWeightLogId] = useState<number | null>(null);
  const [integrityForm, setIntegrityForm] = useState({
    tubeCapComplete: true,
    lotNumberCorrect: true,
    packingCorrect: true,
    notes: '',
  });

  const { data: workOrder, isLoading: woLoading } = useQuery<WorkOrderBasic>({
    queryKey: ['work-order', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/detail`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data?.workOrder;
    },
  });

  const { data: criteria } = useQuery<QCCriteria | null>({
    queryKey: ['wo-packaging-qc-criteria', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/packaging-qc-criteria`);
      const data = await res.json();
      if (!data.success) return null;
      return data.data;
    },
  });

  const { data: weightLogs, isLoading: weightLoading } = useQuery<WeightLog[]>({
    queryKey: ['wo-packaging-weight', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/packaging-weight`);
      const data = await res.json();
      if (!data.success) return [];
      return data.data;
    },
    enabled: mode === 'weight',
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: integrityLogs, isLoading: integrityLoading } = useQuery<IntegrityLog[]>({
    queryKey: ['wo-packaging-integrity', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/packaging-integrity`);
      const data = await res.json();
      if (!data.success) return [];
      return data.data;
    },
    enabled: mode === 'integrity',
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Realtime — invalidate the active mode's query when another user records
  useRealtimeTopic('work-order-changed', (data) => {
    if (data.workOrderId !== workOrderId) return;
    if (mode === 'weight' && data.section === 'packaging-weight') {
      queryClient.invalidateQueries({ queryKey: ['wo-packaging-weight', workOrderId] });
    }
    if (mode === 'integrity' && data.section === 'packaging-integrity') {
      queryClient.invalidateQueries({ queryKey: ['wo-packaging-integrity', workOrderId] });
    }
  });

  const addWeightMutation = useMutation({
    mutationFn: async (data: { sampleWeights: number[]; notes?: string }) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/packaging-weight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkTime: new Date().toTimeString().slice(0, 5),
          ...data,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-packaging-weight', workOrderId] });
      toast.success('บันทึกการตรวจน้ำหนักแล้ว', 'Weight Control');
      setShowWeightDialog(false);
      setSampleWeights([]);
    },
    onError: (error: Error) => toast.error(error.message, 'Error'),
  });

  const editWeightMutation = useMutation({
    mutationFn: async (data: { logId: number; sampleWeights: number[]; notes?: string }) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/packaging-weight`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-packaging-weight', workOrderId] });
      toast.success('แก้ไขข้อมูลสำเร็จ', 'Weight Control');
      setShowWeightDialog(false);
      setSampleWeights([]);
      setEditingWeightLog(null);
      setWeightNotes('');
    },
    onError: (error: Error) => toast.error(error.message, 'Error'),
  });

  const deleteWeightMutation = useMutation({
    mutationFn: async (logId: number) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/packaging-weight`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-packaging-weight', workOrderId] });
      toast.success('ลบข้อมูลสำเร็จ', 'Weight Control');
      setDeletingWeightLogId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message, 'Error');
      setDeletingWeightLogId(null);
    },
  });

  const addIntegrityMutation = useMutation({
    mutationFn: async (data: typeof integrityForm) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/packaging-integrity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkTime: new Date().toTimeString().slice(0, 5),
          ...data,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-packaging-integrity', workOrderId] });
      toast.success('บันทึกการตรวจ Integrity แล้ว', 'Integrity Check');
      setShowIntegrityDialog(false);
      setIntegrityForm({
        tubeCapComplete: true,
        lotNumberCorrect: true,
        packingCorrect: true,
        notes: '',
      });
    },
    onError: (error: Error) => toast.error(error.message, 'Error'),
  });

  const handleOpenWeightDialog = () => {
    setEditingWeightLog(null);
    setWeightNotes('');
    if (criteria) {
      setSampleWeights(new Array(criteria.sampleSize).fill(0));
    }
    setShowWeightDialog(true);
  };

  const handleEditWeightLog = (log: WeightLog) => {
    setEditingWeightLog(log);
    setSampleWeights(parseSampleWeights(log.sampleWeights));
    setWeightNotes(log.notes || '');
    setShowWeightDialog(true);
  };

  const handleSaveWeight = () => {
    if (editingWeightLog) {
      editWeightMutation.mutate({
        logId: editingWeightLog.id,
        sampleWeights,
        notes: weightNotes || undefined,
      });
    } else {
      addWeightMutation.mutate({ sampleWeights, notes: weightNotes || undefined });
    }
  };

  const updateSampleWeight = (index: number, value: number) => {
    const newWeights = [...sampleWeights];
    newWeights[index] = value;
    setSampleWeights(newWeights);
  };

  const calculateWeightResult = () => {
    if (!criteria || sampleWeights.length === 0) return { failedCount: 0, isPass: true };
    const failedCount = sampleWeights.filter(
      (w) => w < criteria.weightMin || w > criteria.weightMax
    ).length;
    return { failedCount, isPass: failedCount <= criteria.maxFailures };
  };

  const weightResult = calculateWeightResult();

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
          stylingMode="outlined"
          className="mt-4"
          onClick={() => router.push('/production/work-orders')}
        />
      </div>
    );
  }

  // ============================================================
  // MODE: Weight Control
  // ============================================================
  if (mode === 'weight') {
    const totalChecks = weightLogs?.length || 0;
    const passedChecks = weightLogs?.filter((l) => l.isPass).length || 0;
    const failedChecks = totalChecks - passedChecks;
    const passRate = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

    return (
      <div
        className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-blue-50/30"
        style={{
          fontFamily:
            'var(--font-inter), var(--font-sarabun), system-ui, -apple-system, sans-serif',
        }}
      >
        <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
          {/* HERO */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 shadow-xl shadow-indigo-500/20">
            <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-16 -left-16 h-60 w-60 rounded-full bg-cyan-300/20 blur-3xl" />
            <Scale className="absolute top-6 right-8 h-32 w-32 text-white/10" />

            <div className="relative px-6 py-7 md:px-10 md:py-9 text-white">
              <button
                onClick={() => router.push(`/production/work-orders/${workOrderId}/execution`)}
                className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm mb-4 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                กลับไป Execution Dashboard
              </button>

              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-2xl bg-white/15 backdrop-blur p-3 ring-1 ring-white/20">
                  <Scale className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                    ตรวจน้ำหนักบรรจุภัณฑ์
                  </h1>
                  <p className="text-white/80 text-sm">Packaging Weight Control</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
                <span className="font-mono font-semibold">{workOrder.woNumber}</span>
                <span className="text-white/40">•</span>
                <span>Batch: {workOrder.batchNumber}</span>
                <span className="text-white/40">•</span>
                <span>{workOrder.productName}</span>
              </div>
            </div>
          </div>

          {/* CRITERIA + ACTION */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="md:col-span-2 border-indigo-100 bg-white">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                    เกณฑ์การตรวจ (Acceptance Criteria)
                  </span>
                </div>
                {criteria ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">น้ำหนักขั้นต่ำ</div>
                      <div className="text-xl font-bold text-indigo-700">
                        {criteria.weightMin}
                        <span className="text-sm font-normal text-gray-500 ml-1">g</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">น้ำหนักสูงสุด</div>
                      <div className="text-xl font-bold text-indigo-700">
                        {criteria.weightMax}
                        <span className="text-sm font-normal text-gray-500 ml-1">g</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">จำนวนตัวอย่าง</div>
                      <div className="text-xl font-bold text-indigo-700">
                        {criteria.sampleSize}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">เสียได้ไม่เกิน</div>
                      <div className="text-xl font-bold text-amber-600">
                        {criteria.maxFailures}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 border border-amber-200">
                    ⚠️ ยังไม่ได้กำหนดเกณฑ์น้ำหนักใน BOM — ติดต่อ admin เพื่อกำหนดก่อน
                  </div>
                )}
              </CardContent>
            </Card>

            <button
              onClick={handleOpenWeightDialog}
              disabled={!criteria}
              className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 p-5 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
              <div className="relative flex flex-col items-center justify-center gap-2 text-center">
                <div className="rounded-full bg-white/20 p-2">
                  <Plus className="h-6 w-6" />
                </div>
                <span className="font-bold text-lg">บันทึกการตรวจน้ำหนัก</span>
                <span className="text-xs text-white/80">Add Weight Check</span>
              </div>
            </button>
          </div>

          {/* STATS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<Activity className="h-5 w-5" />}
              label="จำนวนครั้งที่ตรวจ"
              value={totalChecks}
              tone="indigo"
            />
            <StatCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="ผ่าน"
              value={passedChecks}
              tone="emerald"
            />
            <StatCard
              icon={<XCircle className="h-5 w-5" />}
              label="ไม่ผ่าน"
              value={failedChecks}
              tone="rose"
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="อัตราผ่าน"
              value={`${passRate}%`}
              tone={passRate >= 95 ? 'emerald' : passRate >= 80 ? 'amber' : 'rose'}
            />
          </div>

          {/* BOM REFERENCE */}
          <BOMConfigReferencePanel
            workOrderId={workOrderId}
            showOnly={['packagingQC']}
            defaultExpanded={false}
          />

          {/* RECORDS */}
          <Card className="border-gray-100">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1 w-12 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500" />
                <h3 className="font-bold text-gray-900">ประวัติการตรวจ ({totalChecks})</h3>
              </div>

              {weightLoading ? (
                <div className="flex justify-center py-12">
                  <DxLoadIndicator />
                </div>
              ) : totalChecks === 0 ? (
                <EmptyState
                  icon={<Scale className="h-10 w-10 text-indigo-400" />}
                  title="ยังไม่มีการตรวจน้ำหนัก"
                  hint='คลิก "บันทึกการตรวจน้ำหนัก" ด้านบนเพื่อเริ่มต้น'
                />
              ) : (
                <div className="grid gap-3 md:gap-4">
                  {weightLogs?.map((log) => {
                    const samples = parseSampleWeights(log.sampleWeights);
                    const validSamples = samples.filter((w) => typeof w === 'number');
                    const avg = validSamples.length
                      ? validSamples.reduce((a, b) => a + b, 0) / validSamples.length
                      : 0;
                    const minW = validSamples.length ? Math.min(...validSamples) : 0;
                    const maxW = validSamples.length ? Math.max(...validSamples) : 0;
                    return (
                      <div
                        key={log.id}
                        className={`relative rounded-2xl border-2 p-4 md:p-5 transition-all hover:shadow-lg ${
                          log.isPass
                            ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white hover:border-emerald-400'
                            : 'border-rose-200 bg-gradient-to-br from-rose-50/60 to-white hover:border-rose-400'
                        }`}
                      >
                        {/* Header: result icon + time + actions */}
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`flex h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0 items-center justify-center rounded-2xl shadow-md ${
                                log.isPass
                                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-200'
                                  : 'bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-rose-200'
                              }`}
                            >
                              {log.isPass ? (
                                <CheckCircle2 className="h-6 w-6 sm:h-7 sm:w-7" />
                              ) : (
                                <XCircle className="h-6 w-6 sm:h-7 sm:w-7" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 text-base font-bold text-gray-900">
                                  <Clock className="h-4 w-4 text-gray-400" />
                                  {log.checkTime}
                                </span>
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide ${
                                    log.isPass
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-rose-100 text-rose-700'
                                  }`}
                                >
                                  {log.isPass ? '✓ PASS' : '✗ FAIL'}
                                </span>
                                {log.failedCount > 0 && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                                    เสีย {log.failedCount} ตัวอย่าง
                                  </span>
                                )}
                              </div>
                              {log.operatorName && (
                                <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                                  <User className="h-3 w-3" />
                                  <span className="truncate">{log.operatorName}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {workOrder.status !== 'completed' && (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleEditWeightLog(log)}
                                className="rounded-lg bg-white text-blue-600 hover:bg-blue-50 active:bg-blue-100 px-3 py-1.5 text-xs font-semibold border border-blue-200 transition-colors flex items-center gap-1 shadow-sm"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                แก้ไข
                              </button>
                              <button
                                onClick={() => setDeletingWeightLogId(log.id)}
                                className="rounded-lg bg-white text-rose-600 hover:bg-rose-50 active:bg-rose-100 px-3 py-1.5 text-xs font-semibold border border-rose-200 transition-colors flex items-center gap-1 shadow-sm"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                ลบ
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Stats summary */}
                        {validSamples.length > 0 && (
                          <div className="grid grid-cols-3 gap-2 mb-3 p-2.5 rounded-xl bg-white/70 border border-gray-100">
                            <StatChip
                              label="เฉลี่ย"
                              value={`${avg.toFixed(2)}g`}
                              tone="indigo"
                            />
                            <StatChip
                              label="ต่ำสุด"
                              value={`${minW.toFixed(2)}g`}
                              tone={
                                criteria && minW < criteria.weightMin ? 'rose' : 'emerald'
                              }
                            />
                            <StatChip
                              label="สูงสุด"
                              value={`${maxW.toFixed(2)}g`}
                              tone={
                                criteria && maxW > criteria.weightMax ? 'rose' : 'emerald'
                              }
                            />
                          </div>
                        )}

                        {/* Sample weight chips */}
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5">
                          {samples.map((w, i) => {
                            const fail =
                              criteria && (w < criteria.weightMin || w > criteria.weightMax);
                            return (
                              <div
                                key={i}
                                className={`rounded-lg px-2 py-1.5 border text-center ${
                                  fail
                                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                                    : 'bg-white text-gray-700 border-gray-200'
                                }`}
                              >
                                <div className="text-[10px] font-semibold text-gray-400">
                                  #{i + 1}
                                </div>
                                <div className="font-mono font-bold text-sm leading-tight">
                                  {Number(w).toFixed(2)}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {log.notes && (
                          <div className="mt-3 text-xs text-gray-600 border-t border-dashed border-gray-200 pt-2.5 flex items-start gap-2">
                            <span className="font-semibold text-gray-500">หมายเหตุ:</span>
                            <span className="italic">{log.notes}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* DIALOGS */}
        <DxPopup
          visible={showWeightDialog}
          onHiding={() => {
            setShowWeightDialog(false);
            setSampleWeights([]);
            setEditingWeightLog(null);
            setWeightNotes('');
          }}
          title={editingWeightLog ? 'แก้ไขการตรวจน้ำหนัก' : 'บันทึกการตรวจน้ำหนัก'}
          width={640}
          height="auto"
          showCloseButton
          dragEnabled={false}
        >
          <div className="p-5 space-y-4">
            {editingWeightLog && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <p className="text-sm text-amber-800">
                  กำลังแก้ไขรายการของ <strong>{editingWeightLog.checkTime}</strong> —
                  การเปลี่ยนแปลงจะถูกบันทึกใน audit trail
                </p>
              </div>
            )}

            {criteria && (
              <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 p-4">
                <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">
                  เกณฑ์
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">ช่วงน้ำหนัก:</span>{' '}
                    <strong className="text-indigo-800">
                      {criteria.weightMin}–{criteria.weightMax}g
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500">ตัวอย่าง:</span>{' '}
                    <strong>{criteria.sampleSize}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500">เสียได้:</span>{' '}
                    <strong className="text-amber-700">{criteria.maxFailures}</strong>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                <Hash className="h-4 w-4 text-indigo-500" />
                ใส่น้ำหนักแต่ละตัวอย่าง (กรัม) — ทศนิยม 2 ตำแหน่ง
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[420px] overflow-y-auto p-1">
                {sampleWeights.map((weight, index) => {
                  const fail =
                    criteria &&
                    weight > 0 &&
                    (weight < criteria.weightMin || weight > criteria.weightMax);
                  return (
                    <div
                      key={index}
                      className={`rounded-xl p-3 border-2 transition-colors ${
                        fail
                          ? 'border-rose-300 bg-rose-50'
                          : weight > 0
                          ? 'border-emerald-300 bg-emerald-50/60'
                          : 'border-gray-200 bg-gray-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-gray-500">
                          ตัวอย่าง #{index + 1}
                        </span>
                        {weight > 0 && (
                          <span
                            className={`text-[10px] font-bold ${
                              fail ? 'text-rose-600' : 'text-emerald-600'
                            }`}
                          >
                            {fail ? 'นอกเกณฑ์' : 'OK'}
                          </span>
                        )}
                      </div>
                      <DxNumberBox
                        value={weight}
                        onValueChanged={(e) => updateSampleWeight(index, e.value)}
                        format="#0.00"
                        step={0.01}
                        min={0}
                        showSpinButtons
                        placeholder="0.00"
                      />
                    </div>
                  );
                })}
              </div>
              {criteria && (
                <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                  <span className="text-indigo-500">ⓘ</span>
                  น้ำหนักที่ผ่าน:{' '}
                  <strong className="text-emerald-700">
                    {criteria.weightMin}–{criteria.weightMax}g
                  </strong>{' '}
                  (เสียได้ไม่เกิน{' '}
                  <strong className="text-amber-700">{criteria.maxFailures}</strong> ตัวอย่าง)
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1 block">
                หมายเหตุ{' '}
                {editingWeightLog && (
                  <span className="text-amber-600 text-xs">(เหตุผลในการแก้ไข)</span>
                )}
              </label>
              <DxTextArea
                value={weightNotes}
                onValueChanged={(e) => setWeightNotes(e.value)}
                placeholder={
                  editingWeightLog ? 'ระบุเหตุผลในการแก้ไข...' : 'หมายเหตุเพิ่มเติม...'
                }
                height={70}
              />
            </div>

            <div
              className={`rounded-xl p-4 border-2 ${
                weightResult.isPass
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-rose-50 border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      weightResult.isPass ? 'bg-emerald-500' : 'bg-rose-500'
                    } text-white`}
                  >
                    {weightResult.isPass ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div
                      className={`font-bold text-lg ${
                        weightResult.isPass ? 'text-emerald-800' : 'text-rose-800'
                      }`}
                    >
                      {weightResult.isPass ? 'PASS' : 'FAIL'}
                    </div>
                    <div className="text-xs text-gray-600">
                      เสีย {weightResult.failedCount} / สูงสุด {criteria?.maxFailures || 0}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <DxButton
                text="ยกเลิก"
                stylingMode="outlined"
                onClick={() => setShowWeightDialog(false)}
              />
              <DxButton
                text={editingWeightLog ? 'อัพเดท' : 'บันทึก'}
                type="success"
                onClick={handleSaveWeight}
                disabled={
                  (editingWeightLog
                    ? editWeightMutation.isPending
                    : addWeightMutation.isPending) || sampleWeights.some((w) => w === 0)
                }
              />
            </div>
          </div>
        </DxPopup>

        <DxPopup
          visible={deletingWeightLogId !== null}
          onHiding={() => setDeletingWeightLogId(null)}
          title="ยืนยันการลบ"
          width={420}
          height="auto"
          showCloseButton
          dragEnabled={false}
        >
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-rose-100 p-2">
                <Trash2 className="h-5 w-5 text-rose-600" />
              </div>
              <p className="text-gray-700 text-sm">
                คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <DxButton
                text="ยกเลิก"
                stylingMode="outlined"
                onClick={() => setDeletingWeightLogId(null)}
              />
              <DxButton
                text="ลบรายการ"
                type="danger"
                onClick={() =>
                  deletingWeightLogId && deleteWeightMutation.mutate(deletingWeightLogId)
                }
                disabled={deleteWeightMutation.isPending}
              />
            </div>
          </div>
        </DxPopup>
      </div>
    );
  }

  // ============================================================
  // MODE: Integrity Check
  // ============================================================
  const totalIntegrity = integrityLogs?.length || 0;
  const allPassIntegrity =
    integrityLogs?.filter(
      (l) => l.tubeCapComplete && l.lotNumberCorrect && l.packingCorrect
    ).length || 0;
  const issuesIntegrity = totalIntegrity - allPassIntegrity;
  const integrityRate =
    totalIntegrity > 0 ? Math.round((allPassIntegrity / totalIntegrity) * 100) : 0;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/30"
      style={{
        fontFamily:
          'var(--font-inter), var(--font-sarabun), system-ui, -apple-system, sans-serif',
      }}
    >
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {/* HERO */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600 via-fuchsia-600 to-pink-500 shadow-xl shadow-purple-500/20">
          <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-16 -left-16 h-60 w-60 rounded-full bg-pink-300/20 blur-3xl" />
          <Package className="absolute top-6 right-8 h-32 w-32 text-white/10" />

          <div className="relative px-6 py-7 md:px-10 md:py-9 text-white">
            <button
              onClick={() => router.push(`/production/work-orders/${workOrderId}/execution`)}
              className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              กลับไป Execution Dashboard
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-2xl bg-white/15 backdrop-blur p-3 ring-1 ring-white/20">
                <Package className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  ตรวจสอบคุณภาพบรรจุภัณฑ์
                </h1>
                <p className="text-white/80 text-sm">Packaging Integrity Check</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
              <span className="font-mono font-semibold">{workOrder.woNumber}</span>
              <span className="text-white/40">•</span>
              <span>Batch: {workOrder.batchNumber}</span>
              <span className="text-white/40">•</span>
              <span>{workOrder.productName}</span>
            </div>
          </div>
        </div>

        {/* CHECKLIST + ACTION */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="md:col-span-2 border-purple-100 bg-white">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <span className="text-xs font-semibold uppercase tracking-wide text-purple-600">
                  รายการตรวจสอบ (Checklist)
                </span>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <ChecklistItem
                  icon="🧴"
                  label="หลอด/ฝา ปิดสนิท"
                  sublabel="Tube/Cap Sealed"
                />
                <ChecklistItem
                  icon="🔢"
                  label="Lot Number ถูกต้อง"
                  sublabel="Lot Correct"
                />
                <ChecklistItem
                  icon="📦"
                  label="การบรรจุถูกต้อง"
                  sublabel="Packing Correct"
                />
              </div>
            </CardContent>
          </Card>

          <button
            onClick={() => setShowIntegrityDialog(true)}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 p-5 text-white shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 transition-all"
          >
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
            <div className="relative flex flex-col items-center justify-center gap-2 text-center">
              <div className="rounded-full bg-white/20 p-2">
                <Plus className="h-6 w-6" />
              </div>
              <span className="font-bold text-lg">บันทึกการตรวจ Integrity</span>
              <span className="text-xs text-white/80">Add Integrity Check</span>
            </div>
          </button>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Activity className="h-5 w-5" />}
            label="จำนวนครั้งที่ตรวจ"
            value={totalIntegrity}
            tone="purple"
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="ผ่านครบทุกข้อ"
            value={allPassIntegrity}
            tone="emerald"
          />
          <StatCard
            icon={<AlertTriangle className="h-5 w-5" />}
            label="พบปัญหา"
            value={issuesIntegrity}
            tone="rose"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="อัตราผ่าน"
            value={`${integrityRate}%`}
            tone={integrityRate >= 95 ? 'emerald' : integrityRate >= 80 ? 'amber' : 'rose'}
          />
        </div>

        {/* RECORDS */}
        <Card className="border-gray-100">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1 w-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
              <h3 className="font-bold text-gray-900">ประวัติการตรวจ ({totalIntegrity})</h3>
            </div>

            {integrityLoading ? (
              <div className="flex justify-center py-12">
                <DxLoadIndicator />
              </div>
            ) : totalIntegrity === 0 ? (
              <EmptyState
                icon={<Package className="h-10 w-10 text-purple-400" />}
                title="ยังไม่มีการตรวจ Integrity"
                hint='คลิก "บันทึกการตรวจ Integrity" ด้านบนเพื่อเริ่มต้น'
              />
            ) : (
              <div className="grid gap-3 md:gap-4">
                {integrityLogs?.map((log) => {
                  const allPass =
                    log.tubeCapComplete && log.lotNumberCorrect && log.packingCorrect;
                  const failCount =
                    (log.tubeCapComplete ? 0 : 1) +
                    (log.lotNumberCorrect ? 0 : 1) +
                    (log.packingCorrect ? 0 : 1);
                  return (
                    <div
                      key={log.id}
                      className={`rounded-2xl border-2 p-4 md:p-5 transition-all hover:shadow-lg ${
                        allPass
                          ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white hover:border-emerald-400'
                          : 'border-rose-200 bg-gradient-to-br from-rose-50/60 to-white hover:border-rose-400'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`flex h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0 items-center justify-center rounded-2xl shadow-md ${
                              allPass
                                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-200'
                                : 'bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-rose-200'
                            }`}
                          >
                            {allPass ? (
                              <CheckCircle2 className="h-6 w-6 sm:h-7 sm:w-7" />
                            ) : (
                              <AlertTriangle className="h-6 w-6 sm:h-7 sm:w-7" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 text-base font-bold text-gray-900">
                                <Clock className="h-4 w-4 text-gray-400" />
                                {log.checkTime}
                              </span>
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide ${
                                  allPass
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-rose-100 text-rose-700'
                                }`}
                              >
                                {allPass ? '✓ ผ่านครบ 3/3' : `✗ ${3 - failCount}/3 ผ่าน`}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                              {log.operatorName && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  Operator: {log.operatorName}
                                </span>
                              )}
                              {log.inspectorName && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  Inspector: {log.inspectorName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <CheckResult
                          icon="🧴"
                          label="หลอด/ฝา ปิดสนิท"
                          pass={log.tubeCapComplete}
                        />
                        <CheckResult
                          icon="🔢"
                          label="Lot Number ถูกต้อง"
                          pass={log.lotNumberCorrect}
                        />
                        <CheckResult
                          icon="📦"
                          label="การบรรจุถูกต้อง"
                          pass={log.packingCorrect}
                        />
                      </div>

                      {log.notes && (
                        <div className="mt-3 text-xs text-gray-600 border-t border-dashed border-gray-200 pt-2.5 flex items-start gap-2">
                          <span className="font-semibold text-gray-500">หมายเหตุ:</span>
                          <span className="italic">{log.notes}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* DIALOG */}
      <DxPopup
        visible={showIntegrityDialog}
        onHiding={() => setShowIntegrityDialog(false)}
        title="บันทึกการตรวจ Integrity"
        width={500}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-5 space-y-4">
          <div className="rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 p-3 text-sm text-purple-800">
            ตรวจสอบทั้ง 3 ข้อ — สลับ toggle หากพบปัญหา
          </div>

          <div className="space-y-2">
            <ToggleRow
              icon="🧴"
              label="หลอด/ฝา ปิดสนิท"
              sublabel="Tube/Cap Complete & Sealed"
              value={integrityForm.tubeCapComplete}
              onChange={(v) =>
                setIntegrityForm({ ...integrityForm, tubeCapComplete: v })
              }
            />
            <ToggleRow
              icon="🔢"
              label="Lot Number ถูกต้อง"
              sublabel="Lot Number Correct"
              value={integrityForm.lotNumberCorrect}
              onChange={(v) =>
                setIntegrityForm({ ...integrityForm, lotNumberCorrect: v })
              }
            />
            <ToggleRow
              icon="📦"
              label="การบรรจุถูกต้อง"
              sublabel="Packing Correct"
              value={integrityForm.packingCorrect}
              onChange={(v) =>
                setIntegrityForm({ ...integrityForm, packingCorrect: v })
              }
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1 block">
              หมายเหตุ
            </label>
            <DxTextArea
              value={integrityForm.notes}
              onValueChanged={(e) => setIntegrityForm({ ...integrityForm, notes: e.value })}
              placeholder="ระบุปัญหาที่พบ หรือ ข้อสังเกต..."
              height={80}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <DxButton
              text="ยกเลิก"
              stylingMode="outlined"
              onClick={() => setShowIntegrityDialog(false)}
            />
            <DxButton
              text="บันทึก"
              type="success"
              onClick={() => addIntegrityMutation.mutate(integrityForm)}
              disabled={addIntegrityMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'indigo' | 'emerald' | 'rose';
}) {
  const toneClasses = {
    indigo: 'text-indigo-700 bg-indigo-50',
    emerald: 'text-emerald-700 bg-emerald-50',
    rose: 'text-rose-700 bg-rose-50',
  };
  return (
    <div className={`rounded-lg px-2 py-1.5 text-center ${toneClasses[tone]}`}>
      <div className="text-[10px] uppercase tracking-wide font-semibold opacity-70">
        {label}
      </div>
      <div className="font-mono font-bold text-sm">{value}</div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: 'indigo' | 'purple' | 'emerald' | 'amber' | 'rose';
}) {
  const toneClasses = {
    indigo: 'from-indigo-500 to-blue-500 shadow-indigo-200',
    purple: 'from-purple-500 to-fuchsia-500 shadow-purple-200',
    emerald: 'from-emerald-500 to-teal-500 shadow-emerald-200',
    amber: 'from-amber-500 to-orange-500 shadow-amber-200',
    rose: 'from-rose-500 to-pink-500 shadow-rose-200',
  };
  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div
          className={`h-10 w-10 rounded-xl bg-gradient-to-br ${toneClasses[tone]} text-white flex items-center justify-center shadow`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-gray-500 truncate">{label}</div>
          <div className="text-2xl font-bold text-gray-900 leading-tight">{value}</div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="text-center py-12 px-4">
      <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-50 mb-4">
        {icon}
      </div>
      <div className="font-semibold text-gray-700 mb-1">{title}</div>
      <div className="text-sm text-gray-500">{hint}</div>
    </div>
  );
}

function ChecklistItem({
  icon,
  label,
  sublabel,
}: {
  icon: string;
  label: string;
  sublabel: string;
}) {
  return (
    <div className="rounded-xl bg-purple-50/50 border border-purple-100 p-3 flex items-center gap-2">
      <span className="text-2xl">{icon}</span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-900 truncate">{label}</div>
        <div className="text-xs text-gray-500 truncate">{sublabel}</div>
      </div>
    </div>
  );
}

function CheckResult({
  icon,
  label,
  pass,
}: {
  icon?: string;
  label: string;
  pass: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm border ${
        pass
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
          : 'bg-rose-50 text-rose-800 border-rose-200'
      }`}
    >
      {icon && <span className="text-xl flex-shrink-0">{icon}</span>}
      {pass ? (
        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 flex-shrink-0" />
      )}
      <span className="font-semibold truncate">{label}</span>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  sublabel,
  value,
  onChange,
}: {
  icon: string;
  label: string;
  sublabel: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className={`rounded-xl border-2 p-3 flex items-center justify-between transition-colors ${
        value ? 'border-emerald-200 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/40'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="text-sm font-semibold text-gray-900">{label}</div>
          <div className="text-xs text-gray-500">{sublabel}</div>
        </div>
      </div>
      <DxSwitch
        value={value}
        onValueChanged={(e: SwitchTypes.ValueChangedEvent) => onChange(e.value ?? true)}
      />
    </div>
  );
}

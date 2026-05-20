'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { ResponsivePageHeader } from '@/components/shared';
import { useToast } from '@/hooks/use-toast';
import { ClipboardCheck, Plus, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { CRITERIA_TYPE_META, type CriteriaType } from '@/lib/master-data/ipc-test-catalog';

interface Criteria {
  id: number;
  code: string;
  name: string;
  nameTh: string | null;
  unit: string | null;
  criteriaType: string;
  isCritical: boolean;
  isActive: boolean;
}

interface RecordingRound {
  id: number;
  criteriaId: number;
  batchNumber: string;
  roundNumber: number;
  submittedAt: string | null;
}

interface CardState {
  criteria: Criteria;
  submittedCount: number;
  inProgressRound: RecordingRound | null;
}

export default function IPCRecordingListPage() {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const { data: criteria = [], isLoading: cLoading } = useQuery<Criteria[]>({
    queryKey: ['ipc-criteria-recording-list'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/ipc-criteria?isActive=true');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load criteria');
      return data.data || [];
    },
  });

  const { data: rounds = [] } = useQuery<RecordingRound[]>({
    queryKey: ['ipc-recording-rounds-all'],
    queryFn: async () => {
      const res = await fetch('/api/recording/rounds');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data || [];
    },
    staleTime: 10_000,
  });

  const cards: CardState[] = React.useMemo(() => {
    return criteria.map((c) => {
      const ownRounds = rounds.filter((r) => r.criteriaId === c.id);
      const submittedCount = ownRounds.filter((r) => r.submittedAt).length;
      const inProgressRound = ownRounds.find((r) => !r.submittedAt) ?? null;
      return { criteria: c, submittedCount, inProgressRound };
    });
  }, [criteria, rounds]);

  // New-round modal state
  const [newRoundFor, setNewRoundFor] = React.useState<Criteria | null>(null);
  const [batchNumber, setBatchNumber] = React.useState('');
  const [reason, setReason] = React.useState('');

  const createRound = useMutation({
    mutationFn: async (vars: { criteriaId: number; batchNumber: string; reason: string }) => {
      const res = await fetch('/api/recording/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to create round');
      return data.data;
    },
    onSuccess: (round) => {
      qc.invalidateQueries({ queryKey: ['ipc-recording-rounds-all'] });
      toast.success('สร้างรอบ', `รอบที่ ${round.roundNumber} พร้อมบันทึก`);
      setNewRoundFor(null);
      setBatchNumber('');
      setReason('');
      router.push(`/ipc-recording/${round.criteriaId}?roundId=${round.id}`);
    },
    onError: (e: Error) => toast.error('สร้างรอบไม่สำเร็จ', e.message),
  });

  if (cLoading) {
    return (
      <MainLayout>
        <div className="p-8 text-center text-slate-500">Loading...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto pb-12">
        <ResponsivePageHeader
          title="IPC Recording"
          subtitle="บันทึกผล In-Process Control แบบ multi-round ตามมาตรฐาน GMP"
          icon={ClipboardCheck}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-600"
          breadcrumbs={[
            { label: 'Production', href: '/production' },
            { label: 'IPC Recording' },
          ]}
          actions={
            <button
              type="button"
              onClick={() => router.push('/master-data/ipc-criteria/new')}
              className="px-4 py-2 rounded-[10px] bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> สร้าง Criteria ใหม่
            </button>
          }
        />

        {cards.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-slate-200 bg-white">
            <AlertTriangle className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium mb-1">ยังไม่มี IPC Criteria</p>
            <p className="text-xs text-slate-400 mb-4">สร้าง criteria ก่อนเริ่มบันทึกผล</p>
            <button
              type="button"
              onClick={() => router.push('/master-data/ipc-criteria/new')}
              className="px-4 py-2 rounded-[10px] bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
            >
              + สร้าง IPC Criteria
            </button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {cards.map((card) => (
              <CriteriaCard
                key={card.criteria.id}
                state={card}
                onContinue={() => {
                  if (card.inProgressRound) {
                    router.push(`/ipc-recording/${card.criteria.id}?roundId=${card.inProgressRound.id}`);
                  } else {
                    router.push(`/ipc-recording/${card.criteria.id}`);
                  }
                }}
                onNewRound={() => {
                  setNewRoundFor(card.criteria);
                  setBatchNumber('');
                  setReason('');
                }}
              />
            ))}
          </div>
        )}

        {/* New-round modal */}
        {newRoundFor && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">เริ่มรอบบันทึกใหม่</h3>
                <button
                  type="button"
                  onClick={() => setNewRoundFor(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mb-4">
                <div className="text-xs text-slate-500 mb-1">Criteria</div>
                <div className="text-sm font-semibold text-slate-800">{newRoundFor.code} — {newRoundFor.nameTh || newRoundFor.name}</div>
              </div>
              <div className="mb-3">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Batch Number (ไม่บังคับ)</label>
                <input
                  className="w-full px-3 py-2 border border-slate-200 rounded-[10px] text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none"
                  placeholder="เช่น BATCH-2026-001 (ปล่อยว่าง = ad-hoc)"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                />
              </div>
              <div className="mb-5">
                <label className="block text-xs font-semibold text-slate-600 mb-1">เหตุผล (ไม่บังคับ)</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 rounded-[10px] text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none"
                  rows={3}
                  placeholder="เช่น น้ำหนักแคปซูลเบี่ยงเบนเกิน → ปรับหัวตอกใหม่"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <p className="text-xs text-slate-500 mb-4">รอบใหม่จะถูกสร้างทันที พร้อมพาเข้าหน้าบันทึก</p>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setNewRoundFor(null)}
                  className="px-4 py-2 rounded-[10px] border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={createRound.isPending}
                  onClick={() => {
                    if (newRoundFor) {
                      createRound.mutate({ criteriaId: newRoundFor.id, batchNumber, reason });
                    }
                  }}
                  className="px-4 py-2 rounded-[10px] bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {createRound.isPending ? 'กำลังสร้าง...' : 'เริ่มบันทึก →'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function CriteriaCard({ state, onContinue, onNewRound }: {
  state: CardState;
  onContinue: () => void;
  onNewRound: () => void;
}) {
  const { criteria, submittedCount, inProgressRound } = state;
  const meta = CRITERIA_TYPE_META[(criteria.criteriaType as CriteriaType) ?? 'numeric'] ?? CRITERIA_TYPE_META.numeric;

  let actionLabel = 'เริ่มบันทึก →';
  if (inProgressRound) actionLabel = 'ดำเนินการต่อ →';
  else if (submittedCount > 0) actionLabel = 'ดูรอบทั้งหมด →';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="font-mono text-xs font-bold text-slate-900">{criteria.code}</span>
              <span className={cn('text-[10px] uppercase font-bold px-1.5 py-0.5 rounded', meta.bgColor, meta.textColor)}>
                {meta.label}
              </span>
              {criteria.isCritical && (
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800">! CRITICAL</span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">{criteria.nameTh || criteria.name}</h3>
            <p className="text-xs text-slate-500">{criteria.unit ? `หน่วย: ${criteria.unit}` : ''}</p>
          </div>
          <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
            {submittedCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-medium">
                ✓ {submittedCount} รอบ
              </span>
            )}
            {inProgressRound && (
              <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-medium">
                • กำลังบันทึก
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-slate-100 flex">
        <button
          type="button"
          onClick={onContinue}
          className="flex-1 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition"
        >
          {actionLabel}
        </button>
        <button
          type="button"
          onClick={onNewRound}
          className="flex-1 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition border-l border-slate-100"
        >
          + รอบใหม่
        </button>
      </div>
    </div>
  );
}

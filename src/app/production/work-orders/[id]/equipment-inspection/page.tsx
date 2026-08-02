'use client';

/**
 * Work-order pre-production equipment inspection. Lists the equipment the BOM
 * requires for the pre_production phase and lets the operator record a pass/fail
 * inspection (per each equipment's checklist) before production. This is the
 * replacement for the old "verify scale before weighing" gate.
 */

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { useToast } from '@/hooks/use-toast';
import { ClipboardCheck, ArrowLeft, CheckCircle2, XCircle, Wrench } from 'lucide-react';

interface InspectionItem {
  bomEquipmentId: number;
  equipmentId: number;
  code: string;
  name: string;
  nameTh: string;
  equipmentType: string;
  checklist: string[];
  isRequired: boolean;
  sequence: number;
  result: string | null;
  performedAt: string | null;
}

export default function WOEquipmentInspectionPage() {
  const params = useParams();
  const router = useRouter();
  const workOrderId = Number(params.id);
  const t = useTranslations('production');
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery<InspectionItem[]>({
    queryKey: ['wo-equipment-inspection', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/equipment-inspection?phase=pre_production`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-4xl mx-auto">
      <ResponsivePageHeader
        title={t('equipmentInspection.title')}
        subtitle={t('equipmentInspection.subtitle')}
        icon={ClipboardCheck}
        iconBgColor="bg-cyan-100"
        iconColor="text-cyan-600"
        actions={
          <button
            onClick={() => router.push(`/production/work-orders/${workOrderId}`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('equipmentInspection.back')}
          </button>
        }
      />

      {isLoading ? (
        <div className="text-center text-gray-400 py-10">{t('equipmentInspection.loading')}</div>
      ) : (items || []).length === 0 ? (
        <div className="bg-white rounded-[18px] border border-emerald-100 p-8 text-center text-gray-500">
          <Wrench className="w-10 h-10 mx-auto mb-2 opacity-40" />
          {t('equipmentInspection.noEquipment')}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {(items || []).map((item) => (
            <EquipmentInspectionCard
              key={item.bomEquipmentId}
              workOrderId={workOrderId}
              item={item}
              onSaved={() => queryClient.invalidateQueries({ queryKey: ['wo-equipment-inspection', workOrderId] })}
              t={t}
              toast={toast}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EquipmentInspectionCard({
  workOrderId,
  item,
  onSaved,
  t,
  toast,
}: {
  workOrderId: number;
  item: InspectionItem;
  onSaved: () => void;
  t: (k: string, v?: Record<string, string | number>) => string;
  toast: ReturnType<typeof useToast>;
}) {
  const [checkState, setCheckState] = useState<Record<number, boolean>>({});
  const [notes, setNotes] = useState('');
  const anyFailed = item.checklist.some((_, i) => checkState[i] === false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const checklistResults = item.checklist.map((c, i) => ({ item: c, ok: checkState[i] !== false }));
      const res = await fetch(`/api/production/work-orders/${workOrderId}/equipment-inspection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId: item.equipmentId,
          bomEquipmentId: item.bomEquipmentId,
          phase: 'pre_production',
          result: anyFailed ? 'fail' : 'pass',
          checklistResults,
          notes,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      toast.success(t('equipmentInspection.saveSuccess'));
      onSaved();
    },
    onError: (e: Error) => toast.error(t('equipmentInspection.saveError'), e.message),
  });

  const done = item.result != null;

  return (
    <div className="bg-white rounded-[18px] border border-emerald-100 shadow-[0_6px_20px_rgba(6,78,59,0.06)] p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-base font-semibold text-[#064E3B] flex items-center gap-2">
            <Wrench className="h-4 w-4 text-purple-500" />
            <span className="font-mono text-purple-700">{item.code}</span>
            {item.nameTh}
          </h3>
          {item.isRequired && <span className="text-xs text-red-500">* {t('equipmentInspection.required')}</span>}
        </div>
        {done && (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${item.result === 'pass' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
            {item.result === 'pass' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            {item.result === 'pass' ? t('equipmentInspection.resultPass') : t('equipmentInspection.resultFail')}
            <span className="text-gray-400">· {item.performedAt ? String(item.performedAt).slice(0, 10) : ''}</span>
          </span>
        )}
      </div>

      {item.checklist.length === 0 ? (
        <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3 border mb-3">{t('equipmentInspection.noChecklist')}</p>
      ) : (
        <div className="space-y-2 mb-3">
          {item.checklist.map((c, i) => {
            const failed = checkState[i] === false;
            return (
              <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-gray-100">
                <span className="text-sm text-gray-800 flex-1">{c}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCheckState((s) => ({ ...s, [i]: true }))}
                    className={`px-2.5 py-1 rounded text-xs font-medium ${!failed ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {t('equipmentInspection.itemPass')}
                  </button>
                  <button
                    onClick={() => setCheckState((s) => ({ ...s, [i]: false }))}
                    className={`px-2.5 py-1 rounded text-xs font-medium ${failed ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {t('equipmentInspection.itemFail')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('equipmentInspection.notesLabel')}</label>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
          data-testid={`wo-eqinsp-save-${item.equipmentId}`}
        >
          <ClipboardCheck className="h-4 w-4" />
          {t('equipmentInspection.record')} ({anyFailed ? t('equipmentInspection.resultFail') : t('equipmentInspection.resultPass')})
        </button>
      </div>
    </div>
  );
}

'use client';

/**
 * Equipment Log — the individual equipment log 21 CFR 211.182 requires.
 *
 * One machine, every event, newest first: cleaning, maintenance, inspection,
 * calibration, and the batches it ran (with product and lot). Read-only — each
 * event is written by the flow that owns it; this is the view that lets an
 * inspector see a single machine's whole history in one place.
 */
import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { ClipboardList, ShieldAlert, AlertTriangle } from 'lucide-react';

interface LogEvent {
  type: 'use' | 'cleaning' | 'inspection' | 'maintenance' | 'calibration';
  date: string | null;
  timestamp: string | null;
  title: string;
  detail: string | null;
  result: string | null;
  workOrderId: number | null;
  workOrderNumber: string | null;
  productName: string | null;
  lotNumber: string | null;
  performedByName: string | null;
  verifiedByName: string | null;
  sourceTable: string;
  sourceId: number;
}

interface LogResponse {
  equipment: {
    id: number;
    code: string;
    name: string;
    nameTh: string;
    equipmentType: string;
    lineCategory?: string | null;
    scaleStatus?: string;
  } | null;
  events: LogEvent[];
}

const TYPE_STYLE: Record<string, string> = {
  use: 'bg-blue-100 text-blue-800',
  cleaning: 'bg-lime-100 text-lime-800',
  inspection: 'bg-cyan-100 text-cyan-800',
  maintenance: 'bg-orange-100 text-orange-800',
  calibration: 'bg-purple-100 text-purple-800',
};

const RESULT_STYLE: Record<string, string> = {
  pass: 'bg-emerald-100 text-emerald-800',
  clean: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-emerald-100 text-emerald-800',
  fail: 'bg-red-100 text-red-800',
  not_clean: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-800',
  deferred: 'bg-amber-100 text-amber-800',
};

export default function EquipmentLogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const tRoot = useTranslations('premises');
  const t = (k: string) => tRoot(`equipmentLog.${k}`);
  const [filter, setFilter] = useState<'all' | LogEvent['type']>('all');

  const { data, isLoading } = useQuery<LogResponse>({
    queryKey: ['equipment-log', id],
    queryFn: async () => {
      const res = await fetch(`/api/premises/equipment-log/${id}`);
      const j = await res.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
  });

  const equipment = data?.equipment;
  const events = data?.events ?? [];
  const shown = filter === 'all' ? events : events.filter((e) => e.type === filter);

  const typeLabel = (v: string) =>
    ({
      use: t('typeUse'),
      cleaning: t('typeCleaning'),
      inspection: t('typeInspection'),
      maintenance: t('typeMaintenance'),
      calibration: t('typeCalibration'),
    } as Record<string, string>)[v] ?? v;

  const statusLabel = (v?: string) =>
    v === 'maintenance' ? t('statusMaintenance') : v === 'out_of_service' ? t('statusOutOfService') : t('statusActive');

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      <ResponsivePageHeader
        title={equipment ? `${equipment.code} — ${equipment.nameTh || equipment.name}` : t('title')}
        subtitle={t('subtitle')}
        icon={ClipboardList}
        iconBgColor="bg-slate-100"
        iconColor="text-slate-600"
        onBack={() => router.push('/master-data/production-equipment')}
        breadcrumbs={[
          { label: t('breadcrumbPremises'), href: '/premises' },
          { label: t('title') },
        ]}
        actions={<DxButton text={t('print')} icon="print" stylingMode="outlined" onClick={() => window.print()} />}
      />

      <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 no-print">
        <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>{t('legalNote')}</span>
      </div>

      {equipment && equipment.scaleStatus && equipment.scaleStatus !== 'active' && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          <AlertTriangle className="h-4 w-4" />
          {t('equipmentStatus')}: {statusLabel(equipment.scaleStatus)}
        </div>
      )}

      <div className="flex flex-wrap gap-2 no-print">
        {(['all', 'use', 'cleaning', 'inspection', 'maintenance', 'calibration'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === k ? 'bg-slate-700 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
            data-testid={`log-filter-${k}`}
          >
            {k === 'all'
              ? t('filterAll')
              : ({
                  use: t('filterUse'),
                  cleaning: t('filterCleaning'),
                  inspection: t('filterInspection'),
                  maintenance: t('filterMaintenance'),
                  calibration: t('filterCalibration'),
                } as Record<string, string>)[k]}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_6px_20px_rgba(6,78,59,0.07)]">
        {isLoading ? (
          <p className="py-8 text-center text-gray-400">{t('loading')}</p>
        ) : shown.length === 0 ? (
          <p className="py-8 text-center text-gray-400">{t('empty')}</p>
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-gray-500">
                <th className="pb-2 pr-3 font-medium">{t('colDate')}</th>
                <th className="pb-2 pr-3 font-medium">{t('colEvent')}</th>
                <th className="pb-2 pr-3 font-medium">{t('colBatch')}</th>
                <th className="pb-2 pr-3 font-medium">{t('colResult')}</th>
                <th className="pb-2 font-medium">{t('colBy')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e, i) => (
                <tr key={`${e.sourceTable}-${e.sourceId}-${e.type}-${i}`} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{e.date ?? '—'}</div>
                    {e.timestamp && (
                      <div className="text-xs text-gray-400">{String(e.timestamp).slice(11, 16)}</div>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLE[e.type] ?? 'bg-gray-100 text-gray-700'}`}>
                      {typeLabel(e.type)}
                    </span>
                    {e.title && <div className="mt-0.5 text-xs text-gray-600">{e.title}</div>}
                    {e.detail && <div className="text-xs text-gray-400">{e.detail}</div>}
                  </td>
                  <td className="py-2 pr-3">
                    {e.workOrderNumber ? (
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-semibold text-emerald-700">{e.workOrderNumber}</span>
                        {e.productName && <span className="text-xs text-gray-700">{e.productName}</span>}
                        {e.lotNumber && <span className="font-mono text-xs text-gray-500">Lot {e.lotNumber}</span>}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {e.result ? (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${RESULT_STYLE[e.result] ?? 'bg-gray-100 text-gray-700'}`}>
                        {e.result}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-2 text-xs text-gray-600">
                    {e.performedByName ?? '—'}
                    {e.verifiedByName && <div className="text-gray-400">✓ {e.verifiedByName}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

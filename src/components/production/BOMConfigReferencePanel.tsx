'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { BOMConfigResponse } from '@/types/bom-config';

interface BOMConfigReferencePanelProps {
  workOrderId: number;
  phase?: string;
  showOnly?: ('rooms' | 'equipment' | 'environmental' | 'sopSteps' | 'packagingQC')[];
  defaultExpanded?: boolean;
}

export default function BOMConfigReferencePanel({
  workOrderId,
  phase,
  showOnly,
  defaultExpanded = false,
}: BOMConfigReferencePanelProps) {
  const t = useTranslations('production');
  const locale = useLocale();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const { data: bomConfig } = useQuery<BOMConfigResponse>({
    queryKey: ['wo-bom-config', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/bom-config`);
      if (!res.ok) throw new Error('Failed to fetch BOM config');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to fetch BOM config');
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!bomConfig) return null;

  // Normalize phase comparison (guards against trailing whitespace / casing drift in DB)
  const normalizedPhase = phase?.trim().toLowerCase();
  const phaseMatch = (p: string | undefined | null): boolean =>
    !!normalizedPhase && (p || '').trim().toLowerCase() === normalizedPhase;

  const rooms = normalizedPhase
    ? bomConfig.rooms.filter((r) => phaseMatch(r.phase))
    : bomConfig.rooms;
  const equipment = normalizedPhase
    ? bomConfig.equipment.filter((e) => phaseMatch(e.phase))
    : bomConfig.equipment;
  const conditions = normalizedPhase
    ? bomConfig.environmentalConditions.filter((c) => phaseMatch(c.phase))
    : bomConfig.environmentalConditions;
  const sopSteps = bomConfig.sopSteps;
  const packagingQC = bomConfig.packagingQC;

  const shouldShow = (type: string) => {
    if (showOnly && !showOnly.includes(type as any)) return false;
    switch (type) {
      case 'rooms': return rooms.length > 0;
      case 'equipment': return equipment.length > 0;
      case 'environmental': return conditions.length > 0;
      case 'sopSteps': return sopSteps.length > 0;
      case 'packagingQC': return packagingQC.length > 0;
      default: return false;
    }
  };

  const hasAnyConfig =
    rooms.length > 0 ||
    equipment.length > 0 ||
    conditions.length > 0 ||
    sopSteps.length > 0 ||
    packagingQC.length > 0;

  const hasAnyVisible =
    shouldShow('rooms') ||
    shouldShow('equipment') ||
    shouldShow('environmental') ||
    shouldShow('sopSteps') ||
    shouldShow('packagingQC');

  if (!hasAnyConfig || !hasAnyVisible) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
        <Info className="h-5 w-5 text-amber-600 flex-shrink-0" />
        <p className="text-amber-800 text-sm">{t('bomConfiguration.noConfig')}</p>
      </div>
    );
  }

  const title = phase
    ? `${t('bomConfiguration.requirements')}: ${phase.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`
    : t('bomConfiguration.summary');

  return (
    <div className="bg-[#F4FBF7] border border-emerald-200 rounded-lg overflow-hidden">
      <button
        data-testid="bom-config-toggle"
        className="w-full flex items-center justify-between p-4 text-left hover:bg-emerald-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-emerald-600" />
          <span className="font-medium text-emerald-800">{title}</span>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-emerald-600" />
        ) : (
          <ChevronRight className="h-4 w-4 text-emerald-600" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {shouldShow('rooms') && (
            <div>
              <h4 className="text-sm font-semibold text-emerald-700 mb-1">{t('bomConfiguration.rooms')}</h4>
              <div className="flex flex-wrap gap-2">
                {rooms.map((r) => (
                  <span key={r.id} className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded border border-emerald-200 text-sm text-emerald-800">
                    <strong>{r.roomCode}</strong> ({locale === 'th' && r.roomNameTh ? r.roomNameTh : r.roomName})
                  </span>
                ))}
              </div>
            </div>
          )}

          {shouldShow('equipment') && (
            <div>
              <h4 className="text-sm font-semibold text-emerald-700 mb-1">{t('bomConfiguration.equipment')}</h4>
              <div className="flex flex-wrap gap-2">
                {equipment.map((e) => (
                  <span key={e.id} className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded border border-emerald-200 text-sm text-emerald-800">
                    <strong>{e.equipmentCode}</strong> ({locale === 'th' && e.equipmentNameTh ? e.equipmentNameTh : e.equipmentName})
                  </span>
                ))}
              </div>
            </div>
          )}

          {shouldShow('environmental') && (
            <div>
              <h4 className="text-sm font-semibold text-emerald-700 mb-1">{t('bomConfiguration.environmentalConditions')}</h4>
              {conditions.map((c) => (
                <div key={c.id} className="text-sm text-emerald-800 bg-white rounded border border-emerald-200 p-2 mb-1">
                  <span className="font-medium">{c.conditionName}</span>
                  {' — '}
                  {t('bomConfiguration.temperatureRange')}: {c.temperatureMin}-{c.temperatureMax}°C,{' '}
                  {t('bomConfiguration.humidityMax')}: ≤{c.humidityMax}% RH,{' '}
                  {t('bomConfiguration.monitoringInterval')}: {t('bomConfiguration.everyMinutes', { minutes: c.monitoringIntervalMinutes })}
                </div>
              ))}
            </div>
          )}

          {shouldShow('sopSteps') && (
            <div>
              <h4 className="text-sm font-semibold text-emerald-700 mb-1">{t('bomConfiguration.sopSteps')}</h4>
              <div className="space-y-1">
                {sopSteps.map((s) => (
                  <div key={s.id} className="text-sm text-emerald-800 bg-white rounded border border-emerald-200 p-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t('bomConfiguration.step', { sequence: s.sequence })}:</span>
                      <span>{locale === 'th' && s.stepNameTh ? s.stepNameTh : s.stepName}</span>
                    </div>
                    {s.parameters && Object.keys(s.parameters).length > 0 && (
                      <div className="mt-1 text-xs text-emerald-600">
                        {t('bomConfiguration.parameters')}:{' '}
                        {Object.entries(s.parameters).map(([key, val]) => `${key}: ${val}`).join(', ')}
                      </div>
                    )}
                    {(s.instructions || s.instructionsTh) && (
                      <div className="mt-1 text-xs text-emerald-600">
                        {t('bomConfiguration.instructions')}: {locale === 'th' && s.instructionsTh ? s.instructionsTh : s.instructions}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {shouldShow('packagingQC') && (
            <div>
              <h4 className="text-sm font-semibold text-emerald-700 mb-1">{t('bomConfiguration.packagingQC')}</h4>
              {packagingQC.map((q) => (
                <div key={q.id} className="text-sm text-emerald-800 bg-white rounded border border-emerald-200 p-2">
                  <span className="font-medium">{q.criteriaName}</span>
                  {' — '}
                  {t('bomConfiguration.weightMin')}: {q.weightMin}g,{' '}
                  {t('bomConfiguration.weightMax')}: {q.weightMax}g,{' '}
                  {t('bomConfiguration.sampleSize')}: {q.sampleSize},{' '}
                  {t('bomConfiguration.maxFailures')}: {q.maxFailures},{' '}
                  {t('bomConfiguration.checkInterval')}: {t('bomConfiguration.everyMinutes', { minutes: q.checkIntervalMinutes })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

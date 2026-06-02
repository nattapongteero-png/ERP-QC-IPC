'use client';

/**
 * PhaseBlockBanner
 *
 * Renders inside a Work Order phase view when pending material-withdrawal
 * requests block that phase (FR-035..040, Selective Block — Option C).
 *
 * Feature: 018-material-withdrawal-approval
 */

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight } from 'lucide-react';

interface BlockedPhasesResponse {
  materialIds: number[];
  pendingRequestIds: number[];
}

export interface PhaseBlockBannerProps {
  workOrderId: number;
  phaseMaterialIds?: number[];
  onViewRequest?: (requestId: number) => void;
  /** Lookup helper — pass materialId, get display name. */
  materialNameLookup?: (id: number) => string;
}

export function PhaseBlockBanner({
  workOrderId,
  phaseMaterialIds,
  onViewRequest,
  materialNameLookup,
}: PhaseBlockBannerProps) {
  const t = useTranslations('material-withdrawal');

  const { data, isLoading } = useQuery<BlockedPhasesResponse>({
    queryKey: ['blocked-phases', workOrderId],
    queryFn: async () => {
      const res = await fetch(
        `/api/production/work-orders/${workOrderId}/blocked-phases`,
      );
      if (!res.ok) throw new Error('Failed to load blocked phases');
      return res.json();
    },
    refetchInterval: 15000,
    staleTime: 5000,
  });

  if (isLoading) return null;
  if (!data || data.materialIds.length === 0) return null;

  const affected = phaseMaterialIds
    ? data.materialIds.filter((id) => phaseMaterialIds.includes(id))
    : data.materialIds;
  if (affected.length === 0) return null;

  const namesList = affected
    .map((id) => materialNameLookup?.(id) ?? `#${id}`)
    .join(', ');

  return (
    <div
      role="status"
      data-testid="phase-block-banner"
      className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900"
    >
      <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{t('phaseBlock.banner.title')}</div>
        <div className="text-sm mt-0.5">
          {t('phaseBlock.banner.message', { materials: namesList })}
        </div>
      </div>
      {onViewRequest && data.pendingRequestIds.length > 0 && (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700"
          onClick={() => onViewRequest(data.pendingRequestIds[0])}
        >
          {t('phaseBlock.banner.viewRequest')}
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

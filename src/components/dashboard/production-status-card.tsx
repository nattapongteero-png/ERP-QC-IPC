'use client';

/**
 * Production Status Card Component
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US11 - T047)
 * FR-052: Production Status
 */

import { useTranslations } from 'next-intl';
import { KpiCard } from './kpi-card';
import { Factory } from 'lucide-react';
import type { ProductionStatus } from '@/lib/services/audit-dashboard-service';

interface ProductionStatusCardProps {
  data: ProductionStatus;
  onClick?: () => void;
}

export function ProductionStatusCard({ data, onClick }: ProductionStatusCardProps) {
  const t = useTranslations('dashboard.auditCards.productionStatus');
  return (
    <KpiCard
      title={t('title')}
      value={`${data.completionRate}%`}
      subtitle={t('subtitle')}
      icon={<Factory className="w-5 h-5 text-indigo-600" />}
      status="normal"
      onClick={onClick}
    >
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
          {t('completed')}: {data.completed}
        </span>
        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
          {t('inProgress')}: {data.inProgress}
        </span>
        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
          {t('planned')}: {data.planned}
        </span>
      </div>
    </KpiCard>
  );
}

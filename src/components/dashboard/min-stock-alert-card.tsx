'use client';

/**
 * Min Stock Alert Card Component
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US11 - T045)
 * FR-050: Min Stock Alerts
 */

import { useTranslations } from 'next-intl';
import { KpiCard } from './kpi-card';
import { AlertTriangle } from 'lucide-react';
import type { MinStockAlerts } from '@/lib/services/audit-dashboard-service';

interface MinStockAlertCardProps {
  data: MinStockAlerts;
  onClick?: () => void;
}

export function MinStockAlertCard({ data, onClick }: MinStockAlertCardProps) {
  const t = useTranslations('dashboard.auditCards.minStockAlert');
  const totalAlerts = data.criticalCount + data.warningCount;
  const status = data.criticalCount > 0 ? 'critical' : data.warningCount > 0 ? 'warning' : 'normal';

  return (
    <KpiCard
      title={t('title')}
      value={totalAlerts}
      subtitle={t('subtitle')}
      icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
      status={status}
      onClick={onClick}
    >
      <div className="flex flex-wrap gap-2 text-xs">
        {data.criticalCount > 0 && (
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
            {t('belowMin')}: {data.criticalCount}
          </span>
        )}
        {data.warningCount > 0 && (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
            {t('belowReorder')}: {data.warningCount}
          </span>
        )}
        {totalAlerts === 0 && (
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
            {t('allOk')}
          </span>
        )}
      </div>
    </KpiCard>
  );
}

'use client';

/**
 * Expiry Alert Card Component
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US11 - T044)
 * FR-049: Expiry Alerts
 */

import { KpiCard } from './kpi-card';
import { Calendar } from 'lucide-react';
import type { ExpiryAlerts } from '@/lib/services/audit-dashboard-service';

interface ExpiryAlertCardProps {
  data: ExpiryAlerts;
  onClick?: () => void;
}

export function ExpiryAlertCard({ data, onClick }: ExpiryAlertCardProps) {
  const totalAlerts = data.expired + data.expiringSoon + data.expiringWarning;
  const status = data.expired > 0 ? 'critical' : data.expiringSoon > 0 ? 'warning' : 'normal';

  return (
    <KpiCard
      title="Expiry Alerts"
      value={totalAlerts}
      subtitle="lots"
      icon={<Calendar className="w-5 h-5 text-orange-600" />}
      status={status}
      onClick={onClick}
    >
      <div className="flex flex-wrap gap-2 text-xs">
        {data.expired > 0 && (
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
            Expired: {data.expired}
          </span>
        )}
        {data.expiringSoon > 0 && (
          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">
            30 days: {data.expiringSoon}
          </span>
        )}
        {data.expiringWarning > 0 && (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
            90 days: {data.expiringWarning}
          </span>
        )}
      </div>
    </KpiCard>
  );
}

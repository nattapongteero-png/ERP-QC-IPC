'use client';

/**
 * RM Status Card Component
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US11 - T043)
 * FR-048: RM Status Breakdown
 */

import { KpiCard } from './kpi-card';
import { BarChart3 } from 'lucide-react';
import type { RmStatusBreakdown } from '@/lib/services/audit-dashboard-service';

interface RmStatusCardProps {
  data: RmStatusBreakdown;
  onClick?: () => void;
}

export function RmStatusCard({ data, onClick }: RmStatusCardProps) {
  const hasIssues = data.rejected > 0 || data.blocked > 0;

  return (
    <KpiCard
      title="RM Status"
      value={data.total}
      subtitle="total lots"
      icon={<BarChart3 className="w-5 h-5 text-blue-600" />}
      status={hasIssues ? 'warning' : 'normal'}
      onClick={onClick}
    >
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
          Quarantine: {data.quarantine}
        </span>
        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
          Under Test: {data.underTest}
        </span>
        <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
          Released: {data.released}
        </span>
        {data.rejected > 0 && (
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
            Rejected: {data.rejected}
          </span>
        )}
      </div>
    </KpiCard>
  );
}

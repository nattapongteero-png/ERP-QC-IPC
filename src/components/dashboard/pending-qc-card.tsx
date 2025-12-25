'use client';

/**
 * Pending QC Card Component
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US11 - T048)
 * FR-053: Pending QC Release
 */

import { KpiCard } from './kpi-card';
import { Clock } from 'lucide-react';
import type { PendingQcRelease } from '@/lib/services/audit-dashboard-service';

interface PendingQcCardProps {
  data: PendingQcRelease;
  onClick?: () => void;
}

export function PendingQcCard({ data, onClick }: PendingQcCardProps) {
  const hasLongWait = data.items.some((item) => item.daysWaiting > 7);
  const status = hasLongWait ? 'warning' : data.count > 0 ? 'normal' : 'normal';

  return (
    <KpiCard
      title="Pending QC Release"
      value={data.count}
      subtitle="lots"
      icon={<Clock className="w-5 h-5 text-amber-600" />}
      status={status}
      onClick={onClick}
    >
      {data.items.length > 0 && (
        <div className="text-xs text-gray-500">
          Oldest: {Math.max(...data.items.map((i) => i.daysWaiting))} days waiting
        </div>
      )}
      {data.count === 0 && (
        <div className="text-xs text-green-600">No items pending</div>
      )}
    </KpiCard>
  );
}

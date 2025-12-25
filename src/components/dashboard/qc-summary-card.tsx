'use client';

/**
 * QC Summary Card Component
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US11 - T046)
 * FR-051: QC Summary
 */

import { KpiCard } from './kpi-card';
import { TestTube2 } from 'lucide-react';
import type { QcSummary } from '@/lib/services/audit-dashboard-service';

interface QcSummaryCardProps {
  data: QcSummary;
  onClick?: () => void;
}

export function QcSummaryCard({ data, onClick }: QcSummaryCardProps) {
  const status = data.failedTests > 0 ? 'warning' : 'normal';

  return (
    <KpiCard
      title="QC Summary YTD"
      value={`${data.passRate}%`}
      subtitle="pass rate"
      icon={<TestTube2 className="w-5 h-5 text-purple-600" />}
      status={status}
      onClick={onClick}
    >
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
          Pass: {data.passedTests}
        </span>
        {data.failedTests > 0 && (
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
            Fail: {data.failedTests}
          </span>
        )}
        {data.pendingTests > 0 && (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
            Pending: {data.pendingTests}
          </span>
        )}
      </div>
    </KpiCard>
  );
}

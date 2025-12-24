'use client';

/**
 * FG Approved Card Component
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US11 - T049)
 * FR-054: FG Approved YTD
 */

import { KpiCard } from './kpi-card';
import { CheckCircle2 } from 'lucide-react';
import type { FgApproved } from '@/lib/services/audit-dashboard-service';

interface FgApprovedCardProps {
  data: FgApproved;
  onClick?: () => void;
}

export function FgApprovedCard({ data, onClick }: FgApprovedCardProps) {
  return (
    <KpiCard
      title="FG Approved YTD"
      value={data.totalBatches}
      subtitle="batches"
      icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
      status="normal"
      onClick={onClick}
    >
      <div className="text-sm text-gray-500">
        {data.totalQuantity.toLocaleString()} units total
      </div>
    </KpiCard>
  );
}

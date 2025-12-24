'use client';

/**
 * RM Summary Card Component
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US11 - T042)
 * FR-047: RM Received YTD
 */

import { KpiCard } from './kpi-card';
import { Package } from 'lucide-react';
import type { RmReceivedYtd } from '@/lib/services/audit-dashboard-service';

interface RmSummaryCardProps {
  data: RmReceivedYtd;
  onClick?: () => void;
}

export function RmSummaryCard({ data, onClick }: RmSummaryCardProps) {
  return (
    <KpiCard
      title="RM Received YTD"
      value={data.totalLots}
      subtitle="lots"
      icon={<Package className="w-5 h-5 text-green-600" />}
      status="normal"
      onClick={onClick}
    >
      <div className="text-sm text-gray-500">
        {data.totalQuantity.toLocaleString()} units total
      </div>
    </KpiCard>
  );
}

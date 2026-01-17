'use client';

/**
 * Executive Cost Dashboard Component
 * Feature: 014-unit-cost (US7 - Executive Dashboard)
 * Integrates all 5 dashboard sections with period selection
 */

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { FinancialHealthSection } from './FinancialHealthSection';
import { MaterialCostSection } from './MaterialCostSection';
import { ProductionCostSection } from './ProductionCostSection';
import { MarginAnalysisSection } from './MarginAnalysisSection';
import { AlertsSection } from './AlertsSection';
import type { ExecutiveDashboardKPIs } from '@/types/unit-cost';

interface CostDashboardProps {
  periodType?: string;
  fromDate?: string;
  toDate?: string;
}

async function fetchDashboardKPIs(periodType: string, fromDate?: string, toDate?: string): Promise<ExecutiveDashboardKPIs> {
  const params = new URLSearchParams({ period: periodType });
  if (fromDate) params.set('from', fromDate);
  if (toDate) params.set('to', toDate);

  const res = await fetch(`/api/cost/dashboard?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch dashboard KPIs');
  const json = await res.json();
  return json.data;
}

export function CostDashboard({ periodType = 'this_month', fromDate, toDate }: CostDashboardProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['executive-dashboard-kpis', periodType, fromDate, toDate],
    queryFn: () => fetchDashboardKPIs(periodType, fromDate, toDate),
    staleTime: 60000, // 1 minute
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="cost-dashboard-loading">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500 bg-red-50 rounded-lg" data-testid="cost-dashboard-error">
        Failed to load dashboard data. Please try again.
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6" data-testid="cost-dashboard">
      {/* Period Info */}
      <div className="text-sm text-gray-500">
        Showing data for: <span className="font-medium">{data.period.label}</span>
        {' '}(compared to {data.priorPeriod.label})
      </div>

      {/* Section 1: Financial Health KPIs */}
      <FinancialHealthSection data={data.financialHealth} />

      {/* Section 2: Material Cost Analysis */}
      <MaterialCostSection data={data.materialCosts} />

      {/* Section 3: Production Cost Analysis */}
      <ProductionCostSection data={data.productionCosts} />

      {/* Section 4: Margin Analysis */}
      <MarginAnalysisSection data={data.margins} />

      {/* Section 5: Alerts & Trends */}
      <AlertsSection
        alerts={data.alerts}
        trends={data.trends}
        momComparison={data.momComparison}
      />
    </div>
  );
}

export default CostDashboard;

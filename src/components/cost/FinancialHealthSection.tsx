'use client';

/**
 * FinancialHealthSection Component - Financial Health KPIs section
 * Feature: 014-unit-cost (Executive Dashboard)
 */

import { KPICard } from './KPICard';
import { Package, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import type { FinancialHealthKPIs } from '@/types/unit-cost';

interface FinancialHealthSectionProps {
  data: FinancialHealthKPIs;
}

export function FinancialHealthSection({ data }: FinancialHealthSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="financial-health-section">
      <KPICard
        title="มูลค่าสินค้าคงคลัง"
        icon={<Package className="h-6 w-6 text-blue-600" />}
        kpi={data.inventoryValue}
        format="currency"
        expandable
      >
        <div className="space-y-2">
          {data.inventoryByCategory.map((cat) => (
            <div key={cat.category} className="flex justify-between text-sm">
              <span>{cat.category}</span>
              <span className="font-medium">
                {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(cat.value)} ({cat.percent}%)
              </span>
            </div>
          ))}
        </div>
      </KPICard>

      <KPICard
        title="ต้นทุนขายเดือนนี้"
        icon={<DollarSign className="h-6 w-6 text-orange-600" />}
        kpi={data.cogsMTD}
        format="currency"
      />

      <KPICard
        title="อัตรากำไรขั้นต้น"
        icon={<TrendingUp className="h-6 w-6 text-green-600" />}
        kpi={data.grossMarginPercent}
        format="percent"
      />

      <KPICard
        title="ผลต่างต้นทุน"
        icon={<AlertTriangle className="h-6 w-6 text-yellow-600" />}
        kpi={data.netCostVariance}
        format="currency"
      />
    </div>
  );
}

export default FinancialHealthSection;

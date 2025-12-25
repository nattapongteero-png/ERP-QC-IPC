// src/components/dashboard/sales-kpi-section.tsx
'use client';

import { KPICard } from '@/components/ui/kpi-card';
import { StatCard } from '@/components/ui/stat-card';
import {
  ShoppingBag,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Truck,
} from 'lucide-react';

interface SalesKpis {
  pendingSOs: number;
  soValueMtd: number;
  ordersFulfilledMtd: number;
  atpShortages: number;
  fulfillmentRate: number;
}

interface SalesKpiSectionProps {
  data: SalesKpis;
}

export function SalesKpiSection({ data }: SalesKpiSectionProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-4">
      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Pending Orders"
          value={data.pendingSOs}
          subtitle="Awaiting processing"
          icon={<ShoppingBag className="h-6 w-6" />}
          iconBgColor="bg-orange-100"
          iconColor="text-orange-600"
        />
        <KPICard
          label="Sales Value (MTD)"
          value={formatCurrency(data.soValueMtd)}
          subtitle="Month-to-date"
          icon={<TrendingUp className="h-6 w-6" />}
          iconBgColor="bg-green-100"
          iconColor="text-green-600"
        />
        <KPICard
          label="Orders Fulfilled"
          value={data.ordersFulfilledMtd}
          subtitle="This month"
          icon={<CheckCircle className="h-6 w-6" />}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-600"
        />
        <KPICard
          label="Fulfillment Rate"
          value={`${data.fulfillmentRate}%`}
          subtitle="On-time delivery"
          icon={<Truck className="h-6 w-6" />}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
          trend={data.fulfillmentRate >= 90 ? 'up' : 'down'}
          trendValue={data.fulfillmentRate >= 90 ? 'On track' : 'Below target'}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="ATP Shortages"
          value={data.atpShortages}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant={data.atpShortages > 0 ? 'danger' : 'success'}
          size="md"
        />
      </div>
    </div>
  );
}

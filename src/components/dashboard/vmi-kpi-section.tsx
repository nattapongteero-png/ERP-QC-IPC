// src/components/dashboard/vmi-kpi-section.tsx
'use client';

import { KPICard } from '@/components/ui/kpi-card';
import { StatCard } from '@/components/ui/stat-card';
import {
  RefreshCw,
  Package,
  AlertTriangle,
  Truck,
  DollarSign,
} from 'lucide-react';

interface VMIKpis {
  vmiItems: number;
  lastSyncTime: string | null;
  stockBelowReorder: number;
  pendingAsns: number;
  outstandingOrderValue: number;
}

interface VMIKpiSectionProps {
  data: VMIKpis;
}

export function VMIKpiSection({ data }: VMIKpiSectionProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatSyncTime = (time: string | null) => {
    if (!time) return 'Never';
    const date = new Date(time);
    return date.toLocaleString('th-TH');
  };

  return (
    <div className="space-y-4">
      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="VMI Items"
          value={data.vmiItems}
          subtitle="Managed via VMI"
          icon={<Package className="h-6 w-6" />}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-600"
        />
        <KPICard
          label="Below Reorder"
          value={data.stockBelowReorder}
          subtitle="Need replenishment"
          icon={<AlertTriangle className="h-6 w-6" />}
          iconBgColor={data.stockBelowReorder > 0 ? 'bg-red-100' : 'bg-green-100'}
          iconColor={data.stockBelowReorder > 0 ? 'text-red-600' : 'text-green-600'}
        />
        <KPICard
          label="Pending ASNs"
          value={data.pendingAsns}
          subtitle="Awaiting receipt"
          icon={<Truck className="h-6 w-6" />}
          iconBgColor="bg-orange-100"
          iconColor="text-orange-600"
        />
        <KPICard
          label="Outstanding Value"
          value={formatCurrency(data.outstandingOrderValue)}
          subtitle="VMI orders"
          icon={<DollarSign className="h-6 w-6" />}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Last Sync"
          value={formatSyncTime(data.lastSyncTime)}
          icon={<RefreshCw className="h-5 w-5" />}
          variant="info"
          size="md"
        />
      </div>
    </div>
  );
}

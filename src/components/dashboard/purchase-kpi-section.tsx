// src/components/dashboard/purchase-kpi-section.tsx
'use client';

import { KPICard } from '@/components/ui/kpi-card';
import { StatCard } from '@/components/ui/stat-card';
import {
  ShoppingCart,
  Building2,
  CheckCircle,
  TrendingUp,
  Package,
} from 'lucide-react';

interface PurchaseKpis {
  pendingPOs: number;
  approvedPOs: number;
  poValueMtd: number;
  activeVendors: number;
  onTimeDeliveryRate: number;
  avlCoverage: number;
}

interface PurchaseKpiSectionProps {
  data: PurchaseKpis;
}

export function PurchaseKpiSection({ data }: PurchaseKpiSectionProps) {
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
          label="Pending POs"
          value={data.pendingPOs}
          subtitle="Awaiting approval"
          icon={<ShoppingCart className="h-6 w-6" />}
          iconBgColor="bg-orange-100"
          iconColor="text-orange-600"
        />
        <KPICard
          label="PO Value (MTD)"
          value={formatCurrency(data.poValueMtd)}
          subtitle="Month-to-date"
          icon={<TrendingUp className="h-6 w-6" />}
          iconBgColor="bg-green-100"
          iconColor="text-green-600"
        />
        <KPICard
          label="Active Vendors"
          value={data.activeVendors}
          subtitle="Approved suppliers"
          icon={<Building2 className="h-6 w-6" />}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-600"
        />
        <KPICard
          label="AVL Coverage"
          value={`${data.avlCoverage}%`}
          subtitle="Items with approved vendors"
          icon={<Package className="h-6 w-6" />}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
          trend={data.avlCoverage >= 80 ? 'up' : 'down'}
          trendValue={data.avlCoverage >= 80 ? 'Good coverage' : 'Needs improvement'}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Approved POs"
          value={data.approvedPOs}
          icon={<CheckCircle className="h-5 w-5" />}
          variant="success"
          size="md"
        />
        <StatCard
          label="On-Time Delivery"
          value={`${data.onTimeDeliveryRate}%`}
          icon={<TrendingUp className="h-5 w-5" />}
          variant={data.onTimeDeliveryRate >= 90 ? 'success' : 'warning'}
          size="md"
        />
      </div>
    </div>
  );
}

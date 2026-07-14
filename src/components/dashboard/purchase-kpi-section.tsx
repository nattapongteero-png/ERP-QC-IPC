// src/components/dashboard/purchase-kpi-section.tsx
'use client';

import { useTranslations, useLocale } from 'next-intl';
import { KPICard } from '@/components/ui/kpi-card';
import { StatCard } from '@/components/ui/stat-card';
import {
  ShoppingCart,
  Building2,
  CheckCircle,
  TrendingUp,
  Package,
} from 'lucide-react';

import type { PurchaseKpis } from '@/lib/services/dashboard.service';

interface PurchaseKpiSectionProps {
  data: PurchaseKpis;
}

export function PurchaseKpiSection({ data }: PurchaseKpiSectionProps) {
  const t = useTranslations('dashboard.moduleKpis.purchase');
  const locale = useLocale();

  const formatCurrency = (value: number) => {
    // Currency symbol remains THB but number format follows current locale.
    const formatLocale = locale === 'th' ? 'th-TH' : 'en-US';
    return new Intl.NumberFormat(formatLocale, {
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
          label={t('pendingPOs.label')}
          value={data.pendingPOs}
          subtitle={t('pendingPOs.subtitle')}
          icon={<ShoppingCart className="h-6 w-6" />}
          iconBgColor="bg-orange-100"
          iconColor="text-orange-600"
        />
        <KPICard
          label={t('poValueMtd.label')}
          value={formatCurrency(data.poValueMtd)}
          subtitle={t('poValueMtd.subtitle')}
          icon={<TrendingUp className="h-6 w-6" />}
          iconBgColor="bg-green-100"
          iconColor="text-green-600"
        />
        <KPICard
          label={t('activeVendors.label')}
          value={data.activeVendors}
          subtitle={t('activeVendors.subtitle')}
          icon={<Building2 className="h-6 w-6" />}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-600"
        />
        <KPICard
          label={t('avlCoverage.label')}
          value={`${data.avlCoverage}%`}
          subtitle={t('avlCoverage.subtitle')}
          icon={<Package className="h-6 w-6" />}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
          trend={data.avlCoverage >= 80 ? 'up' : 'down'}
          trendValue={
            data.avlCoverage >= 80
              ? t('avlCoverage.goodCoverage')
              : t('avlCoverage.needsImprovement')
          }
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('approvedPOs.label')}
          value={data.approvedPOs}
          icon={<CheckCircle className="h-5 w-5" />}
          variant="success"
          size="md"
        />
        {/* Null until POs record an actual delivery date. Renders "—" in a
            neutral card rather than the old hardcoded green "95%", which was
            indistinguishable from a real measurement. */}
        <StatCard
          label={t('onTimeDelivery.label')}
          value={
            data.onTimeDeliveryRate === null
              ? '—'
              : `${data.onTimeDeliveryRate}%`
          }
          icon={<TrendingUp className="h-5 w-5" />}
          variant={
            data.onTimeDeliveryRate === null
              ? 'default'
              : data.onTimeDeliveryRate >= 90
                ? 'success'
                : 'warning'
          }
          size="md"
        />
      </div>
    </div>
  );
}

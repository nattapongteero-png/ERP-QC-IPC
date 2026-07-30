// src/components/dashboard/sales-kpi-section.tsx
'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
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
  const t = useTranslations('dashboard.moduleKpis.sales');
  const locale = useLocale();

  const formatCurrency = (value: number) => {
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
        <Link href="/sales/orders?status=draft" data-testid="sales-kpi-pending" className="block rounded-xl">
          <KPICard
            label={t('pendingOrders.label')}
            value={data.pendingSOs}
            subtitle={t('pendingOrders.subtitle')}
            icon={<ShoppingBag className="h-6 w-6" />}
            iconBgColor="bg-orange-100"
            iconColor="text-orange-600"
          />
        </Link>
        <KPICard
          label={t('salesValueMtd.label')}
          value={formatCurrency(data.soValueMtd)}
          subtitle={t('salesValueMtd.subtitle')}
          icon={<TrendingUp className="h-6 w-6" />}
          iconBgColor="bg-green-100"
          iconColor="text-green-600"
        />
        <Link href="/sales/orders?status=delivered" data-testid="sales-kpi-fulfilled" className="block rounded-xl">
          <KPICard
            label={t('ordersFulfilled.label')}
            value={data.ordersFulfilledMtd}
            subtitle={t('ordersFulfilled.subtitle')}
            icon={<CheckCircle className="h-6 w-6" />}
            iconBgColor="bg-blue-100"
            iconColor="text-blue-600"
          />
        </Link>
        <KPICard
          label={t('fulfillmentRate.label')}
          value={`${data.fulfillmentRate}%`}
          subtitle={t('fulfillmentRate.subtitle')}
          icon={<Truck className="h-6 w-6" />}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
          trend={data.fulfillmentRate >= 90 ? 'up' : 'down'}
          trendValue={
            data.fulfillmentRate >= 90
              ? t('fulfillmentRate.onTrack')
              : t('fulfillmentRate.belowTarget')
          }
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('atpShortages.label')}
          value={data.atpShortages}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant={data.atpShortages > 0 ? 'danger' : 'success'}
          size="md"
        />
      </div>
    </div>
  );
}

// src/components/dashboard/vmi-kpi-section.tsx
'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
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
  const t = useTranslations('dashboard.moduleKpis.vmi');
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

  const formatSyncTime = (time: string | null) => {
    if (!time) return t('lastSync.never');
    const date = new Date(time);
    const formatLocale = locale === 'th' ? 'th-TH' : 'en-US';
    return date.toLocaleString(formatLocale);
  };

  return (
    <div className="space-y-4">
      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/vmi" data-testid="vmi-kpi-items" className="block rounded-xl">
          <KPICard
            label={t('vmiItems.label')}
            value={data.vmiItems}
            subtitle={t('vmiItems.subtitle')}
            icon={<Package className="h-6 w-6" />}
            iconBgColor="bg-blue-100"
            iconColor="text-blue-600"
          />
        </Link>
        <KPICard
          label={t('belowReorder.label')}
          value={data.stockBelowReorder}
          subtitle={t('belowReorder.subtitle')}
          icon={<AlertTriangle className="h-6 w-6" />}
          iconBgColor={data.stockBelowReorder > 0 ? 'bg-red-100' : 'bg-green-100'}
          iconColor={data.stockBelowReorder > 0 ? 'text-red-600' : 'text-green-600'}
        />
        <Link href="/sales/vmi-orders" data-testid="vmi-kpi-asns" className="block rounded-xl">
          <KPICard
            label={t('pendingAsns.label')}
            value={data.pendingAsns}
            subtitle={t('pendingAsns.subtitle')}
            icon={<Truck className="h-6 w-6" />}
            iconBgColor="bg-orange-100"
            iconColor="text-orange-600"
          />
        </Link>
        <KPICard
          label={t('outstandingValue.label')}
          value={formatCurrency(data.outstandingOrderValue)}
          subtitle={t('outstandingValue.subtitle')}
          icon={<DollarSign className="h-6 w-6" />}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('lastSync.label')}
          value={formatSyncTime(data.lastSyncTime)}
          icon={<RefreshCw className="h-5 w-5" />}
          variant="info"
          size="md"
        />
      </div>
    </div>
  );
}

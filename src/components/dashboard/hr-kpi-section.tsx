// src/components/dashboard/hr-kpi-section.tsx
'use client';

import { useTranslations } from 'next-intl';
import { KPICard } from '@/components/ui/kpi-card';
import { StatCard } from '@/components/ui/stat-card';
import {
  Users,
  GraduationCap,
  HeartPulse,
  Shield,
  Bell,
} from 'lucide-react';

interface HRKpis {
  totalEmployees: number;
  activeEmployees: number;
  trainingCompliance: number;
  healthRecordsDue: number;
  gmpAuthorized: number;
  pendingNotifications: number;
}

interface HRKpiSectionProps {
  data: HRKpis;
}

export function HRKpiSection({ data }: HRKpiSectionProps) {
  const t = useTranslations('dashboard.moduleKpis.hr');

  return (
    <div className="space-y-4">
      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label={t('totalEmployees.label')}
          value={data.totalEmployees}
          subtitle={t('totalEmployees.subtitleActive', { count: data.activeEmployees })}
          icon={<Users className="h-6 w-6" />}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-600"
        />
        <KPICard
          label={t('trainingCompliance.label')}
          value={`${data.trainingCompliance}%`}
          subtitle={t('trainingCompliance.subtitle')}
          icon={<GraduationCap className="h-6 w-6" />}
          iconBgColor="bg-green-100"
          iconColor="text-green-600"
          trend={data.trainingCompliance >= 90 ? 'up' : 'down'}
          trendValue={
            data.trainingCompliance >= 90
              ? t('trainingCompliance.onTrack')
              : t('trainingCompliance.needsAttention')
          }
        />
        <KPICard
          label={t('healthRecordsDue.label')}
          value={data.healthRecordsDue}
          subtitle={t('healthRecordsDue.subtitle')}
          icon={<HeartPulse className="h-6 w-6" />}
          iconBgColor={data.healthRecordsDue > 0 ? 'bg-red-100' : 'bg-gray-100'}
          iconColor={data.healthRecordsDue > 0 ? 'text-red-600' : 'text-gray-600'}
        />
        <KPICard
          label={t('gmpAuthorized.label')}
          value={data.gmpAuthorized}
          subtitle={t('gmpAuthorized.subtitle')}
          icon={<Shield className="h-6 w-6" />}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('notifications.label')}
          value={data.pendingNotifications}
          icon={<Bell className="h-5 w-5" />}
          variant={data.pendingNotifications > 0 ? 'warning' : 'info'}
          size="md"
        />
      </div>
    </div>
  );
}

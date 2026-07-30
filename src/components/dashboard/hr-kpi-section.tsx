// src/components/dashboard/hr-kpi-section.tsx
'use client';

import Link from 'next/link';
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
        {/* Every card here was a bare KPICard with no link, so clicking one did
            nothing. Each destination is chosen so the list that opens shows the
            same records the number counted — a link landing on a different
            count is worse than no link, because it teaches the user not to
            trust the figures. */}
        <Link href="/hr/employees" data-testid="hr-kpi-total-employees" className="block rounded-xl">
          <KPICard
            label={t('totalEmployees.label')}
            value={data.totalEmployees}
            subtitle={t('totalEmployees.subtitleActive', { count: data.activeEmployees })}
            icon={<Users className="h-6 w-6" />}
            iconBgColor="bg-blue-100"
            iconColor="text-blue-600"
          />
        </Link>
        {/* The matrix is the page that shows WHICH employee is missing WHICH
            course, i.e. where a 43% figure actually comes from. */}
        <Link href="/hr/training/matrix" data-testid="hr-kpi-training" className="block rounded-xl">
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
        </Link>
        <Link href="/hr/health-records" data-testid="hr-kpi-health-due" className="block rounded-xl">
          <KPICard
            label={t('healthRecordsDue.label')}
            value={data.healthRecordsDue}
            subtitle={t('healthRecordsDue.subtitle')}
            icon={<HeartPulse className="h-6 w-6" />}
            iconBgColor={data.healthRecordsDue > 0 ? 'bg-red-100' : 'bg-gray-100'}
            iconColor={data.healthRecordsDue > 0 ? 'text-red-600' : 'text-gray-600'}
          />
        </Link>
        <Link href="/hr/authorizations" data-testid="hr-kpi-gmp-auth" className="block rounded-xl">
          <KPICard
            label={t('gmpAuthorized.label')}
            value={data.gmpAuthorized}
            subtitle={t('gmpAuthorized.subtitle')}
            icon={<Shield className="h-6 w-6" />}
            iconBgColor="bg-purple-100"
            iconColor="text-purple-600"
          />
        </Link>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/hr/notifications" data-testid="hr-kpi-notifications" className="block rounded-xl">
          <StatCard
            label={t('notifications.label')}
            value={data.pendingNotifications}
            icon={<Bell className="h-5 w-5" />}
            variant={data.pendingNotifications > 0 ? 'warning' : 'info'}
            size="md"
          />
        </Link>
      </div>
    </div>
  );
}

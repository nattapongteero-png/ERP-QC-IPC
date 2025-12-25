// src/components/dashboard/hr-kpi-section.tsx
'use client';

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
  return (
    <div className="space-y-4">
      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Employees"
          value={data.totalEmployees}
          subtitle={`${data.activeEmployees} active`}
          icon={<Users className="h-6 w-6" />}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-600"
        />
        <KPICard
          label="Training Compliance"
          value={`${data.trainingCompliance}%`}
          subtitle="Up-to-date training"
          icon={<GraduationCap className="h-6 w-6" />}
          iconBgColor="bg-green-100"
          iconColor="text-green-600"
          trend={data.trainingCompliance >= 90 ? 'up' : 'down'}
          trendValue={data.trainingCompliance >= 90 ? 'On track' : 'Needs attention'}
        />
        <KPICard
          label="Health Records Due"
          value={data.healthRecordsDue}
          subtitle="Overdue examinations"
          icon={<HeartPulse className="h-6 w-6" />}
          iconBgColor={data.healthRecordsDue > 0 ? 'bg-red-100' : 'bg-gray-100'}
          iconColor={data.healthRecordsDue > 0 ? 'text-red-600' : 'text-gray-600'}
        />
        <KPICard
          label="GMP Authorized"
          value={data.gmpAuthorized}
          subtitle="Active authorizations"
          icon={<Shield className="h-6 w-6" />}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Notifications"
          value={data.pendingNotifications}
          icon={<Bell className="h-5 w-5" />}
          variant={data.pendingNotifications > 0 ? 'warning' : 'info'}
          size="md"
        />
      </div>
    </div>
  );
}

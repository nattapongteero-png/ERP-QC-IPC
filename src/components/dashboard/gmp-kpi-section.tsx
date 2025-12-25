// src/components/dashboard/gmp-kpi-section.tsx
'use client';

import { KPICard } from '@/components/ui/kpi-card';
import { StatCard } from '@/components/ui/stat-card';
import {
  Shield,
  AlertTriangle,
  FileWarning,
  ClipboardCheck,
  GraduationCap,
} from 'lucide-react';

interface GMPKpis {
  overallScore: number;
  openDeviations: number;
  openCapas: number;
  openAuditFindings: number;
  trainingGaps: number;
}

interface GMPKpiSectionProps {
  data: GMPKpis;
}

export function GMPKpiSection({ data }: GMPKpiSectionProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return { bg: 'bg-green-100', text: 'text-green-600' };
    if (score >= 70) return { bg: 'bg-yellow-100', text: 'text-yellow-600' };
    return { bg: 'bg-red-100', text: 'text-red-600' };
  };

  const scoreColor = getScoreColor(data.overallScore);

  return (
    <div className="space-y-4">
      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Compliance Score"
          value={`${data.overallScore}%`}
          subtitle="Overall GMP compliance"
          icon={<Shield className="h-6 w-6" />}
          iconBgColor={scoreColor.bg}
          iconColor={scoreColor.text}
          trend={data.overallScore >= 90 ? 'up' : data.overallScore >= 70 ? 'neutral' : 'down'}
          trendValue={data.overallScore >= 90 ? 'Excellent' : data.overallScore >= 70 ? 'Good' : 'Needs attention'}
        />
        <KPICard
          label="Open Deviations"
          value={data.openDeviations}
          subtitle="Pending resolution"
          icon={<AlertTriangle className="h-6 w-6" />}
          iconBgColor={data.openDeviations > 0 ? 'bg-red-100' : 'bg-gray-100'}
          iconColor={data.openDeviations > 0 ? 'text-red-600' : 'text-gray-600'}
        />
        <KPICard
          label="Open CAPAs"
          value={data.openCapas}
          subtitle="Corrective actions"
          icon={<FileWarning className="h-6 w-6" />}
          iconBgColor={data.openCapas > 0 ? 'bg-orange-100' : 'bg-gray-100'}
          iconColor={data.openCapas > 0 ? 'text-orange-600' : 'text-gray-600'}
        />
        <KPICard
          label="Audit Findings"
          value={data.openAuditFindings}
          subtitle="Open findings"
          icon={<ClipboardCheck className="h-6 w-6" />}
          iconBgColor={data.openAuditFindings > 0 ? 'bg-yellow-100' : 'bg-gray-100'}
          iconColor={data.openAuditFindings > 0 ? 'text-yellow-600' : 'text-gray-600'}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Training Gaps"
          value={data.trainingGaps}
          icon={<GraduationCap className="h-5 w-5" />}
          variant={data.trainingGaps > 0 ? 'warning' : 'success'}
          size="md"
        />
      </div>
    </div>
  );
}

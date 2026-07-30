// src/components/dashboard/gmp-kpi-section.tsx
'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { KPICard } from '@/components/ui/kpi-card';
import { StatCard } from '@/components/ui/stat-card';
import {
  Shield,
  AlertTriangle,
  FileWarning,
  ClipboardCheck,
  GraduationCap,
} from 'lucide-react';

import type { GMPKpis } from '@/lib/services/dashboard.service';

interface GMPKpiSectionProps {
  data: GMPKpis;
}

export function GMPKpiSection({ data }: GMPKpiSectionProps) {
  const t = useTranslations('dashboard.moduleKpis.gmp');

  const hasOpenIssues = data.openIssues > 0;

  return (
    <div className="space-y-4">
      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Outstanding GMP work, not a "compliance score". The score this
            replaced was 100 - (issues * 5): an invented weight, tied to no GMP
            chapter, that read a perfect 100% on an empty database. */}
        {/* Deliberately NOT a link: this number is the SUM of the other four
            cards (deviations + CAPAs + findings + training gaps), so no single
            page can show a matching count. */}
        <KPICard
            label={t('openIssues.label')}
            value={data.openIssues}
            subtitle={t('openIssues.subtitle')}
            icon={<Shield className="h-6 w-6" />}
            iconBgColor={hasOpenIssues ? 'bg-yellow-100' : 'bg-green-100'}
            iconColor={hasOpenIssues ? 'text-yellow-600' : 'text-green-600'}
          />
        <Link href="/quality/deviations?status=active" data-testid="gmp-kpi-deviations" className="block rounded-xl">
          <KPICard
            label={t('openDeviations.label')}
            value={data.openDeviations}
            subtitle={t('openDeviations.subtitle')}
            icon={<AlertTriangle className="h-6 w-6" />}
            iconBgColor={data.openDeviations > 0 ? 'bg-red-100' : 'bg-gray-100'}
            iconColor={data.openDeviations > 0 ? 'text-red-600' : 'text-gray-600'}
          />
        </Link>
        <Link href="/gmp/capa" data-testid="gmp-kpi-capa" className="block rounded-xl">
          <KPICard
            label={t('openCapas.label')}
            value={data.openCapas}
            subtitle={t('openCapas.subtitle')}
            icon={<FileWarning className="h-6 w-6" />}
            iconBgColor={data.openCapas > 0 ? 'bg-orange-100' : 'bg-gray-100'}
            iconColor={data.openCapas > 0 ? 'text-orange-600' : 'text-gray-600'}
          />
        </Link>
        <Link href="/gmp/internal-audit" data-testid="gmp-kpi-audit" className="block rounded-xl">
          <KPICard
            label={t('auditFindings.label')}
            value={data.openAuditFindings}
            subtitle={t('auditFindings.subtitle')}
            icon={<ClipboardCheck className="h-6 w-6" />}
            iconBgColor={data.openAuditFindings > 0 ? 'bg-yellow-100' : 'bg-gray-100'}
            iconColor={data.openAuditFindings > 0 ? 'text-yellow-600' : 'text-gray-600'}
          />
        </Link>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/hr/training/matrix" data-testid="gmp-kpi-training" className="block rounded-xl">
          <StatCard
            label={t('trainingGaps.label')}
            value={data.trainingGaps}
            icon={<GraduationCap className="h-5 w-5" />}
            variant={data.trainingGaps > 0 ? 'warning' : 'success'}
            size="md"
          />
        </Link>
      </div>
    </div>
  );
}

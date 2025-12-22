'use client';

/**
 * Internal Audit Dashboard Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * Overview of internal audit program with statistics and quick actions.
 */

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { AuditStatisticsCard } from '@/components/internal-audit';
import { DxButton } from '@/components/ui/dx-button';
import {
  ClipboardCheck,
  FileSearch,
  AlertTriangle,
  Calendar,
  TrendingUp,
  ListChecks,
} from 'lucide-react';
import type { AuditStatistics, ChapterCoverage, AuditPlan } from '@/types/audits';

// ============================================
// API Functions
// ============================================

async function fetchStatistics(): Promise<AuditStatistics> {
  const year = new Date().getFullYear();
  const response = await fetch(`/api/internal-audit/statistics?year=${year}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data.statistics;
}

async function fetchChapterCoverage(): Promise<ChapterCoverage> {
  const year = new Date().getFullYear();
  const response = await fetch(`/api/internal-audit/statistics?year=${year}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data.chapterCoverage;
}

async function fetchActivePlan(): Promise<AuditPlan | null> {
  const year = new Date().getFullYear();
  const response = await fetch(`/api/internal-audit/plans?year=${year}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  const plans = result.data.plans || [];
  return plans.find((p: AuditPlan) => p.status === 'approved') || plans[0] || null;
}

// ============================================
// Component
// ============================================

export default function InternalAuditDashboardPage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();

  const { data: statistics, isLoading: statsLoading } = useQuery({
    queryKey: ['audit-statistics', currentYear],
    queryFn: fetchStatistics,
  });

  const { data: chapterCoverage, isLoading: coverageLoading } = useQuery({
    queryKey: ['audit-chapter-coverage', currentYear],
    queryFn: fetchChapterCoverage,
  });

  const { data: activePlan, isLoading: planLoading } = useQuery({
    queryKey: ['audit-active-plan', currentYear],
    queryFn: fetchActivePlan,
  });

  const isLoading = statsLoading || coverageLoading || planLoading;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title="Internal Audit Program"
        subtitle="Thai FDA GMP หมวด 10 - Self-Inspection & Internal Audits"
        onBack={() => router.push('/gmp')}
        actions={
          <div className="flex gap-2">
            <DxButton
              text="Audit Plans"
              icon="event"
              onClick={() => router.push('/gmp/internal-audit/plans')}
              stylingMode="outlined"
            />
            <DxButton
              text="Schedule Audit"
              icon="plus"
              onClick={() => router.push('/gmp/internal-audit/audits?new=1')}
              type="default"
            />
          </div>
        }
      />

      {/* Active Plan Banner */}
      {activePlan && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-medium text-blue-800 dark:text-blue-200">
                  {activePlan.name}
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {activePlan.completedAudits} of {activePlan.totalAudits} audits completed
                </p>
              </div>
            </div>
            <DxButton
              text="View Plan"
              onClick={() => router.push('/gmp/internal-audit/plans')}
              stylingMode="outlined"
            />
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <ClipboardCheck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statistics?.totalPlanned || 0}</p>
              <p className="text-sm text-muted-foreground">Planned</p>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <ListChecks className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statistics?.totalCompleted || 0}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <FileSearch className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statistics?.totalFindings || 0}</p>
              <p className="text-sm text-muted-foreground">Findings</p>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statistics?.openFindings || 0}</p>
              <p className="text-sm text-muted-foreground">Open</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => router.push('/gmp/internal-audit/plans')}
          className="bg-card border rounded-lg p-6 text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="font-semibold">Audit Plans</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            View and manage annual audit plans
          </p>
        </button>

        <button
          onClick={() => router.push('/gmp/internal-audit/audits')}
          className="bg-card border rounded-lg p-6 text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <ClipboardCheck className="h-5 w-5 text-green-600" />
            </div>
            <h3 className="font-semibold">Audits</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Execute and track internal audits
          </p>
        </button>

        <button
          onClick={() => router.push('/gmp/internal-audit/findings')}
          className="bg-card border rounded-lg p-6 text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </div>
            <h3 className="font-semibold">Findings & CAPA</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage findings and corrective actions
          </p>
        </button>
      </div>

      {/* Statistics & Charts */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Audit Statistics ({currentYear})
        </h2>
        <AuditStatisticsCard
          statistics={statistics || null}
          chapterCoverage={chapterCoverage || null}
          loading={isLoading}
        />
      </div>

      {/* Open Findings Alert */}
      {statistics && statistics.openFindings > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-orange-800 dark:text-orange-200">
                Open Audit Findings
              </h3>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                {statistics.openFindings} finding(s) require attention.
                {statistics.findingsByCategory.critical > 0 &&
                  ` Including ${statistics.findingsByCategory.critical} critical finding(s).`}
              </p>
            </div>
            <DxButton
              text="View Findings"
              onClick={() => router.push('/gmp/internal-audit/findings?status=open')}
              stylingMode="outlined"
              type="danger"
            />
          </div>
        </div>
      )}
    </div>
  );
}

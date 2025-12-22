'use client';

/**
 * Sanitation Dashboard Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * Overview of sanitation program with pending tasks and quick stats.
 */

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import {
  Sparkles,
  Calendar,
  AlertTriangle,
  Bug,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';
import type { PendingTask, SanitationTrends } from '@/types/sanitation';

// ============================================
// API Functions
// ============================================

async function fetchPendingTasks(): Promise<PendingTask[]> {
  const response = await fetch('/api/sanitation/pending?daysAhead=7');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function fetchTrends(): Promise<SanitationTrends> {
  const response = await fetch('/api/sanitation/trends?period=week');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

// ============================================
// Component
// ============================================

export default function SanitationDashboardPage() {
  const router = useRouter();

  const { data: pendingTasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['sanitation-pending'],
    queryFn: fetchPendingTasks,
  });

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['sanitation-trends-week'],
    queryFn: fetchTrends,
  });

  const isLoading = tasksLoading || trendsLoading;

  const overdueCount = pendingTasks?.filter((t) => t.isOverdue).length || 0;
  const upcomingCount = pendingTasks?.filter((t) => !t.isOverdue).length || 0;

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="grid grid-cols-4 gap-4">
            <div className="h-24 bg-muted rounded" />
            <div className="h-24 bg-muted rounded" />
            <div className="h-24 bg-muted rounded" />
            <div className="h-24 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title="Sanitation Management"
        subtitle="Thai FDA GMP หมวด 4 - Sanitation & Pest Control"
        onBack={() => router.push('/gmp')}
        actions={
          <div className="flex gap-2">
            <DxButton
              text="View Schedules"
              icon="event"
              onClick={() => router.push('/gmp/sanitation/schedules')}
              stylingMode="outlined"
            />
            <DxButton
              text="Record Log"
              icon="plus"
              onClick={() => router.push('/gmp/sanitation/logs?new=1')}
              type="default"
            />
          </div>
        }
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {trends?.overallComplianceRate.toFixed(0) || 0}%
              </p>
              <p className="text-sm text-muted-foreground">Compliance</p>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overdueCount}</p>
              <p className="text-sm text-muted-foreground">Overdue</p>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{upcomingCount}</p>
              <p className="text-sm text-muted-foreground">Upcoming</p>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Bug className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {trends?.pestActivityTrend?.reduce((sum, t) => sum + t.findingsCount, 0) || 0}
              </p>
              <p className="text-sm text-muted-foreground">Pest Findings</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => router.push('/gmp/sanitation/schedules')}
          className="bg-card border rounded-lg p-6 text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Sparkles className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="font-semibold">Sanitation Schedules</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage cleaning schedules and frequencies
          </p>
        </button>

        <button
          onClick={() => router.push('/gmp/sanitation/pest-control')}
          className="bg-card border rounded-lg p-6 text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Bug className="h-5 w-5 text-orange-600" />
            </div>
            <h3 className="font-semibold">Pest Control</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Record and track pest control services
          </p>
        </button>

        <button
          onClick={() => router.push('/gmp/sanitation/trends')}
          className="bg-card border rounded-lg p-6 text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <h3 className="font-semibold">Trends & Analytics</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            View compliance trends and statistics
          </p>
        </button>
      </div>

      {/* Pending Tasks */}
      {pendingTasks && pendingTasks.length > 0 && (
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Pending Tasks</h2>
          <div className="space-y-3">
            {pendingTasks.slice(0, 10).map((task) => (
              <div
                key={`${task.scheduleId}-${task.dueDate}`}
                className={`flex items-center justify-between p-4 border rounded-lg ${
                  task.isOverdue
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200'
                    : 'bg-muted/50'
                }`}
              >
                <div>
                  <h3 className="font-medium">{task.scheduleName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {task.areaType} - {task.frequency}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`font-medium ${
                      task.isOverdue ? 'text-red-600' : 'text-muted-foreground'
                    }`}
                  >
                    {task.isOverdue
                      ? `${task.daysOverdue} days overdue`
                      : `Due: ${task.dueDate}`}
                  </p>
                  <DxButton
                    text="Record"
                    onClick={() =>
                      router.push(`/gmp/sanitation/logs?scheduleId=${task.scheduleId}&new=1`)
                    }
                    stylingMode="text"
                    type="default"
                  />
                </div>
              </div>
            ))}
          </div>
          {pendingTasks.length > 10 && (
            <div className="mt-4 text-center">
              <DxButton
                text={`View All (${pendingTasks.length})`}
                onClick={() => router.push('/gmp/sanitation/logs')}
                stylingMode="outlined"
              />
            </div>
          )}
        </div>
      )}

      {/* Overdue Alert */}
      {overdueCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-800 dark:text-red-200">
                Overdue Sanitation Tasks
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                {overdueCount} sanitation task(s) are overdue. Please complete them as soon as
                possible to maintain GMP compliance.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

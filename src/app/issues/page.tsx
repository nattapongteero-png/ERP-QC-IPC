'use client';

/**
 * Issues Dashboard Page
 * Feature: Issue Tracker
 *
 * Main dashboard showing issue statistics, charts, and quick actions.
 */

import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import {
  AlertTriangle,
  Bug,
  CheckCircle,
  Clock,
  Plus,
  ChevronRight,
  TrendingUp,
  Users,
  AlertCircle,
  ListTodo,
} from 'lucide-react';

import { PieChart, Series, Label, Legend, Tooltip, Connector } from 'devextreme-react/pie-chart';
import {
  Chart,
  CommonSeriesSettings,
  Series as ChartSeries,
  ArgumentAxis,
  ValueAxis,
  Legend as ChartLegend,
  Tooltip as ChartTooltip,
  Size,
  Label as AxisLabel,
} from 'devextreme-react/chart';

import { KPICard, KPICardSkeleton } from '@/components/ui/kpi-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from 'devextreme-react/button';
import { StatusBadge, SeverityBadge, PriorityBadge } from '@/components/issues';
import { ResponsivePageHeader } from '@/components/shared';
import type { IssueDashboardMetrics, Issue } from '@/types/issues';

// ============================================
// API Functions
// ============================================

async function fetchDashboardMetrics(): Promise<IssueDashboardMetrics> {
  const res = await fetch('/api/issues/dashboard');
  if (!res.ok) throw new Error('Failed to fetch dashboard metrics');
  const data = await res.json();
  return data.data;
}

async function fetchRecentIssues(): Promise<Issue[]> {
  const res = await fetch('/api/issues?limit=5&sortBy=createdAt&sortOrder=desc');
  if (!res.ok) throw new Error('Failed to fetch recent issues');
  const data = await res.json();
  return data.data?.items || [];
}

// ============================================
// Color Constants
// ============================================

const STATUS_COLORS: Record<string, string> = {
  draft: '#6B7280',
  submitted: '#3B82F6',
  triaged: '#8B5CF6',
  in_progress: '#6366F1',
  resolved: '#22C55E',
  verified: '#10B981',
  closed: '#9CA3AF',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  major: '#F97316',
  minor: '#EAB308',
};

// ============================================
// Page Header Component
// ============================================

function IssuesPageHeader() {
  const t = useTranslations('issues');
  return (
    <div className="mb-4 md:mb-6">
      <ResponsivePageHeader
        title={t('page.title')}
        subtitle={t('page.description')}
        icon={Bug}
        iconBgColor="bg-rose-100"
        iconColor="text-rose-600"
        actions={
          <>
            <Link href="/issues/list">
              <Button
                text={t('actions.viewAll')}
                type="normal"
                stylingMode="outlined"
                icon="search"
              />
            </Link>
            <Link href="/issues/new">
              <Button
                text={t('actions.reportIssue')}
                type="default"
                stylingMode="contained"
                icon="add"
                data-testid="new-issue-btn"
              />
            </Link>
          </>
        }
      />
    </div>
  );
}

// ============================================
// KPI Cards Section
// ============================================

function KPICardsSection({ metrics }: { metrics: IssueDashboardMetrics }) {
  const t = useTranslations('issues');
  // Find critical count from severity breakdown
  const criticalCount = metrics.issuesBySeverity.find(s => s.severity === 'critical')?.count || 0;
  // Convert avgResolutionTime from hours to days
  const avgResolutionDays = Math.round(metrics.avgResolutionTime / 24);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <KPICard
        label={t('kpi.openIssues')}
        value={metrics.openIssues}
        icon={<AlertCircle className="w-5 h-5" />}
        trend={metrics.openIssues > 0 ? 'up' : 'neutral'}
        subtitle={t('kpi.issuesRequiringAttention')}
      />
      <KPICard
        label={t('kpi.criticalIssues')}
        value={criticalCount}
        icon={<AlertTriangle className="w-5 h-5" />}
        trend={criticalCount > 0 ? 'up' : 'neutral'}
        trendValue={criticalCount > 0 ? t('kpi.actionRequired') : t('kpi.allClear')}
        className={criticalCount > 0 ? 'border-red-200 bg-red-50' : ''}
      />
      <KPICard
        label={t('kpi.resolvedThisWeek')}
        value={metrics.issuesResolvedThisWeek}
        icon={<CheckCircle className="w-5 h-5" />}
        trend="up"
        subtitle={t('kpi.issuesClosedThisWeek')}
      />
      <KPICard
        label={t('kpi.avgResolutionTime')}
        value={`${avgResolutionDays} ${t('kpi.days')}`}
        icon={<Clock className="w-5 h-5" />}
        trend={avgResolutionDays < 7 ? 'down' : 'up'}
        subtitle={t('kpi.averageTimeToResolve')}
      />
    </div>
  );
}

// ============================================
// Charts Section
// ============================================

function ChartsSection({ metrics }: { metrics: IssueDashboardMetrics }) {
  const t = useTranslations('issues');
  const locale = useLocale();
  // Transform data for pie charts
  const statusData = metrics.issuesByStatus.map((item) => ({
    status: item.status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    count: item.count,
    color: STATUS_COLORS[item.status] || '#6B7280',
  }));

  const severityData = metrics.issuesBySeverity.map((item) => ({
    severity: item.severity.replace(/\b\w/g, (c) => c.toUpperCase()),
    count: item.count,
    color: SEVERITY_COLORS[item.severity] || '#6B7280',
  }));

  const categoryData = metrics.issuesByCategory.map((item) => ({
    category: item.categoryName || t('recent.uncategorized'),
    count: item.count,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="w-5 h-5" />
            {t('charts.byStatus')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PieChart
            key={locale}
            dataSource={statusData}
            palette={statusData.map((d) => d.color)}
            resolveLabelOverlapping="shift"
            diameter={0.65}
            sizeGroup="issues-pie"
          >
            <Series argumentField="status" valueField="count">
              <Label
                visible={true}
                position="columns"
                backgroundColor="none"
                customizeText={(arg: { argumentText: string; valueText: string; percentText: string }) =>
                  `${arg.argumentText}: ${arg.valueText} (${arg.percentText})`
                }
                font={{ size: 11 }}
              >
                <Connector visible={true} width={1} />
              </Label>
            </Series>
            <Legend
              orientation="vertical"
                horizontalAlignment="right"
                verticalAlignment="top"
              font={{ size: 11 }}
              rowCount={1}
            />
            <Tooltip enabled={true} />
            <Size height={300} />
          </PieChart>
        </CardContent>
      </Card>

      {/* Severity Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            {t('charts.bySeverity')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PieChart
            key={locale}
            dataSource={severityData}
            palette={severityData.map((d) => d.color)}
            type="doughnut"
            innerRadius={0.5}
            resolveLabelOverlapping="shift"
            diameter={0.65}
            sizeGroup="issues-pie"
          >
            <Series argumentField="severity" valueField="count">
              <Label
                visible={true}
                position="columns"
                backgroundColor="none"
                customizeText={(arg: { argumentText: string; valueText: string; percentText: string }) =>
                  `${arg.argumentText}: ${arg.valueText} (${arg.percentText})`
                }
                font={{ size: 11 }}
              >
                <Connector visible={true} width={1} />
              </Label>
            </Series>
            <Legend
              orientation="vertical"
                horizontalAlignment="right"
                verticalAlignment="top"
              font={{ size: 11 }}
              rowCount={1}
            />
            <Tooltip enabled={true} />
            <Size height={300} />
          </PieChart>
        </CardContent>
      </Card>

      {/* Category Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="w-5 h-5" />
            {t('charts.byCategory')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Chart key={locale} dataSource={categoryData}>
            <CommonSeriesSettings type="bar" argumentField="category" />
            <ChartSeries valueField="count" name={t('charts.seriesName')} color="#3B82F6" />
            <ArgumentAxis>
              <AxisLabel rotationAngle={-45} />
            </ArgumentAxis>
            <ValueAxis />
            <ChartLegend visible={false} />
            <ChartTooltip enabled={true} />
            <Size height={250} />
          </Chart>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Recent Issues Section
// ============================================

function RecentIssuesSection({ issues }: { issues: Issue[] }) {
  const t = useTranslations('issues');
  if (issues.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {t('recent.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Bug className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('recent.noIssues')}</p>
            <Link href="/issues/new" className="text-blue-600 hover:underline mt-2 inline-block">
              {t('recent.reportFirst')}
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {t('recent.title')}
        </CardTitle>
        <Link href="/issues/list" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          {t('recent.viewAll')} <ChevronRight className="w-4 h-4" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {issues.map((issue) => (
            <Link
              key={issue.id}
              href={`/issues/${issue.id}`}
              className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-mono text-gray-500">
                      {issue.issueNumber}
                    </span>
                    <StatusBadge status={issue.status} size="sm" />
                    <SeverityBadge severity={issue.severity} size="sm" />
                  </div>
                  <h3 className="font-medium text-gray-900 truncate">
                    {issue.title}
                  </h3>
                </div>
                {issue.priority && (
                  <PriorityBadge priority={issue.priority} size="sm" />
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>
                  {issue.category?.name || t('recent.uncategorized')}
                </span>
                <span>
                  {new Date(issue.createdAt).toLocaleDateString()}
                </span>
                {issue.assignee && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {issue.assignee.name}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Quick Actions Section
// ============================================

function QuickActionsSection() {
  const t = useTranslations('issues');
  const actions = [
    {
      title: t('quickActions.reportNew'),
      description: t('quickActions.reportNewDescription'),
      href: '/issues/new',
      icon: <Plus className="w-5 h-5" />,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: t('quickActions.viewAll'),
      description: t('quickActions.viewAllDescription'),
      href: '/issues/list',
      icon: <ListTodo className="w-5 h-5" />,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      title: t('quickActions.criticalIssues'),
      description: t('quickActions.criticalDescription'),
      href: '/issues/list?severity=critical',
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'bg-red-100 text-red-600',
    },
    {
      title: t('quickActions.myAssigned'),
      description: t('quickActions.myAssignedDescription'),
      href: '/issues/list?assignedToMe=true',
      icon: <Users className="w-5 h-5" />,
      color: 'bg-green-100 text-green-600',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          {t('quickActions.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className={`p-2 rounded-lg ${action.color}`}>
                {action.icon}
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{action.title}</h3>
                <p className="text-sm text-gray-500">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Loading Skeleton
// ============================================

function DashboardSkeleton() {
  return (
    <div className="p-6">
      <div className="h-8 bg-gray-200 rounded w-1/4 mb-6 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-80 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function IssuesDashboardPage() {
  const t = useTranslations('issues');
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useQuery({
    queryKey: ['issues-dashboard'],
    queryFn: fetchDashboardMetrics,
  });

  const { data: recentIssues } = useQuery({
    queryKey: ['issues-recent'],
    queryFn: fetchRecentIssues,
  });

  if (metricsLoading) {
    return <DashboardSkeleton />;
  }

  if (metricsError) {
    return (
      <div className="p-6">
        <IssuesPageHeader />
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-red-500" />
          <h2 className="text-lg font-semibold text-red-700 mb-2">
            {t('error.loadFailed')}
          </h2>
          <p className="text-red-600">
            {metricsError.message || t('error.genericError')}
          </p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="p-4 md:p-6" data-testid="issues-dashboard">
      <IssuesPageHeader />
      <KPICardsSection metrics={metrics} />
      <ChartsSection metrics={metrics} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <RecentIssuesSection issues={recentIssues || []} />
        <QuickActionsSection />
      </div>
    </div>
  );
}

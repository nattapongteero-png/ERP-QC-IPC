'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/shared';
import { ResponsivePageHeader } from '@/components/shared';
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  AlertOctagon,
  CheckCircle2,
  FileWarning,
  BarChart3,
  LayoutGrid,
  List,
  Search,
  Factory,
  Package,
  Microscope,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import PieChart, { Series, Legend, Tooltip, Label } from 'devextreme-react/pie-chart';
import type { DataGridTypes } from 'devextreme-react/data-grid';

// ============================================================================
// Types
// ============================================================================

interface Deviation {
  id: number;
  deviationNumber: string;
  title: string;
  description: string;
  sourceType: string;
  sourceId: number;
  severity: string;
  status: string;
  rootCause: string;
  correctiveAction: string;
  preventiveAction: string;
  reportedBy: number;
  assignedTo: number;
  dueDate: string;
  closedBy: number;
  closedAt: string;
  createdAt: string;
  updatedAt: string;
}

type ViewMode = 'grid' | 'cards' | 'analytics';

// ============================================================================
// Configuration Constants (labels removed - use t() instead)
// ============================================================================

const STATUS_CONFIG = {
  open: {
    color: '#3b82f6',
    bgClass: 'bg-blue-50 border-blue-200',
    textClass: 'text-blue-700',
    icon: AlertCircle,
    badgeVariant: 'default' as const,
  },
  investigating: {
    color: '#f59e0b',
    bgClass: 'bg-amber-50 border-amber-200',
    textClass: 'text-amber-700',
    icon: Search,
    badgeVariant: 'warning' as const,
  },
  resolved: {
    color: '#06b6d4',
    bgClass: 'bg-cyan-50 border-cyan-200',
    textClass: 'text-cyan-700',
    icon: CheckCircle2,
    badgeVariant: 'info' as const,
  },
  closed: {
    color: '#22c55e',
    bgClass: 'bg-green-50 border-green-200',
    textClass: 'text-green-700',
    icon: CheckCircle2,
    badgeVariant: 'success' as const,
  },
};

const SEVERITY_CONFIG = {
  minor: {
    color: '#6b7280',
    bgClass: 'bg-gray-50 border-gray-200',
    textClass: 'text-gray-700',
    badgeVariant: 'default' as const,
  },
  major: {
    color: '#f59e0b',
    bgClass: 'bg-amber-50 border-amber-200',
    textClass: 'text-amber-700',
    badgeVariant: 'warning' as const,
  },
  critical: {
    color: '#ef4444',
    bgClass: 'bg-red-50 border-red-200',
    textClass: 'text-red-700',
    badgeVariant: 'danger' as const,
  },
};

const SOURCE_CONFIG = {
  production: {
    icon: Factory,
    color: '#8b5cf6',
  },
  quality: {
    icon: Microscope,
    color: '#06b6d4',
  },
  warehouse: {
    icon: Package,
    color: '#f97316',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateShort = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
  });
};

const isOverdue = (dueDate: string, status: string) => {
  if (!dueDate || status === 'closed' || status === 'resolved') return false;
  return new Date(dueDate) < new Date();
};

const getDaysUntilDue = (dueDate: string, status: string) => {
  if (!dueDate || status === 'closed' || status === 'resolved') return null;
  const days = Math.ceil((new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  return days;
};

// ============================================================================
// API Functions
// ============================================================================

async function fetchDeviations() {
  const params = new URLSearchParams();
  params.set('limit', '1000');

  const res = await fetch(`/api/quality/deviations?${params}`);
  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch deviations');
  }

  return data.data?.items || [];
}

// ============================================================================
// Main Component
// ============================================================================

export default function DeviationsPage() {
  const router = useRouter();
  const t = useTranslations('quality');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  // Filter options (inside component because t() is a hook)
  const statusOptions = useMemo(() => [
    { value: '', label: t('deviations.filter.allStatuses') },
    { value: 'open', label: t('deviations.status.open') },
    { value: 'investigating', label: t('deviations.status.investigating') },
    { value: 'resolved', label: t('deviations.status.resolved') },
    { value: 'closed', label: t('deviations.status.closed') },
  ], [t]);

  const severityOptions = useMemo(() => [
    { value: '', label: t('deviations.filter.allSeverities') },
    { value: 'minor', label: t('deviations.severity.minor') },
    { value: 'major', label: t('deviations.severity.major') },
    { value: 'critical', label: t('deviations.severity.critical') },
  ], [t]);

  const sourceOptions = useMemo(() => [
    { value: '', label: t('deviations.filter.allSources') },
    { value: 'production', label: t('deviations.source.production') },
    { value: 'quality', label: t('deviations.source.quality') },
    { value: 'warehouse', label: t('deviations.source.warehouse') },
  ], [t]);

  // Data fetching with React Query
  const { data: deviations = [], isLoading, refetch } = useQuery<Deviation[]>({
    queryKey: ['quality-deviations'],
    queryFn: fetchDeviations,
    staleTime: 30 * 1000,
  });

  // Filter deviations
  const filteredDeviations = useMemo(() => {
    return deviations.filter((dev) => {
      const matchesSearch = !search ||
        dev.deviationNumber?.toLowerCase().includes(search.toLowerCase()) ||
        dev.title?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = !statusFilter || dev.status === statusFilter;
      const matchesSeverity = !severityFilter || dev.severity === severityFilter;
      const matchesSource = !sourceFilter || dev.sourceType === sourceFilter;

      return matchesSearch && matchesStatus && matchesSeverity && matchesSource;
    });
  }, [deviations, search, statusFilter, severityFilter, sourceFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = deviations.length;
    const open = deviations.filter(d => d.status === 'open').length;
    const investigating = deviations.filter(d => d.status === 'investigating').length;
    const resolved = deviations.filter(d => d.status === 'resolved').length;
    const closed = deviations.filter(d => d.status === 'closed').length;
    const critical = deviations.filter(d => d.severity === 'critical' && d.status !== 'closed').length;
    const overdue = deviations.filter(d => isOverdue(d.dueDate, d.status)).length;
    const activeTotal = open + investigating;
    const resolutionRate = total > 0 ? Math.round(((resolved + closed) / total) * 100) : 0;

    return {
      total,
      open,
      investigating,
      resolved,
      closed,
      critical,
      overdue,
      activeTotal,
      resolutionRate,
    };
  }, [deviations]);

  // Chart data for status distribution
  const statusChartData = useMemo(() => {
    return (Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map((key) => ({
      status: t(`deviations.status.${key}`),
      count: deviations.filter(d => d.status === key).length,
      color: STATUS_CONFIG[key].color,
    })).filter(item => item.count > 0);
  }, [deviations, t]);

  // Chart data for severity distribution
  const severityChartData = useMemo(() => {
    return (Object.keys(SEVERITY_CONFIG) as Array<keyof typeof SEVERITY_CONFIG>).map((key) => ({
      severity: t(`deviations.severity.${key}`),
      count: deviations.filter(d => d.severity === key && d.status !== 'closed').length,
      color: SEVERITY_CONFIG[key].color,
    })).filter(item => item.count > 0);
  }, [deviations, t]);

  // Chart data for source distribution
  const sourceChartData = useMemo(() => {
    return (Object.keys(SOURCE_CONFIG) as Array<keyof typeof SOURCE_CONFIG>).map((key) => ({
      source: t(`deviations.source.${key}`),
      count: deviations.filter(d => d.sourceType === key).length,
      color: SOURCE_CONFIG[key].color,
    })).filter(item => item.count > 0);
  }, [deviations, t]);

  // Recent deviations
  const recentDeviations = useMemo(() => {
    return [...deviations]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [deviations]);

  // Urgent deviations (critical or overdue)
  const urgentDeviations = useMemo(() => {
    return deviations
      .filter(d => d.severity === 'critical' || isOverdue(d.dueDate, d.status))
      .filter(d => d.status !== 'closed')
      .sort((a, b) => {
        if (a.severity === 'critical' && b.severity !== 'critical') return -1;
        if (a.severity !== 'critical' && b.severity === 'critical') return 1;
        return new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime();
      })
      .slice(0, 5);
  }, [deviations]);

  // Navigation handler
  const handleRowClick = useCallback((e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/quality/deviations/${e.data.id}`);
    }
  }, [router]);

  const handleDeviationClick = useCallback((id: number) => {
    router.push(`/quality/deviations/${id}`);
  }, [router]);

  // Cell renderers
  const renderDeviationNumberCell = useCallback((data: { data?: Deviation }) => {
    const dev = data.data;
    if (!dev) return null;
    const overdue = isOverdue(dev.dueDate, dev.status);
    return (
      <div>
        <p className="font-mono font-semibold text-indigo-600">{dev.deviationNumber}</p>
        {overdue && (
          <Badge variant="danger" size="sm" className="mt-1">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {t('deviations.grid.overdueBadge')}
          </Badge>
        )}
      </div>
    );
  }, [t]);

  const renderTitleCell = useCallback((data: { data?: Deviation }) => {
    const dev = data.data;
    if (!dev) return null;
    return (
      <div className="min-w-0">
        <p className="font-medium truncate">{dev.title}</p>
        {dev.description && (
          <p className="text-xs text-gray-500 truncate">{dev.description}</p>
        )}
      </div>
    );
  }, []);

  const renderSourceCell = useCallback((data: { data?: Deviation }) => {
    if (!data.data) return null;
    const config = SOURCE_CONFIG[data.data.sourceType as keyof typeof SOURCE_CONFIG];
    if (!config) return <span className="text-gray-400">-</span>;
    const Icon = config.icon;
    return (
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: config.color }} />
        <span>{t(`deviations.source.${data.data.sourceType}`)}</span>
      </div>
    );
  }, [t]);

  const renderSeverityCell = useCallback((data: { data?: Deviation }) => {
    if (!data.data) return null;
    const config = SEVERITY_CONFIG[data.data.severity as keyof typeof SEVERITY_CONFIG];
    if (!config) return <Badge>-</Badge>;
    return (
      <Badge variant={config.badgeVariant}>
        {t(`deviations.severity.${data.data.severity}`)}
      </Badge>
    );
  }, [t]);

  const renderDueDateCell = useCallback((data: { data?: Deviation }) => {
    const dev = data.data;
    if (!dev) return null;
    const overdue = isOverdue(dev.dueDate, dev.status);
    const daysUntil = getDaysUntilDue(dev.dueDate, dev.status);

    if (!dev.dueDate) return <span className="text-gray-400">-</span>;

    return (
      <div>
        <span className={overdue ? 'text-red-600 font-medium' : ''}>
          {formatDate(dev.dueDate)}
        </span>
        {daysUntil !== null && (
          <p className={`text-xs ${daysUntil < 0 ? 'text-red-500' : daysUntil <= 3 ? 'text-amber-500' : 'text-gray-500'}`}>
            {daysUntil < 0 ? t('deviations.overdue.daysOver', { days: Math.abs(daysUntil) }) : daysUntil === 0 ? t('common.today') : t('deviations.overdue.daysRemaining', { days: daysUntil })}
          </p>
        )}
      </div>
    );
  }, [t]);

  const renderStatusCell = useCallback((data: { data?: Deviation }) => {
    if (!data.data) return null;
    const config = STATUS_CONFIG[data.data.status as keyof typeof STATUS_CONFIG];
    if (!config) return <Badge>-</Badge>;
    return (
      <Badge variant={config.badgeVariant} dot>
        {t(`deviations.status.${data.data.status}`)}
      </Badge>
    );
  }, [t]);

  // DataGrid columns
  const columns: DxDataGridColumn[] = useMemo(() => [
    {
      dataField: 'deviationNumber',
      caption: t('deviations.grid.columns.number'),
      width: 150,
      cellRender: renderDeviationNumberCell,
    },
    {
      dataField: 'title',
      caption: t('deviations.grid.columns.title'),
      minWidth: 200,
      cellRender: renderTitleCell,
    },
    {
      dataField: 'sourceType',
      caption: t('deviations.grid.columns.source'),
      width: 130,
      hideOnMobile: true,
      cellRender: renderSourceCell,
    },
    {
      dataField: 'severity',
      caption: t('deviations.grid.columns.severity'),
      width: 100,
      cellRender: renderSeverityCell,
    },
    {
      dataField: 'dueDate',
      caption: t('deviations.grid.columns.dueDate'),
      width: 140,
      dataType: 'date',
      hideOnMobile: true,
      cellRender: renderDueDateCell,
    },
    {
      dataField: 'status',
      caption: t('deviations.grid.columns.status'),
      width: 130,
      cellRender: renderStatusCell,
    },
  ], [t, renderDeviationNumberCell, renderTitleCell, renderSourceCell, renderSeverityCell, renderDueDateCell, renderStatusCell]);

  // ============================================================================
  // Render Functions
  // ============================================================================

  const renderStatCards = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard
        label={t('deviations.stats.total')}
        value={stats.total}
        icon={FileWarning}
        iconColor="text-indigo-500"
        accentColor="border-indigo-500"
        isLoading={isLoading}
      />
      <StatCard
        label={t('deviations.stats.active')}
        value={stats.activeTotal}
        icon={Clock}
        iconColor="text-blue-500"
        accentColor="border-blue-500"
        trend={stats.activeTotal > 0 ? { value: String(stats.activeTotal), direction: 'neutral' } : undefined}
        isLoading={isLoading}
      />
      <StatCard
        label={t('deviations.stats.investigating')}
        value={stats.investigating}
        icon={Search}
        iconColor="text-amber-500"
        accentColor="border-amber-500"
        isLoading={isLoading}
      />
      <StatCard
        label={t('deviations.stats.critical')}
        value={stats.critical}
        icon={AlertOctagon}
        iconColor="text-red-500"
        accentColor="border-red-500"
        trend={stats.critical > 0 ? { value: String(stats.critical), direction: 'down' } : undefined}
        isLoading={isLoading}
      />
      <StatCard
        label={t('deviations.stats.overdue')}
        value={stats.overdue}
        icon={AlertTriangle}
        iconColor="text-orange-500"
        accentColor="border-orange-500"
        trend={stats.overdue > 0 ? { value: String(stats.overdue), direction: 'down' } : undefined}
        isLoading={isLoading}
      />
      <StatCard
        label={t('deviations.stats.resolutionRate')}
        value={`${stats.resolutionRate}%`}
        icon={TrendingUp}
        iconColor="text-green-500"
        accentColor="border-green-500"
        trend={stats.resolutionRate >= 80 ? { value: String(stats.resolutionRate), direction: 'up' } : undefined}
        isLoading={isLoading}
      />
    </div>
  );

  const renderCriticalAlert = () => {
    if (stats.critical === 0) return null;

    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertOctagon className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-red-800">
                {t('deviations.alert.criticalCount', { count: stats.critical })}
              </p>
              <p className="text-sm text-red-600">
                {t('deviations.alert.criticalDescription')}
              </p>
            </div>
            <DxButton
              text={t('deviations.alert.viewAll')}
              type="danger"
              onClick={() => setSeverityFilter('critical')}
            />
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderFilters = () => (
    <Card elevation="raised">
      <CardContent className="py-3">
        <div className="flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1">
            <DxTextBox
              placeholder={t('deviations.filter.searchPlaceholder')}
              value={search}
              onValueChange={setSearch}
              showClearButton
              mode="search"
            />
          </div>
          <div className="w-full md:w-36">
            <DxSelectBox
              items={statusOptions}
              value={statusFilter}
              onValueChange={setStatusFilter}
              placeholder={t('deviations.filter.statusPlaceholder')}
              showClearButton
            />
          </div>
          <div className="w-full md:w-36">
            <DxSelectBox
              items={severityOptions}
              value={severityFilter}
              onValueChange={setSeverityFilter}
              placeholder={t('deviations.filter.severityPlaceholder')}
              showClearButton
            />
          </div>
          <div className="w-full md:w-36">
            <DxSelectBox
              items={sourceOptions}
              value={sourceFilter}
              onValueChange={setSourceFilter}
              placeholder={t('deviations.filter.sourcePlaceholder')}
              showClearButton
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderCharts = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Status Distribution */}
      <Card elevation="raised">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            {t('deviations.analytics.statusDistribution')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {statusChartData.length > 0 ? (
            <PieChart
              id="status-pie"
              dataSource={statusChartData}
              type="doughnut"
              palette={statusChartData.map(d => d.color)}
              innerRadius={0.6}
              size={{ height: 200 }}
            >
              <Series argumentField="status" valueField="count">
                <Label visible={false} />
              </Series>
              <Legend
                orientation="horizontal"
                horizontalAlignment="center"
                verticalAlignment="bottom"
              />
              <Tooltip enabled={true} customizeTooltip={(arg) => ({
                text: `${arg.argumentText}: ${arg.valueText} ${t('common.items')}`
              })} />
            </PieChart>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              {t('common.noData')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Severity Distribution */}
      <Card elevation="raised">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            {t('deviations.analytics.severityDistribution')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {severityChartData.length > 0 ? (
            <PieChart
              id="severity-pie"
              dataSource={severityChartData}
              type="doughnut"
              palette={severityChartData.map(d => d.color)}
              innerRadius={0.6}
              size={{ height: 200 }}
            >
              <Series argumentField="severity" valueField="count">
                <Label visible={false} />
              </Series>
              <Legend
                orientation="horizontal"
                horizontalAlignment="center"
                verticalAlignment="bottom"
              />
              <Tooltip enabled={true} customizeTooltip={(arg) => ({
                text: `${arg.argumentText}: ${arg.valueText} ${t('common.items')}`
              })} />
            </PieChart>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              {t('common.noData')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Source Distribution */}
      <Card elevation="raised">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            {t('deviations.analytics.sourceDistribution')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {sourceChartData.length > 0 ? (
            <PieChart
              id="source-pie"
              dataSource={sourceChartData}
              type="doughnut"
              palette={sourceChartData.map(d => d.color)}
              innerRadius={0.6}
              size={{ height: 200 }}
            >
              <Series argumentField="source" valueField="count">
                <Label visible={false} />
              </Series>
              <Legend
                orientation="horizontal"
                horizontalAlignment="center"
                verticalAlignment="bottom"
              />
              <Tooltip enabled={true} customizeTooltip={(arg) => ({
                text: `${arg.argumentText}: ${arg.valueText} ${t('common.items')}`
              })} />
            </PieChart>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              {t('common.noData')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderDeviationCard = (dev: Deviation) => {
    const statusConfig = STATUS_CONFIG[dev.status as keyof typeof STATUS_CONFIG];
    const severityConfig = SEVERITY_CONFIG[dev.severity as keyof typeof SEVERITY_CONFIG];
    const sourceConfig = SOURCE_CONFIG[dev.sourceType as keyof typeof SOURCE_CONFIG];
    const overdue = isOverdue(dev.dueDate, dev.status);
    const daysUntil = getDaysUntilDue(dev.dueDate, dev.status);

    return (
      <Card
        key={dev.id}
        elevation="raised"
        className={`cursor-pointer transition-all hover:shadow-lg border-l-4 ${
          dev.severity === 'critical' ? 'border-l-red-500' :
          dev.severity === 'major' ? 'border-l-amber-500' :
          'border-l-gray-300'
        }`}
        onClick={() => handleDeviationClick(dev.id)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-mono font-semibold text-indigo-600">{dev.deviationNumber}</p>
              <p className="font-medium mt-1">{dev.title}</p>
            </div>
            <div className="flex flex-col gap-1 items-end">
              {statusConfig && (
                <Badge variant={statusConfig.badgeVariant} size="sm" dot>
                  {t(`deviations.status.${dev.status}`)}
                </Badge>
              )}
              {severityConfig && (
                <Badge variant={severityConfig.badgeVariant} size="sm">
                  {t(`deviations.severity.${dev.severity}`)}
                </Badge>
              )}
            </div>
          </div>

          {dev.description && (
            <p className="text-sm text-gray-500 mb-3 line-clamp-2">{dev.description}</p>
          )}

          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
            <div className="flex items-center gap-2">
              {sourceConfig && (
                <>
                  <sourceConfig.icon className="h-3.5 w-3.5" style={{ color: sourceConfig.color }} />
                  <span>{t(`deviations.source.${dev.sourceType}`)}</span>
                </>
              )}
            </div>
            {dev.dueDate && (
              <div className={`flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : ''}`}>
                <Calendar className="h-3.5 w-3.5" />
                <span>{formatDateShort(dev.dueDate)}</span>
                {daysUntil !== null && (
                  <span className={`${daysUntil < 0 ? 'text-red-500' : daysUntil <= 3 ? 'text-amber-500' : ''}`}>
                    ({daysUntil < 0 ? t('deviations.overdue.daysOver', { days: Math.abs(daysUntil) }) : daysUntil === 0 ? t('common.today') : `${daysUntil}d`})
                  </span>
                )}
              </div>
            )}
          </div>

          {overdue && (
            <div className="mt-2 p-2 bg-red-50 rounded-md flex items-center gap-2 text-red-600 text-xs">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{t('deviations.cards.overdueWarning')}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderGridView = () => (
    <Card elevation="raised" className="flex-1 min-h-0 flex flex-col">
      <CardContent className="flex-1 min-h-0 flex flex-col p-0">
        {filteredDeviations.length > 0 || isLoading ? (
          <DxDataGrid
            dataSource={filteredDeviations}
            keyExpr="id"
            columns={columns}
            loading={isLoading}
            sorting
            filterRow
            headerFilter
            export
            exportFileName="deviations"
            columnChooser
            virtualScrolling={filteredDeviations.length > 100}
            fillHeight
            onRowClick={handleRowClick}
            noDataText={t('deviations.grid.noData')}
          />
        ) : (
          <EmptyState
            icon={<FileWarning className="h-8 w-8" />}
            title={t('deviations.emptyState.title')}
            description={t('deviations.emptyState.description')}
            action={{
              label: t('deviations.emptyState.action'),
              onClick: () => router.push('/quality/deviations/new'),
            }}
          />
        )}
      </CardContent>
    </Card>
  );

  const renderCardsView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1">
      {/* Main Content */}
      <div className="lg:col-span-3 space-y-4">
        {renderCharts()}

        <Card elevation="raised">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <AlertOctagon className="h-5 w-5 text-red-500" />
              {t('deviations.cards.urgentTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {urgentDeviations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {urgentDeviations.map(renderDeviationCard)}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                {t('deviations.cards.noUrgent')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card elevation="raised">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileWarning className="h-5 w-5 text-indigo-500" />
                {t('deviations.cards.filteredTitle', { count: filteredDeviations.length })}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {filteredDeviations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredDeviations.slice(0, 10).map(renderDeviationCard)}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                {t('deviations.cards.noMatch')}
              </div>
            )}
            {filteredDeviations.length > 10 && (
              <div className="mt-4 text-center">
                <DxButton
                  text={t('deviations.cards.viewMore', { count: filteredDeviations.length - 10 })}
                  type="normal"
                  onClick={() => setViewMode('grid')}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Quick Stats */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('deviations.sidebar.summary')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-500">{t('common.all')}</span>
              <span className="font-semibold">{stats.total}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-500">{t('deviations.status.open')}</span>
              <span className="font-semibold text-blue-600">{stats.open}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-500">{t('deviations.status.investigating')}</span>
              <span className="font-semibold text-amber-600">{stats.investigating}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-500">{t('deviations.status.resolved')}</span>
              <span className="font-semibold text-cyan-600">{stats.resolved}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-500">{t('deviations.status.closed')}</span>
              <span className="font-semibold text-green-600">{stats.closed}</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Deviations */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('deviations.sidebar.recent')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {recentDeviations.map((dev) => {
                const severityConfig = SEVERITY_CONFIG[dev.severity as keyof typeof SEVERITY_CONFIG];
                return (
                  <div
                    key={dev.id}
                    className="p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border-l-2"
                    style={{ borderLeftColor: severityConfig?.color || '#ccc' }}
                    onClick={() => handleDeviationClick(dev.id)}
                  >
                    <p className="font-mono text-xs text-indigo-600">{dev.deviationNumber}</p>
                    <p className="text-sm truncate">{dev.title}</p>
                    <p className="text-xs text-gray-400">{formatDate(dev.createdAt)}</p>
                  </div>
                );
              })}
              {recentDeviations.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">{t('common.noData')}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderAnalyticsView = () => (
    <div className="space-y-4 flex-1">
      {/* Full-width Charts */}
      {renderCharts()}

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status Breakdown */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-500" />
              {t('deviations.analytics.statusBreakdown')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map((key) => {
                const config = STATUS_CONFIG[key];
                const count = deviations.filter(d => d.status === key).length;
                const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                const Icon = config.icon;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${config.bgClass}`}>
                      <Icon className={`h-4 w-4 ${config.textClass}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{t(`deviations.status.${key}`)}</span>
                        <span className="text-sm text-gray-500">{count} ({percentage.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${percentage}%`, backgroundColor: config.color }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Severity Breakdown */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t('deviations.analytics.severityBreakdown')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {(Object.keys(SEVERITY_CONFIG) as Array<keyof typeof SEVERITY_CONFIG>).map((key) => {
                const config = SEVERITY_CONFIG[key];
                const count = deviations.filter(d => d.severity === key).length;
                const activeCount = deviations.filter(d => d.severity === key && d.status !== 'closed').length;
                const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: config.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{t(`deviations.severity.${key}`)}</span>
                        <span className="text-sm text-gray-500">
                          {count} ({activeCount} {t('common.stillOpen')})
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${percentage}%`, backgroundColor: config.color }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Source Breakdown */}
      <Card elevation="raised">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5 text-purple-500" />
            {t('deviations.analytics.sourceBreakdown')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.keys(SOURCE_CONFIG) as Array<keyof typeof SOURCE_CONFIG>).map((key) => {
              const config = SOURCE_CONFIG[key];
              const sourceDeviations = deviations.filter(d => d.sourceType === key);
              const count = sourceDeviations.length;
              const criticalCount = sourceDeviations.filter(d => d.severity === 'critical' && d.status !== 'closed').length;
              const openCount = sourceDeviations.filter(d => d.status === 'open' || d.status === 'investigating').length;
              const Icon = config.icon;

              return (
                <Card key={key} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: `${config.color}20` }}>
                        <Icon className="h-5 w-5" style={{ color: config.color }} />
                      </div>
                      <div>
                        <p className="font-medium">{t(`deviations.source.${key}`)}</p>
                        <p className="text-2xl font-bold" style={{ color: config.color }}>{count}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-gray-50 rounded">
                        <span className="text-gray-500">{t('deviations.analytics.inProgress')}</span>
                        <p className="font-semibold text-blue-600">{openCount}</p>
                      </div>
                      <div className="p-2 bg-gray-50 rounded">
                        <span className="text-gray-500">{t('common.critical')}</span>
                        <p className="font-semibold text-red-600">{criticalCount}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div className="flex flex-col h-full gap-4 max-w-[1800px] mx-auto w-full">
      <ResponsivePageHeader
        title={t('nonConformance.title')}
        subtitle={t('nonConformance.description')}
        actions={
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="hidden md:flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                title={t('common.viewGrid')}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded ${viewMode === 'cards' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                title={t('common.viewCards')}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('analytics')}
                className={`p-1.5 rounded ${viewMode === 'analytics' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                title={t('common.viewAnalytics')}
              >
                <BarChart3 className="h-4 w-4" />
              </button>
            </div>

            <DxButton
              icon="refresh"
              hint={t('deviations.actions.refresh')}
              onClick={() => refetch()}
              data-testid="dx-button-refresh"
            />
            <DxButton
              text={t('deviations.actions.report')}
              icon="plus"
              type="success"
              onClick={() => router.push('/quality/deviations/new')}
            />
          </div>
        }
      />

      {/* KPI Stats */}
      {renderStatCards()}

      {/* Critical Alert */}
      {renderCriticalAlert()}

      {/* Filters */}
      {renderFilters()}

      {/* Content based on view mode */}
      {viewMode === 'grid' && renderGridView()}
      {viewMode === 'cards' && renderCardsView()}
      {viewMode === 'analytics' && renderAnalyticsView()}
    </div>
  );
}

'use client';

/**
 * Internal Audit Dashboard Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * Professional dashboard for viewing and managing internal audit program.
 * Redesigned with DevExtreme UI components.
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  SearchPanel,
  HeaderFilter,
  ColumnChooser,
  Export,
  Grouping,
  GroupPanel,
  Summary,
  TotalItem,
  Toolbar,
  Item,
  Scrolling,
  Selection,
} from 'devextreme-react/data-grid';
import { Workbook } from 'exceljs';
import { saveAs } from 'file-saver';
import { exportDataGrid } from 'devextreme/excel_exporter';
import type { ExportingEvent } from 'devextreme/ui/data_grid';
import PieChart, {
  Series as PieSeries,
  Label as PieLabel,
  Legend as PieLegend,
  Tooltip as PieTooltip,
  Connector,
} from 'devextreme-react/pie-chart';
import Chart, {
  CommonSeriesSettings,
  Series,
  ArgumentAxis,
  ValueAxis,
  Legend,
  Tooltip,
  Label,
} from 'devextreme-react/chart';
import {
  ClipboardCheck,
  FileSearch,
  AlertTriangle,
  Calendar,
  ListChecks,
  RefreshCw,
  Plus,
  Eye,
  MoreHorizontal,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  BarChart3,
  Layers,
  Activity,
} from 'lucide-react';
import type {
  AuditStatistics,
  ChapterCoverage,
  AuditPlan,
  Audit,
  AuditStatus,
  AuditFindingCategory,
} from '@/types/audits';

// ============================================
// Constants
// ============================================

const AUDIT_STATUS_CONFIG: Record<AuditStatus, {
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  chartColor: string;
  icon: React.ReactNode;
}> = {
  scheduled: {
    label: 'Scheduled',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    chartColor: '#3b82f6',
    icon: <Calendar className="h-3.5 w-3.5" />,
  },
  in_progress: {
    label: 'In Progress',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    chartColor: '#f59e0b',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  completed: {
    label: 'Completed',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    chartColor: '#10b981',
    icon: <CheckCircle className="h-3.5 w-3.5" />,
  },
  cancelled: {
    label: 'Cancelled',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-200',
    chartColor: '#64748b',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

const FINDING_CATEGORY_CONFIG: Record<AuditFindingCategory, {
  label: string;
  bgColor: string;
  textColor: string;
  chartColor: string;
  icon: React.ReactNode;
}> = {
  observation: {
    label: 'Observation',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    chartColor: '#64748b',
    icon: <Eye className="h-3.5 w-3.5" />,
  },
  minor: {
    label: 'Minor',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    chartColor: '#3b82f6',
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
  major: {
    label: 'Major',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    chartColor: '#f59e0b',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  critical: {
    label: 'Critical',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    chartColor: '#ef4444',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

// ============================================
// Helper Components
// ============================================

function MetricCard({
  value,
  label,
  loading = false,
}: {
  value: string | number;
  label: string;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-2 border-r border-white/20 last:border-r-0">
      <p className={`text-lg font-bold ${loading ? 'animate-pulse' : ''}`}>
        {loading ? '...' : value}
      </p>
      <p className="text-xs text-teal-100">{label}</p>
    </div>
  );
}

function StatusCard({
  count,
  total,
  config,
}: {
  count: number;
  total: number;
  config: {
    label: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
    icon: React.ReactNode;
  };
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className={`${config.bgColor} border ${config.borderColor} rounded-xl p-4 transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${config.bgColor} ${config.textColor}`}>
            {config.icon}
          </div>
          <div>
            <p className={`text-xs font-medium ${config.textColor}`}>{config.label}</p>
            <p className="text-xs text-gray-500">{percentage}% of total</p>
          </div>
        </div>
        <p className={`text-2xl font-bold ${config.textColor}`}>{count}</p>
      </div>
    </div>
  );
}

function FindingCategoryCard({
  count,
  config,
}: {
  count: number;
  config: {
    label: string;
    bgColor: string;
    textColor: string;
    icon: React.ReactNode;
  };
}) {
  return (
    <div className={`${config.bgColor} rounded-lg p-3 flex items-center justify-between`}>
      <div className="flex items-center gap-2">
        <span className={config.textColor}>{config.icon}</span>
        <span className={`text-sm font-medium ${config.textColor}`}>{config.label}</span>
      </div>
      <span className={`text-lg font-bold ${config.textColor}`}>{count}</span>
    </div>
  );
}

function ChapterProgressCard({
  chapter,
  name,
  auditsPlanned,
  auditsCompleted,
  findingsCount,
  lastAuditDate,
}: {
  chapter: number;
  name: string;
  auditsPlanned: number;
  auditsCompleted: number;
  findingsCount: number;
  lastAuditDate: string | null;
}) {
  const progress = auditsPlanned > 0 ? Math.round((auditsCompleted / auditsPlanned) * 100) : 0;
  const progressColor = progress >= 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="bg-white border border-gray-100 rounded-lg p-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center">
            <span className="text-xs font-bold text-teal-700">{chapter}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{name}</p>
          </div>
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded ${progress >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
          {auditsCompleted}/{auditsPlanned}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
        <div className={`${progressColor} h-1.5 rounded-full transition-all`} style={{ width: `${progress}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{findingsCount} findings</span>
        <span>{lastAuditDate ? new Date(lastAuditDate).toLocaleDateString('th-TH') : 'No audit'}</span>
      </div>
    </div>
  );
}

// ============================================
// API Functions
// ============================================

async function fetchStatistics(year: number): Promise<{ statistics: AuditStatistics; chapterCoverage: ChapterCoverage }> {
  const response = await fetch(`/api/internal-audit/statistics?year=${year}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function fetchActivePlan(year: number): Promise<AuditPlan | null> {
  const response = await fetch(`/api/internal-audit/plans?year=${year}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  const plans = result.data.plans || [];
  return plans.find((p: AuditPlan) => p.status === 'approved') || plans[0] || null;
}

async function fetchAudits(): Promise<Audit[]> {
  const response = await fetch(`/api/internal-audit/audits?limit=100`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data.audits || [];
}

// ============================================
// Main Component
// ============================================

export default function InternalAuditDashboardPage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [activeTab, setActiveTab] = useState<'all' | AuditStatus>('all');

  // Fetch data
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['audit-statistics', currentYear],
    queryFn: () => fetchStatistics(currentYear),
  });

  const { data: activePlan, isLoading: planLoading } = useQuery({
    queryKey: ['audit-active-plan', currentYear],
    queryFn: () => fetchActivePlan(currentYear),
  });

  const { data: audits = [], isLoading: auditsLoading, refetch: refetchAudits } = useQuery({
    queryKey: ['audits-list'],
    queryFn: fetchAudits,
  });

  const statistics = statsData?.statistics;
  const chapterCoverage = statsData?.chapterCoverage;
  const isLoading = statsLoading || planLoading || auditsLoading;

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetchStats();
    refetchAudits();
  }, [refetchStats, refetchAudits]);

  // Calculate audit status counts
  const auditStatusCounts = useMemo(() => {
    const counts: Record<AuditStatus, number> = {
      scheduled: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };
    audits.forEach((audit) => {
      if (counts[audit.status] !== undefined) {
        counts[audit.status]++;
      }
    });
    return counts;
  }, [audits]);

  // Filter audits by tab
  const filteredAudits = useMemo(() => {
    if (activeTab === 'all') return audits;
    return audits.filter((a) => a.status === activeTab);
  }, [audits, activeTab]);

  // Chart data
  const statusChartData = useMemo(() => {
    return Object.entries(auditStatusCounts)
      .filter((entry) => entry[1] > 0)
      .map(([status, count]) => ({
        status: AUDIT_STATUS_CONFIG[status as AuditStatus].label,
        count,
        color: AUDIT_STATUS_CONFIG[status as AuditStatus].chartColor,
      }));
  }, [auditStatusCounts]);

  const findingsChartData = useMemo(() => {
    if (!statistics) return [];
    return [
      { category: 'Critical', count: statistics.findingsByCategory.critical, color: '#ef4444' },
      { category: 'Major', count: statistics.findingsByCategory.major, color: '#f59e0b' },
      { category: 'Minor', count: statistics.findingsByCategory.minor, color: '#3b82f6' },
      { category: 'Observation', count: statistics.findingsByCategory.observation, color: '#64748b' },
    ].filter(d => d.count > 0);
  }, [statistics]);

  // Excel export handler
  const onExporting = useCallback((e: ExportingEvent) => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Audits');

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }) => {
        if (gridCell?.rowType === 'data') {
          if (gridCell.column?.dataField === 'status') {
            const status = gridCell.value as AuditStatus;
            excelCell.value = AUDIT_STATUS_CONFIG[status]?.label || status;
          }
        }
      },
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `audits-${currentYear}.xlsx`);
      });
    });
  }, [currentYear]);

  // Custom cell renderers
  const renderStatusCell = useCallback((data: { value: AuditStatus }) => {
    const config = AUDIT_STATUS_CONFIG[data.value];
    if (!config) return data.value;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
        {config.icon}
        {config.label}
      </span>
    );
  }, []);

  const renderAuditNumberCell = useCallback((data: { data: Audit }) => {
    return (
      <button
        onClick={() => router.push(`/gmp/internal-audit/audits/${data.data.id}`)}
        className="text-teal-600 hover:text-teal-800 font-medium hover:underline"
      >
        {data.data.auditNumber}
      </button>
    );
  }, [router]);

  const renderGmpChaptersCell = useCallback((data: { value: number[] }) => {
    if (!data.value || data.value.length === 0) return '-';
    return (
      <div className="flex flex-wrap gap-1">
        {data.value.slice(0, 3).map((ch) => (
          <span key={ch} className="px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded text-xs">
            {ch}
          </span>
        ))}
        {data.value.length > 3 && (
          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
            +{data.value.length - 3}
          </span>
        )}
      </div>
    );
  }, []);

  const renderFindingsCell = useCallback((data: { data: Audit }) => {
    const hasOpen = data.data.openFindingsCount > 0;
    return (
      <div className="flex items-center gap-2">
        <span className="font-medium">{data.data.findingsCount}</span>
        {hasOpen && (
          <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">
            {data.data.openFindingsCount} open
          </span>
        )}
      </div>
    );
  }, []);

  const renderActionsCell = useCallback((data: { data: Audit }) => {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => router.push(`/gmp/internal-audit/audits/${data.data.id}`)}
          className="p-1 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded"
          title="View Details"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={() => {}}
          className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
          title="More Actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    );
  }, [router]);

  const totalAudits = audits.length;

  return (
    <>
      <div className="flex flex-col h-full gap-6 -m-4 md:-m-6">
        {/* Professional Header */}
        <div className="bg-gradient-to-r from-teal-600 via-teal-500 to-cyan-500 p-6 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Shield className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Internal Audit Program</h1>
                <p className="text-teal-100 text-sm">Self-Inspection & Internal Audits (GMP หมวด 10)</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors backdrop-blur-sm"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium">Refresh</span>
              </button>
              <button
                onClick={() => router.push('/gmp/internal-audit/plans')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors backdrop-blur-sm"
              >
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">Audit Plans</span>
              </button>
              <button
                onClick={() => router.push('/gmp/internal-audit/audits?new=1')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-teal-600 hover:bg-teal-50 rounded-lg transition-colors font-medium"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm">Schedule Audit</span>
              </button>
            </div>
          </div>

          {/* Quick Stats Bar */}
          <div className="mt-6 flex flex-wrap items-center bg-white/10 rounded-xl backdrop-blur-sm py-2">
            <MetricCard value={statistics?.totalPlanned || 0} label="Planned" loading={statsLoading} />
            <MetricCard value={statistics?.totalCompleted || 0} label="Completed" loading={statsLoading} />
            <MetricCard
              value={statistics ? `${Math.round(statistics.completionRate)}%` : 'N/A'}
              label="Completion Rate"
              loading={statsLoading}
            />
            <MetricCard value={statistics?.totalFindings || 0} label="Total Findings" loading={statsLoading} />
            <MetricCard value={statistics?.openFindings || 0} label="Open Findings" loading={statsLoading} />
            <MetricCard
              value={statistics?.avgCapaClosureTime ? `${Math.round(statistics.avgCapaClosureTime)}d` : 'N/A'}
              label="Avg Closure Time"
              loading={statsLoading}
            />
            <MetricCard value={chapterCoverage?.chapters?.length || 10} label="GMP Chapters" loading={statsLoading} />
          </div>
        </div>

        {/* Main Content */}
        <div className="px-4 md:px-6 pb-6 space-y-6">
          {/* Active Plan Banner */}
          {activePlan && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-900">{activePlan.name}</h3>
                    <p className="text-sm text-blue-700">
                      {activePlan.completedAudits} of {activePlan.totalAudits} audits completed
                      ({activePlan.totalAudits > 0 ? Math.round((activePlan.completedAudits / activePlan.totalAudits) * 100) : 0}%)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/gmp/internal-audit/plans')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  View Plan
                </button>
              </div>
              {/* Progress bar */}
              <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${activePlan.totalAudits > 0 ? (activePlan.completedAudits / activePlan.totalAudits) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Left Column - Main Content */}
            <div className="xl:col-span-3 space-y-6">
              {/* Audit Status Cards */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardCheck className="h-5 w-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Audits by Status</h3>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {(Object.entries(AUDIT_STATUS_CONFIG) as [AuditStatus, typeof AUDIT_STATUS_CONFIG[AuditStatus]][]).map(
                    ([status, config]) => (
                      <StatusCard
                        key={status}
                        status={status}
                        count={auditStatusCounts[status]}
                        total={totalAudits}
                        config={config}
                      />
                    )
                  )}
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status Distribution */}
                <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="h-5 w-5 text-gray-500" />
                    <h3 className="font-semibold text-gray-900">Audit Status Distribution</h3>
                  </div>
                  {statusChartData.length > 0 ? (
                    <PieChart
                      dataSource={statusChartData}
                      type="doughnut"
                      palette={statusChartData.map((d) => d.color)}
                      innerRadius={0.6}
                      size={{ height: 220 }}
                    >
                      <PieSeries argumentField="status" valueField="count">
                        <PieLabel visible={true} position="outside" format="fixedPoint">
                          <Connector visible={true} width={1} />
                        </PieLabel>
                      </PieSeries>
                      <PieLegend
                        visible={true}
                        horizontalAlignment="center"
                        verticalAlignment="bottom"
                        itemTextPosition="right"
                      />
                      <PieTooltip enabled={true} format="fixedPoint" />
                    </PieChart>
                  ) : (
                    <div className="h-[220px] flex flex-col items-center justify-center text-gray-400">
                      <BarChart3 className="h-12 w-12 mb-2 opacity-50" />
                      <p className="text-sm">No audit data</p>
                    </div>
                  )}
                </div>

                {/* Findings by Category */}
                <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-5 w-5 text-gray-500" />
                    <h3 className="font-semibold text-gray-900">Findings by Category</h3>
                  </div>
                  {findingsChartData.length > 0 ? (
                    <Chart dataSource={findingsChartData} rotated={true} size={{ height: 220 }}>
                      <CommonSeriesSettings
                        argumentField="category"
                        valueField="count"
                        type="bar"
                        barWidth={30}
                      />
                      <Series
                        name="Findings"
                        color="#14b8a6"
                        customizePoint={(pointInfo: { argument: string }) => {
                          const item = findingsChartData.find((d) => d.category === pointInfo.argument);
                          return { color: item?.color || '#14b8a6' };
                        }}
                      />
                      <ArgumentAxis>
                        <Label visible={true} />
                      </ArgumentAxis>
                      <ValueAxis>
                        <Label visible={true} format="fixedPoint" />
                      </ValueAxis>
                      <Legend visible={false} />
                      <Tooltip enabled={true} format="fixedPoint" />
                    </Chart>
                  ) : (
                    <div className="h-[220px] flex flex-col items-center justify-center text-gray-400">
                      <AlertTriangle className="h-12 w-12 mb-2 opacity-50" />
                      <p className="text-sm">No findings data</p>
                    </div>
                  )}
                </div>
              </div>

              {/* GMP Chapter Coverage */}
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-gray-500" />
                    <h3 className="font-semibold text-gray-900">GMP Chapter Coverage ({currentYear})</h3>
                  </div>
                  <span className="text-sm text-gray-500">
                    {chapterCoverage?.chapters?.filter((c) => c.auditsCompleted > 0).length || 0} / {chapterCoverage?.chapters?.length || 10} chapters audited
                  </span>
                </div>
                {chapterCoverage?.chapters && chapterCoverage.chapters.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {chapterCoverage.chapters.map((ch) => (
                      <ChapterProgressCard
                        key={ch.chapter}
                        chapter={ch.chapter}
                        name={ch.name.replace(/หมวด \d+ - /, '')}
                        auditsPlanned={ch.auditsPlanned}
                        auditsCompleted={ch.auditsCompleted}
                        findingsCount={ch.findingsCount}
                        lastAuditDate={ch.lastAuditDate}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="h-32 flex flex-col items-center justify-center text-gray-400">
                    <Layers className="h-10 w-10 mb-2 opacity-50" />
                    <p className="text-sm">No chapter coverage data</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Sidebars */}
            <div className="space-y-6">
              {/* Findings Summary */}
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <FileSearch className="h-5 w-5 text-gray-500" />
                  <h3 className="font-semibold text-gray-900">Findings Summary</h3>
                </div>
                <div className="space-y-2">
                  {(Object.entries(FINDING_CATEGORY_CONFIG) as [AuditFindingCategory, typeof FINDING_CATEGORY_CONFIG[AuditFindingCategory]][]).map(
                    ([category, config]) => (
                      <FindingCategoryCard
                        key={category}
                        category={category}
                        count={statistics?.findingsByCategory[category] || 0}
                        config={config}
                      />
                    )
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Total Findings</span>
                    <span className="font-bold text-gray-900">{statistics?.totalFindings || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Open Findings</span>
                    <span className={`font-bold ${(statistics?.openFindings || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {statistics?.openFindings || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-5 w-5 text-gray-500" />
                  <h3 className="font-semibold text-gray-900">Quick Actions</h3>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => router.push('/gmp/internal-audit/plans')}
                    className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
                  >
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Calendar className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Audit Plans</p>
                      <p className="text-xs text-gray-500">Manage annual plans</p>
                    </div>
                  </button>
                  <button
                    onClick={() => router.push('/gmp/internal-audit/audits')}
                    className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
                  >
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">All Audits</p>
                      <p className="text-xs text-gray-500">View and track audits</p>
                    </div>
                  </button>
                  <button
                    onClick={() => router.push('/gmp/internal-audit/findings')}
                    className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
                  >
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Findings & CAPA</p>
                      <p className="text-xs text-gray-500">Manage findings</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Open Findings Alert */}
              {statistics && statistics.openFindings > 0 && (
                <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-red-900">Action Required</h3>
                      <p className="text-sm text-red-700 mt-1">
                        {statistics.openFindings} finding(s) need attention.
                        {statistics.findingsByCategory.critical > 0 && (
                          <span className="block mt-1 font-medium">
                            Including {statistics.findingsByCategory.critical} critical!
                          </span>
                        )}
                      </p>
                      <button
                        onClick={() => router.push('/gmp/internal-audit/findings?status=open')}
                        className="mt-3 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                      >
                        View Open Findings
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Audits DataGrid */}
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            {/* Tabs Header */}
            <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'all'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All Audits
                  <span className="ml-1.5 text-xs bg-gray-200 px-1.5 py-0.5 rounded-full">{totalAudits}</span>
                </button>
                {(Object.keys(AUDIT_STATUS_CONFIG) as AuditStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setActiveTab(status)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      activeTab === status
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {AUDIT_STATUS_CONFIG[status].label}
                    <span className="ml-1.5 text-xs bg-gray-200 px-1.5 py-0.5 rounded-full">
                      {auditStatusCounts[status]}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <ListChecks className="h-4 w-4" />
                <span>{filteredAudits.length} audits</span>
              </div>
            </div>

            {/* DataGrid */}
            <DataGrid
              dataSource={filteredAudits}
              showBorders={false}
              showRowLines={true}
              showColumnLines={false}
              rowAlternationEnabled={true}
              allowColumnReordering={true}
              allowColumnResizing={true}
              columnAutoWidth={true}
              wordWrapEnabled={true}
              onExporting={onExporting}
              className="audit-professional-grid"
            >
              <Scrolling mode="virtual" />
              <Selection mode="multiple" showCheckBoxesMode="onClick" />
              <SearchPanel visible={true} placeholder="Search audits..." width={250} />
              <FilterRow visible={true} />
              <HeaderFilter visible={true} />
              <GroupPanel visible={true} />
              <Grouping autoExpandAll={false} />
              <ColumnChooser enabled={true} mode="select" />
              <Export enabled={true} allowExportSelectedData={true} />

              <Column
                dataField="auditNumber"
                caption="Audit #"
                width={130}
                cellRender={renderAuditNumberCell}
              />
              <Column dataField="scope" caption="Scope" minWidth={200} />
              <Column
                dataField="auditType"
                caption="Type"
                width={100}
                cellRender={(data) => (
                  <span className="capitalize">{data.value}</span>
                )}
              />
              <Column
                dataField="gmpChapters"
                caption="GMP Chapters"
                width={150}
                cellRender={renderGmpChaptersCell}
                allowFiltering={false}
              />
              <Column
                dataField="scheduledDate"
                caption="Scheduled"
                dataType="date"
                width={110}
                format="dd/MM/yyyy"
              />
              <Column
                dataField="leadAuditorName"
                caption="Lead Auditor"
                width={140}
              />
              <Column
                dataField="status"
                caption="Status"
                width={130}
                cellRender={renderStatusCell}
              />
              <Column
                caption="Findings"
                width={120}
                cellRender={renderFindingsCell}
                allowFiltering={false}
              />
              <Column
                caption="Actions"
                width={80}
                cellRender={renderActionsCell}
                allowFiltering={false}
                allowSorting={false}
              />

              <Summary>
                <TotalItem column="auditNumber" summaryType="count" displayFormat="Total: {0}" />
              </Summary>

              <Paging defaultPageSize={15} />
              <Pager
                visible={true}
                showPageSizeSelector={true}
                allowedPageSizes={[10, 15, 25, 50]}
                showInfo={true}
                showNavigationButtons={true}
              />

              <Toolbar>
                <Item name="groupPanel" />
                <Item name="columnChooserButton" />
                <Item name="exportButton" />
                <Item name="searchPanel" />
              </Toolbar>
            </DataGrid>
          </div>
        </div>
      </div>

      {/* Custom styles */}
      <style jsx global>{`
        .audit-professional-grid {
          font-family: inherit;
        }
        .audit-professional-grid .dx-datagrid-headers {
          background: linear-gradient(to bottom, #f8fafc, #f1f5f9);
          border-bottom: 2px solid #e2e8f0;
        }
        .audit-professional-grid .dx-datagrid-headers .dx-header-row td {
          font-weight: 600;
          color: #334155;
          padding: 12px 8px;
        }
        .audit-professional-grid .dx-data-row td {
          padding: 10px 8px;
          vertical-align: middle;
        }
        .audit-professional-grid .dx-data-row:hover {
          background-color: #f0fdfa !important;
        }
        .audit-professional-grid .dx-row-alt > td {
          background-color: #fafafa;
        }
        .audit-professional-grid .dx-datagrid-search-panel {
          margin-left: 0;
        }
        .audit-professional-grid .dx-toolbar {
          padding: 8px 16px;
          background: transparent;
        }
        .audit-professional-grid .dx-datagrid-group-panel {
          padding: 8px 16px;
        }
        .audit-professional-grid .dx-pager {
          padding: 12px 16px;
          border-top: 1px solid #e2e8f0;
        }
      `}</style>
    </>
  );
}

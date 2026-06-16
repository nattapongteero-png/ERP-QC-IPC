'use client';

/**
 * Internal Audit Dashboard Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * Professional dashboard for viewing and managing internal audit program.
 * Responsive: ResponsivePageHeader, StatCard KPI row, mobile card view,
 * empty state, no-results state, loading skeletons, scroll-snap tabs.
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import DataGrid, {
  Column,
  Paging,
  Pager,
  SearchPanel,
  ColumnChooser,
  Export,
  Grouping,
  GroupPanel,
  Summary,
  TotalItem,
  Toolbar,
  Item,
  Scrolling,
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
  Eye,
  MoreHorizontal,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  BarChart3,
  Layers,
  Activity,
  SearchX,
} from 'lucide-react';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
import { DxButton } from '@/components/ui/dx-button';
import type {
  AuditStatistics,
  ChapterCoverage,
  AuditPlan,
  Audit,
  AuditStatus,
  AuditFindingCategory,
} from '@/types/audits';

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

// ============================================
// Constants
// ============================================

// Style-only config; labels come from t() at render time via `translationKey`
const AUDIT_STATUS_CONFIG: Record<AuditStatus, {
  translationKey: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  accentBorder: string;
  accentText: string;
  chartColor: string;
  icon: React.ReactNode;
}> = {
  scheduled: {
    translationKey: 'scheduled',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    accentBorder: 'border-l-blue-500',
    accentText: 'text-blue-500',
    chartColor: '#3b82f6',
    icon: <Calendar className="h-3.5 w-3.5" />,
  },
  in_progress: {
    translationKey: 'in_progress',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    accentBorder: 'border-l-amber-500',
    accentText: 'text-amber-500',
    chartColor: '#f59e0b',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  completed: {
    translationKey: 'completed',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    accentBorder: 'border-l-emerald-500',
    accentText: 'text-emerald-500',
    chartColor: '#10b981',
    icon: <CheckCircle className="h-3.5 w-3.5" />,
  },
  cancelled: {
    translationKey: 'cancelled',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-200',
    accentBorder: 'border-l-gray-500',
    accentText: 'text-gray-500',
    chartColor: '#64748b',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

// Style-only config; labels come from t() at render time via `translationKey`
const FINDING_CATEGORY_CONFIG: Record<AuditFindingCategory, {
  translationKey: string;
  bgColor: string;
  textColor: string;
  chartColor: string;
  icon: React.ReactNode;
}> = {
  observation: {
    translationKey: 'observation',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    chartColor: '#64748b',
    icon: <Eye className="h-3.5 w-3.5" />,
  },
  minor: {
    translationKey: 'minor',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    chartColor: '#3b82f6',
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
  major: {
    translationKey: 'major',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    chartColor: '#f59e0b',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  critical: {
    translationKey: 'critical',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    chartColor: '#ef4444',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

// ============================================
// Helper Components
// ============================================

function StatusCard({
  count,
  total,
  config,
  label,
  percentSuffix,
}: {
  count: number;
  total: number;
  config: {
    accentBorder: string;
    accentText: string;
    icon: React.ReactNode;
  };
  label: string;
  percentSuffix: string;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className={`bg-white border border-gray-200 border-l-4 ${config.accentBorder} rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)] transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`${config.accentText} flex-shrink-0`}>
            {config.icon}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 truncate">{label}</p>
            <p className="text-xs text-gray-500">{percentage}{percentSuffix}</p>
          </div>
        </div>
        <p className="text-2xl font-bold text-gray-900 flex-shrink-0">{count}</p>
      </div>
    </div>
  );
}

function FindingCategoryCard({
  count,
  config,
  label,
}: {
  count: number;
  config: {
    bgColor: string;
    textColor: string;
    icon: React.ReactNode;
  };
  label: string;
}) {
  return (
    <div className={`${config.bgColor} rounded-lg p-3 flex items-center justify-between`}>
      <div className="flex items-center gap-2">
        <span className={config.textColor}>{config.icon}</span>
        <span className={`text-sm font-medium ${config.textColor}`}>{label}</span>
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
  t,
}: {
  chapter: number;
  name: string;
  auditsPlanned: number;
  auditsCompleted: number;
  findingsCount: number;
  lastAuditDate: string | null;
  t: TranslateFn;
}) {
  const progress = auditsPlanned > 0 ? Math.round((auditsCompleted / auditsPlanned) * 100) : 0;
  const progressColor = progress >= 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="bg-white border border-gray-100 rounded-lg p-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-slate-700">{chapter}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{name}</p>
          </div>
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${progress >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
          {auditsCompleted}/{auditsPlanned}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
        <div className={`${progressColor} h-1.5 rounded-full transition-all`} style={{ width: `${progress}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{findingsCount} {t('internalAudit.findingsList.findings')}</span>
        <span>{lastAuditDate ? new Date(lastAuditDate).toLocaleDateString('th-TH') : 'No audit'}</span>
      </div>
    </div>
  );
}

// ============================================
// Audit Card List (Mobile)
// ============================================

function AuditCardList({
  audits,
  onView,
  t,
}: {
  audits: Audit[];
  onView: (a: Audit) => void;
  t: TranslateFn;
}) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {audits.map((audit) => {
        const statusConfig = AUDIT_STATUS_CONFIG[audit.status];
        const hasOpen = audit.openFindingsCount > 0;
        return (
          <div
            key={audit.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all"
          >
            <button
              type="button"
              onClick={() => onView(audit)}
              className="w-full text-left p-4 flex items-start gap-3"
            >
              <div className="h-11 w-11 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <ClipboardCheck className="h-5 w-5 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-slate-700 truncate">{audit.auditNumber}</p>
                    <p className="text-sm text-gray-900 line-clamp-2 mt-0.5">{audit.scope}</p>
                  </div>
                  {statusConfig && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                      {statusConfig.icon}
                      <span className="hidden xs:inline">{t(`internalAudit.statusLabels.${audit.status}`)}</span>
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-600">
                  <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded capitalize">
                    {audit.auditType}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                    <Calendar className="h-3 w-3" />
                    {new Date(audit.scheduledDate).toLocaleDateString('th-TH')}
                  </span>
                  {audit.leadAuditorName && (
                    <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded truncate max-w-[140px]">
                      {audit.leadAuditorName}
                    </span>
                  )}
                </div>
                {audit.gmpChapters && audit.gmpChapters.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {audit.gmpChapters.slice(0, 5).map((ch) => (
                      <span key={ch} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
                        {ch}
                      </span>
                    ))}
                    {audit.gmpChapters.length > 5 && (
                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                        +{audit.gmpChapters.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
            {/* Card footer: findings + tap-to-view */}
            <div className="flex items-center border-t border-gray-100 divide-x divide-gray-100">
              <div className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm text-gray-700 min-h-[44px]">
                <FileSearch className="h-4 w-4 text-gray-500" />
                <span className="font-medium">{audit.findingsCount}</span>
                <span className="text-gray-500">{t('internalAudit.findingsList.findings')}</span>
                {hasOpen && (
                  <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs font-semibold">
                    {audit.openFindingsCount} {t('internalAudit.findingsList.openSuffix')}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onView(audit)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-slate-50 hover:text-slate-700 active:bg-slate-100 transition-colors min-h-[44px]"
              >
                <Eye className="h-4 w-4" />
                <span>{t('internalAudit.mobile.view')}</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AuditCardSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 bg-gray-200 rounded" />
              <div className="h-3 w-2/3 bg-gray-200 rounded" />
              <div className="flex gap-2 pt-1">
                <div className="h-5 w-16 bg-gray-200 rounded-full" />
                <div className="h-5 w-20 bg-gray-200 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DataGridLoadingSkeleton() {
  return (
    <div className="p-4 space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-lg animate-pulse">
          <div className="h-8 w-8 rounded-lg bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/4 bg-gray-200 rounded" />
            <div className="h-2 w-1/6 bg-gray-200 rounded" />
          </div>
          <div className="h-6 w-20 bg-gray-200 rounded-full" />
          <div className="h-6 w-16 bg-gray-200 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onCreate, t }: { onCreate: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-5">
        <ClipboardCheck className="h-10 w-10 text-slate-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('internalAudit.empty.title')}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {t('internalAudit.empty.description')}
      </p>
      <DxButton
        text={t('internalAudit.actions.scheduleAudit')}
        icon="plus"
        type="success"
        onClick={onCreate}
      />
    </div>
  );
}

function NoResultsState({ onClear, t }: { onClear: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{t('internalAudit.noResults.title')}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {t('internalAudit.noResults.description')}
      </p>
      <DxButton
        text={t('internalAudit.actions.clearFilter')}
        icon="clear"
        stylingMode="outlined"
        onClick={onClear}
      />
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
  const t = useTranslations('gmp');
  const locale = useLocale();
  const { isMobile } = useMobile();
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
    const filtered = activeTab === 'all' ? audits : audits.filter((a) => a.status === activeTab);
    return filtered.map((item, index) => ({ ...item, _rowNumber: index + 1 }));
  }, [audits, activeTab]);

  // Chart data
  const statusChartData = useMemo(() => {
    return Object.entries(auditStatusCounts)
      .filter((entry) => entry[1] > 0)
      .map(([status, count]) => ({
        status: t(`internalAudit.statusLabels.${status}`),
        count,
        color: AUDIT_STATUS_CONFIG[status as AuditStatus].chartColor,
      }));
  }, [auditStatusCounts, t]);

  const findingsChartData = useMemo(() => {
    if (!statistics) return [];
    return [
      { category: t('internalAudit.findingCategories.critical'), count: statistics.findingsByCategory.critical, color: '#ef4444' },
      { category: t('internalAudit.findingCategories.major'), count: statistics.findingsByCategory.major, color: '#f59e0b' },
      { category: t('internalAudit.findingCategories.minor'), count: statistics.findingsByCategory.minor, color: '#3b82f6' },
      { category: t('internalAudit.findingCategories.observation'), count: statistics.findingsByCategory.observation, color: '#64748b' },
    ].filter(d => d.count > 0);
  }, [statistics, t]);

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
            excelCell.value = AUDIT_STATUS_CONFIG[status] ? t(`internalAudit.statusLabels.${status}`) : status;
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
        {t(`internalAudit.statusLabels.${data.value}`)}
      </span>
    );
  }, [t]);

  const renderAuditNumberCell = useCallback((data: { data: Audit }) => {
    return (
      <button
        onClick={() => router.push(`/gmp/internal-audit/audits/${data.data.id}`)}
        className="text-slate-700 hover:text-slate-900 font-medium hover:underline"
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
          <span key={ch} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
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
            {data.data.openFindingsCount} {t('internalAudit.findingsList.openSuffix')}
          </span>
        )}
      </div>
    );
  }, [t]);

  const renderActionsCell = useCallback((data: { data: Audit }) => {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => router.push(`/gmp/internal-audit/audits/${data.data.id}`)}
          className="p-1 text-gray-500 hover:text-slate-700 hover:bg-slate-50 rounded"
          title={t('internalAudit.tooltips.viewDetails')}
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={() => {}}
          className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
          title={t('internalAudit.tooltips.moreActions')}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    );
  }, [router]);

  const handleViewAudit = useCallback((audit: Audit) => {
    router.push(`/gmp/internal-audit/audits/${audit.id}`);
  }, [router]);

  const handleCreateAudit = useCallback(() => {
    router.push('/gmp/internal-audit/audits?new=1');
  }, [router]);

  const totalAudits = audits.length;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title={t('internalAudit.pageTitle')}
        subtitle={t('internalAudit.description')}
        icon={ClipboardCheck}
        iconBgColor="bg-slate-100"
        iconColor="text-slate-600"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              text={t('internalAudit.actions.refresh')}
              stylingMode="outlined"
              onClick={handleRefresh}
              disabled={isLoading}
              className="hidden sm:inline-flex"
            />
            <DxButton
              icon="event"
              text={t('internalAudit.actions.auditPlans')}
              stylingMode="outlined"
              onClick={() => router.push('/gmp/internal-audit/plans')}
              className="hidden md:inline-flex"
            />
            <DxButton
              text={t('internalAudit.actions.scheduleAudit')}
              icon="plus"
              type="success"
              onClick={handleCreateAudit}
            />
          </div>
        }
      />

      {/* KPI StatCards — 4 key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('internalAudit.stats.totalAudits')}
          value={totalAudits}
          icon={ClipboardCheck}
          iconColor="text-slate-500"
          accentColor="border-slate-500"
          isLoading={auditsLoading}
        />
        <StatCard
          label={t('internalAudit.stats.inProgress')}
          value={auditStatusCounts.in_progress}
          icon={Clock}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={auditsLoading}
        />
        <StatCard
          label={t('internalAudit.stats.completed')}
          value={auditStatusCounts.completed}
          icon={CheckCircle}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={auditsLoading}
        />
        <StatCard
          label={t('internalAudit.stats.openFindings')}
          value={statistics?.openFindings ?? 0}
          icon={AlertTriangle}
          iconColor={(statistics?.openFindings ?? 0) > 0 ? 'text-red-500' : 'text-gray-400'}
          accentColor={(statistics?.openFindings ?? 0) > 0 ? 'border-red-500' : 'border-gray-300'}
          isLoading={statsLoading}
        />
      </div>

      {/* Quick Stats Strip — compact secondary KPI row */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="flex flex-col">
          <span className="text-xs text-gray-500">{t('internalAudit.quickStats.planned')}</span>
          <span className="text-lg font-bold text-gray-900">{statsLoading ? '...' : (statistics?.totalPlanned ?? 0)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-gray-500">{t('internalAudit.quickStats.completionRate')}</span>
          <span className="text-lg font-bold text-emerald-600">
            {statsLoading ? '...' : statistics ? `${Math.round(statistics.completionRate)}%` : t('internalAudit.notAvailable')}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-gray-500">{t('internalAudit.quickStats.totalFindings')}</span>
          <span className="text-lg font-bold text-gray-900">{statsLoading ? '...' : (statistics?.totalFindings ?? 0)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-gray-500">{t('internalAudit.quickStats.avgClosure')}</span>
          <span className="text-lg font-bold text-gray-900">
            {statsLoading ? '...' : statistics?.avgCapaClosureTime ? `${Math.round(statistics.avgCapaClosureTime)}${t('internalAudit.daysSuffix')}` : t('internalAudit.notAvailable')}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-gray-500">{t('internalAudit.quickStats.scheduled')}</span>
          <span className="text-lg font-bold text-blue-600">{statsLoading ? '...' : auditStatusCounts.scheduled}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-gray-500">{t('internalAudit.quickStats.gmpChapters')}</span>
          <span className="text-lg font-bold text-gray-900">
            {statsLoading ? '...' : (chapterCoverage?.chapters?.length ?? 10)}
          </span>
        </div>
      </div>

      {/* Active Plan Banner */}
      {activePlan && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-blue-900 truncate">{activePlan.name}</h3>
                <p className="text-sm text-blue-700">
                  {t('internalAudit.activePlan.auditsCompleted', { completed: activePlan.completedAudits, total: activePlan.totalAudits })}
                  {' ('}{activePlan.totalAudits > 0 ? Math.round((activePlan.completedAudits / activePlan.totalAudits) * 100) : 0}{'%)'}
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/gmp/internal-audit/plans')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium min-h-[40px] whitespace-nowrap"
            >
              {t('internalAudit.activePlan.viewPlan')}
            </button>
          </div>
          <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${activePlan.totalAudits > 0 ? (activePlan.completedAudits / activePlan.totalAudits) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Dashboard Grid — desktop only; mobile stacks */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 md:gap-6">
        {/* Left Column — main content */}
        <div className="xl:col-span-3 space-y-4 md:space-y-6">
          {/* Audit Status Cards */}
          <div>
            <div className="flex items-center gap-2 mb-3 md:mb-4">
              <ClipboardCheck className="h-5 w-5 text-gray-600" />
              <h3 className="text-base md:text-lg font-semibold text-gray-900">{t('internalAudit.sections.auditsByStatus')}</h3>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {(Object.entries(AUDIT_STATUS_CONFIG) as [AuditStatus, typeof AUDIT_STATUS_CONFIG[AuditStatus]][]).map(
                ([status, config]) => (
                  <StatusCard
                    key={status}
                    count={auditStatusCounts[status]}
                    total={totalAudits}
                    config={config}
                    label={t(`internalAudit.statusLabels.${status}`)}
                    percentSuffix={t('internalAudit.percentOfTotal')}
                  />
                )
              )}
            </div>
          </div>

          {/* Charts Row — hidden on mobile (too cramped); shown from lg+ */}
          <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Distribution */}
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-gray-500" />
                <h3 className="font-semibold text-gray-900">{t('internalAudit.sections.auditStatusDistribution')}</h3>
              </div>
              {statusChartData.length > 0 ? (
                <PieChart
                  key={locale}
                  dataSource={statusChartData}
                  type="doughnut"
                  palette={statusChartData.map((d) => d.color)}
                  innerRadius={0.6}
                  size={{ height: 280 }}
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
                  <p className="text-sm">{t('internalAudit.noData.audit')}</p>
                </div>
              )}
            </div>

            {/* Findings by Category */}
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-gray-500" />
                <h3 className="font-semibold text-gray-900">{t('internalAudit.sections.findingsByCategory')}</h3>
              </div>
              {findingsChartData.length > 0 ? (
                <Chart
                  key={locale}
                  dataSource={findingsChartData}
                  rotated={true}
                  size={{ height: 280 }}
                  customizePoint={(pointInfo: { argument: string }) => {
                    const item = findingsChartData.find((d) => d.category === pointInfo.argument);
                    return { color: item?.color || '#64748b' };
                  }}
                >
                  <CommonSeriesSettings
                    argumentField="category"
                    valueField="count"
                    type="bar"
                    barWidth={30}
                  />
                  <Series name={t('internalAudit.chart.findingsLegend')} color="#64748b" />
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
                  <p className="text-sm">{t('internalAudit.noData.findings')}</p>
                </div>
              )}
            </div>
          </div>

          {/* GMP Chapter Coverage */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 md:p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-gray-500" />
                <h3 className="font-semibold text-gray-900">{t('internalAudit.sections.gmpChapterCoverage', { year: currentYear })}</h3>
              </div>
              <span className="text-xs sm:text-sm text-gray-500">
                {t('internalAudit.sections.chaptersAudited', {
                  audited: chapterCoverage?.chapters?.filter((c) => c.auditsCompleted > 0).length || 0,
                  total: chapterCoverage?.chapters?.length || 10,
                })}
              </span>
            </div>
            {chapterCoverage?.chapters && chapterCoverage.chapters.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {chapterCoverage.chapters.map((ch) => (
                  <ChapterProgressCard
                    key={ch.chapter}
                    chapter={ch.chapter}
                    name={ch.name.replace(/หมวด \d+ - /, '')}
                    auditsPlanned={ch.auditsPlanned}
                    auditsCompleted={ch.auditsCompleted}
                    findingsCount={ch.findingsCount}
                    lastAuditDate={ch.lastAuditDate}
                    t={t}
                  />
                ))}
              </div>
            ) : (
              <div className="h-32 flex flex-col items-center justify-center text-gray-400">
                <Layers className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">{t('internalAudit.noData.chapter')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column — sidebars */}
        <div className="space-y-4 md:space-y-6">
          {/* Findings Summary */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 md:p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <FileSearch className="h-5 w-5 text-gray-500" />
              <h3 className="font-semibold text-gray-900">{t('internalAudit.sections.findingsSummary')}</h3>
            </div>
            <div className="space-y-2">
              {(Object.entries(FINDING_CATEGORY_CONFIG) as [AuditFindingCategory, typeof FINDING_CATEGORY_CONFIG[AuditFindingCategory]][]).map(
                ([category, config]) => (
                  <FindingCategoryCard
                    key={category}
                    count={statistics?.findingsByCategory[category] || 0}
                    config={config}
                    label={t(`internalAudit.findingCategories.${category}`)}
                  />
                )
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">{t('internalAudit.findingsList.totalFindings')}</span>
                <span className="font-bold text-gray-900">{statistics?.totalFindings || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{t('internalAudit.findingsList.openFindings')}</span>
                <span className={`font-bold ${(statistics?.openFindings || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {statistics?.openFindings || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 md:p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-gray-500" />
              <h3 className="font-semibold text-gray-900">{t('internalAudit.sections.quickActions')}</h3>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/gmp/internal-audit/plans')}
                className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors text-left min-h-[56px]"
              >
                <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                  <Calendar className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{t('internalAudit.quickActions.auditPlans')}</p>
                  <p className="text-xs text-gray-500">{t('internalAudit.quickActions.auditPlansDescription')}</p>
                </div>
              </button>
              <button
                onClick={() => router.push('/gmp/internal-audit/audits')}
                className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors text-left min-h-[56px]"
              >
                <div className="p-2 bg-emerald-100 rounded-lg flex-shrink-0">
                  <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{t('internalAudit.quickActions.allAudits')}</p>
                  <p className="text-xs text-gray-500">{t('internalAudit.quickActions.allAuditsDescription')}</p>
                </div>
              </button>
              <button
                onClick={() => router.push('/gmp/internal-audit/findings')}
                className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors text-left min-h-[56px]"
              >
                <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{t('internalAudit.quickActions.findingsCapa')}</p>
                  <p className="text-xs text-gray-500">{t('internalAudit.quickActions.findingsCapaDescription')}</p>
                </div>
              </button>
            </div>
          </div>

          {/* Open Findings Alert */}
          {statistics && statistics.openFindings > 0 && (
            <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-xl p-4 md:p-5">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-red-900">{t('internalAudit.sections.actionRequired')}</h3>
                  <p className="text-sm text-red-700 mt-1">
                    {t('internalAudit.actionRequiredAlert.message', { count: statistics.openFindings })}
                    {statistics.findingsByCategory.critical > 0 && (
                      <span className="block mt-1 font-medium">
                        {t('internalAudit.actionRequiredAlert.includingCritical', { count: statistics.findingsByCategory.critical })}
                      </span>
                    )}
                  </p>
                  <button
                    onClick={() => router.push('/gmp/internal-audit/findings?status=open')}
                    className="mt-3 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors text-sm font-medium min-h-[40px]"
                  >
                    {t('internalAudit.actionRequiredAlert.button')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Audits DataGrid / Mobile Card List */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        {/* Tabs Header — scroll-snap on mobile */}
        <div className="px-3 py-3 sm:px-5 sm:pt-5 sm:pb-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto scrollbar-thin snap-x w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap flex-shrink-0 snap-start min-h-[36px] ${
                activeTab === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>{t('internalAudit.tabs.all')}</span>
              <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded-full font-semibold">{totalAudits}</span>
            </button>
            {(Object.keys(AUDIT_STATUS_CONFIG) as AuditStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setActiveTab(status)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap flex-shrink-0 snap-start min-h-[36px] ${
                  activeTab === status
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>{t(`internalAudit.statusLabels.${status}`)}</span>
                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded-full font-semibold">
                  {auditStatusCounts[status]}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
            <ListChecks className="h-4 w-4" />
            <span>{filteredAudits.length} {t('internalAudit.findingsList.auditsCount')}</span>
          </div>
        </div>

        {/* Content: Loading / Empty / No-Results / Mobile Cards / Desktop Grid */}
        {isLoading ? (
          isMobile ? (
            <AuditCardSkeletonList count={4} />
          ) : (
            <DataGridLoadingSkeleton />
          )
        ) : audits.length === 0 ? (
          <EmptyState onCreate={handleCreateAudit} t={t} />
        ) : filteredAudits.length === 0 ? (
          <NoResultsState onClear={() => setActiveTab('all')} t={t} />
        ) : isMobile ? (
          <AuditCardList audits={filteredAudits} onView={handleViewAudit} t={t} />
        ) : (
          <div className="overflow-x-auto">
            <DataGrid
              key={locale}
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
              style={{ minWidth: 960 }}
            >
              <Scrolling mode="virtual" />
              <SearchPanel visible={true} placeholder={t('internalAudit.search.placeholder')} width={250} />
              <GroupPanel visible={true} />
              <Grouping autoExpandAll={false} />
              <ColumnChooser enabled={true} mode="select" />
              <Export enabled={true} allowExportSelectedData={false} />

              <Column
                dataField="_rowNumber"
                caption={t('items.grid.columns.rowNum')}
                width={60}
                alignment="center"
                allowFiltering={false}
                allowSorting={false}
                allowGrouping={false}
                cellRender={(cellInfo) => (
                  <span className="text-gray-500 text-sm font-medium">
                    {cellInfo.data._rowNumber}
                  </span>
                )}
              />
              <Column
                dataField="auditNumber"
                caption={t('internalAudit.table.columns.auditNumber')}
                width={130}
                cellRender={renderAuditNumberCell}
              />
              <Column dataField="scope" caption={t('internalAudit.table.columns.scope')} minWidth={200} />
              <Column
                dataField="auditType"
                caption={t('internalAudit.table.columns.type')}
                width={100}
                cellRender={(data) => (
                  <span className="capitalize">{data.value}</span>
                )}
              />
              <Column
                dataField="gmpChapters"
                caption={t('internalAudit.table.columns.gmpChapters')}
                width={150}
                cellRender={renderGmpChaptersCell}
                allowFiltering={false}
              />
              <Column
                dataField="scheduledDate"
                caption={t('internalAudit.table.columns.scheduled')}
                dataType="date"
                width={110}
                format="dd/MM/yyyy"
              />
              <Column
                dataField="leadAuditorName"
                caption={t('internalAudit.table.columns.leadAuditor')}
                width={140}
              />
              <Column
                dataField="status"
                caption={t('internalAudit.table.columns.status')}
                width={130}
                cellRender={renderStatusCell}
              />
              <Column
                caption={t('internalAudit.table.columns.findings')}
                width={120}
                cellRender={renderFindingsCell}
                allowFiltering={false}
              />
              <Column
                caption={t('internalAudit.table.columns.actions')}
                width={80}
                cellRender={renderActionsCell}
                allowFiltering={false}
                allowSorting={false}
              />

              <Summary>
                <TotalItem column="auditNumber" summaryType="count" displayFormat={`${t('internalAudit.totalLabel')}: {0}`} />
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
        )}

        {/* Refresh button on mobile (header hides on <sm) */}
        <div className="sm:hidden border-t border-gray-100 p-3 bg-gray-50/50">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 transition-colors text-sm font-medium min-h-[44px]"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{t('internalAudit.mobile.refresh')}</span>
          </button>
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
          background-color: #f8fafc !important;
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
    </div>
  );
}

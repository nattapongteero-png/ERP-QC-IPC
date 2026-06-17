'use client';

/**
 * Product Recalls Dashboard
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Responsive + informative dashboard for product recall management:
 * - ResponsivePageHeader with strong warning identity (red)
 * - 4 KPI StatCards (Total / Active / Class I / Avg Effectiveness)
 * - Charts hidden on mobile (hidden lg:grid)
 * - Mobile card view with class-severity border accent + 44px touch footer
 * - Loading skeletons, Empty state, No-results state
 * - Responsive search + tab scroll-snap filter row
 * - DxDataGrid on desktop with minWidth/hideOnMobile columns
 * - DxPopup with fullScreenOnMobile for Mock Drill
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils/cn';
import { RecallDataEntryDialog } from '@/components/recalls/RecallDataEntryDialog';
import PieChart, { Series, Label, Legend, Tooltip } from 'devextreme-react/pie-chart';
import { Chart, CommonSeriesSettings, Series as ChartSeries, ArgumentAxis, ValueAxis, Legend as ChartLegend, Tooltip as ChartTooltip } from 'devextreme-react/chart';
import {
  AlertTriangle,
  AlertOctagon,
  Activity,
  CheckCircle,
  Clock,
  Target,
  Shield,
  Package,
  Truck,
  Users,
  XCircle,
  BarChart3,
  PieChartIcon,
  SearchX,
  Calendar,
  FileText,
  ChevronRight,
} from 'lucide-react';
import type { RecallListResponse, RecallStatus, RecallClass, MockDrillResult, Recall } from '@/types/recalls';

// ============================================
// Types
// ============================================

type TabKey = 'all' | 'initiated' | 'in_progress' | 'completed' | 'closed';

// ============================================
// Constants
// ============================================

const CLASS_COLORS: Record<RecallClass, string> = {
  class_i: '#ef4444',
  class_ii: '#f59e0b',
  class_iii: '#3b82f6',
};


// next-intl's Translator shape (subset).
type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

const CLASS_BORDER_ACCENT: Record<RecallClass, string> = {
  class_i: 'border-l-red-500',
  class_ii: 'border-l-amber-500',
  class_iii: 'border-l-blue-500',
};

const CLASS_ICON_BG: Record<RecallClass, string> = {
  class_i: 'bg-red-100',
  class_ii: 'bg-amber-100',
  class_iii: 'bg-blue-100',
};

const CLASS_ICON_COLOR: Record<RecallClass, string> = {
  class_i: 'text-red-600',
  class_ii: 'text-amber-600',
  class_iii: 'text-blue-600',
};

const STATUS_COLORS: Record<RecallStatus, string> = {
  initiated: '#f59e0b',
  in_progress: '#3b82f6',
  completed: '#10b981',
  closed: '#6b7280',
};


const STATUS_BADGE_VARIANT: Record<RecallStatus, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  initiated: 'warning',
  in_progress: 'info',
  completed: 'success',
  closed: 'default',
};

// Status tab configuration (scroll-snap filter row) — labels supplied via t()
const TAB_CONFIG: Array<{
  key: TabKey;
  labelKey: string;
  bgActive: string;
  icon: React.ElementType;
}> = [
  { key: 'all', labelKey: 'recalls.tabs.all', bgActive: 'bg-gray-900', icon: FileText },
  { key: 'initiated', labelKey: 'recalls.tabs.initiated', bgActive: 'bg-amber-500', icon: Clock },
  { key: 'in_progress', labelKey: 'recalls.tabs.in_progress', bgActive: 'bg-blue-600', icon: Activity },
  { key: 'completed', labelKey: 'recalls.tabs.completed', bgActive: 'bg-emerald-600', icon: CheckCircle },
  { key: 'closed', labelKey: 'recalls.tabs.closed', bgActive: 'bg-gray-600', icon: XCircle },
];

// ============================================
// API Functions
// ============================================

async function fetchRecalls(
  status?: RecallStatus,
  recallClass?: RecallClass
): Promise<RecallListResponse> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (recallClass) params.set('recallClass', recallClass);

  const response = await fetch(`/api/recalls?${params.toString()}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function executeMockDrill(lotId: number): Promise<MockDrillResult> {
  const response = await fetch('/api/recalls/mock-drill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lotId }),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

// ============================================
// Helper Functions
// ============================================

function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '-';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getRecoveryColor(rate: number): string {
  if (rate >= 70) return 'text-emerald-600';
  if (rate >= 50) return 'text-amber-600';
  if (rate > 0) return 'text-red-600';
  return 'text-gray-400';
}

function getRecoveryBarColor(rate: number): string {
  if (rate >= 70) return 'bg-emerald-500';
  if (rate >= 50) return 'bg-amber-500';
  if (rate > 0) return 'bg-red-500';
  return 'bg-gray-300';
}

// ============================================
// Recall Effectiveness Matrix
// ============================================

function RecallEffectivenessMatrix({ recalls, t }: { recalls: Recall[]; t: TranslateFn }) {
  const matrixData = useMemo(() => {
    const activeRecalls = recalls.filter(r => r.status !== 'closed');
    const matrix: Record<string, { count: number; avgEffectiveness: number; recalls: Recall[] }> = {};

    (['class_i', 'class_ii', 'class_iii'] as RecallClass[]).forEach(cls => {
      (['initiated', 'in_progress', 'completed'] as RecallStatus[]).forEach(status => {
        matrix[`${cls}-${status}`] = { count: 0, avgEffectiveness: 0, recalls: [] };
      });
    });

    activeRecalls.forEach(recall => {
      const key = `${recall.recallClass}-${recall.status}`;
      if (matrix[key]) {
        matrix[key].count++;
        matrix[key].recalls.push(recall);
      }
    });

    Object.keys(matrix).forEach(key => {
      const cell = matrix[key];
      if (cell.recalls.length > 0) {
        cell.avgEffectiveness = cell.recalls.reduce((sum, r) => sum + r.effectivenessRate, 0) / cell.recalls.length;
      }
    });

    return matrix;
  }, [recalls]);

  const getCellColor = (cls: string, count: number): string => {
    if (count === 0) return 'bg-gray-50';
    if (cls === 'class_i') return 'bg-red-100 text-red-800';
    if (cls === 'class_ii') return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
        <Shield className="w-4 h-4" />
        {t('recalls.charts.activeRecallsMatrix')}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="p-1"></th>
              <th className="p-1 text-center font-medium text-gray-500">{t('recalls.charts.matrixHeaderInitiated')}</th>
              <th className="p-1 text-center font-medium text-gray-500">{t('recalls.charts.matrixHeaderInProgress')}</th>
              <th className="p-1 text-center font-medium text-gray-500">{t('recalls.charts.matrixHeaderCompleted')}</th>
            </tr>
          </thead>
          <tbody>
            {(['class_i', 'class_ii', 'class_iii'] as RecallClass[]).map((cls) => (
              <tr key={cls}>
                <td className="p-1 text-right font-medium text-gray-500 pr-2">
                  {t(`recalls.classLabels.${cls}`)}
                </td>
                {(['initiated', 'in_progress', 'completed'] as RecallStatus[]).map((status) => {
                  const cell = matrixData[`${cls}-${status}`];
                  return (
                    <td key={`${cls}-${status}`} className="p-1">
                      <div
                        className={cn(
                          'rounded-lg h-14 flex flex-col items-center justify-center font-bold transition-all',
                          getCellColor(cls, cell.count),
                          cell.count > 0 && 'ring-1 ring-offset-1 ring-gray-300'
                        )}
                      >
                        {cell.count > 0 ? (
                          <>
                            <span className="text-lg">{cell.count}</span>
                            <span className="text-[10px] font-normal opacity-70">
                              {cell.avgEffectiveness.toFixed(0)}% {t('recalls.charts.effectivenessSuffix')}
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-center gap-4 mt-4 text-xs flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-red-100 border border-red-200"></div>
            <span className="text-gray-500">{t('recalls.classLegend.classI')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-200"></div>
            <span className="text-gray-500">{t('recalls.classLegend.classII')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-blue-100 border border-blue-200"></div>
            <span className="text-gray-500">{t('recalls.classLegend.classIII')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function RecallsDashboardPage() {
  const router = useRouter();
  const t = useTranslations('gmp');
  const locale = useLocale();
  const { isMobile } = useMobile();

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [showNewRecallDialog, setShowNewRecallDialog] = useState(false);
  const [showMockDrill, setShowMockDrill] = useState(false);
  const [mockDrillLotId, setMockDrillLotId] = useState<number>(0);
  const [mockDrillResult, setMockDrillResult] = useState<MockDrillResult | null>(null);
  const [mockDrillLoading, setMockDrillLoading] = useState(false);

  // Fetch all recalls
  const { data: allData, isLoading, refetch } = useQuery({
    queryKey: ['recalls-all'],
    queryFn: () => fetchRecalls(),
  });

  const recalls = useMemo(() => allData?.recalls || [], [allData]);

  // Calculate dashboard stats
  const stats = useMemo(() => {
    const activeRecalls = recalls.filter((r) => r.status !== 'closed');
    const completedRecalls = recalls.filter((r) => r.status === 'completed' || r.status === 'closed');

    const avgEffectiveness = completedRecalls.length > 0
      ? completedRecalls.reduce((sum, r) => sum + r.effectivenessRate, 0) / completedRecalls.length
      : 0;

    const totalDistributed = activeRecalls.reduce((sum, r) => sum + r.distributedQuantity, 0);
    const totalReturned = activeRecalls.reduce((sum, r) => sum + r.returnedQuantity, 0);

    const byStatus = {
      initiated: recalls.filter((r) => r.status === 'initiated').length,
      in_progress: recalls.filter((r) => r.status === 'in_progress').length,
      completed: recalls.filter((r) => r.status === 'completed').length,
      closed: recalls.filter((r) => r.status === 'closed').length,
    };

    const byClass = {
      class_i: activeRecalls.filter((r) => r.recallClass === 'class_i').length,
      class_ii: activeRecalls.filter((r) => r.recallClass === 'class_ii').length,
      class_iii: activeRecalls.filter((r) => r.recallClass === 'class_iii').length,
    };

    return {
      total: recalls.length,
      active: activeRecalls.length,
      classI: byClass.class_i,
      classII: byClass.class_ii,
      classIII: byClass.class_iii,
      avgEffectiveness,
      totalDistributed,
      totalReturned,
      byStatus,
      byClass,
    };
  }, [recalls]);

  // Per-tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = {
      all: recalls.length,
      initiated: stats.byStatus.initiated,
      in_progress: stats.byStatus.in_progress,
      completed: stats.byStatus.completed,
      closed: stats.byStatus.closed,
    };
    return counts;
  }, [recalls.length, stats]);

  // Filter recalls based on tab + search
  const filteredRecalls = useMemo(() => {
    let list = recalls;

    switch (activeTab) {
      case 'initiated':
        list = list.filter(r => r.status === 'initiated');
        break;
      case 'in_progress':
        list = list.filter(r => r.status === 'in_progress');
        break;
      case 'completed':
        list = list.filter(r => r.status === 'completed');
        break;
      case 'closed':
        list = list.filter(r => r.status === 'closed');
        break;
      default:
        break;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.recallNumber?.toLowerCase().includes(q) ||
        r.productName?.toLowerCase().includes(q) ||
        r.coordinatorName?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q)
      );
    }

    return list.map((item, index) => ({ ...item, _rowNumber: index + 1 }));
  }, [recalls, activeTab, search]);

  // Chart data
  const classChartData = useMemo(() => {
    return [
      { class: t('recalls.classLabels.class_i'), count: stats.byClass.class_i, color: CLASS_COLORS.class_i },
      { class: t('recalls.classLabels.class_ii'), count: stats.byClass.class_ii, color: CLASS_COLORS.class_ii },
      { class: t('recalls.classLabels.class_iii'), count: stats.byClass.class_iii, color: CLASS_COLORS.class_iii },
    ].filter(item => item.count > 0);
  }, [stats, t]);

  const statusChartData = useMemo(() => {
    return [
      { status: t('recalls.statusLabels.initiated'), count: stats.byStatus.initiated, color: STATUS_COLORS.initiated },
      { status: t('recalls.statusLabels.in_progress'), count: stats.byStatus.in_progress, color: STATUS_COLORS.in_progress },
      { status: t('recalls.statusLabels.completed'), count: stats.byStatus.completed, color: STATUS_COLORS.completed },
      { status: t('recalls.statusLabels.closed'), count: stats.byStatus.closed, color: STATUS_COLORS.closed },
    ].filter(item => item.count > 0);
  }, [stats, t]);

  // Handlers
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleRowClick = useCallback((e: { data?: Recall }) => {
    if (e.data?.id) {
      router.push(`/gmp/recalls/${e.data.id}`);
    }
  }, [router]);

  const handleRecallClick = useCallback((id: number) => {
    router.push(`/gmp/recalls/${id}`);
  }, [router]);

  const handleNewRecall = useCallback(() => {
    setShowNewRecallDialog(true);
  }, []);

  const handleDialogSuccess = useCallback(() => {
    setShowNewRecallDialog(false);
    refetch();
  }, [refetch]);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setActiveTab('all');
  }, []);

  const handleMockDrill = async () => {
    if (!mockDrillLotId) return;
    setMockDrillLoading(true);
    try {
      const result = await executeMockDrill(mockDrillLotId);
      setMockDrillResult(result);
    } catch (error) {
      console.error('Mock drill failed:', error);
    } finally {
      setMockDrillLoading(false);
    }
  };

  // Cell renderers
  const renderRecallNumberCell = useCallback((data: { data?: Recall }) => {
    const r = data.data;
    if (!r) return null;
    const isClassI = r.recallClass === 'class_i';
    return (
      <div className="flex items-center gap-2">
        {isClassI && (
          <AlertOctagon className="h-4 w-4 text-red-600 flex-shrink-0" aria-label={t('recalls.classIAria')} />
        )}
        <span className="font-mono font-semibold text-red-700">{r.recallNumber}</span>
      </div>
    );
  }, [t]);

  const renderClassCell = useCallback((data: { data?: Recall }) => {
    if (!data.data) return null;
    const cls = data.data.recallClass;
    const colors: Record<RecallClass, string> = {
      class_i: 'bg-red-100 text-red-800',
      class_ii: 'bg-yellow-100 text-yellow-800',
      class_iii: 'bg-blue-100 text-blue-800',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${colors[cls]}`}>
        {t(`recalls.classLabels.${cls}`)}
      </span>
    );
  }, [t]);

  const renderStatusCell = useCallback((data: { data?: Recall }) => {
    if (!data.data) return null;
    return (
      <Badge variant={STATUS_BADGE_VARIANT[data.data.status]} dot>
        {t(`recalls.statusLabels.${data.data.status}`)}
      </Badge>
    );
  }, [t]);

  const renderProductCell = useCallback((data: { data?: Recall }) => {
    const r = data.data;
    if (!r) return null;
    return (
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">{r.productName}</p>
        {r.affectedLotNumbers && r.affectedLotNumbers.length > 0 && (
          <p className="text-xs text-gray-500 font-mono truncate">
            {r.affectedLotNumbers.slice(0, 2).join(', ')}
            {r.affectedLotNumbers.length > 2 && ` +${r.affectedLotNumbers.length - 2}`}
          </p>
        )}
      </div>
    );
  }, []);

  const renderEffectivenessCell = useCallback((data: { data?: Recall }) => {
    const r = data.data;
    if (!r) return null;
    const rate = Number(r.effectivenessRate) || 0;
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[60px]">
          <div
            className={cn('h-full transition-all', getRecoveryBarColor(rate))}
            style={{ width: `${Math.min(rate, 100)}%` }}
          />
        </div>
        <span className={cn('text-xs font-semibold min-w-[40px]', getRecoveryColor(rate))}>
          {rate.toFixed(0)}%
        </span>
      </div>
    );
  }, []);

  const renderQuantitiesCell = useCallback((data: { data?: Recall }) => {
    const r = data.data;
    if (!r) return null;
    const distributed = Number(r.distributedQuantity) || 0;
    const returned = Number(r.returnedQuantity) || 0;
    return (
      <div className="text-xs space-y-0.5">
        <div className="flex items-center gap-1 text-gray-600">
          <Truck className="w-3 h-3" />
          {distributed.toLocaleString()}
        </div>
        <div className="flex items-center gap-1 text-emerald-600">
          <Package className="w-3 h-3" />
          {returned.toLocaleString()}
        </div>
      </div>
    );
  }, []);

  // DataGrid columns
  const columns: DxDataGridColumn[] = useMemo(() => [
    {
      dataField: '_rowNumber',
      caption: t('items.grid.columns.rowNum'),
      width: 60,
      alignment: 'center',
      allowFiltering: false,
      allowSorting: false,
      cellRender: (cell) => (
        <span className="text-gray-500 text-sm font-medium">
          {(cell.data as { _rowNumber?: number })._rowNumber}
        </span>
      ),
    },
    {
      dataField: 'recallNumber',
      caption: t('recalls.columns.recallNumber'),
      width: 150,
      cellRender: renderRecallNumberCell,
    },
    {
      dataField: 'recallClass',
      caption: t('recalls.columns.class'),
      width: 110,
      cellRender: renderClassCell,
    },
    {
      dataField: 'productName',
      caption: t('recalls.columns.product'),
      minWidth: 200,
      cellRender: renderProductCell,
    },
    {
      dataField: 'status',
      caption: t('recalls.columns.status'),
      width: 130,
      cellRender: renderStatusCell,
    },
    {
      dataField: 'effectivenessRate',
      caption: t('recalls.columns.recovery'),
      width: 140,
      hideOnMobile: true,
      cellRender: renderEffectivenessCell,
    },
    {
      dataField: 'distributedQuantity',
      caption: t('recalls.columns.quantity'),
      width: 110,
      hideOnMobile: true,
      hideOnTablet: true,
      cellRender: renderQuantitiesCell,
    },
    {
      dataField: 'coordinatorName',
      caption: t('recalls.columns.coordinator'),
      width: 160,
      hideOnMobile: true,
      hideOnTablet: true,
    },
    {
      dataField: 'initiatedDate',
      caption: t('recalls.columns.initiated'),
      width: 120,
      dataType: 'date',
      hideOnMobile: true,
    },
  ], [renderRecallNumberCell, renderClassCell, renderProductCell, renderStatusCell, renderEffectivenessCell, renderQuantitiesCell, t]);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title={t('recalls.pageTitle')}
        subtitle={t('recalls.description')}
        icon={AlertOctagon}
        iconBgColor="bg-red-100"
        iconColor="text-red-600"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              text={t('recalls.actions.refresh')}
              stylingMode="outlined"
              onClick={handleRefresh}
              className="hidden sm:inline-flex"
            />
            <DxButton
              icon="like"
              text={t('recalls.buttons.mockDrill')}
              stylingMode="outlined"
              onClick={() => setShowMockDrill(true)}
              className="hidden md:inline-flex"
            />
            <DxButton
              icon="plus"
              text={t('recalls.actions.initiateRecall')}
              type="danger"
              onClick={handleNewRecall}
            />
          </div>
        }
      />

      {/* Critical Alert Banner */}
      {stats.classI > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4">
          <div className="flex items-start sm:items-center gap-3 flex-col sm:flex-row">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2 bg-red-100 rounded-full animate-pulse flex-shrink-0">
                <AlertOctagon className="h-5 w-5 text-red-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-red-800 text-sm sm:text-base">
                  {t(
                    stats.classI === 1
                      ? 'recalls.alerts.classIActiveSingle'
                      : 'recalls.alerts.classIActiveMany',
                    { count: stats.classI }
                  )}
                </h3>
                <p className="text-xs sm:text-sm text-red-600 mt-0.5">
                  {t('recalls.alerts.classIActiveSubtitle')}
                </p>
              </div>
            </div>
            <DxButton
              text={t('recalls.buttons.viewCritical')}
              type="danger"
              stylingMode="contained"
              onClick={() => setActiveTab('all')}
              className="self-end sm:self-auto"
            />
          </div>
        </div>
      )}

      {/* 4 KPI StatCards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('recalls.stats.totalRecalls')}
          value={stats.total}
          icon={FileText}
          iconColor="text-gray-500"
          accentColor="border-gray-400"
          isLoading={isLoading}
        />
        <StatCard
          label={t('recalls.stats.active')}
          value={stats.active}
          icon={AlertTriangle}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          trend={stats.active > 0 ? { value: String(stats.active), direction: 'neutral' } : undefined}
          isLoading={isLoading}
        />
        <StatCard
          label={t('recalls.stats.classICritical')}
          value={stats.classI}
          icon={AlertOctagon}
          iconColor={stats.classI > 0 ? 'text-red-500' : 'text-gray-400'}
          accentColor={stats.classI > 0 ? 'border-red-500' : 'border-gray-300'}
          trend={stats.classI > 0 ? { value: String(stats.classI), direction: 'down' } : undefined}
          isLoading={isLoading}
        />
        <StatCard
          label={t('recalls.stats.avgEffectiveness')}
          value={`${stats.avgEffectiveness.toFixed(0)}%`}
          icon={Target}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          trend={stats.avgEffectiveness >= 70 ? { value: `${stats.avgEffectiveness.toFixed(0)}`, direction: 'up' } : undefined}
          isLoading={isLoading}
        />
      </div>

      {/* Charts Row - Hidden on mobile */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Class Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4" />
            {t('recalls.charts.byRecallClass')}
          </h3>
          {classChartData.length > 0 ? (
            <PieChart
              key={locale}
              id="class-pie"
              dataSource={classChartData}
              type="doughnut"
              innerRadius={0.65}
              palette={classChartData.map(d => d.color)}
              size={{ height: 260 }}
            >
              <Series argumentField="class" valueField="count">
                <Label visible={true} position="inside" />
              </Series>
              <Legend
                visible={true}
                orientation="vertical"
                horizontalAlignment="right"
                verticalAlignment="top"
                customizeText={(info: { pointName?: string; pointIndex?: number }) => {
                  const d = classChartData[info.pointIndex ?? -1];
                  return d ? `${info.pointName} (${d.count})` : (info.pointName ?? '');
                }}
              />
              <Tooltip enabled={true} />
            </PieChart>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              {t('recalls.charts.noActiveRecalls')}
            </div>
          )}
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            {t('recalls.charts.byStatus')}
          </h3>
          {statusChartData.length > 0 ? (
            <Chart
              key={locale}
              id="status-chart"
              dataSource={statusChartData}
              rotated={true}
            >
              <CommonSeriesSettings type="bar" argumentField="status" valueField="count" />
              <ChartSeries name={t('recalls.charts.legendCount')} color="#ef4444" barWidth={30} />
              <ArgumentAxis />
              <ValueAxis />
              <ChartLegend visible={false} />
              <ChartTooltip enabled={true} />
            </Chart>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              {t('recalls.charts.noDataAvailable')}
            </div>
          )}
        </div>

        {/* Effectiveness Matrix */}
        <RecallEffectivenessMatrix recalls={recalls} t={t} />
      </div>

      {/* DataGrid / Cards Card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Filter Header: Status Tabs (scroll-snap) */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
          <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-thin snap-x">
            {TAB_CONFIG.map((tab) => {
              const isActive = activeTab === tab.key;
              const count = tabCounts[tab.key];
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 snap-start min-h-[36px]',
                    isActive
                      ? `${tab.bgActive} text-white shadow-sm`
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t(tab.labelKey)}</span>
                  <span className={cn(
                    'ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold',
                    isActive ? 'bg-white/25 text-inherit' : 'bg-gray-200 text-gray-700'
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search + count row */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="w-full sm:max-w-md">
            <DxTextBox
              placeholder={t('recalls.search.placeholder')}
              value={search}
              onValueChange={setSearch}
              showClearButton
              mode="search"
            />
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
            <FileText className="h-4 w-4 text-gray-400" />
            <span>{filteredRecalls.length} / {recalls.length} {t('recalls.recallsCountSuffix')}</span>
          </div>
        </div>

        {/* Content: Loading / Empty / No-Results / Mobile Cards / Desktop Grid */}
        {isLoading ? (
          isMobile ? <RecallCardSkeletonList count={4} /> : <DataGridLoadingSkeleton />
        ) : recalls.length === 0 ? (
          <RecallsEmptyState onCreate={handleNewRecall} t={t} />
        ) : filteredRecalls.length === 0 ? (
          <RecallsNoResultsState onClear={handleClearFilters} t={t} />
        ) : isMobile ? (
          <RecallCardList recalls={filteredRecalls} onClick={handleRecallClick} t={t} />
        ) : (
          <DxDataGrid
            key={locale}
            dataSource={filteredRecalls}
            keyExpr="id"
            columns={columns}
            sorting
            responsiveColumns
            virtualScrolling={filteredRecalls.length > 100}
            height={600}
            mobileHeight={520}
            tabletHeight={560}
            onRowClick={handleRowClick}
            noDataText={t('recalls.noDataText')}
          />
        )}
      </div>

      {/* New Recall Dialog */}
      <RecallDataEntryDialog
        visible={showNewRecallDialog}
        onClose={() => setShowNewRecallDialog(false)}
        onSaved={handleDialogSuccess}
        mode="create"
        title={t('recalls.dialogs.initiateTitle')}
      />

      {/* Mock Drill Dialog - fullScreenOnMobile via DxPopup default */}
      <DxPopup
        visible={showMockDrill}
        onHiding={() => {
          setShowMockDrill(false);
          setMockDrillResult(null);
          setMockDrillLotId(0);
        }}
        title={t('recalls.dialogs.mockDrillTitle')}
        width={500}
        height="auto"
        maxWidth={600}
        showCloseButton
        fullScreenOnMobile
      >
        <div className="p-4 space-y-4">
          {!mockDrillResult ? (
            <>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-blue-800">FDA 4-Hour Traceability Test</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Test your ability to trace product distribution within the FDA-required 4-hour window.
                      Enter a lot ID to verify traceability.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('recalls.mockDrill.lotIdLabel')}</label>
                <DxNumberBox
                  value={mockDrillLotId}
                  onValueChanged={(e) => setMockDrillLotId(e.value || 0)}
                  min={1}
                  placeholder={t('recalls.search.enterLotId')}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <DxButton
                  text={t('common.cancel')}
                  onClick={() => setShowMockDrill(false)}
                  stylingMode="outlined"
                />
                <DxButton
                  text={t('recalls.buttons.runMockDrill')}
                  icon="like"
                  onClick={handleMockDrill}
                  type="default"
                  disabled={!mockDrillLotId || mockDrillLoading}
                />
              </div>
            </>
          ) : (
            <>
              <div
                className={cn(
                  'p-4 rounded-xl border',
                  mockDrillResult.passedTarget
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-red-50 border-red-200'
                )}
              >
                <div className="flex items-center gap-3">
                  {mockDrillResult.passedTarget ? (
                    <CheckCircle className="h-10 w-10 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-10 w-10 text-red-600 flex-shrink-0" />
                  )}
                  <div>
                    <h3 className="text-lg font-bold">
                      {mockDrillResult.passedTarget ? 'DRILL PASSED' : 'DRILL FAILED'}
                    </h3>
                    <p className="text-sm">
                      Traceability completed in{' '}
                      <span className="font-semibold">{mockDrillResult.timeToIdentify.toFixed(2)} seconds</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-100 rounded-xl text-center">
                  <Users className="h-6 w-6 mx-auto mb-2 text-gray-500" />
                  <div className="text-2xl font-bold">{mockDrillResult.customersIdentified}</div>
                  <div className="text-xs text-gray-500">{t('recalls.mockDrill.customersIdentified')}</div>
                </div>
                <div className="p-4 bg-gray-100 rounded-xl text-center">
                  <Package className="h-6 w-6 mx-auto mb-2 text-gray-500" />
                  <div className="text-2xl font-bold">{mockDrillResult.totalDistributed}</div>
                  <div className="text-xs text-gray-500">{t('recalls.mockDrill.unitsDistributed')}</div>
                </div>
              </div>

              <div className="p-3 bg-gray-100 rounded-xl space-y-1">
                <div className="text-sm flex items-center justify-between">
                  <span className="text-gray-500">Lot Number:</span>
                  <span className="font-mono font-medium">{mockDrillResult.lotNumber}</span>
                </div>
                <div className="text-sm flex items-center justify-between">
                  <span className="text-gray-500">Drill ID:</span>
                  <span className="font-mono">{mockDrillResult.drillId}</span>
                </div>
                <div className="text-sm flex items-center justify-between">
                  <span className="text-gray-500">Executed:</span>
                  <span>{new Date(mockDrillResult.executedAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center justify-end pt-4 border-t">
                <DxButton
                  text={t('common.close')}
                  onClick={() => {
                    setShowMockDrill(false);
                    setMockDrillResult(null);
                    setMockDrillLotId(0);
                  }}
                  stylingMode="outlined"
                />
              </div>
            </>
          )}
        </div>
      </DxPopup>
    </div>
  );
}

// ============================================
// Helper Sub-Components (Mobile Cards, Skeletons, Empty States)
// ============================================

/**
 * Mobile card list — replaces DataGrid on mobile viewports.
 * Uses class-severity border-left accent for quick visual scanning.
 * Footer provides 44px touch target.
 */
function RecallCardList({
  recalls,
  onClick,
  t,
}: {
  recalls: Recall[];
  onClick: (id: number) => void;
  t: TranslateFn;
}) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {recalls.map((r) => {
        const rate = Number(r.effectivenessRate) || 0;
        const distributed = Number(r.distributedQuantity) || 0;
        const returned = Number(r.returnedQuantity) || 0;
        return (
          <div
            key={r.id}
            className={cn(
              'bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all border-l-4',
              CLASS_BORDER_ACCENT[r.recallClass]
            )}
          >
            {/* Card body - tap to view */}
            <button
              type="button"
              onClick={() => onClick(r.id)}
              className="w-full text-left p-4 flex items-start gap-3"
            >
              <div
                className={cn(
                  'h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0',
                  CLASS_ICON_BG[r.recallClass]
                )}
              >
                <AlertOctagon className={cn('h-5 w-5', CLASS_ICON_COLOR[r.recallClass])} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-red-700 text-sm">{r.recallNumber}</p>
                    <p className="font-medium text-gray-900 text-base truncate mt-0.5">{r.productName}</p>
                  </div>
                  <Badge variant={STATUS_BADGE_VARIANT[r.status]} size="sm" dot>
                    {t(`recalls.statusLabels.${r.status}`)}
                  </Badge>
                </div>

                {/* Class + initiated date */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-semibold',
                    r.recallClass === 'class_i' ? 'bg-red-100 text-red-800' :
                    r.recallClass === 'class_ii' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  )}>
                    {t(`recalls.classLabels.${r.recallClass}`)}
                  </span>
                  {r.initiatedDate && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="h-3 w-3" />
                      {formatDate(r.initiatedDate)}
                    </span>
                  )}
                </div>

                {/* Quantities + recovery */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-3 text-xs flex-wrap">
                    <span className="inline-flex items-center gap-1 text-gray-600">
                      <Truck className="h-3 w-3" />
                      <span className="font-medium">{distributed.toLocaleString()}</span>
                      <span className="text-gray-400">distributed</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <Package className="h-3 w-3" />
                      <span className="font-medium">{returned.toLocaleString()}</span>
                      <span className="text-gray-400">returned</span>
                    </span>
                  </div>

                  {/* Recovery bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full transition-all', getRecoveryBarColor(rate))}
                        style={{ width: `${Math.min(rate, 100)}%` }}
                      />
                    </div>
                    <span className={cn('text-xs font-semibold min-w-[36px] text-right', getRecoveryColor(rate))}>
                      {rate.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </button>

            {/* Tap footer — 44px touch target */}
            <button
              type="button"
              onClick={() => onClick(r.id)}
              className="w-full flex items-center justify-center gap-1.5 border-t border-gray-100 py-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 active:bg-red-100 transition-colors min-h-[44px]"
            >
              <span>{t('recalls.viewRecall')}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Loading skeleton for mobile card list */
function RecallCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse border-l-4 border-l-gray-300">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 bg-gray-200 rounded" />
              <div className="h-4 w-2/3 bg-gray-200 rounded" />
              <div className="flex gap-2 pt-1">
                <div className="h-5 w-16 bg-gray-200 rounded-full" />
                <div className="h-5 w-20 bg-gray-200 rounded-full" />
              </div>
              <div className="h-2 w-full bg-gray-200 rounded-full mt-2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Loading skeleton for desktop DataGrid area */
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

/** Empty State — shown when zero recalls exist */
function RecallsEmptyState({ onCreate, t }: { onCreate: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-red-100 flex items-center justify-center mb-5">
        <AlertOctagon className="h-10 w-10 text-red-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {t('recalls.empty.title')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {t('recalls.empty.description')}
      </p>
      <DxButton
        text={t('recalls.buttons.initiateRecall')}
        icon="plus"
        type="danger"
        onClick={onCreate}
      />
    </div>
  );
}

/** No Results State — shown when filter/search yields zero results */
function RecallsNoResultsState({ onClear, t }: { onClear: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {t('recalls.noResults.title')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {t('recalls.noResults.description')}
      </p>
      <DxButton
        text={t('common.clearFilters')}
        icon="clear"
        stylingMode="outlined"
        onClick={onClear}
      />
    </div>
  );
}

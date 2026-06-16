'use client';

/**
 * Quality Tests Dashboard Page
 *
 * Professional dashboard for viewing and managing quality control tests.
 * Responsive: ResponsivePageHeader, StatCard KPI row, mobile card view,
 * empty state, no-results state, loading skeletons.
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toLocalDateStr } from '@/lib/utils/date-format';
import { useQuery } from '@tanstack/react-query';
import DataGrid, {
  Column,
  Paging,
  Pager,
  SearchPanel,
  Scrolling,
  Export,
} from 'devextreme-react/data-grid';
import {
  PieChart,
  Series,
  Label,
  Legend,
  Tooltip,
  Connector,
} from 'devextreme-react/pie-chart';
import {
  Chart,
  CommonSeriesSettings,
  Series as ChartSeries,
  ArgumentAxis,
  ValueAxis,
  Legend as ChartLegend,
  Tooltip as ChartTooltip,
  Label as ChartLabel,
} from 'devextreme-react/chart';
import { DxButton } from '@/components/ui/dx-button';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
import { Workbook } from 'exceljs';
import { saveAs } from 'file-saver';
import { exportDataGrid } from 'devextreme/excel_exporter';
import type { ExportingEvent } from 'devextreme/ui/data_grid';
import {
  FlaskConical,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  TrendingUp,
  Package,
  Beaker,
  ClipboardCheck,
  Eye,
  Activity,
  BarChart3,
  Calendar,
  Percent,
  SearchX,
  ChevronRight,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface QualityTest {
  id: number;
  lotId: number;
  lotNumber: string;
  itemId: number | null;
  itemCode: string | null;
  itemName: string | null;
  specId: number;
  testName: string;
  testMethod: string;
  specification: string;
  minValue: number | null;
  maxValue: number | null;
  testType: 'incoming' | 'in_process' | 'final';
  sampleNumber: string;
  testDate: string;
  result: string;
  numericResult: number | null;
  status: 'pending' | 'pass' | 'fail' | 'retest';
  createdAt: string;
  // Disposition fields (FR-067 to FR-070)
  disposition?: string | null;
  dispositionReason?: string | null;
  dispositionBy?: number | null;
  dispositionApprovedBy?: number | null;
}

// next-intl translator type (compatible superset for helper components)
type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

// ============================================
// Constants
// ============================================

const STATUS_CONFIG = {
  pending: {
    color: '#64748b',
    bgClass: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: Clock,
  },
  pass: {
    color: '#22c55e',
    bgClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: CheckCircle,
  },
  fail: {
    color: '#ef4444',
    bgClass: 'bg-red-100 text-red-700 border-red-200',
    icon: XCircle,
  },
  retest: {
    color: '#f59e0b',
    bgClass: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: AlertTriangle,
  },
} as const;

// Disposition status config for FR-067 to FR-070
const DISPOSITION_CONFIG = {
  pending_disposition: {
    bgClass: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: AlertTriangle,
  },
  pending_approval: {
    bgClass: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Clock,
  },
  approved: {
    bgClass: 'bg-green-100 text-green-700 border-green-200',
    icon: CheckCircle,
  },
} as const;

const TYPE_CONFIG = {
  incoming: {
    gradient: 'from-blue-500 to-blue-600',
    icon: Package,
  },
  in_process: {
    gradient: 'from-amber-500 to-amber-600',
    icon: Beaker,
  },
  final: {
    gradient: 'from-emerald-500 to-emerald-600',
    icon: ClipboardCheck,
  },
} as const;

// Tab key → status mapping
type TabKey = 'all' | 'pending' | 'pass' | 'fail' | 'retest';

// ============================================
// API Functions
// ============================================

async function fetchTests(): Promise<QualityTest[]> {
  const response = await fetch('/api/quality/tests?limit=1000');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch tests');
  }
  return result.data?.items || [];
}

// ============================================
// Component
// ============================================

export default function QualityTestsPage() {
  const router = useRouter();
  const t = useTranslations('quality');
  const { isMobile } = useMobile();
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  // Fetch quality tests
  const { data: tests = [], isLoading, refetch } = useQuery({
    queryKey: ['quality-tests'],
    queryFn: fetchTests,
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const pending = tests.filter(t => t.status === 'pending').length;
    const pass = tests.filter(t => t.status === 'pass').length;
    const fail = tests.filter(t => t.status === 'fail').length;
    const retest = tests.filter(t => t.status === 'retest').length;
    const total = tests.length;
    const completed = pass + fail;
    const passRate = completed > 0 ? (pass / completed) * 100 : 0;

    // By type
    const byType = {
      incoming: tests.filter(t => t.testType === 'incoming'),
      in_process: tests.filter(t => t.testType === 'in_process'),
      final: tests.filter(t => t.testType === 'final'),
    };

    const typeStats = (Object.keys(byType) as Array<keyof typeof byType>).reduce((acc, type) => {
      const typeTests = byType[type];
      const typePass = typeTests.filter(t => t.status === 'pass').length;
      const typeCompleted = typeTests.filter(t => ['pass', 'fail'].includes(t.status)).length;
      acc[type] = {
        count: typeTests.length,
        passRate: typeCompleted > 0 ? (typePass / typeCompleted) * 100 : 0,
      };
      return acc;
    }, {} as Record<string, { count: number; passRate: number }>);

    // Today's tests
    const today = toLocalDateStr(new Date());
    const todayTests = tests.filter(t => t.testDate?.startsWith(today)).length;

    // Disposition stats (FR-067 to FR-070)
    const needsDisposition = tests.filter(t =>
      (t.status === 'fail' || t.status === 'retest') && !t.disposition
    ).length;
    const needsApproval = tests.filter(t =>
      t.disposition && !t.dispositionApprovedBy
    ).length;

    return { total, pending, pass, fail, retest, passRate, typeStats, todayTests, needsDisposition, needsApproval };
  }, [tests]);

  // Filtered tests based on status
  const filteredTests = useMemo(() => {
    const filtered = activeTab === 'all' ? tests : tests.filter(t => t.status === activeTab);
    return filtered.map((item, index) => ({ ...item, _rowNumber: index + 1 }));
  }, [tests, activeTab]);

  // Chart data
  const statusChartData = useMemo(() => {
    return [
      { status: t('tests.status.pass'), count: stats.pass, color: STATUS_CONFIG.pass.color },
      { status: t('tests.status.fail'), count: stats.fail, color: STATUS_CONFIG.fail.color },
      { status: t('tests.status.pending'), count: stats.pending, color: STATUS_CONFIG.pending.color },
      { status: t('tests.status.retest'), count: stats.retest, color: STATUS_CONFIG.retest.color },
    ].filter(d => d.count > 0);
  }, [stats, t]);

  const typeChartData = useMemo(() => {
    return [
      { type: t('tests.type.incoming'), count: stats.typeStats.incoming?.count || 0 },
      { type: t('tests.type.in_process'), count: stats.typeStats.in_process?.count || 0 },
      { type: t('tests.type.final'), count: stats.typeStats.final?.count || 0 },
    ];
  }, [stats, t]);

  // Status tabs (scroll-snap responsive)
  const statusTabs: Array<{ key: TabKey; label: string; count: number }> = useMemo(() => [
    { key: 'all', label: t('tests.tabs.all'), count: stats.total },
    { key: 'pending', label: t('tests.tabs.pending'), count: stats.pending },
    { key: 'pass', label: t('tests.tabs.passed'), count: stats.pass },
    { key: 'fail', label: t('tests.tabs.failed'), count: stats.fail },
    { key: 'retest', label: t('tests.tabs.retest'), count: stats.retest },
  ], [t, stats]);

  const handleClearFilters = () => {
    setActiveTab('all');
  };

  // Export handler
  const handleExporting = useCallback((e: ExportingEvent) => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Quality Tests');

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Quality_Tests_${toLocalDateStr(new Date())}.xlsx`
        );
      });
    });
    e.cancel = true;
  }, []);

  // Cell renderers
  const renderLotCell = useCallback((data: { data: QualityTest }) => (
    <div className="min-w-0">
      <p className="font-mono font-semibold text-blue-600">{data.data.lotNumber || '-'}</p>
      {data.data.itemName && (
        <p className="text-xs text-gray-700 truncate">{data.data.itemName}</p>
      )}
      {data.data.sampleNumber && (
        <p className="text-xs text-gray-500">{t('tests.sample', { number: data.data.sampleNumber })}</p>
      )}
    </div>
  ), [t]);

  const renderTestCell = useCallback((data: { data: QualityTest }) => (
    <div className="min-w-0">
      <p className="font-medium text-gray-900 truncate">{data.data.testName || '-'}</p>
      {data.data.testMethod && (
        <p className="text-xs text-gray-500 truncate">{data.data.testMethod}</p>
      )}
    </div>
  ), []);

  const renderTypeCell = useCallback((data: { data: QualityTest }) => {
    const config = TYPE_CONFIG[data.data.testType];
    if (!config) return <span className="text-gray-400">{data.data.testType}</span>;
    const IconComponent = config.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${config.gradient} text-white`}>
        <IconComponent className="h-3 w-3" />
        {t(`tests.type.${data.data.testType}`)}
      </span>
    );
  }, [t]);

  const renderSpecCell = useCallback((data: { data: QualityTest }) => {
    const test = data.data;
    if (test.specification) return <span className="text-sm">{test.specification}</span>;
    if (test.minValue !== null || test.maxValue !== null) {
      return (
        <span className="text-sm font-mono">
          {test.minValue !== null && test.minValue}
          {test.minValue !== null && test.maxValue !== null && ' - '}
          {test.maxValue !== null && test.maxValue}
        </span>
      );
    }
    return <span className="text-gray-400">-</span>;
  }, []);

  const renderResultCell = useCallback((data: { data: QualityTest }) => {
    const test = data.data;
    if (test.numericResult !== null) return <span className="font-mono font-medium">{test.numericResult}</span>;
    if (test.result) return <span className="font-medium">{test.result}</span>;
    return <span className="text-gray-400">-</span>;
  }, []);

  const renderStatusCell = useCallback((data: { data: QualityTest }) => {
    const config = STATUS_CONFIG[data.data.status];
    if (!config) return <span className="text-gray-400">{data.data.status}</span>;
    const IconComponent = config.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bgClass}`}>
        <IconComponent className="h-3 w-3" />
        {t(`tests.status.${data.data.status}`)}
      </span>
    );
  }, [t]);

  // Disposition status cell renderer (FR-067 to FR-070)
  const renderDispositionCell = useCallback((data: { data: QualityTest }) => {
    const test = data.data;
    // Only show disposition status for failed/retest tests
    if (test.status !== 'fail' && test.status !== 'retest') {
      return <span className="text-gray-400">-</span>;
    }

    let configKey: keyof typeof DISPOSITION_CONFIG;
    if (test.dispositionApprovedBy) {
      configKey = 'approved';
    } else if (test.disposition) {
      configKey = 'pending_approval';
    } else {
      configKey = 'pending_disposition';
    }

    const config = DISPOSITION_CONFIG[configKey];
    const IconComponent = config.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${config.bgClass}`}>
        <IconComponent className="h-3 w-3" />
        {t(`tests.disposition.${configKey}`)}
      </span>
    );
  }, [t]);

  const renderActionsCell = useCallback((data: { data: QualityTest }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        router.push(`/quality/tests/${data.data.id}`);
      }}
      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
      title={t('tests.actions.viewDetails')}
    >
      <Eye className="h-4 w-4" />
    </button>
  ), [router, t]);

  const handleView = useCallback((test: QualityTest) => {
    router.push(`/quality/tests/${test.id}`);
  }, [router]);

  const showEmptyState = !isLoading && tests.length === 0;
  const showNoResultsState = !isLoading && tests.length > 0 && filteredTests.length === 0;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title={t('inspections.title')}
        subtitle={t('inspections.description')}
        icon={FlaskConical}
        iconBgColor="bg-pink-100"
        iconColor="text-pink-600"
        breadcrumbs={[
          { label: t('tests.breadcrumbs.quality'), href: '/quality' },
          { label: t('tests.breadcrumbs.tests') },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              text={t('tests.actions.refresh')}
              type="default"
              stylingMode="outlined"
              onClick={() => refetch()}
              className="hidden sm:inline-flex"
            />
            <DxButton
              icon="doc"
              text={t('tests.actions.specifications')}
              type="default"
              stylingMode="outlined"
              onClick={() => router.push('/quality/specs')}
              className="hidden md:inline-flex"
            />
            <DxButton
              icon="plus"
              text={t('tests.actions.newTest')}
              type="success"
              onClick={() => router.push('/quality/tests/new')}
            />
          </div>
        }
      />

      {/* KPI Stat Cards - 4 primary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('tests.stats.totalTests')}
          value={stats.total}
          icon={FileText}
          iconColor="text-indigo-500"
          accentColor="border-indigo-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('tests.stats.pending')}
          value={stats.pending}
          icon={Clock}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('tests.stats.passed')}
          value={stats.pass}
          icon={CheckCircle}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('tests.stats.failed')}
          value={stats.fail}
          icon={XCircle}
          iconColor="text-red-500"
          accentColor="border-red-500"
          isLoading={isLoading}
        />
      </div>

      {/* Secondary Stats Row - visible on large screens only */}
      <div className="hidden xl:grid grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('tests.stats.retest')}
          value={stats.retest}
          icon={AlertTriangle}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('tests.stats.passRate')}
          value={`${stats.passRate.toFixed(1)}%`}
          icon={Percent}
          iconColor="text-indigo-500"
          accentColor="border-indigo-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('tests.stats.today')}
          value={stats.todayTests}
          icon={Calendar}
          iconColor="text-purple-500"
          accentColor="border-purple-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('tests.stats.incomingQC')}
          value={stats.typeStats.incoming?.count || 0}
          icon={Package}
          iconColor="text-cyan-500"
          accentColor="border-cyan-500"
          isLoading={isLoading}
        />
      </div>

      {/* Charts Section - hidden on small screens to prioritize the list */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Status Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              {t('tests.charts.byStatus')}
            </h3>
          </div>
          {statusChartData.length > 0 ? (
            <PieChart
              id="status-pie"
              dataSource={statusChartData}
              type="doughnut"
              innerRadius={0.65}
              palette={statusChartData.map(d => d.color)}
              size={{ height: 260 }}
            >
              <Series argumentField="status" valueField="count">
                <Label visible={false} />
                <Connector visible={false} />
              </Series>
              <Legend
                visible={true}
                orientation="horizontal"
                horizontalAlignment="center"
                verticalAlignment="bottom"
                font={{ size: 11 }}
              />
              <Tooltip
                enabled={true}
                customizeTooltip={(arg: { argumentText?: string; valueText?: string; percentText?: string }) => ({
                  text: `${arg.argumentText}: ${arg.valueText} (${arg.percentText})`,
                })}
              />
            </PieChart>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('tests.charts.noData')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Tests by Type */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              {t('tests.charts.byCategory')}
            </h3>
          </div>
          {typeChartData.some(d => d.count > 0) ? (
            <Chart id="type-chart" dataSource={typeChartData} size={{ height: 260 }}>
              <CommonSeriesSettings argumentField="type" type="bar" color="#6366f1" />
              <ChartSeries valueField="count" name="Tests" color="#6366f1" />
              <ArgumentAxis>
                <ChartLabel overlappingBehavior="rotate" rotationAngle={-45} />
              </ArgumentAxis>
              <ValueAxis />
              <ChartLegend visible={false} />
              <ChartTooltip
                enabled={true}
                customizeTooltip={(arg: { argumentText?: string; valueText?: string }) => ({
                  text: `${arg.argumentText}: ${arg.valueText} tests`,
                })}
              />
            </Chart>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('tests.charts.noData')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Pass Rate by Type */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              {t('tests.charts.passRateByType')}
            </h3>
          </div>
          <div className="space-y-3">
            {/* Overall */}
            <div className="p-3 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">{t('tests.charts.overall')}</span>
                </div>
                <span className="text-lg font-bold text-emerald-600">
                  {stats.passRate.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* By Type */}
            {(Object.keys(TYPE_CONFIG) as Array<keyof typeof TYPE_CONFIG>).map(type => {
              const config = TYPE_CONFIG[type];
              const typeStats = stats.typeStats[type];
              const IconComponent = config.icon;
              return (
                <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 bg-gradient-to-r ${config.gradient} rounded text-white`}>
                      <IconComponent className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{t(`tests.type.${type}`)}</span>
                  </div>
                  <span className={`text-sm font-bold ${
                    (typeStats?.passRate || 0) >= 90 ? 'text-emerald-600' :
                    (typeStats?.passRate || 0) >= 70 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {typeStats?.passRate ? `${typeStats.passRate.toFixed(0)}%` : 'N/A'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Test Type Cards - hidden on small screens */}
      <div className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.keys(TYPE_CONFIG) as Array<keyof typeof TYPE_CONFIG>).map(type => {
          const config = TYPE_CONFIG[type];
          const typeStats = stats.typeStats[type];
          const IconComponent = config.icon;
          return (
            <div key={type} className={`bg-gradient-to-br ${config.gradient} rounded-xl p-5 text-white shadow-lg`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 rounded-lg backdrop-blur-sm">
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{t(`tests.type.${type}`)}</p>
                    <p className="text-sm text-white/70">{t(`tests.typeDescription.${type}`)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">{typeStats?.count || 0}</p>
                  <p className="text-sm text-white/70">
                    {(typeStats?.passRate || 0) > 0 ? t('tests.passText', { rate: typeStats.passRate.toFixed(0) }) : t('tests.charts.noData')}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content - Tabs + Content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tabs Header - scroll-snap responsive */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
          <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-thin snap-x w-full">
            {statusTabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 snap-start min-h-[36px] ${
                    isActive
                      ? 'bg-pink-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold ${
                    isActive ? 'bg-white/25 text-inherit' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Result count row */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
            <FlaskConical className="w-4 h-4 text-gray-400" />
            <span>{t('tests.testsCount', { count: filteredTests.length })}</span>
          </div>
        </div>

        {/* Content: Loading / Empty / No Results / Mobile Cards / Desktop Grid */}
        {isLoading ? (
          isMobile ? (
            <QualityTestCardSkeletonList count={4} />
          ) : (
            <DataGridLoadingSkeleton />
          )
        ) : showEmptyState ? (
          <EmptyState onCreate={() => router.push('/quality/tests/new')} t={t} />
        ) : showNoResultsState ? (
          <NoResultsState onClear={handleClearFilters} t={t} />
        ) : isMobile ? (
          <QualityTestCardList
            tests={filteredTests}
            onView={handleView}
            t={t}
          />
        ) : (
          <DataGrid
            dataSource={filteredTests}
            showBorders={false}
            showRowLines={true}
            showColumnLines={false}
            rowAlternationEnabled={true}
            hoverStateEnabled={true}
            height={500}
            columnAutoWidth={true}
            wordWrapEnabled={false}
            onExporting={handleExporting}
            onRowClick={(e) => {
              if (e.data && e.rowType === 'data') {
                router.push(`/quality/tests/${e.data.id}`);
              }
            }}
          >
            <Scrolling mode="virtual" />
            <Paging defaultPageSize={15} />
            <Pager
              showPageSizeSelector={true}
              allowedPageSizes={[10, 15, 25, 50]}
              showInfo={true}
              showNavigationButtons={true}
            />
            <SearchPanel visible={true} placeholder={t('tests.grid.searchPlaceholder')} width={250} />
            <Export enabled={true} formats={['xlsx']} />

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
              dataField="lotNumber"
              caption={t('tests.grid.lotItem')}
              minWidth={220}
              cellRender={renderLotCell}
            />
            <Column
              caption={t('tests.grid.testName')}
              minWidth={200}
              cellRender={renderTestCell}
              calculateCellValue={(data: QualityTest) => data.testName}
            />
            <Column
              dataField="testType"
              caption={t('tests.grid.type')}
              width={140}
              cellRender={renderTypeCell}
            />
            <Column
              caption={t('tests.grid.specification')}
              minWidth={150}
              cellRender={renderSpecCell}
            />
            <Column
              caption={t('tests.grid.result')}
              width={100}
              cellRender={renderResultCell}
            />
            <Column
              dataField="testDate"
              caption={t('tests.grid.testDate')}
              dataType="date"
              format="dd MMM yyyy"
              width={120}
            />
            <Column
              dataField="status"
              caption={t('tests.grid.status')}
              width={120}
              cellRender={renderStatusCell}
            />
            <Column
              caption={t('tests.grid.disposition')}
              width={130}
              cellRender={renderDispositionCell}
              allowFiltering={false}
            />
            <Column
              caption=""
              width={60}
              cellRender={renderActionsCell}
              allowFiltering={false}
              allowSorting={false}
            />
          </DataGrid>
        )}
      </div>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

/**
 * Mobile Card List — replaces DataGrid on mobile viewports.
 * Each card prioritizes: Lot/Item → Test Name → Type → Status.
 * Tap card to view; footer "View Details" action with min-h-[44px].
 */
function QualityTestCardList({
  tests,
  onView,
  t,
}: {
  tests: QualityTest[];
  onView: (test: QualityTest) => void;
  t: TranslateFn;
}) {
  const statusBadge = (status: QualityTest['status']) => {
    const config = STATUS_CONFIG[status];
    if (!config) return null;
    const IconComponent = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${config.bgClass}`}>
        <IconComponent className="h-3 w-3" />
        {t(`tests.status.${status}`)}
      </span>
    );
  };

  const typeBadge = (testType: QualityTest['testType']) => {
    const config = TYPE_CONFIG[testType];
    if (!config) return null;
    const IconComponent = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 text-xs bg-gradient-to-r ${config.gradient} text-white px-2 py-0.5 rounded`}>
        <IconComponent className="h-3 w-3" />
        {t(`tests.type.${testType}`)}
      </span>
    );
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '-';
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return '-';
      return date.toISOString().slice(0, 10);
    } catch {
      return '-';
    }
  };

  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {tests.map((test) => (
        <div
          key={test.id}
          className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all"
        >
          {/* Card body: tap to view */}
          <button
            type="button"
            onClick={() => onView(test)}
            className="w-full text-left p-4 flex items-start gap-3"
          >
            <div className="h-11 w-11 rounded-xl bg-pink-100 flex items-center justify-center flex-shrink-0">
              <FlaskConical className="h-5 w-5 text-pink-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0">
                  <p className="font-mono font-semibold text-blue-700 text-base truncate">{test.lotNumber || '-'}</p>
                  {test.sampleNumber && (
                    <p className="text-xs text-gray-500 font-mono truncate mt-0.5">
                      {t('tests.sample', { number: test.sampleNumber })}
                    </p>
                  )}
                </div>
                {statusBadge(test.status)}
              </div>

              {/* Item info */}
              {(test.itemCode || test.itemName) && (
                <p className="text-xs text-gray-600 flex items-center gap-1 mt-1.5">
                  <Package className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                  {test.itemCode && <span className="font-mono text-gray-500">{test.itemCode}</span>}
                  {test.itemName && <span className="truncate">- {test.itemName}</span>}
                </p>
              )}

              {/* Test name / method */}
              {test.testName && (
                <p className="text-sm text-gray-700 truncate mt-1.5" title={test.testName}>
                  {test.testName}
                  {test.testMethod && (
                    <span className="text-xs text-gray-500 ml-1">({test.testMethod})</span>
                  )}
                </p>
              )}

              {/* Tags row: type, result, date */}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {typeBadge(test.testType)}
                {(test.numericResult !== null || test.result) && (
                  <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono">
                    {test.numericResult !== null ? test.numericResult : test.result}
                  </span>
                )}
                {test.testDate && (
                  <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                    <Clock className="h-3 w-3" />
                    {formatDate(test.testDate)}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0 mt-2" />
          </button>

          {/* Card footer: view action (touch-friendly) */}
          <div className="flex items-center border-t border-gray-100">
            <button
              type="button"
              onClick={() => onView(test)}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-pink-50 hover:text-pink-700 active:bg-pink-100 transition-colors min-h-[44px]"
            >
              <Eye className="h-4 w-4" />
              <span>{t('tests.actions.viewDetails')}</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Loading skeleton for mobile card list */
function QualityTestCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 bg-gray-200 rounded" />
              <div className="h-3 w-1/3 bg-gray-200 rounded" />
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

/** Empty State — shown when there are zero tests at all */
function EmptyState({ onCreate, t }: { onCreate: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-pink-100 flex items-center justify-center mb-5">
        <FlaskConical className="h-10 w-10 text-pink-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {t('tests.charts.noData')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {t('inspections.description')}
      </p>
      <DxButton
        text={t('tests.actions.newTest')}
        icon="plus"
        type="success"
        onClick={onCreate}
      />
    </div>
  );
}

/** No Results State — shown when filter/search yields zero results but tests exist */
function NoResultsState({ onClear, t }: { onClear: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {t('tests.charts.noData')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {t('tests.grid.searchPlaceholder')}
      </p>
      <DxButton
        text={t('tests.tabs.all')}
        icon="clear"
        stylingMode="outlined"
        onClick={onClear}
      />
    </div>
  );
}

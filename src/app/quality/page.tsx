'use client';

// Quality Control Dashboard - Redesigned
// Feature: Quality Management
// Redesigned with KPIs, DataGrid, Cards, and Analytics views

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import DataGrid, {
  Column,
  SearchPanel,
  HeaderFilter,
  FilterRow,
  Paging,
  Pager,
  Scrolling,
  Toolbar,
  Item,
  Grouping,
  GroupPanel,
  ColumnChooser,
  StateStoring,
  Export,
} from 'devextreme-react/data-grid';
import PieChart, {
  Series,
  Label,
  Connector,
  Legend,
  Tooltip as PieTooltip,
  Size,
} from 'devextreme-react/pie-chart';
import SelectBox from 'devextreme-react/select-box';
import TextBox from 'devextreme-react/text-box';
import { useQuery } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import {
  ClipboardCheck,
  FlaskConical,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  List,
  Grid3X3,
  PieChart as PieChartIcon,
  Filter,
  FileText,
  Activity,
  ArrowRight,
  Beaker,
  TrendingUp,
  Package,
} from 'lucide-react';

// Types
interface QualityTest {
  id: number;
  lotId: number;
  lotNumber: string;
  specId: number;
  testName: string;
  testMethod: string;
  specification: string;
  minValue: number | null;
  maxValue: number | null;
  testType: string;
  sampleNumber: string | null;
  testDate: string | null;
  result: string | null;
  numericResult: number | null;
  status: string;
  createdAt: string;
}

interface QualitySpec {
  id: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  testName: string;
  testMethod: string;
  specification: string;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
  isCritical: boolean;
  isActive: boolean;
  createdAt: string;
}

interface Deviation {
  id: number;
  deviationNumber: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  reportedDate: string;
  reportedBy: string | null;
  closedDate: string | null;
}

type ViewMode = 'grid' | 'cards' | 'analytics';

// Test status configuration (labels removed - use t() instead)
const TEST_STATUS_CONFIG: Record<string, { color: string; bgColor: string }> = {
  pending: { color: 'text-yellow-700', bgColor: 'bg-yellow-50' },
  in_progress: { color: 'text-blue-700', bgColor: 'bg-blue-50' },
  passed: { color: 'text-green-700', bgColor: 'bg-green-50' },
  failed: { color: 'text-red-700', bgColor: 'bg-red-50' },
};

// Test type configuration (labels removed - use t() instead)
const TEST_TYPE_KEYS = ['incoming', 'in_process', 'finished', 'stability'] as const;

// Fetch functions
async function fetchTests(): Promise<QualityTest[]> {
  const response = await fetch('/api/quality/tests?limit=1000');
  if (!response.ok) throw new Error('Failed to fetch tests');
  const result = await response.json();
  return result.data?.items || [];
}

async function fetchSpecs(): Promise<QualitySpec[]> {
  const response = await fetch('/api/quality/specs?limit=1000');
  if (!response.ok) throw new Error('Failed to fetch specs');
  const result = await response.json();
  return result.data?.items || [];
}

async function fetchDeviations(): Promise<Deviation[]> {
  const response = await fetch('/api/quality/deviations?limit=1000');
  if (!response.ok) throw new Error('Failed to fetch deviations');
  const result = await response.json();
  return result.data?.items || [];
}

export default function QualityDashboardPage() {
  const router = useRouter();
  const t = useTranslations('quality');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [testTypeFilter, setTestTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Fetch data
  const { data: testsData = [], isLoading: testsLoading, refetch: refetchTests } = useQuery({
    queryKey: ['quality', 'tests'],
    queryFn: fetchTests,
    staleTime: 30000,
  });

  const { data: specsData = [], isLoading: specsLoading } = useQuery({
    queryKey: ['quality', 'specs'],
    queryFn: fetchSpecs,
    staleTime: 60000,
  });

  const { data: deviationsData = [], isLoading: deviationsLoading } = useQuery({
    queryKey: ['quality', 'deviations'],
    queryFn: fetchDeviations,
    staleTime: 60000,
  });

  const isLoading = testsLoading || specsLoading || deviationsLoading;

  // Ensure data is always arrays
  const tests = useMemo(
    () => (Array.isArray(testsData) ? testsData : []),
    [testsData]
  );
  const specs = useMemo(
    () => (Array.isArray(specsData) ? specsData : []),
    [specsData]
  );
  const deviations = useMemo(
    () => (Array.isArray(deviationsData) ? deviationsData : []),
    [deviationsData]
  );

  // Calculate analytics
  const analytics = useMemo(() => {
    const totalTests = tests.length;
    const pendingTests = tests.filter((t) => t.status === 'pending').length;
    const inProgressTests = tests.filter((t) => t.status === 'in_progress').length;
    const passedTests = tests.filter((t) => t.status === 'passed').length;
    const failedTests = tests.filter((t) => t.status === 'failed').length;

    // Status distribution
    const statusDistribution = [
      { name: t('dashboard.testStatus.pending'), count: pendingTests, color: '#f59e0b' },
      { name: t('dashboard.testStatus.in_progress'), count: inProgressTests, color: '#3b82f6' },
      { name: t('dashboard.testStatus.passed'), count: passedTests, color: '#10b981' },
      { name: t('dashboard.testStatus.failed'), count: failedTests, color: '#ef4444' },
    ].filter((s) => s.count > 0);

    // Type distribution
    const typeDistribution = TEST_TYPE_KEYS.map((type) => ({
      name: t(`dashboard.testType.${type}`),
      type,
      count: tests.filter((t) => t.testType === type).length,
    })).filter((item) => item.count > 0);

    // Specs stats
    const totalSpecs = specs.length;
    const activeSpecs = specs.filter((s) => s.isActive).length;
    const criticalSpecs = specs.filter((s) => s.isCritical).length;

    // Deviations stats
    const openDeviations = deviations.filter((d) => d.status !== 'closed').length;
    const criticalDeviations = deviations.filter((d) => d.severity === 'critical' && d.status !== 'closed').length;

    // Pass rate
    const completedTests = passedTests + failedTests;
    const passRate = completedTests > 0 ? Math.round((passedTests / completedTests) * 100) : 0;

    return {
      totalTests,
      pendingTests,
      inProgressTests,
      passedTests,
      failedTests,
      statusDistribution,
      typeDistribution,
      totalSpecs,
      activeSpecs,
      criticalSpecs,
      openDeviations,
      criticalDeviations,
      passRate,
    };
  }, [tests, specs, deviations, t]);

  // Type filter options (inside component because t() is a hook)
  const typeFilterOptions = useMemo(() => [
    { value: null, text: t('dashboard.filter.allTypes') },
    ...TEST_TYPE_KEYS.map((type) => ({
      value: type,
      text: t(`dashboard.testType.${type}`),
    })),
  ], [t]);

  // Status filter options (inside component because t() is a hook)
  const statusFilterOptions = useMemo(() => [
    { value: null, text: t('dashboard.filter.allStatuses') },
    ...Object.keys(TEST_STATUS_CONFIG).map((status) => ({
      value: status,
      text: t(`dashboard.testStatus.${status}`),
    })),
  ], [t]);

  // Filtered tests
  const filteredTests = useMemo(() => {
    return tests.filter((test) => {
      const matchesSearch =
        !searchText ||
        test.lotNumber?.toLowerCase().includes(searchText.toLowerCase()) ||
        test.testName?.toLowerCase().includes(searchText.toLowerCase()) ||
        test.sampleNumber?.toLowerCase().includes(searchText.toLowerCase());

      const matchesType = !testTypeFilter || test.testType === testTypeFilter;
      const matchesStatus = !statusFilter || test.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [tests, searchText, testTypeFilter, statusFilter]);

  // Handlers
  const handleRefresh = useCallback(() => {
    refetchTests();
  }, [refetchTests]);

  const handleRowClick = useCallback(
    (e: { data: QualityTest }) => {
      router.push(`/quality/tests/${e.data.id}`);
    },
    [router]
  );

  const clearFilters = useCallback(() => {
    setSearchText('');
    setTestTypeFilter(null);
    setStatusFilter(null);
  }, []);

  // Get status badge variant
  const getStatusVariant = (status: string): 'success' | 'warning' | 'secondary' | 'destructive' => {
    switch (status) {
      case 'passed':
        return 'success';
      case 'failed':
        return 'destructive';
      case 'in_progress':
        return 'secondary';
      default:
        return 'warning';
    }
  };

  // Module cards for quick access
  const moduleCards = useMemo(() => [
    {
      title: t('dashboard.moduleCards.qualityTests.title'),
      description: t('dashboard.moduleCards.qualityTests.description'),
      icon: FlaskConical,
      href: '/quality/tests',
      stats: [
        { label: t('dashboard.moduleCards.qualityTests.statsTotal'), value: analytics.totalTests },
        { label: t('dashboard.moduleCards.qualityTests.statsPending'), value: analytics.pendingTests },
        { label: t('dashboard.moduleCards.qualityTests.statsPassRate'), value: `${analytics.passRate}%` },
      ],
      color: 'indigo',
      gradient: 'from-indigo-500 to-indigo-600',
    },
    {
      title: t('dashboard.moduleCards.qualitySpecs.title'),
      description: t('dashboard.moduleCards.qualitySpecs.description'),
      icon: FileText,
      href: '/quality/specs',
      stats: [
        { label: t('dashboard.moduleCards.qualitySpecs.statsTotal'), value: analytics.totalSpecs },
        { label: t('dashboard.moduleCards.qualitySpecs.statsActive'), value: analytics.activeSpecs },
        { label: t('dashboard.moduleCards.qualitySpecs.statsCritical'), value: analytics.criticalSpecs },
      ],
      color: 'emerald',
      gradient: 'from-emerald-500 to-emerald-600',
    },
    {
      title: t('dashboard.moduleCards.deviationsCard.title'),
      description: t('dashboard.moduleCards.deviationsCard.description'),
      icon: AlertTriangle,
      href: '/quality/deviations',
      stats: [
        { label: t('dashboard.moduleCards.deviationsCard.statsOpen'), value: analytics.openDeviations },
        { label: t('dashboard.moduleCards.deviationsCard.statsCritical'), value: analytics.criticalDeviations },
      ],
      color: 'amber',
      gradient: 'from-amber-500 to-amber-600',
    },
  ], [t, analytics]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title={t('page.title')}
        subtitle={t('page.description')}
        actions={
          <div className="flex items-center gap-2">
            <DxButton
              icon="refresh"
              onClick={handleRefresh}
              hint={t('dashboard.hints.refresh')}
            />
            <DxButton
              icon="filter"
              onClick={() => setShowFilters(!showFilters)}
              hint={t('dashboard.hints.filter')}
              type={showFilters ? 'default' : 'normal'}
            />
          </div>
        }
      />

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
        <StatCard
          label={t('dashboard.stats.totalTests')}
          value={analytics.totalTests}
          icon={FlaskConical}
          iconColor="text-indigo-600"
          accentColor="border-indigo-500"
          href="/quality/tests"
          isLoading={isLoading}
        />
        <StatCard
          label={t('dashboard.stats.pending')}
          value={analytics.pendingTests}
          icon={Clock}
          iconColor="text-yellow-600"
          accentColor="border-yellow-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('dashboard.stats.passed')}
          value={analytics.passedTests}
          icon={CheckCircle}
          iconColor="text-green-600"
          accentColor="border-green-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('dashboard.stats.failed')}
          value={analytics.failedTests}
          icon={XCircle}
          iconColor="text-red-600"
          accentColor="border-red-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('dashboard.stats.totalSpecs')}
          value={analytics.totalSpecs}
          icon={FileText}
          iconColor="text-emerald-600"
          accentColor="border-emerald-500"
          href="/quality/specs"
          isLoading={isLoading}
        />
        <StatCard
          label={t('dashboard.stats.openDeviations')}
          value={analytics.openDeviations}
          icon={AlertTriangle}
          iconColor="text-amber-600"
          accentColor="border-amber-500"
          href="/quality/deviations"
          isLoading={isLoading}
        />
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              {t('dashboard.filter.title')}
            </h3>
            <DxButton text={t('dashboard.filter.clear')} type="normal" onClick={clearFilters} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">{t('dashboard.filter.searchLabel')}</label>
              <TextBox
                value={searchText}
                onValueChanged={(e) => setSearchText(e.value || '')}
                placeholder={t('dashboard.filter.searchPlaceholder')}
                showClearButton
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">{t('dashboard.filter.testTypeLabel')}</label>
              <SelectBox
                dataSource={typeFilterOptions}
                value={testTypeFilter}
                onValueChanged={(e) => setTestTypeFilter(e.value)}
                displayExpr="text"
                valueExpr="value"
                placeholder={t('dashboard.filter.testTypePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">{t('dashboard.filter.statusLabel')}</label>
              <SelectBox
                dataSource={statusFilterOptions}
                value={statusFilter}
                onValueChanged={(e) => setStatusFilter(e.value)}
                displayExpr="text"
                valueExpr="value"
                placeholder={t('dashboard.filter.statusPlaceholder')}
              />
            </div>
          </div>
        </div>
      )}

      {/* View Mode Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 mr-2">{t('common.view')}:</span>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title={t('common.viewGrid')}
            >
              <List className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 ${viewMode === 'cards' ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title={t('common.viewCards')}
            >
              <Grid3X3 className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('analytics')}
              className={`p-2 ${viewMode === 'analytics' ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title={t('common.viewAnalytics')}
            >
              <PieChartIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        <DxButton
          text={t('dashboard.actions.newTest')}
          icon="add"
          type="default"
          onClick={() => router.push('/quality/tests/new')}
        />
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <DataGrid
            dataSource={filteredTests}
            keyExpr="id"
            showBorders={false}
            showRowLines
            rowAlternationEnabled
            columnAutoWidth
            height={600}
            onRowClick={handleRowClick}
            hoverStateEnabled
          >
            <SearchPanel visible placeholder={t('dashboard.grid.searchPlaceholder')} />
            <HeaderFilter visible />
            <FilterRow visible />
            <Grouping autoExpandAll={false} />
            <GroupPanel visible />
            <ColumnChooser enabled mode="select" />
            <StateStoring enabled type="localStorage" storageKey="qualityTestsGrid" />
            <Export enabled allowExportSelectedData />
            <Scrolling mode="virtual" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo
              showNavigationButtons
            />

            <Toolbar>
              <Item name="groupPanel" />
              <Item name="searchPanel" />
              <Item name="columnChooserButton" />
              <Item name="exportButton" />
            </Toolbar>

            <Column dataField="lotNumber" caption={t('dashboard.grid.lotNumber')} width={130} />
            <Column
              dataField="testName"
              caption={t('dashboard.grid.testName')}
              minWidth={200}
            />
            <Column
              dataField="testType"
              caption={t('dashboard.grid.type')}
              width={130}
              cellRender={(cellInfo) => {
                const typeKey = cellInfo.data.testType;
                const label = TEST_TYPE_KEYS.includes(typeKey as typeof TEST_TYPE_KEYS[number])
                  ? t(`dashboard.testType.${typeKey}`)
                  : typeKey;
                return <Badge variant="outline">{label}</Badge>;
              }}
            />
            <Column dataField="testMethod" caption={t('dashboard.grid.testMethod')} width={150} />
            <Column dataField="specification" caption={t('dashboard.grid.specification')} width={150} />
            <Column
              dataField="result"
              caption={t('dashboard.grid.result')}
              width={120}
              cellRender={(cellInfo) => (
                <span className="font-medium">
                  {cellInfo.data.result || cellInfo.data.numericResult || '-'}
                </span>
              )}
            />
            <Column
              dataField="status"
              caption={t('dashboard.grid.status')}
              width={120}
              cellRender={(cellInfo) => {
                const statusKey = cellInfo.data.status;
                const label = TEST_STATUS_CONFIG[statusKey]
                  ? t(`dashboard.testStatus.${statusKey}`)
                  : statusKey;
                return (
                  <Badge variant={getStatusVariant(statusKey)}>
                    {label}
                  </Badge>
                );
              }}
            />
            <Column
              dataField="testDate"
              caption={t('dashboard.grid.testDate')}
              width={130}
              dataType="date"
              format="dd/MM/yyyy"
            />
          </DataGrid>
        </div>
      )}

      {/* Cards View - Module Cards */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {moduleCards.map((module) => (
            <div
              key={module.href}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => router.push(module.href)}
            >
              {/* Header with gradient */}
              <div className={`bg-gradient-to-r ${module.gradient} p-4 text-white`}>
                <div className="flex items-center justify-between">
                  <module.icon className="h-8 w-8" />
                  <ArrowRight className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="text-lg font-semibold mt-3">{module.title}</h3>
              </div>
              {/* Content */}
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-4">{module.description}</p>
                <div className="grid grid-cols-3 gap-2">
                  {module.stats.map((stat) => (
                    <div key={stat.label} className="text-center">
                      <div className="text-xl font-bold text-gray-800">{stat.value}</div>
                      <div className="text-xs text-gray-500">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Quick Actions Card */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-gray-600" />
              {t('dashboard.quickActions.title')}
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/quality/tests/new')}
                className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-left"
              >
                <span className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-medium">{t('dashboard.quickActions.newTest')}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </button>
              <button
                onClick={() => router.push('/quality/specs/new')}
                className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors text-left"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium">{t('dashboard.quickActions.newSpec')}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </button>
              <button
                onClick={() => router.push('/quality/deviations/new')}
                className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-colors text-left"
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium">{t('dashboard.quickActions.reportDeviation')}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Pass Rate Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              {t('dashboard.passRate.title')}
            </h3>
            <div className="flex items-center justify-center">
              <div className="relative">
                <svg className="w-32 h-32">
                  <circle
                    className="text-gray-200"
                    strokeWidth="10"
                    stroke="currentColor"
                    fill="transparent"
                    r="50"
                    cx="64"
                    cy="64"
                  />
                  <circle
                    className="text-green-500"
                    strokeWidth="10"
                    strokeDasharray={`${analytics.passRate * 3.14} 314`}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="50"
                    cx="64"
                    cy="64"
                    transform="rotate(-90 64 64)"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-gray-800">{analytics.passRate}%</span>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-green-600">{analytics.passedTests}</div>
                <div className="text-xs text-gray-500">{t('common.passed')}</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-red-600">{analytics.failedTests}</div>
                <div className="text-xs text-gray-500">{t('common.failed')}</div>
              </div>
            </div>
          </div>

          {/* Test Type Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              {t('dashboard.testTypeSummary.title')}
            </h3>
            <div className="space-y-3">
              {TEST_TYPE_KEYS.map((type) => {
                const count = tests.filter((t) => t.testType === type).length;
                const percentage = analytics.totalTests > 0 ? Math.round((count / analytics.totalTests) * 100) : 0;
                return (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{t(`dashboard.testType.${type}`)}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-500 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Analytics View */}
      {viewMode === 'analytics' && (
        <div className="space-y-6">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Distribution */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-indigo-600" />
                {t('dashboard.analytics.statusDistribution')}
              </h3>
              {analytics.statusDistribution.length > 0 ? (
                <PieChart
                  dataSource={analytics.statusDistribution}
                  type="doughnut"
                  palette={['#f59e0b', '#3b82f6', '#10b981', '#ef4444']}
                >
                  <Size height={300} />
                  <Series argumentField="name" valueField="count">
                    <Label visible format="fixedPoint">
                      <Connector visible width={1} />
                    </Label>
                  </Series>
                  <Legend
                    visible
                    verticalAlignment="bottom"
                    horizontalAlignment="center"
                    itemTextPosition="right"
                    orientation="horizontal"
                  />
                  <PieTooltip
                    enabled
                    format="fixedPoint"
                    customizeTooltip={(pointInfo: { argumentText?: string; valueText?: string }) => ({
                      text: `${pointInfo.argumentText}: ${pointInfo.valueText} ${t('common.items')}`,
                    })}
                  />
                </PieChart>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                  {t('dashboard.analytics.noTestData')}
                </div>
              )}
            </div>

            {/* Type Distribution */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Beaker className="h-5 w-5 text-emerald-600" />
                {t('dashboard.analytics.typeDistribution')}
              </h3>
              {analytics.typeDistribution.length > 0 ? (
                <PieChart
                  dataSource={analytics.typeDistribution}
                  type="doughnut"
                  palette="Material"
                >
                  <Size height={300} />
                  <Series argumentField="name" valueField="count">
                    <Label visible format="fixedPoint">
                      <Connector visible width={1} />
                    </Label>
                  </Series>
                  <Legend
                    visible
                    verticalAlignment="bottom"
                    horizontalAlignment="center"
                    itemTextPosition="right"
                    orientation="horizontal"
                  />
                  <PieTooltip
                    enabled
                    format="fixedPoint"
                    customizeTooltip={(pointInfo: { argumentText?: string; valueText?: string }) => ({
                      text: `${pointInfo.argumentText}: ${pointInfo.valueText} ${t('common.items')}`,
                    })}
                  />
                </PieChart>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                  {t('common.noData')}
                </div>
              )}
            </div>
          </div>

          {/* Summary Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Test Status Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-indigo-600" />
                {t('dashboard.analytics.testStatusSummary')}
              </h4>
              <div className="space-y-2">
                {Object.keys(TEST_STATUS_CONFIG).map((status) => {
                  const config = TEST_STATUS_CONFIG[status];
                  const count = tests.filter((t) => t.status === status).length;
                  return (
                    <div key={status} className="flex items-center justify-between py-1">
                      <span className={`text-sm ${config.color}`}>{t(`dashboard.testStatus.${status}`)}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Specs Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-600" />
                {t('dashboard.analytics.specsSummary')}
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-600">{t('dashboard.analytics.specsTotal')}</span>
                  <span className="font-semibold">{analytics.totalSpecs}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-600">{t('dashboard.analytics.specsActive')}</span>
                  <span className="font-semibold text-green-600">{analytics.activeSpecs}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-600">{t('dashboard.analytics.specsCritical')}</span>
                  <span className="font-semibold text-red-600">{analytics.criticalSpecs}</span>
                </div>
              </div>
            </div>

            {/* Deviations Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                {t('dashboard.analytics.deviationsSummary')}
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-600">{t('common.all')}</span>
                  <span className="font-semibold">{deviations.length}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-600">{t('common.open')}</span>
                  <span className="font-semibold text-amber-600">{analytics.openDeviations}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-600">{t('common.critical')}</span>
                  <span className="font-semibold text-red-600">{analytics.criticalDeviations}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-600" />
                {t('dashboard.analytics.quickActionsTitle')}
              </h4>
              <div className="space-y-2">
                <DxButton
                  text={t('dashboard.actions.newTest')}
                  icon="add"
                  type="default"
                  width="100%"
                  onClick={() => router.push('/quality/tests/new')}
                />
                <DxButton
                  text={t('dashboard.analytics.addSpec')}
                  icon="add"
                  type="normal"
                  width="100%"
                  onClick={() => router.push('/quality/specs/new')}
                />
                <DxButton
                  text={t('dashboard.quickActions.reportDeviation')}
                  icon="warning"
                  type="normal"
                  width="100%"
                  onClick={() => router.push('/quality/deviations/new')}
                />
              </div>
            </div>
          </div>

          {/* Type Breakdown */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              {t('dashboard.analytics.typeBreakdown')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {TEST_TYPE_KEYS.map((type) => {
                const typeTests = tests.filter((t) => t.testType === type);
                const passed = typeTests.filter((t) => t.status === 'passed').length;
                const failed = typeTests.filter((t) => t.status === 'failed').length;
                const pending = typeTests.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;
                return (
                  <div key={type} className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-gray-800">{typeTests.length}</div>
                    <div className="text-sm font-medium text-gray-700 mb-2">{t(`dashboard.testType.${type}`)}</div>
                    <div className="mt-3 flex justify-center gap-3 text-xs">
                      <span className="text-green-600">{t('common.passed')} {passed}</span>
                      <span className="text-red-600">{t('common.failed')} {failed}</span>
                      <span className="text-yellow-600">{t('common.pending')} {pending}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

/**
 * Quality Specifications Dashboard Page
 *
 * Professional dashboard for viewing and managing quality specifications.
 * Redesigned with DevExtreme UI components following GMP module patterns.
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  SearchPanel,
  HeaderFilter,
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
import { SelectBox } from 'devextreme-react/select-box';
import { TextBox } from 'devextreme-react/text-box';
import { DxButton } from '@/components/ui/dx-button';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { Workbook } from 'exceljs';
import { saveAs } from 'file-saver';
import { exportDataGrid } from 'devextreme/excel_exporter';
import type { ExportingEvent } from 'devextreme/ui/data_grid';
import {
  FileCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Shield,
  Package,
  Eye,
  LayoutGrid,
  LayoutList,
  BarChart3,
  TrendingUp,
  Beaker,
  ListChecks,
  Filter,
  Plus,
  RefreshCw,
} from 'lucide-react';

// ============================================
// Types
// ============================================

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
  unit: string;
  isCritical: boolean;
  isActive: boolean;
  createdAt: string;
}

type ViewMode = 'grid' | 'cards' | 'analytics';

// ============================================
// Constants
// ============================================

const STATUS_CONFIG = {
  active: {
    color: '#22c55e',
    bgClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: CheckCircle,
  },
  inactive: {
    color: '#64748b',
    bgClass: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: XCircle,
  },
} as const;

const CRITICAL_CONFIG = {
  critical: {
    color: '#ef4444',
    bgClass: 'bg-red-100 text-red-700 border-red-200',
    icon: AlertTriangle,
  },
  normal: {
    color: '#3b82f6',
    bgClass: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Shield,
  },
} as const;

// ============================================
// API Functions
// ============================================

async function fetchSpecs(): Promise<QualitySpec[]> {
  const response = await fetch('/api/quality/specs?limit=1000&isActive=');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch specs');
  }
  return result.data?.items || [];
}

// ============================================
// Component
// ============================================

export default function QualitySpecsPage() {
  const router = useRouter();
  const t = useTranslations('quality');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [criticalFilter, setCriticalFilter] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');

  // Filter options (translated)
  const statusOptions = useMemo(() => [
    { value: '', text: t('specs.filter.allStatuses') },
    { value: 'true', text: t('specs.filter.active') },
    { value: 'false', text: t('specs.filter.inactive') },
  ], [t]);

  const criticalOptions = useMemo(() => [
    { value: '', text: t('specs.filter.allTypes') },
    { value: 'true', text: t('specs.filter.criticalOnly') },
    { value: 'false', text: t('specs.filter.nonCritical') },
  ], [t]);

  // Fetch quality specs
  const { data: specs = [], isLoading, refetch } = useQuery({
    queryKey: ['quality-specs'],
    queryFn: fetchSpecs,
  });

  // Filter specs
  const filteredSpecs = useMemo(() => {
    let result = specs;

    if (statusFilter) {
      const isActive = statusFilter === 'true';
      result = result.filter(s => s.isActive === isActive);
    }

    if (criticalFilter) {
      const isCritical = criticalFilter === 'true';
      result = result.filter(s => s.isCritical === isCritical);
    }

    if (searchText) {
      const search = searchText.toLowerCase();
      result = result.filter(s =>
        s.itemCode?.toLowerCase().includes(search) ||
        s.itemName?.toLowerCase().includes(search) ||
        s.testName?.toLowerCase().includes(search) ||
        s.testMethod?.toLowerCase().includes(search)
      );
    }

    return result;
  }, [specs, statusFilter, criticalFilter, searchText]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = specs.length;
    const active = specs.filter(s => s.isActive).length;
    const inactive = specs.filter(s => !s.isActive).length;
    const critical = specs.filter(s => s.isCritical).length;
    const nonCritical = specs.filter(s => !s.isCritical).length;

    // Unique items with specs
    const uniqueItems = new Set(specs.map(s => s.itemId)).size;

    // By item stats
    const itemStats = specs.reduce((acc, spec) => {
      const key = spec.itemId;
      if (!acc[key]) {
        acc[key] = {
          itemId: spec.itemId,
          itemCode: spec.itemCode,
          itemName: spec.itemName,
          count: 0,
          critical: 0,
          active: 0,
        };
      }
      acc[key].count++;
      if (spec.isCritical) acc[key].critical++;
      if (spec.isActive) acc[key].active++;
      return acc;
    }, {} as Record<number, { itemId: number; itemCode: string; itemName: string; count: number; critical: number; active: number }>);

    const topItems = Object.values(itemStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { total, active, inactive, critical, nonCritical, uniqueItems, topItems };
  }, [specs]);

  // Chart data
  const statusChartData = useMemo(() => [
    { status: t('specs.status.active'), count: stats.active, color: STATUS_CONFIG.active.color },
    { status: t('specs.status.inactive'), count: stats.inactive, color: STATUS_CONFIG.inactive.color },
  ].filter(d => d.count > 0), [stats, t]);

  const criticalChartData = useMemo(() => [
    { type: t('common.critical'), count: stats.critical, color: CRITICAL_CONFIG.critical.color },
    { type: t('specs.stats.nonCritical'), count: stats.nonCritical, color: CRITICAL_CONFIG.normal.color },
  ].filter(d => d.count > 0), [stats, t]);

  // Format range helper
  const formatRange = useCallback((spec: QualitySpec) => {
    if (spec.minValue !== null && spec.maxValue !== null) {
      return `${spec.minValue} - ${spec.maxValue} ${spec.unit || ''}`.trim();
    } else if (spec.minValue !== null) {
      return `≥ ${spec.minValue} ${spec.unit || ''}`.trim();
    } else if (spec.maxValue !== null) {
      return `≤ ${spec.maxValue} ${spec.unit || ''}`.trim();
    }
    return spec.specification || '-';
  }, []);

  // Export handler
  const handleExporting = useCallback((e: ExportingEvent) => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Quality Specs');

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Quality_Specs_${new Date().toISOString().split('T')[0]}.xlsx`
        );
      });
    });
    e.cancel = true;
  }, []);

  // Cell renderers
  const renderItemCell = useCallback((data: { data: QualitySpec }) => (
    <div className="min-w-0">
      <p className="font-mono font-semibold text-blue-600">{data.data.itemCode || '-'}</p>
      <p className="text-xs text-gray-600 truncate">{data.data.itemName}</p>
    </div>
  ), []);

  const renderTestCell = useCallback((data: { data: QualitySpec }) => (
    <div className="min-w-0 flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{data.data.testName || '-'}</p>
        {data.data.testMethod && (
          <p className="text-xs text-gray-500 truncate">{data.data.testMethod}</p>
        )}
      </div>
      {data.data.isCritical && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200 shrink-0">
          <AlertTriangle className="h-3 w-3" />
          {t('specs.stats.critical')}
        </span>
      )}
    </div>
  ), [t]);

  const renderSpecCell = useCallback((data: { data: QualitySpec }) => (
    <span className="text-sm font-mono">{formatRange(data.data)}</span>
  ), [formatRange]);

  const renderStatusCell = useCallback((data: { data: QualitySpec }) => {
    const statusKey = data.data.isActive ? 'active' : 'inactive';
    const config = STATUS_CONFIG[statusKey];
    const IconComponent = config.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bgClass}`}>
        <IconComponent className="h-3 w-3" />
        {t(`specs.status.${statusKey}`)}
      </span>
    );
  }, [t]);

  const renderActionsCell = useCallback((data: { data: QualitySpec }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        router.push(`/quality/specs/${data.data.id}`);
      }}
      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
      title={t('tests.actions.viewDetails')}
    >
      <Eye className="h-4 w-4" />
    </button>
  ), [router, t]);

  // View mode buttons
  const viewModeButtons = useMemo(() => [
    { mode: 'grid' as ViewMode, icon: LayoutList, label: t('common.viewGrid') },
    { mode: 'cards' as ViewMode, icon: LayoutGrid, label: t('common.viewCards') },
    { mode: 'analytics' as ViewMode, icon: BarChart3, label: t('common.viewAnalytics') },
  ], [t]);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1800px] mx-auto">
      {/* Page Header */}
      <ResponsivePageHeader
        title={t('specifications.title')}
        subtitle={t('specifications.description')}
        icon={FileCheck}
        iconBgColor="bg-indigo-100"
        iconColor="text-indigo-600"
        breadcrumbs={[
          { label: t('specs.breadcrumbs.quality'), href: '/quality' },
          { label: t('specs.breadcrumbs.specifications') },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <DxButton
              icon="refresh"
              type="default"
              stylingMode="outlined"
              hint={t('specs.actions.refresh')}
              onClick={() => refetch()}
            />
            <DxButton
              icon="plus"
              text={t('specs.actions.newSpec')}
              type="success"
              onClick={() => router.push('/quality/specs/new')}
            />
          </div>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <StatCard
          label={t('specs.stats.total')}
          value={stats.total}
          icon={FileCheck}
          iconColor="text-indigo-500"
          accentColor="border-indigo-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('specs.stats.active')}
          value={stats.active}
          icon={CheckCircle}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('specs.stats.critical')}
          value={stats.critical}
          icon={AlertTriangle}
          iconColor="text-red-500"
          accentColor="border-red-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('specs.stats.nonCritical')}
          value={stats.nonCritical}
          icon={Shield}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('specs.stats.inactive')}
          value={stats.inactive}
          icon={XCircle}
          iconColor="text-slate-500"
          accentColor="border-slate-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('specs.stats.itemsWithSpec')}
          value={stats.uniqueItems}
          icon={Package}
          iconColor="text-purple-500"
          accentColor="border-purple-500"
          isLoading={isLoading}
        />
      </div>

      {/* View Mode Toggle & Filter Panel */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg shrink-0">
            {viewModeButtons.map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === mode
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 min-w-0">
            <TextBox
              placeholder={t('specs.filter.searchPlaceholder')}
              value={searchText}
              onValueChanged={(e) => setSearchText(e.value || '')}
              showClearButton={true}
              mode="search"
              width="100%"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 shrink-0">
            <Filter className="h-4 w-4 text-gray-400" />
            <SelectBox
              items={statusOptions}
              value={statusFilter}
              onValueChanged={(e) => setStatusFilter(e.value || '')}
              displayExpr="text"
              valueExpr="value"
              placeholder={t('specs.filter.statusPlaceholder')}
              width={130}
            />
            <SelectBox
              items={criticalOptions}
              value={criticalFilter}
              onValueChanged={(e) => setCriticalFilter(e.value || '')}
              displayExpr="text"
              valueExpr="value"
              placeholder={t('specs.filter.typePlaceholder')}
              width={150}
            />
          </div>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'grid' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-3 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <ListChecks className="h-4 w-4" />
              <span>{t('specs.grid.specsCount', { count: filteredSpecs.length })}</span>
            </div>
          </div>
          <DataGrid
            dataSource={filteredSpecs}
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
                router.push(`/quality/specs/${e.data.id}`);
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
            <FilterRow visible={true} />
            <SearchPanel visible={true} placeholder={t('specs.grid.searchPlaceholder')} width={250} />
            <HeaderFilter visible={true} />
            <Export enabled={true} formats={['xlsx']} />

            <Column
              dataField="itemCode"
              caption={t('specs.grid.item')}
              width={180}
              cellRender={renderItemCell}
            />
            <Column
              dataField="testName"
              caption={t('specs.grid.test')}
              minWidth={250}
              cellRender={renderTestCell}
            />
            <Column
              dataField="specification"
              caption={t('specs.grid.specification')}
              width={180}
              cellRender={renderSpecCell}
            />
            <Column
              dataField="isActive"
              caption={t('specs.grid.status')}
              width={120}
              cellRender={renderStatusCell}
            />
            <Column
              caption=""
              width={60}
              cellRender={renderActionsCell}
              allowFiltering={false}
              allowSorting={false}
            />
          </DataGrid>
        </div>
      )}

      {viewMode === 'cards' && (
        <div className="space-y-6">
          {/* Top Items with Specs */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-500" />
              {t('specs.cards.topItemsTitle')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {stats.topItems.map((item) => (
                <div
                  key={item.itemId}
                  className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/inventory/items/${item.itemId}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-semibold text-blue-600 truncate">{item.itemCode}</p>
                      <p className="text-xs text-gray-600 truncate">{item.itemName}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{item.count}</p>
                      <p className="text-xs text-gray-500">{t('specs.stats.total')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-lg font-semibold text-red-600">{item.critical}</p>
                        <p className="text-xs text-gray-500">{t('specs.stats.critical')}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-semibold text-emerald-600">{item.active}</p>
                        <p className="text-xs text-gray-500">{t('specs.stats.active')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Specs Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSpecs.slice(0, 12).map((spec) => (
              <div
                key={spec.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/quality/specs/${spec.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${spec.isCritical ? 'bg-red-100' : 'bg-blue-100'}`}>
                      {spec.isCritical ? (
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      ) : (
                        <Beaker className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{spec.testName}</p>
                      <p className="text-xs text-gray-500 truncate">{spec.testMethod || t('specs.cards.noMethod')}</p>
                    </div>
                  </div>
                  {spec.isCritical && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                      {t('specs.stats.critical')}
                    </span>
                  )}
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">{spec.itemCode}</span>
                    <span className="text-gray-400">-</span>
                    <span className="text-gray-600 truncate">{spec.itemName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <ListChecks className="h-4 w-4 text-gray-400" />
                    <span className="font-mono text-gray-700">{formatRange(spec)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    spec.isActive ? STATUS_CONFIG.active.bgClass : STATUS_CONFIG.inactive.bgClass
                  }`}>
                    {spec.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {spec.isActive ? t('specs.status.active') : t('specs.status.inactive')}
                  </span>
                  <button className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors">
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredSpecs.length > 12 && (
            <div className="text-center">
              <button
                onClick={() => setViewMode('grid')}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <LayoutList className="h-4 w-4" />
                {t('specs.cards.viewAllInGrid', { count: filteredSpecs.length })}
              </button>
            </div>
          )}
        </div>
      )}

      {viewMode === 'analytics' && (
        <div className="space-y-5">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Status Distribution */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-indigo-500" />
                {t('specs.analytics.statusDistribution')}
              </h3>
              {statusChartData.length > 0 ? (
                <PieChart
                  id="status-pie"
                  dataSource={statusChartData}
                  type="doughnut"
                  innerRadius={0.65}
                  palette={statusChartData.map(d => d.color)}
                  size={{ height: 280 }}
                >
                  <Series argumentField="status" valueField="count">
                    <Label visible={true} format="fixedPoint" customizeText={(arg: { valueText?: string }) => arg.valueText || ''}>
                      <Connector visible={true} width={1} />
                    </Label>
                  </Series>
                  <Legend
                    visible={true}
                    orientation="horizontal"
                    horizontalAlignment="center"
                    verticalAlignment="bottom"
                    font={{ size: 12 }}
                  />
                  <Tooltip
                    enabled={true}
                    customizeTooltip={(arg: { argumentText?: string; valueText?: string; percentText?: string }) => ({
                      text: `${arg.argumentText}: ${arg.valueText} (${arg.percentText})`,
                    })}
                  />
                </PieChart>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t('specs.analytics.noData')}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Critical Distribution */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                {t('specs.analytics.criticalDistribution')}
              </h3>
              {criticalChartData.length > 0 ? (
                <PieChart
                  id="critical-pie"
                  dataSource={criticalChartData}
                  type="doughnut"
                  innerRadius={0.65}
                  palette={criticalChartData.map(d => d.color)}
                  size={{ height: 280 }}
                >
                  <Series argumentField="type" valueField="count">
                    <Label visible={true} format="fixedPoint" customizeText={(arg: { valueText?: string }) => arg.valueText || ''}>
                      <Connector visible={true} width={1} />
                    </Label>
                  </Series>
                  <Legend
                    visible={true}
                    orientation="horizontal"
                    horizontalAlignment="center"
                    verticalAlignment="bottom"
                    font={{ size: 12 }}
                  />
                  <Tooltip
                    enabled={true}
                    customizeTooltip={(arg: { argumentText?: string; valueText?: string; percentText?: string }) => ({
                      text: `${arg.argumentText}: ${arg.valueText} (${arg.percentText})`,
                    })}
                  />
                </PieChart>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t('specs.analytics.noData')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Status Summary */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                {t('specs.analytics.statusSummary')}
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">{t('specs.status.active')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-emerald-600">{stats.active}</span>
                    <span className="text-xs text-emerald-500 ml-1">
                      ({stats.total > 0 ? ((stats.active / stats.total) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-slate-600" />
                    <span className="text-sm font-medium text-slate-700">{t('specs.status.inactive')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-slate-600">{stats.inactive}</span>
                    <span className="text-xs text-slate-500 ml-1">
                      ({stats.total > 0 ? ((stats.inactive / stats.total) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Critical Summary */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                {t('specs.analytics.criticalSummary')}
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-700">{t('specs.stats.critical')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-red-600">{stats.critical}</span>
                    <span className="text-xs text-red-500 ml-1">
                      ({stats.total > 0 ? ((stats.critical / stats.total) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">{t('specs.stats.nonCritical')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-blue-600">{stats.nonCritical}</span>
                    <span className="text-xs text-blue-500 ml-1">
                      ({stats.total > 0 ? ((stats.nonCritical / stats.total) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Beaker className="h-5 w-5 text-indigo-500" />
                {t('specs.analytics.quickActions')}
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => router.push('/quality/specs/new')}
                  className="w-full flex items-center gap-3 p-3 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                >
                  <Plus className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-medium text-indigo-700">{t('specs.analytics.addNewSpec')}</span>
                </button>
                <button
                  onClick={() => router.push('/quality/tests/new')}
                  className="w-full flex items-center gap-3 p-3 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                >
                  <Beaker className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">{t('specs.analytics.createNewTest')}</span>
                </button>
                <button
                  onClick={() => refetch()}
                  className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                >
                  <RefreshCw className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">{t('specs.analytics.refreshData')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Top Items Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-500" />
              {t('specs.analytics.topItemsTitle')}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('specs.analytics.tableItem')}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('specs.analytics.tableSpecCount')}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('specs.stats.critical')}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('specs.stats.active')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.topItems.map((item) => (
                    <tr key={item.itemId} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/inventory/items/${item.itemId}`)}>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-mono font-semibold text-blue-600">{item.itemCode}</p>
                          <p className="text-xs text-gray-500">{item.itemName}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-700">
                          {item.count}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold ${
                          item.critical > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {item.critical}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold bg-emerald-100 text-emerald-700">
                          {item.active}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

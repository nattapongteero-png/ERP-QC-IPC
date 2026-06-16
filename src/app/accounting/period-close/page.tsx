'use client';

// Period Close Dashboard Page - Responsive + Informative + User-Friendly
// Feature: 010-accounting-module-integration
// User Story 9: Perform Period-End Closing

import { useState, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import DataGrid, { Column, Paging, Selection, Sorting } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';

// DevExtreme Charts
import { PieChart, Series, Label, Legend, Tooltip, Connector } from 'devextreme-react/pie-chart';
import { CircularGauge, Scale, RangeContainer, Range, ValueIndicator, Geometry } from 'devextreme-react/circular-gauge';
import Funnel, { Item, Label as FunnelLabel, Tooltip as FunnelTooltip } from 'devextreme-react/funnel';
import { Sparkline, Tooltip as SparklineTooltip } from 'devextreme-react/sparkline';
import { Size, Border } from 'devextreme-react/chart';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils/cn';
import {
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  CalendarCheck,
  CalendarX,
  TrendingUp,
  ClipboardCheck,
  FileText,
  Activity,
  Clock,
  BarChart3,
  Target,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import type { FiscalPeriod, FiscalYear, FiscalPeriodStatus } from '@/types/accounting';

interface PeriodWithYear extends FiscalPeriod {
  fiscalYear?: FiscalYear;
}

interface PeriodValidation {
  canClose: boolean;
  periodId: number;
  periodName: string;
  fiscalYearCode: string;
  errors: Array<{ code: string; message: string; count?: number }>;
  warnings: Array<{ code: string; message: string; count?: number }>;
  metrics: {
    unpostedJournalEntries: number;
    draftAPInvoices: number;
    draftARInvoices: number;
    pendingPayments: number;
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
  };
}

type PeriodStatusFilter = '' | 'open' | 'soft_closed' | 'closed';

function formatDate(dateStr: string | Date | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

async function fetchFiscalYears(): Promise<FiscalYear[]> {
  const res = await fetch('/api/accounting/fiscal-years');
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

async function fetchPeriods(fiscalYearId?: number): Promise<PeriodWithYear[]> {
  const params = new URLSearchParams();
  if (fiscalYearId) params.set('fiscalYearId', String(fiscalYearId));

  const res = await fetch(`/api/accounting/fiscal-periods?${params.toString()}`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch periods');
  }
  const data = await res.json();
  return data.data || [];
}

async function fetchPeriodValidation(periodId: number): Promise<PeriodValidation> {
  const res = await fetch(`/api/accounting/fiscal-periods/${periodId}/validate`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to validate period');
  }
  const data = await res.json();
  return data.data;
}

async function closePeriod(periodId: number, force: boolean = false): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/accounting/fiscal-periods/${periodId}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to close period');
  }
  return data;
}

async function reopenPeriod(periodId: number, reason: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/accounting/fiscal-periods/${periodId}/reopen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to reopen period');
  }
  return data;
}

const STATUS_COLORS: Record<string, string> = {
  open: '#22C55E',
  soft_closed: '#F59E0B',
  closed: '#6B7280',
};

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

const STATUS_TAB_CONFIG: Record<PeriodStatusFilter, {
  translationKey: string;
  bgColor: string;
  textColor: string;
  icon: React.ReactNode;
}> = {
  '': {
    translationKey: 'statusTabs.all',
    bgColor: 'bg-gray-900',
    textColor: 'text-white',
    icon: <Calendar className="h-4 w-4" />,
  },
  open: {
    translationKey: 'statusTabs.open',
    bgColor: 'bg-green-600',
    textColor: 'text-white',
    icon: <Unlock className="h-4 w-4" />,
  },
  soft_closed: {
    translationKey: 'statusTabs.softClosed',
    bgColor: 'bg-amber-500',
    textColor: 'text-white',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  closed: {
    translationKey: 'statusTabs.closed',
    bgColor: 'bg-gray-700',
    textColor: 'text-white',
    icon: <Lock className="h-4 w-4" />,
  },
};

function StatusBadge({ status, t }: { status: FiscalPeriodStatus; t: TranslateFn }) {
  const config = {
    open: { bg: 'bg-green-100', text: 'text-green-800', icon: Unlock, labelKey: 'statusBadge.open' },
    soft_closed: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: AlertTriangle, labelKey: 'statusBadge.softClosed' },
    closed: { bg: 'bg-gray-100', text: 'text-gray-800', icon: Lock, labelKey: 'statusBadge.closed' },
  };
  const { bg, text, icon: Icon, labelKey } = config[status] || config.open;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      <Icon className="h-3 w-3" />
      {t(`periodClose.${labelKey}`)}
    </span>
  );
}

// Workflow steps for funnel chart
const getWorkflowData = (validation: PeriodValidation | null | undefined, t: TranslateFn) => {
  if (!validation) {
    return [
      { stage: t('periodClose.workflow.selectPeriod'), count: 100, color: '#94A3B8' },
      { stage: t('periodClose.workflow.validate'), count: 0, color: '#94A3B8' },
      { stage: t('periodClose.workflow.reviewIssues'), count: 0, color: '#94A3B8' },
      { stage: t('periodClose.workflow.closePeriod'), count: 0, color: '#94A3B8' },
    ];
  }

  const hasErrors = validation.errors.length > 0;

  return [
    { stage: t('periodClose.workflow.periodSelected'), count: 100, color: '#22C55E' },
    { stage: t('periodClose.workflow.validationRun'), count: 85, color: '#22C55E' },
    { stage: hasErrors ? t('periodClose.workflow.issuesFound') : t('periodClose.workflow.noIssues'), count: hasErrors ? 50 : 75, color: hasErrors ? '#EF4444' : '#22C55E' },
    { stage: validation.canClose ? t('periodClose.workflow.readyToClose') : t('periodClose.workflow.fixRequired'), count: validation.canClose ? 65 : 25, color: validation.canClose ? '#22C55E' : '#F59E0B' },
  ];
};

export default function PeriodClosePage() {
  const t = useTranslations('accounting');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { isMobile } = useMobile();
  const [selectedYearId, setSelectedYearId] = useState<number | undefined>();
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<PeriodStatusFilter>('');

  const { data: fiscalYears = [] } = useQuery({
    queryKey: ['fiscal-years'],
    queryFn: fetchFiscalYears,
  });

  const { data: periods = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['fiscal-periods', selectedYearId],
    queryFn: () => fetchPeriods(selectedYearId),
  });

  const { data: validation, isFetching: isValidating } = useQuery({
    queryKey: ['period-validation', selectedPeriodId],
    queryFn: () => selectedPeriodId ? fetchPeriodValidation(selectedPeriodId) : null,
    enabled: !!selectedPeriodId,
  });

  const closeMutation = useMutation({
    mutationFn: ({ periodId, force }: { periodId: number; force: boolean }) => closePeriod(periodId, force),
    onSuccess: (data) => {
      notify(data.message, 'success', 3000);
      queryClient.invalidateQueries({ queryKey: ['fiscal-periods'] });
      queryClient.invalidateQueries({ queryKey: ['period-validation'] });
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const reopenMutation = useMutation({
    mutationFn: ({ periodId, reason }: { periodId: number; reason: string }) => reopenPeriod(periodId, reason),
    onSuccess: (data) => {
      notify(data.message, 'success', 3000);
      setReopenReason('');
      queryClient.invalidateQueries({ queryKey: ['fiscal-periods'] });
      queryClient.invalidateQueries({ queryKey: ['period-validation'] });
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleClosePeriod = useCallback((force: boolean = false) => {
    if (!selectedPeriodId) return;
    closeMutation.mutate({ periodId: selectedPeriodId, force });
  }, [selectedPeriodId, closeMutation]);

  const handleReopenPeriod = useCallback(() => {
    if (!selectedPeriodId || !reopenReason.trim()) {
      notify(t('periodClose.actions.reopenReasonRequired'), 'warning', 3000);
      return;
    }
    reopenMutation.mutate({ periodId: selectedPeriodId, reason: reopenReason });
  }, [selectedPeriodId, reopenReason, reopenMutation, t]);

  // Stats
  const openPeriods = periods.filter(p => p.status === 'open').length;
  const closedPeriods = periods.filter(p => p.status === 'closed').length;
  const softClosedPeriods = periods.filter(p => p.status === 'soft_closed').length;
  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);

  // Filter for mobile cards / DataGrid based on status filter
  const filteredPeriods = useMemo(() => {
    if (!statusFilter) return periods;
    return periods.filter(p => p.status === statusFilter);
  }, [periods, statusFilter]);

  // Chart data
  const statusChartData = [
    { status: t('periodClose.statusChart.open'), count: openPeriods, color: STATUS_COLORS.open },
    { status: t('periodClose.statusChart.softClosed'), count: softClosedPeriods, color: STATUS_COLORS.soft_closed },
    { status: t('periodClose.statusChart.closed'), count: closedPeriods, color: STATUS_COLORS.closed },
  ].filter(d => d.count > 0);

  const workflowData = getWorkflowData(validation, t);

  // Calculate close progress percentage
  const closeProgress = periods.length > 0 ? Math.round((closedPeriods / periods.length) * 100) : 0;

  // Sparkline data (simulate monthly close trend)
  const sparklineData = periods.slice(0, 12).map((p) => p.status === 'closed' ? 1 : 0);

  // Recent closed periods
  const recentClosedPeriods = periods
    .filter(p => p.status === 'closed' && p.closedAt)
    .sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime())
    .slice(0, 5);

  // Tab status counts
  const statusCounts: Record<PeriodStatusFilter, number> = {
    '': periods.length,
    open: openPeriods,
    soft_closed: softClosedPeriods,
    closed: closedPeriods,
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full" data-testid="period-close-page">
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title={t('periodClose.title')}
        subtitle={t('periodClose.subtitle')}
        icon={CalendarCheck}
        iconBgColor="bg-violet-100"
        iconColor="text-violet-600"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              text={t('periodClose.refresh')}
              icon={isFetching ? 'spindown' : 'refresh'}
              stylingMode="outlined"
              disabled={isFetching}
              onClick={() => refetch()}
            />
          </div>
        }
      />

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('periodClose.stats.openPeriods')}
          value={openPeriods}
          icon={Unlock}
          iconColor="text-green-500"
          accentColor="border-green-500"
        />
        <StatCard
          label={t('periodClose.stats.softClosed')}
          value={softClosedPeriods}
          icon={AlertTriangle}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
        />
        <StatCard
          label={t('periodClose.stats.closedPeriods')}
          value={closedPeriods}
          icon={Lock}
          iconColor="text-gray-500"
          accentColor="border-gray-500"
        />
        <StatCard
          label={t('periodClose.stats.closeProgress')}
          value={`${closeProgress}%`}
          icon={Target}
          iconColor="text-violet-500"
          accentColor="border-violet-500"
        />
      </div>

      {/* Charts Row - hidden on mobile */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-500" />
              {t('periodClose.charts.statusDistribution')}
            </CardTitle>
            <CardDescription>{t('periodClose.charts.statusDistributionDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {statusChartData.length > 0 ? (
              <PieChart
                id="status-pie-chart"
                dataSource={statusChartData}
                type="doughnut"
                innerRadius={0.65}
                palette={statusChartData.map(d => d.color)}
              >
                <Size height={200} />
                <Series argumentField="status" valueField="count">
                  <Label
                    visible={true}
                    position="columns"
                    customizeText={(e: { argumentText: string; percentText: string }) =>
                      `${e.argumentText}\n${e.percentText}`
                    }
                  >
                    <Connector visible={true} width={1} />
                  </Label>
                </Series>
                <Legend visible={false} />
                <Tooltip enabled={true} />
              </PieChart>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-400">
                {t('periodClose.charts.noPeriods')}
              </div>
            )}
            {sparklineData.length > 0 && (
              <div className="mt-2 h-[40px]">
                <Sparkline
                  dataSource={sparklineData}
                  type="bar"
                  barPositiveColor="#22C55E"
                  barNegativeColor="#E5E7EB"
                >
                  <SparklineTooltip enabled={true} />
                </Sparkline>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Close Progress Gauge */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500" />
              {t('periodClose.charts.yearCloseProgress')}
            </CardTitle>
            <CardDescription>{t('periodClose.charts.yearCloseProgressDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <CircularGauge
              id="close-progress-gauge"
              value={closeProgress}
            >
              <Size height={200} />
              <Scale startValue={0} endValue={100} tickInterval={20} />
              <RangeContainer>
                <Range startValue={0} endValue={30} color="#EF4444" />
                <Range startValue={30} endValue={70} color="#F59E0B" />
                <Range startValue={70} endValue={100} color="#22C55E" />
              </RangeContainer>
              <ValueIndicator type="rectangleNeedle" color="#6366F1" />
              <Geometry startAngle={180} endAngle={0} />
            </CircularGauge>
          </CardContent>
        </Card>

        {/* Workflow Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-purple-500" />
              {t('periodClose.charts.closeWorkflow')}
            </CardTitle>
            <CardDescription>{t('periodClose.charts.closeWorkflowDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Funnel
              id="workflow-funnel"
              dataSource={workflowData}
              argumentField="stage"
              valueField="count"
              sortData={false}
              palette={workflowData.map(d => d.color)}
            >
              <Size height={200} />
              <FunnelLabel
                visible={true}
                position="inside"
                backgroundColor="none"
                customizeText={(info: { item: { argument?: string | number | Date } }) =>
                  `${info.item.argument ?? ''}`
                }
              />
              <Item>
                <Border visible={true} color="#fff" width={2} />
              </Item>
              <FunnelTooltip enabled={true} />
            </Funnel>
          </CardContent>
        </Card>
      </div>

      {/* DataGrid Card with Filter Tabs */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Filter Header: Fiscal Year + Status Tabs */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="h-4 w-4 text-gray-500 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">{t('periodClose.fiscalYear')}</span>
            <div className="min-w-[160px] w-full sm:w-auto sm:max-w-[200px] flex-1 sm:flex-none">
              <SelectBox
                key={locale}
                items={[{ id: undefined, yearCode: t('periodClose.allYears') }, ...fiscalYears]}
                value={selectedYearId}
                onValueChanged={(e) => {
                  setSelectedYearId(e.value);
                  setSelectedPeriodId(null);
                }}
                valueExpr="id"
                displayExpr="yearCode"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
            <FileText className="h-4 w-4 text-gray-400" />
            <span>{t('periodClose.periodsShown', { count: filteredPeriods.length })}</span>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100">
          <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-thin snap-x">
            {(Object.keys(STATUS_TAB_CONFIG) as PeriodStatusFilter[]).map((key) => {
              const config = STATUS_TAB_CONFIG[key];
              const count = statusCounts[key];
              const isActive = statusFilter === key;

              return (
                <button
                  key={key || 'all'}
                  onClick={() => setStatusFilter(key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 snap-start min-h-[36px]',
                    isActive
                      ? `${config.bgColor} ${config.textColor} shadow-sm`
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  {config.icon}
                  <span>{t(`periodClose.${config.translationKey}`)}</span>
                  <span className={cn(
                    'ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold',
                    isActive
                      ? 'bg-white/25 text-inherit'
                      : 'bg-gray-200 text-gray-700'
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content: Loading / Empty / Mobile Cards / Desktop Grid */}
        {isLoading ? (
          isMobile ? (
            <PeriodCardSkeletonList count={4} />
          ) : (
            <DataGridLoadingSkeleton />
          )
        ) : periods.length === 0 ? (
          <EmptyState t={t} />
        ) : filteredPeriods.length === 0 ? (
          <NoResultsState onClear={() => setStatusFilter('')} t={t} />
        ) : isMobile ? (
          <PeriodCardList
            periods={filteredPeriods}
            selectedPeriodId={selectedPeriodId}
            onSelect={(id) => setSelectedPeriodId(id)}
            t={t}
          />
        ) : (
          <div className="overflow-x-auto">
            <DataGrid
              key={locale}
              dataSource={filteredPeriods}
              showBorders={false}
              showRowLines
              columnAutoWidth
              rowAlternationEnabled
              hoverStateEnabled
              onRowClick={(e) => setSelectedPeriodId(e.data.id)}
              selectedRowKeys={selectedPeriodId ? [selectedPeriodId] : []}
              elementAttr={{ 'data-testid': 'periods-grid' }}
              className="min-h-[350px]"
              width="100%"
            >
              <Selection mode="single" />
              <Sorting mode="single" />
              <Paging defaultPageSize={12} />
              <Column dataField="periodName" caption={t('periodClose.columns.period')} minWidth={140} />
              <Column
                dataField="fiscalYear.yearCode"
                caption={t('periodClose.columns.year')}
                width={90}
                calculateCellValue={(row: PeriodWithYear) => row.fiscalYear?.yearCode || '-'}
              />
              <Column
                dataField="startDate"
                caption={t('periodClose.columns.start')}
                calculateCellValue={(row: PeriodWithYear) => formatDate(row.startDate)}
                width={120}
              />
              <Column
                dataField="endDate"
                caption={t('periodClose.columns.end')}
                calculateCellValue={(row: PeriodWithYear) => formatDate(row.endDate)}
                width={120}
              />
              <Column
                dataField="status"
                caption={t('periodClose.columns.status')}
                width={140}
                cellRender={({ data }) => <StatusBadge status={data.status} t={t} />}
                alignment="center"
              />
              <Column
                dataField="closedAt"
                caption={t('periodClose.columns.closedAt')}
                calculateCellValue={(row: PeriodWithYear) => row.closedAt ? formatDate(row.closedAt) : '-'}
                width={120}
              />
            </DataGrid>
          </div>
        )}
      </div>

      {/* Validation & Actions Section + Recent Closed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Validation & Actions Panel */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-indigo-500" />
                {selectedPeriod
                  ? t('periodClose.validation.closeTitle', { periodName: selectedPeriod.periodName })
                  : t('periodClose.validation.selectPrompt')}
              </CardTitle>
              <CardDescription>
                {selectedPeriod
                  ? t('periodClose.validation.descriptionSelected')
                  : t('periodClose.validation.descriptionNone')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedPeriodId ? (
                <div className="text-center py-10 text-gray-500">
                  <div className="h-16 w-16 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-4">
                    <Calendar className="h-8 w-8 text-violet-600" />
                  </div>
                  <p className="font-medium text-gray-800">{t('periodClose.validation.noneSelectedTitle')}</p>
                  <p className="text-sm mt-1 text-gray-500 max-w-sm mx-auto">
                    {t('periodClose.validation.noneSelectedDescription')}
                  </p>
                </div>
              ) : isValidating ? (
                <div className="text-center py-10 text-gray-500">
                  <RefreshCw className="h-8 w-8 mx-auto text-indigo-400 animate-spin" />
                  <p className="mt-2 font-medium">{t('periodClose.validation.validating')}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('periodClose.validation.validatingDetail')}</p>
                </div>
              ) : validation ? (
                <div className="space-y-4">
                  {/* Close Status Banner */}
                  <div className={cn(
                    'p-4 rounded-lg border',
                    validation.canClose
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  )}>
                    <div className="flex items-center gap-2">
                      {validation.canClose ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                          <span className="font-medium text-green-800">{t('periodClose.validation.readyToClose')}</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                          <span className="font-medium text-red-800">{t('periodClose.validation.cannotClose')}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Errors */}
                  {validation.errors.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <h4 className="text-sm font-semibold text-red-800">
                          {t('periodClose.validation.errors', { count: validation.errors.length })}
                        </h4>
                      </div>
                      <div className="space-y-2">
                        {validation.errors.map((error, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-2 text-sm text-red-700 bg-red-50 border border-red-100 p-2.5 rounded-lg"
                          >
                            <span className="flex-1 break-words">{error.message}</span>
                            {error.count !== undefined && error.count > 0 && (
                              <span className="px-2 py-0.5 bg-red-200 text-red-800 rounded-full text-xs font-semibold flex-shrink-0">
                                {error.count}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {validation.warnings.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <h4 className="text-sm font-semibold text-yellow-800">
                          {t('periodClose.validation.warnings', { count: validation.warnings.length })}
                        </h4>
                      </div>
                      <div className="space-y-2">
                        {validation.warnings.map((warning, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-100 p-2.5 rounded-lg"
                          >
                            <span className="flex-1 break-words">{warning.message}</span>
                            {warning.count !== undefined && warning.count > 0 && (
                              <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded-full text-xs font-semibold flex-shrink-0">
                                {warning.count}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metrics Grid */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      {t('periodClose.validation.metrics')}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-200">
                        <div className="text-gray-500 text-xs mb-0.5">{t('periodClose.validation.unpostedJEs')}</div>
                        <div className={cn(
                          'font-bold text-lg',
                          validation.metrics.unpostedJournalEntries > 0 ? 'text-red-600' : 'text-gray-900'
                        )}>
                          {validation.metrics.unpostedJournalEntries}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-200">
                        <div className="text-gray-500 text-xs mb-0.5">{t('periodClose.validation.draftAP')}</div>
                        <div className={cn(
                          'font-bold text-lg',
                          validation.metrics.draftAPInvoices > 0 ? 'text-red-600' : 'text-gray-900'
                        )}>
                          {validation.metrics.draftAPInvoices}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-200">
                        <div className="text-gray-500 text-xs mb-0.5">{t('periodClose.validation.draftAR')}</div>
                        <div className={cn(
                          'font-bold text-lg',
                          validation.metrics.draftARInvoices > 0 ? 'text-red-600' : 'text-gray-900'
                        )}>
                          {validation.metrics.draftARInvoices}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-200">
                        <div className="text-gray-500 text-xs mb-0.5">{t('periodClose.validation.trialBalance')}</div>
                        <div className={cn(
                          'font-bold text-lg',
                          validation.metrics.isBalanced ? 'text-green-600' : 'text-red-600'
                        )}>
                          {validation.metrics.isBalanced ? t('periodClose.validation.balanced') : t('periodClose.validation.notBalanced')}
                        </div>
                      </div>
                    </div>
                    {/* Debit/Credit Summary */}
                    <div className="flex flex-col sm:flex-row gap-2 text-xs">
                      <div className="flex-1 bg-blue-50 p-2 rounded text-center">
                        <div className="text-blue-600">{t('periodClose.validation.debits')}</div>
                        <div className="font-semibold text-blue-800 break-all">{formatCurrency(validation.metrics.totalDebits)}</div>
                      </div>
                      <div className="flex-1 bg-purple-50 p-2 rounded text-center">
                        <div className="text-purple-600">{t('periodClose.validation.credits')}</div>
                        <div className="font-semibold text-purple-800 break-all">{formatCurrency(validation.metrics.totalCredits)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {selectedPeriod?.status === 'open' && (
                    <div className="flex flex-col gap-2 pt-4 border-t">
                      <Button
                        text={t('periodClose.actions.close')}
                        type="default"
                        stylingMode="contained"
                        icon="lock"
                        width="100%"
                        disabled={!validation.canClose || closeMutation.isPending}
                        onClick={() => handleClosePeriod(false)}
                      />
                      {!validation.canClose && (
                        <Button
                          text={t('periodClose.actions.forceClose')}
                          type="danger"
                          stylingMode="outlined"
                          width="100%"
                          disabled={closeMutation.isPending}
                          onClick={() => {
                            if (confirm(t('periodClose.actions.forceCloseConfirm'))) {
                              handleClosePeriod(true);
                            }
                          }}
                        />
                      )}
                    </div>
                  )}

                  {(selectedPeriod?.status === 'closed' || selectedPeriod?.status === 'soft_closed') && (
                    <div className="space-y-3 pt-4 border-t">
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-700">{t('periodClose.actions.reopenReasonLabel')}</label>
                        <input
                          type="text"
                          value={reopenReason}
                          onChange={(e) => setReopenReason(e.target.value)}
                          placeholder={t('periodClose.actions.reopenReasonPlaceholder')}
                          className="border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                        />
                      </div>
                      <Button
                        text={t('periodClose.actions.reopen')}
                        type="normal"
                        stylingMode="outlined"
                        icon="unlock"
                        width="100%"
                        disabled={!reopenReason.trim() || reopenMutation.isPending}
                        onClick={handleReopenPeriod}
                      />
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Recent Closed Periods */}
        <div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-500" />
                {t('periodClose.recentClosed.title')}
              </CardTitle>
              <CardDescription>{t('periodClose.recentClosed.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {recentClosedPeriods.length > 0 ? (
                <div className="space-y-2">
                  {recentClosedPeriods.map((period) => (
                    <button
                      type="button"
                      key={period.id}
                      className="w-full flex items-center justify-between gap-2 p-2.5 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 active:bg-indigo-100 transition-colors text-left min-h-[44px]"
                      onClick={() => setSelectedPeriodId(period.id)}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{period.periodName}</p>
                        <p className="text-xs text-gray-500">{period.fiscalYear?.yearCode}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-500">{t('periodClose.recentClosed.closedLabel')}</p>
                        <p className="text-xs font-medium text-gray-700">{formatDate(period.closedAt!)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <CalendarX className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('periodClose.recentClosed.none')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Guide */}
      <Card className="bg-gradient-to-br from-slate-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">{t('periodClose.guide.title')}</CardTitle>
          <CardDescription>{t('periodClose.guide.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[
              { step: 1, titleKey: 'guide.step1Title', descKey: 'guide.step1Desc', icon: FileText },
              { step: 2, titleKey: 'guide.step2Title', descKey: 'guide.step2Desc', icon: ClipboardCheck },
              { step: 3, titleKey: 'guide.step3Title', descKey: 'guide.step3Desc', icon: Target },
              { step: 4, titleKey: 'guide.step4Title', descKey: 'guide.step4Desc', icon: Lock },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3 p-3 md:p-4 bg-white rounded-lg border border-gray-100">
                <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">
                  {item.step}
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-gray-900 text-sm">{t(`periodClose.${item.titleKey}`)}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{t(`periodClose.${item.descKey}`)}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

/**
 * Mobile Card List — replaces DataGrid on mobile viewports.
 * Each card shows: Period name + status badge + dates + closed info.
 * Tappable to select; 44px min-height.
 */
function PeriodCardList({
  periods,
  selectedPeriodId,
  onSelect,
  t,
}: {
  periods: PeriodWithYear[];
  selectedPeriodId: number | null;
  onSelect: (id: number) => void;
  t: TranslateFn;
}) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {periods.map((period) => {
        const isSelected = selectedPeriodId === period.id;
        const statusKey = period.status as FiscalPeriodStatus;
        const statusIcon = statusKey === 'open' ? Unlock : statusKey === 'soft_closed' ? AlertTriangle : Lock;
        const StatusIcon = statusIcon;
        const iconBg =
          statusKey === 'open' ? 'bg-green-100' :
          statusKey === 'soft_closed' ? 'bg-amber-100' :
          'bg-gray-100';
        const iconColor =
          statusKey === 'open' ? 'text-green-600' :
          statusKey === 'soft_closed' ? 'text-amber-600' :
          'text-gray-600';

        return (
          <div
            key={period.id}
            className={cn(
              'bg-white border rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all',
              isSelected ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-200'
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(period.id)}
              className="w-full text-left p-4 flex items-start gap-3 min-h-[44px]"
            >
              <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
                <StatusIcon className={cn('h-5 w-5', iconColor)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-base truncate">{period.periodName}</p>
                    <p className="text-xs text-gray-500">{period.fiscalYear?.yearCode || '-'}</p>
                  </div>
                  <StatusBadge status={statusKey} t={t} />
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-600">
                  <span className="inline-flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded">
                    <Calendar className="h-3 w-3" />
                    {formatDate(period.startDate)} – {formatDate(period.endDate)}
                  </span>
                  {period.closedAt && (
                    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      <Lock className="h-3 w-3" />
                      {t('periodClose.cardLabels.closedPrefix')} {formatDate(period.closedAt)}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 mt-2" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Loading skeleton for mobile card list */
function PeriodCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 bg-gray-200 rounded" />
              <div className="h-3 w-1/3 bg-gray-200 rounded" />
              <div className="flex gap-2 pt-1">
                <div className="h-5 w-24 bg-gray-200 rounded-full" />
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

/** Empty state — shown when no fiscal periods exist at all */
function EmptyState({ t }: { t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-violet-100 flex items-center justify-center mb-5">
        <CalendarX className="h-10 w-10 text-violet-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {t('periodClose.empty.title')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-2">
        {t('periodClose.empty.description')}
      </p>
    </div>
  );
}

/** No-results state — shown when filter yields zero results but periods exist */
function NoResultsState({ onClear, t }: { onClear: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <CalendarX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {t('periodClose.noResults.title')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {t('periodClose.noResults.description')}
      </p>
      <Button
        text={t('periodClose.noResults.clearFilters')}
        icon="clear"
        stylingMode="outlined"
        onClick={onClear}
      />
    </div>
  );
}

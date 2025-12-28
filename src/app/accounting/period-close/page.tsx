'use client';

// Period Close Dashboard Page - Enhanced Version
// Feature: 010-accounting-module-integration
// User Story 9: Perform Period-End Closing
// Following Template Module UI Patterns

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import DataGrid, { Column, Paging, FilterRow, Selection, Sorting } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';

// DevExtreme Charts
import { PieChart, Series, Label, Legend, Tooltip, Connector } from 'devextreme-react/pie-chart';
import { CircularGauge, Scale, RangeContainer, Range, ValueIndicator, Geometry } from 'devextreme-react/circular-gauge';
import Funnel, { Item, Label as FunnelLabel, Tooltip as FunnelTooltip } from 'devextreme-react/funnel';
import { Sparkline, Tooltip as SparklineTooltip } from 'devextreme-react/sparkline';
import { Size, Border } from 'devextreme-react/chart';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
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
  ChevronRight,
  Activity,
  Clock,
  BarChart3,
  Target,
  RefreshCw,
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

function StatusBadge({ status }: { status: FiscalPeriodStatus }) {
  const config = {
    open: { bg: 'bg-green-100', text: 'text-green-800', icon: Unlock, label: 'Open' },
    soft_closed: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: AlertTriangle, label: 'Soft Closed' },
    closed: { bg: 'bg-gray-100', text: 'text-gray-800', icon: Lock, label: 'Closed' },
  };
  const { bg, text, icon: Icon, label } = config[status] || config.open;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// Workflow steps for funnel chart
const getWorkflowData = (validation: PeriodValidation | null | undefined) => {
  if (!validation) {
    return [
      { stage: 'Select Period', count: 100, color: '#94A3B8' },
      { stage: 'Validate', count: 0, color: '#94A3B8' },
      { stage: 'Review Issues', count: 0, color: '#94A3B8' },
      { stage: 'Close Period', count: 0, color: '#94A3B8' },
    ];
  }

  const hasErrors = validation.errors.length > 0;
  const hasWarnings = validation.warnings.length > 0;

  return [
    { stage: 'Period Selected', count: 100, color: '#22C55E' },
    { stage: 'Validation Run', count: 85, color: '#22C55E' },
    { stage: hasErrors ? 'Issues Found' : 'No Issues', count: hasErrors ? 50 : 75, color: hasErrors ? '#EF4444' : '#22C55E' },
    { stage: validation.canClose ? 'Ready to Close' : 'Fix Required', count: validation.canClose ? 65 : 25, color: validation.canClose ? '#22C55E' : '#F59E0B' },
  ];
};

export default function PeriodClosePage() {
  const queryClient = useQueryClient();
  const [selectedYearId, setSelectedYearId] = useState<number | undefined>();
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [reopenReason, setReopenReason] = useState('');

  const { data: fiscalYears = [], isLoading: isLoadingYears } = useQuery({
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
      notify('Please enter a reason for reopening', 'warning', 3000);
      return;
    }
    reopenMutation.mutate({ periodId: selectedPeriodId, reason: reopenReason });
  }, [selectedPeriodId, reopenReason, reopenMutation]);

  // Stats
  const openPeriods = periods.filter(p => p.status === 'open').length;
  const closedPeriods = periods.filter(p => p.status === 'closed').length;
  const softClosedPeriods = periods.filter(p => p.status === 'soft_closed').length;
  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);

  // Chart data
  const statusChartData = [
    { status: 'Open', count: openPeriods, color: STATUS_COLORS.open },
    { status: 'Soft Closed', count: softClosedPeriods, color: STATUS_COLORS.soft_closed },
    { status: 'Closed', count: closedPeriods, color: STATUS_COLORS.closed },
  ].filter(d => d.count > 0);

  const workflowData = getWorkflowData(validation);

  // Calculate close progress percentage
  const closeProgress = periods.length > 0 ? Math.round((closedPeriods / periods.length) * 100) : 0;

  // Sparkline data (simulate monthly close trend)
  const sparklineData = periods.slice(0, 12).map((p, i) => p.status === 'closed' ? 1 : 0);

  // Recent closed periods
  const recentClosedPeriods = periods
    .filter(p => p.status === 'closed' && p.closedAt)
    .sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6 p-1" data-testid="period-close-page">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 via-white to-indigo-50 border-b border-gray-100 -mx-1 px-6 py-5 rounded-t-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="p-3.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
                <CalendarCheck className="h-7 w-7 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Period Close</h1>
              <p className="text-sm text-gray-500 mt-0.5">Month-end and year-end closing procedures</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              text="Refresh"
              icon={isFetching ? 'spindown' : 'refresh'}
              stylingMode="outlined"
              disabled={isFetching}
              onClick={() => refetch()}
            />
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Periods */}
        <Card className="relative overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Open Periods</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{openPeriods}</p>
                <p className="text-xs text-gray-400 mt-1">Available for transactions</p>
              </div>
              <div className="p-2.5 rounded-xl bg-green-100">
                <Unlock className="h-6 w-6 text-green-600" />
              </div>
            </div>
            {sparklineData.length > 0 && (
              <div className="mt-4 h-[40px]">
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

        {/* Soft Closed */}
        <Card className="relative overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Soft Closed</p>
                <p className="text-3xl font-bold text-yellow-600 mt-1">{softClosedPeriods}</p>
                <p className="text-xs text-gray-400 mt-1">Limited edits allowed</p>
              </div>
              <div className="p-2.5 rounded-xl bg-yellow-100">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Closed Periods */}
        <Card className="relative overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Closed Periods</p>
                <p className="text-3xl font-bold text-gray-700 mt-1">{closedPeriods}</p>
                <p className="text-xs text-gray-400 mt-1">Fully locked</p>
              </div>
              <div className="p-2.5 rounded-xl bg-gray-100">
                <Lock className="h-6 w-6 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Close Progress */}
        <Card className="relative overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Close Progress</p>
                <p className="text-3xl font-bold text-indigo-600 mt-1">{closeProgress}%</p>
                <p className="text-xs text-gray-400 mt-1">{closedPeriods} of {periods.length} periods</p>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-100">
                <Target className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-500" />
              Period Status Distribution
            </CardTitle>
            <CardDescription>Current period status breakdown</CardDescription>
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
                No periods found
              </div>
            )}
          </CardContent>
        </Card>

        {/* Close Progress Gauge */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500" />
              Year Close Progress
            </CardTitle>
            <CardDescription>Percentage of periods closed</CardDescription>
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
              Close Workflow
            </CardTitle>
            <CardDescription>Current close process status</CardDescription>
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

      {/* Filter and Main Content */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Fiscal Year:</span>
            </div>
            <div className="w-48">
              <SelectBox
                items={[{ id: undefined, yearCode: 'All Years' }, ...fiscalYears]}
                value={selectedYearId}
                onValueChanged={(e) => {
                  setSelectedYearId(e.value);
                  setSelectedPeriodId(null);
                }}
                valueExpr="id"
                displayExpr="yearCode"
              />
            </div>
            {/* Quick Stats */}
            <div className="flex items-center gap-4 ml-auto text-sm">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-md">
                <Unlock className="h-3.5 w-3.5 text-green-600" />
                <span className="text-green-600">Open:</span>
                <span className="font-semibold text-green-700">{openPeriods}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 rounded-md">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
                <span className="text-yellow-600">Soft:</span>
                <span className="font-semibold text-yellow-700">{softClosedPeriods}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-md">
                <Lock className="h-3.5 w-3.5 text-gray-600" />
                <span className="text-gray-600">Closed:</span>
                <span className="font-semibold text-gray-700">{closedPeriods}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Periods Grid - 2 columns */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                Fiscal Periods
              </CardTitle>
              <CardDescription>Select a period to view close status and perform actions</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="text-center py-12">
                  <RefreshCw className="h-8 w-8 mx-auto text-gray-300 animate-spin" />
                  <p className="text-gray-500 mt-2">Loading periods...</p>
                </div>
              ) : (
                <DataGrid
                  dataSource={periods}
                  showBorders={false}
                  showRowLines
                  columnAutoWidth
                  rowAlternationEnabled
                  hoverStateEnabled
                  onRowClick={(e) => setSelectedPeriodId(e.data.id)}
                  selectedRowKeys={selectedPeriodId ? [selectedPeriodId] : []}
                  elementAttr={{ 'data-testid': 'periods-grid' }}
                  className="min-h-[350px]"
                >
                  <Selection mode="single" />
                  <FilterRow visible />
                  <Sorting mode="single" />
                  <Paging defaultPageSize={12} />
                  <Column dataField="periodName" caption="Period" minWidth={120} />
                  <Column
                    dataField="fiscalYear.yearCode"
                    caption="Year"
                    width={80}
                    calculateCellValue={(row: PeriodWithYear) => row.fiscalYear?.yearCode || '-'}
                  />
                  <Column
                    dataField="startDate"
                    caption="Start"
                    calculateCellValue={(row: PeriodWithYear) => formatDate(row.startDate)}
                    width={110}
                  />
                  <Column
                    dataField="endDate"
                    caption="End"
                    calculateCellValue={(row: PeriodWithYear) => formatDate(row.endDate)}
                    width={110}
                  />
                  <Column
                    dataField="status"
                    caption="Status"
                    width={130}
                    cellRender={({ data }) => <StatusBadge status={data.status} />}
                    alignment="center"
                  />
                  <Column
                    dataField="closedAt"
                    caption="Closed At"
                    calculateCellValue={(row: PeriodWithYear) => row.closedAt ? formatDate(row.closedAt) : '-'}
                    width={110}
                  />
                </DataGrid>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Validation & Actions Panel - 1 column */}
        <div className="space-y-6">
          {/* Selected Period Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-indigo-500" />
                {selectedPeriod ? `Close: ${selectedPeriod.periodName}` : 'Select a Period'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedPeriodId ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="font-medium">No Period Selected</p>
                  <p className="text-sm mt-1">Click on a period from the list to view close status</p>
                </div>
              ) : isValidating ? (
                <div className="text-center py-8 text-gray-500">
                  <RefreshCw className="h-8 w-8 mx-auto text-indigo-400 animate-spin" />
                  <p className="mt-2">Validating period...</p>
                </div>
              ) : validation ? (
                <div className="space-y-4">
                  {/* Close Status Banner */}
                  <div className={`p-4 rounded-lg ${validation.canClose ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-center gap-2">
                      {validation.canClose ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <span className="font-medium text-green-800">Ready to Close</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-600" />
                          <span className="font-medium text-red-800">Cannot Close - Issues Found</span>
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
                          Errors ({validation.errors.length})
                        </h4>
                      </div>
                      <div className="space-y-2">
                        {validation.errors.map((error, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-sm text-red-700 bg-red-50 border border-red-100 p-2.5 rounded-lg"
                          >
                            <span className="flex-1">{error.message}</span>
                            {error.count !== undefined && error.count > 0 && (
                              <span className="px-2 py-0.5 bg-red-200 text-red-800 rounded-full text-xs font-semibold">
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
                          Warnings ({validation.warnings.length})
                        </h4>
                      </div>
                      <div className="space-y-2">
                        {validation.warnings.map((warning, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-sm text-yellow-700 bg-yellow-50 border border-yellow-100 p-2.5 rounded-lg"
                          >
                            <span className="flex-1">{warning.message}</span>
                            {warning.count !== undefined && warning.count > 0 && (
                              <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded-full text-xs font-semibold">
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
                      Validation Metrics
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-200">
                        <div className="text-gray-500 text-xs mb-0.5">Unposted JEs</div>
                        <div className={`font-bold text-lg ${validation.metrics.unpostedJournalEntries > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          {validation.metrics.unpostedJournalEntries}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-200">
                        <div className="text-gray-500 text-xs mb-0.5">Draft AP</div>
                        <div className={`font-bold text-lg ${validation.metrics.draftAPInvoices > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          {validation.metrics.draftAPInvoices}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-200">
                        <div className="text-gray-500 text-xs mb-0.5">Draft AR</div>
                        <div className={`font-bold text-lg ${validation.metrics.draftARInvoices > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          {validation.metrics.draftARInvoices}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-200">
                        <div className="text-gray-500 text-xs mb-0.5">Trial Balance</div>
                        <div className={`font-bold text-lg ${validation.metrics.isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                          {validation.metrics.isBalanced ? 'Balanced' : 'Not Balanced'}
                        </div>
                      </div>
                    </div>
                    {/* Debit/Credit Summary */}
                    <div className="flex gap-2 text-xs">
                      <div className="flex-1 bg-blue-50 p-2 rounded text-center">
                        <div className="text-blue-600">Debits</div>
                        <div className="font-semibold text-blue-800">{formatCurrency(validation.metrics.totalDebits)}</div>
                      </div>
                      <div className="flex-1 bg-purple-50 p-2 rounded text-center">
                        <div className="text-purple-600">Credits</div>
                        <div className="font-semibold text-purple-800">{formatCurrency(validation.metrics.totalCredits)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {selectedPeriod?.status === 'open' && (
                    <div className="flex flex-col gap-2 pt-4 border-t">
                      <Button
                        text="Close Period"
                        type="default"
                        stylingMode="contained"
                        icon="lock"
                        width="100%"
                        disabled={!validation.canClose || closeMutation.isPending}
                        onClick={() => handleClosePeriod(false)}
                      />
                      {!validation.canClose && (
                        <Button
                          text="Force Close (Skip Validation)"
                          type="danger"
                          stylingMode="outlined"
                          width="100%"
                          disabled={closeMutation.isPending}
                          onClick={() => {
                            if (confirm('Force close will skip validation. Are you sure?')) {
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
                        <label className="text-sm font-medium text-gray-700">Reason for Reopening</label>
                        <input
                          type="text"
                          value={reopenReason}
                          onChange={(e) => setReopenReason(e.target.value)}
                          placeholder="Enter reason..."
                          className="border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                        />
                      </div>
                      <Button
                        text="Reopen Period"
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

          {/* Recent Closed Periods */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-500" />
                Recently Closed
              </CardTitle>
              <CardDescription>Last 5 closed periods</CardDescription>
            </CardHeader>
            <CardContent>
              {recentClosedPeriods.length > 0 ? (
                <div className="space-y-2">
                  {recentClosedPeriods.map((period) => (
                    <div
                      key={period.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedPeriodId(period.id)}
                    >
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{period.periodName}</p>
                        <p className="text-xs text-gray-500">{period.fiscalYear?.yearCode}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Closed</p>
                        <p className="text-xs font-medium text-gray-700">{formatDate(period.closedAt!)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <CalendarX className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No closed periods yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Guide */}
      <Card className="bg-gradient-to-br from-slate-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Period Close Guide</CardTitle>
          <CardDescription>Follow these steps for successful period closing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { step: 1, title: 'Post All Entries', desc: 'Ensure all journal entries are posted', icon: FileText },
              { step: 2, title: 'Process Invoices', desc: 'Complete all AP/AR invoices', icon: ClipboardCheck },
              { step: 3, title: 'Balance Check', desc: 'Verify trial balance is balanced', icon: Target },
              { step: 4, title: 'Close Period', desc: 'Lock period to prevent changes', icon: Lock },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-100">
                <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 text-sm">{item.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

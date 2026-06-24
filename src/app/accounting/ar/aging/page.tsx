'use client';

/**
 * AR Aging Report Page
 * Feature: 010-accounting-module-integration
 * Accounts Receivable aging analysis by customer
 */

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import DataGrid, {
  Column,
  Paging,
  SearchPanel,
  Summary,
  TotalItem,
  Toolbar,
  Item as ToolbarItem,
} from 'devextreme-react/data-grid';
import { DateBox } from 'devextreme-react/date-box';
import { Button } from 'devextreme-react/button';
import notify from 'devextreme/ui/notify';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import {
  Clock,
  Users,
  TrendingUp,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingKPICardSkeleton,
  AccountingFilterPanel,
} from '@/components/accounting';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface AgingEntry {
  entityId: number;
  entityName: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  total: number;
}

interface AgingReport {
  reportType: 'AR';
  asOfDate: string;
  entries: AgingEntry[];
  buckets: Array<{
    range: string;
    count: number;
    amount: number;
  }>;
  totals: {
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    over90: number;
    total: number;
  };
}

const AGING_COLORS = {
  current: '#22c55e',
  days1to30: '#84cc16',
  days31to60: '#eab308',
  days61to90: '#f97316',
  over90: '#ef4444',
};

async function fetchAgingReport(asOfDate: string): Promise<AgingReport> {
  const res = await fetch(`/api/accounting/reports/aging?type=AR&asOfDate=${asOfDate}`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch AR aging report');
  }
  const data = await res.json();
  return data.data;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompactCurrency(amount: number): string {
  if (Math.abs(amount) >= 1000000) {
    return `฿${(amount / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1000) {
    return `฿${(amount / 1000).toFixed(0)}K`;
  }
  return formatCurrency(amount);
}

export default function ARAgingPage() {
  const t = useTranslations('accounting');
  const [asOfDate, setAsOfDate] = useState<Date>(new Date());

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ['ar-aging-report', asOfDate.toISOString().split('T')[0]],
    queryFn: () => fetchAgingReport(asOfDate.toISOString().split('T')[0]),
  });

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleExportJSON = useCallback(() => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ar-aging-${asOfDate.toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify(t('accountsReceivable.agingPage.toast.exportSuccess'), 'success', 3000);
  }, [report, asOfDate, t]);

  // Prepare chart data
  const chartData = report?.buckets?.map((bucket, index) => ({
    name: bucket.range,
    amount: bucket.amount,
    count: bucket.count,
    fill: Object.values(AGING_COLORS)[index] || '#6b7280',
  })) || [];

  // Calculate percentages
  const totalAmount = report?.totals?.total || 0;
  const overdueAmount = (report?.totals?.days1to30 || 0) +
                        (report?.totals?.days31to60 || 0) +
                        (report?.totals?.days61to90 || 0) +
                        (report?.totals?.over90 || 0);
  const overduePercentage = totalAmount > 0 ? (overdueAmount / totalAmount * 100).toFixed(1) : '0';
  const criticalAmount = (report?.totals?.days61to90 || 0) + (report?.totals?.over90 || 0);

  return (
    <div className="space-y-6 p-1" data-testid="ar-aging-page">
      {/* Header */}
      <AccountingPageHeader
        title={t('reports.agingReport')}
        subtitle={t('accountsReceivable.description')}
        icon="clock"
        onBack={() => window.location.href = '/accounting/ar'}
        breadcrumbs={[
          { label: t('accountsReceivable.title'), href: '/accounting/ar' },
          { label: t('reports.agingReport') },
        ]}
        onRefresh={handleRefresh}
        actions={
          report && (
            <Button
              text={t('accountsReceivable.agingPage.exportReport')}
              icon="export"
              stylingMode="outlined"
              onClick={handleExportJSON}
            />
          )
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {isLoading ? (
            <>
              <AccountingKPICardSkeleton />
              <AccountingKPICardSkeleton />
              <AccountingKPICardSkeleton />
              <AccountingKPICardSkeleton />
              <AccountingKPICardSkeleton />
              <AccountingKPICardSkeleton />
            </>
          ) : (
            <>
              <AccountingKPICard
                label={t('accountsReceivable.agingPage.buckets.current')}
                value={formatCurrency(report?.totals?.current || 0)}
                subtitle={t('accountsReceivable.agingPage.kpi.currentSubtitle')}
                icon="check-circle"
                variant="success"
              />
              <AccountingKPICard
                label={t('accountsReceivable.agingPage.buckets.days1to30')}
                value={formatCurrency(report?.totals?.days1to30 || 0)}
                subtitle={t('accountsReceivable.agingPage.kpi.days1to30Subtitle')}
                icon="clock"
                variant="default"
              />
              <AccountingKPICard
                label={t('accountsReceivable.agingPage.buckets.days31to60')}
                value={formatCurrency(report?.totals?.days31to60 || 0)}
                subtitle={t('accountsReceivable.agingPage.kpi.days31to60Subtitle')}
                icon="clock"
                variant="warning"
              />
              <AccountingKPICard
                label={t('accountsReceivable.agingPage.buckets.days61to90')}
                value={formatCurrency(report?.totals?.days61to90 || 0)}
                subtitle={t('accountsReceivable.agingPage.kpi.days61to90Subtitle')}
                icon="trending-up"
                variant="warning"
              />
              <AccountingKPICard
                label={t('accountsReceivable.agingPage.buckets.over90')}
                value={formatCurrency(report?.totals?.over90 || 0)}
                subtitle={t('accountsReceivable.agingPage.kpi.over90Subtitle')}
                icon="trending-up"
                variant="danger"
              />
              <AccountingKPICard
                label={t('accountsReceivable.agingPage.kpi.totalReceivable')}
                value={formatCurrency(totalAmount)}
                subtitle={t('accountsReceivable.agingPage.kpi.overduePercent', { percent: overduePercentage })}
                icon="wallet"
                variant="info"
              />
            </>
          )}
        </div>

        {/* Filter */}
        <AccountingFilterPanel>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t('accountsReceivable.agingPage.asOfDate')}
            </label>
            <DateBox
              value={asOfDate}
              onValueChanged={(e) => setAsOfDate(e.value)}
              type="date"
              displayFormat="dd/MM/yyyy"
              width={180}
            />
          </div>
          <div className="flex gap-2 items-end">
            <Button
              text={t('accountsReceivable.agingPage.generateReport')}
              type="default"
              stylingMode="contained"
              onClick={() => refetch()}
            />
          </div>
        </AccountingFilterPanel>

        {/* Alert for Critical Aging */}
        {criticalAmount > 0 && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-red-800">{t('accountsReceivable.agingPage.criticalAlert.title')}</h3>
                <p className="text-sm text-red-600 mt-1">
                  {t('accountsReceivable.agingPage.criticalAlert.message', { amount: formatCurrency(criticalAmount) })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Chart and Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                {t('accountsReceivable.agingPage.distributionTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="animate-pulse text-gray-400">{t('accountsReceivable.agingPage.loadingChart')}</div>
                </div>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => formatCompactCurrency(value)}
                      />
                      <Tooltip
                        formatter={(value) => formatCurrency(value as number)}
                        labelStyle={{ fontWeight: 600 }}
                      />
                      <Legend />
                      <Bar dataKey="amount" name={t('accountsReceivable.agingPage.amountLegend')} radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                {t('accountsReceivable.agingPage.summaryTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Current */}
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="font-medium text-gray-700">{t('accountsReceivable.agingPage.buckets.current')}</span>
                  </div>
                  <span className="font-semibold text-green-700">
                    {formatCurrency(report?.totals?.current || 0)}
                  </span>
                </div>

                {/* 1-30 Days */}
                <div className="flex items-center justify-between p-3 bg-lime-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-lime-500"></div>
                    <span className="font-medium text-gray-700">{t('accountsReceivable.agingPage.buckets.days1to30')}</span>
                  </div>
                  <span className="font-semibold text-lime-700">
                    {formatCurrency(report?.totals?.days1to30 || 0)}
                  </span>
                </div>

                {/* 31-60 Days */}
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <span className="font-medium text-gray-700">{t('accountsReceivable.agingPage.buckets.days31to60')}</span>
                  </div>
                  <span className="font-semibold text-yellow-700">
                    {formatCurrency(report?.totals?.days31to60 || 0)}
                  </span>
                </div>

                {/* 61-90 Days */}
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    <span className="font-medium text-gray-700">{t('accountsReceivable.agingPage.buckets.days61to90')}</span>
                  </div>
                  <span className="font-semibold text-orange-700">
                    {formatCurrency(report?.totals?.days61to90 || 0)}
                  </span>
                </div>

                {/* Over 90 Days */}
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="font-medium text-gray-700">{t('accountsReceivable.agingPage.buckets.over90')}</span>
                  </div>
                  <span className="font-semibold text-red-700">
                    {formatCurrency(report?.totals?.over90 || 0)}
                  </span>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg border-t-2 border-gray-300">
                  <span className="font-bold text-gray-800">{t('accountsReceivable.agingPage.totalOutstanding')}</span>
                  <span className="font-bold text-lg text-gray-900">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Grid by Customer */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-green-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('accountsReceivable.agingPage.grid.title')}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('accountsReceivable.agingPage.grid.asOf', { date: asOfDate.toLocaleDateString('th-TH') })}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4" data-testid="ar-aging-grid">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-green-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">{t('accountsReceivable.agingPage.grid.loading')}</p>
              </div>
            ) : (
              <DataGrid
                dataSource={report?.entries || []}
                keyExpr="entityId"
                showBorders={false}
                showRowLines
                showColumnLines={false}
                rowAlternationEnabled
                allowColumnReordering
                allowColumnResizing
                columnAutoWidth
                hoverStateEnabled
              >
                <Paging defaultPageSize={20} />
                <SearchPanel visible placeholder={t('accountsReceivable.agingPage.grid.searchPlaceholder')} />

                <Toolbar>
                  <ToolbarItem name="searchPanel" location="before" />
                </Toolbar>

                <Column dataField="entityName" caption={t('accountsReceivable.agingPage.columns.customer')} minWidth={200} />
                <Column
                  dataField="current"
                  caption={t('accountsReceivable.agingPage.buckets.current')}
                  dataType="number"
                  format="#,##0.00"
                  width={130}
                  alignment="right"
                  cssClass="text-green-600"
                />
                <Column
                  dataField="days1to30"
                  caption={t('accountsReceivable.agingPage.buckets.days1to30')}
                  dataType="number"
                  format="#,##0.00"
                  width={130}
                  alignment="right"
                />
                <Column
                  dataField="days31to60"
                  caption={t('accountsReceivable.agingPage.buckets.days31to60')}
                  dataType="number"
                  format="#,##0.00"
                  width={130}
                  alignment="right"
                  cssClass="text-yellow-600"
                />
                <Column
                  dataField="days61to90"
                  caption={t('accountsReceivable.agingPage.buckets.days61to90')}
                  dataType="number"
                  format="#,##0.00"
                  width={130}
                  alignment="right"
                  cssClass="text-orange-600"
                />
                <Column
                  dataField="over90"
                  caption={t('accountsReceivable.agingPage.buckets.over90')}
                  dataType="number"
                  format="#,##0.00"
                  width={130}
                  alignment="right"
                  cssClass="text-red-600"
                />
                <Column
                  dataField="total"
                  caption={t('accountsReceivable.agingPage.columns.total')}
                  dataType="number"
                  format="#,##0.00"
                  width={140}
                  alignment="right"
                  cssClass="font-semibold"
                />

                <Summary>
                  <TotalItem column="current" summaryType="sum" valueFormat="#,##0.00" displayFormat={t('accountsReceivable.agingPage.summaryTotal')} />
                  <TotalItem column="days1to30" summaryType="sum" valueFormat="#,##0.00" displayFormat={t('accountsReceivable.agingPage.summaryTotal')} />
                  <TotalItem column="days31to60" summaryType="sum" valueFormat="#,##0.00" displayFormat={t('accountsReceivable.agingPage.summaryTotal')} />
                  <TotalItem column="days61to90" summaryType="sum" valueFormat="#,##0.00" displayFormat={t('accountsReceivable.agingPage.summaryTotal')} />
                  <TotalItem column="over90" summaryType="sum" valueFormat="#,##0.00" displayFormat={t('accountsReceivable.agingPage.summaryTotal')} />
                  <TotalItem column="total" summaryType="sum" valueFormat="#,##0.00" displayFormat={t('accountsReceivable.agingPage.summaryTotal')} />
                </Summary>
              </DataGrid>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

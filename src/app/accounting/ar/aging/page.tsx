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
  Export,
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
    notify('AR aging report exported successfully', 'success', 3000);
  }, [report, asOfDate]);

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
          { label: 'Accounts Receivable', href: '/accounting/ar' },
          { label: t('reports.agingReport') },
        ]}
        onRefresh={handleRefresh}
        actions={
          report && (
            <Button
              text="Export Report"
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
                label="Current"
                value={formatCurrency(report?.totals?.current || 0)}
                subtitle="Not yet due"
                icon="check-circle"
                variant="success"
              />
              <AccountingKPICard
                label="1-30 Days"
                value={formatCurrency(report?.totals?.days1to30 || 0)}
                subtitle="Slightly overdue"
                icon="clock"
                variant="default"
              />
              <AccountingKPICard
                label="31-60 Days"
                value={formatCurrency(report?.totals?.days31to60 || 0)}
                subtitle="Follow up needed"
                icon="clock"
                variant="warning"
              />
              <AccountingKPICard
                label="61-90 Days"
                value={formatCurrency(report?.totals?.days61to90 || 0)}
                subtitle="Attention required"
                icon="trending-up"
                variant="warning"
              />
              <AccountingKPICard
                label="Over 90 Days"
                value={formatCurrency(report?.totals?.over90 || 0)}
                subtitle="Critical"
                icon="trending-up"
                variant="danger"
              />
              <AccountingKPICard
                label="Total AR"
                value={formatCurrency(totalAmount)}
                subtitle={`${overduePercentage}% overdue`}
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
              As of Date
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
              text="Generate Report"
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
                <h3 className="font-semibold text-red-800">Critical Aging Alert</h3>
                <p className="text-sm text-red-600 mt-1">
                  {formatCurrency(criticalAmount)} is over 60 days past due. Immediate collection action recommended.
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
                Aging Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="animate-pulse text-gray-400">Loading chart...</div>
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
                      <Bar dataKey="amount" name="Amount" radius={[4, 4, 0, 0]}>
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
                Aging Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Current */}
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="font-medium text-gray-700">Current</span>
                  </div>
                  <span className="font-semibold text-green-700">
                    {formatCurrency(report?.totals?.current || 0)}
                  </span>
                </div>

                {/* 1-30 Days */}
                <div className="flex items-center justify-between p-3 bg-lime-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-lime-500"></div>
                    <span className="font-medium text-gray-700">1-30 Days</span>
                  </div>
                  <span className="font-semibold text-lime-700">
                    {formatCurrency(report?.totals?.days1to30 || 0)}
                  </span>
                </div>

                {/* 31-60 Days */}
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <span className="font-medium text-gray-700">31-60 Days</span>
                  </div>
                  <span className="font-semibold text-yellow-700">
                    {formatCurrency(report?.totals?.days31to60 || 0)}
                  </span>
                </div>

                {/* 61-90 Days */}
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    <span className="font-medium text-gray-700">61-90 Days</span>
                  </div>
                  <span className="font-semibold text-orange-700">
                    {formatCurrency(report?.totals?.days61to90 || 0)}
                  </span>
                </div>

                {/* Over 90 Days */}
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="font-medium text-gray-700">Over 90 Days</span>
                  </div>
                  <span className="font-semibold text-red-700">
                    {formatCurrency(report?.totals?.over90 || 0)}
                  </span>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg border-t-2 border-gray-300">
                  <span className="font-bold text-gray-800">Total Outstanding</span>
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
                  AR Aging by Customer
                </h3>
                <p className="text-sm text-gray-600">
                  As of {asOfDate.toLocaleDateString('th-TH')}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4" data-testid="ar-aging-grid">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-green-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading aging data...</p>
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
                <SearchPanel visible placeholder="Search customers..." />
                <Export enabled allowExportSelectedData />

                <Toolbar>
                  <ToolbarItem name="searchPanel" location="before" />
                  <ToolbarItem name="exportButton" location="after" />
                </Toolbar>

                <Column dataField="entityName" caption="Customer" minWidth={200} />
                <Column
                  dataField="current"
                  caption="Current"
                  dataType="number"
                  format="#,##0.00"
                  width={130}
                  alignment="right"
                  cssClass="text-green-600"
                />
                <Column
                  dataField="days1to30"
                  caption="1-30 Days"
                  dataType="number"
                  format="#,##0.00"
                  width={130}
                  alignment="right"
                />
                <Column
                  dataField="days31to60"
                  caption="31-60 Days"
                  dataType="number"
                  format="#,##0.00"
                  width={130}
                  alignment="right"
                  cssClass="text-yellow-600"
                />
                <Column
                  dataField="days61to90"
                  caption="61-90 Days"
                  dataType="number"
                  format="#,##0.00"
                  width={130}
                  alignment="right"
                  cssClass="text-orange-600"
                />
                <Column
                  dataField="over90"
                  caption="Over 90"
                  dataType="number"
                  format="#,##0.00"
                  width={130}
                  alignment="right"
                  cssClass="text-red-600"
                />
                <Column
                  dataField="total"
                  caption="Total"
                  dataType="number"
                  format="#,##0.00"
                  width={140}
                  alignment="right"
                  cssClass="font-semibold"
                />

                <Summary>
                  <TotalItem column="current" summaryType="sum" valueFormat="#,##0.00" displayFormat="Total: {0}" />
                  <TotalItem column="days1to30" summaryType="sum" valueFormat="#,##0.00" displayFormat="Total: {0}" />
                  <TotalItem column="days31to60" summaryType="sum" valueFormat="#,##0.00" displayFormat="Total: {0}" />
                  <TotalItem column="days61to90" summaryType="sum" valueFormat="#,##0.00" displayFormat="Total: {0}" />
                  <TotalItem column="over90" summaryType="sum" valueFormat="#,##0.00" displayFormat="Total: {0}" />
                  <TotalItem column="total" summaryType="sum" valueFormat="#,##0.00" displayFormat="Total: {0}" />
                </Summary>
              </DataGrid>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

/**
 * Complaints Dashboard Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Professional dashboard for viewing and managing customer complaints.
 * Redesigned with DevExtreme UI components.
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ComplaintList, ComplaintDataEntryDialog } from '@/components/complaints';
import { DxButton } from '@/components/ui/dx-button';
import { DxTabs } from '@/components/ui/dx-tabs';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
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
import {
  MessageSquareWarning,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  BarChart3,
  Package,
  Calendar,
  Activity,
  FileWarning,
  Search,
} from 'lucide-react';
import type {
  Complaint,
  ComplaintStatus,
  ComplaintCategory,
  ComplaintSeverity,
  ComplaintTrends,
} from '@/types/complaints';

// ============================================
// Types
// ============================================

interface ComplaintDashboard {
  totalOpen: number;
  byStatus: Record<ComplaintStatus, number>;
  bySeverity: Record<ComplaintSeverity, number>;
  pendingInvestigation: number;
  resolvedThisMonth: number;
  criticalCount: number;
}

// ============================================
// Constants
// ============================================

const STATUS_COLORS: Record<ComplaintStatus, string> = {
  received: '#3b82f6',
  under_investigation: '#f59e0b',
  resolved: '#22c55e',
  closed: '#6b7280',
};

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  received: 'Received',
  under_investigation: 'Investigating',
  resolved: 'Resolved',
  closed: 'Closed',
};

const SEVERITY_COLORS: Record<ComplaintSeverity, string> = {
  minor: '#22c55e',
  major: '#f59e0b',
  critical: '#ef4444',
};

const CATEGORY_COLORS: Record<ComplaintCategory, string> = {
  quality: '#3b82f6',
  efficacy: '#22c55e',
  safety: '#ef4444',
  packaging: '#f59e0b',
  labeling: '#8b5cf6',
  other: '#6b7280',
};

const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  quality: 'Quality',
  efficacy: 'Efficacy',
  safety: 'Safety',
  packaging: 'Packaging',
  labeling: 'Labeling',
  other: 'Other',
};

// ============================================
// API Functions
// ============================================

async function fetchDashboard(): Promise<ComplaintDashboard> {
  const response = await fetch('/api/complaints/dashboard');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch dashboard');
  }
  return result.data;
}

async function fetchTrends(): Promise<ComplaintTrends> {
  const response = await fetch('/api/complaints/trends?period=month');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch trends');
  }
  return result.data;
}

// ============================================
// Component
// ============================================

export default function ComplaintsListPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | undefined>(undefined);
  const [showNewDialog, setShowNewDialog] = useState(false);

  // Fetch dashboard statistics
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['complaints-dashboard'],
    queryFn: fetchDashboard,
  });

  // Fetch trends
  const { data: trends } = useQuery({
    queryKey: ['complaint-trends', 'month'],
    queryFn: fetchTrends,
  });

  // Status tabs
  const statusTabs = [
    { id: 0, text: 'All', icon: 'selectall' },
    { id: 1, text: 'Received', icon: 'inbox' },
    { id: 2, text: 'Investigating', icon: 'find' },
    { id: 3, text: 'Resolved', icon: 'check' },
    { id: 4, text: 'Closed', icon: 'close' },
  ];

  const handleTabChange = (index: number) => {
    const statusMap: (ComplaintStatus | undefined)[] = [
      undefined,
      'received',
      'under_investigation',
      'resolved',
      'closed',
    ];
    setStatusFilter(statusMap[index]);
  };

  // Prepare chart data
  const severityChartData = useMemo(() => {
    if (!dashboard?.bySeverity) return [];
    return Object.entries(dashboard.bySeverity)
      .filter(([, count]) => count > 0)
      .map(([severity, count]) => ({
        severity,
        label: severity.charAt(0).toUpperCase() + severity.slice(1),
        value: count,
        color: SEVERITY_COLORS[severity as ComplaintSeverity],
      }));
  }, [dashboard]);

  const statusChartData = useMemo(() => {
    if (!dashboard?.byStatus) return [];
    return Object.entries(dashboard.byStatus)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        status,
        label: STATUS_LABELS[status as ComplaintStatus],
        value: count,
        color: STATUS_COLORS[status as ComplaintStatus],
      }));
  }, [dashboard]);

  const categoryChartData = useMemo(() => {
    if (!trends?.byCategory) return [];
    return Object.entries(trends.byCategory)
      .filter(([, count]) => count > 0)
      .map(([category, count]) => ({
        category,
        label: CATEGORY_LABELS[category as ComplaintCategory],
        value: count,
        color: CATEGORY_COLORS[category as ComplaintCategory],
      }));
  }, [trends]);

  const timelineChartData = useMemo(() => {
    if (!trends?.dataPoints) return [];
    return trends.dataPoints.map((dp) => ({
      period: dp.label,
      count: dp.count,
    }));
  }, [trends]);

  // Handlers
  const handleComplaintSelect = (complaint: Complaint) => {
    router.push(`/gmp/complaints/${complaint.id}`);
  };

  const handleNewComplaint = () => {
    setShowNewDialog(true);
  };

  const handleComplaintSaved = (complaint: Complaint) => {
    setShowNewDialog(false);
    router.push(`/gmp/complaints/${complaint.id}`);
  };

  // Calculate totals
  const totalAll = dashboard
    ? Object.values(dashboard.byStatus).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1800px] mx-auto">
      {/* Page Header */}
      <ResponsivePageHeader
        title="Customer Complaints"
        subtitle="Complaint Management System (GMP หมวด 9)"
        icon={MessageSquareWarning}
        iconBgColor="bg-orange-100"
        iconColor="text-orange-600"
        breadcrumbs={[
          { label: 'GMP', href: '/gmp' },
          { label: 'Complaints' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <DxButton
              icon="refresh"
              type="default"
              stylingMode="outlined"
              hint="Refresh"
              onClick={() => window.location.reload()}
            />
            <DxButton
              icon="plus"
              text="New Complaint"
              type="success"
              onClick={handleNewComplaint}
            />
          </div>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <StatCard
          label="Total Open"
          value={dashboard?.totalOpen ?? 0}
          icon={MessageSquareWarning}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Received"
          value={dashboard?.byStatus?.received ?? 0}
          icon={Clock}
          iconColor="text-sky-500"
          accentColor="border-sky-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Investigating"
          value={dashboard?.pendingInvestigation ?? 0}
          icon={Search}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Critical"
          value={dashboard?.criticalCount ?? 0}
          icon={AlertTriangle}
          iconColor="text-red-500"
          accentColor="border-red-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Resolved"
          value={dashboard?.byStatus?.resolved ?? 0}
          icon={CheckCircle}
          iconColor="text-green-500"
          accentColor="border-green-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="This Month"
          value={dashboard?.resolvedThisMonth ?? 0}
          icon={Calendar}
          iconColor="text-indigo-500"
          accentColor="border-indigo-500"
          isLoading={dashboardLoading}
          trend={dashboard?.resolvedThisMonth ? { direction: 'up', value: 'resolved' } : undefined}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Severity Pie Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              By Severity
            </h3>
          </div>
          {severityChartData.length > 0 ? (
            <PieChart
              id="severity-pie"
              dataSource={severityChartData}
              type="doughnut"
              innerRadius={0.65}
              palette={severityChartData.map((d) => d.color)}
              size={{ height: 200 }}
            >
              <Series argumentField="label" valueField="value">
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
                <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No data</p>
              </div>
            </div>
          )}
        </div>

        {/* Status Pie Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              By Status
            </h3>
          </div>
          {statusChartData.length > 0 ? (
            <PieChart
              id="status-pie"
              dataSource={statusChartData}
              type="doughnut"
              innerRadius={0.65}
              palette={statusChartData.map((d) => d.color)}
              size={{ height: 200 }}
            >
              <Series argumentField="label" valueField="value">
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
                <Activity className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No data</p>
              </div>
            </div>
          )}
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-purple-500" />
              By Category
            </h3>
          </div>
          {categoryChartData.length > 0 ? (
            <PieChart
              id="category-pie"
              dataSource={categoryChartData}
              type="doughnut"
              innerRadius={0.65}
              palette={categoryChartData.map((d) => d.color)}
              size={{ height: 200 }}
            >
              <Series argumentField="label" valueField="value">
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
                <FileWarning className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No data</p>
              </div>
            </div>
          )}
        </div>

        {/* Summary Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Quick Summary
            </h3>
          </div>
          <div className="space-y-3">
            {/* Total Complaints */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <MessageSquareWarning className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Complaints</p>
                  <p className="text-sm font-medium text-gray-900">All Records</p>
                </div>
              </div>
              <span className="text-xl font-bold text-blue-600">{totalAll}</span>
            </div>

            {/* Minor */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Minor Severity</p>
                  <p className="text-sm font-medium text-gray-900">Low Risk</p>
                </div>
              </div>
              <span className="text-xl font-bold text-green-600">
                {dashboard?.bySeverity?.minor ?? 0}
              </span>
            </div>

            {/* Major */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Major Severity</p>
                  <p className="text-sm font-medium text-gray-900">Medium Risk</p>
                </div>
              </div>
              <span className="text-xl font-bold text-amber-600">
                {dashboard?.bySeverity?.major ?? 0}
              </span>
            </div>

            {/* Critical */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-red-50 to-rose-50 rounded-lg border border-red-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Critical Severity</p>
                  <p className="text-sm font-medium text-gray-900">High Risk</p>
                </div>
              </div>
              <span className="text-xl font-bold text-red-600">
                {dashboard?.bySeverity?.critical ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Chart */}
      {timelineChartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              Monthly Trend
            </h3>
            <span className="text-sm text-gray-500">{trends?.period}</span>
          </div>
          <Chart
            id="timeline-chart"
            dataSource={timelineChartData}
            size={{ height: 180 }}
          >
            <CommonSeriesSettings argumentField="period" type="bar" color="#6366f1" />
            <ChartSeries valueField="count" name="Complaints" color="#6366f1" />
            <ArgumentAxis>
              <ChartLabel overlappingBehavior="rotate" rotationAngle={-45} />
            </ArgumentAxis>
            <ValueAxis />
            <ChartLegend visible={false} />
            <ChartTooltip
              enabled={true}
              customizeTooltip={(arg: { argumentText?: string; valueText?: string }) => ({
                text: `${arg.argumentText}: ${arg.valueText} complaints`,
              })}
            />
          </Chart>
        </div>
      )}

      {/* Main Content - Tabs + DataGrid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tabs Header */}
        <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <DxTabs
              items={statusTabs}
              selectedIndex={
                statusFilter === undefined
                  ? 0
                  : statusFilter === 'received'
                  ? 1
                  : statusFilter === 'under_investigation'
                  ? 2
                  : statusFilter === 'resolved'
                  ? 3
                  : 4
              }
              onSelectedIndexChange={handleTabChange}
              stylingMode="secondary"
            />
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <MessageSquareWarning className="w-4 h-4" />
                {totalAll} complaints
              </span>
            </div>
          </div>
        </div>

        {/* Complaint List */}
        <ComplaintList
          status={statusFilter}
          onComplaintSelect={handleComplaintSelect}
          onNewComplaint={handleNewComplaint}
        />
      </div>

      {/* Top Products with Complaints */}
      {trends?.byProduct && trends.byProduct.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-500" />
              Products with Most Complaints
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {trends.byProduct.slice(0, 5).map((product, index) => (
              <div
                key={product.productId}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    index === 0
                      ? 'bg-red-500'
                      : index === 1
                      ? 'bg-orange-500'
                      : index === 2
                      ? 'bg-amber-500'
                      : 'bg-gray-400'
                  }`}
                >
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {product.productName}
                  </p>
                  <p className="text-xs text-gray-500">{product.count} complaints</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Complaint Dialog */}
      <ComplaintDataEntryDialog
        visible={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        onSaved={handleComplaintSaved}
        mode="create"
      />
    </div>
  );
}

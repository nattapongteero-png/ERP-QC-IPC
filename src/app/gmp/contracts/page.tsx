'use client';

/**
 * Manufacturing Contracts Dashboard Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8)
 *
 * Professional dashboard for managing manufacturing contracts and quality agreements.
 * Redesigned with DevExtreme UI components.
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ContractList, ContractDataEntryDialog } from '@/components/contracts';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxTabs } from '@/components/ui/dx-tabs';
import type { DxTabItem } from '@/components/ui/dx-tabs';
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
  Briefcase,
  AlertTriangle,
  CheckCircle,
  Calendar,
  XCircle,
  Building2,
  FlaskConical,
  Package,
  TrendingUp,
  BarChart3,
  ClipboardCheck,
  FileWarning,
} from 'lucide-react';
import type {
  ManufacturingContract,
  ContractDashboard,
  ContractListResponse,
  ContractStatus,
} from '@/types/contracts';

// ============================================
// Constants
// ============================================

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  expired: '#ef4444',
  terminated: '#6b7280',
  pending: '#f59e0b',
};

const TYPE_COLORS: Record<string, string> = {
  manufacturer: '#3b82f6',
  laboratory: '#8b5cf6',
  both: '#14b8a6',
};

const TYPE_LABELS: Record<string, string> = {
  manufacturer: 'Manufacturer',
  laboratory: 'Laboratory',
  both: 'Both',
};

// ============================================
// API Functions
// ============================================

async function fetchDashboard(): Promise<ContractDashboard> {
  const response = await fetch('/api/contracts/dashboard');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function fetchContracts(status?: ContractStatus): Promise<ContractListResponse> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('limit', '50');

  const response = await fetch(`/api/contracts?${params}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

// ============================================
// Component
// ============================================

export default function ContractsDashboardPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<ContractStatus | undefined>(undefined);
  const [showNewDialog, setShowNewDialog] = useState(false);

  // Fetch dashboard data
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['contracts-dashboard'],
    queryFn: fetchDashboard,
  });

  // Fetch contracts with filter
  const { data: contractsData, isLoading: contractsLoading } = useQuery({
    queryKey: ['contracts', statusFilter],
    queryFn: () => fetchContracts(statusFilter),
  });

  // Status tabs
  const statusTabs: DxTabItem[] = [
    { id: 0, text: 'All Contracts', icon: 'selectall' },
    { id: 1, text: 'Active', icon: 'check' },
    { id: 2, text: 'Expired', icon: 'close' },
    { id: 3, text: 'Pending', icon: 'clock' },
  ];

  const handleTabChange = (index: number) => {
    const statusMap: (ContractStatus | undefined)[] = [
      undefined,
      'active',
      'expired',
      'pending',
    ];
    setStatusFilter(statusMap[index]);
  };

  // Prepare chart data
  const statusChartData = useMemo(() => {
    if (!dashboard?.activeContracts && !dashboard?.expiredContracts) return [];
    const data = [];
    if (dashboard.activeContracts > 0) {
      data.push({ label: 'Active', value: dashboard.activeContracts, color: STATUS_COLORS.active });
    }
    if (dashboard.expiredContracts > 0) {
      data.push({ label: 'Expired', value: dashboard.expiredContracts, color: STATUS_COLORS.expired });
    }
    if (dashboard.terminatedContracts > 0) {
      data.push({ label: 'Terminated', value: dashboard.terminatedContracts, color: STATUS_COLORS.terminated });
    }
    if (dashboard.pendingContracts > 0) {
      data.push({ label: 'Pending', value: dashboard.pendingContracts, color: STATUS_COLORS.pending });
    }
    return data;
  }, [dashboard]);

  const typeChartData = useMemo(() => {
    if (!dashboard?.byContractorType) return [];
    return Object.entries(dashboard.byContractorType)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => ({
        type,
        label: TYPE_LABELS[type] || type,
        value: count,
        color: TYPE_COLORS[type] || '#6b7280',
      }));
  }, [dashboard]);

  const activityChartData = useMemo(() => {
    if (!dashboard?.recentActivity) return [];
    return dashboard.recentActivity.map((item) => ({
      period: item.date,
      count: item.count,
    }));
  }, [dashboard]);

  // Handlers
  const handleContractSelect = (contract: ManufacturingContract) => {
    router.push(`/gmp/contracts/${contract.id}`);
  };

  const handleNewContract = () => {
    setShowNewDialog(true);
  };

  const handleContractSaved = (contract: ManufacturingContract) => {
    setShowNewDialog(false);
    router.push(`/gmp/contracts/${contract.id}`);
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1800px] mx-auto">
      {/* Page Header */}
      <ResponsivePageHeader
        title="Manufacturing Contracts"
        subtitle="GMP หมวด 8 - Contract Manufacturing & Laboratory Services"
        icon={Briefcase}
        iconBgColor="bg-indigo-100"
        iconColor="text-indigo-600"
        breadcrumbs={[
          { label: 'GMP', href: '/gmp' },
          { label: 'Contracts' },
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
              text="New Contract"
              type="success"
              onClick={handleNewContract}
            />
          </div>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <StatCard
          label="Total Contracts"
          value={dashboard?.totalContracts ?? 0}
          icon={Briefcase}
          iconColor="text-indigo-500"
          accentColor="border-indigo-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Active"
          value={dashboard?.activeContracts ?? 0}
          icon={CheckCircle}
          iconColor="text-green-500"
          accentColor="border-green-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Expiring Soon"
          value={dashboard?.expiringSoon ?? 0}
          icon={Calendar}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Audits Overdue"
          value={dashboard?.auditsOverdue ?? 0}
          icon={AlertTriangle}
          iconColor="text-red-500"
          accentColor="border-red-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="Total Batches"
          value={dashboard?.totalBatches ?? 0}
          icon={Package}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={dashboardLoading}
        />
        <StatCard
          label="This Month"
          value={dashboard?.batchesThisMonth ?? 0}
          icon={TrendingUp}
          iconColor="text-teal-500"
          accentColor="border-teal-500"
          isLoading={dashboardLoading}
          trend={dashboard?.batchesThisMonth ? { direction: 'up', value: 'batches' } : undefined}
        />
      </div>

      {/* Alerts Section */}
      {((dashboard?.expiringContracts?.length ?? 0) > 0 || (dashboard?.overdueAudits?.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Expiring Contracts */}
          {dashboard?.expiringContracts && dashboard.expiringContracts.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-500" />
                  Expiring Soon (90 days)
                  <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                    {dashboard.expiringContracts.length}
                  </span>
                </h3>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {dashboard.expiringContracts.slice(0, 5).map((contract) => (
                  <div
                    key={contract.id}
                    className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100 cursor-pointer hover:bg-amber-100 transition-colors"
                    onClick={() => router.push(`/gmp/contracts/${contract.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {contract.contractorName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {contract.contractNumber}
                      </p>
                    </div>
                    <span className="ml-3 px-2 py-1 bg-amber-200 text-amber-800 text-xs font-medium rounded">
                      {contract.daysUntilExpiry}d
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overdue Audits */}
          {dashboard?.overdueAudits && dashboard.overdueAudits.length > 0 && (
            <div className="bg-white rounded-xl border border-red-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-red-500" />
                  Overdue Audits
                  <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                    {dashboard.overdueAudits.length}
                  </span>
                </h3>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {dashboard.overdueAudits.slice(0, 5).map((contract) => (
                  <div
                    key={contract.id}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100 cursor-pointer hover:bg-red-100 transition-colors"
                    onClick={() => router.push(`/gmp/contracts/${contract.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {contract.contractorName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        Due: {contract.nextAuditDue}
                      </p>
                    </div>
                    <span className="ml-3 px-2 py-1 bg-red-200 text-red-800 text-xs font-medium rounded">
                      Overdue
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Status Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-blue-500" />
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
                <FileWarning className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No contracts</p>
              </div>
            </div>
          )}
        </div>

        {/* Contractor Type Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-500" />
              By Type
            </h3>
          </div>
          {typeChartData.length > 0 ? (
            <PieChart
              id="type-pie"
              dataSource={typeChartData}
              type="doughnut"
              innerRadius={0.65}
              palette={typeChartData.map((d) => d.color)}
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
                <Building2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No data</p>
              </div>
            </div>
          )}
        </div>

        {/* Contractor Types Summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Active by Type
            </h3>
          </div>
          <div className="space-y-3">
            {/* Manufacturer */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Manufacturers</p>
                  <p className="text-sm font-medium text-gray-900">Production</p>
                </div>
              </div>
              <span className="text-xl font-bold text-blue-600">
                {dashboard?.byContractorType?.manufacturer ?? 0}
              </span>
            </div>

            {/* Laboratory */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg border border-purple-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FlaskConical className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Laboratories</p>
                  <p className="text-sm font-medium text-gray-900">Testing</p>
                </div>
              </div>
              <span className="text-xl font-bold text-purple-600">
                {dashboard?.byContractorType?.laboratory ?? 0}
              </span>
            </div>

            {/* Both */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg border border-teal-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-100 rounded-lg">
                  <Package className="h-4 w-4 text-teal-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Both Services</p>
                  <p className="text-sm font-medium text-gray-900">Full Service</p>
                </div>
              </div>
              <span className="text-xl font-bold text-teal-600">
                {dashboard?.byContractorType?.both ?? 0}
              </span>
            </div>

            {/* Expired Summary */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-red-50 to-rose-50 rounded-lg border border-red-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Expired</p>
                  <p className="text-sm font-medium text-gray-900">Needs Renewal</p>
                </div>
              </div>
              <span className="text-xl font-bold text-red-600">
                {dashboard?.expiredContracts ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-500" />
              Activity Summary
            </h3>
          </div>
          <div className="space-y-3">
            {/* Total Batches */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Package className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Batches</p>
                  <p className="text-sm font-medium text-gray-900">All Time</p>
                </div>
              </div>
              <span className="text-xl font-bold text-indigo-600">
                {dashboard?.totalBatches ?? 0}
              </span>
            </div>

            {/* Manufacturing */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Manufacturing</p>
                  <p className="text-sm font-medium text-gray-900">Production</p>
                </div>
              </div>
              <span className="text-xl font-bold text-blue-600">
                {dashboard?.byActivityType?.manufacturing ?? 0}
              </span>
            </div>

            {/* Testing */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg border border-purple-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FlaskConical className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Testing</p>
                  <p className="text-sm font-medium text-gray-900">QC/QA</p>
                </div>
              </div>
              <span className="text-xl font-bold text-purple-600">
                {dashboard?.byActivityType?.testing ?? 0}
              </span>
            </div>

            {/* Packaging */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Package className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Packaging</p>
                  <p className="text-sm font-medium text-gray-900">Pack Out</p>
                </div>
              </div>
              <span className="text-xl font-bold text-amber-600">
                {dashboard?.byActivityType?.packaging ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Timeline Chart */}
      {activityChartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              Contract Activity (Last 6 Months)
            </h3>
          </div>
          <Chart
            id="activity-chart"
            dataSource={activityChartData}
            size={{ height: 180 }}
          >
            <CommonSeriesSettings argumentField="period" type="bar" color="#6366f1" />
            <ChartSeries valueField="count" name="Batches Processed" color="#6366f1" />
            <ArgumentAxis>
              <ChartLabel overlappingBehavior="rotate" rotationAngle={-45} />
            </ArgumentAxis>
            <ValueAxis />
            <ChartLegend visible={false} />
            <ChartTooltip
              enabled={true}
              customizeTooltip={(arg: { argumentText?: string; valueText?: string }) => ({
                text: `${arg.argumentText}: ${arg.valueText} batches`,
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
                  : statusFilter === 'active'
                  ? 1
                  : statusFilter === 'expired'
                  ? 2
                  : 3
              }
              onSelectedIndexChange={handleTabChange}
              stylingMode="secondary"
            />
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Briefcase className="w-4 h-4" />
                {contractsData?.total ?? 0} contracts
              </span>
            </div>
          </div>
        </div>

        {/* Contracts List */}
        <div className="p-4">
          <ContractList
            contracts={contractsData?.contracts || []}
            loading={contractsLoading}
            onContractSelect={handleContractSelect}
          />
        </div>
      </div>

      {/* Top Contractors */}
      {dashboard?.topContractors && dashboard.topContractors.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-500" />
              Top Contractors by Activity
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {dashboard.topContractors.slice(0, 5).map((contractor, index) => (
              <div
                key={contractor.contractId}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => router.push(`/gmp/contracts/${contractor.contractId}`)}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    index === 0
                      ? 'bg-indigo-500'
                      : index === 1
                      ? 'bg-blue-500'
                      : index === 2
                      ? 'bg-purple-500'
                      : 'bg-gray-400'
                  }`}
                >
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {contractor.contractorName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {contractor.batchCount} batches
                    <span className={`ml-2 ${contractor.status === 'active' ? 'text-green-600' : 'text-gray-400'}`}>
                      ({contractor.status})
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Contract Dialog */}
      <ContractDataEntryDialog
        visible={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        onSaved={handleContractSaved}
        mode="create"
      />
    </div>
  );
}

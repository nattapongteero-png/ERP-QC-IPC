'use client';

/**
 * CAPA Management Dashboard
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * Professional dashboard for viewing and managing CAPAs with:
 * - KPI cards with trends
 * - Status and Priority distribution charts
 * - Risk matrix visualization
 * - Tabbed data views
 * - Enhanced data grid with advanced filtering
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Selection,
  Sorting,
  ColumnChooser,
  Export,
  Toolbar,
  Item,
  LoadPanel,
  MasterDetail,
  StateStoring,
} from 'devextreme-react/data-grid';
import { Tabs, Item as TabItem } from 'devextreme-react/tabs';
import { PieChart, Series, Label, Legend, Tooltip, Connector } from 'devextreme-react/pie-chart';
import { Chart, CommonSeriesSettings, Series as ChartSeries, ArgumentAxis, ValueAxis, Legend as ChartLegend, Tooltip as ChartTooltip } from 'devextreme-react/chart';
import Button from 'devextreme-react/button';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { CapaDataEntryDialog } from '@/components/capa/CapaDataEntryDialog';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import {
  FileCheck,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Shield,
  ClipboardList,
  Users,
  Calendar,
  Target,
  Activity,
  BarChart3,
  PieChartIcon,
  RefreshCw,
  Plus,
  Filter,
  FileText,
} from 'lucide-react';
import type { Capa, CapaStatus, CapaPriority, CapaDashboard, RiskSeverity, RiskProbability } from '@/types/capa';

// ============================================
// Types
// ============================================

interface ApiError extends Error {
  details?: string;
  stack?: string;
}

type TabKey = 'all' | 'active' | 'overdue' | 'pending_approval' | 'closed';

interface TabConfig {
  id: TabKey;
  text: string;
  icon: string;
  badge?: number;
}

// ============================================
// API Functions
// ============================================

async function fetchDashboard(): Promise<CapaDashboard> {
  const response = await fetch('/api/capa/dashboard');
  const result = await response.json();
  if (!result.success) {
    const error = new Error(result.error || 'Failed to fetch dashboard') as ApiError;
    error.details = result.details;
    throw error;
  }
  return result.data;
}

async function fetchCapas(params: {
  status?: CapaStatus | CapaStatus[];
  overdue?: boolean;
}): Promise<{ capas: Capa[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params.status) {
    if (Array.isArray(params.status)) {
      params.status.forEach(s => searchParams.append('status', s));
    } else {
      searchParams.set('status', params.status);
    }
  }
  if (params.overdue) searchParams.set('overdue', 'true');
  searchParams.set('limit', '1000'); // Get all for client-side filtering

  const response = await fetch(`/api/capa?${searchParams.toString()}`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch CAPAs');
  }
  return result.data;
}

// ============================================
// Helper Functions
// ============================================

function getRiskLevel(score: number | null): { level: string; color: string } {
  if (!score) return { level: 'N/A', color: 'gray' };
  if (score <= 4) return { level: 'Low', color: 'green' };
  if (score <= 9) return { level: 'Medium', color: 'yellow' };
  if (score <= 16) return { level: 'High', color: 'orange' };
  return { level: 'Critical', color: 'red' };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ============================================
// Sub-Components
// ============================================

interface KpiCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  trend?: { value: number; isPositive: boolean };
  onClick?: () => void;
}

function KpiCard({ title, value, subtitle, icon: Icon, iconBg, iconColor, trend, onClick }: KpiCardProps) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{trend.value}% vs last month</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconBg}`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

interface RiskMatrixProps {
  capas: Capa[];
}

function RiskMatrix({ capas }: RiskMatrixProps) {
  const severityLevels: RiskSeverity[] = ['negligible', 'minor', 'moderate', 'major', 'critical'];
  const probabilityLevels: RiskProbability[] = ['rare', 'unlikely', 'possible', 'likely', 'certain'];

  const matrixData = useMemo(() => {
    const matrix: Record<string, number> = {};
    capas.forEach(capa => {
      if (capa.riskSeverity && capa.riskProbability) {
        const key = `${capa.riskSeverity}-${capa.riskProbability}`;
        matrix[key] = (matrix[key] || 0) + 1;
      }
    });
    return matrix;
  }, [capas]);

  const getCellColor = (sevIdx: number, probIdx: number): string => {
    const score = (sevIdx + 1) * (probIdx + 1);
    if (score <= 4) return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
    if (score <= 9) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
    if (score <= 16) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200';
    return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
        <Shield className="w-4 h-4" />
        Risk Matrix (ICH Q9)
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="p-1"></th>
              {probabilityLevels.map(p => (
                <th key={p} className="p-1 text-center capitalize font-medium text-gray-500 dark:text-gray-400 min-w-[60px]">
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...severityLevels].reverse().map((severity, sIdx) => (
              <tr key={severity}>
                <td className="p-1 text-right capitalize font-medium text-gray-500 dark:text-gray-400 pr-2">
                  {severity}
                </td>
                {probabilityLevels.map((probability, pIdx) => {
                  const count = matrixData[`${severity}-${probability}`] || 0;
                  return (
                    <td key={`${severity}-${probability}`} className="p-1">
                      <div
                        className={`rounded-lg h-10 flex items-center justify-center font-bold transition-all ${getCellColor(severityLevels.length - 1 - sIdx, pIdx)} ${
                          count > 0 ? 'ring-2 ring-offset-1 ring-gray-400' : ''
                        }`}
                      >
                        {count > 0 ? count : ''}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-green-100 dark:bg-green-900/30"></div>
            <span className="text-gray-500">Low (1-4)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-yellow-100 dark:bg-yellow-900/30"></div>
            <span className="text-gray-500">Medium (5-9)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-orange-100 dark:bg-orange-900/30"></div>
            <span className="text-gray-500">High (10-16)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-red-100 dark:bg-red-900/30"></div>
            <span className="text-gray-500">Critical (17-25)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function CapaDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations('gmp');
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [showNewCapaDialog, setShowNewCapaDialog] = useState(false);
  const [selectedCapaId, setSelectedCapaId] = useState<number | null>(null);

  // Fetch dashboard data
  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['capa-dashboard'],
    queryFn: fetchDashboard,
  });

  // Fetch all CAPAs for the grid
  const { data: capaData, isLoading: capasLoading, refetch: refetchCapas } = useQuery({
    queryKey: ['capas-all'],
    queryFn: () => fetchCapas({}),
  });

  // Filter CAPAs based on active tab
  const filteredCapas = useMemo(() => {
    if (!capaData?.capas) return [];

    switch (activeTab) {
      case 'active':
        return capaData.capas.filter(c =>
          ['open', 'investigation', 'action_pending', 'verification'].includes(c.status)
        );
      case 'overdue':
        return capaData.capas.filter(c => c.isOverdue);
      case 'pending_approval':
        return capaData.capas.filter(c => c.status === 'pending_approval');
      case 'closed':
        return capaData.capas.filter(c => c.status === 'closed');
      default:
        return capaData.capas;
    }
  }, [capaData?.capas, activeTab]);

  // Chart data
  const statusChartData = useMemo(() => {
    if (!dashboard?.byStatus) return [];
    const statusLabels: Record<string, string> = {
      open: 'Open',
      investigation: 'Investigation',
      action_pending: 'Action Pending',
      verification: 'Verification',
      pending_approval: 'Pending Approval',
      closed: 'Closed',
      cancelled: 'Cancelled',
    };
    const statusColors: Record<string, string> = {
      open: '#3b82f6',
      investigation: '#8b5cf6',
      action_pending: '#f59e0b',
      verification: '#06b6d4',
      pending_approval: '#ec4899',
      closed: '#22c55e',
      cancelled: '#6b7280',
    };
    return Object.entries(dashboard.byStatus)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        status: statusLabels[status] || status,
        count,
        color: statusColors[status] || '#6b7280',
      }));
  }, [dashboard?.byStatus]);

  const priorityChartData = useMemo(() => {
    if (!dashboard?.byPriority) return [];
    const priorityColors: Record<string, string> = {
      low: '#22c55e',
      medium: '#eab308',
      high: '#f97316',
      critical: '#ef4444',
    };
    return Object.entries(dashboard.byPriority)
      .map(([priority, count]) => ({
        priority: priority.charAt(0).toUpperCase() + priority.slice(1),
        count,
        color: priorityColors[priority] || '#6b7280',
      }));
  }, [dashboard?.byPriority]);

  // Tab configuration
  const tabs: TabConfig[] = useMemo(() => [
    { id: 'all', text: 'All CAPAs', icon: 'folder' },
    { id: 'active', text: 'Active', icon: 'clock', badge: dashboard?.totalOpen },
    { id: 'overdue', text: 'Overdue', icon: 'warning', badge: dashboard?.overdue },
    { id: 'pending_approval', text: 'Pending Approval', icon: 'check', badge: dashboard?.byStatus?.pending_approval },
    { id: 'closed', text: 'Closed', icon: 'check', badge: dashboard?.closedThisMonth },
  ], [dashboard]);

  // Handlers
  const handleRefresh = useCallback(() => {
    refetchDashboard();
    refetchCapas();
  }, [refetchDashboard, refetchCapas]);

  const handleRowClick = useCallback((e: { data: Capa }) => {
    router.push(`/gmp/capa/${e.data.id}`);
  }, [router]);

  const handleNewCapa = useCallback(() => {
    setSelectedCapaId(null);
    setShowNewCapaDialog(true);
  }, []);

  const handleDialogClose = useCallback(() => {
    setShowNewCapaDialog(false);
    setSelectedCapaId(null);
  }, []);

  const handleDialogSuccess = useCallback((capa?: Capa) => {
    handleDialogClose();
    handleRefresh();
    if (capa) {
      router.push(`/gmp/capa/${capa.id}`);
    }
  }, [handleDialogClose, handleRefresh, router]);

  // Cell renderers
  const renderPriority = useCallback((cellData: { value: CapaPriority }) => {
    const colors: Record<CapaPriority, string> = {
      low: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
      critical: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${colors[cellData.value]}`}>
        {cellData.value?.toUpperCase()}
      </span>
    );
  }, []);

  const renderStatus = useCallback((cellData: { value: CapaStatus }) => {
    return <WorkflowStatusBadge status={cellData.value} />;
  }, []);

  const renderRiskScore = useCallback((cellData: { data: Capa }) => {
    const { level, color } = getRiskLevel(cellData.data.riskScore);
    const colorClasses: Record<string, string> = {
      green: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
      yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
      orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
      red: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
      gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    };
    return (
      <div className="flex items-center gap-2">
        {cellData.data.riskScore && (
          <span className="text-sm font-mono">{cellData.data.riskScore}</span>
        )}
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClasses[color]}`}>
          {level}
        </span>
      </div>
    );
  }, []);

  const renderOverdue = useCallback((cellData: { data: Capa }) => {
    if (cellData.data.isOverdue) {
      return (
        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
          <AlertTriangle className="h-4 w-4" />
        </span>
      );
    }
    return null;
  }, []);

  const renderActionProgress = useCallback((cellData: { data: Capa }) => {
    const { actionCount = 0, actionsCompleted = 0 } = cellData.data;
    if (actionCount === 0) return <span className="text-gray-400 text-xs">-</span>;

    const percentage = Math.round((actionsCompleted / actionCount) * 100);
    const isComplete = actionsCompleted === actionCount;

    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-[60px]">
          <div
            className={`h-full transition-all ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs text-gray-600 dark:text-gray-400 min-w-[32px]">
          {actionsCompleted}/{actionCount}
        </span>
      </div>
    );
  }, []);

  const renderSourceType = useCallback((cellData: { value: string }) => {
    const icons: Record<string, React.ReactNode> = {
      deviation: <AlertTriangle className="w-3.5 h-3.5" />,
      complaint: <Users className="w-3.5 h-3.5" />,
      audit_finding: <ClipboardList className="w-3.5 h-3.5" />,
      other: <FileText className="w-3.5 h-3.5" />,
    };
    const labels: Record<string, string> = {
      deviation: 'Deviation',
      complaint: 'Complaint',
      audit_finding: 'Audit Finding',
      other: 'Other',
    };
    return (
      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
        {icons[cellData.value]}
        <span className="text-xs">{labels[cellData.value] || cellData.value}</span>
      </div>
    );
  }, []);

  // Master detail template
  const masterDetailTemplate = useCallback((e: { data: Capa }) => {
    const capa = e.data;
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Root Cause</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {capa.rootCauseAnalysis || 'Not analyzed yet'}
          </p>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Impact Assessment</h4>
          <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <p>Scope: <span className="font-medium">{capa.impactScope || 'N/A'}</span></p>
            <p>Patient Impact: <span className={capa.patientImpact ? 'text-red-600 font-medium' : ''}>{capa.patientImpact ? 'Yes' : 'No'}</span></p>
            <p>Regulatory Required: <span className={capa.regulatoryNotificationRequired ? 'text-orange-600 font-medium' : ''}>{capa.regulatoryNotificationRequired ? 'Yes' : 'No'}</span></p>
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Approval Status</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {capa.approvalStatus ? (
              <span className={`font-medium ${capa.approvalStatus === 'approved' ? 'text-green-600' : capa.approvalStatus === 'rejected' ? 'text-red-600' : 'text-yellow-600'}`}>
                {capa.approvalStatus.replace('_', ' ').toUpperCase()}
              </span>
            ) : 'Not submitted'}
          </p>
        </div>
      </div>
    );
  }, []);

  const isLoading = dashboardLoading || capasLoading;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <Target className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                {t('capa.pageTitle')}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('capa.description')} • GMP Chapter 1 Compliance
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                icon="refresh"
                text={t('capa.actions.refresh')}
                stylingMode="outlined"
                onClick={handleRefresh}
              />
              <Button
                icon="plus"
                text={t('capa.actions.newCapa')}
                type="success"
                onClick={handleNewCapa}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1920px] mx-auto px-6 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <KpiCard
            title="Open CAPAs"
            value={dashboard?.totalOpen || 0}
            subtitle="Active cases requiring attention"
            icon={FileCheck}
            iconBg="bg-blue-100 dark:bg-blue-900/30"
            iconColor="text-blue-600 dark:text-blue-400"
            onClick={() => setActiveTab('active')}
          />
          <KpiCard
            title="Overdue"
            value={dashboard?.overdue || 0}
            subtitle="Past due date"
            icon={AlertTriangle}
            iconBg={dashboard?.overdue ? "bg-red-100 dark:bg-red-900/30" : "bg-gray-100 dark:bg-gray-800"}
            iconColor={dashboard?.overdue ? "text-red-600 dark:text-red-400" : "text-gray-400"}
            onClick={() => setActiveTab('overdue')}
          />
          <KpiCard
            title="Pending Approval"
            value={dashboard?.byStatus?.pending_approval || 0}
            subtitle="Awaiting QA review"
            icon={Clock}
            iconBg="bg-purple-100 dark:bg-purple-900/30"
            iconColor="text-purple-600 dark:text-purple-400"
            onClick={() => setActiveTab('pending_approval')}
          />
          <KpiCard
            title="Closed This Month"
            value={dashboard?.closedThisMonth || 0}
            subtitle="Successfully resolved"
            icon={CheckCircle}
            iconBg="bg-green-100 dark:bg-green-900/30"
            iconColor="text-green-600 dark:text-green-400"
            onClick={() => setActiveTab('closed')}
          />
          <KpiCard
            title="Effectiveness Rate"
            value={`${dashboard?.effectivenessRate || 0}%`}
            subtitle="Of closed CAPAs effective"
            icon={Activity}
            iconBg="bg-emerald-100 dark:bg-emerald-900/30"
            iconColor="text-emerald-600 dark:text-emerald-400"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <PieChartIcon className="w-4 h-4" />
              Status Distribution
            </h3>
            {statusChartData.length > 0 ? (
              <PieChart
                id="status-pie"
                dataSource={statusChartData}
                type="doughnut"
                innerRadius={0.65}
                palette={statusChartData.map(d => d.color)}
              >
                <Series argumentField="status" valueField="count">
                  <Label visible={true} position="inside" customizeText={(e: { valueText: string }) => e.valueText}>
                    <Connector visible={false} />
                  </Label>
                </Series>
                <Legend
                  visible={true}
                  horizontalAlignment="right"
                  verticalAlignment="top"
                  itemTextPosition="right"
                />
                <Tooltip enabled={true} />
              </PieChart>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </div>

          {/* Priority Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Priority Distribution
            </h3>
            {priorityChartData.length > 0 ? (
              <Chart
                id="priority-chart"
                dataSource={priorityChartData}
                rotated={true}
              >
                <CommonSeriesSettings type="bar" argumentField="priority" valueField="count" />
                <ChartSeries
                  name="Count"
                  color="#10b981"
                  barWidth={30}
                />
                <ArgumentAxis />
                <ValueAxis />
                <ChartLegend visible={false} />
                <ChartTooltip enabled={true} />
              </Chart>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </div>

          {/* Risk Matrix */}
          <RiskMatrix capas={capaData?.capas || []} />
        </div>

        {/* Tabs and Data Grid */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          {/* Custom Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-4">
            <div className="flex items-center gap-1 overflow-x-auto py-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab.text}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      activeTab === tab.id
                        ? 'bg-emerald-600 text-white'
                        : tab.id === 'overdue'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Data Grid */}
          <DataGrid
            dataSource={filteredCapas}
            showBorders={false}
            showRowLines={true}
            showColumnLines={false}
            rowAlternationEnabled={true}
            hoverStateEnabled={true}
            onRowClick={handleRowClick}
            wordWrapEnabled={false}
            columnAutoWidth={true}
            height="calc(100vh - 550px)"
            className="dx-card-grid"
          >
            <LoadPanel enabled={true} />
            <StateStoring enabled={true} type="localStorage" storageKey="capaGridState" />
            <SearchPanel visible={true} width={250} placeholder="Search CAPAs..." />
            <FilterRow visible={true} />
            <HeaderFilter visible={true} />
            <Sorting mode="multiple" />
            <ColumnChooser enabled={true} mode="select" />
            <Export enabled={true} allowExportSelectedData={true} />
            <Selection mode="multiple" showCheckBoxesMode="onClick" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector={true}
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo={true}
              showNavigationButtons={true}
            />
            <MasterDetail enabled={true} component={masterDetailTemplate} />

            <Column dataField="capaNumber" caption="CAPA #" width={130} fixed={true} />
            <Column dataField="title" caption="Title" minWidth={200} />
            <Column
              dataField="sourceType"
              caption="Source"
              width={130}
              cellRender={renderSourceType}
            />
            <Column dataField="type" caption="Type" width={100} cellRender={(e: { value: string }) => (
              <span className="capitalize text-sm">{e.value}</span>
            )} />
            <Column
              dataField="priority"
              caption="Priority"
              width={110}
              cellRender={renderPriority}
            />
            <Column
              dataField="status"
              caption="Status"
              width={140}
              cellRender={renderStatus}
            />
            <Column
              dataField="riskScore"
              caption="Risk"
              width={110}
              cellRender={renderRiskScore}
            />
            <Column
              dataField="isOverdue"
              caption=""
              width={40}
              cellRender={renderOverdue}
              allowFiltering={false}
              allowSorting={false}
            />
            <Column
              dataField="actionCount"
              caption="Actions"
              width={120}
              cellRender={renderActionProgress}
            />
            <Column dataField="ownerName" caption="Owner" width={150} />
            <Column
              dataField="dueDate"
              caption="Due Date"
              width={110}
              dataType="date"
              format="dd MMM yyyy"
            />
            <Column
              dataField="createdAt"
              caption="Created"
              width={110}
              dataType="date"
              format="dd MMM yyyy"
              visible={false}
            />

            <Toolbar>
              <Item name="searchPanel" />
              <Item name="columnChooserButton" />
              <Item name="exportButton" />
            </Toolbar>
          </DataGrid>
        </div>
      </div>

      {/* New CAPA Dialog */}
      <CapaDataEntryDialog
        visible={showNewCapaDialog}
        onClose={handleDialogClose}
        onSaved={handleDialogSuccess}
      />
    </div>
  );
}

'use client';

/**
 * Product Recalls Dashboard
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Professional dashboard for product recall management with:
 * - KPI cards with trends and click handlers
 * - Status and Class distribution charts
 * - Recall effectiveness matrix
 * - Tabbed data views with badges
 * - Enhanced data grid with advanced filtering
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
import { PieChart, Series, Label, Legend, Tooltip, Connector } from 'devextreme-react/pie-chart';
import { Chart, CommonSeriesSettings, Series as ChartSeries, ArgumentAxis, ValueAxis, Legend as ChartLegend, Tooltip as ChartTooltip } from 'devextreme-react/chart';
import Button from 'devextreme-react/button';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxButton } from '@/components/ui/dx-button';
import { RecallDataEntryDialog } from '@/components/recalls/RecallDataEntryDialog';
import {
  AlertTriangle,
  Package,
  CheckCircle,
  Activity,
  TrendingUp,
  TrendingDown,
  Shield,
  Clock,
  Target,
  BarChart3,
  PieChartIcon,
  XCircle,
  Users,
  Truck,
  RefreshCw,
  FileText,
  AlertOctagon,
} from 'lucide-react';
import type { RecallListResponse, RecallStatus, RecallClass, MockDrillResult, Recall } from '@/types/recalls';

// ============================================
// Types
// ============================================

type TabKey = 'all' | 'initiated' | 'in_progress' | 'completed' | 'closed';

interface TabConfig {
  id: TabKey;
  text: string;
  icon: string;
  badge?: number;
}

// ============================================
// Constants
// ============================================

const CLASS_COLORS: Record<RecallClass, string> = {
  class_i: '#ef4444',
  class_ii: '#f59e0b',
  class_iii: '#3b82f6',
};

const CLASS_LABELS: Record<RecallClass, string> = {
  class_i: 'Class I',
  class_ii: 'Class II',
  class_iii: 'Class III',
};

const STATUS_COLORS: Record<RecallStatus, string> = {
  initiated: '#f59e0b',
  in_progress: '#3b82f6',
  completed: '#10b981',
  closed: '#6b7280',
};

const STATUS_LABELS: Record<RecallStatus, string> = {
  initiated: 'Initiated',
  in_progress: 'In Progress',
  completed: 'Completed',
  closed: 'Closed',
};

// ============================================
// API Functions
// ============================================

async function fetchRecalls(
  status?: RecallStatus,
  recallClass?: RecallClass
): Promise<RecallListResponse> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (recallClass) params.set('recallClass', recallClass);

  const response = await fetch(`/api/recalls?${params.toString()}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function executeMockDrill(lotId: number): Promise<MockDrillResult> {
  const response = await fetch('/api/recalls/mock-drill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lotId }),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

// ============================================
// Helper Functions
// ============================================

function getRecoveryLevel(rate: number): { level: string; color: string } {
  if (rate >= 90) return { level: 'Excellent', color: 'green' };
  if (rate >= 70) return { level: 'Good', color: 'emerald' };
  if (rate >= 50) return { level: 'Fair', color: 'yellow' };
  if (rate >= 30) return { level: 'Poor', color: 'orange' };
  return { level: 'Critical', color: 'red' };
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
  highlight?: boolean;
}

function KpiCard({ title, value, subtitle, icon: Icon, iconBg, iconColor, trend, onClick, highlight }: KpiCardProps) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border ${
        highlight ? 'border-red-300 dark:border-red-700 ring-2 ring-red-100 dark:ring-red-900/50' : 'border-gray-100 dark:border-gray-700'
      } p-5 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-red-200 dark:hover:border-red-800' : ''
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

interface RecallEffectivenessMatrixProps {
  recalls: Recall[];
}

function RecallEffectivenessMatrix({ recalls }: RecallEffectivenessMatrixProps) {
  const matrixData = useMemo(() => {
    const activeRecalls = recalls.filter(r => r.status !== 'closed');
    const matrix: Record<string, { count: number; avgEffectiveness: number; recalls: Recall[] }> = {};

    // Initialize matrix
    ['class_i', 'class_ii', 'class_iii'].forEach(cls => {
      ['initiated', 'in_progress', 'completed'].forEach(status => {
        matrix[`${cls}-${status}`] = { count: 0, avgEffectiveness: 0, recalls: [] };
      });
    });

    // Populate matrix
    activeRecalls.forEach(recall => {
      const key = `${recall.recallClass}-${recall.status}`;
      if (matrix[key]) {
        matrix[key].count++;
        matrix[key].recalls.push(recall);
      }
    });

    // Calculate average effectiveness
    Object.keys(matrix).forEach(key => {
      const cell = matrix[key];
      if (cell.recalls.length > 0) {
        cell.avgEffectiveness = cell.recalls.reduce((sum, r) => sum + r.effectivenessRate, 0) / cell.recalls.length;
      }
    });

    return matrix;
  }, [recalls]);

  const getCellColor = (cls: string, count: number): string => {
    if (count === 0) return 'bg-gray-50 dark:bg-gray-800';
    if (cls === 'class_i') return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
    if (cls === 'class_ii') return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
        <Shield className="w-4 h-4" />
        Active Recalls Matrix
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="p-1"></th>
              <th className="p-1 text-center font-medium text-gray-500 dark:text-gray-400">Initiated</th>
              <th className="p-1 text-center font-medium text-gray-500 dark:text-gray-400">In Progress</th>
              <th className="p-1 text-center font-medium text-gray-500 dark:text-gray-400">Completed</th>
            </tr>
          </thead>
          <tbody>
            {(['class_i', 'class_ii', 'class_iii'] as RecallClass[]).map((cls) => (
              <tr key={cls}>
                <td className="p-1 text-right font-medium text-gray-500 dark:text-gray-400 pr-2">
                  {CLASS_LABELS[cls]}
                </td>
                {(['initiated', 'in_progress', 'completed'] as RecallStatus[]).map((status) => {
                  const cell = matrixData[`${cls}-${status}`];
                  return (
                    <td key={`${cls}-${status}`} className="p-1">
                      <div
                        className={`rounded-lg h-14 flex flex-col items-center justify-center font-bold transition-all ${getCellColor(cls, cell.count)} ${
                          cell.count > 0 ? 'ring-1 ring-offset-1 ring-gray-300 dark:ring-gray-600' : ''
                        }`}
                      >
                        {cell.count > 0 ? (
                          <>
                            <span className="text-lg">{cell.count}</span>
                            <span className="text-[10px] font-normal opacity-70">
                              {cell.avgEffectiveness.toFixed(0)}% eff.
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">-</span>
                        )}
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
            <div className="w-4 h-4 rounded bg-red-100 dark:bg-red-900/30 border border-red-200"></div>
            <span className="text-gray-500">Class I (Critical)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200"></div>
            <span className="text-gray-500">Class II (Major)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-blue-100 dark:bg-blue-900/30 border border-blue-200"></div>
            <span className="text-gray-500">Class III (Minor)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function RecallsDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [showNewRecallDialog, setShowNewRecallDialog] = useState(false);
  const [showMockDrill, setShowMockDrill] = useState(false);
  const [mockDrillLotId, setMockDrillLotId] = useState<number>(0);
  const [mockDrillResult, setMockDrillResult] = useState<MockDrillResult | null>(null);
  const [mockDrillLoading, setMockDrillLoading] = useState(false);

  // Fetch all recalls
  const { data: allData, isLoading, refetch } = useQuery({
    queryKey: ['recalls-all'],
    queryFn: () => fetchRecalls(),
  });

  const recalls = useMemo(() => allData?.recalls || [], [allData]);

  // Calculate dashboard stats
  const stats = useMemo(() => {
    const activeRecalls = recalls.filter((r) => r.status !== 'closed');
    const completedRecalls = recalls.filter((r) => r.status === 'completed' || r.status === 'closed');

    const avgEffectiveness = completedRecalls.length > 0
      ? completedRecalls.reduce((sum, r) => sum + r.effectivenessRate, 0) / completedRecalls.length
      : 0;

    const totalDistributed = activeRecalls.reduce((sum, r) => sum + r.distributedQuantity, 0);
    const totalReturned = activeRecalls.reduce((sum, r) => sum + r.returnedQuantity, 0);

    // Count by status
    const byStatus = {
      initiated: recalls.filter((r) => r.status === 'initiated').length,
      in_progress: recalls.filter((r) => r.status === 'in_progress').length,
      completed: recalls.filter((r) => r.status === 'completed').length,
      closed: recalls.filter((r) => r.status === 'closed').length,
    };

    // Count by class (active only)
    const byClass = {
      class_i: activeRecalls.filter((r) => r.recallClass === 'class_i').length,
      class_ii: activeRecalls.filter((r) => r.recallClass === 'class_ii').length,
      class_iii: activeRecalls.filter((r) => r.recallClass === 'class_iii').length,
    };

    return {
      active: activeRecalls.length,
      classI: byClass.class_i,
      classII: byClass.class_ii,
      classIII: byClass.class_iii,
      avgEffectiveness,
      totalDistributed,
      totalReturned,
      byStatus,
      byClass,
    };
  }, [recalls]);

  // Filter recalls based on active tab
  const filteredRecalls = useMemo(() => {
    switch (activeTab) {
      case 'initiated':
        return recalls.filter(r => r.status === 'initiated');
      case 'in_progress':
        return recalls.filter(r => r.status === 'in_progress');
      case 'completed':
        return recalls.filter(r => r.status === 'completed');
      case 'closed':
        return recalls.filter(r => r.status === 'closed');
      default:
        return recalls;
    }
  }, [recalls, activeTab]);

  // Chart data
  const classChartData = useMemo(() => {
    return [
      { class: 'Class I', count: stats.byClass.class_i, color: CLASS_COLORS.class_i },
      { class: 'Class II', count: stats.byClass.class_ii, color: CLASS_COLORS.class_ii },
      { class: 'Class III', count: stats.byClass.class_iii, color: CLASS_COLORS.class_iii },
    ].filter(item => item.count > 0);
  }, [stats]);

  const statusChartData = useMemo(() => {
    return [
      { status: 'Initiated', count: stats.byStatus.initiated, color: STATUS_COLORS.initiated },
      { status: 'In Progress', count: stats.byStatus.in_progress, color: STATUS_COLORS.in_progress },
      { status: 'Completed', count: stats.byStatus.completed, color: STATUS_COLORS.completed },
      { status: 'Closed', count: stats.byStatus.closed, color: STATUS_COLORS.closed },
    ].filter(item => item.count > 0);
  }, [stats]);

  // Monthly trend data
  const monthlyTrendData = useMemo(() => {
    const months: Record<string, { initiated: number; closed: number }> = {};

    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      months[key] = { initiated: 0, closed: 0 };
    }

    recalls.forEach((recall) => {
      const initiatedDate = new Date(recall.initiatedDate);
      const key = initiatedDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (months[key]) {
        months[key].initiated++;
      }

      if (recall.closureDate) {
        const closedDate = new Date(recall.closureDate);
        const closedKey = closedDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (months[closedKey]) {
          months[closedKey].closed++;
        }
      }
    });

    return Object.entries(months).map(([month, data]) => ({
      month,
      initiated: data.initiated,
      closed: data.closed,
    }));
  }, [recalls]);

  // Tab configuration
  const tabs: TabConfig[] = useMemo(() => [
    { id: 'all', text: 'All Recalls', icon: 'folder' },
    { id: 'initiated', text: 'Initiated', icon: 'clock', badge: stats.byStatus.initiated },
    { id: 'in_progress', text: 'In Progress', icon: 'runner', badge: stats.byStatus.in_progress },
    { id: 'completed', text: 'Completed', icon: 'check', badge: stats.byStatus.completed },
    { id: 'closed', text: 'Closed', icon: 'save', badge: stats.byStatus.closed },
  ], [stats]);

  // Handlers
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleRowClick = useCallback((e: { data: Recall }) => {
    router.push(`/gmp/recalls/${e.data.id}`);
  }, [router]);

  const handleNewRecall = useCallback(() => {
    setShowNewRecallDialog(true);
  }, []);

  const handleDialogClose = useCallback(() => {
    setShowNewRecallDialog(false);
  }, []);

  const handleDialogSuccess = useCallback(() => {
    setShowNewRecallDialog(false);
    handleRefresh();
  }, [handleRefresh]);

  const handleMockDrill = async () => {
    if (!mockDrillLotId) return;
    setMockDrillLoading(true);
    try {
      const result = await executeMockDrill(mockDrillLotId);
      setMockDrillResult(result);
    } catch (error) {
      console.error('Mock drill failed:', error);
    } finally {
      setMockDrillLoading(false);
    }
  };

  // Cell renderers
  const renderClass = useCallback((cellData: { value: RecallClass }) => {
    const colors: Record<RecallClass, string> = {
      class_i: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
      class_ii: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
      class_iii: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${colors[cellData.value]}`}>
        {CLASS_LABELS[cellData.value]}
      </span>
    );
  }, []);

  const renderStatus = useCallback((cellData: { value: RecallStatus }) => {
    const colors: Record<RecallStatus, string> = {
      initiated: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
      closed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${colors[cellData.value]}`}>
        {STATUS_LABELS[cellData.value]}
      </span>
    );
  }, []);

  const renderEffectiveness = useCallback((cellData: { data: Recall }) => {
    const rate = Number(cellData.data.effectivenessRate) || 0;
    const { level, color } = getRecoveryLevel(rate);
    const colorClasses: Record<string, string> = {
      green: 'text-green-600 dark:text-green-400',
      emerald: 'text-emerald-600 dark:text-emerald-400',
      yellow: 'text-yellow-600 dark:text-yellow-400',
      orange: 'text-orange-600 dark:text-orange-400',
      red: 'text-red-600 dark:text-red-400',
    };

    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-[60px]">
          <div
            className={`h-full transition-all ${
              rate >= 70 ? 'bg-green-500' : rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${rate}%` }}
          />
        </div>
        <span className={`text-xs font-semibold min-w-[40px] ${colorClasses[color]}`}>
          {rate.toFixed(0)}%
        </span>
      </div>
    );
  }, []);

  const renderQuantities = useCallback((cellData: { data: Recall }) => {
    const distributedQuantity = Number(cellData.data.distributedQuantity) || 0;
    const returnedQuantity = Number(cellData.data.returnedQuantity) || 0;
    return (
      <div className="text-xs">
        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
          <Truck className="w-3 h-3" />
          {distributedQuantity.toLocaleString()}
        </div>
        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
          <Package className="w-3 h-3" />
          {returnedQuantity.toLocaleString()}
        </div>
      </div>
    );
  }, []);

  const renderClassIcon = useCallback((cellData: { data?: Recall }) => {
    if (cellData.data?.recallClass === 'class_i') {
      return (
        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
          <AlertOctagon className="h-4 w-4" />
        </span>
      );
    }
    return null;
  }, []);

  // Master detail template
  const masterDetailTemplate = useCallback((e: { data: Recall }) => {
    const recall = e.data;
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Reason for Recall</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {recall.reason || 'Not specified'}
          </p>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Affected Lots</h4>
          <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
            {recall.affectedLotNumbers?.join(', ') || 'N/A'}
          </p>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Recovery Progress</h4>
          <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <p>Distributed: <span className="font-medium">{recall.distributedQuantity.toLocaleString()}</span></p>
            <p>Returned: <span className="font-medium text-green-600">{recall.returnedQuantity.toLocaleString()}</span></p>
            <p>Rate: <span className={`font-medium ${recall.effectivenessRate >= 70 ? 'text-green-600' : 'text-red-600'}`}>
              {recall.effectivenessRate.toFixed(1)}%
            </span></p>
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Linked Complaint</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {recall.complaintNumber ? (
              <span className="font-mono text-blue-600 dark:text-blue-400">{recall.complaintNumber}</span>
            ) : (
              'None'
            )}
          </p>
        </div>
      </div>
    );
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                Product Recalls
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Thai FDA GMP หมวด 9 • Recall Management Dashboard
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                icon="refresh"
                text="Refresh"
                stylingMode="outlined"
                onClick={handleRefresh}
              />
              <Button
                icon="like"
                text="Mock Drill"
                stylingMode="outlined"
                onClick={() => setShowMockDrill(true)}
              />
              <Button
                icon="plus"
                text="Initiate Recall"
                type="danger"
                onClick={handleNewRecall}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1920px] mx-auto px-6 py-6 space-y-6">
        {/* Critical Alert Banner */}
        {stats.classI > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-800 rounded-full animate-pulse">
                  <AlertOctagon className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-red-800 dark:text-red-200">
                    {stats.classI} Active Class I Recall{stats.classI > 1 ? 's' : ''}
                  </h3>
                  <p className="text-sm text-red-600 dark:text-red-300">
                    Critical recalls require immediate attention and regulatory reporting within 24 hours
                  </p>
                </div>
              </div>
              <Button
                text="View Critical"
                icon="arrowright"
                onClick={() => setActiveTab('all')}
                type="danger"
                stylingMode="outlined"
              />
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <KpiCard
            title="Active Recalls"
            value={stats.active}
            subtitle="Requiring action"
            icon={AlertTriangle}
            iconBg="bg-orange-100 dark:bg-orange-900/30"
            iconColor="text-orange-600 dark:text-orange-400"
            onClick={() => setActiveTab('all')}
          />
          <KpiCard
            title="Class I (Critical)"
            value={stats.classI}
            subtitle="Health hazard risk"
            icon={AlertOctagon}
            iconBg={stats.classI > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-gray-100 dark:bg-gray-800"}
            iconColor={stats.classI > 0 ? "text-red-600 dark:text-red-400" : "text-gray-400"}
            highlight={stats.classI > 0}
            onClick={() => setActiveTab('all')}
          />
          <KpiCard
            title="In Progress"
            value={stats.byStatus.in_progress}
            subtitle="Currently being processed"
            icon={Activity}
            iconBg="bg-blue-100 dark:bg-blue-900/30"
            iconColor="text-blue-600 dark:text-blue-400"
            onClick={() => setActiveTab('in_progress')}
          />
          <KpiCard
            title="Pending Closure"
            value={stats.byStatus.completed}
            subtitle="Awaiting final review"
            icon={Clock}
            iconBg="bg-purple-100 dark:bg-purple-900/30"
            iconColor="text-purple-600 dark:text-purple-400"
            onClick={() => setActiveTab('completed')}
          />
          <KpiCard
            title="Avg Effectiveness"
            value={`${stats.avgEffectiveness.toFixed(0)}%`}
            subtitle="Product recovery rate"
            icon={Target}
            iconBg="bg-emerald-100 dark:bg-emerald-900/30"
            iconColor="text-emerald-600 dark:text-emerald-400"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Class Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <PieChartIcon className="w-4 h-4" />
              By Recall Class
            </h3>
            {classChartData.length > 0 ? (
              <PieChart
                id="class-pie"
                dataSource={classChartData}
                type="doughnut"
                innerRadius={0.65}
                palette={classChartData.map(d => d.color)}
              >
                <Series argumentField="class" valueField="count">
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
                No active recalls
              </div>
            )}
          </div>

          {/* Status Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              By Status
            </h3>
            {statusChartData.length > 0 ? (
              <Chart
                id="status-chart"
                dataSource={statusChartData}
                rotated={true}
              >
                <CommonSeriesSettings type="bar" argumentField="status" valueField="count" />
                <ChartSeries
                  name="Count"
                  color="#ef4444"
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

          {/* Effectiveness Matrix */}
          <RecallEffectivenessMatrix recalls={recalls} />
        </div>

        {/* Trend Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Recall Trend (Last 6 Months)
          </h3>
          <Chart dataSource={monthlyTrendData} height={200}>
            <CommonSeriesSettings type="bar" argumentField="month" />
            <ChartSeries valueField="initiated" name="Initiated" color="#f59e0b" />
            <ChartSeries valueField="closed" name="Closed" color="#10b981" />
            <ArgumentAxis />
            <ValueAxis />
            <ChartLegend visible={true} horizontalAlignment="center" verticalAlignment="bottom" />
            <ChartTooltip enabled={true} />
          </Chart>
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
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab.text}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      activeTab === tab.id
                        ? 'bg-red-600 text-white'
                        : tab.id === 'initiated'
                        ? 'bg-yellow-500 text-white'
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
            dataSource={filteredRecalls}
            showBorders={false}
            showRowLines={true}
            showColumnLines={false}
            rowAlternationEnabled={true}
            hoverStateEnabled={true}
            onRowClick={handleRowClick}
            wordWrapEnabled={false}
            columnAutoWidth={true}
            height="calc(100vh - 650px)"
            className="dx-card-grid"
          >
            <LoadPanel enabled={true} />
            <StateStoring enabled={true} type="localStorage" storageKey="recallGridState" />
            <SearchPanel visible={true} width={250} placeholder="Search recalls..." />
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

            <Column dataField="recallNumber" caption="Recall #" width={130} fixed={true} />
            <Column
              caption=""
              width={40}
              cellRender={renderClassIcon}
              allowFiltering={false}
              allowSorting={false}
            />
            <Column
              dataField="recallClass"
              caption="Class"
              width={110}
              cellRender={renderClass}
            />
            <Column dataField="productName" caption="Product" minWidth={180} />
            <Column
              dataField="status"
              caption="Status"
              width={120}
              cellRender={renderStatus}
            />
            <Column
              dataField="effectivenessRate"
              caption="Recovery"
              width={130}
              cellRender={renderEffectiveness}
            />
            <Column
              dataField="distributedQuantity"
              caption="Qty"
              width={100}
              cellRender={renderQuantities}
            />
            <Column dataField="coordinatorName" caption="Coordinator" width={150} />
            <Column
              dataField="initiatedDate"
              caption="Initiated"
              width={110}
              dataType="date"
              format="dd MMM yyyy"
            />
            <Column
              dataField="closureDate"
              caption="Closed"
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

      {/* New Recall Dialog */}
      <RecallDataEntryDialog
        visible={showNewRecallDialog}
        onClose={handleDialogClose}
        onSaved={handleDialogSuccess}
        mode="create"
        title="Initiate New Recall"
      />

      {/* Mock Drill Dialog */}
      <DxPopup
        visible={showMockDrill}
        onHiding={() => {
          setShowMockDrill(false);
          setMockDrillResult(null);
          setMockDrillLotId(0);
        }}
        title="Mock Recall Drill"
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          {!mockDrillResult ? (
            <>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800 dark:text-blue-200">FDA 4-Hour Traceability Test</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Test your ability to trace product distribution within the FDA-required 4-hour window.
                      Enter a lot ID to verify traceability.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Lot ID to Trace</label>
                <DxNumberBox
                  value={mockDrillLotId}
                  onValueChanged={(e) => setMockDrillLotId(e.value || 0)}
                  min={1}
                  placeholder="Enter lot ID..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <DxButton
                  text="Cancel"
                  onClick={() => setShowMockDrill(false)}
                  stylingMode="outlined"
                />
                <DxButton
                  text="Run Mock Drill"
                  icon="like"
                  onClick={handleMockDrill}
                  type="default"
                  disabled={!mockDrillLotId || mockDrillLoading}
                />
              </div>
            </>
          ) : (
            <>
              <div
                className={`p-4 rounded-xl ${
                  mockDrillResult.passedTarget
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  {mockDrillResult.passedTarget ? (
                    <CheckCircle className="h-10 w-10 text-green-600" />
                  ) : (
                    <XCircle className="h-10 w-10 text-red-600" />
                  )}
                  <div>
                    <h3 className="text-lg font-bold">
                      {mockDrillResult.passedTarget ? 'DRILL PASSED' : 'DRILL FAILED'}
                    </h3>
                    <p className="text-sm">
                      Traceability completed in{' '}
                      <span className="font-semibold">{mockDrillResult.timeToIdentify.toFixed(2)} seconds</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-xl text-center">
                  <Users className="h-6 w-6 mx-auto mb-2 text-gray-500" />
                  <div className="text-2xl font-bold">{mockDrillResult.customersIdentified}</div>
                  <div className="text-xs text-gray-500">Customers Identified</div>
                </div>
                <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-xl text-center">
                  <Package className="h-6 w-6 mx-auto mb-2 text-gray-500" />
                  <div className="text-2xl font-bold">{mockDrillResult.totalDistributed}</div>
                  <div className="text-xs text-gray-500">Units Distributed</div>
                </div>
              </div>

              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-xl space-y-1">
                <div className="text-sm flex items-center justify-between">
                  <span className="text-gray-500">Lot Number:</span>
                  <span className="font-mono font-medium">{mockDrillResult.lotNumber}</span>
                </div>
                <div className="text-sm flex items-center justify-between">
                  <span className="text-gray-500">Drill ID:</span>
                  <span className="font-mono">{mockDrillResult.drillId}</span>
                </div>
                <div className="text-sm flex items-center justify-between">
                  <span className="text-gray-500">Executed:</span>
                  <span>{new Date(mockDrillResult.executedAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center justify-end pt-4 border-t">
                <DxButton
                  text="Close"
                  onClick={() => {
                    setShowMockDrill(false);
                    setMockDrillResult(null);
                    setMockDrillLotId(0);
                  }}
                  stylingMode="outlined"
                />
              </div>
            </>
          )}
        </div>
      </DxPopup>
    </div>
  );
}

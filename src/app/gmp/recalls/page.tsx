'use client';

/**
 * Recalls Dashboard Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Professional dashboard for product recall management.
 * Redesigned with DevExtreme UI components.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { RecallList } from '@/components/recalls';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTabs } from '@/components/ui/dx-tabs';
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
  AlertTriangle,
  Package,
  CheckCircle,
  Activity,
  TrendingUp,
  Shield,
  ArrowRight,
  FileCheck,
  Users,
  BarChart3,
  XCircle,
  RefreshCw,
  Clipboard,
  Target,
} from 'lucide-react';
import type { RecallListResponse, RecallStatus, RecallClass, MockDrillResult } from '@/types/recalls';

// ============================================
// Constants
// ============================================

const CLASS_COLORS: Record<RecallClass, string> = {
  class_i: '#ef4444',
  class_ii: '#f59e0b',
  class_iii: '#3b82f6',
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
// Tab Items
// ============================================

const tabItems = [
  { id: 'all', text: 'All Recalls', icon: 'folder' },
  { id: 'initiated', text: 'Initiated', icon: 'clock' },
  { id: 'in_progress', text: 'In Progress', icon: 'runner' },
  { id: 'completed', text: 'Completed', icon: 'check' },
  { id: 'closed', text: 'Closed', icon: 'save' },
];

// ============================================
// Component
// ============================================

export default function RecallsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [showMockDrill, setShowMockDrill] = useState(false);
  const [mockDrillLotId, setMockDrillLotId] = useState<number>(0);
  const [mockDrillResult, setMockDrillResult] = useState<MockDrillResult | null>(null);
  const [mockDrillLoading, setMockDrillLoading] = useState(false);

  // Get status filter from active tab
  const statusFilter = activeTab === 0 ? undefined : tabItems[activeTab].id as RecallStatus;

  // Fetch all recalls for stats (no filter)
  const { data: allData } = useQuery({
    queryKey: ['recalls-all'],
    queryFn: () => fetchRecalls(),
  });

  // Fetch filtered recalls for display
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['recalls', statusFilter],
    queryFn: () => fetchRecalls(statusFilter),
  });

  // Calculate stats
  const stats = useMemo(() => {
    const recalls = allData?.recalls || [];
    const activeRecalls = recalls.filter((r) => r.status !== 'closed');

    // Average effectiveness rate
    const completedRecalls = recalls.filter((r) => r.status === 'completed' || r.status === 'closed');
    const avgEffectiveness = completedRecalls.length > 0
      ? completedRecalls.reduce((sum, r) => sum + r.effectivenessRate, 0) / completedRecalls.length
      : 0;

    // Total distributed and returned
    const totalDistributed = activeRecalls.reduce((sum, r) => sum + r.distributedQuantity, 0);
    const totalReturned = activeRecalls.reduce((sum, r) => sum + r.returnedQuantity, 0);

    return {
      active: activeRecalls.length,
      classI: recalls.filter((r) => r.recallClass === 'class_i' && r.status !== 'closed').length,
      classII: recalls.filter((r) => r.recallClass === 'class_ii' && r.status !== 'closed').length,
      classIII: recalls.filter((r) => r.recallClass === 'class_iii' && r.status !== 'closed').length,
      initiated: recalls.filter((r) => r.status === 'initiated').length,
      inProgress: recalls.filter((r) => r.status === 'in_progress').length,
      completed: recalls.filter((r) => r.status === 'completed').length,
      closed: recalls.filter((r) => r.status === 'closed').length,
      avgEffectiveness,
      totalDistributed,
      totalReturned,
    };
  }, [allData]);

  // Prepare chart data
  const classChartData = useMemo(() => {
    const recalls = allData?.recalls || [];
    const activeRecalls = recalls.filter((r) => r.status !== 'closed');

    return [
      { class: 'Class I', count: activeRecalls.filter((r) => r.recallClass === 'class_i').length, color: CLASS_COLORS.class_i },
      { class: 'Class II', count: activeRecalls.filter((r) => r.recallClass === 'class_ii').length, color: CLASS_COLORS.class_ii },
      { class: 'Class III', count: activeRecalls.filter((r) => r.recallClass === 'class_iii').length, color: CLASS_COLORS.class_iii },
    ].filter(item => item.count > 0);
  }, [allData]);

  const statusChartData = useMemo(() => {
    const recalls = allData?.recalls || [];
    return [
      { status: 'Initiated', count: recalls.filter((r) => r.status === 'initiated').length, color: STATUS_COLORS.initiated },
      { status: 'In Progress', count: recalls.filter((r) => r.status === 'in_progress').length, color: STATUS_COLORS.in_progress },
      { status: 'Completed', count: recalls.filter((r) => r.status === 'completed').length, color: STATUS_COLORS.completed },
      { status: 'Closed', count: recalls.filter((r) => r.status === 'closed').length, color: STATUS_COLORS.closed },
    ].filter(item => item.count > 0);
  }, [allData]);

  // Monthly trend data
  const monthlyTrendData = useMemo(() => {
    const recalls = allData?.recalls || [];
    const months: Record<string, { initiated: number; closed: number }> = {};

    // Get last 6 months
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
  }, [allData]);

  // Recent critical recalls
  const criticalRecalls = useMemo(() => {
    const recalls = allData?.recalls || [];
    return recalls
      .filter((r) => r.recallClass === 'class_i' && r.status !== 'closed')
      .slice(0, 3);
  }, [allData]);

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

  const recalls = data?.recalls || [];

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive">Failed to load recalls</p>
          <DxButton
            text="Retry"
            icon="refresh"
            onClick={() => refetch()}
            className="mt-4"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title="Product Recalls"
        subtitle="Thai FDA GMP หมวด 9 - Recall Management Dashboard"
        icon={AlertTriangle}
        iconBgColor="bg-red-100"
        iconColor="text-red-600"
        actions={
          <div className="flex items-center gap-2">
            <DxButton
              text="Refresh"
              icon="refresh"
              onClick={() => refetch()}
              stylingMode="text"
            />
            <DxButton
              text="Mock Drill"
              icon="like"
              onClick={() => setShowMockDrill(true)}
              stylingMode="outlined"
            />
            <DxButton
              text="Initiate Recall"
              icon="add"
              onClick={() => router.push('/gmp/recalls/new')}
              type="danger"
            />
          </div>
        }
        breadcrumbs={[
          { label: 'GMP', href: '/gmp' },
          { label: 'Recalls' },
        ]}
      />

      {/* Critical Alert Banner */}
      {stats.classI > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-800 rounded-full">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-red-800 dark:text-red-200">
                  {stats.classI} Active Class I Recall{stats.classI > 1 ? 's' : ''}
                </h3>
                <p className="text-sm text-red-600 dark:text-red-300">
                  Critical recalls require immediate attention and regulatory reporting
                </p>
              </div>
            </div>
            <DxButton
              text="View Critical"
              icon="arrowright"
              onClick={() => setActiveTab(0)}
              type="danger"
              stylingMode="outlined"
            />
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Active Recalls"
          value={stats.active}
          icon={AlertTriangle}
          iconColor="text-orange-600"
          iconBgColor="bg-orange-100"
          trend={stats.active > 0 ? { value: stats.active, isPositive: false, label: 'requiring action' } : undefined}
        />
        <StatCard
          title="Class I (Critical)"
          value={stats.classI}
          icon={Package}
          iconColor="text-red-600"
          iconBgColor="bg-red-100"
        />
        <StatCard
          title="Class II (Major)"
          value={stats.classII}
          icon={Package}
          iconColor="text-yellow-600"
          iconBgColor="bg-yellow-100"
        />
        <StatCard
          title="In Progress"
          value={stats.inProgress}
          icon={Activity}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100"
        />
        <StatCard
          title="Awaiting Closure"
          value={stats.completed}
          icon={CheckCircle}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
        />
        <StatCard
          title="Avg Effectiveness"
          value={`${stats.avgEffectiveness.toFixed(1)}%`}
          icon={Target}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-100"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Recalls by Class */}
        <div className="bg-card border rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            By Recall Class
          </h3>
          {classChartData.length > 0 ? (
            <PieChart
              dataSource={classChartData}
              palette={classChartData.map(d => d.color)}
              size={{ height: 200 }}
            >
              <Series
                argumentField="class"
                valueField="count"
                innerRadius={0.6}
              >
                <Label visible position="inside" format="fixedPoint">
                  <Connector visible width={1} />
                </Label>
              </Series>
              <Legend
                visible
                horizontalAlignment="center"
                verticalAlignment="bottom"
              />
              <Tooltip enabled customizeTooltip={(arg: { argumentText: string; valueText: string }) => ({
                text: `${arg.argumentText}: ${arg.valueText} recalls`,
              })} />
            </PieChart>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              No active recalls
            </div>
          )}
        </div>

        {/* Recalls by Status */}
        <div className="bg-card border rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            By Status
          </h3>
          {statusChartData.length > 0 ? (
            <PieChart
              dataSource={statusChartData}
              palette={statusChartData.map(d => d.color)}
              size={{ height: 200 }}
            >
              <Series
                argumentField="status"
                valueField="count"
                innerRadius={0.6}
              >
                <Label visible position="inside" format="fixedPoint">
                  <Connector visible width={1} />
                </Label>
              </Series>
              <Legend
                visible
                horizontalAlignment="center"
                verticalAlignment="bottom"
              />
              <Tooltip enabled customizeTooltip={(arg: { argumentText: string; valueText: string }) => ({
                text: `${arg.argumentText}: ${arg.valueText} recalls`,
              })} />
            </PieChart>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              No recalls data
            </div>
          )}
        </div>

        {/* Quick Summary */}
        <div className="lg:col-span-2 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg shadow-sm p-6 text-white">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 opacity-90">
            <BarChart3 className="h-4 w-4" />
            Recall Overview
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
              <div className="text-3xl font-bold">{stats.totalDistributed.toLocaleString()}</div>
              <div className="text-sm opacity-80">Total Units Distributed</div>
            </div>
            <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
              <div className="text-3xl font-bold">{stats.totalReturned.toLocaleString()}</div>
              <div className="text-sm opacity-80">Total Units Returned</div>
            </div>
            <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
              <div className="text-3xl font-bold">{stats.closed}</div>
              <div className="text-sm opacity-80">Closed This Year</div>
            </div>
            <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
              <div className="text-3xl font-bold">{stats.avgEffectiveness.toFixed(0)}%</div>
              <div className="text-sm opacity-80">Avg Recovery Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recall Trend Chart */}
      <div className="bg-card border rounded-lg shadow-sm p-4">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Recall Trend (Last 6 Months)
        </h3>
        <Chart dataSource={monthlyTrendData} size={{ height: 250 }}>
          <CommonSeriesSettings type="bar" argumentField="month" />
          <ChartSeries valueField="initiated" name="Initiated" color="#f59e0b" />
          <ChartSeries valueField="closed" name="Closed" color="#10b981" />
          <ArgumentAxis>
            <ChartLabel rotationAngle={-45} />
          </ArgumentAxis>
          <ValueAxis>
            <ChartLabel format="fixedPoint" />
          </ValueAxis>
          <ChartLegend visible horizontalAlignment="center" verticalAlignment="bottom" />
          <ChartTooltip enabled />
        </Chart>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => router.push('/gmp/recalls/new')}
          className="bg-card border rounded-lg p-4 hover:border-primary hover:shadow-md transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg group-hover:bg-red-200 dark:group-hover:bg-red-800/50 transition-colors">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h4 className="font-medium">Initiate Recall</h4>
              <p className="text-xs text-muted-foreground">Start new recall</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground mt-2 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        <button
          onClick={() => setShowMockDrill(true)}
          className="bg-card border rounded-lg p-4 hover:border-primary hover:shadow-md transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-colors">
              <RefreshCw className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h4 className="font-medium">Mock Drill</h4>
              <p className="text-xs text-muted-foreground">Test traceability</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground mt-2 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        <button
          onClick={() => router.push('/gmp/recalls?status=completed')}
          className="bg-card border rounded-lg p-4 hover:border-primary hover:shadow-md transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg group-hover:bg-green-200 dark:group-hover:bg-green-800/50 transition-colors">
              <FileCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h4 className="font-medium">Pending Closure</h4>
              <p className="text-xs text-muted-foreground">Review completed</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground mt-2 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        <button
          onClick={() => router.push('/gmp/reports/recalls')}
          className="bg-card border rounded-lg p-4 hover:border-primary hover:shadow-md transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-800/50 transition-colors">
              <Clipboard className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h4 className="font-medium">Reports</h4>
              <p className="text-xs text-muted-foreground">View analytics</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground mt-2 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      {/* Critical Recalls Section */}
      {criticalRecalls.length > 0 && (
        <div className="bg-card border border-red-200 dark:border-red-800 rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4" />
            Active Class I Recalls
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {criticalRecalls.map((recall) => (
              <button
                key={recall.id}
                onClick={() => router.push(`/gmp/recalls/${recall.id}`)}
                className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg p-4 text-left hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-medium text-red-700 dark:text-red-300">
                    {recall.recallNumber}
                  </span>
                  <span className="px-2 py-0.5 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 text-xs rounded-full">
                    {STATUS_LABELS[recall.status]}
                  </span>
                </div>
                <h4 className="font-medium text-sm mb-1 line-clamp-1">{recall.productName}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">{recall.reason}</p>
                <div className="flex items-center justify-between mt-3 text-xs">
                  <span className="text-muted-foreground">
                    {recall.distributedQuantity.toLocaleString()} units
                  </span>
                  <span className={`font-medium ${recall.effectivenessRate >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                    {recall.effectivenessRate.toFixed(1)}% recovered
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs and Recalls List */}
      <div className="bg-card border rounded-lg shadow-sm">
        <div className="border-b px-4 pt-4">
          <DxTabs
            items={tabItems}
            selectedIndex={activeTab}
            onSelectedIndexChange={setActiveTab}
          />
        </div>
        <div className="p-4">
          <RecallList recalls={recalls} loading={isLoading} />
        </div>
      </div>

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
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800 dark:text-blue-200">Mock Drill Test</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Test your ability to trace product distribution within the FDA-required 4-hour window.
                      Enter a lot ID to test traceability.
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
                className={`p-4 rounded-lg ${
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
                <div className="p-4 bg-muted rounded-lg text-center">
                  <Users className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-2xl font-bold">{mockDrillResult.customersIdentified}</div>
                  <div className="text-xs text-muted-foreground">Customers Identified</div>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <Package className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-2xl font-bold">{mockDrillResult.totalDistributed}</div>
                  <div className="text-xs text-muted-foreground">Units Distributed</div>
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg space-y-1">
                <div className="text-sm flex items-center justify-between">
                  <span className="text-muted-foreground">Lot Number:</span>
                  <span className="font-mono font-medium">{mockDrillResult.lotNumber}</span>
                </div>
                <div className="text-sm flex items-center justify-between">
                  <span className="text-muted-foreground">Drill ID:</span>
                  <span className="font-mono">{mockDrillResult.drillId}</span>
                </div>
                <div className="text-sm flex items-center justify-between">
                  <span className="text-muted-foreground">Executed:</span>
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

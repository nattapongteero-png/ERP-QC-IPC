'use client';

/**
 * Quality Tests Page - Professional DevExtreme UI Design
 *
 * Features:
 * - Gradient header with quick stats
 * - Test type breakdown cards
 * - Status distribution chart
 * - Test trend chart
 * - Advanced DataGrid with filtering, grouping, export
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import DataGrid, {
  Column,
  Paging,
  Pager,
  SearchPanel,
  FilterRow,
  HeaderFilter,
  ColumnChooser,
  Export,
  Grouping,
  GroupPanel,
  Summary,
  TotalItem,
  Toolbar,
  Item,
  Scrolling,
  Selection,
} from 'devextreme-react/data-grid';
import PieChart, {
  Series as PieSeries,
  Label as PieLabel,
  Legend as PieLegend,
  Connector,
} from 'devextreme-react/pie-chart';
import Chart, {
  CommonSeriesSettings,
  Series,
  ArgumentAxis,
  ValueAxis,
  Legend,
  Tooltip,
} from 'devextreme-react/chart';
import { Workbook } from 'exceljs';
import { saveAs } from 'file-saver';
import { exportDataGrid } from 'devextreme/excel_exporter';
import type { ExportingEvent } from 'devextreme/ui/data_grid';
import {
  FlaskConical,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Plus,
  FileText,
  TrendingUp,
  Package,
  Beaker,
  ClipboardCheck,
  Eye,
  MoreHorizontal,
  Activity,
  BarChart3,
} from 'lucide-react';

interface QualityTest {
  id: number;
  lotId: number;
  lotNumber: string;
  specId: number;
  testName: string;
  testMethod: string;
  specification: string;
  minValue: number | null;
  maxValue: number | null;
  testType: string;
  sampleNumber: string;
  testDate: string;
  result: string;
  numericResult: number | null;
  status: string;
  createdAt: string;
}

type TestStatus = 'pending' | 'pass' | 'fail' | 'retest';
type TestType = 'incoming' | 'in_process' | 'final';

const statusConfig: Record<TestStatus, {
  label: string;
  labelTh: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  chartColor: string;
  icon: React.ReactNode;
}> = {
  pending: {
    label: 'Pending',
    labelTh: 'รอทดสอบ',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-200',
    chartColor: '#64748b',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  pass: {
    label: 'Pass',
    labelTh: 'ผ่าน',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    chartColor: '#10b981',
    icon: <CheckCircle className="h-3.5 w-3.5" />,
  },
  fail: {
    label: 'Fail',
    labelTh: 'ไม่ผ่าน',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
    chartColor: '#ef4444',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  retest: {
    label: 'Retest',
    labelTh: 'ทดสอบซ้ำ',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    chartColor: '#f59e0b',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
};

const testTypeConfig: Record<TestType, {
  label: string;
  labelTh: string;
  description: string;
  bgGradient: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
}> = {
  incoming: {
    label: 'Incoming QC',
    labelTh: 'QC รับเข้า',
    description: 'Raw Material Inspection',
    bgGradient: 'from-blue-500 to-blue-600',
    iconBg: 'bg-blue-400/30',
    iconColor: 'text-white',
    icon: <Package className="h-5 w-5" />,
  },
  in_process: {
    label: 'In-Process QC',
    labelTh: 'QC ระหว่างผลิต',
    description: 'Production Monitoring',
    bgGradient: 'from-amber-500 to-amber-600',
    iconBg: 'bg-amber-400/30',
    iconColor: 'text-white',
    icon: <Beaker className="h-5 w-5" />,
  },
  final: {
    label: 'Final QC',
    labelTh: 'QC สุดท้าย',
    description: 'Finished Product Release',
    bgGradient: 'from-emerald-500 to-emerald-600',
    iconBg: 'bg-emerald-400/30',
    iconColor: 'text-white',
    icon: <ClipboardCheck className="h-5 w-5" />,
  },
};

// Helper Components
function MetricCard({
  value,
  label,
  color = 'text-gray-900'
}: {
  value: number | string;
  label: string;
  color?: string;
}) {
  return (
    <div className="text-center px-4 py-3">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function TestTypeCard({
  type,
  count,
  passRate,
}: {
  type: TestType;
  count: number;
  passRate: number;
}) {
  const config = testTypeConfig[type];
  return (
    <div className={`bg-gradient-to-br ${config.bgGradient} rounded-xl p-4 text-white shadow-lg`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 ${config.iconBg} rounded-lg`}>
            {config.icon}
          </div>
          <div>
            <p className="font-semibold">{config.label}</p>
            <p className="text-xs text-white/70">{config.description}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{count}</p>
          <p className="text-xs text-white/70">
            {passRate > 0 ? `${passRate.toFixed(0)}% pass` : 'No data'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function QualityTestsPage() {
  const router = useRouter();
  const [tests, setTests] = useState<QualityTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');

  const fetchTests = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');

      const res = await fetch(`/api/quality/tests?${params}`);
      const data = await res.json();

      if (data.success) {
        setTests(data.data?.items || []);
      } else {
        console.error('API error:', data.error);
        setTests([]);
      }
    } catch (error) {
      console.error('Failed to fetch quality tests:', error);
      setTests([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  // Calculate statistics
  const stats = useMemo(() => {
    const pending = tests.filter(t => t.status === 'pending').length;
    const pass = tests.filter(t => t.status === 'pass').length;
    const fail = tests.filter(t => t.status === 'fail').length;
    const retest = tests.filter(t => t.status === 'retest').length;
    const total = tests.length;
    const completed = pass + fail;
    const passRate = completed > 0 ? (pass / completed) * 100 : 0;

    // By test type
    const byType = {
      incoming: tests.filter(t => t.testType === 'incoming'),
      in_process: tests.filter(t => t.testType === 'in_process'),
      final: tests.filter(t => t.testType === 'final'),
    };

    const typeStats = Object.entries(byType).reduce((acc, [type, typeTests]) => {
      const typePass = typeTests.filter(t => t.status === 'pass').length;
      const typeCompleted = typeTests.filter(t => t.status === 'pass' || t.status === 'fail').length;
      acc[type as TestType] = {
        count: typeTests.length,
        passRate: typeCompleted > 0 ? (typePass / typeCompleted) * 100 : 0,
      };
      return acc;
    }, {} as Record<TestType, { count: number; passRate: number }>);

    // Today's tests
    const today = new Date().toISOString().split('T')[0];
    const todayTests = tests.filter(t => t.testDate?.startsWith(today)).length;

    // This week's tests
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const thisWeek = tests.filter(t => {
      if (!t.testDate) return false;
      return new Date(t.testDate) >= weekAgo;
    }).length;

    return {
      total,
      pending,
      pass,
      fail,
      retest,
      passRate,
      typeStats,
      todayTests,
      thisWeek,
    };
  }, [tests]);

  // Filtered data based on active tab
  const filteredTests = useMemo(() => {
    if (activeTab === 'all') return tests;
    if (activeTab === 'pending') return tests.filter(t => t.status === 'pending');
    if (activeTab === 'pass') return tests.filter(t => t.status === 'pass');
    if (activeTab === 'fail') return tests.filter(t => t.status === 'fail');
    if (activeTab === 'retest') return tests.filter(t => t.status === 'retest');
    return tests;
  }, [tests, activeTab]);

  // Chart data
  const statusChartData = useMemo(() => {
    return [
      { status: 'Pass', count: stats.pass, color: statusConfig.pass.chartColor },
      { status: 'Fail', count: stats.fail, color: statusConfig.fail.chartColor },
      { status: 'Pending', count: stats.pending, color: statusConfig.pending.chartColor },
      { status: 'Retest', count: stats.retest, color: statusConfig.retest.chartColor },
    ].filter(d => d.count > 0);
  }, [stats]);

  const typeChartData = useMemo(() => {
    return [
      { type: 'Incoming QC', count: stats.typeStats.incoming?.count || 0 },
      { type: 'In-Process QC', count: stats.typeStats.in_process?.count || 0 },
      { type: 'Final QC', count: stats.typeStats.final?.count || 0 },
    ];
  }, [stats]);

  // Export handler
  const handleExporting = (e: ExportingEvent) => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Quality Tests');

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }) => {
        if (gridCell?.rowType === 'header') {
          excelCell.font = { bold: true };
          excelCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE3F2FD' },
          };
        }
      },
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Quality_Tests_${new Date().toISOString().split('T')[0]}.xlsx`
        );
      });
    });
    e.cancel = true;
  };

  // Cell renderers
  const renderLotCell = (cellData: { data: QualityTest }) => {
    const test = cellData.data;
    return (
      <div className="min-w-0">
        <p className="font-mono font-semibold text-blue-700">{test.lotNumber || '-'}</p>
        {test.sampleNumber && (
          <p className="text-xs text-gray-500 truncate">Sample: {test.sampleNumber}</p>
        )}
      </div>
    );
  };

  const renderTestCell = (cellData: { data: QualityTest }) => {
    const test = cellData.data;
    return (
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">{test.testName || '-'}</p>
        {test.testMethod && (
          <p className="text-xs text-gray-500 truncate">{test.testMethod}</p>
        )}
      </div>
    );
  };

  const renderTypeCell = (cellData: { data: QualityTest }) => {
    const type = cellData.data.testType as TestType;
    const config = testTypeConfig[type];
    if (!config) return <span className="text-gray-400">{type}</span>;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${config.bgGradient} text-white`}>
        {config.icon}
        {config.labelTh}
      </span>
    );
  };

  const renderSpecCell = (cellData: { data: QualityTest }) => {
    const test = cellData.data;
    if (test.specification) {
      return <span className="text-sm">{test.specification}</span>;
    }
    if (test.minValue !== null || test.maxValue !== null) {
      return (
        <span className="text-sm font-mono">
          {test.minValue !== null && `${test.minValue}`}
          {test.minValue !== null && test.maxValue !== null && ' - '}
          {test.maxValue !== null && `${test.maxValue}`}
        </span>
      );
    }
    return <span className="text-gray-400">-</span>;
  };

  const renderResultCell = (cellData: { data: QualityTest }) => {
    const test = cellData.data;
    if (test.numericResult !== null) {
      return <span className="font-mono font-medium">{test.numericResult}</span>;
    }
    if (test.result) {
      return <span className="font-medium">{test.result}</span>;
    }
    return <span className="text-gray-400">-</span>;
  };

  const renderStatusCell = (cellData: { data: QualityTest }) => {
    const status = cellData.data.status as TestStatus;
    const config = statusConfig[status];
    if (!config) return <span className="text-gray-400">{status}</span>;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
        {config.icon}
        {config.labelTh}
      </span>
    );
  };

  const renderActionsCell = (cellData: { data: QualityTest }) => {
    const test = cellData.data;
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/quality/tests/${test.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title="View Details"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
          title="More Options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="flex flex-col h-full gap-6 -m-4 md:-m-6">
        {/* Professional Header */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 p-6 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <FlaskConical className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Quality Control Tests</h1>
                <p className="text-blue-100 text-sm">การทดสอบคุณภาพ - QC Testing Dashboard</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={fetchTests}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors backdrop-blur-sm"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium">Refresh</span>
              </button>
              <button
                onClick={() => router.push('/quality/specs')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors backdrop-blur-sm"
              >
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">Specifications</span>
              </button>
              <button
                onClick={() => router.push('/quality/tests/new')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-blue-50 text-blue-600 rounded-lg transition-colors font-medium"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm">New Test</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="mx-4 md:mx-6 -mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-x divide-gray-200 bg-white rounded-xl shadow-lg border border-gray-100">
            <MetricCard value={stats.total} label="Total Tests" />
            <MetricCard value={stats.pending} label="Pending" color="text-slate-600" />
            <MetricCard value={stats.pass} label="Passed" color="text-emerald-600" />
            <MetricCard value={stats.fail} label="Failed" color="text-red-600" />
            <MetricCard value={stats.retest} label="Retest" color="text-amber-600" />
            <MetricCard value={`${stats.passRate.toFixed(1)}%`} label="Pass Rate" color="text-blue-600" />
            <MetricCard value={stats.todayTests} label="Today" color="text-indigo-600" />
            <MetricCard value={stats.thisWeek} label="This Week" color="text-purple-600" />
          </div>
        </div>

        {/* Main Content */}
        <div className="px-4 md:px-6 pb-6 flex-1 flex flex-col gap-6">
          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left Column - Charts */}
            <div className="xl:col-span-2 space-y-6">
              {/* Test Type Cards */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">Tests by Type</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <TestTypeCard
                    type="incoming"
                    count={stats.typeStats.incoming?.count || 0}
                    passRate={stats.typeStats.incoming?.passRate || 0}
                  />
                  <TestTypeCard
                    type="in_process"
                    count={stats.typeStats.in_process?.count || 0}
                    passRate={stats.typeStats.in_process?.passRate || 0}
                  />
                  <TestTypeCard
                    type="final"
                    count={stats.typeStats.final?.count || 0}
                    passRate={stats.typeStats.final?.passRate || 0}
                  />
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Status Distribution */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Status Distribution</h3>
                  </div>
                  {statusChartData.length > 0 ? (
                    <PieChart
                      dataSource={statusChartData}
                      type="doughnut"
                      innerRadius={0.65}
                      palette={statusChartData.map(d => d.color)}
                      size={{ height: 220 }}
                    >
                      <PieSeries argumentField="status" valueField="count">
                        <PieLabel visible format="fixedPoint" customizeText={(arg) => `${arg.percentText}`}>
                          <Connector visible width={1} />
                        </PieLabel>
                      </PieSeries>
                      <PieLegend
                        verticalAlignment="bottom"
                        horizontalAlignment="center"
                        itemTextPosition="right"
                      />
                    </PieChart>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[220px] text-gray-400">
                      <TrendingUp className="h-12 w-12 mb-2 opacity-50" />
                      <p className="text-sm">No test data</p>
                    </div>
                  )}
                </div>

                {/* Tests by Type Chart */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Tests by Category</h3>
                  </div>
                  {typeChartData.some(d => d.count > 0) ? (
                    <Chart dataSource={typeChartData} size={{ height: 220 }}>
                      <CommonSeriesSettings
                        argumentField="type"
                        valueField="count"
                        type="bar"
                        barWidth={40}
                        color="#3b82f6"
                      />
                      <Series />
                      <ArgumentAxis>
                        <Label visible />
                      </ArgumentAxis>
                      <ValueAxis />
                      <Legend visible={false} />
                      <Tooltip enabled />
                    </Chart>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[220px] text-gray-400">
                      <BarChart3 className="h-12 w-12 mb-2 opacity-50" />
                      <p className="text-sm">No test data</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Summary */}
            <div className="space-y-6">
              {/* Pass Rate Summary */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-semibold text-gray-900">Pass Rate Summary</h3>
                </div>
                <div className="space-y-4">
                  {/* Overall Pass Rate */}
                  <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl">
                    <p className="text-4xl font-bold text-emerald-600">
                      {stats.passRate.toFixed(1)}%
                    </p>
                    <p className="text-sm text-emerald-700 mt-1">Overall Pass Rate</p>
                  </div>

                  {/* By Type */}
                  <div className="space-y-3">
                    {(['incoming', 'in_process', 'final'] as TestType[]).map(type => {
                      const config = testTypeConfig[type];
                      const typeStats = stats.typeStats[type];
                      return (
                        <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 bg-gradient-to-r ${config.bgGradient} rounded text-white`}>
                              {config.icon}
                            </div>
                            <span className="text-sm font-medium text-gray-700">{config.labelTh}</span>
                          </div>
                          <span className={`text-sm font-bold ${typeStats?.passRate >= 90 ? 'text-emerald-600' : typeStats?.passRate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                            {typeStats?.passRate ? `${typeStats.passRate.toFixed(0)}%` : '-'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">Quick Stats</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-blue-700">Total Tests</span>
                    </div>
                    <span className="text-lg font-bold text-blue-700">{stats.total}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-600" />
                      <span className="text-sm text-slate-700">Pending</span>
                    </div>
                    <span className="text-lg font-bold text-slate-700">{stats.pending}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm text-emerald-700">Passed</span>
                    </div>
                    <span className="text-lg font-bold text-emerald-700">{stats.pass}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-red-50 to-red-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-red-700">Failed</span>
                    </div>
                    <span className="text-lg font-bold text-red-700">{stats.fail}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-amber-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span className="text-sm text-amber-700">Retest</span>
                    </div>
                    <span className="text-lg font-bold text-amber-700">{stats.retest}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DataGrid Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1">
            {/* Tabs Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex gap-1">
                {[
                  { key: 'all', label: 'All Tests', count: stats.total },
                  { key: 'pending', label: 'Pending', count: stats.pending },
                  { key: 'pass', label: 'Passed', count: stats.pass },
                  { key: 'fail', label: 'Failed', count: stats.fail },
                  { key: 'retest', label: 'Retest', count: stats.retest },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tab.label}
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                      activeTab === tab.key
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <FlaskConical className="h-4 w-4" />
                <span>{filteredTests.length} tests</span>
              </div>
            </div>

            {/* DataGrid */}
            <div className="quality-tests-grid">
              <DataGrid
                dataSource={filteredTests}
                showBorders={false}
                showRowLines
                showColumnLines={false}
                rowAlternationEnabled
                hoverStateEnabled
                height={500}
                columnAutoWidth
                wordWrapEnabled={false}
                onExporting={handleExporting}
                onRowClick={(e) => {
                  if (e.data && e.rowType === 'data') {
                    router.push(`/quality/tests/${e.data.id}`);
                  }
                }}
                className="dx-card"
              >
                {/* Toolbar */}
                <Toolbar>
                  <Item name="groupPanel" />
                  <Item location="after" name="columnChooserButton" />
                  <Item location="after" name="exportButton" />
                  <Item location="after" name="searchPanel" />
                </Toolbar>

                {/* Features */}
                <SearchPanel visible placeholder="Search tests..." width={250} />
                <FilterRow visible />
                <HeaderFilter visible />
                <ColumnChooser enabled mode="select" />
                <Grouping autoExpandAll={false} />
                <GroupPanel visible />
                <Scrolling mode="virtual" />
                <Selection mode="single" />

                {/* Export */}
                <Export enabled allowExportSelectedData formats={['xlsx']} />

                {/* Paging */}
                <Paging defaultPageSize={15} />
                <Pager
                  showPageSizeSelector
                  allowedPageSizes={[10, 15, 25, 50]}
                  showInfo
                  showNavigationButtons
                  displayMode="adaptive"
                />

                {/* Columns */}
                <Column
                  dataField="lotNumber"
                  caption="Lot / Sample"
                  width={160}
                  fixed
                  cellRender={renderLotCell}
                />
                <Column
                  caption="Test Name"
                  minWidth={200}
                  cellRender={renderTestCell}
                  allowFiltering={false}
                />
                <Column
                  dataField="testType"
                  caption="Type"
                  width={140}
                  cellRender={renderTypeCell}
                />
                <Column
                  caption="Specification"
                  width={150}
                  cellRender={renderSpecCell}
                  allowFiltering={false}
                />
                <Column
                  caption="Result"
                  width={100}
                  cellRender={renderResultCell}
                  allowFiltering={false}
                />
                <Column
                  dataField="testDate"
                  caption="Test Date"
                  dataType="date"
                  format="dd MMM yyyy"
                  width={120}
                />
                <Column
                  dataField="status"
                  caption="Status"
                  width={120}
                  cellRender={renderStatusCell}
                />
                <Column
                  caption=""
                  width={80}
                  cellRender={renderActionsCell}
                  allowFiltering={false}
                  allowSorting={false}
                  allowGrouping={false}
                  fixed
                  fixedPosition="right"
                />

                {/* Summary */}
                <Summary>
                  <TotalItem column="lotNumber" summaryType="count" displayFormat="Total: {0}" />
                </Summary>
              </DataGrid>

              <style jsx global>{`
                .quality-tests-grid .dx-datagrid {
                  background: transparent;
                }
                .quality-tests-grid .dx-datagrid-headers {
                  background: linear-gradient(to bottom, #f9fafb, #f3f4f6);
                  border-bottom: 2px solid #e5e7eb;
                }
                .quality-tests-grid .dx-datagrid-headers .dx-header-row > td {
                  font-weight: 600;
                  color: #374151;
                  padding: 12px 8px;
                }
                .quality-tests-grid .dx-datagrid-rowsview .dx-row > td {
                  padding: 10px 8px;
                  vertical-align: middle;
                }
                .quality-tests-grid .dx-datagrid-rowsview .dx-row:hover {
                  background-color: #eff6ff !important;
                  cursor: pointer;
                }
                .quality-tests-grid .dx-datagrid-rowsview .dx-row-alt > td {
                  background-color: #fafafa;
                }
                .quality-tests-grid .dx-datagrid-search-panel {
                  margin-left: 0;
                }
                .quality-tests-grid .dx-toolbar {
                  padding: 8px 12px;
                  background: #f9fafb;
                  border-bottom: 1px solid #e5e7eb;
                }
                .quality-tests-grid .dx-datagrid-group-panel {
                  padding: 8px;
                }
                .quality-tests-grid .dx-datagrid-pager {
                  padding: 12px;
                  background: #f9fafb;
                  border-top: 1px solid #e5e7eb;
                }
              `}</style>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

// Missing Label import for Chart
import { Label } from 'devextreme-react/chart';

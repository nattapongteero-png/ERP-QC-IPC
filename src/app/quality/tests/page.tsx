'use client';

/**
 * Quality Tests Dashboard Page
 *
 * Professional dashboard for viewing and managing quality control tests.
 * Redesigned with DevExtreme UI components following GMP module patterns.
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  SearchPanel,
  HeaderFilter,
  Scrolling,
  Export,
} from 'devextreme-react/data-grid';
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
import { DxButton } from '@/components/ui/dx-button';
import { DxTabs } from '@/components/ui/dx-tabs';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
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
  FileText,
  TrendingUp,
  Package,
  Beaker,
  ClipboardCheck,
  Eye,
  Activity,
  BarChart3,
  Calendar,
  Percent,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface QualityTest {
  id: number;
  lotId: number;
  lotNumber: string;
  itemId: number | null;
  itemCode: string | null;
  itemName: string | null;
  specId: number;
  testName: string;
  testMethod: string;
  specification: string;
  minValue: number | null;
  maxValue: number | null;
  testType: 'incoming' | 'in_process' | 'final';
  sampleNumber: string;
  testDate: string;
  result: string;
  numericResult: number | null;
  status: 'pending' | 'pass' | 'fail' | 'retest';
  createdAt: string;
  // Disposition fields (FR-067 to FR-070)
  disposition?: string | null;
  dispositionReason?: string | null;
  dispositionBy?: number | null;
  dispositionApprovedBy?: number | null;
}

// ============================================
// Constants
// ============================================

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    labelTh: 'รอทดสอบ',
    color: '#64748b',
    bgClass: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: Clock,
  },
  pass: {
    label: 'Pass',
    labelTh: 'ผ่าน',
    color: '#22c55e',
    bgClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: CheckCircle,
  },
  fail: {
    label: 'Fail',
    labelTh: 'ไม่ผ่าน',
    color: '#ef4444',
    bgClass: 'bg-red-100 text-red-700 border-red-200',
    icon: XCircle,
  },
  retest: {
    label: 'Retest',
    labelTh: 'ทดสอบซ้ำ',
    color: '#f59e0b',
    bgClass: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: AlertTriangle,
  },
} as const;

// Disposition status config for FR-067 to FR-070
const DISPOSITION_CONFIG = {
  pending_disposition: {
    label: 'Needs Disposition',
    labelTh: 'รอตัดสินใจ',
    bgClass: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: AlertTriangle,
  },
  pending_approval: {
    label: 'Needs Approval',
    labelTh: 'รออนุมัติ',
    bgClass: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Clock,
  },
  approved: {
    label: 'Approved',
    labelTh: 'อนุมัติแล้ว',
    bgClass: 'bg-green-100 text-green-700 border-green-200',
    icon: CheckCircle,
  },
} as const;

const TYPE_CONFIG = {
  incoming: {
    label: 'Incoming QC',
    labelTh: 'QC รับเข้า',
    description: 'Raw Material Inspection',
    gradient: 'from-blue-500 to-blue-600',
    icon: Package,
  },
  in_process: {
    label: 'In-Process QC',
    labelTh: 'QC ระหว่างผลิต',
    description: 'Production Monitoring',
    gradient: 'from-amber-500 to-amber-600',
    icon: Beaker,
  },
  final: {
    label: 'Final QC',
    labelTh: 'QC สุดท้าย',
    description: 'Finished Product Release',
    gradient: 'from-emerald-500 to-emerald-600',
    icon: ClipboardCheck,
  },
} as const;

// ============================================
// API Functions
// ============================================

async function fetchTests(): Promise<QualityTest[]> {
  const response = await fetch('/api/quality/tests?limit=1000');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch tests');
  }
  return result.data?.items || [];
}

// ============================================
// Component
// ============================================

export default function QualityTestsPage() {
  const router = useRouter();
  const t = useTranslations('quality');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  // Fetch quality tests
  const { data: tests = [], isLoading, refetch } = useQuery({
    queryKey: ['quality-tests'],
    queryFn: fetchTests,
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const pending = tests.filter(t => t.status === 'pending').length;
    const pass = tests.filter(t => t.status === 'pass').length;
    const fail = tests.filter(t => t.status === 'fail').length;
    const retest = tests.filter(t => t.status === 'retest').length;
    const total = tests.length;
    const completed = pass + fail;
    const passRate = completed > 0 ? (pass / completed) * 100 : 0;

    // By type
    const byType = {
      incoming: tests.filter(t => t.testType === 'incoming'),
      in_process: tests.filter(t => t.testType === 'in_process'),
      final: tests.filter(t => t.testType === 'final'),
    };

    const typeStats = (Object.keys(byType) as Array<keyof typeof byType>).reduce((acc, type) => {
      const typeTests = byType[type];
      const typePass = typeTests.filter(t => t.status === 'pass').length;
      const typeCompleted = typeTests.filter(t => ['pass', 'fail'].includes(t.status)).length;
      acc[type] = {
        count: typeTests.length,
        passRate: typeCompleted > 0 ? (typePass / typeCompleted) * 100 : 0,
      };
      return acc;
    }, {} as Record<string, { count: number; passRate: number }>);

    // Today's tests
    const today = new Date().toISOString().split('T')[0];
    const todayTests = tests.filter(t => t.testDate?.startsWith(today)).length;

    // Disposition stats (FR-067 to FR-070)
    const needsDisposition = tests.filter(t =>
      (t.status === 'fail' || t.status === 'retest') && !t.disposition
    ).length;
    const needsApproval = tests.filter(t =>
      t.disposition && !t.dispositionApprovedBy
    ).length;

    return { total, pending, pass, fail, retest, passRate, typeStats, todayTests, needsDisposition, needsApproval };
  }, [tests]);

  // Filtered tests based on status
  const filteredTests = useMemo(() => {
    if (!statusFilter) return tests;
    return tests.filter(t => t.status === statusFilter);
  }, [tests, statusFilter]);

  // Chart data
  const statusChartData = useMemo(() => {
    return [
      { status: 'Pass', count: stats.pass, color: STATUS_CONFIG.pass.color },
      { status: 'Fail', count: stats.fail, color: STATUS_CONFIG.fail.color },
      { status: 'Pending', count: stats.pending, color: STATUS_CONFIG.pending.color },
      { status: 'Retest', count: stats.retest, color: STATUS_CONFIG.retest.color },
    ].filter(d => d.count > 0);
  }, [stats]);

  const typeChartData = useMemo(() => {
    return [
      { type: 'Incoming', count: stats.typeStats.incoming?.count || 0 },
      { type: 'In-Process', count: stats.typeStats.in_process?.count || 0 },
      { type: 'Final', count: stats.typeStats.final?.count || 0 },
    ];
  }, [stats]);

  // Status tabs
  const statusTabs = [
    { id: 0, text: 'All', icon: 'selectall' },
    { id: 1, text: 'Pending', icon: 'clock' },
    { id: 2, text: 'Passed', icon: 'check' },
    { id: 3, text: 'Failed', icon: 'close' },
    { id: 4, text: 'Retest', icon: 'warning' },
  ];

  const handleTabChange = (index: number) => {
    const statusMap: (string | undefined)[] = [undefined, 'pending', 'pass', 'fail', 'retest'];
    setStatusFilter(statusMap[index]);
  };

  // Export handler
  const handleExporting = useCallback((e: ExportingEvent) => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Quality Tests');

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Quality_Tests_${new Date().toISOString().split('T')[0]}.xlsx`
        );
      });
    });
    e.cancel = true;
  }, []);

  // Cell renderers
  const renderLotCell = useCallback((data: { data: QualityTest }) => (
    <div className="min-w-0">
      <p className="font-mono font-semibold text-blue-600">{data.data.lotNumber || '-'}</p>
      {data.data.itemName && (
        <p className="text-xs text-gray-700 truncate">{data.data.itemName}</p>
      )}
      {data.data.sampleNumber && (
        <p className="text-xs text-gray-500">Sample: {data.data.sampleNumber}</p>
      )}
    </div>
  ), []);

  const renderTestCell = useCallback((data: { data: QualityTest }) => (
    <div className="min-w-0">
      <p className="font-medium text-gray-900 truncate">{data.data.testName || '-'}</p>
      {data.data.testMethod && (
        <p className="text-xs text-gray-500 truncate">{data.data.testMethod}</p>
      )}
    </div>
  ), []);

  const renderTypeCell = useCallback((data: { data: QualityTest }) => {
    const config = TYPE_CONFIG[data.data.testType];
    if (!config) return <span className="text-gray-400">{data.data.testType}</span>;
    const IconComponent = config.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${config.gradient} text-white`}>
        <IconComponent className="h-3 w-3" />
        {config.labelTh}
      </span>
    );
  }, []);

  const renderSpecCell = useCallback((data: { data: QualityTest }) => {
    const test = data.data;
    if (test.specification) return <span className="text-sm">{test.specification}</span>;
    if (test.minValue !== null || test.maxValue !== null) {
      return (
        <span className="text-sm font-mono">
          {test.minValue !== null && test.minValue}
          {test.minValue !== null && test.maxValue !== null && ' - '}
          {test.maxValue !== null && test.maxValue}
        </span>
      );
    }
    return <span className="text-gray-400">-</span>;
  }, []);

  const renderResultCell = useCallback((data: { data: QualityTest }) => {
    const test = data.data;
    if (test.numericResult !== null) return <span className="font-mono font-medium">{test.numericResult}</span>;
    if (test.result) return <span className="font-medium">{test.result}</span>;
    return <span className="text-gray-400">-</span>;
  }, []);

  const renderStatusCell = useCallback((data: { data: QualityTest }) => {
    const config = STATUS_CONFIG[data.data.status];
    if (!config) return <span className="text-gray-400">{data.data.status}</span>;
    const IconComponent = config.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bgClass}`}>
        <IconComponent className="h-3 w-3" />
        {config.labelTh}
      </span>
    );
  }, []);

  // Disposition status cell renderer (FR-067 to FR-070)
  const renderDispositionCell = useCallback((data: { data: QualityTest }) => {
    const test = data.data;
    // Only show disposition status for failed/retest tests
    if (test.status !== 'fail' && test.status !== 'retest') {
      return <span className="text-gray-400">-</span>;
    }

    let configKey: keyof typeof DISPOSITION_CONFIG;
    if (test.dispositionApprovedBy) {
      configKey = 'approved';
    } else if (test.disposition) {
      configKey = 'pending_approval';
    } else {
      configKey = 'pending_disposition';
    }

    const config = DISPOSITION_CONFIG[configKey];
    const IconComponent = config.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${config.bgClass}`}>
        <IconComponent className="h-3 w-3" />
        {config.labelTh}
      </span>
    );
  }, []);

  const renderActionsCell = useCallback((data: { data: QualityTest }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        router.push(`/quality/tests/${data.data.id}`);
      }}
      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
      title="View Details"
    >
      <Eye className="h-4 w-4" />
    </button>
  ), [router]);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1800px] mx-auto">
      {/* Page Header */}
      <ResponsivePageHeader
        title={t('inspections.title')}
        subtitle={t('inspections.description')}
        icon={FlaskConical}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: 'Quality', href: '/quality' },
          { label: 'Tests' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <DxButton
              icon="refresh"
              type="default"
              stylingMode="outlined"
              hint="Refresh"
              onClick={() => refetch()}
            />
            <DxButton
              icon="doc"
              text="Specifications"
              type="default"
              stylingMode="outlined"
              onClick={() => router.push('/quality/specs')}
            />
            <DxButton
              icon="plus"
              text="New Test"
              type="success"
              onClick={() => router.push('/quality/tests/new')}
            />
          </div>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 md:gap-4">
        <StatCard
          label="Total Tests"
          value={stats.total}
          icon={FlaskConical}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Pending"
          value={stats.pending}
          icon={Clock}
          iconColor="text-slate-500"
          accentColor="border-slate-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Passed"
          value={stats.pass}
          icon={CheckCircle}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Failed"
          value={stats.fail}
          icon={XCircle}
          iconColor="text-red-500"
          accentColor="border-red-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Retest"
          value={stats.retest}
          icon={AlertTriangle}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Pass Rate"
          value={`${stats.passRate.toFixed(1)}%`}
          icon={Percent}
          iconColor="text-indigo-500"
          accentColor="border-indigo-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Today"
          value={stats.todayTests}
          icon={Calendar}
          iconColor="text-purple-500"
          accentColor="border-purple-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Incoming QC"
          value={stats.typeStats.incoming?.count || 0}
          icon={Package}
          iconColor="text-cyan-500"
          accentColor="border-cyan-500"
          isLoading={isLoading}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Status Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              By Status
            </h3>
          </div>
          {statusChartData.length > 0 ? (
            <PieChart
              id="status-pie"
              dataSource={statusChartData}
              type="doughnut"
              innerRadius={0.65}
              palette={statusChartData.map(d => d.color)}
              size={{ height: 200 }}
            >
              <Series argumentField="status" valueField="count">
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
                <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No data</p>
              </div>
            </div>
          )}
        </div>

        {/* Tests by Type */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              Tests by Category
            </h3>
          </div>
          {typeChartData.some(d => d.count > 0) ? (
            <Chart id="type-chart" dataSource={typeChartData} size={{ height: 200 }}>
              <CommonSeriesSettings argumentField="type" type="bar" color="#6366f1" />
              <ChartSeries valueField="count" name="Tests" color="#6366f1" />
              <ArgumentAxis>
                <ChartLabel overlappingBehavior="rotate" rotationAngle={-45} />
              </ArgumentAxis>
              <ValueAxis />
              <ChartLegend visible={false} />
              <ChartTooltip
                enabled={true}
                customizeTooltip={(arg: { argumentText?: string; valueText?: string }) => ({
                  text: `${arg.argumentText}: ${arg.valueText} tests`,
                })}
              />
            </Chart>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No data</p>
              </div>
            </div>
          )}
        </div>

        {/* Pass Rate by Type */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              Pass Rate by Type
            </h3>
          </div>
          <div className="space-y-3">
            {/* Overall */}
            <div className="p-3 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">Overall</span>
                </div>
                <span className="text-lg font-bold text-emerald-600">
                  {stats.passRate.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* By Type */}
            {(Object.keys(TYPE_CONFIG) as Array<keyof typeof TYPE_CONFIG>).map(type => {
              const config = TYPE_CONFIG[type];
              const typeStats = stats.typeStats[type];
              const IconComponent = config.icon;
              return (
                <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 bg-gradient-to-r ${config.gradient} rounded text-white`}>
                      <IconComponent className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{config.labelTh}</span>
                  </div>
                  <span className={`text-sm font-bold ${
                    (typeStats?.passRate || 0) >= 90 ? 'text-emerald-600' :
                    (typeStats?.passRate || 0) >= 70 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {typeStats?.passRate ? `${typeStats.passRate.toFixed(0)}%` : 'N/A'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Test Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.keys(TYPE_CONFIG) as Array<keyof typeof TYPE_CONFIG>).map(type => {
          const config = TYPE_CONFIG[type];
          const typeStats = stats.typeStats[type];
          const IconComponent = config.icon;
          return (
            <div key={type} className={`bg-gradient-to-br ${config.gradient} rounded-xl p-5 text-white shadow-lg`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 rounded-lg backdrop-blur-sm">
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{config.label}</p>
                    <p className="text-sm text-white/70">{config.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">{typeStats?.count || 0}</p>
                  <p className="text-sm text-white/70">
                    {(typeStats?.passRate || 0) > 0 ? `${typeStats.passRate.toFixed(0)}% pass` : 'No data'}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content - Tabs + DataGrid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tabs Header */}
        <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <DxTabs
              items={statusTabs}
              selectedIndex={
                statusFilter === undefined ? 0 :
                statusFilter === 'pending' ? 1 :
                statusFilter === 'pass' ? 2 :
                statusFilter === 'fail' ? 3 : 4
              }
              onSelectedIndexChange={handleTabChange}
              stylingMode="secondary"
            />
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <FlaskConical className="w-4 h-4" />
                {filteredTests.length} tests
              </span>
            </div>
          </div>
        </div>

        {/* DataGrid */}
        <DataGrid
          dataSource={filteredTests}
          showBorders={false}
          showRowLines={true}
          showColumnLines={false}
          rowAlternationEnabled={true}
          hoverStateEnabled={true}
          height={500}
          columnAutoWidth={true}
          wordWrapEnabled={false}
          onExporting={handleExporting}
          onRowClick={(e) => {
            if (e.data && e.rowType === 'data') {
              router.push(`/quality/tests/${e.data.id}`);
            }
          }}
        >
          <Scrolling mode="virtual" />
          <Paging defaultPageSize={15} />
          <Pager
            showPageSizeSelector={true}
            allowedPageSizes={[10, 15, 25, 50]}
            showInfo={true}
            showNavigationButtons={true}
          />
          <FilterRow visible={true} />
          <SearchPanel visible={true} placeholder="Search tests..." width={250} />
          <HeaderFilter visible={true} />
          <Export enabled={true} formats={['xlsx']} />

          <Column
            dataField="lotNumber"
            caption="Lot / Item"
            width={220}
            cellRender={renderLotCell}
          />
          <Column
            caption="Test Name"
            minWidth={200}
            cellRender={renderTestCell}
            calculateCellValue={(data: QualityTest) => data.testName}
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
          />
          <Column
            caption="Result"
            width={100}
            cellRender={renderResultCell}
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
            caption="Disposition"
            width={130}
            cellRender={renderDispositionCell}
            allowFiltering={false}
          />
          <Column
            caption=""
            width={60}
            cellRender={renderActionsCell}
            allowFiltering={false}
            allowSorting={false}
          />
        </DataGrid>
      </div>
    </div>
  );
}

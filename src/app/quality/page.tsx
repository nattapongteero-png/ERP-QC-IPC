'use client';

// Quality Control Dashboard - Redesigned
// Feature: Quality Management
// Redesigned with KPIs, DataGrid, Cards, and Analytics views

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DataGrid, {
  Column,
  SearchPanel,
  HeaderFilter,
  FilterRow,
  Paging,
  Pager,
  Scrolling,
  Toolbar,
  Item,
  Grouping,
  GroupPanel,
  ColumnChooser,
  StateStoring,
  Export,
} from 'devextreme-react/data-grid';
import PieChart, {
  Series,
  Label,
  Connector,
  Legend,
  Tooltip as PieTooltip,
  Size,
} from 'devextreme-react/pie-chart';
import SelectBox from 'devextreme-react/select-box';
import TextBox from 'devextreme-react/text-box';
import { useQuery } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import {
  ClipboardCheck,
  FlaskConical,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  List,
  Grid3X3,
  PieChart as PieChartIcon,
  Filter,
  FileText,
  Activity,
  ArrowRight,
  Beaker,
  TrendingUp,
  Package,
} from 'lucide-react';

// Types
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
  sampleNumber: string | null;
  testDate: string | null;
  result: string | null;
  numericResult: number | null;
  status: string;
  createdAt: string;
}

interface QualitySpec {
  id: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  testName: string;
  testMethod: string;
  specification: string;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
  isCritical: boolean;
  isActive: boolean;
  createdAt: string;
}

interface Deviation {
  id: number;
  deviationNumber: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  reportedDate: string;
  reportedBy: string | null;
  closedDate: string | null;
}

type ViewMode = 'grid' | 'cards' | 'analytics';

// Test status configuration
const TEST_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'รอทดสอบ', color: 'text-yellow-700', bgColor: 'bg-yellow-50' },
  in_progress: { label: 'กำลังทดสอบ', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  passed: { label: 'ผ่าน', color: 'text-green-700', bgColor: 'bg-green-50' },
  failed: { label: 'ไม่ผ่าน', color: 'text-red-700', bgColor: 'bg-red-50' },
};

// Test type configuration
const TEST_TYPE_CONFIG: Record<string, { label: string; labelEn: string }> = {
  incoming: { label: 'วัตถุดิบ', labelEn: 'Incoming QC' },
  in_process: { label: 'ระหว่างผลิต', labelEn: 'In-Process QC' },
  finished: { label: 'ผลิตภัณฑ์สำเร็จ', labelEn: 'Finished Product' },
  stability: { label: 'ความคงตัว', labelEn: 'Stability' },
};

// Fetch functions
async function fetchTests(): Promise<QualityTest[]> {
  const response = await fetch('/api/quality/tests?limit=1000');
  if (!response.ok) throw new Error('Failed to fetch tests');
  const result = await response.json();
  return result.data?.items || [];
}

async function fetchSpecs(): Promise<QualitySpec[]> {
  const response = await fetch('/api/quality/specs?limit=1000');
  if (!response.ok) throw new Error('Failed to fetch specs');
  const result = await response.json();
  return result.data?.items || [];
}

async function fetchDeviations(): Promise<Deviation[]> {
  const response = await fetch('/api/quality/deviations?limit=1000');
  if (!response.ok) throw new Error('Failed to fetch deviations');
  const result = await response.json();
  return result.data?.items || [];
}

export default function QualityDashboardPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [testTypeFilter, setTestTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Fetch data
  const { data: testsData = [], isLoading: testsLoading, refetch: refetchTests } = useQuery({
    queryKey: ['quality', 'tests'],
    queryFn: fetchTests,
    staleTime: 30000,
  });

  const { data: specsData = [], isLoading: specsLoading } = useQuery({
    queryKey: ['quality', 'specs'],
    queryFn: fetchSpecs,
    staleTime: 60000,
  });

  const { data: deviationsData = [], isLoading: deviationsLoading } = useQuery({
    queryKey: ['quality', 'deviations'],
    queryFn: fetchDeviations,
    staleTime: 60000,
  });

  const isLoading = testsLoading || specsLoading || deviationsLoading;

  // Ensure data is always arrays
  const tests = useMemo(
    () => (Array.isArray(testsData) ? testsData : []),
    [testsData]
  );
  const specs = useMemo(
    () => (Array.isArray(specsData) ? specsData : []),
    [specsData]
  );
  const deviations = useMemo(
    () => (Array.isArray(deviationsData) ? deviationsData : []),
    [deviationsData]
  );

  // Calculate analytics
  const analytics = useMemo(() => {
    const totalTests = tests.length;
    const pendingTests = tests.filter((t) => t.status === 'pending').length;
    const inProgressTests = tests.filter((t) => t.status === 'in_progress').length;
    const passedTests = tests.filter((t) => t.status === 'passed').length;
    const failedTests = tests.filter((t) => t.status === 'failed').length;

    // Status distribution
    const statusDistribution = [
      { name: 'รอทดสอบ', count: pendingTests, color: '#f59e0b' },
      { name: 'กำลังทดสอบ', count: inProgressTests, color: '#3b82f6' },
      { name: 'ผ่าน', count: passedTests, color: '#10b981' },
      { name: 'ไม่ผ่าน', count: failedTests, color: '#ef4444' },
    ].filter((s) => s.count > 0);

    // Type distribution
    const typeDistribution = Object.entries(TEST_TYPE_CONFIG).map(([type, config]) => ({
      name: config.label,
      type,
      count: tests.filter((t) => t.testType === type).length,
    })).filter((item) => item.count > 0);

    // Specs stats
    const totalSpecs = specs.length;
    const activeSpecs = specs.filter((s) => s.isActive).length;
    const criticalSpecs = specs.filter((s) => s.isCritical).length;

    // Deviations stats
    const openDeviations = deviations.filter((d) => d.status !== 'closed').length;
    const criticalDeviations = deviations.filter((d) => d.severity === 'critical' && d.status !== 'closed').length;

    // Pass rate
    const completedTests = passedTests + failedTests;
    const passRate = completedTests > 0 ? Math.round((passedTests / completedTests) * 100) : 0;

    return {
      totalTests,
      pendingTests,
      inProgressTests,
      passedTests,
      failedTests,
      statusDistribution,
      typeDistribution,
      totalSpecs,
      activeSpecs,
      criticalSpecs,
      openDeviations,
      criticalDeviations,
      passRate,
    };
  }, [tests, specs, deviations]);

  // Filtered tests
  const filteredTests = useMemo(() => {
    return tests.filter((test) => {
      const matchesSearch =
        !searchText ||
        test.lotNumber?.toLowerCase().includes(searchText.toLowerCase()) ||
        test.testName?.toLowerCase().includes(searchText.toLowerCase()) ||
        test.sampleNumber?.toLowerCase().includes(searchText.toLowerCase());

      const matchesType = !testTypeFilter || test.testType === testTypeFilter;
      const matchesStatus = !statusFilter || test.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [tests, searchText, testTypeFilter, statusFilter]);

  // Handlers
  const handleRefresh = useCallback(() => {
    refetchTests();
  }, [refetchTests]);

  const handleRowClick = useCallback(
    (e: { data: QualityTest }) => {
      router.push(`/quality/tests/${e.data.id}`);
    },
    [router]
  );

  const clearFilters = useCallback(() => {
    setSearchText('');
    setTestTypeFilter(null);
    setStatusFilter(null);
  }, []);

  // Get status badge variant
  const getStatusVariant = (status: string): 'success' | 'warning' | 'secondary' | 'destructive' => {
    switch (status) {
      case 'passed':
        return 'success';
      case 'failed':
        return 'destructive';
      case 'in_progress':
        return 'secondary';
      default:
        return 'warning';
    }
  };

  // Module cards for quick access
  const moduleCards = [
    {
      title: 'การทดสอบคุณภาพ',
      titleEn: 'Quality Tests',
      description: 'จัดการการทดสอบคุณภาพวัตถุดิบและผลิตภัณฑ์',
      icon: FlaskConical,
      href: '/quality/tests',
      stats: [
        { label: 'ทั้งหมด', value: analytics.totalTests },
        { label: 'รอทดสอบ', value: analytics.pendingTests },
        { label: 'อัตราผ่าน', value: `${analytics.passRate}%` },
      ],
      color: 'indigo',
      gradient: 'from-indigo-500 to-indigo-600',
    },
    {
      title: 'ข้อกำหนดคุณภาพ',
      titleEn: 'Quality Specifications',
      description: 'กำหนดมาตรฐานและข้อกำหนดการทดสอบ',
      icon: FileText,
      href: '/quality/specs',
      stats: [
        { label: 'ทั้งหมด', value: analytics.totalSpecs },
        { label: 'ใช้งาน', value: analytics.activeSpecs },
        { label: 'จุดวิกฤต', value: analytics.criticalSpecs },
      ],
      color: 'emerald',
      gradient: 'from-emerald-500 to-emerald-600',
    },
    {
      title: 'ความเบี่ยงเบน',
      titleEn: 'Deviations',
      description: 'บันทึกและติดตามความเบี่ยงเบนจากกระบวนการ',
      icon: AlertTriangle,
      href: '/quality/deviations',
      stats: [
        { label: 'เปิดอยู่', value: analytics.openDeviations },
        { label: 'วิกฤต', value: analytics.criticalDeviations },
      ],
      color: 'amber',
      gradient: 'from-amber-500 to-amber-600',
    },
  ];

  // Type filter options
  const typeFilterOptions = [
    { value: null, text: 'ทุกประเภท' },
    ...Object.entries(TEST_TYPE_CONFIG).map(([value, config]) => ({
      value,
      text: config.label,
    })),
  ];

  // Status filter options
  const statusFilterOptions = [
    { value: null, text: 'ทุกสถานะ' },
    ...Object.entries(TEST_STATUS_CONFIG).map(([value, config]) => ({
      value,
      text: config.label,
    })),
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title="ควบคุมคุณภาพ"
        subtitle="Quality Control Dashboard"
        actions={
          <div className="flex items-center gap-2">
            <DxButton
              icon="refresh"
              onClick={handleRefresh}
              hint="รีเฟรชข้อมูล"
            />
            <DxButton
              icon="filter"
              onClick={() => setShowFilters(!showFilters)}
              hint="ตัวกรอง"
              type={showFilters ? 'default' : 'normal'}
            />
          </div>
        }
      />

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
        <StatCard
          label="การทดสอบทั้งหมด"
          value={analytics.totalTests}
          icon={FlaskConical}
          iconColor="text-indigo-600"
          accentColor="border-indigo-500"
          href="/quality/tests"
          isLoading={isLoading}
        />
        <StatCard
          label="รอทดสอบ"
          value={analytics.pendingTests}
          icon={Clock}
          iconColor="text-yellow-600"
          accentColor="border-yellow-500"
          isLoading={isLoading}
        />
        <StatCard
          label="ผ่านการทดสอบ"
          value={analytics.passedTests}
          icon={CheckCircle}
          iconColor="text-green-600"
          accentColor="border-green-500"
          isLoading={isLoading}
        />
        <StatCard
          label="ไม่ผ่านการทดสอบ"
          value={analytics.failedTests}
          icon={XCircle}
          iconColor="text-red-600"
          accentColor="border-red-500"
          isLoading={isLoading}
        />
        <StatCard
          label="ข้อกำหนดคุณภาพ"
          value={analytics.totalSpecs}
          icon={FileText}
          iconColor="text-emerald-600"
          accentColor="border-emerald-500"
          href="/quality/specs"
          isLoading={isLoading}
        />
        <StatCard
          label="ความเบี่ยงเบนเปิด"
          value={analytics.openDeviations}
          icon={AlertTriangle}
          iconColor="text-amber-600"
          accentColor="border-amber-500"
          href="/quality/deviations"
          isLoading={isLoading}
        />
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              ตัวกรองข้อมูล
            </h3>
            <DxButton text="ล้างตัวกรอง" type="normal" onClick={clearFilters} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">ค้นหา</label>
              <TextBox
                value={searchText}
                onValueChanged={(e) => setSearchText(e.value || '')}
                placeholder="ค้นหาตาม Lot หรือชื่อการทดสอบ..."
                showClearButton
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">ประเภทการทดสอบ</label>
              <SelectBox
                dataSource={typeFilterOptions}
                value={testTypeFilter}
                onValueChanged={(e) => setTestTypeFilter(e.value)}
                displayExpr="text"
                valueExpr="value"
                placeholder="เลือกประเภท..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">สถานะ</label>
              <SelectBox
                dataSource={statusFilterOptions}
                value={statusFilter}
                onValueChanged={(e) => setStatusFilter(e.value)}
                displayExpr="text"
                valueExpr="value"
                placeholder="เลือกสถานะ..."
              />
            </div>
          </div>
        </div>
      )}

      {/* View Mode Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 mr-2">มุมมอง:</span>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title="มุมมองตาราง"
            >
              <List className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 ${viewMode === 'cards' ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title="มุมมองการ์ด"
            >
              <Grid3X3 className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('analytics')}
              className={`p-2 ${viewMode === 'analytics' ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title="มุมมองวิเคราะห์"
            >
              <PieChartIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        <DxButton
          text="ทดสอบใหม่"
          icon="add"
          type="default"
          onClick={() => router.push('/quality/tests/new')}
        />
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <DataGrid
            dataSource={filteredTests}
            keyExpr="id"
            showBorders={false}
            showRowLines
            rowAlternationEnabled
            columnAutoWidth
            height={600}
            onRowClick={handleRowClick}
            hoverStateEnabled
          >
            <SearchPanel visible placeholder="ค้นหา..." />
            <HeaderFilter visible />
            <FilterRow visible />
            <Grouping autoExpandAll={false} />
            <GroupPanel visible />
            <ColumnChooser enabled mode="select" />
            <StateStoring enabled type="localStorage" storageKey="qualityTestsGrid" />
            <Export enabled allowExportSelectedData />
            <Scrolling mode="virtual" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo
              showNavigationButtons
            />

            <Toolbar>
              <Item name="groupPanel" />
              <Item name="searchPanel" />
              <Item name="columnChooserButton" />
              <Item name="exportButton" />
            </Toolbar>

            <Column dataField="lotNumber" caption="เลขที่ Lot" width={130} />
            <Column
              dataField="testName"
              caption="ชื่อการทดสอบ"
              minWidth={200}
            />
            <Column
              dataField="testType"
              caption="ประเภท"
              width={130}
              cellRender={(cellInfo) => {
                const config = TEST_TYPE_CONFIG[cellInfo.data.testType];
                return config ? (
                  <Badge variant="outline">{config.label}</Badge>
                ) : (
                  cellInfo.data.testType
                );
              }}
            />
            <Column dataField="testMethod" caption="วิธีทดสอบ" width={150} />
            <Column dataField="specification" caption="ข้อกำหนด" width={150} />
            <Column
              dataField="result"
              caption="ผลทดสอบ"
              width={120}
              cellRender={(cellInfo) => (
                <span className="font-medium">
                  {cellInfo.data.result || cellInfo.data.numericResult || '-'}
                </span>
              )}
            />
            <Column
              dataField="status"
              caption="สถานะ"
              width={120}
              cellRender={(cellInfo) => {
                const config = TEST_STATUS_CONFIG[cellInfo.data.status];
                return (
                  <Badge variant={getStatusVariant(cellInfo.data.status)}>
                    {config?.label || cellInfo.data.status}
                  </Badge>
                );
              }}
            />
            <Column
              dataField="testDate"
              caption="วันที่ทดสอบ"
              width={130}
              dataType="date"
              format="dd/MM/yyyy"
            />
          </DataGrid>
        </div>
      )}

      {/* Cards View - Module Cards */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {moduleCards.map((module) => (
            <div
              key={module.href}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => router.push(module.href)}
            >
              {/* Header with gradient */}
              <div className={`bg-gradient-to-r ${module.gradient} p-4 text-white`}>
                <div className="flex items-center justify-between">
                  <module.icon className="h-8 w-8" />
                  <ArrowRight className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="text-lg font-semibold mt-3">{module.title}</h3>
                <p className="text-sm opacity-90">{module.titleEn}</p>
              </div>
              {/* Content */}
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-4">{module.description}</p>
                <div className="grid grid-cols-3 gap-2">
                  {module.stats.map((stat) => (
                    <div key={stat.label} className="text-center">
                      <div className="text-xl font-bold text-gray-800">{stat.value}</div>
                      <div className="text-xs text-gray-500">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Quick Actions Card */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-gray-600" />
              การดำเนินการด่วน
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/quality/tests/new')}
                className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-left"
              >
                <span className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-medium">สร้างการทดสอบใหม่</span>
                </span>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </button>
              <button
                onClick={() => router.push('/quality/specs/new')}
                className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors text-left"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium">เพิ่มข้อกำหนดใหม่</span>
                </span>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </button>
              <button
                onClick={() => router.push('/quality/deviations/new')}
                className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-colors text-left"
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium">รายงานความเบี่ยงเบน</span>
                </span>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Pass Rate Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              อัตราการผ่านการทดสอบ
            </h3>
            <div className="flex items-center justify-center">
              <div className="relative">
                <svg className="w-32 h-32">
                  <circle
                    className="text-gray-200"
                    strokeWidth="10"
                    stroke="currentColor"
                    fill="transparent"
                    r="50"
                    cx="64"
                    cy="64"
                  />
                  <circle
                    className="text-green-500"
                    strokeWidth="10"
                    strokeDasharray={`${analytics.passRate * 3.14} 314`}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="50"
                    cx="64"
                    cy="64"
                    transform="rotate(-90 64 64)"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-gray-800">{analytics.passRate}%</span>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-green-600">{analytics.passedTests}</div>
                <div className="text-xs text-gray-500">ผ่าน</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-red-600">{analytics.failedTests}</div>
                <div className="text-xs text-gray-500">ไม่ผ่าน</div>
              </div>
            </div>
          </div>

          {/* Recent Activity Placeholder */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              สรุปตามประเภทการทดสอบ
            </h3>
            <div className="space-y-3">
              {Object.entries(TEST_TYPE_CONFIG).map(([type, config]) => {
                const count = tests.filter((t) => t.testType === type).length;
                const percentage = analytics.totalTests > 0 ? Math.round((count / analytics.totalTests) * 100) : 0;
                return (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{config.label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-500 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Analytics View */}
      {viewMode === 'analytics' && (
        <div className="space-y-6">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Distribution */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-indigo-600" />
                การกระจายตามสถานะ
              </h3>
              {analytics.statusDistribution.length > 0 ? (
                <PieChart
                  dataSource={analytics.statusDistribution}
                  type="doughnut"
                  palette={['#f59e0b', '#3b82f6', '#10b981', '#ef4444']}
                >
                  <Size height={300} />
                  <Series argumentField="name" valueField="count">
                    <Label visible format="fixedPoint">
                      <Connector visible width={1} />
                    </Label>
                  </Series>
                  <Legend
                    visible
                    verticalAlignment="bottom"
                    horizontalAlignment="center"
                    itemTextPosition="right"
                    orientation="horizontal"
                  />
                  <PieTooltip
                    enabled
                    format="fixedPoint"
                    customizeTooltip={(pointInfo: { argumentText?: string; valueText?: string }) => ({
                      text: `${pointInfo.argumentText}: ${pointInfo.valueText} รายการ`,
                    })}
                  />
                </PieChart>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                  ไม่มีข้อมูลการทดสอบ
                </div>
              )}
            </div>

            {/* Type Distribution */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Beaker className="h-5 w-5 text-emerald-600" />
                การกระจายตามประเภท
              </h3>
              {analytics.typeDistribution.length > 0 ? (
                <PieChart
                  dataSource={analytics.typeDistribution}
                  type="doughnut"
                  palette="Material"
                >
                  <Size height={300} />
                  <Series argumentField="name" valueField="count">
                    <Label visible format="fixedPoint">
                      <Connector visible width={1} />
                    </Label>
                  </Series>
                  <Legend
                    visible
                    verticalAlignment="bottom"
                    horizontalAlignment="center"
                    itemTextPosition="right"
                    orientation="horizontal"
                  />
                  <PieTooltip
                    enabled
                    format="fixedPoint"
                    customizeTooltip={(pointInfo: { argumentText?: string; valueText?: string }) => ({
                      text: `${pointInfo.argumentText}: ${pointInfo.valueText} รายการ`,
                    })}
                  />
                </PieChart>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                  ไม่มีข้อมูล
                </div>
              )}
            </div>
          </div>

          {/* Summary Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Test Status Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-indigo-600" />
                สรุปสถานะการทดสอบ
              </h4>
              <div className="space-y-2">
                {Object.entries(TEST_STATUS_CONFIG).map(([status, config]) => {
                  const count = tests.filter((t) => t.status === status).length;
                  return (
                    <div key={status} className="flex items-center justify-between py-1">
                      <span className={`text-sm ${config.color}`}>{config.label}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Specs Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-600" />
                สรุปข้อกำหนดคุณภาพ
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-600">ข้อกำหนดทั้งหมด</span>
                  <span className="font-semibold">{analytics.totalSpecs}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-600">ใช้งานอยู่</span>
                  <span className="font-semibold text-green-600">{analytics.activeSpecs}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-600">จุดวิกฤต</span>
                  <span className="font-semibold text-red-600">{analytics.criticalSpecs}</span>
                </div>
              </div>
            </div>

            {/* Deviations Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                สรุปความเบี่ยงเบน
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-600">ทั้งหมด</span>
                  <span className="font-semibold">{deviations.length}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-600">เปิดอยู่</span>
                  <span className="font-semibold text-amber-600">{analytics.openDeviations}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-600">วิกฤต</span>
                  <span className="font-semibold text-red-600">{analytics.criticalDeviations}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-600" />
                ดำเนินการด่วน
              </h4>
              <div className="space-y-2">
                <DxButton
                  text="ทดสอบใหม่"
                  icon="add"
                  type="default"
                  width="100%"
                  onClick={() => router.push('/quality/tests/new')}
                />
                <DxButton
                  text="เพิ่มข้อกำหนด"
                  icon="add"
                  type="normal"
                  width="100%"
                  onClick={() => router.push('/quality/specs/new')}
                />
                <DxButton
                  text="รายงานความเบี่ยงเบน"
                  icon="warning"
                  type="normal"
                  width="100%"
                  onClick={() => router.push('/quality/deviations/new')}
                />
              </div>
            </div>
          </div>

          {/* Type Breakdown */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              รายละเอียดตามประเภทการทดสอบ
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(TEST_TYPE_CONFIG).map(([type, config]) => {
                const typeTests = tests.filter((t) => t.testType === type);
                const passed = typeTests.filter((t) => t.status === 'passed').length;
                const failed = typeTests.filter((t) => t.status === 'failed').length;
                const pending = typeTests.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;
                return (
                  <div key={type} className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-gray-800">{typeTests.length}</div>
                    <div className="text-sm font-medium text-gray-700 mb-2">{config.label}</div>
                    <div className="text-xs text-gray-500">{config.labelEn}</div>
                    <div className="mt-3 flex justify-center gap-3 text-xs">
                      <span className="text-green-600">ผ่าน {passed}</span>
                      <span className="text-red-600">ไม่ผ่าน {failed}</span>
                      <span className="text-yellow-600">รอ {pending}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

// HR Organization Chart Page - Professional Dashboard Style
// Feature: 007-hr-personnel-management
// Redesigned with DevExtreme UI components

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { DxTabs } from '@/components/ui/dx-tabs';
import { OrgChartTree, OrgChartDiagram } from '@/components/hr';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { OrgUnit } from '@/types/hr';
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
  Building2,
  Users,
  Network,
  X,
  Layers,
  Building,
  FolderTree,
  Shield,
  CheckCircle,
  XCircle,
  TrendingUp,
  BarChart3,
  Activity,
} from 'lucide-react';

type ViewMode = 'tree' | 'diagram';

interface OrgUnitStats {
  total: number;
  active: number;
  inactive: number;
  gmpCritical: number;
  maxDepth: number;
  byType: {
    company: number;
    site: number;
    division: number;
    department: number;
    section: number;
    unit: number;
  };
}

const TYPE_LABELS: Record<string, string> = {
  company: 'บริษัท',
  site: 'สาขา',
  division: 'ฝ่าย',
  department: 'แผนก',
  section: 'หมวด',
  unit: 'หน่วย',
};

const TYPE_LABELS_EN: Record<string, string> = {
  company: 'Company',
  site: 'Site',
  division: 'Division',
  department: 'Department',
  section: 'Section',
  unit: 'Unit',
};

const TYPE_COLORS: Record<string, string> = {
  company: '#1e40af',
  site: '#1d4ed8',
  division: '#2563eb',
  department: '#3b82f6',
  section: '#60a5fa',
  unit: '#93c5fd',
};

const TYPE_ICONS: Record<string, typeof Building2> = {
  company: Building2,
  site: Building,
  division: Layers,
  department: FolderTree,
  section: Users,
  unit: Network,
};

async function fetchOrgUnitStats(): Promise<OrgUnitStats> {
  const response = await fetch('/api/hr/org-units/stats');
  if (!response.ok) throw new Error('Failed to fetch stats');
  const result = await response.json();
  return result.data;
}

async function fetchSubUnitCount(parentId: number): Promise<number> {
  const response = await fetch(`/api/hr/org-units?parentId=${parentId}`);
  if (!response.ok) return 0;
  const result = await response.json();
  return result.data?.length || 0;
}

async function fetchEmployeeCount(orgUnitId: number): Promise<number> {
  const response = await fetch(`/api/hr/employees?orgUnitId=${orgUnitId}`);
  if (!response.ok) return 0;
  const result = await response.json();
  return result.data?.length || 0;
}

export default function OrgChartPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [selectedOrgUnit, setSelectedOrgUnit] = useState<OrgUnit | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [chartHeight, setChartHeight] = useState(400);
  const [subUnitCount, setSubUnitCount] = useState<number>(0);
  const [employeeCount, setEmployeeCount] = useState<number>(0);

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['hr', 'org-units', 'stats'],
    queryFn: fetchOrgUnitStats,
  });

  // Prepare chart data for pie chart
  const pieChartData = useMemo(() => {
    if (!stats?.byType) return [];
    return Object.entries(stats.byType)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => ({
        type,
        label: TYPE_LABELS[type],
        labelEn: TYPE_LABELS_EN[type],
        value: count,
        color: TYPE_COLORS[type],
      }));
  }, [stats]);

  // Prepare bar chart data
  const barChartData = useMemo(() => {
    if (!stats?.byType) return [];
    return Object.entries(stats.byType).map(([type, count]) => ({
      type: TYPE_LABELS[type],
      count: count,
      color: TYPE_COLORS[type],
    }));
  }, [stats]);

  // Tab items for view mode
  const viewTabs = [
    { id: 0, text: 'Tree View', icon: 'hierarchy' },
    { id: 1, text: 'Diagram', icon: 'share' },
  ];

  // Responsive height calculation
  useEffect(() => {
    const calculateHeight = () => {
      const headerHeight = 380;
      const padding = 32;
      const minHeight = 700;
      const availableHeight = window.innerHeight - headerHeight - padding;
      setChartHeight(Math.max(minHeight, availableHeight));
    };

    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    return () => window.removeEventListener('resize', calculateHeight);
  }, []);

  // Fetch sub-unit and employee counts when selection changes
  useEffect(() => {
    if (!selectedOrgUnit) return;

    let cancelled = false;

    Promise.all([
      fetchSubUnitCount(selectedOrgUnit.id),
      fetchEmployeeCount(selectedOrgUnit.id),
    ]).then(([subCount, empCount]) => {
      if (!cancelled) {
        setSubUnitCount(subCount);
        setEmployeeCount(empCount);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedOrgUnit]);

  // Reset counts when no unit selected
  const displaySubUnitCount = selectedOrgUnit ? subUnitCount : 0;
  const displayEmployeeCount = selectedOrgUnit ? employeeCount : 0;

  const handleSelectionChange = useCallback((orgUnit: OrgUnit | null) => {
    setSelectedOrgUnit(orgUnit);
    setShowDetailPanel(true);
  }, []);

  const handleTabChange = useCallback((index: number) => {
    setViewMode(index === 0 ? 'tree' : 'diagram');
  }, []);

  // Calculate active percentage
  const activePercentage = stats?.total
    ? Math.round((stats.active / stats.total) * 100)
    : 0;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1800px] mx-auto">
      {/* Page Header */}
      <ResponsivePageHeader
        title="โครงสร้างองค์กร"
        subtitle="Organization Structure Management"
        icon={Building2}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'โครงสร้างองค์กร' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <DxButton
              icon="refresh"
              type="default"
              stylingMode="outlined"
              hint="รีเฟรช"
              onClick={() => window.location.reload()}
            />
            <DxButton
              icon="export"
              text="Export"
              type="default"
              stylingMode="outlined"
              className="hidden sm:flex"
            />
          </div>
        }
      />

      {/* Stats Row - Professional Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <StatCard
          label="หน่วยงานทั้งหมด"
          value={stats?.total ?? 0}
          icon={Building2}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={statsLoading}
        />
        <StatCard
          label="ฝ่าย (Divisions)"
          value={stats?.byType?.division ?? 0}
          icon={Layers}
          iconColor="text-indigo-500"
          accentColor="border-indigo-500"
          isLoading={statsLoading}
        />
        <StatCard
          label="แผนก (Depts)"
          value={stats?.byType?.department ?? 0}
          icon={FolderTree}
          iconColor="text-cyan-500"
          accentColor="border-cyan-500"
          isLoading={statsLoading}
        />
        <StatCard
          label="หมวด/หน่วย"
          value={(stats?.byType?.section ?? 0) + (stats?.byType?.unit ?? 0)}
          icon={Building}
          iconColor="text-teal-500"
          accentColor="border-teal-500"
          isLoading={statsLoading}
        />
        <StatCard
          label="ใช้งาน (Active)"
          value={`${stats?.active ?? 0}`}
          icon={CheckCircle}
          iconColor="text-green-500"
          accentColor="border-green-500"
          isLoading={statsLoading}
          trend={{ direction: 'up', value: `${activePercentage}%` }}
        />
        <StatCard
          label="GMP Critical"
          value={stats?.gmpCritical ?? 0}
          icon={Shield}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={statsLoading}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        {/* Pie Chart - Organization Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              การกระจายหน่วยงาน
            </h3>
          </div>
          {pieChartData.length > 0 ? (
            <PieChart
              id="org-distribution-pie"
              dataSource={pieChartData}
              type="doughnut"
              innerRadius={0.6}
              palette={pieChartData.map((d) => d.color)}
              size={{ height: 220 }}
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
                itemTextPosition="right"
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
            <div className="h-[220px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">ไม่มีข้อมูล</p>
              </div>
            </div>
          )}
        </div>

        {/* Bar Chart - Organization by Type */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              จำนวนตามประเภท
            </h3>
          </div>
          {barChartData.length > 0 ? (
            <Chart
              id="org-type-bar"
              dataSource={barChartData}
              size={{ height: 220 }}
            >
              <CommonSeriesSettings
                argumentField="type"
                type="bar"
                color="#3b82f6"
              />
              <ChartSeries valueField="count" name="จำนวน" color="#3b82f6" />
              <ArgumentAxis>
                <ChartLabel overlappingBehavior="rotate" rotationAngle={-45} />
              </ArgumentAxis>
              <ValueAxis />
              <ChartLegend visible={false} />
              <ChartTooltip
                enabled={true}
                customizeTooltip={(arg: { argumentText?: string; valueText?: string }) => ({
                  text: `${arg.argumentText}: ${arg.valueText} หน่วยงาน`,
                })}
              />
            </Chart>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">ไม่มีข้อมูล</p>
              </div>
            </div>
          )}
        </div>

        {/* Summary Card - Structure Overview */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              สรุปโครงสร้าง
            </h3>
          </div>
          <div className="space-y-3">
            {/* Max Depth */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Layers className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">ความลึกสูงสุด</p>
                  <p className="text-sm font-medium text-gray-900">Max Depth</p>
                </div>
              </div>
              <span className="text-xl font-bold text-purple-600">
                {stats?.maxDepth ?? 0}
                <span className="text-sm font-normal text-gray-500 ml-1">ชั้น</span>
              </span>
            </div>

            {/* Active Units */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">หน่วยงานใช้งาน</p>
                  <p className="text-sm font-medium text-gray-900">Active Units</p>
                </div>
              </div>
              <span className="text-xl font-bold text-green-600">
                {stats?.active ?? 0}
              </span>
            </div>

            {/* Inactive Units */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-red-50 to-rose-50 rounded-lg border border-red-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">ปิดใช้งาน</p>
                  <p className="text-sm font-medium text-gray-900">Inactive</p>
                </div>
              </div>
              <span className="text-xl font-bold text-red-600">
                {stats?.inactive ?? 0}
              </span>
            </div>

            {/* GMP Critical */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Shield className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">GMP Critical Areas</p>
                  <p className="text-sm font-medium text-gray-900">Critical</p>
                </div>
              </div>
              <span className="text-xl font-bold text-amber-600">
                {stats?.gmpCritical ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Tree/Diagram + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5">
        {/* Org Chart View - takes 4 of 5 columns */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Tabs Header */}
          <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
            <div className="flex items-center justify-between">
              <DxTabs
                items={viewTabs}
                selectedIndex={viewMode === 'tree' ? 0 : 1}
                onSelectedIndexChange={handleTabChange}
                stylingMode="secondary"
              />
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  {stats?.total ?? 0} หน่วยงาน
                </span>
              </div>
            </div>
          </div>

          {/* Chart Content */}
          {viewMode === 'tree' ? (
            <OrgChartTree
              height={chartHeight}
              onSelectionChange={handleSelectionChange}
              editable
            />
          ) : (
            <OrgChartDiagram
              height={chartHeight}
              onNodeClick={handleSelectionChange}
            />
          )}
        </div>

        {/* Detail Panel - Slide-up on mobile when selected */}
        <div
          className={`
          lg:col-span-1
          ${
            showDetailPanel && selectedOrgUnit
              ? 'fixed inset-x-0 bottom-0 z-50 bg-gray-50 p-4 shadow-2xl rounded-t-2xl max-h-[70vh] overflow-y-auto lg:relative lg:inset-auto lg:z-auto lg:bg-transparent lg:p-0 lg:shadow-none lg:rounded-none lg:max-h-none'
              : 'hidden lg:block'
          }
        `}
        >
          {/* Mobile Close Button */}
          {showDetailPanel && selectedOrgUnit && (
            <button
              onClick={() => setShowDetailPanel(false)}
              className="lg:hidden absolute top-4 right-4 p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          )}

          {/* Selected Unit Info */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Network className="w-4 h-4" />
                ข้อมูลหน่วยงาน
              </h3>
            </div>

            <div className="p-4">
              {selectedOrgUnit ? (
                <div className="space-y-4">
                  {/* Unit Header */}
                  <div className="flex items-start gap-3">
                    <div
                      className="p-3 rounded-xl"
                      style={{
                        backgroundColor: `${TYPE_COLORS[selectedOrgUnit.type]}15`,
                      }}
                    >
                      {(() => {
                        const IconComponent = TYPE_ICONS[selectedOrgUnit.type] || Network;
                        return (
                          <IconComponent
                            className="h-6 w-6"
                            style={{ color: TYPE_COLORS[selectedOrgUnit.type] }}
                          />
                        );
                      })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-lg">{selectedOrgUnit.code}</p>
                      <p className="text-sm text-gray-600 truncate">{selectedOrgUnit.name}</p>
                      {selectedOrgUnit.nameEn && (
                        <p className="text-xs text-gray-400 truncate">{selectedOrgUnit.nameEn}</p>
                      )}
                    </div>
                  </div>

                  {/* Badges Row */}
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="default"
                      style={{
                        backgroundColor: `${TYPE_COLORS[selectedOrgUnit.type]}20`,
                        color: TYPE_COLORS[selectedOrgUnit.type],
                        borderColor: TYPE_COLORS[selectedOrgUnit.type],
                      }}
                    >
                      {TYPE_LABELS[selectedOrgUnit.type] || selectedOrgUnit.type}
                    </Badge>
                    <Badge variant={selectedOrgUnit.isActive ? 'success' : 'danger'}>
                      {selectedOrgUnit.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    {selectedOrgUnit.isGmpCritical && (
                      <Badge variant="warning" className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        GMP
                      </Badge>
                    )}
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                      <p className="text-2xl font-bold text-blue-600">{displaySubUnitCount}</p>
                      <p className="text-xs text-gray-500">หน่วยงานย่อย</p>
                    </div>
                    <div className="text-center p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
                      <p className="text-2xl font-bold text-green-600">{displayEmployeeCount}</p>
                      <p className="text-xs text-gray-500">พนักงาน</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-gray-100 space-y-2">
                    <DxButton
                      icon="group"
                      text="ดูพนักงาน"
                      type="default"
                      stylingMode="outlined"
                      width="100%"
                      onClick={() => {
                        window.location.href = `/hr/employees?orgUnitId=${selectedOrgUnit.id}`;
                      }}
                    />
                    <DxButton
                      icon="chart"
                      text="รายงานหน่วยงาน"
                      type="default"
                      stylingMode="outlined"
                      width="100%"
                    />
                    <DxButton
                      icon="edit"
                      text="แก้ไขข้อมูล"
                      type="default"
                      stylingMode="text"
                      width="100%"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <Users className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium">
                    เลือกหน่วยงานเพื่อดูรายละเอียด
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Select a unit to view details
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Type Legend */}
          <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              ประเภทหน่วยงาน
            </h4>
            <div className="space-y-2">
              {Object.entries(TYPE_LABELS).map(([key, label]) => {
                const IconComponent = TYPE_ICONS[key] || Network;
                const count = stats?.byType?.[key as keyof OrgUnitStats['byType']] ?? 0;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: TYPE_COLORS[key] }}
                      />
                      <IconComponent
                        className="w-4 h-4"
                        style={{ color: TYPE_COLORS[key] }}
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

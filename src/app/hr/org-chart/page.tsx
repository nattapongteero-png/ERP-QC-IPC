'use client';

// HR Organization Chart Page - Dashboard Style
// Feature: 007-hr-personnel-management

import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { OrgChartTree, OrgChartDiagram } from '@/components/hr';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { OrgUnit } from '@/types/hr';
import {
  Building2,
  Users,
  Network,
  List,
  GitBranch,
  X,
  Layers,
  Building,
  FolderTree,
  Shield,
  CheckCircle,
  XCircle,
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

const TYPE_COLORS: Record<string, string> = {
  company: '#1a365d',
  site: '#2c5282',
  division: '#2b6cb0',
  department: '#3182ce',
  section: '#4299e1',
  unit: '#63b3ed',
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

  // Responsive height calculation - increased for better visibility
  useEffect(() => {
    const calculateHeight = () => {
      const headerHeight = 320; // Reduced further for more table space
      const padding = 32;
      const minHeight = 900; // Increased minimum height
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

  // Calculate max value for bar chart scaling
  const maxTypeCount = stats?.byType
    ? Math.max(...Object.values(stats.byType))
    : 0;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      {/* ResponsivePageHeader */}
      <ResponsivePageHeader
        title="โครงสร้างองค์กร"
        subtitle="Organization Structure Dashboard"
        icon={Building2}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'โครงสร้างองค์กร' },
        ]}
        actions={
          <div className="flex items-center gap-2 md:gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('tree')}
                className={`
                  flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-all min-h-[40px]
                  ${viewMode === 'tree'
                    ? 'bg-white shadow text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Tree View</span>
              </button>
              <button
                onClick={() => setViewMode('diagram')}
                className={`
                  flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-all min-h-[40px]
                  ${viewMode === 'diagram'
                    ? 'bg-white shadow text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                <GitBranch className="h-4 w-4" />
                <span className="hidden sm:inline">Diagram</span>
              </button>
            </div>

            <DxButton
              icon="refresh"
              type="default"
              stylingMode="outlined"
              onClick={() => window.location.reload()}
            />
          </div>
        }
      />

      {/* Stats Row - 5 StatCards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
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
          label="แผนก (Departments)"
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
          label="GMP Critical"
          value={stats?.gmpCritical ?? 0}
          icon={Shield}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={statsLoading}
        />
      </div>

      {/* Chart Section - Unit Distribution + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Horizontal Bar Chart */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">
            การกระจายหน่วยงานตามประเภท
          </h3>
          <div className="space-y-3">
            {Object.entries(TYPE_LABELS).map(([key, label]) => {
              const count = stats?.byType?.[key as keyof OrgUnitStats['byType']] ?? 0;
              const percentage = maxTypeCount > 0 ? (count / maxTypeCount) * 100 : 0;

              return (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-20 md:w-24 text-sm text-gray-600 truncate">
                    {label}
                  </div>
                  <div className="flex-1 h-6 md:h-8 bg-gray-100 rounded-md overflow-hidden">
                    <div
                      className="h-full rounded-md transition-all duration-500 ease-out"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: TYPE_COLORS[key],
                        minWidth: count > 0 ? '24px' : '0',
                      }}
                    />
                  </div>
                  <div className="w-8 text-sm font-medium text-gray-900 text-right">
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary Card */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">
            สรุปโครงสร้าง
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-purple-500" />
                <span className="text-sm text-gray-600">ความลึกสูงสุด</span>
              </div>
              <span className="text-lg font-bold text-purple-600">
                {stats?.maxDepth ?? 0} ชั้น
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm text-gray-600">ใช้งาน</span>
              </div>
              <span className="text-lg font-bold text-green-600">
                {stats?.active ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="text-sm text-gray-600">ปิดใช้งาน</span>
              </div>
              <span className="text-lg font-bold text-red-600">
                {stats?.inactive ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Tree/Diagram + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
        {/* Org Chart View - takes 4 of 5 columns for more width */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
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
        <div className={`
          lg:col-span-1
          ${showDetailPanel && selectedOrgUnit
            ? 'fixed inset-x-0 bottom-0 z-50 bg-gray-50 p-4 shadow-2xl rounded-t-2xl max-h-[70vh] overflow-y-auto lg:relative lg:inset-auto lg:z-auto lg:bg-transparent lg:p-0 lg:shadow-none lg:rounded-none lg:max-h-none'
            : 'hidden lg:block'
          }
        `}>
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
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              ข้อมูลหน่วยงาน
            </h3>

            {selectedOrgUnit ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div
                    className="p-3 rounded-lg"
                    style={{
                      backgroundColor: `${TYPE_COLORS[selectedOrgUnit.type]}20`,
                    }}
                  >
                    <Network
                      className="h-6 w-6"
                      style={{ color: TYPE_COLORS[selectedOrgUnit.type] }}
                    />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{selectedOrgUnit.code}</p>
                    <p className="text-sm text-gray-600">{selectedOrgUnit.name}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500">ประเภท</p>
                    <Badge variant="default" className="mt-1">
                      {TYPE_LABELS[selectedOrgUnit.type] || selectedOrgUnit.type}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">สถานะ</p>
                    <Badge
                      variant={selectedOrgUnit.isActive ? 'success' : 'danger'}
                      className="mt-1"
                    >
                      {selectedOrgUnit.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                    </Badge>
                  </div>
                </div>

                {/* Sub-unit and Employee counts */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-xl font-bold text-blue-600">{displaySubUnitCount}</p>
                    <p className="text-xs text-gray-500">หน่วยงานย่อย</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-xl font-bold text-green-600">{displayEmployeeCount}</p>
                    <p className="text-xs text-gray-500">พนักงาน</p>
                  </div>
                </div>

                {selectedOrgUnit.nameEn && (
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">ชื่อภาษาอังกฤษ</p>
                    <p className="text-sm text-gray-900 mt-1">{selectedOrgUnit.nameEn}</p>
                  </div>
                )}

                {selectedOrgUnit.isGmpCritical && (
                  <div className="pt-3 border-t border-gray-100">
                    <Badge variant="warning" className="w-full justify-center">
                      <Shield className="h-4 w-4 mr-1" />
                      GMP Critical Area
                    </Badge>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-100 space-y-2">
                  <DxButton
                    icon="user"
                    text="ดูพนักงาน"
                    type="default"
                    stylingMode="outlined"
                    width="100%"
                    onClick={() => {
                      window.location.href = `/hr/employees?orgUnitId=${selectedOrgUnit.id}`;
                    }}
                  />
                  <DxButton
                    icon="edit"
                    text="แก้ไขหน่วยงาน"
                    type="default"
                    stylingMode="text"
                    width="100%"
                    onClick={() => {
                      // Edit functionality handled by tree component
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">
                  เลือกหน่วยงานจาก{viewMode === 'tree' ? 'ตาราง' : 'แผนผัง'}เพื่อดูรายละเอียด
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

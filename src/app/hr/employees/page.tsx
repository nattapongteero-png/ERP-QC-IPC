'use client';

// HR Employee Directory Page
// Feature: 007-hr-personnel-management

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DataGrid, {
  Column,
  SearchPanel,
  HeaderFilter,
  FilterRow,
  Paging,
  Pager,
  Selection,
  Scrolling,
  Export,
  Toolbar,
  Item,
} from 'devextreme-react/data-grid';
import { useQuery } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import { OrgUnitPicker, ResponsivePageHeader, StatCard } from '@/components/shared';
import {
  Users,
  UserPlus,
  UserCheck,
  Clock,
  Phone,
  Calendar,
  ChevronRight,
  Building2,
} from 'lucide-react';
import type { EmployeeWithDetails } from '@/types/hr';

const STATUS_OPTIONS = [
  { value: 'active', label: 'ใช้งาน' },
  { value: 'inactive', label: 'พักงาน' },
  { value: 'terminated', label: 'พ้นสภาพ' },
];

// Professional avatar gradient colors based on name hash
const AVATAR_GRADIENTS = [
  'from-blue-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-sky-600',
  'from-indigo-500 to-blue-600',
  'from-fuchsia-500 to-pink-600',
];

function getAvatarGradient(name: string): string {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function formatRelativeDate(dateStr: string | Date | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 30) return `${diffDays} วันที่แล้ว`;
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} เดือนที่แล้ว`;
  }
  const years = Math.floor(diffDays / 365);
  const remainingMonths = Math.floor((diffDays % 365) / 30);
  if (remainingMonths > 0) {
    return `${years} ปี ${remainingMonths} เดือน`;
  }
  return `${years} ปี`;
}

async function fetchEmployees(filters: {
  orgUnitId?: number;
  status?: string;
  search?: string;
}): Promise<EmployeeWithDetails[]> {
  const url = new URL('/api/hr/employees', window.location.origin);
  if (filters.orgUnitId) url.searchParams.set('orgUnitId', String(filters.orgUnitId));
  if (filters.status) url.searchParams.set('status', filters.status);
  if (filters.search) url.searchParams.set('search', filters.search);

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error('Failed to fetch employees');
  const result = await response.json();
  return result.data || [];
}

export default function EmployeesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orgUnitFilter, setOrgUnitFilter] = useState<number | null>(
    searchParams.get('orgUnitId') ? Number(searchParams.get('orgUnitId')) : null
  );
  const [statusFilter, setStatusFilter] = useState<string | null>(
    searchParams.get('status') || null
  );
  const [showFilters, setShowFilters] = useState(false);
  const [gridHeight, setGridHeight] = useState(600);

  // T015: Responsive height calculation for DataGrid
  useEffect(() => {
    const calculateHeight = () => {
      const headerHeight = 200;
      const padding = 100;
      const minHeight = 400;
      const availableHeight = window.innerHeight - headerHeight - padding;
      setGridHeight(Math.max(minHeight, availableHeight));
    };

    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    return () => window.removeEventListener('resize', calculateHeight);
  }, []);

  const { data: employees = [], isLoading, refetch } = useQuery({
    queryKey: ['hr', 'employees', { orgUnitId: orgUnitFilter, status: statusFilter }],
    queryFn: () => fetchEmployees({
      orgUnitId: orgUnitFilter || undefined,
      status: statusFilter || undefined,
    }),
  });

  const handleRowClick = useCallback(
    (e: { data: EmployeeWithDetails }) => {
      router.push(`/hr/employees/${e.data.id}`);
    },
    [router]
  );

  const handleAddEmployee = useCallback(() => {
    router.push('/hr/employees/new');
  }, [router]);

  const clearFilters = useCallback(() => {
    setOrgUnitFilter(null);
    setStatusFilter(null);
  }, []);

  // Enhanced status cell with dot indicator and refined styling
  const renderStatusCell = (cellData: { value: string }) => {
    const status = cellData.value;
    const statusConfig = {
      active: { variant: 'success' as const, label: 'ใช้งาน' },
      inactive: { variant: 'warning' as const, label: 'พักงาน' },
      terminated: { variant: 'danger' as const, label: 'พ้นสภาพ' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;

    return (
      <div className="flex items-center justify-center">
        <Badge variant={config.variant} dot className="font-medium">
          {config.label}
        </Badge>
      </div>
    );
  };

  // Professional employee cell with gradient avatar and enhanced typography
  const renderEmployeeCell = (cellData: { data: EmployeeWithDetails }) => {
    const emp = cellData.data;
    const fullName = `${emp.firstName} ${emp.lastName}`;
    const gradient = getAvatarGradient(fullName);

    return (
      <div className="flex items-center gap-3.5 py-2 group">
        {/* Gradient Avatar */}
        <div className={`
          relative w-10 h-10 rounded-full bg-gradient-to-br ${gradient}
          flex items-center justify-center text-white font-semibold text-sm
          shadow-sm ring-2 ring-white
          transition-transform duration-200 group-hover:scale-105
        `}>
          {emp.firstName?.charAt(0)}{emp.lastName?.charAt(0)}
          {/* Online indicator for active employees */}
          {emp.status === 'active' && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
          )}
        </div>

        {/* Employee Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 truncate">
              {fullName}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
              {emp.employeeCode}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Organization unit cell with icon
  const renderOrgUnitCell = (cellData: { data: EmployeeWithDetails }) => {
    const emp = cellData.data;
    if (!emp.orgUnitName) {
      return <span className="text-slate-300 text-sm italic">-</span>;
    }
    return (
      <div className="flex items-center gap-2 py-1">
        <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-3.5 h-3.5 text-amber-600" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-slate-700 text-sm truncate">{emp.orgUnitName}</span>
          {emp.positionTitle && (
            <span className="text-xs text-slate-400 truncate">{emp.positionTitle}</span>
          )}
        </div>
      </div>
    );
  };

  // Professional phone cell with icon
  const renderPhoneCell = (cellData: { value: string }) => {
    const phone = cellData.value;
    if (!phone) {
      return <span className="text-slate-300 text-sm italic">-</span>;
    }
    return (
      <div className="flex items-center gap-2 py-1">
        <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <Phone className="w-3.5 h-3.5 text-emerald-500" />
        </div>
        <span className="text-slate-600 text-sm font-mono">
          {phone}
        </span>
      </div>
    );
  };

  // Enhanced date cell with relative time
  const renderHireDateCell = (cellData: { value: string | Date }) => {
    const dateValue = cellData.value;
    if (!dateValue) {
      return <span className="text-slate-300 text-sm italic">-</span>;
    }

    const date = new Date(dateValue);
    const formattedDate = date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const tenure = formatRelativeDate(dateValue);

    return (
      <div className="flex items-center gap-2 py-1">
        <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
          <Calendar className="w-3.5 h-3.5 text-violet-500" />
        </div>
        <div className="flex flex-col">
          <span className="text-slate-700 text-sm">{formattedDate}</span>
          <span className="text-xs text-slate-400">{tenure}</span>
        </div>
      </div>
    );
  };

  // T014: Compute employee stats for StatCards
  const employeeList = Array.isArray(employees) ? employees : [];
  const activeCount = employeeList.filter((e) => e.status === 'active').length;
  const inactiveCount = employeeList.filter((e) => e.status === 'inactive').length;
  const thisMonth = new Date();
  const newThisMonth = employeeList.filter((e) => {
    if (!e.hireDate) return false;
    const hireDate = new Date(e.hireDate);
    return hireDate.getMonth() === thisMonth.getMonth() &&
           hireDate.getFullYear() === thisMonth.getFullYear();
  }).length;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      {/* T012: ResponsivePageHeader */}
      <ResponsivePageHeader
        title="ทะเบียนพนักงาน"
        subtitle={`Employee Directory • ${employeeList.length} รายการ`}
        icon={Users}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'พนักงาน' },
        ]}
        actions={
          <>
            <DxButton
              icon="filter"
              text={showFilters ? 'ซ่อนตัวกรอง' : 'ตัวกรอง'}
              type="default"
              stylingMode="outlined"
              onClick={() => setShowFilters(!showFilters)}
            />
            <DxButton
              icon="refresh"
              type="default"
              stylingMode="outlined"
              onClick={() => refetch()}
              disabled={isLoading}
            />
            <DxButton
              icon="add"
              text="เพิ่มพนักงาน"
              type="default"
              stylingMode="contained"
              onClick={handleAddEmployee}
            />
          </>
        }
      />

      {/* T014: Stat cards for employee counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="พนักงานทั้งหมด"
          value={employeeList.length}
          icon={Users}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
        />
        <StatCard
          label="ใช้งาน"
          value={activeCount}
          icon={UserCheck}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={isLoading}
        />
        <StatCard
          label="พักงาน"
          value={inactiveCount}
          icon={Clock}
          iconColor="text-yellow-500"
          accentColor="border-yellow-500"
          isLoading={isLoading}
        />
        <StatCard
          label="เข้าใหม่เดือนนี้"
          value={newThisMonth}
          icon={UserPlus}
          iconColor="text-violet-500"
          accentColor="border-violet-500"
          isLoading={isLoading}
        />
      </div>

      {/* T016: Mobile-optimized filters */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 md:gap-4">
            <div className="w-full sm:w-64">
              <OrgUnitPicker
                value={orgUnitFilter}
                onValueChange={setOrgUnitFilter}
                label="หน่วยงาน"
                placeholder="ทุกหน่วยงาน"
                showClearButton
              />
            </div>
            <div className="w-full sm:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                สถานะ
              </label>
              <select
                value={statusFilter || ''}
                onChange={(e) => setStatusFilter(e.target.value || null)}
                className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">ทั้งหมด</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <DxButton
              text="ล้างตัวกรอง"
              type="default"
              stylingMode="text"
              onClick={clearFilters}
            />
          </div>
        </div>
      )}

      {/* T013: DataGrid with enhanced styling */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <DataGrid
          dataSource={employeeList}
          keyExpr="id"
          showBorders={false}
          showRowLines
          rowAlternationEnabled={false}
          columnAutoWidth
          allowColumnReordering
          allowColumnResizing
          columnHidingEnabled
          height={gridHeight}
          onRowClick={handleRowClick}
          hoverStateEnabled
          loadPanel={{ enabled: isLoading }}
          className="[&_.dx-datagrid-headers]:bg-slate-50/80 [&_.dx-datagrid-headers]:border-b [&_.dx-datagrid-headers]:border-slate-200 [&_.dx-header-row>td]:font-semibold [&_.dx-header-row>td]:text-slate-600 [&_.dx-header-row>td]:text-xs [&_.dx-header-row>td]:uppercase [&_.dx-header-row>td]:tracking-wider [&_.dx-header-row>td]:py-3 [&_.dx-data-row]:border-b [&_.dx-data-row]:border-slate-100 [&_.dx-data-row:hover]:bg-blue-50/50 [&_.dx-data-row]:transition-colors [&_.dx-data-row]:cursor-pointer"
        >
          <SearchPanel visible placeholder="ค้นหาพนักงาน..." width={280} />
          <HeaderFilter visible />
          <FilterRow visible={false} />
          <Scrolling mode="virtual" />
          <Paging defaultPageSize={20} />
          <Pager
            showPageSizeSelector
            allowedPageSizes={[10, 20, 50, 100]}
            showInfo
            showNavigationButtons
          />
          <Selection mode="single" />
          <Export enabled />

          <Toolbar>
            <Item name="searchPanel" />
            <Item name="exportButton" />
          </Toolbar>

          {/* Professional columns with enhanced cell renderers */}
          <Column
            caption="พนักงาน"
            cellRender={renderEmployeeCell}
            minWidth={220}
            calculateSortValue={(data: EmployeeWithDetails) => `${data.firstName} ${data.lastName}`}
            hidingPriority={0}
          />
          <Column
            caption="หน่วยงาน / ตำแหน่ง"
            cellRender={renderOrgUnitCell}
            minWidth={200}
            calculateSortValue={(data: EmployeeWithDetails) => data.orgUnitName || ''}
            hidingPriority={2}
          />
          <Column
            dataField="phone"
            caption="เบอร์โทร"
            cellRender={renderPhoneCell}
            width={160}
            hidingPriority={4}
          />
          <Column
            dataField="status"
            caption="สถานะ"
            width={120}
            cellRender={renderStatusCell}
            alignment="center"
            hidingPriority={1}
          >
            <HeaderFilter
              dataSource={STATUS_OPTIONS.map((o) => ({
                text: o.label,
                value: o.value,
              }))}
            />
          </Column>
          <Column
            dataField="hireDate"
            caption="วันเริ่มงาน"
            cellRender={renderHireDateCell}
            minWidth={160}
            hidingPriority={3}
          />
        </DataGrid>
      </div>
    </div>
  );
}

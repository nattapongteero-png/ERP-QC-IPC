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
import { buddhistDateFormat } from '@/components/ui/dx-date-box';
import { OrgUnitPicker, ResponsivePageHeader, StatCard } from '@/components/shared';
import { Users, UserPlus, UserCheck, Clock } from 'lucide-react';
import type { Employee } from '@/types/hr';

const STATUS_OPTIONS = [
  { value: 'active', label: 'ใช้งาน' },
  { value: 'inactive', label: 'พักงาน' },
  { value: 'terminated', label: 'พ้นสภาพ' },
];

async function fetchEmployees(filters: {
  orgUnitId?: number;
  status?: string;
  search?: string;
}): Promise<Employee[]> {
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
      const headerHeight = 200; // Approximate header + stats + filters height
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
    (e: { data: Employee }) => {
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

  const renderStatusCell = (cellData: { value: string }) => {
    const status = cellData.value;
    return (
      <Badge
        variant={
          status === 'active' ? 'success' :
          status === 'inactive' ? 'warning' : 'danger'
        }
      >
        {status === 'active' ? 'ใช้งาน' :
         status === 'inactive' ? 'พักงาน' : 'พ้นสภาพ'}
      </Badge>
    );
  };

  const renderEmployeeCell = (cellData: { data: Employee }) => {
    const emp = cellData.data;
    return (
      <div className="flex items-center gap-3 py-1">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-sm">
          {emp.firstName?.charAt(0)}{emp.lastName?.charAt(0)}
        </div>
        <div>
          <div className="font-medium text-gray-900">
            {emp.firstName} {emp.lastName}
          </div>
          <div className="text-xs text-gray-500">{emp.employeeCode}</div>
        </div>
      </div>
    );
  };

  // T014: Compute employee stats for StatCards
  const activeCount = employees.filter((e) => e.status === 'active').length;
  const inactiveCount = employees.filter((e) => e.status === 'inactive').length;
  const thisMonth = new Date();
  const newThisMonth = employees.filter((e) => {
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
        subtitle={`Employee Directory • ${employees.length} รายการ`}
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
          value={employees.length}
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
        <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-4">
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
                className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

      {/* T013: DataGrid with columnHidingEnabled and hidingPriority */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <DataGrid
          dataSource={employees}
          keyExpr="id"
          showBorders={false}
          showRowLines
          rowAlternationEnabled
          columnAutoWidth
          allowColumnReordering
          allowColumnResizing
          columnHidingEnabled
          height={gridHeight}
          onRowClick={handleRowClick}
          hoverStateEnabled
          loadPanel={{ enabled: isLoading }}
        >
          <SearchPanel visible placeholder="ค้นหา..." width={240} />
          <HeaderFilter visible />
          <FilterRow visible />
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

          {/* T013: Columns with hidingPriority for mobile responsiveness */}
          <Column
            caption="พนักงาน"
            cellRender={renderEmployeeCell}
            minWidth={180}
            calculateSortValue={(data: Employee) => `${data.firstName} ${data.lastName}`}
            hidingPriority={0}
          />
          <Column
            dataField="email"
            caption="อีเมล"
            width={200}
            hidingPriority={2}
          />
          <Column
            dataField="phone"
            caption="เบอร์โทร"
            width={120}
            hidingPriority={3}
          />
          <Column
            dataField="status"
            caption="สถานะ"
            width={100}
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
            dataType="date"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            format={buddhistDateFormat as any}
            width={120}
            hidingPriority={4}
          />
        </DataGrid>
      </div>
    </div>
  );
}

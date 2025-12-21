'use client';

// HR Employee Directory Page
// Feature: 007-hr-personnel-management

import { useState, useCallback } from 'react';
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
import { OrgUnitPicker } from '@/components/shared';
import { Users, UserPlus, Filter, RefreshCw } from 'lucide-react';
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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-600" />
            ทะเบียนพนักงาน
          </h1>
          <p className="text-gray-500 mt-1">
            Employee Directory • {employees.length} รายการ
          </p>
        </div>

        <div className="flex items-center gap-3">
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
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-64">
              <OrgUnitPicker
                value={orgUnitFilter}
                onValueChange={setOrgUnitFilter}
                label="หน่วยงาน"
                placeholder="ทุกหน่วยงาน"
                showClearButton
              />
            </div>
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                สถานะ
              </label>
              <select
                value={statusFilter || ''}
                onChange={(e) => setStatusFilter(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

      {/* DataGrid */}
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
          height={600}
          onRowClick={handleRowClick}
          hoverStateEnabled
          loadPanel={{ enabled: isLoading }}
        >
          <SearchPanel visible placeholder="ค้นหา..." width={300} />
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

          <Column
            caption="พนักงาน"
            cellRender={renderEmployeeCell}
            minWidth={200}
            calculateSortValue={(data: Employee) => `${data.firstName} ${data.lastName}`}
          />
          <Column
            dataField="email"
            caption="อีเมล"
            width={200}
          />
          <Column
            dataField="phone"
            caption="เบอร์โทร"
            width={120}
          />
          <Column
            dataField="status"
            caption="สถานะ"
            width={100}
            cellRender={renderStatusCell}
            alignment="center"
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
            format="dd/MM/yyyy"
            width={120}
          />
        </DataGrid>
      </div>
    </div>
  );
}

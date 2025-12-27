'use client';

// HR Roles Management Page
// Following template design pattern for list page with CRUD operations
// Feature: 007-hr-personnel-management

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DataGrid, {
  Column,
  HeaderFilter,
  FilterRow,
  Paging,
  Pager,
  Scrolling,
  LoadPanel,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import TextBox from 'devextreme-react/text-box';
import SelectBox from 'devextreme-react/select-box';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useToast } from '@/components/ui/toast';
import {
  Shield,
  Users,
  Lock,
  Settings,
  Eye,
  Edit,
  Trash2,
  Filter,
  Key,
} from 'lucide-react';
import type { AppRoleWithPermissions } from '@/types/hr';

// Status options for filter
const statusOptions = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'active', label: 'ใช้งาน' },
  { value: 'inactive', label: 'ปิดใช้งาน' },
  { value: 'system', label: 'บทบาทระบบ' },
];

async function fetchRoles(): Promise<AppRoleWithPermissions[]> {
  const response = await fetch('/api/hr/roles');
  if (!response.ok) throw new Error('Failed to fetch roles');
  const result = await response.json();
  return result.data || [];
}

async function deactivateRole(id: number): Promise<void> {
  const response = await fetch('/api/hr/roles/' + id, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || 'Failed to deactivate role');
  }
}

export default function RolesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Filter states
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Delete confirmation state
  const [selectedRole, setSelectedRole] = useState<AppRoleWithPermissions | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [gridHeight, setGridHeight] = useState(500);

  // Responsive height calculation
  useEffect(() => {
    const calculateHeight = () => {
      const headerHeight = 320;
      const padding = 100;
      const minHeight = 400;
      const availableHeight = window.innerHeight - headerHeight - padding;
      setGridHeight(Math.max(minHeight, availableHeight));
    };

    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    return () => window.removeEventListener('resize', calculateHeight);
  }, []);

  const { data: rolesData = [], isLoading } = useQuery({
    queryKey: ['hr', 'roles'],
    queryFn: fetchRoles,
  });

  // Ensure data is always an array
  const allRoles = useMemo(() => Array.isArray(rolesData) ? rolesData : [], [rolesData]);

  // Filter roles based on search and status
  const roles = useMemo(() => {
    let filtered = allRoles;

    // Apply status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter(r => r.isActive && !r.isSystemRole);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(r => !r.isActive);
    } else if (statusFilter === 'system') {
      filtered = filtered.filter(r => r.isSystemRole);
    }

    // Apply search filter
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase().trim();
      filtered = filtered.filter(r =>
        r.code?.toLowerCase().includes(searchLower) ||
        r.name?.toLowerCase().includes(searchLower) ||
        r.description?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [allRoles, statusFilter, searchText]);

  // Stats
  const stats = useMemo(() => ({
    total: allRoles.length,
    active: allRoles.filter(r => r.isActive && !r.isSystemRole).length,
    system: allRoles.filter(r => r.isSystemRole).length,
    totalPermissions: allRoles.reduce((sum, r) => sum + (r.permissionCount || 0), 0),
  }), [allRoles]);

  const deactivateMutation = useMutation({
    mutationFn: deactivateRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'roles'] });
      toast.success('ปิดใช้งานบทบาทสำเร็จ');
      setShowDeleteConfirm(false);
      setSelectedRole(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'ไม่สามารถปิดใช้งานบทบาทได้');
    },
  });

  // Handlers
  const handleRowClick = useCallback((e: { data: AppRoleWithPermissions }) => {
    router.push(`/hr/roles/${e.data.id}`);
  }, [router]);

  const handleDelete = useCallback((role: AppRoleWithPermissions) => {
    setSelectedRole(role);
    setShowDeleteConfirm(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (selectedRole) {
      deactivateMutation.mutate(selectedRole.id);
    }
  }, [selectedRole, deactivateMutation]);

  // Cell renderers
  const renderCodeCell = useCallback((cellData: { data: AppRoleWithPermissions }) => {
    const role = cellData.data;
    return (
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${role.isSystemRole ? 'bg-purple-100' : 'bg-blue-100'}`}>
          <Shield className={`h-4 w-4 ${role.isSystemRole ? 'text-purple-600' : 'text-blue-600'}`} />
        </div>
        <span className="font-mono font-semibold text-blue-600">{role.code}</span>
      </div>
    );
  }, []);

  const renderStatusCell = useCallback((cellData: { data: AppRoleWithPermissions }) => {
    const role = cellData.data;
    if (role.isSystemRole) {
      return (
        <Badge variant="info" className="text-xs">
          <Lock className="h-3 w-3 mr-1" />
          ระบบ
        </Badge>
      );
    }
    return role.isActive ? (
      <Badge variant="success">ใช้งาน</Badge>
    ) : (
      <Badge variant="danger">ปิดใช้งาน</Badge>
    );
  }, []);

  const renderPermissionCountCell = useCallback((cellData: { value: number }) => {
    return (
      <div className="flex items-center gap-1.5">
        <Key className="h-3.5 w-3.5 text-amber-500" />
        <span className="font-medium">{cellData.value || 0}</span>
        <span className="text-gray-500 text-xs">สิทธิ์</span>
      </div>
    );
  }, []);

  const renderActionsCell = useCallback((cellData: { data: AppRoleWithPermissions }) => {
    const role = cellData.data;

    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/hr/roles/${role.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title="ดูรายละเอียด"
        >
          <Eye className="h-4 w-4" />
        </button>
        {!role.isSystemRole && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/hr/roles/${role.id}`);
              }}
              className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
              title="แก้ไข"
            >
              <Edit className="h-4 w-4" />
            </button>
            {role.isActive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(role);
                }}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="ปิดใช้งาน"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>
    );
  }, [router, handleDelete]);

  return (
    <div className="space-y-6 p-1">
      {/* ResponsivePageHeader */}
      <ResponsivePageHeader
        title="จัดการบทบาทและสิทธิ์"
        subtitle="กำหนดบทบาทและสิทธิ์การเข้าถึงในระบบ"
        icon={Shield}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'บทบาทและสิทธิ์' },
        ]}
        actions={
          <Button
            text="สร้างบทบาท"
            icon="plus"
            type="success"
            onClick={() => router.push('/hr/roles/new')}
          />
        }
      />

      {/* Stats using StatCard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="บทบาททั้งหมด"
          value={stats.total}
          icon={Shield}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
        />
        <StatCard
          label="ใช้งาน"
          value={stats.active}
          icon={Users}
          iconColor="text-green-500"
          accentColor="border-green-500"
        />
        <StatCard
          label="บทบาทระบบ"
          value={stats.system}
          icon={Lock}
          iconColor="text-purple-500"
          accentColor="border-purple-500"
        />
        <StatCard
          label="สิทธิ์ทั้งหมด"
          value={stats.totalPermissions}
          icon={Settings}
          iconColor="text-orange-500"
          accentColor="border-orange-500"
        />
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && selectedRole && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-800">ยืนยันการปิดใช้งาน</p>
                <p className="text-sm text-red-600">
                  คุณต้องการปิดใช้งานบทบาท &quot;{selectedRole.name}&quot; หรือไม่?
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text="ยกเลิก"
                  stylingMode="outlined"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedRole(null);
                  }}
                />
                <Button
                  text={deactivateMutation.isPending ? 'กำลังลบ...' : 'ปิดใช้งาน'}
                  icon="trash"
                  type="danger"
                  onClick={confirmDelete}
                  disabled={deactivateMutation.isPending}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters Card */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">ตัวกรอง:</span>
              </div>
              <div className="w-56">
                <TextBox
                  value={searchText}
                  onValueChanged={(e) => setSearchText(e.value || '')}
                  valueChangeEvent="keyup"
                  placeholder="ค้นหาบทบาท..."
                  showClearButton
                  mode="search"
                />
              </div>
              <div className="w-40">
                <SelectBox
                  dataSource={statusOptions}
                  displayExpr="label"
                  valueExpr="value"
                  value={statusFilter}
                  onValueChanged={(e) => setStatusFilter(e.value)}
                  placeholder="สถานะ"
                />
              </div>
              {(searchText || statusFilter) && (
                <Button
                  text="ล้าง"
                  stylingMode="text"
                  onClick={() => {
                    setSearchText('');
                    setStatusFilter('');
                  }}
                />
              )}
            </div>

            {/* Compact Statistics */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-md">
                <span className="text-gray-500">แสดง:</span>
                <span className="font-semibold text-gray-900">{roles.length}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roles DataGrid */}
      <Card>
        <CardContent className="p-0">
          <DataGrid
            dataSource={roles}
            showBorders={false}
            showRowLines
            rowAlternationEnabled
            columnAutoWidth
            columnHidingEnabled
            wordWrapEnabled
            height={gridHeight}
            hoverStateEnabled
            onRowClick={handleRowClick}
            className="cursor-pointer"
          >
            <LoadPanel enabled={isLoading} />
            <HeaderFilter visible />
            <FilterRow visible />
            <Scrolling mode="virtual" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50]}
              showInfo
              showNavigationButtons
            />

            <Column
              dataField="code"
              caption="รหัส"
              width={180}
              hidingPriority={2}
              cellRender={renderCodeCell}
            />
            <Column dataField="name" caption="ชื่อบทบาท" minWidth={150} hidingPriority={0} />
            <Column dataField="description" caption="คำอธิบาย" minWidth={180} hidingPriority={4} />
            <Column
              dataField="permissionCount"
              caption="จำนวนสิทธิ์"
              width={120}
              alignment="center"
              cellRender={renderPermissionCountCell}
              hidingPriority={3}
            />
            <Column
              caption="สถานะ"
              width={100}
              alignment="center"
              cellRender={renderStatusCell}
              hidingPriority={1}
            />
            <Column
              caption="จัดการ"
              width={120}
              alignment="center"
              cellRender={renderActionsCell}
              hidingPriority={5}
              allowFiltering={false}
              allowSorting={false}
            />
          </DataGrid>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

// HR Roles Management Page
// Feature: 007-hr-personnel-management

import { useState, useCallback } from 'react';
import DataGrid, {
  Column,
  SearchPanel,
  HeaderFilter,
  FilterRow,
  Paging,
  Pager,
  Scrolling,
} from 'devextreme-react/data-grid';
import { Popup, ToolbarItem } from 'devextreme-react/popup';
import TextBox from 'devextreme-react/text-box';
import TextArea from 'devextreme-react/text-area';
import TagBox from 'devextreme-react/tag-box';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import {
  Shield,
  Users,
  Lock,
  Settings,
} from 'lucide-react';
import type { AppRoleWithPermissions, AppPermission } from '@/types/hr';

async function fetchRoles(): Promise<AppRoleWithPermissions[]> {
  const response = await fetch('/api/hr/roles');
  if (!response.ok) throw new Error('Failed to fetch roles');
  const result = await response.json();
  return result.data || [];
}

async function fetchPermissions(): Promise<AppPermission[]> {
  const response = await fetch('/api/hr/permissions');
  if (!response.ok) throw new Error('Failed to fetch permissions');
  const result = await response.json();
  return result.data || [];
}

async function createRole(data: {
  code: string;
  name: string;
  description?: string;
}): Promise<AppRoleWithPermissions> {
  const response = await fetch('/api/hr/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || 'Failed to create role');
  }
  const result = await response.json();
  return result.data;
}

async function updateRole(
  id: number,
  data: { name?: string; description?: string; isActive?: boolean }
): Promise<AppRoleWithPermissions> {
  const response = await fetch('/api/hr/roles/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || 'Failed to update role');
  }
  const result = await response.json();
  return result.data;
}

async function updateRolePermissions(
  roleId: number,
  permissionIds: number[]
): Promise<AppPermission[]> {
  const response = await fetch('/api/hr/roles/' + roleId + '/permissions', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissionIds }),
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || 'Failed to update permissions');
  }
  const result = await response.json();
  return result.data;
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
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [showPermissionsPopup, setShowPermissionsPopup] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRoleWithPermissions | null>(null);

  const [newRole, setNewRole] = useState({
    code: '',
    name: '',
    description: '',
  });

  const [editRole, setEditRole] = useState({
    name: '',
    description: '',
  });

  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);

  const { data: roles = [] } = useQuery({
    queryKey: ['hr', 'roles'],
    queryFn: fetchRoles,
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ['hr', 'permissions'],
    queryFn: fetchPermissions,
  });

  const createMutation = useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'roles'] });
      setShowCreatePopup(false);
      resetNewRole();
      toast.success('สร้างบทบาทสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'ไม่สามารถสร้างบทบาทได้');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; description?: string } }) =>
      updateRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'roles'] });
      setShowEditPopup(false);
      setSelectedRole(null);
      toast.success('แก้ไขบทบาทสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'ไม่สามารถแก้ไขบทบาทได้');
    },
  });

  const permissionsMutation = useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: number; permissionIds: number[] }) =>
      updateRolePermissions(roleId, permissionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'roles'] });
      setShowPermissionsPopup(false);
      setSelectedRole(null);
      toast.success('อัปเดตสิทธิ์สำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'ไม่สามารถอัปเดตสิทธิ์ได้');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'roles'] });
      toast.success('ปิดใช้งานบทบาทสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'ไม่สามารถปิดใช้งานบทบาทได้');
    },
  });

  const resetNewRole = () => {
    setNewRole({
      code: '',
      name: '',
      description: '',
    });
  };

  const handleCreateRole = useCallback(() => {
    if (!newRole.code || !newRole.name) return;
    createMutation.mutate({
      code: newRole.code,
      name: newRole.name,
      description: newRole.description || undefined,
    });
  }, [newRole, createMutation]);

  const handleUpdateRole = useCallback(() => {
    if (!selectedRole || !editRole.name) return;
    updateMutation.mutate({
      id: selectedRole.id,
      data: {
        name: editRole.name,
        description: editRole.description || undefined,
      },
    });
  }, [selectedRole, editRole, updateMutation]);

  const handleUpdatePermissions = useCallback(() => {
    if (!selectedRole) return;
    permissionsMutation.mutate({
      roleId: selectedRole.id,
      permissionIds: selectedPermissionIds,
    });
  }, [selectedRole, selectedPermissionIds, permissionsMutation]);

  const openEditPopup = (role: AppRoleWithPermissions) => {
    setSelectedRole(role);
    setEditRole({
      name: role.name,
      description: role.description || '',
    });
    setShowEditPopup(true);
  };

  const openPermissionsPopup = async (role: AppRoleWithPermissions) => {
    setSelectedRole(role);
    // Fetch current permissions for this role
    const response = await fetch('/api/hr/roles/' + role.id + '/permissions');
    if (response.ok) {
      const result = await response.json();
      setSelectedPermissionIds((result.data || []).map((p: AppPermission) => p.id));
    }
    setShowPermissionsPopup(true);
  };

  // Group permissions by module
  const permissionsByModule = permissions.reduce(
    (acc, perm) => {
      if (!acc[perm.module]) {
        acc[perm.module] = [];
      }
      acc[perm.module].push(perm);
      return acc;
    },
    {} as Record<string, AppPermission[]>
  );

  const renderStatusCell = (cellData: { data: AppRoleWithPermissions }) => {
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
  };

  const renderPermissionCountCell = (cellData: { value: number }) => {
    return (
      <Badge variant="secondary" className="text-xs">
        {cellData.value} สิทธิ์
      </Badge>
    );
  };

  const renderActionsCell = (cellData: { data: AppRoleWithPermissions }) => {
    const role = cellData.data;

    return (
      <div className="flex gap-1">
        <DxButton
          icon="key"
          hint="จัดการสิทธิ์"
          type="default"
          stylingMode="text"
          onClick={() => openPermissionsPopup(role)}
          disabled={role.isSystemRole}
        />
        <DxButton
          icon="edit"
          hint="แก้ไข"
          type="default"
          stylingMode="text"
          onClick={() => openEditPopup(role)}
          disabled={role.isSystemRole}
        />
        {role.isActive && !role.isSystemRole && (
          <DxButton
            icon="close"
            hint="ปิดใช้งาน"
            type="danger"
            stylingMode="text"
            onClick={() => {
              if (confirm('ต้องการปิดใช้งานบทบาทนี้หรือไม่?')) {
                deactivateMutation.mutate(role.id);
              }
            }}
          />
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            จัดการบทบาทและสิทธิ์
          </h1>
          <p className="text-gray-600 mt-1">
            กำหนดบทบาทและสิทธิ์การเข้าถึงในระบบ
          </p>
        </div>
        <DxButton
          text="สร้างบทบาท"
          icon="plus"
          type="default"
          onClick={() => setShowCreatePopup(true)}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-full">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{roles.length}</div>
              <div className="text-gray-600 text-sm">บทบาททั้งหมด</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-full">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {roles.filter((r) => r.isActive).length}
              </div>
              <div className="text-gray-600 text-sm">ใช้งาน</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-full">
              <Lock className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {roles.filter((r) => r.isSystemRole).length}
              </div>
              <div className="text-gray-600 text-sm">บทบาทระบบ</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-full">
              <Settings className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{permissions.length}</div>
              <div className="text-gray-600 text-sm">สิทธิ์ทั้งหมด</div>
            </div>
          </div>
        </div>
      </div>

      {/* Roles DataGrid */}
      <div className="bg-white rounded-lg shadow">
        <DataGrid
          dataSource={roles}
          showBorders
          rowAlternationEnabled
          columnAutoWidth
          wordWrapEnabled
          height={500}
        >
          <SearchPanel visible placeholder="ค้นหา..." />
          <HeaderFilter visible />
          <FilterRow visible />
          <Scrolling mode="virtual" />
          <Paging defaultPageSize={20} />
          <Pager
            showPageSizeSelector
            allowedPageSizes={[10, 20, 50]}
            showInfo
          />

          <Column dataField="code" caption="รหัส" width={150} />
          <Column dataField="name" caption="ชื่อบทบาท" width={200} />
          <Column dataField="description" caption="คำอธิบาย" />
          <Column
            dataField="permissionCount"
            caption="จำนวนสิทธิ์"
            width={120}
            alignment="center"
            cellRender={renderPermissionCountCell}
          />
          <Column
            caption="สถานะ"
            width={120}
            alignment="center"
            cellRender={renderStatusCell}
          />
          <Column
            caption="จัดการ"
            width={140}
            alignment="center"
            cellRender={renderActionsCell}
          />
        </DataGrid>
      </div>

      {/* Create Role Popup */}
      <Popup
        visible={showCreatePopup}
        onHiding={() => {
          setShowCreatePopup(false);
          resetNewRole();
        }}
        title="สร้างบทบาทใหม่"
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="space-y-4 p-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              รหัสบทบาท <span className="text-red-500">*</span>
            </label>
            <TextBox
              value={newRole.code}
              onValueChanged={(e) =>
                setNewRole((prev) => ({ ...prev, code: e.value || '' }))
              }
              placeholder="เช่น quality_manager"
            />
            <p className="text-xs text-gray-500 mt-1">
              ตัวพิมพ์เล็กและขีดล่างเท่านั้น
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ชื่อบทบาท <span className="text-red-500">*</span>
            </label>
            <TextBox
              value={newRole.name}
              onValueChanged={(e) =>
                setNewRole((prev) => ({ ...prev, name: e.value || '' }))
              }
              placeholder="เช่น ผู้จัดการคุณภาพ"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              คำอธิบาย
            </label>
            <TextArea
              value={newRole.description}
              onValueChanged={(e) =>
                setNewRole((prev) => ({ ...prev, description: e.value || '' }))
              }
              placeholder="ระบุคำอธิบายบทบาท..."
              height={80}
            />
          </div>
        </div>

        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'ยกเลิก',
            onClick: () => {
              setShowCreatePopup(false);
              resetNewRole();
            },
          }}
        />
        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'สร้าง',
            type: 'default',
            disabled: !newRole.code || !newRole.name || createMutation.isPending,
            onClick: handleCreateRole,
          }}
        />
      </Popup>

      {/* Edit Role Popup */}
      <Popup
        visible={showEditPopup}
        onHiding={() => {
          setShowEditPopup(false);
          setSelectedRole(null);
        }}
        title={`แก้ไขบทบาท: ${selectedRole?.code || ''}`}
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="space-y-4 p-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ชื่อบทบาท <span className="text-red-500">*</span>
            </label>
            <TextBox
              value={editRole.name}
              onValueChanged={(e) =>
                setEditRole((prev) => ({ ...prev, name: e.value || '' }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              คำอธิบาย
            </label>
            <TextArea
              value={editRole.description}
              onValueChanged={(e) =>
                setEditRole((prev) => ({ ...prev, description: e.value || '' }))
              }
              height={80}
            />
          </div>
        </div>

        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'ยกเลิก',
            onClick: () => {
              setShowEditPopup(false);
              setSelectedRole(null);
            },
          }}
        />
        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'บันทึก',
            type: 'default',
            disabled: !editRole.name || updateMutation.isPending,
            onClick: handleUpdateRole,
          }}
        />
      </Popup>

      {/* Permissions Popup */}
      <Popup
        visible={showPermissionsPopup}
        onHiding={() => {
          setShowPermissionsPopup(false);
          setSelectedRole(null);
          setSelectedPermissionIds([]);
        }}
        title={`จัดการสิทธิ์: ${selectedRole?.name || ''}`}
        width={700}
        height={600}
        showCloseButton
      >
        <div className="space-y-4 p-2 h-full overflow-y-auto">
          {Object.entries(permissionsByModule).map(([module, modulePermissions]) => (
            <div key={module} className="border rounded-lg p-4">
              <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                {module}
              </h3>
              <TagBox
                items={modulePermissions}
                displayExpr="name"
                valueExpr="id"
                value={selectedPermissionIds.filter((id) =>
                  modulePermissions.some((p) => p.id === id)
                )}
                onValueChanged={(e) => {
                  const otherModuleIds = selectedPermissionIds.filter(
                    (id) => !modulePermissions.some((p) => p.id === id)
                  );
                  setSelectedPermissionIds([...otherModuleIds, ...(e.value || [])]);
                }}
                showSelectionControls
                placeholder="เลือกสิทธิ์..."
              />
            </div>
          ))}
        </div>

        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'ยกเลิก',
            onClick: () => {
              setShowPermissionsPopup(false);
              setSelectedRole(null);
              setSelectedPermissionIds([]);
            },
          }}
        />
        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'บันทึก',
            type: 'default',
            disabled: permissionsMutation.isPending,
            onClick: handleUpdatePermissions,
          }}
        />
      </Popup>
    </div>
  );
}

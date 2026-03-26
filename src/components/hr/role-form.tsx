'use client';

// Role Form Component
// Following template design pattern for create/edit flow
// Feature: 007-hr-personnel-management

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from 'devextreme-react/button';
import TextBox from 'devextreme-react/text-box';
import TextArea from 'devextreme-react/text-area';
import TagBox from 'devextreme-react/tag-box';
import LoadIndicator from 'devextreme-react/load-indicator';
import notify from 'devextreme/ui/notify';
import {
  Shield,
  Key,
  Settings,
} from 'lucide-react';
import type { AppRoleWithPermissions, AppPermission } from '@/types/hr';

export interface RoleFormProps {
  mode: 'create' | 'edit';
  roleId?: number;
  onSuccess?: (role: AppRoleWithPermissions) => void;
  onCancel?: () => void;
}

interface FormData {
  code: string;
  name: string;
  description: string;
}

const defaultFormData: FormData = {
  code: '',
  name: '',
  description: '',
};

async function fetchRole(id: number): Promise<AppRoleWithPermissions> {
  const res = await fetch(`/api/hr/roles/${id}`);
  if (!res.ok) throw new Error('Failed to fetch role');
  const data = await res.json();
  return data.data;
}

async function fetchRolePermissions(id: number): Promise<AppPermission[]> {
  const res = await fetch(`/api/hr/roles/${id}/permissions`);
  if (!res.ok) throw new Error('Failed to fetch role permissions');
  const data = await res.json();
  return data.data || [];
}

async function fetchAllPermissions(): Promise<AppPermission[]> {
  const res = await fetch('/api/hr/permissions');
  if (!res.ok) throw new Error('Failed to fetch permissions');
  const data = await res.json();
  return data.data || [];
}

async function createRole(data: { code: string; name: string; description?: string }): Promise<AppRoleWithPermissions> {
  const res = await fetch('/api/hr/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to create role');
  }
  const result = await res.json();
  return result.data;
}

async function updateRole(id: number, data: { name?: string; description?: string }): Promise<AppRoleWithPermissions> {
  const res = await fetch(`/api/hr/roles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to update role');
  }
  const result = await res.json();
  return result.data;
}

async function updateRolePermissions(roleId: number, permissionIds: number[]): Promise<void> {
  const res = await fetch(`/api/hr/roles/${roleId}/permissions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissionIds }),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to update permissions');
  }
}

async function deleteRole(id: number): Promise<void> {
  const res = await fetch(`/api/hr/roles/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to deactivate role');
  }
}

export function RoleForm({ mode, roleId, onSuccess, onCancel }: RoleFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditMode = mode === 'edit';

  const [formData, setFormData] = React.useState<FormData>(defaultFormData);
  const [selectedPermissionIds, setSelectedPermissionIds] = React.useState<number[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  // Fetch role data in edit mode
  const { data: role, isLoading: isLoadingRole } = useQuery({
    queryKey: ['hr', 'role', roleId],
    queryFn: () => fetchRole(roleId!),
    enabled: isEditMode && !!roleId,
  });

  // Fetch role permissions in edit mode
  const { data: rolePermissions = [] } = useQuery({
    queryKey: ['hr', 'role-permissions', roleId],
    queryFn: () => fetchRolePermissions(roleId!),
    enabled: isEditMode && !!roleId,
  });

  // Fetch all permissions
  const { data: allPermissions = [] } = useQuery({
    queryKey: ['hr', 'permissions'],
    queryFn: fetchAllPermissions,
  });

  // Initialize form data when role is loaded
  React.useEffect(() => {
    if (role) {
      setFormData({
        code: role.code,
        name: role.name,
        description: role.description || '',
      });
    }
  }, [role]);

  // Initialize permissions when loaded
  React.useEffect(() => {
    if (rolePermissions.length > 0) {
      setSelectedPermissionIds(rolePermissions.map(p => p.id));
    }
  }, [rolePermissions]);

  // Group permissions by module
  const permissionsByModule = React.useMemo(() => {
    return allPermissions.reduce((acc, perm) => {
      if (!acc[perm.module]) {
        acc[perm.module] = [];
      }
      acc[perm.module].push(perm);
      return acc;
    }, {} as Record<string, AppPermission[]>);
  }, [allPermissions]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: createRole,
    onSuccess: async (data) => {
      // Also save permissions if any selected
      if (selectedPermissionIds.length > 0) {
        await updateRolePermissions(data.id, selectedPermissionIds);
      }
      queryClient.invalidateQueries({ queryKey: ['hr', 'roles'] });
      notify('สร้างบทบาทสำเร็จ', 'success', 3000);
      onSuccess?.(data);
      router.push('/hr/roles');
    },
    onError: (error: Error) => {
      notify(error.message || 'ไม่สามารถสร้างบทบาทได้', 'error', 5000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; description?: string } }) =>
      updateRole(id, data),
    onSuccess: async (data) => {
      // Also update permissions
      await updateRolePermissions(data.id, selectedPermissionIds);
      queryClient.invalidateQueries({ queryKey: ['hr', 'roles'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'role', roleId] });
      notify('แก้ไขบทบาทสำเร็จ', 'success', 3000);
      onSuccess?.(data);
      router.push('/hr/roles');
    },
    onError: (error: Error) => {
      notify(error.message || 'ไม่สามารถแก้ไขบทบาทได้', 'error', 5000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'roles'] });
      notify('ปิดใช้งานบทบาทสำเร็จ', 'success', 3000);
      router.push('/hr/roles');
    },
    onError: (error: Error) => {
      notify(error.message || 'ไม่สามารถปิดใช้งานบทบาทได้', 'error', 5000);
    },
  });

  const handleSubmit = () => {
    if (!formData.code || !formData.name) {
      notify('กรุณากรอกข้อมูลให้ครบถ้วน', 'warning', 3000);
      return;
    }

    if (isEditMode && roleId) {
      updateMutation.mutate({
        id: roleId,
        data: {
          name: formData.name,
          description: formData.description || undefined,
        },
      });
    } else {
      createMutation.mutate({
        code: formData.code,
        name: formData.name,
        description: formData.description || undefined,
      });
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push('/hr/roles');
    }
  };

  const handleDelete = () => {
    if (roleId) {
      deleteMutation.mutate(roleId);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isValid = !!formData.code && !!formData.name;

  // Handle permission selection for a module
  const handleModulePermissionChange = (module: string, newModulePermissionIds: number[]) => {
    const modulePermissionIds = permissionsByModule[module]?.map(p => p.id) || [];
    const otherIds = selectedPermissionIds.filter(id => !modulePermissionIds.includes(id));
    setSelectedPermissionIds([...otherIds, ...newModulePermissionIds]);
  };

  if (isEditMode && isLoadingRole) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadIndicator />
      </div>
    );
  }

  // Check if system role (read-only in edit mode)
  const isSystemRole = role?.isSystemRole || false;

  return (
      <div className="space-y-6 p-1">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              icon="back"
              stylingMode="text"
              onClick={handleCancel}
            />
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {isEditMode ? `แก้ไขบทบาท: ${role?.code || ''}` : 'สร้างบทบาทใหม่'}
                </h1>
                <p className="text-sm text-gray-500">
                  {isEditMode ? 'แก้ไขข้อมูลและสิทธิ์ของบทบาท' : 'กรอกข้อมูลบทบาทและกำหนดสิทธิ์'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditMode && !isSystemRole && (
              <Button
                text="ปิดใช้งาน"
                icon="trash"
                type="danger"
                stylingMode="outlined"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleteMutation.isPending}
              />
            )}
            <Button
              text="ยกเลิก"
              stylingMode="outlined"
              onClick={handleCancel}
              disabled={isPending}
            />
            <Button
              text={isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              icon={isPending ? 'spindown' : 'save'}
              type="success"
              onClick={handleSubmit}
              disabled={!isValid || isPending || isSystemRole}
              elementAttr={{ 'data-testid': 'role-submit-btn' }}
            />
          </div>
        </div>

        {/* System Role Warning */}
        {isSystemRole && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 text-amber-800">
                <Shield className="h-5 w-5" />
                <span className="font-medium">
                  บทบาทระบบไม่สามารถแก้ไขได้
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-red-800">ยืนยันการปิดใช้งาน</p>
                  <p className="text-sm text-red-600">
                    คุณต้องการปิดใช้งานบทบาท &quot;{role?.name}&quot; หรือไม่?
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    text="ยกเลิก"
                    stylingMode="outlined"
                    onClick={() => setShowDeleteConfirm(false)}
                  />
                  <Button
                    text={deleteMutation.isPending ? 'กำลังลบ...' : 'ปิดใช้งาน'}
                    icon="trash"
                    type="danger"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Role Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-5 w-5 text-blue-500" />
                  ข้อมูลบทบาท
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div data-testid="role-code-field">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    รหัสบทบาท <span className="text-red-500">*</span>
                  </label>
                  <TextBox
                    value={formData.code}
                    onValueChanged={(e) => setFormData(prev => ({ ...prev, code: e.value || '' }))}
                    placeholder="เช่น quality_manager"
                    disabled={isEditMode || isSystemRole}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ตัวพิมพ์เล็กและขีดล่างเท่านั้น (ไม่สามารถแก้ไขได้หลังสร้าง)
                  </p>
                </div>

                <div data-testid="role-name-field">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ชื่อบทบาท <span className="text-red-500">*</span>
                  </label>
                  <TextBox
                    value={formData.name}
                    onValueChanged={(e) => setFormData(prev => ({ ...prev, name: e.value || '' }))}
                    placeholder="เช่น ผู้จัดการคุณภาพ"
                    disabled={isSystemRole}
                  />
                </div>

                <div data-testid="role-description-field">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    คำอธิบาย
                  </label>
                  <TextArea
                    value={formData.description}
                    onValueChanged={(e) => setFormData(prev => ({ ...prev, description: e.value || '' }))}
                    placeholder="ระบุคำอธิบายบทบาท..."
                    height={100}
                    disabled={isSystemRole}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Permissions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Key className="h-5 w-5 text-amber-500" />
                  สิทธิ์การเข้าถึง
                  <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                    {selectedPermissionIds.length} สิทธิ์
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(permissionsByModule).map(([module, modulePermissions]) => {
                  const modulePermissionIds = modulePermissions.map(p => p.id);
                  const selectedForModule = selectedPermissionIds.filter(id => modulePermissionIds.includes(id));

                  return (
                    <div key={module} className="border rounded-lg p-4">
                      <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        {module}
                        <span className="text-xs text-gray-500">
                          ({selectedForModule.length}/{modulePermissions.length})
                        </span>
                      </h3>
                      <TagBox
                        items={modulePermissions}
                        displayExpr="name"
                        valueExpr="id"
                        value={selectedForModule}
                        onValueChanged={(e) => handleModulePermissionChange(module, e.value || [])}
                        showSelectionControls
                        placeholder="เลือกสิทธิ์..."
                        disabled={isSystemRole}
                      />
                    </div>
                  );
                })}
                {Object.keys(permissionsByModule).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Key className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>ไม่พบสิทธิ์ในระบบ</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">สรุป</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">รหัส</span>
                  <span className="font-medium text-gray-900">{formData.code || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ชื่อ</span>
                  <span className="font-medium text-gray-900 truncate max-w-[150px]">
                    {formData.name || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">จำนวนสิทธิ์</span>
                  <span className="font-medium text-amber-600">{selectedPermissionIds.length} สิทธิ์</span>
                </div>
                {isEditMode && role && (
                  <>
                    <div className="pt-3 border-t">
                      <div className="flex justify-between">
                        <span className="text-gray-500">สถานะ</span>
                        <span className={`font-medium ${role.isActive ? 'text-green-600' : 'text-red-600'}`}>
                          {role.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                        </span>
                      </div>
                    </div>
                    {role.isSystemRole && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">ประเภท</span>
                        <span className="font-medium text-purple-600">บทบาทระบบ</span>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            {isEditMode && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">การดำเนินการ</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    text="กลับไปรายการ"
                    icon="back"
                    stylingMode="outlined"
                    width="100%"
                    onClick={() => router.push('/hr/roles')}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
  );
}

export default RoleForm;

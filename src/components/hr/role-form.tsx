'use client';

// Role Form Component
// Following template design pattern for create/edit flow
// Feature: 007-hr-personnel-management

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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

/**
 * Memoized per-module permission selector.
 * DevExtreme TagBox's template-manager calls React setState internally
 * when it detects prop changes. New array references on `value` cause
 * infinite re-render loops. This component uses React.memo with a custom
 * comparator to prevent unnecessary TagBox re-renders.
 */
const ModulePermissionSelector = React.memo(function ModulePermissionSelector({
  module,
  modulePermissions,
  selectedIds,
  onChange,
  disabled,
  placeholder,
}: {
  module: string;
  modulePermissions: AppPermission[];
  selectedIds: number[];
  onChange: (module: string, ids: number[]) => void;
  disabled: boolean;
  placeholder: string;
}) {
  const handleChange = React.useCallback(
    (e: { value?: number[] }) => onChange(module, e.value || []),
    [module, onChange]
  );

  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
        <Settings className="h-4 w-4" />
        {module}
        <span className="text-xs text-gray-500">
          ({selectedIds.length}/{modulePermissions.length})
        </span>
      </h3>
      <TagBox
        items={modulePermissions}
        displayExpr="name"
        valueExpr="id"
        value={selectedIds}
        onValueChanged={handleChange}
        showSelectionControls
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}, (prev, next) => {
  if (prev.module !== next.module) return false;
  if (prev.disabled !== next.disabled) return false;
  if (prev.placeholder !== next.placeholder) return false;
  if (prev.modulePermissions !== next.modulePermissions) return false;
  if (prev.onChange !== next.onChange) return false;
  // Deep compare selectedIds to avoid re-render on same content
  if (prev.selectedIds.length !== next.selectedIds.length) return false;
  return prev.selectedIds.every((id, i) => id === next.selectedIds[i]);
});

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

async function activateRole(id: number): Promise<AppRoleWithPermissions> {
  const res = await fetch(`/api/hr/roles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: true }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to activate role');
  }
  return res.json();
}

export function RoleForm({ mode, roleId, onSuccess, onCancel }: RoleFormProps) {
  const t = useTranslations('hr');
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

  // Initialize permissions when loaded — use functional setState to
  // return same reference when content is unchanged, preventing re-render
  React.useEffect(() => {
    if (rolePermissions.length > 0) {
      const newIds = rolePermissions.map(p => p.id).sort((a, b) => a - b);
      setSelectedPermissionIds(prev => {
        const sorted = [...prev].sort((a, b) => a - b);
        if (sorted.length === newIds.length && sorted.every((v, i) => v === newIds[i])) {
          return prev;
        }
        return newIds;
      });
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
      notify(t('roles.form.toast.createSuccess'), 'success', 3000);
      onSuccess?.(data);
      router.push('/hr/roles');
    },
    onError: (error: Error) => {
      notify(error.message || t('roles.form.toast.createError'), 'error', 5000);
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
      notify(t('roles.form.toast.updateSuccess'), 'success', 3000);
      onSuccess?.(data);
      router.push('/hr/roles');
    },
    onError: (error: Error) => {
      notify(error.message || t('roles.form.toast.updateError'), 'error', 5000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'roles'] });
      notify(t('roles.form.toast.deactivateSuccess'), 'success', 3000);
      router.push('/hr/roles');
    },
    onError: (error: Error) => {
      notify(error.message || t('roles.form.toast.deactivateError'), 'error', 5000);
    },
  });

  const activateMutation = useMutation({
    mutationFn: activateRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'roles'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'role', roleId] });
      notify(t('roles.form.toast.activateSuccess'), 'success', 3000);
    },
    onError: (error: Error) => {
      notify(error.message || t('roles.form.toast.activateError'), 'error', 5000);
    },
  });

  const handleSubmit = () => {
    if (!formData.code || !formData.name) {
      notify(t('roles.form.validation.incomplete'), 'warning', 3000);
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

  // Handle permission selection for a module — use functional setState
  // to avoid creating new array references when content hasn't changed
  const handleModulePermissionChange = React.useCallback(
    (module: string, newModulePermissionIds: number[]) => {
      setSelectedPermissionIds(prev => {
        const modulePermissionIds = permissionsByModule[module]?.map(p => p.id) || [];
        const otherIds = prev.filter(id => !modulePermissionIds.includes(id));
        const newIds = [...otherIds, ...newModulePermissionIds];
        // Return same reference if content unchanged — prevents re-render
        const sortedNew = [...newIds].sort((a, b) => a - b);
        const sortedPrev = [...prev].sort((a, b) => a - b);
        if (sortedNew.length === sortedPrev.length && sortedNew.every((v, i) => v === sortedPrev[i])) {
          return prev;
        }
        return newIds;
      });
    },
    [permissionsByModule]
  );

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
                  {isEditMode ? t('roles.form.editTitle', { code: role?.code || '' }) : t('roles.form.createTitle')}
                </h1>
                <p className="text-sm text-gray-500">
                  {isEditMode ? t('roles.form.editSubtitle') : t('roles.form.createSubtitle')}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditMode && !isSystemRole && role?.isActive === false && (
              <Button
                text={t('roles.form.activate')}
                icon="check"
                type="success"
                stylingMode="outlined"
                onClick={() => roleId && activateMutation.mutate(roleId)}
                disabled={activateMutation.isPending}
                elementAttr={{ 'data-testid': 'role-activate-btn' }}
              />
            )}
            {isEditMode && !isSystemRole && role?.isActive !== false && (
              <Button
                text={t('roles.form.deactivate')}
                icon="trash"
                type="danger"
                stylingMode="outlined"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleteMutation.isPending}
              />
            )}
            <Button
              text={t('roles.form.cancel')}
              stylingMode="outlined"
              onClick={handleCancel}
              disabled={isPending}
            />
            <Button
              text={isPending ? t('roles.form.saving') : t('roles.form.save')}
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
                  {t('roles.form.systemRoleWarning')}
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
                  <p className="font-medium text-red-800">{t('roles.form.deleteConfirm.title')}</p>
                  <p className="text-sm text-red-600">
                    {t('roles.form.deleteConfirm.message', { name: role?.name || '' })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    text={t('roles.form.cancel')}
                    stylingMode="outlined"
                    onClick={() => setShowDeleteConfirm(false)}
                  />
                  <Button
                    text={deleteMutation.isPending ? t('roles.form.deleting') : t('roles.form.deactivate')}
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
                  {t('roles.form.infoTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div data-testid="role-code-field">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('roles.form.code.label')} <span className="text-red-500">*</span>
                  </label>
                  <TextBox
                    value={formData.code}
                    onValueChanged={(e) => setFormData(prev => ({ ...prev, code: e.value || '' }))}
                    placeholder={t('roles.form.code.placeholder')}
                    disabled={isEditMode || isSystemRole}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('roles.form.code.hint')}
                  </p>
                </div>

                <div data-testid="role-name-field">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('roles.form.name.label')} <span className="text-red-500">*</span>
                  </label>
                  <TextBox
                    value={formData.name}
                    onValueChanged={(e) => setFormData(prev => ({ ...prev, name: e.value || '' }))}
                    placeholder={t('roles.form.name.placeholder')}
                    disabled={isSystemRole}
                  />
                </div>

                <div data-testid="role-description-field">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('roles.form.description.label')}
                  </label>
                  <TextArea
                    value={formData.description}
                    onValueChanged={(e) => setFormData(prev => ({ ...prev, description: e.value || '' }))}
                    placeholder={t('roles.form.description.placeholder')}
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
                  {t('roles.form.permissionsTitle')}
                  <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                    {t('roles.form.permissionCount', { count: selectedPermissionIds.length })}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(permissionsByModule).map(([module, modulePermissions]) => {
                  const modulePermissionIds = modulePermissions.map(p => p.id);
                  const selectedForModule = selectedPermissionIds.filter(id => modulePermissionIds.includes(id));

                  return (
                    <ModulePermissionSelector
                      key={module}
                      module={module}
                      modulePermissions={modulePermissions}
                      selectedIds={selectedForModule}
                      onChange={handleModulePermissionChange}
                      disabled={isSystemRole}
                      placeholder={t('roles.form.permissionPlaceholder')}
                    />
                  );
                })}
                {Object.keys(permissionsByModule).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Key className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>{t('roles.form.noPermissions')}</p>
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
                <CardTitle className="text-base">{t('roles.form.summaryTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('roles.form.summaryCode')}</span>
                  <span className="font-medium text-gray-900">{formData.code || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('roles.form.summaryName')}</span>
                  <span className="font-medium text-gray-900 truncate max-w-[150px]">
                    {formData.name || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('roles.form.summaryPermissionCount')}</span>
                  <span className="font-medium text-amber-600">{t('roles.form.permissionCount', { count: selectedPermissionIds.length })}</span>
                </div>
                {isEditMode && role && (
                  <>
                    <div className="pt-3 border-t">
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('roles.form.summaryStatus')}</span>
                        <span className={`font-medium ${role.isActive ? 'text-green-600' : 'text-red-600'}`}>
                          {role.isActive ? t('roles.form.statusActive') : t('roles.form.statusInactive')}
                        </span>
                      </div>
                    </div>
                    {role.isSystemRole && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('roles.form.summaryType')}</span>
                        <span className="font-medium text-purple-600">{t('roles.form.systemRoleLabel')}</span>
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
                  <CardTitle className="text-base">{t('roles.form.quickActionsTitle')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    text={t('roles.form.backToList')}
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

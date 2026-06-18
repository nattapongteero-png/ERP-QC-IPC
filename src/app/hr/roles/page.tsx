'use client';

// HR Roles Management Page
// Following template design pattern for list page with CRUD operations
// Feature: 007-hr-personnel-management

import { useState, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import DataGrid, {
  Column,
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
  CheckCircle,
} from 'lucide-react';
import type { AppRoleWithPermissions } from '@/types/hr';

// Status options for filter - use translationKey instead of label
const statusOptionConfig = [
  { value: '', translationKey: 'filters.all' },
  { value: 'active', translationKey: 'filters.active' },
  { value: 'inactive', translationKey: 'filters.inactive' },
  { value: 'system', translationKey: 'filters.system' },
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

async function activateRoleById(id: number): Promise<void> {
  const response = await fetch('/api/hr/roles/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: true }),
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || 'Failed to activate role');
  }
}

export default function RolesPage() {
  const t = useTranslations('hr');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Build status options with translations
  const statusOptions = useMemo(
    () =>
      statusOptionConfig.map((o) => ({
        value: o.value,
        label: t(`roles.${o.translationKey}`),
      })),
    [t]
  );

  // Filter states
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Delete confirmation state
  const [selectedRole, setSelectedRole] = useState<AppRoleWithPermissions | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

    return filtered.map((item, index) => ({ ...item, _rowNumber: index + 1 }));
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
      toast.success(t('roles.toast.deactivateSuccess'));
      setShowDeleteConfirm(false);
      setSelectedRole(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || t('roles.toast.deactivateError'));
    },
  });

  const activateMutation = useMutation({
    mutationFn: activateRoleById,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'roles'] });
      toast.success('เปิดใช้งานบทบาทสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'ไม่สามารถเปิดใช้งานบทบาทได้');
    },
  });

  const handleActivate = useCallback((role: AppRoleWithPermissions) => {
    activateMutation.mutate(role.id);
  }, [activateMutation]);

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
          {t('roles.status.system')}
        </Badge>
      );
    }
    return role.isActive ? (
      <Badge variant="success">{t('roles.status.active')}</Badge>
    ) : (
      <Badge variant="danger">{t('roles.status.inactive')}</Badge>
    );
  }, [t]);

  const renderPermissionCountCell = useCallback((cellData: { value: number }) => {
    return (
      <div className="flex items-center gap-1.5">
        <Key className="h-3.5 w-3.5 text-amber-500" />
        <span className="font-medium">{cellData.value || 0}</span>
        <span className="text-gray-500 text-xs">{t('roles.permissions')}</span>
      </div>
    );
  }, [t]);

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
          title={t('roles.actionsHint.view')}
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
              title={t('roles.actionsHint.edit')}
            >
              <Edit className="h-4 w-4" />
            </button>
            {role.isActive ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(role);
                }}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title={t('roles.actionsHint.deactivate')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleActivate(role);
                }}
                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                title="เปิดใช้งาน"
                data-testid={`role-activate-${role.id}`}
              >
                <CheckCircle className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>
    );
  }, [router, handleDelete, handleActivate, t]);

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6" data-testid="hr-roles-page">
      {/* ResponsivePageHeader */}
      <ResponsivePageHeader
        title={t('roles.title')}
        subtitle={t('roles.description')}
        icon={Shield}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: t('roles.breadcrumb') },
        ]}
        actions={
          <Button
            text={t('roles.createRole')}
            icon="plus"
            type="success"
            onClick={() => router.push('/hr/roles/new')}
            elementAttr={{ 'data-testid': 'hr-add-role-btn' }}
          />
        }
      />

      {/* Stats using StatCard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4" data-testid="hr-roles-stats">
        <StatCard
          label={t('roles.stats.total')}
          value={stats.total}
          icon={Shield}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
        />
        <StatCard
          label={t('roles.stats.active')}
          value={stats.active}
          icon={Users}
          iconColor="text-green-500"
          accentColor="border-green-500"
        />
        <StatCard
          label={t('roles.stats.system')}
          value={stats.system}
          icon={Lock}
          iconColor="text-purple-500"
          accentColor="border-purple-500"
        />
        <StatCard
          label={t('roles.stats.totalPermissions')}
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
                <p className="font-medium text-red-800">{t('roles.deleteConfirm.title')}</p>
                <p className="text-sm text-red-600">
                  {t('roles.deleteConfirm.message', { 0: selectedRole.name })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text={t('common.cancel')}
                  stylingMode="outlined"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedRole(null);
                  }}
                />
                <Button
                  text={deactivateMutation.isPending ? t('roles.deleteConfirm.deactivating') : t('roles.deleteConfirm.deactivate')}
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
                <span className="text-sm font-medium text-gray-700">{t('common.filters')}:</span>
              </div>
              <div className="w-56">
                <TextBox
                  value={searchText}
                  onValueChanged={(e) => setSearchText(e.value || '')}
                  valueChangeEvent="keyup"
                  placeholder={t('roles.filters.placeholder')}
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
                  placeholder={t('roles.filters.statusPlaceholder')}
                />
              </div>
              {(searchText || statusFilter) && (
                <Button
                  text={t('notifications.filters.clear')}
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
                <span className="text-gray-500">{t('common.show')}</span>
                <span className="font-semibold text-gray-900">{roles.length}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roles DataGrid */}
      <Card data-testid="hr-roles-grid">
        <CardContent className="p-0">
          <DataGrid
            key={locale}
            dataSource={roles}
            showBorders={false}
            showRowLines
            rowAlternationEnabled
            columnAutoWidth
            columnHidingEnabled
            wordWrapEnabled
            height="auto"
            hoverStateEnabled
            onRowClick={handleRowClick}
            className="cursor-pointer"
          >
            <LoadPanel enabled={isLoading} />
            <Scrolling mode="standard" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50]}
              showInfo
              showNavigationButtons
            />

            <Column
              dataField="_rowNumber"
              caption={t('items.grid.columns.rowNum')}
              width={60}
              alignment="center"
              allowFiltering={false}
              allowSorting={false}
              allowGrouping={false}
              cellRender={(cellInfo) => (
                <span className="text-gray-500 text-sm font-medium">
                  {cellInfo.data._rowNumber}
                </span>
              )}
            />
            <Column
              dataField="code"
              caption={t('roles.columns.code')}
              width={180}
              hidingPriority={2}
              cellRender={renderCodeCell}
            />
            <Column dataField="name" caption={t('roles.columns.name')} minWidth={150} hidingPriority={0} />
            <Column dataField="description" caption={t('roles.columns.description')} minWidth={180} hidingPriority={4} />
            <Column
              dataField="permissionCount"
              caption={t('roles.columns.permissionCount')}
              width={120}
              alignment="center"
              cellRender={renderPermissionCountCell}
              hidingPriority={3}
            />
            <Column
              caption={t('roles.columns.status')}
              width={100}
              alignment="center"
              cellRender={renderStatusCell}
              hidingPriority={1}
            />
            <Column
              caption={t('roles.columns.actions')}
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

'use client';

/**
 * Confidential Access Groups Page
 * Admin page to manage confidential access groups for BOM confidentiality.
 * Feature: BOM Confidentiality Protection (014-unit-cost)
 */

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ShieldCheck,
  Filter,
  Edit,
  Trash2,
  Users,
} from 'lucide-react';
import DataGrid, {
  Column,
  Paging,
  Pager,
  Sorting,
  LoadPanel,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import TextBox from 'devextreme-react/text-box';
import notify from 'devextreme/ui/notify';
import { Card, CardContent } from '@/components/ui/card';
import { DxPopup, DxConfirmDialog } from '@/components/ui/dx-popup';
import { ResponsivePageHeader } from '@/components/shared';
import type { ConfidentialAccessGroup } from '@/types/confidentiality';

// Page header component
function PageHeader({
  title,
  subtitle,
  icon: Icon,
  iconClassName,
  onRefresh,
  isRefreshing,
  actions,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  iconClassName?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${iconClassName || 'from-blue-500 to-indigo-600'} text-white shadow-lg`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">{title}</h1>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {onRefresh && (
          <Button
            icon={isRefreshing ? 'spindown' : 'refresh'}
            stylingMode="text"
            hint="Refresh"
            onClick={onRefresh}
            disabled={isRefreshing}
            elementAttr={{ 'data-testid': 'refresh-btn' }}
          />
        )}
        {actions}
      </div>
    </div>
  );
}

// API functions
async function fetchGroups(): Promise<ConfidentialAccessGroup[]> {
  const res = await fetch('/api/admin/confidential-groups');
  if (!res.ok) throw new Error('Failed to fetch confidential access groups');
  const data = await res.json();
  return data.data || [];
}

async function createGroup(data: { code: string; name: string; description?: string }): Promise<ConfidentialAccessGroup> {
  const res = await fetch('/api/admin/confidential-groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create group');
  }
  const result = await res.json();
  return result.data;
}

async function updateGroup(id: number, data: { code?: string; name?: string; description?: string }): Promise<ConfidentialAccessGroup> {
  const res = await fetch(`/api/admin/confidential-groups/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update group');
  }
  const result = await res.json();
  return result.data;
}

async function deleteGroup(id: number): Promise<void> {
  const res = await fetch(`/api/admin/confidential-groups/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete group');
  }
}

// Form data interface
interface GroupFormData {
  code: string;
  name: string;
  description: string;
}

const initialFormData: GroupFormData = {
  code: '',
  name: '',
  description: '',
};

export default function ConfidentialAccessGroupsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations('admin');
  const [searchText, setSearchText] = React.useState('');
  const [selectedGroup, setSelectedGroup] = React.useState<ConfidentialAccessGroup | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [showFormDialog, setShowFormDialog] = React.useState(false);
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [formData, setFormData] = React.useState<GroupFormData>(initialFormData);
  const [formErrors, setFormErrors] = React.useState<Partial<Record<keyof GroupFormData, string>>>({});

  // Query for groups list
  const { data: groupsData = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['confidential-access-groups'],
    queryFn: fetchGroups,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['confidential-access-groups'] });
      notify(t('confidentialGroups.toast.createSuccess'), 'success', 3000);
      closeFormDialog();
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<GroupFormData> }) => updateGroup(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['confidential-access-groups'] });
      notify(t('confidentialGroups.toast.updateSuccess'), 'success', 3000);
      closeFormDialog();
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['confidential-access-groups'] });
      notify(t('confidentialGroups.toast.deleteSuccess'), 'success', 3000);
      setShowDeleteConfirm(false);
      setSelectedGroup(null);
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Filter groups based on search text
  const groups = React.useMemo(() => {
    if (!searchText.trim()) return groupsData;

    const searchLower = searchText.toLowerCase().trim();
    return groupsData.filter((group) =>
      group.code?.toLowerCase().includes(searchLower) ||
      group.name?.toLowerCase().includes(searchLower) ||
      group.description?.toLowerCase().includes(searchLower)
    );
  }, [groupsData, searchText]);

  // Form handlers
  const openCreateDialog = () => {
    setFormData(initialFormData);
    setFormErrors({});
    setIsEditMode(false);
    setShowFormDialog(true);
  };

  const openEditDialog = (group: ConfidentialAccessGroup) => {
    setFormData({
      code: group.code,
      name: group.name,
      description: group.description || '',
    });
    setFormErrors({});
    setSelectedGroup(group);
    setIsEditMode(true);
    setShowFormDialog(true);
  };

  const closeFormDialog = () => {
    setShowFormDialog(false);
    setSelectedGroup(null);
    setFormData(initialFormData);
    setFormErrors({});
  };

  const validateForm = React.useCallback((): boolean => {
    const errors: Partial<Record<keyof GroupFormData, string>> = {};

    if (!formData.code.trim()) {
      errors.code = t('confidentialGroups.form.codeRequired');
    } else if (!/^[A-Z0-9_]+$/.test(formData.code)) {
      errors.code = t('confidentialGroups.form.codeFormat');
    }

    if (!formData.name.trim()) {
      errors.name = t('confidentialGroups.form.nameRequired');
    }

    if (formData.description && formData.description.length > 500) {
      errors.description = t('confidentialGroups.form.descriptionMaxLength');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, t]);

  const handleSubmit = () => {
    if (!validateForm()) return;

    if (isEditMode && selectedGroup) {
      updateMutation.mutate({
        id: selectedGroup.id,
        data: {
          code: formData.code.trim(),
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
        },
      });
    } else {
      createMutation.mutate({
        code: formData.code.trim(),
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      });
    }
  };

  const handleDelete = (group: ConfidentialAccessGroup) => {
    setSelectedGroup(group);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (selectedGroup) {
      deleteMutation.mutate(selectedGroup.id);
    }
  };

  const handleManageMembers = (group: ConfidentialAccessGroup) => {
    router.push(`/admin/confidential-groups/${group.id}/members`);
  };

  // Render cell functions
  const renderMemberCountCell = (cellData: { data: ConfidentialAccessGroup }) => {
    const count = cellData.data.memberCount || 0;
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
        <Users className="h-3 w-3" />
        {count}
      </span>
    );
  };

  const renderDateCell = (cellData: { value?: string | Date }) => {
    if (!cellData.value) return '-';
    const date = new Date(cellData.value);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderActionsCell = React.useCallback((cellData: { data: ConfidentialAccessGroup }) => {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleManageMembers(cellData.data);
          }}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title={t('confidentialGroups.actions.manageMembers')}
          data-testid={`members-btn-${cellData.data.id}`}
        >
          <Users className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            openEditDialog(cellData.data);
          }}
          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
          title={t('confidentialGroups.actions.edit')}
          data-testid={`edit-btn-${cellData.data.id}`}
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(cellData.data);
          }}
          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title={t('confidentialGroups.actions.delete')}
          data-testid={`delete-btn-${cellData.data.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      {/* Header */}
      <ResponsivePageHeader
        title={t('confidentialGroups.title')}
        subtitle={t('confidentialGroups.subtitle')}
        icon={ShieldCheck}
        iconBgColor="bg-amber-100"
        iconColor="text-amber-600"
        actions={
          <>
            <Button
              icon={isFetching ? 'spindown' : 'refresh'}
              stylingMode="outlined"
              hint="Refresh"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="refresh-btn"
            />
            <Button
              text={t('confidentialGroups.addGroup')}
              icon="add"
              type="success"
              onClick={openCreateDialog}
              elementAttr={{ 'data-testid': 'add-group-btn' }}
            />
          </>
        }
      />

      {/* Filters & Statistics */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{t('confidentialGroups.search')}</span>
              </div>
              <div className="w-64">
                <TextBox
                  value={searchText}
                  onValueChanged={(e) => setSearchText(e.value || '')}
                  valueChangeEvent="keyup"
                  placeholder={t('confidentialGroups.searchPlaceholder')}
                  showClearButton
                  mode="search"
                  data-testid="search-input"
                />
              </div>
              {searchText && (
                <Button
                  text={t('confidentialGroups.clear')}
                  stylingMode="text"
                  onClick={() => setSearchText('')}
                  data-testid="clear-search-btn"
                />
              )}
            </div>

            {/* Statistics */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-md">
                <span className="text-gray-500">{t('confidentialGroups.totalGroups')}</span>
                <span className="font-semibold text-gray-900">{groupsData.length}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-md">
                <span className="text-blue-600">{t('confidentialGroups.totalMembers')}</span>
                <span className="font-semibold text-blue-700">
                  {groupsData.reduce((sum, g) => sum + (g.memberCount || 0), 0)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Grid */}
      <Card>
        <CardContent className="p-0">
          <DataGrid
            dataSource={groups}
            keyExpr="id"
            showBorders={false}
            showRowLines
            rowAlternationEnabled
            hoverStateEnabled
            columnAutoWidth
            className="min-h-[400px]"
            data-testid="groups-grid"
          >
            <LoadPanel enabled={isLoading} />
            <Sorting mode="multiple" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo
              showNavigationButtons
            />

            <Column dataField="id" caption={t('confidentialGroups.columns.id')} width={70} />
            <Column dataField="code" caption={t('confidentialGroups.columns.code')} width={150} />
            <Column dataField="name" caption={t('confidentialGroups.columns.name')} minWidth={200} />
            <Column dataField="description" caption={t('confidentialGroups.columns.description')} minWidth={250} />
            <Column
              dataField="memberCount"
              caption={t('confidentialGroups.columns.members')}
              width={100}
              cellRender={renderMemberCountCell}
              alignment="center"
            />
            <Column
              dataField="createdAt"
              caption={t('confidentialGroups.columns.created')}
              width={120}
              cellRender={renderDateCell}
            />
            <Column
              caption={t('confidentialGroups.columns.actions')}
              width={140}
              cellRender={renderActionsCell}
              allowFiltering={false}
              allowSorting={false}
              alignment="center"
            />
          </DataGrid>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <DxPopup
        visible={showFormDialog}
        onVisibleChange={setShowFormDialog}
        title={isEditMode ? t('confidentialGroups.form.editTitle') : t('confidentialGroups.form.createTitle')}
        width={500}
        height="auto"
        showCloseButton
        toolbarItems={[
          {
            widget: 'dxButton',
            toolbar: 'bottom',
            location: 'after',
            options: {
              text: isSubmitting ? t('confidentialGroups.form.saving') : t('confidentialGroups.form.save'),
              type: 'success',
              onClick: handleSubmit,
            },
          },
          {
            widget: 'dxButton',
            toolbar: 'bottom',
            location: 'after',
            options: {
              text: t('confidentialGroups.form.cancel'),
              stylingMode: 'outlined',
              onClick: closeFormDialog,
            },
          },
        ]}
      >
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('confidentialGroups.form.codeLabel')} <span className="text-red-500">*</span>
            </label>
            <TextBox
              value={formData.code}
              onValueChanged={(e) => {
                const value = (e.value || '').toUpperCase().replace(/[^A-Z0-9_]/g, '');
                setFormData((prev) => ({ ...prev, code: value }));
                if (formErrors.code) setFormErrors((prev) => ({ ...prev, code: undefined }));
              }}
              placeholder={t('confidentialGroups.form.codePlaceholder')}
              maxLength={50}
              disabled={isEditMode}
              data-testid="code-input"
            />
            {formErrors.code && (
              <p className="mt-1 text-sm text-red-500">{formErrors.code}</p>
            )}
            {!isEditMode && (
              <p className="mt-1 text-xs text-gray-500">
                {t('confidentialGroups.form.codeHint')}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('confidentialGroups.form.nameLabel')} <span className="text-red-500">*</span>
            </label>
            <TextBox
              value={formData.name}
              onValueChanged={(e) => {
                setFormData((prev) => ({ ...prev, name: e.value || '' }));
                if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder={t('confidentialGroups.form.namePlaceholder')}
              maxLength={100}
              data-testid="name-input"
            />
            {formErrors.name && (
              <p className="mt-1 text-sm text-red-500">{formErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('confidentialGroups.form.descriptionLabel')}
            </label>
            <TextBox
              value={formData.description}
              onValueChanged={(e) => {
                setFormData((prev) => ({ ...prev, description: e.value || '' }));
                if (formErrors.description) setFormErrors((prev) => ({ ...prev, description: undefined }));
              }}
              placeholder={t('confidentialGroups.form.descriptionPlaceholder')}
              maxLength={500}
              data-testid="description-input"
            />
            {formErrors.description && (
              <p className="mt-1 text-sm text-red-500">{formErrors.description}</p>
            )}
          </div>
        </div>
      </DxPopup>

      {/* Delete Confirmation Dialog */}
      <DxConfirmDialog
        visible={showDeleteConfirm}
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setSelectedGroup(null);
        }}
        title={t('confidentialGroups.deleteDialog.title')}
        message={t('confidentialGroups.deleteDialog.message', { name: selectedGroup?.name || '' })}
        confirmText={deleteMutation.isPending ? t('confidentialGroups.deleteDialog.deleting') : t('confidentialGroups.deleteDialog.confirm')}
        confirmType="danger"
      />
    </div>
  );
}

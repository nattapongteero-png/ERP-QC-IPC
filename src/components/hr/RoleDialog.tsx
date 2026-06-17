'use client';

// Reusable Role Dialog Component
// Feature: 007-hr-personnel-management

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Popup, ToolbarItem } from 'devextreme-react/popup';
import TextBox from 'devextreme-react/text-box';
import TextArea from 'devextreme-react/text-area';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
import type { AppRoleWithPermissions } from '@/types/hr';

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
  data: { name?: string; description?: string }
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

interface RoleDialogProps {
  visible: boolean;
  onHide: () => void;
  role?: AppRoleWithPermissions | null;
  onSuccess?: (role: AppRoleWithPermissions) => void;
}

export function RoleDialog({ visible, onHide, role, onSuccess }: RoleDialogProps) {
  const t = useTranslations('hr');
  const queryClient = useQueryClient();
  const toast = useToast();
  const isEditMode = !!role;

  // Form state - initialize from role when in edit mode
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const createMutation = useMutation({
    mutationFn: createRole,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'roles'] });
      toast.success(t('roleDialog.toast.createSuccess'));
      onSuccess?.(data);
      onHide();
    },
    onError: (error: Error) => {
      toast.error(error.message || t('roleDialog.toast.createError'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; description?: string } }) =>
      updateRole(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'roles'] });
      toast.success(t('roleDialog.toast.updateSuccess'));
      onSuccess?.(data);
      onHide();
    },
    onError: (error: Error) => {
      toast.error(error.message || t('roleDialog.toast.updateError'));
    },
  });

  const handleSubmit = () => {
    if (isEditMode && role) {
      updateMutation.mutate({
        id: role.id,
        data: {
          name: name || role.name,
          description: (description || role.description) || undefined,
        },
      });
    } else {
      if (!code || !name) return;
      createMutation.mutate({
        code,
        name,
        description: description || undefined,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isValid = isEditMode ? true : !!code && !!name;

  // Don't render popup at all when not visible to avoid any event issues
  if (!visible) return null;

  return (
    <Popup
      visible={visible}
      onHiding={() => {
        setCode('');
        setName('');
        setDescription('');
        onHide();
      }}
      title={isEditMode ? t('roleDialog.editTitle', { code: role?.code || '' }) : t('roleDialog.createTitle')}
      width={500}
      height="auto"
      showCloseButton
    >
      <div className="space-y-4 p-2">
        {!isEditMode && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('roleDialog.code.label')} <span className="text-red-500">*</span>
            </label>
            <TextBox
              value={code}
              onValueChanged={(e) => setCode(e.value || '')}
              placeholder={t('roleDialog.code.placeholder')}
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('roleDialog.code.hint')}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('roleDialog.name.label')} <span className="text-red-500">*</span>
          </label>
          <TextBox
            value={isEditMode ? (name || role?.name || '') : name}
            onValueChanged={(e) => setName(e.value || '')}
            placeholder={t('roleDialog.name.placeholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('roleDialog.description.label')}
          </label>
          <TextArea
            value={isEditMode ? (description || role?.description || '') : description}
            onValueChanged={(e) => setDescription(e.value || '')}
            placeholder={t('roleDialog.description.placeholder')}
            height={80}
          />
        </div>
      </div>

      <ToolbarItem
        widget="dxButton"
        location="after"
        options={{
          text: t('roleDialog.cancel'),
          onClick: () => {
            setCode('');
            setName('');
            setDescription('');
            onHide();
          },
        }}
      />
      <ToolbarItem
        widget="dxButton"
        location="after"
        options={{
          text: isEditMode ? t('roleDialog.save') : t('roleDialog.create'),
          type: 'default',
          disabled: !isValid || isPending,
          onClick: handleSubmit,
        }}
      />
    </Popup>
  );
}

export default RoleDialog;

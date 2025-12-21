'use client';

// Reusable Role Dialog Component
// Feature: 007-hr-personnel-management

import { useState, useCallback, useMemo } from 'react';
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
  const queryClient = useQueryClient();
  const toast = useToast();
  const isEditMode = !!role;

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Reset form when dialog opens (called by DevExtreme onShowing)
  const handleShowing = useCallback(() => {
    setCode('');
    setName(role?.name || '');
    setDescription(role?.description || '');
  }, [role?.name, role?.description]);

  const createMutation = useMutation({
    mutationFn: createRole,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'roles'] });
      toast.success('สร้างบทบาทสำเร็จ');
      onSuccess?.(data);
      onHide();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'ไม่สามารถสร้างบทบาทได้');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; description?: string } }) =>
      updateRole(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'roles'] });
      toast.success('แก้ไขบทบาทสำเร็จ');
      onSuccess?.(data);
      onHide();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'ไม่สามารถแก้ไขบทบาทได้');
    },
  });

  const handleSubmit = useCallback(() => {
    if (isEditMode && role) {
      updateMutation.mutate({
        id: role.id,
        data: {
          name,
          description: description || undefined,
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
  }, [isEditMode, role, name, description, code, createMutation, updateMutation]);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isValid = isEditMode ? !!name : !!code && !!name;

  // Memoize toolbar button options
  const cancelButtonOptions = useMemo(() => ({
    text: 'ยกเลิก',
    onClick: onHide,
  }), [onHide]);

  const submitButtonOptions = useMemo(() => ({
    text: isEditMode ? 'บันทึก' : 'สร้าง',
    type: 'default' as const,
    disabled: !isValid || isPending,
    onClick: handleSubmit,
  }), [isEditMode, isValid, isPending, handleSubmit]);

  // Memoize event handlers
  const handleCodeChange = useCallback((e: { value?: string }) => setCode(e.value || ''), []);
  const handleNameChange = useCallback((e: { value?: string }) => setName(e.value || ''), []);
  const handleDescriptionChange = useCallback((e: { value?: string }) => setDescription(e.value || ''), []);

  return (
    <Popup
      visible={visible}
      onShowing={handleShowing}
      onHiding={onHide}
      title={isEditMode ? `แก้ไขบทบาท: ${role?.code || ''}` : 'สร้างบทบาทใหม่'}
      width={500}
      height="auto"
      showCloseButton
    >
      <div className="space-y-4 p-2">
        {!isEditMode && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              รหัสบทบาท <span className="text-red-500">*</span>
            </label>
            <TextBox
              value={code}
              onValueChanged={handleCodeChange}
              placeholder="เช่น quality_manager"
            />
            <p className="text-xs text-gray-500 mt-1">
              ตัวพิมพ์เล็กและขีดล่างเท่านั้น
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ชื่อบทบาท <span className="text-red-500">*</span>
          </label>
          <TextBox
            value={name}
            onValueChanged={handleNameChange}
            placeholder="เช่น ผู้จัดการคุณภาพ"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            คำอธิบาย
          </label>
          <TextArea
            value={description}
            onValueChanged={handleDescriptionChange}
            placeholder="ระบุคำอธิบายบทบาท..."
            height={80}
          />
        </div>
      </div>

      <ToolbarItem
        widget="dxButton"
        location="after"
        options={cancelButtonOptions}
      />
      <ToolbarItem
        widget="dxButton"
        location="after"
        options={submitButtonOptions}
      />
    </Popup>
  );
}

export default RoleDialog;

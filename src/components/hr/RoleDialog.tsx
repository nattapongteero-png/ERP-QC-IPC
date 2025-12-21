'use client';

// Reusable Role Dialog Component
// Feature: 007-hr-personnel-management

import { useState } from 'react';
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

  // Form state - initialize from role when in edit mode
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

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
              onValueChanged={(e) => setCode(e.value || '')}
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
            value={isEditMode ? (name || role?.name || '') : name}
            onValueChanged={(e) => setName(e.value || '')}
            placeholder="เช่น ผู้จัดการคุณภาพ"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            คำอธิบาย
          </label>
          <TextArea
            value={isEditMode ? (description || role?.description || '') : description}
            onValueChanged={(e) => setDescription(e.value || '')}
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
          text: isEditMode ? 'บันทึก' : 'สร้าง',
          type: 'default',
          disabled: !isValid || isPending,
          onClick: handleSubmit,
        }}
      />
    </Popup>
  );
}

export default RoleDialog;

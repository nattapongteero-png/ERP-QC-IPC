'use client';

// PositionForm Component - Create/Edit Mode Pattern
// Feature: 007-hr-personnel-management - Task 4: Template Pattern Alignment
// Follows template module patterns for consistent form handling

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import Form, { SimpleItem, GroupItem, RequiredRule, FormRef } from 'devextreme-react/form';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import notify from 'devextreme/ui/notify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrgUnitPicker } from '@/components/shared';
import { ChevronLeft, Briefcase, Edit3 } from 'lucide-react';
import { createHrNavigator } from '@/lib/hr/navigation';
import type { Position } from '@/types/hr';

interface PositionFormData {
  code: string;
  title: string;
  titleEn: string;
  orgUnitId: number | null;
  jobGrade: string;
  isGmpCritical: boolean;
  isActive: boolean;
}

export interface PositionFormProps {
  mode: 'create' | 'edit';
  positionId?: number;
  onSuccess?: (position: Position) => void;
  onCancel?: () => void;
}

const defaultFormData: PositionFormData = {
  code: '',
  title: '',
  titleEn: '',
  orgUnitId: null,
  jobGrade: '',
  isGmpCritical: false,
  isActive: true,
};

async function fetchPosition(id: number): Promise<Position> {
  const res = await fetch(`/api/hr/positions/${id}`);
  if (!res.ok) throw new Error('Failed to fetch position');
  const result = await res.json();
  return result.data;
}

async function createPosition(data: Partial<Position>): Promise<Position> {
  const res = await fetch('/api/hr/positions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.error || 'Failed to create position');
  }
  return (await res.json()).data;
}

async function updatePosition(id: number, data: Partial<Position>): Promise<Position> {
  const res = await fetch(`/api/hr/positions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.error || 'Failed to update position');
  }
  return (await res.json()).data;
}

export function PositionForm({
  mode,
  positionId,
  onSuccess,
  onCancel,
}: PositionFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const navigate = createHrNavigator(router, 'positions');
  const formRef = useRef<FormRef>(null);

  const [formData, setFormData] = useState<PositionFormData>(defaultFormData);

  // Fetch existing position in edit mode
  const { data: existingPosition, isLoading: isLoadingPosition } = useQuery({
    queryKey: ['hr', 'position', positionId],
    queryFn: () => fetchPosition(positionId!),
    enabled: mode === 'edit' && !!positionId,
  });

  // Populate form when position loads
  useEffect(() => {
    if (existingPosition) {
      setFormData({
        code: existingPosition.code || '',
        title: existingPosition.title || '',
        titleEn: existingPosition.titleEn || '',
        orgUnitId: existingPosition.orgUnitId || null,
        jobGrade: existingPosition.jobGrade || '',
        isGmpCritical: existingPosition.isGmpCritical || false,
        isActive: existingPosition.isActive ?? true,
      });
    }
  }, [existingPosition]);

  const createMutation = useMutation({
    mutationFn: createPosition,
    onSuccess: (position) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'positions'] });
      notify('สร้างตำแหน่งสำเร็จ', 'success', 3000);
      if (onSuccess) {
        onSuccess(position);
      } else {
        navigate.toDetail(position.id);
      }
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Position>) => updatePosition(positionId!, data),
    onSuccess: (position) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'positions'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'position', positionId] });
      notify('อัปเดตตำแหน่งสำเร็จ', 'success', 3000);
      if (onSuccess) {
        onSuccess(position);
      } else {
        navigate.toList();
      }
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleBack = useCallback(() => {
    if (onCancel) {
      onCancel();
    } else {
      navigate.toList();
    }
  }, [onCancel, navigate]);

  const handleSubmit = useCallback(() => {
    // Validate using DevExtreme form
    const validationResult = formRef.current?.instance()?.validate();
    if (!validationResult?.isValid) {
      notify('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน', 'warning', 3000);
      return;
    }

    if (!formData.code?.trim()) {
      notify('กรุณาระบุรหัสตำแหน่ง', 'warning', 3000);
      return;
    }
    if (!formData.title?.trim()) {
      notify('กรุณาระบุชื่อตำแหน่ง', 'warning', 3000);
      return;
    }

    const submitData = {
      code: formData.code.trim(),
      title: formData.title.trim(),
      titleEn: formData.titleEn?.trim() || undefined,
      orgUnitId: formData.orgUnitId || undefined,
      jobGrade: formData.jobGrade?.trim() || undefined,
      isGmpCritical: formData.isGmpCritical,
      isActive: formData.isActive,
    };

    if (mode === 'create') {
      createMutation.mutate(submitData);
    } else {
      updateMutation.mutate(submitData);
    }
  }, [formData, mode, createMutation, updateMutation]);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isCreate = mode === 'create';

  // Loading state for edit mode
  if (mode === 'edit' && isLoadingPosition) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-3">
            <LoadIndicator height={24} width={24} />
            <span>กำลังโหลดข้อมูล...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isCreate ? 'bg-blue-100' : 'bg-indigo-100'}`}>
              {isCreate ? (
                <Briefcase className="h-6 w-6 text-blue-600" />
              ) : (
                <Edit3 className="h-6 w-6 text-indigo-600" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {isCreate ? 'เพิ่มตำแหน่งใหม่' : 'แก้ไขตำแหน่ง'}
              </h1>
              {!isCreate && existingPosition && (
                <p className="text-sm text-gray-500">รหัส: {existingPosition.code}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            text="ยกเลิก"
            stylingMode="outlined"
            onClick={handleBack}
          />
          <Button
            text={isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            type="default"
            icon="save"
            disabled={isPending}
            onClick={handleSubmit}
          />
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลตำแหน่ง</CardTitle>
        </CardHeader>
        <CardContent>
          <Form
            ref={formRef}
            formData={formData}
            onFieldDataChanged={(e) => {
              if (e.dataField) {
                setFormData(prev => ({ ...prev, [e.dataField!]: e.value }));
              }
            }}
            labelLocation="top"
            showColonAfterLabel={false}
          >
            <GroupItem colCount={2}>
              <SimpleItem
                dataField="code"
                label={{ text: 'รหัสตำแหน่ง' }}
                editorOptions={{
                  placeholder: 'เช่น QC-001',
                  readOnly: mode === 'edit',
                }}
              >
                <RequiredRule message="กรุณาระบุรหัสตำแหน่ง" />
              </SimpleItem>

              <SimpleItem
                dataField="jobGrade"
                label={{ text: 'ระดับตำแหน่ง' }}
                editorOptions={{
                  placeholder: 'เช่น Manager, Supervisor',
                }}
              />
            </GroupItem>

            <SimpleItem
              dataField="title"
              label={{ text: 'ชื่อตำแหน่ง (ไทย)' }}
              editorOptions={{
                placeholder: 'ชื่อตำแหน่งภาษาไทย',
              }}
            >
              <RequiredRule message="กรุณาระบุชื่อตำแหน่ง" />
            </SimpleItem>

            <SimpleItem
              dataField="titleEn"
              label={{ text: 'ชื่อตำแหน่ง (อังกฤษ)' }}
              editorOptions={{
                placeholder: 'Position title in English',
              }}
            />

            <SimpleItem
              dataField="orgUnitId"
              label={{ text: 'หน่วยงาน' }}
              render={() => (
                <OrgUnitPicker
                  value={formData.orgUnitId}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, orgUnitId: val }))}
                  placeholder="เลือกหน่วยงาน"
                  showClearButton
                />
              )}
            />

            <GroupItem colCount={2}>
              <SimpleItem
                dataField="isGmpCritical"
                label={{ text: 'ตำแหน่ง GMP Critical' }}
                editorType="dxCheckBox"
              />

              <SimpleItem
                dataField="isActive"
                label={{ text: 'ใช้งาน' }}
                editorType="dxCheckBox"
              />
            </GroupItem>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

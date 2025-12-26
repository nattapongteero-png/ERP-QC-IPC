'use client';

// TrainingCourseForm Component - Create/Edit Mode Pattern
// Feature: 007-hr-personnel-management - Task 5: Template Pattern Alignment
// Follows template module patterns for consistent form handling

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import Form, { SimpleItem, GroupItem, RequiredRule, FormRef } from 'devextreme-react/form';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import notify from 'devextreme/ui/notify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, BookOpen, Edit3 } from 'lucide-react';
import { createHrNavigator } from '@/lib/hr/navigation';
import type { TrainingCourse } from '@/types/hr';

interface CourseFormData {
  code: string;
  name: string;
  nameEn: string;
  category: string;
  description: string;
  validityDays: number | undefined;
  durationHours: number | undefined;
  isMandatory: boolean;
  isActive: boolean;
}

export interface TrainingCourseFormProps {
  mode: 'create' | 'edit';
  courseId?: number;
  onSuccess?: (course: TrainingCourse) => void;
  onCancel?: () => void;
}

const defaultFormData: CourseFormData = {
  code: '',
  name: '',
  nameEn: '',
  category: '',
  description: '',
  validityDays: undefined,
  durationHours: undefined,
  isMandatory: false,
  isActive: true,
};

async function fetchCourse(id: number): Promise<TrainingCourse> {
  const res = await fetch(`/api/hr/training/courses/${id}`);
  if (!res.ok) throw new Error('Failed to fetch course');
  const result = await res.json();
  return result.data;
}

async function createCourse(data: Partial<TrainingCourse>): Promise<TrainingCourse> {
  const res = await fetch('/api/hr/training/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.error || 'Failed to create course');
  }
  return (await res.json()).data;
}

async function updateCourse(id: number, data: Partial<TrainingCourse>): Promise<TrainingCourse> {
  const res = await fetch(`/api/hr/training/courses/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.error || 'Failed to update course');
  }
  return (await res.json()).data;
}

export function TrainingCourseForm({
  mode,
  courseId,
  onSuccess,
  onCancel,
}: TrainingCourseFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const navigate = createHrNavigator(router, 'training-courses');
  const formRef = useRef<FormRef>(null);

  const [formData, setFormData] = useState<CourseFormData>(defaultFormData);

  // Fetch existing course in edit mode
  const { data: existingCourse, isLoading: isLoadingCourse } = useQuery({
    queryKey: ['hr', 'training', 'course', courseId],
    queryFn: () => fetchCourse(courseId!),
    enabled: mode === 'edit' && !!courseId,
  });

  // Populate form when course loads
  useEffect(() => {
    if (existingCourse) {
      setFormData({
        code: existingCourse.code || '',
        name: existingCourse.name || '',
        nameEn: existingCourse.nameEn || '',
        category: existingCourse.category || '',
        description: existingCourse.description || '',
        validityDays: existingCourse.validityDays || undefined,
        durationHours: existingCourse.durationHours || undefined,
        isMandatory: existingCourse.isMandatory || false,
        isActive: existingCourse.isActive ?? true,
      });
    }
  }, [existingCourse]);

  const createMutation = useMutation({
    mutationFn: createCourse,
    onSuccess: (course) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'training', 'courses'] });
      notify('สร้างหลักสูตรสำเร็จ', 'success', 3000);
      if (onSuccess) {
        onSuccess(course);
      } else {
        navigate.toDetail(course.id);
      }
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<TrainingCourse>) => updateCourse(courseId!, data),
    onSuccess: (course) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'training', 'courses'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'training', 'course', courseId] });
      notify('อัปเดตหลักสูตรสำเร็จ', 'success', 3000);
      if (onSuccess) {
        onSuccess(course);
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
      notify('กรุณาระบุรหัสหลักสูตร', 'warning', 3000);
      return;
    }
    if (!formData.name?.trim()) {
      notify('กรุณาระบุชื่อหลักสูตร', 'warning', 3000);
      return;
    }

    const submitData = {
      code: formData.code.trim(),
      name: formData.name.trim(),
      nameEn: formData.nameEn?.trim() || undefined,
      category: formData.category?.trim() || undefined,
      description: formData.description?.trim() || undefined,
      validityDays: formData.validityDays || undefined,
      durationHours: formData.durationHours || undefined,
      isMandatory: formData.isMandatory,
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
  if (mode === 'edit' && isLoadingCourse) {
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
                <BookOpen className="h-6 w-6 text-blue-600" />
              ) : (
                <Edit3 className="h-6 w-6 text-indigo-600" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {isCreate ? 'เพิ่มหลักสูตรใหม่' : 'แก้ไขหลักสูตร'}
              </h1>
              {!isCreate && existingCourse && (
                <p className="text-sm text-gray-500">รหัส: {existingCourse.code}</p>
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
          <CardTitle>ข้อมูลหลักสูตร</CardTitle>
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
                label={{ text: 'รหัสหลักสูตร' }}
                editorOptions={{
                  placeholder: 'เช่น GMP-001',
                  readOnly: mode === 'edit',
                }}
              >
                <RequiredRule message="กรุณาระบุรหัสหลักสูตร" />
              </SimpleItem>

              <SimpleItem
                dataField="category"
                label={{ text: 'หมวดหมู่' }}
                editorOptions={{
                  placeholder: 'เช่น GMP, Safety',
                }}
              />
            </GroupItem>

            <SimpleItem
              dataField="name"
              label={{ text: 'ชื่อหลักสูตร (ไทย)' }}
              editorOptions={{
                placeholder: 'ชื่อหลักสูตรภาษาไทย',
              }}
            >
              <RequiredRule message="กรุณาระบุชื่อหลักสูตร" />
            </SimpleItem>

            <SimpleItem
              dataField="nameEn"
              label={{ text: 'ชื่อหลักสูตร (อังกฤษ)' }}
              editorOptions={{
                placeholder: 'Course name in English',
              }}
            />

            <SimpleItem
              dataField="description"
              label={{ text: 'รายละเอียด' }}
              editorType="dxTextArea"
              editorOptions={{
                placeholder: 'ระบุรายละเอียดหลักสูตร...',
                height: 100,
              }}
            />

            <GroupItem colCount={2}>
              <SimpleItem
                dataField="validityDays"
                label={{ text: 'อายุการรับรอง (วัน)' }}
                editorType="dxNumberBox"
                editorOptions={{
                  min: 0,
                  showSpinButtons: true,
                  placeholder: 'เช่น 365',
                }}
                helpText="ว่างเปล่า = ไม่มีหมดอายุ"
              />

              <SimpleItem
                dataField="durationHours"
                label={{ text: 'ระยะเวลาอบรม (ชั่วโมง)' }}
                editorType="dxNumberBox"
                editorOptions={{
                  min: 0,
                  showSpinButtons: true,
                  placeholder: 'เช่น 8',
                }}
              />
            </GroupItem>

            <GroupItem colCount={2}>
              <SimpleItem
                dataField="isMandatory"
                label={{ text: 'หลักสูตรบังคับ' }}
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

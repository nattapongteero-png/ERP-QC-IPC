'use client';

// TrainingSessionForm Component - Create/Edit Mode Pattern
// Feature: 007-hr-personnel-management - Training Sessions
// Follows template module patterns for consistent form handling

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import Form, { SimpleItem, GroupItem, RequiredRule, FormRef } from 'devextreme-react/form';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, Calendar, Edit3 } from 'lucide-react';
import { createHrNavigator } from '@/lib/hr/navigation';
import { handleApiError, showSuccess, showWarning } from '@/lib/hr/error-handler';
import type { TrainingSession, TrainingCourse, Employee } from '@/types/hr';

interface SessionFormData {
  courseId: number | undefined;
  sessionDate: string;
  startTime: string;
  endTime: string;
  location: string;
  instructorId: number | undefined;
  instructorExternal: string;
  maxParticipants: number | undefined;
  notes: string;
}

export interface TrainingSessionFormProps {
  mode: 'create' | 'edit';
  sessionId?: number;
  onSuccess?: (session: TrainingSession) => void;
  onCancel?: () => void;
}

const defaultFormData: SessionFormData = {
  courseId: undefined,
  sessionDate: '',
  startTime: '',
  endTime: '',
  location: '',
  instructorId: undefined,
  instructorExternal: '',
  maxParticipants: undefined,
  notes: '',
};

// API fetch functions
async function fetchSession(id: number): Promise<TrainingSession> {
  const res = await fetch(`/api/hr/training/sessions/${id}`);
  if (!res.ok) throw new Error('Failed to fetch session');
  const result = await res.json();
  return result.data;
}

async function fetchCourses(): Promise<TrainingCourse[]> {
  const res = await fetch('/api/hr/training/courses?isActive=true');
  if (!res.ok) throw new Error('Failed to fetch courses');
  const result = await res.json();
  return result.data || [];
}

async function fetchEmployees(): Promise<Employee[]> {
  const res = await fetch('/api/hr/employees?isActive=true');
  if (!res.ok) throw new Error('Failed to fetch employees');
  const result = await res.json();
  return result.data || [];
}

async function createSession(data: Partial<TrainingSession>): Promise<TrainingSession> {
  const res = await fetch('/api/hr/training/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.error || 'Failed to create session');
  }
  return (await res.json()).data;
}

async function updateSession(id: number, data: Partial<TrainingSession>): Promise<TrainingSession> {
  const res = await fetch(`/api/hr/training/sessions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.error || 'Failed to update session');
  }
  return (await res.json()).data;
}

// Time validation regex
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function TrainingSessionForm({
  mode,
  sessionId,
  onSuccess,
  onCancel,
}: TrainingSessionFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const navigate = createHrNavigator(router, 'training-sessions');
  const formRef = useRef<FormRef>(null);

  const [formData, setFormData] = useState<SessionFormData>(defaultFormData);

  // Fetch existing session in edit mode
  const { data: existingSession, isLoading: isLoadingSession } = useQuery({
    queryKey: ['hr', 'training', 'session', sessionId],
    queryFn: () => fetchSession(sessionId!),
    enabled: mode === 'edit' && !!sessionId,
  });

  // Fetch active courses for SelectBox
  const { data: courses = [] } = useQuery({
    queryKey: ['hr', 'training', 'courses', 'active'],
    queryFn: fetchCourses,
  });

  // Fetch active employees for instructor SelectBox
  const { data: employees = [] } = useQuery({
    queryKey: ['hr', 'employees', 'active'],
    queryFn: fetchEmployees,
  });

  // Populate form when session loads
  useEffect(() => {
    if (existingSession) {
      setFormData({
        courseId: existingSession.courseId || undefined,
        sessionDate: existingSession.sessionDate || '',
        startTime: existingSession.startTime || '',
        endTime: existingSession.endTime || '',
        location: existingSession.location || '',
        instructorId: existingSession.instructorId || undefined,
        instructorExternal: existingSession.instructorExternal || '',
        maxParticipants: existingSession.maxParticipants || undefined,
        notes: existingSession.notes || '',
      });
    }
  }, [existingSession]);

  const createMutation = useMutation({
    mutationFn: createSession,
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'training', 'sessions'] });
      showSuccess('สร้างการจัดอบรมสำเร็จ');
      if (onSuccess) {
        onSuccess(session);
      } else {
        navigate.toList();
      }
    },
    onError: (error: Error) => {
      handleApiError(error, 'เกิดข้อผิดพลาดในการสร้างการจัดอบรม');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<TrainingSession>) => updateSession(sessionId!, data),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'training', 'sessions'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'training', 'session', sessionId] });
      showSuccess('อัปเดตการจัดอบรมสำเร็จ');
      if (onSuccess) {
        onSuccess(session);
      } else {
        navigate.toList();
      }
    },
    onError: (error: Error) => {
      handleApiError(error, 'เกิดข้อผิดพลาดในการอัปเดตการจัดอบรม');
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
      showWarning('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    if (!formData.courseId) {
      showWarning('กรุณาเลือกหลักสูตร');
      return;
    }
    if (!formData.sessionDate) {
      showWarning('กรุณาระบุวันที่อบรม');
      return;
    }

    // Validate time format if provided
    if (formData.startTime && !TIME_REGEX.test(formData.startTime)) {
      showWarning('เวลาเริ่มต้องอยู่ในรูปแบบ HH:MM');
      return;
    }
    if (formData.endTime && !TIME_REGEX.test(formData.endTime)) {
      showWarning('เวลาสิ้นสุดต้องอยู่ในรูปแบบ HH:MM');
      return;
    }

    const submitData = {
      courseId: formData.courseId,
      sessionDate: formData.sessionDate,
      startTime: formData.startTime?.trim() || undefined,
      endTime: formData.endTime?.trim() || undefined,
      location: formData.location?.trim() || undefined,
      instructorId: formData.instructorId || undefined,
      instructorExternal: formData.instructorExternal?.trim() || undefined,
      maxParticipants: formData.maxParticipants || undefined,
      notes: formData.notes?.trim() || undefined,
    };

    if (mode === 'create') {
      createMutation.mutate(submitData);
    } else {
      updateMutation.mutate(submitData);
    }
  }, [formData, mode, createMutation, updateMutation]);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isCreate = mode === 'create';

  // Course options for SelectBox
  const courseOptions = courses.map((c) => ({
    id: c.id,
    displayName: `${c.code} - ${c.name}`,
  }));

  // Employee options for instructor SelectBox
  const employeeOptions = employees.map((e) => ({
    id: e.id,
    displayName: `${e.employeeCode} - ${e.firstName} ${e.lastName}`,
  }));

  // Loading state for edit mode
  if (mode === 'edit' && isLoadingSession) {
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
                <Calendar className="h-6 w-6 text-blue-600" />
              ) : (
                <Edit3 className="h-6 w-6 text-indigo-600" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {isCreate ? 'จัดอบรมใหม่' : 'แก้ไขการจัดอบรม'}
              </h1>
              {!isCreate && existingSession && (
                <p className="text-sm text-gray-500">
                  รหัส: {existingSession.id}
                </p>
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
            elementAttr={{ 'data-testid': 'session-submit-btn' }}
          />
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลการจัดอบรม</CardTitle>
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
                dataField="courseId"
                label={{ text: 'หลักสูตร' }}
                editorType="dxSelectBox"
                editorOptions={{
                  items: courseOptions,
                  valueExpr: 'id',
                  displayExpr: 'displayName',
                  placeholder: 'เลือกหลักสูตร',
                  searchEnabled: true,
                  showClearButton: true,
                  elementAttr: { 'data-testid': 'session-course-field' },
                }}
              >
                <RequiredRule message="กรุณาเลือกหลักสูตร" />
              </SimpleItem>

              <SimpleItem
                dataField="sessionDate"
                label={{ text: 'วันที่อบรม' }}
                editorType="dxDateBox"
                editorOptions={{
                  displayFormat: 'dd/MM/yyyy',
                  type: 'date',
                  placeholder: 'เลือกวันที่',
                  elementAttr: { 'data-testid': 'session-date-field' },
                }}
              >
                <RequiredRule message="กรุณาระบุวันที่อบรม" />
              </SimpleItem>
            </GroupItem>

            <GroupItem colCount={2}>
              <SimpleItem
                dataField="startTime"
                label={{ text: 'เวลาเริ่ม' }}
                editorOptions={{
                  placeholder: 'HH:MM เช่น 09:00',
                  elementAttr: { 'data-testid': 'session-start-time-field' },
                }}
                helpText="รูปแบบ HH:MM"
              />

              <SimpleItem
                dataField="endTime"
                label={{ text: 'เวลาสิ้นสุด' }}
                editorOptions={{
                  placeholder: 'HH:MM เช่น 17:00',
                  elementAttr: { 'data-testid': 'session-end-time-field' },
                }}
                helpText="รูปแบบ HH:MM"
              />
            </GroupItem>

            <SimpleItem
              dataField="location"
              label={{ text: 'สถานที่' }}
              editorOptions={{
                placeholder: 'เช่น ห้องประชุม A',
                maxLength: 100,
                elementAttr: { 'data-testid': 'session-location-field' },
              }}
            />

            <GroupItem colCount={2}>
              <SimpleItem
                dataField="instructorId"
                label={{ text: 'วิทยากรภายใน' }}
                editorType="dxSelectBox"
                editorOptions={{
                  items: employeeOptions,
                  valueExpr: 'id',
                  displayExpr: 'displayName',
                  placeholder: 'เลือกพนักงาน',
                  searchEnabled: true,
                  showClearButton: true,
                }}
              />

              <SimpleItem
                dataField="instructorExternal"
                label={{ text: 'วิทยากรภายนอก' }}
                editorOptions={{
                  placeholder: 'ชื่อวิทยากรภายนอก',
                  maxLength: 100,
                }}
              />
            </GroupItem>

            <SimpleItem
              dataField="maxParticipants"
              label={{ text: 'จำนวนผู้เข้าร่วมสูงสุด' }}
              editorType="dxNumberBox"
              editorOptions={{
                min: 1,
                showSpinButtons: true,
                placeholder: 'เช่น 20',
              }}
            />

            <SimpleItem
              dataField="notes"
              label={{ text: 'หมายเหตุ' }}
              editorType="dxTextArea"
              editorOptions={{
                placeholder: 'ระบุหมายเหตุ...',
                height: 100,
              }}
            />
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

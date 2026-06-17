'use client';

// TrainingSessionForm Component - Create/Edit Mode Pattern
// Feature: 007-hr-personnel-management - Training Sessions
// Follows template module patterns for consistent form handling

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('hr');
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
      showSuccess(t('training.sessionForm.toast.createSuccess'));
      if (onSuccess) {
        onSuccess(session);
      } else {
        navigate.toList();
      }
    },
    onError: (error: Error) => {
      handleApiError(error, t('training.sessionForm.toast.createError'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<TrainingSession>) => updateSession(sessionId!, data),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'training', 'sessions'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'training', 'session', sessionId] });
      showSuccess(t('training.sessionForm.toast.updateSuccess'));
      if (onSuccess) {
        onSuccess(session);
      } else {
        navigate.toList();
      }
    },
    onError: (error: Error) => {
      handleApiError(error, t('training.sessionForm.toast.updateError'));
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
      showWarning(t('formCommon.fillRequired'));
      return;
    }

    if (!formData.courseId) {
      showWarning(t('training.sessionForm.validation.courseRequired'));
      return;
    }
    if (!formData.sessionDate) {
      showWarning(t('training.sessionForm.validation.dateRequired'));
      return;
    }

    // Validate time format if provided
    if (formData.startTime && !TIME_REGEX.test(formData.startTime)) {
      showWarning(t('training.sessionForm.validation.startTimeFormat'));
      return;
    }
    if (formData.endTime && !TIME_REGEX.test(formData.endTime)) {
      showWarning(t('training.sessionForm.validation.endTimeFormat'));
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
            <span>{t('formCommon.loading')}</span>
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
                {isCreate ? t('training.sessionForm.createTitle') : t('training.sessionForm.editTitle')}
              </h1>
              {!isCreate && existingSession && (
                <p className="text-sm text-gray-500">
                  {t('training.sessionForm.codeLabel', { code: existingSession.id })}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            text={t('formCommon.cancel')}
            stylingMode="outlined"
            onClick={handleBack}
          />
          <Button
            text={isPending ? t('formCommon.saving') : t('formCommon.save')}
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
          <CardTitle>{t('training.sessionForm.cardTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form
            ref={formRef}
            formData={formData}
            onFieldDataChanged={(e) => {
              if (e.dataField) {
                // Prevent infinite loop by checking if value actually changed
                setFormData(prev => {
                  const currentValue = prev[e.dataField as keyof SessionFormData];
                  if (currentValue === e.value) {
                    return prev; // No change, return same reference
                  }
                  return { ...prev, [e.dataField!]: e.value };
                });
              }
            }}
            labelLocation="top"
            showColonAfterLabel={false}
          >
            <GroupItem colCount={2}>
              <SimpleItem
                dataField="courseId"
                label={{ text: t('training.sessionForm.course') }}
                editorType="dxSelectBox"
                editorOptions={{
                  items: courseOptions,
                  valueExpr: 'id',
                  displayExpr: 'displayName',
                  placeholder: t('training.sessionForm.coursePlaceholder'),
                  searchEnabled: true,
                  showClearButton: true,
                  elementAttr: { 'data-testid': 'session-course-field' },
                }}
              >
                <RequiredRule message={t('training.sessionForm.validation.courseRequired')} />
              </SimpleItem>

              <SimpleItem
                dataField="sessionDate"
                label={{ text: t('training.sessionForm.sessionDate') }}
                editorType="dxDateBox"
                editorOptions={{
                  displayFormat: 'dd/MM/yyyy',
                  type: 'date',
                  placeholder: t('training.sessionForm.sessionDatePlaceholder'),
                  elementAttr: { 'data-testid': 'session-date-field' },
                }}
              >
                <RequiredRule message={t('training.sessionForm.validation.dateRequired')} />
              </SimpleItem>
            </GroupItem>

            <GroupItem colCount={2}>
              <SimpleItem
                dataField="startTime"
                label={{ text: t('training.sessionForm.startTime') }}
                editorOptions={{
                  placeholder: t('training.sessionForm.startTimePlaceholder'),
                  elementAttr: { 'data-testid': 'session-start-time-field' },
                }}
                helpText={t('training.sessionForm.timeHelp')}
              />

              <SimpleItem
                dataField="endTime"
                label={{ text: t('training.sessionForm.endTime') }}
                editorOptions={{
                  placeholder: t('training.sessionForm.endTimePlaceholder'),
                  elementAttr: { 'data-testid': 'session-end-time-field' },
                }}
                helpText={t('training.sessionForm.timeHelp')}
              />
            </GroupItem>

            <SimpleItem
              dataField="location"
              label={{ text: t('training.sessionForm.location') }}
              editorOptions={{
                placeholder: t('training.sessionForm.locationPlaceholder'),
                maxLength: 100,
                elementAttr: { 'data-testid': 'session-location-field' },
              }}
            />

            <GroupItem colCount={2}>
              <SimpleItem
                dataField="instructorId"
                label={{ text: t('training.sessionForm.instructorInternal') }}
                editorType="dxSelectBox"
                editorOptions={{
                  items: employeeOptions,
                  valueExpr: 'id',
                  displayExpr: 'displayName',
                  placeholder: t('training.sessionForm.instructorInternalPlaceholder'),
                  searchEnabled: true,
                  showClearButton: true,
                }}
              />

              <SimpleItem
                dataField="instructorExternal"
                label={{ text: t('training.sessionForm.instructorExternal') }}
                editorOptions={{
                  placeholder: t('training.sessionForm.instructorExternalPlaceholder'),
                  maxLength: 100,
                }}
              />
            </GroupItem>

            <SimpleItem
              dataField="maxParticipants"
              label={{ text: t('training.sessionForm.maxParticipants') }}
              editorType="dxNumberBox"
              editorOptions={{
                min: 1,
                showSpinButtons: true,
                placeholder: t('training.sessionForm.maxParticipantsPlaceholder'),
              }}
            />

            <SimpleItem
              dataField="notes"
              label={{ text: t('training.sessionForm.notes') }}
              editorType="dxTextArea"
              editorOptions={{
                placeholder: t('training.sessionForm.notesPlaceholder'),
                height: 100,
              }}
            />
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

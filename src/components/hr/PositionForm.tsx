'use client';

// PositionForm Component - Create/Edit Mode Pattern
// Feature: 007-hr-personnel-management - Task 4: Template Pattern Alignment
// Follows template module patterns for consistent form handling

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import Form, { SimpleItem, GroupItem, RequiredRule, FormRef } from 'devextreme-react/form';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrgUnitPicker } from '@/components/shared';
import { ChevronLeft, Briefcase, Edit3 } from 'lucide-react';
import { createHrNavigator } from '@/lib/hr/navigation';
import { handleApiError, showSuccess, showWarning } from '@/lib/hr/error-handler';
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
  const t = useTranslations('hr');
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
      showSuccess(t('positions.toast.createSuccess'));
      if (onSuccess) {
        onSuccess(position);
      } else {
        navigate.toDetail(position.id);
      }
    },
    onError: (error: Error) => {
      handleApiError(error, t('positions.toast.createError'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Position>) => updatePosition(positionId!, data),
    onSuccess: (position) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'positions'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'position', positionId] });
      showSuccess(t('positions.toast.updateSuccess'));
      if (onSuccess) {
        onSuccess(position);
      } else {
        navigate.toList();
      }
    },
    onError: (error: Error) => {
      handleApiError(error, t('positions.toast.updateError'));
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

    if (!formData.code?.trim()) {
      showWarning(t('positions.form.validation.codeRequired'));
      return;
    }
    if (!formData.title?.trim()) {
      showWarning(t('positions.form.validation.titleRequired'));
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
                <Briefcase className="h-6 w-6 text-blue-600" />
              ) : (
                <Edit3 className="h-6 w-6 text-indigo-600" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {isCreate ? t('positions.form.createTitle') : t('positions.form.editTitle')}
              </h1>
              {!isCreate && existingPosition && (
                <p className="text-sm text-gray-500">{t('positions.form.codeLabel', { code: existingPosition.code })}</p>
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
            elementAttr={{ 'data-testid': 'pos-submit-btn' }}
          />
        </div>
      </div>

      {/* Form */}
      <Card data-testid="pos-form-card">
        <CardHeader>
          <CardTitle>{t('positions.form.cardTitle')}</CardTitle>
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
                label={{ text: t('positions.form.code') }}
                editorOptions={{
                  placeholder: t('positions.form.codePlaceholder'),
                  readOnly: mode === 'edit',
                  elementAttr: { 'data-testid': 'pos-code-field' },
                }}
              >
                <RequiredRule message={t('positions.form.validation.codeRequired')} />
              </SimpleItem>

              <SimpleItem
                dataField="jobGrade"
                label={{ text: t('positions.form.grade') }}
                editorOptions={{
                  placeholder: t('positions.form.gradePlaceholder'),
                }}
              />
            </GroupItem>

            <SimpleItem
              dataField="title"
              label={{ text: t('positions.form.titleTh') }}
              editorOptions={{
                placeholder: t('positions.form.titleThPlaceholder'),
                elementAttr: { 'data-testid': 'pos-title-field' },
              }}
            >
              <RequiredRule message={t('positions.form.validation.titleRequired')} />
            </SimpleItem>

            <SimpleItem
              dataField="titleEn"
              label={{ text: t('positions.form.titleEn') }}
              editorOptions={{
                placeholder: t('positions.form.titleEnPlaceholder'),
                elementAttr: { 'data-testid': 'pos-title-en-field' },
              }}
            />

            <SimpleItem
              dataField="orgUnitId"
              label={{ text: t('positions.form.orgUnit') }}
              render={() => (
                <div data-testid="pos-orgunit-field">
                  <OrgUnitPicker
                    value={formData.orgUnitId}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, orgUnitId: val }))}
                    placeholder={t('positions.form.orgUnitPlaceholder')}
                    showClearButton
                  />
                </div>
              )}
            />

            <GroupItem colCount={2}>
              <SimpleItem
                dataField="isGmpCritical"
                label={{ text: t('positions.form.isGmpCritical') }}
                editorType="dxCheckBox"
              />

              <SimpleItem
                dataField="isActive"
                label={{ text: t('positions.form.isActive') }}
                editorType="dxCheckBox"
              />
            </GroupItem>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

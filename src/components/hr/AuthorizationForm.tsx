'use client';

// AuthorizationForm Component - Create/Edit Mode Pattern
// Feature: 007-hr-personnel-management - Authorizations
// Follows template module patterns for consistent form handling

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import Form, { SimpleItem, GroupItem, RequiredRule, FormRef } from 'devextreme-react/form';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import TagBox from 'devextreme-react/tag-box';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ShieldCheck, Edit3 } from 'lucide-react';
import { createHrNavigator } from '@/lib/hr/navigation';
import { handleApiError, showSuccess, showWarning } from '@/lib/hr/error-handler';
import type { AuthorizationWithDetails, AuthorizationType, EmployeeWithDetails } from '@/types/hr';
import { toLocalDateStr } from '@/lib/utils/date-format';

// Authorization type values — labels are resolved via i18n inside the component.
const AUTH_TYPE_VALUES: AuthorizationType[] = [
  'batch_release',
  'sop_approval',
  'deviation_approval',
  'change_control_approval',
  'capa_approval',
];

// Maps API enum value to its i18n key suffix under authorizations.types.*
const AUTH_TYPE_I18N_KEY: Record<AuthorizationType, string> = {
  batch_release: 'batchRelease',
  sop_approval: 'sopApproval',
  deviation_approval: 'deviationApproval',
  change_control_approval: 'changeControlApproval',
  capa_approval: 'capaApproval',
};

const PRODUCT_LINE_OPTIONS = ['Herbal', 'Supplement', 'Cosmetic', 'Food'];

interface AuthorizationFormData {
  employeeId: number | undefined;
  authType: AuthorizationType | undefined;
  scopeProductLines: string[];
  effectiveFrom: string;
  effectiveTo: string;
}

export interface AuthorizationFormProps {
  mode: 'create' | 'edit';
  authorizationId?: number;
  onSuccess?: (authorization: AuthorizationWithDetails) => void;
  onCancel?: () => void;
}

const defaultFormData: AuthorizationFormData = {
  employeeId: undefined,
  authType: undefined,
  scopeProductLines: [],
  effectiveFrom: toLocalDateStr(new Date()),
  effectiveTo: '',
};

// API fetch functions
async function fetchAuthorization(id: number): Promise<AuthorizationWithDetails> {
  const res = await fetch(`/api/hr/authorizations/${id}`);
  if (!res.ok) throw new Error('Failed to fetch authorization');
  const result = await res.json();
  return result.data;
}

async function fetchEmployees(): Promise<EmployeeWithDetails[]> {
  const res = await fetch('/api/hr/employees?status=active');
  if (!res.ok) throw new Error('Failed to fetch employees');
  const result = await res.json();
  return result.data || [];
}

async function createAuthorization(data: {
  employeeId: number;
  authType: AuthorizationType;
  scopeProductLines?: string[];
  effectiveFrom: string;
  effectiveTo?: string;
}): Promise<AuthorizationWithDetails> {
  const res = await fetch('/api/hr/authorizations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.error || 'Failed to create authorization');
  }
  return (await res.json()).data;
}

interface AuthorizationUpdateData {
  employeeId?: number;
  authType?: AuthorizationType;
  scopeProductLines?: string[];
  effectiveFrom?: string;
  effectiveTo?: string;
}

async function updateAuthorization(
  id: number,
  data: AuthorizationUpdateData
): Promise<AuthorizationWithDetails> {
  const res = await fetch(`/api/hr/authorizations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.error || 'Failed to update authorization');
  }
  return (await res.json()).data;
}

export function AuthorizationForm({
  mode,
  authorizationId,
  onSuccess,
  onCancel,
}: AuthorizationFormProps) {
  const t = useTranslations('hr');
  const router = useRouter();
  const queryClient = useQueryClient();
  const navigate = createHrNavigator(router, 'authorizations');
  const formRef = useRef<FormRef>(null);

  const [formData, setFormData] = useState<AuthorizationFormData>(defaultFormData);

  // Build auth type options with translated labels
  const authTypeOptions = useMemo(
    () =>
      AUTH_TYPE_VALUES.map((value) => ({
        value,
        text: t(`authorizations.types.${AUTH_TYPE_I18N_KEY[value]}`),
      })),
    [t]
  );

  // Fetch existing authorization in edit mode
  const { data: existingAuthorization, isLoading: isLoadingAuthorization } = useQuery({
    queryKey: ['hr', 'authorization', authorizationId],
    queryFn: () => fetchAuthorization(authorizationId!),
    enabled: mode === 'edit' && !!authorizationId,
  });

  // Fetch active employees for SelectBox
  const { data: employees = [], isLoading: isLoadingEmployees } = useQuery({
    queryKey: ['hr', 'employees', 'active'],
    queryFn: fetchEmployees,
  });

  // Employee options for SelectBox - compute fullName from firstName + lastName
  const employeeOptions = employees.map((e) => ({
    id: e.id,
    displayName: `${e.employeeCode} - ${e.firstName} ${e.lastName}`,
  }));

  // Populate form when authorization loads
  useEffect(() => {
    if (existingAuthorization) {
      // Parse scopeProductLines from JSON string if needed
      let productLines: string[] = [];
      if (existingAuthorization.scopeProductLines) {
        if (typeof existingAuthorization.scopeProductLines === 'string') {
          try {
            productLines = JSON.parse(existingAuthorization.scopeProductLines);
          } catch {
            productLines = [];
          }
        } else if (Array.isArray(existingAuthorization.scopeProductLines)) {
          productLines = existingAuthorization.scopeProductLines;
        }
      }
      setFormData({
        employeeId: existingAuthorization.employeeId || undefined,
        authType: existingAuthorization.authType || undefined,
        scopeProductLines: productLines,
        effectiveFrom: existingAuthorization.effectiveFrom || '',
        effectiveTo: existingAuthorization.effectiveTo || '',
      });
    }
  }, [existingAuthorization]);

  const createMutation = useMutation({
    mutationFn: createAuthorization,
    onSuccess: (authorization) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'authorizations'] });
      showSuccess(t('authorizations.form.toast.createSuccess'));
      if (onSuccess) {
        onSuccess(authorization);
      } else {
        navigate.toList();
      }
    },
    onError: (error: Error) => {
      handleApiError(error, t('authorizations.form.toast.createError'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: AuthorizationUpdateData) =>
      updateAuthorization(authorizationId!, data),
    onSuccess: (authorization) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'authorizations'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'authorization', authorizationId] });
      showSuccess(t('authorizations.form.toast.updateSuccess'));
      if (onSuccess) {
        onSuccess(authorization);
      } else {
        navigate.toList();
      }
    },
    onError: (error: Error) => {
      handleApiError(error, t('authorizations.form.toast.updateError'));
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
      showWarning(t('authorizations.form.validation.incomplete'));
      return;
    }

    if (!formData.employeeId) {
      showWarning(t('authorizations.form.employee.required'));
      return;
    }
    if (!formData.authType) {
      showWarning(t('authorizations.form.authType.required'));
      return;
    }
    if (!formData.effectiveFrom) {
      showWarning(t('authorizations.form.effectiveFrom.required'));
      return;
    }

    const submitData: AuthorizationUpdateData = {
      employeeId: formData.employeeId,
      authType: formData.authType,
      scopeProductLines: formData.scopeProductLines.length > 0 ? formData.scopeProductLines : undefined,
      effectiveFrom: formData.effectiveFrom,
      effectiveTo: formData.effectiveTo || undefined,
    };

    if (mode === 'create') {
      createMutation.mutate({
        employeeId: submitData.employeeId!,
        authType: submitData.authType!,
        scopeProductLines: submitData.scopeProductLines,
        effectiveFrom: submitData.effectiveFrom!,
        effectiveTo: submitData.effectiveTo,
      });
    } else {
      updateMutation.mutate(submitData);
    }
  }, [formData, mode, createMutation, updateMutation, t]);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isCreate = mode === 'create';

  // Loading state - wait for employees to load (and authorization in edit mode)
  const isLoading = isLoadingEmployees || (mode === 'edit' && isLoadingAuthorization);
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-3">
            <LoadIndicator height={24} width={24} />
            <span>{t('authorizations.form.loading')}</span>
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
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isCreate ? 'bg-indigo-100' : 'bg-purple-100'}`}>
              {isCreate ? (
                <ShieldCheck className="h-6 w-6 text-indigo-600" />
              ) : (
                <Edit3 className="h-6 w-6 text-purple-600" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {isCreate ? t('authorizations.form.createTitle') : t('authorizations.form.editTitle')}
              </h1>
              {!isCreate && existingAuthorization && (
                <p className="text-sm text-gray-500">
                  {existingAuthorization.employeeName} - {existingAuthorization.authType ? t(`authorizations.types.${AUTH_TYPE_I18N_KEY[existingAuthorization.authType]}`) : ''}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            text={t('authorizations.form.cancel')}
            stylingMode="outlined"
            onClick={handleBack}
          />
          <Button
            text={isPending ? t('authorizations.form.saving') : t('authorizations.form.save')}
            type="default"
            icon="save"
            disabled={isPending}
            onClick={handleSubmit}
            elementAttr={{ 'data-testid': 'auth-submit-btn' }}
          />
        </div>
      </div>

      {/* Form */}
      <Card data-testid="auth-form-card">
        <CardHeader>
          <CardTitle>{t('authorizations.form.cardTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form
            ref={formRef}
            formData={formData}
            onFieldDataChanged={(e) => {
              if (e.dataField) {
                // Prevent infinite loop by checking if value actually changed
                setFormData(prev => {
                  const currentValue = prev[e.dataField as keyof AuthorizationFormData];
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
            <SimpleItem
              dataField="employeeId"
              label={{ text: t('authorizations.form.employee.label') }}
              editorType="dxSelectBox"
              editorOptions={{
                items: employeeOptions,
                valueExpr: 'id',
                displayExpr: 'displayName',
                placeholder: t('authorizations.form.employee.placeholder'),
                searchEnabled: true,
                showClearButton: true,
                readOnly: mode === 'edit',
                elementAttr: { 'data-testid': 'auth-employee-field' },
              }}
            >
              <RequiredRule message={t('authorizations.form.employee.required')} />
            </SimpleItem>

            <SimpleItem
              dataField="authType"
              label={{ text: t('authorizations.form.authType.label') }}
              editorType="dxSelectBox"
              editorOptions={{
                items: authTypeOptions,
                valueExpr: 'value',
                displayExpr: 'text',
                placeholder: t('authorizations.form.authType.placeholder'),
                readOnly: mode === 'edit',
                elementAttr: { 'data-testid': 'auth-type-field' },
              }}
            >
              <RequiredRule message={t('authorizations.form.authType.required')} />
            </SimpleItem>

            <SimpleItem
              dataField="scopeProductLines"
              label={{ text: t('authorizations.form.scopeProductLines.label') }}
              render={() => (
                <TagBox
                  items={PRODUCT_LINE_OPTIONS}
                  value={formData.scopeProductLines}
                  onValueChanged={(e) => setFormData(prev => ({ ...prev, scopeProductLines: e.value || [] }))}
                  placeholder={t('authorizations.form.scopeProductLines.placeholder')}
                  showSelectionControls
                  data-testid="auth-product-lines-field"
                />
              )}
            />

            <GroupItem colCount={2}>
              <SimpleItem
                dataField="effectiveFrom"
                label={{ text: t('authorizations.form.effectiveFrom.label') }}
                editorType="dxDateBox"
                editorOptions={{
                  displayFormat: 'dd/MM/yyyy',
                  type: 'date',
                  placeholder: t('authorizations.form.effectiveFrom.placeholder'),
                  elementAttr: { 'data-testid': 'auth-effective-from-field' },
                }}
              >
                <RequiredRule message={t('authorizations.form.effectiveFrom.required')} />
              </SimpleItem>

              <SimpleItem
                dataField="effectiveTo"
                label={{ text: t('authorizations.form.effectiveTo.label') }}
                editorType="dxDateBox"
                editorOptions={{
                  displayFormat: 'dd/MM/yyyy',
                  type: 'date',
                  placeholder: t('authorizations.form.effectiveTo.placeholder'),
                  showClearButton: true,
                  elementAttr: { 'data-testid': 'auth-effective-to-field' },
                }}
              />
            </GroupItem>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

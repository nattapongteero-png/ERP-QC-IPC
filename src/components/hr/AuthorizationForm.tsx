'use client';

// AuthorizationForm Component - Create/Edit Mode Pattern
// Feature: 007-hr-personnel-management - Authorizations
// Follows template module patterns for consistent form handling

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
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

// Authorization type configuration
const AUTH_TYPE_CONFIG: Record<
  AuthorizationType,
  { label: string; labelEn: string }
> = {
  batch_release: { label: 'ปล่อยผ่านชุด', labelEn: 'Batch Release' },
  sop_approval: { label: 'อนุมัติ SOP', labelEn: 'SOP Approval' },
  deviation_approval: { label: 'อนุมัติ Deviation', labelEn: 'Deviation Approval' },
  change_control_approval: { label: 'อนุมัติ Change Control', labelEn: 'Change Control' },
  capa_approval: { label: 'อนุมัติ CAPA', labelEn: 'CAPA Approval' },
};

const AUTH_TYPE_OPTIONS = Object.entries(AUTH_TYPE_CONFIG).map(([value, config]) => ({
  value,
  text: config.label,
}));

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
  effectiveFrom: new Date().toISOString().split('T')[0],
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const navigate = createHrNavigator(router, 'authorizations');
  const formRef = useRef<FormRef>(null);

  const [formData, setFormData] = useState<AuthorizationFormData>(defaultFormData);

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
      showSuccess('มอบสิทธิ์สำเร็จ');
      if (onSuccess) {
        onSuccess(authorization);
      } else {
        navigate.toList();
      }
    },
    onError: (error: Error) => {
      handleApiError(error, 'เกิดข้อผิดพลาดในการมอบสิทธิ์');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: AuthorizationUpdateData) =>
      updateAuthorization(authorizationId!, data),
    onSuccess: (authorization) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'authorizations'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'authorization', authorizationId] });
      showSuccess('อัปเดตสิทธิ์สำเร็จ');
      if (onSuccess) {
        onSuccess(authorization);
      } else {
        navigate.toList();
      }
    },
    onError: (error: Error) => {
      handleApiError(error, 'เกิดข้อผิดพลาดในการอัปเดตสิทธิ์');
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

    if (!formData.employeeId) {
      showWarning('กรุณาเลือกพนักงาน');
      return;
    }
    if (!formData.authType) {
      showWarning('กรุณาเลือกประเภทสิทธิ์');
      return;
    }
    if (!formData.effectiveFrom) {
      showWarning('กรุณาระบุวันที่เริ่มต้น');
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
  }, [formData, mode, createMutation, updateMutation]);

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
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isCreate ? 'bg-indigo-100' : 'bg-purple-100'}`}>
              {isCreate ? (
                <ShieldCheck className="h-6 w-6 text-indigo-600" />
              ) : (
                <Edit3 className="h-6 w-6 text-purple-600" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {isCreate ? 'มอบสิทธิ์ใหม่' : 'แก้ไขสิทธิ์อนุมัติ'}
              </h1>
              {!isCreate && existingAuthorization && (
                <p className="text-sm text-gray-500">
                  {existingAuthorization.employeeName} - {AUTH_TYPE_CONFIG[existingAuthorization.authType]?.label}
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
            elementAttr={{ 'data-testid': 'auth-submit-btn' }}
          />
        </div>
      </div>

      {/* Form */}
      <Card data-testid="auth-form-card">
        <CardHeader>
          <CardTitle>ข้อมูลสิทธิ์อนุมัติ</CardTitle>
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
              label={{ text: 'พนักงาน' }}
              editorType="dxSelectBox"
              editorOptions={{
                items: employeeOptions,
                valueExpr: 'id',
                displayExpr: 'displayName',
                placeholder: 'เลือกพนักงาน',
                searchEnabled: true,
                showClearButton: true,
                readOnly: mode === 'edit',
                elementAttr: { 'data-testid': 'auth-employee-field' },
              }}
            >
              <RequiredRule message="กรุณาเลือกพนักงาน" />
            </SimpleItem>

            <SimpleItem
              dataField="authType"
              label={{ text: 'ประเภทสิทธิ์' }}
              editorType="dxSelectBox"
              editorOptions={{
                items: AUTH_TYPE_OPTIONS,
                valueExpr: 'value',
                displayExpr: 'text',
                placeholder: 'เลือกประเภทสิทธิ์',
                readOnly: mode === 'edit',
                elementAttr: { 'data-testid': 'auth-type-field' },
              }}
            >
              <RequiredRule message="กรุณาเลือกประเภทสิทธิ์" />
            </SimpleItem>

            <SimpleItem
              dataField="scopeProductLines"
              label={{ text: 'สายผลิตภัณฑ์ (ไม่บังคับ)' }}
              render={() => (
                <TagBox
                  items={PRODUCT_LINE_OPTIONS}
                  value={formData.scopeProductLines}
                  onValueChanged={(e) => setFormData(prev => ({ ...prev, scopeProductLines: e.value || [] }))}
                  placeholder="เลือกสายผลิตภัณฑ์..."
                  showSelectionControls
                  data-testid="auth-product-lines-field"
                />
              )}
            />

            <GroupItem colCount={2}>
              <SimpleItem
                dataField="effectiveFrom"
                label={{ text: 'วันที่เริ่มต้น' }}
                editorType="dxDateBox"
                editorOptions={{
                  displayFormat: 'dd/MM/yyyy',
                  type: 'date',
                  placeholder: 'เลือกวันที่',
                  elementAttr: { 'data-testid': 'auth-effective-from-field' },
                }}
              >
                <RequiredRule message="กรุณาระบุวันที่เริ่มต้น" />
              </SimpleItem>

              <SimpleItem
                dataField="effectiveTo"
                label={{ text: 'วันที่สิ้นสุด (ถ้ามี)' }}
                editorType="dxDateBox"
                editorOptions={{
                  displayFormat: 'dd/MM/yyyy',
                  type: 'date',
                  placeholder: 'เลือกวันที่',
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

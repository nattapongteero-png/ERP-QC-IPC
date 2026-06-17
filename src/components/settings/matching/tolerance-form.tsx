'use client';

/**
 * Matching Tolerance Form Component
 * Reusable form for creating and editing matching tolerances
 * Following template module pattern
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from 'devextreme-react/button';
import Form, { Item, Label, RequiredRule, FormRef } from 'devextreme-react/form';
import SelectBox from 'devextreme-react/select-box';
import TextBox from 'devextreme-react/text-box';
import TextArea from 'devextreme-react/text-area';
import NumberBox from 'devextreme-react/number-box';
import Switch from 'devextreme-react/switch';
import LoadIndicator from 'devextreme-react/load-indicator';
import notify from 'devextreme/ui/notify';
import type {
  MatchingTolerance,
  ToleranceCreateInput,
  ToleranceUpdateInput,
  ToleranceType,
  ToleranceMethod,
} from '@/types/matching';
import {
  TOLERANCE_TYPE_OPTIONS,
  TOLERANCE_METHOD_OPTIONS,
} from '@/types/matching';

export interface ToleranceFormProps {
  mode: 'create' | 'edit';
  toleranceId?: number;
  onSuccess?: (tolerance: MatchingTolerance) => void;
  onCancel?: () => void;
}

interface FormData {
  name: string;
  description: string;
  toleranceType: ToleranceType;
  toleranceMethod: ToleranceMethod;
  toleranceValue: number;
  priority: number;
  isActive: boolean;
}

const defaultFormData: FormData = {
  name: '',
  description: '',
  toleranceType: 'quantity',
  toleranceMethod: 'percentage',
  toleranceValue: 5,
  priority: 10,
  isActive: true,
};

async function fetchTolerance(id: number): Promise<MatchingTolerance> {
  const res = await fetch(`/api/settings/matching-tolerances/${id}`);
  if (!res.ok) throw new Error('Failed to fetch tolerance');
  const data = await res.json();
  return data.data;
}

async function createTolerance(data: ToleranceCreateInput): Promise<MatchingTolerance> {
  const res = await fetch('/api/settings/matching-tolerances', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to create tolerance');
  }
  return res.json();
}

async function updateTolerance(id: number, data: ToleranceUpdateInput): Promise<MatchingTolerance> {
  const res = await fetch(`/api/settings/matching-tolerances/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to update tolerance');
  }
  return res.json();
}

async function deleteTolerance(id: number): Promise<void> {
  const res = await fetch(`/api/settings/matching-tolerances/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to delete tolerance');
  }
}

export function ToleranceForm({
  mode,
  toleranceId,
  onSuccess,
  onCancel,
}: ToleranceFormProps) {
  const t = useTranslations('settings');
  const router = useRouter();
  const queryClient = useQueryClient();
  const formRef = React.useRef<FormRef>(null);
  const [formData, setFormData] = React.useState<FormData>(defaultFormData);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  // Fetch tolerance for edit mode
  const { data: existingTolerance, isLoading: isLoadingTolerance } = useQuery({
    queryKey: ['matching-tolerance', toleranceId],
    queryFn: () => fetchTolerance(toleranceId!),
    enabled: mode === 'edit' && !!toleranceId,
  });

  // Set form data when tolerance is loaded
  React.useEffect(() => {
    if (existingTolerance) {
      setFormData({
        name: existingTolerance.name,
        description: existingTolerance.description || '',
        toleranceType: existingTolerance.toleranceType,
        toleranceMethod: existingTolerance.toleranceMethod,
        toleranceValue: existingTolerance.toleranceValue,
        priority: existingTolerance.priority,
        isActive: existingTolerance.isActive,
      });
    }
  }, [existingTolerance]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createTolerance,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['matching-tolerances'] });
      notify(t('matchingTolerances.form.toast.createSuccess'), 'success', 3000);
      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push('/settings/matching-tolerances');
      }
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: ToleranceUpdateInput) => updateTolerance(toleranceId!, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['matching-tolerances'] });
      queryClient.invalidateQueries({ queryKey: ['matching-tolerance', toleranceId] });
      notify(t('matchingTolerances.form.toast.updateSuccess'), 'success', 3000);
      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push('/settings/matching-tolerances');
      }
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteTolerance(toleranceId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matching-tolerances'] });
      notify(t('matchingTolerances.form.toast.deleteSuccess'), 'success', 3000);
      router.push('/settings/matching-tolerances');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleSubmit = () => {
    const validationResult = formRef.current?.instance()?.validate();
    if (!validationResult?.isValid) {
      notify(t('matchingTolerances.form.validation.incomplete'), 'warning', 3000);
      return;
    }

    if (mode === 'create') {
      const createData: ToleranceCreateInput = {
        name: formData.name,
        description: formData.description || undefined,
        toleranceType: formData.toleranceType,
        toleranceMethod: formData.toleranceMethod,
        toleranceValue: formData.toleranceValue,
        priority: formData.priority,
        isActive: formData.isActive,
      };
      createMutation.mutate(createData);
    } else {
      const updateData: ToleranceUpdateInput = {
        name: formData.name,
        description: formData.description || undefined,
        toleranceValue: formData.toleranceValue,
        priority: formData.priority,
        isActive: formData.isActive,
      };
      updateMutation.mutate(updateData);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(false);
    deleteMutation.mutate();
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  if (mode === 'edit' && isLoadingTolerance) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-3 text-gray-500">
            <LoadIndicator height={24} width={24} />
            <span>{t('matchingTolerances.form.loading')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            text={t('matchingTolerances.form.back')}
            icon="back"
            stylingMode="text"
            onClick={handleCancel}
          />
          <div className="h-6 w-px bg-gray-200" />
          <h1 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? t('matchingTolerances.form.createTitle') : t('matchingTolerances.form.editTitle', { name: existingTolerance?.name || '' })}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'edit' && (
            <Button
              text={t('matchingTolerances.form.delete')}
              icon={isDeleting ? 'spindown' : 'trash'}
              type="danger"
              stylingMode="outlined"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              data-testid="delete-tolerance-btn"
            />
          )}
          <Button
            text={t('matchingTolerances.form.cancel')}
            icon="close"
            stylingMode="outlined"
            onClick={handleCancel}
            disabled={isSubmitting}
          />
          <Button
            text={mode === 'create' ? t('matchingTolerances.form.create') : t('matchingTolerances.form.saveChanges')}
            icon={isSubmitting ? 'spindown' : 'save'}
            type="success"
            onClick={handleSubmit}
            disabled={isSubmitting}
            data-testid="save-tolerance-btn"
          />
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-800">{t('matchingTolerances.form.deleteConfirm.title')}</p>
                <p className="text-sm text-red-600">
                  {t('matchingTolerances.form.deleteConfirm.message')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text={t('matchingTolerances.form.cancel')}
                  stylingMode="outlined"
                  onClick={() => setShowDeleteConfirm(false)}
                />
                <Button
                  text={t('matchingTolerances.form.delete')}
                  icon="trash"
                  type="danger"
                  onClick={handleDelete}
                  data-testid="confirm-delete-btn"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('matchingTolerances.form.cardTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Form
                ref={formRef}
                formData={formData}
                onFieldDataChanged={(e) => {
                  if (e.dataField) {
                    setFormData((prev) => ({ ...prev, [e.dataField!]: e.value }));
                  }
                }}
                labelLocation="top"
                showColonAfterLabel={false}
                colCount={2}
              >
                <Item dataField="name" colSpan={2}>
                  <Label text={t('matchingTolerances.form.name.label')} />
                  <TextBox
                    value={formData.name}
                    onValueChanged={(e) => setFormData((prev) => ({ ...prev, name: e.value || '' }))}
                    placeholder={t('matchingTolerances.form.name.placeholder')}
                    data-testid="tolerance-name-input"
                  />
                  <RequiredRule message={t('matchingTolerances.form.name.required')} />
                </Item>
                <Item dataField="toleranceType" colSpan={1}>
                  <Label text={t('matchingTolerances.form.toleranceType.label')} />
                  <SelectBox
                    dataSource={TOLERANCE_TYPE_OPTIONS}
                    displayExpr="label"
                    valueExpr="value"
                    value={formData.toleranceType}
                    onValueChanged={(e) => setFormData((prev) => ({ ...prev, toleranceType: e.value }))}
                    readOnly={mode === 'edit'}
                    data-testid="tolerance-type-select"
                  />
                </Item>
                <Item dataField="toleranceMethod" colSpan={1}>
                  <Label text={t('matchingTolerances.form.toleranceMethod.label')} />
                  <SelectBox
                    dataSource={TOLERANCE_METHOD_OPTIONS}
                    displayExpr="label"
                    valueExpr="value"
                    value={formData.toleranceMethod}
                    onValueChanged={(e) => setFormData((prev) => ({ ...prev, toleranceMethod: e.value }))}
                    readOnly={mode === 'edit'}
                    data-testid="tolerance-method-select"
                  />
                </Item>
                <Item dataField="toleranceValue" colSpan={1}>
                  <Label text={t('matchingTolerances.form.toleranceValue.label')} />
                  <NumberBox
                    value={formData.toleranceValue}
                    onValueChanged={(e) => setFormData((prev) => ({ ...prev, toleranceValue: e.value || 0 }))}
                    format={formData.toleranceMethod === 'percentage' ? "#0.##'%'" : '#,##0.##'}
                    min={0}
                    max={formData.toleranceMethod === 'percentage' ? 100 : undefined}
                    showSpinButtons
                    data-testid="tolerance-value-input"
                  />
                </Item>
                <Item dataField="priority" colSpan={1}>
                  <Label text={t('matchingTolerances.form.priority.label')} />
                  <NumberBox
                    value={formData.priority}
                    onValueChanged={(e) => setFormData((prev) => ({ ...prev, priority: e.value || 10 }))}
                    min={1}
                    max={100}
                    showSpinButtons
                    data-testid="tolerance-priority-input"
                  />
                </Item>
                <Item dataField="description" colSpan={2}>
                  <Label text={t('matchingTolerances.form.description.label')} />
                  <TextArea
                    value={formData.description}
                    onValueChanged={(e) => setFormData((prev) => ({ ...prev, description: e.value || '' }))}
                    height={100}
                    placeholder={t('matchingTolerances.form.description.placeholder')}
                    data-testid="tolerance-description-input"
                  />
                </Item>
              </Form>
            </CardContent>
          </Card>

          {/* Info Box */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="py-4">
              <h3 className="text-blue-800 font-medium mb-2">{t('matchingTolerances.form.infoBox.title')}</h3>
              <p className="text-blue-700 text-sm">
                {t('matchingTolerances.form.infoBox.description')}
              </p>
              <ul className="mt-2 text-sm text-blue-700 list-disc list-inside">
                <li><strong>{t('matchingTolerances.form.infoBox.quantity')}</strong> {t('matchingTolerances.form.infoBox.quantityDesc')}</li>
                <li><strong>{t('matchingTolerances.form.infoBox.price')}</strong> {t('matchingTolerances.form.infoBox.priceDesc')}</li>
                <li><strong>{t('matchingTolerances.form.infoBox.amount')}</strong> {t('matchingTolerances.form.infoBox.amountDesc')}</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('matchingTolerances.form.statusTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{t('matchingTolerances.form.enabled')}</span>
                <Switch
                  value={formData.isActive}
                  onValueChanged={(e) => setFormData((prev) => ({ ...prev, isActive: e.value }))}
                  data-testid="tolerance-active-switch"
                />
              </div>
              <p className="text-xs text-gray-500">
                {formData.isActive
                  ? t('matchingTolerances.form.activeHint')
                  : t('matchingTolerances.form.inactiveHint')}
              </p>
            </CardContent>
          </Card>

          {mode === 'edit' && existingTolerance && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('matchingTolerances.form.detailsTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('matchingTolerances.form.detailId')}</span>
                  <span className="font-mono text-gray-900">{existingTolerance.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('matchingTolerances.form.detailType')}</span>
                  <span className="text-gray-900 capitalize">{existingTolerance.toleranceType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('matchingTolerances.form.detailMethod')}</span>
                  <span className="text-gray-900 capitalize">{existingTolerance.toleranceMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('matchingTolerances.form.detailCreatedAt')}</span>
                  <span className="text-gray-900">
                    {new Date(existingTolerance.createdAt).toLocaleDateString('th-TH')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('matchingTolerances.form.detailUpdatedAt')}</span>
                  <span className="text-gray-900">
                    {new Date(existingTolerance.updatedAt).toLocaleDateString('th-TH')}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

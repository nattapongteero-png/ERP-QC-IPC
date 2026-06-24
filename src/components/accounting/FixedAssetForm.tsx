// Accounting Fixed Asset Form Component
// Feature: 010-accounting-module-integration
// Pattern: Aligned with Template module form design
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from 'devextreme-react/button';
import { TextBox } from 'devextreme-react/text-box';
import { NumberBox } from 'devextreme-react/number-box';
import { SelectBox } from 'devextreme-react/select-box';
import notify from 'devextreme/ui/notify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { AuditLogViewerDialog } from '@/components/shared/AuditLogViewerDialog';
import { Building, History } from 'lucide-react';
import type { FixedAsset, AssetCategory, FixedAssetCreate, FixedAssetUpdate, DepreciationMethod } from '@/types/accounting';

export interface FixedAssetFormProps {
  mode: 'create' | 'edit';
  assetId?: number;
}

async function fetchAsset(id: number): Promise<FixedAsset> {
  const res = await fetch(`/api/accounting/fixed-assets/${id}`);
  if (!res.ok) throw new Error('Failed to fetch asset');
  const data = await res.json();
  return data.data;
}

async function fetchCategories(): Promise<AssetCategory[]> {
  const res = await fetch('/api/accounting/asset-categories');
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

async function createAsset(data: FixedAssetCreate): Promise<{ id: number }> {
  const res = await fetch('/api/accounting/fixed-assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create asset');
  }
  return res.json();
}

async function updateAsset(id: number, data: FixedAssetUpdate): Promise<void> {
  const res = await fetch(`/api/accounting/fixed-assets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update asset');
  }
}

async function deleteAsset(id: number): Promise<void> {
  const res = await fetch(`/api/accounting/fixed-assets/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete asset');
  }
}

interface FormData {
  nameTh: string;
  nameEn: string;
  categoryId: number | null;
  acquisitionDate: string;
  acquisitionCost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  depreciationMethod: DepreciationMethod;
  depreciationStartDate: string;
  location: string;
  departmentId: number | null;
  responsiblePersonId: number | null;
}

export function FixedAssetForm({ mode, assetId }: FixedAssetFormProps) {
  const t = useTranslations('accounting');
  const router = useRouter();
  const queryClient = useQueryClient();
  const depreciationMethods = [
    { value: 'straight_line', label: t('fixedAssets.form.depreciationMethods.straightLine') },
    { value: 'declining_balance', label: t('fixedAssets.form.depreciationMethods.decliningBalance') },
  ];
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    nameTh: '',
    nameEn: '',
    categoryId: null,
    acquisitionDate: '',
    acquisitionCost: 0,
    salvageValue: 0,
    usefulLifeMonths: 60,
    depreciationMethod: 'straight_line',
    depreciationStartDate: '',
    location: '',
    departmentId: null,
    responsiblePersonId: null,
  });

  const { data: existingAsset, isLoading: isLoadingAsset } = useQuery({
    queryKey: ['fixed-asset', assetId],
    queryFn: () => fetchAsset(assetId!),
    enabled: mode === 'edit' && !!assetId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['asset-categories'],
    queryFn: fetchCategories,
  });

  useEffect(() => {
    if (existingAsset) {
      setFormData({
        nameTh: existingAsset.nameTh || '',
        nameEn: existingAsset.nameEn || '',
        categoryId: existingAsset.categoryId,
        acquisitionDate: existingAsset.acquisitionDate || '',
        acquisitionCost: Number(existingAsset.acquisitionCost) || 0,
        salvageValue: Number(existingAsset.salvageValue) || 0,
        usefulLifeMonths: existingAsset.usefulLifeMonths || 60,
        depreciationMethod: existingAsset.depreciationMethod || 'straight_line',
        depreciationStartDate: existingAsset.depreciationStartDate || '',
        location: existingAsset.location || '',
        departmentId: existingAsset.departmentId || null,
        responsiblePersonId: existingAsset.responsiblePersonId || null,
      });
    }
  }, [existingAsset]);

  const createMutation = useMutation({
    mutationFn: (data: FixedAssetCreate) => createAsset(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      notify(t('fixedAssets.form.toast.createSuccess'), 'success', 3000);
      router.push('/accounting/fixed-assets');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: FixedAssetUpdate) => updateAsset(assetId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      queryClient.invalidateQueries({ queryKey: ['fixed-asset', assetId] });
      notify(t('fixedAssets.form.toast.updateSuccess'), 'success', 3000);
      router.push('/accounting/fixed-assets');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAsset(assetId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      notify(t('fixedAssets.toast.deleteSuccess'), 'success', 3000);
      router.push('/accounting/fixed-assets');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleSubmit = () => {
    if (!formData.nameTh || !formData.nameEn || !formData.categoryId || !formData.acquisitionDate || formData.acquisitionCost <= 0) {
      notify(t('fixedAssets.form.validation.requiredFields'), 'error', 3000);
      return;
    }

    if (mode === 'create') {
      const createData: FixedAssetCreate = {
        nameTh: formData.nameTh,
        nameEn: formData.nameEn,
        categoryId: formData.categoryId,
        acquisitionDate: formData.acquisitionDate,
        acquisitionCost: formData.acquisitionCost,
        salvageValue: formData.salvageValue,
        usefulLifeMonths: formData.usefulLifeMonths,
        depreciationMethod: formData.depreciationMethod,
        depreciationStartDate: formData.depreciationStartDate || undefined,
        location: formData.location || undefined,
        departmentId: formData.departmentId || undefined,
        responsiblePersonId: formData.responsiblePersonId || undefined,
      };
      createMutation.mutate(createData);
    } else {
      const updateData: FixedAssetUpdate = {
        nameTh: formData.nameTh,
        nameEn: formData.nameEn,
        location: formData.location || undefined,
        departmentId: formData.departmentId || undefined,
        responsiblePersonId: formData.responsiblePersonId || undefined,
      };
      updateMutation.mutate(updateData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (mode === 'edit' && isLoadingAsset) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">{t('fixedAssets.form.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ResponsivePageHeader
        title={mode === 'create' ? t('fixedAssets.form.title.create') : t('fixedAssets.form.title.edit')}
        subtitle={mode === 'create' ? t('fixedAssets.form.subtitle.create') : t('fixedAssets.form.subtitle.edit', { code: existingAsset?.assetCode || '' })}
        icon={Building}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: t('fixedAssets.breadcrumbAccounting'), href: '/accounting' },
          { label: t('fixedAssets.title'), href: '/accounting/fixed-assets' },
          { label: mode === 'create' ? t('fixedAssets.form.breadcrumbCreate') : t('fixedAssets.form.breadcrumbEdit') },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              text={t('fixedAssets.form.back')}
              icon="back"
              stylingMode="outlined"
              onClick={() => router.push('/accounting/fixed-assets')}
            />
            <Button
              text={isSubmitting ? t('fixedAssets.form.saving') : t('fixedAssets.form.save')}
              icon="save"
              type="success"
              onClick={handleSubmit}
              disabled={isSubmitting}
            />
          </div>
        }
      />

      {/* Delete Confirmation */}
      {showDeleteConfirm && mode === 'edit' && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-800">{t('fixedAssets.deleteDialog.title')}</p>
                <p className="text-sm text-red-600">
                  {t('fixedAssets.form.deleteConfirm.message')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text={t('fixedAssets.deleteDialog.cancel')}
                  stylingMode="outlined"
                  onClick={() => setShowDeleteConfirm(false)}
                />
                <Button
                  text={deleteMutation.isPending ? t('fixedAssets.deleteDialog.deleting') : t('fixedAssets.deleteDialog.confirm')}
                  icon="trash"
                  type="danger"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('fixedAssets.form.sections.basic')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('fixedAssets.form.fields.nameTh')} <span className="text-red-500">*</span>
                  </label>
                  <TextBox
                    value={formData.nameTh}
                    onValueChanged={(e) => setFormData({ ...formData, nameTh: e.value || '' })}
                    placeholder={t('fixedAssets.form.fields.nameThPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('fixedAssets.form.fields.nameEn')} <span className="text-red-500">*</span>
                  </label>
                  <TextBox
                    value={formData.nameEn}
                    onValueChanged={(e) => setFormData({ ...formData, nameEn: e.value || '' })}
                    placeholder={t('fixedAssets.form.fields.nameEnPlaceholder')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('fixedAssets.form.fields.category')} <span className="text-red-500">*</span>
                  </label>
                  <SelectBox
                    dataSource={categories}
                    displayExpr="nameEn"
                    valueExpr="id"
                    value={formData.categoryId}
                    onValueChanged={(e) => setFormData({ ...formData, categoryId: e.value })}
                    placeholder={t('fixedAssets.form.fields.categoryPlaceholder')}
                    searchEnabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('fixedAssets.form.fields.location')}
                  </label>
                  <TextBox
                    value={formData.location}
                    onValueChanged={(e) => setFormData({ ...formData, location: e.value || '' })}
                    placeholder={t('fixedAssets.form.fields.location')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('fixedAssets.form.sections.acquisition')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('fixedAssets.form.fields.acquisitionDate')} <span className="text-red-500">*</span>
                  </label>
                  <DxDateBox
                    value={formData.acquisitionDate}
                    onValueChange={(value) => setFormData({ ...formData, acquisitionDate: value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('fixedAssets.form.fields.acquisitionCost')} <span className="text-red-500">*</span>
                  </label>
                  <NumberBox
                    value={formData.acquisitionCost}
                    onValueChanged={(e) => setFormData({ ...formData, acquisitionCost: e.value || 0 })}
                    format="#,##0.00"
                    min={0}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('fixedAssets.form.fields.salvageValue')}
                  </label>
                  <NumberBox
                    value={formData.salvageValue}
                    onValueChanged={(e) => setFormData({ ...formData, salvageValue: e.value || 0 })}
                    format="#,##0.00"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('fixedAssets.form.fields.usefulLifeMonths')}
                  </label>
                  <NumberBox
                    value={formData.usefulLifeMonths}
                    onValueChanged={(e) => setFormData({ ...formData, usefulLifeMonths: e.value || 60 })}
                    min={1}
                    max={600}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('fixedAssets.form.fields.depreciationMethod')}
                  </label>
                  <SelectBox
                    dataSource={depreciationMethods}
                    displayExpr="label"
                    valueExpr="value"
                    value={formData.depreciationMethod}
                    onValueChanged={(e) => setFormData({ ...formData, depreciationMethod: e.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('fixedAssets.form.fields.depreciationStartDate')}
                  </label>
                  <DxDateBox
                    value={formData.depreciationStartDate}
                    onValueChange={(value) => setFormData({ ...formData, depreciationStartDate: value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {mode === 'edit' && existingAsset && (
            <Card>
              <CardHeader>
                <CardTitle>{t('fixedAssets.form.detail.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-sm text-gray-500">{t('fixedAssets.form.detail.assetCode')}</span>
                  <p className="font-medium">{existingAsset.assetCode}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">{t('fixedAssets.form.detail.status')}</span>
                  <p className="font-medium capitalize">{existingAsset.status}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">{t('fixedAssets.form.detail.netBookValue')}</span>
                  <p className="font-medium">
                    {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(
                      Number(existingAsset.netBookValue) || 0
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">{t('fixedAssets.form.detail.accumulatedDepreciation')}</span>
                  <p className="font-medium">
                    {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(
                      Number(existingAsset.accumulatedDepreciation) || 0
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {mode === 'edit' && assetId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  {t('fixedAssets.form.audit.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  {t('fixedAssets.form.audit.description')}
                </p>
                <Button
                  text={t('fixedAssets.form.audit.viewHistory')}
                  icon="clock"
                  stylingMode="outlined"
                  onClick={() => setAuditDialogOpen(true)}
                  width="100%"
                />
              </CardContent>
            </Card>
          )}

          {mode === 'edit' && (
            <Card className="border-red-100">
              <CardHeader>
                <CardTitle className="text-red-600">{t('fixedAssets.form.dangerZone.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  {t('fixedAssets.form.dangerZone.description')}
                </p>
                <Button
                  text={t('fixedAssets.form.dangerZone.deleteButton')}
                  icon="trash"
                  type="danger"
                  stylingMode="outlined"
                  onClick={() => setShowDeleteConfirm(true)}
                  width="100%"
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Audit Log Dialog */}
      {mode === 'edit' && assetId && (
        <AuditLogViewerDialog
          entityType="fixedAssets"
          entityId={assetId}
          visible={auditDialogOpen}
          onClose={() => setAuditDialogOpen(false)}
          fieldLabels={{
            nameTh: t('fixedAssets.form.fields.nameTh'),
            nameEn: t('fixedAssets.form.fields.nameEn'),
            categoryId: t('fixedAssets.form.fields.category'),
            acquisitionDate: t('fixedAssets.form.fields.acquisitionDate'),
            acquisitionCost: t('fixedAssets.form.fields.acquisitionCost'),
            salvageValue: t('fixedAssets.form.fields.salvageValue'),
            usefulLifeMonths: t('fixedAssets.form.fields.usefulLifeMonths'),
            depreciationMethod: t('fixedAssets.form.fields.depreciationMethod'),
            depreciationStartDate: t('fixedAssets.form.fields.depreciationStartDate'),
            location: t('fixedAssets.form.fields.location'),
            departmentId: t('fixedAssets.form.audit.fields.department'),
            responsiblePersonId: t('fixedAssets.form.audit.fields.responsiblePerson'),
            status: t('fixedAssets.form.detail.status'),
          }}
        />
      )}
    </div>
  );
}

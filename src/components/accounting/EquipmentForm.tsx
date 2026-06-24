// Accounting Equipment Form Component
// Feature: 010-accounting-module-integration
// Pattern: Aligned with Template module form design
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from 'devextreme-react/button';
import { TextBox } from 'devextreme-react/text-box';
import { TextArea } from 'devextreme-react/text-area';
import { SelectBox } from 'devextreme-react/select-box';
import { Switch } from 'devextreme-react/switch';
import notify from 'devextreme/ui/notify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { AuditLogViewerDialog } from '@/components/shared/AuditLogViewerDialog';
import { Wrench, History } from 'lucide-react';
import type { Equipment, EquipmentCreate, EquipmentUpdate, FixedAsset } from '@/types/accounting';

export interface EquipmentFormProps {
  mode: 'create' | 'edit';
  equipmentId?: number;
}

interface EquipmentWithAsset extends Equipment {
  asset?: FixedAsset;
}

async function fetchEquipment(id: number): Promise<EquipmentWithAsset> {
  const res = await fetch(`/api/accounting/equipment/${id}`);
  if (!res.ok) throw new Error('Failed to fetch equipment');
  const data = await res.json();
  return data.data;
}

async function fetchFixedAssets(): Promise<FixedAsset[]> {
  const res = await fetch('/api/accounting/fixed-assets?status=active');
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

async function createEquipment(data: EquipmentCreate): Promise<{ id: number }> {
  const res = await fetch('/api/accounting/equipment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create equipment');
  }
  return res.json();
}

async function updateEquipment(id: number, data: EquipmentUpdate): Promise<void> {
  const res = await fetch(`/api/accounting/equipment/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update equipment');
  }
}

async function deleteEquipment(id: number): Promise<void> {
  const res = await fetch(`/api/accounting/equipment/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete equipment');
  }
}

interface FormData {
  fixedAssetId: number | null;
  serialNumber: string;
  manufacturer: string;
  model: string;
  specifications: string;
  warrantyStartDate: string;
  warrantyEndDate: string;
  isAvailable: boolean;
}

export function EquipmentForm({ mode, equipmentId }: EquipmentFormProps) {
  const t = useTranslations('accounting');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    fixedAssetId: null,
    serialNumber: '',
    manufacturer: '',
    model: '',
    specifications: '',
    warrantyStartDate: '',
    warrantyEndDate: '',
    isAvailable: true,
  });

  const { data: existingEquipment, isLoading: isLoadingEquipment } = useQuery({
    queryKey: ['equipment', equipmentId],
    queryFn: () => fetchEquipment(equipmentId!),
    enabled: mode === 'edit' && !!equipmentId,
  });

  const { data: fixedAssets = [] } = useQuery({
    queryKey: ['fixed-assets-active'],
    queryFn: fetchFixedAssets,
    enabled: mode === 'create',
  });

  useEffect(() => {
    if (existingEquipment) {
      setFormData({
        fixedAssetId: existingEquipment.fixedAssetId,
        serialNumber: existingEquipment.serialNumber || '',
        manufacturer: existingEquipment.manufacturer || '',
        model: existingEquipment.model || '',
        specifications: existingEquipment.specifications || '',
        warrantyStartDate: existingEquipment.warrantyStartDate || '',
        warrantyEndDate: existingEquipment.warrantyEndDate || '',
        isAvailable: existingEquipment.isAvailable ?? true,
      });
    }
  }, [existingEquipment]);

  const createMutation = useMutation({
    mutationFn: (data: EquipmentCreate) => createEquipment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      notify(t('equipment.form.toast.createSuccess'), 'success', 3000);
      router.push('/accounting/equipment');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: EquipmentUpdate) => updateEquipment(equipmentId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['equipment', equipmentId] });
      notify(t('equipment.form.toast.updateSuccess'), 'success', 3000);
      router.push('/accounting/equipment');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteEquipment(equipmentId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      notify(t('equipment.deleteSuccess'), 'success', 3000);
      router.push('/accounting/equipment');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleSubmit = () => {
    if (mode === 'create' && !formData.fixedAssetId) {
      notify(t('equipment.form.validation.selectFixedAsset'), 'error', 3000);
      return;
    }

    if (mode === 'create') {
      const createData: EquipmentCreate = {
        fixedAssetId: formData.fixedAssetId!,
        serialNumber: formData.serialNumber || undefined,
        manufacturer: formData.manufacturer || undefined,
        model: formData.model || undefined,
        specifications: formData.specifications || undefined,
        warrantyStartDate: formData.warrantyStartDate || undefined,
        warrantyEndDate: formData.warrantyEndDate || undefined,
      };
      createMutation.mutate(createData);
    } else {
      const updateData: EquipmentUpdate = {
        serialNumber: formData.serialNumber || undefined,
        manufacturer: formData.manufacturer || undefined,
        model: formData.model || undefined,
        specifications: formData.specifications || undefined,
        warrantyStartDate: formData.warrantyStartDate || undefined,
        warrantyEndDate: formData.warrantyEndDate || undefined,
        isAvailable: formData.isAvailable,
      };
      updateMutation.mutate(updateData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (mode === 'edit' && isLoadingEquipment) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">{t('equipment.form.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ResponsivePageHeader
        title={mode === 'create' ? t('equipment.form.title.create') : t('equipment.form.title.edit')}
        subtitle={mode === 'create' ? t('equipment.form.subtitle.create') : t('equipment.form.subtitle.edit', { code: existingEquipment?.asset?.assetCode || '' })}
        icon={Wrench}
        iconBgColor="bg-purple-100"
        iconColor="text-purple-600"
        breadcrumbs={[
          { label: t('equipment.breadcrumbAccounting'), href: '/accounting' },
          { label: t('equipment.breadcrumbEquipment'), href: '/accounting/equipment' },
          { label: mode === 'create' ? t('equipment.form.breadcrumbCreate') : t('equipment.form.breadcrumbEdit') },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              text={t('equipment.form.back')}
              icon="back"
              stylingMode="outlined"
              onClick={() => router.push('/accounting/equipment')}
            />
            <Button
              text={isSubmitting ? t('equipment.form.saving') : t('equipment.form.save')}
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
                <p className="font-medium text-red-800">{t('equipment.delete.title')}</p>
                <p className="text-sm text-red-600">
                  {t('equipment.form.deleteConfirm.message')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text={t('equipment.delete.cancel')}
                  stylingMode="outlined"
                  onClick={() => setShowDeleteConfirm(false)}
                />
                <Button
                  text={deleteMutation.isPending ? t('equipment.delete.deleting') : t('equipment.delete.confirm')}
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
              <CardTitle>{t('equipment.form.sections.basic')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === 'create' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('equipment.form.fields.fixedAsset')} <span className="text-red-500">*</span>
                  </label>
                  <SelectBox
                    dataSource={fixedAssets}
                    displayExpr={(item: FixedAsset) => item ? `${item.assetCode} - ${item.nameTh}` : ''}
                    valueExpr="id"
                    value={formData.fixedAssetId}
                    onValueChanged={(e) => setFormData({ ...formData, fixedAssetId: e.value })}
                    placeholder={t('equipment.form.fields.fixedAssetPlaceholder')}
                    searchEnabled
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('equipment.form.fields.serialNumber')}
                  </label>
                  <TextBox
                    value={formData.serialNumber}
                    onValueChanged={(e) => setFormData({ ...formData, serialNumber: e.value || '' })}
                    placeholder={t('equipment.form.fields.serialNumber')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('equipment.form.fields.manufacturer')}
                  </label>
                  <TextBox
                    value={formData.manufacturer}
                    onValueChanged={(e) => setFormData({ ...formData, manufacturer: e.value || '' })}
                    placeholder={t('equipment.form.fields.manufacturer')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('equipment.form.fields.model')}
                </label>
                <TextBox
                  value={formData.model}
                  onValueChanged={(e) => setFormData({ ...formData, model: e.value || '' })}
                  placeholder={t('equipment.form.fields.model')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('equipment.form.fields.specifications')}
                </label>
                <TextArea
                  value={formData.specifications}
                  onValueChanged={(e) => setFormData({ ...formData, specifications: e.value || '' })}
                  placeholder={t('equipment.form.fields.specificationsPlaceholder')}
                  height={100}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('equipment.form.sections.warranty')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('equipment.form.fields.warrantyStartDate')}
                  </label>
                  <DxDateBox
                    value={formData.warrantyStartDate}
                    onValueChange={(value) => setFormData({ ...formData, warrantyStartDate: value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('equipment.form.fields.warrantyEndDate')}
                  </label>
                  <DxDateBox
                    value={formData.warrantyEndDate}
                    onValueChange={(value) => setFormData({ ...formData, warrantyEndDate: value })}
                  />
                </div>
              </div>

              {mode === 'edit' && (
                <div className="flex items-center gap-3">
                  <label className="block text-sm font-medium text-gray-700">
                    {t('equipment.form.fields.isAvailable')}
                  </label>
                  <Switch
                    value={formData.isAvailable}
                    onValueChanged={(e) => setFormData({ ...formData, isAvailable: e.value })}
                  />
                  <span className="text-sm text-gray-500">
                    {formData.isAvailable ? t('equipment.form.status.available') : t('equipment.form.status.unavailable')}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {mode === 'edit' && existingEquipment && (
            <Card>
              <CardHeader>
                <CardTitle>{t('equipment.form.detail.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-sm text-gray-500">{t('equipment.form.detail.assetCode')}</span>
                  <p className="font-medium">{existingEquipment.asset?.assetCode || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">{t('equipment.form.detail.assetName')}</span>
                  <p className="font-medium">{existingEquipment.asset?.nameTh || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">{t('equipment.form.detail.operatingHours')}</span>
                  <p className="font-medium">{t('equipment.form.detail.operatingHoursValue', { hours: existingEquipment.operatingHours?.toLocaleString() || 0 })}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">{t('equipment.form.detail.lastMaintenance')}</span>
                  <p className="font-medium">
                    {existingEquipment.lastMaintenanceDate || t('equipment.form.detail.never')}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">{t('equipment.form.detail.status')}</span>
                  <p className={`font-medium ${existingEquipment.isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                    {existingEquipment.isAvailable ? t('equipment.form.detail.statusAvailable') : t('equipment.form.detail.statusUnavailable')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {mode === 'edit' && equipmentId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  {t('equipment.form.audit.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  {t('equipment.form.audit.description')}
                </p>
                <Button
                  text={t('equipment.form.audit.viewHistory')}
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
                <CardTitle className="text-red-600">{t('equipment.form.dangerZone.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  {t('equipment.form.dangerZone.description')}
                </p>
                <Button
                  text={t('equipment.form.dangerZone.deleteButton')}
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
      {mode === 'edit' && equipmentId && (
        <AuditLogViewerDialog
          entityType="accountingEquipment"
          entityId={equipmentId}
          visible={auditDialogOpen}
          onClose={() => setAuditDialogOpen(false)}
          fieldLabels={{
            fixedAssetId: t('equipment.form.fields.fixedAsset'),
            serialNumber: t('equipment.form.fields.serialNumber'),
            manufacturer: t('equipment.form.fields.manufacturer'),
            model: t('equipment.form.fields.model'),
            specifications: t('equipment.form.fields.specifications'),
            warrantyStartDate: t('equipment.form.fields.warrantyStartDate'),
            warrantyEndDate: t('equipment.form.fields.warrantyEndDate'),
            operatingHours: t('equipment.form.audit.fields.operatingHours'),
            operatingUnits: t('equipment.form.audit.fields.operatingUnits'),
            lastMeterReading: t('equipment.form.audit.fields.lastMeterReading'),
            isAvailable: t('equipment.form.fields.isAvailable'),
            lastMaintenanceDate: t('equipment.form.audit.fields.lastMaintenanceDate'),
            nextMaintenanceDue: t('equipment.form.audit.fields.nextMaintenanceDue'),
          }}
        />
      )}
    </div>
  );
}

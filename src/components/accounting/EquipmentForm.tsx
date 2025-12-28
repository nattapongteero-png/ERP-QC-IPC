// Accounting Equipment Form Component
// Feature: 010-accounting-module-integration
// Pattern: Aligned with Template module form design
'use client';

import { useState, useEffect } from 'react';
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
      notify('Equipment created successfully', 'success', 3000);
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
      notify('Equipment updated successfully', 'success', 3000);
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
      notify('Equipment deleted successfully', 'success', 3000);
      router.push('/accounting/equipment');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleSubmit = () => {
    if (mode === 'create' && !formData.fixedAssetId) {
      notify('Please select a Fixed Asset', 'error', 3000);
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
        <p className="text-gray-500">Loading equipment...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ResponsivePageHeader
        title={mode === 'create' ? 'เพิ่มอุปกรณ์' : 'แก้ไขอุปกรณ์'}
        subtitle={mode === 'create' ? 'Create New Equipment' : `Edit: ${existingEquipment?.asset?.assetCode || ''}`}
        icon={Wrench}
        iconBgColor="bg-purple-100"
        iconColor="text-purple-600"
        breadcrumbs={[
          { label: 'Accounting', href: '/accounting' },
          { label: 'Equipment', href: '/accounting/equipment' },
          { label: mode === 'create' ? 'New' : 'Edit' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              text="Back"
              icon="back"
              stylingMode="outlined"
              onClick={() => router.push('/accounting/equipment')}
            />
            <Button
              text={isSubmitting ? 'Saving...' : 'Save'}
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
                <p className="font-medium text-red-800">Confirm Delete</p>
                <p className="text-sm text-red-600">
                  Are you sure you want to delete this equipment? This action cannot be undone.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text="Cancel"
                  stylingMode="outlined"
                  onClick={() => setShowDeleteConfirm(false)}
                />
                <Button
                  text={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
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
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === 'create' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fixed Asset <span className="text-red-500">*</span>
                  </label>
                  <SelectBox
                    dataSource={fixedAssets}
                    displayExpr={(item: FixedAsset) => item ? `${item.assetCode} - ${item.nameTh}` : ''}
                    valueExpr="id"
                    value={formData.fixedAssetId}
                    onValueChanged={(e) => setFormData({ ...formData, fixedAssetId: e.value })}
                    placeholder="Select Fixed Asset"
                    searchEnabled
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Serial Number
                  </label>
                  <TextBox
                    value={formData.serialNumber}
                    onValueChanged={(e) => setFormData({ ...formData, serialNumber: e.value || '' })}
                    placeholder="Serial Number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manufacturer
                  </label>
                  <TextBox
                    value={formData.manufacturer}
                    onValueChanged={(e) => setFormData({ ...formData, manufacturer: e.value || '' })}
                    placeholder="Manufacturer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                <TextBox
                  value={formData.model}
                  onValueChanged={(e) => setFormData({ ...formData, model: e.value || '' })}
                  placeholder="Model"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Specifications
                </label>
                <TextArea
                  value={formData.specifications}
                  onValueChanged={(e) => setFormData({ ...formData, specifications: e.value || '' })}
                  placeholder="Equipment specifications..."
                  height={100}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Warranty Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Warranty Start Date
                  </label>
                  <DxDateBox
                    value={formData.warrantyStartDate}
                    onValueChange={(value) => setFormData({ ...formData, warrantyStartDate: value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Warranty End Date
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
                    Available
                  </label>
                  <Switch
                    value={formData.isAvailable}
                    onValueChanged={(e) => setFormData({ ...formData, isAvailable: e.value })}
                  />
                  <span className="text-sm text-gray-500">
                    {formData.isAvailable ? 'Equipment is available for use' : 'Equipment is not available'}
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
                <CardTitle>Equipment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-sm text-gray-500">Asset Code</span>
                  <p className="font-medium">{existingEquipment.asset?.assetCode || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Asset Name</span>
                  <p className="font-medium">{existingEquipment.asset?.nameTh || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Operating Hours</span>
                  <p className="font-medium">{existingEquipment.operatingHours?.toLocaleString() || 0} hrs</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Last Maintenance</span>
                  <p className="font-medium">
                    {existingEquipment.lastMaintenanceDate || 'Never'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Status</span>
                  <p className={`font-medium ${existingEquipment.isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                    {existingEquipment.isAvailable ? 'Available' : 'Unavailable'}
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
                  Audit History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  View all changes made to this equipment.
                </p>
                <Button
                  text="View History"
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
                <CardTitle className="text-red-600">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Deleting this equipment will remove all associated maintenance records.
                </p>
                <Button
                  text="Delete Equipment"
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
            fixedAssetId: 'Fixed Asset',
            serialNumber: 'Serial Number',
            manufacturer: 'Manufacturer',
            model: 'Model',
            specifications: 'Specifications',
            warrantyStartDate: 'Warranty Start Date',
            warrantyEndDate: 'Warranty End Date',
            operatingHours: 'Operating Hours',
            operatingUnits: 'Operating Units',
            lastMeterReading: 'Last Meter Reading',
            isAvailable: 'Available',
            lastMaintenanceDate: 'Last Maintenance Date',
            nextMaintenanceDue: 'Next Maintenance Due',
          }}
        />
      )}
    </div>
  );
}

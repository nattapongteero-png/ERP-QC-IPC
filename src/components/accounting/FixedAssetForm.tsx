'use client';

import { useState, useEffect } from 'react';
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
import { Building } from 'lucide-react';
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

const depreciationMethods = [
  { value: 'straight_line', label: 'Straight Line' },
  { value: 'declining_balance', label: 'Declining Balance' },
];

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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
      notify('Fixed asset created successfully', 'success', 3000);
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
      notify('Fixed asset updated successfully', 'success', 3000);
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
      notify('Fixed asset deleted successfully', 'success', 3000);
      router.push('/accounting/fixed-assets');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleSubmit = () => {
    if (!formData.nameTh || !formData.nameEn || !formData.categoryId) {
      notify('Please fill in required fields', 'error', 3000);
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
        <p className="text-gray-500">Loading asset...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ResponsivePageHeader
        title={mode === 'create' ? 'เพิ่มทรัพย์สินถาวร' : 'แก้ไขทรัพย์สินถาวร'}
        subtitle={mode === 'create' ? 'Create New Fixed Asset' : `Edit: ${existingAsset?.assetCode || ''}`}
        icon={Building}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: 'Accounting', href: '/accounting' },
          { label: 'Fixed Assets', href: '/accounting/fixed-assets' },
          { label: mode === 'create' ? 'New' : 'Edit' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              text="Back"
              icon="back"
              stylingMode="outlined"
              onClick={() => router.push('/accounting/fixed-assets')}
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
                  Are you sure you want to delete this asset? This action cannot be undone.
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name (Thai) <span className="text-red-500">*</span>
                  </label>
                  <TextBox
                    value={formData.nameTh}
                    onValueChanged={(e) => setFormData({ ...formData, nameTh: e.value || '' })}
                    placeholder="ชื่อทรัพย์สิน"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name (English) <span className="text-red-500">*</span>
                  </label>
                  <TextBox
                    value={formData.nameEn}
                    onValueChanged={(e) => setFormData({ ...formData, nameEn: e.value || '' })}
                    placeholder="Asset Name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <SelectBox
                    dataSource={categories}
                    displayExpr="nameEn"
                    valueExpr="id"
                    value={formData.categoryId}
                    onValueChanged={(e) => setFormData({ ...formData, categoryId: e.value })}
                    placeholder="Select Category"
                    searchEnabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <TextBox
                    value={formData.location}
                    onValueChanged={(e) => setFormData({ ...formData, location: e.value || '' })}
                    placeholder="Location"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acquisition & Depreciation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Acquisition Date <span className="text-red-500">*</span>
                  </label>
                  <DxDateBox
                    value={formData.acquisitionDate}
                    onValueChange={(value) => setFormData({ ...formData, acquisitionDate: value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Acquisition Cost <span className="text-red-500">*</span>
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
                    Salvage Value
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
                    Useful Life (Months)
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
                    Depreciation Method
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
                    Depreciation Start Date
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
                <CardTitle>Asset Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-sm text-gray-500">Asset Code</span>
                  <p className="font-medium">{existingAsset.assetCode}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Status</span>
                  <p className="font-medium capitalize">{existingAsset.status}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Net Book Value</span>
                  <p className="font-medium">
                    {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(
                      Number(existingAsset.netBookValue) || 0
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Accumulated Depreciation</span>
                  <p className="font-medium">
                    {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(
                      Number(existingAsset.accumulatedDepreciation) || 0
                    )}
                  </p>
                </div>
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
                  Deleting this asset will remove all associated records.
                </p>
                <Button
                  text="Delete Asset"
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
    </div>
  );
}

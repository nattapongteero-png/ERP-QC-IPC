'use client';

/**
 * Packaging QC Criteria Form Component
 * Reusable form for creating and editing packaging QC criteria
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSwitch } from '@/components/ui/dx-switch';
import { SwitchTypes } from 'devextreme-react/switch';
import { useToast } from '@/hooks/use-toast';
import { Scale, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PackagingQCCriteria {
  id: number;
  code: string;
  name: string;
  weightMin: number;
  weightMax: number;
  sampleSize: number;
  maxFailures: number;
  checkIntervalMinutes: number;
  unitsPerPack: number;
  isActive: boolean;
}

interface PackagingQCCriteriaFormProps {
  mode: 'create' | 'edit';
  id?: number;
}

export function PackagingQCCriteriaForm({ mode, id }: PackagingQCCriteriaFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formData, setFormData] = React.useState<Partial<PackagingQCCriteria>>({
    weightMin: 30,
    weightMax: 33,
    sampleSize: 20,
    maxFailures: 2,
    checkIntervalMinutes: 30,
    unitsPerPack: 12,
    isActive: true,
  });

  // Fetch existing criteria for edit mode
  const { data: existingCriteria, isLoading: isLoadingCriteria } = useQuery<PackagingQCCriteria>({
    queryKey: ['packaging-qc-criteria', id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/packaging-qc-criteria?id=${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const items = data.data;
      const item = Array.isArray(items) ? items.find((i: PackagingQCCriteria) => i.id === id) : items;
      return item;
    },
    enabled: mode === 'edit' && !!id,
  });

  // Populate form when editing
  React.useEffect(() => {
    if (existingCriteria) {
      setFormData(existingCriteria);
    }
  }, [existingCriteria]);

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<PackagingQCCriteria>) => {
      const url = '/api/master-data/packaging-qc-criteria';
      const method = mode === 'edit' ? 'PUT' : 'POST';

      const payload = mode === 'edit' ? { ...data, id } : data;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging-qc-criteria'] });
      toast.success(
        mode === 'edit' ? 'Criteria Updated' : 'Criteria Created',
        `${formData.name} has been ${mode === 'edit' ? 'updated' : 'created'} successfully.`
      );
      router.push('/master-data/packaging-qc-criteria');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const handleSave = () => {
    if (!formData.code || !formData.name) {
      toast.error('Validation Error', 'Please fill in all required fields.');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleCancel = () => {
    router.push('/master-data/packaging-qc-criteria');
  };

  if (mode === 'edit' && isLoadingCriteria) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-4xl mx-auto">
      {/* Header */}
      <ResponsivePageHeader
        title={mode === 'edit' ? 'Edit QC Criteria' : 'New QC Criteria'}
        subtitle={mode === 'edit' ? `Editing ${existingCriteria?.name || ''}` : 'Create new packaging QC criteria'}
        icon={Scale}
        iconBgColor="bg-indigo-100"
        iconColor="text-indigo-600"
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'Packaging QC Criteria', href: '/master-data/packaging-qc-criteria' },
          { label: mode === 'edit' ? 'Edit' : 'New' },
        ]}
        actions={
          <div className="flex gap-2">
            <DxButton
              text="Cancel"
              icon="back"
              stylingMode="outlined"
              onClick={handleCancel}
            />
            <DxButton
              text={saveMutation.isPending ? 'Saving...' : 'Save'}
              icon="save"
              type="success"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            />
          </div>
        }
      />

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-indigo-600" />
            QC Criteria Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <DxTextBox
                value={formData.code || ''}
                onValueChanged={(e) => setFormData({ ...formData, code: e.value })}
                placeholder="e.g., QC-30G-TUBE"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Criteria Name *</label>
              <DxTextBox
                value={formData.name || ''}
                onValueChanged={(e) => setFormData({ ...formData, name: e.value })}
                placeholder="e.g., Plai Cream 30g Tube"
              />
            </div>
          </div>

          {/* Weight Control */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Weight Control (grams)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-blue-700 mb-1">Minimum Weight</label>
                <DxNumberBox
                  value={formData.weightMin}
                  onValueChanged={(e) => setFormData({ ...formData, weightMin: e.value })}
                  min={0}
                  max={1000}
                  format="#0.0"
                  showSpinButtons
                />
              </div>
              <div>
                <label className="block text-xs text-blue-700 mb-1">Maximum Weight</label>
                <DxNumberBox
                  value={formData.weightMax}
                  onValueChanged={(e) => setFormData({ ...formData, weightMax: e.value })}
                  min={0}
                  max={1000}
                  format="#0.0"
                  showSpinButtons
                />
              </div>
            </div>
          </div>

          {/* Sampling Criteria */}
          <div className="bg-amber-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-amber-800 mb-3">Sampling Criteria</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-amber-700 mb-1">Sample Size</label>
                <DxNumberBox
                  value={formData.sampleSize}
                  onValueChanged={(e) => setFormData({ ...formData, sampleSize: e.value })}
                  min={1}
                  max={100}
                  showSpinButtons
                />
              </div>
              <div>
                <label className="block text-xs text-amber-700 mb-1">Max Allowed Failures</label>
                <DxNumberBox
                  value={formData.maxFailures}
                  onValueChanged={(e) => setFormData({ ...formData, maxFailures: e.value })}
                  min={0}
                  max={20}
                  showSpinButtons
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Check Interval (minutes)</label>
              <DxNumberBox
                value={formData.checkIntervalMinutes}
                onValueChanged={(e) => setFormData({ ...formData, checkIntervalMinutes: e.value })}
                min={5}
                max={120}
                step={5}
                showSpinButtons
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Package className="h-4 w-4" />
                Units Per Pack
              </label>
              <DxNumberBox
                value={formData.unitsPerPack}
                onValueChanged={(e) => setFormData({ ...formData, unitsPerPack: e.value })}
                min={1}
                max={100}
                showSpinButtons
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <DxSwitch
              value={formData.isActive !== false}
              onValueChanged={(e: SwitchTypes.ValueChangedEvent) => setFormData({ ...formData, isActive: e.value })}
            />
            <span className="text-sm text-gray-700">Active</span>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <DxButton
          text="Cancel"
          stylingMode="outlined"
          onClick={handleCancel}
        />
        <DxButton
          text={saveMutation.isPending ? 'Saving...' : (mode === 'edit' ? 'Update Criteria' : 'Create Criteria')}
          type="success"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        />
      </div>
    </div>
  );
}

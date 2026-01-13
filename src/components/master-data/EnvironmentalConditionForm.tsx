'use client';

/**
 * Environmental Condition Form Component
 * Reusable form for creating and editing environmental condition profiles
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSwitch } from '@/components/ui/dx-switch';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { SwitchTypes } from 'devextreme-react/switch';
import { useToast } from '@/hooks/use-toast';
import { Thermometer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface EnvironmentalCondition {
  id: number;
  code: string;
  name: string;
  temperatureMin: number;
  temperatureMax: number;
  humidityMax: number;
  monitoringIntervalMinutes: number;
  notes?: string;
  isActive: boolean;
}

interface EnvironmentalConditionFormProps {
  mode: 'create' | 'edit';
  id?: number;
}

export function EnvironmentalConditionForm({ mode, id }: EnvironmentalConditionFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formData, setFormData] = React.useState<Partial<EnvironmentalCondition>>({
    temperatureMin: 20,
    temperatureMax: 30,
    humidityMax: 60,
    monitoringIntervalMinutes: 60,
    isActive: true,
  });

  // Fetch existing condition for edit mode
  const { data: existingCondition, isLoading: isLoadingCondition } = useQuery<EnvironmentalCondition>({
    queryKey: ['environmental-condition', id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/environmental-conditions?id=${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const items = data.data;
      const item = Array.isArray(items) ? items.find((i: EnvironmentalCondition) => i.id === id) : items;
      return item;
    },
    enabled: mode === 'edit' && !!id,
  });

  // Populate form when editing
  React.useEffect(() => {
    if (existingCondition) {
      setFormData(existingCondition);
    }
  }, [existingCondition]);

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<EnvironmentalCondition>) => {
      const url = '/api/master-data/environmental-conditions';
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
      queryClient.invalidateQueries({ queryKey: ['environmental-conditions'] });
      toast.success(
        mode === 'edit' ? 'Condition Updated' : 'Condition Created',
        `${formData.name} has been ${mode === 'edit' ? 'updated' : 'created'} successfully.`
      );
      router.push('/master-data/environmental-conditions');
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
    router.push('/master-data/environmental-conditions');
  };

  if (mode === 'edit' && isLoadingCondition) {
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
        title={mode === 'edit' ? 'Edit Condition Profile' : 'New Condition Profile'}
        subtitle={mode === 'edit' ? `Editing ${existingCondition?.name || ''}` : 'Create a new environmental condition profile'}
        icon={Thermometer}
        iconBgColor="bg-teal-100"
        iconColor="text-teal-600"
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'Environmental Conditions', href: '/master-data/environmental-conditions' },
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
            <Thermometer className="h-5 w-5 text-teal-600" />
            Condition Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <DxTextBox
                value={formData.code || ''}
                onValueChanged={(e) => setFormData({ ...formData, code: e.value })}
                placeholder="e.g., COND-STD"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Profile Name *</label>
              <DxTextBox
                value={formData.name || ''}
                onValueChanged={(e) => setFormData({ ...formData, name: e.value })}
                placeholder="e.g., Standard Production"
              />
            </div>
          </div>

          {/* Temperature Range */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
              <Thermometer className="h-4 w-4" />
              Temperature Range (C)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-blue-700 mb-1">Minimum</label>
                <DxNumberBox
                  value={formData.temperatureMin}
                  onValueChanged={(e) => setFormData({ ...formData, temperatureMin: e.value })}
                  min={0}
                  max={50}
                  showSpinButtons
                />
              </div>
              <div>
                <label className="block text-xs text-blue-700 mb-1">Maximum</label>
                <DxNumberBox
                  value={formData.temperatureMax}
                  onValueChanged={(e) => setFormData({ ...formData, temperatureMax: e.value })}
                  min={0}
                  max={50}
                  showSpinButtons
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Humidity (% RH)</label>
              <DxNumberBox
                value={formData.humidityMax}
                onValueChanged={(e) => setFormData({ ...formData, humidityMax: e.value })}
                min={0}
                max={100}
                showSpinButtons
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monitoring Interval (minutes)</label>
              <DxNumberBox
                value={formData.monitoringIntervalMinutes}
                onValueChanged={(e) => setFormData({ ...formData, monitoringIntervalMinutes: e.value })}
                min={5}
                max={120}
                step={5}
                showSpinButtons
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <DxTextArea
              value={formData.notes || ''}
              onValueChanged={(e) => setFormData({ ...formData, notes: e.value })}
              placeholder="e.g., Humidity may exceed during boiling process"
              height={80}
            />
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
          text={saveMutation.isPending ? 'Saving...' : (mode === 'edit' ? 'Update Condition' : 'Create Condition')}
          type="success"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        />
      </div>
    </div>
  );
}

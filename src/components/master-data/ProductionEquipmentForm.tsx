'use client';

/**
 * Production Equipment Form Component
 * Reusable form for creating and editing production equipment
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSwitch } from '@/components/ui/dx-switch';
import { SwitchTypes } from 'devextreme-react/switch';
import { useToast } from '@/hooks/use-toast';
import { Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProductionEquipment {
  id: number;
  code: string;
  name: string;
  nameTh: string;
  equipmentType: string;
  capacity?: string;
  roomId?: number;
  description?: string;
  isActive: boolean;
}

interface ProductionRoom {
  id: number;
  code: string;
  name: string;
}

interface ProductionEquipmentFormProps {
  mode: 'create' | 'edit';
  id?: number;
}

const equipmentTypes = [
  { value: 'scale', label: 'Scale' },
  { value: 'mixer', label: 'Mixer' },
  { value: 'hotplate', label: 'Hotplate' },
  { value: 'container', label: 'Container' },
  { value: 'tool', label: 'Tool' },
  { value: 'filler', label: 'Filler' },
  { value: 'tank', label: 'Tank' },
  { value: 'pump', label: 'Pump' },
  { value: 'other', label: 'Other' },
];

export function ProductionEquipmentForm({ mode, id }: ProductionEquipmentFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formData, setFormData] = React.useState<Partial<ProductionEquipment>>({
    isActive: true,
  });

  // Fetch existing equipment for edit mode
  const { data: existingEquipment, isLoading: isLoadingEquipment } = useQuery<ProductionEquipment>({
    queryKey: ['production-equipment', id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/production-equipment?id=${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      // API returns array, get the single item
      const items = data.data;
      const item = Array.isArray(items) ? items.find((i: ProductionEquipment) => i.id === id) : items;
      return item;
    },
    enabled: mode === 'edit' && !!id,
  });

  // Populate form when editing
  React.useEffect(() => {
    if (existingEquipment) {
      setFormData(existingEquipment);
    }
  }, [existingEquipment]);

  // Fetch rooms for dropdown
  const { data: rooms } = useQuery<ProductionRoom[]>({
    queryKey: ['production-rooms'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/production-rooms');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<ProductionEquipment>) => {
      const url = mode === 'edit'
        ? '/api/master-data/production-equipment'
        : '/api/master-data/production-equipment';
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
      queryClient.invalidateQueries({ queryKey: ['production-equipment'] });
      toast.success(
        mode === 'edit' ? 'Equipment Updated' : 'Equipment Created',
        `${formData.name} has been ${mode === 'edit' ? 'updated' : 'created'} successfully.`
      );
      router.push('/master-data/production-equipment');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const handleSave = () => {
    if (!formData.code || !formData.name || !formData.nameTh || !formData.equipmentType) {
      toast.error('Validation Error', 'Please fill in all required fields.');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleCancel = () => {
    router.push('/master-data/production-equipment');
  };

  if (mode === 'edit' && isLoadingEquipment) {
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
        title={mode === 'edit' ? 'Edit Equipment' : 'New Equipment'}
        subtitle={mode === 'edit' ? `Editing ${existingEquipment?.name || ''}` : 'Create a new production equipment'}
        icon={Wrench}
        iconBgColor="bg-purple-100"
        iconColor="text-purple-600"
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'Production Equipment', href: '/master-data/production-equipment' },
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
            <Wrench className="h-5 w-5 text-purple-600" />
            Equipment Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <DxTextBox
                value={formData.code || ''}
                onValueChanged={(e) => setFormData({ ...formData, code: e.value })}
                placeholder="e.g., EQ-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Equipment Type *</label>
              <DxSelectBox
                dataSource={equipmentTypes}
                displayExpr="label"
                valueExpr="value"
                value={formData.equipmentType}
                onValueChanged={(e) => setFormData({ ...formData, equipmentType: e.value })}
                placeholder="Select type"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name (EN) *</label>
            <DxTextBox
              value={formData.name || ''}
              onValueChanged={(e) => setFormData({ ...formData, name: e.value })}
              placeholder="Equipment name in English"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name (TH) *</label>
            <DxTextBox
              value={formData.nameTh || ''}
              onValueChanged={(e) => setFormData({ ...formData, nameTh: e.value })}
              placeholder="Equipment name in Thai"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
              <DxTextBox
                value={formData.capacity || ''}
                onValueChanged={(e) => setFormData({ ...formData, capacity: e.value })}
                placeholder="e.g., 200 kg, 50 liters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Room</label>
              <DxSelectBox
                dataSource={(rooms || []).map(r => ({ id: r.id, name: r.name }))}
                displayExpr="name"
                valueExpr="id"
                value={formData.roomId}
                onValueChanged={(e) => setFormData({ ...formData, roomId: e.value })}
                placeholder="Select room"
                showClearButton
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <DxTextBox
              value={formData.description || ''}
              onValueChanged={(e) => setFormData({ ...formData, description: e.value })}
              placeholder="Optional description"
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
          text={saveMutation.isPending ? 'Saving...' : (mode === 'edit' ? 'Update Equipment' : 'Create Equipment')}
          type="success"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        />
      </div>
    </div>
  );
}

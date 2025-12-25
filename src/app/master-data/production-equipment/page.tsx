'use client';

/**
 * Production Equipment Master Data Page
 * Manages production equipment for GMP compliance.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSwitch } from '@/components/ui/dx-switch';
import { SwitchTypes } from 'devextreme-react/switch';
import { useToast } from '@/hooks/use-toast';
import { Wrench, Plus } from 'lucide-react';

interface ProductionEquipment {
  id: number;
  code: string;
  name: string;
  nameTh: string;
  equipmentType: string;
  capacity?: string;
  roomId?: number;
  roomName?: string;
  description?: string;
  isActive: boolean;
}

interface ProductionRoom {
  id: number;
  code: string;
  name: string;
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

export default function ProductionEquipmentPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<ProductionEquipment | null>(null);
  const [formData, setFormData] = useState<Partial<ProductionEquipment>>({
    isActive: true,
  });

  // Fetch equipment
  const { data: equipment, isLoading } = useQuery<ProductionEquipment[]>({
    queryKey: ['production-equipment'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/production-equipment');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

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
      const url = editingEquipment
        ? `/api/master-data/production-equipment?id=${editingEquipment.id}`
        : '/api/master-data/production-equipment';
      const method = editingEquipment ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-equipment'] });
      toast.success(
        editingEquipment ? 'Equipment Updated' : 'Equipment Created',
        `${formData.name} has been ${editingEquipment ? 'updated' : 'created'} successfully.`
      );
      handleCloseForm();
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/master-data/production-equipment?id=${id}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-equipment'] });
      toast.success('Equipment Deactivated', 'The equipment has been deactivated.');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const handleOpenForm = (equip?: ProductionEquipment) => {
    if (equip) {
      setEditingEquipment(equip);
      setFormData(equip);
    } else {
      setEditingEquipment(null);
      setFormData({ isActive: true });
    }
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingEquipment(null);
    setFormData({ isActive: true });
  };

  const handleSave = () => {
    if (!formData.code || !formData.name || !formData.nameTh || !formData.equipmentType) {
      toast.error('Validation Error', 'Please fill in all required fields.');
      return;
    }
    saveMutation.mutate(formData);
  };

  const renderTypeBadge = (type: string) => {
    const typeInfo = equipmentTypes.find((t) => t.value === type);
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
        <Wrench className="h-3 w-3" />
        {typeInfo?.label || type}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      {/* Header */}
      <ResponsivePageHeader
        title="Production Equipment"
        subtitle="Manage production equipment for GMP compliance"
        icon={Wrench}
        iconBgColor="bg-purple-100"
        iconColor="text-purple-600"
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'Production Equipment' },
        ]}
        actions={
          <DxButton
            text="Add Equipment"
            icon="plus"
            type="success"
            onClick={() => handleOpenForm()}
          />
        }
      />

      {/* Data Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <DxDataGrid
          dataSource={equipment || []}
          keyExpr="id"
          showBorders={false}
          rowAlternationEnabled
          loading={isLoading}
          height={500}
          width="100%"
          columnAutoWidth
        >
          <DxSearchPanel visible placeholder="Search equipment..." width={200} />
          <DxPaging defaultPageSize={15} />

          <DxColumn dataField="code" caption="Code" width={120} cellRender={(cell) => (
            <span className="font-mono font-medium text-purple-700">{cell.value}</span>
          )} />
          <DxColumn dataField="name" caption="Name (EN)" minWidth={150} />
          <DxColumn dataField="nameTh" caption="Name (TH)" minWidth={150} />
          <DxColumn dataField="equipmentType" caption="Type" width={120} cellRender={(cell) => renderTypeBadge(cell.value)} />
          <DxColumn dataField="capacity" caption="Capacity" width={120} />
          <DxColumn dataField="roomName" caption="Default Room" minWidth={150} />
          <DxColumn dataField="isActive" caption="Status" width={100} cellRender={(cell) => (
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cell.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {cell.value ? 'Active' : 'Inactive'}
            </span>
          )} />
          <DxColumn caption="Actions" width={100} cellRender={(cell) => (
            <div className="flex gap-1">
              <DxButton
                icon="edit"
                stylingMode="text"
                hint="Edit"
                onClick={() => handleOpenForm(cell.data)}
              />
              <DxButton
                icon="trash"
                stylingMode="text"
                hint="Deactivate"
                onClick={() => deleteMutation.mutate(cell.data.id)}
              />
            </div>
          )} />
        </DxDataGrid>
      </div>

      {/* Add/Edit Form Popup */}
      <DxPopup
        visible={showForm}
        onHiding={handleCloseForm}
        title={editingEquipment ? 'Edit Equipment' : 'Add Equipment'}
        width={550}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid grid-cols-2 gap-4">
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
          <div className="flex items-center gap-2">
            <DxSwitch
              value={formData.isActive !== false}
              onValueChanged={(e: SwitchTypes.ValueChangedEvent) => setFormData({ ...formData, isActive: e.value })}
            />
            <span className="text-sm text-gray-700">Active</span>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton text="Cancel" stylingMode="outlined" onClick={handleCloseForm} />
            <DxButton
              text={editingEquipment ? 'Update' : 'Create'}
              type="success"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}

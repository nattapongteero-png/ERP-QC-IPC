'use client';

/**
 * Production Rooms Master Data Page
 * Manages production rooms/areas for GMP compliance.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel, DxEditing } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { SwitchTypes } from 'devextreme-react/switch';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSwitch } from '@/components/ui/dx-switch';
import { useToast } from '@/hooks/use-toast';
import { Building2, Plus, Trash2 } from 'lucide-react';

interface ProductionRoom {
  id: number;
  code: string;
  name: string;
  nameTh: string;
  roomType: string;
  description?: string;
  isActive: boolean;
}

const roomTypes = [
  { value: 'weighing', label: 'Weighing Room' },
  { value: 'mixing', label: 'Mixing Room' },
  { value: 'packaging', label: 'Packaging Room' },
  { value: 'storage', label: 'Storage Area' },
  { value: 'preparation', label: 'Preparation Room' },
  { value: 'production', label: 'Production Room' },
];

export default function ProductionRoomsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState<ProductionRoom | null>(null);
  const [formData, setFormData] = useState<Partial<ProductionRoom>>({
    isActive: true,
  });

  // Fetch rooms
  const { data: rooms, isLoading } = useQuery<ProductionRoom[]>({
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
    mutationFn: async (data: Partial<ProductionRoom>) => {
      const url = editingRoom
        ? `/api/master-data/production-rooms?id=${editingRoom.id}`
        : '/api/master-data/production-rooms';
      const method = editingRoom ? 'PUT' : 'POST';

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
      queryClient.invalidateQueries({ queryKey: ['production-rooms'] });
      toast.success(
        editingRoom ? 'Room Updated' : 'Room Created',
        `${formData.name} has been ${editingRoom ? 'updated' : 'created'} successfully.`
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
      const res = await fetch(`/api/master-data/production-rooms?id=${id}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-rooms'] });
      toast.success('Room Deactivated', 'The room has been deactivated.');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const handleOpenForm = (room?: ProductionRoom) => {
    if (room) {
      setEditingRoom(room);
      setFormData(room);
    } else {
      setEditingRoom(null);
      setFormData({ isActive: true });
    }
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingRoom(null);
    setFormData({ isActive: true });
  };

  const handleSave = () => {
    if (!formData.code || !formData.name || !formData.nameTh || !formData.roomType) {
      toast.error('Validation Error', 'Please fill in all required fields.');
      return;
    }
    saveMutation.mutate(formData);
  };

  const renderRoomTypeBadge = (roomType: string) => {
    const type = roomTypes.find((t) => t.value === roomType);
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <Building2 className="h-3 w-3" />
        {type?.label || roomType}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      {/* Header */}
      <ResponsivePageHeader
        title="Production Rooms"
        subtitle="Manage production rooms and areas for GMP compliance"
        icon={Building2}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'Production Rooms' },
        ]}
        actions={
          <DxButton
            text="Add Room"
            icon="plus"
            type="success"
            onClick={() => handleOpenForm()}
          />
        }
      />

      {/* Data Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <DxDataGrid
          dataSource={rooms || []}
          keyExpr="id"
          showBorders={false}
          rowAlternationEnabled
          loading={isLoading}
          height={500}
          width="100%"
          columnAutoWidth
        >
          <DxSearchPanel visible placeholder="Search rooms..." width={200} />
          <DxPaging defaultPageSize={15} />

          <DxColumn dataField="code" caption="Code" width={120} cellRender={(cell) => (
            <span className="font-mono font-medium text-blue-700">{cell.value}</span>
          )} />
          <DxColumn dataField="name" caption="Name (EN)" minWidth={150} />
          <DxColumn dataField="nameTh" caption="Name (TH)" minWidth={150} />
          <DxColumn dataField="roomType" caption="Type" width={150} cellRender={(cell) => renderRoomTypeBadge(cell.value)} />
          <DxColumn dataField="description" caption="Description" minWidth={200} />
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
        title={editingRoom ? 'Edit Room' : 'Add Room'}
        width={500}
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
                placeholder="e.g., ROOM-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room Type *</label>
              <DxSelectBox
                dataSource={roomTypes}
                displayExpr="label"
                valueExpr="value"
                value={formData.roomType}
                onValueChanged={(e) => setFormData({ ...formData, roomType: e.value })}
                placeholder="Select type"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name (EN) *</label>
            <DxTextBox
              value={formData.name || ''}
              onValueChanged={(e) => setFormData({ ...formData, name: e.value })}
              placeholder="Room name in English"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name (TH) *</label>
            <DxTextBox
              value={formData.nameTh || ''}
              onValueChanged={(e) => setFormData({ ...formData, nameTh: e.value })}
              placeholder="Room name in Thai"
            />
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
              text={editingRoom ? 'Update' : 'Create'}
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

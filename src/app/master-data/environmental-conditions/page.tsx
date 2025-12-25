'use client';

/**
 * Environmental Conditions Master Data Page
 * Manages environmental condition profiles for GMP compliance.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSwitch } from '@/components/ui/dx-switch';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { SwitchTypes } from 'devextreme-react/switch';
import { useToast } from '@/hooks/use-toast';
import { Thermometer } from 'lucide-react';

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

export default function EnvironmentalConditionsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingCondition, setEditingCondition] = useState<EnvironmentalCondition | null>(null);
  const [formData, setFormData] = useState<Partial<EnvironmentalCondition>>({
    temperatureMin: 20,
    temperatureMax: 30,
    humidityMax: 60,
    monitoringIntervalMinutes: 60,
    isActive: true,
  });

  // Fetch conditions
  const { data: conditions, isLoading } = useQuery<EnvironmentalCondition[]>({
    queryKey: ['environmental-conditions'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/environmental-conditions');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<EnvironmentalCondition>) => {
      const url = editingCondition
        ? `/api/master-data/environmental-conditions?id=${editingCondition.id}`
        : '/api/master-data/environmental-conditions';
      const method = editingCondition ? 'PUT' : 'POST';

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
      queryClient.invalidateQueries({ queryKey: ['environmental-conditions'] });
      toast.success(
        editingCondition ? 'Condition Updated' : 'Condition Created',
        `${formData.name} has been ${editingCondition ? 'updated' : 'created'} successfully.`
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
      const res = await fetch(`/api/master-data/environmental-conditions?id=${id}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environmental-conditions'] });
      toast.success('Condition Deactivated', 'The condition profile has been deactivated.');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const handleOpenForm = (condition?: EnvironmentalCondition) => {
    if (condition) {
      setEditingCondition(condition);
      setFormData(condition);
    } else {
      setEditingCondition(null);
      setFormData({
        temperatureMin: 20,
        temperatureMax: 30,
        humidityMax: 60,
        monitoringIntervalMinutes: 60,
        isActive: true,
      });
    }
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingCondition(null);
    setFormData({
      temperatureMin: 20,
      temperatureMax: 30,
      humidityMax: 60,
      monitoringIntervalMinutes: 60,
      isActive: true,
    });
  };

  const handleSave = () => {
    if (!formData.code || !formData.name) {
      toast.error('Validation Error', 'Please fill in all required fields.');
      return;
    }
    saveMutation.mutate(formData);
  };

  const renderTempRange = (data: EnvironmentalCondition) => {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <Thermometer className="h-3 w-3" />
        {data.temperatureMin}-{data.temperatureMax}°C
      </span>
    );
  };

  const renderHumidity = (value: number) => {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
        ≤{value}% RH
      </span>
    );
  };

  const renderInterval = (value: number) => {
    return (
      <span className="text-gray-600">
        Every {value} min
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      {/* Header */}
      <ResponsivePageHeader
        title="Environmental Conditions"
        subtitle="Manage environmental condition profiles for production monitoring"
        icon={Thermometer}
        iconBgColor="bg-teal-100"
        iconColor="text-teal-600"
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'Environmental Conditions' },
        ]}
        actions={
          <DxButton
            text="Add Condition"
            icon="plus"
            type="success"
            onClick={() => handleOpenForm()}
          />
        }
      />

      {/* Data Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <DxDataGrid
          dataSource={conditions || []}
          keyExpr="id"
          showBorders={false}
          rowAlternationEnabled
          loading={isLoading}
          height={500}
          width="100%"
          columnAutoWidth
        >
          <DxSearchPanel visible placeholder="Search conditions..." width={200} />
          <DxPaging defaultPageSize={15} />

          <DxColumn dataField="code" caption="Code" width={120} cellRender={(cell) => (
            <span className="font-mono font-medium text-teal-700">{cell.value}</span>
          )} />
          <DxColumn dataField="name" caption="Profile Name" minWidth={200} />
          <DxColumn caption="Temperature Range" width={150} cellRender={(cell) => renderTempRange(cell.data)} />
          <DxColumn dataField="humidityMax" caption="Max Humidity" width={120} cellRender={(cell) => renderHumidity(cell.value)} />
          <DxColumn dataField="monitoringIntervalMinutes" caption="Monitoring Interval" width={150} cellRender={(cell) => renderInterval(cell.value)} />
          <DxColumn dataField="notes" caption="Notes" minWidth={200} />
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
        title={editingCondition ? 'Edit Condition Profile' : 'Add Condition Profile'}
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

          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
              <Thermometer className="h-4 w-4" />
              Temperature Range (°C)
            </h4>
            <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
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
              text={editingCondition ? 'Update' : 'Create'}
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

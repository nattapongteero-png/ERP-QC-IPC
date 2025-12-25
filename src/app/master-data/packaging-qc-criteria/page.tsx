'use client';

/**
 * Packaging QC Criteria Master Data Page
 * Manages packaging quality control criteria for GMP compliance.
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
import { SwitchTypes } from 'devextreme-react/switch';
import { useToast } from '@/hooks/use-toast';
import { Scale, Package } from 'lucide-react';

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

export default function PackagingQCCriteriaPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingCriteria, setEditingCriteria] = useState<PackagingQCCriteria | null>(null);
  const [formData, setFormData] = useState<Partial<PackagingQCCriteria>>({
    weightMin: 30,
    weightMax: 33,
    sampleSize: 20,
    maxFailures: 2,
    checkIntervalMinutes: 30,
    unitsPerPack: 12,
    isActive: true,
  });

  // Fetch criteria
  const { data: criteria, isLoading } = useQuery<PackagingQCCriteria[]>({
    queryKey: ['packaging-qc-criteria'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/packaging-qc-criteria');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<PackagingQCCriteria>) => {
      const url = editingCriteria
        ? `/api/master-data/packaging-qc-criteria?id=${editingCriteria.id}`
        : '/api/master-data/packaging-qc-criteria';
      const method = editingCriteria ? 'PUT' : 'POST';

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
      queryClient.invalidateQueries({ queryKey: ['packaging-qc-criteria'] });
      toast.success(
        editingCriteria ? 'Criteria Updated' : 'Criteria Created',
        `${formData.name} has been ${editingCriteria ? 'updated' : 'created'} successfully.`
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
      const res = await fetch(`/api/master-data/packaging-qc-criteria?id=${id}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging-qc-criteria'] });
      toast.success('Criteria Deactivated', 'The packaging QC criteria has been deactivated.');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const handleOpenForm = (crit?: PackagingQCCriteria) => {
    if (crit) {
      setEditingCriteria(crit);
      setFormData(crit);
    } else {
      setEditingCriteria(null);
      setFormData({
        weightMin: 30,
        weightMax: 33,
        sampleSize: 20,
        maxFailures: 2,
        checkIntervalMinutes: 30,
        unitsPerPack: 12,
        isActive: true,
      });
    }
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingCriteria(null);
    setFormData({
      weightMin: 30,
      weightMax: 33,
      sampleSize: 20,
      maxFailures: 2,
      checkIntervalMinutes: 30,
      unitsPerPack: 12,
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

  const renderWeightRange = (data: PackagingQCCriteria) => {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <Scale className="h-3 w-3" />
        {data.weightMin}-{data.weightMax}g
      </span>
    );
  };

  const renderSampleCriteria = (data: PackagingQCCriteria) => {
    return (
      <span className="text-gray-600">
        ≤{data.maxFailures}/{data.sampleSize} fail
      </span>
    );
  };

  const renderPackInfo = (data: PackagingQCCriteria) => {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <Package className="h-3 w-3" />
        {data.unitsPerPack}/pack
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      {/* Header */}
      <ResponsivePageHeader
        title="Packaging QC Criteria"
        subtitle="Manage packaging quality control criteria for weight and integrity checks"
        icon={Scale}
        iconBgColor="bg-indigo-100"
        iconColor="text-indigo-600"
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'Packaging QC Criteria' },
        ]}
        actions={
          <DxButton
            text="Add Criteria"
            icon="plus"
            type="success"
            onClick={() => handleOpenForm()}
          />
        }
      />

      {/* Data Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <DxDataGrid
          dataSource={criteria || []}
          keyExpr="id"
          showBorders={false}
          rowAlternationEnabled
          loading={isLoading}
          height={500}
          width="100%"
          columnAutoWidth
        >
          <DxSearchPanel visible placeholder="Search criteria..." width={200} />
          <DxPaging defaultPageSize={15} />

          <DxColumn dataField="code" caption="Code" width={120} cellRender={(cell) => (
            <span className="font-mono font-medium text-indigo-700">{cell.value}</span>
          )} />
          <DxColumn dataField="name" caption="Criteria Name" minWidth={200} />
          <DxColumn caption="Weight Range" width={140} cellRender={(cell) => renderWeightRange(cell.data)} />
          <DxColumn caption="Sample Criteria" width={140} cellRender={(cell) => renderSampleCriteria(cell.data)} />
          <DxColumn dataField="checkIntervalMinutes" caption="Check Interval" width={130} cellRender={(cell) => (
            <span className="text-gray-600">Every {cell.value} min</span>
          )} />
          <DxColumn caption="Units/Pack" width={120} cellRender={(cell) => renderPackInfo(cell.data)} />
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
        title={editingCriteria ? 'Edit Packaging QC Criteria' : 'Add Packaging QC Criteria'}
        width={600}
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

          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Weight Control (grams)
            </h4>
            <div className="grid grid-cols-2 gap-4">
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

          <div className="bg-amber-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-amber-800 mb-3">Sampling Criteria</h4>
            <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Units Per Pack</label>
              <DxNumberBox
                value={formData.unitsPerPack}
                onValueChanged={(e) => setFormData({ ...formData, unitsPerPack: e.value })}
                min={1}
                max={100}
                showSpinButtons
              />
            </div>
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
              text={editingCriteria ? 'Update' : 'Create'}
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

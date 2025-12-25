'use client';

/**
 * SOP Templates Master Data Page
 * Manages SOP step templates for production processes.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxSwitch } from '@/components/ui/dx-switch';
import { SwitchTypes } from 'devextreme-react/switch';
import { useToast } from '@/hooks/use-toast';
import { FileText, ClipboardList } from 'lucide-react';

interface SOPTemplate {
  id: number;
  code: string;
  name: string;
  nameTh: string;
  category: string;
  instructions?: string;
  instructionsTh?: string;
  defaultParameters?: string;
  isActive: boolean;
}

const categories = [
  { value: 'preparation', label: 'Preparation' },
  { value: 'weighing', label: 'Weighing' },
  { value: 'mixing', label: 'Mixing' },
  { value: 'heating', label: 'Heating' },
  { value: 'cooling', label: 'Cooling' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' },
];

const categoryColors: Record<string, { bg: string; text: string }> = {
  preparation: { bg: 'bg-amber-100', text: 'text-amber-800' },
  weighing: { bg: 'bg-blue-100', text: 'text-blue-800' },
  mixing: { bg: 'bg-purple-100', text: 'text-purple-800' },
  heating: { bg: 'bg-red-100', text: 'text-red-800' },
  cooling: { bg: 'bg-cyan-100', text: 'text-cyan-800' },
  packaging: { bg: 'bg-green-100', text: 'text-green-800' },
  cleaning: { bg: 'bg-teal-100', text: 'text-teal-800' },
  inspection: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
  other: { bg: 'bg-gray-100', text: 'text-gray-800' },
};

export default function SOPTemplatesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SOPTemplate | null>(null);
  const [formData, setFormData] = useState<Partial<SOPTemplate>>({
    isActive: true,
  });

  // Fetch templates
  const { data: templates, isLoading } = useQuery<SOPTemplate[]>({
    queryKey: ['sop-templates'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/sop-templates');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<SOPTemplate>) => {
      const url = editingTemplate
        ? `/api/master-data/sop-templates?id=${editingTemplate.id}`
        : '/api/master-data/sop-templates';
      const method = editingTemplate ? 'PUT' : 'POST';

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
      queryClient.invalidateQueries({ queryKey: ['sop-templates'] });
      toast.success(
        editingTemplate ? 'Template Updated' : 'Template Created',
        `${formData.name} has been ${editingTemplate ? 'updated' : 'created'} successfully.`
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
      const res = await fetch(`/api/master-data/sop-templates?id=${id}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sop-templates'] });
      toast.success('Template Deactivated', 'The SOP template has been deactivated.');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const handleOpenForm = (template?: SOPTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData(template);
    } else {
      setEditingTemplate(null);
      setFormData({ isActive: true });
    }
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingTemplate(null);
    setFormData({ isActive: true });
  };

  const handleSave = () => {
    if (!formData.code || !formData.name || !formData.nameTh || !formData.category) {
      toast.error('Validation Error', 'Please fill in all required fields.');
      return;
    }
    saveMutation.mutate(formData);
  };

  const renderCategoryBadge = (category: string) => {
    const colors = categoryColors[category] || categoryColors.other;
    const label = categories.find((c) => c.value === category)?.label || category;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
        <ClipboardList className="h-3 w-3" />
        {label}
      </span>
    );
  };

  const parseParameters = (params?: string) => {
    if (!params) return null;
    try {
      const parsed = JSON.parse(params);
      return Object.entries(parsed)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    } catch {
      return params;
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      {/* Header */}
      <ResponsivePageHeader
        title="SOP Templates"
        subtitle="Manage SOP step templates for production processes"
        icon={FileText}
        iconBgColor="bg-amber-100"
        iconColor="text-amber-600"
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'SOP Templates' },
        ]}
        actions={
          <DxButton
            text="Add Template"
            icon="plus"
            type="success"
            onClick={() => handleOpenForm()}
          />
        }
      />

      {/* Data Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <DxDataGrid
          dataSource={templates || []}
          keyExpr="id"
          showBorders={false}
          rowAlternationEnabled
          loading={isLoading}
          height={500}
          width="100%"
          columnAutoWidth
        >
          <DxSearchPanel visible placeholder="Search templates..." width={200} />
          <DxPaging defaultPageSize={15} />

          <DxColumn dataField="code" caption="Code" width={120} cellRender={(cell) => (
            <span className="font-mono font-medium text-amber-700">{cell.value}</span>
          )} />
          <DxColumn dataField="name" caption="Name (EN)" minWidth={150} />
          <DxColumn dataField="nameTh" caption="Name (TH)" minWidth={150} />
          <DxColumn dataField="category" caption="Category" width={130} cellRender={(cell) => renderCategoryBadge(cell.value)} />
          <DxColumn dataField="defaultParameters" caption="Default Parameters" minWidth={200} cellRender={(cell) => (
            <span className="text-gray-600 text-sm">{parseParameters(cell.value) || '-'}</span>
          )} />
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
        title={editingTemplate ? 'Edit SOP Template' : 'Add SOP Template'}
        width={650}
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
                placeholder="e.g., SOP-MIX-01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <DxSelectBox
                dataSource={categories}
                displayExpr="label"
                valueExpr="value"
                value={formData.category}
                onValueChanged={(e) => setFormData({ ...formData, category: e.value })}
                placeholder="Select category"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name (EN) *</label>
            <DxTextBox
              value={formData.name || ''}
              onValueChanged={(e) => setFormData({ ...formData, name: e.value })}
              placeholder="Step name in English"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name (TH) *</label>
            <DxTextBox
              value={formData.nameTh || ''}
              onValueChanged={(e) => setFormData({ ...formData, nameTh: e.value })}
              placeholder="Step name in Thai"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instructions (EN)</label>
            <DxTextArea
              value={formData.instructions || ''}
              onValueChanged={(e) => setFormData({ ...formData, instructions: e.value })}
              placeholder="Detailed instructions in English"
              height={80}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instructions (TH)</label>
            <DxTextArea
              value={formData.instructionsTh || ''}
              onValueChanged={(e) => setFormData({ ...formData, instructionsTh: e.value })}
              placeholder="Detailed instructions in Thai"
              height={80}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Parameters (JSON)</label>
            <DxTextArea
              value={formData.defaultParameters || ''}
              onValueChanged={(e) => setFormData({ ...formData, defaultParameters: e.value })}
              placeholder='e.g., {"temperature": 75, "mixingSpeed": 45, "duration": 5}'
              height={60}
            />
            <p className="text-xs text-gray-500 mt-1">Enter JSON object with default parameter values</p>
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
              text={editingTemplate ? 'Update' : 'Create'}
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

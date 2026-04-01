'use client';

/**
 * SOP Template Form Component
 * Reusable form for creating and editing SOP templates
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxSwitch } from '@/components/ui/dx-switch';
import { SwitchTypes } from 'devextreme-react/switch';
import { useToast } from '@/hooks/use-toast';
import { FileText } from 'lucide-react';
import { SOPTemplateStepsEditor } from './SOPTemplateStepsEditor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

interface SOPTemplateFormProps {
  mode: 'create' | 'edit';
  id?: number;
}

const categories = [
  { value: 'line_clearance', label: 'Line Clearance (การเคลียร์สายผลิต)' },
  { value: 'dispensing', label: 'Dispensing (การเบิกจ่าย/ชั่ง)' },
  { value: 'preparation', label: 'Preparation (การเตรียม)' },
  { value: 'milling', label: 'Milling / Grinding (การบด)' },
  { value: 'sieving', label: 'Sieving (การแร่ง)' },
  { value: 'drying', label: 'Drying (การอบแห้ง)' },
  { value: 'blending', label: 'Blending / Mixing (การผสม)' },
  { value: 'mixing', label: 'Mixing (การผสม)' },
  { value: 'heating', label: 'Heating (การให้ความร้อน)' },
  { value: 'cooling', label: 'Cooling (การทำให้เย็น)' },
  { value: 'filling', label: 'Filling (การบรรจุ)' },
  { value: 'packaging', label: 'Packaging (การบรรจุภัณฑ์)' },
  { value: 'ipc', label: 'In-Process Control (IPC)' },
  { value: 'weighing', label: 'Weighing (การชั่ง)' },
  { value: 'cleaning', label: 'Cleaning (การทำความสะอาด)' },
  { value: 'inspection', label: 'Inspection (การตรวจสอบ)' },
  { value: 'other', label: 'Other (อื่นๆ)' },
];

export function SOPTemplateForm({ mode, id }: SOPTemplateFormProps) {
  // Fetch existing template for edit mode
  const { data: existingTemplate, isLoading: isLoadingTemplate } = useQuery<SOPTemplate>({
    queryKey: ['sop-template', id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/sop-templates?id=${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    enabled: mode === 'edit' && !!id,
  });

  // Block render until data is loaded — then mount inner form with key to ensure
  // DevExtreme TextBox gets correct initial values (it doesn't re-render from '' → value)
  if (mode === 'edit' && (isLoadingTemplate || !existingTemplate)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const initialData: Partial<SOPTemplate> = existingTemplate
    ? {
        code: existingTemplate.code || '',
        name: existingTemplate.name || '',
        nameTh: existingTemplate.nameTh || '',
        category: existingTemplate.category || '',
        instructions: existingTemplate.instructions || '',
        instructionsTh: existingTemplate.instructionsTh || '',
        defaultParameters: existingTemplate.defaultParameters || '',
        isActive: existingTemplate.isActive ?? true,
      }
    : { code: '', name: '', nameTh: '', category: '', instructions: '', instructionsTh: '', defaultParameters: '', isActive: true };

  return <SOPTemplateFormInner key={id || 'new'} mode={mode} id={id} initialData={initialData} existingTemplate={existingTemplate} />;
}

function SOPTemplateFormInner({ mode, id, initialData, existingTemplate }: SOPTemplateFormProps & { initialData: Partial<SOPTemplate>; existingTemplate?: SOPTemplate | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [formData, setFormData] = React.useState<Partial<SOPTemplate>>(initialData);

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<SOPTemplate>) => {
      const url = '/api/master-data/sop-templates';
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
      queryClient.invalidateQueries({ queryKey: ['sop-templates'] });
      toast.success(
        mode === 'edit' ? 'Template Updated' : 'Template Created',
        `${formData.name} has been ${mode === 'edit' ? 'updated' : 'created'} successfully.`
      );
      router.push('/master-data/sop-templates');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const handleSave = () => {
    if (!formData.code || !formData.name || !formData.nameTh || !formData.category) {
      toast.error('Validation Error', 'Please fill in all required fields.');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleCancel = () => {
    router.push('/master-data/sop-templates');
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-4xl mx-auto">
      {/* Header */}
      <ResponsivePageHeader
        title={mode === 'edit' ? 'Edit SOP Template' : 'New SOP Template'}
        subtitle={mode === 'edit' ? `Editing ${existingTemplate?.name || ''}` : 'Create a new SOP step template'}
        icon={FileText}
        iconBgColor="bg-amber-100"
        iconColor="text-amber-600"
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'SOP Templates', href: '/master-data/sop-templates' },
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
            <FileText className="h-5 w-5 text-amber-600" />
            Template Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              height={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instructions (TH)</label>
            <DxTextArea
              value={formData.instructionsTh || ''}
              onValueChanged={(e) => setFormData({ ...formData, instructionsTh: e.value })}
              placeholder="Detailed instructions in Thai"
              height={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Parameters (JSON)</label>
            <DxTextArea
              value={formData.defaultParameters || ''}
              onValueChanged={(e) => setFormData({ ...formData, defaultParameters: e.value })}
              placeholder='e.g., {"temperature": 75, "mixingSpeed": 45, "duration": 5}'
              height={80}
            />
            <p className="text-xs text-gray-500 mt-1">Enter JSON object with default parameter values</p>
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

      {/* Procedure Steps - only in edit mode */}
      {mode === 'edit' && id && (
        <SOPTemplateStepsEditor templateId={id} />
      )}

      {/* Bottom Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <DxButton
          text="Cancel"
          stylingMode="outlined"
          onClick={handleCancel}
        />
        <DxButton
          text={saveMutation.isPending ? 'Saving...' : (mode === 'edit' ? 'Update Template' : 'Create Template')}
          type="success"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        />
      </div>
    </div>
  );
}

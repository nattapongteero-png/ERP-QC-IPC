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
import { DxSwitch } from '@/components/ui/dx-switch';
import { SwitchTypes } from 'devextreme-react/switch';
import { useToast } from '@/hooks/use-toast';
import { FileText, CheckCircle2 } from 'lucide-react';
import { SOPTemplateStepsEditor } from './SOPTemplateStepsEditor';
import { SOPTemplateStepsInline, type LocalStep } from './SOPTemplateStepsInline';
import { GmpDocumentSelect } from '@/components/documents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SOPTemplate {
  id: number;
  code: string;
  name: string;
  nameTh: string;
  category: string;
  defaultParameters?: string;
  // Template-level GMP document link (soft ref to documents.id). Shown at the
  // step header on the WO SOP execution screen.
  gmpDocumentId?: number | null;
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
        defaultParameters: existingTemplate.defaultParameters || '',
        gmpDocumentId: existingTemplate.gmpDocumentId ?? null,
        isActive: existingTemplate.isActive ?? true,
      }
    : { code: '', name: '', nameTh: '', category: '', defaultParameters: '', gmpDocumentId: null, isActive: true };

  return <SOPTemplateFormInner key={id || 'new'} mode={mode} id={id} initialData={initialData} existingTemplate={existingTemplate} />;
}

function SOPTemplateFormInner({ mode, id, initialData, existingTemplate }: SOPTemplateFormProps & { initialData: Partial<SOPTemplate>; existingTemplate?: SOPTemplate | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [formData, setFormData] = React.useState<Partial<SOPTemplate>>(initialData);
  // Pending steps for create mode — persisted once the template is POSTed.
  const [pendingSteps, setPendingSteps] = React.useState<LocalStep[]>([]);

  // Create/Update mutation
  // Create mode: persist template first, then POST each pending step in
  // sequence so the user's local drafts land in the DB with the right
  // sequence numbers. If any step POST fails we surface the error but
  // keep the template — the user can finish adding steps on the edit
  // page.
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

      const template = result.data;

      if (mode === 'create' && template?.id && pendingSteps.length > 0) {
        for (let i = 0; i < pendingSteps.length; i++) {
          const step = pendingSteps[i];
          const stepRes = await fetch(
            `/api/master-data/sop-templates/${template.id}/steps`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...step, sequence: i + 1 }),
            },
          );
          const stepResult = await stepRes.json();
          if (!stepResult.success) {
            throw new Error(`บันทึก Step ${i + 1} ล้มเหลว: ${stepResult.error}`);
          }
        }
      }

      return template;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sop-templates'] });
      const stepsNote = mode === 'create' && pendingSteps.length > 0
        ? ` พร้อม ${pendingSteps.length} Steps`
        : '';
      toast.success(
        mode === 'edit' ? 'Template Updated' : 'Template Created',
        `${formData.name || formData.nameTh} ${mode === 'edit' ? 'ถูกอัปเดตแล้ว' : 'ถูกสร้างแล้ว' + stepsNote}`,
      );
      // Create mode: go to edit page so the user can keep adding/adjusting
      // steps. Edit mode: back to list.
      if (mode === 'create' && data?.id) {
        router.push(`/master-data/sop-templates/${data.id}`);
      } else {
        router.push('/master-data/sop-templates');
      }
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const handleSave = () => {
    if (!formData.code || !formData.nameTh || !formData.category) {
      toast.error('Validation Error', 'กรุณากรอก Code, ชื่อ (TH), และ Category');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleCancel = () => {
    router.push('/master-data/sop-templates');
  };

  const isCreate = mode === 'create';

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-4xl mx-auto">
      {/* Header — keep it minimal (no save button duplicated here) */}
      <ResponsivePageHeader
        title={isCreate ? 'New SOP Template' : 'Edit SOP Template'}
        subtitle={isCreate ? 'สร้าง SOP Template ใหม่ — เพิ่ม Step หลังบันทึก' : `กำลังแก้ไข: ${existingTemplate?.name || existingTemplate?.nameTh || ''}`}
        icon={FileText}
        iconBgColor="bg-amber-100"
        iconColor="text-amber-600"
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'SOP Templates', href: '/master-data/sop-templates' },
          { label: isCreate ? 'New' : 'Edit' },
        ]}
        actions={
          <DxButton
            text="Back"
            icon="back"
            stylingMode="outlined"
            onClick={handleCancel}
          />
        }
      />

      {/* Template Information + Procedure Steps in a single card for create
          mode so the user doesn't feel like they're filling two disconnected
          forms. Edit mode keeps the legacy two-card layout (second card uses
          the persistent SOPTemplateStepsEditor that reads from API). */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-600" />
            Template Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code <span className="text-red-500">*</span>
              </label>
              <DxTextBox
                value={formData.code || ''}
                onValueChanged={(e) => setFormData({ ...formData, code: e.value })}
                placeholder="เช่น SOP-MIX-01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <DxSelectBox
                dataSource={categories}
                displayExpr="label"
                valueExpr="value"
                value={formData.category}
                onValueChanged={(e) => setFormData({ ...formData, category: e.value })}
                placeholder="เลือกหมวดหมู่"
                searchEnabled
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ชื่อ (TH) <span className="text-red-500">*</span>
            </label>
            <DxTextBox
              value={formData.nameTh || ''}
              onValueChanged={(e) => setFormData({ ...formData, nameTh: e.value })}
              placeholder="ชื่อ SOP Template ภาษาไทย"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name (EN)</label>
            <DxTextBox
              value={formData.name || ''}
              onValueChanged={(e) => setFormData({ ...formData, name: e.value })}
              placeholder="SOP Template name in English (optional)"
            />
          </div>

          {/* Template-level GMP document — distinct from per-step and per-IPC
              links. Surfaces at the step header on the WO SOP execution screen. */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-gray-500" /> เอกสาร GMP ที่ผูกกับ SOP Template
            </label>
            <GmpDocumentSelect
              value={formData.gmpDocumentId ?? null}
              onValueChange={(docId) => setFormData({ ...formData, gmpDocumentId: docId })}
            />
            <p className="text-xs text-gray-500 mt-1">
              จะแสดงชื่อ + ปุ่มดูเอกสารที่หัวขั้นตอน (SOP execution) ของ Work Order — ใช้กับทั้ง Template
            </p>
          </div>

          <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`h-5 w-5 ${formData.isActive !== false ? 'text-green-600' : 'text-gray-400'}`} />
              <div>
                <div className="text-sm font-medium text-gray-700">สถานะใช้งาน</div>
                <div className="text-xs text-gray-500">
                  {formData.isActive !== false ? 'Template นี้พร้อมใช้ในการผลิต' : 'Template นี้ถูกปิดใช้งาน'}
                </div>
              </div>
            </div>
            <DxSwitch
              value={formData.isActive !== false}
              onValueChanged={(e: SwitchTypes.ValueChangedEvent) => setFormData({ ...formData, isActive: e.value })}
            />
          </div>

          {/* Inline Procedure Steps — only in create mode. Steps buffer in
              local state and are persisted alongside the template at save. */}
          {isCreate && (
            <div className="pt-4 border-t border-gray-200">
              <SOPTemplateStepsInline steps={pendingSteps} onStepsChange={setPendingSteps} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit mode uses the API-backed editor in its own card (unchanged). */}
      {!isCreate && id && (
        <SOPTemplateStepsEditor templateId={id} />
      )}

      {/* Bottom Actions — stack on mobile, inline on tablet+ */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-gray-200">
        <DxButton
          text="Cancel"
          stylingMode="outlined"
          onClick={handleCancel}
          width="100%"
          elementAttr={{ class: 'sm:!w-auto' }}
        />
        <DxButton
          text={
            saveMutation.isPending
              ? 'กำลังบันทึก…'
              : isCreate
                ? pendingSteps.length > 0
                  ? `Save Template + ${pendingSteps.length} Steps`
                  : 'Save Template'
                : 'Update Template'
          }
          icon="save"
          type="success"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          width="100%"
          elementAttr={{ class: 'sm:!w-auto' }}
        />
      </div>
    </div>
  );
}

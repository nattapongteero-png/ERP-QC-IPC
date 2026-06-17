'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListOrdered, Plus, ChevronUp, ChevronDown, Pencil, Trash2, FileText } from 'lucide-react';
import { GmpDocumentSelect } from '@/components/documents';

interface SOPTemplateStep {
  id: number;
  templateId: number;
  sequence: number;
  stepName: string;
  stepNameTh: string | null;
  instructions: string | null;
  instructionsTh: string | null;
  defaultParameters: string | null;
  gmpDocumentId: number | null;
}

interface StepFormData {
  stepName: string;
  stepNameTh: string;
  instructions: string;
  instructionsTh: string;
  defaultParameters: string;
  gmpDocumentId: number | null;
}

const emptyForm: StepFormData = {
  stepName: '',
  stepNameTh: '',
  instructions: '',
  instructionsTh: '',
  defaultParameters: '',
  gmpDocumentId: null,
};

interface Props {
  templateId: number;
}

export function SOPTemplateStepsEditor({ templateId }: Props) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const queryKey = ['sop-template-steps', templateId];

  const [isAdding, setIsAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [formData, setFormData] = React.useState<StepFormData>(emptyForm);

  const { data: steps = [], isLoading } = useQuery<SOPTemplateStep[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/master-data/sop-templates/${templateId}/steps`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: StepFormData) => {
      const res = await fetch(`/api/master-data/sop-templates/${templateId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          sequence: steps.length + 1,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setIsAdding(false);
      setFormData(emptyForm);
      toast.success('เพิ่มขั้นตอนแล้ว', 'เพิ่มขั้นตอนการปฏิบัติงานเรียบร้อยแล้ว');
    },
    onError: (err: Error) => toast.error('เกิดข้อผิดพลาด', err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ stepId, data }: { stepId: number; data: StepFormData }) => {
      const res = await fetch(`/api/master-data/sop-templates/${templateId}/steps`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId, ...data }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setEditingId(null);
      setFormData(emptyForm);
      toast.success('แก้ไขขั้นตอนแล้ว', 'แก้ไขขั้นตอนการปฏิบัติงานเรียบร้อยแล้ว');
    },
    onError: (err: Error) => toast.error('เกิดข้อผิดพลาด', err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (stepId: number) => {
      const res = await fetch(
        `/api/master-data/sop-templates/${templateId}/steps?stepId=${stepId}`,
        { method: 'DELETE' }
      );
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('ลบขั้นตอนแล้ว', 'ลบขั้นตอนการปฏิบัติงานเรียบร้อยแล้ว');
    },
    onError: (err: Error) => toast.error('เกิดข้อผิดพลาด', err.message),
  });

  const reorderMutation = useMutation({
    mutationFn: async (stepIds: number[]) => {
      const res = await fetch(`/api/master-data/sop-templates/${templateId}/steps`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepIds }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const ids = steps.map((s) => s.id);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    reorderMutation.mutate(ids);
  };

  const handleMoveDown = (index: number) => {
    if (index >= steps.length - 1) return;
    const ids = steps.map((s) => s.id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    reorderMutation.mutate(ids);
  };

  const startEdit = (step: SOPTemplateStep) => {
    setEditingId(step.id);
    setIsAdding(false);
    setFormData({
      stepName: step.stepName,
      stepNameTh: step.stepNameTh || '',
      instructions: step.instructions || '',
      instructionsTh: step.instructionsTh || '',
      defaultParameters: step.defaultParameters || '',
      gmpDocumentId: step.gmpDocumentId ?? null,
    });
  };

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const cancelForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleSave = () => {
    if (!formData.stepNameTh.trim()) {
      toast.error('Validation', 'กรุณากรอกชื่อขั้นตอน (TH)');
      return;
    }
    if (editingId) {
      updateMutation.mutate({ stepId: editingId, data: formData });
    } else {
      addMutation.mutate(formData);
    }
  };

  const isSaving = addMutation.isPending || updateMutation.isPending;

  const renderForm = () => (
    <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อขั้นตอน (TH) *</label>
          <DxTextBox
            value={formData.stepNameTh}
            onValueChanged={(e) => setFormData({ ...formData, stepNameTh: e.value })}
            placeholder="เช่น การเตรียมการก่อนการผลิต"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อขั้นตอน (EN)</label>
          <DxTextBox
            value={formData.stepName}
            onValueChanged={(e) => setFormData({ ...formData, stepName: e.value })}
            placeholder="เช่น Line Clearance"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">คำแนะนำ (TH)</label>
        <DxTextArea
          value={formData.instructionsTh}
          onValueChanged={(e) => setFormData({ ...formData, instructionsTh: e.value })}
          placeholder="คำแนะนำขั้นตอนโดยละเอียดเป็นภาษาไทย"
          height={80}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">คำแนะนำ (EN)</label>
        <DxTextArea
          value={formData.instructions}
          onValueChanged={(e) => setFormData({ ...formData, instructions: e.value })}
          placeholder="คำแนะนำเป็นภาษาอังกฤษ"
          height={80}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-gray-500" /> เอกสาร GMP ที่เกี่ยวข้อง
        </label>
        <GmpDocumentSelect
          value={formData.gmpDocumentId}
          onValueChange={(docId) => setFormData({ ...formData, gmpDocumentId: docId })}
        />
        <p className="text-xs text-gray-500 mt-1">
          จะแสดงชื่อ + ปุ่มดูเอกสารในหน้าบันทึกขั้นตอน (SOP execution) ของ Work Order
        </p>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <DxButton text="ยกเลิก" icon="close" stylingMode="text" onClick={cancelForm} disabled={isSaving} />
        <DxButton
          text={isSaving ? 'กำลังบันทึก...' : editingId ? 'บันทึกขั้นตอน' : 'เพิ่มขั้นตอน'}
          icon="save"
          type="success"
          onClick={handleSave}
          disabled={isSaving}
        />
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5 text-emerald-600" />
            ขั้นตอนการปฏิบัติงาน ({steps.length})
          </CardTitle>
          {!isAdding && !editingId && (
            <button
              onClick={startAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
            >
              <Plus className="h-4 w-4" />
              เพิ่มขั้นตอน
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <div className="text-center py-8 text-gray-400">กำลังโหลดขั้นตอน...</div>
        )}

        {!isLoading && steps.length === 0 && !isAdding && (
          <div className="text-center py-8">
            <ListOrdered className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">ยังไม่ได้กำหนดขั้นตอนการปฏิบัติงาน</p>
            <p className="text-xs text-gray-400 mt-1">กด &quot;เพิ่มขั้นตอน&quot; เพื่อกำหนดขั้นตอนแรก</p>
          </div>
        )}

        {steps.map((step, index) => (
          <div key={step.id}>
            {editingId === step.id ? (
              renderForm()
            ) : (
              <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:border-emerald-200 transition-colors group">
                {/* Sequence badge */}
                <div className="flex-none w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center mt-0.5">
                  {index + 1}
                </div>

                {/* Content — show TH as primary */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">{step.stepNameTh || step.stepName}</div>
                  {step.stepName && step.stepNameTh && (
                    <div className="text-sm text-gray-500">{step.stepName}</div>
                  )}
                  {step.instructionsTh && (
                    <div className="text-xs text-gray-400 mt-1 line-clamp-2">{step.instructionsTh}</div>
                  )}
                  {step.instructions && !step.instructionsTh && (
                    <div className="text-xs text-gray-400 mt-1 line-clamp-2">{step.instructions}</div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex-none flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0 || reorderMutation.isPending}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="เลื่อนขึ้น"
                  >
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index >= steps.length - 1 || reorderMutation.isPending}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="เลื่อนลง"
                  >
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => startEdit(step)}
                    className="p-1 rounded hover:bg-blue-50"
                    title="แก้ไข"
                  >
                    <Pencil className="h-4 w-4 text-blue-500" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('ลบขั้นตอนนี้?')) deleteMutation.mutate(step.id);
                    }}
                    disabled={deleteMutation.isPending}
                    className="p-1 rounded hover:bg-red-50"
                    title="ลบ"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                </div>
              </div>
            )}
            {/* IPC linker removed (Phase 14): IPC criteria are now configured
                at the BOM level (BOM Configuration → SOP Steps → Manage IPC).
                The master template only defines the procedure/steps now. */}
          </div>
        ))}

        {isAdding && renderForm()}
      </CardContent>
    </Card>
  );
}

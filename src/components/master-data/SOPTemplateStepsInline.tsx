'use client';

/**
 * SOP Template Steps — Inline (local state) editor
 *
 * Used on /master-data/sop-templates/new so the operator can draft
 * procedure steps BEFORE the template is persisted. Steps are held in
 * React state and handed back to the parent via onStepsChange. The
 * parent is responsible for POSTing each step after the template
 * itself is created.
 *
 * Kept intentionally similar to SOPTemplateStepsEditor in markup so
 * the two feel the same to the user, but without any fetch/mutation
 * logic — all state lives in the caller.
 */

import * as React from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { useToast } from '@/hooks/use-toast';
import { ListOrdered, Plus, ChevronUp, ChevronDown, Pencil, Trash2, FileText } from 'lucide-react';
import { GmpDocumentSelect } from '@/components/documents';

export interface LocalStep {
  stepName: string;
  stepNameTh: string;
  instructions: string;
  instructionsTh: string;
  defaultParameters: string;
  gmpDocumentId: number | null;
}

const emptyForm: LocalStep = {
  stepName: '',
  stepNameTh: '',
  instructions: '',
  instructionsTh: '',
  defaultParameters: '',
  gmpDocumentId: null,
};

interface Props {
  steps: LocalStep[];
  onStepsChange: (steps: LocalStep[]) => void;
}

export function SOPTemplateStepsInline({ steps, onStepsChange }: Props) {
  const toast = useToast();
  const [isAdding, setIsAdding] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [formData, setFormData] = React.useState<LocalStep>(emptyForm);

  const startAdd = () => {
    setIsAdding(true);
    setEditingIndex(null);
    setFormData(emptyForm);
  };

  const startEdit = (index: number) => {
    setIsAdding(false);
    setEditingIndex(index);
    setFormData({ ...steps[index] });
  };

  const cancelForm = () => {
    setIsAdding(false);
    setEditingIndex(null);
    setFormData(emptyForm);
  };

  const handleSave = () => {
    if (!formData.stepNameTh.trim()) {
      toast.error('Validation', 'กรุณากรอกชื่อขั้นตอน (TH)');
      return;
    }
    if (editingIndex !== null) {
      const next = [...steps];
      next[editingIndex] = formData;
      onStepsChange(next);
    } else {
      onStepsChange([...steps, formData]);
    }
    cancelForm();
  };

  const handleDelete = (index: number) => {
    if (!confirm('ลบขั้นตอนนี้?')) return;
    onStepsChange(steps.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const next = [...steps];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onStepsChange(next);
  };

  const handleMoveDown = (index: number) => {
    if (index >= steps.length - 1) return;
    const next = [...steps];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onStepsChange(next);
  };

  const renderForm = () => (
    <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ชื่อขั้นตอน (TH) <span className="text-red-500">*</span>
          </label>
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
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <DxButton text="ยกเลิก" icon="close" stylingMode="text" onClick={cancelForm} />
        <DxButton
          text={editingIndex !== null ? 'บันทึกขั้นตอน' : 'เพิ่มขั้นตอน'}
          icon="save"
          type="success"
          onClick={handleSave}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-gray-800">
          <ListOrdered className="h-5 w-5 text-emerald-600" />
          ขั้นตอนการปฏิบัติงาน ({steps.length})
        </h3>
        {!isAdding && editingIndex === null && (
          <button
            type="button"
            onClick={startAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
          >
            <Plus className="h-4 w-4" />
            เพิ่มขั้นตอน
          </button>
        )}
      </div>

      {steps.length === 0 && !isAdding && (
        <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
          <ListOrdered className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">ยังไม่มีขั้นตอน</p>
          <p className="text-xs text-gray-400 mt-1">กด &quot;เพิ่มขั้นตอน&quot; เพื่อเพิ่มขั้นตอนแรก — จะถูกบันทึกพร้อม template ตอนกด Save</p>
        </div>
      )}

      {steps.map((step, index) => (
        <div key={index}>
          {editingIndex === index ? (
            renderForm()
          ) : (
            <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:border-emerald-200 transition-colors group">
              <div className="flex-none w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center mt-0.5">
                {index + 1}
              </div>
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
              <div className="flex-none flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="เลื่อนขึ้น"
                >
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveDown(index)}
                  disabled={index >= steps.length - 1}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="เลื่อนลง"
                >
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(index)}
                  className="p-1 rounded hover:bg-blue-50"
                  title="แก้ไข"
                >
                  <Pencil className="h-4 w-4 text-blue-500" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(index)}
                  className="p-1 rounded hover:bg-red-50"
                  title="ลบ"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {isAdding && renderForm()}
    </div>
  );
}

'use client';

/**
 * CAPA Form Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * Form for creating and editing CAPAs.
 */

import { useState } from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import type { Capa, CapaCreate, CapaSourceType, CapaType, CapaPriority } from '@/types/capa';
import { toLocalDateStr } from '@/lib/utils/date-format';

// ============================================
// Types
// ============================================

interface CapaFormProps {
  capa?: Capa | null;
  deviationId?: number;
  deviationNumber?: string;
  onSave?: (capa: Capa) => void;
  onCancel?: () => void;
}

interface FormData {
  title: string;
  sourceType: CapaSourceType;
  sourceId: number | null;
  type: CapaType;
  priority: CapaPriority;
  ownerId: number | null;
  dueDate: string;
  rootCauseAnalysis: string;
  rootCauseCategory: string;
}

// ============================================
// API Functions
// ============================================

async function fetchUsers(): Promise<{ id: number; name: string }[]> {
  const response = await fetch('/api/users?limit=100');
  const result = await response.json();
  if (!result.success) return [];
  // API returns paginated response with items array
  const items = result.data?.items || result.data || [];
  return Array.isArray(items) ? items : [];
}

async function createCapa(data: CapaCreate): Promise<Capa> {
  const response = await fetch('/api/capa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to create CAPA');
  }
  return result.data;
}

async function createCapaFromDeviation(
  deviationId: number,
  data: Omit<CapaCreate, 'sourceType' | 'sourceId'>
): Promise<Capa> {
  const response = await fetch('/api/capa/from-deviation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviationId, ...data }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to create CAPA');
  }
  return result.data;
}

async function updateCapa(id: number, data: Partial<CapaCreate>): Promise<Capa> {
  const response = await fetch(`/api/capa/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to update CAPA');
  }
  return result.data;
}

// ============================================
// Component
// ============================================

export function CapaForm({
  capa,
  deviationId,
  deviationNumber,
  onSave,
  onCancel,
}: CapaFormProps) {
  const isEditing = !!capa;
  const isFromDeviation = !!deviationId;

  // Form state
  const [formData, setFormData] = useState<FormData>({
    title: capa?.title || (deviationNumber ? `CAPA for ${deviationNumber}` : ''),
    sourceType: capa?.sourceType || (isFromDeviation ? 'deviation' : 'other'),
    sourceId: capa?.sourceId || deviationId || null,
    type: capa?.type || 'corrective',
    priority: capa?.priority || 'medium',
    ownerId: capa?.ownerId || null,
    dueDate: capa?.dueDate || '',
    rootCauseAnalysis: capa?.rootCauseAnalysis || '',
    rootCauseCategory: capa?.rootCauseCategory || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch users for owner selection
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: () => {
      if (isFromDeviation && deviationId) {
        return createCapaFromDeviation(deviationId, {
          title: formData.title,
          type: formData.type,
          priority: formData.priority,
          ownerId: formData.ownerId!,
          dueDate: formData.dueDate,
          rootCauseAnalysis: formData.rootCauseAnalysis || undefined,
          rootCauseCategory: formData.rootCauseCategory || undefined,
        });
      }
      return createCapa({
        title: formData.title,
        sourceType: formData.sourceType,
        sourceId: formData.sourceId || undefined,
        type: formData.type,
        priority: formData.priority,
        ownerId: formData.ownerId!,
        dueDate: formData.dueDate,
        rootCauseAnalysis: formData.rootCauseAnalysis || undefined,
        rootCauseCategory: formData.rootCauseCategory || undefined,
      });
    },
    onSuccess: (data) => {
      onSave?.(data);
    },
    onError: (error) => {
      setErrors({ submit: error.message });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: Partial<CapaCreate>) => updateCapa(capa!.id, data),
    onSuccess: (data) => {
      onSave?.(data);
    },
    onError: (error) => {
      setErrors({ submit: error.message });
    },
  });

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!formData.ownerId) {
      newErrors.ownerId = 'Owner is required';
    }
    if (!formData.dueDate) {
      newErrors.dueDate = 'Due date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = () => {
    if (!validate()) return;

    if (isEditing) {
      updateMutation.mutate({
        title: formData.title,
        priority: formData.priority,
        rootCauseAnalysis: formData.rootCauseAnalysis || undefined,
        rootCauseCategory: formData.rootCauseCategory || undefined,
      });
    } else {
      createMutation.mutate();
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Source type options
  const sourceTypeOptions = [
    { value: 'deviation', label: 'Deviation' },
    { value: 'complaint', label: 'Complaint' },
    { value: 'audit_finding', label: 'Audit Finding' },
    { value: 'other', label: 'Other' },
  ];

  // CAPA type options
  const typeOptions = [
    { value: 'corrective', label: 'Corrective' },
    { value: 'preventive', label: 'Preventive' },
    { value: 'both', label: 'Both' },
  ];

  // Priority options
  const priorityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ];

  // Root cause categories (5M+E)
  const rootCauseCategoryOptions = [
    { value: 'Human Error', label: 'Human Error (Man)' },
    { value: 'Equipment Failure', label: 'Equipment Failure (Machine)' },
    { value: 'Material Defect', label: 'Material Defect (Material)' },
    { value: 'Method Issue', label: 'Method Issue (Method)' },
    { value: 'Environment Factor', label: 'Environment Factor' },
    { value: 'Measurement Error', label: 'Measurement Error' },
  ];

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {isEditing ? 'Edit CAPA' : isFromDeviation ? 'Create CAPA from Deviation' : 'New CAPA'}
        </h2>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {isFromDeviation && deviationNumber && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Creating CAPA linked to Deviation: <span className="font-mono font-medium">{deviationNumber}</span>
          </p>
        </div>
      )}

      {errors.submit && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {errors.submit}
        </div>
      )}

      <div className="space-y-4">
        {/* Title */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Title <span className="text-destructive">*</span>
          </label>
          <DxTextBox
            value={formData.title}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, title: value || '' }))}
            placeholder="Enter CAPA title"
          />
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title}</p>
          )}
        </div>

        {/* Source Type (hidden if from deviation) */}
        {!isFromDeviation && !isEditing && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Source Type</label>
            <DxSelectBox
              items={sourceTypeOptions}
              value={formData.sourceType}
              valueExpr="value"
              displayExpr="label"
              onValueChange={(value) => setFormData((prev) => ({ ...prev, sourceType: value as CapaSourceType }))}
            />
          </div>
        )}

        {/* CAPA Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            CAPA Type <span className="text-destructive">*</span>
          </label>
          <DxSelectBox
            items={typeOptions}
            value={formData.type}
            valueExpr="value"
            displayExpr="label"
            onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value as CapaType }))}
            disabled={isEditing}
          />
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Priority <span className="text-destructive">*</span>
          </label>
          <DxSelectBox
            items={priorityOptions}
            value={formData.priority}
            valueExpr="value"
            displayExpr="label"
            onValueChange={(value) => setFormData((prev) => ({ ...prev, priority: value as CapaPriority }))}
          />
        </div>

        {/* Owner */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Owner <span className="text-destructive">*</span>
          </label>
          <DxSelectBox
            items={(users || []).map((u) => ({ value: u.id, label: u.name }))}
            value={formData.ownerId}
            valueExpr="value"
            displayExpr="label"
            onValueChange={(value) => setFormData((prev) => ({ ...prev, ownerId: value }))}
            placeholder="Select owner"
            disabled={isEditing}
          />
          {errors.ownerId && (
            <p className="text-sm text-destructive">{errors.ownerId}</p>
          )}
        </div>

        {/* Due Date */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Due Date <span className="text-destructive">*</span>
          </label>
          <DxDateBox
            value={formData.dueDate || undefined}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                dueDate: value ? toLocalDateStr(new Date(value)) : '',
              }))
            }
            type="date"
            displayFormat="yyyy-MM-dd"
            disabled={isEditing}
          />
          {errors.dueDate && (
            <p className="text-sm text-destructive">{errors.dueDate}</p>
          )}
        </div>

        {/* Root Cause Category */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Root Cause Category (5M+E)</label>
          <DxSelectBox
            items={rootCauseCategoryOptions}
            value={formData.rootCauseCategory}
            valueExpr="value"
            displayExpr="label"
            onValueChange={(value) => setFormData((prev) => ({ ...prev, rootCauseCategory: value || '' }))}
            placeholder="Select category"
            showClearButton
          />
        </div>

        {/* Root Cause Analysis */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Root Cause Analysis (5-Why)</label>
          <DxTextArea
            value={formData.rootCauseAnalysis}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, rootCauseAnalysis: value || '' }))}
            placeholder="Enter root cause analysis..."
            height={120}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4">
          <DxButton
            text={isEditing ? 'Save Changes' : 'Create CAPA'}
            icon="save"
            onClick={handleSubmit}
            type="success"
            disabled={isSubmitting}
          />
          {onCancel && (
            <DxButton
              text="Cancel"
              onClick={onCancel}
              stylingMode="outlined"
              disabled={isSubmitting}
            />
          )}
        </div>
      </div>
    </div>
  );
}

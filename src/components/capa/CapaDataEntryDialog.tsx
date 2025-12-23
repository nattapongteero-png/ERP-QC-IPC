'use client';

/**
 * CAPA Data Entry Dialog Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * Reusable dialog for creating and editing CAPAs.
 * Used by both /gmp/capa/new and /gmp/capa/[id] pages.
 */

import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { AlertCircle, Link2 } from 'lucide-react';
import type { Capa, CapaCreate, CapaSourceType, CapaType, CapaPriority } from '@/types/capa';

// ============================================
// Types
// ============================================

export interface CapaDataEntryDialogProps {
  /** Whether the dialog is visible */
  visible: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Callback when CAPA is saved successfully */
  onSaved?: (capa: Capa) => void;
  /** Existing CAPA data for editing */
  capa?: Capa | null;
  /** Pre-link to deviation */
  deviationId?: number;
  deviationNumber?: string;
  /** Pre-link to complaint */
  complaintId?: number;
  complaintNumber?: string;
  /** Pre-link to audit finding */
  auditFindingId?: number;
  auditFindingNumber?: string;
  /** Dialog title override */
  title?: string;
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
// Options
// ============================================

const sourceTypeOptions = [
  { value: 'deviation', label: 'Deviation' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'audit_finding', label: 'Audit Finding' },
  { value: 'other', label: 'Other' },
];

const typeOptions = [
  { value: 'corrective', label: 'Corrective' },
  { value: 'preventive', label: 'Preventive' },
  { value: 'both', label: 'Both' },
];

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const rootCauseCategoryOptions = [
  { value: 'Human Error', label: 'Human Error (Man)' },
  { value: 'Equipment Failure', label: 'Equipment Failure (Machine)' },
  { value: 'Material Defect', label: 'Material Defect (Material)' },
  { value: 'Method Issue', label: 'Method Issue (Method)' },
  { value: 'Environment Factor', label: 'Environment Factor' },
  { value: 'Measurement Error', label: 'Measurement Error' },
];

// ============================================
// Component
// ============================================

export function CapaDataEntryDialog({
  visible,
  onClose,
  onSaved,
  capa,
  deviationId,
  deviationNumber,
  complaintId,
  complaintNumber,
  auditFindingId,
  auditFindingNumber,
  title: customTitle,
}: CapaDataEntryDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!capa;

  // Determine source linking
  const isFromDeviation = !!deviationId;
  const isFromComplaint = !!complaintId;
  const isFromAuditFinding = !!auditFindingId;
  const hasLinkedSource = isFromDeviation || isFromComplaint || isFromAuditFinding;

  // Determine source info
  const linkedSourceType: CapaSourceType = isFromDeviation
    ? 'deviation'
    : isFromComplaint
    ? 'complaint'
    : isFromAuditFinding
    ? 'audit_finding'
    : 'other';
  const linkedSourceId = deviationId || complaintId || auditFindingId || null;
  const linkedSourceNumber = deviationNumber || complaintNumber || auditFindingNumber || '';

  // Generate initial form data (memoized to use as initial state)
  const initialFormData = useMemo((): FormData => {
    if (capa) {
      return {
        title: capa.title,
        sourceType: capa.sourceType,
        sourceId: capa.sourceId,
        type: capa.type,
        priority: capa.priority,
        ownerId: capa.ownerId,
        dueDate: capa.dueDate || '',
        rootCauseAnalysis: capa.rootCauseAnalysis || '',
        rootCauseCategory: capa.rootCauseCategory || '',
      };
    }

    return {
      title: linkedSourceNumber ? `CAPA for ${linkedSourceNumber}` : '',
      sourceType: linkedSourceType,
      sourceId: linkedSourceId,
      type: 'corrective',
      priority: 'medium',
      ownerId: null,
      dueDate: '',
      rootCauseAnalysis: '',
      rootCauseCategory: '',
    };
  }, [capa, linkedSourceType, linkedSourceId, linkedSourceNumber]);

  // Form state - key prop on dialog will reset this when capa changes
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when initial data changes (dialog reopens with different data)
  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setErrors({});
  }, [initialFormData]);

  // Fetch users for owner selection
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    enabled: visible,
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
      queryClient.invalidateQueries({ queryKey: ['capas'] });
      queryClient.invalidateQueries({ queryKey: ['capa-dashboard'] });
      onSaved?.(data);
      onClose();
    },
    onError: (error) => {
      setErrors({ submit: error.message });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: Partial<CapaCreate>) => updateCapa(capa!.id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['capa', capa!.id] });
      queryClient.invalidateQueries({ queryKey: ['capas'] });
      queryClient.invalidateQueries({ queryKey: ['capa-dashboard'] });
      onSaved?.(data);
      onClose();
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
        dueDate: formData.dueDate,
        ownerId: formData.ownerId || undefined,
        rootCauseAnalysis: formData.rootCauseAnalysis || undefined,
        rootCauseCategory: formData.rootCauseCategory || undefined,
      });
    } else {
      createMutation.mutate();
    }
  };

  // Handle field change
  const handleFieldChange = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field is edited
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Determine dialog title
  const dialogTitle = customTitle || (isEditing
    ? 'Edit CAPA'
    : hasLinkedSource
    ? `Create CAPA from ${linkedSourceType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`
    : 'Create New CAPA');

  // Generate a key for the dialog based on capa id to force remount on capa change
  const dialogKey = capa ? `edit-${capa.id}` : 'create';

  return (
    <DxPopup
      key={dialogKey}
      visible={visible}
      onHiding={onClose}
      onShown={resetForm}
      title={dialogTitle}
      width={600}
      height="auto"
      maxHeight="90vh"
      showCloseButton
      dragEnabled={false}
    >
      <div className="p-4 space-y-5 overflow-y-auto max-h-[calc(90vh-120px)]">
        {/* Linked Source Info */}
        {hasLinkedSource && linkedSourceNumber && !isEditing && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Linked to: <span className="font-mono font-medium">{linkedSourceNumber}</span>
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {errors.submit && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-sm text-destructive">{errors.submit}</p>
          </div>
        )}

        <div className="grid gap-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </label>
            <DxTextBox
              value={formData.title}
              onValueChange={(value) => handleFieldChange('title', value || '')}
              placeholder="Enter CAPA title"
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title}</p>
            )}
          </div>

          {/* Source Type (only for new CAPA without linked source) */}
          {!hasLinkedSource && !isEditing && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Source Type</label>
              <DxSelectBox
                items={sourceTypeOptions}
                value={formData.sourceType}
                valueExpr="value"
                displayExpr="label"
                onValueChange={(value) => handleFieldChange('sourceType', value as CapaSourceType)}
              />
            </div>
          )}

          {/* Two column grid for Type and Priority */}
          <div className="grid grid-cols-2 gap-4">
            {/* CAPA Type */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                CAPA Type <span className="text-destructive">*</span>
              </label>
              <DxSelectBox
                items={typeOptions}
                value={formData.type}
                valueExpr="value"
                displayExpr="label"
                onValueChange={(value) => handleFieldChange('type', value as CapaType)}
                disabled={isEditing}
              />
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Priority <span className="text-destructive">*</span>
              </label>
              <DxSelectBox
                items={priorityOptions}
                value={formData.priority}
                valueExpr="value"
                displayExpr="label"
                onValueChange={(value) => handleFieldChange('priority', value as CapaPriority)}
              />
            </div>
          </div>

          {/* Two column grid for Owner and Due Date */}
          <div className="grid grid-cols-2 gap-4">
            {/* Owner */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Owner <span className="text-destructive">*</span>
              </label>
              <DxSelectBox
                items={(users || []).map((u) => ({ value: u.id, label: u.name }))}
                value={formData.ownerId}
                valueExpr="value"
                displayExpr="label"
                onValueChange={(value) => handleFieldChange('ownerId', value)}
                placeholder="Select owner"
                searchEnabled
              />
              {errors.ownerId && (
                <p className="text-xs text-destructive">{errors.ownerId}</p>
              )}
            </div>

            {/* Due Date */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Due Date <span className="text-destructive">*</span>
              </label>
              <DxDateBox
                value={formData.dueDate || undefined}
                onValueChange={(value) =>
                  handleFieldChange(
                    'dueDate',
                    value ? new Date(value).toISOString().split('T')[0] : ''
                  )
                }
                type="date"
                displayFormat="yyyy-MM-dd"
              />
              {errors.dueDate && (
                <p className="text-xs text-destructive">{errors.dueDate}</p>
              )}
            </div>
          </div>

          {/* Root Cause Category */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Root Cause Category (5M+E)</label>
            <DxSelectBox
              items={rootCauseCategoryOptions}
              value={formData.rootCauseCategory}
              valueExpr="value"
              displayExpr="label"
              onValueChange={(value) => handleFieldChange('rootCauseCategory', value || '')}
              placeholder="Select category"
              showClearButton
            />
          </div>

          {/* Root Cause Analysis */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Root Cause Analysis (5-Why)</label>
            <DxTextArea
              value={formData.rootCauseAnalysis}
              onValueChange={(value) => handleFieldChange('rootCauseAnalysis', value || '')}
              placeholder="Enter root cause analysis using the 5-Why method..."
              height={100}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <DxButton
            text="Cancel"
            onClick={onClose}
            stylingMode="outlined"
            disabled={isSubmitting}
          />
          <DxButton
            text={isEditing ? 'Save Changes' : 'Create CAPA'}
            icon="save"
            onClick={handleSubmit}
            type="success"
            disabled={isSubmitting}
          />
        </div>
      </div>
    </DxPopup>
  );
}

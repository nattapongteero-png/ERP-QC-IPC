'use client';

/**
 * Document Form Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * Form for creating and editing GMP documents.
 */

import { useState } from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { useQuery, useMutation } from '@tanstack/react-query';
import { X } from 'lucide-react';
import type { DocumentType, DocumentCreate, Document } from '@/types/documents';

// ============================================
// Types
// ============================================

interface DocumentFormProps {
  document?: Document | null;
  onSave?: (document: Document) => void;
  onCancel?: () => void;
}

interface FormData {
  title: string;
  typeId: number | null;
  departmentId: number | null;
  content: string;
  retentionYears: number;
}

// ============================================
// API Functions
// ============================================

async function fetchDocumentTypes(): Promise<DocumentType[]> {
  const response = await fetch('/api/documents/types');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch document types');
  }
  return result.data;
}

async function fetchDepartments(): Promise<{ id: number; name: string }[]> {
  const response = await fetch('/api/hr/org-units');
  const result = await response.json();
  if (!result.success) {
    return []; // Return empty if HR module not available
  }
  return result.data || [];
}

async function createDocument(data: DocumentCreate): Promise<Document> {
  const response = await fetch('/api/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to create document');
  }
  return result.data;
}

async function updateDocument(
  id: number,
  data: Partial<DocumentCreate>
): Promise<Document> {
  const response = await fetch(`/api/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to update document');
  }
  return result.data;
}

// ============================================
// Component
// ============================================

export function DocumentForm({ document, onSave, onCancel }: DocumentFormProps) {
  const isEditing = !!document;

  // Form state
  const [formData, setFormData] = useState<FormData>({
    title: document?.title || '',
    typeId: document?.typeId || null,
    departmentId: document?.departmentId || null,
    content: '',
    retentionYears: document?.retentionYears || 5,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch document types
  const { data: documentTypes, isLoading: isLoadingTypes } = useQuery({
    queryKey: ['document-types'],
    queryFn: fetchDocumentTypes,
  });

  // Fetch departments
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createDocument,
    onSuccess: (data) => {
      onSave?.(data);
    },
    onError: (error) => {
      setErrors({ submit: error.message });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: Partial<DocumentCreate>) =>
      updateDocument(document!.id, data),
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
    if (!formData.typeId) {
      newErrors.typeId = 'Document type is required';
    }
    if (formData.retentionYears < 1 || formData.retentionYears > 99) {
      newErrors.retentionYears = 'Retention period must be between 1 and 99 years';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = () => {
    if (!validate()) return;

    const data: DocumentCreate = {
      title: formData.title.trim(),
      typeId: formData.typeId!,
      departmentId: formData.departmentId,
      content: formData.content || undefined,
      retentionYears: formData.retentionYears,
    };

    if (isEditing) {
      updateMutation.mutate({
        title: data.title,
        departmentId: data.departmentId,
      });
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {isEditing ? 'Edit Document' : 'New Document'}
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
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, title: value || '' }))
            }
            placeholder="Enter document title"
          />
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title}</p>
          )}
        </div>

        {/* Document Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Document Type <span className="text-destructive">*</span>
          </label>
          <DxSelectBox
            items={(documentTypes || []).map((t: DocumentType) => ({
              value: t.id,
              label: t.name,
            }))}
            value={formData.typeId}
            valueExpr="value"
            displayExpr="label"
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, typeId: value }))
            }
            placeholder="Select document type"
            disabled={isEditing || isLoadingTypes}
          />
          {errors.typeId && (
            <p className="text-sm text-destructive">{errors.typeId}</p>
          )}
        </div>

        {/* Department */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Department</label>
          <DxSelectBox
            items={(departments || []).map((d) => ({
              value: d.id,
              label: d.name,
            }))}
            value={formData.departmentId}
            valueExpr="value"
            displayExpr="label"
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, departmentId: value }))
            }
            placeholder="Select department (optional)"
            showClearButton
          />
        </div>

        {/* Retention Period */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Retention Period (years)
          </label>
          <DxNumberBox
            value={formData.retentionYears}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                retentionYears: value || 5,
              }))
            }
            min={1}
            max={99}
            disabled={isEditing}
          />
          {errors.retentionYears && (
            <p className="text-sm text-destructive">{errors.retentionYears}</p>
          )}
        </div>

        {/* Content (only for new documents) */}
        {!isEditing && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Initial Content</label>
            <DxTextArea
              value={formData.content}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, content: value || '' }))
              }
              placeholder="Enter initial document content (optional)"
              height={150}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4">
          <DxButton
            text={isEditing ? 'Save Changes' : 'Create Document'}
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

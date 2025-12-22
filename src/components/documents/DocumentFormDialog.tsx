'use client';

/**
 * Document Form Dialog Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * Reusable dialog for creating and editing GMP documents.
 * Designed for both desktop and mobile devices.
 */

import { useState, useMemo } from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxPopup } from '@/components/ui/dx-popup';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FileText, X } from 'lucide-react';
import { useMobile } from '@/hooks/use-mobile';
import type { DocumentType, DocumentCreate, Document } from '@/types/documents';

// ============================================
// Types
// ============================================

interface DocumentFormDialogProps {
  /** Control dialog visibility */
  open: boolean;
  /** Callback when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Existing document for editing (null for new document) */
  document?: Document | null;
  /** Callback after successful save */
  onSave?: (document: Document) => void;
  /** Dialog title override */
  title?: string;
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

export function DocumentFormDialog({
  open,
  onOpenChange,
  document,
  onSave,
  title: customTitle,
}: DocumentFormDialogProps) {
  const isEditing = !!document;
  const { isMobile } = useMobile();

  // Create a unique key for resetting form state when dialog opens
  const formKey = useMemo(() => {
    return open ? `${document?.id || 'new'}-${Date.now()}` : 'closed';
  }, [open, document?.id]);

  // Initial form state based on document
  const initialFormData = useMemo<FormData>(() => ({
    title: document?.title || '',
    typeId: document?.typeId || null,
    departmentId: document?.departmentId || null,
    content: '',
    retentionYears: document?.retentionYears || 5,
  }), [document]);

  // Form state - uses key to reset when dialog opens
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form data when formKey changes (dialog opens with new/different document)
  useMemo(() => {
    if (open) {
      setFormData(initialFormData);
      setErrors({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey]);

  // Fetch document types
  const { data: documentTypes, isLoading: isLoadingTypes } = useQuery({
    queryKey: ['document-types'],
    queryFn: fetchDocumentTypes,
    enabled: open,
  });

  // Fetch departments
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
    enabled: open,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createDocument,
    onSuccess: (data) => {
      onSave?.(data);
      onOpenChange(false);
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
      onOpenChange(false);
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

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const dialogTitle = customTitle || (isEditing ? 'Edit Document' : 'Create New Document');

  return (
    <DxPopup
      visible={open}
      onHiding={handleClose}
      title={dialogTitle}
      width={isMobile ? '100%' : 600}
      height="auto"
      maxHeight={isMobile ? '100%' : '90vh'}
      showCloseButton
      fullScreenOnMobile
      closeOnOutsideClick={!isSubmitting}
      dragEnabled={!isMobile}
    >
      <div className="flex flex-col h-full">
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          {/* Header Icon for Mobile */}
          {isMobile && (
            <div className="flex justify-center pb-2">
              <div className="p-3 bg-primary/10 rounded-full">
                <FileText className="h-8 w-8 text-primary" />
              </div>
            </div>
          )}

          {/* Error Message */}
          {errors.submit && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm flex items-center gap-2">
              <X className="h-4 w-4 flex-shrink-0" />
              {errors.submit}
            </div>
          )}

          {/* Title Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Document Title <span className="text-destructive">*</span>
            </label>
            <DxTextBox
              value={formData.title}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, title: value || '' }))
              }
              placeholder="Enter document title"
              disabled={isSubmitting}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          {/* Document Type Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Document Type <span className="text-destructive">*</span>
            </label>
            <DxSelectBox
              items={(documentTypes || []).map((t: DocumentType) => ({
                value: t.id,
                label: `${t.code} - ${t.name}`,
              }))}
              value={formData.typeId}
              valueExpr="value"
              displayExpr="label"
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, typeId: value }))
              }
              placeholder="Select document type"
              disabled={isEditing || isLoadingTypes || isSubmitting}
              searchEnabled
            />
            {errors.typeId && (
              <p className="text-sm text-destructive">{errors.typeId}</p>
            )}
          </div>

          {/* Department Field */}
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
              disabled={isSubmitting}
              searchEnabled
            />
          </div>

          {/* Retention Period Field */}
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
              disabled={isEditing || isSubmitting}
            />
            {errors.retentionYears && (
              <p className="text-sm text-destructive">{errors.retentionYears}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Thai FDA GMP requires minimum 5-7 years retention for most documents
            </p>
          </div>

          {/* Content Field (only for new documents) */}
          {!isEditing && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Initial Content</label>
              <DxTextArea
                value={formData.content}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, content: value || '' }))
                }
                placeholder="Enter initial document content (optional)"
                height={120}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                You can add or update content in document versions later
              </p>
            </div>
          )}
        </div>

        {/* Sticky Footer Actions */}
        <div className="flex-shrink-0 border-t bg-background p-4 md:p-6">
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <DxButton
              text="Cancel"
              onClick={handleClose}
              stylingMode="outlined"
              disabled={isSubmitting}
              width={isMobile ? '100%' : undefined}
            />
            <DxButton
              text={isSubmitting ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Document')}
              icon={isSubmitting ? undefined : 'save'}
              onClick={handleSubmit}
              type="success"
              disabled={isSubmitting}
              width={isMobile ? '100%' : undefined}
            />
          </div>
        </div>
      </div>
    </DxPopup>
  );
}

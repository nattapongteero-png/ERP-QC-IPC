'use client';

/**
 * Document Form Dialog Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * Reusable dialog for creating and editing GMP documents.
 * Designed for both desktop and mobile devices.
 */

import { useState, useMemo, useRef } from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxPopup } from '@/components/ui/dx-popup';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, X, Upload, File as FileIcon, Eye, RotateCw } from 'lucide-react';
import { useMobile } from '@/hooks/use-mobile';
import type { DocumentType, DocumentCreate, Document, DocumentDetails } from '@/types/documents';

// ============================================
// Types
// ============================================

interface DocumentFormDialogProps {
  /** Control dialog visibility */
  open: boolean;
  /** Callback when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Existing document for editing (null for new document) */
  document?: (Document & Partial<DocumentDetails>) | null;
  /** Callback after successful save */
  onSave?: (document: Document) => void;
  /** Dialog title override */
  title?: string;
}

interface FormData {
  title: string;
  typeId: number | null;
  departmentId: number | null;
  trainingCourseId: number | null;
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
  const queryClient = useQueryClient();

  // Create a unique key for resetting form state when dialog opens
  const formKey = useMemo(() => {
    return open ? `${document?.id || 'new'}-${Date.now()}` : 'closed';
  }, [open, document?.id]);

  // Initial form state based on document
  const initialFormData = useMemo<FormData>(() => ({
    title: document?.title || '',
    typeId: document?.typeId || null,
    departmentId: document?.departmentId || null,
    trainingCourseId: document?.trainingCourseId || null,
    content: '',
    retentionYears: document?.retentionYears || 5,
  }), [document]);

  // Form state - uses key to reset when dialog opens
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingFileDeleted, setExistingFileDeleted] = useState(false);
  const [isDeletingFile, setIsDeletingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form data when formKey changes (dialog opens with new/different document)
  useMemo(() => {
    if (open) {
      setFormData(initialFormData);
      setErrors({});
      setSelectedFile(null);
      setExistingFileDeleted(false);
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

  // Fetch training courses
  const { data: trainingCourses } = useQuery({
    queryKey: ['training-courses'],
    queryFn: async () => {
      const res = await fetch('/api/hr/training/courses');
      const data = await res.json();
      if (!data.success) return [];
      return data.data;
    },
    enabled: open,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createDocument,
    onSuccess: async (data) => {
      // Upload file as initial version if selected
      if (selectedFile) {
        await uploadFileForDocument(data.id);
      }
      // Invalidate documents query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['documents'] });
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
    onSuccess: async (data) => {
      // Upload new file to current version if selected (edit mode re-upload)
      if (selectedFile && document?.currentVersion) {
        await uploadFileToVersion(document.currentVersion.id);
      } else if (selectedFile && document) {
        // No version exists yet - create initial version with file
        await uploadFileForDocument(document.id);
      }
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', document!.id] });
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
      newErrors.title = 'จำเป็นต้องกรอกชื่อเอกสาร';
    }
    if (!formData.typeId) {
      newErrors.typeId = 'จำเป็นต้องเลือกประเภทเอกสาร';
    }
    if (formData.retentionYears < 1 || formData.retentionYears > 99) {
      newErrors.retentionYears = 'ระยะเวลาจัดเก็บต้องอยู่ระหว่าง 1 ถึง 99 ปี';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!validate()) return;

    const data: DocumentCreate = {
      title: formData.title.trim(),
      typeId: formData.typeId!,
      departmentId: formData.departmentId,
      trainingCourseId: formData.trainingCourseId,
      content: formData.content || undefined,
      retentionYears: formData.retentionYears,
    };

    if (isEditing) {
      updateMutation.mutate({
        title: data.title,
        departmentId: data.departmentId,
        trainingCourseId: data.trainingCourseId,
      });
    } else {
      createMutation.mutate(data);
    }
  };

  // After document is created, upload file as initial version if selected
  const uploadFileForDocument = async (documentId: number) => {
    if (!selectedFile) return;

    try {
      // Upload file to get base64 data
      const uploadForm = new FormData();
      uploadForm.append('file', selectedFile);
      uploadForm.append('documentId', String(documentId));

      const uploadRes = await fetch('/api/documents/upload', {
        method: 'POST',
        body: uploadForm,
      });
      const uploadResult = await uploadRes.json();
      if (!uploadResult.success) {
        console.error('File upload failed:', uploadResult.error);
        return;
      }

      // Create initial version with the file
      const versionRes = await fetch(`/api/documents/${documentId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: uploadResult.data.fileData,
          fileName: uploadResult.data.fileName,
          fileSize: uploadResult.data.fileSize,
          mimeType: uploadResult.data.mimeType,
          changeDescription: 'Initial document upload',
        }),
      });
      const versionResult = await versionRes.json();
      if (!versionResult.success) {
        console.error('Version creation failed:', versionResult.error);
      }
    } catch (error) {
      console.error('File upload error:', error);
    }
  };

  // Upload file to an existing version (for edit mode re-upload)
  const uploadFileToVersion = async (_versionId: number) => {
    if (!selectedFile || !document) return;

    try {
      const uploadForm = new FormData();
      uploadForm.append('file', selectedFile);
      uploadForm.append('documentId', String(document.id));

      const uploadRes = await fetch('/api/documents/upload', {
        method: 'POST',
        body: uploadForm,
      });
      const uploadResult = await uploadRes.json();
      if (!uploadResult.success) {
        console.error('File upload failed:', uploadResult.error);
        return;
      }

      // Update the version with new file data
      const versionRes = await fetch(`/api/documents/${document.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: uploadResult.data.fileData,
          fileName: uploadResult.data.fileName,
          fileSize: uploadResult.data.fileSize,
          mimeType: uploadResult.data.mimeType,
          changeDescription: existingFileDeleted ? 'Replaced attached file' : 'Attached new file',
        }),
      });
      const versionResult = await versionRes.json();
      if (!versionResult.success) {
        console.error('Version creation failed:', versionResult.error);
      }
    } catch (error) {
      console.error('File upload error:', error);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const dialogTitle = customTitle || (isEditing ? 'แก้ไขเอกสาร' : 'สร้างเอกสารใหม่');

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
              ชื่อเอกสาร <span className="text-destructive">*</span>
            </label>
            <DxTextBox
              value={formData.title}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, title: value || '' }))
              }
              placeholder="กรอกชื่อเอกสาร"
              disabled={isSubmitting}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          {/* Document Type Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              ประเภทเอกสาร <span className="text-destructive">*</span>
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
              placeholder="เลือกประเภทเอกสาร"
              disabled={isEditing || isLoadingTypes || isSubmitting}
              searchEnabled
            />
            {errors.typeId && (
              <p className="text-sm text-destructive">{errors.typeId}</p>
            )}
          </div>

          {/* Department Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium">แผนก</label>
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
              placeholder="เลือกแผนก (ไม่บังคับ)"
              showClearButton
              disabled={isSubmitting}
              searchEnabled
            />
          </div>

          {/* Related Training Course Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium">หลักสูตรอบรมที่เกี่ยวข้อง</label>
            <DxSelectBox
              items={(trainingCourses || []).map((c: any) => ({
                value: c.id,
                label: `${c.code} - ${c.name}`,
              }))}
              value={formData.trainingCourseId}
              valueExpr="value"
              displayExpr="label"
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, trainingCourseId: value }))
              }
              placeholder="เลือกหลักสูตรอบรม (ไม่บังคับ)"
              showClearButton
              disabled={isSubmitting}
              searchEnabled
            />
          </div>

          {/* Retention Period Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              ระยะเวลาจัดเก็บ (ปี)
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
              GMP อย. ไทย กำหนดให้จัดเก็บเอกสารส่วนใหญ่อย่างน้อย 5-7 ปี
            </p>
          </div>

          {/* Current Attached File (only in edit mode) */}
          {isEditing && document?.currentVersion && (
            <div className="space-y-2">
              <label className="text-sm font-medium">ไฟล์แนบ</label>
              {!existingFileDeleted && (document.currentVersion.fileName || document.currentVersion.hasFileData) ? (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                  <FileIcon className="h-8 w-8 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {document.currentVersion.fileName || 'เอกสารแนบ'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      เวอร์ชัน {document.currentVersion.versionNumber}
                      {document.currentVersion.fileSize
                        ? ` — ${(document.currentVersion.fileSize / 1024).toFixed(1)} KB`
                        : ''}
                    </p>
                  </div>
                  <a
                    href={`/api/documents/versions/${document.currentVersion.id}/file`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded hover:bg-muted transition-colors"
                    title="ดูตัวอย่างไฟล์"
                  >
                    <Eye className="h-4 w-4 text-gray-600" />
                  </a>
                  {document.currentVersion.status === 'draft' && (
                    <button
                      type="button"
                      onClick={async () => {
                        const confirmed = window.confirm('ลบไฟล์แนบนี้?\nไฟล์ที่ลบแล้วจะไม่สามารถกู้คืนได้');
                        if (!confirmed) return;
                        setIsDeletingFile(true);
                        try {
                          const res = await fetch(
                            `/api/documents/versions/${document.currentVersion!.id}/file`,
                            { method: 'DELETE' }
                          );
                          const result = await res.json();
                          if (res.ok && result.success) {
                            setExistingFileDeleted(true);
                          } else {
                            setErrors(prev => ({ ...prev, file: result.error || 'ลบไฟล์ไม่สำเร็จ' }));
                          }
                        } catch {
                          setErrors(prev => ({ ...prev, file: 'ลบไฟล์ไม่สำเร็จ' }));
                        }
                        setIsDeletingFile(false);
                      }}
                      className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors"
                      title="ลบไฟล์"
                      disabled={isDeletingFile || isSubmitting}
                    >
                      {isDeletingFile
                        ? <RotateCw className="h-4 w-4 animate-spin" />
                        : <X className="h-4 w-4" />
                      }
                    </button>
                  )}
                </div>
              ) : document.status === 'draft' ? (
                /* Allow re-upload when draft and file deleted or no file */
                selectedFile ? (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                    <FileIcon className="h-8 w-8 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB — ไฟล์ใหม่
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="p-1 rounded hover:bg-destructive/10 text-destructive"
                      disabled={isSubmitting}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        if (file.size > 10 * 1024 * 1024) {
                          setErrors(prev => ({ ...prev, file: 'ขนาดไฟล์ต้องไม่เกิน 10MB' }));
                          return;
                        }
                        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
                        if (!['.pdf', '.doc', '.docx', '.xls', '.xlsx'].includes(ext)) {
                          setErrors(prev => ({ ...prev, file: 'อนุญาตเฉพาะไฟล์ PDF, DOC, DOCX, XLS, XLSX' }));
                          return;
                        }
                        setSelectedFile(file);
                        setErrors(prev => { const { file: _, ...rest } = prev; return rest; });
                      }
                    }}
                  >
                    <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                    <p className="text-sm text-muted-foreground">
                      {existingFileDeleted ? 'อัปโหลดไฟล์ทดแทน' : 'คลิกเพื่ออัปโหลดไฟล์'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, DOC, DOCX, XLS, XLSX (สูงสุด 10MB)
                    </p>
                  </div>
                )
              ) : (
                <div className="p-3 bg-muted/30 rounded-lg border border-dashed text-center">
                  <p className="text-sm text-muted-foreground">ไม่มีไฟล์แนบ</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                      setErrors(prev => ({ ...prev, file: 'ขนาดไฟล์ต้องไม่เกิน 10MB' }));
                      return;
                    }
                    setSelectedFile(file);
                    setErrors(prev => { const { file: _, ...rest } = prev; return rest; });
                  }
                }}
                disabled={isSubmitting}
              />
              {errors.file && (
                <p className="text-sm text-destructive">{errors.file}</p>
              )}
            </div>
          )}

          {/* Content Field (only for new documents) */}
          {!isEditing && (
            <div className="space-y-2">
              <label className="text-sm font-medium">เนื้อหาเริ่มต้น</label>
              <DxTextArea
                value={formData.content}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, content: value || '' }))
                }
                placeholder="กรอกเนื้อหาเอกสารเริ่มต้น (ไม่บังคับ)"
                height={120}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                คุณสามารถเพิ่มหรือแก้ไขเนื้อหาในเวอร์ชันของเอกสารได้ภายหลัง
              </p>
            </div>
          )}

          {/* File Upload Field (only for new documents) */}
          {!isEditing && (
            <div className="space-y-2">
              <label className="text-sm font-medium">อัปโหลดเอกสาร</label>
              {selectedFile ? (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                  <FileIcon className="h-8 w-8 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="p-1 rounded hover:bg-destructive/10 text-destructive"
                    disabled={isSubmitting}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) {
                        setErrors(prev => ({ ...prev, file: 'ขนาดไฟล์ต้องไม่เกิน 10MB' }));
                        return;
                      }
                      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
                      if (!['.pdf', '.doc', '.docx', '.xls', '.xlsx'].includes(ext)) {
                        setErrors(prev => ({ ...prev, file: 'อนุญาตเฉพาะไฟล์ PDF, DOC, DOCX, XLS, XLSX' }));
                        return;
                      }
                      setSelectedFile(file);
                      setErrors(prev => { const { file: _, ...rest } = prev; return rest; });
                    }
                  }}
                >
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    คลิกเพื่ออัปโหลดหรือลากไฟล์มาวาง
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, DOC, DOCX, XLS, XLSX (สูงสุด 10MB)
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                      setErrors(prev => ({ ...prev, file: 'ขนาดไฟล์ต้องไม่เกิน 10MB' }));
                      return;
                    }
                    setSelectedFile(file);
                    setErrors(prev => { const { file: _, ...rest } = prev; return rest; });
                  }
                }}
                disabled={isSubmitting}
              />
              {errors.file && (
                <p className="text-sm text-destructive">{errors.file}</p>
              )}
            </div>
          )}
        </div>

        {/* Sticky Footer Actions */}
        <div className="flex-shrink-0 border-t bg-background p-4 md:p-6">
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <DxButton
              text="ยกเลิก"
              onClick={handleClose}
              stylingMode="outlined"
              disabled={isSubmitting}
              width={isMobile ? '100%' : undefined}
            />
            <DxButton
              text={isSubmitting ? 'กำลังบันทึก...' : (isEditing ? 'บันทึกการเปลี่ยนแปลง' : 'สร้างเอกสาร')}
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

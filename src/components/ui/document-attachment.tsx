'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { cn } from '@/lib/utils/cn';
import {
  FileText,
  Image,
  Table,
  File,
  Download,
  Trash2,
  Eye,
  AlertCircle,
  CheckCircle,
  Paperclip,
} from 'lucide-react';
import {
  ATTACHMENT_CATEGORIES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  canPreviewInline,
  type AttachmentCategory,
} from '@/lib/validation/attachments';

// ============================================================================
// Types
// ============================================================================

interface Attachment {
  id: number;
  moduleName: string;
  entityId: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  description: string | null;
  category: string | null;
  uploadedBy: number | null;
  uploadedByName?: string | null;
  uploadedAt: string;
}

interface DocumentAttachmentProps {
  moduleName: string;
  entityId: number;
  title?: string;
  readOnly?: boolean;
  maxFiles?: number;
  maxFileSize?: number;
  allowedExtensions?: string[];
  categories?: AttachmentCategory[];
  showPreview?: boolean;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getFileIcon(mimeType: string) {
  if (mimeType === 'application/pdf') return FileText;
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return Table;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

const categoryLabels: Record<string, string> = {
  // Quality/GMP categories
  evidence: 'หลักฐาน',
  report: 'รายงาน',
  photo: 'รูปภาพ',
  investigation: 'การสอบสวน',
  root_cause: 'สาเหตุราก',
  sop_revision: 'แก้ไข SOP',
  training_record: 'บันทึกการฝึกอบรม',
  lab_result: 'ผลห้องปฏิบัติการ',
  certificate: 'ใบรับรอง',
  specification: 'สเปค',
  // HR categories
  id_document: 'เอกสารประจำตัว',
  contract: 'สัญญา',
  qualification: 'คุณวุฒิ',
  resume: 'ประวัติ',
  medical_certificate: 'ใบรับรองแพทย์',
  training_material: 'เอกสารฝึกอบรม',
  authorization_doc: 'เอกสารอนุมัติ',
  // Procurement categories
  quotation: 'ใบเสนอราคา',
  invoice: 'ใบแจ้งหนี้',
  delivery_note: 'ใบส่งของ',
  coa: 'ใบ COA',
  vendor_qualification: 'คุณสมบัติผู้ขาย',
  purchase_contract: 'สัญญาซื้อขาย',
  // Sales categories
  sales_quotation: 'ใบเสนอราคาขาย',
  sales_invoice: 'ใบกำกับภาษี',
  receipt: 'ใบเสร็จรับเงิน',
  shipping_doc: 'เอกสารจัดส่ง',
  sales_contract: 'สัญญาขาย',
  customer_po: 'ใบสั่งซื้อลูกค้า',
  other: 'อื่นๆ',
};

// ============================================================================
// Main Component
// ============================================================================

export function DocumentAttachment({
  moduleName,
  entityId,
  title = 'เอกสารแนบ',
  readOnly = false,
  maxFiles = 20,
  maxFileSize = MAX_FILE_SIZE,
  allowedExtensions = ALLOWED_EXTENSIONS,
  categories = [...ATTACHMENT_CATEGORIES],
  showPreview = true,
  className,
}: DocumentAttachmentProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Preview dialog state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Edit dialog state
  const [editingAttachment, setEditingAttachment] = useState<Attachment | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load attachments
  const loadAttachments = useCallback(async () => {
    if (!entityId) return;

    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/attachments?moduleName=${moduleName}&entityId=${entityId}`
      );
      const result = await res.json();
      if (result.success) {
        setAttachments(result.data);
      } else {
        setError(result.error || 'Failed to load attachments');
      }
    } catch (err) {
      setError('Failed to load attachments');
      console.error('Load attachments error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [moduleName, entityId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  // Clear messages after timeout
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Check max files limit
    if (attachments.length + files.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setIsUploading(true);
    setError(null);

    for (const file of Array.from(files)) {
      setUploadProgress(`Uploading ${file.name}...`);

      // Validate extension
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        setError(`File type ${ext} is not allowed`);
        continue;
      }

      // Validate size
      if (file.size > maxFileSize) {
        setError(`File ${file.name} exceeds maximum size (${formatFileSize(maxFileSize)})`);
        continue;
      }

      try {
        // Convert to base64
        const base64 = await fileToBase64(file);

        const res = await fetch('/api/attachments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            moduleName,
            entityId,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || 'application/octet-stream',
            fileData: base64,
          }),
        });

        const result = await res.json();
        if (result.success) {
          setAttachments((prev) => [result.data, ...prev]);
          setSuccess(`${file.name} uploaded successfully`);
        } else {
          setError(result.error || `Failed to upload ${file.name}`);
        }
      } catch (err) {
        setError(`Failed to upload ${file.name}`);
        console.error('Upload error:', err);
      }
    }

    setIsUploading(false);
    setUploadProgress(null);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  // Handle preview
  const handlePreview = (attachment: Attachment) => {
    if (!canPreviewInline(attachment.mimeType)) {
      // Download instead
      handleDownload(attachment);
      return;
    }

    const url = `/api/attachments/${attachment.id}/download?inline=1`;
    setPreviewUrl(url);
    setPreviewFileName(attachment.fileName);
    setIsPreviewOpen(true);
  };

  // Handle download
  const handleDownload = (attachment: Attachment) => {
    const link = document.createElement('a');
    link.href = `/api/attachments/${attachment.id}/download`;
    link.download = attachment.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle delete
  const handleDelete = async (attachment: Attachment) => {
    if (!confirm(`Delete "${attachment.fileName}"?`)) return;

    try {
      const res = await fetch(`/api/attachments/${attachment.id}`, {
        method: 'DELETE',
      });
      const result = await res.json();

      if (result.success) {
        setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
        setSuccess('File deleted successfully');
      } else {
        setError(result.error || 'Failed to delete file');
      }
    } catch (err) {
      setError('Failed to delete file');
      console.error('Delete error:', err);
    }
  };

  // Handle edit
  const handleEdit = (attachment: Attachment) => {
    setEditingAttachment(attachment);
    setEditDescription(attachment.description || '');
    setEditCategory(attachment.category || '');
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!editingAttachment) return;

    try {
      const res = await fetch(`/api/attachments/${editingAttachment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editDescription || null,
          category: editCategory || null,
        }),
      });
      const result = await res.json();

      if (result.success) {
        setAttachments((prev) =>
          prev.map((a) => (a.id === editingAttachment.id ? result.data : a))
        );
        setEditingAttachment(null);
        setSuccess('Updated successfully');
      } else {
        setError(result.error || 'Failed to update');
      }
    } catch (err) {
      setError('Failed to update');
      console.error('Update error:', err);
    }
  };

  // Category select options
  const categoryOptions = categories.map((cat) => ({
    id: cat,
    name: categoryLabels[cat] || cat,
  }));

  return (
    <div className={cn('rounded-lg border bg-white', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Paperclip className="h-5 w-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {attachments.length}
          </span>
        </div>

        {!readOnly && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={allowedExtensions.join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />
            <DxButton
              text="Upload"
              icon="upload"
              type="default"
              stylingMode="outlined"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || attachments.length >= maxFiles}
            />
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          <CheckCircle className="h-4 w-4" />
          {success}
        </div>
      )}
      {uploadProgress && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
          <DxLoadIndicator width={16} height={16} />
          {uploadProgress}
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <DxLoadIndicator />
          </div>
        ) : attachments.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            <Paperclip className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2">No attachments yet</p>
            {!readOnly && (
              <p className="mt-1 text-xs">Click Upload to add files</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment) => {
              const FileIcon = getFileIcon(attachment.mimeType);
              const previewable = canPreviewInline(attachment.mimeType);

              return (
                <div
                  key={attachment.id}
                  className="flex items-center gap-3 rounded-lg border p-3 hover:bg-gray-50"
                >
                  {/* Icon */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                    <FileIcon className="h-5 w-5 text-gray-600" />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">
                      {attachment.fileName}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span>{formatFileSize(attachment.fileSize)}</span>
                      {attachment.category && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5">
                          {categoryLabels[attachment.category] || attachment.category}
                        </span>
                      )}
                      <span>{formatDate(attachment.uploadedAt)}</span>
                      {attachment.uploadedByName && (
                        <span>by {attachment.uploadedByName}</span>
                      )}
                    </div>
                    {attachment.description && (
                      <p className="mt-1 truncate text-xs text-gray-600">
                        {attachment.description}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {showPreview && previewable && (
                      <button
                        onClick={() => handlePreview(attachment)}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDownload(attachment)}
                      className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-green-600"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    {!readOnly && (
                      <>
                        <button
                          onClick={() => handleEdit(attachment)}
                          className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                          title="Edit"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(attachment)}
                          className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <DxPopup
        visible={isPreviewOpen}
        onHiding={() => {
          setIsPreviewOpen(false);
          setPreviewUrl(null);
        }}
        title={previewFileName}
        width="90%"
        height="90%"
        showCloseButton
        dragEnabled
      >
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-hidden">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="h-full w-full border-0"
                title={previewFileName}
              />
            )}
          </div>
        </div>
      </DxPopup>

      {/* Edit Dialog */}
      <DxPopup
        visible={!!editingAttachment}
        onHiding={() => setEditingAttachment(null)}
        title={`Edit: ${editingAttachment?.fileName || ''}`}
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Description
            </label>
            <DxTextBox
              value={editDescription}
              onValueChange={setEditDescription}
              placeholder="Add a description..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Category
            </label>
            <DxSelectBox
              value={editCategory}
              onValueChange={setEditCategory}
              dataSource={categoryOptions}
              displayExpr="name"
              valueExpr="id"
              placeholder="Select category"
              showClearButton
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <DxButton
              text="Cancel"
              type="normal"
              stylingMode="outlined"
              onClick={() => setEditingAttachment(null)}
            />
            <DxButton
              text="Save"
              type="success"
              onClick={handleSaveEdit}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}

// Export for module usage
export type { DocumentAttachmentProps, Attachment };

/**
 * Attachment Validation Schemas
 * Zod schemas for validating attachment inputs
 */

import { z } from 'zod';

// Allowed file types
export const ALLOWED_MIME_TYPES = [
  // PDF
  'application/pdf',
  // Word
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Images
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  // Text/CSV
  'text/plain',
  'text/csv',
];

export const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.txt',
  '.csv',
];

// Max file size: 10MB
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Module names that can have attachments
export const VALID_MODULES = [
  // Quality/GMP modules
  'gmp_document',
  'capa',
  'deviation',
  'complaint',
  'recall',
  'change_control',
  'internal_audit',
  'audit_finding',
  'work_order',
  'batch_record',
  'stability_study',
  'sanitation',
  'contract',
  'pqr',
  'training',
  'health_record',
  // HR modules
  'employee',
  'training_course',
  'training_session',
  'authorization',
  'delegation',
  'job_description',
  'position',
  'org_unit',
  // Procurement modules
  'purchase_order',
  'vendor',
  'goods_receiving',
  // Sales modules
  'sales_order',
  'customer',
  'sales_quotation',
  // Inventory modules (GMP Phase 2)
  'inventory_lot',
  // Template module (reference implementation)
  'template-items',
] as const;

export type ModuleName = (typeof VALID_MODULES)[number];

// Attachment category options
export const ATTACHMENT_CATEGORIES = [
  // Quality/GMP categories
  'evidence',
  'report',
  'photo',
  'investigation',
  'root_cause',
  'sop_revision',
  'training_record',
  'lab_result',
  'certificate',
  'specification',
  // HR categories
  'id_document',
  'contract',
  'qualification',
  'resume',
  'medical_certificate',
  'training_material',
  'authorization_doc',
  // Procurement categories
  'quotation',
  'invoice',
  'delivery_note',
  'coa',
  'msds',
  'vendor_qualification',
  'purchase_contract',
  // Sales categories
  'sales_quotation',
  'sales_invoice',
  'receipt',
  'shipping_doc',
  'sales_contract',
  'customer_po',
  'other',
] as const;

export type AttachmentCategory = (typeof ATTACHMENT_CATEGORIES)[number];

// Create attachment schema (for API)
export const attachmentCreateSchema = z.object({
  moduleName: z.enum(VALID_MODULES, {
    message: 'Invalid module name',
  }),
  entityId: z.number().int().positive('Entity ID must be a positive integer'),
  fileName: z.string().min(1, 'File name is required').max(255),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE, 'File size must be less than 10MB'),
  mimeType: z.string().min(1).max(100),
  fileData: z.string().min(1, 'File data is required'), // Base64-encoded
  description: z.string().max(500).optional(),
  category: z.enum(ATTACHMENT_CATEGORIES).optional(),
});

// Update attachment schema
export const attachmentUpdateSchema = z.object({
  description: z.string().max(500).optional(),
  category: z.enum(ATTACHMENT_CATEGORIES).optional(),
});

// List query params schema
export const attachmentListQuerySchema = z.object({
  moduleName: z.enum(VALID_MODULES),
  entityId: z.coerce.number().int().positive(),
  category: z.enum(ATTACHMENT_CATEGORIES).optional(),
});

// Export types
export type AttachmentCreateInput = z.infer<typeof attachmentCreateSchema>;
export type AttachmentUpdateInput = z.infer<typeof attachmentUpdateSchema>;
export type AttachmentListQuery = z.infer<typeof attachmentListQuerySchema>;

// Helper to validate file extension
export function isValidFileExtension(fileName: string): boolean {
  const ext = '.' + fileName.split('.').pop()?.toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

// Helper to get file extension from MIME type
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'text/plain': '.txt',
    'text/csv': '.csv',
  };
  return mimeToExt[mimeType] || '';
}

// Helper to check if file can be previewed inline
export function canPreviewInline(mimeType: string): boolean {
  const previewable = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
  ];
  return previewable.includes(mimeType);
}

// Get file type icon name for UI
export function getFileTypeIcon(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'file-text';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('word')) return 'file-text';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'table';
  if (mimeType.includes('text') || mimeType.includes('csv')) return 'file';
  return 'file';
}

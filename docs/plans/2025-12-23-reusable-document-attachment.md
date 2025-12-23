# Reusable Document Attachment System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a reusable document attachment system that any module can use to upload, store, preview, and manage document files (PDF, DOCX, Excel, images) linked by module name and entity ID.

**Architecture:** A standalone `attachments` table stores binary file data (LONGBLOB) with a polymorphic link (`moduleName` + `entityId`). A reusable React component `<DocumentAttachment>` handles upload, preview, and management. API routes provide upload/download/list/delete operations with permission checks.

**Tech Stack:** Next.js 16, Drizzle ORM (MySQL/SQLite dual support), DevExtreme React components, Zod validation, BLOB storage in database

---

## Overview

### Database Design
```
attachments
├── id (PK)
├── moduleName (varchar) - e.g., 'capa', 'deviation', 'complaint', 'work_order'
├── entityId (int) - ID of the linked record
├── fileName (varchar) - Original file name
├── fileSize (int) - Size in bytes
├── mimeType (varchar) - MIME type
├── fileData (LONGBLOB) - Binary content
├── description (varchar) - Optional description
├── category (varchar) - Optional categorization (evidence, report, photo, etc.)
├── uploadedBy (FK -> users)
├── uploadedAt (datetime)
├── updatedAt (datetime)
```

### Supported File Types
- PDF: `application/pdf`
- Word: `.doc`, `.docx`
- Excel: `.xls`, `.xlsx`
- Images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`
- Text: `.txt`, `.csv`

### Component Props
```typescript
interface DocumentAttachmentProps {
  moduleName: string;           // e.g., 'capa', 'deviation'
  entityId: number;             // ID of the parent record
  title?: string;               // Section title
  readOnly?: boolean;           // View-only mode
  maxFiles?: number;            // Limit number of attachments
  maxFileSize?: number;         // Max size per file (default 10MB)
  allowedTypes?: string[];      // Restrict file types
  categories?: string[];        // Available categories for grouping
  showPreview?: boolean;        // Enable inline preview
}
```

---

## Task 1: Create Attachment Schema (MySQL + SQLite)

**Files:**
- Modify: `src/lib/db/schema.ts` (add after line ~2854)

**Step 1: Add MySQL attachment table schema**

Add to `src/lib/db/schema.ts` after the existing table definitions (around line 2854):

```typescript
// ============================================================================
// Reusable Attachment System (Polymorphic)
// ============================================================================

// MySQL Attachments Table
export const mysqlAttachments = mysqlTable('attachments', {
  id: int('id').primaryKey().autoincrement(),
  moduleName: varchar('module_name', { length: 50 }).notNull(), // e.g., 'capa', 'deviation', 'complaint'
  entityId: int('entity_id').notNull(), // ID of the linked record
  fileName: varchar('file_name', { length: 255 }).notNull(), // Original file name
  fileSize: int('file_size').notNull(), // Size in bytes
  mimeType: varchar('mime_type', { length: 100 }).notNull(), // MIME type
  fileData: longblob('file_data').notNull(), // Binary content (LONGBLOB)
  description: varchar('description', { length: 500 }), // Optional description
  category: varchar('category', { length: 50 }), // Optional: evidence, report, photo, etc.
  uploadedBy: int('uploaded_by').references(() => mysqlUsers.id),
  uploadedAt: datetime('uploaded_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// SQLite Attachments Table
export const sqliteAttachments = sqliteTable('attachments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  moduleName: text('module_name').notNull(),
  entityId: integer('entity_id').notNull(),
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type').notNull(),
  fileData: blob('file_data').notNull(), // SQLite blob for binary data
  description: text('description'),
  category: text('category'),
  uploadedBy: integer('uploaded_by').references(() => sqliteUsers.id),
  uploadedAt: text('uploaded_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// Attachment Relations
export const mysqlAttachmentsRelations = relations(mysqlAttachments, ({ one }) => ({
  uploader: one(mysqlUsers, {
    fields: [mysqlAttachments.uploadedBy],
    references: [mysqlUsers.id],
  }),
}));

export const sqliteAttachmentsRelations = relations(sqliteAttachments, ({ one }) => ({
  uploader: one(sqliteUsers, {
    fields: [sqliteAttachments.uploadedBy],
    references: [sqliteUsers.id],
  }),
}));
```

**Step 2: Run lint to verify schema is correct**

Run: `npm run lint -- --fix`
Expected: No errors in schema.ts

**Step 3: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "$(cat <<'EOF'
feat(db): add reusable attachments table schema

Add polymorphic attachments table for both MySQL and SQLite:
- moduleName + entityId for linking to any module
- BLOB storage for file data
- Support for categories and descriptions

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create Attachment Service

**Files:**
- Create: `src/lib/services/attachment-service.ts`

**Step 1: Create the attachment service file**

Create `src/lib/services/attachment-service.ts`:

```typescript
/**
 * Reusable Attachment Service
 * Provides polymorphic file attachment for any module
 */

import { getDb, isSqlite } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import {
  sqliteAttachments,
  sqliteUsers,
  mysqlAttachments,
  mysqlUsers,
} from '../db/schema';
import { createAuditLog } from '../audit';
import { getNow } from '../db/date-utils';

// ============================================================================
// Types
// ============================================================================

export interface Attachment {
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
  updatedAt: string;
}

export interface AttachmentWithData extends Attachment {
  fileData: Buffer;
}

export interface AttachmentCreate {
  moduleName: string;
  entityId: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileData: Buffer;
  description?: string;
  category?: string;
}

export interface AttachmentUpdate {
  description?: string;
  category?: string;
}

// ============================================================================
// Database Helpers
// ============================================================================

function getTables() {
  if (isSqlite()) {
    return {
      attachments: sqliteAttachments,
      users: sqliteUsers,
    };
  }
  return {
    attachments: mysqlAttachments,
    users: mysqlUsers,
  };
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Get all attachments for a module entity
 */
export async function getAttachments(
  moduleName: string,
  entityId: number
): Promise<Attachment[]> {
  const { attachments, users } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await getDb()) as any;

  const rows = await db
    .select({
      id: attachments.id,
      moduleName: attachments.moduleName,
      entityId: attachments.entityId,
      fileName: attachments.fileName,
      fileSize: attachments.fileSize,
      mimeType: attachments.mimeType,
      description: attachments.description,
      category: attachments.category,
      uploadedBy: attachments.uploadedBy,
      uploadedByName: users.fullName,
      uploadedAt: attachments.uploadedAt,
      updatedAt: attachments.updatedAt,
    })
    .from(attachments)
    .leftJoin(users, eq(attachments.uploadedBy, users.id))
    .where(
      and(
        eq(attachments.moduleName, moduleName),
        eq(attachments.entityId, entityId)
      )
    )
    .orderBy(desc(attachments.uploadedAt));

  return rows.map((row: any) => ({
    ...row,
    uploadedAt: String(row.uploadedAt),
    updatedAt: String(row.updatedAt),
  }));
}

/**
 * Get attachment by ID (without file data)
 */
export async function getAttachmentById(id: number): Promise<Attachment | null> {
  const { attachments, users } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await getDb()) as any;

  const [row] = await db
    .select({
      id: attachments.id,
      moduleName: attachments.moduleName,
      entityId: attachments.entityId,
      fileName: attachments.fileName,
      fileSize: attachments.fileSize,
      mimeType: attachments.mimeType,
      description: attachments.description,
      category: attachments.category,
      uploadedBy: attachments.uploadedBy,
      uploadedByName: users.fullName,
      uploadedAt: attachments.uploadedAt,
      updatedAt: attachments.updatedAt,
    })
    .from(attachments)
    .leftJoin(users, eq(attachments.uploadedBy, users.id))
    .where(eq(attachments.id, id));

  if (!row) return null;

  return {
    ...row,
    uploadedAt: String(row.uploadedAt),
    updatedAt: String(row.updatedAt),
  };
}

/**
 * Get attachment file data for download
 */
export async function getAttachmentFileData(
  id: number
): Promise<{ data: Buffer; fileName: string; fileSize: number; mimeType: string } | null> {
  const { attachments } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await getDb()) as any;

  const [row] = await db
    .select({
      fileData: attachments.fileData,
      fileName: attachments.fileName,
      fileSize: attachments.fileSize,
      mimeType: attachments.mimeType,
    })
    .from(attachments)
    .where(eq(attachments.id, id));

  if (!row || !row.fileData) return null;

  // Convert to Buffer if needed
  const data = Buffer.isBuffer(row.fileData)
    ? row.fileData
    : Buffer.from(row.fileData);

  return {
    data,
    fileName: row.fileName,
    fileSize: row.fileSize,
    mimeType: row.mimeType,
  };
}

/**
 * Create a new attachment
 */
export async function createAttachment(
  data: AttachmentCreate,
  userId: number
): Promise<Attachment> {
  const { attachments } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await getDb()) as any;

  const now = getNow();
  const insertData: any = {
    moduleName: data.moduleName,
    entityId: data.entityId,
    fileName: data.fileName,
    fileSize: data.fileSize,
    mimeType: data.mimeType,
    fileData: data.fileData,
    description: data.description || null,
    category: data.category || null,
    uploadedBy: userId,
    uploadedAt: now,
    updatedAt: now,
  };

  const result = await db.insert(attachments).values(insertData);

  const insertId = isSqlite()
    ? (result as any).lastInsertRowid
    : (result as any)[0].insertId;

  // Log audit trail
  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'attachments',
    recordId: insertId,
    newValue: JSON.stringify({
      moduleName: data.moduleName,
      entityId: data.entityId,
      fileName: data.fileName,
      fileSize: data.fileSize,
      category: data.category,
    }),
  });

  const created = await getAttachmentById(insertId);
  if (!created) {
    throw new Error('Failed to retrieve created attachment');
  }

  return created;
}

/**
 * Update attachment metadata
 */
export async function updateAttachment(
  id: number,
  data: AttachmentUpdate,
  userId: number
): Promise<Attachment> {
  const { attachments } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await getDb()) as any;

  const existing = await getAttachmentById(id);
  if (!existing) {
    throw new Error('Attachment not found');
  }

  const now = getNow();
  const updateData: any = {
    updatedAt: now,
  };

  if (data.description !== undefined) {
    updateData.description = data.description;
  }
  if (data.category !== undefined) {
    updateData.category = data.category;
  }

  await db
    .update(attachments)
    .set(updateData)
    .where(eq(attachments.id, id));

  // Log audit trail
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'attachments',
    recordId: id,
    oldValue: JSON.stringify({
      description: existing.description,
      category: existing.category,
    }),
    newValue: JSON.stringify(data),
  });

  const updated = await getAttachmentById(id);
  if (!updated) {
    throw new Error('Failed to retrieve updated attachment');
  }

  return updated;
}

/**
 * Delete an attachment
 */
export async function deleteAttachment(id: number, userId: number): Promise<void> {
  const { attachments } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await getDb()) as any;

  const existing = await getAttachmentById(id);
  if (!existing) {
    throw new Error('Attachment not found');
  }

  await db.delete(attachments).where(eq(attachments.id, id));

  // Log audit trail
  await createAuditLog({
    userId,
    action: 'DELETE',
    tableName: 'attachments',
    recordId: id,
    oldValue: JSON.stringify({
      moduleName: existing.moduleName,
      entityId: existing.entityId,
      fileName: existing.fileName,
      category: existing.category,
    }),
  });
}

/**
 * Delete all attachments for an entity (used when deleting parent record)
 */
export async function deleteAllAttachments(
  moduleName: string,
  entityId: number,
  userId: number
): Promise<number> {
  const { attachments } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await getDb()) as any;

  // Get all attachments first for audit
  const existing = await getAttachments(moduleName, entityId);

  if (existing.length === 0) {
    return 0;
  }

  await db
    .delete(attachments)
    .where(
      and(
        eq(attachments.moduleName, moduleName),
        eq(attachments.entityId, entityId)
      )
    );

  // Log audit trail for each deleted attachment
  for (const att of existing) {
    await createAuditLog({
      userId,
      action: 'DELETE',
      tableName: 'attachments',
      recordId: att.id,
      oldValue: JSON.stringify({
        moduleName: att.moduleName,
        entityId: att.entityId,
        fileName: att.fileName,
        category: att.category,
      }),
    });
  }

  return existing.length;
}

/**
 * Count attachments for an entity
 */
export async function countAttachments(
  moduleName: string,
  entityId: number
): Promise<number> {
  const attachmentList = await getAttachments(moduleName, entityId);
  return attachmentList.length;
}
```

**Step 2: Run lint to verify service is correct**

Run: `npm run lint -- --fix`
Expected: No errors in attachment-service.ts

**Step 3: Commit**

```bash
git add src/lib/services/attachment-service.ts
git commit -m "$(cat <<'EOF'
feat(services): add reusable attachment service

Add polymorphic attachment service with:
- CRUD operations for any module
- BLOB file data storage/retrieval
- Audit trail logging
- MySQL/SQLite dual support

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create Attachment Validation Schema

**Files:**
- Create: `src/lib/validation/attachments.ts`

**Step 1: Create the validation schema file**

Create `src/lib/validation/attachments.ts`:

```typescript
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
] as const;

export type ModuleName = (typeof VALID_MODULES)[number];

// Attachment category options
export const ATTACHMENT_CATEGORIES = [
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
  'other',
] as const;

export type AttachmentCategory = (typeof ATTACHMENT_CATEGORIES)[number];

// Create attachment schema (for API)
export const attachmentCreateSchema = z.object({
  moduleName: z.enum(VALID_MODULES, {
    errorMap: () => ({ message: 'Invalid module name' }),
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
```

**Step 2: Run lint to verify**

Run: `npm run lint -- --fix`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/validation/attachments.ts
git commit -m "$(cat <<'EOF'
feat(validation): add attachment validation schemas

Add Zod schemas for attachment validation:
- Supported MIME types and extensions
- Module name validation
- Category options
- Helper functions for preview/icons

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create Attachment API Routes

**Files:**
- Create: `src/app/api/attachments/route.ts`
- Create: `src/app/api/attachments/[id]/route.ts`
- Create: `src/app/api/attachments/[id]/download/route.ts`

**Step 1: Create main attachments route**

Create `src/app/api/attachments/route.ts`:

```typescript
/**
 * Attachments API
 * Reusable file attachment endpoints for any module
 *
 * GET /api/attachments?moduleName=xxx&entityId=xxx - List attachments
 * POST /api/attachments - Upload new attachment
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getAttachments,
  createAttachment,
} from '@/lib/services/attachment-service';
import {
  attachmentCreateSchema,
  attachmentListQuerySchema,
  isValidFileExtension,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from '@/lib/validation/attachments';

// GET /api/attachments - List attachments for a module entity
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const query = {
          moduleName: searchParams.get('moduleName'),
          entityId: searchParams.get('entityId'),
          category: searchParams.get('category'),
        };

        // Validate query params
        const parseResult = attachmentListQuerySchema.safeParse(query);
        if (!parseResult.success) {
          return errorResponse('Invalid query parameters', 400, {
            errors: parseResult.error.issues,
          });
        }

        const { moduleName, entityId } = parseResult.data;
        const attachments = await getAttachments(moduleName, entityId);

        // Filter by category if provided
        const filtered = parseResult.data.category
          ? attachments.filter((a) => a.category === parseResult.data.category)
          : attachments;

        return successResponse(filtered);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    [] // No specific permission - each module handles its own permissions
  );
}

// POST /api/attachments - Create new attachment
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = attachmentCreateSchema.safeParse(body);
        if (!parseResult.success) {
          return errorResponse('Validation failed', 400, {
            errors: parseResult.error.issues,
          });
        }

        const data = parseResult.data;

        // Validate file extension
        if (!isValidFileExtension(data.fileName)) {
          return errorResponse(
            'Invalid file type. Supported: PDF, Word, Excel, Images, Text/CSV',
            400
          );
        }

        // Validate MIME type (allow unknown for browser inconsistencies)
        if (data.mimeType && !ALLOWED_MIME_TYPES.includes(data.mimeType)) {
          console.warn(`[Attachments] Unexpected MIME type: ${data.mimeType}`);
        }

        // Validate file size
        if (data.fileSize > MAX_FILE_SIZE) {
          return errorResponse('File size must be less than 10MB', 400);
        }

        // Decode base64 to buffer
        const fileBuffer = Buffer.from(data.fileData, 'base64');

        const attachment = await createAttachment(
          {
            moduleName: data.moduleName,
            entityId: data.entityId,
            fileName: data.fileName,
            fileSize: data.fileSize,
            mimeType: data.mimeType,
            fileData: fileBuffer,
            description: data.description,
            category: data.category,
          },
          session.userId
        );

        console.log(
          `[Attachments] File uploaded: ${data.fileName} for ${data.moduleName}/${data.entityId} by user ${session.userId}`
        );

        return successResponse(attachment, 'File uploaded successfully');
      } catch (error) {
        console.error('[Attachments] Upload error:', error);
        return serverErrorResponse(error);
      }
    },
    [] // No specific permission - each module handles its own permissions
  );
}
```

**Step 2: Create individual attachment route**

Create `src/app/api/attachments/[id]/route.ts`:

```typescript
/**
 * Individual Attachment API
 *
 * GET /api/attachments/[id] - Get attachment details
 * PUT /api/attachments/[id] - Update attachment metadata
 * DELETE /api/attachments/[id] - Delete attachment
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  notFoundResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getAttachmentById,
  updateAttachment,
  deleteAttachment,
} from '@/lib/services/attachment-service';
import { attachmentUpdateSchema } from '@/lib/validation/attachments';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/attachments/[id] - Get attachment details
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const attachmentId = parseInt(id, 10);

        if (isNaN(attachmentId)) {
          return errorResponse('Invalid attachment ID', 400);
        }

        const attachment = await getAttachmentById(attachmentId);

        if (!attachment) {
          return notFoundResponse('Attachment not found');
        }

        return successResponse(attachment);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    []
  );
}

// PUT /api/attachments/[id] - Update attachment metadata
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const attachmentId = parseInt(id, 10);

        if (isNaN(attachmentId)) {
          return errorResponse('Invalid attachment ID', 400);
        }

        const body = await request.json();

        // Validate input
        const parseResult = attachmentUpdateSchema.safeParse(body);
        if (!parseResult.success) {
          return errorResponse('Validation failed', 400, {
            errors: parseResult.error.issues,
          });
        }

        const attachment = await updateAttachment(
          attachmentId,
          parseResult.data,
          session.userId
        );

        return successResponse(attachment, 'Attachment updated successfully');
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return notFoundResponse(error.message);
        }
        return serverErrorResponse(error);
      }
    },
    []
  );
}

// DELETE /api/attachments/[id] - Delete attachment
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const attachmentId = parseInt(id, 10);

        if (isNaN(attachmentId)) {
          return errorResponse('Invalid attachment ID', 400);
        }

        await deleteAttachment(attachmentId, session.userId);

        console.log(`[Attachments] File deleted: ID ${attachmentId} by user ${session.userId}`);

        return successResponse(null, 'Attachment deleted successfully');
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return notFoundResponse(error.message);
        }
        return serverErrorResponse(error);
      }
    },
    []
  );
}
```

**Step 3: Create download route**

Create `src/app/api/attachments/[id]/download/route.ts`:

```typescript
/**
 * Attachment Download API
 *
 * GET /api/attachments/[id]/download - Download attachment file
 * Query params:
 * - inline=1: Display inline (for preview) instead of forcing download
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getAttachmentFileData } from '@/lib/services/attachment-service';
import { canPreviewInline } from '@/lib/validation/attachments';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/attachments/[id]/download - Download file
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const attachmentId = parseInt(id, 10);

        if (isNaN(attachmentId) || attachmentId <= 0) {
          return errorResponse('Invalid attachment ID', 400);
        }

        const { searchParams } = new URL(request.url);
        const isInline = searchParams.get('inline') === '1';

        // Get file data from database
        const fileData = await getAttachmentFileData(attachmentId);

        if (!fileData) {
          return errorResponse('Attachment not found', 404);
        }

        // Determine Content-Disposition
        const canInline = isInline && canPreviewInline(fileData.mimeType);
        const disposition = canInline
          ? 'inline'
          : `attachment; filename="${encodeURIComponent(fileData.fileName)}"`;

        console.log(
          `[Attachments] File downloaded: ID ${attachmentId}, ${fileData.fileName} (${fileData.fileSize} bytes)`
        );

        // Return file with appropriate headers
        return new NextResponse(fileData.data, {
          headers: {
            'Content-Type': fileData.mimeType,
            'Content-Disposition': disposition,
            'Content-Length': String(fileData.fileSize),
            'Cache-Control': 'private, max-age=3600',
          },
        });
      } catch (error) {
        console.error('[Attachments] Download error:', error);
        return serverErrorResponse(error);
      }
    },
    []
  );
}
```

**Step 4: Run lint to verify all API routes**

Run: `npm run lint -- --fix`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/api/attachments/
git commit -m "$(cat <<'EOF'
feat(api): add reusable attachment API routes

Add REST API for attachment management:
- GET /api/attachments - List by module+entityId
- POST /api/attachments - Upload with base64 data
- GET /api/attachments/[id] - Get details
- PUT /api/attachments/[id] - Update metadata
- DELETE /api/attachments/[id] - Remove
- GET /api/attachments/[id]/download - Download/preview

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Create DocumentAttachment UI Component

**Files:**
- Create: `src/components/ui/document-attachment.tsx`

**Step 1: Create the reusable component**

Create `src/components/ui/document-attachment.tsx`:

```typescript
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
  Upload,
  Download,
  Trash2,
  Eye,
  X,
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
```

**Step 2: Run lint to verify component**

Run: `npm run lint -- --fix`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/ui/document-attachment.tsx
git commit -m "$(cat <<'EOF'
feat(components): add reusable DocumentAttachment component

Add DocumentAttachment component with:
- Upload with drag-and-drop visual
- File list with icons and metadata
- Inline preview for PDF/images
- Download functionality
- Edit description/category
- Delete with confirmation
- Category filtering
- DevExtreme UI integration

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add Unit Tests for Attachment Service

**Files:**
- Create: `tests/unit/services/attachment-service.test.ts`

**Step 1: Create the test file**

Create `tests/unit/services/attachment-service.test.ts`:

```typescript
/**
 * Attachment Service Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
  isSqlite: vi.fn(() => true),
}));

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(),
}));

vi.mock('@/lib/db/date-utils', () => ({
  getNow: vi.fn(() => new Date('2024-12-23T10:00:00Z')),
}));

import { getDb, isSqlite } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

describe('Attachment Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAttachments', () => {
    it('should return empty array when no attachments exist', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const { getAttachments } = await import('@/lib/services/attachment-service');
      const result = await getAttachments('capa', 1);

      expect(result).toEqual([]);
    });

    it('should return attachments with proper formatting', async () => {
      const mockRow = {
        id: 1,
        moduleName: 'capa',
        entityId: 1,
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        description: 'Test file',
        category: 'evidence',
        uploadedBy: 1,
        uploadedByName: 'Test User',
        uploadedAt: new Date('2024-12-23T10:00:00Z'),
        updatedAt: new Date('2024-12-23T10:00:00Z'),
      };

      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([mockRow]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const { getAttachments } = await import('@/lib/services/attachment-service');
      const result = await getAttachments('capa', 1);

      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('test.pdf');
      expect(result[0].category).toBe('evidence');
    });
  });

  describe('createAttachment', () => {
    it('should create attachment and return result', async () => {
      const mockInsertResult = { lastInsertRowid: 1 };
      const mockCreatedRow = {
        id: 1,
        moduleName: 'capa',
        entityId: 1,
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        description: null,
        category: null,
        uploadedBy: 1,
        uploadedByName: 'Test User',
        uploadedAt: '2024-12-23T10:00:00Z',
        updatedAt: '2024-12-23T10:00:00Z',
      };

      const mockDb = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(mockInsertResult),
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockCreatedRow]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);
      vi.mocked(isSqlite).mockReturnValue(true);

      const { createAttachment } = await import('@/lib/services/attachment-service');
      const result = await createAttachment(
        {
          moduleName: 'capa',
          entityId: 1,
          fileName: 'test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          fileData: Buffer.from('test'),
        },
        1
      );

      expect(result.fileName).toBe('test.pdf');
      expect(createAuditLog).toHaveBeenCalled();
    });
  });

  describe('deleteAttachment', () => {
    it('should throw error when attachment not found', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const { deleteAttachment } = await import('@/lib/services/attachment-service');

      await expect(deleteAttachment(999, 1)).rejects.toThrow('Attachment not found');
    });
  });
});
```

**Step 2: Run the tests**

Run: `npm test -- tests/unit/services/attachment-service.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/unit/services/attachment-service.test.ts
git commit -m "$(cat <<'EOF'
test(services): add unit tests for attachment service

Add Vitest unit tests for:
- getAttachments (empty and with data)
- createAttachment with audit logging
- deleteAttachment error handling

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add Integration Tests for Attachment API

**Files:**
- Create: `tests/integration/api/attachments.test.ts`

**Step 1: Create the integration test file**

Create `tests/integration/api/attachments.test.ts`:

```typescript
/**
 * Attachment API Integration Tests
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock authentication
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(() => Promise.resolve({ userId: 1, role: 'admin' })),
  hasPermission: vi.fn(() => true),
}));

// Mock attachment service
vi.mock('@/lib/services/attachment-service', () => ({
  getAttachments: vi.fn(),
  getAttachmentById: vi.fn(),
  getAttachmentFileData: vi.fn(),
  createAttachment: vi.fn(),
  updateAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
}));

import { GET, POST } from '@/app/api/attachments/route';
import { GET as GET_BY_ID, PUT, DELETE } from '@/app/api/attachments/[id]/route';
import { GET as DOWNLOAD } from '@/app/api/attachments/[id]/download/route';
import {
  getAttachments,
  getAttachmentById,
  getAttachmentFileData,
  createAttachment,
  updateAttachment,
  deleteAttachment,
} from '@/lib/services/attachment-service';

describe('Attachments API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/attachments', () => {
    it('should return attachments for valid moduleName and entityId', async () => {
      const mockAttachments = [
        {
          id: 1,
          moduleName: 'capa',
          entityId: 1,
          fileName: 'test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          description: null,
          category: 'evidence',
          uploadedAt: '2024-12-23T10:00:00Z',
        },
      ];
      vi.mocked(getAttachments).mockResolvedValue(mockAttachments as any);

      const request = new NextRequest(
        'http://localhost/api/attachments?moduleName=capa&entityId=1'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].fileName).toBe('test.pdf');
    });

    it('should return error for invalid module name', async () => {
      const request = new NextRequest(
        'http://localhost/api/attachments?moduleName=invalid&entityId=1'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/attachments', () => {
    it('should create attachment with valid data', async () => {
      const mockCreated = {
        id: 1,
        moduleName: 'capa',
        entityId: 1,
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
      };
      vi.mocked(createAttachment).mockResolvedValue(mockCreated as any);

      const request = new NextRequest('http://localhost/api/attachments', {
        method: 'POST',
        body: JSON.stringify({
          moduleName: 'capa',
          entityId: 1,
          fileName: 'test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          fileData: Buffer.from('test').toString('base64'),
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.fileName).toBe('test.pdf');
    });

    it('should reject invalid file type', async () => {
      const request = new NextRequest('http://localhost/api/attachments', {
        method: 'POST',
        body: JSON.stringify({
          moduleName: 'capa',
          entityId: 1,
          fileName: 'test.exe',
          fileSize: 1024,
          mimeType: 'application/x-msdownload',
          fileData: Buffer.from('test').toString('base64'),
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid file type');
    });
  });

  describe('GET /api/attachments/[id]/download', () => {
    it('should return file for download', async () => {
      vi.mocked(getAttachmentFileData).mockResolvedValue({
        data: Buffer.from('test content'),
        fileName: 'test.pdf',
        fileSize: 12,
        mimeType: 'application/pdf',
      });

      const request = new NextRequest(
        'http://localhost/api/attachments/1/download'
      );
      const response = await DOWNLOAD(request, {
        params: Promise.resolve({ id: '1' }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/pdf');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
    });

    it('should return inline for preview when requested', async () => {
      vi.mocked(getAttachmentFileData).mockResolvedValue({
        data: Buffer.from('test content'),
        fileName: 'test.pdf',
        fileSize: 12,
        mimeType: 'application/pdf',
      });

      const request = new NextRequest(
        'http://localhost/api/attachments/1/download?inline=1'
      );
      const response = await DOWNLOAD(request, {
        params: Promise.resolve({ id: '1' }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Disposition')).toBe('inline');
    });
  });

  describe('DELETE /api/attachments/[id]', () => {
    it('should delete attachment successfully', async () => {
      vi.mocked(deleteAttachment).mockResolvedValue();

      const request = new NextRequest('http://localhost/api/attachments/1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: '1' }),
      });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(deleteAttachment).toHaveBeenCalledWith(1, 1);
    });
  });
});
```

**Step 2: Run the integration tests**

Run: `npm test -- tests/integration/api/attachments.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/integration/api/attachments.test.ts
git commit -m "$(cat <<'EOF'
test(api): add integration tests for attachment endpoints

Add Vitest integration tests for:
- GET /api/attachments (list)
- POST /api/attachments (upload)
- GET /api/attachments/[id]/download
- DELETE /api/attachments/[id]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Create Example Usage in CAPA Detail Page

**Files:**
- Modify: `src/app/gmp/capa/[id]/page.tsx` (add DocumentAttachment component)

**Step 1: Import and add DocumentAttachment to CAPA detail page**

Find the CAPA detail page and add the DocumentAttachment component. Look for an appropriate section (usually after action items or at the bottom).

Add import at top:
```typescript
import { DocumentAttachment } from '@/components/ui/document-attachment';
```

Add component in the page JSX (find a suitable card/section location):
```typescript
{/* Attachments Section */}
<DocumentAttachment
  moduleName="capa"
  entityId={capaId}
  title="เอกสารแนบ (Attachments)"
  categories={['evidence', 'root_cause', 'investigation', 'report', 'training_record', 'other']}
  readOnly={capa.status === 'closed'}
/>
```

**Step 2: Run lint to verify**

Run: `npm run lint -- --fix`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/gmp/capa/[id]/page.tsx
git commit -m "$(cat <<'EOF'
feat(capa): integrate DocumentAttachment component

Add reusable attachment section to CAPA detail page:
- Evidence and investigation documents
- Read-only mode when CAPA is closed

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Export Component from UI Index

**Files:**
- Modify: `src/components/ui/index.ts`

**Step 1: Add export for DocumentAttachment**

Add to `src/components/ui/index.ts`:
```typescript
export { DocumentAttachment } from './document-attachment';
export type { DocumentAttachmentProps, Attachment } from './document-attachment';
```

**Step 2: Run lint**

Run: `npm run lint -- --fix`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/ui/index.ts
git commit -m "$(cat <<'EOF'
feat(components): export DocumentAttachment from UI index

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Run Full Test Suite and Verify

**Step 1: Run lint on all files**

Run: `npm run lint -- --fix`
Expected: No errors

**Step 2: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 3: Manual verification in browser**

1. Start dev server: `npm run dev`
2. Navigate to a CAPA detail page: `/gmp/capa/1`
3. Verify attachment section appears
4. Test upload, preview, download, delete
5. Verify audit trail logs are created

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: final fixes for attachment system

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Usage Examples

### Basic Usage (CAPA)
```tsx
<DocumentAttachment
  moduleName="capa"
  entityId={capaId}
/>
```

### With All Options (Deviation)
```tsx
<DocumentAttachment
  moduleName="deviation"
  entityId={deviationId}
  title="Investigation Documents"
  categories={['evidence', 'photo', 'lab_result', 'report']}
  maxFiles={10}
  maxFileSize={5 * 1024 * 1024} // 5MB
  allowedExtensions={['.pdf', '.jpg', '.png']}
  showPreview={true}
  readOnly={deviation.status === 'closed'}
/>
```

### Supported Modules
- `capa` - Corrective/Preventive Actions
- `deviation` - Quality Deviations
- `complaint` - Customer Complaints
- `recall` - Product Recalls
- `change_control` - Change Requests
- `internal_audit` - Audit Records
- `audit_finding` - Audit Findings
- `work_order` - Production Work Orders
- `batch_record` - Batch Production Records
- `stability_study` - Stability Studies
- `sanitation` - Sanitation Records
- `contract` - GMP Contracts
- `pqr` - Product Quality Reviews
- `training` - Training Records
- `health_record` - Employee Health Records

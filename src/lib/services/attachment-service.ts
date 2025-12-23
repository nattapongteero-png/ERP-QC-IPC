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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (result as any).lastInsertRowid
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

/**
 * Audit Wrapper
 *
 * Centralized audit logging wrapper that automatically:
 * - Captures old values before update/delete operations
 * - Logs changes after successful operations
 * - Works with any table in the system
 *
 * Usage:
 * ```typescript
 * // For INSERT
 * const id = await auditedInsert({
 *   table: 'templateItems',
 *   data: { name: 'New Item', code: 'IT-001' },
 *   userId: session.userId,
 *   ipAddress: getClientIP(request),
 * });
 *
 * // For UPDATE
 * await auditedUpdate({
 *   table: 'templateItems',
 *   id: 123,
 *   data: { name: 'Updated Name' },
 *   userId: session.userId,
 * });
 *
 * // For DELETE
 * await auditedDelete({
 *   table: 'templateItems',
 *   id: 123,
 *   userId: session.userId,
 * });
 *
 * // For custom operations with full control
 * await withAuditLog({
 *   action: 'APPROVE',
 *   table: 'templateItems',
 *   id: 123,
 *   userId: session.userId,
 *   operation: async () => {
 *     // Your custom operation
 *     return result;
 *   },
 * });
 * ```
 */

import { eq } from 'drizzle-orm';
import { getDb } from './index';
import { getTableRef, getInsertId, executeDbOperation } from './db-helper';
import { createAuditLog, type AuditLogEntry } from '../audit';
import { getNow } from './date-utils';

// Action types for audit logging
export type AuditAction = AuditLogEntry['action'];

// Base config for all audited operations
interface AuditConfig {
  /** User ID performing the operation */
  userId?: number;
  /** Client IP address */
  ipAddress?: string;
  /** Additional description for the log */
  description?: string;
}

// Config for insert operations
interface AuditedInsertConfig extends AuditConfig {
  /** Table name (camelCase, e.g., 'templateItems') */
  table: string;
  /** Data to insert */
  data: Record<string, unknown>;
}

// Config for update operations
interface AuditedUpdateConfig extends AuditConfig {
  /** Table name (camelCase, e.g., 'templateItems') */
  table: string;
  /** Record ID to update */
  id: number;
  /** Data to update */
  data: Record<string, unknown>;
  /** Optional: specific fields to track (if not provided, all changed fields are tracked) */
  trackFields?: string[];
}

// Config for delete operations
interface AuditedDeleteConfig extends AuditConfig {
  /** Table name (camelCase, e.g., 'templateItems') */
  table: string;
  /** Record ID to delete */
  id: number;
  /** Whether to soft delete (set isActive=false) instead of hard delete */
  softDelete?: boolean;
}

// Config for custom operations
interface WithAuditLogConfig<T> extends AuditConfig {
  /** Action type */
  action: AuditAction;
  /** Table name (camelCase, e.g., 'templateItems') */
  table: string;
  /** Record ID (optional for CREATE) */
  id?: number;
  /** The operation to perform */
  operation: () => Promise<T>;
  /** Old value (will be auto-fetched if not provided and id is given) */
  oldValue?: Record<string, unknown>;
  /** New value (for manual control) */
  newValue?: Record<string, unknown>;
  /** Skip auto-fetching old value */
  skipAutoFetch?: boolean;
}

/**
 * Fetch a record by ID for audit logging
 */
async function fetchRecordById(
  table: string,
  id: number
): Promise<Record<string, unknown> | null> {
  try {
    const tableRef = getTableRef(table);
    const db = await getDb();
    const results = await db.select().from(tableRef).where(eq(tableRef.id, id)).limit(1);
    return results[0] || null;
  } catch (error) {
    console.error(`Failed to fetch record for audit (${table}:${id}):`, error);
    return null;
  }
}

/**
 * Filter object to only include specified fields
 */
function filterFields(
  obj: Record<string, unknown> | null,
  fields?: string[]
): Record<string, unknown> | null {
  if (!obj) return null;
  if (!fields || fields.length === 0) return obj;

  const filtered: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in obj) {
      filtered[field] = obj[field];
    }
  }
  return filtered;
}

/**
 * Remove internal/sensitive fields from audit data
 */
function sanitizeForAudit(obj: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!obj) return null;

  const sensitiveFields = ['password', 'passwordHash', 'apiKey', 'secretKey', 'token'];
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveFields.includes(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Insert with automatic audit logging
 *
 * @returns The inserted record ID
 */
export async function auditedInsert(config: AuditedInsertConfig): Promise<number> {
  const { table, data, userId, ipAddress } = config;

  return executeDbOperation(async (db) => {
    const tableRef = getTableRef(table);

    // Add timestamps if not provided
    const insertData = {
      ...data,
      createdAt: data.createdAt ?? getNow(),
      updatedAt: data.updatedAt ?? getNow(),
    };

    // Perform insert
    const result = await db.insert(tableRef).values(insertData);
    const insertedId = getInsertId(result);

    // Log the creation
    await createAuditLog({
      userId,
      action: 'CREATE',
      tableName: table,
      recordId: insertedId,
      oldValue: undefined,
      newValue: sanitizeForAudit(insertData) as Record<string, any>,
      ipAddress,
    });

    return insertedId;
  });
}

/**
 * Update with automatic audit logging
 *
 * Automatically fetches old value before update and logs the diff.
 */
export async function auditedUpdate(config: AuditedUpdateConfig): Promise<void> {
  const { table, id, data, userId, ipAddress, trackFields } = config;

  return executeDbOperation(async (db) => {
    const tableRef = getTableRef(table);

    // Fetch old value BEFORE update
    const oldRecord = await fetchRecordById(table, id);
    if (!oldRecord) {
      throw new Error(`Record not found: ${table}:${id}`);
    }

    // Add updatedAt timestamp
    const updateData = {
      ...data,
      updatedAt: getNow(),
    };

    // Perform update
    await db.update(tableRef).set(updateData).where(eq(tableRef.id, id));

    // Prepare audit values (filter to tracked fields if specified)
    const oldValue = filterFields(oldRecord, trackFields);
    const newValue = filterFields({ ...oldRecord, ...updateData }, trackFields);

    // Log the update
    await createAuditLog({
      userId,
      action: 'UPDATE',
      tableName: table,
      recordId: id,
      oldValue: sanitizeForAudit(oldValue) as Record<string, any>,
      newValue: sanitizeForAudit(newValue) as Record<string, any>,
      ipAddress,
    });
  });
}

/**
 * Delete with automatic audit logging
 *
 * Automatically fetches record before deletion and logs it.
 * Supports soft delete (setting isActive=false) or hard delete.
 */
export async function auditedDelete(config: AuditedDeleteConfig): Promise<void> {
  const { table, id, userId, ipAddress, softDelete = false } = config;

  return executeDbOperation(async (db) => {
    const tableRef = getTableRef(table);

    // Fetch record BEFORE deletion
    const oldRecord = await fetchRecordById(table, id);
    if (!oldRecord) {
      throw new Error(`Record not found: ${table}:${id}`);
    }

    if (softDelete) {
      // Soft delete - set isActive to false
      await db.update(tableRef).set({
        isActive: false,
        updatedAt: getNow(),
      }).where(eq(tableRef.id, id));
    } else {
      // Hard delete
      await db.delete(tableRef).where(eq(tableRef.id, id));
    }

    // Log the deletion
    await createAuditLog({
      userId,
      action: 'DELETE',
      tableName: table,
      recordId: id,
      oldValue: sanitizeForAudit(oldRecord) as Record<string, any>,
      newValue: undefined,
      ipAddress,
    });
  });
}

/**
 * Generic wrapper for any operation with audit logging
 *
 * Use this for custom actions like APPROVE, REJECT, SYNC, etc.
 * Automatically fetches old value if id is provided and skipAutoFetch is false.
 */
export async function withAuditLog<T>(config: WithAuditLogConfig<T>): Promise<T> {
  const {
    action,
    table,
    id,
    userId,
    ipAddress,
    operation,
    oldValue: providedOldValue,
    newValue: providedNewValue,
    skipAutoFetch = false,
  } = config;

  // Auto-fetch old value if needed
  let oldValue = providedOldValue;
  if (!oldValue && id && !skipAutoFetch && action !== 'CREATE') {
    oldValue = (await fetchRecordById(table, id)) || undefined;
  }

  // Perform the operation
  const result = await operation();

  // Auto-fetch new value if needed (for actions that modify data)
  let newValue = providedNewValue;
  if (!newValue && id && !skipAutoFetch && action !== 'DELETE') {
    newValue = (await fetchRecordById(table, id)) || undefined;
  }

  // Log the action
  await createAuditLog({
    userId,
    action,
    tableName: table,
    recordId: id,
    oldValue: sanitizeForAudit(oldValue as Record<string, unknown>) as Record<string, any>,
    newValue: sanitizeForAudit(newValue as Record<string, unknown>) as Record<string, any>,
    ipAddress,
  });

  return result;
}

/**
 * Batch insert with audit logging
 *
 * Inserts multiple records and logs each one.
 * @returns Array of inserted IDs
 */
export async function auditedBatchInsert(config: {
  table: string;
  data: Record<string, unknown>[];
  userId?: number;
  ipAddress?: string;
}): Promise<number[]> {
  const { table, data, userId, ipAddress } = config;
  const insertedIds: number[] = [];

  for (const record of data) {
    const id = await auditedInsert({
      table,
      data: record,
      userId,
      ipAddress,
    });
    insertedIds.push(id);
  }

  return insertedIds;
}

/**
 * Batch update with audit logging
 *
 * Updates multiple records and logs each one.
 */
export async function auditedBatchUpdate(config: {
  table: string;
  updates: Array<{ id: number; data: Record<string, unknown> }>;
  userId?: number;
  ipAddress?: string;
  trackFields?: string[];
}): Promise<void> {
  const { table, updates, userId, ipAddress, trackFields } = config;

  for (const update of updates) {
    await auditedUpdate({
      table,
      id: update.id,
      data: update.data,
      userId,
      ipAddress,
      trackFields,
    });
  }
}

/**
 * Helper to create audit context from request
 */
export function createAuditContext(request: Request, userId?: number): AuditConfig {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');

  let ipAddress = 'unknown';
  if (forwarded) {
    ipAddress = forwarded.split(',')[0].trim();
  } else if (realIP) {
    ipAddress = realIP;
  }

  return {
    userId,
    ipAddress,
  };
}

// Re-export for convenience
export { createAuditLog, getClientIP } from '../audit';

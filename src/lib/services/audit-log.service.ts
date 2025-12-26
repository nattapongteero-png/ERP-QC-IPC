/**
 * Audit Log Service
 *
 * Generic service for fetching and managing audit logs across all modules.
 */

import { eq, and, gte, lte, desc, or, like, sql } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '../db/db-helper';
import { toQueryDate, formatDateFromDb } from '../db/date-utils';
import type {
  AuditLog,
  AuditLogFilters,
  FieldChange,
} from '@/types/audit-log';

// Get table references
function getTables() {
  return {
    auditTrail: getTableRef('auditTrail'),
    users: getTableRef('users'),
  };
}

/**
 * Get audit logs with optional filters
 */
export async function getAuditLogs(
  filters: AuditLogFilters = {}
): Promise<{ logs: AuditLog[]; total: number }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const conditions: any[] = [];

    // Build filter conditions
    if (filters.tableName) {
      conditions.push(eq(tables.auditTrail.tableName, filters.tableName));
    }
    if (filters.recordId) {
      conditions.push(eq(tables.auditTrail.recordId, filters.recordId));
    }
    if (filters.userId) {
      conditions.push(eq(tables.auditTrail.userId, filters.userId));
    }
    if (filters.action) {
      conditions.push(eq(tables.auditTrail.action, filters.action));
    }
    if (filters.fromDate) {
      conditions.push(gte(tables.auditTrail.createdAt, toQueryDate(filters.fromDate)));
    }
    if (filters.toDate) {
      // Add 1 day to include the entire end date
      const endDate = new Date(filters.toDate);
      endDate.setDate(endDate.getDate() + 1);
      conditions.push(lte(tables.auditTrail.createdAt, toQueryDate(endDate.toISOString().split('T')[0])));
    }

    // Text search in oldValue/newValue JSON
    if (filters.searchText) {
      const searchPattern = `%${filters.searchText}%`;
      conditions.push(
        or(
          like(tables.auditTrail.oldValue, searchPattern),
          like(tables.auditTrail.newValue, searchPattern)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.auditTrail)
      .where(whereClause);
    const total = Number(countResult[0]?.count || 0);

    // Get paginated results with user join
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const results = await db
      .select({
        id: tables.auditTrail.id,
        userId: tables.auditTrail.userId,
        userName: tables.users.fullName,
        userRole: tables.users.role,
        action: tables.auditTrail.action,
        tableName: tables.auditTrail.tableName,
        recordId: tables.auditTrail.recordId,
        oldValue: tables.auditTrail.oldValue,
        newValue: tables.auditTrail.newValue,
        ipAddress: tables.auditTrail.ipAddress,
        createdAt: tables.auditTrail.createdAt,
      })
      .from(tables.auditTrail)
      .leftJoin(tables.users, eq(tables.auditTrail.userId, tables.users.id))
      .where(whereClause)
      .orderBy(desc(tables.auditTrail.createdAt))
      .limit(limit)
      .offset(offset);

    // Transform results
    const logs: AuditLog[] = results.map((row: any) => ({
      id: row.id,
      userId: row.userId,
      userName: row.userName || 'ระบบ',
      userRole: row.userRole,
      action: row.action,
      tableName: row.tableName,
      recordId: row.recordId,
      oldValue: parseJsonSafe(row.oldValue),
      newValue: parseJsonSafe(row.newValue),
      ipAddress: row.ipAddress,
      createdAt: formatDateFromDb(row.createdAt) || new Date().toISOString(),
    }));

    return { logs, total };
  });
}

/**
 * Get audit logs for a specific entity (table + recordId)
 */
export async function getEntityAuditLogs(
  tableName: string,
  recordId: number,
  options: { limit?: number; offset?: number } = {}
): Promise<{ logs: AuditLog[]; total: number }> {
  return getAuditLogs({
    tableName,
    recordId,
    limit: options.limit,
    offset: options.offset,
  });
}

/**
 * Get audit logs by user
 */
export async function getUserAuditLogs(
  userId: number,
  options: { limit?: number; offset?: number; fromDate?: string; toDate?: string } = {}
): Promise<{ logs: AuditLog[]; total: number }> {
  return getAuditLogs({
    userId,
    ...options,
  });
}

/**
 * Get distinct users who modified a specific entity
 */
export async function getEntityModifiers(
  tableName: string,
  recordId: number
): Promise<Array<{ userId: number; userName: string; lastModified: string }>> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const results = await db
      .select({
        userId: tables.auditTrail.userId,
        userName: tables.users.fullName,
        lastModified: sql<string>`MAX(${tables.auditTrail.createdAt})`,
      })
      .from(tables.auditTrail)
      .leftJoin(tables.users, eq(tables.auditTrail.userId, tables.users.id))
      .where(
        and(
          eq(tables.auditTrail.tableName, tableName),
          eq(tables.auditTrail.recordId, recordId)
        )
      )
      .groupBy(tables.auditTrail.userId, tables.users.fullName);

    return results.map((row: any) => ({
      userId: row.userId,
      userName: row.userName || 'ระบบ',
      lastModified: formatDateFromDb(row.lastModified) || '',
    }));
  });
}

/**
 * Get distinct action types for a specific entity
 */
export async function getEntityActionTypes(
  tableName: string,
  recordId: number
): Promise<string[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const results = await db
      .selectDistinct({ action: tables.auditTrail.action })
      .from(tables.auditTrail)
      .where(
        and(
          eq(tables.auditTrail.tableName, tableName),
          eq(tables.auditTrail.recordId, recordId)
        )
      );

    return results.map((row: any) => row.action);
  });
}

/**
 * Parse field-level changes between old and new values
 */
export function parseFieldChanges(
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
  fieldLabels: Record<string, string> = {}
): FieldChange[] {
  const changes: FieldChange[] = [];

  if (!oldValue && !newValue) {
    return changes;
  }

  // For CREATE action (no oldValue)
  if (!oldValue && newValue) {
    Object.entries(newValue).forEach(([key, value]) => {
      if (shouldIncludeField(key, value)) {
        changes.push({
          fieldName: key,
          fieldLabel: fieldLabels[key] || formatFieldLabel(key),
          oldValue: null,
          newValue: value,
        });
      }
    });
    return changes;
  }

  // For DELETE action (no newValue)
  if (oldValue && !newValue) {
    Object.entries(oldValue).forEach(([key, value]) => {
      if (shouldIncludeField(key, value)) {
        changes.push({
          fieldName: key,
          fieldLabel: fieldLabels[key] || formatFieldLabel(key),
          oldValue: value,
          newValue: null,
        });
      }
    });
    return changes;
  }

  // For UPDATE action - compare fields
  if (oldValue && newValue) {
    const allKeys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);

    allKeys.forEach((key) => {
      const oldVal = oldValue[key];
      const newVal = newValue[key];

      // Skip if values are the same
      if (JSON.stringify(oldVal) === JSON.stringify(newVal)) {
        return;
      }

      // Skip internal fields
      if (!shouldIncludeField(key, newVal)) {
        return;
      }

      changes.push({
        fieldName: key,
        fieldLabel: fieldLabels[key] || formatFieldLabel(key),
        oldValue: oldVal ?? null,
        newValue: newVal ?? null,
      });
    });
  }

  return changes;
}

/**
 * Check if a field should be included in change display
 */
function shouldIncludeField(key: string, value: unknown): boolean {
  // Skip common internal fields
  const skipFields = ['id', 'createdAt', 'updatedAt', 'deletedAt', 'password', 'passwordHash'];
  if (skipFields.includes(key)) {
    return false;
  }

  // Skip null/undefined values
  if (value === null || value === undefined) {
    return false;
  }

  return true;
}

/**
 * Format field name to readable label
 */
function formatFieldLabel(fieldName: string): string {
  // Convert camelCase to Title Case with spaces
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Safely parse JSON string
 */
function parseJsonSafe(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

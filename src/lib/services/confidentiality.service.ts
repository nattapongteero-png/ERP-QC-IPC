/**
 * Confidentiality Service
 * Feature: BOM Confidentiality Protection (014-unit-cost)
 *
 * Provides CRUD operations for:
 * - Confidential Access Groups
 * - Group Members
 * - BOM Access Grants
 */

import { eq, count } from 'drizzle-orm';
import { getTableRef, executeDbOperation, getInsertId } from '../db/db-helper';
import { getNow } from '../db/date-utils';
import type {
  ConfidentialAccessGroup,
  ConfidentialAccessGroupCreate,
  ConfidentialAccessGroupUpdate,
} from '@/types/confidentiality';

/**
 * Get table references for confidentiality entities
 */
function getTables() {
  return {
    groups: getTableRef('confidentialAccessGroups'),
    groupMembers: getTableRef('confidentialAccessGroupMembers'),
    bomAccess: getTableRef('bOMConfidentialAccess'),
    users: getTableRef('users'),
  };
}

// ============ Confidential Access Groups ============

/**
 * Create a new confidential access group
 */
export async function createConfidentialAccessGroup(
  data: ConfidentialAccessGroupCreate
): Promise<{ id: number; code: string }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const result = await db.insert(tables.groups).values({
      code: data.code,
      name: data.name,
      description: data.description || null,
      createdAt: getNow(),
      updatedAt: getNow(),
    });
    const id = getInsertId(result);
    return { id, code: data.code };
  });
}

/**
 * Get a confidential access group by ID with member count
 */
export async function getConfidentialAccessGroup(
  id: number
): Promise<ConfidentialAccessGroup | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const rows = await db
      .select({
        id: tables.groups.id,
        code: tables.groups.code,
        name: tables.groups.name,
        description: tables.groups.description,
        createdAt: tables.groups.createdAt,
        updatedAt: tables.groups.updatedAt,
      })
      .from(tables.groups)
      .where(eq(tables.groups.id, id));

    if (rows.length === 0) return null;

    // Get member count
    const countResult = await db
      .select({ count: count() })
      .from(tables.groupMembers)
      .where(eq(tables.groupMembers.groupId, id));

    return {
      ...rows[0],
      memberCount: countResult[0]?.count || 0,
    };
  });
}

/**
 * List all confidential access groups with member counts
 */
export async function listConfidentialAccessGroups(): Promise<ConfidentialAccessGroup[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const rows = await db
      .select({
        id: tables.groups.id,
        code: tables.groups.code,
        name: tables.groups.name,
        description: tables.groups.description,
        createdAt: tables.groups.createdAt,
        updatedAt: tables.groups.updatedAt,
      })
      .from(tables.groups)
      .orderBy(tables.groups.name);

    // Get member counts for all groups
    const counts = await db
      .select({
        groupId: tables.groupMembers.groupId,
        count: count(),
      })
      .from(tables.groupMembers)
      .groupBy(tables.groupMembers.groupId);

    const countMap = new Map(
      counts.map((c: { groupId: number; count: number }) => [c.groupId, c.count])
    );

    return rows.map((row: { id: number; code: string; name: string; description: string | null; createdAt: string | Date; updatedAt: string | Date }) => ({
      ...row,
      memberCount: countMap.get(row.id) || 0,
    }));
  });
}

/**
 * Update a confidential access group
 */
export async function updateConfidentialAccessGroup(
  id: number,
  data: ConfidentialAccessGroupUpdate
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    await db
      .update(tables.groups)
      .set({
        ...data,
        updatedAt: getNow(),
      })
      .where(eq(tables.groups.id, id));
  });
}

/**
 * Delete a confidential access group and its members
 */
export async function deleteConfidentialAccessGroup(id: number): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    // Delete members first (foreign key constraint)
    await db.delete(tables.groupMembers).where(eq(tables.groupMembers.groupId, id));
    // Delete the group
    await db.delete(tables.groups).where(eq(tables.groups.id, id));
  });
}

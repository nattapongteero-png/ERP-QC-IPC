/**
 * Confidentiality Service
 * Feature: BOM Confidentiality Protection (014-unit-cost)
 *
 * Provides CRUD operations for:
 * - Confidential Access Groups
 * - Group Members
 * - BOM Access Grants
 */

import { eq, count, and, inArray } from 'drizzle-orm';
import { getTableRef, executeDbOperation, getInsertId } from '../db/db-helper';
import { getNow } from '../db/date-utils';
import type {
  ConfidentialAccessGroup,
  ConfidentialAccessGroupCreate,
  ConfidentialAccessGroupUpdate,
  ConfidentialAccessGroupMember,
  BOMConfidentialAccess,
  BOMConfidentialAccessCreate,
  FilteredBOMLine,
  BOMConfidentialityInfo,
  ConfidentialityOverride,
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
    bom: getTableRef('bOM'),
    settings: getTableRef('settings'),
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

// ============ Group Members ============

/**
 * Add a user to a confidential access group
 */
export async function addGroupMember(
  groupId: number,
  userId: number,
  addedBy: number
): Promise<{ id: number }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const result = await db.insert(tables.groupMembers).values({
      groupId,
      userId,
      addedBy,
      addedAt: getNow(),
    });
    return { id: getInsertId(result) };
  });
}

/**
 * Remove a user from a confidential access group
 */
export async function removeGroupMember(
  groupId: number,
  userId: number
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    await db
      .delete(tables.groupMembers)
      .where(
        and(
          eq(tables.groupMembers.groupId, groupId),
          eq(tables.groupMembers.userId, userId)
        )
      );
  });
}

/**
 * Get all members of a confidential access group with user info
 */
export async function getGroupMembers(
  groupId: number
): Promise<ConfidentialAccessGroupMember[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    return db
      .select({
        id: tables.groupMembers.id,
        groupId: tables.groupMembers.groupId,
        userId: tables.groupMembers.userId,
        addedAt: tables.groupMembers.addedAt,
        addedBy: tables.groupMembers.addedBy,
        userName: tables.users.name,
        userEmail: tables.users.email,
      })
      .from(tables.groupMembers)
      .leftJoin(tables.users, eq(tables.groupMembers.userId, tables.users.id))
      .where(eq(tables.groupMembers.groupId, groupId));
  });
}

/**
 * Get all groups that a user belongs to
 */
export async function getUserGroups(
  userId: number
): Promise<ConfidentialAccessGroup[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    return db
      .select({
        id: tables.groups.id,
        code: tables.groups.code,
        name: tables.groups.name,
        description: tables.groups.description,
      })
      .from(tables.groupMembers)
      .innerJoin(tables.groups, eq(tables.groupMembers.groupId, tables.groups.id))
      .where(eq(tables.groupMembers.userId, userId));
  });
}

/**
 * Get all group IDs that a user belongs to
 */
export async function getUserGroupIds(userId: number): Promise<number[]> {
  const groups = await getUserGroups(userId);
  return groups.map(g => g.id);
}

// ============ BOM Access Grants ============

/**
 * Grant access to a confidential BOM for a user or group
 */
export async function grantBOMAccess(
  data: BOMConfidentialAccessCreate,
  grantedBy: number
): Promise<{ id: number }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const result = await db.insert(tables.bomAccess).values({
      bomId: data.bomId,
      userId: data.userId || null,
      groupId: data.groupId || null,
      grantedBy,
      grantedAt: getNow(),
    });
    return { id: getInsertId(result) };
  });
}

/**
 * Revoke a BOM access grant
 */
export async function revokeBOMAccess(grantId: number): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    await db.delete(tables.bomAccess).where(eq(tables.bomAccess.id, grantId));
  });
}

/**
 * Get all access grants for a specific BOM
 */
export async function getBOMAccessList(bomId: number): Promise<BOMConfidentialAccess[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    return db
      .select({
        id: tables.bomAccess.id,
        bomId: tables.bomAccess.bomId,
        userId: tables.bomAccess.userId,
        groupId: tables.bomAccess.groupId,
        grantedBy: tables.bomAccess.grantedBy,
        grantedAt: tables.bomAccess.grantedAt,
      })
      .from(tables.bomAccess)
      .where(eq(tables.bomAccess.bomId, bomId));
  });
}

/**
 * Check if a user has access to a confidential BOM
 * Checks both direct user grants and group-based grants
 */
export async function userHasBOMAccess(
  userId: number,
  bomId: number
): Promise<boolean> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Check direct user grant
    const userGrant = await db
      .select({ id: tables.bomAccess.id })
      .from(tables.bomAccess)
      .where(
        and(
          eq(tables.bomAccess.bomId, bomId),
          eq(tables.bomAccess.userId, userId)
        )
      )
      .limit(1);

    if (userGrant.length > 0) return true;

    // Check group grants
    const userGroupIds = await getUserGroupIds(userId);
    if (userGroupIds.length === 0) return false;

    const groupGrant = await db
      .select({ id: tables.bomAccess.id })
      .from(tables.bomAccess)
      .where(
        and(
          eq(tables.bomAccess.bomId, bomId),
          inArray(tables.bomAccess.groupId, userGroupIds)
        )
      )
      .limit(1);

    return groupGrant.length > 0;
  });
}

// ============ Confidentiality Checks ============

/**
 * Check if a BOM line is confidential based on override and item settings
 */
export function isLineConfidential(
  line: { confidentialityOverride?: string | null },
  item: { defaultConfidential?: boolean; confidentialityLevel?: string }
): boolean {
  // BOM line override takes precedence
  if (line.confidentialityOverride === 'public') return false;
  if (line.confidentialityOverride === 'confidential') return true;

  // Fall back to item default (inherit behavior)
  return item.defaultConfidential === true ||
         item.confidentialityLevel === 'confidential';
}

/**
 * Get roles that bypass confidentiality checks
 */
export async function getBypassRoles(): Promise<string[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const result = await db
      .select({ value: tables.settings.value })
      .from(tables.settings)
      .where(eq(tables.settings.key, 'confidential_bypass_roles'))
      .limit(1);

    if (result.length === 0) return ['ADMIN']; // Default

    try {
      return JSON.parse(result[0].value || '["ADMIN"]');
    } catch {
      return ['ADMIN'];
    }
  });
}

/**
 * Set roles that bypass confidentiality checks
 */
export async function setBypassRoles(roles: string[]): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const value = JSON.stringify(roles);

    // Upsert pattern
    const existing = await db
      .select({ id: tables.settings.id })
      .from(tables.settings)
      .where(eq(tables.settings.key, 'confidential_bypass_roles'))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(tables.settings)
        .set({ value, updatedAt: getNow() })
        .where(eq(tables.settings.key, 'confidential_bypass_roles'));
    } else {
      await db.insert(tables.settings).values({
        key: 'confidential_bypass_roles',
        value,
        description: 'User roles that can view confidential BOM items without explicit access',
        category: 'confidentiality',
        createdAt: getNow(),
        updatedAt: getNow(),
      });
    }
  });
}

/**
 * Check if user can view confidential items in a BOM
 * Returns true if: user has bypass role, is BOM approver, or has explicit access
 */
export async function canViewConfidentialItems(
  userId: number,
  bomId: number,
  userRole?: string
): Promise<boolean> {
  // 1. Check bypass roles
  if (userRole) {
    const bypassRoles = await getBypassRoles();
    if (bypassRoles.includes(userRole)) return true;
  }

  return executeDbOperation(async (db) => {
    const tables = getTables();

    // 2. Check if user is BOM approver (since BOM doesn't have createdBy, use approvedBy)
    const bom = await db
      .select({ approvedBy: tables.bom.approvedBy })
      .from(tables.bom)
      .where(eq(tables.bom.id, bomId))
      .limit(1);

    if (bom.length > 0 && bom[0].approvedBy === userId) return true;

    // 3. Check explicit access
    return userHasBOMAccess(userId, bomId);
  });
}

// ============ BOM Line Filtering ============

export interface BOMLineWithItem {
  id: number;
  sequence: number;
  itemId: number;
  itemCode?: string;
  itemName?: string;
  quantity: number;
  unit?: string;
  unitCost?: number;
  totalCost?: number;
  isOptional?: boolean;
  notes?: string;
  confidentialityOverride?: string | null;
  item?: {
    defaultConfidential?: boolean;
    confidentialityLevel?: string;
  };
}

/**
 * Filter BOM lines based on user's access to confidential items
 * Returns filtered lines and metadata about confidentiality
 */
export function filterBOMLines(
  lines: BOMLineWithItem[],
  canViewConfidential: boolean
): { lines: FilteredBOMLine[]; info: BOMConfidentialityInfo } {
  let visibleCount = 0;
  let hasConfidential = false;

  const filteredLines = lines.map((line): FilteredBOMLine => {
    const item = line.item || {};
    const confidential = isLineConfidential(line, item);

    if (confidential) hasConfidential = true;

    if (!confidential || canViewConfidential) {
      visibleCount++;
      return {
        id: line.id,
        sequence: line.sequence,
        isConfidential: confidential,
        isHidden: false,
        itemId: line.itemId,
        itemCode: line.itemCode,
        itemName: line.itemName,
        quantity: line.quantity,
        unit: line.unit,
        unitCost: line.unitCost,
        totalCost: line.totalCost,
        isOptional: line.isOptional,
        notes: line.notes,
        confidentialityOverride: line.confidentialityOverride as ConfidentialityOverride | undefined,
      };
    }

    // Return placeholder for hidden confidential items
    return {
      id: line.id,
      sequence: line.sequence,
      isConfidential: true,
      isHidden: true,
      placeholder: '[Confidential Item]',
    };
  });

  return {
    lines: filteredLines,
    info: {
      hasConfidentialItems: hasConfidential,
      visibleLineCount: visibleCount,
      totalLineCount: lines.length,
      userHasFullAccess: canViewConfidential,
    },
  };
}

// DB-backed permission resolver with a short-lived in-memory cache.
//
// Semantics: a user's effective permission set = the rows in
// hr_role_permissions for their role code. Admin bypass is applied
// separately by isAdminRole(). The hardcoded PERMISSIONS map in
// src/lib/auth/index.ts is still the authoritative catalog of codes;
// the DB stores which of those codes each role currently holds, and
// is synced by scripts/sync-permissions-to-db.ts.
//
// Callers that need to gate a request should prefer `getRolePermissionSet`
// over the sync hasPermission(), so admin edits in the Role Management UI
// take effect without a deploy.

import { executeDbOperation } from '../db/db-helper';
import { getTableRef } from '../db/db-helper';
import { eq, sql } from 'drizzle-orm';

interface CacheEntry {
  permissions: Set<string>;
  expiresAt: number;
}

const CACHE_TTL_MS = 60 * 1000; // 60s — short enough that admin edits show up quickly
const cache = new Map<string, CacheEntry>();

/**
 * Return the set of permission codes granted to the given role from
 * hr_role_permissions. Results are cached in process memory for
 * CACHE_TTL_MS and can be explicitly invalidated via
 * invalidateRolePermissions() when the role is edited through the UI.
 *
 * Role codes are matched case-insensitively (UPPER-cased before lookup)
 * because user.role and hr_app_roles.code can be persisted in either case.
 */
export async function getRolePermissionSet(roleCode: string): Promise<Set<string>> {
  if (!roleCode) return new Set();
  const key = roleCode.trim().toUpperCase();
  const now = Date.now();

  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.permissions;
  }

  const permissions = await loadFromDb(key);
  cache.set(key, { permissions, expiresAt: now + CACHE_TTL_MS });
  return permissions;
}

async function loadFromDb(upperRoleCode: string): Promise<Set<string>> {
  try {
    return await executeDbOperation(async (db) => {
      const roles = getTableRef('HRAppRoles');
      const rolePerms = getTableRef('HRRolePermissions');
      const perms = getTableRef('HRAppPermissions');

      const rows = await db
        .select({ code: perms.code })
        .from(rolePerms)
        .innerJoin(roles, eq(rolePerms.roleId, roles.id))
        .innerJoin(perms, eq(rolePerms.permissionId, perms.id))
        .where(sql`UPPER(${roles.code}) = ${upperRoleCode}`);

      return new Set(rows.map((r: { code: string }) => r.code));
    });
  } catch (err) {
    // Be fault-tolerant: on DB failure, fall back to an empty set so the
    // caller can defer to the hardcoded PERMISSIONS map. We don't want a
    // transient DB issue to start denying every request.
    console.error('[permission-resolver] failed to load role permissions:', err);
    return new Set();
  }
}

/**
 * Drop the cached permission set for one role (after admin edits) or for
 * all roles (pass no argument) so the next request repopulates from DB.
 */
export function invalidateRolePermissions(roleCode?: string): void {
  if (!roleCode) {
    cache.clear();
    return;
  }
  cache.delete(roleCode.trim().toUpperCase());
}

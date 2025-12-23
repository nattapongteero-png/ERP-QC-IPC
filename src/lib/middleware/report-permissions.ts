/**
 * Report Permission Middleware Utilities
 * Provides permission checking functions for report API endpoints
 */

import { getSession } from '@/lib/auth';
import { getDb, isSqlite } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export type ReportPermissionType = 'view' | 'export' | 'design';

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  userId?: number;
  userRole?: string;
}

/**
 * Check if the current user has permission to perform an action on a report template
 */
export async function checkReportPermission(
  templateCode: string,
  permissionType: ReportPermissionType
): Promise<PermissionCheckResult> {
  try {
    // Get current session
    const session = await getSession();
    if (!session) {
      return { allowed: false, reason: 'Not authenticated' };
    }

    const db = await getDb();
     
    const usingSqlite = isSqlite();

    const templatesTable = usingSqlite
      ? schema.sqliteReportTemplates
      : schema.mysqlReportTemplates;
    const permissionsTable = usingSqlite
      ? schema.sqliteReportPermissions
      : schema.mysqlReportPermissions;

    // Get template
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const templates = await (db as any)
      .select({
        id: templatesTable.id,
        isPublished: templatesTable.isPublished,
        isSystem: templatesTable.isSystem,
        createdBy: templatesTable.createdBy,
      })
      .from(templatesTable)
      .where(eq(templatesTable.code, templateCode))
      .limit(1);

    if (templates.length === 0) {
      return { allowed: false, reason: 'Template not found' };
    }

    const template = templates[0];

    // Admin users have full access
    if (session.role === 'admin') {
      return { allowed: true, userId: session.userId, userRole: session.role };
    }

    // Template creators can always access their own templates
    if (template.createdBy === session.userId) {
      return { allowed: true, userId: session.userId, userRole: session.role };
    }

    // Check if template is published (for view/export)
    if (permissionType === 'view' || permissionType === 'export') {
      if (!template.isPublished) {
        // Non-published templates require explicit permission
        // Fall through to permission check below
      }
    }

    // Check specific permissions for the user's role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const permissions = await (db as any)
      .select({
        role: permissionsTable.role,
        canView: permissionsTable.canView,
        canDesign: permissionsTable.canDesign,
        canExport: permissionsTable.canExport,
      })
      .from(permissionsTable)
      .where(
        and(
          eq(permissionsTable.templateId, template.id),
          eq(permissionsTable.role, session.role || 'user')
        )
      )
      .limit(1);

    if (permissions.length > 0) {
      const perm = permissions[0];
      let hasPermission = false;

      switch (permissionType) {
        case 'view':
          hasPermission = perm.canView;
          break;
        case 'export':
          hasPermission = perm.canExport;
          break;
        case 'design':
          hasPermission = perm.canDesign;
          break;
      }

      if (hasPermission) {
        return { allowed: true, userId: session.userId, userRole: session.role };
      } else {
        return { allowed: false, reason: `No ${permissionType} permission for role ${session.role}` };
      }
    }

    // No specific permissions found - use defaults
    // Published templates can be viewed by anyone
    if (template.isPublished && permissionType === 'view') {
      return { allowed: true, userId: session.userId, userRole: session.role };
    }

    // Default: deny access if no specific permission
    return { allowed: false, reason: 'No permission configured for this role' };
  } catch (error) {
    console.error('Permission check error:', error);
    return { allowed: false, reason: 'Permission check failed' };
  }
}

/**
 * Get all permissions for a user on a specific template
 */
export async function getUserTemplatePermissions(
  templateCode: string,
  userId: number,
  userRole: string
): Promise<{ canView: boolean; canExport: boolean; canDesign: boolean }> {
  try {
    const db = await getDb();
     
    const usingSqlite = isSqlite();

    const templatesTable = usingSqlite
      ? schema.sqliteReportTemplates
      : schema.mysqlReportTemplates;
    const permissionsTable = usingSqlite
      ? schema.sqliteReportPermissions
      : schema.mysqlReportPermissions;

    // Admin users have full access
    if (userRole === 'admin') {
      return { canView: true, canExport: true, canDesign: true };
    }

    // Get template
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const templates = await (db as any)
      .select({
        id: templatesTable.id,
        isPublished: templatesTable.isPublished,
        createdBy: templatesTable.createdBy,
      })
      .from(templatesTable)
      .where(eq(templatesTable.code, templateCode))
      .limit(1);

    if (templates.length === 0) {
      return { canView: false, canExport: false, canDesign: false };
    }

    const template = templates[0];

    // Template creators have full access
    if (template.createdBy === userId) {
      return { canView: true, canExport: true, canDesign: true };
    }

    // Get role-based permissions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const permissions = await (db as any)
      .select({
        canView: permissionsTable.canView,
        canDesign: permissionsTable.canDesign,
        canExport: permissionsTable.canExport,
      })
      .from(permissionsTable)
      .where(
        and(
          eq(permissionsTable.templateId, template.id),
          eq(permissionsTable.role, userRole)
        )
      )
      .limit(1);

    if (permissions.length > 0) {
      return {
        canView: permissions[0].canView,
        canExport: permissions[0].canExport,
        canDesign: permissions[0].canDesign,
      };
    }

    // Default permissions based on publish status
    return {
      canView: template.isPublished,
      canExport: template.isPublished,
      canDesign: false,
    };
  } catch (error) {
    console.error('Get user permissions error:', error);
    return { canView: false, canExport: false, canDesign: false };
  }
}

/**
 * Require authentication and return session or throw
 */
export async function requireAuth(): Promise<{
  userId: number;
  role: string;
  email: string;
}> {
  const session = await getSession();
  if (!session) {
    throw new Error('Authentication required');
  }
  return {
    userId: session.userId,
    role: session.role || 'user',
    email: session.email || '',
  };
}

/**
 * Require admin role
 */
export async function requireAdmin(): Promise<{
  userId: number;
  role: string;
  email: string;
}> {
  const session = await requireAuth();
  if (session.role !== 'admin') {
    throw new Error('Admin access required');
  }
  return session;
}

import {
  getSession,
  PERMISSIONS,
  hasPermission,
  isAdminRole,
  type Permission,
  type Role,
} from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-utils';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return unauthorizedResponse('Not authenticated');
    }

    // Compute the permission codes this user has, so the client can gate UI
    // elements (buttons, menus) without re-implementing the role mapping.
    // A permission is granted when EITHER the hardcoded defaults or the DB
    // role-permission table allows it. Admin short-circuits to every code.
    const allCodes = Object.keys(PERMISSIONS) as Permission[];
    let permissionCodes: Permission[];

    if (isAdminRole(session.role)) {
      permissionCodes = allCodes;
    } else {
      const dbPerms = await getRolePermissionSet(session.role);
      permissionCodes = allCodes.filter(
        (code) => dbPerms.has(code) || hasPermission(session.role as Role, code)
      );
    }

    return successResponse({
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
        permissions: permissionCodes,
      },
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}

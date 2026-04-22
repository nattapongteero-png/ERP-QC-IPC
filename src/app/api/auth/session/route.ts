import { getSession, PERMISSIONS, hasPermission, type Permission, type Role } from '@/lib/auth';
import { successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-utils';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return unauthorizedResponse('Not authenticated');
    }

    // Compute the permission codes this user has, so the client can gate UI
    // elements (buttons, menus) without re-implementing the role mapping.
    const permissionCodes = (Object.keys(PERMISSIONS) as Permission[]).filter((code) =>
      hasPermission(session.role as Role, code)
    );

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

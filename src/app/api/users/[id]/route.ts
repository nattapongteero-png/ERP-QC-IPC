import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/users/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const userId = parseInt(id);
      
      if (isNaN(userId)) {
        return errorResponse('Invalid user ID');
      }
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const usersTable = useSqlite ? schema.sqliteUsers : schema.mysqlUsers;
      
      const users = await (db as any)
        .select({
          id: usersTable.id,
          email: usersTable.email,
          name: usersTable.name,
          role: usersTable.role,
          department: usersTable.department,
          isActive: usersTable.isActive,
          createdAt: usersTable.createdAt,
          updatedAt: usersTable.updatedAt,
        })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);
      
      if (users.length === 0) {
        return notFoundResponse('User not found');
      }
      
      return successResponse(users[0]);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['users:read']);
}

// PUT /api/users/[id]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const userId = parseInt(id);
      
      if (isNaN(userId)) {
        return errorResponse('Invalid user ID');
      }
      
      const body = await request.json();
      const { email, password, name, role, department, isActive } = body;
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const usersTable = useSqlite ? schema.sqliteUsers : schema.mysqlUsers;
      
      // Get existing user
      const existing = await (db as any)
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);
      
      if (existing.length === 0) {
        return notFoundResponse('User not found');
      }
      
      const oldUser = existing[0];
      
      // Build update object
      const updateData: any = {
        updatedAt: useSqlite ? new Date().toISOString() : new Date(),
      };
      
      if (email !== undefined) updateData.email = email;
      if (name !== undefined) updateData.name = name;
      if (role !== undefined) updateData.role = role;
      if (department !== undefined) updateData.department = department;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (password) updateData.password = await hashPassword(password);
      
      // Update user
      await (db as any)
        .update(usersTable)
        .set(updateData)
        .where(eq(usersTable.id, userId));
      
      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'users',
        recordId: userId,
        oldValue: { email: oldUser.email, name: oldUser.name, role: oldUser.role },
        newValue: { email, name, role, department, isActive },
        ipAddress: getClientIP(request),
      });
      
      return successResponse({ id: userId }, 'User updated successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['users:write']);
}

// DELETE /api/users/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const userId = parseInt(id);
      
      if (isNaN(userId)) {
        return errorResponse('Invalid user ID');
      }
      
      // Prevent self-deletion
      if (userId === session.userId) {
        return errorResponse('Cannot delete your own account');
      }
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const usersTable = useSqlite ? schema.sqliteUsers : schema.mysqlUsers;
      
      // Get existing user
      const existing = await (db as any)
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);
      
      if (existing.length === 0) {
        return notFoundResponse('User not found');
      }
      
      // Soft delete - set isActive to false
      await (db as any)
        .update(usersTable)
        .set({ isActive: false, updatedAt: useSqlite ? new Date().toISOString() : new Date() })
        .where(eq(usersTable.id, userId));
      
      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'DELETE',
        tableName: 'users',
        recordId: userId,
        oldValue: { email: existing[0].email, name: existing[0].name },
        ipAddress: getClientIP(request),
      });
      
      return successResponse({ id: userId }, 'User deleted successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['users:delete']);
}

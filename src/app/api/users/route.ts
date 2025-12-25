import { NextRequest } from 'next/server';
import { eq, like, or, sql, type SQL } from 'drizzle-orm';
import { getTableRef, executeDbOperation, getInsertId } from '@/lib/db/db-helper';
import { hashPassword } from '@/lib/auth';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
  getPaginationParams,
  createPaginatedResponse,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

// GET /api/users - List users
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const role = searchParams.get('role') || '';

      const usersTable = getTableRef('users');

      // Build conditions
      const conditions: (SQL | undefined)[] = [];
      if (search) {
        conditions.push(
          or(
            like(usersTable.email, `%${search}%`),
            like(usersTable.name, `%${search}%`)
          )
        );
      }
      if (role) {
        conditions.push(eq(usersTable.role, role));
      }

      const whereClause = conditions.length > 0
        ? conditions.reduce((acc, cond, i) => (i === 0 ? cond : sql`${acc} AND ${cond}`))
        : undefined;

      // Get total count
      const total = await executeDbOperation(async (db) => {
        const countResult = await db
          .select({ count: sql`count(*)` })
          .from(usersTable);
        return Number(countResult[0]?.count || 0);
      });

      // Get paginated results
      const offset = (pagination.page - 1) * pagination.limit;
      const users = await executeDbOperation(async (db) => {
        let query = db.select({
          id: usersTable.id,
          email: usersTable.email,
          name: usersTable.name,
          role: usersTable.role,
          department: usersTable.department,
          isActive: usersTable.isActive,
          createdAt: usersTable.createdAt,
        }).from(usersTable);

        if (whereClause) {
          query = query.where(whereClause);
        }

        return query.limit(pagination.limit).offset(offset);
      });

      return successResponse(createPaginatedResponse(users, total, pagination));
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['users:read']);
}

// POST /api/users - Create user
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const { email, password, name, role, department } = body;

      if (!email || !password || !name) {
        return errorResponse('Email, password, and name are required');
      }

      const usersTable = getTableRef('users');

      // Check if email exists
      const existing = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, email))
          .limit(1);
      });

      if (existing.length > 0) {
        return errorResponse('Email already exists');
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const result = await executeDbOperation(async (db) => {
        return db.insert(usersTable).values({
          email,
          password: hashedPassword,
          name,
          role: role || 'user',
          department,
        });
      });

      const userId = getInsertId(result);

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'users',
        recordId: Number(userId),
        newValue: { email, name, role, department },
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: Number(userId) }, 'User created successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['users:write']);
}

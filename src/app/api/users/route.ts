import { NextRequest } from 'next/server';
import { eq, like, or, sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
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
  return withAuth(async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const role = searchParams.get('role') || '';
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const usersTable = useSqlite ? schema.sqliteUsers : schema.mysqlUsers;
      
      // Build query
      let query = (db as any).select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        department: usersTable.department,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
      }).from(usersTable);
      
      // Apply filters
      const conditions = [];
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
      
      if (conditions.length > 0) {
        query = query.where(conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`);
      }
      
      // Get total count
      const countResult = await (db as any)
        .select({ count: sql`count(*)` })
        .from(usersTable);
      const total = Number(countResult[0]?.count || 0);
      
      // Apply pagination
      const offset = (pagination.page - 1) * pagination.limit;
      const users = await query.limit(pagination.limit).offset(offset);
      
      return successResponse(createPaginatedResponse(users, total, pagination));
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['users:read']);
}

// POST /api/users - Create user
export async function POST(request: NextRequest) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const { email, password, name, role, department } = body;
      
      if (!email || !password || !name) {
        return errorResponse('Email, password, and name are required');
      }
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const usersTable = useSqlite ? schema.sqliteUsers : schema.mysqlUsers;
      
      // Check if email exists
      const existing = await (db as any)
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);
      
      if (existing.length > 0) {
        return errorResponse('Email already exists');
      }
      
      // Hash password
      const hashedPassword = await hashPassword(password);
      
      // Create user
      const result = await (db as any).insert(usersTable).values({
        email,
        password: hashedPassword,
        name,
        role: role || 'user',
        department,
      });
      
      const userId = useSqlite ? result.lastInsertRowid : result[0].insertId;
      
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

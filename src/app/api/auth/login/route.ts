import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { verifyPassword, setSession } from '@/lib/auth';
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return errorResponse('Email and password are required');
    }

    console.log('Login attempt - DB_TYPE:', process.env.DB_TYPE);
    const db = await getDb();
    const useSqlite = process.env.DB_TYPE === 'sqlite';
    console.log('useSqlite:', useSqlite);

    // Find user
    let user;
    if (useSqlite) {
      const users = await (db as any)
        .select()
        .from(schema.sqliteUsers)
        .where(eq(schema.sqliteUsers.email, email))
        .limit(1);
      user = users[0];
    } else {
      const users = await (db as any)
        .select()
        .from(schema.mysqlUsers)
        .where(eq(schema.mysqlUsers.email, email))
        .limit(1);
      user = users[0];
    }

    if (!user) {
      return errorResponse('Invalid email or password', 401);
    }

    if (!user.isActive) {
      return errorResponse('Account is disabled', 401);
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return errorResponse('Invalid email or password', 401);
    }

    // Create session
    await setSession({
      userId: user.userId,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    // Log login
    await createAuditLog({
      userId: user.userId,
      action: 'LOGIN',
      ipAddress: getClientIP(request),
    });

    return successResponse({
      user: {
        id: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
      },
    }, 'Login successful');
  } catch (error) {
    console.error('Login error:', error);
    return serverErrorResponse(error);
  }
}

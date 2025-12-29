import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { verifyPassword, setSession } from '@/lib/auth';
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid request body');
    }
    const { email, password } = body;

    if (!email || !password) {
      return errorResponse('Email and password are required');
    }

    const usersTable = getTableRef('users');

    // Find user
    const users = await executeDbOperation(async (db) => {
      return db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);
    });

    const user = users[0];

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
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    // Log login
    await createAuditLog({
      userId: user.id,
      action: 'LOGIN',
      ipAddress: getClientIP(request),
    });

    return successResponse({
      user: {
        id: user.id,
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

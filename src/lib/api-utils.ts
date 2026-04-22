import { NextResponse } from 'next/server';
import { getSession, hasPermission, isAdminRole, Permission, Role } from './auth';
import { getRolePermissionSet } from './auth/permission-resolver';

// Check if running in development mode
export function isDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export interface ErrorDetails {
  message: string;
  stack?: string;
  name?: string;
  cause?: string;
  code?: string;
  path?: string;
  timestamp: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  // Debug information only included in development mode
  debug?: ErrorDetails;
}

// Extract error details from unknown error type
function extractErrorDetails(error: unknown, context?: string): ErrorDetails {
  const timestamp = new Date().toISOString();

  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause ? String(error.cause) : undefined,
      code: (error as any).code,
      path: context,
      timestamp,
    };
  }

  if (typeof error === 'string') {
    return {
      message: error,
      path: context,
      timestamp,
    };
  }

  return {
    message: String(error),
    path: context,
    timestamp,
  };
}

export function successResponse<T>(data: T, message?: string): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message,
  });
}

export function errorResponse(
  error: string,
  status: number = 400,
  additionalData?: Record<string, unknown>,
  context?: string
): NextResponse<ApiResponse> {
  const response: ApiResponse = {
    success: false,
    error,
    ...additionalData, // Spread additional data fields (e.g., { errors: [...] })
  };

  // Include context in development mode if provided
  if (isDevelopment() && context) {
    response.debug = {
      message: error,
      path: context,
      timestamp: new Date().toISOString(),
    };
  }

  return NextResponse.json(response, { status });
}

export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status: 401 }
  );
}

export function forbiddenResponse(message: string = 'Forbidden'): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status: 403 }
  );
}

export function notFoundResponse(message: string = 'Not found'): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status: 404 }
  );
}

export function serverErrorResponse(error: unknown, context?: string): NextResponse<ApiResponse> {
  console.error('Server error:', error);

  const response: ApiResponse = {
    success: false,
    error: 'Internal server error',
  };

  // Include detailed error information in development mode
  if (isDevelopment()) {
    response.debug = extractErrorDetails(error, context);
    // Also include the actual error message in development
    if (error instanceof Error) {
      response.error = error.message;
    }
  }

  return NextResponse.json(response, { status: 500 });
}

/**
 * Build a descriptive forbidden response body that tells the caller EXACTLY
 * which permission they are missing plus a Thai message admins can act on.
 *
 * Rationale: the original generic "You do not have permission to perform this
 * action" gave no indication of which permission to grant. When a user hit
 * it they had to dig through code or contact dev — now both the user and the
 * admin see the missing permission code right in the error toast.
 */
function buildMissingPermissionResponse(
  missing: string[],
  userRole: string | null | undefined,
  path?: string,
): NextResponse<ApiResponse> {
  const missingList = missing.join(', ');
  const roleLabel = userRole || 'unknown';
  // Bilingual message — Thai first (primary audience), English for logs.
  const thaiMsg = `ไม่มีสิทธิ์ทำรายการนี้ — role "${roleLabel}" ขาด permission: ${missingList}. กรุณาติดต่อผู้ดูแลระบบเพิ่มสิทธิ์ใน HR → Roles`;
  const response: ApiResponse = {
    success: false,
    error: thaiMsg,
    // Structured fields for frontend toast + bug reporting
    ...(({
      missingPermissions: missing,
      userRole: roleLabel,
      actionHint: 'เพิ่มสิทธิ์นี้ให้ role ใน /hr/roles หรือเปลี่ยน user ให้เป็น role ที่มีสิทธิ์',
    } as unknown) as Record<string, unknown>),
  };
  if (isDevelopment()) {
    response.debug = {
      message: `Missing permissions: ${missingList}`,
      path,
      timestamp: new Date().toISOString(),
    };
  }
  return NextResponse.json(response, { status: 403 });
}

// Middleware helper for protected routes
export async function withAuth(
  request: Request,
  handler: (session: NonNullable<Awaited<ReturnType<typeof getSession>>>) => Promise<NextResponse>,
  requiredPermissions?: Permission[]
): Promise<NextResponse> {
  const session = await getSession();

  if (!session) {
    return unauthorizedResponse('Please login to continue');
  }

  if (requiredPermissions && requiredPermissions.length > 0) {
    // Administrator bypasses all permission checks
    if (!isAdminRole(session.role)) {
      // Grant a permission if EITHER the hardcoded PERMISSIONS map allows
      // it (the built-in defaults) OR the DB-backed role-permission table
      // allows it (admin overrides through /hr/roles). This makes the
      // Role Management UI effective without requiring every legacy code
      // path to migrate off the static map.
      const dbPerms = await getRolePermissionSet(session.role);
      const missing = requiredPermissions.filter((permission) => {
        if (dbPerms.has(permission)) return false;
        return !hasPermission(session.role as Role, permission);
      });

      if (missing.length > 0) {
        const url = new URL(request.url);
        return buildMissingPermissionResponse(
          missing,
          session.role,
          `${request.method} ${url.pathname}`,
        );
      }
    }
  }

  return handler(session);
}

// Pagination helper
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function getPaginationParams(searchParams: URLSearchParams): PaginationParams {
  return {
    page: Math.max(1, parseInt(searchParams.get('page') || '1')),
    limit: Math.min(1000, Math.max(1, parseInt(searchParams.get('limit') || '20'))),
    sortBy: searchParams.get('sortBy') || undefined,
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
  };
}

export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  return {
    items,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}

// Alias functions for backward compatibility
export function createErrorResponse(error: string, status?: number): { success: false; error: string } {
  return { success: false, error };
}

export function createSuccessResponse<T>(data: T, message?: string): { success: true; data: T; message?: string } {
  return { success: true, data, message };
}

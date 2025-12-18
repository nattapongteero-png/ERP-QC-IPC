import { NextResponse } from 'next/server';
import { getSession, hasPermission, Permission, Role } from './auth';

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
  debugError?: unknown,
  context?: string
): NextResponse<ApiResponse> {
  const response: ApiResponse = {
    success: false,
    error,
  };

  // Include debug information in development mode if error object is provided
  if (isDevelopment() && debugError) {
    response.debug = extractErrorDetails(debugError, context);
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
    const hasAllPermissions = requiredPermissions.every(permission =>
      hasPermission(session.role as Role, permission)
    );
    
    if (!hasAllPermissions) {
      return forbiddenResponse('You do not have permission to perform this action');
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
    limit: Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20'))),
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

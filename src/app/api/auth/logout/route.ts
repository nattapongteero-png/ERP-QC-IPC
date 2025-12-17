import { NextRequest } from 'next/server';
import { clearSession, getSession } from '@/lib/auth';
import { successResponse, serverErrorResponse } from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (session) {
      await createAuditLog({
        userId: session.userId,
        action: 'LOGOUT',
        ipAddress: getClientIP(request),
      });
    }
    
    await clearSession();
    
    return successResponse(null, 'Logout successful');
  } catch (error) {
    return serverErrorResponse(error);
  }
}

import { getSession } from '@/lib/auth';
import { successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-utils';

export async function GET() {
  try {
    const session = await getSession();
    
    if (!session) {
      return unauthorizedResponse('Not authenticated');
    }
    
    return successResponse({
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
      },
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}

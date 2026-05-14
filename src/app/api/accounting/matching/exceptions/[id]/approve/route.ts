/**
 * Approve Matching Exception API (T114)
 * POST /api/accounting/matching/exceptions/[id]/approve
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { approveException } from '@/lib/services/matching.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await context.params;
      const exceptionId = parseInt(id, 10);

      if (isNaN(exceptionId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid exception ID' },
          { status: 400 }
        );
      }

      // Get optional comments from body
      let comments;
      try {
        const body = await request.json();
        comments = body.comments;
      } catch {
        // No body provided
      }

      // TODO: Get actual user ID from session
      const userId = session.userId;

      const result = await approveException(exceptionId, userId, comments);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error approving exception:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }

  });
}

/**
 * Reject Request API (T126)
 * POST /api/accounting/approvals/[id]/reject
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { rejectRequest } from '@/lib/services/approval-workflow.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await context.params;
      const requestId = parseInt(id, 10);

      if (isNaN(requestId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid request ID' },
          { status: 400 }
        );
      }

      // Get comments from body (required for rejection)
      let comments = '';
      try {
        const body = await request.json();
        comments = body.comments || '';
      } catch {
        // No body provided
      }

      if (!comments.trim()) {
        return NextResponse.json(
          { success: false, error: 'Comments are required for rejection' },
          { status: 400 }
        );
      }

      // TODO: Get actual user ID from session
      const userId = session.userId;

      const result = await rejectRequest(requestId, userId, comments);
      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      console.error('Error rejecting request:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }

  });
}

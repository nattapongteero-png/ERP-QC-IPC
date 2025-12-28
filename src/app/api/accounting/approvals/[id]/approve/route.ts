/**
 * Approve Request API (T126)
 * POST /api/accounting/approvals/[id]/approve
 */

import { NextRequest, NextResponse } from 'next/server';
import { approveRequest } from '@/lib/services/approval-workflow.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const requestId = parseInt(id, 10);

    if (isNaN(requestId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request ID' },
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
    const userId = 1;

    const result = await approveRequest(requestId, userId, comments);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error approving request:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

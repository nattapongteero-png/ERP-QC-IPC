/**
 * Issue Assignment API Route
 * Feature: Issue Tracker
 *
 * POST /api/issues/:id/assign - Assign owner to issue
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { getIssue, updateIssue } from '@/lib/services/issues.service';
import { issueAssignSchema } from '@/lib/validation/issues';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Only managers and admins can assign issues
    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'issues:assign')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied - Manager or Admin only' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const issueId = parseInt(id, 10);
    if (isNaN(issueId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid issue ID' },
        { status: 400 }
      );
    }

    // Verify issue exists
    const existingIssue = await getIssue(issueId);
    if (!existingIssue) {
      return NextResponse.json(
        { success: false, error: 'Issue not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parseResult = issueAssignSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { assigneeId } = parseResult.data;

    // Update issue with the new assignee
    const issue = await updateIssue(issueId, { assigneeId }, session.userId);

    return NextResponse.json({
      success: true,
      data: issue,
    });
  } catch (error) {
    console.error('Error assigning issue:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to assign issue' },
      { status: 500 }
    );
  }
}

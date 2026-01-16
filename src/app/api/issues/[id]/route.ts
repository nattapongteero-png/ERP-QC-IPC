/**
 * Issue Detail API Routes
 * Feature: Issue Tracker
 *
 * GET /api/issues/:id - Get issue details
 * PUT /api/issues/:id - Update issue
 * DELETE /api/issues/:id - Delete issue (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { getIssue, updateIssue, deleteIssue } from '@/lib/services/issues.service';
import { issueUpdateSchema } from '@/lib/validation/issues';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'issues:read')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
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

    const issue = await getIssue(issueId);
    if (!issue) {
      return NextResponse.json(
        { success: false, error: 'Issue not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: issue,
    });
  } catch (error) {
    console.error('Error fetching issue:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch issue' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'issues:write')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
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

    const body = await request.json();
    const parseResult = issueUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const issue = await updateIssue(issueId, parseResult.data, session.userId);

    return NextResponse.json({
      success: true,
      data: issue,
    });
  } catch (error) {
    console.error('Error updating issue:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update issue' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Only admin can delete issues
    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'issues:delete')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied - Admin only' },
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

    await deleteIssue(issueId);

    return NextResponse.json({
      success: true,
      message: 'Issue deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting issue:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete issue' },
      { status: 500 }
    );
  }
}

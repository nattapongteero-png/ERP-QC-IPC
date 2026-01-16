/**
 * Issue Comments API Routes
 * Feature: Issue Tracker
 *
 * GET /api/issues/:id/comments - List comments for an issue
 * POST /api/issues/:id/comments - Create a new comment on an issue
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { getIssue } from '@/lib/services/issues.service';
import { listComments, createComment } from '@/lib/services/issues-comments.service';
import { issueCommentCreateSchema } from '@/lib/validation/issues';

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

    // Verify issue exists
    const issue = await getIssue(issueId);
    if (!issue) {
      return NextResponse.json(
        { success: false, error: 'Issue not found' },
        { status: 404 }
      );
    }

    const comments = await listComments(issueId);

    return NextResponse.json({
      success: true,
      data: comments,
    });
  } catch (error) {
    console.error('Error listing comments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list comments' },
      { status: 500 }
    );
  }
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
    const parseResult = issueCommentCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const comment = await createComment(issueId, parseResult.data, session.userId);

    return NextResponse.json({
      success: true,
      data: comment,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create comment' },
      { status: 500 }
    );
  }
}

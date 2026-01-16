/**
 * Single Comment API Routes
 * Feature: Issue Tracker
 *
 * PUT /api/issues/:id/comments/:commentId - Update a comment
 * DELETE /api/issues/:id/comments/:commentId - Delete a comment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission, ROLES } from '@/lib/auth';
import { updateComment, deleteComment, getComment } from '@/lib/services/issues-comments.service';
import { issueCommentUpdateSchema } from '@/lib/validation/issues';

interface RouteParams {
  params: Promise<{ id: string; commentId: string }>;
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

    const { commentId } = await params;
    const commentIdNum = parseInt(commentId, 10);
    if (isNaN(commentIdNum)) {
      return NextResponse.json(
        { success: false, error: 'Invalid comment ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parseResult = issueCommentUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    // updateComment takes (commentId, content, actorId)
    const comment = await updateComment(commentIdNum, parseResult.data.content, session.userId);

    return NextResponse.json({
      success: true,
      data: comment,
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update comment';

    // Check for author-only error
    if (errorMessage.includes('Only the author')) {
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 403 }
      );
    }

    // Check for not found error
    if (errorMessage.includes('not found')) {
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
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

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'issues:write')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { commentId } = await params;
    const commentIdNum = parseInt(commentId, 10);
    if (isNaN(commentIdNum)) {
      return NextResponse.json(
        { success: false, error: 'Invalid comment ID' },
        { status: 400 }
      );
    }

    // Check if comment exists
    const existingComment = await getComment(commentIdNum);
    if (!existingComment) {
      return NextResponse.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      );
    }

    // Check if user is admin (for delete permission)
    const isAdmin = session.role === ROLES.ADMIN;

    // deleteComment takes (commentId, actorId, isAdmin)
    await deleteComment(commentIdNum, session.userId, isAdmin);

    return NextResponse.json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete comment';

    // Check for authorization error
    if (errorMessage.includes('Only the author') || errorMessage.includes('admin')) {
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

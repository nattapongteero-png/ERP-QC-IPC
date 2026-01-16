/**
 * Issue Status Change API Route
 * Feature: Issue Tracker
 *
 * POST /api/issues/:id/status - Change issue status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission, ROLES } from '@/lib/auth';
import { getIssue, updateIssue } from '@/lib/services/issues.service';
import { issueStatusChangeSchema } from '@/lib/validation/issues';
import type { IssueStatus } from '@/types/issues';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Status transitions and their required permissions
// Some statuses can only be set by managers/admins
const RESTRICTED_STATUSES: IssueStatus[] = ['triaged', 'closed'];

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

    // Verify issue exists
    const existingIssue = await getIssue(issueId);
    if (!existingIssue) {
      return NextResponse.json(
        { success: false, error: 'Issue not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parseResult = issueStatusChangeSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { status } = parseResult.data;

    // Check if user has permission to set restricted statuses
    if (RESTRICTED_STATUSES.includes(status)) {
      const isManagerOrAdmin = session.role === ROLES.ADMIN || session.role === ROLES.MANAGER;
      if (!isManagerOrAdmin) {
        return NextResponse.json(
          { success: false, error: `Permission denied - Cannot change status to '${status}'` },
          { status: 403 }
        );
      }
    }

    // Update issue with the new status
    const issue = await updateIssue(issueId, { status }, session.userId);

    return NextResponse.json({
      success: true,
      data: issue,
    });
  } catch (error) {
    console.error('Error changing issue status:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to change issue status' },
      { status: 500 }
    );
  }
}

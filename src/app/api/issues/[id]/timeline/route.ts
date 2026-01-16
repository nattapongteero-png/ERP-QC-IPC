/**
 * Issue Timeline API Route
 * Feature: Issue Tracker
 *
 * GET /api/issues/:id/timeline - Get unified timeline of audit events and comments
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { getIssue } from '@/lib/services/issues.service';
import { getIssueTimeline, getTimelineCount } from '@/lib/services/issues-timeline.service';

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

    // Get timeline and counts
    const [timeline, counts] = await Promise.all([
      getIssueTimeline(issueId),
      getTimelineCount(issueId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        timeline,
        counts,
      },
    });
  } catch (error) {
    console.error('Error getting timeline:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get timeline' },
      { status: 500 }
    );
  }
}

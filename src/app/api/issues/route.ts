/**
 * Issues API Routes
 * Feature: Issue Tracker
 *
 * GET /api/issues - List issues with filtering and pagination
 * POST /api/issues - Create a new issue
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { listIssues, createIssue } from '@/lib/services/issues.service';
import { issueCreateSchema } from '@/lib/validation/issues';
import type { IssueListFilters, IssueStatus } from '@/types/issues';

export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const filters: IssueListFilters = {};

    const status = searchParams.get('status');
    if (status) {
      filters.status = status as IssueStatus;
    }

    const severity = searchParams.get('severity');
    if (severity) {
      filters.severity = severity as IssueListFilters['severity'];
    }

    const priority = searchParams.get('priority');
    if (priority) {
      filters.priority = priority as IssueListFilters['priority'];
    }

    const categoryId = searchParams.get('categoryId');
    if (categoryId) {
      const parsed = parseInt(categoryId, 10);
      if (!isNaN(parsed)) {
        filters.categoryId = parsed;
      }
    }

    const assigneeId = searchParams.get('assigneeId');
    if (assigneeId) {
      const parsed = parseInt(assigneeId, 10);
      if (!isNaN(parsed)) {
        filters.assigneeId = parsed;
      }
    }

    const reporterId = searchParams.get('reporterId');
    if (reporterId) {
      const parsed = parseInt(reporterId, 10);
      if (!isNaN(parsed)) {
        filters.reporterId = parsed;
      }
    }

    const tagIds = searchParams.get('tagIds');
    if (tagIds) {
      filters.tagIds = tagIds.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    }

    const search = searchParams.get('search');
    if (search) {
      filters.search = search;
    }

    const page = searchParams.get('page');
    if (page) {
      const parsed = parseInt(page, 10);
      if (!isNaN(parsed) && parsed > 0) {
        filters.page = parsed;
      }
    }

    const limit = searchParams.get('limit');
    if (limit) {
      const parsed = parseInt(limit, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
        filters.limit = parsed;
      }
    }

    const result = await listIssues(filters);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error listing issues:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list issues' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const parseResult = issueCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    // Create with reporter from session and initial status 'draft'
    const issue = await createIssue(parseResult.data, session.userId, 'draft');

    return NextResponse.json({
      success: true,
      data: issue,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating issue:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create issue' },
      { status: 500 }
    );
  }
}

/**
 * Issue Duplicate Detection API Route
 * Feature: Issue Tracker
 *
 * POST /api/issues/duplicates - Check for potential duplicate issues using AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { listIssues } from '@/lib/services/issues.service';
import { checkDuplicates } from '@/lib/services/issues-ai.service';
import type { IssueDescription, IssueStatus } from '@/types/issues';

interface DuplicatesRequestBody {
  title: string;
  description: IssueDescription;
  excludeIssueId?: number;
}

// Open statuses to check for duplicates
const OPEN_STATUSES: IssueStatus[] = ['draft', 'submitted', 'triaged', 'in_progress'];

export async function POST(request: NextRequest) {
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

    const body: DuplicatesRequestBody = await request.json();
    const { title, description, excludeIssueId } = body;

    // Validate required fields
    if (!title || !description) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: title, description' },
        { status: 400 }
      );
    }

    if (!description.summary) {
      return NextResponse.json(
        { success: false, error: 'Description must include summary' },
        { status: 400 }
      );
    }

    // Fetch open issues to check for duplicates
    // We need to get issues from all open statuses
    const existingIssues: Array<{
      id: number;
      issueNumber: string;
      title: string;
      description: IssueDescription;
    }> = [];

    for (const status of OPEN_STATUSES) {
      const result = await listIssues({ status, limit: 100 });
      if (result.items) {
        for (const issue of result.items) {
          // Skip the issue being edited (if excludeIssueId provided)
          if (excludeIssueId && issue.id === excludeIssueId) {
            continue;
          }
          existingIssues.push({
            id: issue.id,
            issueNumber: issue.issueNumber,
            title: issue.title,
            description: issue.description,
          });
        }
      }
    }

    // Call AI duplicate detection service
    const result = await checkDuplicates({ title, description }, existingIssues);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error checking duplicates:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to check duplicates' },
      { status: 500 }
    );
  }
}

/**
 * Issue AI Validation API Route
 * Feature: Issue Tracker
 *
 * POST /api/issues/validate - Validate issue content with AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { getIssueCategory } from '@/lib/services/issues.service';
import { validateIssue } from '@/lib/services/issues-ai.service';
import type { IssueDescription, IssueCategory } from '@/types/issues';

interface ValidateRequestBody {
  title: string;
  description: IssueDescription;
  categoryId: number;
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

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'issues:read')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const body: ValidateRequestBody = await request.json();
    const { title, description, categoryId } = body;

    // Validate required fields
    if (!title || !description || !categoryId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: title, description, categoryId' },
        { status: 400 }
      );
    }

    if (!description.summary) {
      return NextResponse.json(
        { success: false, error: 'Description must include summary' },
        { status: 400 }
      );
    }

    // Fetch the category for AI validation context
    const category = await getIssueCategory(categoryId);
    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }

    // Prepare category for AI service (ensure requiredFields is array)
    const categoryForAI: IssueCategory = {
      ...category,
      requiredFields: Array.isArray(category.requiredFields)
        ? category.requiredFields
        : [],
    };

    // Call AI validation service
    const result = await validateIssue({ title, description }, categoryForAI);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error validating issue:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to validate issue' },
      { status: 500 }
    );
  }
}

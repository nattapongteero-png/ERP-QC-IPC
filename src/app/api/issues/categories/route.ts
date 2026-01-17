/**
 * Issue Categories API Routes
 * Feature: Issue Tracker
 *
 * GET /api/issues/categories - List all categories
 * POST /api/issues/categories - Create a new category (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission, ROLES } from '@/lib/auth';
import { listIssueCategories, createIssueCategory } from '@/lib/services/issues.service';
import { issueCategoryCreateSchema } from '@/lib/validation/issues';
import type { IssueCategoryType } from '@/types/issues';

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
    const isActiveParam = searchParams.get('isActive');
    const typeParam = searchParams.get('type');

    const filters: { isActive?: boolean; type?: IssueCategoryType } = {};

    if (isActiveParam !== null) {
      filters.isActive = isActiveParam === 'true';
    }

    if (typeParam && (typeParam === 'software' || typeParam === 'operational')) {
      filters.type = typeParam;
    }

    const categories = await listIssueCategories(filters);

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Error listing categories:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list categories' },
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

    // Only admin can create categories
    if (session.role !== ROLES.ADMIN) {
      return NextResponse.json(
        { success: false, error: 'Permission denied - Admin only' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parseResult = issueCategoryCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const category = await createIssueCategory(parseResult.data);

    return NextResponse.json({
      success: true,
      data: category,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create category' },
      { status: 500 }
    );
  }
}

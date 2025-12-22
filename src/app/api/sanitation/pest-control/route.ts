/**
 * Pest Control Logs API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * GET /api/sanitation/pest-control - List all pest control logs
 * POST /api/sanitation/pest-control - Create new pest control log
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission, type Role } from '@/lib/auth';
import {
  getPestControlLogs,
  createPestControlLog,
} from '@/lib/services/sanitation-service';
import {
  pestControlCreateSchema,
  pestControlListParamsSchema,
} from '@/lib/validation/sanitation';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as Role, 'sanitation:read')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = pestControlListParamsSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const result = await getPestControlLogs(parseResult.data);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching pest control logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pest control logs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as Role, 'sanitation:write')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parseResult = pestControlCreateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const log = await createPestControlLog(parseResult.data, session.userId);

    return NextResponse.json({ success: true, data: log }, { status: 201 });
  } catch (error) {
    console.error('Error creating pest control log:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create pest control log' },
      { status: 500 }
    );
  }
}

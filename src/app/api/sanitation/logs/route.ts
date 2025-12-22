/**
 * Sanitation Logs API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * GET /api/sanitation/logs - List all logs with pagination
 * POST /api/sanitation/logs - Create new log
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission, type Role } from '@/lib/auth';
import {
  getSanitationLogs,
  createSanitationLog,
} from '@/lib/services/sanitation-service';
import { logCreateSchema, logListParamsSchema } from '@/lib/validation/sanitation';

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
    const parseResult = logListParamsSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const result = await getSanitationLogs(parseResult.data);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching sanitation logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch logs' },
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
    const parseResult = logCreateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const log = await createSanitationLog(parseResult.data, session.userId);

    return NextResponse.json({ success: true, data: log }, { status: 201 });
  } catch (error) {
    console.error('Error creating sanitation log:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create log' },
      { status: 500 }
    );
  }
}

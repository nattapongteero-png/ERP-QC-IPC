/**
 * Pest Control Log Detail API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * GET /api/sanitation/pest-control/[id] - Get pest control log details
 * PATCH /api/sanitation/pest-control/[id] - Update pest control log
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission, type Role } from '@/lib/auth';
import {
  getPestControlLogById,
  updatePestControlLog,
} from '@/lib/services/sanitation-service';
import { pestControlUpdateSchema } from '@/lib/validation/sanitation';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as Role, 'sanitation:read')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const logId = parseInt(id, 10);
    if (isNaN(logId)) {
      return NextResponse.json({ success: false, error: 'Invalid log ID' }, { status: 400 });
    }

    const log = await getPestControlLogById(logId);
    if (!log) {
      return NextResponse.json({ success: false, error: 'Log not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: log });
  } catch (error) {
    console.error('Error fetching pest control log:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch log' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as Role, 'sanitation:write')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const logId = parseInt(id, 10);
    if (isNaN(logId)) {
      return NextResponse.json({ success: false, error: 'Invalid log ID' }, { status: 400 });
    }

    const body = await request.json();
    const parseResult = pestControlUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const log = await updatePestControlLog(logId, parseResult.data, session.userId);
    if (!log) {
      return NextResponse.json({ success: false, error: 'Log not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: log });
  } catch (error) {
    console.error('Error updating pest control log:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update log' },
      { status: 500 }
    );
  }
}

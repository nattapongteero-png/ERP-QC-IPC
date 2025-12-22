/**
 * Sanitation Log Verify API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * POST /api/sanitation/logs/[id]/verify - Verify a sanitation log
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission, type Role } from '@/lib/auth';
import { verifySanitationLog } from '@/lib/services/sanitation-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as Role, 'sanitation:verify')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const logId = parseInt(id, 10);
    if (isNaN(logId)) {
      return NextResponse.json({ success: false, error: 'Invalid log ID' }, { status: 400 });
    }

    const log = await verifySanitationLog(logId, session.userId);
    if (!log) {
      return NextResponse.json({ success: false, error: 'Log not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: log });
  } catch (error) {
    console.error('Error verifying sanitation log:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify log' },
      { status: 500 }
    );
  }
}

/**
 * Pending Sanitation Tasks API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * GET /api/sanitation/pending - Get pending and overdue tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission, type Role } from '@/lib/auth';
import { getPendingTasks } from '@/lib/services/sanitation-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as Role, 'sanitation:read')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const daysAhead = parseInt(request.nextUrl.searchParams.get('daysAhead') || '7', 10);
    const tasks = await getPendingTasks(daysAhead);

    return NextResponse.json({ success: true, data: tasks });
  } catch (error) {
    console.error('Error fetching pending tasks:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pending tasks' },
      { status: 500 }
    );
  }
}

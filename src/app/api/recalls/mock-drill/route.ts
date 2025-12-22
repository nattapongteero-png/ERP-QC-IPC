/**
 * Mock Drill API Route
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * POST /api/recalls/mock-drill - Execute mock recall drill
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/auth';
import { executeMockDrill } from '@/lib/services/recall-service';
import { mockDrillRequestSchema } from '@/lib/validation/recalls';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.user.role, 'recalls:execute')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = mockDrillRequestSchema.parse(body);

    const result = await executeMockDrill(validatedData, session.user.id);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error executing mock drill:', error);
    const message = error instanceof Error ? error.message : 'Failed to execute mock drill';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

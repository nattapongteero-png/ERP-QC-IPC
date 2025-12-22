/**
 * Recall Reconciliation API Routes
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * GET /api/recalls/:id/reconciliation - Get reconciliation records
 * POST /api/recalls/:id/reconciliation - Record reconciliation
 */

import { NextRequest, NextResponse } from 'next/server';


import { getSession, hasPermission } from '@/lib/auth';
import {
  getRecallReconciliation,
  recordReconciliation,
  getRecallById,
} from '@/lib/services/recall-service';
import { recallReconciliationCreateSchema } from '@/lib/validation/recalls';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as any, 'recalls:read')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const recallId = parseInt(id, 10);

    if (isNaN(recallId)) {
      return NextResponse.json({ success: false, error: 'Invalid recall ID' }, { status: 400 });
    }

    const recall = await getRecallById(recallId);
    if (!recall) {
      return NextResponse.json({ success: false, error: 'Recall not found' }, { status: 404 });
    }

    const reconciliation = await getRecallReconciliation(recallId);

    return NextResponse.json({ success: true, data: reconciliation });
  } catch (error) {
    console.error('Error getting reconciliation:', error);
    const message = error instanceof Error ? error.message : 'Failed to get reconciliation';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as any, 'recalls:execute')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const recallId = parseInt(id, 10);

    if (isNaN(recallId)) {
      return NextResponse.json({ success: false, error: 'Invalid recall ID' }, { status: 400 });
    }

    const recall = await getRecallById(recallId);
    if (!recall) {
      return NextResponse.json({ success: false, error: 'Recall not found' }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = recallReconciliationCreateSchema.parse(body);

    const reconciliation = await recordReconciliation(recallId, validatedData, session.userId);

    return NextResponse.json({ success: true, data: reconciliation }, { status: 201 });
  } catch (error) {
    console.error('Error recording reconciliation:', error);
    const message = error instanceof Error ? error.message : 'Failed to record reconciliation';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

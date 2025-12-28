/**
 * Fiscal Year Close API Route
 * Feature: 010-accounting-module-integration
 * User Story 9: Perform Period-End Closing
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateYearClose, closeYearEnd, getFiscalYearById } from '@/lib/services/accounting-period.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const yearId = parseInt(id, 10);

    if (isNaN(yearId)) {
      return NextResponse.json({ error: 'Invalid fiscal year ID' }, { status: 400 });
    }

    // Check if year exists
    const year = await getFiscalYearById(yearId);
    if (!year) {
      return NextResponse.json({ error: 'Fiscal year not found' }, { status: 404 });
    }

    // Return validation info
    const validation = await validateYearClose(yearId);

    return NextResponse.json({
      success: true,
      data: validation,
    });
  } catch (error) {
    console.error('Error validating year close:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to validate year close' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const yearId = parseInt(id, 10);

    if (isNaN(yearId)) {
      return NextResponse.json({ error: 'Invalid fiscal year ID' }, { status: 400 });
    }

    // Check if year exists
    const year = await getFiscalYearById(yearId);
    if (!year) {
      return NextResponse.json({ error: 'Fiscal year not found' }, { status: 404 });
    }

    const body = await request.json();
    const closedBy = body.closedBy || 1; // TODO: Get from auth
    const retainedEarningsAccountId = body.retainedEarningsAccountId;

    if (!retainedEarningsAccountId) {
      return NextResponse.json(
        { error: 'Retained earnings account ID is required' },
        { status: 400 }
      );
    }

    const result = await closeYearEnd(yearId, retainedEarningsAccountId, closedBy);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error closing fiscal year:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to close fiscal year' },
      { status: 500 }
    );
  }
}

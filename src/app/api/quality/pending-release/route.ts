/**
 * Pending Release API
 * Feature: 009-gmp-compliance-gap-analysis Phase 7 (US15 - T090)
 *
 * GET: Get tests pending disposition or approval (FR-053)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPendingRelease } from '@/lib/services/qc-disposition.service';

/**
 * GET /api/quality/pending-release
 * Get tests pending disposition or approval
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const pendingItems = await getPendingRelease();

    return NextResponse.json({
      success: true,
      data: {
        items: pendingItems,
        total: pendingItems.length,
        needsDisposition: pendingItems.filter(i => i.needsDisposition).length,
        needsApproval: pendingItems.filter(i => i.needsApproval).length,
      },
    });
  } catch (error) {
    console.error('Error fetching pending release items:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pending release items' },
      { status: 500 }
    );
  }
}

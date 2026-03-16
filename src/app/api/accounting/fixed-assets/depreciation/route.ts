/**
 * Run Monthly Depreciation API Route
 * Feature: 010-accounting-module-integration
 * User Story 7: Manage Fixed Assets and Depreciation
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { runMonthlyDepreciation } from '@/lib/services/accounting-assets.service';
import { z } from 'zod';

const runDepreciationSchema = z.object({
  depreciationMonth: z.string().regex(/^\d{4}-\d{2}$/, 'รูปแบบเดือนไม่ถูกต้อง (YYYY-MM)'),
});

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const validation = runDepreciationSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.flatten() },
          { status: 400 }
        );
      }

      // TODO: Get createdBy from session
      const result = await runMonthlyDepreciation(validation.data.depreciationMonth);

      return NextResponse.json({
        success: true,
        data: {
          ...result,
          message: result.processedCount > 0
            ? `Successfully processed depreciation for ${result.processedCount} assets. Total: ${result.totalDepreciation.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}`
            : 'No assets were depreciated for this period.',
        },
      });
    } catch (error) {
      console.error('Error running monthly depreciation:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to run monthly depreciation' },
        { status: 500 }
      );
    }

  });
}

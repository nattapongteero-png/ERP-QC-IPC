/**
 * Asset Register Report API Route
 * Feature: 010-accounting-module-integration
 * User Story 7: Manage Fixed Assets and Depreciation
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { generateAssetRegister } from '@/lib/services/accounting-reports.service';
import { getTodayStr } from '@/lib/db/date-utils';

export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const { searchParams } = new URL(request.url);

      // Get report date (defaults to today)
      const asOfDate = searchParams.get('asOfDate') || getTodayStr();

      // Get optional filters
      const filters: { categoryId?: number; status?: string } = {};
      if (searchParams.has('categoryId')) {
        filters.categoryId = parseInt(searchParams.get('categoryId')!, 10);
      }
      if (searchParams.has('status')) {
        filters.status = searchParams.get('status')!;
      }

      const report = await generateAssetRegister(asOfDate, filters);

      return NextResponse.json({
        success: true,
        data: report,
      });
    } catch (error) {
      console.error('Error generating asset register:', error);
      return NextResponse.json(
        { error: 'Failed to generate asset register report' },
        { status: 500 }
      );
    }

  });
}

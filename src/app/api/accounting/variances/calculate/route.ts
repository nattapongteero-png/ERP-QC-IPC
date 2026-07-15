/**
 * Calculate Variances API (T142)
 * POST /api/accounting/variances/calculate
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { calculateWorkOrderVariances, postVariances } from '@/lib/services/variance-analysis.service';
import { calculateVarianceRequestSchema } from '@/lib/validation/variance';

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const data = calculateVarianceRequestSchema.parse(body);

      // TODO: Get actual user ID from session
      const userId = session.userId;

      const result = await calculateWorkOrderVariances(data.workOrderId, userId);

      // Post immediately if requested.
      //
      // Posting is disabled (it wrote journal entries with no journal_lines),
      // so this must NOT take the whole request down with it: calculating the
      // variances still works and still saves the records. Report the skip in
      // the response instead of throwing, otherwise asking for
      // postImmediately would make the calculation itself look broken.
      let postingSkipped: string | undefined;
      if (data.postImmediately && result.variances.length > 0) {
        try {
          const varianceIds = result.variances.map((v) => v.id);
          const postResult = await postVariances(varianceIds, undefined, userId);
          result.journalEntryId = postResult.journalEntriesCreated > 0 ? 1 : undefined; // Simplified
        } catch (postError) {
          if ((postError as Error).message !== 'VARIANCE_POSTING_DISABLED') throw postError;
          postingSkipped =
            'คำนวณผลต่างเรียบร้อย แต่ยังไม่ได้ลงบัญชี เนื่องจากระบบปิดการลงบัญชีผลต่างไว้ชั่วคราว';
        }
      }

      return NextResponse.json({ success: true, data: result, warning: postingSkipped });
    } catch (error) {
      console.error('Error calculating variances:', error);
      if ((error as any).name === 'ZodError') {
        return NextResponse.json(
          { success: false, error: 'Validation error', details: (error as any).errors },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 400 }
      );
    }

  });
}

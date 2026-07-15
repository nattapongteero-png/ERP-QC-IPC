/**
 * Post Variances API (T143)
 * POST /api/accounting/variances/post
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { postVariances } from '@/lib/services/variance-analysis.service';
import { postVarianceRequestSchema } from '@/lib/validation/variance';

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const data = postVarianceRequestSchema.parse(body);

      // TODO: Get actual user ID from session
      const userId = session.userId;

      const result = await postVariances(data.varianceIds, data.periodId, userId);
      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      console.error('Error posting variances:', error);
      if ((error as any).name === 'ZodError') {
        return NextResponse.json(
          { success: false, error: 'Validation error', details: (error as any).errors },
          { status: 400 }
        );
      }
      // Posting is deliberately disabled: it produced journal entries with no
      // journal_lines behind them. 501 (not implemented), not 500 — this is a
      // known unfinished feature, not an unexpected crash.
      if ((error as Error).message === 'VARIANCE_POSTING_DISABLED') {
        return NextResponse.json(
          {
            success: false,
            error:
              'ระบบปิดการลงบัญชีผลต่างไว้ชั่วคราว เนื่องจากยังสร้างใบสำคัญที่ไม่มีรายการบรรทัด กรุณาติดต่อผู้ดูแลระบบ',
          },
          { status: 501 }
        );
      }
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }

  });
}

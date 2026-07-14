/**
 * PR Reject API Route (T041)
 * POST /api/purchasing/requisitions/[id]/reject - Reject PR
 */

import { NextRequest, NextResponse } from 'next/server';
import { rejectPR } from '@/lib/services/purchase-requisition.service';
import { getSession } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const { id } = await params;
    const prId = parseInt(id, 10);

    if (isNaN(prId)) {
      return NextResponse.json({ success: false, error: 'รหัสใบขอซื้อไม่ถูกต้อง' }, { status: 400 });
    }

    const body = await request.json();
    const reason = body.reason || body.comments || '';

    if (!reason) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุเหตุผลในการปฏิเสธ' },
        { status: 400 }
      );
    }

    const userId = session.userId;

    await rejectPR(prId, userId, reason);

    return NextResponse.json({ success: true, message: 'PR rejected successfully' });
  } catch (error: any) {
    console.error('Error rejecting PR:', error);

    // Thai messages — shown directly to the operator in the UI toast.
    const errorMessages: Record<string, string> = {
      PR_NOT_FOUND: 'ไม่พบใบขอซื้อนี้',
      PR_NOT_PENDING_APPROVAL: 'ใบขอซื้อนี้ไม่ได้อยู่ในสถานะรออนุมัติ',
      NO_APPROVAL_REQUEST: 'ไม่พบคำขออนุมัติของใบขอซื้อนี้',
      NOT_AUTHORIZED: 'คุณไม่มีสิทธิ์ปฏิเสธใบขอซื้อนี้',
      ALREADY_PROCESSED: 'ใบขอซื้อนี้ถูกดำเนินการไปแล้ว',
      INVALID_REQUEST: 'ไม่พบคำขออนุมัติของใบขอซื้อนี้',
    };

    // The workflow engine throws 'CODE: english detail' (e.g.
    // 'NOT_AUTHORIZED: You are not authorized to reject this request'), while
    // this service throws a bare 'CODE'. Keying on the code prefix covers both
    // — an exact-match lookup missed the prefixed ones and leaked the raw
    // English sentence into the Thai UI.
    const code = String(error?.message ?? '').split(':')[0].trim();

    const message = errorMessages[code] || 'ไม่สามารถปฏิเสธใบขอซื้อได้';
    const status = code === 'PR_NOT_FOUND' ? 404 :
                   code === 'NOT_AUTHORIZED' ? 403 : 400;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}

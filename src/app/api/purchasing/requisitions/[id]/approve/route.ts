/**
 * PR Approve API Route (T040)
 * POST /api/purchasing/requisitions/[id]/approve - Approve PR
 */

import { NextRequest, NextResponse } from 'next/server';
import { approvePR } from '@/lib/services/purchase-requisition.service';
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

    const body = await request.json().catch(() => ({}));
    const comments = body.comments || '';
    const userId = session.userId;

    await approvePR(prId, userId, comments);

    return NextResponse.json({ success: true, message: 'PR approved successfully' });
  } catch (error: any) {
    console.error('Error approving PR:', error);

    const errorMessages: Record<string, string> = {
      PR_NOT_FOUND: 'ไม่พบใบขอซื้อนี้',
      PR_NOT_PENDING_APPROVAL: 'ใบขอซื้อนี้ไม่ได้อยู่ในสถานะรออนุมัติ',
      NO_APPROVAL_REQUEST: 'ไม่พบคำขออนุมัติของใบขอซื้อนี้',
      NOT_AUTHORIZED: 'คุณไม่มีสิทธิ์อนุมัติใบขอซื้อนี้',
      ALREADY_PROCESSED: 'ใบขอซื้อนี้ถูกดำเนินการไปแล้ว',
      INVALID_REQUEST: 'ไม่พบคำขออนุมัติของใบขอซื้อนี้',
    };

    // Same as the reject route: the workflow engine throws 'CODE: english
    // detail' while this service throws a bare 'CODE'. Key on the code prefix
    // so the prefixed ones don't leak their English sentence into the Thai UI.
    const code = String(error?.message ?? '').split(':')[0].trim();

    const message = errorMessages[code] || 'ไม่สามารถอนุมัติใบขอซื้อได้';
    const status = code === 'PR_NOT_FOUND' ? 404 :
                   code === 'NOT_AUTHORIZED' ? 403 : 400;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}

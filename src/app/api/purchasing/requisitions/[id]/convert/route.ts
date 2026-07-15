/**
 * PR to PO Convert API Route (T042)
 * POST /api/purchasing/requisitions/[id]/convert - Convert approved PR to PO
 */

import { NextRequest, NextResponse } from 'next/server';
import { convertPRToPO } from '@/lib/services/purchase-requisition.service';
import { prToPOConvertSchema } from '@/lib/validation/purchase-requisition';
import { getSession } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const prId = parseInt(id, 10);

    if (isNaN(prId)) {
      return NextResponse.json({ success: false, error: 'Invalid PR ID' }, { status: 400 });
    }

    const body = await request.json();
    const data = prToPOConvertSchema.parse({ ...body, prId });
    const userId = session.userId;

    const result = await convertPRToPO(data, userId);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error converting PR to PO:', error);

    // Thai — these reach the operator directly in the convert dialog.
    const errorMessages: Record<string, string> = {
      PR_NOT_FOUND: 'ไม่พบใบขอซื้อนี้',
      PR_NOT_APPROVED: 'ใบขอซื้อยังไม่ได้รับการอนุมัติ ต้องอนุมัติก่อนจึงจะแปลงเป็นใบสั่งซื้อได้',
      NO_LINES_TO_CONVERT: 'ไม่มีรายการที่อนุมัติแล้วสำหรับแปลงเป็นใบสั่งซื้อ',
      VENDOR_REQUIRED: 'กรุณาเลือกผู้ขาย',
      LINE_VENDOR_REQUIRED: 'กรุณาระบุบริษัทผู้ขายของแต่ละรายการ',
    };

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    const message = errorMessages[error.message] || error.message || 'Failed to convert PR to PO';
    const status = error.message === 'PR_NOT_FOUND' ? 404 : 400;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}

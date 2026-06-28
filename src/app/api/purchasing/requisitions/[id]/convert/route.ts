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

    const errorMessages: Record<string, string> = {
      PR_NOT_FOUND: 'PR not found',
      PR_NOT_APPROVED: 'PR is not approved. Only approved PRs can be converted to POs',
      NO_LINES_TO_CONVERT: 'No approved lines available for conversion',
      VENDOR_REQUIRED: 'Please select a vendor',
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

/**
 * Invoice Available for Credit API (T093)
 * Part of 011-accounting-spec-gap - User Story 3
 */

import { NextRequest, NextResponse } from 'next/server';
import { invoiceAvailableForCreditQuerySchema } from '@/lib/validation/credit-debit-notes';
import { getInvoiceAvailableForCredit } from '@/lib/services/credit-debit-notes.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const invoiceId = parseInt(id, 10);

    if (isNaN(invoiceId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid invoice ID' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = invoiceAvailableForCreditQuerySchema.parse({
      invoiceType: searchParams.get('invoiceType') || 'ar',
    });

    const result = await getInvoiceAvailableForCredit(invoiceId, query.invoiceType);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error getting invoice availability:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid invoice type' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to get invoice availability' },
      { status: 500 }
    );
  }
}

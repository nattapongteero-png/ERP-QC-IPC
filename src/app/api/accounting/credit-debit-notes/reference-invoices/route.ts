/**
 * Reference Invoices API (T094)
 * GET /api/accounting/credit-debit-notes/reference-invoices
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getReferenceInvoices,
  getInvoiceLines,
} from '@/lib/services/credit-debit-notes.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'ar' | 'ap';
    const invoiceId = searchParams.get('invoiceId');
    const customerId = searchParams.get('customerId');
    const vendorId = searchParams.get('vendorId');

    if (!type || !['ar', 'ap'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be "ar" or "ap"' },
        { status: 400 }
      );
    }

    // If invoiceId is provided, return invoice lines
    if (invoiceId) {
      const lines = await getInvoiceLines(type, parseInt(invoiceId, 10));
      return NextResponse.json({ success: true, data: lines });
    }

    // Otherwise return list of invoices
    const invoices = await getReferenceInvoices(
      type,
      customerId ? parseInt(customerId, 10) : undefined,
      vendorId ? parseInt(vendorId, 10) : undefined
    );

    return NextResponse.json({ success: true, data: invoices });
  } catch (error) {
    console.error('Error getting reference invoices:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

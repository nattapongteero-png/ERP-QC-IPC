/**
 * API Route: Invoice issuance terms (list item 3)
 * GET  /api/settings/invoice-terms - current payment-terms days
 * PUT  /api/settings/invoice-terms - set payment-terms days ({ days })
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import {
  getInvoicePaymentTermsDays,
  setInvoicePaymentTermsDays,
} from '@/lib/services/settings.service';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const days = await getInvoicePaymentTermsDays();
      return NextResponse.json({ success: true, data: { days } });
    } catch (error) {
      console.error('Error loading invoice terms:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to load invoice terms' },
        { status: 500 },
      );
    }
  });
}

export async function PUT(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json().catch(() => ({}));
      const days = Number(body?.days);
      if (!Number.isFinite(days) || days < 0 || days > 365) {
        return NextResponse.json(
          { success: false, error: 'จำนวนวันต้องอยู่ระหว่าง 0 ถึง 365' },
          { status: 400 },
        );
      }
      await setInvoicePaymentTermsDays(days, session.userId);
      return NextResponse.json({ success: true, data: { days: Math.floor(days) } });
    } catch (error) {
      console.error('Error saving invoice terms:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save invoice terms' },
        { status: 500 },
      );
    }
  });
}

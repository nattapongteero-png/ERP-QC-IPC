/**
 * API Route: Invoice issuance settings
 *
 * GET  /api/settings/invoice-terms
 *   → { days, requiresAccountingApproval }
 *
 * PUT  /api/settings/invoice-terms
 *   Accepts either or both:
 *     { days }                        - payment-terms days (due date = ship + N)
 *     { requiresAccountingApproval }   - gate the tax invoice behind Accounting
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import {
  getInvoicePaymentTermsDays,
  setInvoicePaymentTermsDays,
  getInvoiceRequiresAccountingApproval,
  setInvoiceRequiresAccountingApproval,
} from '@/lib/services/settings.service';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const [days, requiresAccountingApproval] = await Promise.all([
        getInvoicePaymentTermsDays(),
        getInvoiceRequiresAccountingApproval(),
      ]);
      return NextResponse.json({
        success: true,
        data: { days, requiresAccountingApproval },
      });
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

      // Both fields are optional so a caller can change one without having to
      // resend the other and risk clobbering it with a stale value.
      const hasDays = body?.days !== undefined;
      const hasApproval = body?.requiresAccountingApproval !== undefined;

      if (!hasDays && !hasApproval) {
        return NextResponse.json(
          { success: false, error: 'ไม่มีข้อมูลที่ต้องบันทึก' },
          { status: 400 },
        );
      }

      if (hasDays) {
        const days = Number(body.days);
        if (!Number.isFinite(days) || days < 0 || days > 365) {
          return NextResponse.json(
            { success: false, error: 'จำนวนวันต้องอยู่ระหว่าง 0 ถึง 365' },
            { status: 400 },
          );
        }
        await setInvoicePaymentTermsDays(days, session.userId);
      }

      if (hasApproval) {
        if (typeof body.requiresAccountingApproval !== 'boolean') {
          return NextResponse.json(
            { success: false, error: 'requiresAccountingApproval ต้องเป็น true หรือ false' },
            { status: 400 },
          );
        }
        await setInvoiceRequiresAccountingApproval(
          body.requiresAccountingApproval,
          session.userId,
        );
      }

      const [days, requiresAccountingApproval] = await Promise.all([
        getInvoicePaymentTermsDays(),
        getInvoiceRequiresAccountingApproval(),
      ]);
      return NextResponse.json({
        success: true,
        data: { days, requiresAccountingApproval },
      });
    } catch (error) {
      console.error('Error saving invoice terms:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save invoice terms' },
        { status: 500 },
      );
    }
  });
}

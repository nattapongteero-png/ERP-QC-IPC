/**
 * API: POST /api/sales/vmi-orders/backfill-customers
 * One-shot backfill so VMI hospitals from orders ingested before the customer
 * auto-sync existed appear in the customer register (list item 10 follow-up).
 * Idempotent.
 */
import { NextRequest } from 'next/server';
import { successResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';
import { backfillVmiCustomers } from '@/lib/services/vmi-customer-sync.service';

export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const result = await backfillVmiCustomers();
      return successResponse(
        result,
        `ซิงก์ลูกค้า VMI แล้ว: ${result.hospitals} โรงพยาบาล (สร้างใหม่ ${result.created})`,
      );
    } catch (error) {
      return serverErrorResponse(error, 'backfillVmiCustomers');
    }
  });
}

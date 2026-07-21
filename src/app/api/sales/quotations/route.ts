/**
 * API: /api/sales/quotations — list + create quotations (ใบเสนอราคา).
 * List items 1a–1b.
 */
import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createQuotation, listQuotations } from '@/lib/services/quotation.service';
import { quotationCreateSchema } from '@/lib/validation/quotation';

// GET /api/sales/quotations
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get('status') || undefined;
      const search = searchParams.get('search') || undefined;
      const data = await listQuotations({ status, search });
      return successResponse(data);
    } catch (error) {
      return serverErrorResponse(error, 'listQuotations');
    }
  });
}

// POST /api/sales/quotations
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const parsed = quotationCreateSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง', 400);
      }
      const result = await createQuotation(parsed.data, session.userId);
      return successResponse(result, 'สร้างใบเสนอราคาสำเร็จ');
    } catch (error) {
      return serverErrorResponse(error, 'createQuotation');
    }
  });
}

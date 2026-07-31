/**
 * API: /api/sales/quotations/[id] — get / update / delete a quotation.
 * List items 1b–1c.
 */
import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getQuotation,
  updateQuotation,
  deleteQuotation,
  replaceQuotation,
} from '@/lib/services/quotation.service';
import { quotationUpdateSchema, quotationCreateSchema } from '@/lib/validation/quotation';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const quotationId = parseInt(id, 10);
      if (isNaN(quotationId)) return errorResponse('รหัสไม่ถูกต้อง', 400);
      const data = await getQuotation(quotationId);
      if (!data) return errorResponse('ไม่พบใบเสนอราคา', 404);
      return successResponse(data);
    } catch (error) {
      return serverErrorResponse(error, 'getQuotation');
    }
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const quotationId = parseInt(id, 10);
      if (isNaN(quotationId)) return errorResponse('รหัสไม่ถูกต้อง', 400);
      const body = await request.json();
      const parsed = quotationUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง', 400);
      }
      await updateQuotation(quotationId, parsed.data);
      return successResponse({ id: quotationId }, 'บันทึกสำเร็จ');
    } catch (error) {
      return serverErrorResponse(error, 'updateQuotation');
    }
  });
}

// Full edit (header + lines) of a DRAFT quotation. PATCH handles small header/
// status tweaks; PUT rewrites the whole thing the way the create form builds it.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const quotationId = parseInt(id, 10);
      if (isNaN(quotationId)) return errorResponse('รหัสไม่ถูกต้อง', 400);
      const existing = await getQuotation(quotationId);
      if (!existing) return errorResponse('ไม่พบใบเสนอราคา', 404);
      // Only drafts are freely rewritable; a sent/accepted quote is a document
      // someone may already be holding, so it must not change underneath them.
      if (existing.status !== 'draft') {
        return errorResponse('แก้ไขได้เฉพาะใบเสนอราคาสถานะ "ร่าง" เท่านั้น', 400);
      }
      const body = await request.json();
      const parsed = quotationCreateSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง', 400);
      }
      await replaceQuotation(quotationId, parsed.data);
      return successResponse({ id: quotationId }, 'บันทึกสำเร็จ');
    } catch (error) {
      return serverErrorResponse(error, 'replaceQuotation');
    }
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const quotationId = parseInt(id, 10);
      if (isNaN(quotationId)) return errorResponse('รหัสไม่ถูกต้อง', 400);
      await deleteQuotation(quotationId);
      return successResponse({ id: quotationId }, 'ลบสำเร็จ');
    } catch (error) {
      return serverErrorResponse(error, 'deleteQuotation');
    }
  });
}

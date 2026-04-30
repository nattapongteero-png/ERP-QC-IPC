/**
 * COA Document — single-resource routes
 *   GET   /api/quality/coa/[id]   — full detail (header + results + signatures + template)
 *   POST  /api/quality/coa/[id]   — status transition action
 *
 * POST body: { action: 'submit_for_review'|'approve'|'issue'|'supersede'|'revoke',
 *              signatureMeaning?, notes?, supersededBy?, reason? }
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  notFoundResponse,
  withAuth,
} from '@/lib/api-utils';
import { getCoaById, transitionCoaStatus } from '@/lib/services/coa.service';
import { transitionCoaStatusSchema } from '@/lib/validation/coa';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const coaId = Number(id);
      if (!Number.isFinite(coaId)) {
        return errorResponse('Invalid COA ID');
      }
      const detail = await getCoaById(coaId);
      if (!detail) return notFoundResponse('COA not found');
      return successResponse(detail);
    } catch (error) {
      console.error('Error fetching COA detail:', error);
      return serverErrorResponse(error);
    }
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const coaId = Number(id);
      if (!Number.isFinite(coaId)) {
        return errorResponse('Invalid COA ID');
      }
      const body = await request.json();
      const parsed = transitionCoaStatusSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse('Invalid status action payload', 400, {
          errors: parsed.error.issues,
        });
      }

      const ipHeader =
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        '';
      const ip = ipHeader.split(',')[0]?.trim() || undefined;

      const result = await transitionCoaStatus(
        coaId,
        {
          action: parsed.data.action,
          signatureMeaning: parsed.data.signatureMeaning,
          notes: parsed.data.notes,
          supersededBy: parsed.data.supersededBy,
          reason: parsed.data.reason,
          ipAddress: ip,
        },
        session.userId,
      );
      return successResponse(
        result,
        `COA transitioned: ${result.fromStatus} → ${result.toStatus}`,
      );
    } catch (error) {
      console.error('Error transitioning COA status:', error);
      if (error instanceof Error && error.message) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  });
}

/**
 * Per-entity audit trail — GET /api/quality/audit-trail/entity/{type}/{id}
 *
 * Used by the embedded "Audit Trail" tabs on QC sample detail and COA detail
 * pages. Permission-gated to authenticated users — anyone who can see the
 * sample/COA detail page also gets to see its audit trail (FDA 21 CFR Part 11
 * §11.10(e) requires the audit trail to be available to authorized personnel
 * for review and inspection).
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getEntityAuditTrail,
  type AuditEntityType,
} from '@/lib/services/audit-viewer.service';

const VALID_TYPES: AuditEntityType[] = [
  'qc_sample',
  'coa_document',
  'material_return',
  'wo_sop_execution',
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  return withAuth(request, async () => {
    try {
      const { type, id } = await params;
      const entityId = Number(id);
      if (!Number.isFinite(entityId)) {
        return errorResponse('Invalid entity ID');
      }
      if (!VALID_TYPES.includes(type as AuditEntityType)) {
        return errorResponse(
          `Invalid entity type. Allowed: ${VALID_TYPES.join(', ')}`,
        );
      }

      const url = new URL(request.url);
      const limitRaw = url.searchParams.get('limit');
      const limit = limitRaw ? Math.max(1, Math.min(500, Number(limitRaw))) : 200;

      const result = await getEntityAuditTrail(
        type as AuditEntityType,
        entityId,
        { limit },
      );
      return successResponse(result);
    } catch (error) {
      console.error('[audit-trail-entity] error:', error);
      return serverErrorResponse(error);
    }
  });
}

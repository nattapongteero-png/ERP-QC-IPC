/**
 * CAPA AI Summary API
 *
 * GET /api/gmp/capa/[id]/summary
 * Loads a CAPA with its actions and returns an AI-generated management summary.
 * Read-level permission — it only reads the CAPA.
 */
import { NextRequest } from 'next/server';
import { successResponse, errorResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';
import { getCapaDetails } from '@/lib/services/capa-service';
import { summarizeRecord } from '@/lib/services/ai-summary.service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const capaId = Number(id);
        if (!Number.isInteger(capaId) || capaId <= 0) {
          return errorResponse('Invalid CAPA id', 400);
        }

        const capa = await getCapaDetails(capaId);
        if (!capa) return errorResponse('CAPA not found', 404);

        const summary = await summarizeRecord({
          domain: 'capa',
          heading: `${capa.capaNumber} — ${capa.title}`,
          fields: {
            status: capa.status,
            type: capa.type,
            priority: capa.priority,
            source: capa.sourceNumber ?? capa.sourceType,
            rootCause: capa.rootCauseAnalysis,
            rootCauseCategory: capa.rootCauseCategory,
            riskScore: capa.riskScore,
            riskJustification: capa.riskJustification,
            patientImpact: capa.patientImpact,
            regulatoryNotificationRequired: capa.regulatoryNotificationRequired,
            dueDate: capa.dueDate,
            isOverdue: capa.isOverdue,
            owner: capa.ownerName,
          },
          items: capa.actions.map((a) => ({
            label: a.description,
            detail: `${a.actionType} · ${a.status}`,
          })),
          focus: 'current status, risk, and any overdue or outstanding actions',
        });

        if (summary === null) {
          return successResponse({ summary: null, aiUnavailable: true });
        }
        return successResponse({ summary, aiUnavailable: false });
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['capa:read']
  );
}

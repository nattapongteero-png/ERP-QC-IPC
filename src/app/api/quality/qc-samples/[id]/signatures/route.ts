/**
 * QC Sample Signatures — 3-tier sign-off (Phase 3)
 *   GET  /api/quality/qc-samples/[id]/signatures — list signatures for sample
 *   POST /api/quality/qc-samples/[id]/signatures — capture an e-signature
 *
 * The POST endpoint enforces:
 *   - Unique (sampleId, role) — duplicates rejected.
 *   - Optional bcrypt password re-entry per 21 CFR Part 11.
 *   - Segregation of duties (analyst != reviewer) — checked in the service.
 *   - Auto-transitions the sample status (reviewer→approved, qa_release→released).
 * IP and User-Agent are captured from request headers for the audit trail.
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  listQcSampleSignatures,
  signQcSample,
} from '@/lib/services/qc-sample.service';
import { signQcSampleSchema } from '@/lib/validation/qc-sample';

function getClientIP(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const sampleId = Number(id);
      if (!Number.isFinite(sampleId)) {
        return errorResponse('Invalid sample ID');
      }
      const signatures = await listQcSampleSignatures(sampleId);
      return successResponse({ signatures });
    } catch (error) {
      console.error('Error listing QC sample signatures:', error);
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
      const sampleId = Number(id);
      if (!Number.isFinite(sampleId)) {
        return errorResponse('Invalid sample ID');
      }
      const body = await request.json();
      const parsed = signQcSampleSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(
          'Invalid signature payload',
          400,
          { errors: parsed.error.issues },
        );
      }

      const ipAddress = getClientIP(request);
      const userAgent = request.headers.get('user-agent') ?? undefined;

      const result = await signQcSample({
        sampleId,
        role: parsed.data.role,
        userId: session.userId,
        signatureMeaning: parsed.data.signatureMeaning,
        notes: parsed.data.notes ?? null,
        passwordReentry: parsed.data.passwordReentry,
        ipAddress,
        userAgent,
      });

      const message = result.transitionedStatus
        ? `Signed (${result.role}) — sample transitioned ${result.transitionedStatus.fromStatus} → ${result.transitionedStatus.toStatus}`
        : `Signed (${result.role})`;
      return successResponse(result, message);
    } catch (error) {
      console.error('Error capturing QC sample signature:', error);
      if (error instanceof Error && error.message) {
        const status = (error as any).statusCode === 401 ? 401 : 400;
        return errorResponse(error.message, status);
      }
      return serverErrorResponse(error);
    }
  });
}

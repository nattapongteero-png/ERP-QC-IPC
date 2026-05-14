/**
 * POST /api/quality/coa/[id]/email — Phase 8
 *
 * Send the Certificate of Analysis to a customer email address. Renders the
 * official PDF via the existing pdf-renderer pipeline and attaches it.
 *
 * Body shape:
 *   {
 *     recipientEmail: string,    // required, RFC-5322 email
 *     cc?: string[],
 *     subject?: string,
 *     bodyText?: string,
 *     attachOfficial?: boolean,  // default true; if false send link-only
 *   }
 *
 * Behaviour:
 *   - 503 if SMTP isn't configured (clear message, NOT a 500 crash)
 *   - 200 with smtpUnavailable=true if SMTP_HOST is missing — email logged
 *     to coa_print_history regardless so operators see a paper trail
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { emailCoaToCustomer } from '@/lib/services/coa.service';

const emailSchema = z.object({
  recipientEmail: z.email('Invalid recipient email'),
  cc: z.array(z.email()).optional(),
  subject: z.string().max(200).optional(),
  bodyText: z.string().max(10000).optional(),
  attachOfficial: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const coaId = Number(id);
      if (!Number.isFinite(coaId)) return errorResponse('Invalid COA ID');

      const body = await request.json();
      const parsed = emailSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse('Invalid email payload', 400, {
          errors: parsed.error.issues,
        });
      }

      const ipHeader =
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        '';
      const ip = ipHeader.split(',')[0]?.trim() || undefined;

      const result = await emailCoaToCustomer({
        coaId,
        recipientEmail: parsed.data.recipientEmail,
        ccEmails: parsed.data.cc,
        subject: parsed.data.subject,
        bodyText: parsed.data.bodyText,
        attachOfficial: parsed.data.attachOfficial ?? true,
        sentBy: session.userId,
        ipAddress: ip,
      });

      if (result.smtpUnavailable) {
        return successResponse(
          result,
          'Email recorded but SMTP is not configured (set SMTP_HOST/SMTP_FROM in env).',
        );
      }

      return successResponse(result, 'COA emailed to customer');
    } catch (error) {
      console.error('Error emailing COA:', error);
      if (error instanceof Error && error.message) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  });
}

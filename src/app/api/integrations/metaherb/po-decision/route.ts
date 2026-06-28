/**
 * Metaherb → ERP : PO approval decision (INBOUND)
 *
 * POST /api/integrations/metaherb/po-decision
 * Body: { erpPOID, decision: 'approved' | 'rejected', decidedBy? }
 *
 * Metaherb-admin's verdict on a Metaherb-originated PO. Auth: the same
 * service-account session Metaherb uses for dual-write (cookie session +
 * purchasing:write), per the integration spec.
 *
 * Merge rule (Metaherb approves first, then ERP owner finalises):
 *   approved → metaherbApproval='approved'; PO stays pending_approval
 *   rejected → metaherbApproval='rejected'; PO.status='rejected'
 * Idempotent — re-sending the same decision is a no-op.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { metaherbPoDecisionSchema } from '@/lib/validation/metaherb-po-webhook';
import { applyMetaherbPoDecision } from '@/lib/services/metaherb-po-approval.service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      let raw: unknown;
      try {
        raw = await request.json();
      } catch {
        return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
      }

      const parsed = metaherbPoDecisionSchema.safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: 'Validation error', details: parsed.error.issues },
          { status: 400 },
        );
      }

      const { erpPOID, decision, decidedBy } = parsed.data;
      try {
        const result = await applyMetaherbPoDecision(erpPOID, decision, decidedBy);
        if (!result.ok) {
          const map: Record<string, { msg: string; status: number }> = {
            PO_NOT_FOUND: { msg: 'PO not found', status: 404 },
            NOT_METAHERB_PO: { msg: 'PO is not a Metaherb purchase order', status: 400 },
            NOT_PENDING: { msg: 'PO is no longer awaiting approval', status: 409 },
          };
          const m = map[result.error] ?? { msg: result.error, status: 400 };
          return NextResponse.json({ success: false, error: m.msg }, { status: m.status });
        }
        return NextResponse.json({
          success: true,
          data: {
            erpPOID,
            decision,
            applied: result.status, // 'applied' | 'idempotent'
            poStatus: result.poStatus,
            metaherbApproval: result.metaherbApproval,
          },
        });
      } catch (error) {
        console.error('Error applying Metaherb PO decision:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to apply decision' },
          { status: 500 },
        );
      }
    },
    ['purchasing:write'],
  );
}

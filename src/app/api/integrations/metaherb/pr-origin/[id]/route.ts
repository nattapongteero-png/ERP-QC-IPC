/**
 * TEST-ONLY: mark a PR as Metaherb-originated.
 *
 * PATCH /api/integrations/metaherb/pr-origin/[id]
 * Body: { externalRef?: string }  → sets external_source='metaherb', external_ref=<ref>
 *       { clear: true }           → clears both (back to a normal ERP PR)
 *
 * There is no inbound Metaherb→ERP PR-creation path in scope yet, so nothing
 * populates external_source in production. This guarded endpoint exists ONLY to
 * exercise the outbound PR-status webhook in non-prod. It is DISABLED unless
 * METAHERB_WEBHOOK_TEST_ENABLE === 'true' AND the caller has settings:write.
 * Do NOT enable in production. No UI is wired to this.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { getNow } from '@/lib/db/date-utils';
import { withAuth, errorResponse, notFoundResponse, serverErrorResponse } from '@/lib/api-utils';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // Hard gate: off unless explicitly enabled for non-prod testing.
  if (process.env.METAHERB_WEBHOOK_TEST_ENABLE !== 'true') {
    return NextResponse.json(
      { success: false, error: 'Not found' },
      { status: 404 }
    );
  }

  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const prId = parseInt(id, 10);
        if (isNaN(prId)) {
          return errorResponse('Invalid PR ID');
        }

        let body: { externalRef?: string; clear?: boolean } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          // empty body is fine (defaults to set metaherb origin, no ref)
        }

        const prs = getTableRef('purchaseRequisitions');
        const existing = await executeDbOperation(async (db) =>
          db.select({ id: prs.id }).from(prs).where(eq(prs.id, prId)).limit(1)
        );
        if (existing.length === 0) {
          return notFoundResponse('PR not found');
        }

        const setValue = body.clear
          ? { externalSource: null, externalRef: null, updatedAt: getNow() }
          : {
              externalSource: 'metaherb',
              externalRef: body.externalRef ?? null,
              updatedAt: getNow(),
            };

        await executeDbOperation(async (db) =>
          db.update(prs).set(setValue).where(eq(prs.id, prId))
        );

        return NextResponse.json({
          success: true,
          data: { prId, externalSource: setValue.externalSource, externalRef: setValue.externalRef },
        });
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['settings:write']
  );
}

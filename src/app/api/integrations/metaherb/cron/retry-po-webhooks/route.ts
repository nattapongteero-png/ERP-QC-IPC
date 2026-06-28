/**
 * Metaherb PO-submit webhook — retry sweeper (cron)
 *
 * POST /api/integrations/metaherb/cron/retry-po-webhooks
 *
 * Re-sends Metaherb PO-submit deliveries that failed and are now due
 * (status='pending' AND next_retry_at <= now), re-signing each with a fresh
 * timestamp. Mirrors the PR-status retry cron.
 *
 * Security: requires CRON_SECRET (x-cron-secret header or Bearer token).
 */

import { NextRequest, NextResponse } from 'next/server';
import { retryDueMetaherbPoWebhooks } from '@/lib/services/metaherb-po-webhook.service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const cronSecret =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace('Bearer ', '');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error('CRON_SECRET environment variable is not configured');
    return NextResponse.json(
      { success: false, error: 'Cron endpoint not configured' },
      { status: 500 }
    );
  }

  if (cronSecret !== expectedSecret) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const summary = await retryDueMetaherbPoWebhooks();
  return NextResponse.json({ success: true, ...summary });
}

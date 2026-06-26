/**
 * Metaherb PR-status webhook — retry sweeper (cron)
 *
 * POST /api/integrations/metaherb/cron/retry-pr-webhooks
 *
 * Re-sends Metaherb PR-status deliveries that failed and are now due
 * (status='pending' AND next_retry_at <= now), re-signing each with a fresh
 * timestamp. Designed to be called by an external cron (every ~1 min for tight
 * 1m/5m/15m timing) and/or the in-app periodic trigger. Idempotent — Metaherb
 * dedupes, and the sweeper only picks up due rows.
 *
 * Security: requires CRON_SECRET (x-cron-secret header or Bearer token) — same
 * scheme as the VMI poll-orders cron.
 */

import { NextRequest, NextResponse } from 'next/server';
import { retryDueMetaherbPrWebhooks } from '@/lib/services/metaherb-pr-webhook.service';

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

  const summary = await retryDueMetaherbPrWebhooks();
  return NextResponse.json({ success: true, ...summary });
}

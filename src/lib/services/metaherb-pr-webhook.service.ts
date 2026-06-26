/**
 * Metaherb PR-status webhook — OUTBOUND sender + durable retry sweeper.
 *
 * When a Metaherb-originated PR (purchase_requisitions.external_source ===
 * 'metaherb') changes status, the ERP POSTs the new status to Metaherb's
 * PR-status endpoint, signed HMAC-SHA256 with the shared SSO secret — the same
 * signature scheme as the inbound VMI webhook (we reuse computeSignature).
 *
 * Design (see docs/superpowers/specs/2026-06-25-erp-pr-status-webhook-...):
 *  - Fire-and-forget AFTER the PR status commit (the caller awaits the DB write,
 *    not the network). notifyMetaherbPrStatus NEVER throws to its caller — a
 *    webhook failure can never roll back or fail the PR status change.
 *  - Durability: every attempt-set is a row in metaherb_pr_webhook_deliveries.
 *    A failed POST is left status='pending' with nextRetryAt set; a sweeper
 *    (retryDueMetaherbPrWebhooks, called by a CRON_SECRET route and once at
 *    boot) re-sends due rows. Retries RE-SIGN with a fresh timestamp because
 *    Metaherb (like our VMI validator) rejects a stale signature (~5 min TTL).
 *  - Terminal (never retry): 2xx success, 403 (cross-tenant — wrong company in
 *    URL), 400 (bad payload) and 401 (bad/expired signature) — the last two are
 *    OUR bug; retrying an identical request won't fix it, so we stop and log.
 *  - Retryable: network/timeout, 408, 429, and any 5xx → schedule 1m/5m/15m.
 */

import { eq, and, lte, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { getTableRef, executeDbOperation } from '../db/db-helper';
import { getNow, toDbDate } from '../db/date-utils';
import { getMetaherbSsoConfig } from './metaherb-sso.service';
import { computeSignature } from './vmi-webhook-crypto';
import {
  metaherbPrStatusBodySchema,
  type MetaherbPrStatus,
  type MetaherbPrStatusBody,
} from '../validation/metaherb-pr-webhook';

export type { MetaherbPrStatus, MetaherbPrStatusBody };

/** Max attempts before a delivery is marked terminally failed (inline + 3 retries). */
const MAX_ATTEMPTS = 4;
/** Backoff schedule in minutes, indexed by the attempt that just failed. */
const BACKOFF_MINUTES = [1, 5, 15];
/** Per-attempt network timeout. A hung Metaherb must not wedge the request. */
const FETCH_TIMEOUT_MS = 10_000;

function tables() {
  return {
    prs: getTableRef('purchaseRequisitions'),
    deliveries: getTableRef('metaherbPrWebhookDeliveries'),
  };
}

/**
 * Build the exact body Metaherb expects. companyKey is intentionally omitted
 * (the company is baked into the target URL). poNumber is included only for a
 * 'converted' status. Validated against the Zod schema so a bad shape throws
 * here (in our code) rather than being silently sent.
 */
export function buildMetaherbPrStatusBody(
  erpPRID: number,
  status: MetaherbPrStatus,
  poNumber?: string
): MetaherbPrStatusBody {
  const body: MetaherbPrStatusBody = { erpPRID, status };
  if (status === 'converted' && poNumber) {
    body.poNumber = poNumber;
  }
  return metaherbPrStatusBodySchema.parse(body);
}

/** attemptCount (after increment) → minutes until next retry, or null = terminal. */
function nextBackoffMinutes(attemptCount: number): number | null {
  // attemptCount 1 = first (inline) attempt just failed → wait BACKOFF[0]=1m.
  const idx = attemptCount - 1;
  if (idx < 0 || idx >= BACKOFF_MINUTES.length) return null;
  return BACKOFF_MINUTES[idx];
}

/** Whether an HTTP status is a terminal failure we must NOT retry. */
function isTerminalHttpStatus(httpStatus: number): boolean {
  // 403 cross-tenant, 400 bad payload, 401 bad/expired sig — retrying won't help.
  return httpStatus === 403 || httpStatus === 400 || httpStatus === 401;
}

interface SendOutcome {
  ok: boolean; // 2xx
  httpStatus: number | null; // null = network error / timeout (no response)
  error?: string;
  durationMs: number;
}

/**
 * Sign + POST one delivery's body. Re-signs with a fresh timestamp every call
 * (returns the ts/signature used so the caller can persist the latest attempt).
 */
async function sendOnce(
  url: string,
  rawBody: string,
  secret: string
): Promise<{ outcome: SendOutcome; ts: string; signature: string }> {
  const ts = Math.floor(Date.now() / 1000).toString();
  const signature = computeSignature(ts, rawBody, secret);
  const startedAt = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Timestamp': ts,
        'X-Webhook-Signature': signature,
      },
      body: rawBody,
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;
    return {
      outcome: {
        ok: res.ok,
        httpStatus: res.status,
        error: res.ok ? undefined : `HTTP ${res.status}`,
        durationMs,
      },
      ts,
      signature,
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const error = err instanceof Error ? err.message : String(err);
    return {
      outcome: { ok: false, httpStatus: null, error, durationMs },
      ts,
      signature,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Apply a send outcome to a delivery row: mark processed on success, terminal
 * 'failed' on a non-retryable status or exhausted attempts, else keep it
 * 'pending' with the next backoff. Pure-ish (returns the update object).
 */
function deliveryUpdateFromOutcome(
  outcome: SendOutcome,
  ts: string,
  signature: string,
  attemptCount: number
): Record<string, unknown> {
  const now = getNow();
  const base: Record<string, unknown> = {
    attemptCount,
    httpStatus: outcome.httpStatus,
    signature,
    timestamp: ts,
    lastError: outcome.error ?? null,
    processingDurationMs: outcome.durationMs,
    lastAttemptAt: now,
  };

  if (outcome.ok) {
    return { ...base, status: 'processed', nextRetryAt: null, processedAt: now };
  }

  // Non-retryable HTTP status → terminal failure immediately.
  if (outcome.httpStatus !== null && isTerminalHttpStatus(outcome.httpStatus)) {
    return { ...base, status: 'failed', nextRetryAt: null };
  }

  // Retryable (network/timeout/5xx/408/429) — schedule next attempt if any left.
  const minutes = attemptCount < MAX_ATTEMPTS ? nextBackoffMinutes(attemptCount) : null;
  if (minutes === null) {
    return { ...base, status: 'failed', nextRetryAt: null };
  }
  const retryAt = new Date(Date.now() + minutes * 60_000).toISOString();
  return { ...base, status: 'pending', nextRetryAt: toDbDate(retryAt) };
}

/**
 * Is this PR's origin Metaherb? Tolerant by design: Metaherb stamps the source
 * with different casings/suffixes across its surfaces (e.g. 'metaherb',
 * 'METAHERB_WEB'), so we match any value that starts with "metaherb"
 * case-insensitively rather than an exact 'metaherb'. NULL/empty → false.
 */
export function isMetaherbOrigin(externalSource: string | null | undefined): boolean {
  return typeof externalSource === 'string'
    && externalSource.trim().toLowerCase().startsWith('metaherb');
}

/**
 * OUTBOUND entry point — call AFTER a PR status commit, fire-and-forget.
 * Skips silently for non-Metaherb PRs. Never throws.
 */
export async function notifyMetaherbPrStatus(
  prId: number,
  status: MetaherbPrStatus,
  poNumber?: string
): Promise<void> {
  try {
    const t = tables();

    // Re-read the PR to learn its origin + own id (the erpPRID we send).
    const prRows = await executeDbOperation(async (db) =>
      db
        .select({
          id: t.prs.id,
          externalSource: t.prs.externalSource,
        })
        .from(t.prs)
        .where(eq(t.prs.id, prId))
        .limit(1)
    );
    const pr = prRows[0];
    if (!pr) {
      console.warn(`[metaherb-pr-webhook] PR ${prId} not found — skipping notify`);
      return;
    }
    // Only Metaherb-originated PRs are pushed back. Silent skip otherwise.
    if (!isMetaherbOrigin(pr.externalSource)) {
      return;
    }

    const cfg = await getMetaherbSsoConfig();
    const url = cfg.prStatusUrl;
    const secret = cfg.ssoSecret;

    const body = buildMetaherbPrStatusBody(pr.id as number, status, poNumber);
    const rawBody = JSON.stringify(body);
    const deliveryId = randomUUID();

    // Config missing → record a terminal failed row (nothing to retry against).
    if (!url || !secret) {
      const now = getNow();
      await executeDbOperation(async (db) =>
        db.insert(t.deliveries).values({
          prId: pr.id as number,
          deliveryId,
          eventType: status,
          targetUrl: url ?? '',
          payload: rawBody,
          signature: '',
          timestamp: '',
          status: 'failed',
          attemptCount: 0,
          lastError: 'config_missing',
          createdAt: now,
        })
      );
      console.error(
        `[metaherb-pr-webhook] config missing (url=${!!url} secret=${!!secret}) — PR ${prId} status ${status} not sent`
      );
      return;
    }

    // Persist a pending row FIRST so the sweeper can resume even if this process
    // dies before the POST returns.
    const nowIso = getNow();
    await executeDbOperation(async (db) =>
      db.insert(t.deliveries).values({
        prId: pr.id as number,
        deliveryId,
        eventType: status,
        targetUrl: url,
        payload: rawBody,
        signature: '',
        timestamp: '',
        status: 'pending',
        attemptCount: 0,
        nextRetryAt: toDbDate(new Date().toISOString()),
        createdAt: nowIso,
      })
    );

    // First (inline) attempt.
    const { outcome, ts, signature } = await sendOnce(url, rawBody, secret);
    const update = deliveryUpdateFromOutcome(outcome, ts, signature, 1);
    await executeDbOperation(async (db) =>
      db.update(t.deliveries).set(update).where(eq(t.deliveries.deliveryId, deliveryId))
    );

    if (!outcome.ok) {
      console.warn(
        `[metaherb-pr-webhook] PR ${prId} status ${status} attempt 1 failed (${outcome.error}) — ${
          (update.status as string) === 'failed' ? 'terminal' : 'will retry'
        }`
      );
    }
  } catch (err) {
    // Absolutely never propagate — the PR status change must stand regardless.
    console.error(
      `[metaherb-pr-webhook] unexpected error notifying PR ${prId} status ${status}:`,
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Durable retry sweeper. Re-sends deliveries where status='pending' AND
 * nextRetryAt <= now. Re-signs each with a fresh timestamp. Called by the
 * CRON_SECRET route and once at boot. Never throws.
 */
export async function retryDueMetaherbPrWebhooks(): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
  rescheduled: number;
}> {
  const summary = { attempted: 0, succeeded: 0, failed: 0, rescheduled: 0 };
  try {
    const t = tables();
    const nowDb = toDbDate(new Date().toISOString());

    const due = await executeDbOperation(async (db) =>
      db
        .select({
          id: t.deliveries.id,
          deliveryId: t.deliveries.deliveryId,
          targetUrl: t.deliveries.targetUrl,
          payload: t.deliveries.payload,
          attemptCount: t.deliveries.attemptCount,
        })
        .from(t.deliveries)
        .where(and(eq(t.deliveries.status, 'pending'), lte(t.deliveries.nextRetryAt, nowDb)))
        .limit(100)
    );

    if (due.length === 0) return summary;

    // The secret is shared across all deliveries — load config once.
    const cfg = await getMetaherbSsoConfig();
    const secret = cfg.ssoSecret;
    if (!secret) {
      // No secret → can't sign anything; mark all due rows failed so they don't
      // spin forever. (Operationally this means SSO secret got cleared.)
      const ids = due.map((d: { id: number }) => d.id);
      await executeDbOperation(async (db) =>
        db
          .update(t.deliveries)
          .set({ status: 'failed', nextRetryAt: null, lastError: 'config_missing', lastAttemptAt: getNow() })
          .where(inArray(t.deliveries.id, ids))
      );
      summary.attempted = due.length;
      summary.failed = due.length;
      console.error('[metaherb-pr-webhook] sweeper: SSO secret missing — failed', due.length, 'due deliveries');
      return summary;
    }

    for (const d of due as Array<{
      deliveryId: string;
      targetUrl: string;
      payload: string;
      attemptCount: number;
    }>) {
      summary.attempted++;
      const attemptCount = (d.attemptCount ?? 0) + 1;
      const { outcome, ts, signature } = await sendOnce(d.targetUrl, d.payload, secret);
      const update = deliveryUpdateFromOutcome(outcome, ts, signature, attemptCount);
      await executeDbOperation(async (db) =>
        db.update(t.deliveries).set(update).where(eq(t.deliveries.deliveryId, d.deliveryId))
      );
      if (outcome.ok) summary.succeeded++;
      else if ((update.status as string) === 'failed') summary.failed++;
      else summary.rescheduled++;
    }
  } catch (err) {
    console.error(
      '[metaherb-pr-webhook] sweeper error:',
      err instanceof Error ? err.message : err
    );
  }
  return summary;
}

/**
 * Metaherb PO-submit webhook — OUTBOUND sender + durable retry sweeper.
 *
 * When a Metaherb-originated PO (vendor.code === 'METAHERB') is submitted for
 * approval, the ERP POSTs the PO to Metaherb's po-submit endpoint so it appears
 * in the Metaherb-admin approval queue. Signed HMAC-SHA256 with the shared SSO
 * secret — the SAME signature scheme as the PR-status webhook (we reuse
 * computeSignature: HMAC over `timestamp + "." + rawBody`).
 *
 * Design mirrors metaherb-pr-webhook.service.ts:
 *  - Fire-and-forget AFTER the PO status commit. notifyMetaherbPoSubmit NEVER
 *    throws to its caller — a webhook failure can't roll back the PO change.
 *  - Durability: every attempt is a row in metaherb_po_webhook_deliveries. A
 *    failed POST stays status='pending' with nextRetryAt; a sweeper
 *    (retryDueMetaherbPoWebhooks, called by a CRON_SECRET route + once at boot)
 *    re-sends due rows, re-signing with a fresh timestamp (~5min TTL).
 *  - Terminal (never retry): 2xx, 403 (wrong company in URL), 400 (bad payload),
 *    401 (bad/expired signature). Retryable: network/timeout, 408, 429, any 5xx.
 */

import { eq, and, lte, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { getTableRef, executeDbOperation } from '../db/db-helper';
import { getNow, toDbDate, formatDateFromDb, getTodayStr } from '../db/date-utils';
import { getMetaherbSsoConfig, derivePoOwnerDecisionUrl } from './metaherb-sso.service';
import { computeSignature } from './vmi-webhook-crypto';
import {
  metaherbPoSubmitBodySchema,
  metaherbPoOwnerDecisionBodySchema,
  type MetaherbPoSubmitBody,
  type MetaherbPoItem,
} from '../validation/metaherb-po-webhook';

export type { MetaherbPoSubmitBody };

/** The vendor code that marks a PO as Metaherb-originated. */
export const METAHERB_VENDOR_CODE = 'METAHERB';

const MAX_ATTEMPTS = 4;
const BACKOFF_MINUTES = [1, 5, 15];
const FETCH_TIMEOUT_MS = 10_000;

function tables() {
  return {
    pos: getTableRef('purchaseOrders'),
    poLines: getTableRef('purchaseOrderLines'),
    vendors: getTableRef('vendors'),
    items: getTableRef('items'),
    deliveries: getTableRef('metaherbPoWebhookDeliveries'),
  };
}

/** attemptCount (after increment) → minutes until next retry, or null = terminal. */
function nextBackoffMinutes(attemptCount: number): number | null {
  const idx = attemptCount - 1;
  if (idx < 0 || idx >= BACKOFF_MINUTES.length) return null;
  return BACKOFF_MINUTES[idx];
}

function isTerminalHttpStatus(httpStatus: number): boolean {
  return httpStatus === 403 || httpStatus === 400 || httpStatus === 401;
}

interface SendOutcome {
  ok: boolean;
  httpStatus: number | null;
  error?: string;
  durationMs: number;
}

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
  if (outcome.httpStatus !== null && isTerminalHttpStatus(outcome.httpStatus)) {
    return { ...base, status: 'failed', nextRetryAt: null };
  }
  const minutes = attemptCount < MAX_ATTEMPTS ? nextBackoffMinutes(attemptCount) : null;
  if (minutes === null) {
    return { ...base, status: 'failed', nextRetryAt: null };
  }
  const retryAt = new Date(Date.now() + minutes * 60_000).toISOString();
  return { ...base, status: 'pending', nextRetryAt: toDbDate(retryAt) };
}

/** Is this PO's vendor the Metaherb vendor? (code === 'METAHERB', case-insensitive). */
export function isMetaherbVendorCode(code: string | null | undefined): boolean {
  return typeof code === 'string' && code.trim().toUpperCase() === METAHERB_VENDOR_CODE;
}

interface PoForWebhook {
  id: number;
  poNumber: string;
  orderDate: Date | string | null;
  totalAmount: number | null;
  paymentTerms: string | null;
  vendorCode: string | null;
  vendorName: string | null;
}

/** Load the PO header + vendor for the webhook. Returns null if not found. */
async function loadPoHeader(poId: number): Promise<PoForWebhook | null> {
  const t = tables();
  const rows = await executeDbOperation(async (db) =>
    db
      .select({
        id: t.pos.id,
        poNumber: t.pos.poNumber,
        orderDate: t.pos.orderDate,
        totalAmount: t.pos.totalAmount,
        paymentTerms: t.pos.paymentTerms,
        vendorCode: t.vendors.code,
        vendorName: t.vendors.name,
      })
      .from(t.pos)
      .leftJoin(t.vendors, eq(t.pos.vendorId, t.vendors.id))
      .where(eq(t.pos.id, poId))
      .limit(1)
  );
  return (rows[0] as PoForWebhook | undefined) ?? null;
}

/** Build the items[] array from PO lines (joined to items for the name). */
async function loadPoItems(poId: number): Promise<MetaherbPoItem[]> {
  const t = tables();
  const rows = await executeDbOperation(async (db) =>
    db
      .select({
        itemName: t.items.nameTh,
        notes: t.poLines.notes,
        quantity: t.poLines.quantity,
        unit: t.poLines.unit,
        unitPrice: t.poLines.unitPrice,
      })
      .from(t.poLines)
      .leftJoin(t.items, eq(t.poLines.itemId, t.items.id))
      .where(eq(t.poLines.poId, poId))
  );
  return rows.map((r: any) => ({
    name: r.itemName || r.notes || '',
    qty: Number(r.quantity) || 0,
    unit: r.unit || undefined,
    pricePerUnit: r.unitPrice != null ? Number(r.unitPrice) : undefined,
  }));
}

/**
 * Build the exact body Metaherb expects for po-submit. Validated against the
 * Zod schema so a bad shape throws here (in our code) rather than being sent.
 */
export async function buildMetaherbPoSubmitBody(
  po: PoForWebhook,
  factoryName: string | null,
  items: MetaherbPoItem[]
): Promise<MetaherbPoSubmitBody> {
  const poDate = formatDateFromDb(po.orderDate) || getTodayStr();
  const body = {
    erpPOID: po.id,
    poNumber: po.poNumber,
    poDate,
    factory: factoryName ?? '',
    supplier: po.vendorName ?? '',
    paymentTerms: po.paymentTerms ?? undefined,
    total: Number(po.totalAmount) || 0,
    items,
  };
  return metaherbPoSubmitBodySchema.parse(body);
}

/**
 * OUTBOUND entry point — call AFTER a PO is submitted for approval, fire-and-
 * forget. Skips silently for non-Metaherb POs. Never throws.
 */
/**
 * Persist a delivery row + make the first (inline) attempt. Shared by the
 * po-submit and po-owner-decision senders. `url`/`secret` may be null → a
 * terminal config_missing row is written and nothing is sent. Never throws.
 */
async function dispatchPoDelivery(args: {
  poId: number;
  eventType: 'po_submit' | 'po_owner_decision';
  url: string | null;
  secret: string | null;
  rawBody: string;
}): Promise<void> {
  const { poId, eventType, url, secret, rawBody } = args;
  const t = tables();
  const deliveryId = randomUUID();

  if (!url || !secret) {
    const now = getNow();
    await executeDbOperation(async (db) =>
      db.insert(t.deliveries).values({
        poId,
        deliveryId,
        eventType,
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
      `[metaherb-po-webhook] config missing (url=${!!url} secret=${!!secret}) — PO ${poId} ${eventType} not sent`
    );
    return;
  }

  // Persist a pending row FIRST so the sweeper can resume even if this process
  // dies before the POST returns.
  const nowIso = getNow();
  await executeDbOperation(async (db) =>
    db.insert(t.deliveries).values({
      poId,
      deliveryId,
      eventType,
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

  const { outcome, ts, signature } = await sendOnce(url, rawBody, secret);
  const update = deliveryUpdateFromOutcome(outcome, ts, signature, 1);
  await executeDbOperation(async (db) =>
    db.update(t.deliveries).set(update).where(eq(t.deliveries.deliveryId, deliveryId))
  );

  if (!outcome.ok) {
    console.warn(
      `[metaherb-po-webhook] PO ${poId} ${eventType} attempt 1 failed (${outcome.error}) — ${
        (update.status as string) === 'failed' ? 'terminal' : 'will retry'
      }`
    );
  }
}

export async function notifyMetaherbPoSubmit(poId: number): Promise<void> {
  try {
    const po = await loadPoHeader(poId);
    if (!po) {
      console.warn(`[metaherb-po-webhook] PO ${poId} not found — skipping notify`);
      return;
    }
    // Only Metaherb POs are pushed. Silent skip otherwise.
    if (!isMetaherbVendorCode(po.vendorCode)) {
      return;
    }

    const cfg = await getMetaherbSsoConfig();
    const items = await loadPoItems(poId);
    const body = await buildMetaherbPoSubmitBody(po, cfg.factoryName, items);
    await dispatchPoDelivery({
      poId: po.id,
      eventType: 'po_submit',
      url: cfg.poSubmitUrl,
      secret: cfg.ssoSecret,
      rawBody: JSON.stringify(body),
    });
  } catch (err) {
    console.error(
      `[metaherb-po-webhook] unexpected error notifying PO ${poId} submit:`,
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * OUTBOUND — tell Metaherb the ERP owner's verdict on a Metaherb PO. Call AFTER
 * the PO status commit, fire-and-forget. Skips silently for non-Metaherb POs.
 * Never throws.
 */
export async function notifyMetaherbPoOwnerDecision(
  poId: number,
  decision: 'approved' | 'rejected',
  poNumber: string
): Promise<void> {
  try {
    const po = await loadPoHeader(poId);
    if (!po) {
      console.warn(`[metaherb-po-webhook] PO ${poId} not found — skipping owner-decision notify`);
      return;
    }
    if (!isMetaherbVendorCode(po.vendorCode)) {
      return;
    }

    const cfg = await getMetaherbSsoConfig();
    const url = derivePoOwnerDecisionUrl(cfg.poSubmitUrl);
    const body = metaherbPoOwnerDecisionBodySchema.parse({
      erpPOID: po.id,
      decision,
      poNumber: poNumber || po.poNumber,
    });
    await dispatchPoDelivery({
      poId: po.id,
      eventType: 'po_owner_decision',
      url,
      secret: cfg.ssoSecret,
      rawBody: JSON.stringify(body),
    });
  } catch (err) {
    console.error(
      `[metaherb-po-webhook] unexpected error notifying PO ${poId} owner-decision:`,
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Durable retry sweeper. Re-sends deliveries where status='pending' AND
 * nextRetryAt <= now. Re-signs each with a fresh timestamp. Never throws.
 */
export async function retryDueMetaherbPoWebhooks(): Promise<{
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

    const cfg = await getMetaherbSsoConfig();
    const secret = cfg.ssoSecret;
    if (!secret) {
      const ids = due.map((d: { id: number }) => d.id);
      await executeDbOperation(async (db) =>
        db
          .update(t.deliveries)
          .set({ status: 'failed', nextRetryAt: null, lastError: 'config_missing', lastAttemptAt: getNow() })
          .where(inArray(t.deliveries.id, ids))
      );
      summary.attempted = due.length;
      summary.failed = due.length;
      console.error('[metaherb-po-webhook] sweeper: SSO secret missing — failed', due.length, 'due deliveries');
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
      '[metaherb-po-webhook] sweeper error:',
      err instanceof Error ? err.message : err
    );
  }
  return summary;
}

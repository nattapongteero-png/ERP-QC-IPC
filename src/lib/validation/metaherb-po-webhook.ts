/**
 * Metaherb PO-submit webhook (OUTBOUND) — Zod validation.
 *
 * Shapes the body the ERP POSTs to Metaherb when a Metaherb-originated PO is
 * submitted for approval. companyKey is intentionally absent — the company is
 * baked into the target URL (.../po-submit/<company>). Mirrors the PR-status
 * webhook signing scheme (HMAC over timestamp + "." + rawBody).
 */

import { z } from 'zod';
import { PAYMENT_TERMS_VALUES } from '@/lib/constants/payment-terms';

export const metaherbPoItemSchema = z.object({
  name: z.string(),
  grade: z.string().optional(),
  qty: z.number(),
  unit: z.string().optional(),
  pricePerUnit: z.number().optional(),
  image: z.string().optional(),
  // Partner line correlation echoed back to Metaherb. null = the line has no
  // origin in Metaherb's system (ERP-added, or a PO created without a PR).
  externalLineRef: z.string().nullable().optional(),
});

export type MetaherbPoItem = z.infer<typeof metaherbPoItemSchema>;

export const metaherbPoSubmitBodySchema = z.object({
  erpPOID: z.number().int().positive(),
  poNumber: z.string().min(1),
  poDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  factory: z.string(), // our company/factory name (may be '')
  supplier: z.string(), // vendor (METAHERB) name
  // Whitelisted payment term (canonical code or empty). The PO value is
  // normalized at build time, so a legacy free-text value can't leak to Metaherb.
  paymentTerms: z.enum(PAYMENT_TERMS_VALUES).optional(),
  total: z.number(),
  items: z.array(metaherbPoItemSchema),
});

export type MetaherbPoSubmitBody = z.infer<typeof metaherbPoSubmitBodySchema>;

/**
 * Inbound po-decision body — Metaherb tells the ERP its admin's verdict.
 */
export const metaherbPoDecisionSchema = z.object({
  erpPOID: z.number().int().positive(),
  decision: z.enum(['approved', 'rejected']),
  decidedBy: z.string().optional(),
});

export type MetaherbPoDecision = z.infer<typeof metaherbPoDecisionSchema>;

/**
 * Outbound po-owner-decision body — the ERP tells Metaherb the owner's verdict
 * on a Metaherb PO (so Metaherb shows the ERP side + forwards to the store once
 * both sides agree). Same signing scheme as po-submit.
 */
export const metaherbPoOwnerDecisionBodySchema = z.object({
  erpPOID: z.number().int().positive(),
  decision: z.enum(['approved', 'rejected']),
  poNumber: z.string().min(1),
  // The owner's rejection reason — present only on a 'rejected' decision.
  reason: z.string().optional(),
  // The PO's final lines (with externalLineRef) — sent on 'approved' so Metaherb
  // can reserve/cut stock against the actual approved lines (PO lines are
  // editable until approval). Omitted on reject.
  items: z.array(metaherbPoItemSchema).optional(),
});

export type MetaherbPoOwnerDecisionBody = z.infer<typeof metaherbPoOwnerDecisionBodySchema>;

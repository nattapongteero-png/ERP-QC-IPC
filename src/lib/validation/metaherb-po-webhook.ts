/**
 * Metaherb PO-submit webhook (OUTBOUND) — Zod validation.
 *
 * Shapes the body the ERP POSTs to Metaherb when a Metaherb-originated PO is
 * submitted for approval. companyKey is intentionally absent — the company is
 * baked into the target URL (.../po-submit/<company>). Mirrors the PR-status
 * webhook signing scheme (HMAC over timestamp + "." + rawBody).
 */

import { z } from 'zod';

export const metaherbPoItemSchema = z.object({
  name: z.string(),
  grade: z.string().optional(),
  qty: z.number(),
  unit: z.string().optional(),
  pricePerUnit: z.number().optional(),
  image: z.string().optional(),
});

export type MetaherbPoItem = z.infer<typeof metaherbPoItemSchema>;

export const metaherbPoSubmitBodySchema = z.object({
  erpPOID: z.number().int().positive(),
  poNumber: z.string().min(1),
  poDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  factory: z.string(), // our company/factory name (may be '')
  supplier: z.string(), // vendor (METAHERB) name
  paymentTerms: z.string().optional(),
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

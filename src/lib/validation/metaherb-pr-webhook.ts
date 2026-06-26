/**
 * Metaherb PR-status webhook (OUTBOUND) — Zod validation
 *
 * Shapes the body the ERP POSTs to Metaherb when a Metaherb-originated PR
 * changes status. companyKey is intentionally absent — the company is baked
 * into the target URL (.../pr-status/<company>).
 *
 * Body: { erpPRID, status, poNumber? }  (poNumber only when status==='converted')
 */

import { z } from 'zod';

/** The four PR statuses Metaherb cares about. */
export const metaherbPrStatusEnum = z.enum([
  'approved',
  'rejected',
  'converted',
  'cancelled',
]);

export type MetaherbPrStatus = z.infer<typeof metaherbPrStatusEnum>;

/**
 * Outbound body. `poNumber` is allowed only for 'converted' (a PO number only
 * exists once the PR has been converted to a PO). The refine keeps a stray
 * poNumber from leaking onto approve/reject/cancel payloads.
 */
export const metaherbPrStatusBodySchema = z
  .object({
    erpPRID: z.number().int().positive(),
    status: metaherbPrStatusEnum,
    poNumber: z.string().min(1).optional(),
  })
  .refine(
    (b) => b.status === 'converted' || b.poNumber === undefined,
    { message: 'poNumber is only allowed when status is "converted"', path: ['poNumber'] }
  );

export type MetaherbPrStatusBody = z.infer<typeof metaherbPrStatusBodySchema>;

/**
 * Metaherb PO dual-approval — merge the Metaherb-admin decision into the ERP PO.
 *
 * PARALLEL approval: the ERP owner and Metaherb approve independently, either
 * order. The PO becomes 'approved' only when BOTH sides are 'approved'; it
 * becomes 'rejected' the moment either side rejects.
 *
 *   decision = 'approved' → metaherbApproval='approved'; if the owner already
 *                            approved → status='approved', else stays
 *                            'pending_approval'.
 *   decision = 'rejected' → metaherbApproval='rejected'; status='rejected'.
 *
 * Idempotent: re-applying the same decision is a no-op (no duplicate side effects).
 */

import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '../db/db-helper';
import { getNow } from '../db/date-utils';

export type MetaherbPoDecisionValue = 'approved' | 'rejected';

export type ApplyPoDecisionResult =
  | { ok: true; status: 'idempotent' | 'applied'; poStatus: string; metaherbApproval: string }
  | { ok: false; error: 'PO_NOT_FOUND' | 'NOT_METAHERB_PO' | 'NOT_PENDING' };

function tables() {
  return {
    pos: getTableRef('purchaseOrders'),
    vendors: getTableRef('vendors'),
  };
}

/**
 * Apply Metaherb-admin's verdict to a PO. erpPOID is the ERP's own PO id.
 * Returns a discriminated result the route maps to an HTTP response.
 */
export async function applyMetaherbPoDecision(
  erpPOID: number,
  decision: MetaherbPoDecisionValue,
  decidedBy?: string,
): Promise<ApplyPoDecisionResult> {
  return executeDbOperation(async (db) => {
    const t = tables();

    const rows = await db
      .select({
        id: t.pos.id,
        status: t.pos.status,
        metaherbApproval: t.pos.metaherbApproval,
        erpOwnerApproval: t.pos.erpOwnerApproval,
        vendorCode: t.vendors.code,
      })
      .from(t.pos)
      .leftJoin(t.vendors, eq(t.pos.vendorId, t.vendors.id))
      .where(eq(t.pos.id, erpPOID))
      .limit(1);

    const po = rows[0];
    if (!po) return { ok: false, error: 'PO_NOT_FOUND' } as const;

    const isMetaherb =
      typeof po.vendorCode === 'string' && po.vendorCode.trim().toUpperCase() === 'METAHERB';
    if (!isMetaherb) return { ok: false, error: 'NOT_METAHERB_PO' } as const;

    // Idempotency: same decision already recorded → no-op.
    if (po.metaherbApproval === decision) {
      return {
        ok: true,
        status: 'idempotent',
        poStatus: po.status,
        metaherbApproval: po.metaherbApproval,
      } as const;
    }

    const now = getNow();

    if (decision === 'rejected') {
      // Either side rejecting terminates the PO. Allowed from pending_approval
      // (and harmlessly from draft if the queue raced). Don't touch a PO that
      // already advanced past approval (sent/received/etc).
      if (!['draft', 'pending_approval'].includes(po.status)) {
        return { ok: false, error: 'NOT_PENDING' } as const;
      }
      await db
        .update(t.pos)
        .set({ metaherbApproval: 'rejected', status: 'rejected', updatedAt: now })
        .where(eq(t.pos.id, erpPOID));
      return { ok: true, status: 'applied', poStatus: 'rejected', metaherbApproval: 'rejected' } as const;
    }

    // decision === 'approved' — record Metaherb's approval. Parallel rule: if the
    // ERP owner already approved, both sides are in → PO becomes 'approved';
    // otherwise it waits in pending_approval for the owner.
    const bothApproved = po.erpOwnerApproval === 'approved';
    const newPoStatus = bothApproved ? 'approved' : po.status;
    await db
      .update(t.pos)
      .set({
        metaherbApproval: 'approved',
        status: newPoStatus,
        updatedAt: now,
      })
      .where(eq(t.pos.id, erpPOID));

    // decidedBy is accepted for audit/logging by the caller; not persisted here.
    void decidedBy;

    return {
      ok: true,
      status: 'applied',
      poStatus: newPoStatus,
      metaherbApproval: 'approved',
    } as const;
  });
}

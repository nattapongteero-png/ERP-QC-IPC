import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate, parseDbDate } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PO lifecycle state machine — enforced server-side so a PO cannot skip the
// approval step (e.g. jump draft → received). The receive endpoint advances
// 'partial'/'received' from 'sent' as goods arrive.
//   draft → pending_approval → approved → sent → partial → received
// Any non-terminal status may be cancelled. Re-setting the same status (no-op)
// and edits that don't change status are always allowed.
const PO_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_approval', 'cancelled'],
  pending_approval: ['approved', 'draft', 'cancelled'],
  approved: ['sent', 'cancelled'],
  sent: ['partial', 'received', 'cancelled'],
  partial: ['received', 'cancelled'],
  received: [],
  cancelled: [],
};

// GET /api/purchasing/orders/[id] - Get single purchase order
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const poId = parseInt(id);

      if (isNaN(poId)) {
        return errorResponse('Invalid PO ID');
      }

      const poTable = getTableRef('purchaseOrders');
      const vendorsTable = getTableRef('vendors');

      const order = await executeDbOperation(async (db) => {
        const result = await db
          .select({
            id: poTable.id,
            poNumber: poTable.poNumber,
            vendorId: poTable.vendorId,
            vendorCode: vendorsTable.code,
            vendorName: vendorsTable.name,
            status: poTable.status,
            orderDate: poTable.orderDate,
            expectedDate: poTable.expectedDate,
            totalAmount: poTable.totalAmount,
            currency: poTable.currency,
            paymentTerms: poTable.paymentTerms,
            shippingAddress: poTable.shippingAddress,
            notes: poTable.notes,
            createdAt: poTable.createdAt,
            updatedAt: poTable.updatedAt,
          })
          .from(poTable)
          .leftJoin(vendorsTable, eq(poTable.vendorId, vendorsTable.id))
          .where(eq(poTable.id, poId))
          .limit(1);

        return result[0] || null;
      });

      if (!order) {
        return errorResponse('Purchase order not found', 404);
      }

      return successResponse(order);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:read']);
}

// PUT /api/purchasing/orders/[id] - Update purchase order
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const poId = parseInt(id);

      if (isNaN(poId)) {
        return errorResponse('Invalid PO ID');
      }

      const body = await request.json();
      const {
        vendorId,
        status,
        orderDate,
        expectedDate,
        paymentTerms,
        shippingAddress,
        notes,
      } = body;

      const poTable = getTableRef('purchaseOrders');
      const vendorsTbl = getTableRef('vendors');

      // Check if PO exists (join vendor so we know if it's a Metaherb PO).
      const existing = await executeDbOperation(async (db) => {
        const result = await db
          .select({
            id: poTable.id,
            status: poTable.status,
            vendorId: poTable.vendorId,
            metaherbApproval: poTable.metaherbApproval,
            vendorCode: vendorsTbl.code,
          })
          .from(poTable)
          .leftJoin(vendorsTbl, eq(poTable.vendorId, vendorsTbl.id))
          .where(eq(poTable.id, poId))
          .limit(1);
        return result[0] || null;
      });

      if (!existing) {
        return errorResponse('Purchase order not found', 404);
      }

      // Metaherb dual-approval gate. A PO whose vendor is METAHERB needs BOTH
      // the ERP owner AND Metaherb-admin to approve before it can become
      // 'approved'. Either side rejecting → rejected.
      const isMetaherbPO =
        typeof existing.vendorCode === 'string' &&
        existing.vendorCode.trim().toUpperCase() === 'METAHERB';
      // Set true below when this PATCH submits a Metaherb PO for approval, so we
      // fire the po-submit webhook after the DB commit.
      let firePoSubmit = false;

      // Enforce the PO lifecycle: reject illegal status jumps (e.g. skipping
      // approval). A no-op (same status) or a status-less edit is allowed.
      if (status !== undefined && status !== existing.status) {
        const allowed = PO_STATUS_TRANSITIONS[existing.status] ?? [];
        if (!allowed.includes(status)) {
          return errorResponse(
            `ไม่สามารถเปลี่ยนสถานะจาก "${existing.status}" เป็น "${status}" ได้` +
              (allowed.length
                ? ` (อนุญาต: ${allowed.join(', ')})`
                : ' (สถานะนี้สิ้นสุดแล้ว)'),
            400,
          );
        }
      }

      // Dual-approval gate for Metaherb POs: the ERP owner may only finalise the
      // approval once Metaherb-admin has approved. If Metaherb hasn't decided yet,
      // block the owner's 'approved' click (keep it pending_approval). If Metaherb
      // already rejected, the PO is rejected, not approvable.
      if (isMetaherbPO && status === 'approved' && existing.status !== 'approved') {
        if (existing.metaherbApproval === 'rejected') {
          return errorResponse(
            'ใบสั่งซื้อนี้ถูกปฏิเสธโดย Metaherb แล้ว ไม่สามารถอนุมัติได้',
            400,
          );
        }
        if (existing.metaherbApproval !== 'approved') {
          return errorResponse(
            'ใบสั่งซื้อจาก Metaherb ต้องรอ Metaherb อนุมัติก่อน จึงจะอนุมัติฝั่งโรงงานได้ (ขณะนี้ยังรอผลจาก Metaherb)',
            400,
          );
        }
      }

      // Build update object
      const updateData: Record<string, unknown> = {
        updatedAt: dbDate(),
      };

      if (vendorId !== undefined) updateData.vendorId = vendorId;
      if (status !== undefined) updateData.status = status;
      if (orderDate !== undefined) updateData.orderDate = parseDbDate(orderDate);
      if (expectedDate !== undefined) updateData.expectedDate = parseDbDate(expectedDate);
      if (paymentTerms !== undefined) updateData.paymentTerms = paymentTerms;
      if (shippingAddress !== undefined) updateData.shippingAddress = shippingAddress;
      if (notes !== undefined) updateData.notes = notes;

      // Metaherb PO submitted for approval → mark its Metaherb side 'pending' and
      // queue the po-submit webhook (fired after commit) so it lands in the
      // Metaherb-admin approval queue.
      if (isMetaherbPO && status === 'pending_approval' && existing.status !== 'pending_approval') {
        updateData.metaherbApproval = 'pending';
        firePoSubmit = true;
      }

      // Stamp who/when on approval, and how/when on send-to-vendor, so the detail
      // page can show "อนุมัติโดย … / ส่งทาง … เมื่อ …" instead of a bare status.
      if (status === 'approved' && existing.status !== 'approved') {
        updateData.approvedBy = session.userId;
        updateData.approvedAt = dbDate();
      }
      if (status === 'sent' && existing.status !== 'sent') {
        // No automated email yet — record the channel (defaults to 'email') and
        // the vendor's email address so the UI can report how it was sent.
        const vendorsTable = getTableRef('vendors');
        const vrow = await executeDbOperation(async (db) =>
          db.select({ email: vendorsTable.email })
            .from(vendorsTable)
            .where(eq(vendorsTable.id, existing.vendorId))
            .limit(1),
        );
        updateData.sentVia = body.sentVia || 'email';
        updateData.sentAt = dbDate();
        updateData.sentToEmail = vrow[0]?.email ?? null;
      }

      // Update PO
      await executeDbOperation(async (db) => {
        return db.update(poTable).set(updateData).where(eq(poTable.id, poId));
      });

      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'purchase_orders',
        recordId: poId,
        oldValue: { status: existing.status },
        newValue: updateData,
        ipAddress: getClientIP(request),
      });

      // After commit: push the PO into Metaherb's approval queue. Fire-and-forget
      // (never throws to caller) so a webhook failure can't fail the submit; a
      // durable retry sweeper resends failed deliveries.
      if (firePoSubmit) {
        try {
          const { notifyMetaherbPoSubmit } = await import('@/lib/services/metaherb-po-webhook.service');
          void notifyMetaherbPoSubmit(poId);
        } catch (err) {
          console.warn('Metaherb po-submit webhook dispatch failed (non-fatal):', err);
        }
      }

      // Auto-create a Goods Receipt once the PO advances past draft, so the PO
      // lines appear on the GRN screen (quarantine → QC checklist → release).
      // Triggered on the first transition into any of approved/sent/partial/
      // received — covers POs advanced via this PATCH or the legacy /receive
      // path (which sets 'received'/'partial'). Idempotent
      // (autoCreateGrnForSource skips if a GRN already exists) and best-effort:
      // never fail the PO update if GRN creation errors.
      const GRN_TRIGGER_STATUSES = ['approved', 'sent', 'partial', 'received'];
      if (
        status !== undefined &&
        GRN_TRIGGER_STATUSES.includes(status) &&
        status !== existing.status
      ) {
        try {
          const { autoCreateGrnForSource } = await import('@/lib/services/goods-receipt.service');
          await autoCreateGrnForSource({ sourceType: 'po', poId, userId: session.userId });
        } catch (err) {
          console.warn('PO auto-GRN failed (non-fatal):', err);
        }
      }

      return successResponse({ id: poId }, 'Purchase order updated successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:write']);
}

// DELETE /api/purchasing/orders/[id] - Delete purchase order
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const poId = parseInt(id);

      if (isNaN(poId)) {
        return errorResponse('Invalid PO ID');
      }

      const poTable = getTableRef('purchaseOrders');
      const poLinesTable = getTableRef('purchaseOrderLines');

      // Check if PO exists and can be deleted
      const existing = await executeDbOperation(async (db) => {
        const result = await db
          .select({ id: poTable.id, status: poTable.status, poNumber: poTable.poNumber })
          .from(poTable)
          .where(eq(poTable.id, poId))
          .limit(1);
        return result[0] || null;
      });

      if (!existing) {
        return errorResponse('Purchase order not found', 404);
      }

      // Only allow deletion of draft or cancelled POs
      if (!['draft', 'cancelled'].includes(existing.status)) {
        return errorResponse('Only draft or cancelled purchase orders can be deleted');
      }

      // Delete PO lines first
      await executeDbOperation(async (db) => {
        return db.delete(poLinesTable).where(eq(poLinesTable.poId, poId));
      });

      // Delete PO
      await executeDbOperation(async (db) => {
        return db.delete(poTable).where(eq(poTable.id, poId));
      });

      await createAuditLog({
        userId: session.userId,
        action: 'DELETE',
        tableName: 'purchase_orders',
        recordId: poId,
        oldValue: { poNumber: existing.poNumber, status: existing.status },
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: poId }, 'Purchase order deleted successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:write']);
}

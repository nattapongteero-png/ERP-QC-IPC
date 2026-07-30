/**
 * Shipping details on one sales order.
 *
 * PATCH /api/sales/orders/[id]
 *
 * Freight, carrier and tracking number are known at different times: the
 * freight is agreed when the order is taken, but the consignment number only
 * exists once the goods physically leave. Forcing both into the create form
 * would mean either guessing the tracking number or delaying the order, so
 * they are editable afterwards through here.
 *
 * Only these three fields are writable. Quantities, prices and status move
 * through their own flows (fulfil, approve) which carry stock and GL effects;
 * letting a generic PATCH touch them would route around those.
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  notFoundResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const soId = Number(id);
        if (!Number.isInteger(soId) || soId <= 0) {
          return errorResponse('รหัสใบขายไม่ถูกต้อง');
        }

        const body = await request.json();
        const soTable = getTableRef('salesOrders');

        const [existing] = await executeDbOperation(async (db) =>
          db.select().from(soTable).where(eq(soTable.id, soId)).limit(1),
        );
        if (!existing) return notFoundResponse('ไม่พบใบขายนี้');

        const updates: Record<string, unknown> = {};

        if ('shippingCost' in body) {
          // Freight is money and posts to the GL, so a bad value is rejected
          // rather than coerced. See the same rule on create.
          const raw = body.shippingCost;
          const n = raw === null || raw === '' ? 0 : typeof raw === 'string' ? Number(raw) : raw;
          if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
            return errorResponse('ค่าขนส่งต้องเป็นตัวเลขและไม่ติดลบ');
          }
          updates.shippingCost = n;
        }

        // An empty string means "clear it" — a wrong tracking number is worse
        // than none, so the user must be able to take it back out.
        if ('carrier' in body) updates.carrier = body.carrier || null;
        if ('trackingNumber' in body) updates.trackingNumber = body.trackingNumber || null;

        // Manual status move (list items 50/58/59). Only the no-side-effect
        // transitions are allowed here — draft⇄confirmed and cancelling a
        // not-yet-fulfilled order. Anything that touches stock/GL (shipped,
        // delivered) still goes through fulfilment, never this generic PATCH.
        if ('status' in body && body.status && body.status !== existing.status) {
          const ALLOWED: Record<string, string[]> = {
            draft: ['confirmed', 'cancelled'],
            confirmed: ['draft', 'cancelled'],
          };
          const allowed = ALLOWED[existing.status as string] ?? [];
          if (!allowed.includes(body.status)) {
            return errorResponse(
              `เปลี่ยนสถานะจาก "${existing.status}" เป็น "${body.status}" ไม่ได้`,
            );
          }
          updates.status = body.status;
        }

        if (Object.keys(updates).length === 0) {
          return errorResponse('ไม่มีข้อมูลที่จะแก้ไข');
        }

        updates.updatedAt = dbDate();

        await executeDbOperation(async (db) =>
          db.update(soTable).set(updates).where(eq(soTable.id, soId)),
        );

        await createAuditLog({
          userId: session.userId,
          action: 'UPDATE',
          tableName: 'sales_orders',
          recordId: soId,
          oldValue: {
            shippingCost: existing.shippingCost,
            carrier: existing.carrier,
            trackingNumber: existing.trackingNumber,
          },
          newValue: updates,
          ipAddress: getClientIP(request),
        });

        return successResponse({ id: soId }, 'บันทึกข้อมูลการจัดส่งแล้ว');
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['sales:write'],
  );
}

/**
 * Full update of a DRAFT sales order — header fields AND line items.
 *
 * PUT /api/sales/orders/[id]
 *
 * A draft has not reserved stock, shipped, or posted to the GL, so its entire
 * contents (customer, dates, payment terms, and the line items) can be safely
 * rewritten. Once it leaves draft (confirmed/shipped/…) this is refused: those
 * states carry stock and accounting effects and must change through their own
 * flows, never a blanket overwrite. The narrow PATCH above stays the only way
 * to touch a non-draft order (shipping fields / status move).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const soId = Number(id);
        if (!Number.isInteger(soId) || soId <= 0) {
          return errorResponse('รหัสใบขายไม่ถูกต้อง');
        }

        const soTable = getTableRef('salesOrders');
        const soLinesTable = getTableRef('salesOrderLines');

        const [existing] = await executeDbOperation(async (db) =>
          db.select().from(soTable).where(eq(soTable.id, soId)).limit(1),
        );
        if (!existing) return notFoundResponse('ไม่พบใบขายนี้');

        // Only drafts are freely editable. Anything further along has stock/GL
        // effects and must not be rewritten wholesale.
        if (existing.status !== 'draft') {
          return errorResponse('แก้ไขได้เฉพาะใบสั่งขายสถานะ "ร่าง" เท่านั้น');
        }

        const body = await request.json();
        const {
          customerId,
          customerName,
          customerContact,
          customerAddress,
          requiredDate,
          paymentTerms,
          notes,
          shippingCost,
          carrier,
          trackingNumber,
          lines,
        } = body;

        if (!customerName) return errorResponse('กรุณาระบุลูกค้า');
        if (!lines || !Array.isArray(lines) || lines.length === 0) {
          return errorResponse('ต้องมีรายการสินค้าอย่างน้อย 1 รายการ');
        }

        // Freight posts to the GL — reject a bad value rather than coerce it.
        const rawFreight = shippingCost;
        const freight =
          rawFreight === null || rawFreight === undefined || rawFreight === ''
            ? 0
            : typeof rawFreight === 'string'
              ? Number(rawFreight)
              : rawFreight;
        if (typeof freight !== 'number' || !Number.isFinite(freight) || freight < 0) {
          return errorResponse('ค่าขนส่งต้องเป็นตัวเลขและไม่ติดลบ');
        }

        // Prefer the master-data id; fall back to an exact name match so the AR
        // invoice keeps a real buyer (มาตรา 86/4) instead of the id=0 sentinel.
        let resolvedCustomerId: number | null =
          Number.isInteger(customerId) && customerId > 0 ? Number(customerId) : null;
        if (resolvedCustomerId === null) {
          const customersTable = getTableRef('customers');
          const [match] = await executeDbOperation(async (db) =>
            db
              .select({ id: (customersTable as { id: unknown }).id })
              .from(customersTable)
              .where(eq((customersTable as { name: unknown }).name as never, customerName))
              .limit(1),
          );
          resolvedCustomerId = match?.id ?? null;
        }

        const totalAmount = lines.reduce(
          (sum: number, line: { quantity: number; unitPrice: number }) =>
            sum + line.quantity * line.unitPrice,
          0,
        );
        const parsedRequiredDate = requiredDate ? dbDate(new Date(requiredDate)) : null;

        await executeDbOperation(async (db) =>
          db
            .update(soTable)
            .set({
              customerId: resolvedCustomerId,
              customerName,
              customerContact: customerContact ?? null,
              customerAddress: customerAddress ?? null,
              requiredDate: parsedRequiredDate,
              totalAmount,
              paymentTerms: paymentTerms ?? null,
              notes: notes ?? null,
              shippingCost: freight,
              carrier: carrier || null,
              trackingNumber: trackingNumber || null,
              updatedAt: dbDate(),
            })
            .where(eq(soTable.id, soId)),
        );

        // Replace the lines wholesale: a draft's lines have no shipped quantity
        // or downstream reference, so delete-then-insert is safe and keeps the
        // set exactly what the form submitted.
        await executeDbOperation(async (db) =>
          db.delete(soLinesTable).where(eq(soLinesTable.soId, soId)),
        );
        for (const line of lines) {
          await executeDbOperation(async (db) =>
            db.insert(soLinesTable).values({
              soId,
              itemId: line.itemId,
              lotId: line.lotId ?? null,
              quantity: line.quantity,
              shippedQuantity: 0,
              unit: line.unit,
              unitPrice: line.unitPrice,
              totalPrice: line.quantity * line.unitPrice,
              notes: line.notes ?? null,
            }),
          );
        }

        await createAuditLog({
          userId: session.userId,
          action: 'UPDATE',
          tableName: 'sales_orders',
          recordId: soId,
          oldValue: { customerName: existing.customerName, totalAmount: existing.totalAmount },
          newValue: { customerName, totalAmount, linesCount: lines.length },
          ipAddress: getClientIP(request),
        });

        return successResponse({ id: soId }, 'บันทึกการแก้ไขใบสั่งขายแล้ว');
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['sales:write'],
  );
}

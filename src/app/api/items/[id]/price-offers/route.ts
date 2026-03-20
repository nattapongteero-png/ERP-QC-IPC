/**
 * VMI Price Offers API
 * Feature: 008-vmi-vendor-sync
 *
 * CRUD operations for managing VMI price offers for a specific item.
 * Since this system IS the vendor, we use a "SELF" vendor record.
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate, parseDbDate } from '@/lib/db/db-helper';
import { isSqlite } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

// Get or create the SELF vendor ID (cached)
let selfVendorId: number | null = null;
async function getSelfVendorId(): Promise<number> {
  if (selfVendorId !== null) return selfVendorId;

  const vendorsTable = getTableRef('vendors');
  const result = await executeDbOperation(async (db) => {
    return db.select({ id: vendorsTable.id })
      .from(vendorsTable)
      .where(eq(vendorsTable.code, 'SELF'))
      .limit(1);
  });

  if (result.length > 0) {
    selfVendorId = result[0].id;
    return result[0].id;
  }

  // Create SELF vendor if it doesn't exist
  const now = dbDate();
  const newVendor = await executeDbOperation(async (db) => {
    if (isSqlite()) {
      const insertResult = await db.insert(vendorsTable).values({
        code: 'SELF',
        name: 'บริษัท (ตนเอง)',
        isApproved: true,
        isVmi: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }).returning();
      return insertResult[0];
    } else {
      const [insertResult] = await db.insert(vendorsTable).values({
        code: 'SELF',
        name: 'บริษัท (ตนเอง)',
        isApproved: true,
        isVmi: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }).$returningId();
      return { id: insertResult.id };
    }
  });

  selfVendorId = newVendor.id;
  return newVendor.id;
}

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/items/[id]/price-offers - List all price offers for an item
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const itemId = parseInt(id);

      if (isNaN(itemId)) {
        return errorResponse('Invalid item ID');
      }

      const priceOffersTable = getTableRef('VMIPriceOffers');

      const offers = await executeDbOperation(async (db) => {
        return db
          .select({
            id: priceOffersTable.id,
            itemId: priceOffersTable.itemId,
            unitPrice: priceOffersTable.unitPrice,
            packPrice: priceOffersTable.packPrice,
            moq: priceOffersTable.moq,
            leadTimeDays: priceOffersTable.leadTimeDays,
            effectiveDate: priceOffersTable.effectiveDate,
            expiryDate: priceOffersTable.expiryDate,
            isActive: priceOffersTable.isActive,
            syncStatus: priceOffersTable.syncStatus,
            lastSyncedAt: priceOffersTable.lastSyncedAt,
            createdAt: priceOffersTable.createdAt,
            updatedAt: priceOffersTable.updatedAt,
          })
          .from(priceOffersTable)
          .where(eq(priceOffersTable.itemId, itemId))
          .orderBy(priceOffersTable.effectiveDate);
      });

      // Convert MySQL DECIMAL to numbers
      const formattedOffers = offers.map((offer: Record<string, unknown>) => ({
        ...offer,
        unitPrice: Number(offer.unitPrice) || 0,
        packPrice: offer.packPrice ? Number(offer.packPrice) : null,
      }));

      return successResponse(formattedOffers);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['items:read']);
}

// POST /api/items/[id]/price-offers - Create a new price offer
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const itemId = parseInt(id);

      if (isNaN(itemId)) {
        return errorResponse('Invalid item ID');
      }

      const body = await request.json();
      const { unitPrice, packPrice, moq, leadTimeDays, effectiveDate, expiryDate } = body;

      // Validate required fields
      if (unitPrice === undefined || unitPrice === null) {
        return errorResponse('กรุณาระบุราคาต่อหน่วย (Unit price is required)');
      }
      if (unitPrice < 0) {
        return errorResponse('ราคาต่อหน่วยต้องไม่ติดลบ (Unit price cannot be negative)');
      }
      if (unitPrice === 0) {
        return errorResponse('ราคาต่อหน่วยต้องมากกว่า 0 (Unit price must be greater than 0)');
      }
      if (packPrice !== undefined && packPrice !== null && packPrice < 0) {
        return errorResponse('ราคาต่อแพ็คต้องไม่ติดลบ (Pack price cannot be negative)');
      }
      if (!effectiveDate) {
        return errorResponse('กรุณาระบุวันที่มีผล (Effective date is required)');
      }

      // Verify item exists
      const itemsTable = getTableRef('items');
      const item = await executeDbOperation(async (db) => {
        const result = await db.select().from(itemsTable).where(eq(itemsTable.id, itemId)).limit(1);
        return result[0];
      });

      if (!item) {
        return notFoundResponse('Item not found');
      }

      const priceOffersTable = getTableRef('VMIPriceOffers');
      const now = dbDate();
      const vendorId = await getSelfVendorId();

      const newOffer = {
        vendorId,
        itemId,
        unitPrice: unitPrice.toString(),
        packPrice: packPrice ? packPrice.toString() : null,
        moq: moq || null,
        leadTimeDays: leadTimeDays || null,
        effectiveDate: parseDbDate(effectiveDate),
        expiryDate: expiryDate ? parseDbDate(expiryDate) : null,
        isActive: true,
        syncStatus: 'pending',
        createdAt: now,
        updatedAt: now,
      };

      const result = await executeDbOperation(async (db) => {
        if (isSqlite()) {
          const insertResult = await db.insert(priceOffersTable).values(newOffer).returning();
          return insertResult[0];
        } else {
          const [insertResult] = await db.insert(priceOffersTable).values(newOffer).$returningId();
          return { id: insertResult.id };
        }
      });

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'vmi_price_offers',
        recordId: result.id,
        newValue: { itemId, unitPrice, effectiveDate },
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: result.id }, 'Price offer created successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['items:write']);
}

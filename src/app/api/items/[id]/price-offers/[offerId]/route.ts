/**
 * VMI Price Offer Detail API
 * Feature: 008-vmi-vendor-sync
 *
 * GET/PUT/DELETE operations for a specific price offer.
 * Since this system IS the vendor, no vendor field is needed.
 */

import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate, parseDbDate } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

type RouteParams = { params: Promise<{ id: string; offerId: string }> };

// GET /api/items/[id]/price-offers/[offerId] - Get a specific price offer
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id, offerId } = await params;
      const itemId = parseInt(id);
      const priceOfferId = parseInt(offerId);

      if (isNaN(itemId) || isNaN(priceOfferId)) {
        return errorResponse('Invalid ID');
      }

      const priceOffersTable = getTableRef('VMIPriceOffers');

      const offer = await executeDbOperation(async (db) => {
        const result = await db
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
          .where(
            and(
              eq(priceOffersTable.id, priceOfferId),
              eq(priceOffersTable.itemId, itemId)
            )
          )
          .limit(1);
        return result[0];
      });

      if (!offer) {
        return notFoundResponse('Price offer not found');
      }

      // Convert MySQL DECIMAL to numbers
      const formattedOffer = {
        ...offer,
        unitPrice: Number(offer.unitPrice) || 0,
        packPrice: offer.packPrice ? Number(offer.packPrice) : null,
      };

      return successResponse(formattedOffer);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['items:read']);
}

// PUT /api/items/[id]/price-offers/[offerId] - Update a price offer
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id, offerId } = await params;
      const itemId = parseInt(id);
      const priceOfferId = parseInt(offerId);

      if (isNaN(itemId) || isNaN(priceOfferId)) {
        return errorResponse('Invalid ID');
      }

      const body = await request.json();
      const priceOffersTable = getTableRef('VMIPriceOffers');

      // Check if offer exists
      const existing = await executeDbOperation(async (db) => {
        const result = await db
          .select()
          .from(priceOffersTable)
          .where(
            and(
              eq(priceOffersTable.id, priceOfferId),
              eq(priceOffersTable.itemId, itemId)
            )
          )
          .limit(1);
        return result[0];
      });

      if (!existing) {
        return notFoundResponse('Price offer not found');
      }

      // Build update data
      const updateData: Record<string, unknown> = {
        updatedAt: dbDate(),
        syncStatus: 'pending', // Mark as pending since price changed
      };

      if (body.unitPrice !== undefined) {
        if (body.unitPrice < 0) {
          return errorResponse('ราคาต่อหน่วยต้องไม่ติดลบ (Unit price cannot be negative)');
        }
        if (body.unitPrice === 0) {
          return errorResponse('ราคาต่อหน่วยต้องมากกว่า 0 (Unit price must be greater than 0)');
        }
        updateData.unitPrice = body.unitPrice.toString();
      }

      if (body.packPrice !== undefined) {
        if (body.packPrice !== null && body.packPrice < 0) {
          return errorResponse('ราคาต่อแพ็คต้องไม่ติดลบ (Pack price cannot be negative)');
        }
        updateData.packPrice = body.packPrice ? body.packPrice.toString() : null;
      }

      if (body.moq !== undefined) {
        updateData.moq = body.moq || null;
      }

      if (body.leadTimeDays !== undefined) {
        updateData.leadTimeDays = body.leadTimeDays || null;
      }

      if (body.effectiveDate !== undefined) {
        if (!body.effectiveDate) {
          return errorResponse('Effective date is required');
        }
        updateData.effectiveDate = parseDbDate(body.effectiveDate);
      }

      if (body.expiryDate !== undefined) {
        updateData.expiryDate = body.expiryDate ? parseDbDate(body.expiryDate) : null;
      }

      if (body.isActive !== undefined) {
        updateData.isActive = body.isActive;
      }

      await executeDbOperation(async (db) => {
        return db
          .update(priceOffersTable)
          .set(updateData)
          .where(eq(priceOffersTable.id, priceOfferId));
      });

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'vmi_price_offers',
        recordId: priceOfferId,
        oldValue: { unitPrice: existing.unitPrice, isActive: existing.isActive },
        newValue: updateData,
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: priceOfferId }, 'Price offer updated successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['items:write']);
}

// DELETE /api/items/[id]/price-offers/[offerId] - Delete a price offer
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id, offerId } = await params;
      const itemId = parseInt(id);
      const priceOfferId = parseInt(offerId);

      if (isNaN(itemId) || isNaN(priceOfferId)) {
        return errorResponse('Invalid ID');
      }

      const priceOffersTable = getTableRef('VMIPriceOffers');

      // Check if offer exists
      const existing = await executeDbOperation(async (db) => {
        const result = await db
          .select()
          .from(priceOffersTable)
          .where(
            and(
              eq(priceOffersTable.id, priceOfferId),
              eq(priceOffersTable.itemId, itemId)
            )
          )
          .limit(1);
        return result[0];
      });

      if (!existing) {
        return notFoundResponse('Price offer not found');
      }

      // Hard delete the price offer
      await executeDbOperation(async (db) => {
        return db
          .delete(priceOffersTable)
          .where(eq(priceOffersTable.id, priceOfferId));
      });

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'DELETE',
        tableName: 'vmi_price_offers',
        recordId: priceOfferId,
        oldValue: { itemId, unitPrice: existing.unitPrice },
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: priceOfferId }, 'Price offer deleted successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['items:delete']);
}

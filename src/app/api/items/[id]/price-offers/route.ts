/**
 * VMI Price Offers API
 * Feature: 008-vmi-vendor-sync
 *
 * CRUD operations for managing VMI price offers for a specific item
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
      const vendorsTable = getTableRef('vendors');

      const offers = await executeDbOperation(async (db) => {
        return db
          .select({
            id: priceOffersTable.id,
            vendorId: priceOffersTable.vendorId,
            vendorName: vendorsTable.name,
            vendorCode: vendorsTable.code,
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
          .leftJoin(vendorsTable, eq(priceOffersTable.vendorId, vendorsTable.id))
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
      const { vendorId, unitPrice, packPrice, moq, leadTimeDays, effectiveDate, expiryDate } = body;

      // Validate required fields
      if (!vendorId) {
        return errorResponse('Vendor is required');
      }
      if (unitPrice === undefined || unitPrice === null || unitPrice <= 0) {
        return errorResponse('Unit price must be greater than 0');
      }
      if (!effectiveDate) {
        return errorResponse('Effective date is required');
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

      // Verify vendor exists
      const vendorsTable = getTableRef('vendors');
      const vendor = await executeDbOperation(async (db) => {
        const result = await db.select().from(vendorsTable).where(eq(vendorsTable.id, vendorId)).limit(1);
        return result[0];
      });

      if (!vendor) {
        return errorResponse('Vendor not found');
      }

      const priceOffersTable = getTableRef('VMIPriceOffers');
      const now = dbDate();

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
        newValue: { itemId, vendorId, unitPrice, effectiveDate },
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: result.id }, 'Price offer created successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['items:write']);
}

import { NextRequest } from 'next/server';
import { eq, like, or, sql, and, type SQL } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate, getInsertId } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
  getPaginationParams,
  createPaginatedResponse,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';
import { recalculateItemOnHand } from '@/lib/services/inventory.service';

// GET /api/inventory/lots - List inventory lots
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const status = searchParams.get('status') || '';
      const itemId = searchParams.get('itemId') || '';
      const warehouseId = searchParams.get('warehouseId') || '';

      const lotsTable = getTableRef('inventoryLots');
      const itemsTable = getTableRef('items');
      const warehousesTable = getTableRef('warehouses');

      // Build conditions
      const conditions: (SQL | undefined)[] = [];
      if (search) {
        // Search across lot number, batch number, AND item identifiers so
        // users can find a lot by typing the product code or Thai/English
        // item name in addition to the lot/batch numbers. All matches are
        // OR'd together; the main query already inner-joins the items table,
        // so these `like` expressions resolve correctly inside `where(...)`.
        const pattern = `%${search}%`;
        conditions.push(
          or(
            like(lotsTable.lotNumber, pattern),
            like(lotsTable.batchNumber, pattern),
            like(itemsTable.code, pattern),
            like(itemsTable.nameTh, pattern),
            like(itemsTable.nameEn, pattern),
          )
        );
      }
      if (status) {
        conditions.push(eq(lotsTable.status, status));
      }
      if (itemId) {
        conditions.push(eq(lotsTable.itemId, parseInt(itemId)));
      }
      if (warehouseId) {
        conditions.push(eq(lotsTable.warehouseId, parseInt(warehouseId)));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count. We join items here too because the search filter
      // may reference items.code / items.nameTh / items.nameEn — without the
      // join, Drizzle would throw "column not in scope" for those fields.
      const total = await executeDbOperation(async (db) => {
        let countQuery = db
          .select({ count: sql`count(*)` })
          .from(lotsTable)
          .leftJoin(itemsTable, eq(lotsTable.itemId, itemsTable.id));
        if (whereClause) {
          countQuery = countQuery.where(whereClause);
        }
        const countResult = await countQuery;
        return Number(countResult[0]?.count || 0);
      });

      // Get lots with item and warehouse info
      const offset = (pagination.page - 1) * pagination.limit;
      const lots = await executeDbOperation(async (db) => {
        let query = db
          .select({
            id: lotsTable.id,
            lotNumber: lotsTable.lotNumber,
            batchNumber: lotsTable.batchNumber,
            quantity: lotsTable.quantity,
            reservedQuantity: lotsTable.reservedQuantity,
            unit: lotsTable.unit,
            status: lotsTable.status,
            manufacturingDate: lotsTable.manufacturingDate,
            expiryDate: lotsTable.expiryDate,
            receivedDate: lotsTable.receivedDate,
            itemId: lotsTable.itemId,
            itemCode: itemsTable.code,
            itemName: itemsTable.nameTh,
            itemType: itemsTable.type,
            warehouseId: lotsTable.warehouseId,
            warehouseName: warehousesTable.name,
            vendorLotNumber: lotsTable.vendorLotNumber,
            cost: lotsTable.cost,
            createdAt: lotsTable.createdAt,
            // Phase 4: GMP Compliance fields
            manufacturerName: lotsTable.manufacturerName,
            importerName: lotsTable.importerName,
            countryOfOrigin: lotsTable.countryOfOrigin,
            retestDate: lotsTable.retestDate,
            retestStatus: lotsTable.retestStatus,
          })
          .from(lotsTable)
          .leftJoin(itemsTable, eq(lotsTable.itemId, itemsTable.id))
          .leftJoin(warehousesTable, eq(lotsTable.warehouseId, warehousesTable.id));

        if (whereClause) {
          query = query.where(whereClause);
        }

        return query.limit(pagination.limit).offset(offset);
      });

      return successResponse(createPaginatedResponse(lots, total, pagination));
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['inventory:read']);
}

// POST /api/inventory/lots - Create inventory lot (receiving)
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const {
        itemId,
        lotNumber,
        batchNumber,
        warehouseId,
        locationId,
        quantity,
        unit,
        manufacturingDate,
        expiryDate,
        vendorId,
        vendorLotNumber,
        cost,
        poNumber,
        coaNumber,
        // Phase 4: GMP Compliance fields (FR-055, FR-056)
        manufacturerName,
        manufacturerId,
        importerName,
        importerId,
        countryOfOrigin,
        retestDate,
        retestIntervalMonths,
      } = body;

      if (!itemId || !lotNumber || !warehouseId || !quantity || !unit) {
        return errorResponse('Item ID, lot number, warehouse ID, quantity, and unit are required');
      }

      const lotsTable = getTableRef('inventoryLots');
      const transactionsTable = getTableRef('inventoryTransactions');

      // Parse dates properly
      const parsedMfgDate = manufacturingDate ? dbDate(new Date(manufacturingDate)) : null;
      const parsedExpDate = expiryDate ? dbDate(new Date(expiryDate)) : null;
      const parsedRetestDate = retestDate ? dbDate(new Date(retestDate)) : null;

      // Create lot with quarantine status
      const result = await executeDbOperation(async (db) => {
        return db.insert(lotsTable).values({
          itemId,
          lotNumber,
          batchNumber: batchNumber || null,
          warehouseId,
          locationId: locationId || null,
          quantity,
          reservedQuantity: 0,
          unit,
          status: 'quarantine', // Always start in quarantine
          manufacturingDate: parsedMfgDate,
          expiryDate: parsedExpDate,
          receivedDate: dbDate(),
          vendorId: vendorId || null,
          vendorLotNumber: vendorLotNumber || null,
          cost: cost ? parseFloat(cost) : null,
          poNumber: poNumber || null,
          coaNumber: coaNumber || null,
          // Phase 4: GMP Compliance fields
          manufacturerName: manufacturerName || null,
          manufacturerId: manufacturerId || null,
          importerName: importerName || null,
          importerId: importerId || null,
          countryOfOrigin: countryOfOrigin || null,
          retestDate: parsedRetestDate,
          retestIntervalMonths: retestIntervalMonths || null,
          retestStatus: parsedRetestDate ? 'scheduled' : null,
          createdAt: dbDate(),
          updatedAt: dbDate(),
        });
      });

      const lotId = getInsertId(result);

      // Snapshot balance after lot creation
      const lotsTableRef = getTableRef('inventoryLots');
      const [itemBalRow] = await executeDbOperation(async (db) => {
        return db.select({ total: sql`COALESCE(SUM(${lotsTableRef.quantity}), 0)` })
          .from(lotsTableRef)
          .where(eq(lotsTableRef.itemId, itemId));
      });

      // Create receive transaction with balance snapshot
      await executeDbOperation(async (db) => {
        return db.insert(transactionsTable).values({
          lotId: Number(lotId),
          transactionType: 'receive',
          quantity,
          unit,
          referenceType: poNumber ? 'PO' : null,
          referenceId: null,
          referenceNumber: poNumber || null,
          fromWarehouseId: null,
          toWarehouseId: warehouseId,
          reason: null,
          performedBy: session.userId,
          approvedBy: null,
          balanceAfter: quantity,
          itemBalanceAfter: Number(itemBalRow?.total) || 0,
          createdAt: dbDate(),
        });
      });

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'inventory_lots',
        recordId: Number(lotId),
        newValue: { itemId, lotNumber, quantity, warehouseId },
        ipAddress: getClientIP(request),
      });

      // Recalculate item onHand and quarantineQty (new lot starts in quarantine)
      await recalculateItemOnHand(itemId);

      return successResponse({ id: Number(lotId) }, 'Inventory lot created successfully');
    } catch (error) {
      console.error('Error creating inventory lot:', error);
      return serverErrorResponse(error);
    }
  }, ['inventory:write']);
}

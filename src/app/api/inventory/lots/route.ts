import { NextRequest } from 'next/server';
import { eq, like, or, sql, and } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
  getPaginationParams,
  createPaginatedResponse,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

// GET /api/inventory/lots - List inventory lots
export async function GET(request: NextRequest) {
  return withAuth(async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const status = searchParams.get('status') || '';
      const itemId = searchParams.get('itemId') || '';
      const warehouseId = searchParams.get('warehouseId') || '';
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const lotsTable = useSqlite ? schema.sqliteInventoryLots : schema.mysqlInventoryLots;
      const itemsTable = useSqlite ? schema.sqliteItems : schema.mysqlItems;
      const warehousesTable = useSqlite ? schema.sqliteWarehouses : schema.mysqlWarehouses;
      
      // Build conditions
      const conditions = [];
      if (search) {
        conditions.push(
          or(
            like(lotsTable.lotNumber, `%${search}%`),
            like(lotsTable.batchNumber, `%${search}%`)
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
      
      // Get total count
      let countQuery = (db as any).select({ count: sql`count(*)` }).from(lotsTable);
      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions));
      }
      const countResult = await countQuery;
      const total = Number(countResult[0]?.count || 0);
      
      // Get lots with item and warehouse info
      let query = (db as any)
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
          warehouseId: lotsTable.warehouseId,
          warehouseName: warehousesTable.name,
          createdAt: lotsTable.createdAt,
        })
        .from(lotsTable)
        .leftJoin(itemsTable, eq(lotsTable.itemId, itemsTable.id))
        .leftJoin(warehousesTable, eq(lotsTable.warehouseId, warehousesTable.id));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      const offset = (pagination.page - 1) * pagination.limit;
      const lots = await query.limit(pagination.limit).offset(offset);
      
      return successResponse(createPaginatedResponse(lots, total, pagination));
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['inventory:read']);
}

// POST /api/inventory/lots - Create inventory lot (receiving)
export async function POST(request: NextRequest) {
  return withAuth(async (session) => {
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
        poNumber,
        coaNumber,
      } = body;
      
      if (!itemId || !lotNumber || !warehouseId || !quantity || !unit) {
        return errorResponse('Item ID, lot number, warehouse ID, quantity, and unit are required');
      }
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const lotsTable = useSqlite ? schema.sqliteInventoryLots : schema.mysqlInventoryLots;
      const transactionsTable = useSqlite ? schema.sqliteInventoryTransactions : schema.mysqlInventoryTransactions;
      
      // Create lot with quarantine status
      const result = await (db as any).insert(lotsTable).values({
        itemId,
        lotNumber,
        batchNumber,
        warehouseId,
        locationId,
        quantity,
        reservedQuantity: 0,
        unit,
        status: 'quarantine', // Always start in quarantine
        manufacturingDate,
        expiryDate,
        receivedDate: useSqlite ? new Date().toISOString() : new Date(),
        vendorId,
        poNumber,
        coaNumber,
      });
      
      const lotId = useSqlite ? result.lastInsertRowid : result[0].insertId;
      
      // Create receive transaction
      await (db as any).insert(transactionsTable).values({
        lotId: Number(lotId),
        transactionType: 'receive',
        quantity,
        unit,
        referenceType: poNumber ? 'PO' : null,
        referenceNumber: poNumber,
        toWarehouseId: warehouseId,
        performedBy: session.userId,
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
      
      return successResponse({ id: Number(lotId) }, 'Inventory lot created successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['inventory:write']);
}

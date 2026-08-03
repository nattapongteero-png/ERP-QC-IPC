import { NextRequest, NextResponse } from 'next/server';
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';
import { eq, desc, and, gte, lte, sql, type SQL } from 'drizzle-orm';
import { withAuth, createPaginatedResponse } from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const searchParams = request.nextUrl.searchParams;
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const type = searchParams.get('type') || '';
      const dateFrom = searchParams.get('dateFrom') || '';
      const dateTo = searchParams.get('dateTo') || '';
      const offset = (page - 1) * limit;

      const transactions = getTableRef('inventoryTransactions');
      const lots = getTableRef('inventoryLots');
      const items = getTableRef('items');
      const warehouses = getTableRef('warehouses');
      const users = getTableRef('users');

      // Build conditions
      const conditions: (SQL | undefined)[] = [];
      if (type) {
        conditions.push(eq(transactions.transactionType, type));
      }
      if (dateFrom) {
        conditions.push(gte(transactions.createdAt, new Date(dateFrom)));
      }
      if (dateTo) {
        conditions.push(lte(transactions.createdAt, new Date(dateTo + 'T23:59:59')));
      }

      // Get transactions with joins
      const result = await executeDbOperation(async (db) => {
        return db
          .select({
            id: transactions.id,
            transactionNumber: transactions.referenceNumber,
            type: transactions.transactionType,
            lotId: transactions.lotId,
            lotNumber: lots.lotNumber,
            itemCode: items.code,
            itemName: items.nameTh,
            quantity: transactions.quantity,
            unit: lots.unit,
            // Lot unit cost — used to show the movement's value (|qty| × cost).
            unitCost: lots.cost,
            fromWarehouseId: transactions.fromWarehouseId,
            toWarehouseId: transactions.toWarehouseId,
            referenceType: transactions.referenceType,
            referenceId: transactions.referenceId,
            notes: transactions.reason,
            createdBy: transactions.performedBy,
            createdAt: transactions.createdAt,
          })
          .from(transactions)
          .leftJoin(lots, eq(transactions.lotId, lots.id))
          .leftJoin(items, eq(lots.itemId, items.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(transactions.createdAt))
          .limit(limit)
          .offset(offset);
      });

      // Get warehouse names
      const warehouseList = await executeDbOperation(async (db) => {
        return db.select().from(warehouses);
      });
      const warehouseMap = new Map(warehouseList.map((w: { id: number; name: string }) => [w.id, w.name]));

      // Get user names
      const userList = await executeDbOperation(async (db) => {
        return db.select({ id: users.id, name: users.name }).from(users);
      });
      const userMap = new Map(userList.map((u: { id: number; name: string }) => [u.id, u.name]));

      // Enrich results
      const enrichedResult = result.map((t: {
        fromWarehouseId: number | null;
        toWarehouseId: number | null;
        createdBy: number | null;
      }) => ({
        ...t,
        fromWarehouseName: t.fromWarehouseId ? warehouseMap.get(t.fromWarehouseId) : null,
        toWarehouseName: t.toWarehouseId ? warehouseMap.get(t.toWarehouseId) : null,
        createdByName: t.createdBy ? userMap.get(t.createdBy) || 'Unknown' : 'Unknown',
      }));

      // Get total count
      const countResult = await executeDbOperation(async (db) => {
        return db
          .select({ count: sql<number>`count(*)` })
          .from(transactions)
          .where(conditions.length > 0 ? and(...conditions) : undefined);
      });

      const total = Number(countResult[0]?.count || 0);

      return NextResponse.json({ success: true, data: createPaginatedResponse(enrichedResult, total, { page, limit }) });
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch transactions' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      const body = await request.json();
      const { type, lotId, quantity, fromWarehouseId, toWarehouseId, referenceType, notes } = body;

      if (!type || !lotId || !quantity) {
        return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }

      const transactions = getTableRef('inventoryTransactions');
      const lots = getTableRef('inventoryLots');

      // Get the lot
      const lotResult = await executeDbOperation(async (db) => {
        return db.select().from(lots).where(eq(lots.id, lotId));
      });

      if (lotResult.length === 0) {
        return NextResponse.json({ success: false, error: 'Lot not found' }, { status: 404 });
      }
      const lot = lotResult[0];

      // Validate quantity for issue/transfer/scrap
      if (['ISSUE', 'TRANSFER', 'SCRAP'].includes(type)) {
        const availableQty = lot.quantity - (lot.reservedQuantity || 0);
        if (quantity > availableQty) {
          return NextResponse.json(
            { success: false, error: `Insufficient quantity. Available: ${availableQty}` },
            { status: 400 }
          );
        }
      }

      // Generate transaction number
      const now = new Date();
      const prefix = type.substring(0, 3);
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const transactionNumber = `${prefix}-${dateStr}-${random}`;

      // Update lot quantity based on transaction type (BEFORE creating transaction to get correct snapshot)
      let newQuantity = lot.quantity;
      let newWarehouseId = lot.warehouseId;

      switch (type) {
        case 'RECEIVE':
        case 'RETURN':
          newQuantity = lot.quantity + quantity;
          if (toWarehouseId) newWarehouseId = toWarehouseId;
          break;
        case 'ISSUE':
        case 'SCRAP':
          newQuantity = lot.quantity - quantity;
          break;
        case 'TRANSFER':
          if (toWarehouseId) newWarehouseId = toWarehouseId;
          break;
        case 'ADJUST':
          newQuantity = quantity;
          break;
      }

      // Update lot
      await executeDbOperation(async (db) => {
        return db.update(lots).set({
          quantity: newQuantity,
          warehouseId: newWarehouseId,
          updatedAt: dbDate(),
        }).where(eq(lots.id, lotId));
      });

      // Snapshot balance after lot update
      const balanceAfter = newQuantity;
      const [itemBalanceRow] = await executeDbOperation(async (db) => {
        return db.select({ total: sql`COALESCE(SUM(${lots.quantity}), 0)` })
          .from(lots)
          .where(eq(lots.itemId, lot.itemId));
      });
      const itemBalanceAfter = Number(itemBalanceRow?.total) || 0;

      // Create transaction with balance snapshot
      const insertResult = await executeDbOperation(async (db) => {
        return db.insert(transactions).values({
          referenceNumber: transactionNumber,
          transactionType: type,
          lotId,
          quantity,
          unit: lot.unit || 'unit',
          fromWarehouseId: fromWarehouseId || null,
          toWarehouseId: toWarehouseId || null,
          referenceType: referenceType || null,
          referenceId: null,
          reason: notes || null,
          performedBy: user.userId,
          balanceAfter,
          itemBalanceAfter,
          createdAt: dbDate(),
        }).returning();
      });

      const newTransaction = insertResult[0];

      // Log audit
      await createAuditLog({
        userId: user.userId,
        action: 'CREATE',
        tableName: 'inventory_transactions',
        recordId: newTransaction.id,
        newValue: { transactionNumber, type, lotId, quantity },
        ipAddress: getClientIP(request),
      });

      return NextResponse.json({ success: true, data: newTransaction, message: 'Transaction created successfully' });
    } catch (error) {
      console.error('Failed to create transaction:', error);
      return NextResponse.json({ success: false, error: 'Failed to create transaction' }, { status: 500 });
    }
  });
}

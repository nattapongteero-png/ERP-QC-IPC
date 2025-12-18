import { NextRequest, NextResponse } from 'next/server';
import { getDb, useSqlite } from '@/lib/db';
import { 
  sqliteInventoryLots, sqliteInventoryTransactions, sqliteItems, sqliteWarehouses, sqliteUsers,
  mysqlInventoryLots, mysqlInventoryTransactions, mysqlItems, mysqlWarehouses, mysqlUsers
} from '@/lib/db/schema';
import { eq, desc, and, like, or, gte, lte, sql } from 'drizzle-orm';
import { withAuth, successResponse, errorResponse, createPaginatedResponse, serverErrorResponse } from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

export async function GET(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      const db = await getDb();
      const searchParams = request.nextUrl.searchParams;
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const search = searchParams.get('search') || '';
      const type = searchParams.get('type') || '';
      const dateFrom = searchParams.get('dateFrom') || '';
      const dateTo = searchParams.get('dateTo') || '';
      const offset = (page - 1) * limit;

      const transactions = useSqlite() ? sqliteInventoryTransactions : mysqlInventoryTransactions;
      const lots = useSqlite() ? sqliteInventoryLots : mysqlInventoryLots;
      const items = useSqlite() ? sqliteItems : mysqlItems;
      const warehouses = useSqlite() ? sqliteWarehouses : mysqlWarehouses;
      const users = useSqlite() ? sqliteUsers : mysqlUsers;

      // Build conditions
      const conditions = [];
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
      const result = await db
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

      // Get warehouse names
      const warehouseList = await db.select().from(warehouses);
      const warehouseMap = new Map(warehouseList.map((w: any) => [w.id, w.name]));

      // Get user names
      const userList = await db.select({ id: users.id, name: users.name }).from(users);
      const userMap = new Map(userList.map((u: any) => [u.id, u.name]));

      // Enrich results
      const enrichedResult = result.map((t: any) => ({
        ...t,
        fromWarehouseName: t.fromWarehouseId ? warehouseMap.get(t.fromWarehouseId) : null,
        toWarehouseName: t.toWarehouseId ? warehouseMap.get(t.toWarehouseId) : null,
        createdByName: userMap.get(t.createdBy) || 'Unknown',
      }));

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(transactions)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

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
      const db = await getDb();
      const body = await request.json();
      const { type, lotId, quantity, fromWarehouseId, toWarehouseId, referenceType, referenceNumber, notes } = body;

      if (!type || !lotId || !quantity) {
        return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }

      const transactions = useSqlite() ? sqliteInventoryTransactions : mysqlInventoryTransactions;
      const lots = useSqlite() ? sqliteInventoryLots : mysqlInventoryLots;

      // Get the lot
      const [lot] = await db.select().from(lots).where(eq(lots.id, lotId));
      if (!lot) {
        return NextResponse.json({ success: false, error: 'Lot not found' }, { status: 404 });
      }

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
      const isSqlite = useSqlite();
      const prefix = type.substring(0, 3);
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const transactionNumber = `${prefix}-${dateStr}-${random}`;

      // Create transaction
      const [newTransaction] = await db.insert(transactions).values({
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
        createdAt: isSqlite ? now.toISOString() : now,
      }).returning();

      // Update lot quantity based on transaction type
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
          // Adjustment can be positive or negative
          newQuantity = quantity; // Direct set to new quantity
          break;
      }

      // Update lot
      await db.update(lots).set({
        quantity: newQuantity,
        warehouseId: newWarehouseId,
        updatedAt: isSqlite ? now.toISOString() : now,
      }).where(eq(lots.id, lotId));

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

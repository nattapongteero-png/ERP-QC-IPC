import { NextRequest, NextResponse } from 'next/server';
import { getDb, useSqlite } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports/data/inventory-valuation
 * Returns inventory valuation data for reporting
 * Query params:
 *   - warehouseId: Optional warehouse filter
 *   - asOfDate: Optional date filter (defaults to current date)
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isSqlite = useSqlite();
    const { searchParams } = new URL(request.url);

    const warehouseId = searchParams.get('warehouseId');
    const asOfDate = searchParams.get('asOfDate') || new Date().toISOString().split('T')[0];

    // Get the appropriate schema tables
    const itemsTable = isSqlite ? schema.sqliteItems : schema.mysqlItems;
    const lotsTable = isSqlite ? schema.sqliteInventoryLots : schema.mysqlInventoryLots;
    const warehousesTable = isSqlite ? schema.sqliteWarehouses : schema.mysqlWarehouses;

    // Build inventory valuation query
    const conditions = [];

    // Filter by warehouse if specified
    if (warehouseId) {
      conditions.push(eq(lotsTable.warehouseId, parseInt(warehouseId)));
    }

    // Only include released lots (available for use)
    conditions.push(eq(lotsTable.status, 'released'));

    // Query inventory lots with item and warehouse details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await (db as any)
      .select({
        itemCode: itemsTable.code,
        itemName: itemsTable.nameTh,
        itemNameEn: itemsTable.nameEn,
        category: itemsTable.category,
        warehouseCode: warehousesTable.code,
        warehouseName: warehousesTable.name,
        lotNumber: lotsTable.lotNumber,
        quantity: lotsTable.currentQty,
        unitCost: lotsTable.unitCost,
        expirationDate: lotsTable.expirationDate,
      })
      .from(lotsTable)
      .innerJoin(itemsTable, eq(lotsTable.itemId, itemsTable.id))
      .innerJoin(warehousesTable, eq(lotsTable.warehouseId, warehousesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Calculate total value for each row
    const valuationData = results.map((row: {
      itemCode: string;
      itemName: string;
      itemNameEn: string | null;
      category: string | null;
      warehouseCode: string;
      warehouseName: string;
      lotNumber: string;
      quantity: number;
      unitCost: number | null;
      expirationDate: string | null;
    }) => ({
      itemCode: row.itemCode,
      itemName: row.itemName,
      itemNameEn: row.itemNameEn,
      category: row.category || 'Uncategorized',
      warehouseCode: row.warehouseCode,
      warehouseName: row.warehouseName,
      lotNumber: row.lotNumber,
      quantity: row.quantity,
      unitCost: row.unitCost || 0,
      totalValue: (row.quantity || 0) * (row.unitCost || 0),
      expirationDate: row.expirationDate,
    }));

    // Calculate summary statistics
    const summary = {
      totalItems: valuationData.length,
      totalQuantity: valuationData.reduce((sum: number, item: { quantity: number }) => sum + (item.quantity || 0), 0),
      totalValue: valuationData.reduce((sum: number, item: { totalValue: number }) => sum + item.totalValue, 0),
      asOfDate,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: valuationData,
      summary,
    });
  } catch (error) {
    console.error('Inventory valuation report error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate inventory valuation report' },
      { status: 500 }
    );
  }
}

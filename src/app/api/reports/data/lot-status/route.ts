import { NextRequest, NextResponse } from 'next/server';
import { getDb, useSqlite } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports/data/lot-status
 * Returns lot status data for reporting
 * Query params:
 *   - status: Optional status filter (quarantine, released, rejected, expired)
 *   - warehouseId: Optional warehouse filter
 *   - itemType: Optional item type filter
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isSqlite = useSqlite();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const warehouseId = searchParams.get('warehouseId');
    const itemType = searchParams.get('itemType');

    // Get the appropriate schema tables
    const itemsTable = isSqlite ? schema.sqliteItems : schema.mysqlItems;
    const lotsTable = isSqlite ? schema.sqliteInventoryLots : schema.mysqlInventoryLots;
    const warehousesTable = isSqlite ? schema.sqliteWarehouses : schema.mysqlWarehouses;

    // Build conditions
    const conditions = [];

    if (status) {
      conditions.push(eq(lotsTable.status, status));
    }

    if (warehouseId) {
      conditions.push(eq(lotsTable.warehouseId, parseInt(warehouseId)));
    }

    if (itemType) {
      conditions.push(eq(itemsTable.type, itemType));
    }

    // Query lots with item and warehouse details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await (db as any)
      .select({
        lotNumber: lotsTable.lotNumber,
        itemCode: itemsTable.code,
        itemName: itemsTable.nameTh,
        itemNameEn: itemsTable.nameEn,
        itemType: itemsTable.type,
        status: lotsTable.status,
        quantity: lotsTable.currentQty,
        unit: itemsTable.primaryUnit,
        manufacturingDate: lotsTable.manufacturingDate,
        expirationDate: lotsTable.expirationDate,
        warehouseCode: warehousesTable.code,
        warehouseName: warehousesTable.name,
        receivedDate: lotsTable.receivedDate,
      })
      .from(lotsTable)
      .innerJoin(itemsTable, eq(lotsTable.itemId, itemsTable.id))
      .innerJoin(warehousesTable, eq(lotsTable.warehouseId, warehousesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(lotsTable.expirationDate);

    // Calculate days to expiry and format data
    const today = new Date();
    const lotStatusData = results.map((row: {
      lotNumber: string;
      itemCode: string;
      itemName: string;
      itemNameEn: string | null;
      itemType: string;
      status: string;
      quantity: number;
      unit: string;
      manufacturingDate: string | null;
      expirationDate: string | null;
      warehouseCode: string;
      warehouseName: string;
      receivedDate: string | null;
    }) => {
      const expirationDate = row.expirationDate ? new Date(row.expirationDate) : null;
      const daysToExpiry = expirationDate
        ? Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        lotNumber: row.lotNumber,
        itemCode: row.itemCode,
        itemName: row.itemName,
        itemNameEn: row.itemNameEn,
        itemType: row.itemType,
        status: row.status,
        quantity: row.quantity,
        unit: row.unit,
        manufacturingDate: row.manufacturingDate,
        expirationDate: row.expirationDate,
        daysToExpiry,
        isExpired: daysToExpiry !== null && daysToExpiry < 0,
        isNearExpiry: daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 30,
        warehouseCode: row.warehouseCode,
        warehouseName: row.warehouseName,
        receivedDate: row.receivedDate,
      };
    });

    // Calculate summary by status
    const statusSummary = lotStatusData.reduce((acc: Record<string, number>, lot: { status: string }) => {
      acc[lot.status] = (acc[lot.status] || 0) + 1;
      return acc;
    }, {});

    const summary = {
      totalLots: lotStatusData.length,
      statusCounts: statusSummary,
      expiredCount: lotStatusData.filter((l: { isExpired: boolean }) => l.isExpired).length,
      nearExpiryCount: lotStatusData.filter((l: { isNearExpiry: boolean }) => l.isNearExpiry).length,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: lotStatusData,
      summary,
    });
  } catch (error) {
    console.error('Lot status report error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate lot status report' },
      { status: 500 }
    );
  }
}
